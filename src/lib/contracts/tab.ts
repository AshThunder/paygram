import { Contract, JsonRpcProvider, Interface } from 'ethers';
import {
  getContractAddresses,
  getContractsRpcUrl,
  usdcToUnits,
  type ContractAddresses,
} from './config';
import { encodeApprove, ERC20_ABI } from './abi';

export const TAB_ABI = [
  'function nextDebtId() view returns (uint256)',
  'function debts(uint256) view returns (address lender, address borrower, uint128 principal, uint128 repaid, uint64 dueAt, bool closed, string note)',
  'function lend(address borrower, uint256 amount, uint64 dueAt, string note) returns (uint256 debtId)',
  'function repay(uint256 debtId, uint256 amount)',
  'function forgive(uint256 debtId)',
  'function outstanding(uint256 debtId) view returns (uint256)',
  'function debtsAsBorrower(address user) view returns (uint256[])',
  'function debtsAsLender(address user) view returns (uint256[])',
] as const;

export const tabInterface = new Interface(TAB_ABI);

export type EncodedCall = { to: string; data: string; value?: string };

export function isTabConfigured(): boolean {
  const a = getContractAddresses();
  return Boolean(a?.tab && /^0x[a-fA-F0-9]{40}$/.test(a.tab));
}

export async function peekNextDebtId(addresses: ContractAddresses): Promise<number> {
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.tab, TAB_ABI, provider);
  return Number(await c.nextDebtId());
}

export async function buildLendCalls(opts: {
  borrowerAddress: string;
  amountUsd: number;
  dueAtSec?: number;
  note?: string;
}): Promise<{
  addresses: ContractAddresses;
  amountUnits: bigint;
  onChainDebtId: number;
  expectUsdc: string;
  calls: EncodedCall[];
}> {
  const addresses = getContractAddresses();
  if (!addresses?.tab) throw new Error('Tab contract not configured — set VITE_TAB after deploy');

  const amountUnits = usdcToUnits(opts.amountUsd);
  const dueAt = BigInt(opts.dueAtSec ?? 0);
  const onChainDebtId = await peekNextDebtId(addresses);

  return {
    addresses,
    amountUnits,
    onChainDebtId,
    expectUsdc: String(opts.amountUsd),
    calls: [
      { to: addresses.usdc, data: encodeApprove(addresses.tab, amountUnits), value: '0x0' },
      {
        to: addresses.tab,
        data: tabInterface.encodeFunctionData('lend', [
          opts.borrowerAddress,
          amountUnits,
          dueAt,
          opts.note ?? '',
        ]),
        value: '0x0',
      },
    ],
  };
}

export function buildRepayCalls(onChainDebtId: number, amountUsd: number): {
  addresses: ContractAddresses;
  expectUsdc: string;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.tab) throw new Error('Tab contract not configured');
  const amountUnits = usdcToUnits(amountUsd);
  return {
    addresses,
    expectUsdc: String(amountUsd),
    calls: [
      { to: addresses.usdc, data: encodeApprove(addresses.tab, amountUnits), value: '0x0' },
      {
        to: addresses.tab,
        data: tabInterface.encodeFunctionData('repay', [BigInt(onChainDebtId), amountUnits]),
        value: '0x0',
      },
    ],
  };
}

export function buildForgiveCalls(onChainDebtId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.tab) throw new Error('Tab contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.tab,
        data: tabInterface.encodeFunctionData('forgive', [BigInt(onChainDebtId)]),
        value: '0x0',
      },
    ],
  };
}

export async function readDebtOnChain(onChainDebtId: number) {
  const addresses = getContractAddresses();
  if (!addresses?.tab) return null;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.tab, TAB_ABI, provider);
  const d = await c.debts(onChainDebtId);
  return {
    lender: d.lender as string,
    borrower: d.borrower as string,
    principal: d.principal as bigint,
    repaid: d.repaid as bigint,
    dueAt: Number(d.dueAt),
    closed: Boolean(d.closed),
    note: d.note as string,
  };
}

export { ERC20_ABI };
