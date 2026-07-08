import type { Intent } from './intents';
import { intentSchema } from './intents';
import { isAddress, normalizeHandle } from './constants';

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  twentyfive: 25, thirty: 30, fifty: 50, hundred: 100,
};

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/\$/g, '').trim().toLowerCase();
  if (!cleaned) return null;

  const numeric = parseFloat(cleaned);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;

  const words = cleaned.replace(/-/g, '').replace(/\s+/g, '');
  if (WORD_NUMBERS[words] !== undefined) return WORD_NUMBERS[words];

  const twentyFive = cleaned.match(/twenty\s*five/);
  if (twentyFive) return 25;

  return null;
}

function extractAmount(text: string): { amount: number | null; rest: string } {
  const dollarMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?)/i);
  if (dollarMatch) {
    const amount = parseAmount(dollarMatch[1]);
    return { amount, rest: text.replace(dollarMatch[0], ' ').trim() };
  }

  const trailingNumber = text.match(/([\d,]+(?:\.\d+)?)\s*(?:dollars?|usd)?/i);
  if (trailingNumber) {
    const amount = parseAmount(trailingNumber[1]);
    return { amount, rest: text.replace(trailingNumber[0], ' ').trim() };
  }

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(text)) {
      return { amount: value, rest: text.replace(re, ' ').trim() };
    }
  }

  return { amount: null, rest: text };
}

function extractHandles(text: string): string[] {
  const handles = [...text.matchAll(/@([a-zA-Z0-9_]{3,})/g)].map((m) => `@${m[1]}`);
  if (handles.length > 0) return handles;

  const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
  if (addressMatch) return [addressMatch[1]];

  return [];
}

function extractNote(text: string, keyword: string): string | undefined {
  const re = new RegExp(`${keyword}\\s+(.+)$`, 'i');
  const match = text.match(re);
  if (match) return match[1].trim();
  const forMatch = text.match(/\bfor\s+(.+)$/i);
  return forMatch?.[1]?.trim();
}

export function parseIntent(input: string): Intent {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { type: 'unknown', raw: input };
  }

  if (/^(balance|how much|what.?s my balance)/i.test(lower)) {
    return intentSchema.parse({ type: 'balance' });
  }

  if (/^(tip|tips)\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const handles = extractHandles(rest);
    if (amount && handles[0]) {
      return intentSchema.parse({
        type: 'tip',
        amount,
        recipient: handles[0],
        note: extractNote(text, 'for'),
      });
    }
  }

  if (/^(send|pay|transfer)\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const handles = extractHandles(rest);
    const toMatch = rest.match(/\bto\s+(@?[a-zA-Z0-9_]+|0x[a-fA-F0-9]{40})/i);
    const recipient = handles[0] || (toMatch ? (toMatch[1].startsWith('@') || isAddress(toMatch[1]) ? toMatch[1] : `@${toMatch[1]}`) : null);
    if (amount && recipient) {
      return intentSchema.parse({
        type: 'send',
        amount,
        currency: 'USD',
        recipient: recipient.startsWith('@') || isAddress(recipient) ? recipient : `@${recipient}`,
        note: extractNote(text, 'for'),
      });
    }
  }

  if (/^(request|ask)\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const fromMatch = rest.match(/\bfrom\s+(@[a-zA-Z0-9_]+)/i);
    const handles = extractHandles(rest);
    const from = fromMatch?.[1] || handles[0];
    if (amount && from) {
      return intentSchema.parse({
        type: 'request',
        amount,
        from,
        note: extractNote(text, 'for'),
      });
    }
  }

  if (/^split\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const handles = extractHandles(rest);
    if (amount && handles.length > 0) {
      return intentSchema.parse({
        type: 'split',
        total: amount,
        recipients: handles,
        note: extractNote(text, 'for'),
      });
    }
  }

  if (/^(collect|raise)\b/i.test(lower)) {
    const { amount } = extractAmount(text);
    const forMatch = text.match(/\bfor\s+(.+)$/i);
    if (amount) {
      return intentSchema.parse({
        type: 'collect',
        goal: amount,
        title: forMatch?.[1]?.trim() || 'Collection',
      });
    }
  }

  if (/^(create\s+)?gift\b/i.test(lower)) {
    const { amount } = extractAmount(lower);
    if (amount) {
      return intentSchema.parse({ type: 'gift', amount });
    }
  }

  if (/^remind\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const handles = extractHandles(rest);
    const aboutMatch = rest.match(/@([a-zA-Z0-9_]+)/);
    const target = handles[0] || (aboutMatch ? `@${aboutMatch[1]}` : null);
    if (target) {
      return intentSchema.parse({
        type: 'remind',
        target,
        amount: amount ?? undefined,
      });
    }
  }

  if (/^contribute\b/i.test(lower)) {
    const { amount, rest } = extractAmount(lower);
    const potMatch = rest.match(/\bto\s+(pot_[a-z0-9_]+)/i);
    if (amount && potMatch) {
      return intentSchema.parse({
        type: 'contribute',
        amount,
        potId: potMatch[1],
      });
    }
  }

  return { type: 'unknown', raw: input };
}

export async function resolveRecipient(recipient: string): Promise<string | null> {
  if (isAddress(recipient)) return recipient;

  const handle = normalizeHandle(recipient);
  const registry = getUserRegistry();
  const local = registry[handle];
  if (local) return local;

  const { resolveUserApi } = await import('./api');
  const remote = await resolveUserApi(handle);
  if (remote) return remote;

  const demo = import.meta.env.VITE_DEMO_RECIPIENT_ADDRESS;
  return demo && demo !== '0x' ? demo : null;
}

export type UserRegistry = Record<string, string>;

export function getUserRegistry(): UserRegistry {
  try {
    const raw = localStorage.getItem('paygram_registry');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function registerUser(handle: string, address: string): void {
  const registry = getUserRegistry();
  registry[normalizeHandle(handle)] = address;
  localStorage.setItem('paygram_registry', JSON.stringify(registry));
}

export function registerSelf(username: string | undefined, address: string): void {
  if (username) {
    registerUser(username, address);
  }
}
