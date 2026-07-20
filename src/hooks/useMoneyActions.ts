import { useCallback, useState } from 'react';
import { formatWalletError, formatUsd } from '@/lib/constants';
import { resolveRecipient } from '@/lib/parser';
import { addRecurringTip } from '@/lib/recurringTips';
import { createLocalCircle, loadCircles, patchCircle } from '@/lib/circles';
import { shareUrl } from '@/lib/telegram';
import { requestLink } from '@/lib/links';
import { assertTransferReady, createUsdcSendTransaction, spendableUsd } from '@/lib/uaTransfer';
import { scheduleBalanceRefresh } from '@/lib/balanceRefresh';
import {
  buildForgiveCalls,
  buildLendCalls,
  buildRepayCalls,
  isTabConfigured,
} from '@/lib/contracts';
import { outstandingUsd, uidTab, upsertTab, tabPartyEq, type TabDebt } from '@/lib/tabs';
import { useAuth } from '@/hooks/AuthProvider';
import { usePayGram, userHandle } from '@/hooks/PayGramProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { useFriends } from '@/hooks/useFriends';
import { useToast } from '@/hooks/ToastProvider';

export type ActionResult = {
  ok: true;
  message: string;
  txId?: string;
  link?: string;
  id?: string;
  onChainId?: number | null;
};

