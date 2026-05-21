import { describe, expect, test } from 'vitest';

import { actionTypeForElement, buildElementAction, selectorForElement } from '../../src/core/action-discovery.js';
import type { DiscoverableElement } from '../../src/core/action-discovery.js';

function element(options: {
  tagName: string;
  textContent?: string;
  attributes?: Record<string, string | null>;
  isVisible?: boolean;
}): DiscoverableElement {
  return {
    tagName: options.tagName.toUpperCase(),
    textContent: options.textContent ?? '',
    isVisible: options.isVisible ?? true,
    getAttribute(name: string): string | null {
      return options.attributes?.[name] ?? null;
    }
  };
}

describe('action discovery helpers', () => {
  test('generates selectors by priority', () => {
    expect(
      selectorForElement(element({ tagName: 'button', textContent: 'Save', attributes: { 'data-testid': 'save-button' } }))
    ).toBe('[data-testid="save-button"]');
    expect(
      selectorForElement(element({ tagName: 'button', textContent: '☰', attributes: { 'aria-label': 'Open menu' } }))
    ).toBe('[aria-label="Open menu"]');
    expect(
      selectorForElement(element({ tagName: 'button', textContent: 'Continue', attributes: { role: 'button' } }))
    ).toBe('role=button[name="Continue"]');
    expect(selectorForElement(element({ tagName: 'button', textContent: 'Plain text' }))).toBe(
      'text="Plain text"'
    );
  });

  test('infers action types for interactive elements', () => {
    expect(actionTypeForElement(element({ tagName: 'a', textContent: 'Docs', attributes: { href: '/docs' } }))).toBe(
      'goto'
    );
    expect(actionTypeForElement(element({ tagName: 'button', textContent: 'Open' }))).toBe('click');
    expect(actionTypeForElement(element({ tagName: 'input', attributes: { type: 'text', 'aria-label': 'Email' } }))).toBe(
      'fill'
    );
    expect(actionTypeForElement(element({ tagName: 'select', attributes: { 'aria-label': 'Plan' } }))).toBe('select');
    expect(actionTypeForElement(element({ tagName: 'textarea', attributes: { 'aria-label': 'Message' } }))).toBe('fill');
  });

  test('builds a pending action with label and selector metadata', () => {
    expect(
      buildElementAction(
        element({ tagName: 'button', textContent: 'Save changes', attributes: { 'data-testid': 'save-button' } }),
        2,
        'https://example.com/settings'
      )
    ).toMatchObject({
      id: 'action-3',
      index: 2,
      type: 'click',
      label: 'Save changes',
      selector: '[data-testid="save-button"]',
      urlBefore: 'https://example.com/settings',
      depth: 0,
      status: 'pending'
    });
  });

  test('skips hidden actions before execution', () => {
    expect(
      buildElementAction(element({ tagName: 'button', textContent: 'Hidden Button', isVisible: false }), 0, 'https://example.com')
    ).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is not visible'
    });
  });

  test.each([
    element({ tagName: 'button', textContent: 'Disabled Button', attributes: { disabled: '' } }),
    element({ tagName: 'input', attributes: { type: 'text', 'aria-label': 'Disabled Input', disabled: '' } }),
    element({ tagName: 'div', textContent: 'Role Button', attributes: { role: 'button', 'aria-disabled': 'true' } })
  ])('skips disabled action %# before execution', (disabledElement) => {
    expect(buildElementAction(disabledElement, 0, 'https://example.com')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is disabled'
    });
  });

  test('leaves same-origin links pending when sameOriginOnly is enabled', () => {
    expect(
      buildElementAction(element({ tagName: 'a', textContent: 'Docs', attributes: { href: '/docs' } }), 0, 'https://example.com', {
        sameOriginOnly: true,
        startUrl: 'https://example.com'
      })
    ).toMatchObject({
      status: 'pending'
    });
  });

  test('skips cross-origin links when sameOriginOnly is enabled', () => {
    expect(
      buildElementAction(
        element({ tagName: 'a', textContent: 'External Docs', attributes: { href: 'https://example.org/docs' } }),
        0,
        'https://example.com',
        {
          sameOriginOnly: true,
          startUrl: 'https://example.com'
        }
      )
    ).toMatchObject({
      status: 'skipped',
      skipReason: 'Cross-origin link skipped'
    });
  });

  test('leaves cross-origin links pending when sameOriginOnly is disabled', () => {
    expect(
      buildElementAction(
        element({ tagName: 'a', textContent: 'External Docs', attributes: { href: 'https://example.org/docs' } }),
        0,
        'https://example.com',
        {
          sameOriginOnly: false,
          startUrl: 'https://example.com'
        }
      )
    ).toMatchObject({
      status: 'pending'
    });
  });
});
