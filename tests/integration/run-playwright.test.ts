import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { runBugHunter } from '../../src/cli/commands/run.js';
import type { BugHunterReport } from '../../src/types/report.js';

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.map((server) => closeServer(server)));
  servers.length = 0;
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('bug-hunter run Playwright capture', () => {
  test('captures initial browser events, network events, and screenshot', async () => {
    const server = await startFixtureServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected local HTTP server to listen on a port');
    }

    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-'));
    temporaryDirectories.push(outputRoot);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const report = await runBugHunter(startUrl, {
      output: outputRoot,
      timeout: 5000,
      maxActions: 10,
      slowThreshold: 100,
      trace: true
    });
    const persistedReport = JSON.parse(await readFile(report.artifacts.reportJsonPath, 'utf8')) as BugHunterReport;
    const eventTypes = persistedReport.events.map((event) => event.type);

    expect(eventTypes).toContain('console_error');
    expect(eventTypes).toContain('page_error');
    expect(eventTypes).toContain('http_error');
    expect(eventTypes).toContain('request_failed');
    expect(persistedReport.networkEvents.length).toBeGreaterThan(0);
    expect(persistedReport.networkEvents.some((event) => event.status === 500)).toBe(true);
    expect(persistedReport.networkEvents.some((event) => event.status === 404)).toBe(true);
    expect(persistedReport.networkEvents.some((event) => event.failedText)).toBe(true);
    expect(persistedReport.summary.networkEventsCaptured).toBe(persistedReport.networkEvents.length);
    expect(persistedReport.summary.issuesFound).toBe(persistedReport.issues.length);
    expect(persistedReport.artifacts.reportMarkdownPath).toBe(join(outputRoot, persistedReport.runId, 'report.md'));
    expect(persistedReport.artifacts.reportHtmlPath).toBe(join(outputRoot, persistedReport.runId, 'report.html'));
    expect(persistedReport.artifacts.reproSpecPath).toBe(join(outputRoot, persistedReport.runId, 'repro.spec.ts'));
    expect(persistedReport.artifacts.tracePath).toBe(join(outputRoot, persistedReport.runId, 'traces', 'trace.zip'));
    expect(persistedReport.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining(['console_error', 'page_error', 'http_5xx', 'request_failed', 'slow_request', 'blank_page'])
    );
    expect(persistedReport.actions.length).toBeGreaterThan(0);
    expect(persistedReport.summary.actionsDiscovered).toBe(persistedReport.actions.length);
    expect(persistedReport.summary.actionsExecuted).toBeGreaterThan(0);
    expect(persistedReport.actions.map((action) => action.type)).toEqual(
      expect.arrayContaining(['goto', 'click', 'fill', 'select'])
    );
    expect(persistedReport.actions.filter((action) => action.status === 'passed').map((action) => action.type)).toEqual(
      expect.arrayContaining(['goto', 'click', 'fill', 'select'])
    );
    expect(persistedReport.actions.find((action) => action.label === 'Delete account')).toMatchObject({
      status: 'skipped',
      skipReason: expect.stringContaining('Dangerous action keyword')
    });
    expect(persistedReport.actions.find((action) => action.label === 'Hidden Button')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is not visible'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Invisible Button')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is not visible'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Disabled Button')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is disabled'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Disabled Input')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is disabled'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Disabled Role Button')).toMatchObject({
      status: 'skipped',
      skipReason: 'Element is disabled'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Docs')).toMatchObject({
      status: 'passed',
      urlAfter: `${startUrl}details`,
      depth: 1,
      actionPath: ['Docs']
    });
    expect(persistedReport.actions.find((action) => action.label === 'Details action')).toMatchObject({
      status: 'passed',
      depth: 2,
      actionPath: ['Docs', 'Details action']
    });
    expect(persistedReport.actions.find((action) => action.label === 'Same Origin')).toMatchObject({
      status: 'passed'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Cross Origin')).toMatchObject({
      status: 'skipped',
      skipReason: 'Cross-origin link skipped'
    });
    expect(persistedReport.actions.find((action) => action.label === 'Save form')).toMatchObject({
      status: 'skipped',
      skipReason: 'Form submit skipped by default'
    });
    const openMenuAction = persistedReport.actions.find((action) => action.label === 'Open menu');
    expect(openMenuAction).toMatchObject({
      status: 'passed',
      urlBefore: startUrl,
      screenshotBefore: 'screenshots/step-003-before.png',
      screenshotAfter: 'screenshots/step-003-after.png'
    });
    expect(openMenuAction?.startedAt).toEqual(expect.any(String));
    expect(openMenuAction?.endedAt).toEqual(expect.any(String));
    expect(openMenuAction?.urlAfter).toEqual(expect.any(String));
    expect(persistedReport.actions.find((action) => action.label === 'Email')).toMatchObject({
      status: 'passed',
      type: 'fill',
      urlBefore: startUrl
    });
    expect(persistedReport.actions.find((action) => action.label === 'Plan')).toMatchObject({
      status: 'passed',
      type: 'select',
      urlBefore: startUrl
    });
    expect(persistedReport.events.some((event) => event.message.includes('menu opened'))).toBe(true);
    expect(persistedReport.events.some((event) => event.message.includes('email filled'))).toBe(true);
    expect(persistedReport.events.some((event) => event.message.includes('plan selected'))).toBe(true);
    expect(persistedReport.issues.find((issue) => issue.type === 'slow_request')).toMatchObject({
      severity: 'warning',
      metadata: {
        thresholdMs: 100,
        resourceType: 'fetch'
      }
    });
    expect(persistedReport.issues.find((issue) => issue.type === 'blank_page')).toMatchObject({
      severity: 'error',
      stepId: expect.any(String),
      actionPath: ['Blank page'],
      screenshot: expect.stringMatching(/^screenshots\/step-\d{3}-after\.png$/)
    });
    expect(persistedReport.artifacts.screenshots).toEqual(
      expect.arrayContaining(['screenshots/initial.png', 'screenshots/step-003-before.png', 'screenshots/step-003-after.png'])
    );
    await expect(stat(persistedReport.artifacts.reportMarkdownPath)).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(persistedReport.artifacts.reportHtmlPath)).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(persistedReport.artifacts.reproSpecPath)).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(persistedReport.artifacts.tracePath ?? '')).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(
      stat(join(outputRoot, persistedReport.runId, persistedReport.artifacts.screenshots[0] ?? ''))
    ).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(outputRoot, persistedReport.runId, openMenuAction?.screenshotBefore ?? ''))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(join(outputRoot, persistedReport.runId, openMenuAction?.screenshotAfter ?? ''))).resolves.toMatchObject({
      size: expect.any(Number)
    });
  });

  test('limits action execution by maxActions', async () => {
    const server = await startFixtureServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected local HTTP server to listen on a port');
    }

    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-max-actions-'));
    temporaryDirectories.push(outputRoot);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const report = await runBugHunter(startUrl, {
      output: outputRoot,
      timeout: 5000,
      maxActions: 2
    });
    const persistedReport = JSON.parse(await readFile(report.artifacts.reportJsonPath, 'utf8')) as BugHunterReport;

    expect(persistedReport.summary.actionsExecuted).toBe(2);
    expect(persistedReport.actions.filter((action) => action.status === 'passed' || action.status === 'failed')).toHaveLength(2);
  });

  test('honors maxDepth during BFS exploration', async () => {
    const server = await startFixtureServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected local HTTP server to listen on a port');
    }

    const outputRootDepthOne = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-depth-one-'));
    const outputRootDepthTwo = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-depth-two-'));
    temporaryDirectories.push(outputRootDepthOne, outputRootDepthTwo);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const depthOneReport = await runBugHunter(startUrl, {
      output: outputRootDepthOne,
      timeout: 5000,
      maxDepth: 1,
      maxActions: 10,
      trace: false
    });
    const depthTwoReport = await runBugHunter(startUrl, {
      output: outputRootDepthTwo,
      timeout: 5000,
      maxDepth: 2,
      maxActions: 10,
      trace: false
    });

    expect(depthOneReport.actions.find((action) => action.label === 'Details action')).toBeUndefined();
    expect(depthTwoReport.actions.find((action) => action.label === 'Details action')).toMatchObject({
      status: 'passed',
      depth: 2,
      actionPath: ['Docs', 'Details action']
    });
  });

  test('does not write traces when trace is disabled', async () => {
    const server = await startFixtureServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected local HTTP server to listen on a port');
    }

    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-no-trace-'));
    temporaryDirectories.push(outputRoot);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const report = await runBugHunter(startUrl, {
      output: outputRoot,
      timeout: 5000,
      maxActions: 5,
      trace: false
    });

    expect(report.artifacts.tracePath).toBeUndefined();
    await expect(stat(join(outputRoot, report.runId, 'traces'))).rejects.toThrow();
  });

  test('does not execute cross-origin links when same-origin-only is disabled', async () => {
    const server = await startFixtureServer();
    servers.push(server);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected local HTTP server to listen on a port');
    }

    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-playwright-cross-origin-'));
    temporaryDirectories.push(outputRoot);
    const startUrl = `http://127.0.0.1:${address.port}/`;

    const report = await runBugHunter(startUrl, {
      output: outputRoot,
      timeout: 5000,
      maxActions: 5,
      sameOriginOnly: false
    });
    const persistedReport = JSON.parse(await readFile(report.artifacts.reportJsonPath, 'utf8')) as BugHunterReport;

    expect(persistedReport.actions.find((action) => action.label === 'Cross Origin')).toMatchObject({
      status: 'skipped',
      skipReason: 'Cross-origin link skipped'
    });
  });

  test('writes report.json with a navigation_error event when navigation fails', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-navigation-error-'));
    temporaryDirectories.push(outputRoot);

    const report = await runBugHunter('http://127.0.0.1:9/', {
      output: outputRoot,
      timeout: 1000,
      maxActions: 5
    });
    const persistedReport = JSON.parse(await readFile(report.artifacts.reportJsonPath, 'utf8')) as BugHunterReport;

    expect(persistedReport.events.map((event) => event.type)).toContain('navigation_error');
    expect(persistedReport.startUrl).toBe('http://127.0.0.1:9/');
  });
});

