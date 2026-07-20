import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';

type Action = {
  label: string;
  onClick?: () => void;
  to?: string;
  state?: unknown;
};

type Props = {
  message: string;
  actions?: Action[];
};

/** Error with one clear next step (Show QR / Unlock / Retry). */
export function ErrorActionBanner({ message, actions = [] }: Props) {
  const navigate = useNavigate();
  if (!message) return null;

  return (
    <div className="mb-4 rounded-2xl border border-error-container bg-error-container/30 px-3 py-3">
      <p className="text-body-sm text-error">{message}</p>
      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                if (a.onClick) a.onClick();
                else if (a.to) navigate(a.to, { state: a.state });
              }}
              className="rounded-full bg-error px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-error"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function actionsForWalletError(message: string): Action[] {
  // Convert / AA24 / secondary-chain unlock — unlock first, funding second.
  if (
    /AA24|Unlock|Unlocked |Get started|re-unlock|unlock is incomplete|one-time unlock|tiny bit of ETH|tiny ETH|Arbitrum QR|elsewhere|Unlock on |convert from another network|add USDC on Arbitrum|network holding your funds/i.test(
      message,
    )
  ) {
    return [
      { label: 'Unlock wallet', to: '/me', state: { scrollTo: 'setup' } },
      { label: 'Add money', to: '/me', state: { scrollTo: 'funding' } },
    ];
  }
  if (
    /Couldn’t (route this send|convert & send)|would fail on the target chain|routing|deposit QR|headroom|convert & send|spare|bit more balance/i.test(
      message,
    )
  ) {
    return [{ label: 'Add money', to: '/me', state: { scrollTo: 'funding' } }];
  }
  if (/Not enough balance|Add a bit more|gas/i.test(message)) {
    return [{ label: 'Add money', to: '/me', state: { scrollTo: 'funding' } }];
  }
  if (/sign out|hard-refresh|Connection hiccup/i.test(message)) {
    return [{ label: 'Retry', onClick: () => window.location.reload() }];
  }
  return [{ label: 'Go to Me', to: '/me' }];
}

export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: string;
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-[24px] border border-dashed border-surface-variant bg-surface-container-lowest px-6 py-10 text-center soft-shadow">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon name={icon} className="text-[28px]" filled />
      </div>
      <p className="text-headline-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-2 max-w-[260px] text-body-sm text-on-surface-variant">{body}</p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-5 rounded-full bg-cta px-5 py-2.5 text-label-md font-semibold text-on-primary active:scale-[0.98]"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
