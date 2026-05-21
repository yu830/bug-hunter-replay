export type ActionStepType = 'goto' | 'click' | 'fill' | 'select' | 'press';

export type ActionStepStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export interface ActionStep {
  id: string;
  index: number;
  type: ActionStepType;
  label: string;
  selector: string;
  urlBefore: string;
  depth: number;
  status: ActionStepStatus;
  startedAt?: string;
  endedAt?: string;
  urlAfter?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
  skipReason?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}
