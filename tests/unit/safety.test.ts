import { describe, expect, test } from 'vitest';

import { evaluateActionSafety } from '../../src/core/safety.js';
import type { ActionStep } from '../../src/types/action.js';

function action(label: string): ActionStep {
  return {
    id: 'action-1',
    index: 0,
    type: 'click',
    label,
    selector: `text=${label}`,
    urlBefore: 'https://example.com',
    depth: 0,
    status: 'pending'
  };
}

describe('evaluateActionSafety', () => {
  test.each([
    'Delete account',
    'Remove item',
    'Destroy database',
    'Drop table',
    'Pay now',
    'Purchase plan',
    'Checkout',
    'Submit order',
    'Logout',
    'Sign out'
  ])('skips dangerous action label %s', (label) => {
    const result = evaluateActionSafety(action(label));

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toContain('Dangerous action keyword');
  });

  test('leaves safe action pending', () => {
    const result = evaluateActionSafety(action('View details'));

    expect(result.status).toBe('pending');
    expect(result).not.toHaveProperty('skipReason');
  });
});
