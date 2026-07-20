import { Contract, JsonRpcProvider, Interface } from 'ethers';
import {
  getContractAddresses,
  getContractsRpcUrl,
  usdcToUnits,
  unitsToUsdc,
  type ContractAddresses,
} from './config';
import { encodeApprove } from './abi';

/** Default split window — 7 days. */
export const DEFAULT_BILL_DURATION_SEC = 7 * 24 * 60 * 60;

export const BILL_ESCROW_ABI = [
  'function nextBillId() view returns (uint256)',
  'function bills(uint256) view returns (address creator, address payee, uint128 total, uint128 collected, uint64 expiresAt, bool released, bool cancelled)',
  'function shareOf(uint256 billId, address payer) view returns (uint256)',
  'function paidOf(uint256 billId, address payer) view returns (uint256)',
  'function createBill(address payee_, address[] payers_, uint256[] shares_, uint256 durationSeconds) returns (uint256 billId)',
  'function payShare(uint256 billId, uint256 amount)',
  'function withdrawPayment(uint256 billId)',
  'function cancel(uint256 billId)',
  'function release(uint256 billId)',
  'function releaseIfFunded(uint256 billId)',
] as const;

const billInterface = new Interface(BILL_ESCROW_ABI);

export type EncodedCall = { to: string; data: string; value?: string };

export function isBillEscrowConfigured(): boolean {
  const a = getContractAddresses();
  return Boolean(a?.billEscrow && /^0x[a-fA-F0-9]{40}$/.test(a.billEscrow));
}

export async function peekNextBillId(addresses: ContractAddresses): Promise<number> {
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.billEscrow, BILL_ESCROW_ABI, provider);
  return Number(await c.nextBillId());
}

/**
 * Equal split including the creator (who already paid the merchant).
 * Friends deposit `share` each; bill total = share × friends.
 * Creator receives escrowed funds on release.
 */
export function equalSplitShares(totalUsd: number, friendCount: number): {
  shareUsd: number;
  billTotalUsd: number;
  shareUnits: bigint;
  billTotalUnits: bigint;
} {
  if (friendCount < 1) throw new Error('Add at least one person to split with');
  const parties = friendCount + 1;
  const totalUnits = usdcToUnits(totalUsd);
  const shareUnits = totalUnits / BigInt(parties);
  if (shareUnits <= 0n) throw new Error('Amount too small to split');
  const billTotalUnits = shareUnits * BigInt(friendCount);
  return {
    shareUsd: unitsToUsdc(shareUnits),
    billTotalUsd: unitsToUsdc(billTotalUnits),
    shareUnits,
    billTotalUnits,
  };
}

export async function buildCreateBillCalls(opts: {
  payeeAddress: string;
  payerAddresses: string[];
  shareUnits: bigint;
  durationSeconds?: number;
}): Promise<{
  addresses: ContractAddresses;
  onChainBillId: number;
  calls: EncodedCall[];
}> {
  const addresses = getContractAddresses();
  if (!addresses?.billEscrow) throw new Error('Bill escrow not configured — set VITE_BILL_ESCROW');
  if (!opts.payerAddresses.length) throw new Error('No payers for bill');

  const duration = opts.durationSeconds ?? DEFAULT_BILL_DURATION_SEC;
  const shares = opts.payerAddresses.map(() => opts.shareUnits);
  const onChainBillId = await peekNextBillId(addresses);

  return {
    addresses,
    onChainBillId,
    calls: [
      {
        to: addresses.billEscrow,
        data: billInterface.encodeFunctionData('createBill', [
          opts.payeeAddress,
          opts.payerAddresses,
          shares,
          BigInt(duration),
        ]),
        value: '0x0',
      },
    ],
  };
}

export function buildPayShareCalls(onChainBillId: number, amountUsd: number): {
  addresses: ContractAddresses;
  expectUsdc: string;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.billEscrow) throw new Error('Bill escrow not configured');
  const amountUnits = usdcToUnits(amountUsd);
  return {
    addresses,
    expectUsdc: String(amountUsd),
    calls: [
      {
        to: addresses.usdc,
        data: encodeApprove(addresses.billEscrow, amountUnits),
        value: '0x0',
      },
      {
        to: addresses.billEscrow,
        data: billInterface.encodeFunctionData('payShare', [
          BigInt(onChainBillId),
          amountUnits,
        ]),
        value: '0x0',
      },
    ],
  };
}

/** After the last share is paid, release escrowed USDC to the payee. */
export function buildReleaseIfFundedCalls(onChainBillId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.billEscrow) throw new Error('Bill escrow not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.billEscrow,
        data: billInterface.encodeFunctionData('releaseIfFunded', [BigInt(onChainBillId)]),
        value: '0x0',
      },
    ],
  };
}

export function buildCancelBillCalls(onChainBillId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.billEscrow) throw new Error('Bill escrow not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.billEscrow,
        data: billInterface.encodeFunctionData('cancel', [BigInt(onChainBillId)]),
        value: '0x0',
      },
    ],
  };
}

export async function readBillOnChain(onChainBillId: number) {
  const addresses = getContractAddresses();
  if (!addresses?.billEscrow) return null;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.billEscrow, BILL_ESCROW_ABI, provider);
  const b = await c.bills(onChainBillId);
  return {
    creator: b.creator as string,
    payee: b.payee as string,
    total: b.total as bigint,
    collected: b.collected as bigint,
    expiresAt: Number(b.expiresAt),
    released: Boolean(b.released),
    cancelled: Boolean(b.cancelled),
  };
}
