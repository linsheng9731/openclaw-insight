/**
 * openclaw-insight — Improvement Suggestions Generator
 * 
 * Analyzes usage patterns and friction events to generate
 * actionable improvement recommendations.
 */

import type {
  InsightReport,
  Suggestion,
  FrictionEvent,
  UsagePattern,
  SessionAnalysis,
  ChannelStats,
  ModelStats,
} from './types.js';
import { pct, formatTokens, formatCost, estimateCost } from './utils.js';

/**
 * SuggestionGenerator: produces actionable recommendations
 */
export class SuggestionGenerator {
  private report: InsightReport;

  constructor(report: InsightReport) {
    this.report = report;
  }

  /**
   * Generate all suggestions based on the report data
   */
  generateAll(): Suggestion[] {
    const suggestions: Suggestion[] = [];

    suggestions.push(...this.tokenEfficiencySuggestions());
    suggestions.push(...this.channelOptimizationSuggestions());
    suggestions.push(...this.modelSelectionSuggestions());
    suggestions.push(...this.contextManagementSuggestions());
    suggestions.push(...this.schedulingSuggestions());
    suggestions.push(...this.memoryUtilizationSuggestions());
    suggestions.push(...this.featureDiscoverySuggestions());
    suggestions.push(...this.workflowSuggestions());

    // Sort by impact (high first), then effort (easy first)
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { easy: 0, moderate: 1, complex: 2 };
    suggestions.sort((a, b) => {
      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
      if (impactDiff !== 0) return impactDiff;
      return effortOrder[a.effort] - effortOrder[b.effort];
    });

    return suggestions;
  }

  // ─── Token Efficiency ─────────────────────────────────────────

  private tokenEfficiencySuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { summary } = this.report;

    // Cache utilization improvement
    const cacheRate = summary.totalTokens > 0
      ? pct(summary.totalCacheRead, summary.totalInputTokens)
      : 0;
    
    if (cacheRate < 15 && summary.totalInputTokens > 100000) {
      const potentialSaving = summary.totalInputTokens * 0.3; // 30% could be cached
      suggestions.push({
        category: 'token_efficiency',
        title: 'Improve Prompt Caching',
        description: `Your cache hit rate is only ${cacheRate}%. With better prompt structuring, you could save ~${formatTokens(potentialSaving)} tokens.`,
        impact: 'high',
        effort: 'moderate',
        details: 'Place stable system prompts and context at the beginning of your messages. Frequently repeated instructions should be in a consistent prefix that the cache can match.',
        configSnippet: '// In your OpenClaw agent config, ensure system prompts are\n// placed as the first content block for optimal cache hits.',
      });
    }

    // High token waste detection
    const wastefulSessions = this.report.frictions.filter(
      f => f.type === 'high_token_waste'
    );
    if (wastefulSessions.length > 3) {
      suggestions.push({
        category: 'token_efficiency',
        title: 'Reduce Output Verbosity',
        description: `${wastefulSessions.length} sessions had excessive output/input ratios. The assistant may be generating overly verbose responses.`,
        impact: 'high',
        effort: 'easy',
        details: 'Add instructions to your agent configuration asking for concise responses. You can specify "Be concise" or set a preferred response length in your system prompt.',
      });
    }

    // Single message session pattern
    const singleMsg = this.report.frictions.filter(
      f => f.type === 'single_message_sessions'
    );
    const singleMsgPct = pct(singleMsg.length, summary.totalSessions);
    if (singleMsgPct > 30) {
      suggestions.push({
        category: 'token_efficiency',
        title: 'Batch Related Questions',
        description: `${singleMsgPct}% of your sessions are single-exchange. Batching related questions into one session reduces overhead tokens from system prompts.`,
        impact: 'medium',
        effort: 'easy',
        details: 'Instead of starting a new conversation for each small question, group related queries into a single session. This amortizes the cost of system prompts and context loading.',
      });
    }

