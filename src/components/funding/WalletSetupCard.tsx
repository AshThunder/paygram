import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { formatWalletError } from '@/lib/constants';
import { hasEnoughArbEth, unlockEthHint } from '@/lib/arbBalance';
import { Icon } from '@/components/ui/Icon';
import { AddressQrSheet } from '@/components/funding/AddressQrSheet';
import { ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';

type Props = {
  compact?: boolean;
};

export function WalletSetupCard({ compact }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { walletAddress } = useAuth();
  const {
    primaryAssets,
    accountInfo,
    ensureDelegated,
    isDelegated: uaDelegated,
    refreshBalance,
  } = useUniversalAccount();
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arbEthOk, setArbEthOk] = useState<boolean | null>(null);
  const autoTried = useRef(false);

  const receiveAddress = walletAddress ?? accountInfo.ownerAddress;
  const balance = primaryAssets?.totalAmountInUSD ?? 0;
  const funded = balance >= 0.5;
  const delegated = uaDelegated;
  const setupComplete = delegated;
  const ethHint = unlockEthHint(primaryAssets, arbEthOk);

  // Deep-link from Lend / error CTAs: Me → setup (+ optional QR).
  useEffect(() => {
    const state = location.state as { scrollTo?: string; openUnlockQr?: boolean } | null;
    if (!state?.openUnlockQr || compact) return;
    setShowQr(true);
    navigate(location.pathname, { replace: true, state: { scrollTo: 'setup' } });
  }, [location.state, location.pathname, navigate, compact]);

  useEffect(() => {
    if (!receiveAddress || delegated) return;
    let cancelled = false;
    void (async () => {
      const ok = await hasEnoughArbEth(receiveAddress);
      if (!cancelled) setArbEthOk(ok);
    })();
    const t = window.setInterval(() => {
      void (async () => {
        const ok = await hasEnoughArbEth(receiveAddress);
        if (!cancelled) setArbEthOk(ok);
        void refreshBalance();
      })();
    }, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [receiveAddress, delegated, refreshBalance]);

  const activate = async () => {
    setError(null);
    setBusy(true);
    try {
      if (receiveAddress) {
        const ok = await hasEnoughArbEth(receiveAddress);
        setArbEthOk(ok);
        if (!ok) {
          setShowQr(true);
          throw new Error(
            `${ethHint}. Scan the QR and send on Arbitrum (same address — not Ethereum mainnet).`,
          );
        }
      }
      await ensureDelegated();
    } catch (err) {
      const msg = formatWalletError(err);
      setError(msg);
      if (/Arbitrum|ETH|AA24|one-time unlock|Unlock/i.test(msg)) {
        setShowQr(true);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (compact || setupComplete || !funded || delegated || busy || autoTried.current) return;
    if (arbEthOk !== true) return;
    autoTried.current = true;
    void activate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, setupComplete, funded, delegated, arbEthOk]);

  if (setupComplete || !receiveAddress) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() =>
          navigate('/me', { state: { scrollTo: 'setup', openUnlockQr: arbEthOk === false } })
        }
        className="flex w-full items-center gap-3 rounded-[20px] border border-primary/20 bg-primary/5 px-4 py-3 text-left active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Icon name="rocket_launch" className="text-[20px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-medium text-on-surface">Finish setup</p>
          <p className="text-body-sm text-on-surface-variant">
            {!funded ? 'Add money, then unlock your wallet' : ethHint}
          </p>
        </div>
        <Icon name="chevron_right" className="text-outline" />
      </button>
    );
  }

  return (
    <>
      <section
        id="wallet-setup"
        className="flex flex-col gap-4 rounded-[24px] border border-primary/25 bg-surface-container-lowest p-5"
      >
        <div>
          <h2 className="text-headline-md text-on-surface">Get started</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            One-time unlock. Your money stays unified — we only need a tiny Arbitrum ETH tip for
            setup.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          <li className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm font-bold ${
                funded ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'
              }`}
            >
              {funded ? <Icon name="check" className="text-[16px]" /> : '1'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-medium text-on-surface">Add money</p>
              <p className="text-body-sm text-on-surface-variant">
                Any supported network — one balance.
              </p>
              {!funded && (
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className="mt-2 rounded-full bg-primary px-4 py-2 text-label-md text-on-primary"
                >
                  Show deposit QR
                </button>
              )}
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm font-bold ${
                delegated
                  ? 'bg-secondary text-on-secondary'
                  : funded
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-outline'
              }`}
            >
              {delegated ? <Icon name="check" className="text-[16px]" /> : '2'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-medium text-on-surface">Unlock wallet</p>
              <p className="text-body-sm text-on-surface-variant">{ethHint}.</p>
              {!delegated && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void activate()}
                    className="rounded-full bg-primary px-4 py-2 text-label-md text-on-primary disabled:opacity-60"
                  >
                    {busy ? 'Unlocking…' : 'Unlock wallet'}
                  </button>
                  {arbEthOk === false && (
                    <button
                      type="button"
                      onClick={() => setShowQr(true)}
                      className="rounded-full border border-primary px-4 py-2 text-label-md text-primary"
                    >
                      Show Arbitrum QR
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        </ol>

        {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      </section>

      {showQr && (
        <AddressQrSheet
          address={receiveAddress}
          solanaAddress={accountInfo.solanaSmartAccount || undefined}
          mode={arbEthOk === false || !funded ? 'setup' : 'deposit'}
          onClose={() => setShowQr(false)}
        />
      )}
    </>
  );
}
