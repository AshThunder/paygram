import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { SharedTabDebt } from '../_lib/types.js';

function norm(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const tabs = (await storeGet<SharedTabDebt[]>(KEYS.tabs)) ?? [];
    const forUser = req.query.for ? norm(String(req.query.for)) : null;
    const filtered = forUser
      ? tabs.filter(
          (t) => norm(t.lender) === forUser || norm(t.borrower) === forUser,
        )
      : tabs;
    return res.status(200).json({ tabs: filtered });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const {
      id,
      lender,
      borrower,
      lenderAddress,
      borrowerAddress,
      principal,
      repaid,
      dueAt,
      note,
      closed,
      onChainId,
      chainId,
      fundTxId,
      createdAt,
    } = body;

    if (!lender || !borrower || principal == null || !lenderAddress || !borrowerAddress) {
      return res.status(400).json({
        error: 'lender, borrower, principal, lenderAddress, borrowerAddress required',
      });
    }

    const tabs = (await storeGet<SharedTabDebt[]>(KEYS.tabs)) ?? [];
    const debtId = id ? String(id) : crypto.randomUUID().slice(0, 8);

    const existing = tabs.find((t) => t.id === debtId);
    const debt: SharedTabDebt = {
      id: debtId,
      onChainId: onChainId != null ? Number(onChainId) : existing?.onChainId ?? null,
      chainId: chainId != null ? Number(chainId) : existing?.chainId ?? null,
      lender: String(lender),
      borrower: String(borrower),
      lenderAddress: String(lenderAddress),
      borrowerAddress: String(borrowerAddress),
      principal: Number(principal),
      repaid: repaid != null ? Number(repaid) : existing?.repaid ?? 0,
      dueAt: dueAt === null || dueAt === undefined ? null : Number(dueAt),
      note: note ? String(note) : existing?.note,
      closed: Boolean(closed ?? existing?.closed ?? false),
      fundTxId: fundTxId ? String(fundTxId) : existing?.fundTxId,
      createdAt: existing?.createdAt ?? (createdAt ? Number(createdAt) : Date.now()),
    };

    const next = [debt, ...tabs.filter((t) => t.id !== debtId)].slice(0, 500);
    await storeSet(KEYS.tabs, next);
    return res.status(existing ? 200 : 201).json({ tab: debt });
  }

  if (req.method === 'PATCH') {
    const { id, repaid, closed, fundTxId } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const tabs = (await storeGet<SharedTabDebt[]>(KEYS.tabs)) ?? [];
    const next = tabs.map((t) => {
      if (t.id !== String(id)) return t;
      return {
        ...t,
        repaid: repaid != null ? Number(repaid) : t.repaid,
        closed: closed != null ? Boolean(closed) : t.closed,
        fundTxId: fundTxId ? String(fundTxId) : t.fundTxId,
      };
    });
    await storeSet(KEYS.tabs, next);
    const updated = next.find((t) => t.id === String(id));
    return res.status(200).json({ tab: updated ?? null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
