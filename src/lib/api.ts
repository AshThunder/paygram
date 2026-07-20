import type { CollectionPot, PaymentRequest } from './storage';
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
  friends?: string[];
  createdAt: number;
};

export async function registerUserApi(payload: {
  telegramId?: number;
  username?: string;
  displayName?: string;
  walletAddress: string;
  email?: string;
}): Promise<PayGramUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user-registry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: PayGramUser; error?: string };
    if (res.status === 409) {
      throw new Error(data.error ?? 'Username already taken');
    }
    if (res.status === 503 || !res.ok) {
      if (payload.username) {
        throw new Error(
          data.error ?? 'Username registry unavailable. Check your connection and try again.',
        );
      }
      // Soft sync without claiming — don't block login if registry is down.
      if (res.status === 503) return null;
      if (!res.ok) return null;
    }
    if (data.user) {
      if (data.user.username) {
        registerUser(data.user.username, data.user.walletAddress);
      }
      return data.user;
    }
  } catch (e) {
    if (e instanceof Error) throw e;
  }

  if (payload.username) {
    throw new Error('Username registry unavailable. Check your connection and try again.');
  }
  return null;
}

/** Restore claimed username for a wallet (Telegram WebViews clear localStorage). */
export async function lookupUserByWalletApi(
  walletAddress: string,
): Promise<PayGramUser | null> {
  const wallet = walletAddress.toLowerCase();
  try {
    const res = await fetch(
      `${API_BASE}/api/user-registry?wallet=${encodeURIComponent(wallet)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: PayGramUser };
    if (data.user?.username) {
      registerUser(data.user.username, data.user.walletAddress);
    }
    return data.user ?? null;
  } catch {
    return null;
  }
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

/** Returns true if handle is free or already owned by `walletAddress`. */
export async function checkUsernameAvailable(
  handle: string,
  walletAddress?: string | null,
): Promise<{ available: boolean; reason?: string }> {
  const normalized = handle.replace('@', '').toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) {
    return { available: false, reason: 'Use 3–32 characters: letters, numbers, underscore.' };
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/user-registry?handle=${encodeURIComponent(normalized)}`,
    );
    if (res.status === 404) return { available: true };
    if (res.status === 503 || !res.ok) {
      return {
        available: false,
        reason: 'Username registry unavailable — try again in a moment.',
      };
    }
    const data = (await res.json()) as { user?: PayGramUser };
    if (!data.user?.walletAddress) return { available: true };
    if (
      walletAddress &&
      data.user.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    ) {
      return { available: true };
    }
    return { available: false, reason: `@${normalized} is already taken` };
  } catch {
    return {
      available: false,
      reason: 'Username registry unavailable — check your connection.',
    };
  }
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

/** Persist friend handles for a wallet (survives Telegram WebView storage clears). */
export async function syncFriendsApi(
  walletAddress: string,
  friends: string[],
): Promise<string[] | null> {
  const result = await apiFetch<{ user: PayGramUser }>('/api/user-registry', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress,
      friends: friends.map((f) => f.replace(/^@/, '').toLowerCase()),
    }),
  });
  return result?.user?.friends ?? null;
}

/** `null` = fetch failed (keep local cache). `[]` = server has none for this user. */
export async function fetchRequestsApi(forUser?: string): Promise<PaymentRequest[] | null> {
  const q = forUser ? `?for=${encodeURIComponent(forUser)}` : '';
  const result = await apiFetch<{ requests: PaymentRequest[] }>(`/api/requests${q}`);
  if (!result) return null;
  return result.requests ?? [];
}

export async function createRequestApi(
  fromUser: string,
  toUser: string,
  amount: number,
  note?: string,
  meta?: {
    onChainBillId?: number;
    chainId?: number;
    payeeAddress?: string;
  },
): Promise<PaymentRequest | null> {
  const result = await apiFetch<{ request: PaymentRequest }>('/api/requests', {
    method: 'POST',
    body: JSON.stringify({
      fromUser,
      toUser,
      amount,
      note,
      onChainBillId: meta?.onChainBillId,
      chainId: meta?.chainId,
      payeeAddress: meta?.payeeAddress,
    }),
  });
  return result?.request ?? null;
}

export async function markRequestPaidApi(id: string): Promise<void> {
  await apiFetch('/api/requests', {
    method: 'PATCH',
    body: JSON.stringify({ id, status: 'paid' }),
  });
}

export type SharedActivity = {
  id: string;
  type: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  txId?: string;
  status: string;
  createdAt: number;
};

export async function fetchActivityApi(forUser?: string): Promise<SharedActivity[]> {
  const q = forUser ? `?for=${encodeURIComponent(forUser)}` : '';
  const result = await apiFetch<{ activities: SharedActivity[] }>(`/api/activity${q}`);
  return result?.activities ?? [];
}

