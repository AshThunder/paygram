import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { CollectionPot } from '../_lib/types.js';

function uid(): string {
  return `pot_${crypto.randomUUID().slice(0, 8)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const pots = (await storeGet<CollectionPot[]>(KEYS.pots)) ?? [];
    return res.status(200).json({ pots });
  }

  if (req.method === 'POST') {
    const { title, goal, creator } = req.body ?? {};
    if (!title || !goal || !creator) {
      return res.status(400).json({ error: 'title, goal, creator required' });
    }

    const pot: CollectionPot = {
      id: uid(),
      title: String(title),
      goal: Number(goal),
      collected: 0,
      creator: String(creator),
      createdAt: Date.now(),
    };

    const pots = (await storeGet<CollectionPot[]>(KEYS.pots)) ?? [];
    const next = [pot, ...pots];
    await storeSet(KEYS.pots, next);
    return res.status(201).json({ pot });
  }

  if (req.method === 'PATCH') {
    const { id, collected, contributor } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const pots = (await storeGet<CollectionPot[]>(KEYS.pots)) ?? [];
    const next = pots.map((p) => {
      if (p.id !== id) return p;
      const contributors = [...(p.contributors ?? [])];
      if (contributor?.user && contributor?.amount) {
        const existing = contributors.find((c) => c.user === contributor.user);
        if (existing) existing.amount += Number(contributor.amount);
        else contributors.push({ user: String(contributor.user), amount: Number(contributor.amount) });
      }
      return {
        ...p,
        collected: Number(collected ?? p.collected),
        contributors: contributors.sort((a, b) => b.amount - a.amount),
      };
    });
    await storeSet(KEYS.pots, next);
    const updated = next.find((p) => p.id === id);
    return res.status(200).json({ pot: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
