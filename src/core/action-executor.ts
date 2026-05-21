import type { Page } from 'playwright';

import { detectBlankPage, type BlankPageResult } from './blank-page.js';
import { resolveLocator } from './locator.js';
import { captureActionScreenshot } from './screenshot.js';
import type { ActionStep } from '../types/action.js';

export interface ExecutePendingActionsOptions {
  runPath: string;
  maxActions: number;
  timeout: number;
  startUrl: string;
}

export interface ExecutePendingActionsResult {
  actions: ActionStep[];
  actionsExecuted: number;
  screenshots: string[];
  blankPageResults: BlankPageResult[];
}

const FILL_VALUE = 'bug-hunter-test';

export async function executePendingActions(
  page: Page,
  actions: ActionStep[],
  options: ExecutePendingActionsOptions
): Promise<ExecutePendingActionsResult> {
  const screenshots: string[] = [];
  const blankPageResults: BlankPageResult[] = [];
  let actionsExecuted = 0;
  const updatedActions: ActionStep[] = [];

  for (const action of actions) {
    if (action.status !== 'pending') {
      updatedActions.push(action);
      continue;
    }

    if (isFormSubmit(action)) {
      updatedActions.push({ ...action, status: 'skipped', skipReason: 'Form submit skipped by default' });
      continue;
    }

    if (isCrossOriginGoto(action, options.startUrl)) {
      updatedActions.push({ ...action, status: 'skipped', skipReason: 'Cross-origin link skipped' });
      continue;
    }

    if (actionsExecuted >= options.maxActions) {
      updatedActions.push(action);
      continue;
    }

    const stepNumber = actionsExecuted + 1;
    const executedAction = await executeAction(page, action, stepNumber, options);
    screenshots.push(...[executedAction.screenshotBefore, executedAction.screenshotAfter].filter(isString));
    blankPageResults.push(
      await detectBlankPage(page, {
        screenshot: executedAction.screenshotAfter,
        stepId: executedAction.id,
        actionPath: [executedAction.label]
      })
    );
    updatedActions.push(executedAction);
    actionsExecuted += 1;
  }

  return { actions: updatedActions, actionsExecuted, screenshots, blankPageResults };
}

async function executeAction(
  page: Page,
  action: ActionStep,
  stepNumber: number,
  options: ExecutePendingActionsOptions
): Promise<ActionStep> {
  await resetToStartUrl(page, options.startUrl, options.timeout);
  const urlBefore = page.url();
  const startedAt = new Date();
  const screenshotBefore = await captureActionScreenshot(page, options.runPath, stepNumber, 'before');
  let status: ActionStep['status'] = 'passed';
  let errorMessage: string | undefined;

  try {
    await performAction(page, action, options.timeout);
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  await page.waitForLoadState('load', { timeout: options.timeout }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: options.timeout }).catch(() => undefined);
  await page.waitForTimeout(100);
  const screenshotAfter = await captureActionScreenshot(page, options.runPath, stepNumber, 'after');

  return {
    ...action,
    urlBefore,
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    urlAfter: page.url(),
    screenshotBefore,
    screenshotAfter,
    status,
    errorMessage
  };
}

async function resetToStartUrl(page: Page, startUrl: string, timeout: number): Promise<void> {
  if (page.url() === startUrl) {
    return;
  }

  await page.goto(startUrl, { waitUntil: 'load', timeout });
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
  await page.waitForTimeout(100);
}

async function performAction(page: Page, action: ActionStep, timeout: number): Promise<void> {
  const locator = resolveLocator(page, action.selector);

  if (action.type === 'goto' || action.type === 'click') {
    await locator.click({ timeout });
    return;
  }

  if (action.type === 'fill') {
    await locator.fill(FILL_VALUE, { timeout });
    return;
  }

  if (action.type === 'select') {
    const optionValue = await locator.locator('option').evaluateAll((options) => {
      const option = options.find((element) => (element as HTMLOptionElement).value !== '');
      return option ? (option as HTMLOptionElement).value : undefined;
    });

    if (optionValue) {
      await locator.selectOption(optionValue, { timeout });
    }

    return;
  }

  throw new Error(`Unsupported action type: ${action.type}`);
}

function isFormSubmit(action: ActionStep): boolean {
  return action.metadata?.tagName === 'input' && action.metadata.inputType === 'submit';
}

function isCrossOriginGoto(action: ActionStep, startUrl: string): boolean {
  if (action.type !== 'goto' || typeof action.metadata?.href !== 'string') {
    return false;
  }

  return new URL(action.metadata.href, startUrl).origin !== new URL(startUrl).origin;
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}
