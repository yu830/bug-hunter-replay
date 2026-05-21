import type { Page } from 'playwright';

import { discoverActions } from './action-discovery.js';
import { detectBlankPage, type BlankPageResult } from './blank-page.js';
import type { RecorderActionContext } from './recorder.js';
import { resolveLocator } from './locator.js';
import { evaluateActionSafety } from './safety.js';
import { captureActionScreenshot } from './screenshot.js';
import type { ActionStep } from '../types/action.js';

const FILL_VALUE = 'bug-hunter-test';

export interface ExplorePageOptions {
  runPath: string;
  startUrl: string;
  maxDepth: number;
  maxActions: number;
  timeout: number;
  sameOriginOnly: boolean;
  recorder?: {
    setActionContext(context: RecorderActionContext | undefined): void;
  };
}

export interface ExplorePageResult {
  actions: ActionStep[];
  actionsExecuted: number;
  screenshots: string[];
  blankPageResults: BlankPageResult[];
}

interface ExplorationState {
  depth: number;
  actionPath: string[];
  replayActions: ActionStep[];
}

export async function explorePage(page: Page, options: ExplorePageOptions): Promise<ExplorePageResult> {
  const actions: ActionStep[] = [];
  const screenshots: string[] = [];
  const blankPageResults: BlankPageResult[] = [];
  const queue: ExplorationState[] = [{ depth: 0, actionPath: [], replayActions: [] }];
  let actionsExecuted = 0;
  let nextActionIndex = 0;
  let stopForMaxActions = false;

  while (queue.length > 0 && !stopForMaxActions) {
    const state = queue.shift();
    if (!state || state.depth >= options.maxDepth) {
      continue;
    }

    await replayState(page, options.startUrl, state.replayActions, options.timeout);
    const discoveredActions = await discoverActions(page, {
      sameOriginOnly: options.sameOriginOnly,
      startUrl: options.startUrl
    });

    for (const discoveredAction of discoveredActions) {
      const action = prepareDiscoveredAction(discoveredAction, {
        index: nextActionIndex,
        depth: state.depth + 1,
        parentId: state.replayActions.at(-1)?.id,
        actionPath: [...state.actionPath, discoveredAction.label],
        urlBefore: page.url()
      });
      nextActionIndex += 1;

      if (action.status !== 'pending') {
        actions.push(action);
        continue;
      }

      if (actionsExecuted >= options.maxActions) {
        actions.push(skipAction(action, 'Max actions limit reached'));
        stopForMaxActions = true;
        continue;
      }

      const executedAction = await executeExplorationAction(page, action, {
        ...options,
        replayActions: state.replayActions,
        stepNumber: actionsExecuted + 1
      });
      actions.push(executedAction);
      screenshots.push(...[executedAction.screenshotBefore, executedAction.screenshotAfter].filter(isString));
      actionsExecuted += 1;

      const blankPageResult = await detectBlankPage(page, {
        screenshot: executedAction.screenshotAfter,
        stepId: executedAction.id,
        actionPath: executedAction.actionPath
      });
      blankPageResults.push(blankPageResult);

      if (
        executedAction.status === 'passed' &&
        !blankPageResult.isBlank &&
        executedAction.depth < options.maxDepth &&
        isSameOriginUrl(executedAction.urlAfter, options.startUrl)
      ) {
        queue.push({
          depth: executedAction.depth,
          actionPath: executedAction.actionPath ?? [executedAction.label],
          replayActions: [...state.replayActions, executedAction]
        });
      }
    }
  }

  return { actions, actionsExecuted, screenshots, blankPageResults };
}

function prepareDiscoveredAction(
  action: ActionStep,
  context: Pick<ActionStep, 'index' | 'depth' | 'parentId' | 'actionPath' | 'urlBefore'>
): ActionStep {
  const candidateAction = evaluateActionSafety({
    ...action,
    id: `action-${context.index + 1}`,
    index: context.index,
    depth: context.depth,
    parentId: context.parentId,
    actionPath: context.actionPath,
    urlBefore: context.urlBefore,
    urlAfter: action.status === 'skipped' ? context.urlBefore : action.urlAfter
  });
  const updatedAction =
    candidateAction.status === 'pending' && isCrossOriginGoto(candidateAction, context.urlBefore)
      ? skipAction(candidateAction, 'Cross-origin link skipped')
      : candidateAction;

  return updatedAction.status === 'skipped' ? { ...updatedAction, urlAfter: updatedAction.urlAfter ?? context.urlBefore } : updatedAction;
}

async function executeExplorationAction(
  page: Page,
  action: ActionStep,
  options: ExplorePageOptions & { replayActions: ActionStep[]; stepNumber: number }
): Promise<ActionStep> {
  await replayState(page, options.startUrl, options.replayActions, options.timeout);
  const urlBefore = page.url();
  const startedAt = new Date();
  const screenshotBefore = await captureActionScreenshot(page, options.runPath, options.stepNumber, 'before');
  let status: ActionStep['status'] = 'passed';
  let errorMessage: string | undefined;

  options.recorder?.setActionContext({
    stepId: action.id,
    actionPath: action.actionPath ?? [action.label]
  });

  try {
    await performAction(page, action, options.timeout);
    await settlePage(page, options.timeout);
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    await page.waitForTimeout(50);
    options.recorder?.setActionContext(undefined);
  }

  await settlePage(page, options.timeout);
  const screenshotAfter = await captureActionScreenshot(page, options.runPath, options.stepNumber, 'after');

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

async function replayState(page: Page, startUrl: string, replayActions: ActionStep[], timeout: number): Promise<void> {
  await page.goto(startUrl, { waitUntil: 'load', timeout });
  await settlePage(page, timeout);

  for (const action of replayActions) {
    await performAction(page, action, timeout);
    await settlePage(page, timeout);
  }
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

async function settlePage(page: Page, timeout: number): Promise<void> {
  const settleTimeout = Math.min(timeout, 1000);

  await page.waitForLoadState('load', { timeout: settleTimeout }).catch(() => undefined);
  await page.waitForTimeout(200);
}

function skipAction(action: ActionStep, skipReason: string): ActionStep {
  return {
    ...action,
    status: 'skipped',
    skipReason,
    urlAfter: action.urlBefore
  };
}

function isSameOriginUrl(url: string | undefined, startUrl: string): boolean {
  if (!url) {
    return false;
  }

  return new URL(url, startUrl).origin === new URL(startUrl).origin;
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
