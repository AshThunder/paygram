import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { shortenAddress, formatUsd, formatWalletError } from '@/lib/constants';
import { tipLink, payLink, webPayLink, merchantCheckoutLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';
import { FundingPanel } from '@/components/funding/FundingPanel';
import { AddressQrSheet } from '@/components/funding/AddressQrSheet';
import { WalletSetupCard } from '@/components/funding/WalletSetupCard';
import { AllowancePanel } from '@/components/funding/AllowancePanel';
import { LinkAccountSection } from '@/components/auth/LinkAccountSection';
import { formatSessionRemaining } from '@/lib/sessionKeys';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle } from '@/components/ui/stitch';
import { Skeleton } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { ARBITRUM_MAINNET_CONTRACTS, arbiscanAddressUrl } from '@/lib/contracts/config';
import { useToast } from '@/hooks/ToastProvider';

type MeSheet = 'funding' | 'links' | 'settings' | 'allowance' | 'about' | 'commands';

function MenuRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low active:bg-surface-container"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div className="min-w-0">
          <span className="block text-body-lg text-on-background">{label}</span>
          {hint ? (
            <span className="block truncate text-body-sm text-on-surface-variant">{hint}</span>
          ) : null}
        </div>
      </div>
      <Icon name="chevron_right" className="shrink-0 text-outline" />
    </button>
  );
}

