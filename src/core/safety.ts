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
  'transfer',
  'refund',
  'cancel subscription',
  'reset account',
  'clear data',
  'logout',
  'sign out',
  '删除',
  '移除',
  '销毁',
  '清空',
  '支付',
  '付款',
  '购买',
  '下单',
  '结账',
  '提交订单',
  '转账',
  '退款',
  '注销',
  '退出',
  '登出',
  '取消订阅',
  '重置账户'
];

export function evaluateActionSafety(action: ActionStep): ActionStep {
  if (isUnsafeInput(action)) {
    return skipped(action, `Unsafe input type skipped: ${String(action.metadata?.inputType)}`);
  }

  if (isSubmitAction(action)) {
    return skipped(action, 'Form submit skipped by default');
  }

  const haystack = riskText(action);
  const matchedKeyword = DANGEROUS_KEYWORDS.find((keyword) => haystack.includes(keyword));

  if (!matchedKeyword) {
    return action;
  }

  return skipped(action, `Dangerous action keyword: ${matchedKeyword}`);
}

function isUnsafeInput(action: ActionStep): boolean {
  const tagName = String(action.metadata?.tagName ?? '').toLowerCase();
  const inputType = String(action.metadata?.inputType ?? '').toLowerCase();

  return tagName === 'input' && ['password', 'file'].includes(inputType);
}

function isSubmitAction(action: ActionStep): boolean {
  const tagName = String(action.metadata?.tagName ?? '').toLowerCase();
  const inputType = String(action.metadata?.inputType ?? '').toLowerCase();
  const insideForm = action.metadata?.insideForm === true;

  if (tagName === 'input' && ['submit', 'image'].includes(inputType)) {
    return true;
  }

  if (tagName === 'button' && (inputType === 'submit' || (insideForm && inputType === ''))) {
    return true;
  }

  return false;
}

function riskText(action: ActionStep): string {
  const metadataValues = [
    action.metadata?.href,
    action.metadata?.formAction,
    action.metadata?.ariaLabel,
    action.metadata?.name,
    action.metadata?.id,
    action.metadata?.inputType
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  return `${action.label} ${action.selector} ${metadataValues}`.toLowerCase();
}

function skipped(action: ActionStep, skipReason: string): ActionStep {
  return {
    ...action,
    status: 'skipped',
    skipReason,
    urlAfter: action.urlAfter ?? action.urlBefore
  };
}
