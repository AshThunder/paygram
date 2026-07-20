export const ARBITRUM_CHAIN_ID = 42161;
export const ETHEREUM_CHAIN_ID = 1;
export const BASE_CHAIN_ID = 8453;

/** Magick can only sign chain-specific EIP-7702 auth — these chains are in EVMExtension. */
export const MAGIC_7702_CHAINS = [ARBITRUM_CHAIN_ID, ETHEREUM_CHAIN_ID, BASE_CHAIN_ID] as const;

export const CHAIN_LABEL: Record<number, string> = {
  [ARBITRUM_CHAIN_ID]: 'Arbitrum',
  [ETHEREUM_CHAIN_ID]: 'Ethereum',
  [BASE_CHAIN_ID]: 'Base',
};

/** Public RPCs — Magick + Type-4 gas estimation. Avoid endpoints that 403 Magick’s origin. */
export const ARBITRUM_RPC_FALLBACK = 'https://arb1.arbitrum.io/rpc';
/** Public fallback only — set VITE_ETH_RPC_URL (Alchemy) in prod for Magick unlock. */
export const ETHEREUM_RPC_FALLBACK = 'https://ethereum-rpc.publicnode.com';
export const BASE_RPC_FALLBACK = 'https://base.gateway.tenderly.co';

/** Extra public RPCs when the primary fails (CORS / rate limits). */
export const ETHEREUM_RPC_FALLBACKS = [
  ETHEREUM_RPC_FALLBACK,
  'https://eth.drpc.org',
  'https://0xrpc.io/eth',
  'https://rpc.mevblocker.io',
] as const;

export const BASE_RPC_FALLBACKS = [
  BASE_RPC_FALLBACK,
  'https://1rpc.io/base',
  'https://base.meowrpc.com',
  'https://mainnet.base.org',
] as const;

export const ARBITRUM_RPC_FALLBACKS = [
  ARBITRUM_RPC_FALLBACK,
  'https://arbitrum-one.publicnode.com',
  'https://1rpc.io/arb',
] as const;

function configuredRpc(envKey: string, fallback: string): string {
  const configured = (import.meta.env as Record<string, string | undefined>)[envKey]?.trim();
  if (
    configured &&
    !configured.includes('YOUR_KEY') &&
    !configured.includes('your_') &&
    configured.startsWith('http')
  ) {
    return configured;
  }
  return fallback;
}

export function getArbitrumRpcUrl(): string {
  return configuredRpc('VITE_ARB_RPC_URL', ARBITRUM_RPC_FALLBACK);
}

export function getEthereumRpcUrl(): string {
  return configuredRpc('VITE_ETH_RPC_URL', ETHEREUM_RPC_FALLBACK);
}

export function getBaseRpcUrl(): string {
  return configuredRpc('VITE_BASE_RPC_URL', BASE_RPC_FALLBACK);
}

export function getChainRpcUrl(chainId: number): string {
  if (chainId === ARBITRUM_CHAIN_ID) return getArbitrumRpcUrl();
  if (chainId === ETHEREUM_CHAIN_ID) return getEthereumRpcUrl();
  if (chainId === BASE_CHAIN_ID) return getBaseRpcUrl();
  return getArbitrumRpcUrl();
}

/** Primary + alternates for gas/nonce reads (Magick still uses MagicProvider rpcUrl). */
export function getChainRpcCandidates(chainId: number): string[] {
  const primary = getChainRpcUrl(chainId);
  const extras =
    chainId === ETHEREUM_CHAIN_ID
      ? ETHEREUM_RPC_FALLBACKS
      : chainId === BASE_CHAIN_ID
        ? BASE_RPC_FALLBACKS
        : ARBITRUM_RPC_FALLBACKS;
  return [...new Set([primary, ...extras])];
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
  const raw = handle.trim().replace(/\s+/g, '');
  return raw.startsWith('@') ? raw.slice(1).toLowerCase() : raw.toLowerCase();
}

export function universalXUrl(transactionId: string): string {
  return `https://universalx.app/activity/details?id=${transactionId}`;
}

/** Turn raw Magic / RPC / Particle errors into something users can act on. */
export function formatWalletError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Keep our unlock / convert copy — do not rewrite Eth/Base messages into Arb-only.
  if (/Unlock on |Unlocked |one-time unlock on the network|tiny ETH on |add USDC on Arbitrum/i.test(msg)) {
    return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
  }
  if (/convert from another network|AA24/i.test(msg)) {
    return msg.length < 200
      ? msg
      : 'Couldn’t convert from another network. Unlock that network (tiny ETH for gas), or add USDC on Arbitrum.';
  }
  if (/would fail on the target chain|check the transaction parameters/i.test(msg)) {
    return 'Couldn’t convert & send from your balance. Try a smaller amount, or add money and leave ~$0.35 spare.';
  }
  if (/Insufficient balance for gas/i.test(msg) || /after making a deposit/i.test(msg)) {
    return 'Not enough headroom to convert & send (~$1 spare). Add money on Me, then retry.';
  }
  if (/System maintenance/i.test(msg) || /use SEND\/TRANSFER\/SELL/i.test(msg)) {
    return 'Payments are briefly paused for an upgrade. Try Chat → Send in a few minutes — your funds are safe.';
  }
  if (/Unable to get network info|Couldn’t reach .* for unlock/i.test(msg)) {
    return msg.length < 220
      ? msg
      : 'Couldn’t reach that network for unlock. Hard-refresh and retry, or add USDC on Arbitrum.';
  }
  if (/One-time unlock needs ~\$0\.01 ETH on Arbitrum/i.test(msg)) {
    return msg;
  }
  if (/insufficient funds/i.test(msg) || /One-time wallet setup|elsewhere — send/i.test(msg)) {
    return 'One-time unlock needs ~$0.01 ETH on Arbitrum (same address — not Ethereum mainnet). Me → Show QR.';
  }
  if (/Magic RPC Error/i.test(msg)) {
    return formatWalletError(msg.replace(/^Magic RPC Error:\s*\[[^\]]+\]\s*/i, ''));
  }
  if (msg.length > 200) {
    return msg.slice(0, 200) + '…';
  }
  return msg;
}
