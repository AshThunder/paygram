import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoneyActions } from '@/hooks/useMoneyActions';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatUsd } from '@/lib/constants';
import { isTabConfigured } from '@/lib/contracts';
import { outstandingUsd, tabPartyEq, isOpenTab, type TabDebt } from '@/lib/tabs';
import { spendHint } from '@/lib/uaTransfer';
import { usePayGram, userHandle } from '@/hooks/PayGramProvider';
import {
  ActionPageShell,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  FormCard,
  FriendChips,
  PrimaryButton,
  SuccessPanel,
  AmountInput,
  normalizeHandleInput,
} from '@/components/actions/ActionForm';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle, SectionLabel } from '@/components/ui/stitch';
import { EmptyState, ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';

function DebtCard({
  debt,
  role,
  busy,
  onRepay,
  onForgive,
}: {
  debt: TabDebt;
  role: 'lender' | 'borrower';
  busy: boolean;
  onRepay: (id: string, amount: number) => void;
  onForgive: (id: string) => void;
}) {
  const left = outstandingUsd(debt);
  const due =
    debt.dueAt != null
      ? new Date(debt.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;

  return (
    <div className="rounded-[24px] border border-surface-variant bg-surface-container-lowest p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <AvatarCircle
            label={role === 'lender' ? debt.borrower : debt.lender}
            className="h-10 w-10 text-sm"
          />
          <div>
            <p className="text-body-md font-semibold text-on-surface">
              {role === 'lender' ? debt.borrower : debt.lender}
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {role === 'lender' ? 'owes you' : 'you owe'} · {formatUsd(left)}
              {due ? ` · due ${due}` : ''}
            </p>
          </div>
        </div>
        {debt.onChainId != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            tracked
          </span>
        )}
      </div>
      {debt.note && <p className="mb-3 text-body-sm text-outline">{debt.note}</p>}
      <div className="flex flex-col gap-2">
        {role === 'borrower' && left > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onRepay(debt.id, left)}
              className="flex-1 rounded-full bg-primary py-2.5 text-label-md font-semibold text-on-primary disabled:opacity-50"
            >
              Repay {formatUsd(left)}
            </button>
            {left > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onRepay(debt.id, Math.min(left, Math.round((left / 2) * 100) / 100))
                }
                className="rounded-full border border-primary px-3 py-2.5 text-label-md text-primary disabled:opacity-50"
              >
                Half
              </button>
            )}
          </div>
        )}
        {role === 'lender' && left > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onForgive(debt.id)}
            className="w-full rounded-full border border-surface-variant py-2.5 text-label-md text-on-surface-variant disabled:opacity-50"
          >
            Forgive {formatUsd(left)}
          </button>
        )}
      </div>
    </div>
  );
}

