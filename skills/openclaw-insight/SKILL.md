---
name: openclaw-insight
description: |
  Analyze OpenClaw AI assistant usage patterns, session statistics, and token consumption to generate interactive insight reports with improvement suggestions. Use this skill whenever the user wants to understand their OpenClaw usage habits, review session history metrics, check token costs, identify friction points, get optimization recommendations, or generate a usage analytics report. Also trigger when users mention: "openclaw stats", "usage analysis", "session insights", "token consumption report", "how am I using openclaw", "openclaw usage summary", "improvement suggestions for my AI assistant", or any request to audit, analyze, or visualize OpenClaw session data — even if they just say "show me my stats" or "how much am I spending on AI".
---

# OpenClaw Insight

Generate usage analytics and improvement insights for [OpenClaw](https://github.com/openclaw/openclaw) — the multi-channel AI gateway. This skill analyzes local session data and produces interactive reports with behavior patterns, friction analysis, and actionable recommendations.

## When You Have This Skill

You have access to `openclaw-insight`, a CLI tool that reads OpenClaw's local session data and generates comprehensive analytics reports. The tool is entirely local — no data leaves the user's machine.

## Quick Reference

```bash
# Analyze last 30 days (default), open HTML report in browser
openclaw-insight

# Analyze last 7 days
openclaw-insight --days 7

# JSON output instead of HTML
openclaw-insight --format json --output report.json

# Specific agent, custom output
openclaw-insight --agent my-agent --output ~/Desktop/insight.html

# Verbose mode
openclaw-insight --verbose

# Don't auto-open browser
openclaw-insight --no-open
```

### All CLI Options

| Option | Default | Purpose |
|---|---|---|
| `-d, --days <n>` | `30` | Analysis window in days |
| `-m, --max-sessions <n>` | `200` | Cap on sessions to process |
| `-a, --agent <id>` | auto-detect | Target agent ID |
| `-s, --state-dir <path>` | `~/.openclaw` | OpenClaw state directory |
| `-o, --output <path>` | `~/.openclaw/usage-data/report.html` | Report file path |
| `-f, --format <fmt>` | `html` | `html` or `json` |
| `--no-open` | — | Skip auto-open in browser |
| `-v, --verbose` | — | Detailed progress output |

## How to Use This Skill

### Step 1: Determine What the User Needs

Users typically want one of these:

| Request Type | Approach |
|---|---|
| "Show me my stats" | Run `openclaw-insight` with default settings |
| "How much am I spending?" | Run with `--format json`, extract `summary.estimatedCostUsd` |
| "Why are my sessions so slow?" | Run analysis, focus on friction events and context management suggestions |
| "Compare channels" | Run analysis, present `channelStats` breakdown |
| "Give me a report for last week" | Run with `--days 7` |
| "How can I use OpenClaw better?" | Run analysis, focus on the suggestions section |

### Step 2: Run the Analysis

Before running, verify the prerequisites:

1. **Check OpenClaw state exists**: Look for `~/.openclaw/agents/` directory
2. **Check Node.js**: The tool requires Node.js >= 22
3. **Build if needed**: If running from source, `npm install && npm run build` first

Then run the tool. For most cases, the default command is sufficient:

```bash
cd <project-root>   # wherever openclaw-insight is installed
openclaw-insight --no-open --verbose 2>&1
```

Use `--no-open` when running on behalf of the user so you can process the output before presenting it.

For programmatic analysis, use JSON format:

```bash
openclaw-insight --format json --output /tmp/insight.json --no-open 2>&1
```

Then read the JSON to extract specific metrics.

### Step 3: Present Results

The tool outputs a structured report. Here's how to interpret and present each section:

#### Summary Dashboard
The `summary` object contains headline numbers. Present these prominently:
- **Sessions** and daily average — shows engagement level
- **Tokens** and cost — shows resource consumption
- **Active days** and streak — shows consistency
- **Channels** and models — shows platform diversity

#### Behavior Patterns
The `patterns` array contains detected usage habits. Each has an `impact` level (high/medium/low). Focus on high-impact patterns first and explain what they mean practically.

#### Friction Events
The `frictions` array identifies pain points. Group by type and explain the impact:

| Friction Type | What It Means | What to Suggest |
|---|---|---|
| `high_token_waste` | Excessive output relative to input | Use concise prompts, request shorter responses |
| `excessive_compactions` | Hitting context window limits | Split long conversations, use memory features |
| `abandoned_session` | Sessions started but barely used | Check if there's a UX barrier or channel issue |
| `underutilized_cache` | No prompt caching benefit | Structure prompts for cache-friendly patterns |
| `context_overflow` | Repeated context exhaustion | Reduce context size, use topic-based sessions |
| `single_message_sessions` | One-shot with high overhead | Batch queries, use lighter models for simple tasks |

#### Improvement Suggestions
The `suggestions` array contains actionable recommendations sorted by impact and effort. Each has:
- `category` — what area it addresses
- `impact` — high/medium/low benefit
- `effort` — easy/moderate/complex to implement
- `details` — full explanation
- `configSnippet` — optional configuration to apply

Present the top 3-5 suggestions with clear next steps.

### Step 4: If the Tool Isn't Installed

If `openclaw-insight` is not installed yet, help the user set it up:

**Option A — One-line install:**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-insight/main/install.sh)
```

**Option B — Install from source:**
```bash
git clone https://github.com/openclaw/openclaw-insight.git
cd openclaw-insight
npm install && npm run build
```

**Option C — Use the bundled quick-analyze script** (see `scripts/quick-analyze.sh`) for a lightweight version that reads session data without the full tool installation.

## Data Sources

The tool reads from OpenClaw's local state directory:

```
~/.openclaw/
└── agents/{agentId}/
    └── sessions/
        ├── sessions.json              # Session metadata index
        └── {sessionId}.jsonl          # Per-session transcripts
