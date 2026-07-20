import { useLocation, useNavigate } from 'react-router-dom';
import { universalXUrl } from '@/lib/constants';
import { parseCounterparty } from '@/lib/chatContext';
import { useChatChrome } from '@/hooks/ChatChromeProvider';
import { Icon } from './Icon';

function PeerAvatar({ handle }: { handle: string }) {
  const letter = handle.replace(/^@/, '').charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-surface-variant bg-surface-container-high text-label-md font-semibold text-on-surface-variant">
      {letter}
    </div>
  );
}

export function AppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { chrome, chatMenu } = useChatChrome();

  const chatClearButton =
    chatMenu?.hasMessages ? (
      <button
        type="button"
        onClick={chatMenu.requestClear}
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-transform hover:bg-surface-container active:scale-95"
        aria-label="Clear chat"
      >
        <Icon name="delete_outline" className="text-[22px]" />
      </button>
    ) : null;

  // Pages that own their chrome (Stitch TopAppBar)
  if (
    pathname === '/' ||
    pathname === '/circles' ||
    pathname === '/collect' ||
    pathname === '/balance' ||
    pathname === '/send' ||
    pathname === '/tip' ||
    pathname === '/request' ||
    pathname === '/split' ||
    pathname === '/swap' ||
    pathname === '/remind' ||
    pathname === '/friends' ||
    pathname === '/activity' ||
    pathname === '/tabs' ||
    pathname === '/me'
  ) {
    return null;
  }

  if (pathname === '/chat' && chrome.variant === 'pending' && chrome.counterparty) {
    const { at } = parseCounterparty(chrome.counterparty);
    return (
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-surface px-edge-margin">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-primary transition-transform hover:opacity-80 active:scale-95"
            aria-label="Back to home"
          >
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <div className="flex items-center gap-2">
            <PeerAvatar handle={at} />
            <h1 className="text-headline-sm text-on-surface">{at}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {chatClearButton}
          <button
            type="button"
            onClick={() => {
              if (chrome.txId) {
                window.open(universalXUrl(chrome.txId), '_blank', 'noopener,noreferrer');
              } else {
                navigate('/activity');
              }
            }}
            className="text-label-md text-primary transition-transform hover:opacity-80 active:scale-95"
          >
            Details
          </button>
        </div>
      </header>
    );
  }

  if (pathname === '/chat') {
    return (
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-surface px-edge-margin">
        <div className="flex items-center gap-2 text-primary">
          <Icon name="chat" className="text-[22px]" filled />
          <h1 className="text-headline-lg-mobile font-bold text-primary">Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          {chatClearButton}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full bg-primary/10 px-3 py-1 text-label-md font-semibold text-primary"
          >
            Home
          </button>
        </div>
      </header>
    );
  }

  if (pathname === '/collect') {
    return (
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-surface px-edge-margin">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-primary"
        >
          <Icon name="arrow_back" className="text-[22px]" />
          <h1 className="text-headline-lg-mobile font-bold text-primary">Collect</h1>
        </button>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-label-md font-semibold text-primary">
          Collect
        </span>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-surface px-edge-margin">
      <div className="flex items-center gap-2 text-primary">
        <Icon name="account_balance_wallet" className="text-[22px]" filled />
        <h1 className="text-headline-lg-mobile font-bold text-primary">PayGram</h1>
      </div>
      <span className="rounded-full bg-primary-container px-3 py-1 text-label-md font-semibold text-on-primary-container">
        PayGram
      </span>
    </header>
  );
}
