import { useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { useMagic } from '@/hooks/MagicProvider';

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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-surface-dark">
        <h1 className="text-2xl font-bold text-text-primary mb-2">PayGram</h1>
        <p className="text-text-muted text-sm mb-4">
          Copy <code className="text-brand">.env.example</code> to <code className="text-brand">.env</code> and add
          your Magic + Particle credentials.
        </p>
      </div>
    );
  }

  if (!magic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inTelegram = Boolean(telegramUser);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-surface-dark">
      <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center text-3xl mb-6">
        💸
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">PayGram</h1>
      <p className="text-text-muted text-sm text-center mb-6 max-w-xs">Type it. Tap confirm. Paid.</p>

      <div className="w-full max-w-xs space-y-4">
        {inTelegram && (
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
            <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider mb-1">Telegram</p>
            <p className="text-text-primary font-medium">
              {telegramUser!.firstName}
              {telegramUser!.username && (
                <span className="text-text-secondary"> @{telegramUser!.username}</span>
              )}
            </p>
          </div>
        )}

        <label className="block">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 block">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full h-12 px-4 bg-surface-card border border-surface-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand/50"
          />
          {inTelegram && (
            <p className="text-text-muted text-xs mt-2">
              Magic sends a one-time code to this email to create your wallet. Your Telegram @username is used for payments.
            </p>
          )}
        </label>

        {error && (
          <p className="text-danger text-sm text-center bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => handleLogin(email.trim())}
          disabled={isLoggingIn || !email.trim()}
          className="w-full h-12 bg-brand hover:bg-brand-light disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {isLoggingIn ? 'Connecting…' : 'Send login code'}
        </button>
      </div>

      <p className="text-text-muted text-xs mt-6">No seed phrases. No gas. No chains.</p>
    </div>
  );
}
