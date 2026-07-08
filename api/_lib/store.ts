const memory = new Map<string, unknown>();

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
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
  } catch (err) {
    console.error('Redis get failed:', err);
  }
  return (memory.get(key) as T) ?? null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  try {
    const ok = await redisCmd<string>(['SET', key, JSON.stringify(value)]);
    if (ok === 'OK') return;
  } catch (err) {
    console.error('Redis set failed:', err);
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
