const KEY = 'paygram_net_strip_dismiss';

export function netStripFingerprint(
  youOwe: number,
  owedToYou: number,
  openIds: string[],
): string {
  const ids = [...openIds].sort().join(',');
  return `${youOwe.toFixed(2)}|${owedToYou.toFixed(2)}|${ids}`;
}

export function loadDismissedNetFingerprint(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function dismissNetStrip(fingerprint: string): void {
  try {
    localStorage.setItem(KEY, fingerprint);
  } catch {
    /* ignore */
  }
}
