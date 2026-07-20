import { createContext, useContext, useState, type ReactNode } from 'react';

export type ChatChromeState = {
  variant: 'default' | 'pending' | 'peer';
  counterparty?: string;
  txId?: string;
  balance?: number;
};

export type ChatMenuState = {
  hasMessages: boolean;
  requestClear: () => void;
};

type ChatChromeContextValue = {
  chrome: ChatChromeState;
  setChrome: (chrome: ChatChromeState) => void;
  chatMenu: ChatMenuState | null;
  setChatMenu: (menu: ChatMenuState | null) => void;
};

const ChatChromeContext = createContext<ChatChromeContextValue | null>(null);

export function ChatChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<ChatChromeState>({ variant: 'default' });
  const [chatMenu, setChatMenu] = useState<ChatMenuState | null>(null);
  return (
    <ChatChromeContext.Provider value={{ chrome, setChrome, chatMenu, setChatMenu }}>
      {children}
    </ChatChromeContext.Provider>
  );
}

export function useChatChrome() {
  const ctx = useContext(ChatChromeContext);
  if (!ctx) throw new Error('useChatChrome requires ChatChromeProvider');
  return ctx;
}
