/**
 * openclaw-insight — Session Data Collector
 * 
 * Reads and parses OpenClaw session data from the local state directory.
 * Handles sessions.json metadata and individual JSONL transcript files.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  SessionStore,
  SessionEntry,
  SessionAnalysis,
  TranscriptLine,
  TranscriptMessage,
  TranscriptCompaction,
  ToolUseStats,
  ContentBlock,
  InsightConfig,
} from './types.js';
import {
  getSessionsDir,
  parseJson,
  parseJsonl,
  fileExists,
  dateFromTs,
} from './utils.js';

/**
 * Collector: gathers all session data within the analysis window
 */
export class SessionCollector {
  private config: InsightConfig;
  private sessionsDir: string;

  constructor(config: InsightConfig) {
    this.config = config;
    this.sessionsDir = getSessionsDir(config.stateDir, config.agentId);
  }

  /**
   * Collect all sessions within the time window
   */
  async collectSessions(): Promise<SessionEntry[]> {
    const storePath = join(this.sessionsDir, 'sessions.json');
    const store = await parseJson<SessionStore>(storePath);
    
    if (!store) {
      throw new Error(
        `Could not read session store at ${storePath}. ` +
        `Make sure OpenClaw has been used and the state directory is correct.`
      );
    }

    const cutoff = Date.now() - this.config.daysBack * 24 * 60 * 60 * 1000;
    
    // Filter sessions within the time window
    let sessions = Object.values(store)
      .filter(s => {
        const ts = s.updatedAt < 1e12 ? s.updatedAt * 1000 : s.updatedAt;
        return ts >= cutoff;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // Filter out sub-agent sessions (spawned sessions)
    sessions = sessions.filter(s => !s.spawnedBy);

    // Apply max sessions limit
    if (sessions.length > this.config.maxSessions) {
      sessions = sessions.slice(0, this.config.maxSessions);
    }

    return sessions;
  }

  /**
   * Analyze a single session by reading its transcript
   */
  async analyzeSession(entry: SessionEntry): Promise<SessionAnalysis> {
    const transcriptPath = this.resolveTranscriptPath(entry);
    const lines = transcriptPath
      ? await parseJsonl<TranscriptLine>(transcriptPath)
      : [];

    // Extract messages
    const messages = lines.filter(
      (l): l is TranscriptMessage => l.type === 'message'
    );
    const compactions = lines.filter(
      (l): l is TranscriptCompaction => l.type === 'compaction'
    );

    // Count messages by role
    const userMessages = messages.filter(m => m.message.role === 'user').length;
    const assistantMessages = messages.filter(m => m.message.role === 'assistant').length;

    // Aggregate token usage from transcript messages
    let transcriptInputTokens = 0;
    let transcriptOutputTokens = 0;
    let transcriptCacheRead = 0;
    let transcriptCacheWrite = 0;

    for (const msg of messages) {
      const usage = msg.message.usage;
      if (usage) {
        transcriptInputTokens += usage.input_tokens || 0;
        transcriptOutputTokens += usage.output_tokens || 0;
        transcriptCacheRead += usage.cache_read_input_tokens || 0;
        transcriptCacheWrite += usage.cache_creation_input_tokens || 0;
      }
    }

    // Use session-level totals if available, fall back to transcript aggregation
    const inputTokens = entry.inputTokens || transcriptInputTokens;
    const outputTokens = entry.outputTokens || transcriptOutputTokens;
    const totalTokens = entry.totalTokens || (inputTokens + outputTokens);
    const cacheReadTokens = entry.cacheRead || transcriptCacheRead;
    const cacheWriteTokens = entry.cacheWrite || transcriptCacheWrite;

    // Extract timestamps for duration estimation
    const timestamps = messages
      .map(m => m.message.timestamp)
      .filter((t): t is number => t !== undefined);
    
    const startTime = timestamps.length > 0 ? Math.min(...timestamps) : entry.updatedAt;
    const endTime = timestamps.length > 0 ? Math.max(...timestamps) : entry.updatedAt;
    
    // Duration in minutes
    const startMs = startTime < 1e12 ? startTime * 1000 : startTime;
    const endMs = endTime < 1e12 ? endTime * 1000 : endTime;
    const duration = Math.max(1, (endMs - startMs) / (1000 * 60));

    // Extract tool usage from assistant messages
    const toolUses = this.extractToolUses(messages);

    return {
      sessionId: entry.sessionId,
      channel: entry.channel || entry.origin?.surface || 'unknown',
      model: entry.model || 'unknown',
      provider: entry.modelProvider || 'unknown',
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      compactionCount: entry.compactionCount || compactions.length,
      duration,
      toolUses,
      startTime: startMs,
      endTime: endMs,
    };
  }

  /**
   * Collect and analyze all sessions in the time window
   */
  async collectAndAnalyze(
    onProgress?: (current: number, total: number) => void
  ): Promise<SessionAnalysis[]> {
    const sessions = await this.collectSessions();
    const analyses: SessionAnalysis[] = [];

    for (let i = 0; i < sessions.length; i++) {
      const analysis = await this.analyzeSession(sessions[i]);
      analyses.push(analysis);
      onProgress?.(i + 1, sessions.length);
    }

    return analyses;
  }

  /**
   * Resolve the transcript file path for a session
   */
  private resolveTranscriptPath(entry: SessionEntry): string | null {
    if (entry.sessionFile) {
      return entry.sessionFile;
    }
    return join(this.sessionsDir, `${entry.sessionId}.jsonl`);
  }

  /**
   * Extract tool usage statistics from messages
   */
  private extractToolUses(messages: TranscriptMessage[]): ToolUseStats[] {
    const toolCounts = new Map<string, number>();

    for (const msg of messages) {
      if (msg.message.role !== 'assistant') continue;
      
      const content = msg.message.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (block.type === 'tool_use' && block.name) {
          toolCounts.set(block.name, (toolCounts.get(block.name) || 0) + 1);
        }
      }
    }

    return Array.from(toolCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * List available agent IDs in the state directory
   */
  static async listAgents(stateDir: string): Promise<string[]> {
    const agentsDir = join(stateDir, 'agents');
    try {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }
  }
}
