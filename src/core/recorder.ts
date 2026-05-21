import { performance } from 'node:perf_hooks';

import type { ConsoleMessage, Page, Request } from 'playwright';

import type { NetworkEvent, RawCapturedEvent, RawCapturedEventType } from '../types/event.js';

interface TrackedRequest {
  event: NetworkEvent;
  startedAtMs: number;
}

export interface RecorderActionContext {
  stepId: string;
  actionPath: string[];
}

export interface BrowserRecorder {
  events: RawCapturedEvent[];
  networkEvents: NetworkEvent[];
  setActionContext(context: RecorderActionContext | undefined): void;
}

export function attachBrowserRecorder(page: Page): BrowserRecorder {
  const events: RawCapturedEvent[] = [];
  const networkEvents: NetworkEvent[] = [];
  const requests = new Map<Request, TrackedRequest>();
  let eventCounter = 0;
  let networkCounter = 0;
  let actionContext: RecorderActionContext | undefined;

  function nextEventId(): string {
    eventCounter += 1;
    return `event-${eventCounter}`;
  }

  function nextNetworkId(): string {
    networkCounter += 1;
    return `network-${networkCounter}`;
  }

  function pushEvent(type: RawCapturedEventType, message: string, url: string, metadata?: Record<string, unknown>): void {
    events.push({
      id: nextEventId(),
      type,
      message,
      url,
      timestamp: new Date().toISOString(),
      ...mergedMetadata(metadata)
    });
  }

  function mergedMetadata(metadata?: Record<string, unknown>): { metadata?: Record<string, unknown> } {
    const contextMetadata = actionContext
      ? {
          stepId: actionContext.stepId,
          actionPath: actionContext.actionPath
        }
      : {};
    const merged = { ...metadata, ...contextMetadata };

    return Object.keys(merged).length > 0 ? { metadata: merged } : {};
  }

  function networkActionContext(): Pick<NetworkEvent, 'stepId' | 'actionPath'> {
    return actionContext
      ? {
          stepId: actionContext.stepId,
          actionPath: actionContext.actionPath
        }
      : {};
  }

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') {
      return;
    }

    pushEvent('console_error', message.text(), page.url());
  });

  page.on('pageerror', (error) => {
    pushEvent('page_error', error.message, page.url());
  });

  page.on('request', (request) => {
    requests.set(request, {
      event: {
        id: nextNetworkId(),
        requestUrl: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        startedAt: new Date().toISOString(),
        ...networkActionContext()
      },
      startedAtMs: performance.now()
    });
  });

  page.on('response', (response) => {
    const request = response.request();
    const tracked = requests.get(request);
    if (!tracked) {
      return;
    }

    const endedAtMs = performance.now();
    tracked.event.status = response.status();
    tracked.event.statusText = response.statusText();
    tracked.event.endedAt = new Date().toISOString();
    tracked.event.durationMs = Math.round(endedAtMs - tracked.startedAtMs);
    networkEvents.push(tracked.event);
    requests.delete(request);

    if (response.status() >= 400) {
      pushEvent('http_error', `${response.status()} ${response.statusText()}`, response.url(), {
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });

  page.on('requestfailed', (request) => {
    const tracked = requests.get(request);
    const endedAtMs = performance.now();
    const event = tracked?.event ?? {
      id: nextNetworkId(),
      requestUrl: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startedAt: new Date().toISOString(),
      ...networkActionContext()
    };
    const failedText = request.failure()?.errorText ?? 'Request failed';

    event.failedText = failedText;
    event.endedAt = new Date().toISOString();
    event.durationMs = tracked ? Math.round(endedAtMs - tracked.startedAtMs) : 0;
    networkEvents.push(event);
    requests.delete(request);
    pushEvent('request_failed', failedText, request.url());
  });

  return {
    events,
    networkEvents,
    setActionContext(context: RecorderActionContext | undefined): void {
      actionContext = context;
    }
  };
}

export function createNavigationErrorEvent(message: string, url: string): RawCapturedEvent {
  return {
    id: 'event-navigation-error',
    type: 'navigation_error',
    message,
    url,
    timestamp: new Date().toISOString()
  };
}
