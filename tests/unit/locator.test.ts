import { describe, expect, test } from 'vitest';
import type { Page } from 'playwright';

import { resolveLocator } from '../../src/core/locator.js';

type LocatorCall = {
  kind: string;
  value: string;
  options?: Record<string, string>;
};

function fakePage(): Page {
  const page = {
    getByTestId(value: string): LocatorCall {
      return { kind: 'testId', value };
    },
    getByLabel(value: string): LocatorCall {
      return { kind: 'label', value };
    },
    getByRole(value: string, options: Record<string, string>): LocatorCall {
      return { kind: 'role', value, options };
    },
    getByText(value: string): LocatorCall {
      return { kind: 'text', value };
    },
    locator(value: string): LocatorCall {
      return { kind: 'css', value };
    }
  };

  return page as unknown as Page;
}

describe('resolveLocator', () => {
  test.each([
    ['[data-testid="save-button"]', { kind: 'testId', value: 'save-button' }],
    ['[aria-label="Open menu"]', { kind: 'label', value: 'Open menu' }],
    ['role=button[name="Continue"]', { kind: 'role', value: 'button', options: { name: 'Continue' } }],
    ['text="Plain text"', { kind: 'text', value: 'Plain text' }],
    ['#fallback-id', { kind: 'css', value: '#fallback-id' }],
    ['input[name="email"]', { kind: 'css', value: 'input[name="email"]' }]
  ])('resolves %s', (selector, expected) => {
    expect(resolveLocator(fakePage(), selector)).toEqual(expected);
  });
});
