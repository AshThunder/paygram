import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { setOverlayOpen } from '@/lib/overlayLock';

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    setOverlayOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      setOverlayOpen(false);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-on-surface/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className="relative z-10 flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-0.5rem))] min-h-0 w-full max-w-[390px] flex-col overflow-hidden rounded-t-[28px] border border-surface-variant bg-surface-container-lowest shadow-xl sm:max-h-[min(85dvh,640px)] sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline-variant/60 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-variant px-5 py-3">
          <div className="min-w-0">
            <h2 id="bottom-sheet-title" className="text-headline-md text-on-surface">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
            aria-label="Close"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="scroll-touch min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
