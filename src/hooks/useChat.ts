import { useCallback, useEffect, useState } from 'react';
import type { Intent } from '@/lib/intents';
import { parseIntentAsync, resolveRecipient } from '@/lib/parser';
import { getChainBreakdown, getTokenBreakdown } from '@/lib/assets';
import {
  type ChatMessage,
  type ConfirmPayload,
  clearChatMessages,
  loadChatMessages,
  saveChatMessages,
  uid,
} from '@/lib/storage';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { assertTransferReady, createUsdcSendTransaction } from '@/lib/uaTransfer';
import { scheduleBalanceRefresh } from '@/lib/balanceRefresh';
import { mapTxStatus, TX_POLL_INTERVAL_MS } from '@/lib/txTracker';
import { inviteLink, requestLink } from '@/lib/links';
import { parseReceiptApi, shareReceiptApi } from '@/lib/api';
import { addRecurringTip } from '@/lib/recurringTips';
import { blobToBase64, generateReceiptImage } from '@/lib/receiptImage';
import {
  haptic,
  shareReceipt,
  shareUrl,
  isGroupChat,
  getTelegramChat,
  getTelegramChatId,
  canShareToGroup,
} from '@/lib/telegram';
import { usePayGram, userHandle } from './PayGramProvider';
import { useUniversalAccount } from './UniversalAccountProvider';
import { useAuth } from './AuthProvider';

const QUICK_ACTIONS = ['Send', 'Tip', 'Split', 'Request', 'Collect', 'Swap'] as const;

