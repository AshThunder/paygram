import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet } from '../_lib/store';
import { setCors } from '../_lib/cors';
import type { PayGramUser } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const handle = String(req.query.handle ?? '').replace('@', '').toLowerCase();
    if (!handle) return res.status(400).json({ error: 'handle required' });

    const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
    const user = users.find((u) => u.username?.toLowerCase() === handle);

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (err) {
    console.error('resolve failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
