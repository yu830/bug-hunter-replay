import type { ActionStep } from '../types/action.js';

const DANGEROUS_KEYWORDS = [
  'delete',
  'remove',
  'destroy',
  'drop',
  'pay',
  'purchase',
  'checkout',
  'submit order',
  'logout',
  'sign out'
];

export function evaluateActionSafety(action: ActionStep): ActionStep {
  const haystack = `${action.label} ${action.selector}`.toLowerCase();
  const matchedKeyword = DANGEROUS_KEYWORDS.find((keyword) => haystack.includes(keyword));

  if (!matchedKeyword) {
    return action;
  }

  return {
    ...action,
    status: 'skipped',
    skipReason: `Dangerous action keyword: ${matchedKeyword}`
  };
}
