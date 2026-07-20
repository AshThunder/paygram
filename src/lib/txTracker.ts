/** Particle / UniversalX transaction status codes (from WSS docs). */
export const TX_STATUS_SUCCESS = 7;
export const TX_STATUS_FAILED = 11;

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export function mapTxStatus(status: number | string | undefined): TxStatus {
  if (status === TX_STATUS_SUCCESS || status === 'success' || status === 'confirmed' || status === 7) {
    return 'confirmed';
  }
  if (status === TX_STATUS_FAILED || status === 'failed' || status === 11) {
    return 'failed';
  }
  return 'pending';
}

export function txStatusLabel(status: TxStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'failed':
      return 'Failed';
    default:
      return 'Processing…';
  }
}

export const TX_POLL_INTERVAL_MS = 3000;
export const TX_POLL_MAX_ATTEMPTS = 40;
