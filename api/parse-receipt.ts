import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from './_lib/cors.js';

const SYSTEM = `You read restaurant/store receipts and return ONLY valid JSON (no markdown).
Extract the total amount in USD (or convert if only one currency shown).
If line items are visible, include them.
If you see a party size hint, use it for per-person split suggestions.

Schema:
{
  "total": number,
  "merchant": string | null,
  "items": [{"name": string, "amount": number}] | null,
  "suggestedSplitCount": number | null,
  "note": string | null
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'OCR not configured — set OPENAI_API_KEY' });

  const { imageBase64, mimeType } = req.body ?? {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  const mediaType = typeof mimeType === 'string' ? mimeType : 'image/jpeg';
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Parse this receipt for a bill split in PayGram.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Vision API request failed' });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: 'Empty OCR response' });

    const parsed = JSON.parse(content) as {
      total: number;
      merchant?: string | null;
      items?: Array<{ name: string; amount: number }> | null;
      suggestedSplitCount?: number | null;
      note?: string | null;
    };

    if (!parsed.total || parsed.total <= 0) {
      return res.status(422).json({ error: 'Could not read a total from the receipt' });
    }

    return res.status(200).json({ receipt: parsed });
  } catch (err) {
    console.error('parse-receipt failed', err);
    return res.status(500).json({ error: 'Failed to parse receipt' });
  }
}
