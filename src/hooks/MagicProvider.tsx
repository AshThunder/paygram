import { EVMExtension } from '@magic-ext/evm';
import { Magic as MagicBase } from 'magic-sdk';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ARBITRUM_CHAIN_ID } from '@/lib/constants';

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

    const rpc = import.meta.env.VITE_ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc';
    const instance = new MagicBase(key, {
      extensions: [
        new EVMExtension([
          { rpcUrl: rpc, chainId: ARBITRUM_CHAIN_ID, default: true },
        ]),
      ],
    });

    setMagic(instance);
  }, []);

  const value = useMemo(() => ({ magic }), [magic]);

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}
