import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMagic } from './MagicProvider';
import { getTelegramUser } from '@/lib/telegram';
import { registerSelf } from '@/lib/parser';
import { registerUserApi } from '@/lib/api';

type AuthContextType = {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  telegramUser: ReturnType<typeof getTelegramUser>;
};

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  isAuthenticated: false,
  isLoggingIn: false,
  login: async () => {},
  logout: async () => {},
  telegramUser: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { magic } = useMagic();
  const [walletAddress, setWalletAddress] = useState<string | null>(
    () => localStorage.getItem('paygram_wallet'),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const telegramUser = getTelegramUser();

  useEffect(() => {
    const checkSession = async () => {
      if (!magic) return;
      try {
        const loggedIn = await magic.user.isLoggedIn();
        if (loggedIn) {
          const info = await magic.user.getInfo();
          const addr = info.wallets?.ethereum?.publicAddress;
          if (addr) {
            setWalletAddress(addr);
            localStorage.setItem('paygram_wallet', addr);
            registerSelf(telegramUser?.username, addr);
            await registerUserApi({
              telegramId: telegramUser?.id,
              username: telegramUser?.username,
              displayName: telegramUser?.firstName,
              walletAddress: addr,
            });
          }
        }
      } catch {
        // no session
      }
    };
    checkSession();
  }, [magic, telegramUser]);

  const login = useCallback(async (email: string) => {
    if (!magic) throw new Error('Magic SDK not initialized');
    if (!email.trim()) throw new Error('Email required');

    setIsLoggingIn(true);
    try {
      await magic.auth.loginWithEmailOTP({ email: email.trim() });

      const info = await magic.user.getInfo();
      const addr = info.wallets?.ethereum?.publicAddress;
      if (!addr) throw new Error('No wallet address returned');

      setWalletAddress(addr);
      localStorage.setItem('paygram_wallet', addr);
      registerSelf(telegramUser?.username, addr);
      await registerUserApi({
        telegramId: telegramUser?.id,
        username: telegramUser?.username,
        displayName: telegramUser?.firstName,
        walletAddress: addr,
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [magic, telegramUser]);

  const logout = useCallback(async () => {
    if (magic) {
      const loggedIn = await magic.user.isLoggedIn();
      if (loggedIn) await magic.user.logout();
    }
    localStorage.removeItem('paygram_wallet');
    setWalletAddress(null);
  }, [magic]);

  const value = useMemo(
    () => ({
      walletAddress,
      isAuthenticated: Boolean(walletAddress),
      isLoggingIn,
      login,
      logout,
      telegramUser,
    }),
    [walletAddress, isLoggingIn, login, logout, telegramUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
