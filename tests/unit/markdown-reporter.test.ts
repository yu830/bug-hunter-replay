import { describe, expect, test } from 'vitest';

import { renderMarkdownReport } from '../../src/reporters/markdown.js';
import type { BugHunterReport } from '../../src/types/report.js';

describe('renderMarkdownReport', () => {
  test('renders required report sections with issue screenshots', () => {
    const markdown = renderMarkdownReport(reportFixture());

    expect(markdown).toContain('# Bug Hunter Replay Report');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Issues');
    expect(markdown).toContain('## Action Timeline');
    expect(markdown).toContain('## Network Problems');
    expect(markdown).toContain('## Reproduction');
    expect(markdown).toContain('npx playwright test reports/2026-05-21_000000_example-com/repro.spec.ts');
    expect(markdown).toContain('## Config');
    expect(markdown).toContain('- Issues found: 2');
    expect(markdown).toContain('### issue-1: Console error');
    expect(markdown).toContain('![Issue screenshot](screenshots/step-001-after.png)');
    expect(markdown).toContain('| action-1 | click | Open menu | failed | https://example.com |');
    expect(markdown).toContain('| https://example.com/api | GET | fetch | 500 | 125 |');
    expect(markdown).toContain('- maxActions: 5');
  });
});

function reportFixture(): BugHunterReport {
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
      actionsDiscovered: 1,
      actionsExecuted: 1,
      issuesFound: 2,
      networkEventsCaptured: 1
    },
    actions: [
      {
        id: 'action-1',
        index: 0,
        type: 'click',
        label: 'Open menu',
        selector: 'text="Open menu"',
        urlBefore: 'https://example.com',
        depth: 0,
        status: 'failed',
        errorMessage: 'locator timeout',
        screenshotAfter: 'screenshots/step-001-after.png'
      }
    ],
    issues: [
      {
        id: 'issue-1',
        dedupeKey: 'console_error:https://example.com:boom',
        type: 'console_error',
        severity: 'warning',
        title: 'Console error',
        message: 'boom',
        url: 'https://example.com',
        actionPath: [],
        screenshot: 'screenshots/step-001-after.png',
        timestamp: '2026-05-21T00:00:00.000Z'
      },
      {
        id: 'issue-2',
        dedupeKey: 'http_5xx:https://example.com/api:server error',
        type: 'http_5xx',
        severity: 'error',
        title: 'HTTP 500',
        message: 'server error',
        url: 'https://example.com/api',
        actionPath: [],
        timestamp: '2026-05-21T00:00:00.000Z'
      }
    ],
    events: [],
    networkEvents: [
      {
        id: 'network-1',
        requestUrl: 'https://example.com/api',
        method: 'GET',
        resourceType: 'fetch',
        status: 500,
        statusText: 'Internal Server Error',
        startedAt: '2026-05-21T00:00:00.000Z',
        endedAt: '2026-05-21T00:00:00.125Z',
        durationMs: 125
      }
    ],
    artifacts: {
      reportJsonPath: 'reports/2026-05-21_000000_example-com/report.json',
      reportMarkdownPath: 'reports/2026-05-21_000000_example-com/report.md',
      reportHtmlPath: 'reports/2026-05-21_000000_example-com/report.html',
      reproSpecPath: 'reports\\2026-05-21_000000_example-com\\repro.spec.ts',
      screenshots: ['screenshots/initial.png', 'screenshots/step-001-after.png']
    }
  };
}
