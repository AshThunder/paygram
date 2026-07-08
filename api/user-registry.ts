import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { PayGramUser } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      const handle = String(req.query.handle ?? '').replace('@', '').toLowerCase();
      if (handle) {
        const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
        const user = users.find((u) => u.username?.toLowerCase() === handle);
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json({ user });
      }
      const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      const { telegramId, username, displayName, walletAddress } = req.body ?? {};
      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'walletAddress required' });
      }

      const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
      const handle = username ? String(username).replace('@', '').toLowerCase() : null;
      const existing = users.find(
        (u) => u.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
      );

      const user: PayGramUser = {
        id: existing?.id ?? String(telegramId ?? walletAddress.slice(2, 10)),
        username: handle,
        displayName: displayName ? String(displayName) : handle ?? 'PayGram User',
        walletAddress,
        createdAt: existing?.createdAt ?? Date.now(),
      };

      const next = [
        user,
        ...users.filter((u) => u.walletAddress.toLowerCase() !== walletAddress.toLowerCase()),
      ];
      await storeSet(KEYS.users, next);
      return res.status(200).json({ user });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('user-registry failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
