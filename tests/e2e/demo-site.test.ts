import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { afterEach, describe, expect, test } from 'vitest';

import { runBugHunter } from '../../src/cli/commands/run.js';
import type { BugHunterReport } from '../../src/types/report.js';
import { startDemoSiteServer } from '../fixtures/demo-site/server.js';

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.map((server) => closeServer(server)));
  servers.length = 0;
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('demo site e2e', () => {
  test('generates reports and issue evidence from the local demo site', async () => {
    const server = await startDemoSiteServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected demo server to listen on a port');
    }

    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-demo-site-'));
    temporaryDirectories.push(outputRoot);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const report = await runBugHunter(startUrl, {
      output: outputRoot,
      timeout: 5000,
      maxActions: 20,
      slowThreshold: 100,
      trace: true
    });
    const persistedReport = JSON.parse(await readFile(report.artifacts.reportJsonPath, 'utf8')) as BugHunterReport;

    const issueTypes = persistedReport.issues.map((issue) => issue.type);
    expect(issueTypes).toEqual(
      expect.arrayContaining(['console_error', 'page_error', 'request_failed', 'http_5xx', 'slow_request', 'blank_page'])
    );
    expect(issueTypes).not.toContain('action_failed');
    await expect(stat(persistedReport.artifacts.reportJsonPath)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(persistedReport.artifacts.reportMarkdownPath)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(persistedReport.artifacts.reportHtmlPath)).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(persistedReport.artifacts.reproSpecPath)).resolves.toMatchObject({ size: expect.any(Number) });
    expect(persistedReport.artifacts.screenshots.length).toBeGreaterThan(0);
    await expect(
      stat(join(outputRoot, persistedReport.runId, persistedReport.artifacts.screenshots[0] ?? ''))
    ).resolves.toMatchObject({ size: expect.any(Number) });
  });
});

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
