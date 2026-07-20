type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat?: {
      id?: number;
      type?: string;
      title?: string;
    };
    start_param?: string;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  openTelegramLink?: (url: string) => void;
  shareMessage?: (params: { text: string }) => void;
  close: () => void;
  themeParams: Record<string, string>;
};

function webApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp;
}

export function getTelegramUser(): {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
} | null {
  const user = webApp()?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

export function getTelegramChat(): { id?: number; type?: string; title?: string } | null {
  const chat = webApp()?.initDataUnsafe?.chat;
  if (!chat) return null;
  return { id: chat.id, type: chat.type, title: chat.title };
}

export function getTelegramChatId(): number | null {
  return getTelegramChat()?.id ?? null;
}

export function canShareToGroup(): boolean {
  const chat = getTelegramChat();
  return Boolean(chat?.id && (chat.type === 'group' || chat.type === 'supergroup'));
}

export function isGroupChat(): boolean {
  const type = getTelegramChat()?.type;
  return type === 'group' || type === 'supergroup';
}

export function isTelegramMiniApp(): boolean {
  return Boolean(webApp()?.initData);
}

export function applyTelegramTheme(): void {
  const tg = webApp();
  if (!tg?.themeParams) return;
  const p = tg.themeParams;
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty('--tg-bg', p.bg_color);
  if (p.text_color) root.style.setProperty('--tg-text', p.text_color);
  if (p.hint_color) root.style.setProperty('--tg-hint', p.hint_color);
  if (p.button_color) root.style.setProperty('--tg-button', p.button_color);
  if (p.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', p.secondary_bg_color);

  const isLight = p.bg_color && parseInt(p.bg_color.replace('#', ''), 16) > 0x888888;
  if (isLight) {
    document.body.style.background = p.bg_color ?? '#fff';
    document.body.style.color = p.text_color ?? '#000';
  }
}

export function initTelegramApp(): void {
  const tg = webApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  applyTelegramTheme();
  const bg = tg.themeParams?.bg_color ?? '#f9f9fa';
  tg.setHeaderColor(bg);
  tg.setBackgroundColor(bg);
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void {
  const tg = webApp();
  if (!tg?.HapticFeedback) return;
  if (type === 'success' || type === 'error') {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
}

export function shareUrl(url: string, text: string): void {
  const tg = webApp();
  if (tg?.openTelegramLink) {
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(share);
  } else if (navigator.share) {
    navigator.share({ url, text }).catch(() => {});
  }
}

export function shareReceipt(text: string, emoji = '✅'): void {
  const full = `${emoji} ${text}`;
  const tg = webApp();
  if (tg?.shareMessage) {
    try {
      tg.shareMessage({ text: full });
      return;
    } catch {
      // fallback
    }
  }
  shareUrl(window.location.origin, full);
}

export function getStartParam(): string | null {
  return webApp()?.initDataUnsafe?.start_param ?? null;
}
