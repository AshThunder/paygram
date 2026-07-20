export const ARBITRUM_ONE = 42161;
export const ARBITRUM_SEPOLIA = 421614;

/** Native USDC on Arbitrum One */
export const USDC_ARBITRUM_ONE = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

/**
 * Filled after `npm run deploy:arb` → paste VITE_* from `npm run env:app`.
 * Keep in sync with contracts/deployments/arbitrum.json.
 */
const ARBITRUM_DEPLOY: Partial<{
  usdc: string;
  PayGramPot: string;
  PayGramBillEscrow: string;
  PayGramRosca: string;
  PayGramTab: string;
  PayGramAllowance: string;
}> = {
  usdc: USDC_ARBITRUM_ONE,
  PayGramPot: '0x6D58560966914637565B4a10ebDADD56ea49E2cF',
  PayGramBillEscrow: '0xe927742DBfFa80Df2575B5220cc74d91459A86A8',
  PayGramRosca: '0xd6aCb0ef288001c171FCA29300f001970B2e5a45',
  PayGramTab: '0xcfbb48A1C3890BB9a550d92A3dC0A02571B0A4bE',
  PayGramAllowance: '0x1d19aD900A157d83982816B48f4452bD01eF8B7b',
};

/** Snapshot of contracts/deployments/arbitrumSepolia.json — rehearsal only. */
const SEPOLIA_DEPLOY = {
  usdc: '0x6D58560966914637565B4a10ebDADD56ea49E2cF',
  PayGramPot: '0xcfbb48A1C3890BB9a550d92A3dC0A02571B0A4bE',
  PayGramBillEscrow: '0x1d19aD900A157d83982816B48f4452bD01eF8B7b',
  PayGramRosca: '0xd6aCb0ef288001c171FCA29300f001970B2e5a45',
  PayGramTab: '0xDe6b429911735BD9a2B64BF1A7b92A144996233C',
  PayGramAllowance: '0xd95A1aA47B6C5aB010e43d792ad5336c3dFE0786',
} as const;

export type PayGramNetwork = 'arbitrum' | 'arbitrumSepolia';

export type ContractAddresses = {
  chainId: number;
  usdc: string;
  pot: string;
  billEscrow: string;
  rosca: string;
  tab: string;
  allowance: string;
  mockUsdc: boolean;
};

function envAddr(key: string): string | undefined {
  const v = import.meta.env[key]?.trim();
  if (!v || v === '0x' || !/^0x[a-fA-F0-9]{40}$/.test(v)) return undefined;
  return v;
}

/**
 * Production default: Arbitrum One (Particle UA).
 * Override with VITE_PAYGRAM_NETWORK=arbitrumSepolia only for offline rehearsal.
 */
export function getPayGramNetwork(): PayGramNetwork {
  const n = (import.meta.env.VITE_PAYGRAM_NETWORK ?? 'arbitrum').trim().toLowerCase();
  if (n === 'arbitrumsepolia' || n === 'sepolia') return 'arbitrumSepolia';
  return 'arbitrum';
}

export function getContractAddresses(): ContractAddresses | null {
  const network = getPayGramNetwork();

  if (network === 'arbitrum') {
    return {
      chainId: ARBITRUM_ONE,
      usdc: envAddr('VITE_USDC_ADDRESS') ?? ARBITRUM_DEPLOY.usdc ?? USDC_ARBITRUM_ONE,
      pot: envAddr('VITE_POT') ?? ARBITRUM_DEPLOY.PayGramPot ?? '',
      billEscrow: envAddr('VITE_BILL_ESCROW') ?? ARBITRUM_DEPLOY.PayGramBillEscrow ?? '',
      rosca: envAddr('VITE_ROSCA') ?? ARBITRUM_DEPLOY.PayGramRosca ?? '',
      tab: envAddr('VITE_TAB') ?? ARBITRUM_DEPLOY.PayGramTab ?? '',
      allowance: envAddr('VITE_ALLOWANCE') ?? ARBITRUM_DEPLOY.PayGramAllowance ?? '',
      mockUsdc: false,
    };
  }

  return {
    chainId: ARBITRUM_SEPOLIA,
    usdc: envAddr('VITE_USDC_ADDRESS') ?? SEPOLIA_DEPLOY.usdc,
    pot: envAddr('VITE_POT') ?? SEPOLIA_DEPLOY.PayGramPot,
    billEscrow: envAddr('VITE_BILL_ESCROW') ?? SEPOLIA_DEPLOY.PayGramBillEscrow,
    rosca: envAddr('VITE_ROSCA') ?? SEPOLIA_DEPLOY.PayGramRosca,
    tab: envAddr('VITE_TAB') ?? SEPOLIA_DEPLOY.PayGramTab,
    allowance: envAddr('VITE_ALLOWANCE') ?? SEPOLIA_DEPLOY.PayGramAllowance,
    mockUsdc: true,
  };
}

export function getContractsRpcUrl(chainId: number): string {
  if (chainId === ARBITRUM_SEPOLIA) {
    const configured = import.meta.env.VITE_ARB_SEPOLIA_RPC_URL?.trim();
    if (configured?.startsWith('http') && !configured.includes('YOUR_KEY')) return configured;
    return 'https://sepolia-rollup.arbitrum.io/rpc';
  }
  const configured = import.meta.env.VITE_ARB_RPC_URL?.trim();
  if (configured?.startsWith('http') && !configured.includes('YOUR_KEY')) return configured;
  return 'https://arbitrum-one.publicnode.com';
}

/** USDC amount in human dollars → 6-decimal base units. */
export function usdcToUnits(amountUsd: number): bigint {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('Invalid amount');
  return BigInt(Math.round(amountUsd * 1e6));
}

export function unitsToUsdc(units: bigint): number {
  return Number(units) / 1e6;
}

export function arbiscanAddressUrl(address: string): string {
  return `https://arbiscan.io/address/${address}`;
}

/** Mainnet vault addresses — sync with contracts/deployments/arbitrum.json */
export const ARBITRUM_MAINNET_CONTRACTS = {
  usdc: USDC_ARBITRUM_ONE,
  pot: '0x6D58560966914637565B4a10ebDADD56ea49E2cF',
  billEscrow: '0xe927742DBfFa80Df2575B5220cc74d91459A86A8',
  rosca: '0xd6aCb0ef288001c171FCA29300f001970B2e5a45',
  tab: '0xcfbb48A1C3890BB9a550d92A3dC0A02571B0A4bE',
  allowance: '0x1d19aD900A157d83982816B48f4452bD01eF8B7b',
  rescueGuardian: '0x77539C4ec616360751b97563Dd6B4A9dE5D1E578',
  deployer: '0x77539C4ec616360751b97563Dd6B4A9dE5D1E578',
} as const;
