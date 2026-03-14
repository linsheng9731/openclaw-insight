/**
 * openclaw-insight — Usage Analysis Engine
 * 
 * Processes collected session data to generate comprehensive usage statistics,
 * detect behavior patterns, and identify friction points.
 */

import type {
  SessionAnalysis,
  DailyActivity,
  HourlyDistribution,
  ChannelStats,
  ModelStats,
  UsagePattern,
  FrictionEvent,
  InsightReport,
} from './types.js';
import {
  dateFromTs,
  hourFromTs,
  longestStreak,
  estimateCost,
  pct,
} from './utils.js';

/**
 * Analyzer: transforms raw session data into structured insights
 */
export class UsageAnalyzer {
  private sessions: SessionAnalysis[];
  private daysBack: number;

  constructor(sessions: SessionAnalysis[], daysBack: number) {
    this.sessions = sessions;
    this.daysBack = daysBack;
  }

  /**
   * Generate the complete insight report
   */
  generateReport(): InsightReport {
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now.getTime() - this.daysBack * 86400000)
      .toISOString()
      .slice(0, 10);

    const dailyActivity = this.computeDailyActivity();
    const hourlyDistribution = this.computeHourlyDistribution();
    const channelStats = this.computeChannelStats();
    const modelStats = this.computeModelStats();
    const patterns = this.detectPatterns();
    const frictions = this.detectFrictions();

    // Compute summary
    const totalSessions = this.sessions.length;
    const totalMessages = this.sessions.reduce((s, a) => s + a.messageCount, 0);
    const totalTokens = this.sessions.reduce((s, a) => s + a.totalTokens, 0);
    const totalInputTokens = this.sessions.reduce((s, a) => s + a.inputTokens, 0);
    const totalOutputTokens = this.sessions.reduce((s, a) => s + a.outputTokens, 0);
    const totalCacheRead = this.sessions.reduce((s, a) => s + a.cacheReadTokens, 0);
    const totalCacheWrite = this.sessions.reduce((s, a) => s + a.cacheWriteTokens, 0);
    const activeDays = new Set(dailyActivity.map(d => d.date)).size;
    const uniqueChannels = new Set(this.sessions.map(s => s.channel)).size;
    const uniqueModels = new Set(this.sessions.map(s => s.model)).size;
    const streak = longestStreak(dailyActivity.map(d => d.date));

    // Estimate total cost
    const estimatedCostUsd = this.sessions.reduce((sum, s) => {
      return sum + estimateCost(s.model, s.inputTokens, s.outputTokens);
    }, 0);

