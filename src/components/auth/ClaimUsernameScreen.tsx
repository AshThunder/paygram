import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { checkUsernameAvailable } from '@/lib/api';
import { normalizeHandle } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';

/**
 * Required after email login: every wallet claims a unique PayGram @username.
 * Telegram Mini App username is only a suggested default, not identity.
 */
export function ClaimUsernameScreen() {
  const { claimUsername, logout, telegramUser, walletAddress, userEmail, isLoggingIn } = useAuth();
  const suggested = telegramUser?.username ? normalizeHandle(telegramUser.username) : '';
  const [draft, setDraft] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string | null>(null);

  useEffect(() => {
    const handle = normalizeHandle(draft);
    if (!handle || handle.length < 3) {
      setAvailability(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await checkUsernameAvailable(handle, walletAddress);
        setAvailability(res.available ? `@${handle} is available` : res.reason ?? 'Taken');
        if (!res.available) setError(null);
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [draft, walletAddress]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const handle = normalizeHandle(draft);
      const check = await checkUsernameAvailable(handle, walletAddress);
      if (!check.available) {
        setError(check.reason ?? 'Username taken');
        return;
      }
      await claimUsername(handle);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim username');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out');
      setSigningOut(false);
    }
  };

  const useSuggested = suggested && draft.toLowerCase() !== suggested.toLowerCase();
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-container-padding py-stack-gap-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
            <Icon name="alternate_email" className="text-[32px]" />
          </div>
          <h1 className="text-headline-lg font-bold text-on-surface">Choose your username</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            This unique @handle is how friends send you money on PayGram.
          </p>
          {(shortWallet || userEmail) && (
            <p className="mt-3 text-body-sm text-outline">
              Signed in
              {userEmail ? ` as ${userEmail}` : ''}
              {shortWallet ? ` · ${shortWallet}` : ''}
            </p>
          )}
        </div>

        {suggested && (
          <button
            type="button"
            onClick={() => setDraft(suggested)}
            className="mb-4 w-full rounded-2xl border border-surface-variant bg-surface-container-lowest px-4 py-3 text-left"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Suggested from Telegram
            </p>
            <p className="text-body-lg font-semibold text-primary">@{suggested}</p>
            <p className="mt-1 text-body-sm text-outline">
              Optional — you can pick any available name.
            </p>
          </button>
        )}

        <div className="flex items-center gap-2 rounded-full border border-surface-variant bg-surface-container-lowest px-4 py-3">
          <span className="text-outline">@</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/^@/, '').toLowerCase())}
            placeholder="yourname"
            autoFocus
            className="flex-1 bg-transparent text-body-lg text-on-surface outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </div>

        {availability && (
          <p
            className={`mt-2 text-body-sm ${
              availability.includes('available') ? 'text-secondary' : 'text-error'
            }`}
          >
            {availability}
          </p>
        )}
        {error && (
          <p className="mt-2 rounded-xl border border-error-container bg-error-container/40 px-3 py-2 text-body-sm text-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy || signingOut || isLoggingIn || normalizeHandle(draft).length < 3}
          onClick={() => void submit()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-headline-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? 'Claiming…' : useSuggested ? 'Claim username' : 'Continue'}
        </button>

        <button
          type="button"
          disabled={busy || signingOut}
          onClick={() => void handleSignOut()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-error/40 py-3.5 text-label-md font-semibold text-error disabled:opacity-50"
        >
          <Icon name="logout" className="text-[18px]" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="mt-2 text-center text-body-sm text-outline">
          Wrong account after switching Telegram? Sign out, then sign in again.
        </p>
      </main>
    </div>
  );
}
