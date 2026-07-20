import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { resolveRecipient } from '@/lib/parser';
import { formatUsd, formatWalletError, universalXUrl } from '@/lib/constants';
import { assertTransferReady, createUsdcSendTransaction } from '@/lib/uaTransfer';
import { scheduleBalanceRefresh } from '@/lib/balanceRefresh';
import { addActivity } from '@/lib/storage';
import { createActivityApi } from '@/lib/api';
import { shareUrl, shareReceipt } from '@/lib/telegram';
import { inviteLink } from '@/lib/links';
import { Icon } from '@/components/ui/Icon';
import { TxTracker } from '@/components/tx/TxTracker';
import { AvatarCircle } from '@/components/ui/stitch';
import { ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { ConfettiBurst } from '@/components/chat/ConfettiBurst';
import { useAuth } from '@/hooks/AuthProvider';
import { useToast } from '@/hooks/ToastProvider';

type Props = {
  amount: number;
  recipient: string;
  note?: string;
  merchantMode?: boolean;
};

export function CheckoutPage({ amount: initialAmount, recipient, note, merchantMode }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { walletAddress, telegramUser, paygramUsername } = useAuth();
  const { universalAccount, ensureDelegated, signAndSend, refreshBalance, initError, primaryAssets } =
    useUniversalAccount();
  const [amount, setAmount] = useState(initialAmount);
  const [processing, setProcessing] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ handle: string; address: string } | null>(null);

  const handle = recipient.startsWith('@') ? recipient : `@${recipient}`;
  const fromHandle = paygramUsername
    ? `@${paygramUsername}`
    : telegramUser?.username
      ? `@${telegramUser.username}`
      : walletAddress
        ? `@${walletAddress.slice(2, 8)}`
        : '@you';

  useEffect(() => {
    void resolveRecipient(handle).then((address) => {
      if (address && address !== '0x') {
        setResolved({ handle, address });
      } else {
        setError(`${handle} isn't on PayGram yet. Ask them to open the app first.`);
      }
    });
  }, [handle]);

  const inviteRecipient = () => {
    shareUrl(inviteLink(), `Join PayGram so I can pay you ${formatUsd(amount)}`);
  };

  const pay = async () => {
    if (initError) {
      setError(initError);
      toast.error(initError, { walletActions: true });
      return;
    }
    if (!universalAccount || !resolved) return;
    setProcessing(true);
    setError(null);
    try {
      const assets = (await refreshBalance()) ?? primaryAssets;
      const receiver = assertTransferReady({
        amount,
        receiver: resolved.address,
        sender: walletAddress,
        assets,
      });
      await ensureDelegated({ assets });
      const transaction = await createUsdcSendTransaction(universalAccount, amount, receiver);
      const result = await signAndSend(transaction);
      await refreshBalance();
      scheduleBalanceRefresh(refreshBalance);
      setTxId(result.transactionId);
      const type = merchantMode ? 'checkout' : 'send';
      addActivity({
        type,
        amount,
        counterparty: resolved.handle,
        note: note ?? 'Pay link',
        txId: result.transactionId,
        status: 'pending',
      });
      void createActivityApi({
        fromUser: fromHandle,
        toUser: resolved.handle,
        amount,
        type,
        note: note ?? 'Pay link',
        txId: result.transactionId,
        status: 'pending',
      });
      toast.success(`Paid ${formatUsd(amount)} to ${resolved.handle}`);
    } catch (e) {
      const msg = formatWalletError(e);
      setError(msg);
      toast.error(msg, { walletActions: true });
    } finally {
      setProcessing(false);
    }
  };

  if (txId) {
    return (
      <div className="relative flex min-h-full flex-1 flex-col bg-background">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-surface-variant bg-background px-container-padding">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
          <div className="text-headline-sm font-bold text-primary">PayGram</div>
          <div className="h-10 w-10" />
        </header>

        <main className="relative mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center px-container-padding pb-10 pt-6">
          <ConfettiBurst active />
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-tertiary-fixed">
            <Icon name="check_circle" className="text-[48px] text-tertiary-container" filled />
          </div>
          <h1 className="text-headline-lg text-on-surface">
            {merchantMode ? 'Purchase complete' : 'Payment sent'}
          </h1>
          <p className="mt-2 text-center text-body-md text-on-surface-variant">
            <span className="font-bold text-on-surface">{formatUsd(amount)}</span>
            {merchantMode ? ' paid to ' : ' to '}
            {resolved?.handle}
          </p>
          {note && (
            <p className="mt-1 text-body-sm text-outline">{note}</p>
          )}

          <div className="mt-8 w-full rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5">
            <div className="mb-4 flex items-center justify-between border-b border-surface-variant pb-4">
              <span className="text-body-md text-on-surface-variant">Status</span>
              <span className="flex items-center gap-1.5 rounded-full bg-tertiary-fixed/50 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-tertiary-container" />
                <span className="text-[11px] font-bold uppercase text-tertiary-container">Processing</span>
              </span>
            </div>
            <TxTracker txId={txId} variant="steps" />
          </div>

          <div className="mt-auto w-full space-y-3 pt-10">
            <button
              type="button"
              onClick={() =>
                shareReceipt(
                  `Paid ${formatUsd(amount)} to ${resolved?.handle ?? 'merchant'} on PayGram${note ? ` — ${note}` : ''}`,
                  '✅',
                )
              }
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-label-md font-bold text-on-primary"
            >
              <Icon name="ios_share" className="text-[20px]" />
              Share receipt
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-14 w-full items-center justify-center rounded-full bg-cta text-label-md font-bold text-on-primary"
            >
              Back to Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/activity')}
              className="flex h-12 w-full items-center justify-center rounded-full text-label-md font-semibold text-primary hover:bg-primary-fixed/40"
            >
              View in Activity
            </button>
            <a
              href={universalXUrl(txId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 text-body-sm text-outline hover:text-primary"
            >
              <Icon name="open_in_new" className="text-[18px]" />
              Open on UniversalX
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-surface-variant bg-background px-container-padding">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-container-low"
          aria-label="Close"
        >
          <Icon name="close" className="text-on-surface" />
        </button>
        <div className="text-center">
          <h1 className="text-headline-sm font-semibold text-primary">
            {merchantMode ? 'Merchant checkout' : 'Checkout'}
          </h1>
          <p className="text-[11px] text-on-surface-variant">
            {merchantMode ? 'Pay store · gasless · You’ll confirm once' : 'Pay link · gasless'}
          </p>
        </div>
        <div className="w-10" />
      </header>

      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col px-container-padding pb-10 pt-4">
        <div className="relative overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <p className="mt-2 text-center font-section-label text-section-label uppercase tracking-widest text-outline">
            {merchantMode ? 'Pay merchant' : 'Pay link'}
          </p>
          <p className="mt-1 text-center text-body-sm text-on-surface-variant">
            Complete purchase — no chains, no gas
          </p>

          {merchantMode && (
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="mt-4 h-12 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 text-center text-headline-sm font-bold"
            />
          )}

          <div className="mb-6 mt-8 flex flex-col items-center">
            <span className="text-display-amount-mobile tracking-tight text-on-surface">
              {formatUsd(amount)}
            </span>
          </div>

          <hr className="border-surface-variant" />

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AvatarCircle label={handle} className="h-11 w-11 bg-primary-fixed text-sm" />
              <div>
                <p className="text-body-sm text-outline">Pay to</p>
                <p className="font-semibold text-on-surface">{handle}</p>
              </div>
            </div>
            {merchantMode && (
              <span className="rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold uppercase text-primary">
                Verified
              </span>
            )}
          </div>

          {note && (
            <div className="flex items-start justify-between border-t border-surface-variant py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-high text-outline">
                  <Icon name="description" />
                </div>
                <span className="text-body-md text-on-surface">Note</span>
              </div>
              <p className="max-w-[160px] text-right text-body-sm text-on-surface-variant">{note}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#A7EBAE] bg-[#EAFBF0] p-4">
          <Icon name="eco" className="text-tertiary-container" filled />
          <span className="text-body-sm font-semibold text-tertiary-container">
            100% gasless · unified balance
          </span>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorActionBanner
              message={error}
              actions={
                error.includes("isn't on PayGram")
                  ? [{ label: 'Invite to PayGram', onClick: inviteRecipient }]
                  : actionsForWalletError(error)
              }
            />
          </div>
        )}

        <div className="mt-auto flex w-full flex-col gap-3 pt-8">
          <button
            type="button"
            disabled={processing || !resolved || amount <= 0}
            onClick={pay}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-cta text-label-md font-bold text-on-primary disabled:opacity-50"
          >
            {processing ? 'Processing…' : `Pay ${formatUsd(amount)}`}
            {!processing && <Icon name="payments" className="text-[20px]" />}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-14 w-full items-center justify-center rounded-full text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
