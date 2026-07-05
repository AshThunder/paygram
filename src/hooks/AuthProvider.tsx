import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMagic } from './MagicProvider';
import { getTelegramUser } from '@/lib/telegram';
import { registerSelf } from '@/lib/parser';

type AuthContextType = {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
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
          }
        }
      } catch {
        // no session
      }
    };
    checkSession();
  }, [magic, telegramUser?.username]);

  const login = useCallback(async () => {
    if (!magic) throw new Error('Magic SDK not initialized');

    setIsLoggingIn(true);
    try {
      const email = telegramUser?.username
        ? `${telegramUser.username}@telegram.paygram.local`
        : prompt('Enter email for login:');

      if (!email) throw new Error('Email required');

      await magic.auth.loginWithEmailOTP({ email });

      const info = await magic.user.getInfo();
      const addr = info.wallets?.ethereum?.publicAddress;
      if (!addr) throw new Error('No wallet address returned');

      setWalletAddress(addr);
      localStorage.setItem('paygram_wallet', addr);
      registerSelf(telegramUser?.username, addr);
    } finally {
      setIsLoggingIn(false);
    }
  }, [magic, telegramUser?.username]);

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
