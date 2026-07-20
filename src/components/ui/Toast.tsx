import { Icon } from '@/components/ui/Icon';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastItem = {
  id: string;
  kind: 'success' | 'error';
  message: string;
  action?: ToastAction;
};

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

/** Fixed above the tab bar — does not block Confirm buttons. */
export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-[60] mx-auto flex max-w-[390px] flex-col gap-2 px-container-padding"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-3 py-3 shadow-md ${
            t.kind === 'success'
              ? 'border-tertiary/30 bg-surface-container-lowest text-on-surface'
              : 'border-error-container bg-error-container/40 text-error'
          }`}
        >
          <Icon
            name={t.kind === 'success' ? 'check_circle' : 'error'}
            className={`mt-0.5 shrink-0 text-[20px] ${
              t.kind === 'success' ? 'text-tertiary' : 'text-error'
            }`}
            filled
          />
          <div className="min-w-0 flex-1">
            <p className="text-body-sm">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  onDismiss(t.id);
                }}
                className={`mt-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  t.kind === 'success'
                    ? 'bg-primary text-on-primary'
                    : 'bg-error text-on-error'
                }`}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 p-0.5 text-outline"
            aria-label="Dismiss"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      ))}
    </div>
  );
}
