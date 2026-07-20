import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { usePayGram, userHandle } from '@/hooks/PayGramProvider';
import { useNetStripDismiss } from '@/hooks/useNetStripDismiss';
import { computeNetSummary } from '@/lib/activitySummary';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { tabPartyEq, isOpenTab } from '@/lib/tabs';
import { Icon } from '@/components/ui/Icon';
import { ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { useToast } from '@/hooks/ToastProvider';

/** Compact home strip: net + You owe / Owed + Pay all / Remind. */
export function NetBalanceStrip() {
  const navigate = useNavigate();
  const toast = useToast();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const { requests, tabs, payAllPending, remindRequest, refresh } = usePayGram();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = userHandle(telegramUser?.username, walletAddress, paygramUsername);
  const summary = useMemo(() => computeNetSummary(requests, me, tabs), [requests, me, tabs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests],
  );
  const iOwe = pending.filter((r) => tabPartyEq(r.toUser, me));
  const owedToMe = pending.filter((r) => tabPartyEq(r.fromUser, me));
  const tabOwedToMe = tabs.filter((d) => isOpenTab(d) && tabPartyEq(d.lender, me));
  const tabIOwe = tabs.filter((d) => isOpenTab(d) && tabPartyEq(d.borrower, me));

  const openIds = useMemo(() => {
    const ids: string[] = [];
    for (const r of pending) ids.push(`r:${r.id}`);
    for (const d of [...tabOwedToMe, ...tabIOwe]) ids.push(`t:${d.id}`);
    return ids;
  }, [pending, tabOwedToMe, tabIOwe]);

  const { visible, dismiss } = useNetStripDismiss(summary, openIds);

  if (!visible) return null;

  const handlePayAll = async () => {
    setBusy(true);
    setError(null);
    try {
      await payAllPending(me);
      await refresh();
      toast.success('Payments submitted');
      navigate('/activity');
    } catch (e) {
      const msg = formatWalletError(e);
      setError(msg);
      toast.error(msg, { walletActions: true });
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = async () => {
    const first = owedToMe[0];
    if (!first) return;
    setBusy(true);
    setError(null);
    try {
      await remindRequest(first.id);
      toast.success('Reminder sent');
    } catch (e) {
      const msg = formatWalletError(e);
      setError(msg);
      toast.error(msg, { walletActions: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[20px] border border-surface-variant bg-surface-container-lowest">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/activity')}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Net with friends
          </p>
          <p className="text-headline-md tabular-nums text-on-surface">
            {summary.net >= 0 ? '+' : '−'}
            {formatUsd(Math.abs(summary.net))}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center rounded-full text-outline hover:bg-surface-container-high hover:text-on-surface-variant"
            aria-label="Hide net with friends"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/activity')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-outline hover:bg-surface-container-high"
            aria-label="Open activity"
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        <div className="rounded-xl bg-error-container/40 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
            You owe
          </p>
          <p className="text-label-md font-semibold tabular-nums text-error">
            {formatUsd(summary.youOwe)}
          </p>
        </div>
        <div className="rounded-xl bg-tertiary-fixed/40 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
            Owed to you
          </p>
          <p className="text-label-md font-semibold tabular-nums text-tertiary">
            {formatUsd(summary.owedToYou)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 p-4">
        {(iOwe.length > 0 || tabIOwe.length > 0) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (iOwe.length > 0) void handlePayAll();
              else navigate('/tabs');
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-[11px] font-bold uppercase tracking-wide text-on-primary disabled:opacity-50"
          >
            <Icon name="payments" className="text-[16px]" />
            {busy
              ? '…'
              : iOwe.length > 0
                ? `Pay all (${iOwe.length})`
                : `Repay loans (${tabIOwe.length})`}
          </button>
        )}
        {(owedToMe.length > 0 || tabOwedToMe.length > 0) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (owedToMe.length > 0) void handleRemind();
              else navigate('/tabs');
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-primary disabled:opacity-50"
          >
            <Icon name="notifications" className="text-[16px]" />
            {owedToMe.length > 0 ? 'Remind' : 'View loans'}
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 pb-4">
          <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />
        </div>
      )}
    </section>
  );
}
