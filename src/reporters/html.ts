import type { ActionStep } from '../types/action.js';
import type { NetworkEvent } from '../types/event.js';
import type { BugHunterReport, CapturedIssue } from '../types/report.js';

export function renderHtmlReport(report: BugHunterReport): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bug Hunter Replay Report</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #18202f; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin-top: 32px; border-bottom: 1px solid #dbe1ea; padding-bottom: 8px; }
    .meta { margin: 0; color: #5d6b82; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .summary-card, .issue-card, .panel { background: #fff; border: 1px solid #dbe1ea; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
    .summary-card { padding: 16px; }
    .summary-card strong { display: block; font-size: 28px; margin-bottom: 4px; }
    .summary-card span { color: #5d6b82; }
    .issue-grid { display: grid; gap: 16px; }
    .issue-card { padding: 16px; border-left-width: 6px; }
    .severity-critical { border-left-color: #7f1d1d; }
    .severity-error { border-left-color: #dc2626; }
    .severity-warning { border-left-color: #d97706; }
    .severity-info { border-left-color: #2563eb; }
    .issue-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
    .issue-heading h3 { margin: 0; }
    .severity-label { border-radius: 999px; padding: 2px 10px; background: #eef2f7; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .issue-message { margin: 8px 0; }
    .issue-meta { color: #5d6b82; font-size: 14px; }
    .issue-screenshot { display: block; max-width: 320px; max-height: 220px; margin-top: 12px; border: 1px solid #dbe1ea; border-radius: 8px; object-fit: contain; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dbe1ea; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8edf5; text-align: left; vertical-align: top; }
    th { background: #eef2f7; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr:last-child td { border-bottom: 0; }
    code { background: #eef2f7; border-radius: 4px; padding: 2px 5px; }
    dl { display: grid; grid-template-columns: minmax(120px, 220px) 1fr; gap: 8px 16px; padding: 16px; margin: 0; }
    dt { font-weight: 700; }
    dd { margin: 0; color: #344054; }
    .empty { padding: 16px; color: #5d6b82; }
  </style>
</head>
<body>
  <main>
    <h1>Bug Hunter Replay Report</h1>
    <p class="meta">Run ${escapeHtml(report.runId)} · ${escapeHtml(report.startUrl)}</p>
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Summary</h2>
      <div class="summary-grid">
        ${summaryCard('Actions discovered', report.summary.actionsDiscovered)}
        ${summaryCard('Actions executed', report.summary.actionsExecuted)}
        ${summaryCard('Issues found', report.summary.issuesFound)}
        ${summaryCard('Network events', report.summary.networkEventsCaptured)}
      </div>
    </section>
    <section aria-labelledby="issues-heading">
      <h2 id="issues-heading">Issues</h2>
      ${renderIssueCards(report.issues)}
    </section>
    <section aria-labelledby="actions-heading">
      <h2 id="actions-heading">Action Timeline</h2>
      ${renderActionTimeline(report.actions)}
    </section>
    <section aria-labelledby="network-heading">
      <h2 id="network-heading">Network Problems</h2>
      ${renderNetworkProblems(report.networkEvents, report.config.slowThreshold)}
    </section>
    <section aria-labelledby="reproduction-heading">
      <h2 id="reproduction-heading">Reproduction</h2>
      <div class="panel"><p class="empty"><a href="repro.spec.ts">repro.spec.ts</a></p><p class="empty"><code>npx playwright test ${escapeHtml(displayPath(report.artifacts.reproSpecPath))}</code></p></div>
    </section>
    <section aria-labelledby="config-heading">
      <h2 id="config-heading">Config</h2>
      <div class="panel">${renderConfig(report)}</div>
    </section>
  </main>
</body>
</html>
`;
}

function summaryCard(label: string, value: number): string {
  return `<div class="summary-card"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderIssueCards(issues: CapturedIssue[]): string {
  if (issues.length === 0) {
    return '<div class="panel empty">No issues found.</div>';
  }

  return `<div class="issue-grid">${issues.map(renderIssueCard).join('')}</div>`;
}

function renderIssueCard(issue: CapturedIssue): string {
  const actionPath = issue.actionPath.length > 0 ? `<p class="issue-meta">Action path: ${escapeHtml(issue.actionPath.join(' > '))}</p>` : '';
  const step = issue.stepId ? `<p class="issue-meta">Step: ${escapeHtml(issue.stepId)}</p>` : '';
  const screenshot = issue.screenshot
    ? `<img class="issue-screenshot" src="${escapeAttribute(issue.screenshot)}" alt="Screenshot for ${escapeAttribute(issue.id)}">`
    : '';

  return `<article class="issue-card severity-${escapeAttribute(issue.severity)}">
    <div class="issue-heading"><h3>${escapeHtml(issue.id)}: ${escapeHtml(issue.title)}</h3><span class="severity-label">${escapeHtml(issue.severity)}</span></div>
    <p class="issue-message">${escapeHtml(issue.message)}</p>
    <p class="issue-meta">${escapeHtml(issue.type)} · ${escapeHtml(issue.url)} · ${escapeHtml(issue.timestamp)}</p>
    ${step}
    ${actionPath}
    ${screenshot}
  </article>`;
}

function renderActionTimeline(actions: ActionStep[]): string {
  if (actions.length === 0) {
    return '<div class="panel empty">No actions discovered.</div>';
  }

  return `<table><thead><tr><th>ID</th><th>Type</th><th>Label</th><th>Status</th><th>URL Before</th></tr></thead><tbody>${actions
    .map(
      (action) =>
        `<tr><td>${escapeHtml(action.id)}</td><td>${escapeHtml(action.type)}</td><td>${escapeHtml(action.label)}</td><td>${escapeHtml(action.status)}</td><td>${escapeHtml(action.urlBefore)}</td></tr>`
    )
    .join('')}</tbody></table>`;
}

function renderNetworkProblems(networkEvents: NetworkEvent[], slowThreshold: number): string {
  const problemEvents = networkEvents.filter(
    (event) =>
      event.failedText ||
      (event.status !== undefined && event.status >= 400) ||
      (event.durationMs !== undefined && event.durationMs > slowThreshold)
  );

  if (problemEvents.length === 0) {
    return '<div class="panel empty">No network problems found.</div>';
  }

  return `<table><thead><tr><th>URL</th><th>Method</th><th>Type</th><th>Status</th><th>Duration (ms)</th></tr></thead><tbody>${problemEvents
    .map(
      (event) =>
        `<tr><td>${escapeHtml(event.requestUrl)}</td><td>${escapeHtml(event.method)}</td><td>${escapeHtml(event.resourceType)}</td><td>${escapeHtml(event.status?.toString() ?? event.failedText ?? '')}</td><td>${escapeHtml(event.durationMs?.toString() ?? '')}</td></tr>`
    )
    .join('')}</tbody></table>`;
}

function renderConfig(report: BugHunterReport): string {
  return `<dl>${Object.entries(report.config)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join('')}</dl>`;
}

function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
