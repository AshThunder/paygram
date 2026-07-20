import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle } from '@/components/ui/stitch';
import { useFriends } from '@/hooks/useFriends';
import { useMoneyActions } from '@/hooks/useMoneyActions';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { isRoscaConfigured, hasPendingInvite, readCircleOnChain, unitsToUsdc } from '@/lib/contracts';
import { circleInviteLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';
import {
  FieldInput,
  FieldLabel,
  PrimaryButton,
  normalizeHandleInput,
} from '@/components/actions/ActionForm';
import { EmptyState, ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { usePayGram } from '@/hooks/PayGramProvider';
import { loadCircles, type LocalCircle, type CircleStatus } from '@/lib/circles';

const STATUS: Record<CircleStatus, { label: string; className: string }> = {
  forming: {
    label: 'Forming',
    className: 'border border-surface-variant bg-surface-container-high text-on-surface-variant',
  },
  active: { label: 'Active', className: 'bg-[#CAE6FF] text-[#006190]' },
  paused: { label: 'Paused', className: 'bg-surface-container-high text-on-surface-variant' },
  completed: { label: 'Completed', className: 'bg-tertiary-fixed text-tertiary-container' },
  dissolved: { label: 'Ended', className: 'bg-error-container text-error' },
};

function CircleCard({
  circle,
  busy,
  onContribute,
  onRevoke,
  onShare,
}: {
  circle: LocalCircle;
  busy: boolean;
  onContribute: (id: string) => void;
  onRevoke: (id: string, handle: string) => void;
  onShare: (onChainId: number) => void;
}) {
  const st = STATUS[circle.status];
  const turn = circle.members[circle.currentRound] ?? '—';
  const progress = circle.memberCount
    ? Math.round((circle.paidRounds / Math.max(1, circle.memberCount)) * 100)
    : 0;
  const goal = circle.contribution * Math.max(1, circle.memberCount);
  const pending = circle.pendingInvites ?? [];
  const canPay =
    circle.onChainId != null &&
    circle.status !== 'completed' &&
    circle.status !== 'dissolved' &&
    circle.status !== 'paused' &&
    pending.length === 0 &&
    circle.memberCount >= 2;

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="mb-1 text-headline-sm font-semibold text-on-surface">{circle.name}</h3>
          <p className="flex items-center gap-1 text-body-sm text-on-surface-variant">
            <Icon name="account_balance_wallet" className="text-[16px]" />
            {formatUsd(goal)} pot · {formatUsd(circle.contribution)}/round
          </p>
          {circle.onChainId != null && (
            <p className="mt-1 text-[11px] font-medium text-primary">on-chain #{circle.onChainId}</p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${st.className}`}>
          {st.label}
        </span>
      </div>

      {pending.length > 0 && (
        <div className="mb-4 rounded-2xl bg-surface-container-low px-3 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Waiting to accept
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((h) => (
              <button
                key={h}
                type="button"
                disabled={busy}
                onClick={() => onRevoke(circle.id, h)}
                className="flex items-center gap-1 rounded-full border border-surface-variant bg-surface px-3 py-1 text-body-sm text-on-surface-variant"
                title="Revoke invite"
              >
                {h}
                <Icon name="close" className="text-[14px]" />
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-outline">
            Circles can’t start until every invite is accepted or revoked.
          </p>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-[11px] text-on-surface-variant">
          <span>Rounds paid</span>
          <span className="font-semibold text-primary">
            {circle.paidRounds}/{circle.memberCount}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
          <div className="h-2 rounded-full bg-cta" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-surface-variant pt-4">
        <div className="flex -space-x-2">
          {circle.members.slice(0, 3).map((m) => (
            <AvatarCircle key={m} label={m} className="h-8 w-8 border-2 border-white text-[9px]" />
          ))}
          {circle.members.length > 3 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-secondary-fixed text-[10px] font-bold text-on-secondary-container">
              +{circle.members.length - 3}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] text-on-surface-variant">This round</p>
          <p className="text-body-sm font-semibold text-primary">{turn}</p>
        </div>
      </div>
      {canPay && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onContribute(circle.id)}
          className="mt-4 w-full rounded-full bg-primary py-3 text-label-md font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? '…' : `Pay ${formatUsd(circle.contribution)} this round`}
        </button>
      )}
      {circle.onChainId != null && circle.status === 'forming' && (
        <button
          type="button"
          onClick={() => onShare(circle.onChainId!)}
          className="mt-3 w-full text-center text-body-sm font-semibold text-primary"
        >
          Share invite link
        </button>
      )}
      {circle.onChainId == null && (
        <p className="mt-3 text-center text-body-sm text-outline">Local-only circle (no escrow)</p>
      )}
    </div>
  );
}

export function CirclesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { friends } = useFriends();
  const { walletAddress } = useAuth();
  const { accountInfo } = useUniversalAccount();
  const {
    createCircle,
    contributeToCircle,
    acceptCircleInvite,
    declineCircleInvite,
    revokeCircleInvite,
    busy,
    error,
    setError,
  } = useMoneyActions();
  const { circles: sharedCircles, refresh, syncCircle } = usePayGram();
  const [circles, setCircles] = useState(() => loadCircles());
  const [filter, setFilter] = useState<'all' | 'active' | 'forming'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [contribution, setContribution] = useState('50');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<{
    circleId: number;
    contribution: number;
    members: number;
    pending: boolean;
  } | null>(null);
  const onChain = isRoscaConfigured();
  const checkAddress = accountInfo.evmSmartAccount || walletAddress || '';

  // Pull shared circles, reconcile pending invites from chain, then push.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
        if (cancelled) return;
        const { reconcileCircleWithOnChain } = await import('@/lib/circles');
        const local = loadCircles();
        for (const c of local) {
          let next = c;
          if (c.onChainId != null && onChain) {
            try {
              const row = await readCircleOnChain(c.onChainId);
              if (row) next = reconcileCircleWithOnChain(c, row);
            } catch {
              /* keep local */
            }
          }
          await syncCircle(next);
        }
        if (!cancelled) setCircles(loadCircles());
      } catch {
        if (!cancelled) setCircles(loadCircles());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, syncCircle, onChain]);

  useEffect(() => {
    setCircles(sharedCircles);
  }, [sharedCircles]);

  const visible = useMemo(() => {
    if (filter === 'all') return circles;
    return circles.filter((c) => c.status === filter);
  }, [circles, filter]);

  const inviteParam = searchParams.get('invite');

  useEffect(() => {
    if (!inviteParam || !checkAddress || !onChain) return;
    const id = Number(inviteParam);
    if (!Number.isFinite(id) || id < 1) return;
    let cancelled = false;
    void (async () => {
      try {
        const [row, pending] = await Promise.all([
          readCircleOnChain(id),
          hasPendingInvite(id, checkAddress),
        ]);
        if (cancelled || !row || row.creator === '0x0000000000000000000000000000000000000000') {
          return;
        }
        setInvitePreview({
          circleId: id,
          contribution: unitsToUsdc(row.contribution),
          members: row.memberCount,
          pending,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteParam, checkAddress, onChain]);

  const toggleFriend = (handle: string) => {
    const n = normalizeHandleInput(handle);
    setSelectedFriends((prev) =>
      prev.some((h) => h.toLowerCase() === n.toLowerCase())
        ? prev.filter((h) => h.toLowerCase() !== n.toLowerCase())
        : [...prev, n],
    );
  };

  const handleCreate = async () => {
    const amount = parseFloat(contribution);
    const circleName = name.trim();
    if (!amount || amount <= 0 || !circleName || selectedFriends.length < 1) return;
    if (friends.length === 0) {
      setLocalError('Add friends on the Friends tab first — only saved friends can be invited.');
      return;
    }
    setLocalError(null);
    try {
      const created = await createCircle({
        name: circleName,
        contribution: amount,
        inviteHandles: selectedFriends,
      });
      setCircles(loadCircles());
      setShowCreate(false);
      setName('');
      setSelectedFriends([]);
      const onChainId =
        created?.onChainId ??
        loadCircles().find((c) => c.name === circleName)?.onChainId;
      if (onChainId != null) {
        void shareUrl(
          circleInviteLink(onChainId),
          `Join “${circleName}” on PayGram — accept the invite to start the circle`,
        );
      }
    } catch (e) {
      setLocalError(formatWalletError(e));
    }
  };

  const handleContribute = async (circleId: string) => {
    setPayBusy(circleId);
    setLocalError(null);
    setError(null);
    try {
      await contributeToCircle({ circleId });
      setCircles(loadCircles());
    } catch (e) {
      setLocalError(formatWalletError(e));
    } finally {
      setPayBusy(null);
    }
  };

  const handleAccept = async () => {
    if (!invitePreview) return;
    setLocalError(null);
    try {
      await acceptCircleInvite(invitePreview.circleId);
      setCircles(loadCircles());
      setInvitePreview(null);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setLocalError(formatWalletError(e));
    }
  };

  const handleDecline = async () => {
    if (!invitePreview) return;
    setLocalError(null);
    try {
      await declineCircleInvite(invitePreview.circleId);
      setInvitePreview(null);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setLocalError(formatWalletError(e));
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-[22px]" />
        </button>
        <h1 className="flex-1 pr-10 text-center text-headline-sm font-bold text-primary">Circles</h1>
      </header>

      <main className="mx-auto w-full max-w-[390px] flex-1 px-container-padding pb-tab-bar pt-4">
        {(error || localError) && (
          <ErrorActionBanner
            message={error || localError || ''}
            actions={actionsForWalletError(error || localError || '')}
          />
        )}

        {invitePreview && (
          <div className="mb-6 space-y-4 rounded-[24px] border-2 border-primary bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <Icon name="groups" className="text-[28px]" filled />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  You’re invited
                </p>
                <h2 className="text-headline-sm font-semibold text-on-surface">
                  Circle #{invitePreview.circleId}
                </h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {formatUsd(invitePreview.contribution)} each round · {invitePreview.members} member
                  {invitePreview.members === 1 ? '' : 's'} so far. Accept to join the escrow.
                </p>
              </div>
            </div>
            {invitePreview.pending ? (
              <div className="flex gap-2">
                <PrimaryButton busy={busy} onClick={() => void handleAccept()} className="flex-1">
                  Accept invite
                </PrimaryButton>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDecline()}
                  className="flex-1 rounded-full border border-surface-variant py-4 text-headline-sm font-semibold text-on-surface disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                No pending invite for your wallet — you may already be a member.
              </p>
            )}
          </div>
        )}

        {!onChain && (
          <p className="mb-4 rounded-2xl bg-surface-container-high px-3 py-2 text-body-sm text-on-surface-variant">
            Rosca not configured — deploy the new invite-capable contract and set VITE_ROSCA.
          </p>
        )}

        <div className="relative mb-6 flex h-[120px] items-center justify-between overflow-hidden rounded-[24px] border border-surface-variant bg-primary-fixed p-5">
          <div className="z-10 flex h-full max-w-[60%] flex-col justify-center">
            <h2 className="mb-1 text-headline-sm font-semibold text-primary">Start a Circle</h2>
            <p className="mb-3 text-body-sm leading-tight text-on-surface-variant">
              Invite friends — they must accept.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="self-start rounded-full bg-cta px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-on-primary"
            >
              Create Now
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-[40%] items-center justify-center opacity-80">
            <Icon name="groups" className="text-[80px] text-secondary-fixed-dim" filled />
          </div>
        </div>

        {showCreate && (
          <div className="mb-6 space-y-3 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5">
            <div>
              <FieldLabel>Circle name</FieldLabel>
              <FieldInput
                className="!pl-4"
                placeholder="Friday pot"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Contribution each round</FieldLabel>
              <FieldInput
                className="!pl-4"
                inputMode="decimal"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Invite friends (saved only)</FieldLabel>
              {friends.length === 0 ? (
                <p className="rounded-2xl bg-surface-container-low px-3 py-3 text-body-sm text-on-surface-variant">
                  No saved friends yet.{' '}
                  <button
                    type="button"
                    className="font-semibold text-primary"
                    onClick={() => navigate('/friends')}
                  >
                    Add friends
                  </button>{' '}
                  before inviting.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const h = `@${f.username}`;
                    const on = selectedFriends.some(
                      (s) => s.toLowerCase() === h.toLowerCase(),
                    );
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFriend(h)}
                        className={`rounded-full px-3 py-1.5 text-body-sm font-medium ${
                          on
                            ? 'bg-secondary-fixed text-on-secondary-container'
                            : 'border border-surface-variant bg-surface text-on-surface-variant'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Invites must be accepted on-chain. The circle can’t start until every invite is
              accepted or revoked (needs 2+ members).
            </p>
            <PrimaryButton
              busy={busy}
              disabled={selectedFriends.length < 1 || friends.length === 0}
              onClick={() => void handleCreate()}
            >
              Create &amp; send invites
            </PrimaryButton>
          </div>
        )}

        <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['forming', 'Forming'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-semibold ${
                filter === id
                  ? 'bg-secondary-fixed text-on-secondary-container'
                  : 'border border-surface-variant bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          {visible.length === 0 && !showCreate ? (
            <EmptyState
              icon="groups"
              title="No circles yet"
              body="Start a rotating savings circle with friends — they accept the invite on-chain before anyone pays."
              ctaLabel="Create a circle"
              onCta={() => setShowCreate(true)}
            />
          ) : (
            visible.map((c) => (
              <CircleCard
                key={c.id}
                circle={c}
                busy={payBusy === c.id || busy}
                onContribute={(id) => void handleContribute(id)}
                onRevoke={(id, handle) => {
                  void (async () => {
                    try {
                      await revokeCircleInvite({ circleId: id, handle });
                      setCircles(loadCircles());
                    } catch (e) {
                      setLocalError(formatWalletError(e));
                    }
                  })();
                }}
                onShare={(onChainId) => {
                  void shareUrl(
                    circleInviteLink(onChainId),
                    `Join my PayGram circle #${onChainId} — accept the invite to start`,
                  );
                }}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-surface-variant bg-surface-container-lowest/50 py-4 text-headline-sm text-primary"
          >
            <Icon name="add_circle" className="text-[24px]" />
            Create New Circle
          </button>
        </div>
      </main>
    </div>
  );
}
