import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { usePayGram } from '@/hooks/PayGramProvider';
import { useFriends } from '@/hooks/useFriends';
import { formatUsd } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle } from '@/components/ui/stitch';
import { WalletSetupCard } from '@/components/funding/WalletSetupCard';
import { NetBalanceStrip } from '@/components/home/NetBalanceStrip';

/** Matches stitch home_dashboard — 8 services, uniform soft-blue tiles */
const SERVICES = [
  { label: 'Send', icon: 'send', to: '/send' },
  { label: 'Request', icon: 'request_quote', to: '/request' },
  { label: 'Split', icon: 'call_split', to: '/split' },
  { label: 'Tip', icon: 'volunteer_activism', to: '/tip' },
  { label: 'Swap', icon: 'currency_exchange', to: '/swap' },
  { label: 'Collect', icon: 'group_add', to: '/collect' },
  { label: 'Loans', icon: 'handshake', to: '/tabs' },
  { label: 'Circles', icon: 'donut_large', to: '/circles' },
] as const;

function greetingForHour(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const { telegramUser, paygramUsername } = useAuth();
  const { primaryAssets } = useUniversalAccount();
  const { requests, refresh } = usePayGram();
  const { friends } = useFriends();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const balanceUsd = primaryAssets?.totalAmountInUSD ?? 0;
  const letter = (telegramUser?.firstName || paygramUsername || 'P').charAt(0).toUpperCase();
  const headerName = paygramUsername
    ? `@${paygramUsername}`
    : telegramUser?.username
      ? `@${telegramUser.username}`
      : telegramUser?.firstName ?? 'PayGram';

  const pendingReqs = useMemo(
    () => requests.filter((r) => r.status === 'pending').slice(0, 2),
    [requests],
  );

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SERVICES;
    return SERVICES.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return friends.slice(0, 8);
    return friends.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        f.displayName?.toLowerCase().includes(q),
    );
  }, [friends, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background pb-tab-bar">
      <header className="relative z-10 sticky top-0 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-surface-variant bg-primary-fixed text-sm font-bold text-primary">
            {letter}
          </div>
          <div>
            <span className="block text-body-sm text-on-surface-variant">{greetingForHour()}</span>
            <span className="text-headline-sm font-semibold text-primary">{headerName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/activity')}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-primary"
          aria-label="Notifications"
        >
          <Icon name="notifications" className="text-[24px]" />
          {pendingReqs.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-error" />
          )}
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[390px] flex-col gap-5 px-container-padding pt-4">
        <label className="relative block w-full">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon name="search" className="text-[22px] text-outline" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services & friends"
            className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest py-3 pl-10 pr-4 text-body-sm text-on-surface outline-none placeholder:text-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
          />
        </label>

        {!searching && (
        <section className="relative overflow-hidden rounded-[24px] border border-primary bg-primary p-5 text-on-primary soft-shadow">
          <div className="relative z-10 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-primary-fixed">
              Total Balance
            </span>
            <span className="text-[40px] font-bold leading-[48px] tracking-tight">
              {formatUsd(balanceUsd)}
            </span>
          </div>
          <div className="relative z-10 mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-cta py-3 text-[12px] font-bold uppercase tracking-wide text-white transition active:scale-[0.98]"
            >
              <Icon name="chat" className="text-[18px]" filled />
              Open Chat
            </button>
            <button
              type="button"
              onClick={() => navigate('/me', { state: { scrollTo: 'funding' } })}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/40 bg-primary-container py-3 text-[12px] font-bold uppercase tracking-wide text-white transition active:scale-[0.98]"
            >
              <Icon name="add" className="text-[18px]" />
              Fund
            </button>
          </div>
        </section>
        )}

        {searching && filteredServices.length === 0 && (
          <p className="text-center text-body-sm text-on-surface-variant">No matching services</p>
        )}

        {!searching && <WalletSetupCard compact />}

        {!searching && <NetBalanceStrip />}

        {(searching || filteredServices.length > 0) && (
        <div className="grid grid-cols-4 gap-x-2 gap-y-5">
          {filteredServices.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => navigate(s.to)}
              className="group flex flex-col items-center gap-2 transition active:scale-95"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-surface-variant bg-primary-fixed text-primary transition group-hover:bg-primary-fixed-dim/40">
                <Icon name={s.icon} className="text-[24px]" />
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">{s.label}</span>
            </button>
          ))}
        </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">Friends</h2>
            {!searching && (
            <button
              type="button"
              onClick={() => navigate('/friends')}
              className="text-[11px] font-medium text-primary-container hover:underline"
            >
              See all
            </button>
            )}
          </div>
          {searching && filteredFriends.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No matching friends</p>
          ) : (
          <div className="hide-scrollbar -mx-container-padding flex gap-4 overflow-x-auto px-container-padding pb-2">
            {!searching && (
            <button
              type="button"
              onClick={() => navigate('/friends')}
              className="flex min-w-[60px] flex-col items-center gap-2"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-outline-variant text-outline-variant">
                <Icon name="add" className="text-[24px]" />
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">Add</span>
            </button>
            )}
            {filteredFriends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  navigate('/send', { state: { recipient: `@${f.username}`, amount: 10 } })
                }
                className="flex min-w-[60px] flex-col items-center gap-2"
              >
                <AvatarCircle label={f.username} className="h-14 w-14 text-sm" />
                <span className="max-w-[60px] truncate text-[11px] font-medium text-on-surface-variant">
                  {f.displayName || f.username}
                </span>
              </button>
            ))}
          </div>
          )}
        </section>
      </main>
    </div>
  );
}
