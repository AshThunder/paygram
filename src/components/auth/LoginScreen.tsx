import { useAuth } from '@/hooks/AuthProvider';
import { useMagic } from '@/hooks/MagicProvider';

export function LoginScreen() {
  const { login, isLoggingIn, telegramUser } = useAuth();
  const { magic } = useMagic();

  const hasConfig = Boolean(
    import.meta.env.VITE_MAGIC_API_KEY &&
    import.meta.env.VITE_PROJECT_ID &&
    import.meta.env.VITE_CLIENT_KEY &&
    import.meta.env.VITE_APP_ID,
  );

  if (!hasConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-surface-dark">
        <h1 className="text-2xl font-bold text-text-primary mb-2">PayGram</h1>
        <p className="text-text-muted text-sm mb-4">Copy <code className="text-brand">.env.example</code> to <code className="text-brand">.env</code> and add your Magic + Particle credentials.</p>
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-surface-dark">
      <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center text-3xl mb-6">
        💸
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">PayGram</h1>
      <p className="text-text-muted text-sm text-center mb-8 max-w-xs">
        Type it. Tap confirm. Paid.
        {telegramUser && (
          <span className="block mt-2 text-text-secondary">
            Hi, {telegramUser.firstName}
            {telegramUser.username && ` (@${telegramUser.username})`}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => login()}
        disabled={isLoggingIn}
        className="w-full max-w-xs h-12 bg-brand hover:bg-brand-light disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {isLoggingIn ? 'Connecting…' : 'Get started'}
      </button>
      <p className="text-text-muted text-xs mt-6">No seed phrases. No gas. No chains.</p>
    </div>
  );
}
