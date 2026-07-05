import { useState } from 'react';
import { usePayGram } from '@/hooks/PayGramProvider';
import { useAuth } from '@/hooks/AuthProvider';
import { formatUsd, universalXUrl } from '@/lib/constants';

export function ActivityPage() {
  const { requests, pots, activity, payRequest, remindRequest, refresh } = usePayGram();
  const { telegramUser } = useAuth();
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myHandle = telegramUser?.username ? `@${telegramUser.username}` : null;
  const incoming = requests.filter((r) => r.status === 'pending');
  const owedToMe = incoming.filter((r) => myHandle && r.fromUser.toLowerCase() === myHandle.toLowerCase());
  const iOwe = myHandle
    ? incoming.filter((r) => r.toUser.toLowerCase() === myHandle.toLowerCase())
    : incoming;

  const handlePay = async (id: string) => {
    setPaying(id);
    setError(null);
    try {
      await payRequest(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">{error}</div>
      )}

      {iOwe.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
            You owe ({iOwe.length})
          </h2>
          <div className="space-y-2">
            {iOwe.map((r) => (
              <div key={r.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <p className="text-lg font-bold text-text-primary">{formatUsd(r.amount)}</p>
                <p className="text-sm text-text-secondary">to {r.fromUser}</p>
                {r.note && <p className="text-xs text-text-muted mt-1">{r.note}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={paying === r.id}
                    onClick={() => handlePay(r.id)}
                    className="flex-1 h-9 bg-brand text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {paying === r.id ? 'Paying…' : 'Pay now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {owedToMe.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
            Owed to you ({owedToMe.length})
          </h2>
          <div className="space-y-2">
            {owedToMe.map((r) => (
              <div key={r.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <p className="text-sm font-medium text-text-primary">
                  {formatUsd(r.amount)} from {r.toUser}
                </p>
                {r.note && <p className="text-xs text-text-muted mt-1">{r.note}</p>}
                <button
                  type="button"
                  onClick={() => remindRequest(r.id)}
                  className="mt-2 text-xs text-brand font-medium hover:underline"
                >
                  Send reminder
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pots.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Collections</h2>
          <div className="space-y-2">
            {pots.map((p) => (
              <div key={p.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <p className="text-sm font-medium text-text-primary">{p.title}</p>
                <p className="text-xs text-text-muted mt-1">
                  {formatUsd(p.collected)} / {formatUsd(p.goal)} · by {p.creator}
                </p>
                <div className="mt-2 h-1.5 bg-surface-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${Math.min(100, (p.collected / p.goal) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2 font-mono">contribute $10 to {p.id}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">History</h2>
        {activity.length === 0 ? (
          <p className="text-text-muted text-sm">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm text-text-primary capitalize">
                      {a.type.replace('_', ' ')} {formatUsd(a.amount)}
                      {a.counterparty && <span className="text-text-secondary"> · {a.counterparty}</span>}
                    </p>
                    {a.note && <p className="text-xs text-text-muted mt-1">{a.note}</p>}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      a.status === 'confirmed'
                        ? 'bg-success/20 text-success'
                        : a.status === 'failed'
                          ? 'bg-danger/20 text-danger'
                          : 'bg-brand/20 text-brand-muted'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.txId && (
                  <a
                    href={universalXUrl(a.txId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand mt-2 inline-block hover:underline"
                  >
                    View tx →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
