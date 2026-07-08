import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from './constants';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'BSC',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  10: 'Optimism',
  101: 'Solana',
  43114: 'Avalanche',
  59144: 'Linea',
};

export type ChainBalance = {
  chainId: number;
  name: string;
  amountInUSD: number;
};

export function getChainBreakdown(assets: IAssetsResponse | null): ChainBalance[] {
  if (!assets?.assets?.length) return [];

  const byChain = new Map<number, number>();

  for (const asset of assets.assets) {
    for (const row of asset.chainAggregation ?? []) {
      const chainId = row.token?.chainId;
      if (!chainId) continue;
      byChain.set(chainId, (byChain.get(chainId) ?? 0) + (row.amountInUSD ?? 0));
    }
  }

  return [...byChain.entries()]
    .filter(([, amount]) => amount > 0.001)
    .map(([chainId, amountInUSD]) => ({
      chainId,
      name: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
      amountInUSD,
    }))
    .sort((a, b) => b.amountInUSD - a.amountInUSD);
}

export function formatChainBreakdown(assets: IAssetsResponse | null): string {
  const chains = getChainBreakdown(assets);
  if (!chains.length) return 'No per-chain breakdown yet';
  return chains.map((c) => `${c.name} ${formatUsd(c.amountInUSD)}`).join(' · ');
}
