import type { VercelRequest, VercelResponse } from '@vercel/node';
import { KEYS, storeGet } from './_lib/store.js';
import { setCors } from './_lib/cors.js';
import type { PayGramUser } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ error: 'Bot not configured' });

  const { targetUsername, amount, fromUser, note } = req.body ?? {};
  if (!targetUsername) return res.status(400).json({ error: 'targetUsername required' });

  const handle = String(targetUsername).replace('@', '').toLowerCase();
  const users = (await storeGet<PayGramUser[]>(KEYS.users)) ?? [];
  const user = users.find((u) => u.username?.toLowerCase() === handle);
  if (!user?.telegramId) {
    return res.status(404).json({ error: 'User not found or no Telegram ID' });
  }

  const botUsername = process.env.VITE_BOT_USERNAME || 'paygram_bbot';
  const miniAppUrl = process.env.VITE_MINI_APP_URL || 'https://paygram-rust.vercel.app';
  const payUrl = `https://t.me/${botUsername}?startapp=pay_${amount ?? 0}_${handle}`;

  const text = [
    `💸 Payment reminder from ${fromUser ?? 'someone'}`,
    amount ? `Amount: $${Number(amount).toFixed(2)}` : null,
    note ? `Note: ${note}` : null,
    '',
    `Tap to pay in PayGram:`,
    payUrl,
  ]
    .filter(Boolean)
    .join('\n');

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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

  const tgData = (await tgRes.json()) as { ok?: boolean; description?: string };
  if (!tgData.ok) {
    return res.status(502).json({ error: tgData.description ?? 'Telegram send failed' });
  }

  return res.status(200).json({ ok: true });
}
