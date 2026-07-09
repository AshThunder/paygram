import { useState } from 'react';
import type { ConfirmPayload } from '@/lib/storage';
import { formatUsd } from '@/lib/constants';

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

  if (c.intentType === 'split' && c.recipients) {
    const perPerson = c.amount / c.recipients.length;
    return (
      <ConfirmShell title="Confirm split" processing={processing} onConfirm={() => onConfirm(c)} onCancel={() => onCancel(messageId)}>
        <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
        <p className="text-sm text-text-secondary mb-1">{formatUsd(perPerson)} each · {c.recipients.length} people</p>
        <p className="text-xs text-text-muted mb-3">{c.recipients.join(', ')}</p>
      </ConfirmShell>
    );
  }

  if (c.intentType === 'collect') {
    return (
      <ConfirmShell title="Confirm collection" processing={processing} onConfirm={() => onConfirm(c)} onCancel={() => onCancel(messageId)} confirmLabel="Create collection">
        <p className="text-xl font-bold text-text-primary mb-1">{c.title}</p>
        <p className="text-2xl font-bold text-brand mb-3">{formatUsd(c.amount)} goal</p>
      </ConfirmShell>
    );
  }

  if (c.intentType === 'contribute') {
    return (
      <ConfirmShell title="Confirm contribution" processing={processing} onConfirm={() => onConfirm(c)} onCancel={() => onCancel(messageId)} confirmLabel="Contribute">
        <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
        <p className="text-sm text-text-secondary mb-3">to {c.note}</p>
        {balanceAfter != null && (
          <p className="text-xs text-text-muted mb-2">Balance after: {formatUsd(balanceAfter)}</p>
        )}
      </ConfirmShell>
    );
  }

  if (c.intentType === 'swap') {
    return (
      <ConfirmShell title="Confirm swap" processing={processing} onConfirm={() => onConfirm(c)} onCancel={() => onCancel(messageId)} confirmLabel="Swap">
        <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
        <p className="text-sm text-text-secondary mb-3">→ {c.toToken} (cross-chain via UA)</p>
      </ConfirmShell>
    );
  }

  return (
    <ConfirmShell
      title={`Confirm ${c.intentType}`}
      processing={processing}
      onConfirm={() => onConfirm(c)}
      onCancel={() => onCancel(messageId)}
    >
      {editing ? (
        <div className="space-y-2 mb-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-9 px-3 bg-surface-dark border border-surface-border rounded-lg text-sm"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
            className="w-full h-9 px-3 bg-surface-dark border border-surface-border rounded-lg text-sm"
          />
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-brand">Done editing</button>
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
          <p className="text-sm text-text-secondary mb-1">→ {c.recipient}</p>
          {c.note && <p className="text-xs text-text-muted mb-2">Note: {c.note}</p>}
          {balanceAfter != null && (
            <p className="text-xs text-brand-muted mb-2">
              {formatUsd(balanceBefore!)} → {formatUsd(balanceAfter)}
            </p>
          )}
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-brand mb-2">Edit</button>
        </>
      )}
    </ConfirmShell>
  );
}

function ConfirmShell({
  title,
  children,
  processing,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
}: {
  title: string;
  children: React.ReactNode;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md p-4 max-w-[90%] w-full">
        <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">{title}</p>
        {children}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={processing}
            onClick={onConfirm}
            className="flex-1 h-10 bg-brand hover:bg-brand-light disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            {processing ? 'Working…' : confirmLabel}
          </button>
          <button type="button" disabled={processing} onClick={onCancel} className="px-4 h-10 text-sm border border-surface-border rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
