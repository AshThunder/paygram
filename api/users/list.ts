import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet } from '../_lib/store';
import { setCors } from '../_lib/cors';
import type { PayGramUser } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
  return res.status(200).json({ users });
}
