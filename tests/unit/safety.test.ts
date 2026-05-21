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
    status: 'pending',
    metadata: {}
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
    'Sign out',
    '删除账号',
    '退出登录',
    '支付订单'
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

  test('checks href, form action, aria-label, name, and id for risky text', () => {
    const result = evaluateActionSafety({
      ...action('Continue'),
      metadata: {
        href: '/account/delete',
        formAction: '/billing/checkout',
        ariaLabel: 'Continue',
        name: 'submit-order',
        id: 'pay-now'
      }
    });

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toContain('Dangerous action keyword');
  });

  test.each([
    { tagName: 'input', inputType: 'submit' },
    { tagName: 'button', inputType: 'submit' },
    { tagName: 'button', inputType: '', insideForm: true }
  ])('skips submit action metadata %#', (metadata) => {
    const result = evaluateActionSafety({
      ...action('Save'),
      metadata
    });

    expect(result).toMatchObject({
      status: 'skipped',
      skipReason: 'Form submit skipped by default'
    });
  });

  test.each(['password', 'file'])('skips unsafe %s inputs', (inputType) => {
    const result = evaluateActionSafety({
      ...action('Secret'),
      type: 'fill',
      metadata: {
        tagName: 'input',
        inputType
      }
    });

    expect(result).toMatchObject({
      status: 'skipped',
      skipReason: `Unsafe input type skipped: ${inputType}`
    });
  });
});
