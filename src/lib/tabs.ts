import { normalizeHandle } from './constants';

export type TabDebt = {
  id: string;
  /** On-chain PayGramTab debt id when VITE_TAB is set. */
  onChainId?: number | null;
  chainId?: number | null;
  lender: string;
  borrower: string;
  lenderAddress: string;
  borrowerAddress: string;
  principal: number;
  repaid: number;
  /** Unix ms due date, or null if none. */
  dueAt: number | null;
  note?: string;
  closed: boolean;
  fundTxId?: string | null;
  createdAt: number;
};

const KEY = 'paygram_tabs';

function load(): TabDebt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TabDebt[]) : [];
  } catch {
    return [];
  }
}

function save(debts: TabDebt[]): void {
  localStorage.setItem(KEY, JSON.stringify(debts));
}

export function loadTabs(): TabDebt[] {
  return load();
}

export function saveTabs(debts: TabDebt[]): void {
  save(debts);
}

export function upsertTab(debt: TabDebt): TabDebt[] {
  const next = [debt, ...load().filter((d) => d.id !== debt.id)];
  save(next);
  return next;
}

export function patchTab(id: string, patch: Partial<TabDebt>): TabDebt | null {
  const list = load();
  const cur = list.find((d) => d.id === id);
  if (!cur) return null;
  const updated = { ...cur, ...patch };
  save(list.map((d) => (d.id === id ? updated : d)));
  return updated;
}

export function outstandingUsd(d: TabDebt): number {
  if (d.closed) return 0;
  return Math.max(0, Math.round((d.principal - d.repaid) * 100) / 100);
}

export function tabPartyEq(a: string, b: string): boolean {
  return normalizeHandle(a) === normalizeHandle(b);
}

export function isOpenTab(d: TabDebt): boolean {
  return !d.closed && outstandingUsd(d) > 0;
}

export function uidTab(): string {
  return crypto.randomUUID().slice(0, 8);
}
