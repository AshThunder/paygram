import { useEffect } from 'react';
import { BalanceHeader } from '@/components/balance/BalanceHeader';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatThread } from '@/components/chat/ChatThread';
import { useChat } from '@/hooks/useChat';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { getStartParam } from '@/lib/telegram';
import { parseStartParam } from '@/lib/links';

export function ChatPage() {
  const { loading } = useUniversalAccount();
  const chat = useChat();

  useEffect(() => {
    const param = getStartParam();
    const parsed = parseStartParam(param);
    if (!parsed) return;

    if (parsed.type === 'pay' && parsed.amount && parsed.target) {
      chat.setInput(`send $${parsed.amount} to @${parsed.target}`);
    }
    if (parsed.type === 'gift' && parsed.amount) {
      chat.setInput(`send $${parsed.amount} to @creator`);
    }
    if (parsed.type === 'pot' && parsed.target) {
      chat.setInput(`contribute $10 to ${parsed.target}`);
    }
  }, [chat]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <BalanceHeader balance={chat.balance} loading={loading} />
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
