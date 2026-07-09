export type RecurringTip = {
  id: string;
  recipient: string;
  amount: number;
  intervalDays: number;
  lastRemindedAt: number;
  createdAt: number;
};

const KEY = 'paygram_recurring_tips';

export function loadRecurringTips(): RecurringTip[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecurringTips(tips: RecurringTip[]): void {
  localStorage.setItem(KEY, JSON.stringify(tips));
}

export function addRecurringTip(recipient: string, amount: number, intervalDays = 7): RecurringTip {
  const tip: RecurringTip = {
    id: crypto.randomUUID(),
    recipient,
    amount,
    intervalDays,
    lastRemindedAt: Date.now(),
    createdAt: Date.now(),
  };
  const next = [tip, ...loadRecurringTips()];
  saveRecurringTips(next);
  return tip;
}

export function dueRecurringTips(): RecurringTip[] {
  const now = Date.now();
  return loadRecurringTips().filter((t) => {
    const elapsed = now - t.lastRemindedAt;
    return elapsed >= t.intervalDays * 24 * 60 * 60 * 1000;
  });
}

export function markRecurringTipReminded(id: string): void {
  const next = loadRecurringTips().map((t) =>
    t.id === id ? { ...t, lastRemindedAt: Date.now() } : t,
  );
  saveRecurringTips(next);
}
