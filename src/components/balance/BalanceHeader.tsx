import { useState } from 'react';
import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from '@/lib/constants';
import { getChainBreakdown } from '@/lib/assets';
import { TokenBalanceList } from './TokenBalanceList';

const CHAIN_DOT: Record<string, string> = {
  Base: '#0052FF',
  Arbitrum: '#28A0F0',
  Solana: '#14F195',
  Ethereum: '#627EEA',
};

type Props = {
  balance: number;
  assets: IAssetsResponse | null;
  loading?: boolean;
  showBreakdown?: boolean;
};

export function BalanceStickyBar({
  balance,
  loading,
  expanded = false,
  onToggle,
  onAddFunds,
}: {
  balance: number;
  loading?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAddFunds?: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-surface-variant bg-surface-container-lowest px-container-padding py-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex flex-col text-left disabled:pointer-events-none"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide balance details' : 'Show balance details'}
      >
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Available Balance
        </span>
        <span className="text-headline-md tabular-nums text-on-surface">
          {loading ? '—' : formatUsd(balance)}
        </span>
      </button>
      {onAddFunds && (
        <button
          type="button"
          onClick={onAddFunds}
          className="rounded-full bg-secondary-fixed px-4 py-1.5 text-label-sm font-semibold text-on-secondary-container transition-opacity hover:opacity-80"
        >
          Add Funds
        </button>
      )}
    </div>
  );
}

export function BalanceDetails({
  assets,
  showBreakdown = true,
}: {
  assets: IAssetsResponse | null;
  showBreakdown?: boolean;
}) {
  const chains = getChainBreakdown(assets);
  const [showTokens, setShowTokens] = useState(false);

  return (
    <div className="flex flex-col items-center px-container-padding pb-4 pt-3 text-center">
      <span className="mb-1 font-section-label text-section-label uppercase tracking-wider text-outline">
        BALANCE
      </span>
      <p className="mb-3 text-body-sm text-outline">Unified across all chains · gasless sends</p>
      {showBreakdown && chains.length > 0 ? (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {chains.map((chain) => (
            <span
              key={chain.chainId}
              className="flex items-center gap-1 rounded-full bg-surface-container-highest px-3 py-1 text-label-md text-on-surface-variant"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CHAIN_DOT[chain.name] ?? '#006190' }}
              />
              {chain.name} {formatUsd(chain.amountInUSD)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-body-sm text-on-surface-variant">No chain breakdown yet</p>
      )}
      {showBreakdown && assets && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowTokens((v) => !v);
          }}
          className="text-label-md font-semibold text-primary transition-colors hover:text-primary-fixed-dim"
        >
          {showTokens ? 'Hide tokens by chain' : 'Show tokens by chain'}
        </button>
      )}
      {showTokens && assets && (
        <div className="mt-3 w-full rounded-[20px] border border-surface-container-highest bg-surface-container-lowest p-3 text-left soft-shadow">
          <TokenBalanceList assets={assets} compact />
        </div>
      )}
    </div>
  );
}

/** Combined header for non-chat pages that still want expand-in-place. */
export function BalanceHeader({ balance, assets, loading, showBreakdown = true }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0">
      <BalanceStickyBar
        balance={balance}
        loading={loading}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && <BalanceDetails assets={assets} showBreakdown={showBreakdown} />}
    </div>
  );
}
