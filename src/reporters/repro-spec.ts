import type { ActionStep } from '../types/action.js';
import type { BugHunterReport, CapturedIssue } from '../types/report.js';

const FILL_VALUE = 'bug-hunter-test';
const DATA_TESTID_PATTERN = /^\[data-testid="((?:\\.|[^"])*)"\]$/;
const ARIA_LABEL_PATTERN = /^\[aria-label="((?:\\.|[^"])*)"\]$/;
const ROLE_PATTERN = /^role=([a-zA-Z0-9_-]+)\[name="((?:\\.|[^"])*)"\]$/;
const TEXT_PATTERN = /^text="((?:\\.|[^"])*)"$/;

export function renderReproSpec(report: BugHunterReport): string {
  const tests = report.issues.length > 0 ? report.issues.flatMap((issue) => renderIssueTest(report, issue)) : renderBaseTest(report);

  return ["import { test, expect } from 'playwright/test';", '', ...tests, ''].join('\n');
}

function renderIssueTest(report: BugHunterReport, issue: CapturedIssue): string[] {
  const actionPath = actionsForIssue(report, issue);
  const lines = [
    `test(${stringLiteral(`reproduces ${issue.id} ${issue.type}`)}, async ({ page }) => {`,
    ...renderInstrumentation(),
    '',
    `  await page.goto(${stringLiteral(report.startUrl)});`,
    ...actionPath.flatMap(renderAction),
    '  await page.waitForTimeout(300);',
    "  await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });",
    ...renderIssueAssertion(report, issue),
    '});',
    ''
  ];

  return lines;
}

function renderBaseTest(report: BugHunterReport): string[] {
  return [
    "test('reproduces Bug Hunter Replay run', async ({ page }) => {",
    ...renderInstrumentation(),
    '',
    `  await page.goto(${stringLiteral(report.startUrl)});`,
    '  await page.waitForTimeout(300);',
    "  await page.screenshot({ path: 'repro-screenshot.png', fullPage: true });",
    '  expect(consoleErrors).toHaveLength(0);',
    '  expect(pageErrors).toHaveLength(0);',
    '});'
  ];
}

function renderInstrumentation(): string[] {
  return [
    '  const consoleErrors: string[] = [];',
    '  const pageErrors: string[] = [];',
    '  const failedRequests: string[] = [];',
    '  const responseStatuses: Array<{ url: string; status: number }> = [];',
    '  const requestStarts = new Map<string, number>();',
    '  const slowRequests: Array<{ url: string; durationMs: number }> = [];',
    "  page.on('console', msg => {",
    "    if (msg.type() === 'error') consoleErrors.push(msg.text());",
    '  });',
    "  page.on('pageerror', error => pageErrors.push(error.message));",
    "  page.on('request', request => requestStarts.set(request.url(), Date.now()));",
    "  page.on('requestfailed', request => failedRequests.push(request.url()));",
    "  page.on('response', response => {",
    '    responseStatuses.push({ url: response.url(), status: response.status() });',
    '    const startedAt = requestStarts.get(response.url());',
    '    if (startedAt !== undefined) slowRequests.push({ url: response.url(), durationMs: Date.now() - startedAt });',
    '  });'
  ];
}

function renderIssueAssertion(report: BugHunterReport, issue: CapturedIssue): string[] {
  if (issue.type === 'console_error') {
    return [
      `  expect(consoleErrors.some(message => message.includes(${stringLiteral(assertionMessage(issue.message))}))).toBe(true);`
    ];
  }

  if (issue.type === 'page_error') {
    return [`  expect(pageErrors.some(message => message.includes(${stringLiteral(assertionMessage(issue.message))}))).toBe(true);`];
  }

  if (issue.type === 'request_failed') {
    return ['  expect(failedRequests.length).toBeGreaterThan(0);'];
  }

  if (issue.type === 'http_4xx' || issue.type === 'http_5xx') {
    const status = typeof issue.metadata?.status === 'number' ? issue.metadata.status : Number(issue.title.match(/\d+/)?.[0] ?? 400);

    return [
      `  expect(responseStatuses.some(response => response.status === ${status})).toBe(true);`
    ];
  }

  if (issue.type === 'slow_request') {
    const threshold =
      typeof issue.metadata?.thresholdMs === 'number' ? issue.metadata.thresholdMs : report.config.slowThreshold;

    return [
      `  expect(slowRequests.some(request => request.durationMs > ${threshold})).toBe(true);`
    ];
  }

  if (issue.type === 'blank_page') {
    return [
      '  const blankPage = await page.evaluate(() => {',
      "    const textLength = document.body.innerText.trim().length;",
      "    const visibleElementCount = Array.from(document.body.querySelectorAll('*')).filter((element) => {",
      '      const style = window.getComputedStyle(element);',
      '      const rect = element.getBoundingClientRect();',
      "      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;",
      '    }).length;',
      '    return { textLength, visibleElementCount };',
      '  });',
      '  expect(blankPage.textLength).toBeLessThan(20);',
      '  expect(blankPage.visibleElementCount).toBeLessThanOrEqual(2);'
    ];
  }

  return ['  expect(consoleErrors.length + pageErrors.length + failedRequests.length).toBeGreaterThanOrEqual(0);'];
}

function actionsForIssue(report: BugHunterReport, issue: CapturedIssue): ActionStep[] {
  if (issue.stepId) {
    const action = report.actions.find((candidate) => candidate.id === issue.stepId);
    if (action) {
      return actionPathFromParentLinks(report.actions, action).filter(isReproAction);
    }
  }

  if (issue.actionPath.length > 0) {
    const matchedActions = actionsMatchingPath(report.actions, issue.actionPath);
    if (matchedActions.length > 0) {
      return matchedActions.filter(isReproAction);
    }
  }

  return [];
}

function actionPathFromParentLinks(actions: ActionStep[], action: ActionStep): ActionStep[] {
  const byId = new Map(actions.map((candidate) => [candidate.id, candidate]));
  const path: ActionStep[] = [];
  let current: ActionStep | undefined = action;

  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}

function actionsMatchingPath(actions: ActionStep[], labels: string[]): ActionStep[] {
  const target = actions.find((action) => arraysEqual(action.actionPath ?? [], labels));

  return target ? actionPathFromParentLinks(actions, target) : [];
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function assertionMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function safeIdentifier(value: string): string {
  const identifier = value.replace(/[^a-zA-Z0-9_$]/g, '');
  return identifier && /^[a-zA-Z_$]/.test(identifier) ? identifier : 'action';
}
