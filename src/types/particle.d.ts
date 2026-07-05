declare module '@particle-network/universal-account-sdk' {
  export const UNIVERSAL_ACCOUNT_VERSION: string;
  export const CHAIN_ID: {
    ARBITRUM_MAINNET_ONE: number;
    SOLANA_MAINNET: number;
    [key: string]: number;
  };

  export type IAssetsResponse = {
    totalAmountInUSD: number;
    [key: string]: unknown;
  };

  export class UniversalAccount {
    constructor(config: Record<string, unknown>);
    getPrimaryAssets(): Promise<IAssetsResponse>;
    getSmartAccountOptions(): Promise<{
      smartAccountAddress?: string;
      solanaSmartAccountAddress?: string;
    }>;
    getEIP7702Deployments(): Promise<Array<{ chainId: number; isDelegated?: boolean }>>;
    getEIP7702Auth(chainIds: number[]): Promise<Array<{ address: string; nonce: number }>>;
    createTransferTransaction(params: Record<string, unknown>): Promise<Record<string, unknown>>;
    sendTransaction(
      transaction: Record<string, unknown>,
      signature: string,
      authorizations?: Array<{ userOpHash: string; signature: string }>,
    ): Promise<{ transactionId: string }>;
  }
}
