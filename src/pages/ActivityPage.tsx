import { useMemo, useState, useCallback, useEffect } from 'react';
import { usePayGram, userHandle } from '@/hooks/PayGramProvider';
import { useAuth } from '@/hooks/AuthProvider';
import { useNetStripDismiss } from '@/hooks/useNetStripDismiss';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { computeNetSummary } from '@/lib/activitySummary';
import { updateActivityStatus, type ActivityItem } from '@/lib/storage';
import { updateActivityApi } from '@/lib/api';
import { outstandingUsd, tabPartyEq, isOpenTab, type TabDebt } from '@/lib/tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { TxTracker } from '@/components/tx/TxTracker';
import { EmptyState, ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { TxStatus } from '@/lib/txTracker';
import { useNavigate } from 'react-router-dom';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { useToast } from '@/hooks/ToastProvider';
import type { PaymentRequest } from '@/lib/storage';

type View = 'open' | 'history';

type FeatureTab =
  | 'all'
  | 'send'
  | 'receive'
  | 'tip'
  | 'request'
  | 'split'
  | 'lend'
  | 'collect'
  | 'circles'
  | 'swap';

const FEATURE_TABS: { id: FeatureTab; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'send', label: 'Send', icon: 'send' },
  { id: 'receive', label: 'Receive', icon: 'south_west' },
  { id: 'tip', label: 'Tip', icon: 'volunteer_activism' },
  { id: 'request', label: 'Request', icon: 'request_quote' },
  { id: 'split', label: 'Split', icon: 'call_split' },
  { id: 'lend', label: 'Loans', icon: 'handshake' },
  { id: 'collect', label: 'Collect', icon: 'savings' },
  { id: 'circles', label: 'Circles', icon: 'donut_large' },
  { id: 'swap', label: 'Swap', icon: 'currency_exchange' },
];

const PRIMARY_FEATURES: FeatureTab[] = ['all', 'send', 'receive', 'tip', 'request'];
const MORE_FEATURES: FeatureTab[] = ['split', 'lend', 'collect', 'circles', 'swap'];

function featureMeta(id: FeatureTab) {
  return FEATURE_TABS.find((t) => t.id === id)!;
}

/** Money that came in — tips received, sends to you, loan principal, etc. */
function isReceiveActivity(a: ActivityItem): boolean {
  const t = a.type;
  if (/receive|tip_received|incoming|claim|borrow|repay_received/i.test(t)) return true;
  if (/remind|request|^split$/i.test(t)) return false;
  if (/send|tip|pay|lend|checkout|batch_pay|repay|forgive|swap|collect|contribute|pot_|circle/i.test(t)) {
    return false;
  }
  return Boolean(a.txId) && a.amount > 0 && !isOutbound(a);
}

function matchesFeature(a: ActivityItem, tab: FeatureTab): boolean {
  if (tab === 'all') return true;
  const t = a.type;
  switch (tab) {
    case 'send':
      return (
        /^(send|checkout|batch_pay)$/i.test(t) ||
        (/^pay$/i.test(t) && !/request/i.test(t))
      );
    case 'receive':
      return isReceiveActivity(a);
    case 'tip':
      return /^tip$/i.test(t);
    case 'request':
      return /request|remind/i.test(t);
    case 'split':
      return /split|bill/i.test(t);
    case 'lend':
      return /lend|forgive|^tab$/i.test(t) || /^repay$/i.test(t);
    case 'collect':
      return /collect|contribute|pot_/i.test(t);
    case 'circles':
      return /circle/i.test(t);
    case 'swap':
      return /swap/i.test(t);
    default:
      return true;
  }
}

