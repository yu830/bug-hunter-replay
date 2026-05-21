import { chromium, type Browser, type Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  page: Page;
}

export async function openBrowserSession(headful: boolean): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage();

  return { browser, page };
}