export function useMoneyActions() {
  const paygram = usePayGram();
  const { telegramUser, walletAddress, paygramUsername } = useAuth();
  const { rememberHandle } = useFriends();
  const toast = useToast();
  const {
    universalAccount,
    ensureDelegated,
    signAndSend,
    refreshBalance,
    initError,
    executeSwap,
    executeContractCalls,
    primaryAssets,
  } = useUniversalAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = userHandle(telegramUser?.username, walletAddress, paygramUsername);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setBusy(true);
      setError(null);
      try {
        const result = await fn();
        if (result && typeof result === 'object' && 'message' in result) {
          const msg = (result as { message?: string }).message;
          if (msg) toast.success(msg);
        }
        return result;
      } catch (e) {
        // Sticky ErrorActionBanner on forms — skip toast to avoid duplicate copy.
        setError(formatWalletError(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const sendUsdc = useCallback(
    async (amount: number, toAddress: string) => {
      if (!universalAccount) throw new Error(initError || 'Wallet not ready');
      const refreshed = await refreshBalance();
      const assets =
        refreshed && spendableUsd(refreshed) >= 0.01
          ? refreshed
          : (primaryAssets ?? refreshed);
      const receiver = assertTransferReady({
        amount,
        receiver: toAddress,
        sender: walletAddress,
        assets,
      });
      await ensureDelegated({ assets });
      const transaction = await createUsdcSendTransaction(universalAccount, amount, receiver);
      const result = await signAndSend(transaction);
      await refreshBalance();
      scheduleBalanceRefresh(refreshBalance);
      return result.transactionId as string;
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

  const sendMoney = useCallback(
    async (opts: { amount: number; recipient: string; note?: string; asTip?: boolean }) => {
      return run(async () => {
        const address = await resolveRecipient(opts.recipient);
        if (!address || address === '0x') {
          throw new Error(`${opts.recipient} isn't on PayGram yet. Invite them first.`);
        }
        const txId = await sendUsdc(opts.amount, address);
        const type = opts.asTip ? 'tip' : 'send';
        paygram.logTxActivity({
          type,
          amount: opts.amount,
          counterparty: opts.recipient,
          note: opts.note,
          txId,
          status: 'pending',
        });
        void rememberHandle(opts.recipient);
        await paygram.refresh();
        return {
          ok: true as const,
          message: `${opts.asTip ? 'Tip' : 'Send'} of $${opts.amount} to ${opts.recipient} submitted`,
          txId,
        };
      });
    },
    [paygram, rememberHandle, run, sendUsdc],
  );

  const requestMoney = useCallback(
    async (opts: { amount: number; from: string; note?: string }) => {
      return run(async () => {
        await paygram.createRequest(me, opts.from, opts.amount, opts.note);
        const username = paygramUsername ?? me.replace(/^@/, '');
        const link = requestLink(username, opts.amount, opts.note);
        shareUrl(link, `Pay me ${formatUsd(opts.amount)} on PayGram`);
        return {
          ok: true as const,
          message: `Requested $${opts.amount} from ${opts.from} — share link opened`,
          link,
        };
      });
    },
    [me, paygram, paygramUsername, run],
  );

  const splitBill = useCallback(
    async (opts: { total: number; recipients: string[]; note?: string }) => {
      return run(async () => {
        if (!walletAddress) throw new Error('Wallet not ready');
        const reqs = await paygram.createSplit(
          me,
          opts.total,
          opts.recipients,
          opts.note,
          walletAddress,
        );
        const onChain = reqs[0]?.onChainBillId;
        const share = reqs[0]?.amount;
        return {
          ok: true as const,
          message:
            onChain != null
              ? `Split $${opts.total} on-chain (escrow #${onChain}) — ${opts.recipients.length}× ${formatUsd(share ?? 0)}`
              : `Split $${opts.total} across ${opts.recipients.length} people`,
        };
      });
    },
    [me, paygram, run, walletAddress],
  );

  const createCollection = useCallback(
    async (opts: { goal: number; title: string }) => {
      return run(async () => {
        if (!walletAddress) throw new Error('Wallet not ready');
        const pot = await paygram.createPot(opts.title, opts.goal, me, walletAddress);
        return {
          ok: true as const,
          message:
            pot.onChainId != null
              ? `Pot “${opts.title}” created on-chain (#${pot.onChainId})`
              : `Collection “${opts.title}” created`,
          id: pot.id,
        };
      });
    },
    [me, paygram, run, walletAddress],
  );

  const contribute = useCallback(
    async (opts: { potId: string; amount: number }) => {
      return run(async () => {
        const { txId } = await paygram.contributeToPot(opts.potId, opts.amount, me);
        return {
          ok: true as const,
          message: `Contributed $${opts.amount}`,
          txId,
        };
      });
    },
    [me, paygram, run],
  );

  const swapTokens = useCallback(
    async (opts: { amount: number; toToken: string }) => {
      return run(async () => {
        const { transactionId: txId } = await executeSwap(opts.amount, opts.toToken);
        paygram.logTxActivity({
          type: 'swap',
          amount: opts.amount,
          note: `→ ${opts.toToken}`,
          txId,
          status: 'pending',
        });
        return {
          ok: true as const,
          message: `Swap $${opts.amount} → ${opts.toToken} submitted`,
          txId,
        };
      });
    },
    [executeSwap, paygram, run],
  );

  const remind = useCallback(
    async (requestId: string) => {
      return run(async () => {
        await paygram.remindRequest(requestId);
        return { ok: true as const, message: 'Reminder sent' };
      });
    },
    [paygram, run],
  );

  const scheduleRecurringTip = useCallback(
    async (opts: { amount: number; recipient: string; intervalDays?: number }) => {
      return run(async () => {
        addRecurringTip(opts.recipient, opts.amount, opts.intervalDays ?? 7);
        return {
          ok: true as const,
          message: `Weekly tip reminder: $${opts.amount} to ${opts.recipient}`,
        };
      });
    },
    [run],
  );

  const createCircle = useCallback(
    async (opts: {
      name: string;
      contribution: number;
      /** Saved friends to invite (must already be on PayGram). */
      inviteHandles: string[];
      roundPeriodSec?: number;
    }) => {
      return run(async () => {
        if (!walletAddress) throw new Error('Wallet not ready');
        const meHandle = me.startsWith('@') ? me : `@${me}`;
        const invites = opts.inviteHandles
          .map((m) => (m.startsWith('@') ? m : `@${m}`))
          .filter((h) => h.toLowerCase() !== meHandle.toLowerCase());
        if (invites.length < 1) {
          throw new Error('Invite at least one saved friend');
        }

        const inviteAddresses: string[] = [];
        for (const h of invites) {
          const addr = await resolveRecipient(h);
          if (!addr || addr === '0x') {
            throw new Error(`${h} isn't on PayGram yet — they need to open the app first`);
          }
          inviteAddresses.push(addr);
        }

        let onChainId: number | null = null;
        let chainId: number | null = null;
        let txId: string | undefined;
        const period = opts.roundPeriodSec;

        const {
          isRoscaConfigured,
          buildCreateCircleCalls,
          DEFAULT_ROSCA_PERIOD_SEC,
        } = await import('@/lib/contracts');
        const { sendCircleInviteApi } = await import('@/lib/api');

        if (isRoscaConfigured()) {
          const plan = await buildCreateCircleCalls({
            contributionUsd: opts.contribution,
            roundPeriodSec: period ?? DEFAULT_ROSCA_PERIOD_SEC,
            inviteAddresses,
          });
          const result = await executeContractCalls({
            calls: plan.calls,
            chainId: plan.addresses.chainId,
          });
          txId = result.transactionId as string;
          onChainId = plan.onChainCircleId;
          chainId = plan.addresses.chainId;

          for (const h of invites) {
            void sendCircleInviteApi({
              targetUsername: h,
              circleId: onChainId,
              circleName: opts.name,
              contribution: opts.contribution,
              fromUser: meHandle,
            }).catch(() => undefined);
          }
        }

        const circle = createLocalCircle({
          name: opts.name,
          contribution: opts.contribution,
          members: [meHandle],
          pendingInvites: invites,
          onChainId,
          chainId,
          memberAddresses: [walletAddress],
          pendingAddresses: inviteAddresses,
          creatorAddress: walletAddress,
          creatorHandle: meHandle,
          roundPeriodSec: period ?? (await import('@/lib/contracts')).DEFAULT_ROSCA_PERIOD_SEC,
          status: 'forming',
        });
        await paygram.syncCircle(circle);

        paygram.logTxActivity({
          type: 'circle_create',
          amount: opts.contribution,
          note:
            onChainId != null
              ? `${opts.name} · rosca #${onChainId} · ${invites.length} invited`
              : opts.name,
          txId,
          status: txId ? 'pending' : 'confirmed',
        });

        return {
          ok: true as const,
          message:
            onChainId != null
              ? `Circle “${circle.name}” created — invites sent (#${onChainId})`
              : `Circle “${circle.name}” created locally (on-chain ROSCA not configured)`,
          id: circle.id,
          onChainId,
          txId,
        };
      });
    },
    [executeContractCalls, me, paygram, run, walletAddress],
  );

  const acceptCircleInvite = useCallback(
    async (onChainCircleId: number) => {
      return run(async () => {
        if (!walletAddress) throw new Error('Wallet not ready');
        const {
          buildAcceptInviteCalls,
          readCircleOnChain,
          unitsToUsdc,
          DEFAULT_ROSCA_PERIOD_SEC,
        } = await import('@/lib/contracts');
        const plan = buildAcceptInviteCalls(onChainCircleId);
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        const onChain = await readCircleOnChain(onChainCircleId);
        const meHandle = me.startsWith('@') ? me : `@${me}`;
        if (onChain) {
          const { fetchCirclesApi } = await import('@/lib/api');
          const { reconcileCircleWithOnChain } = await import('@/lib/circles');
          const contribution = unitsToUsdc(onChain.contribution);
          const { upsertCircle } = await import('@/lib/circles');
          const remote = (await fetchCirclesApi(meHandle)).find(
            (c) => c.onChainId === onChainCircleId,
          );
          // Prefer creator’s shared row so pending invites clear for everyone.
          if (remote) upsertCircle({ ...remote, pendingInvites: remote.pendingInvites ?? [] });

          const existing = loadCircles().find((c) => c.onChainId === onChainCircleId);
          let circle;
          if (existing) {
            const patched = patchCircle(existing.id, {
              name: existing.name || remote?.name || `Circle #${onChainCircleId}`,
              members: existing.members.includes(meHandle)
                ? existing.members
                : [...existing.members, meHandle],
              memberCount: onChain.memberCount,
              pendingInvites:
                onChain.pendingInvites.length === 0
                  ? []
                  : (existing.pendingInvites ?? []).filter(
                      (h) => h.toLowerCase() !== meHandle.toLowerCase(),
                    ),
              pendingAddresses:
                onChain.pendingInvites.length === 0 ? [] : existing.pendingAddresses,
              status: onChain.started ? 'active' : 'forming',
              onChainId: onChainCircleId,
              chainId: plan.addresses.chainId,
              memberAddresses: onChain.members,
              creatorAddress: onChain.creator,
            });
            circle = patched ? reconcileCircleWithOnChain(patched, onChain) : null;
          } else {
            circle = reconcileCircleWithOnChain(
              createLocalCircle({
                name: remote?.name ?? `Circle #${onChainCircleId}`,
                contribution,
                members: [meHandle],
                pendingInvites: [],
                onChainId: onChainCircleId,
                chainId: plan.addresses.chainId,
                memberAddresses: onChain.members,
                creatorAddress: onChain.creator,
                roundPeriodSec: onChain.roundPeriod || DEFAULT_ROSCA_PERIOD_SEC,
                status: onChain.started ? 'active' : 'forming',
              }),
              onChain,
            );
          }
          if (circle) {
            if (remote?.id) circle = { ...circle, id: remote.id };
            await paygram.syncCircle(circle);
          }
        }
        return {
          ok: true as const,
          message: `Joined circle #${onChainCircleId}`,
          txId: result.transactionId as string,
        };
      });
    },
    [executeContractCalls, me, paygram, run, walletAddress],
  );

  const declineCircleInvite = useCallback(
    async (onChainCircleId: number) => {
      return run(async () => {
        const { buildDeclineInviteCalls } = await import('@/lib/contracts');
        const plan = buildDeclineInviteCalls(onChainCircleId);
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        return {
          ok: true as const,
          message: `Declined invite to circle #${onChainCircleId}`,
          txId: result.transactionId as string,
        };
      });
    },
    [executeContractCalls, run],
  );

  const inviteToCircle = useCallback(
    async (opts: { circleId: string; handle: string }) => {
      return run(async () => {
        const all = loadCircles();
        const circle = all.find((c) => c.id === opts.circleId);
        if (!circle?.onChainId) throw new Error('Circle not on-chain');
        const handle = opts.handle.startsWith('@') ? opts.handle : `@${opts.handle}`;
        const addr = await resolveRecipient(handle);
        if (!addr || addr === '0x') {
          throw new Error(`${handle} isn't on PayGram yet`);
        }
        const { buildInviteMemberCalls } = await import('@/lib/contracts');
        const { sendCircleInviteApi } = await import('@/lib/api');
        const plan = buildInviteMemberCalls(circle.onChainId, addr);
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        const updated = patchCircle(circle.id, {
          pendingInvites: [...(circle.pendingInvites ?? []), handle],
          pendingAddresses: [...(circle.pendingAddresses ?? []), addr],
        });
        if (updated) await paygram.syncCircle(updated);
        void sendCircleInviteApi({
          targetUsername: handle,
          circleId: circle.onChainId,
          circleName: circle.name,
          contribution: circle.contribution,
          fromUser: me,
        }).catch(() => undefined);
        return {
          ok: true as const,
          message: `Invited ${handle}`,
          txId: result.transactionId as string,
        };
      });
    },
    [executeContractCalls, me, paygram, run],
  );

  const revokeCircleInvite = useCallback(
    async (opts: { circleId: string; handle: string }) => {
      return run(async () => {
        const all = loadCircles();
        const circle = all.find((c) => c.id === opts.circleId);
        if (!circle?.onChainId) throw new Error('Circle not on-chain');
        const handle = opts.handle.startsWith('@') ? opts.handle : `@${opts.handle}`;
        const addr =
          circle.pendingAddresses?.[
            (circle.pendingInvites ?? []).findIndex((h) => h.toLowerCase() === handle.toLowerCase())
          ] ?? (await resolveRecipient(handle));
        if (!addr || addr === '0x') throw new Error(`Could not resolve ${handle}`);
        const { buildRevokeInviteCalls } = await import('@/lib/contracts');
        const plan = buildRevokeInviteCalls(circle.onChainId, addr);
        const result = await executeContractCalls({
          calls: plan.calls,
          chainId: plan.addresses.chainId,
        });
        const idx = (circle.pendingInvites ?? []).findIndex(
          (h) => h.toLowerCase() === handle.toLowerCase(),
        );
        const pendingInvites = [...(circle.pendingInvites ?? [])];
        const pendingAddresses = [...(circle.pendingAddresses ?? [])];
        if (idx >= 0) {
          pendingInvites.splice(idx, 1);
          if (pendingAddresses[idx]) pendingAddresses.splice(idx, 1);
        }
        const updated = patchCircle(circle.id, { pendingInvites, pendingAddresses });
        if (updated) await paygram.syncCircle(updated);
        return {
          ok: true as const,
          message: `Revoked invite for ${handle}`,
          txId: result.transactionId as string,
        };
      });
    },
    [executeContractCalls, paygram, run],
  );

  const contributeToCircle = useCallback(
    async (opts: { circleId: string }) => {
      return run(async () => {
        const { loadCircles, patchCircle } = await import('@/lib/circles');
        const {
          isRoscaConfigured,
          buildContributeCircleCalls,
          readCircleOnChain,
        } = await import('@/lib/contracts');

        const circle = loadCircles().find((c) => c.id === opts.circleId);
        if (!circle) throw new Error('Circle not found');
        if (circle.status === 'completed' || circle.status === 'dissolved') {
          throw new Error('Circle is closed');
        }

        if (circle.onChainId == null || !isRoscaConfigured()) {
          throw new Error('On-chain Rosca not configured for this circle');
        }

        const plan = buildContributeCircleCalls(circle.onChainId, circle.contribution);
        const result = await executeContractCalls({
          calls: plan.calls,
          expectUsdc: plan.expectUsdc,
          chainId: plan.addresses.chainId,
        });
        const txId = result.transactionId as string;

        const onChain = await readCircleOnChain(circle.onChainId);
        if (onChain) {
          let status: import('@/lib/circles').CircleStatus = 'active';
          if (onChain.completed) status = 'completed';
          else if (onChain.cancelled) status = 'dissolved';
          else if (onChain.roundDeadline === 0 && onChain.started) status = 'paused';
          else if (!onChain.started) status = 'forming';

          const updated = patchCircle(circle.id, {
            currentRound: onChain.currentRound,
            paidRounds: onChain.paidRounds,
            status,
            roundDeadline: onChain.roundDeadline ? onChain.roundDeadline * 1000 : undefined,
            memberCount: onChain.memberCount,
          });
          if (updated) await paygram.syncCircle(updated);
        } else {
          const updated = patchCircle(circle.id, { status: 'active' });
          if (updated) await paygram.syncCircle(updated);
        }

        paygram.logTxActivity({
          type: 'circle_contribute',
          amount: circle.contribution,
          note: `${circle.name} · round`,
          txId,
          status: 'pending',
        });

        return {
          ok: true as const,
          message: `Contributed $${circle.contribution} to ${circle.name}`,
          txId,
        };
      });
    },
    [executeContractCalls, paygram, run],
  );

  /** Lend USDC — PayGramTab when VITE_TAB set, else transfer + local IOU. */
  const lendMoney = useCallback(
    async (opts: { amount: number; borrower: string; note?: string; dueInDays?: number }) => {
      return run(async () => {
        if (!walletAddress) throw new Error('Wallet not ready');
        const borrowerHandle = opts.borrower.startsWith('@') ? opts.borrower : `@${opts.borrower}`;
        const borrowerAddress = await resolveRecipient(borrowerHandle);
        if (!borrowerAddress || borrowerAddress === '0x') {
          throw new Error(`${borrowerHandle} isn't on PayGram yet. Invite them first.`);
        }
        if (borrowerAddress.toLowerCase() === walletAddress.toLowerCase()) {
          throw new Error("You can't lend to yourself");
        }

        const dueAtMs =
          opts.dueInDays && opts.dueInDays > 0
            ? Date.now() + opts.dueInDays * 24 * 60 * 60 * 1000
            : null;
        const dueAtSec = dueAtMs ? Math.floor(dueAtMs / 1000) : 0;

        let txId: string;
        let onChainId: number | null = null;
        let chainId: number | null = null;

        if (isTabConfigured()) {
          const plan = await buildLendCalls({
            borrowerAddress,
            amountUsd: opts.amount,
            dueAtSec,
            note: opts.note,
          });
          const result = await executeContractCalls({
            calls: plan.calls,
            expectUsdc: plan.expectUsdc,
            chainId: plan.addresses.chainId,
          });
          txId = result.transactionId as string;
          onChainId = plan.onChainDebtId;
          chainId = plan.addresses.chainId;
        } else {
          txId = await sendUsdc(opts.amount, borrowerAddress);
        }

        const debt: TabDebt = {
          id: uidTab(),
          onChainId,
          chainId,
          lender: me,
          borrower: borrowerHandle,
          lenderAddress: walletAddress,
          borrowerAddress,
          principal: opts.amount,
          repaid: 0,
          dueAt: dueAtMs,
          note: opts.note,
          closed: false,
          fundTxId: txId,
          createdAt: Date.now(),
        };
        upsertTab(debt);
        await paygram.syncTab(debt);

        paygram.logTxActivity({
          type: 'lend',
          amount: opts.amount,
          counterparty: borrowerHandle,
          // Prefer user note; otherwise "Lend" (not raw on-chain "tab #N").
          note:
            opts.note?.trim() ||
            (onChainId != null ? `Lend · tab #${onChainId}` : 'Lend'),
          txId,
          status: 'pending',
        });

        return {
          ok: true as const,
          message: `Lent $${opts.amount} to ${borrowerHandle}`,
          txId,
          id: debt.id,
        };
      });
    },
    [executeContractCalls, me, paygram, run, sendUsdc, walletAddress],
  );

  const repayDebt = useCallback(
    async (opts: { debtId: string; amount: number }) => {
      return run(async () => {
        const { loadTabs } = await import('@/lib/tabs');
        const debt = loadTabs().find((d) => d.id === opts.debtId);
        if (!debt || debt.closed) throw new Error('Debt not found or already closed');
        const remaining = outstandingUsd(debt);
        if (opts.amount <= 0 || opts.amount > remaining + 0.001) {
          throw new Error(`Repay between $0.01 and $${remaining}`);
        }
        const amount = Math.min(opts.amount, remaining);

        let txId: string;
        if (debt.onChainId != null && isTabConfigured()) {
          const plan = buildRepayCalls(debt.onChainId, amount);
          const result = await executeContractCalls({
            calls: plan.calls,
            expectUsdc: plan.expectUsdc,
            chainId: plan.addresses.chainId,
          });
          txId = result.transactionId as string;
        } else {
          txId = await sendUsdc(amount, debt.lenderAddress);
        }

        const repaid = Math.round((debt.repaid + amount) * 100) / 100;
        const closed = repaid >= debt.principal - 0.001;
        await paygram.patchTabRemote(debt.id, {
          repaid: closed ? debt.principal : repaid,
          closed,
          fundTxId: txId,
        });

        paygram.logTxActivity({
          type: 'repay',
          amount,
          counterparty: debt.lender,
          note: debt.onChainId != null ? `tab #${debt.onChainId}` : debt.id,
          txId,
          status: 'pending',
        });

        return {
          ok: true as const,
          message: closed ? `Paid off $${amount} — debt closed` : `Repaid $${amount}`,
          txId,
        };
      });
    },
    [executeContractCalls, paygram, run, sendUsdc],
  );

  const forgiveDebt = useCallback(
    async (opts: { debtId: string }) => {
      return run(async () => {
        const { loadTabs } = await import('@/lib/tabs');
        const debt = loadTabs().find((d) => d.id === opts.debtId);
        if (!debt || debt.closed) throw new Error('Debt not found or already closed');
        if (!tabPartyEq(debt.lender, me)) {
          throw new Error('Only the lender can forgive');
        }

        let txId: string | undefined;
        if (debt.onChainId != null && isTabConfigured()) {
          const plan = buildForgiveCalls(debt.onChainId);
          const result = await executeContractCalls({
            calls: plan.calls,
            chainId: plan.addresses.chainId,
          });
          txId = result.transactionId as string;
        }

        const remaining = outstandingUsd(debt);
        await paygram.patchTabRemote(debt.id, { closed: true });

        paygram.logTxActivity({
          type: 'forgive',
          amount: remaining,
          counterparty: debt.borrower,
          note: debt.onChainId != null ? `tab #${debt.onChainId}` : debt.id,
          txId,
          status: txId ? 'pending' : 'confirmed',
        });

        return {
          ok: true as const,
          message: `Forgave ${formatUsd(remaining)} owed by ${debt.borrower}`,
          txId,
        };
      });
    },
    [executeContractCalls, me, paygram, run],
  );

  return {
    me,
    busy,
    error,
    setError,
    sendMoney,
    requestMoney,
    splitBill,
    createCollection,
    contribute,
    swapTokens,
    remind,
    scheduleRecurringTip,
    createCircle,
    contributeToCircle,
    acceptCircleInvite,
    declineCircleInvite,
    inviteToCircle,
    revokeCircleInvite,
    lendMoney,
    repayDebt,
    forgiveDebt,
  };
}
