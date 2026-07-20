import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { SharedCircle } from '../_lib/types.js';

function norm(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
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

function involvesUser(c: SharedCircle, forUser: string): boolean {
  const u = norm(forUser);
  if (c.creatorHandle && norm(c.creatorHandle) === u) return true;
  if (c.members.some((m) => norm(m) === u)) return true;
  if ((c.pendingInvites ?? []).some((m) => norm(m) === u)) return true;
  return false;
}

function mergeCircle(existing: SharedCircle | undefined, incoming: SharedCircle): SharedCircle {
  if (!existing) return incoming;
  const members = uniqHandles([...(existing.members ?? []), ...(incoming.members ?? [])]);
  const pendingInvites = uniqHandles([
    ...(existing.pendingInvites ?? []),
    ...(incoming.pendingInvites ?? []),
  ]).filter((h) => !members.some((m) => norm(m) === norm(h)));

  const statusRank: Record<SharedCircle['status'], number> = {
    forming: 0,
    active: 1,
    paused: 1,
    completed: 2,
    dissolved: 2,
  };
  const status =
    statusRank[incoming.status] >= statusRank[existing.status] ? incoming.status : existing.status;

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    members,
    pendingInvites,
    memberCount: Math.max(existing.memberCount, incoming.memberCount, members.length),
    currentRound: Math.max(existing.currentRound, incoming.currentRound),
    paidRounds: Math.max(existing.paidRounds, incoming.paidRounds),
    status,
    onChainId: incoming.onChainId ?? existing.onChainId ?? null,
    chainId: incoming.chainId ?? existing.chainId ?? null,
    creatorAddress: incoming.creatorAddress ?? existing.creatorAddress ?? null,
    creatorHandle: incoming.creatorHandle ?? existing.creatorHandle ?? null,
    createdAt: existing.createdAt || incoming.createdAt,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const circles = (await storeGet<SharedCircle[]>(KEYS.circles)) ?? [];
    const forUser = req.query.for ? String(req.query.for) : null;
    const filtered = forUser ? circles.filter((c) => involvesUser(c, forUser)) : circles;
    return res.status(200).json({ circles: filtered });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const {
      id,
      name,
      contribution,
      memberCount,
      members,
      pendingInvites,
      currentRound,
      paidRounds,
      status,
      roundDeadline,
      createdAt,
      onChainId,
      chainId,
      memberAddresses,
      pendingAddresses,
      creatorAddress,
      creatorHandle,
      roundPeriodSec,
    } = body;

    if (!name || contribution == null || !Array.isArray(members)) {
      return res.status(400).json({ error: 'name, contribution, members required' });
    }

    const circles = (await storeGet<SharedCircle[]>(KEYS.circles)) ?? [];
    const circleId = id ? String(id) : crypto.randomUUID().slice(0, 8);
    const chainKey = onChainId != null ? Number(onChainId) : null;

    const existing =
      circles.find((c) => c.id === circleId) ??
      (chainKey != null ? circles.find((c) => c.onChainId === chainKey) : undefined);

    const incoming: SharedCircle = {
      id: existing?.id ?? circleId,
      name: String(name),
      contribution: Number(contribution),
      memberCount: memberCount != null ? Number(memberCount) : members.length,
      members: uniqHandles(members.map(String)),
      pendingInvites: Array.isArray(pendingInvites)
        ? uniqHandles(pendingInvites.map(String))
        : existing?.pendingInvites ?? [],
      currentRound: currentRound != null ? Number(currentRound) : existing?.currentRound ?? 0,
      paidRounds: paidRounds != null ? Number(paidRounds) : existing?.paidRounds ?? 0,
      status: (status as SharedCircle['status']) ?? existing?.status ?? 'forming',
      roundDeadline:
        roundDeadline != null ? Number(roundDeadline) : existing?.roundDeadline,
      createdAt: existing?.createdAt ?? (createdAt ? Number(createdAt) : Date.now()),
      onChainId: chainKey ?? existing?.onChainId ?? null,
      chainId: chainId != null ? Number(chainId) : existing?.chainId ?? null,
      memberAddresses: Array.isArray(memberAddresses)
        ? memberAddresses.map(String)
        : existing?.memberAddresses,
      pendingAddresses: Array.isArray(pendingAddresses)
        ? pendingAddresses.map(String)
        : existing?.pendingAddresses,
      creatorAddress: creatorAddress ? String(creatorAddress) : existing?.creatorAddress ?? null,
      creatorHandle: creatorHandle ? String(creatorHandle) : existing?.creatorHandle ?? null,
      roundPeriodSec:
        roundPeriodSec != null ? Number(roundPeriodSec) : existing?.roundPeriodSec,
    };

    const merged = mergeCircle(existing, incoming);
    const next = [merged, ...circles.filter((c) => c.id !== merged.id)].slice(0, 500);
    // Drop duplicate onChainId rows kept under other ids.
    const deduped =
      merged.onChainId != null
        ? next.filter(
            (c) => c.id === merged.id || c.onChainId !== merged.onChainId,
          )
        : next;

    await storeSet(KEYS.circles, deduped);
    return res.status(existing ? 200 : 201).json({ circle: merged });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const { id, onChainId } = body;
    if (!id && onChainId == null) {
      return res.status(400).json({ error: 'id or onChainId required' });
    }

    const circles = (await storeGet<SharedCircle[]>(KEYS.circles)) ?? [];
    const idx = circles.findIndex(
      (c) =>
        (id && c.id === String(id)) ||
        (onChainId != null && c.onChainId === Number(onChainId)),
    );
    if (idx < 0) return res.status(404).json({ error: 'Circle not found' });

    const cur = circles[idx];
    const updated: SharedCircle = {
      ...cur,
      name: body.name != null ? String(body.name) : cur.name,
      members: Array.isArray(body.members) ? uniqHandles(body.members.map(String)) : cur.members,
      pendingInvites: Array.isArray(body.pendingInvites)
        ? uniqHandles(body.pendingInvites.map(String))
        : cur.pendingInvites,
      memberCount: body.memberCount != null ? Number(body.memberCount) : cur.memberCount,
      currentRound: body.currentRound != null ? Number(body.currentRound) : cur.currentRound,
      paidRounds: body.paidRounds != null ? Number(body.paidRounds) : cur.paidRounds,
      status: (body.status as SharedCircle['status']) ?? cur.status,
      roundDeadline: body.roundDeadline != null ? Number(body.roundDeadline) : cur.roundDeadline,
      memberAddresses: Array.isArray(body.memberAddresses)
        ? body.memberAddresses.map(String)
        : cur.memberAddresses,
      pendingAddresses: Array.isArray(body.pendingAddresses)
        ? body.pendingAddresses.map(String)
        : cur.pendingAddresses,
    };
    if (Array.isArray(body.members) || Array.isArray(body.pendingInvites)) {
      updated.pendingInvites = (updated.pendingInvites ?? []).filter(
        (h) => !updated.members.some((m) => norm(m) === norm(h)),
      );
      updated.memberCount = Math.max(updated.memberCount, updated.members.length);
    }

    const next = [...circles];
    next[idx] = updated;
    await storeSet(KEYS.circles, next);
    return res.status(200).json({ circle: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
