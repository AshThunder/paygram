import { formatUsd } from '@/lib/constants';

type Props = {
  balance: number;
  loading?: boolean;
};

export function BalanceHeader({ balance, loading }: Props) {
  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">Balance</p>
      <p className="text-3xl font-bold text-text-primary tabular-nums">
        {loading ? '—' : formatUsd(balance)}
      </p>
      <p className="text-text-muted text-xs mt-1">Unified across all chains</p>
    </div>
  );
}
