import { describe, expect, test } from 'vitest';

import { renderReproSpec } from '../../src/reporters/repro-spec.js';
import type { ActionStep } from '../../src/types/action.js';
import type { BugHunterReport } from '../../src/types/report.js';

describe('renderReproSpec', () => {
  test('renders console capture, screenshot, assertion, and only the action referenced by issue.stepId', () => {
    const spec = renderReproSpec(
      reportFixture({
        issues: [
          {
            id: 'issue-1',
            dedupeKey: 'blank_page:https://example.com:blank page detected',
            type: 'blank_page',
            severity: 'error',
            title: 'Blank page',
            message: 'Blank page detected',
            url: 'https://example.com',
            stepId: 'action-2',
            actionPath: ['Email'],
            timestamp: '2026-05-21T00:00:00.000Z'
          }
        ]
      })
    );

    expect(spec).toContain("import { test, expect } from 'playwright/test';");
    expect(spec).toContain('const consoleErrors: string[] = [];');
    expect(spec).toContain("page.on('console', msg => {");
    expect(spec).toContain("if (msg.type() === 'error') consoleErrors.push(msg.text());");
    expect(spec).toContain("await page.goto('https://example.com');");
    expect(spec).toContain("await page.getByLabel('Email').fill('bug-hunter-test');");
    expect(spec).toContain("await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });");
    expect(spec).toContain('expect(consoleErrors).toHaveLength(0);');
    expect(spec).not.toContain("page.getByText('Open menu').click();");
    expect(spec).not.toContain("page.getByLabel('Plan').selectOption");
    expect(spec).not.toContain('Delete account');
  });

  test('falls back to the first failed action when no issue has stepId', () => {
    const spec = renderReproSpec(
      reportFixture({
        actions: [
          action({ id: 'action-1', index: 0, label: 'Open menu', selector: 'text="Open menu"', status: 'passed' }),
          action({ id: 'action-2', index: 1, label: 'Email', selector: '[aria-label="Email"]', type: 'fill', status: 'failed' }),
          action({ id: 'action-3', index: 2, label: 'Plan', selector: '[aria-label="Plan"]', type: 'select', status: 'failed' })
        ]
      })
    );

    expect(spec).toContain("await page.getByLabel('Email').fill('bug-hunter-test');");
    expect(spec).not.toContain("page.getByText('Open menu').click();");
    expect(spec).not.toContain('action3Option');
  });

  test('renders a base spec when there is no issue stepId and no failed action', () => {
    const spec = renderReproSpec(reportFixture({ issues: [], actions: [action({ status: 'passed' })] }));

    expect(spec).toContain("await page.goto('https://example.com');");
    expect(spec).toContain('const consoleErrors: string[] = [];');
    expect(spec).toContain("await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });");
    expect(spec).toContain('expect(consoleErrors).toHaveLength(0);');
    expect(spec).not.toContain('.click();');
    expect(spec).not.toContain(".fill('bug-hunter-test');");
    expect(spec).not.toContain('.selectOption');
  });

  test('escapes string literals in generated Playwright actions', () => {
    const spec = renderReproSpec(
      reportFixture({
        startUrl: "https://example.com/?q='quoted'",
        issues: [
          {
            id: 'issue-1',
            dedupeKey: 'action_failed:https://example.com:failed',
            type: 'action_failed',
            severity: 'warning',
            title: 'Action failed',
            message: 'failed',
            url: 'https://example.com',
            stepId: 'action-1',
            actionPath: ['Open "menu"'],
            timestamp: '2026-05-21T00:00:00.000Z'
          }
        ],
        actions: [
          action({
            id: 'action-1',
            label: 'Open "menu"',
            selector: 'text="Open \\"menu\\""',
            status: 'failed'
          })
        ]
      })
    );

    expect(spec).toContain("await page.goto('https://example.com/?q=\\'quoted\\'');");
    expect(spec).toContain("await page.getByText('Open \"menu\"').click();");
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
    actions: [
      action({ id: 'action-1', index: 0, label: 'Open menu', selector: 'text="Open menu"', status: 'passed' }),
      action({ id: 'action-2', index: 1, label: 'Email', selector: '[aria-label="Email"]', type: 'fill', status: 'passed' }),
      action({ id: 'action-3', index: 2, label: 'Plan', selector: '[aria-label="Plan"]', type: 'select', status: 'passed' }),
      action({ id: 'action-4', index: 3, label: 'Delete account', selector: 'text="Delete account"', status: 'skipped' })
    ],
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
    depth: 0,
    status: 'passed',
    ...overrides
  };
}
