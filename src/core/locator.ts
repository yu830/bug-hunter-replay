import type { Locator, Page } from 'playwright';

const DATA_TESTID_PATTERN = /^\[data-testid="((?:\\.|[^"])*)"\]$/;
const ARIA_LABEL_PATTERN = /^\[aria-label="((?:\\.|[^"])*)"\]$/;
const ROLE_PATTERN = /^role=([a-zA-Z0-9_-]+)\[name="((?:\\.|[^"])*)"\]$/;
const TEXT_PATTERN = /^text="((?:\\.|[^"])*)"$/;

export function resolveLocator(page: Page, selector: string): Locator {
  const testId = selector.match(DATA_TESTID_PATTERN);
  if (testId?.[1]) {
    return page.getByTestId(unescapeSelectorValue(testId[1]));
  }

  const ariaLabel = selector.match(ARIA_LABEL_PATTERN);
  if (ariaLabel?.[1]) {
    return page.getByLabel(unescapeSelectorValue(ariaLabel[1]));
  }

  const role = selector.match(ROLE_PATTERN);
  if (role?.[1] && role[2]) {
    return page.getByRole(role[1] as Parameters<Page['getByRole']>[0], { name: unescapeSelectorValue(role[2]) });
  }

  const text = selector.match(TEXT_PATTERN);
  if (text?.[1]) {
    return page.getByText(unescapeSelectorValue(text[1]));
  }

  return page.locator(selector);
}

function unescapeSelectorValue(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
