import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMoneyActions } from '@/hooks/useMoneyActions';
import { useFriends } from '@/hooks/useFriends';
import { usePayGram } from '@/hooks/PayGramProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatUsd } from '@/lib/constants';
import { spendHint } from '@/lib/uaTransfer';
import {
  ActionPageShell,
  FieldInput,
  FieldLabel,
  FieldTextarea,
  FormCard,
  FriendAvatarRow,
  FriendChips,
  PrimaryButton,
  SuccessPanel,
  RecipientInput,
  AmountInput,
  normalizeHandleInput,
  isRecipientValid,
} from '@/components/actions/ActionForm';
import { Icon } from '@/components/ui/Icon';
import { ErrorActionBanner, actionsForWalletError, EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';

export function SendPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seed = (location.state as { recipient?: string; amount?: number; note?: string } | null) ?? null;
  const { friends } = useFriends();
  const { primaryAssets } = useUniversalAccount();
  const { sendMoney, busy, error } = useMoneyActions();
  const recipientRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(seed?.amount != null ? String(seed.amount) : '');
  const [recipient, setRecipient] = useState(seed?.recipient ?? '');
  const [note, setNote] = useState(seed?.note ?? '');
  const [done, setDone] = useState<{ message: string; txId?: string } | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const balance = primaryAssets?.totalAmountInUSD ?? 0;
  const sendHint = spendHint(primaryAssets, parseFloat(amount) || 0);

  const submit = async () => {
    const value = parseFloat(amount);
    const to = normalizeHandleInput(recipient);
    if (!value || value <= 0) return;
    if (!isRecipientValid(recipient)) {
      setRecipientError(
        to.startsWith('0x') ? 'Enter a valid 0x wallet address' : 'Enter @username or 0x address',
      );
      return;
    }
    setRecipientError(null);
    try {
      const res = await sendMoney({ amount: value, recipient: to, note: note || undefined });
      setDone(res);
    } catch {
      /* toasted via useMoneyActions */
    }
  };

  const focusRecipient = () => {
    queueMicrotask(() => recipientRef.current?.focus());
  };

  if (done) {
    return (
      <ActionPageShell title="Send Money" subtitle="">
        <SuccessPanel
          message={done.message}
          onDone={() => navigate('/')}
          secondaryLabel="View activity"
          onSecondary={() => navigate('/activity')}
        />
      </ActionPageShell>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-primary pb-safe">
      <header className="shrink-0 px-container-padding pb-4 pt-2">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-on-primary"
            aria-label="Go back"
          >
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <h1 className="text-headline-md font-semibold text-on-primary">Send Money</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-on-primary"
            aria-label="Close"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <p className="mb-2 text-center text-body-sm text-on-primary/80">
          Available Balance: {formatUsd(balance)}
        </p>
        <AmountInput variant="hero" value={amount} onChange={setAmount} autoFocus />
        {sendHint && (
          <p className="mt-3 text-center text-body-sm text-on-primary/75">{sendHint}</p>
        )}
      </header>

      <div className="min-h-0 flex-1 rounded-t-[28px] bg-surface-container-lowest px-container-padding pt-6 pb-8">
        {error && (
          <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />
        )}

        <div className="mb-5 space-y-3">
          <p className="text-body-lg font-semibold text-on-surface">Send to</p>
          <FriendAvatarRow
            friends={friends}
            selected={recipient.startsWith('0x') ? undefined : recipient}
            onPick={(h) => {
              setRecipient(h);
              setRecipientError(null);
            }}
            onAdd={() => {
              setRecipient('');
              setRecipientError(null);
              focusRecipient();
            }}
          />
          <RecipientInput
            inputRef={recipientRef}
            value={recipient}
            onChange={(v) => {
              setRecipient(v);
              setRecipientError(null);
            }}
          />
          {recipientError && (
            <p className="text-body-sm text-error">{recipientError}</p>
          )}
        </div>

        <div className="mb-6 space-y-2">
          <p className="text-body-md font-semibold text-on-surface">Note (Optional)</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <Icon name="edit_note" className="text-[20px] text-outline" />
            </span>
            <input
              className="w-full rounded-[16px] border-none bg-surface-container-low py-3.5 pl-10 pr-4 text-body-md text-on-surface outline-none placeholder:text-outline-variant focus:ring-1 focus:ring-primary-container"
              placeholder="What's this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <PrimaryButton
          busy={busy}
          onClick={submit}
          className="rounded-[16px] bg-primary shadow-none"
        >
          Send
          <Icon name="arrow_forward" className="text-[20px]" />
        </PrimaryButton>
      </div>
    </div>
  );
}

export function TipPage() {
  const navigate = useNavigate();
  const { friends } = useFriends();
  const { sendMoney, scheduleRecurringTip, busy, error } = useMoneyActions();
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [weekly, setWeekly] = useState(false);
  const [done, setDone] = useState<{ message: string } | null>(null);

  const submit = async () => {
    const value = parseFloat(amount);
    const to = normalizeHandleInput(recipient);
    if (!value || value <= 0 || !to) return;
    if (weekly) {
      const res = await scheduleRecurringTip({ amount: value, recipient: to });
      setDone(res);
      return;
    }
    const res = await sendMoney({ amount: value, recipient: to, note: note || undefined, asTip: true });
    setDone(res);
  };

  return (
    <ActionPageShell title="Tip" subtitle="no chat required">
      {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      {done ? (
        <SuccessPanel message={done.message} onDone={() => navigate('/')} />
      ) : (
        <>
          <FormCard>
            <AmountInput label="Amount" value={amount} onChange={setAmount} />
            <hr className="border-surface-variant" />
            <div>
              <FieldLabel>Creator</FieldLabel>
              <FriendChips friends={friends} selected={recipient} onPick={setRecipient} />
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Icon name="alternate_email" className="text-[20px] text-outline" />
                </span>
                <FieldInput
                  placeholder="creator"
                  value={recipient.replace(/^@/, '')}
                  onChange={(e) => setRecipient(e.target.value.replace(/\s+/g, ''))}
                />
              </div>
            </div>
            {!weekly && (
              <div>
                <FieldLabel>Note (Optional)</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-3">
                    <Icon name="edit_note" className="text-[20px] text-outline" />
                  </span>
                  <FieldTextarea
                    rows={2}
                    placeholder="great stream"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
              <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
              <span className="text-body-sm text-on-surface">Set weekly tip reminder</span>
            </label>
          </FormCard>
          <div className="mt-6">
            <PrimaryButton busy={busy} onClick={submit}>
              {weekly ? 'Save reminder' : 'Send tip'}
              <Icon name="volunteer_activism" className="text-[20px]" />
            </PrimaryButton>
          </div>
        </>
      )}
    </ActionPageShell>
  );
}

export function RequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seed = (location.state as { from?: string; amount?: number; note?: string } | null) ?? null;
  const { friends } = useFriends();
  const { requestMoney, busy, error } = useMoneyActions();
  const [amount, setAmount] = useState(seed?.amount != null ? String(seed.amount) : '');
  const [from, setFrom] = useState(seed?.from ?? '');
  const [note, setNote] = useState(seed?.note ?? '');
  const [done, setDone] = useState<{ message: string } | null>(null);

  const submit = async () => {
    const value = parseFloat(amount);
    const who = normalizeHandleInput(from);
    if (!value || value <= 0 || !who) return;
    setDone(await requestMoney({ amount: value, from: who, note: note || undefined }));
  };

  return (
    <ActionPageShell title="Request" subtitle="no chat required">
      {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      {done ? (
        <SuccessPanel message={done.message} onDone={() => navigate('/activity')} />
      ) : (
        <>
          <FormCard>
            <AmountInput value={amount} onChange={setAmount} autoFocus />
            <div>
              <FieldLabel>Request from</FieldLabel>
              <FriendChips friends={friends} selected={from} onPick={setFrom} />
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Icon name="search" className="text-[20px] text-outline" />
                </span>
                <FieldInput
                  placeholder="@handle or phone number"
                  value={from.replace(/^@/, '')}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Note (Optional)</FieldLabel>
              <input
                className="w-full rounded-[16px] border border-surface-variant bg-surface px-4 py-3 text-body-md outline-none placeholder:text-outline-variant focus:border-primary-container"
                placeholder="What's this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <PrimaryButton busy={busy} onClick={submit}>
              Request Money
            </PrimaryButton>
          </FormCard>
          <button
            type="button"
            onClick={() => navigate('/split')}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-4 active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-fixed-dim text-tertiary">
              <Icon name="group" className="text-[24px]" />
            </div>
            <span className="text-[11px] font-medium text-on-surface">Split a bill instead</span>
          </button>
        </>
      )}
    </ActionPageShell>
  );
}

export function SplitPage() {
  const navigate = useNavigate();
  const { friends } = useFriends();
  const { splitBill, busy, error } = useMoneyActions();
  const [total, setTotal] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ message: string } | null>(null);

  const toggle = (handle: string) => {
    const h = normalizeHandleInput(handle);
    if (!h) return;
    setSelected((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  const addManual = () => {
    const h = normalizeHandleInput(manual);
    if (!h || h.length < 4) return;
    setSelected((prev) => (prev.includes(h) ? prev : [...prev, h]));
    setManual('');
  };

  const value = parseFloat(total) || 0;
  const perPerson = selected.length > 0 ? value / (selected.length + 1) : 0;

  const submit = async () => {
    if (!value || value <= 0 || selected.length === 0) return;
    setDone(await splitBill({ total: value, recipients: selected, note: note || undefined }));
  };

  return (
    <ActionPageShell title="Split Bill" subtitle="no chat required">
      {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      {done ? (
        <SuccessPanel message={done.message} onDone={() => navigate('/activity')} />
      ) : (
        <>
          <FormCard>
            <div className="border-b border-surface-variant/50 pb-2">
              <AmountInput label="Total amount" value={total} onChange={setTotal} />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <FieldLabel>Split with</FieldLabel>
                <button
                  type="button"
                  onClick={() => navigate('/friends')}
                  className="text-[11px] font-medium text-primary"
                >
                  {friends.length ? 'Manage friends' : 'Add friends'}
                </button>
              </div>
              {friends.length === 0 && selected.length === 0 ? (
                <p className="mb-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-body-sm text-on-surface-variant">
                  No saved friends yet. Type an @username below, or{' '}
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => navigate('/friends')}
                  >
                    add friends
                  </button>{' '}
                  first. Shares go into on-chain escrow until everyone’s paid.
                </p>
              ) : (
                <div className="mb-3 flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const h = `@${f.username}`;
                    const on = selected.includes(h);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggle(h)}
                        className={`flex items-center rounded-full px-3 py-1.5 text-body-sm font-medium ${
                          on
                            ? 'bg-secondary-fixed text-primary-container'
                            : 'border border-surface-variant bg-surface text-on-surface-variant'
                        }`}
                      >
                        {f.username}
                        {on && <Icon name="close" className="ml-1.5 text-[14px]" />}
                      </button>
                    );
                  })}
                  {selected
                    .filter((h) => !friends.some((f) => `@${f.username}` === h))
                    .map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggle(h)}
                        className="flex items-center rounded-full bg-secondary-fixed px-3 py-1.5 text-body-sm font-medium text-primary-container"
                      >
                        {h}
                        <Icon name="close" className="ml-1.5 text-[14px]" />
                      </button>
                    ))}
                </div>
              )}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Icon name="alternate_email" className="text-[20px] text-outline" />
                </span>
                <FieldInput
                  placeholder="username to split with"
                  value={manual.replace(/^@/, '')}
                  onChange={(e) => setManual(e.target.value.replace(/\s+/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addManual();
                    }
                  }}
                />
                {manual.trim().length >= 3 && (
                  <button
                    type="button"
                    onClick={addManual}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-full bg-primary px-3 text-[11px] font-bold text-on-primary"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4">
              <div>
                <span className="text-body-sm text-on-surface-variant">Split equally</span>
                <p className="text-[10px] text-outline">Total ÷ you + friends · escrowed on Arbitrum</p>
              </div>
              <span className="text-headline-sm font-semibold text-primary">
                ${perPerson.toFixed(2)}
              </span>
            </div>
            <div>
              <FieldLabel>Note (Optional)</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <Icon name="edit" className="text-[20px] text-outline-variant" />
                </span>
                <input
                  className="w-full rounded-[16px] border border-surface-variant bg-surface py-3 pl-10 pr-4 text-body-md outline-none focus:border-primary-container"
                  placeholder="What's this for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </FormCard>
          <div className="mt-6">
            <PrimaryButton
              busy={busy}
              disabled={!value || selected.length === 0}
              onClick={submit}
            >
              Confirm Split
            </PrimaryButton>
          </div>
        </>
      )}
    </ActionPageShell>
  );
}