function startFixtureServer(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html>
<html>
  <body>
    <h1>Milestone 2 fixture</h1>
    <a href="/details" data-testid="docs-link">Docs</a>
    <a href="#same-origin">Same Origin</a>
    <a href="https://example.org/offsite">Cross Origin</a>
    <button aria-label="Open menu" onclick="document.body.insertAdjacentHTML('beforeend', '<p>Menu opened</p>'); console.error('menu opened')">Menu</button>
    <button style="display: none">Hidden Button</button>
    <button style="visibility: hidden">Invisible Button</button>
    <button disabled>Disabled Button</button>
    <div role="button">Role Button</div>
    <div role="button" aria-disabled="true">Disabled Role Button</div>
    <input type="button" value="Input Button" />
    <button>Delete account</button>
    <form onsubmit="console.error('form submitted'); return false">
      <input type="submit" value="Save form" />
    </form>
    <input type="text" aria-label="Email" oninput="console.error('email filled')" />
    <input type="text" aria-label="Disabled Input" disabled />
    <select aria-label="Plan" onchange="console.error('plan selected')"><option value="">Choose</option><option value="free">Free</option></select>
    <textarea aria-label="Message"></textarea>
    <button onclick="document.body.innerHTML = '<main></main>'">Blank page</button>
    <input type="hidden" value="secret" />
    <img src="/missing.png" />
    <script>
      console.error('fixture console error');
      fetch('/server-error').catch(() => {});
      fetch('/slow-api').catch(() => {});
      fetch('/network-fail').catch(() => {});
      setTimeout(() => { throw new Error('fixture page error'); }, 0);
    </script>
  </body>
</html>`);
      return;
    }

    if (request.url === '/details') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html>
<html>
  <body>
    <h1>Details page with enough visible content</h1>
    <button aria-label="Details action" onclick="console.error('details action')">Details action</button>
  </body>
</html>`);
      return;
    }

    if (request.url === '/server-error') {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end('server error');
      return;
    }

    if (request.url === '/slow-api') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"ok":true}');
      }, 150);
      return;
    }

    if (request.url === '/network-fail') {
      request.socket.destroy();
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

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
