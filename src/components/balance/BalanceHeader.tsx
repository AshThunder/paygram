import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from '@/lib/constants';
import { getChainBreakdown } from '@/lib/assets';

type Props = {
  balance: number;
  assets: IAssetsResponse | null;
  loading?: boolean;
  showBreakdown?: boolean;
};

export function BalanceHeader({ balance, assets, loading, showBreakdown = true }: Props) {
  const chains = getChainBreakdown(assets);

  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Balance</p>
      <p className="text-3xl font-bold text-text-primary tabular-nums">
        {loading ? '—' : formatUsd(balance)}
      </p>
      <p className="text-text-muted text-xs mt-1">Unified across all chains</p>
      {showBreakdown && chains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chains.map((chain) => (
            <span
              key={chain.chainId}
              className="text-xs px-2 py-1 rounded-full bg-surface-card border border-surface-border text-text-secondary"
            >
              {chain.name} {formatUsd(chain.amountInUSD)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
