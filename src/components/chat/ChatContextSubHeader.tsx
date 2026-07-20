import { formatUsd } from '@/lib/constants';
import { parseCounterparty } from '@/lib/chatContext';

type Props = {
  counterparty: string;
  balance: number;
};

function PeerAvatar({ handle }: { handle: string }) {
  const letter = handle.charAt(0).toUpperCase();
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-label-md font-semibold text-on-surface-variant">
      {letter}
    </div>
  );
}

export function ChatContextSubHeader({ counterparty, balance }: Props) {
  const { at, displayName } = parseCounterparty(counterparty);

  return (
    <div className="sticky top-14 z-30 flex items-center justify-between border-b border-surface-container-highest border-b border-surface-variant bg-surface-container-lowest px-container-padding py-stack-gap-sm">
      <div className="flex items-center gap-3">
        <PeerAvatar handle={at} />
        <div className="flex flex-col">
          <span className="text-label-md text-on-surface">{displayName}</span>
          <span className="text-body-sm text-on-surface-variant">{at}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-section-label text-section-label uppercase text-on-surface-variant">Your Balance</span>
        <span className="text-headline-sm tabular-nums text-on-surface">{formatUsd(balance)}</span>
      </div>
    </div>
  );
}
