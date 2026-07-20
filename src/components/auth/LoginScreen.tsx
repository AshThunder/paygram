import { useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { useMagic } from '@/hooks/MagicProvider';
import { LoadingScreen } from '@/components/auth/LoadingScreen';
import { PayGramBrand } from '@/components/ui/PayGramLogo';
import { Icon } from '@/components/ui/Icon';
import { isTelegramMiniApp } from '@/lib/telegram';

/** Email OTP login only — Telegram Mini App is the shell, not an auth provider. */
export function LoginScreen() {
  const { login, isLoggingIn, telegramUser } = useAuth();
  const { magic } = useMagic();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasConfig = Boolean(
    import.meta.env.VITE_MAGIC_API_KEY &&
      import.meta.env.VITE_PROJECT_ID &&
      import.meta.env.VITE_CLIENT_KEY &&
      import.meta.env.VITE_APP_ID,
  );

  const handleLogin = async (loginEmail: string) => {
    setError(null);
    try {
      await login(loginEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  if (!hasConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-body-sm text-outline">Configure Magic + Particle in .env</p>
      </div>
    );
  }

  if (!magic) {
    return (
      <LoadingScreen message="Starting PayGram…" subtitle="Initializing secure login" />
    );
  }

  const inTelegram = Boolean(telegramUser) || isTelegramMiniApp();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-container-padding py-stack-gap-lg">
        <div className="mb-stack-gap-lg flex w-full justify-center">
          <PayGramBrand subtitle="Sign in to get started" className="scale-90" />
        </div>

        <div className="mb-10 w-full space-y-3 text-center">
          <h1 className="text-headline-md text-on-surface">Welcome back</h1>
          <p className="mx-auto max-w-[280px] text-body-lg text-on-surface-variant">
            Email login unlocks your wallet
            {inTelegram ? ' inside Telegram' : ''} — no seed phrase.
          </p>
        </div>

        {inTelegram && telegramUser && (
          <div className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-surface-variant bg-surface-container-lowest p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-primary-fixed font-bold text-primary">
              {telegramUser.firstName.slice(0, 1)}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-label-md text-on-surface">{telegramUser.firstName}</span>
              {telegramUser.username && (
                <span className="text-body-sm text-on-surface-variant">
                  Telegram @{telegramUser.username}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex w-full flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            className="h-14 w-full rounded-full border border-outline-variant bg-surface-container-lowest px-5 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim()) void handleLogin(email.trim());
            }}
          />
          {error && (
            <p className="rounded-xl border border-error-container bg-error-container/40 px-3 py-2 text-center text-body-sm text-error">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleLogin(email.trim())}
            disabled={isLoggingIn || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-headline-md text-on-primary transition-opacity hover:opacity-90 active:scale-[0.96] disabled:opacity-50"
          >
            <Icon name="mail" />
            {isLoggingIn ? 'Connecting…' : 'Send login code'}
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="flex items-center justify-center gap-1 text-label-sm text-on-surface-variant opacity-70">
            Powered by <span className="font-bold text-primary">PayGram</span>
          </p>
        </div>
      </main>
    </div>
  );
}