function tabIdFromNote(note?: string): number | null {
  const m = note?.match(/tab #(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Don't repeat open-loan cards as lend history rows on the same screen. */
function hideLendDup(
  a: ActivityItem,
  openDebts: TabDebt[],
  view: View,
  feature: FeatureTab,
): boolean {
  if (view !== 'history') return false;
  if (feature !== 'all' && feature !== 'lend') return false;
  if (!/lend/i.test(a.type)) return false;
  const chainId = tabIdFromNote(a.note);
  if (chainId == null) return false;
  return openDebts.some((d) => d.onChainId === chainId && outstandingUsd(d) > 0);
}

function activityScore(item: ActivityItem): number {
  let s = 0;
  if (item.amount > 0) s += 4;
  if (item.note && item.note !== 'UniversalX') s += 2;
  if (item.counterparty) s += 1;
  if (/collect|contribute|pot_|allowance|request|send|tip|receive/i.test(item.type)) s += 1;
  return s;
}

function mergeActivity(local: ActivityItem[], chain: ActivityItem[]): ActivityItem[] {
  const byKey = new Map<string, ActivityItem>();

  const consider = (item: ActivityItem) => {
    const key = item.txId
      ? `tx:${item.txId}`
      : `local:${item.type}:${item.note ?? ''}:${item.amount}:${Math.floor(item.createdAt / 60_000)}`;
    const existing = byKey.get(key);
    if (!existing || activityScore(item) >= activityScore(existing)) {
      byKey.set(key, item);
    }
  };

  for (const item of local) consider(item);
  for (const item of chain) {
    if (item.txId && byKey.has(`tx:${item.txId}`)) {
      const existing = byKey.get(`tx:${item.txId}`)!;
      if (activityScore(item) > activityScore(existing)) byKey.set(`tx:${item.txId}`, item);
      continue;
    }
    if (item.amount === 0 && item.note === 'UniversalX') {
      const nearDup = [...byKey.values()].some(
        (l) =>
          l.amount > 0 &&
          /collect|contribute|pot_/i.test(l.type) &&
          Math.abs(l.createdAt - item.createdAt) < 120_000,
      );
      if (nearDup) continue;
    }
    consider(item);
  }

  return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function activityIcon(type: string): string {
  if (/split|bill/i.test(type)) return 'restaurant';
  if (/tip/i.test(type)) return 'volunteer_activism';
  if (/receive|tip_received|repay_received|incoming/i.test(type)) return 'south_west';
  if (/remind/i.test(type)) return 'notifications';
  if (/request/i.test(type)) return 'request_quote';
  if (/swap/i.test(type)) return 'currency_exchange';
  if (/lend|repay|forgive|tab/i.test(type)) return 'handshake';
  if (/collect|pot/i.test(type)) return 'savings';
  if (/circle/i.test(type)) return 'donut_large';
  return 'payments';
}

function titleFor(a: ActivityItem): string {
  if (a.note && !/^tab #\d+$/i.test(a.note.trim())) return a.note;
  if (/lend/i.test(a.type)) {
    const tab = a.note?.match(/^tab #(\d+)$/i)?.[1];
    return tab ? `Lend · tab #${tab}` : 'Lend';
  }
  if (a.note) return a.note;
  if (/borrow/i.test(a.type)) {
    return a.counterparty ? `Borrowed from ${a.counterparty}` : 'Borrowed';
  }
  if (/receive|tip_received|repay_received/i.test(a.type)) {
    return a.counterparty ? `From ${a.counterparty}` : 'Received';
  }
  if (/remind/i.test(a.type)) return a.counterparty ? `Reminded ${a.counterparty}` : 'Reminder';
  if (/request/i.test(a.type)) return a.counterparty ? `Request to ${a.counterparty}` : 'Request';
  return a.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isOutbound(a: ActivityItem): boolean {
  if (/receive|claim|incoming|forgive|tip_received|repay_received|remind|request|borrow/i.test(a.type)) return false;
  if (/^split$/i.test(a.type) && !a.txId) return false;
  return /send|tip|pay|lend|repay|checkout|batch_pay/i.test(a.type);
}

function showsAmount(a: ActivityItem): boolean {
  if (a.amount <= 0) return false;
  if (/remind/i.test(a.type)) return false;
  return true;
}

function offChainStatusLabel(a: ActivityItem): { text: string; tone: 'ok' | 'warn' | 'muted' } | null {
  if (a.txId) return null;
  if (/remind/i.test(a.type)) {
    return a.status === 'confirmed' || a.status === 'sent'
      ? { text: 'Sent', tone: 'ok' }
      : { text: 'Logged', tone: 'muted' };
  }
  if (/request|^split$/i.test(a.type)) {
    if (a.status === 'paid' || a.status === 'confirmed') return { text: 'Paid', tone: 'ok' };
    if (a.status === 'cancelled') return { text: 'Cancelled', tone: 'muted' };
    return { text: 'Unpaid', tone: 'warn' };
  }
  if (a.status === 'confirmed') return { text: 'Done', tone: 'ok' };
  if (a.status === 'failed') return { text: 'Failed', tone: 'warn' };
  return null;
}

function dateGroupLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  if (ts >= startToday) return 'Today';
  if (ts >= startYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupByDate(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const map = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const label = dateGroupLabel(item.createdAt);
    const list = map.get(label) ?? [];
    list.push(item);
    map.set(label, list);
  }
  return [...map.entries()].map(([label, groupItems]) => ({ label, items: groupItems }));
}

function requestIcon(r: PaymentRequest): string {
  if (r.onChainBillId != null) return 'call_split';
  const note = r.note?.toLowerCase() ?? '';
  if (/split|bill|dinner|lunch|restaurant|food|uber|taxi/i.test(note)) return 'restaurant';
  return 'request_quote';
}

function OpenRequestRow({
  r,
  paying,
  batchPaying,
  onPay,
}: {
  r: PaymentRequest;
  paying: boolean;
  batchPaying: boolean;
  onPay: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-surface-variant bg-surface-container-lowest p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-error-container/30 text-error">
        <Icon name={requestIcon(r)} className="text-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-body-md font-semibold text-on-surface">
            {r.note ?? `Payment to ${r.fromUser}`}
          </span>
          <span className="whitespace-nowrap text-body-md font-semibold text-error">
            {formatUsd(r.amount)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-body-sm text-on-surface-variant">
            To {r.fromUser}
            {r.onChainBillId != null ? ` · escrow #${r.onChainBillId}` : ''}
          </span>
          <button
            type="button"
            disabled={paying || batchPaying}
            onClick={onPay}
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-on-primary disabled:opacity-50"
          >
            {paying ? '…' : 'Pay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenOwedRow({
  r,
  onRemind,
}: {
  r: PaymentRequest;
  onRemind: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-surface-variant bg-surface-container-lowest p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
        <Icon name="request_quote" className="text-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-body-md font-semibold text-on-surface">
            {r.note ?? 'Request'}
          </span>
          <span className="whitespace-nowrap text-body-md font-semibold text-tertiary">
            {formatUsd(r.amount)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-body-sm text-on-surface-variant">Waiting on {r.toUser}</span>
          <button
            type="button"
            onClick={onRemind}
            className="shrink-0 rounded-full border border-primary/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
          >
            Remind
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenLoanRow({
  d,
  direction,
  onClick,
}: {
  d: TabDebt;
  direction: 'owe' | 'owed';
  onClick: () => void;
}) {
  const amt = outstandingUsd(d);
  const isOwe = direction === 'owe';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-surface-variant bg-surface-container-lowest p-4 text-left"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isOwe ? 'bg-error-container/30 text-error' : 'bg-tertiary-fixed/40 text-tertiary'
        }`}
      >
        <Icon name="handshake" className="text-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-body-md font-semibold text-on-surface">
            {d.note ??
              (isOwe ? `Loan from ${d.lender}` : `Loan to ${d.borrower}`)}
          </span>
          <span
            className={`whitespace-nowrap text-body-md font-semibold ${
              isOwe ? 'text-error' : 'text-tertiary'
            }`}
          >
            {formatUsd(amt)}
          </span>
        </div>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          {isOwe
            ? `Repay ${d.lender}${d.onChainId != null ? ` · tab #${d.onChainId}` : ''}`
            : `${d.borrower} owes you${d.onChainId != null ? ` · tab #${d.onChainId}` : ''}`}
        </p>
      </div>
      <Icon name="chevron_right" className="shrink-0 text-outline" />
    </button>
  );
}

function HistoryRow({
  a,
  liveStatus,
  onTxStatus,
}: {
  a: ActivityItem;
  liveStatus: Record<string, TxStatus>;
  onTxStatus: (activityId: string, txId: string, status: TxStatus) => void;
}) {
  const out = isOutbound(a);
  const status = liveStatus[a.id] ?? (a.status as TxStatus) ?? 'pending';
  const confirmed = status === 'confirmed';
  const badge = offChainStatusLabel({ ...a, status });
  const counterpartLabel = (() => {
    if (!a.counterparty) return a.type.replace(/_/g, ' ');
    if (/remind/i.test(a.type)) return a.counterparty;
    if (out) return `To ${a.counterparty}`;
    if (/request|^split$/i.test(a.type)) return `Waiting on ${a.counterparty}`;
    return `From ${a.counterparty}`;
  })();

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-surface-variant bg-surface-container-lowest px-3 py-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
        <Icon name={activityIcon(a.type)} className="text-[20px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-body-md font-semibold text-on-surface">{titleFor(a)}</span>
          {showsAmount(a) && (
            <span
              className={`whitespace-nowrap text-body-md font-semibold ${
                out ? 'text-on-surface' : 'text-tertiary'
              }`}
            >
              {out ? '−' : '+'}
              {formatUsd(a.amount)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-body-sm text-on-surface-variant">{counterpartLabel}</span>
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                badge.tone === 'ok'
                  ? 'bg-tertiary-fixed/50 text-tertiary-container'
                  : badge.tone === 'warn'
                    ? 'bg-error-container/40 text-error'
                    : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
        {a.txId ? (
          <TxTracker
            txId={a.txId}
            variant="pill"
            initialStatus={status === 'failed' ? 'failed' : confirmed ? 'confirmed' : 'pending'}
            onStatusChange={(s) => onTxStatus(a.id, a.txId!, s)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ActivityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { loading, refreshBalance } = useUniversalAccount();
  const { requests, tabs: tabDebts, activity, chainActivity, payRequest, payAllPending, remindRequest, refresh } =
    usePayGram();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const [paying, setPaying] = useState<string | null>(null);
  const [batchPaying, setBatchPaying] = useState(false);
  const [batchTxIds, setBatchTxIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('open');
  const [feature, setFeature] = useState<FeatureTab>('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [liveStatus, setLiveStatus] = useState<Record<string, TxStatus>>({});
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = useCallback(
    async (opts?: { notify?: boolean }) => {
      setRefreshing(true);
      try {
        await Promise.all([refresh(), refreshBalance()]);
        if (opts?.notify) toast.success('Updated');
      } catch {
        if (opts?.notify) toast.error('Could not refresh — check your connection');
      } finally {
        setRefreshing(false);
      }
    },
    [refresh, refreshBalance, toast],
  );

  useEffect(() => {
    void refreshAll();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshAll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshAll]);

  const onTxStatus = useCallback(
    (activityId: string, txId: string, status: TxStatus) => {
      setLiveStatus((prev) => {
        const current = prev[activityId];
        if (status === 'pending' && (current === 'confirmed' || current === 'failed')) {
          return prev;
        }
        if (current === status) return prev;
        return { ...prev, [activityId]: status };
      });
      if (status === 'confirmed' || status === 'failed') {
        updateActivityStatus(txId, status);
        void updateActivityApi({ txId, status });
        if (status === 'confirmed') void refreshBalance();
      }
    },
    [refreshBalance],
  );

  const mergedActivity = useMemo(() => mergeActivity(activity, chainActivity), [activity, chainActivity]);
  const myHandle = userHandle(telegramUser?.username, walletAddress, paygramUsername);
  const incoming = requests.filter((r) => r.status === 'pending');
  const owedToMe = incoming.filter((r) => tabPartyEq(r.fromUser, myHandle));
  const iOwe = incoming.filter((r) => tabPartyEq(r.toUser, myHandle));
  const tabOwedToMe = tabDebts.filter((d) => isOpenTab(d) && tabPartyEq(d.lender, myHandle));
  const tabIOwe = tabDebts.filter((d) => isOpenTab(d) && tabPartyEq(d.borrower, myHandle));
  const summary = computeNetSummary(requests, myHandle, tabDebts);
  const openCount = iOwe.length + owedToMe.length + tabIOwe.length + tabOwedToMe.length;

  const openIds = useMemo(() => {
    const ids: string[] = [];
    for (const r of [...iOwe, ...owedToMe]) ids.push(`r:${r.id}`);
    for (const d of [...tabIOwe, ...tabOwedToMe]) ids.push(`t:${d.id}`);
    return ids;
  }, [iOwe, owedToMe, tabIOwe, tabOwedToMe]);

  const { visible: netCardVisible, dismiss: dismissNetCard } = useNetStripDismiss(summary, openIds);

  const openDebts = useMemo(
    () => [...tabIOwe, ...tabOwedToMe],
    [tabIOwe, tabOwedToMe],
  );

  const historyItems = useMemo(() => {
    return mergedActivity
      .filter((a) => matchesFeature(a, feature))
      .filter((a) => !hideLendDup(a, openDebts, 'history', feature));
  }, [mergedActivity, feature, openDebts]);

  const historyGroups = useMemo(() => groupByDate(historyItems), [historyItems]);

  const featureCounts = useMemo(() => {
    const counts = new Map<FeatureTab, number>();
    for (const t of FEATURE_TABS) counts.set(t.id, 0);
    for (const a of mergedActivity) {
      for (const t of FEATURE_TABS) {
        if (t.id === 'all') continue;
        if (matchesFeature(a, t.id)) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
      }
    }
    counts.set('all', mergedActivity.length);
    return counts;
  }, [mergedActivity]);

  const handlePay = async (id: string) => {
    setPaying(id);
    setError(null);
    try {
      await payRequest(id);
      await refresh();
      toast.success('Payment submitted');
    } catch (e) {
      const msg = formatWalletError(e);
      setError(msg);
      toast.error(msg, { walletActions: true });
    } finally {
      setPaying(null);
    }
  };

  const handlePayAll = async () => {
    if (!myHandle) return;
    setBatchPaying(true);
    setBatchTxIds([]);
    setError(null);
    try {
      const { paid, txIds } = await payAllPending(myHandle);
      setBatchTxIds(txIds);
      await refresh();
      if (paid === 0) {
        toast.error('No pending payments to settle.');
      } else {
        toast.success(`Settled ${paid} payment${paid === 1 ? '' : 's'}`);
      }
    } catch (e) {
      const msg = formatWalletError(e);
      setError(msg);
      toast.error(msg, { walletActions: true });
    } finally {
      setBatchPaying(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background pb-tab-bar">
      <PageHeader
        title="Activity"
        onBack={null}
        right={
          <button
            type="button"
            onClick={() => void refreshAll({ notify: true })}
            disabled={refreshing}
            className="text-label-sm font-medium text-primary disabled:opacity-50"
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
        }
      />
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-stack-gap-md px-container-padding py-stack-gap-md md:max-w-screen-md">
        {/* Open | History */}
        <div className="flex rounded-xl bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => setView('open')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-label-md transition-colors ${
              view === 'open'
                ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-sm'
                : 'text-on-surface-variant'
            }`}
          >
            Open
            {openCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">
                {openCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-label-md transition-colors ${
              view === 'history'
                ? 'bg-surface-container-lowest font-semibold text-on-surface shadow-sm'
                : 'text-on-surface-variant'
            }`}
          >
            History
          </button>
        </div>

        {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}

        {view === 'open' ? (
          <>
            {netCardVisible && (
            <section className="relative rounded-2xl border border-surface-variant bg-surface-container-lowest p-4 soft-shadow">
              <button
                type="button"
                onClick={dismissNetCard}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-outline hover:bg-surface-container-high"
                aria-label="Hide net with friends"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Net with friends
              </p>
              <p className="mt-1 text-display-amount text-on-surface">
                {summary.net >= 0 ? '+' : '−'}
                {formatUsd(Math.abs(summary.net))}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-error-container/35 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">You owe</p>
                  <p className="text-label-md font-semibold tabular-nums text-error">
                    {formatUsd(summary.youOwe)}
                  </p>
                </div>
                <div className="rounded-xl bg-tertiary-fixed/35 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Owed to you</p>
                  <p className="text-label-md font-semibold tabular-nums text-tertiary">
                    {formatUsd(summary.owedToYou)}
                  </p>
                </div>
              </div>
              {iOwe.length > 0 && (
                <button
                  type="button"
                  disabled={batchPaying}
                  onClick={() => void handlePayAll()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-label-md font-bold text-on-primary disabled:opacity-50"
                >
                  {batchPaying ? 'Paying…' : `Pay all (${iOwe.length})`}
                  <Icon name="arrow_forward" className="text-[18px]" filled />
                </button>
              )}
            </section>
            )}

            {batchTxIds.length > 0 && (
              <section className="flex flex-col gap-2">
                {batchTxIds.map((txId) => (
                  <div
                    key={txId}
                    className="rounded-2xl border border-surface-variant bg-surface-container-lowest p-3"
                  >
                    <TxTracker txId={txId} variant="steps" />
                  </div>
                ))}
              </section>
            )}

            {loading && openCount === 0 && mergedActivity.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : openCount === 0 ? (
              <EmptyState
                icon="done_all"
                title="All caught up"
                body="No open requests or loans. Completed payments live under History."
                ctaLabel="View history"
                onCta={() => setView('history')}
              />
            ) : (
              <div className="flex flex-col gap-stack-gap-md">
                {iOwe.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      You owe
                    </h3>
                    {iOwe.map((r) => (
                      <OpenRequestRow
                        key={r.id}
                        r={r}
                        paying={paying === r.id}
                        batchPaying={batchPaying}
                        onPay={() => void handlePay(r.id)}
                      />
                    ))}
                  </section>
                )}
                {tabIOwe.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Loans to repay
                    </h3>
                    {tabIOwe.map((d) => (
                      <OpenLoanRow
                        key={d.id}
                        d={d}
                        direction="owe"
                        onClick={() => navigate('/tabs')}
                      />
                    ))}
                  </section>
                )}
                {owedToMe.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Owed to you
                    </h3>
                    {owedToMe.map((r) => (
                      <OpenOwedRow
                        key={r.id}
                        r={r}
                        onRemind={() => void remindRequest(r.id).then(() => toast.success('Reminder sent'))}
                      />
                    ))}
                  </section>
                )}
                {tabOwedToMe.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Active loans
                    </h3>
                    {tabOwedToMe.map((d) => (
                      <OpenLoanRow
                        key={d.id}
                        d={d}
                        direction="owed"
                        onClick={() => navigate('/tabs')}
                      />
                    ))}
                  </section>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRIMARY_FEATURES.map((id) => {
                  const t = featureMeta(id);
                  const count = featureCounts.get(id) ?? 0;
                  const active = feature === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFeature(id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-label-sm transition-colors ${
                        active
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-surface-variant bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      <Icon name={t.icon} className="text-[18px]" filled={active} />
                      {t.label}
                      {count > 0 && id !== 'all' && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                            active ? 'bg-on-primary/20 text-on-primary' : 'text-outline'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(true)}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-2 text-label-sm transition-colors ${
                    MORE_FEATURES.includes(feature)
                      ? 'border-primary bg-primary-fixed/30 text-primary'
                      : 'border-surface-variant bg-surface-container-lowest text-on-surface-variant'
                  }`}
                >
                  <Icon name="tune" className="text-[18px]" />
                  {MORE_FEATURES.includes(feature) ? featureMeta(feature).label : 'More'}
                </button>
              </div>
            </div>

            {showMoreFilters && (
              <BottomSheet
                title="Filter history"
                subtitle="Split, loans, collect, circles, swap"
                onClose={() => setShowMoreFilters(false)}
              >
                <div className="grid grid-cols-2 gap-2">
                  {MORE_FEATURES.map((id) => {
                    const t = featureMeta(id);
                    const count = featureCounts.get(id) ?? 0;
                    const active = feature === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setFeature(id);
                          setShowMoreFilters(false);
                        }}
                        className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors ${
                          active
                            ? 'border-primary bg-primary-fixed/30 text-primary'
                            : 'border-surface-variant bg-surface-container-lowest text-on-surface-variant'
                        }`}
                      >
                        <Icon name={t.icon} className="text-[26px]" filled={active} />
                        <span className="text-label-md font-medium">{t.label}</span>
                        {count > 0 && (
                          <span className="text-[11px] tabular-nums text-outline">{count} items</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </BottomSheet>
            )}

            {loading && historyItems.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : historyItems.length === 0 ? (
              <EmptyState
                icon={FEATURE_TABS.find((t) => t.id === feature)?.icon ?? 'payments'}
                title={`No ${feature === 'all' ? '' : FEATURE_TABS.find((t) => t.id === feature)?.label.toLowerCase() + ' '}history yet`}
                body={
                  feature === 'receive'
                    ? 'Tips, sends, and payments from friends show up here.'
                    : 'Completed sends, tips, and loans show up here.'
                }
                ctaLabel={
                  feature === 'send'
                    ? 'Send money'
                    : feature === 'receive'
                      ? 'Share pay link'
                      : feature === 'tip'
                        ? 'Send a tip'
                        : feature === 'lend'
                          ? 'Open loans'
                          : 'Go home'
                }
                onCta={() =>
                  navigate(
                    feature === 'send'
                      ? '/send'
                      : feature === 'receive'
                        ? '/me'
                        : feature === 'tip'
                          ? '/tip'
                          : feature === 'lend'
                            ? '/tabs'
                            : feature === 'collect'
                              ? '/collect'
                              : feature === 'circles'
                                ? '/circles'
                                : feature === 'swap'
                                  ? '/swap'
                                  : '/',
                  )
                }
              />
            ) : (
              <div className="flex flex-col gap-stack-gap-md">
                {historyGroups.map((group) => (
                  <section key={group.label} className="flex flex-col gap-2">
                    <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-outline">
                      {group.label}
                    </h3>
                    {group.items.map((a) => (
                      <HistoryRow
                        key={a.id}
                        a={a}
                        liveStatus={liveStatus}
                        onTxStatus={onTxStatus}
                      />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
