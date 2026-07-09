import { useCallback, useState } from 'react';
import { CHAIN_ID } from '@particle-network/universal-account-sdk';
import type { Intent } from '@/lib/intents';
import { parseIntent, resolveRecipient } from '@/lib/parser';
import { formatChainBreakdown } from '@/lib/assets';
import {
  type ChatMessage,
  type ConfirmPayload,
  loadChatMessages,
  saveChatMessages,
  uid,
} from '@/lib/storage';
import { USDC_ARBITRUM, formatUsd } from '@/lib/constants';
import { giftLink } from '@/lib/links';
import { fetchGiftApi } from '@/lib/api';
import { haptic, shareUrl } from '@/lib/telegram';
import { usePayGram, userHandle } from './PayGramProvider';
import { useUniversalAccount } from './UniversalAccountProvider';
import { useAuth } from './AuthProvider';

const QUICK_ACTIONS = ['Send', 'Tip', 'Split', 'Request', 'Collect'] as const;

export function useChat() {
  const { universalAccount, primaryAssets, ensureDelegated, signAndSend, refreshBalance, initError } =
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

  const showConfirm = useCallback(
    (confirm: ConfirmPayload, content: string) => {
      append({ type: 'confirm', content, confirm });
    },
    [append],
  );

  const executeSend = useCallback(
    async (amount: number, address: string) => {
      if (initError) throw new Error(initError);
      if (!universalAccount) {
        throw new Error('Wallet not ready — wait a moment or reopen PayGram');
      }
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
    [universalAccount, initError, ensureDelegated, signAndSend, refreshBalance],
  );

  const handleIntent = useCallback(
    async (intent: Intent, raw: string) => {
      if (intent.type === 'balance') {
        const assets = await refreshBalance();
        const total = assets?.totalAmountInUSD ?? balance;
        const breakdown = formatChainBreakdown(assets);
        append({
          type: 'balance',
          content: `Your balance is ${formatUsd(total)}${breakdown ? `\n${breakdown}` : ''}`,
        });
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
        await paygram.createRequest(me, intent.from, intent.amount, intent.note);
        append({
          type: 'receipt',
          content: `Request sent to ${intent.from} for ${formatUsd(intent.amount)}`,
          receipt: { intentType: 'request', amount: intent.amount, counterparty: intent.from, status: 'pending' },
        });
        return;
      }

      if (intent.type === 'split') {
        showConfirm(
          {
            intentType: 'split',
            amount: intent.total,
            recipients: intent.recipients,
            note: intent.note,
          },
          'Confirm split',
        );
        return;
      }

      if (intent.type === 'collect') {
        showConfirm(
          {
            intentType: 'collect',
            amount: intent.goal,
            title: intent.title,
          },
          'Confirm collection',
        );
        return;
      }

      if (intent.type === 'gift') {
        if (!walletAddress) return;
        const gift = await paygram.createGift(intent.amount, me, walletAddress);
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
        showConfirm(
          {
            intentType: 'contribute',
            amount: intent.amount,
            title: pot.id,
            recipient: pot.creator,
            note: pot.title,
          },
          'Confirm contribution',
        );
        return;
      }

      if (intent.type === 'send' || intent.type === 'tip') {
        const address = await resolveRecipient(intent.recipient);
        if (!address || address === '0x') {
          append({
            type: 'error',
            content: `${intent.recipient} isn't on PayGram yet. They need to open the app first, or send to a 0x address.`,
          });
          return;
        }
        showConfirm(
          {
            intentType: intent.type,
            amount: intent.amount,
            recipient: intent.recipient,
            note: intent.note,
            resolvedAddress: address,
          },
          `Confirm ${intent.type}`,
        );
      }
    },
    [append, balance, me, paygram, refreshBalance, showConfirm, walletAddress],
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
          await paygram.createSplit(me, confirm.amount, confirm.recipients, confirm.note);
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
          const pot = await paygram.createPot(confirm.title, confirm.amount, me);
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

        await paygram.refresh();
        append({
          type: 'receipt',
          content: `✅ ${confirm.intentType === 'tip' ? 'Tipped' : 'Sent'} ${formatUsd(confirm.amount)} to ${confirm.recipient}`,
          receipt: {
            intentType: confirm.intentType,
            amount: confirm.amount,
            counterparty: confirm.recipient,
            note: confirm.note,
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

  const openPayDeepLink = useCallback(
    async (amount: number, target: string) => {
      const recipient = target.startsWith('@') ? target : `@${target}`;
      const address = await resolveRecipient(recipient);
      if (!address || address === '0x') {
        append({
          type: 'error',
          content: `${recipient} isn't on PayGram yet. Ask them to open the app first.`,
        });
        return;
      }
      showConfirm(
        {
          intentType: 'send',
          amount,
          recipient,
          resolvedAddress: address,
        },
        'Confirm payment',
      );
    },
    [append, showConfirm],
  );

  const openGiftDeepLink = useCallback(
    async (giftId: string) => {
      const local = paygram.gifts.find((g) => g.id === giftId);
      const gift = local ?? (await fetchGiftApi(giftId));
      if (!gift || gift.claimed) {
        append({ type: 'error', content: 'Gift link not found or already claimed.' });
        return;
      }
      showConfirm(
        {
          intentType: 'send',
          amount: gift.amount,
          recipient: gift.creator,
          resolvedAddress: gift.creatorAddress,
          note: 'Gift',
        },
        'Claim gift',
      );
    },
    [append, paygram.gifts, showConfirm],
  );

  const openPotDeepLink = useCallback(
    (potId: string, amount = 10) => {
      const pot = paygram.pots.find((p) => p.id === potId);
      if (!pot) {
        append({ type: 'error', content: `Collection ${potId} not found` });
        return;
      }
      showConfirm(
        {
          intentType: 'contribute',
          amount,
          title: pot.id,
          recipient: pot.creator,
          note: pot.title,
        },
        'Confirm contribution',
      );
    },
    [append, paygram.pots, showConfirm],
  );

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
    openPayDeepLink,
    openGiftDeepLink,
    openPotDeepLink,
  };
}
