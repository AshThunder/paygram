import { useEffect } from 'react';
import { universalXUrl } from '@/lib/constants';
import { txStatusLabel, type TxStatus } from '@/lib/txTracker';
import { useTxTracker } from '@/hooks/useTxTracker';
import { Icon } from '@/components/ui/Icon';

type Props = {
  txId: string;
  /** Known status from activity — avoids replaying the progress UI when already done */
  initialStatus?: TxStatus;
  onStatusChange?: (status: TxStatus) => void;
  variant?: 'pill' | 'steps' | 'boxed';
};

const STEPS = ['Sent', 'Route', 'Done'] as const;

export function TxTracker({
  txId,
  initialStatus = 'pending',
  onStatusChange,
  variant = 'pill',
}: Props) {
  const { status, polling } = useTxTracker(txId, Boolean(txId), initialStatus);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  if (variant === 'steps' || variant === 'boxed') {
    // Once settled, keep the card short — badge + link only.
    if (status === 'confirmed' || status === 'failed') {
      return (
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              status === 'confirmed'
                ? 'bg-secondary-container/40 text-secondary'
                : 'bg-error-container/50 text-error'
            }`}
          >
            {txStatusLabel(status)}
          </span>
          <a
            href={universalXUrl(txId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary"
          >
            UniversalX
            <Icon name="arrow_forward" className="text-[12px]" />
          </a>
        </div>
      );
    }

    const activeStep = polling ? 2 : 1;
    const tracker = (
      <>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {STEPS.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep - 1;
              return (
                <div key={step} className="contents">
                  {i > 0 && (
                    <div
                      className={`h-px min-w-[8px] flex-1 ${done || active ? 'bg-primary/40' : 'bg-surface-variant'}`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={`flex h-3 w-3 items-center justify-center rounded-full ${
                        done
                          ? 'bg-primary text-on-primary'
                          : active
                            ? 'bg-primary ring-2 ring-primary/25'
                            : 'border border-outline-variant bg-surface-variant'
                      }`}
                    >
                      {done && <Icon name="check" className="text-[8px]" filled />}
                      {active && !done && (
                        <span className="h-1 w-1 rounded-full bg-on-primary" />
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wide ${
                        done || active ? 'text-primary' : 'text-outline'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <a
            href={universalXUrl(txId)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-medium text-primary"
          >
            Details
          </a>
        </div>
      </>
    );

    if (variant === 'boxed') {
      return (
        <div className="rounded-lg border border-surface-variant bg-surface-container-lowest p-2.5">
          {tracker}
        </div>
      );
    }

    return <div className="mt-1.5">{tracker}</div>;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          status === 'confirmed'
            ? 'bg-secondary-container/30 text-secondary'
            : status === 'failed'
              ? 'bg-error-container text-error'
              : 'bg-primary-fixed text-on-primary-fixed-variant'
        }`}
      >
        {polling && status === 'pending' ? '… ' : ''}
        {txStatusLabel(status)}
      </span>
      <a
        href={universalXUrl(txId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-medium text-primary hover:opacity-80"
      >
        UniversalX →
      </a>
    </div>
  );
}
