import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayGram } from '@/hooks/PayGramProvider';
import { useAuth } from '@/hooks/AuthProvider';
import { useMoneyActions } from '@/hooks/useMoneyActions';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { isPotConfigured } from '@/lib/contracts';
import { potLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';

export function CollectPage() {
  const navigate = useNavigate();
  const { pots, contributeToPot, releasePot, withdrawFromPot } = usePayGram();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const { createCollection, busy, error } = useMoneyActions();
  const { isDelegated: uaDelegated } = useUniversalAccount();
  const [contribByPot, setContribByPot] = useState<Record<string, string>>({});
  const [contributing, setContributing] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [contribError, setContribError] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [title, setTitle] = useState('');

  const me = paygramUsername
    ? `@${paygramUsername}`
    : telegramUser?.username
      ? `@${telegramUser.username}`
      : 'you';
  const onChain = isPotConfigured();
  const walletReady = uaDelegated;

  const handleContribute = async (potId: string, fallbackGoal: number, collected: number) => {
    const remaining = Math.max(0, fallbackGoal - collected);
    const raw = contribByPot[potId];
    const val = parseFloat(raw ?? String(remaining || fallbackGoal || 1));
    if (!val || val <= 0) return;
    setContributing(potId);
    setContribError(null);
    try {
      await contributeToPot(potId, val, me);
    } catch (e) {
      setContribError(formatWalletError(e));
    } finally {
      setContributing(null);
    }
  };

  const handleCreate = async () => {
    const g = parseFloat(goal);
    if (!g || g <= 0 || !title.trim()) return;
    if (!walletReady) {
      setContribError('Finish Get started on Me (add money + unlock wallet), then create a pot.');
      return;
    }
    await createCollection({ goal: g, title: title.trim() });
    setTitle('');
    setGoal('');
  };

  const handleRelease = async (potId: string) => {
    setActionBusy(potId);
    setContribError(null);
    try {
      await releasePot(potId);
    } catch (e) {
      setContribError(formatWalletError(e));
    } finally {
      setActionBusy(null);
    }
  };

  const handleWithdraw = async (potId: string) => {
    setActionBusy(potId);
    setContribError(null);
    try {
      await withdrawFromPot(potId);
    } catch (e) {
      setContribError(formatWalletError(e));
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background">

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-[22px] text-on-surface" />
        </button>
        <h1 className="text-headline-sm font-semibold text-on-surface">Collect</h1>
        <div className="h-10 w-10" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[390px] px-container-padding pb-tab-bar pt-4">
        {(error || contribError) && (
          <ErrorActionBanner
            message={error || contribError || ''}
            actions={actionsForWalletError(error || contribError || '')}
          />
        )}

        {!walletReady && (
          <button
            type="button"
            onClick={() => navigate('/me', { state: { scrollTo: 'setup' } })}
            className="mb-4 w-full rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3 text-left"
          >
            <p className="text-body-md font-medium text-on-surface">Finish setup first</p>
            <p className="text-body-sm text-on-surface-variant">
              Add money and unlock your wallet on Me — takes about a minute.
            </p>
          </button>
        )}

        {!onChain && (
          <p className="mb-4 rounded-2xl border border-surface-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
            Pots are in beta — contributions go directly to the creator for now.
          </p>
        )}

        <section className="mb-6">
          <div className="rounded-2xl border border-surface-variant bg-surface-container-lowest p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/20 text-primary-container">
                <Icon name="add_circle" className="text-[28px]" filled />
              </div>
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface">New Pot</h2>
                <p className="text-body-sm text-on-surface-variant">
                  Collect money for a shared expense. Release it when you&apos;re ready.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <input
                className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3 text-body-md outline-none placeholder:text-outline focus:border-primary-container"
                placeholder="What's this for? (e.g., Office Party)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-body-md text-outline">$</span>
                <input
                  inputMode="decimal"
                  className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest py-3 pl-8 pr-4 text-body-md outline-none focus:border-primary-container"
                  placeholder="0.00"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={busy || !walletAddress}
                onClick={() => void handleCreate()}
                className="w-full rounded-full bg-primary-container py-4 text-[12px] font-bold uppercase tracking-wide text-on-primary disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create Pot'}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-headline-sm font-semibold text-on-surface">Active Pots</h3>
          {pots.filter((p) => !p.released).length === 0 ? (
            <EmptyState
              icon="savings"
              title="No pots yet"
              body="Create a $5 lunch pot and share the link — friends chip in from chat."
              ctaLabel="Create a $5 lunch pot"
              onCta={() => {
                setTitle('Lunch');
                setGoal('5');
              }}
            />
          ) : (
            <div className="space-y-4">
              {pots
                .filter((p) => !p.released)
                .map((p) => {
                const pct = Math.min(100, (p.collected / p.goal) * 100);
                const link = potLink(p.id);
                const isCreator = p.creator.toLowerCase() === me.toLowerCase();
                const funded = p.collected >= p.goal;
                const remaining = Math.max(0, Number((p.goal - p.collected).toFixed(2)));
                const contribValue =
                  contribByPot[p.id] ?? (remaining > 0 ? String(remaining) : String(p.goal || ''));
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-surface-variant bg-surface-container-lowest p-5"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/20 text-primary-container">
                          <Icon name="savings" className="text-[24px]" filled />
                        </div>
                        <div>
                          <h4 className="text-headline-sm font-semibold leading-tight text-on-surface">
                            {p.title}
                          </h4>
                          <p className="mt-1 text-[11px] text-outline">
                            by {p.creator}
                            {p.onChainId != null ? ` · pot #${p.onChainId}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="mb-2 flex items-end justify-between">
                        <span className="text-[24px] font-bold leading-8 text-on-surface">
                          {formatUsd(p.collected)}
                        </span>
                        <span className="text-body-sm text-on-surface-variant">
                          of {formatUsd(p.goal)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                        <div
                          className="h-full rounded-full bg-primary-container"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="mb-3 flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">$</span>
                        <input
                          type="number"
                          value={contribValue}
                          onChange={(e) =>
                            setContribByPot((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="h-12 w-full rounded-full border-none bg-surface-container-low pl-8 text-label-md"
                          placeholder="Amount"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => shareUrl(link, `Contribute to ${p.title}`)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-secondary-fixed py-3 text-[12px] font-bold uppercase tracking-wide text-on-secondary-fixed-variant"
                      >
                        <Icon name="share" className="text-[18px]" /> Share
                      </button>
                      <button
                        type="button"
                        disabled={contributing === p.id}
                        onClick={() => void handleContribute(p.id, p.goal, p.collected)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container py-3 text-[12px] font-bold uppercase tracking-wide text-on-primary disabled:opacity-50"
                      >
                        <Icon name="payments" className="text-[18px]" />
                        {contributing === p.id ? '…' : 'Pay In'}
                      </button>
                    </div>
                    {p.onChainId != null && (
                      <div className="mt-2 flex gap-2">
                        {isCreator && (
                          <button
                            type="button"
                            disabled={actionBusy === p.id || p.collected <= 0}
                            onClick={() => void handleRelease(p.id)}
                            className="flex-1 rounded-full border border-primary py-2.5 text-[12px] font-bold uppercase tracking-wide text-primary disabled:opacity-50"
                          >
                            {actionBusy === p.id ? '…' : funded ? 'Release (goal met)' : 'Release'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionBusy === p.id}
                          onClick={() => void handleWithdraw(p.id)}
                          className="flex-1 rounded-full border border-surface-variant py-2.5 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant disabled:opacity-50"
                        >
                          Withdraw mine
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
