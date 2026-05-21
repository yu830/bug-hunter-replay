import type { ActionStep } from '../types/action.js';
import type { BugHunterReport } from '../types/report.js';

const FILL_VALUE = 'bug-hunter-test';
const DATA_TESTID_PATTERN = /^\[data-testid="((?:\\.|[^"])*)"\]$/;
const ARIA_LABEL_PATTERN = /^\[aria-label="((?:\\.|[^"])*)"\]$/;
const ROLE_PATTERN = /^role=([a-zA-Z0-9_-]+)\[name="((?:\\.|[^"])*)"\]$/;
const TEXT_PATTERN = /^text="((?:\\.|[^"])*)"$/;

export function renderReproSpec(report: BugHunterReport): string {
  const selectedAction = selectReproAction(report);
  const lines = [
    "import { test, expect } from 'playwright/test';",
    '',
    "test('reproduces Bug Hunter Replay run', async ({ page }) => {",
    '  const consoleErrors: string[] = [];',
    "  page.on('console', msg => {",
    "    if (msg.type() === 'error') consoleErrors.push(msg.text());",
    '  });',
    '',
    `  await page.goto(${stringLiteral(report.startUrl)});`,
    ...(selectedAction ? renderAction(selectedAction) : []),
    "  await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });",
    '  expect(consoleErrors).toHaveLength(0);',
    '});',
    ''
  ];

  return lines.join('\n');
}

function selectReproAction(report: BugHunterReport): ActionStep | undefined {
  const issueWithStepId = report.issues.find((issue) => issue.stepId);
  const issueAction = issueWithStepId ? report.actions.find((action) => action.id === issueWithStepId.stepId) : undefined;

  if (issueAction && isReproAction(issueAction)) {
    return issueAction;
  }

  return report.actions.find((action) => action.status === 'failed' && isReproAction(action));
}

function isReproAction(action: ActionStep): boolean {
  return action.status !== 'skipped' && action.status !== 'pending' && ['goto', 'click', 'fill', 'select'].includes(action.type);
}

function renderAction(action: ActionStep): string[] {
  const locator = locatorExpression(action.selector);

  if (action.type === 'goto' || action.type === 'click') {
    return [`  await ${locator}.click();`];
  }

  if (action.type === 'fill') {
    return [`  await ${locator}.fill(${stringLiteral(FILL_VALUE)});`];
  }

  const optionName = `${safeIdentifier(action.id)}Option`;
  return [
    `  const ${optionName} = await ${locator}.locator('option').evaluateAll((options) => {`,
    "    const option = options.find((element) => (element as HTMLOptionElement).value !== '');",
    '    return option ? (option as HTMLOptionElement).value : undefined;',
    '  });',
    `  if (${optionName}) {`,
    `    await ${locator}.selectOption(${optionName});`,
    '  }'
  ];
}

function locatorExpression(selector: string): string {
  const testId = selector.match(DATA_TESTID_PATTERN);
  if (testId?.[1]) {
    return `page.getByTestId(${stringLiteral(unescapeSelectorValue(testId[1]))})`;
  }

  const ariaLabel = selector.match(ARIA_LABEL_PATTERN);
  if (ariaLabel?.[1]) {
    return `page.getByLabel(${stringLiteral(unescapeSelectorValue(ariaLabel[1]))})`;
  }

  const role = selector.match(ROLE_PATTERN);
  if (role?.[1] && role[2]) {
    return `page.getByRole(${stringLiteral(role[1])}, { name: ${stringLiteral(unescapeSelectorValue(role[2]))} })`;
  }

  const text = selector.match(TEXT_PATTERN);
  if (text?.[1]) {
    return `page.getByText(${stringLiteral(unescapeSelectorValue(text[1]))})`;
  }

  return `page.locator(${stringLiteral(selector)})`;
}

function unescapeSelectorValue(value: string): string {
  return value.replace(/\\(["\\])/g, '$1');
}

function stringLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function safeIdentifier(value: string): string {
  const identifier = value.replace(/[^a-zA-Z0-9_$]/g, '');
  return identifier && /^[a-zA-Z_$]/.test(identifier) ? identifier : 'action';
}
