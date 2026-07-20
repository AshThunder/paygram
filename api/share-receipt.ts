import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from './_lib/cors.js';
import { telegramApi } from './_lib/telegramBot.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ error: 'Bot not configured' });

  const { chatId, text, imageBase64 } = req.body ?? {};
  if (!chatId) return res.status(400).json({ error: 'chatId required' });

  try {
    if (imageBase64 && typeof imageBase64 === 'string') {
      const bytes = Buffer.from(imageBase64, 'base64');
      const body = new FormData();
      body.append('chat_id', String(chatId));
      if (text) body.append('caption', String(text).slice(0, 1024));
      body.append('photo', new Blob([bytes], { type: 'image/png' }), 'receipt.png');

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body,
      });
      const data = (await tgRes.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        return res.status(502).json({ error: data.description ?? 'sendPhoto failed' });
      }
      return res.status(200).json({ ok: true });
    }

    if (!text) return res.status(400).json({ error: 'text or imageBase64 required' });

    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: String(text).slice(0, 4096),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('share-receipt failed', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to share receipt',
    });
  }
}
