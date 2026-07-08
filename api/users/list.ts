import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { PayGramUser } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
    return res.status(200).json({ users });
  } catch (err) {
    console.error('list failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
