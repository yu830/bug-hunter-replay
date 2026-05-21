import type { ActionStep } from '../types/action.js';
import type { NetworkEvent } from '../types/event.js';
import type { BugHunterReport, CapturedIssue } from '../types/report.js';

export function renderMarkdownReport(report: BugHunterReport): string {
  return [
    '# Bug Hunter Replay Report',
    '',
    `Run ID: ${report.runId}`,
    `Start URL: ${report.startUrl}`,
    `Started: ${report.startedAt}`,
    `Ended: ${report.endedAt}`,
    '',
    '## Summary',
    '',
    `- Actions discovered: ${report.summary.actionsDiscovered}`,
    `- Actions executed: ${report.summary.actionsExecuted}`,
    `- Issues found: ${report.summary.issuesFound}`,
    `- Network events captured: ${report.summary.networkEventsCaptured}`,
    '',
    '## Issues',
    '',
    renderIssues(report.issues),
    '',
    '## Action Timeline',
    '',
    renderActionTimeline(report.actions),
    '',
    '## Network Problems',
    '',
    renderNetworkProblems(report.networkEvents, report.config.slowThreshold),
    '',
    '## Reproduction',
    '',
    '```bash',
    `npx playwright test ${displayPath(report.artifacts.reproSpecPath)}`,
    '```',
    '',
    '## Config',
    '',
    ...Object.entries(report.config).map(([key, value]) => `- ${key}: ${String(value)}`),
    ''
  ].join('\n');
}

function renderIssues(issues: CapturedIssue[]): string {
  if (issues.length === 0) {
    return 'No issues found.';
  }

  return issues
    .map((issue) => {
      const lines = [
        `### ${issue.id}: ${issue.title}`,
        '',
        `- Type: ${issue.type}`,
        `- Severity: ${issue.severity}`,
        `- URL: ${issue.url}`,
        `- Message: ${issue.message}`,
        `- Timestamp: ${issue.timestamp}`
      ];

      if (issue.stepId) {
        lines.push(`- Step: ${issue.stepId}`);
      }

      if (issue.actionPath.length > 0) {
        lines.push(`- Action path: ${issue.actionPath.join(' > ')}`);
      }

      if (issue.screenshot) {
        lines.push('', `![Issue screenshot](${issue.screenshot})`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

function renderActionTimeline(actions: ActionStep[]): string {
  if (actions.length === 0) {
    return 'No actions discovered.';
  }

  return [
    '| ID | Type | Label | Status | URL Before |',
    '| --- | --- | --- | --- | --- |',
    ...actions.map((action) =>
      [action.id, action.type, action.label, action.status, action.urlBefore].map(escapeTableCell).join(' | ')
    )
  ]
    .map((line) => (line.startsWith('|') ? line : `| ${line} |`))
    .join('\n');
}

function renderNetworkProblems(networkEvents: NetworkEvent[], slowThreshold: number): string {
  const problemEvents = networkEvents.filter(
    (event) =>
      event.failedText ||
      (event.status !== undefined && event.status >= 400) ||
      (event.durationMs !== undefined && event.durationMs > slowThreshold)
  );

  if (problemEvents.length === 0) {
    return 'No network problems found.';
  }

  return [
    '| URL | Method | Type | Status | Duration (ms) |',
    '| --- | --- | --- | --- | --- |',
    ...problemEvents.map((event) =>
      [
        event.requestUrl,
        event.method,
        event.resourceType,
        event.status?.toString() ?? event.failedText ?? '',
        event.durationMs?.toString() ?? ''
      ]
        .map(escapeTableCell)
        .join(' | ')
    )
  ]
    .map((line) => (line.startsWith('|') ? line : `| ${line} |`))
    .join('\n');
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}
