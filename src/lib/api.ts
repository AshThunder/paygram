import type { CollectionPot, PaymentRequest } from './storage';
import type { GiftLink } from '@/hooks/PayGramProvider';
import { getUserRegistry, registerUser, type UserRegistry } from './parser';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type PayGramUser = {
  id: string;
  username: string | null;
  displayName: string;
  walletAddress: string;
  createdAt: number;
};

export async function registerUserApi(payload: {
  telegramId?: number;
  username?: string;
  displayName?: string;
  walletAddress: string;
}): Promise<PayGramUser | null> {
  const result = await apiFetch<{ user: PayGramUser }>('/api/user-registry', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result?.user) {
    if (result.user.username) {
      registerUser(result.user.username, result.user.walletAddress);
    }
    return result.user;
  }

  if (payload.username) {
    registerUser(payload.username, payload.walletAddress);
  }
  return null;
}

export async function resolveUserApi(handle: string): Promise<string | null> {
  const normalized = handle.replace('@', '').toLowerCase();
  const result = await apiFetch<{ user: PayGramUser }>(
    `/api/user-registry?handle=${encodeURIComponent(normalized)}`,
  );
  if (result?.user?.walletAddress) {
    registerUser(normalized, result.user.walletAddress);
    return result.user.walletAddress;
  }
  return getUserRegistry()[normalized] ?? null;
}

export async function listUsersApi(): Promise<PayGramUser[]> {
  const result = await apiFetch<{ users: PayGramUser[] }>('/api/user-registry');
  if (result?.users) {
    const registry: UserRegistry = {};
    for (const u of result.users) {
      if (u.username) registry[u.username] = u.walletAddress;
    }
    localStorage.setItem('paygram_registry', JSON.stringify(registry));
    return result.users;
  }
  return Object.entries(getUserRegistry()).map(([username, walletAddress]) => ({
    id: username,
    username,
    displayName: username,
    walletAddress,
    createdAt: 0,
  }));
}

export async function fetchRequestsApi(forUser?: string): Promise<PaymentRequest[]> {
  const q = forUser ? `?for=${encodeURIComponent(forUser)}` : '';
  const result = await apiFetch<{ requests: PaymentRequest[] }>(`/api/requests${q}`);
  return result?.requests ?? [];
}

export async function createRequestApi(
  fromUser: string,
  toUser: string,
  amount: number,
  note?: string,
): Promise<PaymentRequest | null> {
  const result = await apiFetch<{ request: PaymentRequest }>('/api/requests', {
    method: 'POST',
    body: JSON.stringify({ fromUser, toUser, amount, note }),
  });
  return result?.request ?? null;
}

export async function markRequestPaidApi(id: string): Promise<void> {
  await apiFetch('/api/requests', {
    method: 'PATCH',
    body: JSON.stringify({ id, status: 'paid' }),
  });
}

export async function fetchPotsApi(): Promise<CollectionPot[]> {
  const result = await apiFetch<{ pots: CollectionPot[] }>('/api/pots');
  return result?.pots ?? [];
}

export async function createPotApi(
  title: string,
  goal: number,
  creator: string,
): Promise<CollectionPot | null> {
  const result = await apiFetch<{ pot: CollectionPot }>('/api/pots', {
    method: 'POST',
    body: JSON.stringify({ title, goal, creator }),
  });
  return result?.pot ?? null;
}

export async function updatePotCollectedApi(id: string, collected: number): Promise<void> {
  await apiFetch('/api/pots', {
    method: 'PATCH',
    body: JSON.stringify({ id, collected }),
  });
}

export async function fetchGiftApi(id: string): Promise<GiftLink | null> {
  const result = await apiFetch<{ gift: GiftLink }>(`/api/gifts?id=${encodeURIComponent(id)}`);
  return result?.gift ?? null;
}

export async function createGiftApi(
  amount: number,
  creator: string,
  creatorAddress: string,
): Promise<GiftLink | null> {
  const result = await apiFetch<{ gift: GiftLink }>('/api/gifts', {
    method: 'POST',
    body: JSON.stringify({ amount, creator, creatorAddress }),
  });
  return result?.gift ?? null;
}

export async function claimGiftApi(id: string): Promise<void> {
  await apiFetch('/api/gifts', {
    method: 'PATCH',
    body: JSON.stringify({ id }),
  });
}

export async function sendRemindApi(payload: {
  targetUsername: string;
  amount?: number;
  fromUser?: string;
  note?: string;
}): Promise<boolean> {
  const result = await apiFetch<{ ok: boolean }>('/api/remind', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return Boolean(result?.ok);
}

export async function addPotContributorApi(
  potId: string,
  user: string,
  amount: number,
  collected: number,
): Promise<void> {
  await apiFetch('/api/pots', {
    method: 'PATCH',
    body: JSON.stringify({ id: potId, collected, contributor: { user, amount } }),
  });
}
