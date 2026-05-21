import { describe, expect, test } from 'vitest';

import { renderReproSpec } from '../../src/reporters/repro-spec.js';
import type { ActionStep } from '../../src/types/action.js';
import type { BugHunterReport, CapturedIssue } from '../../src/types/report.js';

describe('renderReproSpec', () => {
  test('renders issue-specific assertions and replays a multi-step action path', () => {
    const spec = renderReproSpec(
      reportFixture({
        issues: [
          issue({
            id: 'issue-1',
            type: 'console_error',
            message: 'nested console error',
            stepId: 'action-2',
            actionPath: ['Docs', 'Trigger nested console']
          })
        ],
        actions: [
          action({
            id: 'action-1',
            label: 'Docs',
            selector: '[data-testid="docs-link"]',
            status: 'passed',
            actionPath: ['Docs']
          }),
          action({
            id: 'action-2',
            parentId: 'action-1',
            label: 'Trigger nested console',
            selector: '[aria-label="Trigger nested console"]',
            status: 'passed',
            actionPath: ['Docs', 'Trigger nested console']
          })
        ]
      })
    );

    expect(spec).toContain("test('reproduces issue-1 console_error'");
    expect(spec).toContain("await page.getByTestId('docs-link').click();");
    expect(spec).toContain("await page.getByLabel('Trigger nested console').click();");
    expect(spec).toContain("expect(consoleErrors.some(message => message.includes('nested console error'))).toBe(true);");
  });

  test('renders assertions for supported issue types', () => {
    const spec = renderReproSpec(
      reportFixture({
        issues: [
          issue({ id: 'issue-1', type: 'page_error', message: 'demo page error' }),
          issue({ id: 'issue-2', type: 'request_failed', message: 'net::ERR_FAILED' }),
          issue({ id: 'issue-3', type: 'http_5xx', title: 'HTTP 500', message: 'Internal Server Error', metadata: { status: 500 } }),
          issue({ id: 'issue-4', type: 'slow_request', message: 'Slow request: 150ms', metadata: { thresholdMs: 100 } }),
          issue({ id: 'issue-5', type: 'blank_page', message: 'Blank page detected' })
        ]
      })
    );

    expect(spec).toContain("expect(pageErrors.some(message => message.includes('demo page error'))).toBe(true);");
    expect(spec).toContain('expect(failedRequests.length).toBeGreaterThan(0);');
    expect(spec).toContain('expect(responseStatuses.some(response => response.status === 500)).toBe(true);');
    expect(spec).toContain('expect(slowRequests.some(request => request.durationMs > 100)).toBe(true);');
    expect(spec).toContain('expect(blankPage.textLength).toBeLessThan(20);');
    expect(spec).toContain('expect(blankPage.visibleElementCount).toBeLessThanOrEqual(2);');
  });

  test('renders a base spec when there are no issues', () => {
    const spec = renderReproSpec(reportFixture({ issues: [], actions: [action({ status: 'passed' })] }));

    expect(spec).toContain("await page.goto('https://example.com');");
    expect(spec).toContain('const consoleErrors: string[] = [];');
    expect(spec).toContain("await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });");
    expect(spec).toContain('expect(consoleErrors).toHaveLength(0);');
    expect(spec).toContain('expect(pageErrors).toHaveLength(0);');
  });

  test('escapes string literals in generated Playwright actions and assertions', () => {
    const spec = renderReproSpec(
      reportFixture({
        startUrl: "https://example.com/?q='quoted'",
        issues: [
          issue({
            id: 'issue-1',
            type: 'console_error',
            message: "can't open",
            stepId: 'action-1',
            actionPath: ['Open "menu"']
          })
        ],
        actions: [
          action({
            id: 'action-1',
            label: 'Open "menu"',
            selector: 'text="Open \\"menu\\""',
            status: 'failed',
            actionPath: ['Open "menu"']
          })
        ]
      })
    );

    expect(spec).toContain("await page.goto('https://example.com/?q=\\'quoted\\'');");
    expect(spec).toContain("await page.getByText('Open \"menu\"').click();");
    expect(spec).toContain("message.includes('can\\'t open')");
  });
});

function reportFixture(overrides: Partial<BugHunterReport> = {}): BugHunterReport {
  return {
    runId: '2026-05-21_000000_example-com',
    startUrl: 'https://example.com',
    startedAt: '2026-05-21T00:00:00.000Z',
    endedAt: '2026-05-21T00:00:01.000Z',
    config: {
      maxDepth: 2,
      maxActions: 5,
      timeout: 10000,
      slowThreshold: 3000,
      output: './reports',
      headful: false,
      sameOriginOnly: true,
      trace: true
    },
    summary: {
      actionsDiscovered: 5,
      actionsExecuted: 3,
      issuesFound: overrides.issues?.length ?? 0,
      networkEventsCaptured: 0
    },
    actions: [action({ id: 'action-1', label: 'Open menu', selector: 'text="Open menu"', status: 'passed' })],
    issues: [],
    events: [],
    networkEvents: [],
    artifacts: {
      reportJsonPath: 'reports/2026-05-21_000000_example-com/report.json',
      reportMarkdownPath: 'reports/2026-05-21_000000_example-com/report.md',
      reportHtmlPath: 'reports/2026-05-21_000000_example-com/report.html',
      reproSpecPath: 'reports/2026-05-21_000000_example-com/repro.spec.ts',
      screenshots: []
    },
    ...overrides
  };
}

function action(overrides: Partial<ActionStep> = {}): ActionStep {
  return {
    id: 'action-1',
    index: 0,
    type: 'click',
    label: 'Open menu',
    selector: 'text="Open menu"',
    urlBefore: 'https://example.com',
    depth: 1,
    status: 'passed',
    actionPath: ['Open menu'],
    ...overrides
  };
}

function issue(overrides: Partial<CapturedIssue> = {}): CapturedIssue {
  return {
    id: 'issue-1',
    dedupeKey: 'console_error:https://example.com:demo',
    type: 'console_error',
    severity: 'error',
    title: 'Console error',
    message: 'demo',
    url: 'https://example.com',
    actionPath: [],
    timestamp: '2026-05-21T00:00:00.000Z',
    ...overrides
  };
}
