import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from './_lib/cors.js';

const SYSTEM = `You parse payment chat messages into JSON. Return ONLY valid JSON, no markdown.
Schema examples:
{"type":"send","amount":25,"currency":"USD","recipient":"@alice","note":"lunch"}
{"type":"tip","amount":5,"recipient":"@bob"}
{"type":"request","amount":30,"from":"@bob"}
{"type":"split","total":120,"recipients":["@a","@b"],"note":"dinner"}
{"type":"collect","goal":500,"title":"Bali trip"}
{"type":"balance"}
{"type":"swap","amount":50,"toToken":"SOL"}
{"type":"remind","target":"@bob","amount":30}
{"type":"unknown","raw":"..."}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'LLM not configured' });

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

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
          { role: 'user', content: text },
        ],
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'LLM request failed' });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: 'Empty LLM response' });

    const intent = JSON.parse(content) as Record<string, unknown>;
    return res.status(200).json({ intent });
  } catch {
    return res.status(500).json({ error: 'Failed to parse intent' });
  }
}
