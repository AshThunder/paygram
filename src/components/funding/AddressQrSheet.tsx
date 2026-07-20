import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '@/components/ui/Icon';
import { shortenAddress } from '@/lib/constants';
import { setOverlayOpen } from '@/lib/overlayLock';

type Props = {
  address: string;
  label?: string;
  solanaAddress?: string;
  /** setup = emphasize tiny Arbitrum ETH for first unlock */
  mode?: 'deposit' | 'setup';
  onClose: () => void;
};

export function AddressQrSheet({
  address,
  label,
  solanaAddress,
  mode = 'deposit',
  onClose,
}: Props) {
  const [tab, setTab] = useState<'evm' | 'sol'>('evm');
  const [copied, setCopied] = useState(false);

  const showSol = Boolean(solanaAddress) && mode !== 'setup';
  const value = tab === 'sol' && solanaAddress ? solanaAddress : address;
  const title = mode === 'setup' ? 'Unlock deposit' : 'Receive';
  const subtitle =
    label ??
    (mode === 'setup'
      ? 'Same address — send ~$0.01 ETH on Arbitrum One (not Ethereum)'
      : 'Your deposit address');

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

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

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
        aria-labelledby="receive-qr-title"
        className="relative z-10 flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-0.5rem))] min-h-0 w-full max-w-[390px] flex-col overflow-hidden rounded-t-[28px] border border-surface-variant bg-surface-container-lowest shadow-xl sm:rounded-[28px]"
      >
        <div className="scroll-touch min-h-0 flex-1 overflow-y-auto p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="receive-qr-title" className="text-headline-md text-on-surface">
              {title}
            </h2>
            <p className="text-body-sm text-on-surface-variant">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
            aria-label="Close receive sheet"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {mode === 'setup' && (
          <div className="mb-4 rounded-2xl border border-[#BCE3C6] bg-[#E6F4EA] px-3 py-2.5 text-body-sm text-on-secondary-fixed-variant">
            Network must be <span className="font-semibold text-secondary">Arbitrum One</span> — not
            Ethereum. About $0.01–0.05 ETH is enough for one-time unlock.
          </div>
        )}

        {showSol && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setTab('evm')}
              className={`rounded-full py-2 text-label-md ${
                tab === 'evm' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              EVM
            </button>
            <button
              type="button"
              onClick={() => setTab('sol')}
              className={`rounded-full py-2 text-label-md ${
                tab === 'sol' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              Solana
            </button>
          </div>
        )}

        <div className="mx-auto mb-4 flex w-fit rounded-2xl border border-surface-variant bg-white p-4">
          <QRCodeSVG value={value} size={200} level="M" includeMargin={false} />
        </div>

        <p className="mb-3 text-center text-body-sm text-on-surface-variant">
          {tab === 'sol'
            ? 'Scan to deposit SOL / USDC on Solana'
            : mode === 'setup'
              ? 'Scan or copy — send ETH on Arbitrum only'
              : 'Same address works on Arbitrum, Base, Ethereum, and more'}
        </p>

        <button
          type="button"
          onClick={() => void copy()}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3"
        >
          <span className="truncate font-mono text-body-sm text-on-surface">
            {tab === 'sol' ? shortenAddress(value) : value}
          </span>
          <Icon
            name={copied ? 'check' : 'content_copy'}
            className="shrink-0 text-[20px] text-primary"
          />
        </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
