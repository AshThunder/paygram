import { JsonRpcProvider } from 'ethers';
import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { ARBITRUM_CHAIN_ID, getArbitrumRpcUrl } from '@/lib/constants';
import { getTokenBreakdown } from '@/lib/assets';

/** Magick Type-4 unlock gas — ~$0.01 of ETH, not a full 0.001. */
export const MIN_ARB_ETH_WEI = 5_000_000_000_000n; // 0.000005 ETH

export async function getArbitrumEthWei(address: string): Promise<bigint> {
  const provider = new JsonRpcProvider(getArbitrumRpcUrl(), ARBITRUM_CHAIN_ID);
  return provider.getBalance(address);
}

export async function hasEnoughArbEth(address: string): Promise<boolean> {
  try {
    const bal = await getArbitrumEthWei(address);
    return bal >= MIN_ARB_ETH_WEI;
  } catch {
    return false;
  }
}

/** ETH held off Arbitrum (unified balance) — unlock still needs a tiny Arb native tip. */
export function ethOffArbitrumUsd(assets: IAssetsResponse | null): number {
  return getTokenBreakdown(assets)
    .filter((t) => t.chainId !== 42161 && /ETH/i.test(t.symbol))
    .reduce((s, t) => s + t.amountInUSD, 0);
}

export function unlockEthHint(assets: IAssetsResponse | null, arbEthOk: boolean | null): string {
  if (arbEthOk === true) return 'Ready to unlock';
  const off = ethOffArbitrumUsd(assets);
  if (off >= 0.02) {
    return 'You have ETH elsewhere — send ~$0.01 ETH on Arbitrum to the same address, then unlock';
  }
  return 'Add tiny ETH on Arbitrum (~$0.01), then unlock';
}
