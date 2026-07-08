import { kv } from '@vercel/kv';

const memory = new Map<string, unknown>();

function useKv(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function storeGet<T>(key: string): Promise<T | null> {
  if (useKv()) {
    return kv.get<T>(key);
  }
  return (memory.get(key) as T) ?? null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (useKv()) {
    await kv.set(key, value);
    return;
  }
  memory.set(key, value);
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
