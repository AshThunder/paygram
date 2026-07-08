import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store';
import { setCors } from '../_lib/cors';
import type { PayGramUser } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  } catch (err) {
    console.error('register failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
