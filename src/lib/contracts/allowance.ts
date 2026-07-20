import { Contract, JsonRpcProvider, Interface } from 'ethers';
import {
  getContractAddresses,
  getContractsRpcUrl,
  usdcToUnits,
  type ContractAddresses,
} from './config';
import { encodeApprove } from './abi';

export const ALLOWANCE_ABI = [
  'function nextPurseId() view returns (uint256)',
  'function purses(uint256) view returns (address guardian, address spender, uint128 deposited, uint128 spent, uint64 expiresAt, bool closed)',
  'function open(address spender, uint256 amount, uint256 durationSeconds) returns (uint256 purseId)',
  'function topUp(uint256 purseId, uint256 amount)',
  'function spend(uint256 purseId, address to, uint256 amount)',
  'function close(uint256 purseId)',
] as const;

export const allowanceInterface = new Interface(ALLOWANCE_ABI);

export type EncodedCall = { to: string; data: string; value?: string };

export function isAllowanceConfigured(): boolean {
  const a = getContractAddresses();
  return Boolean(a?.allowance && /^0x[a-fA-F0-9]{40}$/.test(a.allowance));
}

export async function peekNextPurseId(addresses: ContractAddresses): Promise<number> {
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.allowance, ALLOWANCE_ABI, provider);
  return Number(await c.nextPurseId());
}

export async function buildOpenAllowanceCalls(opts: {
  spenderAddress: string;
  amountUsd: number;
  durationDays?: number;
}): Promise<{
  addresses: ContractAddresses;
  onChainPurseId: number;
  expectUsdc: string;
  calls: EncodedCall[];
}> {
  const addresses = getContractAddresses();
  if (!addresses?.allowance) throw new Error('Allowance contract not configured — set VITE_ALLOWANCE');
  const amountUnits = usdcToUnits(opts.amountUsd);
  const durationSeconds = BigInt(Math.max(1, opts.durationDays ?? 30) * 24 * 60 * 60);
  const onChainPurseId = await peekNextPurseId(addresses);
  return {
    addresses,
    onChainPurseId,
    expectUsdc: String(opts.amountUsd),
    calls: [
      { to: addresses.usdc, data: encodeApprove(addresses.allowance, amountUnits), value: '0x0' },
      {
        to: addresses.allowance,
        data: allowanceInterface.encodeFunctionData('open', [
          opts.spenderAddress,
          amountUnits,
          durationSeconds,
        ]),
        value: '0x0',
      },
    ],
  };
}

export function buildCloseAllowanceCalls(onChainPurseId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.allowance) throw new Error('Allowance contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.allowance,
        data: allowanceInterface.encodeFunctionData('close', [onChainPurseId]),
        value: '0x0',
      },
    ],
  };
}

export async function readPurseOnChain(purseId: number): Promise<{
  guardian: string;
  spender: string;
  deposited: number;
  spent: number;
  expiresAt: number;
  closed: boolean;
} | null> {
  const addresses = getContractAddresses();
  if (!addresses?.allowance) return null;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.allowance, ALLOWANCE_ABI, provider);
  const p = await c.purses(purseId);
  return {
    guardian: p.guardian as string,
    spender: p.spender as string,
    deposited: Number(p.deposited) / 1e6,
    spent: Number(p.spent) / 1e6,
    expiresAt: Number(p.expiresAt),
    closed: Boolean(p.closed),
  };
}
