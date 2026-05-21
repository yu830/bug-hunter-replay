#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { Command, InvalidArgumentError } from 'commander';

import { runBugHunter } from './commands/run.js';

const VERSION = '0.0.0';

export function normalizeCliArgv(argv: string[]): string[] {
  if (argv[2] === '--') {
    return [argv[0] ?? '', argv[1] ?? '', ...argv.slice(3)];
  }

  return argv;
}

export function parsePositiveInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError(`'${value}' is invalid`);
  }

  return parsed;
}

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name('bug-hunter')
    .description('Playwright-based Web bug auto-exploration CLI')
    .version(VERSION);

  program
    .command('run')
    .argument('<url>', 'target URL to explore')
    .description('explore a URL and generate bug reports')
    .option('--max-depth <number>', 'maximum exploration depth', parsePositiveInteger, 2)
    .option('--max-actions <number>', 'maximum actions to execute', parsePositiveInteger, 50)
    .option('--timeout <number>', 'navigation and action timeout in milliseconds', parsePositiveInteger, 10000)
    .option('--slow-threshold <number>', 'slow request threshold in milliseconds', parsePositiveInteger, 3000)
    .option('--output <path>', 'reports output directory', './reports')
    .option('--headful', 'run browser in headful mode', false)
    .option('--same-origin-only', 'limit exploration to same-origin URLs', true)
    .option('--trace', 'collect Playwright trace when available', true)
    .option('--no-trace', 'disable Playwright trace collection')
    .action(async (url: string, options: Record<string, string | boolean | undefined>) => {
      const report = await runBugHunter(url, options);
      console.log(`Report written to ${report.artifacts.reportJsonPath}`);
    });

  return program;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  createCliProgram().parse(normalizeCliArgv(process.argv));
}