export function MePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupRef = useRef<HTMLDivElement>(null);
  const { walletAddress, userEmail, telegramUser, paygramUsername, logout } = useAuth();
  const { primaryAssets, accountInfo, ensureDelegated, isDelegated: uaDelegated, loading } =
    useUniversalAccount();
  const [sheet, setSheet] = useState<MeSheet | null>(null);
  const [showReceiveQr, setShowReceiveQr] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [delegateHint, setDelegateHint] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null;
    if (state?.scrollTo === 'funding') {
      setSheet('funding');
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (state?.scrollTo === 'setup' && setupRef.current) {
      setupRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const username = paygramUsername ?? 'me';
  const displayName = telegramUser?.firstName ?? paygramUsername ?? 'PayGram User';
  const receiveAddress = walletAddress ?? accountInfo.ownerAddress;
  const delegated = uaDelegated;
  const balance = primaryAssets?.totalAmountInUSD ?? 0;

  const runDelegate = async () => {
    setDelegateError(null);
    setDelegateHint(null);
    setDelegating(true);
    try {
      const result = await ensureDelegated();
      if (result === 'deferred') {
        setDelegateHint(
          'Unlock deferred. Add a tiny ETH if asked, then Unlock again.',
        );
      } else {
        setDelegateHint('Wallet unlocked — you can send and create pots now.');
      }
    } catch (err) {
      setDelegateError(formatWalletError(err));
    } finally {
      setDelegating(false);
    }
  };

  const myTipLink = tipLink(username, 5);
  const myPayLink = payLink(username, 25);
  const myWebPayLink = webPayLink(username, 25);
  const myCheckoutLink = merchantCheckoutLink(username, 25, 'Order');

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedLink(key);
    toast.success('Link copied');
    window.setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary-fixed-dim/20 to-transparent" />

      <main className="relative flex flex-grow flex-col gap-stack-gap-md px-container-padding pb-tab-bar pt-stack-gap-lg">
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-surface-container-lowest">
              <AvatarCircle label={displayName} className="h-full w-full border-0 text-2xl" />
            </div>
            <button
              type="button"
              onClick={() => setSheet('settings')}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container text-on-primary active:scale-95"
              aria-label="Settings"
            >
              <Icon name="settings" className="text-[16px]" />
            </button>
          </div>
          <h2 className="text-headline-md text-on-background">{displayName}</h2>
          <p className="mt-0.5 text-body-md text-on-surface-variant">@{paygramUsername}</p>
          <p className="mt-2 max-w-[280px] text-[11px] leading-snug text-outline">
            Powered by Particle Universal Accounts + EIP-7702
          </p>

          <button
            type="button"
            onClick={() => navigate('/balance')}
            className="mt-4 w-full rounded-[24px] border border-surface-variant bg-surface-container-lowest p-4 text-center transition-colors hover:bg-surface-container-low active:scale-[0.99]"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Total balance
            </span>
            {loading && !primaryAssets ? (
              <Skeleton className="mx-auto mt-2 h-10 w-36" />
            ) : (
              <p className="mt-1 text-display-amount tracking-tight text-on-background">
                {formatUsd(balance)}
              </p>
            )}
            <span className="mt-1 inline-flex items-center gap-0.5 text-label-sm text-primary">
              View breakdown
              <Icon name="chevron_right" className="text-[16px]" />
            </span>
          </button>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { label: 'Send', icon: 'send', onClick: () => navigate('/send') },
            {
              label: 'Receive',
              icon: 'qr_code_scanner',
              onClick: () => receiveAddress && setShowReceiveQr(true),
              disabled: !receiveAddress,
            },
            { label: 'Add', icon: 'add_card', onClick: () => setSheet('funding') },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 rounded-2xl border border-surface-variant bg-surface-container-lowest py-3.5 transition-colors hover:bg-surface-container-low active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon name={action.icon} className="text-[22px] text-primary" />
              </div>
              <span className="text-label-md text-on-background">{action.label}</span>
            </button>
          ))}
        </section>

        <div ref={setupRef}>
          <WalletSetupCard />
        </div>

        {!delegated && balance >= 0.5 && (
          <button
            type="button"
            onClick={() => setSheet('settings')}
            className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-left"
          >
            <Icon name="lock_open" className="text-[22px] text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-medium text-on-surface">Unlock wallet</p>
              <p className="text-body-sm text-on-surface-variant">One-time setup to send on-chain</p>
            </div>
            <Icon name="chevron_right" className="text-outline" />
          </button>
        )}

        <section className="overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest">
          <MenuRow
            icon="account_balance_wallet"
            label="Add money"
            hint="Card, bank, or crypto deposit"
            onClick={() => setSheet('funding')}
          />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow
            icon="link"
            label="Payment links"
            hint="Tip jar, checkout, pay links"
            onClick={() => setSheet('links')}
          />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow
            icon="tune"
            label="Spend limits"
            hint="Allow trusted friends to spend"
            onClick={() => setSheet('allowance')}
          />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow
            icon="chat"
            label="Chat commands"
            hint="Examples you can type in Chat"
            onClick={() => setSheet('commands')}
          />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow icon="group" label="Friends" onClick={() => navigate('/friends')} />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow icon="info" label="About PayGram" hint="Stack, contracts, hackathon" onClick={() => setSheet('about')} />
          <div className="mx-4 h-px bg-surface-variant" />
          <MenuRow
            icon="manage_accounts"
            label="Account & security"
            hint={userEmail ?? 'Email & wallet'}
            onClick={() => setSheet('settings')}
          />
        </section>
      </main>

      {sheet === 'funding' && (
        <BottomSheet
          title="Add money"
          subtitle="Any supported network — one unified balance"
          onClose={() => setSheet(null)}
        >
          <FundingPanel embedded />
        </BottomSheet>
      )}

      {sheet === 'links' && (
        <BottomSheet title="Payment links" subtitle={`Share @${paygramUsername}`} onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Checkout', url: myCheckoutLink, desc: 'Merchant checkout page' },
              { label: 'Tip jar', url: myTipLink, desc: 'Let anyone tip you' },
              { label: 'Pay $25', url: myPayLink, desc: 'Fixed amount pay link' },
              { label: 'Web pay', url: myWebPayLink, desc: 'Opens in browser' },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-surface-container-low p-3">
                <p className="text-body-md font-medium text-on-surface">{row.label}</p>
                <p className="text-body-sm text-on-surface-variant">{row.desc}</p>
                <p className="mt-1 break-all font-mono text-[10px] leading-snug text-outline">{row.url}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(row.url, row.label)}
                    className="flex-1 rounded-full border border-primary py-2 text-label-sm text-primary"
                  >
                    {copiedLink === row.label ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => shareUrl(row.url, `${row.label} on PayGram`)}
                    className="flex-1 rounded-full bg-primary py-2 text-label-sm text-on-primary"
                  >
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        </BottomSheet>
      )}

      {sheet === 'allowance' && (
        <BottomSheet title="Spend limits" subtitle="Open a purse for trusted spenders" onClose={() => setSheet(null)}>
          <AllowancePanel embedded />
        </BottomSheet>
      )}

      {sheet === 'commands' && (
        <BottomSheet
          title="Chat commands"
          subtitle="Type these in Chat, then confirm"
          onClose={() => setSheet(null)}
        >
          <ul className="mb-4 flex flex-col gap-2">
            {[
              'send $25 to @alice for lunch',
              'tip @creator $5',
              'request $30 from @bob',
              'split $120 with @bob @carol',
              'collect $500 for Bali',
              'swap $50 to SOL',
              'balance',
            ].map((cmd) => (
              <li
                key={cmd}
                className="rounded-xl border border-surface-variant bg-surface-container-low px-3 py-2.5 font-mono text-[12px] text-on-surface"
              >
                {cmd}
              </li>
            ))}
          </ul>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            You can also use Send, Tip, Request, and other screens from Home if you prefer forms.
          </p>
          <button
            type="button"
            onClick={() => {
              setSheet(null);
              navigate('/chat');
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-label-md font-semibold text-on-primary active:scale-[0.98]"
          >
            <Icon name="chat" className="text-[20px]" filled />
            Open Chat
          </button>
        </BottomSheet>
      )}

      {sheet === 'about' && (
        <BottomSheet
          title="About PayGram"
          subtitle="Universal Accounts Track · UXmaxx Hackathon"
          onClose={() => setSheet(null)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-body-sm text-on-surface-variant">
              Peer-to-peer payments in Telegram — one unified balance, zero chain jargon. Settlement on
              Arbitrum via Particle{' '}
              <span className="font-medium text-on-surface">Universal Accounts</span> with{' '}
              <span className="font-medium text-on-surface">EIP-7702</span> (Magic embedded wallet).
            </p>
            <div className="rounded-xl bg-surface-container-low px-4 py-3">
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Live</p>
              <a
                href="https://paygram-rust.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-body-md text-primary"
              >
                paygram-rust.vercel.app
              </a>
              <a
                href="https://t.me/paygram_bbot"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-body-sm text-primary"
              >
                @paygram_bbot on Telegram
              </a>
            </div>
            <div>
              <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                Arbitrum One contracts
              </p>
              <ul className="flex flex-col gap-2">
                {(
                  [
                    ['PayGramPot', ARBITRUM_MAINNET_CONTRACTS.pot],
                    ['PayGramBillEscrow', ARBITRUM_MAINNET_CONTRACTS.billEscrow],
                    ['PayGramRosca', ARBITRUM_MAINNET_CONTRACTS.rosca],
                    ['PayGramTab', ARBITRUM_MAINNET_CONTRACTS.tab],
                    ['PayGramAllowance', ARBITRUM_MAINNET_CONTRACTS.allowance],
                  ] as const
                ).map(([label, addr]) => (
                  <li key={label}>
                    <a
                      href={arbiscanAddressUrl(addr)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl border border-surface-variant bg-surface-container-lowest px-3 py-2.5"
                    >
                      <span className="text-body-sm font-medium text-on-surface">{label}</span>
                      <span className="truncate font-mono text-[11px] text-primary">
                        {shortenAddress(addr)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-outline">
                All vaults verified on Arbiscan — source readable at each link above.
              </p>
            </div>
          </div>
        </BottomSheet>
      )}

      {sheet === 'settings' && (
        <BottomSheet title="Account" subtitle="Sign-in, wallet, and security" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-4">
            <LinkAccountSection />
            <div className="rounded-xl bg-surface-container-low px-4 py-3">
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Username</p>
              <p className="mt-1 text-body-md text-on-surface">
                Pay you at <span className="font-semibold text-primary">@{paygramUsername}</span>
              </p>
            </div>
            {receiveAddress && (
              <button
                type="button"
                onClick={() => {
                  setSheet(null);
                  setShowReceiveQr(true);
                }}
                className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3"
              >
                <div className="text-left">
                  <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Deposit address
                  </p>
                  <p className="mt-1 font-mono text-body-sm text-on-surface">
                    {shortenAddress(receiveAddress)}
                  </p>
                </div>
                <Icon name="qr_code_2" className="text-primary" />
              </button>
            )}
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-md font-medium text-on-surface">Wallet status</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {formatSessionRemaining(uaDelegated)}
                  </p>
                </div>
                <span className={`text-label-md ${delegated ? 'text-secondary' : 'text-outline'}`}>
                  {delegated ? 'Ready' : 'Needs unlock'}
                </span>
              </div>
              {!delegated && (
                <button
                  type="button"
                  onClick={() => void runDelegate()}
                  disabled={delegating}
                  className="flex h-10 w-full items-center justify-center rounded-full bg-primary text-label-md text-on-primary disabled:opacity-60"
                >
                  {delegating ? 'Unlocking…' : 'Unlock wallet'}
                </button>
              )}
              {delegateHint && (
                <p className="text-body-sm text-on-surface-variant">{delegateHint}</p>
              )}
              {delegateError && (
                <ErrorActionBanner message={delegateError} actions={actionsForWalletError(delegateError)} />
              )}
            </div>
            {userEmail && <p className="text-center text-body-sm text-outline">{userEmail}</p>}
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-error text-label-md text-error"
            >
              <Icon name="logout" className="text-[20px]" />
              Sign out
            </button>
          </div>
        </BottomSheet>
      )}

      {showReceiveQr && receiveAddress && (
        <AddressQrSheet
          address={receiveAddress}
          solanaAddress={accountInfo.solanaSmartAccount || undefined}
          onClose={() => setShowReceiveQr(false)}
        />
      )}
    </div>
  );
}
