import type { PaymentRequest } from './storage';

export type NetSummary = {
  owedToYou: number;
  youOwe: number;
  net: number;
};

export function computeNetSummary(requests: PaymentRequest[], myHandle: string | null): NetSummary {
  if (!myHandle) return { owedToYou: 0, youOwe: 0, net: 0 };
  const handle = myHandle.toLowerCase();
  let owedToYou = 0;
  let youOwe = 0;

  for (const r of requests) {
    if (r.status !== 'pending') continue;
    if (r.fromUser.toLowerCase() === handle) owedToYou += r.amount;
    if (r.toUser.toLowerCase() === handle) youOwe += r.amount;
  }

  return { owedToYou, youOwe, net: owedToYou - youOwe };
}
