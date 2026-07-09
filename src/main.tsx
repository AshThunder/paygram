import { Buffer } from 'buffer';
import process from 'process';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MagicProvider } from '@/hooks/MagicProvider';
import { AuthProvider } from '@/hooks/AuthProvider';
import { useTelegramTheme } from '@/hooks/useTelegramTheme';
import { initTelegramApp } from '@/lib/telegram';
import App from './App';
import './index.css';

// Particle UA SDK expects Node globals in the browser
if (!globalThis.Buffer) globalThis.Buffer = Buffer;
if (!globalThis.process) globalThis.process = process;

function Root() {
  useTelegramTheme();
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <StrictMode>
      <BrowserRouter>
        <MagicProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MagicProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
