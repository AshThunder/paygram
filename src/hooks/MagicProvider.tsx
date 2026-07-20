import { EVMExtension } from '@magic-ext/evm';
import { Magic as MagicBase } from 'magic-sdk';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ARBITRUM_CHAIN_ID,
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  getArbitrumRpcUrl,
  getBaseRpcUrl,
  getEthereumRpcUrl,
} from '@/lib/constants';

export type MagicInstance = MagicBase<[EVMExtension]>;

type MagicContextType = {
  magic: MagicInstance | null;
};

const MagicContext = createContext<MagicContextType>({ magic: null });

export const useMagic = () => useContext(MagicContext);

export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<MagicInstance | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_MAGIC_API_KEY;
    if (!key) return;

    // Magick cannot sign chainId:0 (chain-agnostic) EIP-7702 auth from Particle.
    // Register every chain we may pre-delegate / convert from (Particle Magick guide).
    const instance = new MagicBase(key, {
      extensions: [
        new EVMExtension([
          { rpcUrl: getArbitrumRpcUrl(), chainId: ARBITRUM_CHAIN_ID, default: true },
          { rpcUrl: getEthereumRpcUrl(), chainId: ETHEREUM_CHAIN_ID },
          { rpcUrl: getBaseRpcUrl(), chainId: BASE_CHAIN_ID },
        ]),
      ],
    });

    setMagic(instance);
  }, []);

  const value = useMemo(() => ({ magic }), [magic]);

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}