export function TabsPage() {
  const navigate = useNavigate();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const me = userHandle(telegramUser?.username, walletAddress, paygramUsername);
  const { friends } = useFriends();
  const { tabs, refresh: refreshPaygram } = usePayGram();
  const { primaryAssets } = useUniversalAccount();
  const { lendMoney, repayDebt, forgiveDebt, busy, error, setError } = useMoneyActions();

  const [mode, setMode] = useState<'list' | 'lend'>('list');
  const [amount, setAmount] = useState('25');
  const [borrower, setBorrower] = useState('');
  const [note, setNote] = useState('');
  const [dueInDays, setDueInDays] = useState('');
  const [done, setDone] = useState<{ message: string; txId?: string } | null>(null);

  const debts = tabs;
  const open = debts.filter(isOpenTab);
  const asLender = open.filter((d) => tabPartyEq(d.lender, me));
  const asBorrower = open.filter((d) => tabPartyEq(d.borrower, me));
  const youAreOwed = asLender.reduce((s, d) => s + outstandingUsd(d), 0);
  const youOwe = asBorrower.reduce((s, d) => s + outstandingUsd(d), 0);
  const onChain = isTabConfigured();
  const lendAmount = parseFloat(amount) || 0;
  const hint = spendHint(primaryAssets, lendAmount);

  const refresh = () => {
    void refreshPaygram();
  };

  useEffect(() => {
    refresh();
  }, [refreshPaygram]);

  const submitLend = async () => {
    const value = parseFloat(amount);
    const to = normalizeHandleInput(borrower);
    if (!value || value <= 0 || !to) return;
    const days = dueInDays ? parseInt(dueInDays, 10) : undefined;
    try {
      const res = await lendMoney({
        amount: value,
        borrower: to,
        note: note || undefined,
        dueInDays: days && days > 0 ? days : undefined,
      });
      setDone(res);
      refresh();
    } catch {
      /* ErrorActionBanner via useMoneyActions — no toast */
    }
  };

  const onRepay = async (id: string, amt: number) => {
    setError(null);
    try {
      await repayDebt({ debtId: id, amount: amt });
      refresh();
    } catch {
      /* toasted */
    }
  };

  const onForgive = async (id: string) => {
    setError(null);
    try {
      await forgiveDebt({ debtId: id });
      refresh();
    } catch {
      /* toasted */
    }
  };

  if (mode === 'lend') {
    return (
      <ActionPageShell title="Lend" subtitle="Send USDC and track what they owe">
        {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
        {done ? (
          <SuccessPanel
            message={done.message}
            onDone={() => {
              setDone(null);
              setMode('list');
              refresh();
            }}
            secondaryLabel="Lend again"
            onSecondary={() => setDone(null)}
          />
        ) : (
          <>
            <FormCard>
              <AmountInput label="Amount" value={amount} onChange={setAmount} />
              <hr className="border-surface-variant" />
              <div className="space-y-3">
                <FieldLabel>Borrower</FieldLabel>
                <FriendChips friends={friends} selected={borrower} onPick={setBorrower} />
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Icon name="alternate_email" className="text-[20px] text-outline" />
                  </span>
                  <FieldInput
                    placeholder="username"
                    value={borrower.replace(/^@/, '')}
                    onChange={(e) => setBorrower(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Due in (days, optional)</FieldLabel>
                <FieldInput
                  inputMode="numeric"
                  placeholder="e.g. 14"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Note (optional)</FieldLabel>
                <FieldTextarea
                  rows={2}
                  placeholder="Dinner, flight, etc."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </FormCard>
            {hint && (
              <p className="mt-3 rounded-2xl bg-surface-container-low px-3 py-2 text-center text-body-sm text-on-surface-variant">
                {hint}
              </p>
            )}
            <p className="mt-3 text-center text-body-sm text-on-surface-variant">
              {onChain
                ? 'Funds leave your unified balance — repayments stay tracked in PayGram.'
                : 'Funds leave your balance; IOU is saved until on-chain tabs are ready.'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <PrimaryButton busy={busy} onClick={() => void submitLend()}>
                Confirm lend
                <Icon name="handshake" className="text-[20px]" />
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setMode('list')}
                className="py-2 text-label-md text-primary"
              >
                Back to tabs
              </button>
            </div>
          </>
        )}
      </ActionPageShell>
    );
  }

  const isEmpty = open.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background pb-tab-bar">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-primary"
        >
          <Icon name="arrow_back" className="text-[22px]" />
          <h1 className="text-headline-sm font-semibold text-on-surface">Borrow & lend</h1>
        </button>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setError(null);
            setMode('lend');
          }}
          className="rounded-full bg-primary px-4 py-2 text-label-md font-semibold text-on-primary"
        >
          Lend
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-5 px-container-padding pb-8 pt-4">
        {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-surface-variant bg-surface-container-lowest p-4">
            <p className="text-label-sm text-on-surface-variant">You’re owed</p>
            <p className="mt-1 text-headline-sm font-bold text-primary">{formatUsd(youAreOwed)}</p>
          </div>
          <div className="rounded-[20px] border border-surface-variant bg-surface-container-lowest p-4">
            <p className="text-label-sm text-on-surface-variant">You owe</p>
            <p className="mt-1 text-headline-sm font-bold text-on-surface">{formatUsd(youOwe)}</p>
          </div>
        </div>

        {isEmpty ? (
          <EmptyState
            icon="handshake"
            title="No open loans"
            body="Lend from your unified balance — we track what they owe you."
            ctaLabel="Lend money"
            onCta={() => {
              setDone(null);
              setError(null);
              setMode('lend');
            }}
          />
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <SectionLabel>You owe</SectionLabel>
              {asBorrower.length === 0 ? (
                <p className="text-body-sm text-outline">Nothing outstanding.</p>
              ) : (
                asBorrower.map((d) => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    role="borrower"
                    busy={busy}
                    onRepay={(id, amt) => void onRepay(id, amt)}
                    onForgive={(id) => void onForgive(id)}
                  />
                ))
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Owed to you</SectionLabel>
              {asLender.length === 0 ? (
                <p className="text-body-sm text-outline">No open loans yet.</p>
              ) : (
                asLender.map((d) => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    role="lender"
                    busy={busy}
                    onRepay={(id, amt) => void onRepay(id, amt)}
                    onForgive={(id) => void onForgive(id)}
                  />
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
