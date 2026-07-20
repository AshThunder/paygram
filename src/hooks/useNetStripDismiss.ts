import { useCallback, useMemo, useState } from 'react';
import {
  dismissNetStrip,
  loadDismissedNetFingerprint,
  netStripFingerprint,
} from '@/lib/netStripDismiss';
import type { NetSummary } from '@/lib/activitySummary';

export function useNetStripDismiss(summary: NetSummary, openIds: string[]) {
  const fingerprint = useMemo(
    () => netStripFingerprint(summary.youOwe, summary.owedToYou, openIds),
    [summary.youOwe, summary.owedToYou, openIds],
  );
  const [dismissedFp, setDismissedFp] = useState(() => loadDismissedNetFingerprint());

  const hasBalance = summary.youOwe > 0 || summary.owedToYou > 0;
  const isDismissed = dismissedFp === fingerprint;
  const visible = hasBalance && !isDismissed;

  const dismiss = useCallback(() => {
    dismissNetStrip(fingerprint);
    setDismissedFp(fingerprint);
  }, [fingerprint]);

  return { visible, dismiss, fingerprint };
}
