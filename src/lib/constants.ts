export const ARBITRUM_CHAIN_ID = 42161;

/** Public Arbitrum RPC — used when VITE_ARB_RPC_URL is unset or still a placeholder. */
export const ARBITRUM_RPC_FALLBACK = 'https://arbitrum-one.publicnode.com';

export function getArbitrumRpcUrl(): string {
  const configured = import.meta.env.VITE_ARB_RPC_URL?.trim();
  if (
    configured &&
    !configured.includes('YOUR_KEY') &&
    !configured.includes('your_') &&
    configured.startsWith('http')
  ) {
    return configured;
  }
  return ARBITRUM_RPC_FALLBACK;
}

export const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

export function formatUsd(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeHandle(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
}

export function universalXUrl(transactionId: string): string {
  return `https://universalx.app/activity/details?id=${transactionId}`;
}
