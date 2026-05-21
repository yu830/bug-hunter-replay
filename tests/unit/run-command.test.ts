import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createCliProgram } from '../../src/cli/index.js';
import type { BugHunterReport } from '../../src/types/report.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('bug-hunter run command', () => {
  test('writes a minimal report.json with default config and overridden max actions', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-run-command-'));
    temporaryDirectories.push(outputRoot);
    const program = createCliProgram();
    program.exitOverride();

    await program.parseAsync(
      ['run', 'http://127.0.0.1:9/', '--max-actions', '5', '--timeout', '1000', '--output', outputRoot],
      { from: 'user' }
    );

    const report = await readOnlyReport(outputRoot);

    expect(report.runId).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_127-0-0-1$/);
    expect(report.startUrl).toBe('http://127.0.0.1:9/');
    expect(report.startedAt).toEqual(expect.any(String));
    expect(report.endedAt).toEqual(expect.any(String));
    expect(report.config).toMatchObject({
      maxDepth: 2,
      maxActions: 5,
      timeout: 1000,
      slowThreshold: 3000,
      output: outputRoot,
      headful: false,
      sameOriginOnly: true,
      trace: true
    });
    expect(report.summary).toEqual({
      actionsDiscovered: 0,
      actionsExecuted: 0,
      issuesFound: report.issues.length,
      networkEventsCaptured: report.networkEvents.length
    });
    expect(report.actions).toEqual([]);
    expect(report.networkEvents.length).toBeGreaterThanOrEqual(0);
    expect(report.artifacts.reportJsonPath.endsWith('report.json')).toBe(true);
  });

  test.each(['abc', '0', '-1', 'NaN'])(
    'rejects invalid numeric option value %s without writing a report',
    async (invalidValue) => {
      const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-run-command-'));
      temporaryDirectories.push(outputRoot);
      const program = createCliProgram();
      program.exitOverride();

      await expect(
        program.parseAsync(
          ['run', 'http://127.0.0.1:9/', '--max-actions', invalidValue, '--output', outputRoot],
          { from: 'user' }
        )
      ).rejects.toThrow('process.exit unexpectedly called with "1"');

      const runDirectories = await import('node:fs/promises').then((fs) => fs.readdir(outputRoot));
      expect(runDirectories).toEqual([]);
    }
  );

  test('parses all supported run options', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-run-command-'));
    temporaryDirectories.push(outputRoot);
    const program = createCliProgram();
    program.exitOverride();

    await program.parseAsync(
      [
        'run',
        'http://127.0.0.1:9/',
        '--max-depth',
        '3',
        '--max-actions',
        '7',
        '--timeout',
        '1000',
        '--slow-threshold',
        '4500',
        '--output',
        outputRoot,
        '--headful',
        '--same-origin-only',
        '--trace'
      ],
      { from: 'user' }
    );

    const report = await readOnlyReport(outputRoot);

    expect(report.config).toMatchObject({
      maxDepth: 3,
      maxActions: 7,
      timeout: 1000,
      slowThreshold: 4500,
      output: outputRoot,
      headful: true,
      sameOriginOnly: true,
      trace: true
    });
  });
});

async function readOnlyReport(outputRoot: string): Promise<BugHunterReport> {
  const runDirectories = await import('node:fs/promises').then((fs) => fs.readdir(outputRoot));
  expect(runDirectories).toHaveLength(1);

  const reportPath = join(outputRoot, runDirectories[0] ?? '', 'report.json');
  return JSON.parse(await readFile(reportPath, 'utf8')) as BugHunterReport;
}
