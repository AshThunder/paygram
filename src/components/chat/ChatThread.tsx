import type { ChatMessage } from '@/lib/storage';
import type { ConfirmPayload } from '@/lib/storage';
import { formatUsd, universalXUrl } from '@/lib/constants';

type Props = {
  messages: ChatMessage[];
  onConfirm: (confirm: ConfirmPayload, messageId: string) => void;
  onCancel: (messageId: string) => void;
  onShare?: (text: string) => void;
  processing: boolean;
};

export function ChatThread({ messages, onConfirm, onCancel, onShare, processing }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary text-sm mb-2">Type a payment in chat</p>
        <p className="text-text-muted text-xs">
          send $25 to @alice · tip @bob $5 · balance
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onConfirm={(c) => onConfirm(c, msg.id)}
          onCancel={onCancel}
          onShare={onShare}
          processing={processing}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  onConfirm,
  onCancel,
  onShare,
  processing,
}: {
  message: ChatMessage;
  onConfirm: (c: ConfirmPayload) => void;
  onCancel: (id: string) => void;
  onShare?: (text: string) => void;
  processing: boolean;
}) {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-brand/20 border border-brand/30 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%]">
          <p className="text-sm text-text-primary">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'confirm' && message.confirm) {
    const c = message.confirm;

    if (c.intentType === 'split' && c.recipients) {
      const perPerson = c.amount / c.recipients.length;
      return (
        <div className="flex justify-start">
          <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md p-4 max-w-[90%] w-full">
            <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">Confirm split</p>
            <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
            <p className="text-sm text-text-secondary mb-1">{formatUsd(perPerson)} each · {c.recipients.length} people</p>
            <p className="text-xs text-text-muted mb-3">{c.recipients.join(', ')}</p>
            <div className="flex gap-2">
              <button type="button" disabled={processing} onClick={() => onConfirm(c)} className="flex-1 h-10 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                {processing ? 'Creating…' : 'Confirm split'}
              </button>
              <button type="button" disabled={processing} onClick={() => onCancel(message.id)} className="px-4 h-10 text-sm border border-surface-border rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    if (c.intentType === 'collect') {
      return (
        <div className="flex justify-start">
          <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md p-4 max-w-[90%] w-full">
            <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">Confirm collection</p>
            <p className="text-xl font-bold text-text-primary mb-1">{c.title}</p>
            <p className="text-2xl font-bold text-brand mb-3">{formatUsd(c.amount)} goal</p>
            <div className="flex gap-2">
              <button type="button" disabled={processing} onClick={() => onConfirm(c)} className="flex-1 h-10 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-50">Create collection</button>
              <button type="button" disabled={processing} onClick={() => onCancel(message.id)} className="px-4 h-10 text-sm border border-surface-border rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    if (c.intentType === 'contribute') {
      return (
        <div className="flex justify-start">
          <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md p-4 max-w-[90%] w-full">
            <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">Confirm contribution</p>
            <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
            <p className="text-sm text-text-secondary mb-3">to {c.note}</p>
            <div className="flex gap-2">
              <button type="button" disabled={processing} onClick={() => onConfirm(c)} className="flex-1 h-10 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-50">Contribute</button>
              <button type="button" disabled={processing} onClick={() => onCancel(message.id)} className="px-4 h-10 text-sm border border-surface-border rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-start">
        <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md p-4 max-w-[90%] w-full">
          <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">
            Confirm {c.intentType}
          </p>
          <p className="text-2xl font-bold text-text-primary mb-1">{formatUsd(c.amount)}</p>
          <p className="text-sm text-text-secondary mb-1">→ {c.recipient}</p>
          {c.note && <p className="text-xs text-text-muted mb-3">Note: {c.note}</p>}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={processing}
              onClick={() => onConfirm(c)}
              className="flex-1 h-10 bg-brand hover:bg-brand-light disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {processing ? 'Sending…' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => onCancel(message.id)}
              className="px-4 h-10 text-text-secondary text-sm font-medium rounded-xl border border-surface-border hover:border-brand/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'receipt' && message.receipt) {
    const r = message.receipt;
    const isSuccess = r.status === 'confirmed';
    return (
      <div className="flex justify-start">
        <div className={`rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%] border ${
          isSuccess ? 'bg-success/10 border-success/30' : 'bg-surface-card border-surface-border'
        }`}>
          <p className="text-sm text-text-primary">{message.content}</p>
          {r.txId && (
            <a
              href={universalXUrl(r.txId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand mt-2 inline-block hover:underline"
            >
              View on UniversalX →
            </a>
          )}
          {onShare && r.status === 'confirmed' && (
            <button
              type="button"
              onClick={() => onShare(message.content)}
              className="text-xs text-brand-muted mt-2 ml-3 hover:underline"
            >
              Share receipt
            </button>
          )}
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="bg-danger/10 border border-danger/30 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%]">
          <p className="text-sm text-danger">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%]">
        <p className="text-sm text-text-secondary">{message.content}</p>
      </div>
    </div>
  );
}