```

- **sessions.json** — A `Record<string, SessionEntry>` with token counts, model info, channel, timestamps
- **{sessionId}.jsonl** — Newline-delimited JSON with message history, per-turn `usage` objects, compaction markers

The analysis is read-only and never modifies any OpenClaw data.

## Report Structure (JSON Format)

When using `--format json`, the output has this structure. Knowing this helps you extract specific metrics:

```
InsightReport {
  generatedAt, periodStart, periodEnd, daysAnalyzed,
  summary: {
    totalSessions, totalMessages, totalTokens,
    totalInputTokens, totalOutputTokens,
    totalCacheRead, totalCacheWrite,
    estimatedCostUsd, activeDays, avgSessionsPerDay,
    avgMessagesPerSession, avgTokensPerSession,
    longestStreak, uniqueChannels, uniqueModels
  },
  dailyActivity[],       // per-day breakdown
  hourlyDistribution[],  // 24-hour activity heatmap
  channelStats[],        // per-channel metrics
  modelStats[],          // per-model metrics
  sessionAnalyses[],     // detailed per-session data
  patterns[],            // detected behavior patterns
  frictions[],           // friction events
  suggestions[]          // improvement recommendations
}
```

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "No agents found" | Empty state directory | Verify `~/.openclaw` exists and has data |
| "No sessions in last N days" | Analysis window too narrow | Increase `--days` value |
| Empty channel/model stats | Missing metadata in sessions.json | OpenClaw version may be too old |
| Build errors | Wrong Node.js version | Upgrade to Node.js >= 22 |

## Advanced: Custom Analysis

For users who want deeper analysis than the default report, read the JSON output and perform custom queries. For instance, to find the most expensive sessions:

```bash
openclaw-insight --format json --output /tmp/r.json --no-open
# Then parse with jq or Node.js to extract specific insights
```

For reference on the full type definitions and data structures, see `references/data-model.md`.
