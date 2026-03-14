/**
 * openclaw-insight — CLI Entry Point
 * 
 * Orchestrates the complete insight generation pipeline:
 * 1. Parse CLI arguments
 * 2. Collect session data
 * 3. Analyze usage patterns
 * 4. Generate improvement suggestions
 * 5. Render and output the report
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

import { SessionCollector } from './collector.js';
import { UsageAnalyzer } from './analyzer.js';
import { SuggestionGenerator } from './suggestions.js';
import { generateHtmlReport, generateJsonReport } from './report.js';
import {
  resolveStateDir,
  findDefaultAgentId,
  fileExists,
  defaultConfig,
  formatNumber,
  formatTokens,
  formatCost,
  progressBar,
} from './utils.js';
import type { InsightConfig } from './types.js';

// ─── CLI Definition ─────────────────────────────────────────────

const program = new Command();

program
  .name('openclaw-insight')
  .description('Usage analytics and improvement insights for OpenClaw')
  .version('1.0.0')
  .option('-d, --days <number>', 'Number of days to analyze', '30')
  .option('-m, --max-sessions <number>', 'Maximum sessions to analyze', '200')
  .option('-a, --agent <id>', 'Agent ID to analyze (default: auto-detect)')
  .option('-s, --state-dir <path>', 'OpenClaw state directory', resolveStateDir())
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (html|json)', 'html')
  .option('--no-open', 'Don\'t auto-open the report in browser')
  .option('-v, --verbose', 'Enable verbose output', false);

program.parse();

// ─── Main Pipeline ──────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = program.opts();
  
  console.log('');
  console.log(chalk.bold.cyan('  🦞 OpenClaw Insight'));
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log('');

  // Build config
  const config: InsightConfig = {
    ...defaultConfig(),
    stateDir: opts.stateDir,
    daysBack: parseInt(opts.days, 10),
    maxSessions: parseInt(opts.maxSessions, 10),
    format: opts.format as 'html' | 'json',
    verbose: opts.verbose,
  };

  // Resolve agent ID
  if (opts.agent) {
    config.agentId = opts.agent;
  } else {
    const agentId = await findDefaultAgentId(config.stateDir);
    if (!agentId) {
      console.error(chalk.red('  ✖ No agents found in ') + chalk.dim(config.stateDir));
      console.error(chalk.dim('    Make sure OpenClaw has been used at least once.'));
      process.exit(1);
    }
    config.agentId = agentId;
    if (config.verbose) {
      console.log(chalk.dim(`  Auto-detected agent: ${agentId}`));
    }
  }

  // Resolve output path
  if (opts.output) {
    config.outputPath = resolve(opts.output);
  } else {
    const ext = config.format === 'json' ? 'json' : 'html';
    config.outputPath = resolve(config.stateDir, 'usage-data', `report.${ext}`);
  }

  // ─── Step 1: Collect ──────────────────────────────────────
  console.log(chalk.cyan('  ▸ Collecting sessions...'));
  
  const collector = new SessionCollector(config);
  
  let sessions;
  try {
    sessions = await collector.collectAndAnalyze((current, total) => {
      if (config.verbose || total > 20) {
        process.stdout.write(`\r  ${chalk.dim(progressBar(current, total))}`);
      }
    });
  } catch (err) {
    console.error('');
    console.error(chalk.red(`  ✖ ${(err as Error).message}`));
    process.exit(1);
  }

  if (sessions.length === 0) {
    console.log('');
    console.log(chalk.yellow('  ⚠ No sessions found in the last ' + config.daysBack + ' days.'));
    console.log(chalk.dim('    Try increasing the time window with --days <n>'));
    process.exit(0);
  }

  console.log(`\r  ${chalk.green('✔')} Collected ${chalk.bold(formatNumber(sessions.length))} sessions`);

  // ─── Step 2: Analyze ──────────────────────────────────────
  console.log(chalk.cyan('  ▸ Analyzing usage patterns...'));
  
  const analyzer = new UsageAnalyzer(sessions, config.daysBack);
  const report = analyzer.generateReport();

  console.log(`  ${chalk.green('✔')} Detected ${chalk.bold(String(report.patterns.length))} patterns, ${chalk.bold(String(report.frictions.length))} friction events`);

  // ─── Step 3: Generate Suggestions ─────────────────────────
  console.log(chalk.cyan('  ▸ Generating improvement suggestions...'));
  
  const suggestor = new SuggestionGenerator(report);
  report.suggestions = suggestor.generateAll();

  console.log(`  ${chalk.green('✔')} Generated ${chalk.bold(String(report.suggestions.length))} suggestions`);

  // ─── Step 4: Render Report ────────────────────────────────
  console.log(chalk.cyan(`  ▸ Rendering ${config.format.toUpperCase()} report...`));

  if (config.format === 'json') {
    await generateJsonReport(report, config.outputPath);
  } else {
    await generateHtmlReport(report, config.outputPath);
  }

  console.log(`  ${chalk.green('✔')} Report saved to ${chalk.underline(config.outputPath)}`);

  // ─── Summary ──────────────────────────────────────────────
  console.log('');
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log(chalk.bold('  📊 Quick Summary'));
  console.log('');
  console.log(`  Sessions:    ${chalk.bold(formatNumber(report.summary.totalSessions))} (${report.summary.avgSessionsPerDay}/day)`);
  console.log(`  Messages:    ${chalk.bold(formatNumber(report.summary.totalMessages))} (${report.summary.avgMessagesPerSession}/session)`);
  console.log(`  Tokens:      ${chalk.bold(formatTokens(report.summary.totalTokens))}`);
  console.log(`  Est. Cost:   ${chalk.bold(formatCost(report.summary.estimatedCostUsd))}`);
  console.log(`  Active Days: ${chalk.bold(String(report.summary.activeDays))} / ${report.daysAnalyzed} (streak: ${report.summary.longestStreak}d)`);
  console.log(`  Channels:    ${chalk.bold(String(report.summary.uniqueChannels))} · Models: ${chalk.bold(String(report.summary.uniqueModels))}`);
  
  if (report.suggestions.length > 0) {
    console.log('');
    console.log(chalk.bold('  💡 Top Suggestions'));
    const topSuggestions = report.suggestions.slice(0, 3);
    for (const s of topSuggestions) {
      const badge = s.impact === 'high' ? chalk.red('HIGH') 
        : s.impact === 'medium' ? chalk.yellow('MED') 
        : chalk.green('LOW');
      console.log(`  [${badge}] ${s.title}`);
      console.log(chalk.dim(`        ${s.description.slice(0, 100)}${s.description.length > 100 ? '...' : ''}`));
    }
  }

  console.log('');
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log('');

  // Auto-open report in browser
  if (opts.open !== false && config.format === 'html') {
    openInBrowser(config.outputPath);
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function openInBrowser(filePath: string): void {
  const url = `file://${filePath}`;
  const cmd = platform() === 'darwin' ? 'open'
    : platform() === 'win32' ? 'start'
    : 'xdg-open';
  
  exec(`${cmd} "${url}"`, (err) => {
    if (err && process.env.OPENCLAW_INSIGHT_VERBOSE) {
      console.error(chalk.dim(`  Could not open browser: ${err.message}`));
    }
  });
}

// ─── Run ────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}\n`));
  if (process.env.OPENCLAW_INSIGHT_VERBOSE) {
    console.error(err.stack);
  }
  process.exit(1);
});
