import type { PaymentRequest } from './storage';
import { normalizeHandle } from './constants';
import { outstandingUsd, tabPartyEq, type TabDebt } from './tabs';

export type NetSummary = {
  owedToYou: number;
  youOwe: number;
  net: number;
};

export function computeNetSummary(
  requests: PaymentRequest[],
  myHandle: string | null,
  tabs: TabDebt[] = [],
): NetSummary {
  if (!myHandle) return { owedToYou: 0, youOwe: 0, net: 0 };
  const handle = normalizeHandle(myHandle);
  let owedToYou = 0;
  let youOwe = 0;

  for (const r of requests) {
    if (r.status !== 'pending') continue;
    if (normalizeHandle(r.fromUser) === handle) owedToYou += r.amount;
    if (normalizeHandle(r.toUser) === handle) youOwe += r.amount;
  }

  for (const d of tabs) {
    if (d.closed) continue;
    const left = outstandingUsd(d);
    if (left <= 0) continue;
    if (tabPartyEq(d.lender, handle)) owedToYou += left;
    if (tabPartyEq(d.borrower, handle)) youOwe += left;
  }

  return { owedToYou, youOwe, net: owedToYou - youOwe };
}
