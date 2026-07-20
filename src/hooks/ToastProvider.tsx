import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastStack, type ToastAction, type ToastItem } from '@/components/ui/Toast';
import { actionsForWalletError } from '@/components/ui/Feedback';
import { haptic } from '@/lib/telegram';

type ShowOpts = {
  action?: ToastAction;
  /** Auto-attach Add money / Unlock from wallet error heuristics. */
  walletActions?: boolean;
  durationMs?: number;
};

type ToastApi = {
  success: (message: string, opts?: ShowOpts) => void;
  error: (message: string, opts?: ShowOpts) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: 'success' | 'error', message: string, opts?: ShowOpts) => {
      const id = `toast-${++idSeq}`;
      let action = opts?.action;

      if (!action && opts?.walletActions && kind === 'error') {
        const mapped = actionsForWalletError(message)[0];
        if (mapped) {
          action = {
            label: mapped.label,
            onClick: () => {
              if (mapped.onClick) mapped.onClick();
              else if (mapped.to) navigate(mapped.to, { state: mapped.state });
            },
          };
        }
      }

      setToasts((prev) => [...prev.slice(-2), { id, kind, message, action }]);
      haptic(kind === 'success' ? 'success' : 'error');

      const ms = opts?.durationMs ?? (kind === 'success' ? 3500 : 5000);
      const timer = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, timer);
    },
    [dismiss, navigate],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
