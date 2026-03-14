#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# openclaw-insight quick-analyze
# Lightweight session analysis without the full tool installation.
# Reads sessions.json and prints key metrics to stdout.
#
# Usage:
#   bash quick-analyze.sh [--state-dir ~/.openclaw] [--days 30] [--agent auto]
# ──────────────────────────────────────────────────────────────
set -euo pipefail

STATE_DIR="${HOME}/.openclaw"
DAYS=30
AGENT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --state-dir) STATE_DIR="$2"; shift 2 ;;
    --days) DAYS="$2"; shift 2 ;;
    --agent) AGENT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Auto-detect agent
if [[ -z "$AGENT" ]]; then
  AGENT=$(ls -1 "$STATE_DIR/agents/" 2>/dev/null | head -1)
  if [[ -z "$AGENT" ]]; then
    echo "Error: No agents found in $STATE_DIR/agents/"
    exit 1
  fi
fi

SESSIONS_FILE="$STATE_DIR/agents/$AGENT/sessions/sessions.json"

if [[ ! -f "$SESSIONS_FILE" ]]; then
  echo "Error: Sessions file not found: $SESSIONS_FILE"
  exit 1
fi

echo ""
echo "  🦞 OpenClaw Quick Analysis"
echo "  ─────────────────────────────────"
echo "  Agent: $AGENT"
echo "  Period: last $DAYS days"
echo ""

# Use Node.js for JSON parsing (available if OpenClaw is installed)
if command -v node >/dev/null 2>&1; then
  node --input-type=module -e "
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('$SESSIONS_FILE', 'utf-8'));
const cutoff = Date.now() - ($DAYS * 86400000);

const sessions = Object.values(data).filter(s => {
  const ts = s.updatedAt < 1e12 ? s.updatedAt * 1000 : s.updatedAt;
  return ts >= cutoff;
});

const totalTokens = sessions.reduce((s, x) => s + (x.totalTokens || 0), 0);
const inputTokens = sessions.reduce((s, x) => s + (x.inputTokens || 0), 0);
const outputTokens = sessions.reduce((s, x) => s + (x.outputTokens || 0), 0);
const cacheRead = sessions.reduce((s, x) => s + (x.cacheRead || 0), 0);

const channels = new Map();
const models = new Map();
for (const s of sessions) {
  const ch = s.channel || 'unknown';
  channels.set(ch, (channels.get(ch) || 0) + 1);
  const m = s.model || 'unknown';
  models.set(m, (models.get(m) || 0) + 1);
}

const dates = new Set(sessions.map(s => {
  const ts = s.updatedAt < 1e12 ? s.updatedAt * 1000 : s.updatedAt;
  return new Date(ts).toISOString().slice(0, 10);
}));

const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n);

console.log('  📊 Summary');
console.log('  Sessions:     ' + sessions.length);
console.log('  Active Days:  ' + dates.size + ' / ' + $DAYS);
console.log('  Total Tokens: ' + fmt(totalTokens));
console.log('    Input:      ' + fmt(inputTokens));
console.log('    Output:     ' + fmt(outputTokens));
console.log('    Cache Read: ' + fmt(cacheRead));
console.log('');
console.log('  📡 Channels');
for (const [ch, n] of [...channels.entries()].sort((a,b) => b[1]-a[1])) {
  console.log('    ' + ch.padEnd(15) + n + ' sessions');
}
console.log('');
console.log('  🤖 Models');
for (const [m, n] of [...models.entries()].sort((a,b) => b[1]-a[1])) {
  console.log('    ' + m.padEnd(25) + n + ' sessions');
}

// Friction quick-check
const highToken = sessions.filter(s => (s.outputTokens||0) > (s.inputTokens||1) * 5).length;
const compacted = sessions.filter(s => (s.compactionCount||0) > 2).length;
if (highToken > 0 || compacted > 0) {
  console.log('');
  console.log('  ⚠️  Friction Detected');
  if (highToken > 0) console.log('    ' + highToken + ' sessions with high token waste');
  if (compacted > 0) console.log('    ' + compacted + ' sessions with excessive compactions');
}
console.log('');
console.log('  Tip: Run \`openclaw-insight\` for full analysis with charts and suggestions');
console.log('');
"
else
  echo "  Node.js not found. Install Node.js >= 22 for full analysis."
  echo "  Basic file stats:"
  echo "  Sessions file: $(wc -c < "$SESSIONS_FILE") bytes"
  echo ""
  JSONL_COUNT=$(find "$STATE_DIR/agents/$AGENT/sessions/" -name "*.jsonl" 2>/dev/null | wc -l)
  echo "  Transcript files: $JSONL_COUNT"
fi
