/**
 * openclaw-insight utility functions
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { InsightConfig } from './types.js';

/**
 * Resolve the OpenClaw state directory
 */
export function resolveStateDir(): string {
  return process.env.OPENCLAW_STATE_DIR || join(homedir(), '.openclaw');
}

/**
 * Find the default agent ID by scanning the agents directory
 */
export async function findDefaultAgentId(stateDir: string): Promise<string | null> {
  const agentsDir = join(stateDir, 'agents');
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agentDirs = entries.filter(e => e.isDirectory());
    if (agentDirs.length === 0) return null;
    // Return the first (or only) agent
    return agentDirs[0].name;
  } catch {
    return null;
  }
}

/**
 * Get the sessions directory for an agent
 */
export function getSessionsDir(stateDir: string, agentId: string): string {
  return join(stateDir, 'agents', agentId, 'sessions');
}

/**
 * Parse a JSONL file, returning an array of parsed objects
 * Gracefully handles malformed lines
 */
export async function parseJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const results: T[] = [];
    for (const line of lines) {
      try {
        results.push(JSON.parse(line) as T);
      } catch {
        // skip malformed lines
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Parse a JSON file, returning null on failure
 */
export async function parseJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a number with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format token count to human-readable
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format cost in USD
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format duration in minutes to human-readable
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

/**
 * Calculate percentage
 */
export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Get date string from timestamp (YYYY-MM-DD)
 */
export function dateFromTs(ts: number): string {
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get hour from timestamp (0-23)
 */
export function hourFromTs(ts: number): number {
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return d.getHours();
}

/**
 * Calculate the longest consecutive streak of dates
 */
export function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let maxStreak = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const nextDay = new Date(prev);
    nextDay.setDate(nextDay.getDate() + 1);
    const expected = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    if (sorted[i] === expected) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 1;
    }
  }
  return maxStreak;
}

/**
 * Estimate cost based on model and token counts
 * Rough pricing estimates for common models
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-opus':     { input: 15.0,  output: 75.0 },
    'claude-3-sonnet':   { input: 3.0,   output: 15.0 },
    'claude-3-haiku':    { input: 0.25,  output: 1.25 },
    'claude-3.5-sonnet': { input: 3.0,   output: 15.0 },
    'claude-3-5-sonnet': { input: 3.0,   output: 15.0 },
    'claude-3.5-haiku':  { input: 0.80,  output: 4.0 },
    'claude-3-5-haiku':  { input: 0.80,  output: 4.0 },
    'claude-4-sonnet':   { input: 3.0,   output: 15.0 },
    'claude-4-opus':     { input: 15.0,  output: 75.0 },
    'gpt-4o-mini':       { input: 0.15,  output: 0.60 },
    'gpt-4o':            { input: 2.50,  output: 10.0 },
    'gpt-4-turbo':       { input: 10.0,  output: 30.0 },
  };

  const defaultTier = { input: 3.0, output: 15.0 };
  const modelLower = model.toLowerCase();
  let tier = defaultTier;
  let bestLen = 0;
  for (const [key, value] of Object.entries(pricing)) {
    if (modelLower.includes(key) && key.length > bestLen) {
      tier = value;
      bestLen = key.length;
    }
  }

  return (inputTokens * tier.input + outputTokens * tier.output) / 1_000_000;
}

/**
 * Default config factory
 */
export function defaultConfig(): InsightConfig {
  const stateDir = resolveStateDir();
  return {
    stateDir,
    agentId: '',
    daysBack: 30,
    maxSessions: 200,
    outputPath: join(stateDir, 'usage-data', 'report.html'),
    format: 'html',
    verbose: false,
  };
}

/**
 * Create a simple progress bar string
 */
export function progressBar(current: number, total: number, width: number = 30): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`;
}
