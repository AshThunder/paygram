import { useCallback, useState } from 'react';
import { CHAIN_ID } from '@particle-network/universal-account-sdk';
import type { Intent } from '@/lib/intents';
import { parseIntent, resolveRecipient } from '@/lib/parser';
import {
  type ChatMessage,
  type ConfirmPayload,
  loadChatMessages,
  saveChatMessages,
  uid,
} from '@/lib/storage';
import { USDC_ARBITRUM, formatUsd } from '@/lib/constants';
import { giftLink } from '@/lib/links';
import { haptic, shareUrl } from '@/lib/telegram';
import { usePayGram, userHandle } from './PayGramProvider';
import { useUniversalAccount } from './UniversalAccountProvider';
import { useAuth } from './AuthProvider';

const QUICK_ACTIONS = ['Send', 'Tip', 'Split', 'Request', 'Collect'] as const;

export function useChat() {
  const { universalAccount, primaryAssets, ensureDelegated, signAndSend, refreshBalance } =
    useUniversalAccount();
  const { telegramUser, walletAddress } = useAuth();
  const paygram = usePayGram();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatMessages());
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);

  const me = userHandle(telegramUser?.username, walletAddress);
  const balance = primaryAssets?.totalAmountInUSD ?? 0;

  const persist = useCallback((next: ChatMessage[]) => {
    setMessages(next);
    saveChatMessages(next);
  }, []);

  const append = useCallback(
    (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const entry: ChatMessage = { ...msg, id: uid(), timestamp: Date.now() };
      persist([...loadChatMessages(), entry]);
      return entry;
    },
    [persist],
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      persist(loadChatMessages().filter((m) => m.id !== messageId));
    },
    [persist],
  );

  const executeSend = useCallback(
    async (amount: number, address: string) => {
      if (!universalAccount) throw new Error('Wallet not ready');
      await ensureDelegated();
      const transaction = await universalAccount.createTransferTransaction({
        token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM },
        amount: String(amount),
        receiver: address,
      });
      const result = await signAndSend(transaction as { rootHash: string; userOps?: unknown[] });
      await refreshBalance();
      return result.transactionId;
    },
    [universalAccount, ensureDelegated, signAndSend, refreshBalance],
  );

  const handleIntent = useCallback(
    async (intent: Intent, raw: string) => {
      if (intent.type === 'balance') {
        await refreshBalance();
        append({ type: 'balance', content: `Your balance is ${formatUsd(balance)}` });
        return;
      }

      if (intent.type === 'unknown') {
        append({
          type: 'error',
          content: `I didn't understand "${raw}". Try: send $25 to @alice, tip @bob $5, split $120 with @a @b, collect $500 for trip`,
        });
        return;
      }

      if (intent.type === 'request') {
        paygram.createRequest(me, intent.from, intent.amount, intent.note);
        append({
          type: 'receipt',
          content: `Request sent to ${intent.from} for ${formatUsd(intent.amount)}`,
          receipt: { intentType: 'request', amount: intent.amount, counterparty: intent.from, status: 'pending' },
        });
        return;
      }

      if (intent.type === 'split') {
        append({
          type: 'confirm',
          content: 'Confirm split',
          confirm: {
            intentType: 'split',
            amount: intent.total,
            recipients: intent.recipients,
            note: intent.note,
          },
        });
        return;
      }

      if (intent.type === 'collect') {
        append({
          type: 'confirm',
          content: 'Confirm collection',
          confirm: {
            intentType: 'collect',
            amount: intent.goal,
            title: intent.title,
          },
        });
        return;
      }

      if (intent.type === 'gift') {
        if (!walletAddress) return;
        const gift = paygram.createGift(intent.amount, me, walletAddress);
        const link = giftLink(gift.id, gift.amount);
        append({
          type: 'receipt',
          content: `🎁 Gift link created — ${formatUsd(intent.amount)}`,
          receipt: { intentType: 'gift', amount: intent.amount, note: link, status: 'pending' },
        });
        return;
      }

      if (intent.type === 'remind') {
        const pending = paygram.requests.find(
          (r) => r.status === 'pending' && r.toUser.toLowerCase() === intent.target.toLowerCase(),
        );
        if (pending) {
          paygram.remindRequest(pending.id);
          append({
            type: 'system',
            content: `Reminder sent to ${intent.target} about ${formatUsd(pending.amount)}`,
          });
        } else {
          append({ type: 'error', content: `No pending request found for ${intent.target}` });
        }
        return;
      }

      if (intent.type === 'contribute') {
        const pot = paygram.pots.find((p) => p.id === intent.potId);
        if (!pot) {
          append({ type: 'error', content: `Collection ${intent.potId} not found` });
          return;
        }
        append({
          type: 'confirm',
          content: 'Confirm contribution',
          confirm: {
            intentType: 'contribute',
            amount: intent.amount,
            title: pot.id,
            recipient: pot.creator,
            note: pot.title,
          },
        });
        return;
      }

      if (intent.type === 'send' || intent.type === 'tip') {
        const address = resolveRecipient(intent.recipient);
        if (!address || address === '0x') {
          append({
            type: 'error',
            content: `${intent.recipient} isn't on PayGram yet. They need to open the app first, or send to a 0x address.`,
          });
          return;
        }
        append({
          type: 'confirm',
          content: `Confirm ${intent.type}`,
          confirm: {
            intentType: intent.type,
            amount: intent.amount,
            recipient: intent.recipient,
            note: intent.note,
            resolvedAddress: address,
          },
        });
      }
    },
    [append, balance, me, paygram, refreshBalance, walletAddress],
  );

  const submitMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      append({ type: 'user', content: trimmed });
      setInput('');
      await handleIntent(parseIntent(trimmed), trimmed);
    },
    [append, handleIntent],
  );

  const confirmPayment = useCallback(
    async (confirm: ConfirmPayload, messageId: string) => {
      setProcessing(true);
      try {
        if (confirm.intentType === 'split' && confirm.recipients) {
          paygram.createSplit(me, confirm.amount, confirm.recipients, confirm.note);
          removeMessage(messageId);
          append({
            type: 'receipt',
            content: `✅ Split ${formatUsd(confirm.amount)} — requests sent to ${confirm.recipients.join(', ')}`,
            receipt: { intentType: 'split', amount: confirm.amount, status: 'pending' },
          });
          haptic('success');
          return;
        }

        if (confirm.intentType === 'collect' && confirm.title) {
          const pot = paygram.createPot(confirm.title, confirm.amount, me);
          removeMessage(messageId);
          append({
            type: 'receipt',
            content: `✅ Collection "${confirm.title}" live — goal ${formatUsd(confirm.amount)}`,
            receipt: { intentType: 'collect', amount: confirm.amount, note: pot.id, status: 'pending' },
          });
          haptic('success');
          return;
        }

        if (confirm.intentType === 'contribute' && confirm.title) {
          await paygram.contributeToPot(confirm.title, confirm.amount, me);
          removeMessage(messageId);
          append({
            type: 'receipt',
            content: `✅ Contributed ${formatUsd(confirm.amount)} to ${confirm.note}`,
            receipt: { intentType: 'contribute', amount: confirm.amount, status: 'confirmed' },
          });
          return;
        }

        if (!confirm.resolvedAddress) throw new Error('No recipient address');

        const txId = await executeSend(confirm.amount, confirm.resolvedAddress);
        removeMessage(messageId);
        haptic('success');

        paygram.refresh();
        const activityNote = confirm.note;
        append({
          type: 'receipt',
          content: `✅ ${confirm.intentType === 'tip' ? 'Tipped' : 'Sent'} ${formatUsd(confirm.amount)} to ${confirm.recipient}`,
          receipt: {
            intentType: confirm.intentType,
            amount: confirm.amount,
            counterparty: confirm.recipient,
            note: activityNote,
            txId,
            status: 'confirmed',
          },
        });
      } catch (err) {
        haptic('error');
        append({ type: 'error', content: err instanceof Error ? err.message : 'Transaction failed' });
      } finally {
        setProcessing(false);
      }
    },
    [append, executeSend, me, paygram, removeMessage],
  );

  const cancelConfirm = useCallback(
    (messageId: string) => {
      removeMessage(messageId);
      append({ type: 'system', content: 'Cancelled.' });
    },
    [append, removeMessage],
  );

  const shareReceipt = useCallback((text: string) => {
    shareUrl(window.location.origin, text);
  }, []);

  const applyQuickAction = useCallback((action: string) => {
    const prompts: Record<string, string> = {
      Send: 'send $25 to @alice for ',
      Tip: 'tip @creator $5',
      Split: 'split $120 with @bob @carol @dave',
      Request: 'request $30 from @bob',
      Collect: 'collect $500 for ',
    };
    setInput(prompts[action] ?? '');
  }, []);

  return {
    messages,
    input,
    setInput,
    submitMessage,
    confirmPayment,
    cancelConfirm,
    shareReceipt,
    processing,
    balance,
    quickActions: QUICK_ACTIONS,
    applyQuickAction,
  };
}
