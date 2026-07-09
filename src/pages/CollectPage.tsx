import { useState } from 'react';
import { usePayGram } from '@/hooks/PayGramProvider';
import { useAuth } from '@/hooks/AuthProvider';
import { formatUsd, formatWalletError } from '@/lib/constants';
import { potLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';

export function CollectPage() {
  const { pots, contributeToPot } = usePayGram();
  const { telegramUser } = useAuth();
  const [amount, setAmount] = useState('10');
  const [contributing, setContributing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = telegramUser?.username ? `@${telegramUser.username}` : 'you';

  const handleContribute = async (potId: string) => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setContributing(potId);
    setError(null);
    try {
      await contributeToPot(potId, val, me);
    } catch (e) {
      setError(formatWalletError(e));
    } finally {
      setContributing(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text-primary mb-1">Collections</h2>
        <p className="text-sm text-text-muted">
          Group pots for trips, gifts, and events. Create one in chat:{' '}
          <code className="text-brand">collect $500 for Bali trip</code>
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">{error}</div>
      )}

      {pots.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-text-secondary text-sm">No collections yet</p>
          <p className="text-text-muted text-xs mt-2">Go to Chat and type: collect $500 for Bali trip</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pots.map((p) => {
            const pct = Math.min(100, (p.collected / p.goal) * 100);
            const link = potLink(p.id);
            const leaders = [...(p.contributors ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 5);
            return (
              <div key={p.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-base font-semibold text-text-primary">{p.title}</p>
                    <p className="text-xs text-text-muted">by {p.creator}</p>
                  </div>
                  <span className="text-xs text-brand-muted font-mono">{Math.round(pct)}%</span>
                </div>

                <p className="text-2xl font-bold text-text-primary mb-1">
                  {formatUsd(p.collected)}
                  <span className="text-sm text-text-muted font-normal"> / {formatUsd(p.goal)}</span>
                </p>

                <div className="h-2 bg-surface-border rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                {leaders.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-2">Top contributors</p>
                    <div className="space-y-1">
                      {leaders.map((c, i) => (
                        <div key={c.user} className="flex justify-between text-xs">
                          <span className="text-text-secondary">
                            {i + 1}. {c.user}
                          </span>
                          <span className="text-text-primary font-medium">{formatUsd(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 h-9 px-3 bg-surface-dark border border-surface-border rounded-lg text-sm"
                    placeholder="Amount"
                  />
                  <button
                    type="button"
                    disabled={contributing === p.id}
                    onClick={() => handleContribute(p.id)}
                    className="px-4 h-9 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {contributing === p.id ? '…' : 'Contribute'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => shareUrl(link, `Contribute to ${p.title}`)}
                  className="w-full h-9 text-brand text-sm font-medium border border-brand/30 rounded-lg hover:bg-brand/10"
                >
                  Share collection link
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
