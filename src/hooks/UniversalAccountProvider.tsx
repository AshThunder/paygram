import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  CHAIN_ID,
  SUPPORTED_TOKEN_TYPE,
  PREFER_TOKEN_TYPE,
  type IAssetsResponse,
  type ITransaction,
} from '@particle-network/universal-account-sdk';
import { BrowserProvider, JsonRpcProvider, getBytes, Signature } from 'ethers';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useMagic } from './MagicProvider';
import {
  ARBITRUM_CHAIN_ID,
  CHAIN_LABEL,
  MAGIC_7702_CHAINS,
  getChainRpcCandidates,
  USDC_ARBITRUM,
} from '@/lib/constants';
import { getTokenBreakdown } from '@/lib/assets';
import { unlockSession, clearSession } from '@/lib/sessionKeys';
import { assertArbUsdcSpendReady, spendableUsd } from '@/lib/uaTransfer';

/** Magick chains with enough balance that Particle may convert from. */
function magickChainsWithAssets(assets: IAssetsResponse | null | undefined): number[] {
  if (!assets) return [];
  const ids = new Set<number>();
  for (const t of getTokenBreakdown(assets)) {
    if (
      t.amountInUSD >= 0.05 &&
      (MAGIC_7702_CHAINS as readonly number[]).includes(t.chainId)
    ) {
      ids.add(t.chainId);
    }
  }
  return [...ids];
}

/** Match Particle Magick demo — Signature.from({ r, s, v }). */
function serializeMagic7702Auth(authorization: {
  r: string;
  s: string;
  v?: number | string;
  yParity?: number;
}): string {
  const r = authorization.r.startsWith('0x') ? authorization.r : `0x${authorization.r}`;
  const s = authorization.s.startsWith('0x') ? authorization.s : `0x${authorization.s}`;
  if (authorization.v !== undefined && authorization.v !== null && authorization.v !== '') {
    return Signature.from({ r, s, v: Number(authorization.v) }).serialized;
  }
  if (authorization.yParity === 0 || authorization.yParity === 1) {
    return Signature.from({ r, s, yParity: authorization.yParity }).serialized;
  }
  return Signature.from({ r, s, v: 27 }).serialized;
}

