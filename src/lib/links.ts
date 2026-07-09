const BOT = import.meta.env.VITE_BOT_USERNAME || 'PayGramBot';
const APP_URL = import.meta.env.VITE_MINI_APP_URL || window.location.origin;

export function tipLink(username: string, amount = 5): string {
  return `https://t.me/${BOT}?startapp=pay_${amount}_${username}`;
}

export function payLink(username: string, amount: number): string {
  return `https://t.me/${BOT}?startapp=pay_${amount}_${username}`;
}

export function giftLink(giftId: string, amount: number): string {
  return `https://t.me/${BOT}?startapp=gift_${amount}_${giftId}`;
}

export function potLink(potId: string): string {
  return `https://t.me/${BOT}?startapp=pot_${potId}`;
}

export function inviteLink(): string {
  return `https://t.me/${BOT}`;
}

export function webPayLink(username: string, amount: number): string {
  return `${APP_URL}/?pay=${amount}&to=${username}`;
}

export function parseStartParam(param: string | null): {
  type: 'pay' | 'gift' | 'pot';
  amount?: number;
  target?: string;
} | null {
  if (!param) return null;
  if (param.startsWith('pay_')) {
    const [, amount, target] = param.split('_');
    return { type: 'pay', amount: parseFloat(amount), target };
  }
  if (param.startsWith('gift_')) {
    const [, amount, giftId] = param.split('_');
    return { type: 'gift', amount: parseFloat(amount), target: giftId };
  }
  if (param.startsWith('pot_')) {
    return { type: 'pot', target: param.replace('pot_', '') };
  }
  return null;
}
