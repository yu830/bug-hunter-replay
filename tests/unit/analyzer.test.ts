import { describe, expect, test } from 'vitest';

import { analyzeIssues } from '../../src/core/analyzer.js';
import type { ActionStep } from '../../src/types/action.js';
import type { NetworkEvent, RawCapturedEvent } from '../../src/types/event.js';

function rawEvent(overrides: Partial<RawCapturedEvent>): RawCapturedEvent {
  return {
    id: 'event-1',
    type: 'console_error',
    message: 'console failed',
    url: 'https://example.com',
    timestamp: '2026-05-21T00:00:00.000Z',
    ...overrides
  };
}

function networkEvent(overrides: Partial<NetworkEvent>): NetworkEvent {
  return {
    id: 'network-1',
    requestUrl: 'https://example.com/api',
    method: 'GET',
    resourceType: 'fetch',
    startedAt: '2026-05-21T00:00:00.000Z',
    ...overrides
  };
}

function action(overrides: Partial<ActionStep>): ActionStep {
  return {
    id: 'action-1',
    index: 0,
    type: 'click',
    label: 'Open menu',
    selector: 'text="Open menu"',
    urlBefore: 'https://example.com',
    depth: 0,
    status: 'failed',
    errorMessage: 'locator timeout',
    screenshotAfter: 'screenshots/step-001-after.png',
    ...overrides
  };
}

describe('analyzeIssues', () => {
  test.each([
    ['TypeError: Cannot read properties of undefined', 'error'],
    ['ReferenceError: missingVariable is not defined', 'error'],
    ['Cannot read property name', 'error'],
    ['fixture console error', 'warning']
  ])('maps console_error severity for %s', (message, severity) => {
    const issues = analyzeIssues({ events: [rawEvent({ type: 'console_error', message })], networkEvents: [], actions: [] });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'console_error',
      severity,
      message,
      url: 'https://example.com'
    });
  });

  test('maps page_error to critical severity', () => {
    const issues = analyzeIssues({
      events: [rawEvent({ type: 'page_error', message: 'Uncaught Error: boom' })],
      networkEvents: [],
      actions: []
    });

    expect(issues[0]).toMatchObject({
      type: 'page_error',
      severity: 'critical',
      title: 'Page error'
    });
  });

  test.each([
    [404, 'image', 'http_4xx', 'warning'],
    [404, 'fetch', 'http_4xx', 'error'],
    [500, 'document', 'http_5xx', 'error']
  ])('maps HTTP status %s %s to %s', (status, resourceType, type, severity) => {
    const issues = analyzeIssues({
      events: [],
      networkEvents: [networkEvent({ status, resourceType, statusText: 'problem' })],
      actions: []
    });

    expect(issues[0]).toMatchObject({
      type,
      severity,
      url: 'https://example.com/api'
    });
  });

  test('maps failed network requests to request_failed issues', () => {
    const issues = analyzeIssues({
      events: [],
      networkEvents: [networkEvent({ failedText: 'net::ERR_FAILED' })],
      actions: []
    });

    expect(issues[0]).toMatchObject({
      type: 'request_failed',
      severity: 'error',
      message: 'net::ERR_FAILED',
      url: 'https://example.com/api'
    });
  });

  test('maps slow requests above threshold to warning severity', () => {
    const issues = analyzeIssues({
      events: [],
      networkEvents: [networkEvent({ durationMs: 3500, resourceType: 'fetch' })],
      actions: [],
      slowThreshold: 3000
    });

    expect(issues[0]).toMatchObject({
      type: 'slow_request',
      severity: 'warning',
      message: 'Slow request: 3500ms',
      url: 'https://example.com/api',
      metadata: {
        durationMs: 3500,
        thresholdMs: 3000,
        method: 'GET',
        resourceType: 'fetch'
      }
    });
  });

  test('maps slow requests at 8000ms or above to error severity', () => {
    const issues = analyzeIssues({
      events: [],
      networkEvents: [networkEvent({ durationMs: 8000, resourceType: 'fetch' })],
      actions: [],
      slowThreshold: 3000
    });

    expect(issues[0]).toMatchObject({
      type: 'slow_request',
      severity: 'error',
      message: 'Slow request: 8000ms'
    });
  });

  test('maps failed actions to action_failed issues with screenshot and action path', () => {
    const issues = analyzeIssues({ events: [], networkEvents: [], actions: [action({})] });

    expect(issues[0]).toMatchObject({
      type: 'action_failed',
      severity: 'warning',
      message: 'locator timeout',
      url: 'https://example.com',
      stepId: 'action-1',
      actionPath: ['Open menu'],
      screenshot: 'screenshots/step-001-after.png'
    });
  });

  test('maps blank page results to blank_page issues', () => {
    const issues = analyzeIssues({
      events: [],
      networkEvents: [],
      actions: [],
      blankPageResults: [
        {
          isBlank: true,
          url: 'https://example.com/blank',
          textLength: 0,
          visibleElementCount: 0,
          timestamp: '2026-05-21T00:00:00.000Z',
          screenshot: 'screenshots/step-004-after.png',
          stepId: 'action-4',
          actionPath: ['Blank page']
        }
      ]
    });

    expect(issues[0]).toMatchObject({
      type: 'blank_page',
      severity: 'error',
      message: 'Blank page detected',
      url: 'https://example.com/blank',
      stepId: 'action-4',
      actionPath: ['Blank page'],
      screenshot: 'screenshots/step-004-after.png',
      metadata: {
        textLength: 0,
        visibleElementCount: 0
      }
    });
  });

  test('dedupes issues by type, url, and normalized message', () => {
    const issues = analyzeIssues({
      events: [
        rawEvent({ id: 'event-1', type: 'console_error', message: 'TypeError:   Cannot read value' }),
        rawEvent({ id: 'event-2', type: 'console_error', message: ' typeerror: cannot read value ' })
      ],
      networkEvents: [],
      actions: []
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.dedupeKey).toBe('console_error:https://example.com:typeerror: cannot read value');
  });
});
