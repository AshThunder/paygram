import { useState } from 'react';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { useAuth } from '@/hooks/AuthProvider';
import { FUNDING_CHAINS } from '@/lib/funding';
import { getOnrampUrl } from '@/lib/onramp';
import { shortenAddress } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import { AddressQrSheet } from '@/components/funding/AddressQrSheet';

const CHAIN_BADGE: Record<string, string> = {
  Base: 'B',
  Arbitrum: 'A',
  Ethereum: 'E',
  Solana: 'S',
  'BNB Chain': 'B',
  'X Layer': 'X',
};

export function FundingPanel({ embedded }: { embedded?: boolean } = {}) {
  const { walletAddress } = useAuth();
  const { accountInfo } = useUniversalAccount();
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const evmAddress = walletAddress ?? accountInfo.ownerAddress;
  const solanaAddress = accountInfo.solanaSmartAccount;

  const displayChains = FUNDING_CHAINS.filter((chain) => {
    const address = chain.chainId === 101 ? solanaAddress : evmAddress;
    return Boolean(address);
  }).slice(0, 4);

  const openOnramp = () => {
    if (!evmAddress) return;
    window.open(getOnrampUrl(evmAddress), '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      className={
        embedded
          ? 'flex flex-col gap-stack-gap-md'
          : 'flex flex-col gap-stack-gap-md rounded-xl border border-surface-container-highest/50 bg-surface-container-lowest p-stack-gap-md ambient-shadow'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-section-label text-section-label uppercase text-outline">ADD MONEY</h2>
          <p className="text-body-sm text-on-surface-variant">
            Add money — works from any supported network. One unified balance.
          </p>
        </div>
        {evmAddress && (
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary"
            aria-label="Show deposit QR code"
          >
            <Icon name="qr_code_2" className="text-[22px]" />
          </button>
        )}
      </div>

      {evmAddress && (
        <button
          type="button"
          onClick={openOnramp}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <Icon name="account_balance" className="text-[20px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body-md font-medium text-on-surface">Buy with card / bank</p>
            <p className="text-body-sm text-on-surface-variant">
              Card or bank → your PayGram balance (MoonPay)
            </p>
          </div>
          <Icon name="open_in_new" className="text-outline" />
        </button>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-[#BCE3C6] bg-[#E6F4EA] p-3">
        <Icon name="local_gas_station" className="mt-0.5 text-secondary" />
        <div className="flex flex-col">
          <span className="text-label-md text-secondary">No gas hassle</span>
          <span className="text-body-sm text-on-secondary-fixed-variant opacity-80">
            Fees are handled for you after a one-time wallet unlock. You’ll confirm each payment.
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-4">
        {displayChains.map((chain) => {
          const address = chain.chainId === 101 ? solanaAddress : evmAddress;
          const key = String(chain.chainId);
          if (!address) return null;
          const badge = CHAIN_BADGE[chain.name] ?? chain.name.slice(0, 1);
          return (
            <div key={chain.chainId} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary text-[10px] font-bold text-on-primary">
                  {badge}
                </div>
                <span className="text-label-md text-on-surface">{chain.name}</span>
              </div>
              <button
                type="button"
                onClick={() => copy(address, key)}
                className="group flex cursor-pointer items-center justify-between rounded-lg bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
              >
                <span className="truncate font-mono text-body-sm text-on-surface-variant">
                  {chain.chainId === 101 ? shortenAddress(address) : address}
                </span>
                <Icon
                  name={copied === key ? 'check' : 'content_copy'}
                  className="text-[20px] text-outline transition-colors group-hover:text-primary"
                />
              </button>
            </div>
          );
        })}
      </div>

      {showQr && evmAddress && (
        <AddressQrSheet
          address={evmAddress}
          solanaAddress={solanaAddress || undefined}
          onClose={() => setShowQr(false)}
        />
      )}
    </section>
  );
}
