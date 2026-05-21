import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { analyzeIssues } from '../../core/analyzer.js';
import { detectBlankPage, type BlankPageResult } from '../../core/blank-page.js';
import { openBrowserSession } from '../../core/browser.js';
import { explorePage } from '../../core/explorer.js';
import { attachBrowserRecorder, createNavigationErrorEvent } from '../../core/recorder.js';
import { captureInitialScreenshot } from '../../core/screenshot.js';
import { renderHtmlReport } from '../../reporters/html.js';
import { renderMarkdownReport } from '../../reporters/markdown.js';
import { renderReproSpec } from '../../reporters/repro-spec.js';
import type { ActionStep } from '../../types/action.js';
import { DEFAULT_RUN_CONFIG, type BugHunterRunConfig } from '../../types/config.js';
import type { BugHunterReport } from '../../types/report.js';
import { createRunDirectory } from '../../storage/run-directory.js';

interface RunCommandOptions {
  maxDepth?: number;
  maxActions?: number;
  timeout?: number;
  slowThreshold?: number;
  output?: string;
  headful?: boolean;
  sameOriginOnly?: boolean;
  trace?: boolean;
}

export async function runBugHunter(startUrl: string, options: RunCommandOptions): Promise<BugHunterReport> {
  const startedAt = new Date();
  const config = buildRunConfig(options);
  const targetHostname = new URL(startUrl).hostname;
  const runDirectory = await createRunDirectory({
    outputRoot: config.output,
    now: startedAt,
    hostname: targetHostname
  });
  const reportMarkdownPath = join(runDirectory.runPath, 'report.md');
  const reportHtmlPath = join(runDirectory.runPath, 'report.html');
  const reproSpecPath = join(runDirectory.runPath, 'repro.spec.ts');
  const tracePath = config.trace ? join(runDirectory.runPath, 'traces', 'trace.zip') : undefined;
  const screenshots: string[] = [];
  const actions: ActionStep[] = [];
  const blankPageResults: BlankPageResult[] = [];
  let actionsExecuted = 0;
  const events = [];
  const networkEvents = [];

  try {
    const { browser, context, page } = await openBrowserSession(config.headful);
    const recorder = attachBrowserRecorder(page);
    let tracingStarted = false;

    try {
      if (tracePath) {
        await mkdir(join(runDirectory.runPath, 'traces'), { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        tracingStarted = true;
      }

      await page.goto(startUrl, { waitUntil: 'load', timeout: config.timeout });
      await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => undefined);
      await page.waitForTimeout(100);
      const initialScreenshot = await captureInitialScreenshot(page, runDirectory.runPath);
      screenshots.push(initialScreenshot);
      blankPageResults.push(await detectBlankPage(page, { screenshot: initialScreenshot }));
      const explorationResult = await explorePage(page, {
        runPath: runDirectory.runPath,
        maxActions: config.maxActions,
        maxDepth: config.maxDepth,
        timeout: config.timeout,
        startUrl,
        sameOriginOnly: config.sameOriginOnly,
        recorder
      });
      actions.splice(0, actions.length, ...explorationResult.actions);
      actionsExecuted = explorationResult.actionsExecuted;
      screenshots.push(...explorationResult.screenshots);
      blankPageResults.push(...explorationResult.blankPageResults);
    } catch (error) {
      recorder.events.push(createNavigationErrorEvent(errorMessage(error), startUrl));
    } finally {
      if (tracingStarted && tracePath) {
        await context.tracing.stop({ path: tracePath }).catch(() => undefined);
      }
      await browser.close();
    }

    events.push(...recorder.events);
    networkEvents.push(...recorder.networkEvents);
  } catch (error) {
    events.push(createNavigationErrorEvent(errorMessage(error), startUrl));
  }

  const issues = analyzeIssues({ events, networkEvents, actions, slowThreshold: config.slowThreshold, blankPageResults });
  const endedAt = new Date();
  const report: BugHunterReport = {
    runId: runDirectory.runId,
    startUrl,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    config,
    summary: {
      actionsDiscovered: actions.length,
      actionsExecuted,
      issuesFound: issues.length,
      networkEventsCaptured: networkEvents.length
    },
    actions,
    issues,
    events,
    networkEvents,
    artifacts: {
      reportJsonPath: runDirectory.reportJsonPath,
      reportMarkdownPath,
      reportHtmlPath,
      reproSpecPath,
      ...(tracePath ? { tracePath } : {}),
      screenshots
    }
  };

  await Promise.all([
    writeFile(runDirectory.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(reportMarkdownPath, renderMarkdownReport(report), 'utf8'),
    writeFile(reportHtmlPath, renderHtmlReport(report), 'utf8'),
    writeFile(reproSpecPath, renderReproSpec(report), 'utf8')
  ]);

  return report;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildRunConfig(options: RunCommandOptions): BugHunterRunConfig {
  return {
    maxDepth: parseNumberOption(options.maxDepth, DEFAULT_RUN_CONFIG.maxDepth),
    maxActions: parseNumberOption(options.maxActions, DEFAULT_RUN_CONFIG.maxActions),
    timeout: parseNumberOption(options.timeout, DEFAULT_RUN_CONFIG.timeout),
    slowThreshold: parseNumberOption(options.slowThreshold, DEFAULT_RUN_CONFIG.slowThreshold),
    output: options.output ?? DEFAULT_RUN_CONFIG.output,
    headful: options.headful ?? DEFAULT_RUN_CONFIG.headful,
    sameOriginOnly: options.sameOriginOnly ?? DEFAULT_RUN_CONFIG.sameOriginOnly,
    trace: options.trace ?? DEFAULT_RUN_CONFIG.trace
  };
}

function parseNumberOption(value: number | undefined, defaultValue: number): number {
  return value ?? defaultValue;
}
