import type { Page } from 'playwright';

export interface BlankPageSnapshot {
  url: string;
  text: string;
  visibleElementCount: number;
  timestamp: string;
  screenshot?: string;
  stepId?: string;
  actionPath?: string[];
}

export interface BlankPageResult {
  isBlank: boolean;
  url: string;
  textLength: number;
  visibleElementCount: number;
  timestamp: string;
  screenshot?: string;
  stepId?: string;
  actionPath: string[];
}

export async function detectBlankPage(
  page: Page,
  context: Pick<BlankPageSnapshot, 'screenshot' | 'stepId' | 'actionPath'> = {}
): Promise<BlankPageResult> {
  const snapshot = await page.evaluate(() => {
    const visibleElementCount = Array.from(document.body.querySelectorAll('*')).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }).length;

    return {
      text: document.body.innerText,
      visibleElementCount
    };
  });

  return evaluateBlankPageSnapshot({
    url: page.url(),
    text: snapshot.text,
    visibleElementCount: snapshot.visibleElementCount,
    timestamp: new Date().toISOString(),
    ...context
  });
}

export function evaluateBlankPageSnapshot(snapshot: BlankPageSnapshot): BlankPageResult {
  const textLength = snapshot.text.trim().length;

  return {
    isBlank: textLength < 20 && snapshot.visibleElementCount <= 2,
    url: snapshot.url,
    textLength,
    visibleElementCount: snapshot.visibleElementCount,
    timestamp: snapshot.timestamp,
    screenshot: snapshot.screenshot,
    stepId: snapshot.stepId,
    actionPath: snapshot.actionPath ?? []
  };
}
