# OpenClaw Insight — Data Model Reference

Detailed type definitions for all data structures used by `openclaw-insight`. Consult this when you need to work with the JSON output programmatically or understand what each field means.

## Session Store (`sessions.json`)

Located at `~/.openclaw/agents/{agentId}/sessions/sessions.json`.

Type: `Record<string, SessionEntry>`  — a flat object keyed by session UUID.

### SessionEntry

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | UUID identifying the session |
| `updatedAt` | `number` | Unix timestamp (seconds or ms) of last update |
| `sessionFile` | `string?` | Relative path to the `.jsonl` transcript |
| `inputTokens` | `number?` | Total input tokens consumed |
| `outputTokens` | `number?` | Total output tokens consumed |
| `totalTokens` | `number?` | Sum of input + output |
| `cacheRead` | `number?` | Tokens read from prompt cache |
| `cacheWrite` | `number?` | Tokens written to prompt cache |
| `model` | `string?` | Model identifier (e.g., `claude-3.5-sonnet`) |
| `modelProvider` | `string?` | Provider name (e.g., `anthropic`) |
| `contextTokens` | `number?` | Context window size used |
| `compactionCount` | `number?` | Number of compaction cycles in this session |
| `label` | `string?` | User-assigned label |
| `displayName` | `string?` | Display name |
| `channel` | `string?` | Channel identifier (`telegram`, `slack`, `tui`, etc.) |
| `origin` | `SessionOrigin?` | Origin metadata |
| `spawnedBy` | `string?` | Parent session ID (for sub-sessions) |
| `spawnDepth` | `number?` | Nesting depth |

### SessionOrigin

| Field | Type | Description |
|---|---|---|
| `provider` | `string?` | Channel provider |
| `surface` | `string?` | Surface type |
| `chatType` | `string?` | Chat type (dm, group, etc.) |
| `from` | `string?` | Sender identifier |
| `to` | `string?` | Recipient identifier |
| `accountId` | `string?` | Account ID |
| `threadId` | `string?` | Thread ID |

---

## Transcript Files (`{sessionId}.jsonl`)

Located at `~/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl`.

Format: Newline-delimited JSON. Each line is one of three types:

### Session Header (first line)

```json
{
  "type": "session",
  "version": 1,
  "id": "uuid",
  "timestamp": "ISO-8601",
  "cwd": "/working/directory"
}
```

### Message Record

```json
{
  "type": "message",
  "message": {
    "role": "user | assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "name": "tool-name", "input": {} },
      { "type": "tool_result", "tool_use_id": "id", "content": "..." }
    ],
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 890
    },
    "timestamp": 1710000000,
    "stop_reason": "end_turn | tool_use",
    "model": "claude-3.5-sonnet"
  }
}
```

### Compaction Marker

```json
{
  "type": "compaction",
  "summary": "Condensed conversation summary...",
  "timestamp": "ISO-8601"
}
```

Compaction markers indicate the conversation exceeded the context window and was summarized. Multiple compactions in one session signal context pressure.

---

## Insight Report (`InsightReport`)

The full output schema when using `--format json`.

### Top-Level Structure

| Field | Type | Description |
|---|---|---|
| `generatedAt` | `string` | ISO-8601 timestamp of report generation |
| `periodStart` | `string` | Start date (YYYY-MM-DD) |
| `periodEnd` | `string` | End date (YYYY-MM-DD) |
| `daysAnalyzed` | `number` | Window size in days |
| `summary` | `Summary` | Aggregate statistics |
| `dailyActivity` | `DailyActivity[]` | Per-day breakdown |
| `hourlyDistribution` | `HourlyDistribution[]` | 24-entry activity heatmap |
| `channelStats` | `ChannelStats[]` | Per-channel metrics |
| `modelStats` | `ModelStats[]` | Per-model metrics |
| `sessionAnalyses` | `SessionAnalysis[]` | Detailed per-session data |
| `patterns` | `UsagePattern[]` | Detected behavior patterns |
| `frictions` | `FrictionEvent[]` | Friction events |
| `suggestions` | `Suggestion[]` | Improvement recommendations |

### Summary

| Field | Type |
|---|---|
| `totalSessions` | `number` |
| `totalMessages` | `number` |
| `totalTokens` | `number` |
| `totalInputTokens` | `number` |
| `totalOutputTokens` | `number` |
| `totalCacheRead` | `number` |
| `totalCacheWrite` | `number` |
| `estimatedCostUsd` | `number` |
| `activeDays` | `number` |
| `avgSessionsPerDay` | `number` |
| `avgMessagesPerSession` | `number` |
| `avgTokensPerSession` | `number` |
| `longestStreak` | `number` |
| `uniqueChannels` | `number` |
| `uniqueModels` | `number` |

### DailyActivity

| Field | Type | Description |
|---|---|---|
| `date` | `string` | YYYY-MM-DD |
| `sessions` | `number` | Session count |
| `messages` | `number` | Message count |
| `totalTokens` | `number` | Total tokens |
| `inputTokens` | `number` | Input tokens |
| `outputTokens` | `number` | Output tokens |

### ChannelStats

| Field | Type |
|---|---|
| `channel` | `string` |
| `sessions` | `number` |
| `messages` | `number` |
| `totalTokens` | `number` |
| `avgTokensPerSession` | `number` |
| `avgMessagesPerSession` | `number` |

### ModelStats

| Field | Type |
|---|---|
| `model` | `string` |
| `provider` | `string` |
| `sessions` | `number` |
| `totalTokens` | `number` |
| `avgTokensPerSession` | `number` |
| `cacheHitRate` | `number` |

### Suggestion

| Field | Type | Values |
|---|---|---|
| `category` | `string` | `token_efficiency`, `channel_optimization`, `model_selection`, `context_management`, `scheduling`, `memory_utilization`, `feature_discovery`, `workflow_improvement` |
| `title` | `string` | Short title |
| `description` | `string` | Brief description |
| `impact` | `string` | `high`, `medium`, `low` |
| `effort` | `string` | `easy`, `moderate`, `complex` |
| `details` | `string?` | Extended explanation |
| `configSnippet` | `string?` | Configuration example |

### FrictionEvent

| Field | Type | Values |
|---|---|---|
| `type` | `string` | `high_token_waste`, `excessive_compactions`, `abandoned_session`, `repeated_retries`, `underutilized_cache`, `context_overflow`, `single_message_sessions` |
| `sessionId` | `string` | Session UUID |
| `description` | `string` | Human-readable description |
| `context` | `string?` | Additional context |

### UsagePattern

| Field | Type | Values |
|---|---|---|
| `type` | `string` | `peak_hours`, `channel_preference`, `model_switching`, `session_length`, `token_efficiency`, `cache_usage`, `tool_preference` |
| `title` | `string` | Pattern name |
| `description` | `string` | Pattern details |
| `frequency` | `number` | How often observed |
| `impact` | `string` | `high`, `medium`, `low` |

---

## Cost Estimation Model

The tool estimates cost using approximate pricing tiers:

| Model Pattern | Input (per 1M) | Output (per 1M) |
|---|---|---|
| `claude-3-opus` | $15.00 | $75.00 |
| `claude-3.5-sonnet` | $3.00 | $15.00 |
| `claude-3-haiku` | $0.25 | $1.25 |
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| Default (unrecognized) | $3.00 | $15.00 |

These are rough estimates. Actual costs depend on your provider agreement and any cached token discounts.
