/** Re-fetch UA balance after Particle settlement catches up. */
export function scheduleBalanceRefresh(
  refreshBalance: () => Promise<unknown>,
  delaysMs: number[] = [2500, 6000, 12000],
): void {
  for (const ms of delaysMs) {
    window.setTimeout(() => {
      void refreshBalance().catch(() => undefined);
    }, ms);
  }
}
