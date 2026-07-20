import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMagic } from './MagicProvider';
import { getTelegramUser, isTelegramMiniApp } from '@/lib/telegram';
import { normalizeHandle } from '@/lib/constants';
import { registerSelf } from '@/lib/parser';
import { registerUserApi, lookupUserByWalletApi } from '@/lib/api';
import { clearSession } from '@/lib/sessionKeys';

const USERNAME_KEY = 'paygram_username';

type AuthContextType = {
  walletAddress: string | null;
  userEmail: string | null;
  /** Claimed PayGram @username (no @). Unique per wallet. */
  paygramUsername: string | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  isLoggingIn: boolean;
  login: (email: string) => Promise<void>;
  linkEmail: (email: string) => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  /** Telegram WebApp profile when opened as Mini App (not a login method). */
  telegramUser: ReturnType<typeof getTelegramUser>;
};

const AuthContext = createContext<AuthContextType>({
  walletAddress: null,
  userEmail: null,
  paygramUsername: null,
  isAuthenticated: false,
  isAuthChecking: true,
  isLoggingIn: false,
  login: async () => {},
  linkEmail: async () => {},
  claimUsername: async () => {},
  refreshProfile: async () => {},
  logout: async () => {},
  telegramUser: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { magic } = useMagic();
  const [walletAddress, setWalletAddress] = useState<string | null>(
    () => localStorage.getItem('paygram_wallet'),
  );
  const [userEmail, setUserEmail] = useState<string | null>(
    () => localStorage.getItem('paygram_email'),
  );
  const [paygramUsername, setPaygramUsername] = useState<string | null>(
    () => localStorage.getItem(USERNAME_KEY),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const telegramUser = getTelegramUser();

  const syncFromMagic = useCallback(async () => {
    if (!magic) return;
    const info = await magic.user.getInfo();
    const addr = info.wallets?.ethereum?.publicAddress ?? null;
    const email = info.email?.trim() || null;

    if (email) {
      setUserEmail(email);
      localStorage.setItem('paygram_email', email);
    }

    if (addr) {
      setWalletAddress(addr);
      localStorage.setItem('paygram_wallet', addr);

      // Prefer server registry — Telegram WebViews often wipe localStorage.
      let claimed = localStorage.getItem(USERNAME_KEY);
      const remote = await lookupUserByWalletApi(addr);
      if (remote?.username) {
        claimed = normalizeHandle(remote.username);
        localStorage.setItem(USERNAME_KEY, claimed);
      }

      if (claimed) {
        const handle = normalizeHandle(claimed);
        setPaygramUsername(handle);
        registerSelf(handle, addr);
      } else {
        setPaygramUsername(null);
      }

      // Soft sync telegramId / email; never overwrite username unless already claimed.
      await registerUserApi({
        telegramId: telegramUser?.id,
        username: claimed ? normalizeHandle(claimed) : undefined,
        displayName: telegramUser?.firstName,
        walletAddress: addr,
        email: email ?? undefined,
      }).catch(() => null);
    }
  }, [magic, telegramUser]);

  useEffect(() => {
    const checkSession = async () => {
      const hasConfig = Boolean(import.meta.env.VITE_MAGIC_API_KEY);
      if (!magic) {
        if (!hasConfig) setIsAuthChecking(false);
        return;
      }
      try {
        if (isTelegramMiniApp()) {
          await new Promise((r) => setTimeout(r, 1500));
        }

        const loggedIn = await magic.user.isLoggedIn();
        if (!loggedIn) {
          localStorage.removeItem('paygram_wallet');
          localStorage.removeItem('paygram_email');
          setWalletAddress(null);
          setUserEmail(null);
          return;
        }

        await syncFromMagic();
      } catch {
        localStorage.removeItem('paygram_wallet');
        localStorage.removeItem('paygram_email');
        setWalletAddress(null);
        setUserEmail(null);
      } finally {
        setIsAuthChecking(false);
      }
    };
    void checkSession();
  }, [magic, syncFromMagic]);

  const login = useCallback(
    async (email: string) => {
      if (!magic) throw new Error('Magic SDK not initialized');
      if (!email.trim()) throw new Error('Email required');

      setIsLoggingIn(true);
      try {
        await magic.auth.loginWithEmailOTP({ email: email.trim() });
        await syncFromMagic();
      } finally {
        setIsLoggingIn(false);
      }
    },
    [magic, syncFromMagic],
  );

  const linkEmail = useCallback(
    async (email: string) => {
      if (!magic) throw new Error('Magic SDK not initialized');
      if (!email.trim()) throw new Error('Email required');
      const loggedIn = await magic.user.isLoggedIn();
      if (!loggedIn) throw new Error('Sign in first');

      setIsLoggingIn(true);
      try {
        await magic.auth.updateEmailWithUI({ email: email.trim(), showUI: true });
        await syncFromMagic();
      } finally {
        setIsLoggingIn(false);
      }
    },
    [magic, syncFromMagic],
  );

  const claimUsername = useCallback(
    async (raw: string) => {
      if (!walletAddress) throw new Error('Sign in first');
      const username = normalizeHandle(raw);
      if (!/^[a-z0-9_]{3,32}$/.test(username)) {
        throw new Error('Use 3–32 characters: letters, numbers, underscore.');
      }

      await registerUserApi({
        telegramId: telegramUser?.id,
        username,
        displayName: telegramUser?.firstName ?? username,
        walletAddress,
        email: userEmail ?? undefined,
      });

      localStorage.setItem(USERNAME_KEY, username);
      setPaygramUsername(username);
      registerSelf(username, walletAddress);
    },
    [walletAddress, telegramUser, userEmail],
  );

  const logout = useCallback(async () => {
    if (magic) {
      const loggedIn = await magic.user.isLoggedIn();
      if (loggedIn) await magic.user.logout();
    }
    localStorage.removeItem('paygram_wallet');
    localStorage.removeItem('paygram_email');
    localStorage.removeItem(USERNAME_KEY);
    clearSession();
    setWalletAddress(null);
    setUserEmail(null);
    setPaygramUsername(null);
  }, [magic]);

  const value = useMemo(
    () => ({
      walletAddress,
      userEmail,
      paygramUsername,
      isAuthenticated: Boolean(walletAddress),
      isAuthChecking,
      isLoggingIn,
      login,
      linkEmail,
      claimUsername,
      refreshProfile: syncFromMagic,
      logout,
      telegramUser,
    }),
    [
      walletAddress,
      userEmail,
      paygramUsername,
      isAuthChecking,
      isLoggingIn,
      login,
      linkEmail,
      claimUsername,
      syncFromMagic,
      logout,
      telegramUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
