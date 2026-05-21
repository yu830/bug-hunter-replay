import { describe, expect, test } from 'vitest';

import { createCliProgram, normalizeCliArgv } from '../../src/cli/index.js';

describe('bug-hunter CLI', () => {
  test('prints help with the run command', () => {
    const program = createCliProgram();

    expect(program.helpInformation()).toContain('run [options] <url>');
  });

  test('exposes the package version', () => {
    const program = createCliProgram();

    expect(program.version()).toBe('0.0.0');
  });

  test('removes a pnpm forwarded argument separator', () => {
    expect(normalizeCliArgv(['node', 'index.ts', '--', '--help'])).toEqual([
      'node',
      'index.ts',
      '--help'
    ]);
  });
});
