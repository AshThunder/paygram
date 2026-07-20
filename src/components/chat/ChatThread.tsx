import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '@/lib/storage';
import { formatUsd, isAddress, shortenAddress, universalXUrl } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import { TxTracker } from '@/components/tx/TxTracker';
import { ConfirmCard } from './ConfirmCard';
import { ConfettiBurst } from './ConfettiBurst';

const RECEIPT_EMOJIS = ['✅', '🎉', '💸', '🔥', '👏'];

function formatCounterparty(value?: string): string | null {
  if (!value) return null;
  const raw = value.replace(/^to\s+/i, '').trim();
  if (isAddress(raw) || /^0x[a-fA-F0-9]{8,}$/i.test(raw)) {
    return shortenAddress(raw.startsWith('0x') ? raw : `0x${raw}`);
  }
  // Truncated mid-address without 0x prefix (from earlier display bug)
  if (/^[a-fA-F0-9]{20,}$/i.test(raw)) {
    return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  }
  return value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-6)}` : value;
}

type Props = {
  messages: ChatMessage[];
  onConfirm: (confirm: NonNullable<ChatMessage['confirm']>, messageId: string) => void;
  onCancel: (messageId: string) => void;
  onShare?: (text: string, emoji?: string) => void;
  onShareToGroup?: (
    text: string,
    details?: { amount: number; recipient?: string; note?: string },
  ) => void;
  canShareToGroup?: boolean;
  onInvite?: () => void;
  onApplySplit?: (command: string) => void;
  processing: boolean;
};

function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function ChatThread({
  messages,
  onConfirm,
  onCancel,
  onShare,
  onShareToGroup,
  canShareToGroup,
  onInvite,
  onApplySplit,
  processing,
}: Props) {
  if (messages.length === 0) return null;

  let lastDay = '';

  return (
    <div className="flex flex-1 flex-col gap-stack-gap-md px-container-padding pb-chat-scroll pt-4">
      {messages.map((msg) => {
        const day = formatDayLabel(msg.timestamp);
        const showDivider = day !== lastDay;
        lastDay = day;

        return (
          <div key={msg.id} className="flex flex-col gap-stack-gap-md">
            {showDivider && (
              <div className="my-1 flex justify-center">
                <span className="rounded-full bg-surface-container-low px-3 py-1 font-section-label text-section-label uppercase tracking-wider text-on-surface-variant">
                  {day}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onShare={onShare}
              onShareToGroup={onShareToGroup}
              canShareToGroup={canShareToGroup}
              onInvite={onInvite}
              onApplySplit={onApplySplit}
              processing={processing}
            />
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  onConfirm,
  onCancel,
  onShare,
  onShareToGroup,
  canShareToGroup,
  onInvite,
  onApplySplit,
  processing,
}: {
  message: ChatMessage;
  onConfirm: Props['onConfirm'];
  onCancel: Props['onCancel'];
  onShare?: Props['onShare'];
  onShareToGroup?: Props['onShareToGroup'];
  canShareToGroup?: boolean;
  onInvite?: () => void;
  onApplySplit?: Props['onApplySplit'];
  processing: boolean;
}) {
  const navigate = useNavigate();

  if (message.type === 'user') {
    return (
      <div className="flex flex-col items-end gap-1 self-end">
        <div className="max-w-[85%] rounded-[16px] rounded-br-sm bg-primary px-4 py-3 text-on-primary">
          <p className="text-body-md">{message.content}</p>
        </div>
        <span className="pr-1 text-[10px] text-outline">{formatTime(message.timestamp)}</span>
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

  if (message.type === 'assistant' && message.assistant) {
    const a = message.assistant;
    if (a.variant === 'scanning') {
      return (
        <div className="flex flex-col items-end gap-1 self-end">
          <div className="max-w-[85%] overflow-hidden rounded-[16px] rounded-tr-sm border border-surface-container-highest bg-surface-container-lowest p-3">
            <div className="relative mb-2 h-24 overflow-hidden rounded-lg bg-surface-container">
              <div className="scan-line absolute left-0 right-0 h-0.5 bg-secondary" />
            </div>
            <div className="flex items-center gap-2 text-on-primary/90">
              <Icon name="photo_camera" className="text-[16px] text-primary" />
              <span className="text-body-sm italic text-on-surface-variant">
                Scanning {a.fileName ?? 'receipt'}…
              </span>
            </div>
          </div>
          <span className="pr-1 text-[10px] text-outline">Just now</span>
        </div>
      );
    }

    return (
      <div className="flex max-w-[90%] flex-col gap-1 self-start">
        <div className="mb-1 flex items-end gap-2 pl-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-container">
            <Icon name="smart_toy" className="text-[14px] text-on-tertiary-container" />
          </div>
          <span className="font-section-label text-[10px] uppercase tracking-wider text-outline">PayGram Assistant</span>
        </div>
        <div className="flex flex-col gap-4 rounded-[20px] rounded-tl-sm border border-surface-variant bg-surface-container-lowest p-4">
          <div className="flex w-fit items-center gap-2 rounded-full bg-secondary-container/30 px-3 py-1.5 text-on-secondary-container">
            <Icon name="check_circle" className="text-[16px] text-secondary" filled />
            <span className="text-label-md text-on-secondary-fixed-variant">Receipt Analyzed</span>
          </div>
          <p className="text-body-md leading-relaxed text-on-surface">
            Found total{' '}
            <span className="text-headline-sm-mobile text-on-surface">{formatUsd(a.total ?? 0)}</span>
            {a.merchant && (
              <>
                {' '}
                at <span className="font-bold">{a.merchant}</span>
              </>
            )}
            {a.note ? ` — ${a.note}` : ''}
          </p>
          <p className="-mt-2 text-body-sm text-on-surface-variant">Add @friends below to split this bill instantly.</p>
          {a.splitCommand && onApplySplit && (
            <button
              type="button"
              onClick={() => onApplySplit(a.splitCommand!)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-3 text-label-md text-primary transition-all hover:bg-primary-fixed/50 active:scale-95"
            >
              <Icon name="call_split" className="text-[20px]" />
              Split Bill
            </button>
          )}
        </div>
        <span className="pl-1 text-[10px] text-outline">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  if (message.type === 'receipt' && message.receipt) {
    const r = message.receipt;
    const isSuccess = r.status === 'confirmed';
    const isPending = r.status === 'pending';
    const isFailed = r.status === 'failed';
    const counterparty = formatCounterparty(r.counterparty);

    return (
      <div className="relative flex max-w-[85%] flex-col gap-1.5 self-start">
        <div
          className={`relative overflow-hidden rounded-[16px] rounded-tl-sm border px-3.5 py-3 ${
            isSuccess
              ? 'border-secondary-container/30 bg-surface'
              : isFailed
                ? 'border-error-container bg-error-container/30'
                : isPending
                  ? 'border-primary-fixed/40 bg-primary-fixed/10'
                  : 'border-surface-container-highest bg-surface-container-lowest'
          }`}
        >
          <ConfettiBurst active={isSuccess} />
          <div className="relative z-10 flex flex-col gap-2">
            {isSuccess && r.amount > 0 ? (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container/25 text-secondary">
                  <Icon name="check_circle" className="text-[18px]" filled />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Sent</p>
                  <p className="text-headline-sm font-semibold tabular-nums tracking-tight text-on-surface">
                    {formatUsd(r.amount)}
                    {counterparty && (
                      <span className="font-normal text-on-surface-variant">
                        {' '}
                        to <span className="font-medium text-on-surface">{counterparty}</span>
                      </span>
                    )}
                  </p>
                  {r.note && (
                    <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">{r.note}</p>
                  )}
                  {r.txId && (
                    <a
                      href={universalXUrl(r.txId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary"
                    >
                      UniversalX
                      <Icon name="arrow_forward" className="text-[14px]" />
                    </a>
                  )}
                </div>
              </div>
            ) : isFailed ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
                  <Icon name="error" className="text-[18px]" filled />
                </div>
                <p className="text-body-sm text-on-surface">{message.content}</p>
              </div>
            ) : isPending ? (
              <>
                <div className="flex items-center gap-2">
                  <Icon name="payments" className="text-lg text-primary" />
                  <span className="text-body-sm text-on-surface-variant">
                    {r.intentType === 'swap' ? 'Swapping' : r.intentType === 'send' ? 'Sending' : 'Paying'}{' '}
                    {formatUsd(r.amount)}
                    {counterparty ? ` to ${counterparty}` : ''}…
                  </span>
                </div>
                <span className="text-headline-sm font-semibold tabular-nums text-on-surface">
                  {formatUsd(r.amount)}
                </span>
                {r.txId && (
                  <TxTracker
                    txId={r.txId}
                    variant="boxed"
                    initialStatus={
                      r.status === 'confirmed'
                        ? 'confirmed'
                        : r.status === 'failed'
                          ? 'failed'
                          : 'pending'
                    }
                  />
                )}
              </>
            ) : (
              <p className="text-body-sm text-on-surface">
                {r.emoji && <span className="mr-1">{r.emoji}</span>}
                {message.content}
              </p>
            )}
          </div>
        </div>

        {onShare && isSuccess && (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={() => onShare(message.content, '✅')}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-on-primary active:scale-[0.98]"
            >
              <Icon name="ios_share" className="text-[14px]" />
              Share
            </button>
            {RECEIPT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onShare(message.content, emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-container-highest bg-surface text-sm active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {onShareToGroup && canShareToGroup && (isSuccess || isPending) && r.amount > 0 && (
          <button
            type="button"
            onClick={() =>
              onShareToGroup(message.content, {
                amount: r.amount,
                recipient: r.counterparty,
                note: r.note,
              })
            }
            className="inline-flex w-max items-center gap-1 pl-1 text-[11px] font-medium text-primary"
          >
            <Icon name="add_photo_alternate" className="text-[14px]" />
            Post to group
          </button>
        )}
        <span className="pl-1 text-[10px] text-outline">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  if (message.type === 'error') {
    const showInvite = message.content.includes("isn't on PayGram") || message.content.includes('not on PayGram');
    return (
      <div className="flex max-w-[85%] flex-col gap-1 self-start">
        <div className="relative overflow-hidden rounded-[16px] rounded-tl-sm border border-error/10 bg-error-container/40 p-4 ">
          <div className="relative z-10 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <Icon name="info" className="text-[18px]" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-on-surface">{message.content}</p>
              {showInvite && onInvite && (
                <button
                  type="button"
                  onClick={onInvite}
                  className="inline-flex items-center gap-1 rounded-full border border-primary px-4 py-2 text-label-md text-primary transition-colors hover:bg-primary/5"
                >
                  <Icon name="person_add" className="text-[18px]" />
                  Invite to PayGram
                </button>
              )}
            </div>
          </div>
        </div>
        <span className="pl-1 text-[10px] text-outline">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  if (message.type === 'balance' && message.balanceDetail) {
    const b = message.balanceDetail;
    return (
      <div className="flex max-w-[92%] flex-col gap-1 self-start">
        <div className="overflow-hidden rounded-[20px] border border-surface-variant bg-surface-container-lowest">
          <div className="flex flex-col gap-1 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <Icon name="account_balance" className="text-[18px] text-primary" />
              <span className="text-label-md text-on-surface">Your balance</span>
            </div>
            <div className="text-display-amount-mobile tabular-nums tracking-tight text-on-surface">
              {formatUsd(b.total)}
            </div>
          </div>
          <div className="h-px w-full bg-surface-container-highest" />
          <div className="flex flex-col gap-3 px-4 py-3 text-body-sm text-on-surface-variant">
            {b.chains.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-label-md text-on-surface">By chain</span>
                <div className="flex flex-wrap items-center gap-2">
                  {b.chains.map((c, i) => (
                    <span key={c.name} className="flex items-center gap-1">
                      {i > 0 && <span className="text-surface-dim">•</span>}
                      <span className="flex items-center gap-1 rounded-md border border-surface-variant bg-surface px-2 py-1">
                        <span>{c.name}</span>
                        <span className="text-label-md tabular-nums text-on-surface">{formatUsd(c.amount)}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {b.tokens.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-label-md text-on-surface">By asset</span>
                <div className="flex flex-wrap items-center gap-2">
                  {b.tokens.map((t, i) => (
                    <span key={t.symbol} className="flex items-center gap-1">
                      {i > 0 && <span className="text-surface-dim">•</span>}
                      <span className="flex items-center gap-1 rounded-md border border-surface-variant bg-surface px-2 py-1">
                        <span>{t.symbol}</span>
                        <span className="text-label-md tabular-nums text-on-surface">{formatUsd(t.amount)}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => navigate('/me', { state: { scrollTo: 'funding' } })}
              className="flex-1 rounded-full bg-primary/10 py-2 text-label-md text-primary transition-colors hover:bg-primary/20"
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat', { state: { prefill: 'send $' } })}
              className="flex-1 rounded-full border border-outline-variant py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Send
            </button>
          </div>
        </div>
        <span className="pl-1 text-[10px] text-outline">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  if (message.type === 'balance') {
    return (
      <div className="self-start max-w-[92%]">
        <div className="whitespace-pre-line rounded-[20px] border border-surface-container-highest bg-surface-container-lowest px-4 py-3">
          <p className="text-body-sm text-on-surface">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="self-start max-w-[92%]">
      <div className="rounded-[16px] rounded-bl-sm border border-surface-container-highest bg-surface-container-lowest px-4 py-2.5">
        <p className="text-body-sm text-on-surface-variant">{message.content}</p>
      </div>
    </div>
  );
}