export function SwapPage() {
  const navigate = useNavigate();
  const { primaryAssets } = useUniversalAccount();
  const { swapTokens, busy, error } = useMoneyActions();
  const [amount, setAmount] = useState('');
  const [toToken, setToToken] = useState('ETH');
  const [done, setDone] = useState<{ message: string } | null>(null);
  const balance = primaryAssets?.totalAmountInUSD ?? 0;

  const submit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0 || !toToken.trim()) return;
    setDone(await swapTokens({ amount: value, toToken: toToken.trim().toUpperCase() }));
  };

  return (
    <ActionPageShell title="Swap" subtitle="no chat required">
      {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      {done ? (
        <SuccessPanel message={done.message} onDone={() => navigate('/activity')} />
      ) : (
        <>
          <FormCard>
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-[11px] text-on-surface-variant">
                <span>From</span>
                <span>Balance: {formatUsd(balance)}</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary font-bold">
                  $
                </div>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="min-w-0 flex-1 border-none bg-transparent text-[28px] font-bold text-on-surface outline-none"
                  placeholder="0.00"
                />
                <span className="rounded-full bg-surface-container-highest px-3 py-1 text-label-md font-semibold">
                  USD
                </span>
              </div>
            </div>
            <div className="mb-4 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed text-primary">
                <Icon name="swap_vert" className="text-[22px]" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] text-on-surface-variant">To</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {['ETH', 'USDC', 'SOL', 'BNB'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToToken(t)}
                    className={`rounded-full px-3 py-1.5 text-label-md font-semibold ${
                      toToken === t
                        ? 'bg-primary-container text-on-primary'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </FormCard>
          <div className="mt-6">
            <PrimaryButton busy={busy} onClick={submit}>
              Confirm Swap
              <Icon name="currency_exchange" className="text-[20px]" />
            </PrimaryButton>
          </div>
        </>
      )}
    </ActionPageShell>
  );
}

export function RemindPage() {
  const navigate = useNavigate();
  const { requests } = usePayGram();
  const { remind, busy, error, me } = useMoneyActions();
  const [done, setDone] = useState<{ message: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue'>('all');

  const mine = requests.filter(
    (r) => r.status === 'pending' && r.fromUser.toLowerCase() === me.toLowerCase(),
  );

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const withAge = mine.map((r) => ({
    ...r,
    overdue: Date.now() - r.createdAt > WEEK_MS,
  }));
  const visible =
    filter === 'all'
      ? withAge
      : filter === 'overdue'
        ? withAge.filter((r) => r.overdue)
        : withAge.filter((r) => !r.overdue);

  const filters = [
    { id: 'all' as const, label: 'All Reminders' },
    { id: 'pending' as const, label: 'Pending' },
    { id: 'overdue' as const, label: 'Overdue' },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background pb-tab-bar">
      <PageHeader title="Remind" />

      <main className="flex flex-grow flex-col gap-stack-gap-lg px-container-padding py-stack-gap-lg">
        <div className="scrollbar-none flex space-x-2 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-label-sm transition-colors ${
                filter === f.id
                  ? 'bg-primary-container text-on-primary'
                  : 'border border-surface-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
        {done ? (
          <SuccessPanel message={done.message} onDone={() => navigate('/activity')} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="notifications_off"
            title="No active reminders"
            body="You're all caught up. When you request money, reminders will appear here."
            ctaLabel="Create a request"
            onCta={() => navigate('/request')}
          />
        ) : (
          <div className="flex flex-col gap-stack-gap-md">
            {visible.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-headline-md text-on-secondary-container">
                      {r.toUser.replace(/^@/, '').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-body-lg font-semibold text-on-background">{r.toUser}</h3>
                      <p className="text-body-md text-on-surface-variant">{r.note || 'Payment request'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-headline-md text-on-background">{formatUsd(r.amount)}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        r.overdue
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-fixed text-on-primary-fixed-variant'
                      }`}
                    >
                      {r.overdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-surface-variant/50 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => setDone(await remind(r.id))}
                    className="flex items-center gap-1 rounded-full bg-primary-container px-4 py-2 text-label-sm font-semibold text-on-primary transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
                  >
                    <Icon name={r.overdue ? 'notifications_active' : 'send'} className="text-[16px]" />
                    {r.overdue ? 'Remind' : 'Nudge'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
