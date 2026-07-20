import { Contract, JsonRpcProvider, Interface } from 'ethers';
import {
  getContractAddresses,
  getContractsRpcUrl,
  usdcToUnits,
  type ContractAddresses,
} from './config';
import { encodeApprove } from './abi';

export const DEFAULT_POT_DURATION_SEC = 30 * 24 * 60 * 60;

export const POT_ABI = [
  'function nextPotId() view returns (uint256)',
  'function pots(uint256) view returns (address creator, address beneficiary, uint128 goal, uint128 collected, uint64 expiresAt, bool released, bool cancelled)',
  'function contributionOf(uint256 potId, address user) view returns (uint256)',
  'function createPot(address beneficiary_, uint256 goal_, uint256 durationSeconds) returns (uint256 potId)',
  'function contribute(uint256 potId, uint256 amount)',
  'function withdrawContribution(uint256 potId)',
  'function cancel(uint256 potId)',
  'function release(uint256 potId)',
  'function releaseIfFunded(uint256 potId)',
] as const;

const potInterface = new Interface(POT_ABI);

export type EncodedCall = { to: string; data: string; value?: string };

export function isPotConfigured(): boolean {
  const a = getContractAddresses();
  return Boolean(a?.pot && /^0x[a-fA-F0-9]{40}$/.test(a.pot));
}

export async function peekNextPotId(addresses: ContractAddresses): Promise<number> {
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.pot, POT_ABI, provider);
  return Number(await c.nextPotId());
}

export async function buildCreatePotCalls(opts: {
  beneficiaryAddress: string;
  goalUsd: number;
  durationSeconds?: number;
}): Promise<{
  addresses: ContractAddresses;
  onChainPotId: number;
  calls: EncodedCall[];
}> {
  const addresses = getContractAddresses();
  if (!addresses?.pot) throw new Error('Pot contract not configured — set VITE_POT');
  const goalUnits = usdcToUnits(opts.goalUsd);
  const duration = opts.durationSeconds ?? DEFAULT_POT_DURATION_SEC;
  const onChainPotId = await peekNextPotId(addresses);
  return {
    addresses,
    onChainPotId,
    calls: [
      {
        to: addresses.pot,
        data: potInterface.encodeFunctionData('createPot', [
          opts.beneficiaryAddress,
          goalUnits,
          BigInt(duration),
        ]),
        value: '0x0',
      },
    ],
  };
}

export function buildContributePotCalls(onChainPotId: number, amountUsd: number): {
  addresses: ContractAddresses;
  expectUsdc: string;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.pot) throw new Error('Pot contract not configured');
  const amountUnits = usdcToUnits(amountUsd);
  return {
    addresses,
    expectUsdc: String(amountUsd),
    calls: [
      { to: addresses.usdc, data: encodeApprove(addresses.pot, amountUnits), value: '0x0' },
      {
        to: addresses.pot,
        data: potInterface.encodeFunctionData('contribute', [BigInt(onChainPotId), amountUnits]),
        value: '0x0',
      },
    ],
  };
}

export function buildWithdrawPotCalls(onChainPotId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.pot) throw new Error('Pot contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.pot,
        data: potInterface.encodeFunctionData('withdrawContribution', [BigInt(onChainPotId)]),
        value: '0x0',
      },
    ],
  };
}

export function buildReleasePotCalls(onChainPotId: number, ifFunded = false): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.pot) throw new Error('Pot contract not configured');
  const fn = ifFunded ? 'releaseIfFunded' : 'release';
  return {
    addresses,
    calls: [
      {
        to: addresses.pot,
        data: potInterface.encodeFunctionData(fn, [BigInt(onChainPotId)]),
        value: '0x0',
      },
    ],
  };
}

export async function readPotOnChain(onChainPotId: number) {
  const addresses = getContractAddresses();
  if (!addresses?.pot) return null;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.pot, POT_ABI, provider);
  const p = await c.pots(onChainPotId);
  return {
    creator: p.creator as string,
    beneficiary: p.beneficiary as string,
    goal: p.goal as bigint,
    collected: p.collected as bigint,
    expiresAt: Number(p.expiresAt),
    released: Boolean(p.released),
    cancelled: Boolean(p.cancelled),
  };
}
