const BOT = import.meta.env.VITE_BOT_USERNAME || 'PayGramBot';
const APP_URL = import.meta.env.VITE_MINI_APP_URL || window.location.origin;

export function tipLink(username: string, amount = 5): string {
  return `https://t.me/${BOT}?startapp=pay_${amount}_${username}`;
}

export function requestLink(fromUsername: string, amount: number, note?: string): string {
  const base = `https://t.me/${BOT}?startapp=request_${amount}_${fromUsername.replace(/^@/, '')}`;
  return note ? `${base}_${encodeURIComponent(note)}` : base;
}

export function payLink(username: string, amount: number): string {
  return `https://t.me/${BOT}?startapp=pay_${amount}_${username}`;
}


export function potLink(potId: string): string {
  return `https://t.me/${BOT}?startapp=pot_${potId}`;
}

export function circleInviteLink(onChainCircleId: number): string {
  return `https://t.me/${BOT}?startapp=circle_${onChainCircleId}`;
}

export function inviteLink(): string {
  return `https://t.me/${BOT}`;
}

export function webPayLink(username: string, amount: number): string {
  return `${APP_URL}/checkout?pay=${amount}&to=${username}`;
}

export function merchantCheckoutLink(username: string, amount: number, note?: string): string {
  const params = new URLSearchParams({
    pay: String(amount),
    to: username,
    merchant: '1',
  });
  if (note) params.set('note', note);
  return `${APP_URL}/checkout?${params.toString()}`;
}

export function parseWebPayParams(search: string): { amount: number; to: string; note?: string; merchant?: boolean } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const pay = params.get('pay');
  const to = params.get('to');
  if (!pay || !to) return null;
  return {
    amount: parseFloat(pay),
    to,
    note: params.get('note') ?? undefined,
    merchant: params.get('merchant') === '1',
  };
}

export function parseStartParam(param: string | null): {
  type: 'pay' | 'pot' | 'request' | 'split' | 'circle';
  amount?: number;
  target?: string;
  targets?: string[];
  note?: string;
} | null {
  if (!param) return null;
  if (param.startsWith('pay_')) {
    const [, amount, target] = param.split('_');
    if (amount === '0') return null;
    return { type: 'pay', amount: parseFloat(amount), target };
  }
  if (param.startsWith('request_')) {
    const rest = param.replace('request_', '');
    const parts = rest.split('_');
    const amount = parseFloat(parts[0]);
    const target = parts[1];
    if (parts[0] === '0' || !target) return null;
    const note = parts.length > 2 ? decodeURIComponent(parts.slice(2).join('_')) : undefined;
    return { type: 'request', amount, target, note };
  }
  if (param.startsWith('split_')) {
    const match = param.match(/^split_([\d.]+)_(.+)$/);
    if (!match || match[1] === '0') return null;
    return {
      type: 'split',
      amount: parseFloat(match[1]),
      targets: match[2].split('-').filter(Boolean).map((t) => `@${t}`),
    };
  }
  if (param.startsWith('pot_')) {
    return { type: 'pot', target: param.replace('pot_', '') };
  }
  if (param.startsWith('circle_')) {
    const id = param.replace('circle_', '');
    if (!id || Number.isNaN(Number(id))) return null;
    return { type: 'circle', target: id };
  }
  return null;
}
