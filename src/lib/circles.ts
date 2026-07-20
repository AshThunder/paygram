import { uid } from '@/lib/storage';

export type CircleStatus = 'forming' | 'active' | 'paused' | 'completed' | 'dissolved';

export type LocalCircle = {
  id: string;
  name: string;
  contribution: number;
  memberCount: number;
  members: string[];
  /** Handles still waiting to accept (friends-only invites). */
  pendingInvites?: string[];
  currentRound: number;
  paidRounds: number;
  status: CircleStatus;
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

const KEY = 'paygram_circles_v1';

function norm(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

function circleKey(c: Pick<LocalCircle, 'id' | 'onChainId'>): string {
  return c.onChainId != null ? `chain:${c.onChainId}` : `id:${c.id}`;
}

export function loadCircles(): LocalCircle[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalCircle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCircles(circles: LocalCircle[]) {
  localStorage.setItem(KEY, JSON.stringify(circles));
}

export function upsertCircle(circle: LocalCircle) {
  const all = loadCircles();
  const idx = all.findIndex(
    (c) =>
      c.id === circle.id ||
      (circle.onChainId != null && c.onChainId === circle.onChainId),
  );
  if (idx >= 0) {
    const merged = mergeOne(all[idx], circle);
    all[idx] = merged;
    saveCircles(all);
    return merged;
  }
  all.unshift(circle);
  saveCircles(all);
  return circle;
}

export function patchCircle(id: string, patch: Partial<LocalCircle>): LocalCircle | null {
  const all = loadCircles();
  const cur = all.find((c) => c.id === id || (patch.onChainId != null && c.onChainId === patch.onChainId));
  if (!cur) return null;
  const updated = mergeOne(cur, { ...cur, ...patch, id: cur.id });
  saveCircles(all.map((c) => (c.id === cur.id ? updated : c)));
  return updated;
}

function mergeOne(a: LocalCircle, b: LocalCircle): LocalCircle {
  const members = uniqHandles([...(a.members ?? []), ...(b.members ?? [])]);
  const pendingInvites = uniqHandles([
    ...(a.pendingInvites ?? []),
    ...(b.pendingInvites ?? []),
  ]).filter((h) => !members.some((m) => norm(m) === norm(h)));
  const statusRank: Record<CircleStatus, number> = {
    forming: 0,
    active: 1,
    paused: 1,
    completed: 2,
    dissolved: 2,
  };
  const status = statusRank[b.status] >= statusRank[a.status] ? b.status : a.status;
  return {
    ...a,
    ...b,
    id: a.id,
    members,
    pendingInvites,
    memberCount: Math.max(a.memberCount, b.memberCount, members.length),
    currentRound: Math.max(a.currentRound, b.currentRound),
    paidRounds: Math.max(a.paidRounds, b.paidRounds),
    status,
    onChainId: b.onChainId ?? a.onChainId ?? null,
    chainId: b.chainId ?? a.chainId ?? null,
    creatorAddress: b.creatorAddress ?? a.creatorAddress ?? null,
    creatorHandle: b.creatorHandle ?? a.creatorHandle ?? null,
    createdAt: a.createdAt || b.createdAt,
  };
}

function uniqHandles(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of list) {
    const key = norm(h);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(h.startsWith('@') ? h : `@${h}`);
  }
  return out;
}

/** Merge remote shared circles into local cache (dedupe by onChainId / id). */
export function mergeRemoteCircles(local: LocalCircle[], remote: LocalCircle[]): LocalCircle[] {
  const byKey = new Map<string, LocalCircle>();
  for (const c of local) byKey.set(circleKey(c), c);
  for (const r of remote) {
    const k = circleKey(r);
    const existing = byKey.get(k);
    // Also collapse id-only local row if remote has same onChainId.
    if (!existing && r.onChainId != null) {
      for (const [key, val] of byKey) {
        if (val.onChainId === r.onChainId) {
          byKey.delete(key);
          byKey.set(k, mergeOne(val, { ...r, id: val.id }));
          break;
        }
      }
      if (!byKey.has(k)) byKey.set(k, r);
      continue;
    }
    byKey.set(k, existing ? mergeOne(existing, { ...r, id: existing.id }) : r);
  }
  return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** On-chain membership is source of truth for pending invites (handles can drift). */
export function reconcileCircleWithOnChain(
  local: LocalCircle,
  onChain: {
    memberCount: number;
    currentRound: number;
    paidRounds: number;
    roundDeadline: number;
    started: boolean;
    cancelled: boolean;
    completed: boolean;
    members: string[];
    pendingInvites: string[];
    creator?: string;
  },
): LocalCircle {
  const memberAddrs = new Set(onChain.members.map((a) => a.toLowerCase()));
  const pendingAddrs = new Set(onChain.pendingInvites.map((a) => a.toLowerCase()));

  const prevPending = local.pendingInvites ?? [];
  const prevPendingAddrs = local.pendingAddresses ?? [];

  // If chain has no pending invites, drop all handle-level pending (accept already landed).
  let pendingInvites: string[] = [];
  let pendingAddresses: string[] = [];
  if (pendingAddrs.size > 0) {
    for (let i = 0; i < prevPending.length; i++) {
      const h = prevPending[i]!;
      const addr = prevPendingAddrs[i]?.toLowerCase();
      if (addr && memberAddrs.has(addr)) continue; // accepted
      if (addr && !pendingAddrs.has(addr)) continue; // revoked / gone
      pendingInvites.push(h);
      if (prevPendingAddrs[i]) pendingAddresses.push(prevPendingAddrs[i]!);
    }
  }

  let status: CircleStatus = local.status;
  if (onChain.completed) status = 'completed';
  else if (onChain.cancelled) status = 'dissolved';
  else if (onChain.started) status = 'active';
  else status = 'forming';

  return {
    ...local,
    memberCount: onChain.memberCount,
    currentRound: onChain.currentRound,
    paidRounds: onChain.paidRounds,
    roundDeadline: onChain.roundDeadline ? onChain.roundDeadline * 1000 : undefined,
    status,
    memberAddresses: onChain.members,
    pendingInvites,
    pendingAddresses,
    creatorAddress: onChain.creator ?? local.creatorAddress ?? null,
    // Promote handles that accepted (were pending, address now a member).
    members: uniqHandles([
      ...local.members,
      ...prevPending.filter((_, i) => {
        const addr = prevPendingAddrs[i]?.toLowerCase();
        return Boolean(addr && memberAddrs.has(addr));
      }),
    ]),
  };
}

export function createLocalCircle(input: {
  name: string;
  contribution: number;
  members: string[];
  pendingInvites?: string[];
  onChainId?: number | null;
  chainId?: number | null;
  memberAddresses?: string[];
  pendingAddresses?: string[];
  creatorAddress?: string | null;
  creatorHandle?: string | null;
  roundPeriodSec?: number;
  status?: CircleStatus;
}): LocalCircle {
  const members = uniqHandles(input.members);
  const circle: LocalCircle = {
    id: uid(),
    name: input.name,
    contribution: input.contribution,
    memberCount: members.length,
    members,
    pendingInvites: uniqHandles(input.pendingInvites ?? []),
    currentRound: 0,
    paidRounds: 0,
    status: input.status ?? 'forming',
    createdAt: Date.now(),
    onChainId: input.onChainId ?? null,
    chainId: input.chainId ?? null,
    memberAddresses: input.memberAddresses,
    pendingAddresses: input.pendingAddresses,
    creatorAddress: input.creatorAddress ?? null,
    creatorHandle: input.creatorHandle ?? null,
    roundPeriodSec: input.roundPeriodSec,
  };
  upsertCircle(circle);
  return circle;
}
