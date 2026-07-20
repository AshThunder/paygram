import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formatUsd } from '@/lib/constants';
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
  appendChatProgress,
} from '@/lib/storage';
import { mapTxStatus } from '@/lib/txTracker';
import { resolveRecipient } from '@/lib/parser';
import { assertTransferReady, createUsdcSendTransaction } from '@/lib/uaTransfer';
import {
  createActivityApi,
  createPotApi,
  createRequestApi,
  fetchActivityApi,
  fetchPotsApi,
  fetchRequestsApi,
  fetchTabsApi,
  fetchCirclesApi,
  upsertCircleApi,
  listUsersApi,
  markRequestPaidApi,
  sendRemindApi,
  addPotContributorApi,
  updatePotCollectedApi,
  upsertTabApi,
  patchTabApi,
  type SharedActivity,
} from '@/lib/api';
import { scheduleBalanceRefresh } from '@/lib/balanceRefresh';
import { normalizeHandle } from '@/lib/constants';
import {
  loadTabs,
  saveTabs,
  upsertTab,
  type TabDebt,
} from '@/lib/tabs';
import {
  loadCircles,
  saveCircles,
  upsertCircle,
  mergeRemoteCircles,
  type LocalCircle,
} from '@/lib/circles';
import {
  buildContributePotCalls,
  buildCreateBillCalls,
  buildCreatePotCalls,
  buildPayShareCalls,
  buildReleaseIfFundedCalls,
  buildReleasePotCalls,
  buildWithdrawPotCalls,
  equalSplitShares,
  isBillEscrowConfigured,
  isPotConfigured,
  unitsToUsdc,
  readBillOnChain,
  readPotOnChain,
} from '@/lib/contracts';
import { useUniversalAccount } from './UniversalAccountProvider';
import { haptic } from '@/lib/telegram';
import { useAuth } from './AuthProvider';

