import type { ActionStep } from './action.js';
import type { BugHunterRunConfig } from './config.js';
import type { NetworkEvent, RawCapturedEvent } from './event.js';

export type CapturedIssueType =
  | 'console_error'
  | 'page_error'
  | 'request_failed'
  | 'http_4xx'
  | 'http_5xx'
  | 'action_failed'
  | 'slow_request'
  | 'blank_page';

export type CapturedIssueSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface CapturedIssue {
  id: string;
  dedupeKey: string;
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

export interface BugHunterReportSummary {
  actionsDiscovered: number;
  actionsExecuted: number;
  issuesFound: number;
  networkEventsCaptured: number;
}

export interface BugHunterReportArtifacts {
  reportJsonPath: string;
  reportMarkdownPath: string;
  reportHtmlPath: string;
  reproSpecPath: string;
  tracePath?: string;
  screenshots: string[];
}

export interface BugHunterReport {
  runId: string;
  startUrl: string;
  startedAt: string;
  endedAt: string;
  config: BugHunterRunConfig;
  summary: BugHunterReportSummary;
  actions: ActionStep[];
  issues: CapturedIssue[];
  events: RawCapturedEvent[];
  networkEvents: NetworkEvent[];
  artifacts: BugHunterReportArtifacts;
}
