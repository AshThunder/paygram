import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { PayGramProvider } from '@/hooks/PayGramProvider';
import { UniversalAccountProvider, useUniversalAccount } from '@/hooks/UniversalAccountProvider';
import { ChatChromeProvider } from '@/hooks/ChatChromeProvider';
import { ToastProvider } from '@/hooks/ToastProvider';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { LoadingScreen } from '@/components/auth/LoadingScreen';
import { ClaimUsernameScreen } from '@/components/auth/ClaimUsernameScreen';
import { OnboardingModal, hasCompletedOnboarding } from '@/components/onboarding/OnboardingModal';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { AppHeader } from '@/components/ui/AppHeader';
import { TabBar } from '@/components/ui/TabBar';
import { ChatPage } from '@/pages/ChatPage';
import { HomePage } from '@/pages/HomePage';
import { CirclesPage } from '@/pages/CirclesPage';
import { BalancePage } from '@/pages/BalancePage';
import {
  SendPage,
  TipPage,
  RequestPage,
  SplitPage,
  SwapPage,
  RemindPage,
} from '@/pages/actions/MoneyActionPages';
import { ActivityPage } from '@/pages/ActivityPage';
import { CollectPage } from '@/pages/CollectPage';
import { MePage } from '@/pages/MePage';
import { FriendsPage } from '@/pages/FriendsPage';
import { CheckoutRoute } from '@/pages/CheckoutRoute';
import { TabsPage } from '@/pages/TabsPage';

const SPLASH_MS = 1400;

function AppShell() {
  const location = useLocation();
  const hideChrome = location.pathname === '/checkout';
  const hideTabBar =
    hideChrome ||
    ['/send', '/tip', '/request', '/split', '/swap', '/remind'].includes(location.pathname);

  return (
    <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-surface-container-lowest pt-safe text-on-surface border-x border-surface-variant">
      {!hideChrome && <AppHeader />}
      <main className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/balance" element={<BalancePage />} />
          <Route path="/send" element={<SendPage />} />
          <Route path="/tip" element={<TipPage />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/split" element={<SplitPage />} />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/remind" element={<RemindPage />} />
          <Route path="/circles" element={<CirclesPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/collect" element={<CollectPage />} />
          <Route path="/tabs" element={<TabsPage />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideTabBar && <TabBar />}
    </div>
  );
}

function AuthenticatedApp() {
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());
  const { loading, isWalletReady, primaryAssets, initError } = useUniversalAccount();
  const walletBooting = loading && !primaryAssets && !isWalletReady && !initError;

  if (walletBooting) {
    return (
      <LoadingScreen
        message="Setting up your secure USD wallet..."
        subtitle="Encrypting keys and establishing connection to the network."
      />
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <PayGramProvider>
        <ChatChromeProvider>
          <AppShell />
        </ChatChromeProvider>
      </PayGramProvider>
    </>
  );
}

export default function App() {
  const { isAuthenticated, isAuthChecking, paygramUsername } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!splashDone) {
    return <SplashScreen />;
  }

  if (isAuthChecking) {
    return (
      <LoadingScreen message="Loading PayGram…" subtitle="Restoring your session" />
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!paygramUsername) {
    return <ClaimUsernameScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <UniversalAccountProvider>
        <ToastProvider>
          <AuthenticatedApp />
        </ToastProvider>
      </UniversalAccountProvider>
    </div>
  );
}
