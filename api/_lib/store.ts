// In-memory store — survives warm invocations; add Upstash/KV later for persistence.
const memory = new Map<string, unknown>();

export async function storeGet<T>(key: string): Promise<T | null> {
  return (memory.get(key) as T) ?? null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
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