type PayGramContextType = {
  requests: PaymentRequest[];
  pots: CollectionPot[];
  tabs: TabDebt[];
  circles: LocalCircle[];
  activity: ActivityItem[];
  chainActivity: ActivityItem[];
  refresh: () => Promise<void>;
  logTxActivity: (item: Omit<ActivityItem, 'id' | 'createdAt'>) => ActivityItem;
  syncTab: (debt: TabDebt) => Promise<void>;
  syncCircle: (circle: LocalCircle) => Promise<void>;
  patchTabRemote: (
    id: string,
    patch: { repaid?: number; closed?: boolean; fundTxId?: string },
  ) => Promise<void>;
  createRequest: (
    from: string,
    to: string,
    amount: number,
    note?: string,
    meta?: { onChainBillId?: number; chainId?: number; payeeAddress?: string },
  ) => Promise<PaymentRequest>;
  createSplit: (
    creator: string,
    total: number,
    recipients: string[],
    note?: string,
    creatorAddress?: string,
  ) => Promise<PaymentRequest[]>;
  createPot: (title: string, goal: number, creator: string, creatorAddress?: string) => Promise<CollectionPot>;
  payRequest: (requestId: string) => Promise<{ txId: string }>;
  payAllPending: (forUser: string) => Promise<{ paid: number; txIds: string[] }>;
  contributeToPot: (potId: string, amount: number, contributor: string) => Promise<{ txId: string }>;
  releasePot: (potId: string) => Promise<{ txId?: string }>;
  withdrawFromPot: (potId: string) => Promise<{ txId: string }>;
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
  const { walletAddress, telegramUser, paygramUsername } = useAuth();
  const {
    universalAccount,
    ensureDelegated,
    signAndSend,
    refreshBalance,
    fetchChainActivity,
    executeContractCalls,
    primaryAssets,
  } = useUniversalAccount();

  const me = userHandle(telegramUser?.username, walletAddress, paygramUsername);

  const [requests, setRequests] = useState<PaymentRequest[]>(() => loadRequests());
  const [pots, setPots] = useState<CollectionPot[]>(() => loadPots());
  const [tabs, setTabs] = useState<TabDebt[]>(() => loadTabs());
  const [circles, setCircles] = useState<LocalCircle[]>(() => loadCircles());
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadActivity());
  const [chainActivity, setChainActivity] = useState<ActivityItem[]>([]);

  const syncChainActivity = useCallback(async () => {
    const txs = await fetchChainActivity(1);
    const items: ActivityItem[] = txs.map((tx) => ({
      id: `chain_${tx.transactionId}`,
      type: tx.tag ?? 'on_chain',
      amount: 0,
      note: 'UniversalX',
      txId: tx.transactionId,
      status: mapTxStatus(tx.status),
      createdAt: tx.created_at ? new Date(tx.created_at).getTime() : Date.now(),
    }));
    setChainActivity(items);
  }, [fetchChainActivity]);

  const mergeRemoteActivity = useCallback(
    (remote: SharedActivity[], local: ActivityItem[]): ActivityItem[] => {
      const myKey = normalizeHandle(me);
      const byKey = new Map<string, ActivityItem>();

      const put = (item: ActivityItem) => {
        const key = item.txId ? `tx:${item.txId}` : `id:${item.id}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, item);
          return;
        }
        // Prefer richer local rows (notes) but keep remote status if newer settled.
        byKey.set(key, {
          ...existing,
          ...item,
          note: existing.note && existing.note !== 'UniversalX' ? existing.note : item.note,
          counterparty: existing.counterparty || item.counterparty,
          amount: existing.amount > 0 ? existing.amount : item.amount,
          status:
            existing.status === 'confirmed' || item.status === 'confirmed'
              ? 'confirmed'
              : existing.status === 'failed' || item.status === 'failed'
                ? 'failed'
                : item.status || existing.status,
        });
      };

      for (const item of local) put(item);

      for (const a of remote) {
        const from = normalizeHandle(a.fromUser);
        const to = normalizeHandle(a.toUser);
        const isSender = from === myKey;
        const isReceiver = to === myKey;
        if (!isSender && !isReceiver) continue;

        put({
          id: a.id,
          type: isSender
            ? a.type
            : a.type === 'tip'
              ? 'tip_received'
              : a.type === 'lend'
                ? 'borrow'
                : a.type === 'repay'
                  ? 'repay_received'
                  : /forgive/i.test(a.type)
                    ? a.type
                    : 'receive',
          amount: a.amount,
          counterparty: isSender
            ? a.toUser.startsWith('@')
              ? a.toUser
              : `@${a.toUser}`
            : a.fromUser.startsWith('@')
              ? a.fromUser
              : `@${a.fromUser}`,
          note: a.note,
          txId: a.txId,
          status: a.status,
          createdAt: a.createdAt,
        });
      }

      return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
    },
    [me],
  );

  const refresh = useCallback(async () => {
    const [remoteRequests, remotePots, remoteActivity, remoteTabs, remoteCircles] =
      await Promise.all([
        fetchRequestsApi(me),
        fetchPotsApi(),
        fetchActivityApi(me),
        fetchTabsApi(me),
        fetchCirclesApi(me),
        listUsersApi(),
      ]);

    // Requests: successful fetch (including []) is source of truth — drop local ghosts
    // that inflated "Net with friends" after debts were settled elsewhere.
    if (remoteRequests) {
      const local = loadRequests();
      const byId = new Map<string, PaymentRequest>();
      const now = Date.now();
      for (const r of remoteRequests) byId.set(r.id, r);
      for (const r of local) {
        const remote = byId.get(r.id);
        if (remote) {
          const status =
            remote.status === 'paid' || r.status === 'paid'
              ? 'paid'
              : remote.status === 'cancelled' || r.status === 'cancelled'
                ? 'cancelled'
                : remote.status;
          byId.set(r.id, { ...r, ...remote, status });
        } else if (now - r.createdAt < 2 * 60 * 1000) {
          // Optimistic local create not synced yet
          byId.set(r.id, r);
        }
      }
      const mergedReqs = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
      saveRequests(mergedReqs);
      setRequests(mergedReqs);
    } else {
      setRequests(loadRequests());
    }

    if (remotePots.length) {
      savePots(remotePots);
      setPots(remotePots);
    } else {
      setPots(loadPots());
    }

    // Tabs: remote list for this user wins; keep local closed / repaid when ahead of server.
    if (remoteTabs !== null) {
      const byId = new Map<string, TabDebt>();
      const byChain = new Map<number, string>();
      const now = Date.now();
      for (const t of remoteTabs) {
        byId.set(t.id, t as TabDebt);
        if (t.onChainId != null) byChain.set(t.onChainId, t.id);
      }
      for (const t of loadTabs()) {
        const remoteId = t.onChainId != null ? byChain.get(t.onChainId) : undefined;
        const existing = byId.get(t.id) ?? (remoteId ? byId.get(remoteId) : undefined);
        if (existing) {
          const id = existing.id;
          byId.set(id, {
            ...t,
            ...existing,
            id,
            repaid: Math.max(t.repaid, existing.repaid),
            closed: Boolean(t.closed || existing.closed),
            fundTxId: existing.fundTxId ?? t.fundTxId,
            onChainId: existing.onChainId ?? t.onChainId ?? null,
            chainId: existing.chainId ?? t.chainId ?? null,
          });
        } else if (now - t.createdAt < 2 * 60 * 1000) {
          // Optimistic local tab not on server yet
          byId.set(t.id, t);
        }
      }
      const mergedTabs = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
      saveTabs(mergedTabs);
      setTabs(mergedTabs);
    } else {
      setTabs(loadTabs());
    }

    // Circles were localStorage-only — hydrate from Redis so every device sees the same list.
    const mergedCircles = mergeRemoteCircles(loadCircles(), remoteCircles ?? []);
    saveCircles(mergedCircles);
    setCircles(mergedCircles);

    const merged = mergeRemoteActivity(remoteActivity, loadActivity());
    saveActivity(merged);
    setActivity(merged);
    await Promise.all([syncChainActivity(), refreshBalance()]);
  }, [me, mergeRemoteActivity, syncChainActivity, refreshBalance]);

  useEffect(() => {
    void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    const onFocus = () => void refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const logActivity = useCallback((item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
    const entry: ActivityItem = { ...item, id: uid(), createdAt: Date.now() };
    const next = [entry, ...loadActivity()];
    saveActivity(next);
    setActivity(next);
    return entry;
  }, []);

  const syncTab = useCallback(
    async (debt: TabDebt) => {
      upsertTab(debt);
      setTabs(loadTabs());
      await upsertTabApi(debt);
    },
    [],
  );

  const syncCircle = useCallback(async (circle: LocalCircle) => {
    const saved = upsertCircle(circle);
    setCircles(loadCircles());
    const remote = await upsertCircleApi(saved);
    if (remote) {
      upsertCircle({ ...saved, ...remote, id: remote.id || saved.id });
      setCircles(loadCircles());
    }
  }, []);

  const patchTabRemote = useCallback(
    async (id: string, patch: { repaid?: number; closed?: boolean; fundTxId?: string }) => {
      const { patchTab } = await import('@/lib/tabs');
      patchTab(id, patch);
      setTabs(loadTabs());
      await patchTabApi(id, patch);
      await refresh();
    },
    [refresh],
  );

  const logTxActivity = useCallback(
    (item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
      const entry = logActivity(item);
      const peer = item.counterparty;
      if (
        peer &&
        item.txId &&
        /^(send|tip|checkout|pay|lend|repay|forgive)$/i.test(item.type)
      ) {
        void createActivityApi({
          fromUser: me,
          toUser: peer.startsWith('@') ? peer : `@${peer}`,
          amount: item.amount,
          type: item.type,
          note: item.note,
          txId: item.txId,
          status: item.status,
        }).then(() => {
          void refresh();
        });
      }
      return entry;
    },
    [logActivity, me, refresh],
  );

  const executeTransfer = useCallback(
    async (amount: number, receiverAddress: string) => {
      if (!universalAccount) throw new Error('Wallet not ready');
      const assets = (await refreshBalance()) ?? primaryAssets;
      const receiver = assertTransferReady({
        amount,
        receiver: receiverAddress,
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
      ensureDelegated,
      signAndSend,
      refreshBalance,
      primaryAssets,
      walletAddress,
    ],
  );

  const createRequest = useCallback(
    async (
      from: string,
      to: string,
      amount: number,
      note?: string,
      meta?: { onChainBillId?: number; chainId?: number; payeeAddress?: string },
    ) => {
      const remote = await createRequestApi(from, to, amount, note, meta);
      const req: PaymentRequest = remote ?? {
        id: uid(),
        fromUser: from,
        toUser: to,
        amount,
        note,
        status: 'pending',
        createdAt: Date.now(),
        onChainBillId: meta?.onChainBillId,
        chainId: meta?.chainId,
        payeeAddress: meta?.payeeAddress,
      };
      const next = [req, ...loadRequests().filter((r) => r.id !== req.id)];
      saveRequests(next);
      setRequests(next);
      logActivity({
        type: meta?.onChainBillId != null ? 'split' : 'request',
        amount,
        counterparty: to,
        note:
          meta?.onChainBillId != null
            ? `${note ?? 'Split bill'} · escrow #${meta.onChainBillId}`
            : note,
        status: 'pending',
      });
      return req;
    },
    [logActivity],
  );

  const createSplit = useCallback(
    async (
      creator: string,
      total: number,
      recipients: string[],
      note?: string,
      creatorAddress?: string,
    ) => {
      if (!recipients.length) throw new Error('Add at least one person to split with');

      const shares = equalSplitShares(total, recipients.length);
      let onChainBillId: number | undefined;
      let chainId: number | undefined;
      let createTxId: string | undefined;

      if (isBillEscrowConfigured() && creatorAddress) {
        const payerAddresses: string[] = [];
        for (const handle of recipients) {
          const addr = await resolveRecipient(handle);
          if (!addr || addr === '0x') {
            throw new Error(`${handle} isn't on PayGram yet — invite them first`);
          }
          if (addr.toLowerCase() === creatorAddress.toLowerCase()) {
            throw new Error("You can't include yourself as a payer on the split");
          }
          payerAddresses.push(addr);
        }

        const plan = await buildCreateBillCalls({
          payeeAddress: creatorAddress,
          payerAddresses,
          shareUnits: shares.shareUnits,
        });
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        createTxId = result.transactionId as string;
        onChainBillId = plan.onChainBillId;
        chainId = plan.addresses.chainId;
      }

      const newReqs: PaymentRequest[] = [];
      for (const r of recipients) {
        const req = await createRequest(creator, r, shares.shareUsd, note ?? 'Split bill', {
          onChainBillId,
          chainId,
          payeeAddress: creatorAddress,
        });
        newReqs.push(req);
      }

      if (createTxId) {
        logActivity({
          type: 'split',
          amount: shares.billTotalUsd,
          counterparty: recipients.join(', '),
          note: `${note ?? 'Split bill'} · escrow #${onChainBillId} (${formatUsd(shares.shareUsd)} each)`,
          txId: createTxId,
          status: 'pending',
        });
      }

      return newReqs;
    },
    [createRequest, executeContractCalls, logActivity],
  );

  const createPot = useCallback(async (title: string, goal: number, creator: string, creatorAddress?: string) => {
    let onChainId: number | null = null;
    let chainId: number | null = null;
    let createTxId: string | undefined;

    if (isPotConfigured() && creatorAddress) {
      const plan = await buildCreatePotCalls({
        beneficiaryAddress: creatorAddress,
        goalUsd: goal,
      });
      const result = await executeContractCalls({
        calls: plan.calls,
        chainId: plan.addresses.chainId,
      });
      createTxId = result.transactionId as string;
      onChainId = plan.onChainPotId;
      chainId = plan.addresses.chainId;
    }

    const remote = await createPotApi(title, goal, creator, {
      onChainId: onChainId ?? undefined,
      chainId: chainId ?? undefined,
      beneficiaryAddress: creatorAddress,
      creatorAddress,
    });
    const pot: CollectionPot = remote ?? {
      id: `pot_${uid().slice(0, 8)}`,
      title,
      goal,
      collected: 0,
      creator,
      onChainId,
      chainId,
      beneficiaryAddress: creatorAddress ?? null,
      creatorAddress: creatorAddress ?? null,
      released: false,
      cancelled: false,
      createdAt: Date.now(),
    };
    const next = [pot, ...loadPots().filter((p) => p.id !== pot.id)];
    savePots(next);
    setPots(next);
    logActivity({
      type: 'collect',
      amount: goal,
      note: onChainId != null ? `${title} · pot #${onChainId}` : title,
      txId: createTxId,
      status: createTxId ? 'pending' : 'confirmed',
    });
    return pot;
  }, [executeContractCalls, logActivity]);

  const markRequestPaid = useCallback(async (requestId: string, txId?: string) => {
    const req = loadRequests().find((r) => r.id === requestId);
    const next = loadRequests().map((r) =>
      r.id === requestId ? { ...r, status: 'paid' as const } : r,
    );
    saveRequests(next);
    setRequests(next);
    await markRequestPaidApi(requestId);
    // Flip matching unpaid request rows in the feed to Paid.
    if (req) {
      const updated = loadActivity().map((a) =>
        /request|^split$/i.test(a.type) &&
        a.status === 'pending' &&
        a.amount === req.amount &&
        (a.counterparty === req.toUser || a.note === req.note)
          ? { ...a, status: 'paid' }
          : a,
      );
      saveActivity(updated);
      setActivity(updated);
    }
    if (txId) {
      logActivity({
        type: 'request_paid',
        amount: req?.amount ?? 0,
        counterparty: req?.fromUser,
        txId,
        status: 'pending',
      });
    }
  }, [logActivity]);

  const payRequest = useCallback(
    async (requestId: string) => {
      const req = loadRequests().find((r) => r.id === requestId);
      if (!req) throw new Error('Request not found');

      let txId: string;

      if (req.onChainBillId != null && isBillEscrowConfigured()) {
        const plan = buildPayShareCalls(req.onChainBillId, req.amount);
        const result = await executeContractCalls({
          calls: plan.calls,
          expectUsdc: plan.expectUsdc,
          chainId: plan.addresses.chainId,
        });
        txId = result.transactionId as string;

        // If this was the last share, release escrow to the payee.
        try {
          const bill = await readBillOnChain(req.onChainBillId);
          if (bill && !bill.released && !bill.cancelled && bill.collected >= bill.total) {
            const release = buildReleaseIfFundedCalls(req.onChainBillId);
            await executeContractCalls({
              calls: release.calls,
              chainId: release.addresses.chainId,
            });
          }
        } catch {
          // Pay succeeded; release can be retried by anyone via releaseIfFunded.
        }
      } else {
        const address = await resolveRecipient(req.fromUser);
        if (!address || address === '0x') {
          throw new Error(`${req.fromUser} has no wallet on PayGram`);
        }
        txId = await executeTransfer(req.amount, address);
      }

      await markRequestPaid(requestId, txId);
      haptic('success');
      return { txId };
    },
    [executeContractCalls, executeTransfer, markRequestPaid],
  );

  const contributeToPot = useCallback(
    async (potId: string, amount: number, contributor: string) => {
      const pot = loadPots().find((p) => p.id === potId);
      if (!pot) throw new Error('Collection not found');
      if (pot.released || pot.cancelled) throw new Error('Pot is closed');

      let txId: string;
      if (pot.onChainId != null && isPotConfigured()) {
        const plan = buildContributePotCalls(pot.onChainId, amount);
        const result = await executeContractCalls({
          calls: plan.calls,
          expectUsdc: plan.expectUsdc,
          chainId: plan.addresses.chainId,
        });
        txId = result.transactionId as string;
        const onChain = await readPotOnChain(pot.onChainId);
        if (onChain) {
          const collected = unitsToUsdc(onChain.collected);
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
        }
      } else {
        const address = await resolveRecipient(pot.creator);
        if (!address || address === '0x') {
          throw new Error(`Creator ${pot.creator} has no wallet`);
        }
        txId = await executeTransfer(amount, address);
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
      }

      logActivity({
        type: 'contribute',
        amount,
        counterparty: pot.creator,
        note: pot.onChainId != null ? `${pot.title} · pot #${pot.onChainId}` : pot.title,
        txId,
        status: 'pending',
      });
      const updated = loadPots().find((p) => p.id === potId);
      const collected = updated?.collected ?? pot.collected + amount;
      appendChatProgress(
        `${contributor} paid ${formatUsd(amount)} toward ${pot.title} (${formatUsd(collected)} / ${formatUsd(pot.goal)})`,
      );
      haptic('success');
      return { txId };
    },
    [executeContractCalls, executeTransfer, logActivity],
  );

  const releasePot = useCallback(
    async (potId: string) => {
      const pot = loadPots().find((p) => p.id === potId);
      if (!pot) throw new Error('Collection not found');
      if (pot.released) throw new Error('Already released');

      let txId: string | undefined;
      if (pot.onChainId != null && isPotConfigured()) {
        const ifFunded = pot.collected >= pot.goal;
        const plan = buildReleasePotCalls(pot.onChainId, ifFunded);
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        txId = result.transactionId as string;
      }

      const next = loadPots().map((p) =>
        p.id === potId ? { ...p, released: true } : p,
      );
      savePots(next);
      setPots(next);
      await updatePotCollectedApi(potId, pot.collected, { released: true });
      logActivity({
        type: 'pot_release',
        amount: pot.collected,
        note: pot.title,
        txId,
        status: txId ? 'pending' : 'confirmed',
      });
      haptic('success');
      return { txId };
    },
    [executeContractCalls, logActivity],
  );

  const withdrawFromPot = useCallback(
    async (potId: string) => {
      const pot = loadPots().find((p) => p.id === potId);
      if (!pot) throw new Error('Collection not found');
      if (pot.onChainId == null || !isPotConfigured()) {
        throw new Error('Withdraw is only available for on-chain pots');
      }
      const plan = buildWithdrawPotCalls(pot.onChainId);
      const result = await executeContractCalls({
        calls: plan.calls,
        chainId: plan.addresses.chainId,
      });
      const txId = result.transactionId as string;
      const onChain = await readPotOnChain(pot.onChainId);
      const collected = onChain ? unitsToUsdc(onChain.collected) : pot.collected;
      const next = loadPots().map((p) => (p.id === potId ? { ...p, collected } : p));
      savePots(next);
      setPots(next);
      await updatePotCollectedApi(potId, collected);
      logActivity({
        type: 'pot_withdraw',
        amount: Math.max(0, pot.collected - collected),
        note: pot.title,
        txId,
        status: 'pending',
      });
      haptic('success');
      return { txId };
    },
    [executeContractCalls, logActivity],
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
    // Avoid duplicate remind rows for the same request within a short window.
    const recent = loadActivity().some(
      (a) =>
        a.type === 'remind' &&
        a.counterparty === req.toUser &&
        Math.abs(a.createdAt - Date.now()) < 60_000,
    );
    if (!recent) {
      logActivity({
        type: 'remind',
        amount: 0,
        counterparty: req.toUser,
        note: sent
          ? `Reminder sent to ${req.toUser}`
          : `Reminder logged for ${req.toUser}`,
        status: sent ? 'confirmed' : 'pending',
      });
    }
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
        logActivity({
          type: 'batch_pay',
          amount: req.amount,
          counterparty: req.fromUser,
          note: req.note,
          txId,
          status: 'pending',
        });
      }
      await syncChainActivity();
      return { paid: txIds.length, txIds };
    },
    [payRequest, logActivity, syncChainActivity],
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
      tabs,
      circles,
      activity,
      chainActivity,
      refresh,
      logTxActivity,
      syncTab,
      syncCircle,
      patchTabRemote,
      createRequest,
      createSplit,
      createPot,
      payRequest,
      payAllPending,
      contributeToPot,
      releasePot,
      withdrawFromPot,
      remindRequest,
      markRequestPaid,
      getPendingForUser,
    }),
    [
      requests,
      pots,
      tabs,
      circles,
      activity,
      chainActivity,
      refresh,
      logTxActivity,
      syncTab,
      syncCircle,
      patchTabRemote,
      createRequest,
      createSplit,
      createPot,
      payRequest,
      payAllPending,
      contributeToPot,
      releasePot,
      withdrawFromPot,
      remindRequest,
      markRequestPaid,
      getPendingForUser,
    ],
  );

  return <PayGramContext.Provider value={value}>{children}</PayGramContext.Provider>;
}

export function userHandle(
  telegramUsername?: string | null,
  walletAddress?: string | null,
  claimedUsername?: string | null,
): string {
  const handle = claimedUsername || telegramUsername;
  if (handle) return handle.startsWith('@') ? handle : `@${handle}`;
  if (walletAddress) return shortenForHandle(walletAddress);
  return 'you';
}

function shortenForHandle(addr: string): string {
  return `@${addr.slice(2, 8)}`;
}
