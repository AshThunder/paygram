import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatUsd } from '@/lib/constants';
import { getTokenBreakdown } from '@/lib/assets';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/Feedback';
import { SectionLabel } from '@/components/ui/stitch';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';

const CHAIN_DOT: Record<string, string> = {
  Base: '#0052FF',
  Arbitrum: '#28A0F0',
  Solana: '#14F195',
  Ethereum: '#627EEA',
  Polygon: '#8247E5',
};

const TOKEN_ICON: Record<string, string> = {
  USDC: 'currency_exchange',
  USDT: 'monetization_on',
  USD: 'attach_money',
  ETH: 'toll',
  SOL: 'toll',
};

export function BalancePage() {
  const navigate = useNavigate();
  const { primaryAssets, loading } = useUniversalAccount();
  const total = primaryAssets?.totalAmountInUSD ?? 0;
  const balanceLoading = loading && !primaryAssets;
  const tokens = useMemo(() => getTokenBreakdown(primaryAssets), [primaryAssets]);
  const [open, setOpen] = useState<string | null>(null);

  const bySymbol = useMemo(() => {
    const map = new Map<
      string,
      { symbol: string; usd: number; amount: number; chains: { name: string; amount: number; usd: number }[] }
    >();
    for (const t of tokens) {
      const key = t.symbol.toUpperCase();
      const entry = map.get(key) ?? { symbol: key, usd: 0, amount: 0, chains: [] };
      entry.usd += t.amountInUSD;
      entry.amount += t.amount;
      entry.chains.push({ name: t.chainName, amount: t.amount, usd: t.amountInUSD });
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.usd - a.usd);
  }, [tokens]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background pb-tab-bar">
      <PageHeader title="Balance" />

      <main className="mx-auto w-full max-w-[500px] px-container-padding pb-stack-gap-lg pt-stack-gap-md">
        <section className="mb-stack-gap-lg flex flex-col items-center justify-center">
          <p className="mb-1 text-body-md text-on-surface-variant">Your balance</p>
          {balanceLoading ? (
            <Skeleton className="mb-2 h-12 w-44" />
          ) : (
            <h2 className="mb-2 text-display-amount text-on-surface">{formatUsd(total)}</h2>
          )}
          <p className="mb-stack-gap-md max-w-[280px] text-center text-body-sm text-on-surface-variant">
            One total across networks — details below show where it’s held.
          </p>
          <button
            type="button"
            onClick={() => navigate('/me', { state: { scrollTo: 'funding' } })}
            className="flex items-center gap-2 rounded-full bg-primary-container px-8 py-3 text-headline-md text-on-primary transition-opacity hover:opacity-90 active:scale-95"
          >
            <Icon name="add" className="text-[22px]" />
            Add money
          </button>
          <p className="mt-2 text-center text-body-sm text-outline">
            Works from any supported network
          </p>
        </section>

        <section className="flex flex-col gap-stack-gap-md">
          {bySymbol.length > 0 && (
            <SectionLabel className="px-1">Holdings</SectionLabel>
          )}
          {balanceLoading ? (
            <div className="flex flex-col gap-stack-gap-md">
              <Skeleton className="h-20 w-full rounded-[24px]" />
              <Skeleton className="h-20 w-full rounded-[24px]" />
            </div>
          ) : bySymbol.length === 0 ? (
            <EmptyState
              icon="account_balance_wallet"
              title="No money yet"
              body="Add money — any supported network works. It all shows as one balance."
              ctaLabel="Add money"
              onCta={() => navigate('/me', { state: { scrollTo: 'funding' } })}
            />
          ) : (
            bySymbol.map((token) => {
              const expanded = open === token.symbol;
              return (
                <div
                  key={token.symbol}
                  className="overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : token.symbol)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-fixed text-primary-container">
                        <Icon
                          name={TOKEN_ICON[token.symbol] ?? 'toll'}
                          className="text-[28px]"
                          filled
                        />
                      </div>
                      <div>
                        <h3 className="text-headline-md text-on-surface">{token.symbol}</h3>
                        <p className="text-body-md text-on-surface-variant">
                          {token.chains.length === 1
                            ? token.chains[0].name
                            : `${token.chains.length} networks`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-headline-md text-on-surface">{formatUsd(token.usd)}</p>
                        {token.symbol !== 'USD' && (
                          <p className="text-label-sm text-on-surface-variant">
                            {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                            {token.symbol}
                          </p>
                        )}
                      </div>
                      <Icon
                        name="expand_more"
                        className={`text-outline transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>
                  {expanded && (
                      <div className="border-t border-surface-variant bg-surface-container-low">
                      <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wider text-outline">
                        Where it’s held
                      </p>
                      <div className="flex flex-col gap-3 p-4 pt-2">
                        {token.chains.map((c) => (
                          <div
                            key={`${token.symbol}-${c.name}`}
                            className="flex items-center justify-between border-b border-surface-variant/50 py-2 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: CHAIN_DOT[c.name] ?? '#006190' }}
                              />
                              <span className="text-body-md text-on-surface">{c.name}</span>
                            </div>
                            <span className="text-body-md text-on-surface-variant">
                              {c.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
