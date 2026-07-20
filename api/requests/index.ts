import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { PaymentRequest } from '../_lib/types.js';

function uid(): string {
  return crypto.randomUUID();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const requests = (await storeGet<PaymentRequest[]>(KEYS.requests)) ?? [];
    const forUser = req.query.for
      ? String(req.query.for).replace(/^@/, '').toLowerCase()
      : null;
    const filtered = forUser
      ? requests.filter((r) => {
          const to = r.toUser.replace(/^@/, '').toLowerCase();
          const from = r.fromUser.replace(/^@/, '').toLowerCase();
          return to === forUser || from === forUser;
        })
      : requests;
    return res.status(200).json({ requests: filtered });
  }

  if (req.method === 'POST') {
    const { fromUser, toUser, amount, note, onChainBillId, chainId, payeeAddress } = req.body ?? {};
    if (!fromUser || !toUser || amount == null) {
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
      onChainBillId:
        onChainBillId != null && Number.isFinite(Number(onChainBillId))
          ? Number(onChainBillId)
          : undefined,
      chainId: chainId != null && Number.isFinite(Number(chainId)) ? Number(chainId) : undefined,
      payeeAddress: payeeAddress ? String(payeeAddress) : undefined,
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