export function useChat() {
  const { universalAccount, primaryAssets, ensureDelegated, signAndSend, refreshBalance, initError, executeSwap, getTransaction } =
    useUniversalAccount();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const paygram = usePayGram();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatMessages());
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);

  const me = userHandle(telegramUser?.username, walletAddress, paygramUsername);
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

  const clearChat = useCallback(() => {
    clearChatMessages();
    setMessages([]);
  }, []);

  useEffect(() => {
    const onProgress = () => setMessages(loadChatMessages());
    window.addEventListener('paygram:chat-progress', onProgress);
    return () => window.removeEventListener('paygram:chat-progress', onProgress);
  }, []);

  useEffect(() => {
    const hasPending = messages.some(
      (m) => m.type === 'receipt' && m.receipt?.status === 'pending' && m.receipt.txId,
    );
    if (!hasPending || !getTransaction) return;

    let cancelled = false;

    const syncReceipts = async () => {
      const current = loadChatMessages();
      let updated = false;
      const next: ChatMessage[] = [];

      for (const m of current) {
        if (m.type !== 'receipt' || !m.receipt || m.receipt.status !== 'pending' || !m.receipt.txId) {
          next.push(m);
          continue;
        }
        try {
          const details = await getTransaction(m.receipt.txId);
          const mapped = mapTxStatus(details?.status as number | string | undefined);
          if (mapped === 'pending') {
            next.push(m);
            continue;
          }
          updated = true;
          const r = m.receipt;
          const verb =
            r.intentType === 'tip' ? 'Tipped' : r.intentType === 'swap' ? 'Swapped' : r.intentType === 'send' ? 'Sent' : 'Paid';
          const content =
            mapped === 'confirmed'
              ? `${verb} ${formatUsd(r.amount)}${r.counterparty ? ` to ${r.counterparty}` : ''}`
              : `Failed — ${verb.toLowerCase()} ${formatUsd(r.amount)}`;
          next.push({
            ...m,
            content,
            receipt: {
              ...r,
              status: mapped,
              emoji: mapped === 'confirmed' ? '✅' : '❌',
            },
          });
          if (mapped === 'confirmed') {
            haptic('success');
            void refreshBalance();
          }
        } catch {
          next.push(m);
        }
      }

      if (!cancelled && updated) persist(next);
    };

    void syncReceipts();
    const timer = window.setInterval(() => void syncReceipts(), TX_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [messages, getTransaction, persist, refreshBalance]);

  const showConfirm = useCallback(
    (confirm: ConfirmPayload, content: string) => {
      append({
        type: 'confirm',
        content,
        confirm: { ...confirm, balanceBefore: balance },
      });
    },
    [append, balance],
  );

  const executeSend = useCallback(
    async (amount: number, address: string) => {
      if (initError) throw new Error(initError);
      if (!universalAccount) {
        throw new Error('Wallet not ready — wait a moment or reopen PayGram');
      }
      const assets = (await refreshBalance()) ?? primaryAssets;
      const receiver = assertTransferReady({
        amount,
        receiver: address,
        sender: walletAddress,
        assets,
      });
      await ensureDelegated({ assets });
      const transaction = await createUsdcSendTransaction(universalAccount, amount, receiver);
      const result = await signAndSend(transaction);
      await refreshBalance();
      scheduleBalanceRefresh(refreshBalance);
      return result.transactionId;
    },
    [
      universalAccount,
      initError,
      ensureDelegated,
      signAndSend,
      refreshBalance,
      primaryAssets,
      walletAddress,
    ],
  );

  const handleIntent = useCallback(
    async (intent: Intent, raw: string) => {
      if (intent.type === 'balance') {
        const assets = await refreshBalance();
        const total = assets?.totalAmountInUSD ?? balance;
        const chains = getChainBreakdown(assets).map((c) => ({ name: c.name, amount: c.amountInUSD }));
        const tokenMap = new Map<string, number>();
        for (const t of getTokenBreakdown(assets)) {
          const key = t.symbol.toUpperCase();
          tokenMap.set(key, (tokenMap.get(key) ?? 0) + t.amountInUSD);
        }
        const tokens = [...tokenMap.entries()].map(([symbol, amount]) => ({ symbol, amount }));
        append({
          type: 'balance',
          content: `Your balance is ${formatUsd(total)}`,
          balanceDetail: { total, chains, tokens },
        });
        return;
      }

      if (intent.type === 'unknown') {
        append({
          type: 'error',
          content: `I didn't understand "${raw}". Try: send $25 to @alice, tip @bob $5, swap $50 to SOL, split $120 with @a @b`,
        });
        return;
      }

      if (intent.type === 'swap') {
        showConfirm(
          {
            intentType: 'swap',
            amount: intent.amount,
            toToken: intent.toToken,
          },
          'Confirm swap',
        );
        return;
      }

      if (intent.type === 'recurring_tip') {
        addRecurringTip(intent.recipient, intent.amount, intent.intervalDays);
        append({
          type: 'system',
          content: `🔁 Weekly tip reminder set: ${formatUsd(intent.amount)} to ${intent.recipient}`,
        });
        return;
      }

      if (intent.type === 'request') {
        await paygram.createRequest(me, intent.from, intent.amount, intent.note);
        const username = paygramUsername ?? me.replace(/^@/, '');
        const link = requestLink(username, intent.amount, intent.note);
        append({
          type: 'receipt',
          content: `Request sent to ${intent.from} for ${formatUsd(intent.amount)} — share so they can pay in one tap`,
          receipt: {
            intentType: 'request',
            amount: intent.amount,
            counterparty: intent.from,
            note: intent.note,
            status: 'pending',
          },
        });
        shareUrl(link, `Pay me ${formatUsd(intent.amount)} on PayGram`);
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


      if (intent.type === 'remind') {
        const pending = paygram.requests.find(
          (r) => r.status === 'pending' && r.toUser.toLowerCase() === intent.target.toLowerCase(),
        );
        if (pending) {
          await paygram.remindRequest(pending.id);
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
            content: `${intent.recipient} isn't on PayGram yet. Invite them to open the app, then try again.`,
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
    [append, balance, me, paygram, paygramUsername, refreshBalance, showConfirm, walletAddress],
  );

  const submitMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      append({ type: 'user', content: trimmed });
      setInput('');
      await handleIntent(await parseIntentAsync(trimmed), trimmed);
    },
    [append, handleIntent],
  );

  const confirmPayment = useCallback(
    async (confirm: ConfirmPayload, messageId: string) => {
      setProcessing(true);
      try {
        if (confirm.intentType === 'split' && confirm.recipients) {
          if (!walletAddress) throw new Error('Wallet not ready');
          const reqs = await paygram.createSplit(
            me,
            confirm.amount,
            confirm.recipients,
            confirm.note,
            walletAddress,
          );
          const billId = reqs[0]?.onChainBillId;
          removeMessage(messageId);
          append({
            type: 'receipt',
            content:
              billId != null
                ? `✅ Split ${formatUsd(confirm.amount)} locked in escrow #${billId} — ${confirm.recipients.join(', ')}`
                : `✅ Split ${formatUsd(confirm.amount)} — requests sent to ${confirm.recipients.join(', ')}`,
            receipt: {
              intentType: 'split',
              amount: confirm.amount,
              status: 'pending',
              txId: undefined,
            },
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
          haptic('success');
          return;
        }

        if (confirm.intentType === 'swap' && confirm.toToken) {
          const pendingReceipt = append({
            type: 'receipt',
            content: `⏳ Swapping ${formatUsd(confirm.amount)} to ${confirm.toToken}…`,
            receipt: { intentType: 'swap', amount: confirm.amount, status: 'pending' },
          });
          removeMessage(messageId);
          const { transactionId: txId } = await executeSwap(confirm.amount, confirm.toToken);
          paygram.logTxActivity({
            type: 'swap',
            amount: confirm.amount,
            note: `→ ${confirm.toToken}`,
            txId,
            status: 'pending',
          });
          persist(
            loadChatMessages().map((m) =>
              m.id === pendingReceipt.id
                ? {
                    ...m,
                    content: `⏳ Swapped ${formatUsd(confirm.amount)} to ${confirm.toToken}`,
                    receipt: {
                      intentType: 'swap',
                      amount: confirm.amount,
                      txId,
                      status: 'pending' as const,
                      emoji: '⏳',
                    },
                  }
                : m,
            ),
          );
          haptic('success');
          return;
        }

        if (!confirm.resolvedAddress && confirm.intentType !== 'split' && confirm.intentType !== 'collect') {
          throw new Error('No recipient address');
        }

        if (confirm.resolvedAddress) {
        const pendingReceipt = append({
          type: 'receipt',
          content: `⏳ Sending ${formatUsd(confirm.amount)} to ${confirm.recipient}…`,
          receipt: {
            intentType: confirm.intentType,
            amount: confirm.amount,
            counterparty: confirm.recipient,
            status: 'pending',
          },
        });
        removeMessage(messageId);

        const txId = await executeSend(confirm.amount, confirm.resolvedAddress);
        haptic('success');

        paygram.logTxActivity({
          type: confirm.intentType,
          amount: confirm.amount,
          counterparty: confirm.recipient,
          note: confirm.note,
          txId,
          status: 'pending',
        });

        await paygram.refresh();
        persist(
          loadChatMessages().map((m) =>
            m.id === pendingReceipt.id
              ? {
                  ...m,
                  content: `⏳ ${confirm.intentType === 'tip' ? 'Tipped' : 'Sent'} ${formatUsd(confirm.amount)} to ${confirm.recipient}`,
                  receipt: {
                    intentType: confirm.intentType,
                    amount: confirm.amount,
                    counterparty: confirm.recipient,
                    note: confirm.note,
                    txId,
                    status: 'pending' as const,
                    emoji: '⏳',
                  },
                }
              : m,
          ),
        );
        }
      } catch (err) {
        haptic('error');
        append({ type: 'error', content: formatWalletError(err) });
      } finally {
        setProcessing(false);
      }
    },
    [append, executeSend, executeSwap, me, paygram, persist, removeMessage, walletAddress],
  );

  const cancelConfirm = useCallback(
    (messageId: string) => {
      removeMessage(messageId);
      append({ type: 'system', content: 'Cancelled.' });
    },
    [append, removeMessage],
  );

  const shareReceiptMsg = useCallback((text: string, emoji = '✅') => {
    shareReceipt(text, emoji);
  }, []);

  const inviteFriend = useCallback(() => {
    shareReceipt(
      `Join me on PayGram — pay friends with @username in Telegram!\n${inviteLink()}`,
      '💸',
    );
  }, []);

  const applyQuickAction = useCallback((action: string) => {
    const prompts: Record<string, string> = {
      Send: 'send $25 to @alice for ',
      Tip: 'tip @creator $5',
      Split: 'split $120 with @bob @carol @dave',
      Request: 'request $30 from @bob',
      Collect: 'collect $500 for ',
      Swap: 'swap $50 to SOL',
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
          content: `${recipient} isn't on PayGram yet. Invite them to open the app, then try again.`,
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

  const openRequestDeepLink = useCallback(
    async (amount: number, target: string, note?: string) => {
      // Shared request links open Confirm to PAY the requester (not create another request).
      const recipient = target.startsWith('@') ? target : `@${target}`;
      const address = await resolveRecipient(recipient);
      if (!address || address === '0x') {
        append({
          type: 'error',
          content: `${recipient} isn't on PayGram yet. Invite them to open the app, then try again.`,
        });
        return;
      }
      showConfirm(
        {
          intentType: 'send',
          amount,
          recipient,
          note: note ?? 'Payment request',
          resolvedAddress: address,
          balanceBefore: balance,
        },
        'Confirm payment',
      );
    },
    [append, balance, showConfirm],
  );

  const openSplitDeepLink = useCallback(
    (amount: number, targets: string[]) => {
      const recipients = targets.map((t) => (t.startsWith('@') ? t : `@${t}`));
      showConfirm(
        {
          intentType: 'split',
          amount,
          recipients,
        },
        'Confirm split',
      );
    },
    [showConfirm],
  );

  const shareReceiptToGroup = useCallback(
    async (content: string, details?: { amount: number; recipient?: string; note?: string }) => {
      const chatId = getTelegramChatId();
      if (!chatId) {
        append({ type: 'error', content: 'Open PayGram from a group chat to post receipts here.' });
        return;
      }
      try {
        let imageBase64: string | undefined;
        if (details) {
          const blob = await generateReceiptImage({
            amount: details.amount,
            payer: me,
            recipient: details.recipient,
            note: details.note,
            emoji: '✅',
          });
          imageBase64 = await blobToBase64(blob);
        }
        const ok = await shareReceiptApi({
          chatId,
          text: content,
          imageBase64,
        });
        if (ok) {
          haptic('success');
          append({ type: 'system', content: 'Posted receipt to the group.' });
        } else {
          append({ type: 'error', content: 'Could not post to group — add @paygram_bbot to the group.' });
        }
      } catch (e) {
        append({ type: 'error', content: formatWalletError(e) });
      }
    },
    [append, me],
  );

  const scanReceipt = useCallback(
    async (file: File) => {
      setProcessing(true);
      const scanning = append({
        type: 'assistant',
        content: 'Scanning receipt…',
        assistant: { variant: 'scanning', fileName: file.name },
      });
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const imageBase64 = btoa(binary);
        const parsed = await parseReceiptApi(imageBase64, file.type || 'image/jpeg');
        const msgs = loadChatMessages().filter((m) => m.id !== scanning.id);
        if (!parsed) {
          persist([
            ...msgs,
            {
              id: uid(),
              type: 'error',
              content: 'Could not read receipt. Try a clearer photo or set OPENAI_API_KEY.',
              timestamp: Date.now(),
            },
          ]);
          return;
        }
        const note = parsed.merchant
          ? `${parsed.merchant}${parsed.note ? ` · ${parsed.note}` : ''}`
          : parsed.note ?? 'Receipt split';
        const splitCommand = `split $${parsed.total.toFixed(2)} with @alice @bob`;
        persist([
          ...msgs,
          {
            id: uid(),
            type: 'assistant',
            content: 'Receipt analyzed',
            timestamp: Date.now(),
            assistant: {
              variant: 'analyzed',
              total: parsed.total,
              merchant: parsed.merchant ?? undefined,
              note: parsed.note ?? note,
              splitCommand,
            },
          },
        ]);
        setInput(splitCommand);
      } catch (e) {
        const msgs = loadChatMessages().filter((m) => m.id !== scanning.id);
        persist([
          ...msgs,
          {
            id: uid(),
            type: 'error',
            content: formatWalletError(e),
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setProcessing(false);
      }
    },
    [append, persist],
  );

  const applySplitCommand = useCallback(
    (command: string) => {
      void submitMessage(command);
    },
    [submitMessage],
  );

  return {
    messages,
    input,
    setInput,
    submitMessage,
    confirmPayment,
    cancelConfirm,
    shareReceipt: shareReceiptMsg,
    inviteFriend,
    applySplitCommand,
    groupHint: isGroupChat()
      ? `Group: ${getTelegramChat()?.title ?? 'chat'} — post receipts here after paying`
      : null,
    canShareToGroup: canShareToGroup(),
    processing,
    balance,
    quickActions: QUICK_ACTIONS,
    applyQuickAction,
    openPayDeepLink,
    openPotDeepLink,
    openRequestDeepLink,
    openSplitDeepLink,
    shareReceiptToGroup,
    scanReceipt,
    clearChat,
  };
}
