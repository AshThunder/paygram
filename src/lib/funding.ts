export type FundingChain = {
  chainId: number;
  name: string;
  assets: string[];
  note?: string;
};

/** Chains users can fund — deposit Primary Assets to their wallet address.
 * Particle UA v2 primary tokens: Solana, Ethereum, BSC, Base, X Layer, Arbitrum.
 */
export const FUNDING_CHAINS: FundingChain[] = [
  { chainId: 42161, name: 'Arbitrum', assets: ['USDC', 'USDT', 'ETH'], note: 'Home chain for PayGram sends' },
  { chainId: 8453, name: 'Base', assets: ['USDC', 'ETH'] },
  { chainId: 1, name: 'Ethereum', assets: ['USDC', 'USDT', 'ETH'] },
  { chainId: 56, name: 'BNB Chain', assets: ['USDC', 'USDT', 'BNB'] },
  { chainId: 196, name: 'X Layer', assets: ['USDC', 'USDT', 'ETH'] },
  { chainId: 101, name: 'Solana', assets: ['USDC', 'USDT', 'SOL'], note: 'Use your Solana UA address' },
];

export function getFundingChain(chainId: number): FundingChain | undefined {
  return FUNDING_CHAINS.find((c) => c.chainId === chainId);
}