    return suggestions;
  }

  // ─── Channel Optimization ─────────────────────────────────────

  private channelOptimizationSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { channelStats } = this.report;

    if (channelStats.length === 0) return suggestions;

    // Channel concentration warning
    const topChannel = channelStats[0];
    const topPct = pct(topChannel.sessions, this.report.summary.totalSessions);
    
    if (topPct > 90 && channelStats.length === 1) {
      suggestions.push({
        category: 'channel_optimization',
        title: 'Explore Multi-Channel Access',
        description: `You're exclusively using ${topChannel.channel}. OpenClaw supports 20+ channels. Consider accessing your assistant from the platform most convenient for each context.`,
        impact: 'medium',
        effort: 'moderate',
        details: 'For quick questions, try the TUI or a mobile channel. For complex tasks, use the web Canvas. For team collaboration, Slack or Teams integration can be valuable.',
      });
    }

    // Channel-specific token efficiency
    for (const ch of channelStats) {
      if (ch.sessions < 5) continue;
      const avgEfficiency = ch.avgTokensPerSession / Math.max(ch.avgMessagesPerSession, 1);
      const overallAvg = this.report.summary.avgTokensPerSession / Math.max(this.report.summary.avgMessagesPerSession, 1);
      
      if (avgEfficiency > overallAvg * 2) {
        suggestions.push({
          category: 'channel_optimization',
          title: `High Token Cost on ${ch.channel}`,
          description: `Sessions on ${ch.channel} consume ${Math.round(avgEfficiency)} tokens/message vs ${Math.round(overallAvg)} overall average. This channel may benefit from more focused conversations.`,
          impact: 'medium',
          effort: 'easy',
        });
      }
    }

    return suggestions;
  }

  // ─── Model Selection ──────────────────────────────────────────

  private modelSelectionSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { modelStats } = this.report;

    if (modelStats.length === 0) return suggestions;

    // Always using expensive models for simple tasks
    const expensiveModels = modelStats.filter(m =>
      m.model.includes('opus') || m.model.includes('gpt-4-turbo')
    );
    const cheapModels = modelStats.filter(m =>
      m.model.includes('haiku') || m.model.includes('mini')
    );
    
    if (expensiveModels.length > 0 && cheapModels.length === 0) {
      const totalExpensiveSessions = expensiveModels.reduce((s, m) => s + m.sessions, 0);
      if (totalExpensiveSessions > 10) {
        suggestions.push({
          category: 'model_selection',
          title: 'Use Smaller Models for Simple Tasks',
          description: `You've used premium models (${expensiveModels.map(m => m.model).join(', ')}) for all ${totalExpensiveSessions} sessions. Consider routing simple queries to smaller, faster, cheaper models like Haiku or GPT-4o-mini.`,
          impact: 'high',
          effort: 'moderate',
          details: 'OpenClaw can be configured to automatically route simple queries to cheaper models while reserving premium models for complex tasks. This can reduce costs by 60-80% for routine queries.',
        });
      }
    }

    // Low cache hit rate on a specific model
    for (const model of modelStats) {
      if (model.sessions < 5) continue;
      if (model.cacheHitRate < 5 && model.totalTokens > 50000) {
        suggestions.push({
          category: 'model_selection',
          title: `Low Cache Hit Rate on ${model.model}`,
          description: `Cache hit rate for ${model.model} is only ${model.cacheHitRate}%. Consistent prompt structuring could improve this significantly.`,
          impact: 'medium',
          effort: 'moderate',
        });
      }
    }

    return suggestions;
  }

  // ─── Context Management ───────────────────────────────────────

  private contextManagementSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // High compaction frequency
    const compactingSessions = this.report.frictions.filter(
      f => f.type === 'excessive_compactions' || f.type === 'context_overflow'
    );
    
    if (compactingSessions.length > 5) {
      suggestions.push({
        category: 'context_management',
        title: 'Split Long Conversations',
        description: `${compactingSessions.length} sessions hit context limits multiple times. Long conversations lose context quality after compaction.`,
        impact: 'high',
        effort: 'easy',
        details: 'When a task has distinct sub-tasks, start fresh sessions for each. This gives the assistant full context window for each sub-task rather than a compressed summary of the entire conversation. Use OpenClaw\'s memory features to maintain continuity across sessions.',
      });
    }

    // Sessions with very high token counts
    const heavySessions = this.report.sessionAnalyses.filter(
      s => s.totalTokens > 200000
    );
    if (heavySessions.length > 3) {
      suggestions.push({
        category: 'context_management',
        title: 'Monitor Token-Heavy Sessions',
        description: `${heavySessions.length} sessions exceeded 200K tokens. Consider setting token budgets or session time limits.`,
        impact: 'medium',
        effort: 'moderate',
        details: 'Very long sessions tend to have diminishing returns on quality. The assistant\'s attention degrades as context grows. Break complex tasks into focused sessions of 50-100K tokens each.',
      });
    }

    return suggestions;
  }

  // ─── Scheduling ───────────────────────────────────────────────

  private schedulingSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { hourlyDistribution } = this.report;

    // Late night usage
    const nightSessions = hourlyDistribution
      .filter(h => h.hour >= 23 || h.hour <= 5)
      .reduce((s, h) => s + h.sessions, 0);
    const nightPct = pct(nightSessions, this.report.summary.totalSessions);
    
    if (nightPct > 20) {
      suggestions.push({
        category: 'scheduling',
        title: 'Night Owl Usage Pattern',
        description: `${nightPct}% of your sessions are between 11PM-5AM. Late-night usage may indicate urgent tasks that could be planned earlier.`,
        impact: 'low',
        effort: 'easy',
        details: 'Consider queuing non-urgent tasks for normal hours. OpenClaw supports scheduled tasks that can run during off-peak hours.',
      });
    }

    // Weekend vs weekday distribution
    const weekendDays = this.report.dailyActivity.filter(d => {
      const day = new Date(d.date).getDay();
      return day === 0 || day === 6;
    });
    const weekdayDays = this.report.dailyActivity.filter(d => {
      const day = new Date(d.date).getDay();
      return day !== 0 && day !== 6;
    });
    
    const weekendSessions = weekendDays.reduce((s, d) => s + d.sessions, 0);
    const weekdaySessions = weekdayDays.reduce((s, d) => s + d.sessions, 0);
    const weekendAvg = weekendDays.length > 0 ? weekendSessions / weekendDays.length : 0;
    const weekdayAvg = weekdayDays.length > 0 ? weekdaySessions / weekdayDays.length : 0;
    
    if (weekendAvg > weekdayAvg * 0.8 && weekendSessions > 5) {
      suggestions.push({
        category: 'scheduling',
        title: 'Consistent Weekend Usage',
        description: `Weekend usage (${Math.round(weekendAvg)} sessions/day) is close to weekday levels (${Math.round(weekdayAvg)} sessions/day). Consider if some weekend tasks could be automated.`,
        impact: 'low',
        effort: 'moderate',
      });
    }

    return suggestions;
  }

  // ─── Memory Utilization ───────────────────────────────────────

  private memoryUtilizationSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // If sessions are very repetitive in topic/channel, memory could help
    const abandonedSessions = this.report.frictions.filter(
      f => f.type === 'abandoned_session'
    );
    
    if (abandonedSessions.length > 5) {
      suggestions.push({
        category: 'memory_utilization',
        title: 'Leverage Memory for Context',
        description: `${abandonedSessions.length} sessions appear abandoned, possibly due to lost context. OpenClaw's memory features can persist important context across sessions.`,
        impact: 'medium',
        effort: 'moderate',
        details: 'Enable the memory-lancedb extension to automatically capture and recall important facts, decisions, and preferences across conversations. This reduces the need to re-explain context.',
        configSnippet: '// Enable memory extension in your OpenClaw config:\n// extensions: ["memory-lancedb"]\n// memory: { autoCapture: true, autoRecall: true }',
      });
    }

    return suggestions;
  }

  // ─── Feature Discovery ────────────────────────────────────────

  private featureDiscoverySuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const toolNames = new Set<string>();
    
    for (const session of this.report.sessionAnalyses) {
      for (const tool of session.toolUses) {
        toolNames.add(tool.name);
      }
    }

    // Check for potentially underused features
    const features = [
      {
        check: () => !toolNames.has('web_search') && !toolNames.has('browser'),
        title: 'Web Browsing',
        description: 'You haven\'t used web browsing capabilities. OpenClaw can search the web and browse URLs for real-time information.',
      },
      {
        check: () => !toolNames.has('code_execute') && !toolNames.has('bash'),
        title: 'Code Execution',
        description: 'You haven\'t used code execution. OpenClaw can run code in sandboxed environments for data analysis, calculations, and automation.',
      },
      {
        check: () => this.report.summary.uniqueChannels < 3 && this.report.summary.totalSessions > 20,
        title: 'Multi-Channel Workflow',
        description: 'You\'re using fewer than 3 channels. Try accessing OpenClaw from mobile (Telegram/WhatsApp) for quick queries and Canvas for complex visual tasks.',
      },
      {
        check: () => {
          const channels = this.report.channelStats.map(c => c.channel);
          return !channels.includes('tui') && this.report.summary.totalSessions > 10;
        },
        title: 'Terminal UI (TUI)',
        description: 'You haven\'t used the TUI. For developers, the terminal interface provides the fastest way to interact with OpenClaw during coding sessions.',
      },
    ];

    for (const feature of features) {
      if (feature.check()) {
        suggestions.push({
          category: 'feature_discovery',
          title: `Try: ${feature.title}`,
          description: feature.description,
          impact: 'low',
          effort: 'easy',
        });
      }
    }

    return suggestions;
  }

  // ─── Workflow Improvements ────────────────────────────────────

  private workflowSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { summary } = this.report;

    // Low engagement (few messages per session)
    if (summary.avgMessagesPerSession < 3 && summary.totalSessions > 10) {
      suggestions.push({
        category: 'workflow_improvement',
        title: 'Deepen Conversations',
        description: `Average of ${summary.avgMessagesPerSession} messages per session suggests brief interactions. For complex tasks, multi-turn conversations often produce better results.`,
        impact: 'medium',
        effort: 'easy',
        details: 'Instead of accepting the first response, follow up with refinements. Ask "can you improve X?" or "what about edge case Y?" to get more polished outputs.',
      });
    }

    // Very high engagement (too many messages)
    if (summary.avgMessagesPerSession > 20) {
      suggestions.push({
        category: 'workflow_improvement',
        title: 'Streamline Long Conversations',
        description: `Average of ${summary.avgMessagesPerSession} messages per session. Very long conversations may indicate unclear initial requirements.`,
        impact: 'medium',
        effort: 'moderate',
        details: 'Try providing more complete specifications upfront: include requirements, constraints, examples, and expected output format in your initial message. This reduces back-and-forth significantly.',
      });
    }

    // Activity streak encouragement
    if (summary.longestStreak < 5 && summary.activeDays > 7) {
      suggestions.push({
        category: 'workflow_improvement',
        title: 'Build Consistent Habits',
        description: `Your longest usage streak is ${summary.longestStreak} days. Regular usage helps build effective prompting habits and makes the assistant more familiar with your workflow.`,
        impact: 'low',
        effort: 'easy',
      });
    }

    // Cost awareness
    if (summary.estimatedCostUsd > 50) {
      suggestions.push({
        category: 'workflow_improvement',
        title: 'Cost Awareness',
        description: `Estimated spending: ${formatCost(summary.estimatedCostUsd)} over ${summary.activeDays} days. Review the channel and model breakdowns for optimization opportunities.`,
        impact: 'high',
        effort: 'easy',
      });
    }

    return suggestions;
  }
}
