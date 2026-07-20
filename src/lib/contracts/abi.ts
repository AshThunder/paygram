import { Interface } from 'ethers';

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const;

export const erc20Interface = new Interface(ERC20_ABI);

export function encodeApprove(spender: string, amount: bigint): string {
  return erc20Interface.encodeFunctionData('approve', [spender, amount]);
}
