import { Contract, JsonRpcProvider, Interface } from 'ethers';
import {
  getContractAddresses,
  getContractsRpcUrl,
  usdcToUnits,
  type ContractAddresses,
} from './config';
import { encodeApprove } from './abi';

/** Default round length: 7 days (contract min 1h, max 365d). */
export const DEFAULT_ROSCA_PERIOD_SEC = 7 * 24 * 60 * 60;

export const ROSCA_ABI = [
  'function nextCircleId() view returns (uint256)',
  'function circles(uint256) view returns (address creator, uint128 contribution, uint32 roundPeriod, uint16 memberCount, uint16 currentRound, uint16 paidRounds, uint64 roundDeadline, bool started, bool cancelled, bool completed)',
  'function createCircle(uint256 contribution_, uint32 roundPeriod_) returns (uint256 circleId)',
  'function inviteMember(uint256 circleId, address candidate)',
  'function acceptInvite(uint256 circleId)',
  'function declineInvite(uint256 circleId)',
  'function revokeInvite(uint256 circleId, address candidate)',
  'function contribute(uint256 circleId)',
  'function payoutRound(uint256 circleId)',
  'function proposeDissolve(uint256 circleId)',
  'function voteDissolve(uint256 circleId)',
  'function claimRoundRefund(uint256 circleId, uint256 round)',
  'function paidRound(uint256 circleId, uint256 round, address user) view returns (bool)',
  'function pendingInvite(uint256 circleId, address user) view returns (bool)',
  'function isMember(uint256 circleId, address user) view returns (bool)',
  'function getMembers(uint256 circleId) view returns (address[])',
  'function getPendingInvites(uint256 circleId) view returns (address[])',
] as const;

const roscaInterface = new Interface(ROSCA_ABI);

export type EncodedCall = { to: string; data: string; value?: string };

export function isRoscaConfigured(): boolean {
  const a = getContractAddresses();
  return Boolean(a?.rosca && /^0x[a-fA-F0-9]{40}$/.test(a.rosca));
}

export async function peekNextCircleId(addresses: ContractAddresses): Promise<number> {
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.rosca, ROSCA_ABI, provider);
  return Number(await c.nextCircleId());
}

export async function buildCreateCircleCalls(opts: {
  contributionUsd: number;
  roundPeriodSec?: number;
  inviteAddresses?: string[];
}): Promise<{
  addresses: ContractAddresses;
  onChainCircleId: number;
  calls: EncodedCall[];
}> {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured — set VITE_ROSCA');

  const contribution = usdcToUnits(opts.contributionUsd);
  const period = opts.roundPeriodSec ?? DEFAULT_ROSCA_PERIOD_SEC;
  const onChainCircleId = await peekNextCircleId(addresses);
  const invites = opts.inviteAddresses ?? [];

  const calls: EncodedCall[] = [
    {
      to: addresses.rosca,
      data: roscaInterface.encodeFunctionData('createCircle', [contribution, period]),
      value: '0x0',
    },
  ];
  for (const addr of invites) {
    calls.push({
      to: addresses.rosca,
      data: roscaInterface.encodeFunctionData('inviteMember', [BigInt(onChainCircleId), addr]),
      value: '0x0',
    });
  }

  return { addresses, onChainCircleId, calls };
}

export function buildInviteMemberCalls(onChainCircleId: number, candidate: string): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.rosca,
        data: roscaInterface.encodeFunctionData('inviteMember', [BigInt(onChainCircleId), candidate]),
        value: '0x0',
      },
    ],
  };
}

export function buildAcceptInviteCalls(onChainCircleId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.rosca,
        data: roscaInterface.encodeFunctionData('acceptInvite', [BigInt(onChainCircleId)]),
        value: '0x0',
      },
    ],
  };
}

export function buildDeclineInviteCalls(onChainCircleId: number): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.rosca,
        data: roscaInterface.encodeFunctionData('declineInvite', [BigInt(onChainCircleId)]),
        value: '0x0',
      },
    ],
  };
}

export function buildRevokeInviteCalls(onChainCircleId: number, candidate: string): {
  addresses: ContractAddresses;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured');
  return {
    addresses,
    calls: [
      {
        to: addresses.rosca,
        data: roscaInterface.encodeFunctionData('revokeInvite', [
          BigInt(onChainCircleId),
          candidate,
        ]),
        value: '0x0',
      },
    ],
  };
}

export function buildContributeCircleCalls(onChainCircleId: number, contributionUsd: number): {
  addresses: ContractAddresses;
  expectUsdc: string;
  calls: EncodedCall[];
} {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) throw new Error('Rosca contract not configured');
  const amountUnits = usdcToUnits(contributionUsd);
  return {
    addresses,
    expectUsdc: String(contributionUsd),
    calls: [
      { to: addresses.usdc, data: encodeApprove(addresses.rosca, amountUnits), value: '0x0' },
      {
        to: addresses.rosca,
        data: roscaInterface.encodeFunctionData('contribute', [BigInt(onChainCircleId)]),
        value: '0x0',
      },
    ],
  };
}

export async function readCircleOnChain(onChainCircleId: number) {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) return null;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.rosca, ROSCA_ABI, provider);
  const row = await c.circles(onChainCircleId);
  const members = (await c.getMembers(onChainCircleId)) as string[];
  const pending = (await c.getPendingInvites(onChainCircleId)) as string[];
  return {
    creator: row.creator as string,
    contribution: row.contribution as bigint,
    roundPeriod: Number(row.roundPeriod),
    memberCount: Number(row.memberCount),
    currentRound: Number(row.currentRound),
    paidRounds: Number(row.paidRounds),
    roundDeadline: Number(row.roundDeadline),
    started: Boolean(row.started),
    cancelled: Boolean(row.cancelled),
    completed: Boolean(row.completed),
    members,
    pendingInvites: pending,
  };
}

export async function hasPendingInvite(onChainCircleId: number, user: string): Promise<boolean> {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) return false;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.rosca, ROSCA_ABI, provider);
  return Boolean(await c.pendingInvite(onChainCircleId, user));
}

export async function isCircleMember(onChainCircleId: number, user: string): Promise<boolean> {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) return false;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.rosca, ROSCA_ABI, provider);
  return Boolean(await c.isMember(onChainCircleId, user));
}

export async function hasPaidThisRound(
  onChainCircleId: number,
  round: number,
  user: string,
): Promise<boolean> {
  const addresses = getContractAddresses();
  if (!addresses?.rosca) return false;
  const provider = new JsonRpcProvider(getContractsRpcUrl(addresses.chainId));
  const c = new Contract(addresses.rosca, ROSCA_ABI, provider);
  return Boolean(await c.paidRound(onChainCircleId, round, user));
}