async function fetch7702TxParams(
  from: string,
  chainId: number,
): Promise<{
  nonce: number;
  gas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}> {
  let lastErr: unknown;
  for (const rpcUrl of getChainRpcCandidates(chainId)) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
      const [nonce, feeData, balance] = await Promise.all([
        provider.getTransactionCount(from, 'pending'),
        provider.getFeeData(),
        provider.getBalance(from),
      ]);

      if (balance === 0n) {
        throw new Error('insufficient funds');
      }

      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 1_000_000n;
      const maxFeePerGas = feeData.maxFeePerGas ?? (feeData.gasPrice ?? 100_000_000n) * 2n;

      return {
        nonce,
        gas: `0x${(200_000).toString(16)}`,
        maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
        maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
      };
    } catch (err) {
      if (err instanceof Error && /insufficient funds/i.test(err.message)) throw err;
      lastErr = err;
      console.warn('fetch7702TxParams rpc failed', chainId, rpcUrl, err);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Unable to get network info for chain ${chainId}`);
}

type AccountInfo = {
  ownerAddress: string;
  evmSmartAccount: string;
  solanaSmartAccount: string;
};

type ContractCall = { to: string; data: string; value?: string };

type UAContextType = {
  universalAccount: UniversalAccount | null;
  accountInfo: AccountInfo;
  primaryAssets: IAssetsResponse | null;
  isDelegated: boolean;
  isWalletReady: boolean;
  initError: string | null;
  refreshBalance: () => Promise<IAssetsResponse | null>;
  ensureDelegated: (opts?: {
    force?: boolean;
    /** When set, also Type-4 pre-delegate Magick chains that hold spendable assets. */
    assets?: IAssetsResponse | null;
  }) => Promise<'ready' | 'deferred'>;
  signAndSend: (transaction: ITransaction) => Promise<{ transactionId: string }>;
  /** Approve + contract calls on Arbitrum One via Particle createUniversalTransaction. */
  executeContractCalls: (opts: {
    calls: ContractCall[];
    expectUsdc?: string;
    chainId?: number;
  }) => Promise<{ transactionId: string }>;
  executeSwap: (amount: number, toToken: string) => Promise<{ transactionId: string }>;
  getTransaction: (transactionId: string) => Promise<{ status?: number | string } | null>;
  fetchChainActivity: (page?: number) => Promise<Array<{ transactionId: string; status?: number | string; tag?: string; created_at?: string }>>;
  loading: boolean;
};

const UAContext = createContext<UAContextType>({
  universalAccount: null,
  accountInfo: { ownerAddress: '', evmSmartAccount: '', solanaSmartAccount: '' },
  primaryAssets: null,
  isDelegated: false,
  isWalletReady: false,
  initError: null,
  refreshBalance: async () => ({} as IAssetsResponse),
  ensureDelegated: async () => 'ready',
  signAndSend: async () => ({ transactionId: '' }),
  executeContractCalls: async () => ({ transactionId: '' }),
  executeSwap: async () => ({ transactionId: '' }),
  getTransaction: async () => null,
  fetchChainActivity: async () => [],
  loading: false,
});

export const useUniversalAccount = () => useContext(UAContext);

function particleConfig(): { projectId: string; projectClientKey: string; projectAppUuid: string } | null {
  const projectId = import.meta.env.VITE_PROJECT_ID;
  const projectClientKey = import.meta.env.VITE_CLIENT_KEY;
  const projectAppUuid = import.meta.env.VITE_APP_ID;
  if (!projectId || !projectClientKey || !projectAppUuid) return null;
  return { projectId, projectClientKey, projectAppUuid };
}

export function UniversalAccountProvider({ children }: { children: ReactNode }) {
  const { magic } = useMagic();
  const { walletAddress } = useAuth();
  const [universalAccount, setUniversalAccount] = useState<UniversalAccount | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    ownerAddress: '',
    evmSmartAccount: '',
    solanaSmartAccount: '',
  });
  const [primaryAssets, setPrimaryAssets] = useState<IAssetsResponse | null>(null);
  const [onChainDelegated, setOnChainDelegated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // UI / gates: Particle on-chain status only. A failed payment (AA24) must NOT
  // pretend the wallet was never unlocked — that forced Arb-ETH setup again.
  const isDelegated = onChainDelegated;

  useEffect(() => {
    if (!walletAddress || !magic) {
      setUniversalAccount(null);
      setInitError(null);
      return;
    }

    const config = particleConfig();
    if (!config) {
      setUniversalAccount(null);
      setInitError('Particle credentials missing — check VITE_PROJECT_ID, VITE_CLIENT_KEY, VITE_APP_ID');
      return;
    }

    try {
      const ua = new UniversalAccount({
        projectId: config.projectId,
        projectClientKey: config.projectClientKey,
        projectAppUuid: config.projectAppUuid,
        // UA SDK 2.x: owner lives only under smartAccountOptions (top-level removed).
        smartAccountOptions: {
          useEIP7702: true,
          name: 'UNIVERSAL',
          version: UNIVERSAL_ACCOUNT_VERSION,
          ownerAddress: walletAddress,
        },
        tradeConfig: {
          slippageBps: 100,
          // Prefer USDC/USDT for fees so dust ETH on another chain doesn't block Arb txs.
          preferTokenType: PREFER_TOKEN_TYPE.USD,
        },
      });
      setUniversalAccount(ua);
      setInitError(null);
    } catch (err) {
      console.error('UniversalAccount init failed:', err);
      setUniversalAccount(null);
      setInitError(err instanceof Error ? err.message : 'Failed to initialize wallet');
    }
  }, [walletAddress, magic]);

  const refreshDelegationStatus = useCallback(async () => {
    if (!universalAccount) return;
    const deployments = await universalAccount.getEIP7702Deployments();
    const arb = deployments.find((d: { chainId: number }) => d.chainId === ARBITRUM_CHAIN_ID);
    const delegated = (arb as { isDelegated?: boolean } | undefined)?.isDelegated ?? false;
    setOnChainDelegated(delegated);
    if (delegated) unlockSession();
    else clearSession();
  }, [universalAccount]);

  useEffect(() => {
    if (!universalAccount || !walletAddress) return;

    const fetchAccountData = async () => {
      setLoading(true);
      try {
        const options = await universalAccount.getSmartAccountOptions();
        setAccountInfo({
          ownerAddress: walletAddress,
          evmSmartAccount: options.smartAccountAddress || '',
          solanaSmartAccount: options.solanaSmartAccountAddress || '',
        });
        await refreshDelegationStatus();
        const assets = await universalAccount.getPrimaryAssets();
        setPrimaryAssets(assets);
      } catch (err) {
        console.error('Failed to fetch UA data:', err);
        setInitError(err instanceof Error ? err.message : 'Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };

    void fetchAccountData();
  }, [universalAccount, walletAddress, refreshDelegationStatus]);

  const refreshBalance = useCallback(async () => {
    if (!universalAccount) return null;
    try {
      const assets = await universalAccount.getPrimaryAssets();
      setPrimaryAssets(assets);
      return assets;
    } catch (err) {
      console.error('Failed to refresh balance:', err);
      return null;
    }
  }, [universalAccount]);

  const signEip7702Auth = useCallback(
    async (contractAddress: string, chainId: number, nonce?: number) => {
      if (!magic) throw new Error('Magic not ready');
      return magic.wallet.sign7702Authorization({
        contractAddress,
        chainId,
        ...(nonce !== undefined && { nonce }),
      });
    },
    [magic],
  );

  /** Type-4 pre-delegate on one Magick-supported chain (Particle Magick requirement). */
  const ensureChainDelegated = useCallback(
    async (chainId: number) => {
      if (!universalAccount || !magic || !walletAddress) {
        throw new Error('Universal Account or wallet not ready');
      }
      if (!(MAGIC_7702_CHAINS as readonly number[]).includes(chainId)) {
        throw new Error(`Magick can’t unlock on chain ${chainId}`);
      }

      const deployments = await universalAccount.getEIP7702Deployments();
      const entry = deployments.find((d: { chainId: number }) => d.chainId === chainId);
      if ((entry as { isDelegated?: boolean } | undefined)?.isDelegated) return;

      try {
        await magic.evm.switchChain(chainId);
      } catch (err) {
        console.warn('switchChain', chainId, err);
      }

      const label = CHAIN_LABEL[chainId] ?? `chain ${chainId}`;
      try {
        const [auth] = await universalAccount.getEIP7702Auth([chainId]);
        const authorization = await signEip7702Auth(auth.address, chainId, auth.nonce + 1);
        const txParams = await fetch7702TxParams(walletAddress, chainId);
        await magic.wallet.send7702Transaction({
          to: walletAddress,
          data: '0x',
          authorizationList: [authorization],
          ...txParams,
        });
      } catch (err) {
        const base = err instanceof Error ? err.message : String(err);
        if (/insufficient funds/i.test(base)) {
          throw new Error(
            chainId === ARBITRUM_CHAIN_ID
              ? 'One-time unlock needs ~$0.01 ETH on Arbitrum. Same address — pick Arbitrum (not Ethereum), then Unlock again.'
              : `To convert funds from ${label}, need a tiny ETH on ${label} for one-time setup. Or add USDC on Arbitrum.`,
          );
        }
        if (/Unable to get network info|network info/i.test(base)) {
          throw new Error(
            chainId === ARBITRUM_CHAIN_ID
              ? 'Couldn’t reach Arbitrum for unlock. Hard-refresh, then Me → Unlock again. Or add USDC on Arbitrum.'
              : `Couldn’t reach ${label} for unlock. Hard-refresh and retry — or add USDC on Arbitrum (same address) to skip convert.`,
          );
        }
        throw new Error(
          /AA24/i.test(base)
            ? `Unlock on ${label} failed (AA24). Retry Unlock, or add a tiny ETH on ${label}.`
            : `Unlock on ${label} failed — ${base}`,
        );
      }
    },
    [universalAccount, magic, walletAddress, signEip7702Auth],
  );

  /**
   * Magick cannot sign Particle’s chainId:0 (chain-agnostic) EIP-7702 auth.
   * Particle Magick guide: Type-4 pre-delegate every Magick chain that holds
   * funds BEFORE createUniversalTransaction — otherwise convert userOps ask for
   * chainId:0 signatures, Magick substitutes a concrete chainId, and Particle
   * rejects with AA24.
   */
  const ensureDelegated = useCallback(
    async (opts?: {
      force?: boolean;
      assets?: IAssetsResponse | null;
    }): Promise<'ready' | 'deferred'> => {
      if (!universalAccount || !magic || !walletAddress) {
        throw new Error('Universal Account or wallet not ready');
      }
      void opts?.force;

      await ensureChainDelegated(ARBITRUM_CHAIN_ID);

      // Hard-require unlock on every Magick chain holding spendable assets.
      // Soft-fail here was what produced the AA24 loop on Lend/Send convert.
      for (const chainId of magickChainsWithAssets(opts?.assets)) {
        if (chainId === ARBITRUM_CHAIN_ID) continue;
        await ensureChainDelegated(chainId);
      }

      // Magick signing / UA rootHash must run with Arbitrum as the active chain.
      try {
        await magic.evm.switchChain(ARBITRUM_CHAIN_ID);
      } catch {
        /* ignore */
      }

      await refreshDelegationStatus();

      const deployments = await universalAccount.getEIP7702Deployments();
      const arb = deployments.find((d: { chainId: number }) => d.chainId === ARBITRUM_CHAIN_ID);
      const ok = Boolean((arb as { isDelegated?: boolean } | undefined)?.isDelegated);
      setOnChainDelegated(ok);
      if (ok) unlockSession();
      else {
        clearSession();
        throw new Error(
          'Unlock submitted but Arbitrum isn’t ready yet. Wait a few seconds, then Me → Unlock wallet again.',
        );
      }
      return 'ready';
    },
    [universalAccount, magic, walletAddress, ensureChainDelegated, refreshDelegationStatus],
  );

  const signAndSend = useCallback(
    async (transaction: ITransaction) => {
      if (!universalAccount || !magic || !walletAddress) {
        throw new Error('Universal Account or wallet not ready');
      }

      type EIP7702Authorization = { userOpHash: string; signature: string };
      const authorizations: EIP7702Authorization[] = [];
      const nonceMap = new Map<number, string>();

      for (const userOp of transaction.userOps ?? []) {
        if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
          let signatureSerialized = nonceMap.get(userOp.eip7702Auth.nonce);

          if (!signatureSerialized) {
            // Magick rejects chainId 0. Substituting another chainId while the
            // userOp still carries chainId 0 → AA24. Pre-delegate in
            // ensureDelegated so Particle marks eip7702Delegated and skips this.
            const authChainId = Number(userOp.eip7702Auth.chainId);
            const opChainId = Number(userOp.chainId);
            const signChainId = authChainId || opChainId || 0;

            if (!signChainId || authChainId === 0) {
              throw new Error(
                'Need a one-time unlock on the network holding your funds before converting. Me → Unlock wallet, or add USDC on Arbitrum.',
              );
            }

            if (!(MAGIC_7702_CHAINS as readonly number[]).includes(signChainId)) {
              throw new Error(
                'This convert needs a network Magick can’t unlock. Add USDC on Arbitrum (same address), then retry.',
              );
            }

            try {
              await magic.evm.switchChain(signChainId);
            } catch {
              /* ignore */
            }

            const authorization = await signEip7702Auth(
              userOp.eip7702Auth.address,
              signChainId,
              userOp.eip7702Auth.nonce,
            );

            signatureSerialized = serializeMagic7702Auth(authorization);
            nonceMap.set(userOp.eip7702Auth.nonce, signatureSerialized);
          }

          if (signatureSerialized) {
            authorizations.push({
              userOpHash: userOp.userOpHash,
              signature: signatureSerialized,
            });
          }
        }
      }

      // Always return Magick to Arbitrum before personal_sign(rootHash).
      try {
        await magic.evm.switchChain(ARBITRUM_CHAIN_ID);
      } catch {
        /* ignore */
      }

      const provider = new BrowserProvider(magic.rpcProvider as import('ethers').Eip1193Provider);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(getBytes(transaction.rootHash));
      let result: { transactionId: string };
      try {
        result = (await universalAccount.sendTransaction(
          transaction,
          signature,
          authorizations.length > 0 ? authorizations : undefined,
        )) as { transactionId: string };
      } catch (err) {
        const base = err instanceof Error ? err.message : String(err);
        if (/AA24/i.test(base)) {
          throw new Error(
            'Convert needs a one-time unlock on the network holding your funds (tiny ETH there for gas), or add USDC on Arbitrum — same wallet address.',
          );
        }
        throw err;
      }
      if (authorizations.length > 0) {
        await refreshDelegationStatus();
      }
      return result;
    },
    [
      universalAccount,
      magic,
      walletAddress,
      signEip7702Auth,
      ensureChainDelegated,
      refreshDelegationStatus,
    ],
  );

  const executeContractCalls = useCallback(
    async (opts: { calls: ContractCall[]; expectUsdc?: string; chainId?: number }) => {
      if (!universalAccount || !magic || !walletAddress) {
        throw new Error('Universal Account or wallet not ready');
      }
      if (!opts.calls.length) throw new Error('No contract calls');

      const chainId = opts.chainId ?? CHAIN_ID.ARBITRUM_MAINNET_ONE;
      if (chainId !== CHAIN_ID.ARBITRUM_MAINNET_ONE) {
        throw new Error('Particle Universal Account only supports Arbitrum One for contract calls');
      }

      const refreshed = await refreshBalance();
      // Prefer refresh, but if Particle returns a hollow total, keep prior holdings.
      const assets =
        refreshed && spendableUsd(refreshed) >= 0.01
          ? refreshed
          : (primaryAssets ?? refreshed);
      if (opts.expectUsdc) {
        assertArbUsdcSpendReady({
          amount: Number(opts.expectUsdc),
          assets,
          verb: 'This action',
        });
      }

      const expectTokens = opts.expectUsdc
        ? [{ type: SUPPORTED_TOKEN_TYPE.USDC, amount: opts.expectUsdc }]
        : [];

      // Magick: Type-4 every funding chain BEFORE create — never after (AA24).
      await ensureDelegated({ assets });
      const transaction = await universalAccount.createUniversalTransaction({
        chainId,
        expectTokens,
        transactions: opts.calls.map((c) => ({
          to: c.to,
          data: c.data,
          value: c.value ?? '0x0',
        })),
      });
      const result = await signAndSend(transaction);
      await refreshBalance();
      return result;
    },
    [
      universalAccount,
      magic,
      walletAddress,
      ensureDelegated,
      signAndSend,
      refreshBalance,
      primaryAssets,
    ],
  );

  const executeSwap = useCallback(
    async (amount: number, toToken: string) => {
      if (!universalAccount || !magic || !walletAddress) {
        throw new Error('Universal Account or wallet not ready');
      }
      const assets = (await refreshBalance()) ?? primaryAssets;
      await ensureDelegated({ assets });

      const tokenType = toToken.toUpperCase();
      const zero = '0x0000000000000000000000000000000000000000';
      // UA SDK 2.x dropped createSwapTransaction — buy-with-USD is the equivalent.
      const token =
        tokenType === 'SOL'
          ? { chainId: CHAIN_ID.SOLANA_MAINNET, address: zero }
          : tokenType === 'ETH'
            ? { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: zero }
            : tokenType === 'USDC'
              ? { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM }
              : tokenType === 'BNB'
                ? { chainId: CHAIN_ID.BSC_MAINNET, address: zero }
                : null;

      if (!token) {
        throw new Error(`Swap to ${tokenType} is not supported (try ETH, SOL, USDC, or BNB)`);
      }

      const transaction = await universalAccount.createBuyTransaction({
        token,
        amountInUSD: String(amount),
      });
      const result = await signAndSend(transaction);
      await refreshBalance();
      return result;
    },
    [
      universalAccount,
      magic,
      walletAddress,
      ensureDelegated,
      signAndSend,
      refreshBalance,
      primaryAssets,
    ],
  );

  const getTransaction = useCallback(
    async (transactionId: string) => {
      if (!universalAccount) return null;
      const fn = universalAccount.getTransaction;
      if (!fn) return null;
      try {
        return await fn.call(universalAccount, transactionId);
      } catch (err) {
        console.error('getTransaction failed:', err);
        return null;
      }
    },
    [universalAccount],
  );

  const fetchChainActivity = useCallback(
    async (page = 1) => {
      if (!universalAccount) return [];
      const fn = universalAccount.getTransactions;
      if (!fn) return [];
      try {
        const result = await fn.call(universalAccount, page, 20);
        return result?.transactions ?? [];
      } catch (err) {
        console.error('getTransactions failed:', err);
        return [];
      }
    },
    [universalAccount],
  );

  const isWalletReady = Boolean(universalAccount && magic && walletAddress && !initError);

  const value = useMemo(
    () => ({
      universalAccount,
      accountInfo,
      primaryAssets,
      isDelegated,
      isWalletReady,
      initError,
      refreshBalance,
      ensureDelegated,
      signAndSend,
      executeContractCalls,
      executeSwap,
      getTransaction,
      fetchChainActivity,
      loading,
    }),
    [universalAccount, accountInfo, primaryAssets, isDelegated, isWalletReady, initError, refreshBalance, ensureDelegated, signAndSend, executeContractCalls, executeSwap, getTransaction, fetchChainActivity, loading],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}
