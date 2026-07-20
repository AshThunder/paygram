export function botUsername(): string {
  return process.env.VITE_BOT_USERNAME || 'paygram_bbot';
}

export function miniAppUrl(): string {
  return process.env.VITE_MINI_APP_URL || 'https://paygram-rust.vercel.app';
}

/** Opens Mini App with startapp payload via t.me deep link. */
export function miniAppStartLink(startapp: string): string {
  return `https://t.me/${botUsername()}?startapp=${encodeURIComponent(startapp)}`;
}

export function parseCommandAmount(text: string): number | null {
  const match = text.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ''));
  return n > 0 ? n : null;
}

export function parseCommandHandles(text: string): string[] {
  return [...text.matchAll(/@([a-zA-Z0-9_]{3,})/g)].map((m) => m[1].toLowerCase());
}

export async function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }
  return data;
}
