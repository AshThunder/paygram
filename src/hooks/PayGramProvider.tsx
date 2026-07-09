import { CHAIN_ID } from '@particle-network/universal-account-sdk';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { USDC_ARBITRUM } from '@/lib/constants';
import {
  type ActivityItem,
  type CollectionPot,
  type PaymentRequest,
  loadActivity,
  loadPots,
  loadRequests,
  saveActivity,
  savePots,
  saveRequests,
  uid,
} from '@/lib/storage';
import { resolveRecipient } from '@/lib/parser';
import {
  createGiftApi,
  createPotApi,
  createRequestApi,
  fetchPotsApi,
  fetchRequestsApi,
  listUsersApi,
  markRequestPaidApi,
  sendRemindApi,
  addPotContributorApi,
  updatePotCollectedApi,
} from '@/lib/api';
import { useUniversalAccount } from './UniversalAccountProvider';
import { haptic } from '@/lib/telegram';

export type GiftLink = {
  id: string;
  amount: number;
  creator: string;
  creatorAddress: string;
  claimed: boolean;
  createdAt: number;
};

function loadGifts(): GiftLink[] {
  try {
    const raw = localStorage.getItem('paygram_gifts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGifts(gifts: GiftLink[]): void {
  localStorage.setItem('paygram_gifts', JSON.stringify(gifts));
}

type PayGramContextType = {
  requests: PaymentRequest[];
  pots: CollectionPot[];
  activity: ActivityItem[];
  gifts: GiftLink[];
  refresh: () => Promise<void>;
  createRequest: (from: string, to: string, amount: number, note?: string) => Promise<PaymentRequest>;
  createSplit: (creator: string, total: number, recipients: string[], note?: string) => Promise<PaymentRequest[]>;
  createPot: (title: string, goal: number, creator: string) => Promise<CollectionPot>;
  createGift: (amount: number, creator: string, creatorAddress: string) => Promise<GiftLink>;
  payRequest: (requestId: string) => Promise<{ txId: string }>;
  payAllPending: (forUser: string) => Promise<{ paid: number; txIds: string[] }>;
  contributeToPot: (potId: string, amount: number, contributor: string) => Promise<{ txId: string }>;
  remindRequest: (requestId: string) => Promise<void>;
  markRequestPaid: (requestId: string, txId?: string) => void;
  getPendingForUser: (username?: string) => PaymentRequest[];
};

const PayGramContext = createContext<PayGramContextType | null>(null);

export function usePayGram() {
  const ctx = useContext(PayGramContext);
  if (!ctx) throw new Error('usePayGram must be used within PayGramProvider');
  return ctx;
}

export function PayGramProvider({ children }: { children: ReactNode }) {
  const { universalAccount, ensureDelegated, signAndSend, refreshBalance } = useUniversalAccount();

  const [requests, setRequests] = useState<PaymentRequest[]>(() => loadRequests());
  const [pots, setPots] = useState<CollectionPot[]>(() => loadPots());
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadActivity());
  const [gifts, setGifts] = useState<GiftLink[]>(() => loadGifts());

  const refresh = useCallback(async () => {
    const [remoteRequests, remotePots] = await Promise.all([
      fetchRequestsApi(),
      fetchPotsApi(),
      listUsersApi(),
    ]);
    if (remoteRequests.length) {
      saveRequests(remoteRequests);
      setRequests(remoteRequests);
    } else {
      setRequests(loadRequests());
    }
    if (remotePots.length) {
      savePots(remotePots);
      setPots(remotePots);
    } else {
      setPots(loadPots());
    }
    setActivity(loadActivity());
    setGifts(loadGifts());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logActivity = useCallback((item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
    const entry: ActivityItem = { ...item, id: uid(), createdAt: Date.now() };
    const next = [entry, ...loadActivity()];
    saveActivity(next);
    setActivity(next);
    return entry;
  }, []);

  const executeTransfer = useCallback(
    async (amount: number, receiverAddress: string) => {
      if (!universalAccount) throw new Error('Wallet not ready');
      await ensureDelegated();
      const transaction = await universalAccount.createTransferTransaction({
        token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM },
        amount: String(amount),
        receiver: receiverAddress,
      });
      const result = await signAndSend(transaction as { rootHash: string; userOps?: unknown[] });
      await refreshBalance();
      return result.transactionId;
    },
    [universalAccount, ensureDelegated, signAndSend, refreshBalance],
  );

  const createRequest = useCallback(async (from: string, to: string, amount: number, note?: string) => {
    const remote = await createRequestApi(from, to, amount, note);
    const req: PaymentRequest = remote ?? {
      id: uid(),
      fromUser: from,
      toUser: to,
      amount,
      note,
      status: 'pending',
      createdAt: Date.now(),
    };
    const next = [req, ...loadRequests().filter((r) => r.id !== req.id)];
    saveRequests(next);
    setRequests(next);
    logActivity({ type: 'request', amount, counterparty: to, note, status: 'pending' });
    return req;
  }, [logActivity]);

  const createSplit = useCallback(async (creator: string, total: number, recipients: string[], note?: string) => {
    const perPerson = total / recipients.length;
    const newReqs: PaymentRequest[] = [];
    for (const r of recipients) {
      const req = await createRequest(creator, r, perPerson, note ?? 'Split bill');
      newReqs.push(req);
    }
    logActivity({ type: 'split', amount: total, counterparty: recipients.join(', '), note, status: 'pending' });
    return newReqs;
  }, [createRequest, logActivity]);

  const createPot = useCallback(async (title: string, goal: number, creator: string) => {
    const remote = await createPotApi(title, goal, creator);
    const pot: CollectionPot = remote ?? {
      id: `pot_${uid().slice(0, 8)}`,
      title,
      goal,
      collected: 0,
      creator,
      createdAt: Date.now(),
    };
    const next = [pot, ...loadPots().filter((p) => p.id !== pot.id)];
    savePots(next);
    setPots(next);
    logActivity({ type: 'collect', amount: goal, note: title, status: 'pending' });
    return pot;
  }, [logActivity]);

  const createGift = useCallback(async (amount: number, creator: string, creatorAddress: string) => {
    const remote = await createGiftApi(amount, creator, creatorAddress);
    const gift: GiftLink = remote ?? {
      id: uid().slice(0, 8),
      amount,
      creator,
      creatorAddress,
      claimed: false,
      createdAt: Date.now(),
    };
    const next = [gift, ...loadGifts().filter((g) => g.id !== gift.id)];
    saveGifts(next);
    setGifts(next);
    logActivity({ type: 'gift', amount, status: 'pending' });
    return gift;
  }, [logActivity]);

  const markRequestPaid = useCallback(async (requestId: string, txId?: string) => {
    const next = loadRequests().map((r) =>
      r.id === requestId ? { ...r, status: 'paid' as const } : r,
    );
    saveRequests(next);
    setRequests(next);
    await markRequestPaidApi(requestId);
    if (txId) {
      logActivity({
        type: 'request_paid',
        amount: next.find((r) => r.id === requestId)?.amount ?? 0,
        txId,
        status: 'confirmed',
      });
    }
  }, [logActivity]);

  const payRequest = useCallback(
    async (requestId: string) => {
      const req = loadRequests().find((r) => r.id === requestId);
      if (!req) throw new Error('Request not found');
      const address = await resolveRecipient(req.fromUser);
      if (!address || address === '0x') {
        throw new Error(`${req.fromUser} has no wallet on PayGram`);
      }
      const txId = await executeTransfer(req.amount, address);
      await markRequestPaid(requestId, txId);
      haptic('success');
      return { txId };
    },
    [executeTransfer, markRequestPaid],
  );

  const contributeToPot = useCallback(
    async (potId: string, amount: number, contributor: string) => {
      const pot = loadPots().find((p) => p.id === potId);
      if (!pot) throw new Error('Collection not found');
      const address = await resolveRecipient(pot.creator);
      if (!address || address === '0x') {
        throw new Error(`Creator ${pot.creator} has no wallet`);
      }
      const txId = await executeTransfer(amount, address);
      const collected = pot.collected + amount;
      const contributors = [...(pot.contributors ?? [])];
      const existing = contributors.find((c) => c.user === contributor);
      if (existing) existing.amount += amount;
      else contributors.push({ user: contributor, amount });
      contributors.sort((a, b) => b.amount - a.amount);

      const next = loadPots().map((p) =>
        p.id === potId ? { ...p, collected, contributors } : p,
      );
      savePots(next);
      setPots(next);
      await updatePotCollectedApi(potId, collected);
      await addPotContributorApi(potId, contributor, amount, collected);
      logActivity({
        type: 'contribute',
        amount,
        counterparty: pot.creator,
        note: pot.title,
        txId,
        status: 'confirmed',
      });
      haptic('success');
      return { txId };
    },
    [executeTransfer, logActivity],
  );

  const remindRequest = useCallback(async (requestId: string) => {
    const req = loadRequests().find((r) => r.id === requestId);
    if (!req) return;
    const sent = await sendRemindApi({
      targetUsername: req.toUser,
      amount: req.amount,
      fromUser: req.fromUser,
      note: req.note,
    });
    logActivity({
      type: 'remind',
      amount: req.amount,
      counterparty: req.toUser,
      note: sent ? `Telegram reminder sent to ${req.toUser}` : `Reminder logged for ${req.toUser}`,
      status: sent ? 'confirmed' : 'pending',
    });
    haptic('light');
  }, [logActivity]);

  const payAllPending = useCallback(
    async (forUser: string) => {
      const handle = forUser.startsWith('@') ? forUser : `@${forUser}`;
      const pending = loadRequests().filter(
        (r) => r.status === 'pending' && r.toUser.toLowerCase() === handle.toLowerCase(),
      );
      const txIds: string[] = [];
      for (const req of pending) {
        const { txId } = await payRequest(req.id);
        txIds.push(txId);
      }
      return { paid: txIds.length, txIds };
    },
    [payRequest],
  );

  const getPendingForUser = useCallback(
    (username?: string) => {
      const handle = username ? `@${username.replace('@', '')}` : null;
      if (!handle) return [];
      return requests.filter((r) => r.status === 'pending' && r.toUser.toLowerCase() === handle.toLowerCase());
    },
    [requests],
  );

  const value = useMemo(
    () => ({
      requests,
      pots,
      activity,
      gifts,
      refresh,
      createRequest,
      createSplit,
      createPot,
      createGift,
      payRequest,
      payAllPending,
      contributeToPot,
      remindRequest,
      markRequestPaid,
      getPendingForUser,
    }),
    [
      requests,
      pots,
      activity,
      gifts,
      refresh,
      createRequest,
      createSplit,
      createPot,
      createGift,
      payRequest,
      payAllPending,
      contributeToPot,
      remindRequest,
      markRequestPaid,
      getPendingForUser,
    ],
  );

  return <PayGramContext.Provider value={value}>{children}</PayGramContext.Provider>;
}

export function userHandle(telegramUsername?: string, walletAddress?: string | null): string {
  if (telegramUsername) return `@${telegramUsername}`;
  if (walletAddress) return shortenForHandle(walletAddress);
  return 'you';
}

function shortenForHandle(addr: string): string {
  return `@${addr.slice(2, 8)}`;
}
