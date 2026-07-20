import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet, storeSet } from '../_lib/store.js';
import { setCors } from '../_lib/cors.js';
import type { PayGramUser, SharedActivity } from '../_lib/types.js';

function uid(): string {
  return crypto.randomUUID();
}

function norm(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

async function notifyReceived(activity: SharedActivity): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const handle = norm(activity.toUser);
  const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
  const user = users.find((u) => u.username && norm(u.username) === handle);
  if (!user?.telegramId) return;

  const miniAppUrl = process.env.VITE_MINI_APP_URL || 'https://paygram-rust.vercel.app';
  const from = activity.fromUser.startsWith('@') ? activity.fromUser : `@${activity.fromUser}`;
  const text = [
    `💸 You received $${Number(activity.amount).toFixed(2)} from ${from}`,
    activity.note ? `Note: ${activity.note}` : null,
    '',
    'Open PayGram → Activity to see it.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: 'Open PayGram', web_app: { url: miniAppUrl } }]],
        },
      }),
    });
  } catch (err) {
    console.error('activity notify failed:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const activities = (await storeGet<SharedActivity[]>(KEYS.activity)) ?? [];
    const forUser = req.query.for ? norm(String(req.query.for)) : null;
    const filtered = forUser
      ? activities.filter(
          (a) => norm(a.fromUser) === forUser || norm(a.toUser) === forUser,
        )
      : activities;
    return res.status(200).json({ activities: filtered });
  }

  if (req.method === 'POST') {
    const { fromUser, toUser, amount, type, note, txId, status } = req.body ?? {};
    if (!fromUser || !toUser || amount == null) {
      return res.status(400).json({ error: 'fromUser, toUser, amount required' });
    }

    const activities = (await storeGet<SharedActivity[]>(KEYS.activity)) ?? [];

    // Dedupe by txId when re-posted
    if (txId) {
      const existing = activities.find((a) => a.txId === String(txId));
      if (existing) {
        return res.status(200).json({ activity: existing });
      }
    }

    const activity: SharedActivity = {
      id: uid(),
      type: String(type ?? 'send'),
      fromUser: String(fromUser),
      toUser: String(toUser),
      amount: Number(amount),
      note: note ? String(note) : undefined,
      txId: txId ? String(txId) : undefined,
      status: String(status ?? 'pending'),
      createdAt: Date.now(),
    };

    const next = [activity, ...activities].slice(0, 500);
    await storeSet(KEYS.activity, next);
    void notifyReceived(activity);
    return res.status(201).json({ activity });
  }

  if (req.method === 'PATCH') {
    const { id, txId, status } = req.body ?? {};
    if (!id && !txId) return res.status(400).json({ error: 'id or txId required' });
    if (!status) return res.status(400).json({ error: 'status required' });

    const activities = (await storeGet<SharedActivity[]>(KEYS.activity)) ?? [];
    const next = activities.map((a) =>
      (id && a.id === id) || (txId && a.txId === txId)
        ? { ...a, status: String(status) }
        : a,
    );
    await storeSet(KEYS.activity, next);
    const updated = next.find(
      (a) => (id && a.id === id) || (txId && a.txId === txId),
    );
    return res.status(200).json({ activity: updated ?? null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
