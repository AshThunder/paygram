import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from './constants';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'BSC',
  196: 'X Layer',
  8453: 'Base',
  42161: 'Arbitrum',
  101: 'Solana',
};

export type ChainBalance = {
  chainId: number;
  name: string;
  amountInUSD: number;
};

export type TokenBalance = {
  tokenType: string;
  symbol: string;
  chainId: number;
  chainName: string;
  amount: number;
  rawAmount: number;
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

export function getTokenBreakdown(assets: IAssetsResponse | null): TokenBalance[] {
  if (!assets?.assets?.length) return [];

  const rows: TokenBalance[] = [];

  for (const asset of assets.assets) {
    const symbol = asset.tokenType || 'TOKEN';
    for (const row of asset.chainAggregation ?? []) {
      const chainId = row.token?.chainId;
      if (!chainId) continue;
      const amountInUSD = row.amountInUSD ?? 0;
      const amount = row.amount ?? 0;
      const rawAmount = row.rawAmount ?? amount;
      if (amountInUSD < 0.001 && amount < 0.000001) continue;
      rows.push({
        tokenType: asset.tokenType,
        symbol: row.token?.symbol ?? symbol,
        chainId,
        chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
        amount,
        rawAmount,
        amountInUSD,
      });
    }
  }

  return rows.sort((a, b) => b.amountInUSD - a.amountInUSD);
}

export function getTokensByType(assets: IAssetsResponse | null): Map<string, TokenBalance[]> {
  const map = new Map<string, TokenBalance[]>();
  for (const row of getTokenBreakdown(assets)) {
    const key = row.tokenType.toUpperCase();
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export function formatRawAmount(raw: number, symbol: string): string {
  const decimals = symbol === 'ETH' || symbol === 'SOL' || symbol === 'BNB' ? 4 : 2;
  const n = raw >= 1 ? raw.toLocaleString('en-US', { maximumFractionDigits: decimals }) : raw.toFixed(decimals);
  return `${n} ${symbol}`;
}

export function formatChainBreakdown(assets: IAssetsResponse | null): string {
  const chains = getChainBreakdown(assets);
  if (!chains.length) return '';
  return chains.map((c) => `${c.name} ${formatUsd(c.amountInUSD)}`).join(' · ');
}

export function formatTokenBreakdown(assets: IAssetsResponse | null): string {
  const tokens = getTokenBreakdown(assets);
  if (!tokens.length) return '';
  return tokens
    .slice(0, 8)
    .map((t) => `${t.chainName}: ${formatRawAmount(t.rawAmount || t.amount, t.symbol)} (${formatUsd(t.amountInUSD)})`)
    .join('\n');
}
