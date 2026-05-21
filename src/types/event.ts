export type RawCapturedEventType =
  | 'console_error'
  | 'page_error'
  | 'request_failed'
  | 'http_error'
  | 'navigation_error';

export interface RawCapturedEvent {
  id: string;
  type: RawCapturedEventType;
  message: string;
  url: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NetworkEvent {
  id: string;
  requestUrl: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  failedText?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  stepId?: string;
  actionPath?: string[];
}
