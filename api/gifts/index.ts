import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store';
import { setCors } from '../_lib/cors';
import type { GiftLink } from '../_lib/types';

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const id = req.query.id ? String(req.query.id) : null;
    const gifts = (await storeGet<GiftLink[]>(KEYS.gifts)) ?? [];
    if (id) {
      const gift = gifts.find((g) => g.id === id);
      if (!gift) return res.status(404).json({ error: 'Gift not found' });
      return res.status(200).json({ gift });
    }
    return res.status(200).json({ gifts });
  }

  if (req.method === 'POST') {
    const { amount, creator, creatorAddress } = req.body ?? {};
    if (!amount || !creator || !creatorAddress) {
      return res.status(400).json({ error: 'amount, creator, creatorAddress required' });
    }

    const gift: GiftLink = {
      id: uid(),
      amount: Number(amount),
      creator: String(creator),
      creatorAddress: String(creatorAddress),
      claimed: false,
      createdAt: Date.now(),
    };

    const gifts = (await storeGet<GiftLink[]>(KEYS.gifts)) ?? [];
    await storeSet(KEYS.gifts, [gift, ...gifts]);
    return res.status(201).json({ gift });
  }

  if (req.method === 'PATCH') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const gifts = (await storeGet<GiftLink[]>(KEYS.gifts)) ?? [];
    const next = gifts.map((g) => (g.id === id ? { ...g, claimed: true } : g));
    await storeSet(KEYS.gifts, next);
    const updated = next.find((g) => g.id === id);
    return res.status(200).json({ gift: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
