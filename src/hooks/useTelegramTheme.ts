import { useEffect } from 'react';
import { applyTelegramTheme } from '@/lib/telegram';

export function useTelegramTheme(): void {
  useEffect(() => {
    applyTelegramTheme();
    const tg = (window as unknown as { Telegram?: { WebApp: unknown } }).Telegram?.WebApp;
    if (!tg) return;
    const handler = () => applyTelegramTheme();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);
}
