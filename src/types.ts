/**
 * openclaw-insight type definitions
 * Mirrors OpenClaw's internal data structures for analysis
 */

// ─── Session Store Types ────────────────────────────────────────────

export interface SessionOrigin {
  provider?: string;
  surface?: string;
  chatType?: string;
  from?: string;
  to?: string;
  accountId?: string;
  threadId?: string;
}

export interface DeliveryContext {
  [key: string]: unknown;
}

export interface SessionEntry {
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
  compactionCount?: number;
  label?: string;
  displayName?: string;
  channel?: string;
  origin?: SessionOrigin;
  deliveryContext?: DeliveryContext;
  spawnedBy?: string;
  spawnDepth?: number;
}

export type SessionStore = Record<string, SessionEntry>;

// ─── Transcript Types ───────────────────────────────────────────────

export interface TranscriptHeader {
  type: 'session';
  version: number;
  id: string;
  timestamp: string;
  cwd?: string;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ContentBlock {
  type: string;
  text?: string;
  name?: string;       // tool_use name
  input?: unknown;     // tool_use input
  tool_use_id?: string;
  content?: string;    // tool_result
}

export interface TranscriptMessage {
  type: 'message';
  message: {
    role: 'user' | 'assistant';
    content: ContentBlock[] | string;
    usage?: TokenUsage;
    timestamp?: number;
    stop_reason?: string;
    model?: string;
  };
}

export interface TranscriptCompaction {
  type: 'compaction';
  summary: string;
  timestamp: string;
}

export type TranscriptLine = TranscriptHeader | TranscriptMessage | TranscriptCompaction;

// ─── Analysis Output Types ──────────────────────────────────────────

export interface HourlyDistribution {
  hour: number;       // 0-23
  sessions: number;
  messages: number;
  tokens: number;
}

export interface DailyActivity {
  date: string;        // YYYY-MM-DD
  sessions: number;
  messages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ChannelStats {
  channel: string;
  sessions: number;
  messages: number;
  totalTokens: number;
  avgTokensPerSession: number;
  avgMessagesPerSession: number;
}

export interface ModelStats {
  model: string;
  provider: string;
  sessions: number;
  totalTokens: number;
  avgTokensPerSession: number;
  cacheHitRate: number;
}

export interface SessionAnalysis {
  sessionId: string;
  channel: string;
  model: string;
  provider: string;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  compactionCount: number;
  duration: number;       // estimated minutes
  toolUses: ToolUseStats[];
  startTime: number;
  endTime: number;
}

export interface ToolUseStats {
  name: string;
  count: number;
}

export interface FrictionEvent {
  type: FrictionType;
  sessionId: string;
  description: string;
  context?: string;
}

export type FrictionType =
  | 'high_token_waste'
  | 'excessive_compactions'
  | 'abandoned_session'
  | 'repeated_retries'
  | 'underutilized_cache'
  | 'context_overflow'
  | 'single_message_sessions';

export interface UsagePattern {
  type: PatternType;
  title: string;
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
}

export type PatternType =
  | 'peak_hours'
  | 'channel_preference'
  | 'model_switching'
  | 'session_length'
  | 'token_efficiency'
  | 'cache_usage'
  | 'tool_preference';

// ─── Suggestion Types ───────────────────────────────────────────────

export interface Suggestion {
  category: SuggestionCategory;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'complex';
  details?: string;
  configSnippet?: string;
}

export type SuggestionCategory =
  | 'token_efficiency'
  | 'channel_optimization'
  | 'model_selection'
  | 'context_management'
  | 'scheduling'
  | 'memory_utilization'
  | 'feature_discovery'
  | 'workflow_improvement';

// ─── Report Types ───────────────────────────────────────────────────

export interface InsightReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  daysAnalyzed: number;
  version: string;

  // Summary stats
  summary: {
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheRead: number;
    totalCacheWrite: number;
    estimatedCostUsd: number;
    activeDays: number;
    avgSessionsPerDay: number;
    avgMessagesPerSession: number;
    avgTokensPerSession: number;
    longestStreak: number;
    uniqueChannels: number;
    uniqueModels: number;
  };

  // Breakdowns
  dailyActivity: DailyActivity[];
  hourlyDistribution: HourlyDistribution[];
  channelStats: ChannelStats[];
  modelStats: ModelStats[];
  sessionAnalyses: SessionAnalysis[];

  // Qualitative
  patterns: UsagePattern[];
  frictions: FrictionEvent[];
  suggestions: Suggestion[];
}

// ─── Config Types ───────────────────────────────────────────────────

export interface InsightConfig {
  stateDir: string;           // ~/.openclaw
  agentId: string;            // default agent
  daysBack: number;           // analysis window (default 30)
  maxSessions: number;        // max sessions to analyze (default 200)
  outputPath: string;         // report output path
  format: 'html' | 'json';   // output format
  verbose: boolean;
}
