import { useEffect, useRef } from 'react';
import { BalanceHeader } from '@/components/balance/BalanceHeader';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatThread } from '@/components/chat/ChatThread';
import { useChat } from '@/hooks/useChat';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { getStartParam } from '@/lib/telegram';
import { parseStartParam } from '@/lib/links';

export function ChatPage() {
  const { loading, primaryAssets } = useUniversalAccount();
  const chat = useChat();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const param = getStartParam();
    const parsed = parseStartParam(param);
    if (!parsed) return;

    handled.current = true;

    if (parsed.type === 'pay' && parsed.amount && parsed.target) {
      void chat.openPayDeepLink(parsed.amount, parsed.target);
    }
    if (parsed.type === 'gift' && parsed.target) {
      void chat.openGiftDeepLink(parsed.target);
    }
    if (parsed.type === 'pot' && parsed.target) {
      chat.openPotDeepLink(parsed.target);
    }
  }, [chat]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <BalanceHeader balance={chat.balance} assets={primaryAssets} loading={loading} />
      <ChatThread
        messages={chat.messages}
        onConfirm={chat.confirmPayment}
        onCancel={chat.cancelConfirm}
        onShare={chat.shareReceipt}
        processing={chat.processing}
      />
      <ChatInput
        value={chat.input}
        onChange={chat.setInput}
        onSubmit={() => chat.submitMessage(chat.input)}
        quickActions={chat.quickActions}
        onQuickAction={chat.applyQuickAction}
        disabled={chat.processing}
      />
    </div>
  );
}
