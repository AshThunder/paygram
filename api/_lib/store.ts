import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DIR = join(tmpdir(), 'paygram-store');

async function ensureDir(): Promise<void> {
  try {
    await access(DIR);
  } catch {
    await mkdir(DIR, { recursive: true });
  }
}

function pathFor(key: string): string {
  return join(DIR, `${key.replace(/[^a-z0-9:_-]/gi, '_')}.json`);
}

export async function storeGet<T>(key: string): Promise<T | null> {
  await ensureDir();
  try {
    const raw = await readFile(pathFor(key), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  await ensureDir();
  await writeFile(pathFor(key), JSON.stringify(value), 'utf8');
}

export async function storeUpdate<T>(key: string, updater: (current: T | null) => T): Promise<T> {
  const current = await storeGet<T>(key);
  const next = updater(current);
  await storeSet(key, next);
  return next;
}

export const KEYS = {
  users: 'paygram:users',
  requests: 'paygram:requests',
  pots: 'paygram:pots',
  gifts: 'paygram:gifts',
} as const;
