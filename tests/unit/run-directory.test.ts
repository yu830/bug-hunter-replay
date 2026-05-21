import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createRunDirectory } from '../../src/storage/run-directory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('createRunDirectory', () => {
  test('creates a timestamped run directory using a sanitized target hostname', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'bug-hunter-run-directory-'));
    temporaryDirectories.push(outputRoot);

    const directory = await createRunDirectory({
      outputRoot,
      now: new Date('2026-05-20T12:34:56.789Z'),
      hostname: 'example.com'
    });

    expect(directory.runId).toBe('2026-05-20_123456_example-com');
    expect(directory.runPath).toBe(join(outputRoot, '2026-05-20_123456_example-com'));
    expect(directory.reportJsonPath).toBe(join(directory.runPath, 'report.json'));

    await expect(readFile(directory.runPath)).rejects.toThrow();
  });
});
