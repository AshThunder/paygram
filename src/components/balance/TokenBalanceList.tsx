import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from '@/lib/constants';
import { formatRawAmount, getTokenBreakdown } from '@/lib/assets';
import { Icon } from '@/components/ui/Icon';

const TOKEN_STYLE: Record<string, string> = {
  USDC: 'bg-blue-100 text-blue-600',
  USDT: 'bg-emerald-100 text-emerald-600',
  ETH: 'bg-slate-100 text-slate-600',
  SOL: 'bg-purple-100 text-purple-600',
  BNB: 'bg-amber-100 text-amber-700',
};

type Props = {
  assets: IAssetsResponse | null;
  compact?: boolean;
  variant?: 'default' | 'accordion';
};

export function TokenBalanceList({ assets, compact = false, variant = 'default' }: Props) {
  const tokens = getTokenBreakdown(assets);
  if (!tokens.length) {
    return <p className="text-body-sm text-outline">No tokens yet — fund your wallet below.</p>;
  }

  if (variant === 'accordion') {
    const bySymbol = new Map<string, { usd: number; symbol: string }>();
    for (const t of tokens) {
      const key = t.symbol.toUpperCase();
      const entry = bySymbol.get(key) ?? { usd: 0, symbol: key };
      entry.usd += t.amountInUSD;
      bySymbol.set(key, entry);
    }
    return (
      <div className="flex flex-col gap-0 border-t border-surface-container-low">
        {[...bySymbol.entries()].map(([symbol, data]) => (
          <div
            key={symbol}
            className="flex items-center justify-between border-b border-surface-container-low py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${TOKEN_STYLE[symbol] ?? 'bg-surface-container-low text-on-surface-variant'}`}
              >
                {symbol.slice(0, 4)}
              </div>
              <span className="text-body-md text-on-surface">{symbol}</span>
            </div>
            <span className="text-label-md text-on-surface">{formatUsd(data.usd)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (compact) {
    const byType = new Map<string, { usd: number; lines: string[] }>();
    for (const t of tokens) {
      const key = t.tokenType.toUpperCase();
      const entry = byType.get(key) ?? { usd: 0, lines: [] };
      entry.usd += t.amountInUSD;
      entry.lines.push(`${t.chainName}: ${formatRawAmount(t.rawAmount || t.amount, t.symbol)}`);
      byType.set(key, entry);
    }
    return (
      <div className="space-y-2">
        {[...byType.entries()].map(([type, data]) => (
          <div key={type} className="text-xs">
            <p className="font-semibold text-on-surface">
              {type} <span className="font-normal text-outline">{formatUsd(data.usd)}</span>
            </p>
            <p className="mt-0.5 text-outline">{data.lines.join(' · ')}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tokens.map((t, i) => (
        <div
          key={`${t.chainId}-${t.symbol}-${i}`}
          className="flex items-center justify-between border-b border-surface-container-highest/50 py-1.5 text-sm last:border-0"
        >
          <div>
            <p className="font-medium text-on-surface">{t.symbol}</p>
            <p className="text-xs text-outline">{t.chainName}</p>
          </div>
          <div className="text-right">
            <p className="tabular-nums text-on-surface">{formatRawAmount(t.rawAmount || t.amount, t.symbol)}</p>
            <p className="text-xs tabular-nums text-outline">{formatUsd(t.amountInUSD)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TokenAccordion({ assets }: { assets: IAssetsResponse | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-container-low bg-surface-container-lowest soft-shadow">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between bg-surface-container-lowest p-4 transition-colors hover:bg-surface-bright [&::-webkit-details-marker]:hidden">
          <span className="text-label-md text-on-surface">BY TOKEN</span>
          <Icon name="expand_more" className="text-on-surface-variant transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <TokenBalanceList assets={assets} variant="accordion" />
        </div>
      </details>
    </div>
  );
}
