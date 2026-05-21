import type { ActionStep } from '../types/action.js';
import type { BlankPageResult } from './blank-page.js';
import type { NetworkEvent, RawCapturedEvent } from '../types/event.js';
import type { CapturedIssue, CapturedIssueSeverity, CapturedIssueType } from '../types/report.js';

interface AnalyzeIssuesInput {
  events: RawCapturedEvent[];
  networkEvents: NetworkEvent[];
  actions: ActionStep[];
  slowThreshold?: number;
  blankPageResults?: BlankPageResult[];
}

interface IssueDraft {
  type: CapturedIssueType;
  severity: CapturedIssueSeverity;
  title: string;
  message: string;
  url: string;
  stepId?: string;
  actionPath: string[];
  screenshot?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function analyzeIssues(input: AnalyzeIssuesInput): CapturedIssue[] {
  const slowThreshold = input.slowThreshold ?? 3000;
  const drafts = [
    ...input.events.flatMap(issueDraftsForEvent),
    ...input.networkEvents.flatMap((event) => issueDraftsForNetworkEvent(event, slowThreshold)),
    ...input.actions.flatMap(issueDraftsForAction),
    ...(input.blankPageResults ?? []).flatMap(issueDraftsForBlankPage)
  ];
  const issues: CapturedIssue[] = [];
  const seen = new Set<string>();

  for (const draft of drafts) {
    const dedupeKey = `${draft.type}:${draft.url}:${normalizeMessage(draft.message)}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    issues.push({
      id: `issue-${issues.length + 1}`,
      dedupeKey,
      ...draft
    });
  }

  return issues;
}

function issueDraftsForEvent(event: RawCapturedEvent): IssueDraft[] {
  if (event.type === 'console_error') {
    return [
      {
        type: 'console_error',
        severity: consoleErrorSeverity(event.message),
        title: 'Console error',
        message: event.message,
        url: event.url,
        actionPath: [],
        timestamp: event.timestamp,
        metadata: event.metadata
      }
    ];
  }

  if (event.type === 'page_error') {
    return [
      {
        type: 'page_error',
        severity: 'critical',
        title: 'Page error',
        message: event.message,
        url: event.url,
        actionPath: [],
        timestamp: event.timestamp,
        metadata: event.metadata
      }
    ];
  }

  return [];
}

function issueDraftsForNetworkEvent(event: NetworkEvent, slowThreshold: number): IssueDraft[] {
  const drafts: IssueDraft[] = [];

  if (event.failedText) {
    drafts.push({
      type: 'request_failed',
      severity: 'error',
      title: 'Request failed',
      message: event.failedText,
      url: event.requestUrl,
      actionPath: [],
      timestamp: event.endedAt ?? event.startedAt,
      metadata: networkMetadata(event)
    });
  }

  if (event.status && event.status >= 400 && event.status < 500) {
    drafts.push({
      type: 'http_4xx',
      severity: http4xxSeverity(event.resourceType),
      title: `HTTP ${event.status}`,
      message: event.statusText || `HTTP ${event.status}`,
      url: event.requestUrl,
      actionPath: [],
      timestamp: event.endedAt ?? event.startedAt,
      metadata: networkMetadata(event)
    });
  }

  if (event.status && event.status >= 500) {
    drafts.push({
      type: 'http_5xx',
      severity: 'error',
      title: `HTTP ${event.status}`,
      message: event.statusText || `HTTP ${event.status}`,
      url: event.requestUrl,
      actionPath: [],
      timestamp: event.endedAt ?? event.startedAt,
      metadata: networkMetadata(event)
    });
  }

  if (event.durationMs !== undefined && event.durationMs > slowThreshold) {
    drafts.push({
      type: 'slow_request',
      severity: event.durationMs >= 8000 ? 'error' : 'warning',
      title: 'Slow request',
      message: `Slow request: ${event.durationMs}ms`,
      url: event.requestUrl,
      actionPath: [],
      timestamp: event.endedAt ?? event.startedAt,
      metadata: {
        durationMs: event.durationMs,
        thresholdMs: slowThreshold,
        method: event.method,
        resourceType: event.resourceType
      }
    });
  }

  return drafts;
}

function issueDraftsForAction(action: ActionStep): IssueDraft[] {
  if (action.status !== 'failed') {
    return [];
  }

  return [
    {
      type: 'action_failed',
      severity: 'warning',
      title: 'Action failed',
      message: action.errorMessage ?? 'Action failed',
      url: action.urlBefore,
      stepId: action.id,
      actionPath: [action.label],
      screenshot: action.screenshotAfter,
      timestamp: action.endedAt ?? action.startedAt ?? new Date(0).toISOString(),
      metadata: action.metadata
    }
  ];
}

function issueDraftsForBlankPage(result: BlankPageResult): IssueDraft[] {
  if (!result.isBlank) {
    return [];
  }

  return [
    {
      type: 'blank_page',
      severity: 'error',
      title: 'Blank page',
      message: 'Blank page detected',
      url: result.url,
      stepId: result.stepId,
      actionPath: result.actionPath,
      screenshot: result.screenshot,
      timestamp: result.timestamp,
      metadata: {
        textLength: result.textLength,
        visibleElementCount: result.visibleElementCount
      }
    }
  ];
}

function consoleErrorSeverity(message: string): CapturedIssueSeverity {
  const normalized = normalizeMessage(message);

  if (normalized.includes('typeerror') || normalized.includes('referenceerror') || normalized.includes('cannot read')) {
    return 'error';
  }

  return 'warning';
}

function http4xxSeverity(resourceType: string): CapturedIssueSeverity {
  return resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch' ? 'error' : 'warning';
}

function networkMetadata(event: NetworkEvent): Record<string, unknown> {
  return {
    method: event.method,
    resourceType: event.resourceType,
    status: event.status,
    statusText: event.statusText,
    durationMs: event.durationMs
  };
}

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().toLowerCase();
}
