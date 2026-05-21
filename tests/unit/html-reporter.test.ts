import { describe, expect, test } from 'vitest';

import { renderHtmlReport } from '../../src/reporters/html.js';
import type { BugHunterReport } from '../../src/types/report.js';

describe('renderHtmlReport', () => {
  test('renders a standalone HTML report with summary, issues, screenshots, actions, network problems, and config', () => {
    const html = renderHtmlReport(reportFixture());

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<style>');
    expect(html).not.toContain('https://cdn');
    expect(html).not.toContain('<script');
    expect(html).toContain('Bug Hunter Replay Report');
    expect(html).toContain('summary-card');
    expect(html).toContain('.summary-card, .issue-card, .panel { background: #fff; border: 1px solid #dbe1ea; border-radius: 8px;');
    expect(html).toContain('table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dbe1ea; border-radius: 8px;');
    expect(html).toContain('issue-card severity-error');
    expect(html).toContain('severity-label">error</span>');
    expect(html).toContain('src="screenshots/step-001-after.png"');
    expect(html).toContain('Action Timeline');
    expect(html).toContain('Network Problems');
    expect(html).toContain('Reproduction');
    expect(html).toContain('href="repro.spec.ts"');
    expect(html).toContain('npx playwright test reports/2026-05-21_000000_example-com/repro.spec.ts');
    expect(html).toContain('<td>https://example.com/api</td>');
    expect(html).toContain('Config');
    expect(html).toContain('<dt>maxActions</dt><dd>5</dd>');
  });

  test('escapes report text before rendering HTML', () => {
    const html = renderHtmlReport({
      ...reportFixture(),
      issues: [
        {
          id: 'issue-1',
          dedupeKey: 'console_error:https://example.com:<script>',
          type: 'console_error',
          severity: 'error',
          title: '<script>alert(1)</script>',
          message: '<img src=x onerror=alert(1)>',
          url: 'https://example.com/?q=<script>',
          actionPath: ['Open <menu>'],
          timestamp: '2026-05-21T00:00:00.000Z'
        }
      ]
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
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
      issuesFound: 1,
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
        dedupeKey: 'http_5xx:https://example.com/api:server error',
        type: 'http_5xx',
        severity: 'error',
        title: 'HTTP 500',
        message: 'server error',
        url: 'https://example.com/api',
        actionPath: ['Open menu'],
        screenshot: 'screenshots/step-001-after.png',
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
