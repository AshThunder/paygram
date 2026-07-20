import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  KEYS,
  storeGet,
  storeSetRequired,
  isStoreConfigured,
  claimUsernameAtomic,
  releaseUsernameClaim,
} from './_lib/store.js';
import { setCors } from './_lib/cors.js';
import type { PayGramUser } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      if (!isStoreConfigured()) {
        return res.status(503).json({
          error: 'Username registry unavailable — Redis/KV not configured',
        });
      }

      const handle = String(req.query.handle ?? '')
        .replace('@', '')
        .toLowerCase()
        .trim();
      const wallet = String(req.query.wallet ?? '')
        .toLowerCase()
        .trim();

      const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];

      if (wallet && /^0x[a-f0-9]{40}$/.test(wallet)) {
        const user = users.find((u) => u.walletAddress.toLowerCase() === wallet);
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json({ user });
      }

      if (handle) {
        const user = users.find((u) => u.username?.toLowerCase() === handle);
        if (user) return res.status(200).json({ user });

        // Fallback: atomic claim key may exist even if list is stale.
        const { getUsernameOwner } = await import('./_lib/store.js');
        const owner = await getUsernameOwner(handle);
        if (owner) {
          return res.status(200).json({
            user: {
              id: owner.slice(2, 10),
              username: handle,
              displayName: handle,
              walletAddress: owner,
              createdAt: 0,
            } satisfies PayGramUser,
          });
        }
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      if (!isStoreConfigured()) {
        return res.status(503).json({
          error: 'Username registry unavailable — Redis/KV not configured',
        });
      }

      const { telegramId, username, displayName, walletAddress, email, friends } = req.body ?? {};
      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'walletAddress required' });
      }

      const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
      const handle = username ? String(username).replace('@', '').toLowerCase().trim() : null;
      const walletLc = String(walletAddress).toLowerCase();
      const existing = users.find((u) => u.walletAddress.toLowerCase() === walletLc);

      if (handle) {
        if (!/^[a-z0-9_]{3,32}$/.test(handle)) {
          return res.status(400).json({ error: 'Invalid username format' });
        }

        // Atomic claim so concurrent requests can't both take the same handle.
        const claimed = await claimUsernameAtomic(handle, walletAddress);
        if (!claimed) {
          return res.status(409).json({ error: `@${handle} is already taken` });
        }

        // If this wallet is renaming, free the old handle.
        if (existing?.username && existing.username.toLowerCase() !== handle) {
          await releaseUsernameClaim(existing.username, walletAddress);
        }
      }

      let nextFriends = existing?.friends;
      if (Array.isArray(friends)) {
        nextFriends = [
          ...new Set(
            friends
              .map((f) => String(f).replace(/^@/, '').toLowerCase().trim())
              .filter((f) => /^[a-z0-9_]{3,32}$/.test(f)),
          ),
        ].slice(0, 100);
      }

      const user: PayGramUser = {
        id: existing?.id ?? String(telegramId ?? walletAddress.slice(2, 10)),
        telegramId: telegramId ? String(telegramId) : existing?.telegramId,
        username: handle ?? existing?.username ?? null,
        displayName: displayName
          ? String(displayName)
          : handle ?? existing?.displayName ?? 'PayGram User',
        walletAddress,
        email: email ? String(email).toLowerCase() : existing?.email,
        friends: nextFriends,
        createdAt: existing?.createdAt ?? Date.now(),
      };

      const next = [
        user,
        ...users.filter((u) => u.walletAddress.toLowerCase() !== walletLc),
      ];
      await storeSetRequired(KEYS.users, next);
      return res.status(200).json({ user });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('user-registry failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
