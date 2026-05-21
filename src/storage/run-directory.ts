import { mkdir } from 'node:fs/promises';
import { hostname as systemHostname } from 'node:os';
import { join } from 'node:path';

export interface RunDirectoryOptions {
  outputRoot: string;
  now?: Date;
  hostname?: string;
}

export interface RunDirectory {
  runId: string;
  runPath: string;
  reportJsonPath: string;
}

export async function createRunDirectory(options: RunDirectoryOptions): Promise<RunDirectory> {
  const now = options.now ?? new Date();
  const hostname = options.hostname ?? systemHostname();
  const runId = `${formatRunTimestamp(now)}_${sanitizeHostname(hostname)}`;
  const runPath = join(options.outputRoot, runId);
  const reportJsonPath = join(runPath, 'report.json');

  await mkdir(runPath, { recursive: true });

  return { runId, runPath, reportJsonPath };
}

function formatRunTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());

  return `${year}-${month}-${day}_${hour}${minute}${second}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function sanitizeHostname(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown-host';
}