    return {
      generatedAt: now.toISOString(),
      periodStart,
      periodEnd,
      daysAnalyzed: this.daysBack,
      summary: {
        totalSessions,
        totalMessages,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalCacheRead,
        totalCacheWrite,
        estimatedCostUsd,
        activeDays,
        avgSessionsPerDay: activeDays > 0 ? Math.round(totalSessions / activeDays * 10) / 10 : 0,
        avgMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions * 10) / 10 : 0,
        avgTokensPerSession: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
        longestStreak: streak,
        uniqueChannels,
        uniqueModels,
      },
      dailyActivity,
      hourlyDistribution,
      channelStats,
      modelStats,
      sessionAnalyses: this.sessions,
      patterns,
      frictions,
      suggestions: [], // populated by SuggestionGenerator
    };
  }

  /**
   * Compute daily activity breakdown
   */
  private computeDailyActivity(): DailyActivity[] {
    const byDate = new Map<string, DailyActivity>();

    for (const session of this.sessions) {
      const date = dateFromTs(session.startTime);
      const existing = byDate.get(date) || {
        date,
        sessions: 0,
        messages: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      existing.sessions++;
      existing.messages += session.messageCount;
      existing.totalTokens += session.totalTokens;
      existing.inputTokens += session.inputTokens;
      existing.outputTokens += session.outputTokens;
      byDate.set(date, existing);
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Compute hourly distribution of activity
   */
  private computeHourlyDistribution(): HourlyDistribution[] {
    const hours: HourlyDistribution[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      sessions: 0,
      messages: 0,
      tokens: 0,
    }));

    for (const session of this.sessions) {
      const hour = hourFromTs(session.startTime);
      hours[hour].sessions++;
      hours[hour].messages += session.messageCount;
      hours[hour].tokens += session.totalTokens;
    }

    return hours;
  }

  /**
   * Compute per-channel statistics
   */
  private computeChannelStats(): ChannelStats[] {
    const byChannel = new Map<string, ChannelStats>();

    for (const session of this.sessions) {
      const ch = session.channel || 'unknown';
      const existing = byChannel.get(ch) || {
        channel: ch,
        sessions: 0,
        messages: 0,
        totalTokens: 0,
        avgTokensPerSession: 0,
        avgMessagesPerSession: 0,
      };
      existing.sessions++;
      existing.messages += session.messageCount;
      existing.totalTokens += session.totalTokens;
      byChannel.set(ch, existing);
    }

    // Compute averages
    for (const stats of byChannel.values()) {
      stats.avgTokensPerSession = Math.round(stats.totalTokens / stats.sessions);
      stats.avgMessagesPerSession = Math.round(stats.messages / stats.sessions * 10) / 10;
    }

    return Array.from(byChannel.values()).sort((a, b) => b.sessions - a.sessions);
  }

  /**
   * Compute per-model statistics
   */
  private computeModelStats(): ModelStats[] {
    const byModel = new Map<string, ModelStats>();

    for (const session of this.sessions) {
      const key = `${session.model}::${session.provider}`;
      const existing = byModel.get(key) || {
        model: session.model,
        provider: session.provider,
        sessions: 0,
        totalTokens: 0,
        avgTokensPerSession: 0,
        cacheHitRate: 0,
      };
      existing.sessions++;
      existing.totalTokens += session.totalTokens;
      byModel.set(key, existing);
    }

    // Compute averages and cache hit rates
    for (const [key, stats] of byModel) {
      stats.avgTokensPerSession = Math.round(stats.totalTokens / stats.sessions);
      
      // Cache hit rate: ratio of cache read tokens to total input tokens
      const modelSessions = this.sessions.filter(
        s => `${s.model}::${s.provider}` === key
      );
      const totalInput = modelSessions.reduce((s, a) => s + a.inputTokens, 0);
      const totalCacheRead = modelSessions.reduce((s, a) => s + a.cacheReadTokens, 0);
      stats.cacheHitRate = totalInput > 0
        ? Math.round((totalCacheRead / totalInput) * 1000) / 10
        : 0;
    }

    return Array.from(byModel.values()).sort((a, b) => b.sessions - a.sessions);
  }

  /**
   * Detect notable usage patterns
   */
  private detectPatterns(): UsagePattern[] {
    const patterns: UsagePattern[] = [];

    // Peak hours pattern
    const hourly = this.computeHourlyDistribution();
    const peakHour = hourly.reduce((max, h) =>
      h.sessions > max.sessions ? h : max, hourly[0]);
    if (peakHour.sessions > 0) {
      const peakRange = this.findPeakRange(hourly);
      patterns.push({
        type: 'peak_hours',
        title: 'Peak Activity Hours',
        description: `Most active during ${peakRange}. Peak hour is ${peakHour.hour}:00 with ${peakHour.sessions} sessions.`,
        frequency: peakHour.sessions,
        impact: 'medium',
      });
    }

    // Channel preference pattern
    const channels = this.computeChannelStats();
    if (channels.length > 1) {
      const topChannel = channels[0];
      const topPct = pct(topChannel.sessions, this.sessions.length);
      patterns.push({
        type: 'channel_preference',
        title: 'Channel Preference',
        description: `Primary channel: ${topChannel.channel} (${topPct}% of sessions). ${channels.length} channels used in total.`,
        frequency: topChannel.sessions,
        impact: topPct > 80 ? 'high' : 'medium',
      });
    }

    // Session length pattern
    const durations = this.sessions.map(s => s.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const shortSessions = this.sessions.filter(s => s.duration < 2).length;
    const longSessions = this.sessions.filter(s => s.duration > 30).length;
    patterns.push({
      type: 'session_length',
      title: 'Session Duration Profile',
      description: `Average session: ${Math.round(avgDuration)}min. ${shortSessions} quick sessions (<2min), ${longSessions} long sessions (>30min).`,
      frequency: this.sessions.length,
      impact: 'medium',
    });

    // Token efficiency pattern
    const totalTokens = this.sessions.reduce((s, a) => s + a.totalTokens, 0);
    const totalCacheRead = this.sessions.reduce((s, a) => s + a.cacheReadTokens, 0);
    const cacheRate = pct(totalCacheRead, totalTokens);
    patterns.push({
      type: 'cache_usage',
      title: 'Cache Utilization',
      description: `Cache hit rate: ${cacheRate}%. ${totalCacheRead > 0 ? 'Cache is actively reducing token consumption.' : 'Cache appears underutilized.'}`,
      frequency: this.sessions.length,
      impact: cacheRate < 10 ? 'high' : 'low',
    });

    // Model switching pattern
    const models = this.computeModelStats();
    if (models.length > 1) {
      patterns.push({
        type: 'model_switching',
        title: 'Model Diversity',
        description: `Using ${models.length} different models. Primary: ${models[0].model} (${pct(models[0].sessions, this.sessions.length)}% of sessions).`,
        frequency: models.length,
        impact: 'low',
      });
    }

    // Tool preference pattern
    const toolAgg = new Map<string, number>();
    for (const session of this.sessions) {
      for (const tool of session.toolUses) {
        toolAgg.set(tool.name, (toolAgg.get(tool.name) || 0) + tool.count);
      }
    }
    const topTools = Array.from(toolAgg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topTools.length > 0) {
      patterns.push({
        type: 'tool_preference',
        title: 'Top Tools',
        description: `Most used tools: ${topTools.map(([name, count]) => `${name} (${count}x)`).join(', ')}`,
        frequency: topTools.reduce((s, [, c]) => s + c, 0),
        impact: 'medium',
      });
    }

    return patterns;
  }

  /**
   * Detect friction events — inefficiencies and pain points
   */
  private detectFrictions(): FrictionEvent[] {
    const frictions: FrictionEvent[] = [];

    for (const session of this.sessions) {
      // High token waste: sessions with very high output relative to input
      if (session.outputTokens > session.inputTokens * 5 && session.totalTokens > 10000) {
        frictions.push({
          type: 'high_token_waste',
          sessionId: session.sessionId,
          description: `Session consumed ${session.totalTokens.toLocaleString()} tokens with a ${Math.round(session.outputTokens / session.inputTokens)}:1 output/input ratio. Consider more specific prompts.`,
        });
      }

      // Excessive compactions: hitting context limits frequently
      if (session.compactionCount >= 3) {
        frictions.push({
          type: 'excessive_compactions',
          sessionId: session.sessionId,
          description: `Session had ${session.compactionCount} context compactions. This suggests very long conversations that may benefit from being split into smaller tasks.`,
        });
      }

      // Abandoned sessions: very few messages
      if (session.messageCount <= 2 && session.totalTokens > 1000) {
        frictions.push({
          type: 'abandoned_session',
          sessionId: session.sessionId,
          description: `Session had only ${session.messageCount} messages but consumed ${session.totalTokens.toLocaleString()} tokens. May indicate an abandoned or misdirected session.`,
        });
      }

      // Single message sessions
      if (session.userMessages === 1 && session.assistantMessages <= 1) {
        frictions.push({
          type: 'single_message_sessions',
          sessionId: session.sessionId,
          description: `Single-exchange session on ${session.channel}. Consider batching related questions for efficiency.`,
        });
      }

      // Underutilized cache
      if (session.inputTokens > 50000 && session.cacheReadTokens === 0) {
        frictions.push({
          type: 'underutilized_cache',
          sessionId: session.sessionId,
          description: `Session used ${session.inputTokens.toLocaleString()} input tokens with zero cache hits. Prompt caching could significantly reduce costs.`,
        });
      }

      // Context overflow signal: high compaction + high tokens
      if (session.compactionCount >= 2 && session.totalTokens > 100000) {
        frictions.push({
          type: 'context_overflow',
          sessionId: session.sessionId,
          description: `Session consumed ${session.totalTokens.toLocaleString()} tokens with ${session.compactionCount} compactions. The conversation likely exceeded the model's context window multiple times.`,
        });
      }
    }

    return frictions;
  }

  /**
   * Find the peak activity time range (e.g., "9:00-18:00")
   */
  private findPeakRange(hourly: HourlyDistribution[]): string {
    const totalSessions = hourly.reduce((s, h) => s + h.sessions, 0);
    if (totalSessions === 0) return '—';

    // Find contiguous block containing 80% of sessions
    let bestStart = 0;
    let bestEnd = 23;
    let bestSpan = 24;

    for (let start = 0; start < 24; start++) {
      let sum = 0;
      for (let len = 1; len <= 24; len++) {
        const idx = (start + len - 1) % 24;
        sum += hourly[idx].sessions;
        if (sum >= totalSessions * 0.8 && len < bestSpan) {
          bestStart = start;
          bestEnd = (start + len - 1) % 24;
          bestSpan = len;
          break;
        }
      }
    }

    return `${bestStart}:00–${bestEnd + 1}:00`;
  }
}
