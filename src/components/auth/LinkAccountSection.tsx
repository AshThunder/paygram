import { useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { isTelegramMiniApp } from '@/lib/telegram';
import { Icon } from '@/components/ui/Icon';

/** Email is the only Magic login method. Telegram Mini App is shown as context only. */
export function LinkAccountSection() {
  const { userEmail, telegramUser, isLoggingIn, linkEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const inTelegram = Boolean(telegramUser?.username || isTelegramMiniApp());

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage('Email updated.');
      setEmail('');
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <section className="relative flex flex-col gap-stack-gap-md overflow-hidden rounded-xl border border-surface-container-highest/50 bg-surface-container-lowest p-stack-gap-md">
      <h2 className="font-section-label text-section-label uppercase text-outline">SIGN-IN</h2>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary">
              <Icon name="mail" />
            </div>
            <div className="flex flex-col">
              <span className="text-label-md text-on-surface">Email</span>
              <span className="text-body-sm text-on-surface-variant">{userEmail ?? 'Not set'}</span>
            </div>
          </div>
          {userEmail && <Icon name="check_circle" className="text-secondary" filled />}
        </div>

        {inTelegram && (
          <>
            <div className="h-px w-full bg-surface-container" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-telegram-blue">
                  <Icon name="send" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-label-md text-on-surface">Telegram</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {telegramUser?.username
                      ? `@${telegramUser.username} (Mini App)`
                      : 'Opened in Telegram'}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-secondary-container/20 px-2 py-1 font-section-label text-[10px] uppercase tracking-wider text-secondary">
                Context
              </span>
            </div>
          </>
        )}
      </div>

      {!userEmail && showAdd && (
        <div className="flex flex-col gap-3 border-t border-surface-container pt-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 text-body-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            disabled={isLoggingIn || !email.trim()}
            onClick={() => run(() => linkEmail(email.trim()))}
            className="h-12 rounded-xl bg-primary text-label-md text-on-primary disabled:opacity-50"
          >
            {isLoggingIn ? 'Saving…' : 'Add email'}
          </button>
        </div>
      )}

      {!userEmail && (
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary text-label-md text-primary transition-colors hover:bg-primary/5"
        >
          <Icon name="add_link" />
          Add email
        </button>
      )}

      {message && (
        <p className="rounded-lg border border-secondary/30 bg-secondary-container/25 px-3 py-2 text-body-sm text-secondary">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-error-container bg-error-container/50 px-3 py-2 text-body-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
