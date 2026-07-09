import type { ChatMessage } from '@/lib/storage';
import { universalXUrl } from '@/lib/constants';
import { ConfirmCard } from './ConfirmCard';

const RECEIPT_EMOJIS = ['✅', '🎉', '💸', '🔥', '👏'];

type Props = {
  messages: ChatMessage[];
  onConfirm: (confirm: NonNullable<ChatMessage['confirm']>, messageId: string) => void;
  onCancel: (messageId: string) => void;
  onShare?: (text: string, emoji?: string) => void;
  onInvite?: () => void;
  processing: boolean;
};

export function ChatThread({ messages, onConfirm, onCancel, onShare, onInvite, processing }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary text-sm mb-2">Type a payment in chat</p>
        <p className="text-text-muted text-xs">
          send $25 to @alice · tip @bob $5 · balance · swap $50 to SOL
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
          onConfirm={onConfirm}
          onCancel={onCancel}
          onShare={onShare}
          onInvite={onInvite}
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
  onInvite,
  processing,
}: {
  message: ChatMessage;
  onConfirm: Props['onConfirm'];
  onCancel: Props['onCancel'];
  onShare?: Props['onShare'];
  onInvite?: () => void;
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
    return (
      <ConfirmCard
        confirm={message.confirm}
        messageId={message.id}
        processing={processing}
        onConfirm={(c) => onConfirm(c, message.id)}
        onCancel={onCancel}
      />
    );
  }

  if (message.type === 'receipt' && message.receipt) {
    const r = message.receipt;
    const isSuccess = r.status === 'confirmed';
    const isPending = r.status === 'pending';
    return (
      <div className="flex justify-start">
        <div
          className={`rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%] border ${
            isSuccess ? 'bg-success/10 border-success/30' : isPending ? 'bg-brand/10 border-brand/30' : 'bg-surface-card border-surface-border'
          }`}
        >
          <p className="text-sm text-text-primary">
            {r.emoji && <span className="mr-1">{r.emoji}</span>}
            {message.content}
          </p>
          {r.txId && (
            <a
              href={universalXUrl(r.txId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand mt-2 inline-block hover:underline"
            >
              {isPending ? 'Pending on UniversalX…' : 'View on UniversalX →'}
            </a>
          )}
          {onShare && isSuccess && (
            <div className="flex flex-wrap gap-2 mt-2">
              {RECEIPT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onShare(message.content, emoji)}
                  className="text-lg hover:scale-110 transition-transform"
                  title="Share with reaction"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    const showInvite = message.content.includes("isn't on PayGram");
    return (
      <div className="flex justify-start">
        <div className="bg-danger/10 border border-danger/30 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%]">
          <p className="text-sm text-danger">{message.content}</p>
          {showInvite && onInvite && (
            <button type="button" onClick={onInvite} className="text-xs text-brand mt-2 font-medium hover:underline">
              Invite to PayGram →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (message.type === 'balance') {
    return (
      <div className="flex justify-start">
        <div className="bg-surface-card border border-surface-border rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%] whitespace-pre-line">
          <p className="text-sm text-text-primary">{message.content}</p>
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