export async function createActivityApi(payload: {
  fromUser: string;
  toUser: string;
  amount: number;
  type?: string;
  note?: string;
  txId?: string;
  status?: string;
}): Promise<SharedActivity | null> {
  const result = await apiFetch<{ activity: SharedActivity }>('/api/activity', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result?.activity ?? null;
}

export async function updateActivityApi(opts: {
  id?: string;
  txId?: string;
  status: string;
}): Promise<void> {
  await apiFetch('/api/activity', {
    method: 'PATCH',
    body: JSON.stringify(opts),
  });
}

export async function fetchPotsApi(): Promise<CollectionPot[]> {
  const result = await apiFetch<{ pots: CollectionPot[] }>('/api/pots');
  return result?.pots ?? [];
}

export type SharedTabDebt = {
  id: string;
  onChainId?: number | null;
  chainId?: number | null;
  lender: string;
  borrower: string;
  lenderAddress: string;
  borrowerAddress: string;
  principal: number;
  repaid: number;
  dueAt: number | null;
  note?: string;
  closed: boolean;
  fundTxId?: string | null;
  createdAt: number;
};

/** `null` = fetch failed (keep local cache). `[]` = server has none for this user. */
export async function fetchTabsApi(forUser?: string): Promise<SharedTabDebt[] | null> {
  const q = forUser ? `?for=${encodeURIComponent(forUser)}` : '';
  const result = await apiFetch<{ tabs: SharedTabDebt[] }>(`/api/tabs${q}`);
  if (!result) return null;
  return result.tabs ?? [];
}

export async function upsertTabApi(debt: SharedTabDebt): Promise<SharedTabDebt | null> {
  const result = await apiFetch<{ tab: SharedTabDebt }>('/api/tabs', {
    method: 'POST',
    body: JSON.stringify(debt),
  });
  return result?.tab ?? null;
}

export async function patchTabApi(
  id: string,
  patch: { repaid?: number; closed?: boolean; fundTxId?: string },
): Promise<void> {
  await apiFetch('/api/tabs', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...patch }),
  });
}

export type SharedCircle = {
  id: string;
  name: string;
  contribution: number;
  memberCount: number;
  members: string[];
  pendingInvites?: string[];
  currentRound: number;
  paidRounds: number;
  status: 'forming' | 'active' | 'paused' | 'completed' | 'dissolved';
  roundDeadline?: number;
  createdAt: number;
  onChainId?: number | null;
  chainId?: number | null;
  memberAddresses?: string[];
  pendingAddresses?: string[];
  creatorAddress?: string | null;
  creatorHandle?: string | null;
  roundPeriodSec?: number;
};

export async function fetchCirclesApi(forUser?: string): Promise<SharedCircle[]> {
  const q = forUser ? `?for=${encodeURIComponent(forUser)}` : '';
  const result = await apiFetch<{ circles: SharedCircle[] }>(`/api/circles${q}`);
  return result?.circles ?? [];
}

export async function upsertCircleApi(circle: SharedCircle): Promise<SharedCircle | null> {
  const result = await apiFetch<{ circle: SharedCircle }>('/api/circles', {
    method: 'POST',
    body: JSON.stringify(circle),
  });
  return result?.circle ?? null;
}

export async function createPotApi(
  title: string,
  goal: number,
  creator: string,
  extra?: {
    onChainId?: number;
    chainId?: number;
    beneficiaryAddress?: string;
    creatorAddress?: string;
  },
): Promise<CollectionPot | null> {
  const result = await apiFetch<{ pot: CollectionPot }>('/api/pots', {
    method: 'POST',
    body: JSON.stringify({ title, goal, creator, ...extra }),
  });
  return result?.pot ?? null;
}

export async function updatePotCollectedApi(
  id: string,
  collected: number,
  flags?: { released?: boolean; cancelled?: boolean },
): Promise<void> {
  await apiFetch('/api/pots', {
    method: 'PATCH',
    body: JSON.stringify({ id, collected, ...flags }),
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

export async function sendCircleInviteApi(payload: {
  targetUsername: string;
  circleId: number;
  circleName?: string;
  contribution?: number;
  fromUser?: string;
}): Promise<boolean> {
  const result = await apiFetch<{ ok: boolean }>('/api/circle-invite', {
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

export async function shareReceiptApi(payload: {
  chatId: number;
  text?: string;
  imageBase64?: string;
}): Promise<boolean> {
  const result = await apiFetch<{ ok: boolean }>('/api/share-receipt', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return Boolean(result?.ok);
}

export type ParsedReceipt = {
  total: number;
  merchant?: string | null;
  items?: Array<{ name: string; amount: number }> | null;
  suggestedSplitCount?: number | null;
  note?: string | null;
};

export async function parseReceiptApi(imageBase64: string, mimeType?: string): Promise<ParsedReceipt | null> {
  const result = await apiFetch<{ receipt: ParsedReceipt }>('/api/parse-receipt', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  return result?.receipt ?? null;
}
