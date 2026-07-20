const SESSION_KEY = 'paygram_session_until';
const DELEGATION_KEY = 'paygram_delegated';

/**
 * Local UX timer only — does NOT mean EIP-7702 is valid on-chain.
 * Prefer UniversalAccountProvider `isDelegated` (Particle) for unlock UI.
 */
export function isSessionFresh(): boolean {
  try {
    const until = Number(localStorage.getItem(SESSION_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

/** @deprecated Misleading name — use isSessionFresh or UA `isDelegated`. */
export function isDelegated(): boolean {
  return isSessionFresh();
}

/** @deprecated Use isSessionFresh. */
export function isSessionUnlocked(): boolean {
  return isSessionFresh();
}

export function unlockSession(hours = 24): void {
  const until = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(SESSION_KEY, String(until));
  localStorage.setItem(DELEGATION_KEY, '1');
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DELEGATION_KEY);
}

export function sessionExpiresAt(): number | null {
  const until = Number(localStorage.getItem(SESSION_KEY) ?? 0);
  return until > Date.now() ? until : null;
}

export function formatSessionRemaining(onChainDelegated?: boolean): string {
  if (onChainDelegated === false) {
    return 'Needs unlock — Me → Unlock wallet';
  }
  const until = sessionExpiresAt();
  if (!until) {
    return onChainDelegated
      ? 'Ready · You’ll confirm each payment'
      : 'Finish Get started on Me to unlock';
  }
  const hours = Math.max(1, Math.round((until - Date.now()) / (60 * 60 * 1000)));
  return `Ready · ~${hours}h · You’ll confirm each payment`;
}
