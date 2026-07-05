import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { usePayGram } from '@/hooks/PayGramProvider';
import { shortenAddress, formatUsd } from '@/lib/constants';
import { getUserRegistry } from '@/lib/parser';
import { tipLink, payLink, giftLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';

export function MePage() {
  const { walletAddress, telegramUser, logout } = useAuth();
  const { primaryAssets } = useUniversalAccount();
  const { gifts } = usePayGram();

  const username = telegramUser?.username ?? walletAddress?.slice(2, 10) ?? 'me';
  const myTipLink = tipLink(username, 5);
  const myPayLink = payLink(username, 25);

  const registry = getUserRegistry();
  const friends = Object.entries(registry).filter(
    ([h]) => h !== telegramUser?.username?.toLowerCase(),
  );

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      {/* Profile card */}
      <section className="bg-gradient-to-br from-brand/20 to-surface-card border border-brand/30 rounded-2xl p-5">
        <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">Your account</p>
        <p className="text-xl font-bold text-text-primary">
          {telegramUser?.firstName ?? 'PayGram User'}
          {telegramUser?.username && (
            <span className="text-text-secondary text-base font-normal"> @{telegramUser.username}</span>
          )}
        </p>
        <p className="text-3xl font-bold text-text-primary mt-3 tabular-nums">
          {formatUsd(primaryAssets?.totalAmountInUSD ?? 0)}
        </p>
        <p className="text-xs text-text-muted mt-1">Unified balance · all chains</p>
        {walletAddress && (
          <button
            type="button"
            onClick={() => copy(walletAddress)}
            className="mt-3 text-xs font-mono text-text-muted hover:text-brand transition-colors"
          >
            {walletAddress} (tap to copy)
          </button>
        )}
      </section>

      {/* TipLink */}
      <section className="bg-surface-card border border-surface-border rounded-xl p-4">
        <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">Tip jar</h2>
        <p className="text-xs text-text-muted mb-3">Fans tip you in one tap — no chains, no addresses.</p>
        <p className="text-xs text-brand font-mono break-all mb-3 bg-surface-dark p-2 rounded-lg">{myTipLink}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copy(myTipLink)}
            className="flex-1 h-9 text-sm font-medium border border-surface-border rounded-lg hover:border-brand/30"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => shareUrl(myTipLink, 'Tip me on PayGram')}
            className="flex-1 h-9 bg-brand text-white text-sm font-semibold rounded-lg"
          >
            Share
          </button>
        </div>
      </section>

      {/* Pay link */}
      <section className="bg-surface-card border border-surface-border rounded-xl p-4">
        <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">Pay link</h2>
        <p className="text-xs text-text-muted mb-3">Request a specific amount via Telegram deep link.</p>
        <p className="text-xs text-brand font-mono break-all mb-3 bg-surface-dark p-2 rounded-lg">{myPayLink}</p>
        <button
          type="button"
          onClick={() => shareUrl(myPayLink, `Pay me $25 on PayGram`)}
          className="w-full h-9 bg-brand/10 border border-brand/30 text-brand text-sm font-semibold rounded-lg"
        >
          Share pay link
        </button>
      </section>

      {/* Gift links */}
      {gifts.length > 0 && (
        <section className="bg-surface-card border border-surface-border rounded-xl p-4">
          <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Gift links</h2>
          <div className="space-y-2">
            {gifts.filter((g) => !g.claimed).map((g) => {
              const link = giftLink(g.id, g.amount);
              return (
                <div key={g.id} className="flex justify-between items-center gap-2 p-2 bg-surface-dark rounded-lg">
                  <span className="text-sm text-text-primary">{formatUsd(g.amount)}</span>
                  <button
                    type="button"
                    onClick={() => shareUrl(link, `Claim your ${formatUsd(g.amount)} gift`)}
                    className="text-xs text-brand font-medium"
                  >
                    Share
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Friends */}
      <section className="bg-surface-card border border-surface-border rounded-xl p-4">
        <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
          Friends on PayGram ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-text-muted text-sm">Friends appear when they open PayGram and log in.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map(([handle, addr]) => (
              <li key={handle} className="flex justify-between items-center text-sm">
                <span className="text-text-primary">@{handle}</span>
                <span className="text-text-muted font-mono text-xs">{shortenAddress(addr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* How to use */}
      <section className="bg-surface-card border border-surface-border rounded-xl p-4">
        <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Chat commands</h2>
        <ul className="text-xs text-text-muted space-y-1.5 font-mono">
          <li>send $25 to @alice for lunch</li>
          <li>tip @creator $5</li>
          <li>request $30 from @bob</li>
          <li>split $120 with @a @b @c</li>
          <li>collect $500 for Bali trip</li>
          <li>create gift $20</li>
          <li>remind @bob about $30</li>
        </ul>
      </section>

      <button
        type="button"
        onClick={() => logout()}
        className="w-full h-10 text-danger text-sm font-medium rounded-xl border border-danger/20 hover:bg-danger/10"
      >
        Sign out
      </button>
    </div>
  );
}
