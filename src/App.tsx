import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { PayGramProvider } from '@/hooks/PayGramProvider';
import { UniversalAccountProvider } from '@/hooks/UniversalAccountProvider';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { OnboardingModal, hasCompletedOnboarding } from '@/components/onboarding/OnboardingModal';
import { TabBar } from '@/components/ui/TabBar';
import { ChatPage } from '@/pages/ChatPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { CollectPage } from '@/pages/CollectPage';
import { MePage } from '@/pages/MePage';

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-dark max-w-lg mx-auto">
      <header className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">PayGram</h1>
        <span className="text-xs text-brand-muted font-medium">UXmaxx</span>
      </header>
      <main className="flex flex-col flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/collect" element={<CollectPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(
    () => isAuthenticated && !hasCompletedOnboarding(),
  );

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <UniversalAccountProvider>
        <PayGramProvider>
          <AppShell />
        </PayGramProvider>
      </UniversalAccountProvider>
    </>
  );
}
