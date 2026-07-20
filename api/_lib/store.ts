const memory = new Map<string, unknown>();

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/** True when Upstash / Vercel KV is configured (required for username uniqueness). */
export function isStoreConfigured(): boolean {
  return redisConfig() != null;
}

async function redisCmd<T>(command: (string | number)[]): Promise<T | null> {
  const cfg = redisConfig();
  if (!cfg) return null;

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    throw new Error(`Redis HTTP ${res.status}`);
  }

  const data = (await res.json()) as { result?: T };
  return data.result ?? null;
}

export async function storeGet<T>(key: string): Promise<T | null> {
  try {
    const result = await redisCmd<string>(['GET', key]);
    if (result != null) return JSON.parse(result) as T;
    // Explicit miss from Redis — do not fall back to cold-instance memory.
    if (isStoreConfigured()) return null;
  } catch (err) {
    console.error('Redis get failed:', err);
    if (isStoreConfigured()) throw err;
  }
  return (memory.get(key) as T) ?? null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (!isStoreConfigured()) {
    // Local/dev only — production username registry must use Redis.
    memory.set(key, value);
    return;
  }
  try {
    const ok = await redisCmd<string>(['SET', key, JSON.stringify(value)]);
    if (ok === 'OK') return;
    throw new Error('Redis SET did not return OK');
  } catch (err) {
    console.error('Redis set failed:', err);
    throw err instanceof Error ? err : new Error('Failed to persist');
  }
}

/** Persist and require Redis — used for username uniqueness. */
export async function storeSetRequired<T>(key: string, value: T): Promise<void> {
  if (!isStoreConfigured()) {
    throw new Error(
      'Username registry unavailable — connect Vercel KV / Upstash Redis (KV_REST_API_URL).',
    );
  }
  await storeSet(key, value);
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
  activity: 'paygram:activity',
  tabs: 'paygram:tabs',
  circles: 'paygram:circles',
} as const;

function usernameKey(handle: string): string {
  return `paygram:uname:${handle.replace('@', '').toLowerCase()}`;
}

/**
 * Atomically claim a username for a wallet.
 * Returns true if this wallet owns the handle after the call.
 */
export async function claimUsernameAtomic(
  handle: string,
  walletAddress: string,
): Promise<boolean> {
  const key = usernameKey(handle);
  const wallet = walletAddress.toLowerCase();
  if (!isStoreConfigured()) {
    throw new Error('Username registry unavailable — Redis/KV not configured');
  }

  // SET NX — only succeed if key is free
  const set = await redisCmd<string | null>(['SET', key, wallet, 'NX']);
  if (set === 'OK') return true;

  // Already exists — allow if same wallet (re-claim / sync)
  const owner = await redisCmd<string>(['GET', key]);
  if (owner && owner.toLowerCase() === wallet) return true;
  return false;
}

export async function releaseUsernameClaim(
  handle: string,
  walletAddress: string,
): Promise<void> {
  const key = usernameKey(handle);
  const wallet = walletAddress.toLowerCase();
  const owner = await redisCmd<string>(['GET', key]);
  if (owner && owner.toLowerCase() === wallet) {
    await redisCmd(['DEL', key]);
  }
}

export async function getUsernameOwner(handle: string): Promise<string | null> {
  if (!isStoreConfigured()) return null;
  const owner = await redisCmd<string>(['GET', usernameKey(handle)]);
  return owner ?? null;
}
