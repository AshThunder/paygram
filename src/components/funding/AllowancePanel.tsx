import { useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { usePayGram } from '@/hooks/PayGramProvider';
import {
  buildOpenAllowanceCalls,
  isAllowanceConfigured,
  readPurseOnChain,
} from '@/lib/contracts';
import { formatUsd, formatWalletError, normalizeHandle } from '@/lib/constants';
import { resolveRecipient } from '@/lib/parser';
import { ErrorActionBanner, actionsForWalletError } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';

type LocalPurse = {
  onChainId: number;
  spender: string;
  amount: number;
  durationDays: number;
};

const STORAGE_KEY = 'paygram_allowance_purses';

function loadPurses(): LocalPurse[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as LocalPurse[];
  } catch {
    return [];
  }
}

function savePurses(rows: LocalPurse[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function AllowancePanel({ embedded }: { embedded?: boolean } = {}) {
  const { walletAddress } = useAuth();
  const { executeContractCalls } = useUniversalAccount();
  const { logTxActivity } = usePayGram();
  const [spender, setSpender] = useState('');
  const [amount, setAmount] = useState('50');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purses, setPurses] = useState(loadPurses);
  const [status, setStatus] = useState<string | null>(null);

  if (!isAllowanceConfigured()) {
    return (
      <section
        className={
          embedded
            ? 'p-1'
            : 'rounded-[24px] border border-dashed border-surface-variant bg-surface-container-lowest p-5'
        }
      >
        <p className="text-body-md font-medium text-on-surface">Spend limits</p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Allowance contract not loaded — set VITE_ALLOWANCE after deploy.
        </p>
      </section>
    );
  }

  const openPurse = async () => {
    setError(null);
    setStatus(null);
    const usd = parseFloat(amount);
    const durationDays = parseInt(days, 10) || 30;
    const handle = normalizeHandle(spender);
    if (!usd || usd <= 0 || !handle || !walletAddress) return;
    setBusy(true);
    try {
      const address = await resolveRecipient(`@${handle}`);
      if (!address || address === '0x') {
        throw new Error(`@${handle} isn’t on PayGram yet`);
      }
      const plan = await buildOpenAllowanceCalls({
        spenderAddress: address,
        amountUsd: usd,
        durationDays,
      });
      const result = await executeContractCalls({
        calls: plan.calls,
        expectUsdc: plan.expectUsdc,
        chainId: plan.addresses.chainId,
      });
      const next = [
        {
          onChainId: plan.onChainPurseId,
          spender: `@${handle}`,
          amount: usd,
          durationDays,
        },
        ...purses,
      ];
      savePurses(next);
      setPurses(next);
      logTxActivity({
        type: 'allowance',
        amount: usd,
        counterparty: `@${handle}`,
        note: `Spend limit · ${durationDays}d · purse #${plan.onChainPurseId}`,
        txId: result.transactionId as string,
        status: 'pending',
      });
      setStatus(`Opened $${usd} limit for @${handle} (${durationDays} days)`);
      setSpender('');
    } catch (e) {
      setError(formatWalletError(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshPurse = async (id: number) => {
    const row = await readPurseOnChain(id);
    if (!row) return;
    setStatus(
      row.closed
        ? `Purse #${id} closed`
        : `Purse #${id}: ${formatUsd(row.spent)} / ${formatUsd(row.deposited)} spent`,
    );
  };

  return (
    <section
      className={
        embedded
          ? 'flex flex-col gap-4'
          : 'flex flex-col gap-4 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5'
      }
    >
      {!embedded && (
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface">Spend limits</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Set a capped allowance for a friend or creator — they can spend up to the limit.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <input
          className="w-full rounded-xl border border-surface-variant bg-surface px-4 py-3 text-body-md outline-none focus:border-primary"
          placeholder="@spender"
          value={spender}
          onChange={(e) => setSpender(e.target.value)}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">$</span>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-surface-variant bg-surface py-3 pl-7 pr-3 text-body-md outline-none focus:border-primary"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Limit"
            />
          </div>
          <input
            inputMode="numeric"
            className="w-24 rounded-xl border border-surface-variant bg-surface px-3 py-3 text-body-md outline-none focus:border-primary"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Days"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void openPurse()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-label-md text-on-primary disabled:opacity-50"
        >
          <Icon name="shield" className="text-[18px]" />
          {busy ? 'Opening…' : 'Open spend limit'}
        </button>
      </div>

      {error && <ErrorActionBanner message={error} actions={actionsForWalletError(error)} />}
      {status && <p className="text-body-sm text-secondary">{status}</p>}

      {purses.length > 0 && (
        <ul className="space-y-2">
          {purses.map((p) => (
            <li
              key={p.onChainId}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2.5"
            >
              <div>
                <p className="text-body-md font-medium text-on-surface">
                  {formatUsd(p.amount)} → {p.spender}
                </p>
                <p className="text-body-sm text-outline">
                  #{p.onChainId} · {p.durationDays}d
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshPurse(p.onChainId)}
                className="text-label-sm text-primary"
              >
                Check
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
