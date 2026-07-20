import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { DemoProvider } from './demoState';
import { DemoTabBar } from './ui/DemoTabBar';
import { Icon } from './ui/primitives';
import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { MeScreen } from './screens/MeScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import {
  CollectScreen,
  CirclesScreen,
  TabsScreen,
  FriendsScreen,
  BalanceScreen,
  SendScreen,
  ActionPlaceholder,
} from './screens/SubScreens';

function Splash({ onDone }: { onDone: () => void }) {
  return (
    <div
      data-testid="splash"
      role="button"
      tabIndex={0}
      onClick={onDone}
      onKeyDown={(e) => e.key === 'Enter' && onDone()}
      className="relative flex min-h-screen cursor-pointer flex-col items-center justify-between overflow-hidden bg-background"
    >
      <div className="w-full flex-1" />
      <main className="splash-fade-in relative z-10 flex flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-primary bg-primary">
          <Icon name="account_balance_wallet" className="text-5xl text-white" filled />
        </div>
        <h1 className="text-display-amount tracking-tight text-primary">PayGram</h1>
        <p className="mt-2 max-w-[280px] text-center text-body-md text-on-surface-variant">
          Seamless payments inside Telegram
        </p>
      </main>
      <footer className="splash-fade-in flex w-full flex-1 flex-col items-center justify-end pb-12 pb-safe" style={{ animationDelay: '0.2s' }}>
        <p className="text-section-label uppercase tracking-widest text-outline">Peer payments in Telegram</p>
        <p className="mt-3 rounded-full bg-surface-container-high px-3 py-1 text-[10px] text-outline">Tap anywhere to continue</p>
      </footer>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideTabBar = !['/', '/chat', '/activity', '/me'].includes(location.pathname);

  useEffect(() => {
    const state = location.state as { prefill?: string } | null;
    if (state?.prefill && location.pathname === '/chat') {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-[390px] flex-col overflow-hidden border-x border-surface-variant bg-surface-container-lowest pt-safe text-on-surface">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="/activity" element={<ActivityScreen />} />
        <Route path="/me" element={<MeScreen />} />
        <Route path="/balance" element={<BalanceScreen />} />
        <Route path="/collect" element={<CollectScreen />} />
        <Route path="/circles" element={<CirclesScreen />} />
        <Route path="/tabs" element={<TabsScreen />} />
        <Route path="/friends" element={<FriendsScreen />} />
        <Route path="/send" element={<SendScreen />} />
        <Route path="/request" element={<ActionPlaceholder title="Request" />} />
        <Route path="/split" element={<ActionPlaceholder title="Split" />} />
        <Route path="/tip" element={<ActionPlaceholder title="Tip" />} />
        <Route path="/swap" element={<ActionPlaceholder title="Swap" />} />
        <Route path="/receive" element={<ActionPlaceholder title="Receive" />} />
      </Routes>
      {!hideTabBar && <DemoTabBar />}
    </div>
  );
}

export function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <Splash onDone={() => setSplashDone(true)} />;
  }

  return (
    <DemoProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </DemoProvider>
  );
}
