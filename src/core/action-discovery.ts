import type { Page } from 'playwright';

import { evaluateActionSafety } from './safety.js';
import type { ActionStep, ActionStepType } from '../types/action.js';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input:not([type="hidden"])',
  'select',
  'textarea'
].join(', ');

export interface DiscoverableElement {
  tagName: string;
  textContent: string | null;
  isVisible: boolean;
  isDisabled?: boolean;
  getAttribute(name: string): string | null;
}

interface SerializableElement {
  tagName: string;
  textContent: string | null;
  isVisible: boolean;
  isDisabled: boolean;
  attributes: Record<string, string | null>;
}

export interface ActionDiscoveryContext {
  sameOriginOnly: boolean;
  startUrl: string;
}

export async function discoverActions(page: Page, context?: ActionDiscoveryContext): Promise<ActionStep[]> {
  const urlBefore = page.url();
  const safetyContext = context ?? { sameOriginOnly: true, startUrl: urlBefore };
  const elements = await page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector)).map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible =
        !element.hasAttribute('hidden') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.visibility !== 'collapse' &&
        rect.width > 0 &&
        rect.height > 0;
      const isDisabled = 'disabled' in element && Boolean((element as HTMLButtonElement).disabled);

      return {
        tagName: element.tagName,
        textContent: element.textContent,
        isVisible,
        isDisabled,
        attributes: {
          'data-testid': element.getAttribute('data-testid'),
          'aria-label': element.getAttribute('aria-label'),
          'aria-disabled': element.getAttribute('aria-disabled'),
          disabled: element.getAttribute('disabled'),
          role: element.getAttribute('role'),
          href: element.getAttribute('href'),
          type: element.getAttribute('type'),
          value: element.getAttribute('value'),
          placeholder: element.getAttribute('placeholder'),
          name: element.getAttribute('name'),
          id: element.getAttribute('id')
        }
      };
    });
  }, INTERACTIVE_SELECTOR);

  return elements.map((element, index) =>
    evaluateActionSafety(buildElementAction(fromSerializable(element), index, urlBefore, safetyContext))
  );
}

export function buildElementAction(
  element: DiscoverableElement,
  index: number,
  urlBefore: string,
  context?: ActionDiscoveryContext
): ActionStep {
  const action: ActionStep = {
    id: `action-${index + 1}`,
    index,
    type: actionTypeForElement(element),
    label: labelForElement(element),
    selector: selectorForElement(element),
    urlBefore,
    depth: 0,
    status: 'pending',
    metadata: {
      tagName: element.tagName.toLowerCase(),
      inputType: element.getAttribute('type')?.toLowerCase(),
      href: element.getAttribute('href') ?? undefined
    }
  };

  return applyPreExecutionSafetyGates(action, element, context);
}

export function actionTypeForElement(element: DiscoverableElement): ActionStepType {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type')?.toLowerCase();

  if (tagName === 'a') {
    return 'goto';
  }

  if (tagName === 'select') {
    return 'select';
  }

  if (tagName === 'input' && type !== 'button' && type !== 'submit') {
    return 'fill';
  }

  if (tagName === 'textarea') {
    return 'fill';
  }

  return 'click';
}

export function selectorForElement(element: DiscoverableElement): string {
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${escapeSelectorValue(testId)}"]`;
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `[aria-label="${escapeSelectorValue(ariaLabel)}"]`;
  }

  const role = element.getAttribute('role');
  const label = labelForElement(element);
  if (role && label) {
    return `role=${role}[name="${escapeSelectorValue(label)}"]`;
  }

  if (label) {
    return `text="${escapeSelectorValue(label)}"`;
  }

  const id = element.getAttribute('id');
  if (id) {
    return `#${cssIdentifier(id)}`;
  }

  const name = element.getAttribute('name');
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${escapeSelectorValue(name)}"]`;
  }

  return element.tagName.toLowerCase();
}

export function labelForElement(element: DiscoverableElement): string {
  return (
    element.getAttribute('aria-label') ??
    trimmed(element.textContent) ??
    element.getAttribute('value') ??
    element.getAttribute('placeholder') ??
    element.getAttribute('href') ??
    element.getAttribute('name') ??
    element.tagName.toLowerCase()
  );
}

function fromSerializable(element: SerializableElement): DiscoverableElement {
  return {
    tagName: element.tagName,
    textContent: element.textContent,
    isVisible: element.isVisible,
    isDisabled: element.isDisabled,
    getAttribute(name: string): string | null {
      return element.attributes[name] ?? null;
    }
  };
}

function applyPreExecutionSafetyGates(
  action: ActionStep,
  element: DiscoverableElement,
  context?: ActionDiscoveryContext
): ActionStep {
  if (!element.isVisible) {
    return skipped(action, 'Element is not visible');
  }

  if (elementIsDisabled(element)) {
    return skipped(action, 'Element is disabled');
  }

  if (isCrossOriginLink(element, context)) {
    return skipped(action, 'Cross-origin link skipped');
  }

  return action;
}

function elementIsDisabled(element: DiscoverableElement): boolean {
  return Boolean(element.isDisabled) || element.getAttribute('disabled') !== null || element.getAttribute('aria-disabled') === 'true';
}

function isCrossOriginLink(element: DiscoverableElement, context?: ActionDiscoveryContext): boolean {
  const href = element.getAttribute('href');

  if (!context?.sameOriginOnly || element.tagName.toLowerCase() !== 'a' || !href) {
    return false;
  }

  return new URL(href, context.startUrl).origin !== new URL(context.startUrl).origin;
}

function skipped(action: ActionStep, skipReason: string): ActionStep {
  return {
    ...action,
    status: 'skipped',
    skipReason
  };
}

function trimmed(value: string | null): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : undefined;
}

function escapeSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function cssIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
