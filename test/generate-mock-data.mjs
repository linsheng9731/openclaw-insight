#!/usr/bin/env node
/**
 * generate-mock-data.mjs
 *
 * Creates realistic mock OpenClaw session data for testing openclaw-insight.
 * Generates 50+ sessions across 30 days with diverse channels, models,
 * token usage, cache patterns, compaction events, and tool usage.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Configuration ──────────────────────────────────────────────

const STATE_DIR = '/opt/tiger/mira_nas/workspace/75878925587/openclaw-insight/test-data';
const SESSIONS_DIR = join(STATE_DIR, 'agents', 'default', 'sessions');
const DAYS_BACK = 30;
const NUM_SESSIONS = 58;

const CHANNELS = ['telegram', 'slack', 'discord', 'tui', 'webchat'];
const MODELS = [
  { model: 'claude-3.5-sonnet', provider: 'anthropic' },
  { model: 'claude-3-haiku', provider: 'anthropic' },
  { model: 'gpt-4o-mini', provider: 'openai' },
];
const TOOLS = ['read', 'write', 'bash', 'web_search', 'grep', 'list_files'];

const LABELS = [
  'Refactor auth module', 'Debug CI pipeline', 'Write unit tests',
  'Code review feedback', 'API design discussion', 'Fix production bug',
  'Database migration', 'Quick question', 'Deploy staging', 'Config update',
  'Investigate memory leak', 'Update documentation', 'Performance profiling',
  'Security audit prep', 'Feature brainstorm', 'Dependency upgrade',
  'Log analysis', 'Schema validation', 'Infra cost review', 'Onboarding help',
];

// ─── Helpers ────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomTimestamp(daysAgo) {
  const now = Date.now();
  const base = now - daysAgo * 24 * 60 * 60 * 1000;
  const hour = weightedPick(
    Array.from({ length: 24 }, (_, i) => i),
    Array.from({ length: 24 }, (_, i) => {
      if (i >= 9 && i <= 18) return 4;
      if (i >= 19 && i <= 22) return 2;
      if (i >= 23 || i <= 5) return 1;
      return 2;
    })
  );
  const minute = rand(0, 59);
  const d = new Date(base);
  d.setHours(hour, minute, rand(0, 59), rand(0, 999));
  return d.getTime();
}

// ─── Session Archetypes ─────────────────────────────────────────

const archetypes = [
  {
    name: 'normal',
    weight: 35,
    gen: () => {
      const msgs = rand(6, 20);
      const inputPerMsg = rand(500, 3000);
      const outputPerMsg = rand(300, 2000);
      return {
        messageCount: msgs,
        inputTokens: msgs * inputPerMsg,
        outputTokens: msgs * outputPerMsg,
        cacheRead: rand(2000, 20000),
        cacheWrite: rand(500, 5000),
        compactionCount: 0,
        durationMinutes: rand(5, 45),
        toolsUsed: rand(1, 4),
      };
    },
  },
  {
    name: 'quick',
    weight: 10,
    gen: () => ({
      messageCount: 2,
      inputTokens: rand(500, 2000),
      outputTokens: rand(200, 1500),
      cacheRead: rand(0, 500),
      cacheWrite: rand(0, 200),
      compactionCount: 0,
      durationMinutes: 1,
      toolsUsed: 0,
    }),
  },
  {
    name: 'abandoned',
    weight: 5,
    gen: () => ({
      messageCount: 2,
      inputTokens: rand(3000, 8000),
      outputTokens: rand(2000, 5000),
      cacheRead: 0,
      cacheWrite: rand(200, 1000),
      compactionCount: 0,
      durationMinutes: rand(1, 3),
      toolsUsed: 0,
    }),
  },
  {
    name: 'token_waste',
    weight: 5,
    gen: () => {
      const inputTokens = rand(2000, 5000);
      return {
        messageCount: rand(4, 8),
        inputTokens,
        outputTokens: inputTokens * rand(6, 12),
        cacheRead: 0,
        cacheWrite: rand(100, 500),
        compactionCount: rand(0, 1),
        durationMinutes: rand(10, 30),
        toolsUsed: rand(0, 2),
      };
    },
  },
  {
    name: 'compaction_heavy',
    weight: 4,
    gen: () => ({
      messageCount: rand(30, 60),
      inputTokens: rand(80000, 200000),
      outputTokens: rand(40000, 120000),
      cacheRead: rand(5000, 30000),
      cacheWrite: rand(3000, 15000),
      compactionCount: rand(3, 7),
      durationMinutes: rand(45, 180),
      toolsUsed: rand(3, 6),
    }),
  },
  {
    name: 'context_overflow',
    weight: 3,
    gen: () => ({
      messageCount: rand(40, 80),
      inputTokens: rand(120000, 300000),
      outputTokens: rand(80000, 200000),
      cacheRead: rand(10000, 50000),
      cacheWrite: rand(5000, 20000),
      compactionCount: rand(4, 8),
      durationMinutes: rand(60, 240),
      toolsUsed: rand(4, 6),
    }),
  },
  {
    name: 'no_cache',
    weight: 4,
    gen: () => ({
      messageCount: rand(8, 15),
      inputTokens: rand(60000, 120000),
      outputTokens: rand(20000, 60000),
      cacheRead: 0,
      cacheWrite: 0,
      compactionCount: rand(0, 1),
      durationMinutes: rand(15, 60),
      toolsUsed: rand(1, 3),
    }),
  },
  {
    name: 'deep_work',
    weight: 6,
    gen: () => ({
      messageCount: rand(15, 35),
      inputTokens: rand(30000, 80000),
      outputTokens: rand(20000, 60000),
      cacheRead: rand(10000, 40000),
      cacheWrite: rand(3000, 10000),
      compactionCount: rand(0, 2),
      durationMinutes: rand(30, 120),
      toolsUsed: rand(2, 5),
    }),
  },
];

// ─── Generate Transcript ────────────────────────────────────────

function generateTranscript(sessionId, startTs, shape, modelChoice) {
  const lines = [];

  lines.push(JSON.stringify({
    type: 'session', version: 1, id: sessionId,
    timestamp: new Date(startTs).toISOString(),
    cwd: '/home/user/projects/myapp',
  }));

  const totalMessages = shape.messageCount;
  const userMessages = Math.ceil(totalMessages / 2);
  const assistantMessages = totalMessages - userMessages;

  const inputPerUser = Math.floor(shape.inputTokens / Math.max(userMessages, 1));
  const outputPerAssistant = Math.floor(shape.outputTokens / Math.max(assistantMessages, 1));
  const cacheReadPerMsg = Math.floor(shape.cacheRead / Math.max(Math.min(assistantMessages, 3), 1));
  const cacheWritePerMsg = Math.floor(shape.cacheWrite / Math.max(Math.min(assistantMessages, 2), 1));

  let currentTs = startTs;
  const timeStep = Math.floor((shape.durationMinutes * 60 * 1000) / Math.max(totalMessages, 1));

  let compactionsInserted = 0;
  const compactionInterval = shape.compactionCount > 0
    ? Math.floor(totalMessages / (shape.compactionCount + 1))
    : Infinity;

  const sessionTools = [];
  if (shape.toolsUsed > 0) {
    const availableTools = [...TOOLS];
    for (let t = 0; t < shape.toolsUsed && availableTools.length > 0; t++) {
      const idx = rand(0, availableTools.length - 1);
      sessionTools.push(availableTools.splice(idx, 1)[0]);
    }
  }

  const userPrompts = [
    'Can you help me refactor this function to be more readable?',
    'What does this error mean and how do I fix it?',
    'Write tests for the authentication module.',
    'Review this code and suggest improvements.',
    'How should I structure the API endpoints?',
    'Debug this failing test — it passes locally but fails in CI.',
    'Help me optimize this database query.',
    'Explain the difference between these two approaches.',
    'Create a migration script for the schema changes.',
    'What are the security implications of this change?',
    'Can you search for similar patterns in the codebase?',
    'Help me set up the monitoring dashboard.',
    'Analyze the logs from the last deployment.',
    'Write a script to automate the deployment process.',
    'How can I reduce the bundle size?',
  ];

  const assistantPrefixes = [
    "I'll help you with that. Let me ",
    "Sure, let me analyze ",
    "Looking at the code, I can see ",
    "Here's my approach: ",
    "I've reviewed the code and ",
    "Based on the error, ",
    "Let me check a few things first. ",
    "Great question. ",
    "I'll investigate this. ",
    "Here's what I found: ",
  ];

  let msgIndex = 0;
  for (let i = 0; i < userMessages; i++) {
    currentTs += timeStep + rand(-5000, 30000);

    lines.push(JSON.stringify({
      type: 'message',
      message: {
        role: 'user',
        content: pick(userPrompts),
        timestamp: currentTs,
      },
    }));
    msgIndex++;

    if (compactionsInserted < shape.compactionCount &&
        msgIndex > 0 && msgIndex % compactionInterval === 0) {
      currentTs += rand(1000, 3000);
      lines.push(JSON.stringify({
        type: 'compaction',
        summary: 'Conversation compacted: The user has been working on ' +
          pick(LABELS).toLowerCase() +
          '. Key decisions: use TypeScript strict mode, add error boundaries, implement retry logic.',
        timestamp: new Date(currentTs).toISOString(),
      }));
      compactionsInserted++;
    }

    if (i < assistantMessages) {
      currentTs += rand(2000, 15000);

      const content = [];
      const textContent = pick(assistantPrefixes) +
        `examine the ${pick(['function', 'module', 'component', 'service', 'handler'])} ` +
        `to identify ${pick(['the issue', 'potential improvements', 'optimization opportunities', 'the root cause'])}. ` +
        `I recommend ${pick(['refactoring', 'adding tests', 'restructuring', 'using a different approach', 'adding error handling'])} ` +
        `to improve ${pick(['maintainability', 'performance', 'reliability', 'readability', 'security'])}.`;
      content.push({ type: 'text', text: textContent });

      if (sessionTools.length > 0 && Math.random() < 0.6) {
        const numToolCalls = rand(1, Math.min(3, sessionTools.length));
        for (let t = 0; t < numToolCalls; t++) {
          const toolName = pick(sessionTools);
          const toolId = `toolu_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

          if (toolName === 'read') {
            content.push({ type: 'tool_use', name: 'read', id: toolId,
              input: { file_path: `/home/user/projects/myapp/src/${pick(['index', 'app', 'utils', 'config', 'auth'])}.ts` } });
          } else if (toolName === 'write') {
            content.push({ type: 'tool_use', name: 'write', id: toolId,
              input: { file_path: `/home/user/projects/myapp/src/${pick(['helper', 'service', 'handler'])}.ts`, content: '// Updated implementation...' } });
          } else if (toolName === 'bash') {
            content.push({ type: 'tool_use', name: 'bash', id: toolId,
              input: { command: pick(['npm test', 'npm run build', 'git diff --stat', 'cat package.json', 'ls -la src/', 'grep -r "TODO" src/']) } });
          } else if (toolName === 'web_search') {
            content.push({ type: 'tool_use', name: 'web_search', id: toolId,
              input: { query: pick(['typescript strict mode best practices', 'node.js memory leak debugging', 'react performance optimization', 'postgresql index optimization']) } });
          } else if (toolName === 'grep') {
            content.push({ type: 'tool_use', name: 'grep', id: toolId,
              input: { pattern: pick(['import.*from', 'export default', 'async function', 'catch.*error']), path: '/home/user/projects/myapp/src' } });
          } else if (toolName === 'list_files') {
            content.push({ type: 'tool_use', name: 'list_files', id: toolId,
              input: { path: '/home/user/projects/myapp/src' } });
          }
        }
      }

      const isEarlyMsg = i < 3;
      const usage = {
        input_tokens: Math.max(0, inputPerUser + rand(-200, 200)),
        output_tokens: Math.max(0, outputPerAssistant + rand(-200, 200)),
        cache_read_input_tokens: Math.max(0, isEarlyMsg ? cacheReadPerMsg + rand(-100, 100) : rand(0, 200)),
        cache_creation_input_tokens: Math.max(0, isEarlyMsg && i < 2 ? cacheWritePerMsg + rand(-50, 50) : 0),
      };

      lines.push(JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant', content, usage, timestamp: currentTs,
          stop_reason: 'end_turn', model: modelChoice.model,
        },
      }));
      msgIndex++;
    }
  }

  while (compactionsInserted < shape.compactionCount) {
    currentTs += rand(1000, 3000);
    lines.push(JSON.stringify({
      type: 'compaction',
      summary: 'Context compacted after extended conversation about ' +
        pick(LABELS).toLowerCase() + '. Retained key context: project structure, recent changes, open issues.',
      timestamp: new Date(currentTs).toISOString(),
    }));
    compactionsInserted++;
  }

  return lines.join('\n') + '\n';
}

// ─── Generate Session ───────────────────────────────────────────

function generateSession(index) {
  const archetype = weightedPick(archetypes, archetypes.map(a => a.weight));
  const daysAgo = rand(0, DAYS_BACK - 1);
  const startTs = randomTimestamp(daysAgo);
  const sessionId = randomUUID();
  const channelChoice = weightedPick(CHANNELS, [30, 25, 10, 25, 10]);
  const modelChoice = weightedPick(MODELS, [50, 25, 25]);
  const shape = archetype.gen();
  const endTs = startTs + shape.durationMinutes * 60 * 1000;
  const totalTokens = shape.inputTokens + shape.outputTokens;

  const entry = {
    sessionId,
    updatedAt: endTs,
    sessionFile: join(SESSIONS_DIR, `${sessionId}.jsonl`),
    inputTokens: shape.inputTokens,
    outputTokens: shape.outputTokens,
    totalTokens,
    cacheRead: shape.cacheRead,
    cacheWrite: shape.cacheWrite,
    model: modelChoice.model,
    modelProvider: modelChoice.provider,
    contextTokens: Math.min(shape.inputTokens, 128000),
    compactionCount: shape.compactionCount,
    label: pick(LABELS),
    displayName: pick(LABELS),
    channel: channelChoice,
    origin: {
      provider: modelChoice.provider,
      surface: channelChoice,
      chatType: 'direct',
      from: `user-${rand(1000, 9999)}`,
      accountId: `acct-${rand(100, 999)}`,
    },
  };

  const transcript = generateTranscript(sessionId, startTs, shape, modelChoice);
  return { entry, transcript, archetype: archetype.name };
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  console.log('OpenClaw Mock Data Generator');
  console.log('============================\n');

  mkdirSync(SESSIONS_DIR, { recursive: true });
  console.log(`Created: ${SESSIONS_DIR}`);

  const sessionsStore = {};
  const archetypeCounts = {};

  for (let i = 0; i < NUM_SESSIONS; i++) {
    const { entry, transcript, archetype } = generateSession(i);
    sessionsStore[entry.sessionId] = entry;
    writeFileSync(entry.sessionFile, transcript, 'utf-8');
    archetypeCounts[archetype] = (archetypeCounts[archetype] || 0) + 1;
  }

  const sessionsPath = join(SESSIONS_DIR, 'sessions.json');
  writeFileSync(sessionsPath, JSON.stringify(sessionsStore, null, 2), 'utf-8');
  console.log(`Created: ${sessionsPath}`);

  const sessionCount = Object.keys(sessionsStore).length;
  console.log(`\nGenerated ${sessionCount} sessions:\n`);

  for (const [arch, count] of Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${arch.padEnd(20)} ${count} sessions`);
  }

  const entries = Object.values(sessionsStore);
  const totalTokens = entries.reduce((s, e) => s + (e.totalTokens || 0), 0);
  const totalCacheRead = entries.reduce((s, e) => s + (e.cacheRead || 0), 0);
  const channels = new Set(entries.map(e => e.channel));
  const models = new Set(entries.map(e => e.model));

  console.log(`\nData characteristics:`);
  console.log(`  Total tokens:     ${totalTokens.toLocaleString()}`);
  console.log(`  Total cache read: ${totalCacheRead.toLocaleString()}`);
  console.log(`  Channels:         ${[...channels].join(', ')}`);
  console.log(`  Models:           ${[...models].join(', ')}`);
  console.log(`  Transcript files: ${sessionCount}`);

  const highCompaction = entries.filter(e => (e.compactionCount || 0) >= 3);
  const noCache = entries.filter(e => (e.inputTokens || 0) > 50000 && (e.cacheRead || 0) === 0);

  console.log(`\nExpected friction triggers:`);
  console.log(`  High compaction (>=3):   ${highCompaction.length} sessions`);
  console.log(`  No cache (>50K input):   ${noCache.length} sessions`);
  console.log(`  Total transcript files:  ${sessionCount}`);

  console.log(`\nMock data ready at: ${STATE_DIR}`);
  console.log('Done!\n');
}

main();
