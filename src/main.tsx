import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MagicProvider } from '@/hooks/MagicProvider';
import { AuthProvider } from '@/hooks/AuthProvider';
import { PayGramProvider } from '@/hooks/PayGramProvider';
import { UniversalAccountProvider } from '@/hooks/UniversalAccountProvider';
import { initTelegramApp } from '@/lib/telegram';
import App from './App';
import './index.css';

function Root() {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <StrictMode>
      <BrowserRouter>
        <MagicProvider>
          <AuthProvider>
            <UniversalAccountProvider>
              <PayGramProvider>
                <App />
              </PayGramProvider>
            </UniversalAccountProvider>
          </AuthProvider>
        </MagicProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
