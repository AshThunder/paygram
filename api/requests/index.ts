import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store';
import { setCors } from '../_lib/cors';
import type { PaymentRequest } from '../_lib/types';

function uid(): string {
  return crypto.randomUUID();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const requests = (await storeGet<PaymentRequest[]>(KEYS.requests)) ?? [];
    const forUser = req.query.for ? String(req.query.for).toLowerCase() : null;
    const filtered = forUser
      ? requests.filter((r) => r.toUser.toLowerCase() === forUser || r.fromUser.toLowerCase() === forUser)
      : requests;
    return res.status(200).json({ requests: filtered });
  }

  if (req.method === 'POST') {
    const { fromUser, toUser, amount, note } = req.body ?? {};
    if (!fromUser || !toUser || !amount) {
      return res.status(400).json({ error: 'fromUser, toUser, amount required' });
    }

    const req_: PaymentRequest = {
      id: uid(),
      fromUser: String(fromUser),
      toUser: String(toUser),
      amount: Number(amount),
      note: note ? String(note) : undefined,
      status: 'pending',
      createdAt: Date.now(),
    };

    const requests = (await storeGet<PaymentRequest[]>(KEYS.requests)) ?? [];
    const next = [req_, ...requests];
    await storeSet(KEYS.requests, next);
    return res.status(201).json({ request: req_ });
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const requests = (await storeGet<PaymentRequest[]>(KEYS.requests)) ?? [];
    const next = requests.map((r) =>
      r.id === id ? { ...r, status: (status as PaymentRequest['status']) ?? 'paid' } : r,
    );
    await storeSet(KEYS.requests, next);
    const updated = next.find((r) => r.id === id);
    return res.status(200).json({ request: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
