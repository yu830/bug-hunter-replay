import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Page } from 'playwright';

export async function captureInitialScreenshot(page: Page, runPath: string): Promise<string> {
  return captureScreenshot(page, runPath, 'screenshots/initial.png');
}

export async function captureActionScreenshot(
  page: Page,
  runPath: string,
  stepNumber: number,
  phase: 'before' | 'after'
): Promise<string> {
  return captureScreenshot(page, runPath, `screenshots/step-${stepNumber.toString().padStart(3, '0')}-${phase}.png`);
}

async function captureScreenshot(page: Page, runPath: string, artifactPath: string): Promise<string> {
  const screenshotsPath = join(runPath, 'screenshots');
  const screenshotPath = join(runPath, artifactPath);

  await mkdir(screenshotsPath, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return artifactPath;
}
