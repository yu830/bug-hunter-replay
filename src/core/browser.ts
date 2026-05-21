import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function openBrowserSession(headful: boolean): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: !headful });
  const context = await browser.newContext();
  const page = await context.newPage();

  return { browser, context, page };
}
