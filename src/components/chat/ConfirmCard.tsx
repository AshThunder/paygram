import { useState } from 'react';
import type { ConfirmPayload } from '@/lib/storage';
import { formatUsd } from '@/lib/constants';
import { haptic } from '@/lib/telegram';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle } from '@/components/ui/stitch';

type Props = {
  confirm: ConfirmPayload;
  processing: boolean;
  messageId: string;
  onConfirm: (confirm: ConfirmPayload) => void;
  onCancel: (id: string) => void;
};

export function ConfirmCard({ confirm: initial, processing, messageId, onConfirm, onCancel }: Props) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(initial.amount));
  const [note, setNote] = useState(initial.note ?? '');

  const c: ConfirmPayload = {
    ...initial,
    amount: parseFloat(amount) || initial.amount,
    note: note || initial.note,
  };

  const balanceBefore = initial.balanceBefore;
  const balanceAfter =
    balanceBefore != null && (c.intentType === 'send' || c.intentType === 'tip' || c.intentType === 'contribute')
      ? balanceBefore - c.amount
      : null;

  const isSplit = c.intentType === 'split';
  const isSwap = c.intentType === 'swap';
  const isCollect = c.intentType === 'collect';

  const title = isSplit
    ? 'CONFIRM SPLIT'
    : isSwap
      ? 'CONFIRM SWAP'
      : isCollect
        ? 'NEW COLLECTION'
        : c.intentType === 'contribute'
          ? 'CONFIRM CONTRIBUTION'
          : `CONFIRM ${c.intentType.toUpperCase()}`;

  const confirmLabel =
    c.intentType === 'collect'
      ? 'Create collection'
      : c.intentType === 'contribute'
        ? 'Contribute'
        : isSwap
          ? 'Confirm Swap'
          : 'Confirm & pay';

  return (
    <div className="flex w-full max-w-[92%] justify-start">
      <div className="flex w-full flex-col overflow-hidden rounded-[20px] border border-surface-container-high bg-surface-container-lowest px-4 py-3.5">
        <div className="mb-2 flex w-full items-center justify-between">
          <span className="font-section-label text-section-label uppercase tracking-wider text-tertiary">{title}</span>
          {(c.intentType === 'send' || c.intentType === 'tip') && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-label-md text-primary">
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="w-full space-y-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-body-sm"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note"
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-body-sm"
            />
            <button type="button" onClick={() => setEditing(false)} className="text-label-md text-primary">
              Done editing
            </button>
          </div>
        ) : (
          <ConfirmBody c={c} />
        )}

        {balanceAfter != null && !editing && (
          <div className="mt-3 flex w-full items-center justify-between border-t border-dashed border-surface-container-highest pt-3">
            <span className="text-body-sm text-outline">After this send</span>
            <span className="text-body-sm tabular-nums text-on-surface">
              <span className="text-outline-variant line-through">{formatUsd(balanceBefore!)}</span>
              {' → '}
              <span className="font-medium">{formatUsd(balanceAfter)}</span>
            </span>
          </div>
        )}

        <div className="mt-3 flex w-full flex-col gap-1.5">
          <button
            type="button"
            disabled={processing}
            onClick={() => {
              haptic('medium');
              onConfirm(c);
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-label-md text-on-primary transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Icon name="check_circle" className="text-[18px]" filled />
            {processing ? 'Working…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() => onCancel(messageId)}
            className="h-10 w-full rounded-full text-label-md text-on-surface-variant disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmBody({ c }: { c: ConfirmPayload }) {
  if (c.intentType === 'split' && c.recipients) {
    const perPerson = c.amount / c.recipients.length;
    return (
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <div className="text-display-amount-mobile text-on-surface">{formatUsd(c.amount)}</div>
        <div className="flex w-full flex-col items-center gap-1 rounded-xl bg-surface-container px-3 py-2">
          <span className="text-label-md text-primary">
            {formatUsd(perPerson)} each · {c.recipients.length} people
          </span>
          <div className="-space-x-2 mt-1 flex items-center justify-center">
            {c.recipients.slice(0, 5).map((r) => (
              <AvatarCircle key={r} label={r} className="z-10 h-7 w-7 border-2 border-surface-container-lowest text-[10px]" />
            ))}
          </div>
          <span className="text-body-sm text-on-surface-variant">{c.recipients.join(', ')}</span>
        </div>
      </div>
    );
  }

  if (c.intentType === 'swap') {
    const toToken = c.toToken ?? 'SOL';
    return (
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <div className="text-display-amount-mobile text-on-surface">{formatUsd(c.amount)}</div>
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <span>USDC</span>
          <Icon name="arrow_forward" className="text-[16px]" />
          <span className="font-semibold text-on-surface">{toToken}</span>
        </div>
      </div>
    );
  }

  if (c.intentType === 'collect') {
    return (
      <div className="flex flex-col items-center gap-1 py-1 text-center">
        <span className="text-headline-sm text-on-surface">{c.title ?? 'New collection'}</span>
        <span className="text-display-amount-mobile text-primary">{formatUsd(c.amount)} goal</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-1 text-center">
      <div className="text-display-amount-mobile tracking-tight text-on-surface">{formatUsd(c.amount)}</div>
      {c.recipient && (
        <div className="mt-1 flex items-center gap-1.5 text-headline-sm text-on-surface">
          <Icon name="arrow_forward" className="text-[18px] text-outline" />
          {c.recipient}
        </div>
      )}
      {c.note && (
        <p className="mt-1.5 text-body-sm text-on-surface-variant">{c.note}</p>
      )}
    </div>
  );
}
