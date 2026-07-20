import { useEffect, useRef, useState } from 'react';
import { useUniversalAccount } from './UniversalAccountProvider';
import { TX_POLL_INTERVAL_MS, TX_POLL_MAX_ATTEMPTS, mapTxStatus, type TxStatus } from '@/lib/txTracker';

/**
 * Poll Particle for a tx status. If `initialStatus` is already confirmed/failed,
 * skip polling so the UI doesn't replay Sent → Route → Done on every remount.
 */
export function useTxTracker(
  txId: string | undefined,
  enabled = true,
  initialStatus: TxStatus = 'pending',
) {
  const { getTransaction, refreshBalance } = useUniversalAccount();
  const settled = initialStatus === 'confirmed' || initialStatus === 'failed';
  const [status, setStatus] = useState<TxStatus>(() =>
    txId ? initialStatus : 'confirmed',
  );
  const [polling, setPolling] = useState(false);
  const attempts = useRef(0);
  const getTxRef = useRef(getTransaction);
  const refreshBalRef = useRef(refreshBalance);
  getTxRef.current = getTransaction;
  refreshBalRef.current = refreshBalance;
  const lastSettled = useRef<string | null>(settled && txId ? txId : null);

  useEffect(() => {
    if (!enabled || !txId) return;

    if (settled) {
      setStatus(initialStatus);
      return;
    }

    attempts.current = 0;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      setPolling(true);
      try {
        const details = await getTxRef.current?.(txId);
        if (cancelled) return;
        const mapped = mapTxStatus(details?.status as number | string | undefined);
        setStatus(mapped);
        attempts.current += 1;
        if (
          (mapped === 'confirmed' || mapped === 'failed') &&
          lastSettled.current !== txId
        ) {
          lastSettled.current = txId;
          void refreshBalRef.current();
        }
        if (mapped === 'pending' && attempts.current < TX_POLL_MAX_ATTEMPTS) {
          timer = window.setTimeout(() => void tick(), TX_POLL_INTERVAL_MS);
        }
      } catch {
        if (cancelled) return;
        attempts.current += 1;
        if (attempts.current < TX_POLL_MAX_ATTEMPTS) {
          timer = window.setTimeout(() => void tick(), TX_POLL_INTERVAL_MS);
        }
      } finally {
        if (!cancelled) setPolling(false);
      }
    };

    // Poll immediately — don't sit on a fake "Sent" step for 3s first.
    void tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [txId, enabled, settled, initialStatus]);

  return { status, polling };
}
