/**
 * openclaw-insight — Interactive HTML Report Renderer
 * 
 * Generates a self-contained HTML report with interactive charts
 * and actionable insights. Uses Chart.js for visualizations.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { InsightReport, Suggestion } from './types.js';
import { formatNumber, formatTokens, formatCost, formatDuration, pct, escapeHtml } from './utils.js';

/**
 * Generate and write the HTML report
 */
export async function generateHtmlReport(
  report: InsightReport,
  outputPath: string
): Promise<void> {
  const html = renderReport(report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf-8');
}

/**
 * Generate JSON report
 */
export async function generateJsonReport(
  report: InsightReport,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

// ─── HTML Rendering ─────────────────────────────────────────────

function renderReport(report: InsightReport): string {
  const { summary } = report;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenClaw Insight Report — ${report.periodStart} to ${report.periodEnd}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
${getStyles()}
</style>
</head>
<body>

<header>
  <div class="header-content">
    <div class="logo">
      <span class="logo-icon">🦞</span>
      <h1>OpenClaw Insight</h1>
    </div>
    <div class="period">
      <span class="period-label">Analysis Period</span>
      <span class="period-dates">${report.periodStart} → ${report.periodEnd}</span>
      <span class="period-info">${report.daysAnalyzed} days · Generated ${new Date(report.generatedAt).toLocaleString()}</span>
    </div>
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">◐</button>
  </div>
</header>

<main>

<!-- ─── Stats Dashboard ──────────────────────────────── -->
<section class="stats-grid">
  ${renderStatCard('Sessions', formatNumber(summary.totalSessions), `${summary.avgSessionsPerDay}/day avg`, 'session')}
  ${renderStatCard('Messages', formatNumber(summary.totalMessages), `${summary.avgMessagesPerSession}/session avg`, 'message')}
  ${renderStatCard('Tokens Used', formatTokens(summary.totalTokens), `${formatTokens(summary.avgTokensPerSession)}/session avg`, 'token')}
  ${renderStatCard('Est. Cost', formatCost(summary.estimatedCostUsd), `${formatCost(summary.estimatedCostUsd / Math.max(summary.activeDays, 1))}/day`, 'cost')}
  ${renderStatCard('Active Days', `${summary.activeDays}`, `${summary.longestStreak}-day streak`, 'calendar')}
  ${renderStatCard('Channels', `${summary.uniqueChannels}`, `${summary.uniqueModels} models`, 'channel')}
</section>

<!-- ─── Executive Summary ────────────────────────────── -->
<section class="card">
  <h2>📊 At a Glance</h2>
  <div class="summary-grid">
    <div class="summary-box good">
      <h3>✅ What's Working</h3>
      <ul>
        ${summary.activeDays > 0 ? `<li>Active ${summary.activeDays} days out of ${report.daysAnalyzed} (${pct(summary.activeDays, report.daysAnalyzed)}% engagement)</li>` : ''}
        ${summary.longestStreak >= 3 ? `<li>Strong ${summary.longestStreak}-day usage streak</li>` : ''}
        ${summary.totalCacheRead > 0 ? `<li>Cache saving ${formatTokens(summary.totalCacheRead)} tokens (${pct(summary.totalCacheRead, summary.totalInputTokens)}% cache hit rate)</li>` : ''}
        ${summary.uniqueChannels > 1 ? `<li>Multi-channel usage across ${summary.uniqueChannels} platforms</li>` : ''}
        ${summary.avgMessagesPerSession >= 3 ? `<li>Healthy conversation depth (${summary.avgMessagesPerSession} msg/session)</li>` : ''}
      </ul>
    </div>
    <div class="summary-box warn">
      <h3>⚠️ Watch Points</h3>
      <ul>
        ${report.frictions.filter(f => f.type === 'excessive_compactions').length > 0 ? `<li>${report.frictions.filter(f => f.type === 'excessive_compactions').length} sessions hit context limits</li>` : ''}
        ${report.frictions.filter(f => f.type === 'high_token_waste').length > 0 ? `<li>${report.frictions.filter(f => f.type === 'high_token_waste').length} sessions with high token waste</li>` : ''}
        ${report.frictions.filter(f => f.type === 'abandoned_session').length > 0 ? `<li>${report.frictions.filter(f => f.type === 'abandoned_session').length} sessions appear abandoned</li>` : ''}
        ${report.frictions.filter(f => f.type === 'underutilized_cache').length > 0 ? `<li>${report.frictions.filter(f => f.type === 'underutilized_cache').length} sessions with zero cache hits</li>` : ''}
        ${summary.avgMessagesPerSession < 3 ? '<li>Low conversation depth — consider multi-turn interactions</li>' : ''}
      </ul>
    </div>
  </div>
</section>

<!-- ─── Charts ───────────────────────────────────────── -->
<section class="charts-row">
  <div class="card chart-card">
    <h2>📈 Daily Activity</h2>
    <canvas id="dailyChart"></canvas>
  </div>
  <div class="card chart-card">
    <h2>🕐 Hourly Distribution</h2>
    <canvas id="hourlyChart"></canvas>
  </div>
</section>

<section class="charts-row">
  <div class="card chart-card">
    <h2>📡 Channel Distribution</h2>
    <canvas id="channelChart"></canvas>
  </div>
  <div class="card chart-card">
    <h2>🤖 Model Usage</h2>
    <canvas id="modelChart"></canvas>
  </div>
</section>

<section class="charts-row">
  <div class="card chart-card">
    <h2>💰 Token Breakdown</h2>
    <canvas id="tokenChart"></canvas>
  </div>
  <div class="card chart-card">
    <h2>🔧 Top Tools</h2>
    <canvas id="toolChart"></canvas>
  </div>
</section>

<!-- ─── Patterns ─────────────────────────────────────── -->
${report.patterns.length > 0 ? `
<section class="card">
  <h2>🔍 Usage Patterns</h2>
  <div class="patterns-grid">
    ${report.patterns.map(p => `
    <div class="pattern-card impact-${p.impact}">
      <div class="pattern-header">
        <span class="pattern-type">${p.type.replace(/_/g, ' ')}</span>
        <span class="pattern-impact impact-badge-${p.impact}">${p.impact}</span>
      </div>
      <h4>${p.title}</h4>
      <p>${p.description}</p>
    </div>`).join('')}
  </div>
</section>` : ''}

<!-- ─── Friction Analysis ────────────────────────────── -->
${report.frictions.length > 0 ? `
<section class="card">
  <h2>🔥 Friction Analysis</h2>
  <p class="section-desc">Issues detected across ${report.frictions.length} friction events in your sessions.</p>
  <div class="friction-summary">
    ${renderFrictionSummary(report.frictions)}
  </div>
</section>` : ''}

<!-- ─── Suggestions ──────────────────────────────────── -->
${report.suggestions.length > 0 ? `
<section class="card suggestions-section">
  <h2>💡 Improvement Suggestions</h2>
  <p class="section-desc">Actionable recommendations ranked by impact and implementation effort.</p>
  <div class="suggestions-list">
    ${report.suggestions.map((s, i) => renderSuggestion(s, i)).join('')}
  </div>
</section>` : ''}

<!-- ─── Session Details ──────────────────────────────── -->
<section class="card">
  <h2>📋 Session Details</h2>
  <p class="section-desc">All ${report.sessionAnalyses.length} sessions analyzed in this period.</p>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Session</th>
          <th>Channel</th>
          <th>Model</th>
          <th>Messages</th>
          <th>Tokens</th>
          <th>Cache %</th>
          <th>Duration</th>
          <th>Compactions</th>
        </tr>
      </thead>
      <tbody>
        ${report.sessionAnalyses.slice(0, 100).map(s => `
        <tr>
          <td class="mono">${escapeHtml(s.sessionId.slice(0, 8))}…</td>
          <td><span class="channel-badge">${escapeHtml(s.channel)}</span></td>
          <td class="mono">${escapeHtml(s.model)}</td>
          <td>${s.messageCount} <span class="dim">(${s.userMessages}u/${s.assistantMessages}a)</span></td>
          <td>${formatTokens(s.totalTokens)}</td>
          <td>${s.inputTokens > 0 ? pct(s.cacheReadTokens, s.inputTokens) + '%' : '—'}</td>
          <td>${formatDuration(s.duration)}</td>
          <td>${s.compactionCount > 0 ? `<span class="warn-text">${s.compactionCount}</span>` : '0'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${report.sessionAnalyses.length > 100 ? `<p class="dim" style="text-align:center;margin-top:1rem">Showing 100 of ${report.sessionAnalyses.length} sessions. Export as JSON for full data.</p>` : ''}
  </div>
</section>

</main>

<footer>
  <p>Generated by <strong>openclaw-insight</strong> v${report.version || '0.0.0'} · Data is 100% local · No data uploaded</p>
</footer>

<script>
${getChartScript(report)}
${getThemeScript()}
</script>

</body>
</html>`;
}

// ─── Component Renderers ────────────────────────────────────────

function renderStatCard(label: string, value: string, sub: string, icon: string): string {
  const icons: Record<string, string> = {
    session: '💬', message: '📝', token: '🔤', cost: '💰', calendar: '📅', channel: '📡',
  };
  return `
  <div class="stat-card">
    <div class="stat-icon">${icons[icon] || '📊'}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-sub">${sub}</div>
  </div>`;
}

function renderFrictionSummary(frictions: InsightReport['frictions']): string {
  const groups = new Map<string, number>();
  for (const f of frictions) {
    groups.set(f.type, (groups.get(f.type) || 0) + 1);
  }

  const labels: Record<string, string> = {
    high_token_waste: '🔴 High Token Waste',
    excessive_compactions: '🟠 Excessive Compactions',
    abandoned_session: '🟡 Abandoned Sessions',
    repeated_retries: '🔵 Repeated Retries',
    underutilized_cache: '🟣 Underutilized Cache',
    context_overflow: '🔴 Context Overflow',
    single_message_sessions: '⚪ Single-Message Sessions',
  };

  return Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `
      <div class="friction-item">
        <span class="friction-label">${labels[type] || type}</span>
        <span class="friction-count">${count}</span>
        <div class="friction-bar">
          <div class="friction-bar-fill" style="width: ${Math.min(100, count / frictions.length * 100 * 2)}%"></div>
        </div>
      </div>`)
    .join('');
}

function renderSuggestion(suggestion: Suggestion, index: number): string {
  const impactColors: Record<string, string> = {
    high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
  };
  const effortLabels: Record<string, string> = {
    easy: '🟢 Easy', moderate: '🟡 Moderate', complex: '🔴 Complex',
  };
  const categoryIcons: Record<string, string> = {
    token_efficiency: '⚡', channel_optimization: '📡', model_selection: '🤖',
    context_management: '📚', scheduling: '⏰', memory_utilization: '🧠',
    feature_discovery: '🔍', workflow_improvement: '🔄',
  };

  return `
  <div class="suggestion-card" onclick="this.classList.toggle('expanded')">
    <div class="suggestion-header">
      <span class="suggestion-num">#${index + 1}</span>
      <span class="suggestion-icon">${categoryIcons[suggestion.category] || '💡'}</span>
      <div class="suggestion-title-group">
        <h4>${suggestion.title}</h4>
        <p>${suggestion.description}</p>
      </div>
      <div class="suggestion-badges">
        <span class="impact-badge" style="background:${impactColors[suggestion.impact]}20;color:${impactColors[suggestion.impact]}">
          ${suggestion.impact} impact
        </span>
        <span class="effort-badge">${effortLabels[suggestion.effort]}</span>
      </div>
      <span class="expand-icon">▸</span>
    </div>
    ${suggestion.details || suggestion.configSnippet ? `
    <div class="suggestion-details">
      ${suggestion.details ? `<p>${suggestion.details}</p>` : ''}
      ${suggestion.configSnippet ? `<pre><code>${suggestion.configSnippet}</code></pre>` : ''}
    </div>` : ''}
  </div>`;
}

// ─── Styles ─────────────────────────────────────────────────────

function getStyles(): string {
  return `
:root {
  --bg: #0f172a; --bg2: #1e293b; --bg3: #334155;
  --fg: #f1f5f9; --fg2: #94a3b8; --fg3: #64748b;
  --accent: #38bdf8; --accent2: #818cf8; --accent3: #a78bfa;
  --green: #4ade80; --yellow: #facc15; --red: #f87171; --orange: #fb923c;
  --radius: 12px; --shadow: 0 4px 24px rgba(0,0,0,0.3);
}
[data-theme="light"] {
  --bg: #f8fafc; --bg2: #ffffff; --bg3: #e2e8f0;
  --fg: #0f172a; --fg2: #475569; --fg3: #94a3b8;
  --shadow: 0 4px 24px rgba(0,0,0,0.08);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; }
header { background: var(--bg2); border-bottom: 1px solid var(--bg3); padding: 1.5rem 2rem; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(12px); }
.header-content { max-width: 1400px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.logo { display: flex; align-items: center; gap: 0.75rem; }
.logo-icon { font-size: 2rem; }
.logo h1 { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.period { margin-left: auto; text-align: right; }
.period-label { display: block; font-size: 0.75rem; color: var(--fg3); text-transform: uppercase; letter-spacing: 0.05em; }
.period-dates { display: block; font-size: 1.1rem; font-weight: 600; color: var(--fg); }
.period-info { display: block; font-size: 0.8rem; color: var(--fg2); }
.theme-toggle { background: var(--bg3); border: none; color: var(--fg); font-size: 1.2rem; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: transform 0.3s; }
.theme-toggle:hover { transform: rotate(180deg); }
main { max-width: 1400px; margin: 2rem auto; padding: 0 2rem; display: flex; flex-direction: column; gap: 2rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.stat-card { background: var(--bg2); border-radius: var(--radius); padding: 1.5rem; text-align: center; box-shadow: var(--shadow); border: 1px solid var(--bg3); transition: transform 0.2s; }
.stat-card:hover { transform: translateY(-2px); }
.stat-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.stat-value { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-label { font-size: 0.85rem; color: var(--fg2); margin-top: 0.25rem; }
.stat-sub { font-size: 0.75rem; color: var(--fg3); margin-top: 0.25rem; }
.card { background: var(--bg2); border-radius: var(--radius); padding: 2rem; box-shadow: var(--shadow); border: 1px solid var(--bg3); }
.card h2 { font-size: 1.3rem; margin-bottom: 1rem; font-weight: 700; }
.section-desc { color: var(--fg2); margin-bottom: 1.5rem; font-size: 0.9rem; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
.chart-card canvas { width: 100% !important; height: 300px !important; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.summary-box { border-radius: 8px; padding: 1.5rem; }
.summary-box.good { background: rgba(74, 222, 128, 0.08); border: 1px solid rgba(74, 222, 128, 0.2); }
.summary-box.warn { background: rgba(251, 146, 60, 0.08); border: 1px solid rgba(251, 146, 60, 0.2); }
.summary-box h3 { font-size: 1rem; margin-bottom: 0.75rem; }
.summary-box ul { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.summary-box li { font-size: 0.9rem; color: var(--fg2); padding-left: 0.5rem; }
.patterns-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
.pattern-card { background: var(--bg); border-radius: 8px; padding: 1.25rem; border: 1px solid var(--bg3); }
.pattern-card.impact-high { border-left: 3px solid var(--red); }
.pattern-card.impact-medium { border-left: 3px solid var(--yellow); }
.pattern-card.impact-low { border-left: 3px solid var(--green); }
.pattern-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.pattern-type { font-size: 0.75rem; color: var(--fg3); text-transform: uppercase; letter-spacing: 0.05em; }
.impact-badge-high { color: var(--red); } .impact-badge-medium { color: var(--yellow); } .impact-badge-low { color: var(--green); }
.pattern-card h4 { font-size: 0.95rem; margin-bottom: 0.5rem; }
.pattern-card p { font-size: 0.85rem; color: var(--fg2); }
.friction-summary { display: flex; flex-direction: column; gap: 0.75rem; }
.friction-item { display: grid; grid-template-columns: 200px 50px 1fr; align-items: center; gap: 1rem; }
.friction-label { font-size: 0.9rem; }
.friction-count { font-weight: 700; text-align: center; color: var(--accent); }
.friction-bar { height: 8px; background: var(--bg3); border-radius: 4px; overflow: hidden; }
.friction-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 4px; transition: width 0.5s ease; }
.suggestions-list { display: flex; flex-direction: column; gap: 0.75rem; }
.suggestion-card { background: var(--bg); border-radius: 8px; border: 1px solid var(--bg3); overflow: hidden; cursor: pointer; transition: border-color 0.2s; }
.suggestion-card:hover { border-color: var(--accent); }
.suggestion-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; }
.suggestion-num { font-size: 0.8rem; color: var(--fg3); font-weight: 700; min-width: 2rem; }
.suggestion-icon { font-size: 1.2rem; }
.suggestion-title-group { flex: 1; }
.suggestion-title-group h4 { font-size: 0.95rem; margin-bottom: 0.25rem; }
.suggestion-title-group p { font-size: 0.85rem; color: var(--fg2); }
.suggestion-badges { display: flex; gap: 0.5rem; flex-shrink: 0; }
.impact-badge, .effort-badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
.effort-badge { background: var(--bg3); color: var(--fg2); }
.expand-icon { color: var(--fg3); transition: transform 0.2s; }
.suggestion-card.expanded .expand-icon { transform: rotate(90deg); }
.suggestion-details { display: none; padding: 0 1.25rem 1.25rem 3.75rem; }
.suggestion-card.expanded .suggestion-details { display: block; }
.suggestion-details p { font-size: 0.9rem; color: var(--fg2); margin-bottom: 0.75rem; }
.suggestion-details pre { background: var(--bg2); border-radius: 6px; padding: 1rem; overflow-x: auto; }
.suggestion-details code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; color: var(--accent); }
.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th { text-align: left; padding: 0.75rem; border-bottom: 2px solid var(--bg3); color: var(--fg2); font-weight: 600; position: sticky; top: 0; background: var(--bg2); }
td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--bg3); }
tr:hover td { background: var(--bg); }
.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }
.dim { color: var(--fg3); font-size: 0.8rem; }
.channel-badge { background: rgba(56,189,248,0.15); color: var(--accent); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.warn-text { color: var(--orange); font-weight: 700; }
footer { text-align: center; padding: 3rem 2rem; color: var(--fg3); font-size: 0.85rem; }
footer strong { color: var(--accent); }
@media (max-width: 768px) {
  .charts-row, .summary-grid { grid-template-columns: 1fr; }
  .header-content { flex-direction: column; align-items: flex-start; }
  .period { margin-left: 0; text-align: left; }
  .friction-item { grid-template-columns: 1fr 40px 1fr; }
  .suggestion-header { flex-wrap: wrap; }
  .suggestion-badges { width: 100%; }
}
`;
}

// ─── Chart Scripts ──────────────────────────────────────────────

function getChartScript(report: InsightReport): string {
  const { dailyActivity, hourlyDistribution, channelStats, modelStats, summary, sessionAnalyses } = report;

  // Aggregate tool usage across all sessions
  const toolAgg = new Map<string, number>();
  for (const session of sessionAnalyses) {
    for (const tool of session.toolUses) {
      toolAgg.set(tool.name, (toolAgg.get(tool.name) || 0) + tool.count);
    }
  }
  const topTools = Array.from(toolAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const colors = [
    '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb923c',
    '#4ade80', '#facc15', '#22d3ee', '#f87171', '#34d399'
  ];

  return `
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--fg2').trim() || '#94a3b8' } } },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
  }
};

// Daily Activity Chart
new Chart(document.getElementById('dailyChart'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(dailyActivity.map(d => d.date.slice(5)))},
    datasets: [
      { label: 'Sessions', data: ${JSON.stringify(dailyActivity.map(d => d.sessions))}, backgroundColor: '#38bdf8', borderRadius: 4, order: 2 },
      { label: 'Messages', data: ${JSON.stringify(dailyActivity.map(d => d.messages))}, type: 'line', borderColor: '#818cf8', borderWidth: 2, pointRadius: 2, fill: false, order: 1 }
    ]
  },
  options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, tooltip: { mode: 'index', intersect: false } } }
});

// Hourly Distribution Chart
new Chart(document.getElementById('hourlyChart'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(hourlyDistribution.map(h => h.hour + ':00'))},
    datasets: [
      { label: 'Sessions', data: ${JSON.stringify(hourlyDistribution.map(h => h.sessions))}, backgroundColor: ${JSON.stringify(hourlyDistribution.map(h => h.sessions > 0 ? '#38bdf8' : 'rgba(56,189,248,0.2)'))}, borderRadius: 4 }
    ]
  },
  options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
});

// Channel Distribution Chart
new Chart(document.getElementById('channelChart'), {
  type: 'doughnut',
  data: {
    labels: ${JSON.stringify(channelStats.map(c => c.channel))},
    datasets: [{ data: ${JSON.stringify(channelStats.map(c => c.sessions))}, backgroundColor: ${JSON.stringify(colors.slice(0, channelStats.length))}, borderWidth: 0, hoverOffset: 8 }]
  },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, usePointStyle: true, pointStyle: 'circle' } } } }
});

// Model Usage Chart
new Chart(document.getElementById('modelChart'), {
  type: 'doughnut',
  data: {
    labels: ${JSON.stringify(modelStats.map(m => m.model))},
    datasets: [{ data: ${JSON.stringify(modelStats.map(m => m.sessions))}, backgroundColor: ${JSON.stringify(colors.slice(0, modelStats.length).reverse())}, borderWidth: 0, hoverOffset: 8 }]
  },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, usePointStyle: true, pointStyle: 'circle' } } } }
});

// Token Breakdown Chart
new Chart(document.getElementById('tokenChart'), {
  type: 'bar',
  data: {
    labels: ['Input', 'Output', 'Cache Read', 'Cache Write'],
    datasets: [{
      data: [${summary.totalInputTokens}, ${summary.totalOutputTokens}, ${summary.totalCacheRead}, ${summary.totalCacheWrite}],
      backgroundColor: ['#38bdf8', '#818cf8', '#4ade80', '#facc15'],
      borderRadius: 6
    }]
  },
  options: { ...chartDefaults, indexAxis: 'y', plugins: { ...chartDefaults.plugins, legend: { display: false } } }
});

// Tool Usage Chart
${topTools.length > 0 ? `
new Chart(document.getElementById('toolChart'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(topTools.map(([name]) => name))},
    datasets: [{
      data: ${JSON.stringify(topTools.map(([, count]) => count))},
      backgroundColor: '#a78bfa',
      borderRadius: 6
    }]
  },
  options: { ...chartDefaults, indexAxis: 'y', plugins: { ...chartDefaults.plugins, legend: { display: false } } }
});` : `
document.getElementById('toolChart').parentElement.innerHTML = '<h2>🔧 Top Tools</h2><p style="color:var(--fg3);text-align:center;padding:2rem">No tool usage detected</p>';
`}
`;
}

function getThemeScript(): string {
  return `
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  localStorage.setItem('openclaw-insight-theme', html.getAttribute('data-theme'));
}
// Restore saved theme
const saved = localStorage.getItem('openclaw-insight-theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);
`;
}
