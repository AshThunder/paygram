import { Interface, parseUnits, getAddress } from 'ethers';
import {
  CHAIN_ID,
  SUPPORTED_TOKEN_TYPE,
  type IAssetsResponse,
  type ITransaction,
  type UniversalAccount,
} from '@particle-network/universal-account-sdk';
import { USDC_ARBITRUM, formatUsd, isAddress } from './constants';
import { getTokenBreakdown } from './assets';

const ERC20_TRANSFER = new Interface(['function transfer(address to, uint256 amount)']);

/** Human-readable USDC amount for Particle (max 6 decimals). */
export function formatUsdcAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid amount greater than $0.');
  }
  // Keep cents clean for dollar sends; allow up to 6dp for dust.
  const fixed = amount >= 0.01 ? amount.toFixed(2) : amount.toFixed(6);
  return fixed.replace(/\.?0+$/, '') || '0';
}

export function checksumAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error('Invalid wallet address for recipient.');
  }
  return getAddress(address);
}

export function arbUsdcUsd(assets: IAssetsResponse | null): number {
  return getTokenBreakdown(assets)
    .filter((t) => t.chainId === 42161 && /USDC/i.test(t.symbol))
    .reduce((s, t) => s + t.amountInUSD, 0);
}

export function stablecoinUsd(assets: IAssetsResponse | null): number {
  return getTokenBreakdown(assets)
    .filter((t) => /USDC|USDT/i.test(t.symbol))
    .reduce((s, t) => s + t.amountInUSD, 0);
}

/**
 * Prefer Particle’s total, but never under-count vs the holdings breakdown
 * (stale/low totalAmountInUSD was falsely blocking Lend with “~$1 headroom”).
 */
export function spendableUsd(assets: IAssetsResponse | null): number {
  const reported = assets?.totalAmountInUSD ?? 0;
  const fromTokens = getTokenBreakdown(assets).reduce((s, t) => s + t.amountInUSD, 0);
  return Math.max(reported, fromTokens);
}

/**
 * Contract spends land as Arb USDC. Unified balance can convert from other
 * chains — only block when spendable USD is below the amount. Convert/unlock
 * failures surface from Magick/Particle (not a fake “add $1” gate).
 */
export function assertArbUsdcSpendReady(opts: {
  amount: number;
  assets: IAssetsResponse | null;
  verb?: string;
}): void {
  const amount = opts.amount;
  const verb = opts.verb ?? 'This payment';
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid amount greater than $0.');
  }

  const total = spendableUsd(opts.assets);
  if (amount > total + 0.001) {
    throw new Error(
      `Not enough balance — you have ${formatUsd(total)}. Add money on Me, then try again.`,
    );
  }

  const arbUsdc = arbUsdcUsd(opts.assets);
  if (arbUsdc >= amount - 0.01) return;

  // Dust buffer only — do not require ~$1 spare (blocked real $7 balances).
  if (total < amount + 0.02) {
    throw new Error(
      `${verb} needs a bit more balance to convert & send. You have ${formatUsd(total)}. Add money, then retry.`,
    );
  }
}

/** Short form hint — unified balance, not chain jargon. */
export function spendHint(assets: IAssetsResponse | null, amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const arbUsdc = arbUsdcUsd(assets);
  if (arbUsdc >= amount - 0.01) {
    return 'Pays from your balance — ready to go.';
  }
  const total = spendableUsd(assets);
  if (total < 0.01) return 'Add money first — any supported network works.';
  if (total < amount + 0.02) {
    return 'Need a bit more balance to convert & send.';
  }
  return 'Converting from your balance · may need a one-time network unlock';
}

/**
 * Preflight before sending — Particle's "target chain" error is opaque;
 * catch common cases ourselves.
 */
export function assertTransferReady(opts: {
  amount: number;
  receiver: string;
  sender?: string | null;
  assets: IAssetsResponse | null;
}): string {
  const receiver = checksumAddress(opts.receiver);
  if (opts.sender && isAddress(opts.sender)) {
    try {
      if (getAddress(opts.sender) === receiver) {
        throw new Error("You can't send to your own wallet.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('own wallet')) throw e;
    }
  }

  assertArbUsdcSpendReady({ amount: opts.amount, assets: opts.assets, verb: 'This send' });

  return receiver;
}

export function transferTokenSpec() {
  return {
    chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE,
    address: USDC_ARBITRUM,
  };
}

/**
 * Build a UA transaction that converts any primary assets → Arb USDC (via
 * expectTokens) then ERC-20 transfers — same pattern as pots/tabs.
 * Plain createTransferTransaction often fails when the balance is ETH/other.
 */
export async function createUsdcSendTransaction(
  universalAccount: UniversalAccount,
  amount: number,
  receiver: string,
): Promise<ITransaction> {
  const amountStr = formatUsdcAmount(amount);
  const units = parseUnits(amountStr, 6);
  const data = ERC20_TRANSFER.encodeFunctionData('transfer', [receiver, units]);

  return universalAccount.createUniversalTransaction({
    chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE,
    expectTokens: [{ type: SUPPORTED_TOKEN_TYPE.USDC, amount: amountStr }],
    transactions: [{ to: USDC_ARBITRUM, data, value: '0x0' }],
  });
}
