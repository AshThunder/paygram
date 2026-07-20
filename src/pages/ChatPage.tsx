import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { BalanceStickyBar, BalanceDetails } from '@/components/balance/BalanceHeader';
import { BalanceSkeleton } from '@/components/ui/Skeleton';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatThread } from '@/components/chat/ChatThread';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton } from '@/components/actions/ActionForm';
import { useChat } from '@/hooks/useChat';
import { useChatChrome } from '@/hooks/ChatChromeProvider';
import { useToast } from '@/hooks/ToastProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { derivePaymentContext } from '@/lib/chatContext';
import { getStartParam } from '@/lib/telegram';
import { parseStartParam, parseWebPayParams } from '@/lib/links';
import { ErrorActionBanner, actionsForWalletError, EmptyState } from '@/components/ui/Feedback';

export function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { loading, primaryAssets, initError, isWalletReady } = useUniversalAccount();
  const chat = useChat();
  const toast = useToast();
  const { setChrome, setChatMenu } = useChatChrome();
  const handled = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages = chat.messages.length > 0;
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    const ctx = derivePaymentContext(chat.messages);
    if (!ctx) {
      setChrome({ variant: 'default' });
      return;
    }
    if (ctx.status === 'pending') {
      setChrome({
        variant: 'pending',
        counterparty: ctx.counterparty,
        txId: ctx.txId,
        balance: chat.balance,
      });
    } else if (ctx.status === 'confirmed') {
      setChrome({
        variant: 'peer',
        counterparty: ctx.counterparty,
        balance: chat.balance,
      });
    } else {
      setChrome({ variant: 'default' });
    }
    return () => setChrome({ variant: 'default' });
  }, [chat.messages, chat.balance, setChrome]);

  useEffect(() => {
    setChatMenu({
      hasMessages,
      requestClear: () => setClearOpen(true),
    });
    return () => setChatMenu(null);
  }, [hasMessages, setChatMenu]);

  const handleClearChat = () => {
    chat.clearChat();
    setChrome({ variant: 'default' });
    setClearOpen(false);
    toast.success('Chat cleared');
  };

  useEffect(() => {
    const webPay = parseWebPayParams(searchParams.toString());
    if (webPay) {
      const q = searchParams.toString();
      navigate(`/checkout?${q}`, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (handled.current) return;
    const param = getStartParam();
    const parsed = parseStartParam(param);
    if (!parsed) return;

    handled.current = true;

    if (parsed.type === 'pay' && parsed.amount && parsed.target) {
      void chat.openPayDeepLink(parsed.amount, parsed.target);
    }
    if (parsed.type === 'request' && parsed.amount && parsed.target) {
      void chat.openRequestDeepLink(parsed.amount, parsed.target, parsed.note);
    }
    if (parsed.type === 'split' && parsed.amount && parsed.targets?.length) {
      chat.openSplitDeepLink(parsed.amount, parsed.targets);
    }
    if (parsed.type === 'pot' && parsed.target) {
      chat.openPotDeepLink(parsed.target);
    }
    if (parsed.type === 'circle' && parsed.target) {
      navigate(`/circles?invite=${parsed.target}`, { replace: true });
    }
  }, [chat, navigate]);

  const { setInput, submitMessage } = chat;

  useEffect(() => {
    const state = location.state as { prefill?: string; submit?: boolean } | null;
    const prefill = state?.prefill;
    if (!prefill) return;
    setInput(prefill);
    navigate(location.pathname, { replace: true, state: {} });
    if (state?.submit) {
      void submitMessage(prefill);
    }
  }, [location.state, location.pathname, navigate, setInput, submitMessage]);

  const lastMessage = chat.messages[chat.messages.length - 1];

  useEffect(() => {
    if (!hasMessages) return;
    const scroll = () => {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    };
    scroll();
    // Confirm cards and receipts can change height after paint
    const t = window.setTimeout(scroll, 50);
    return () => window.clearTimeout(t);
  }, [
    hasMessages,
    chat.messages.length,
    lastMessage?.id,
    lastMessage?.content,
    lastMessage?.type,
    lastMessage?.receipt?.status,
  ]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {loading && !primaryAssets ? (
        <BalanceSkeleton />
      ) : (
        <div className="relative z-20 shrink-0 bg-surface-container-lowest">
          <BalanceStickyBar
            balance={chat.balance}
            loading={loading}
            expanded={balanceOpen}
            onToggle={() => setBalanceOpen((v) => !v)}
            onAddFunds={() => navigate('/me', { state: { scrollTo: 'funding' } })}
          />
          {balanceOpen && (
            <div className="border-b border-surface-container-highest bg-surface-container-lowest">
              <BalanceDetails assets={primaryAssets} />
            </div>
          )}
        </div>
      )}

      <div className="scroll-touch flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">
        {!hasMessages && (
          <div className="px-container-padding pt-4">
          <EmptyState
            icon="forum"
            title="Type a payment in chat"
            body="Try: send $25 to @alice · tip @bob $5 · balance · swap $50 to SOL"
            ctaLabel="Open send"
            onCta={() => navigate('/send')}
          />
          </div>
        )}

        {initError && (
          <div className="mx-container-padding mb-2">
            <ErrorActionBanner message={initError} actions={actionsForWalletError(initError)} />
          </div>
        )}
        {!isWalletReady && !loading && !initError && (
          <p className="mx-container-padding mb-2 text-xs text-outline">Setting up your wallet…</p>
        )}

        <ChatThread
          messages={chat.messages}
          onConfirm={chat.confirmPayment}
          onCancel={chat.cancelConfirm}
          onShare={chat.shareReceipt}
          onShareToGroup={chat.shareReceiptToGroup}
          canShareToGroup={chat.canShareToGroup}
          onInvite={chat.inviteFriend}
          onApplySplit={chat.applySplitCommand}
          processing={chat.processing}
        />
        <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
      </div>

      <ChatInput
        value={chat.input}
        onChange={chat.setInput}
        onSubmit={() => chat.submitMessage(chat.input)}
        disabled={chat.processing}
        groupHint={chat.groupHint}
        compact={false}
      />

      {clearOpen && (
        <BottomSheet title="Clear chat?" subtitle="This only clears messages on this device" onClose={() => setClearOpen(false)}>
          <p className="mb-5 text-body-md text-on-surface-variant">
            All chat history will be removed, including pending confirmations. Your wallet, activity, and payments are not affected.
          </p>
          <PrimaryButton onClick={handleClearChat}>Clear chat</PrimaryButton>
          <button
            type="button"
            onClick={() => setClearOpen(false)}
            className="mt-3 w-full rounded-full py-3 text-label-md font-semibold text-on-surface-variant active:scale-95"
          >
            Cancel
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
