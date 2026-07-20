export type ChatMessageType =
  | 'user'
  | 'system'
  | 'confirm'
  | 'receipt'
  | 'error'
  | 'balance'
  | 'assistant';

export type AssistantPayload = {
  variant: 'scanning' | 'analyzed';
  fileName?: string;
  total?: number;
  merchant?: string;
  note?: string;
  splitCommand?: string;
};

export type BalancePayload = {
  total: number;
  chains: Array<{ name: string; amount: number }>;
  tokens: Array<{ symbol: string; amount: number }>;
};

export type ConfirmPayload = {
  intentType: 'send' | 'tip' | 'request' | 'split' | 'collect' | 'contribute' | 'swap';
  amount: number;
  recipient?: string;
  recipients?: string[];
  from?: string;
  title?: string;
  note?: string;
  resolvedAddress?: string;
  balanceBefore?: number;
  toToken?: string;
};

export type ReceiptPayload = {
  intentType: string;
  amount: number;
  counterparty?: string;
  note?: string;
  txId?: string;
  status: 'confirmed' | 'failed' | 'pending';
  emoji?: string;
};

export type ChatMessage = {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: number;
  confirm?: ConfirmPayload;
  receipt?: ReceiptPayload;
  assistant?: AssistantPayload;
  balanceDetail?: BalancePayload;
};

export type PaymentRequest = {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: number;
  /** PayGramBillEscrow id when split is on-chain. */
  onChainBillId?: number | null;
  chainId?: number | null;
  payeeAddress?: string | null;
};

export type PotContributor = {
  user: string;
  amount: number;
};

export type CollectionPot = {
  id: string;
  title: string;
  goal: number;
  collected: number;
  creator: string;
  contributors?: PotContributor[];
  createdAt: number;
  /** PayGramPot id when VITE_POT is set. */
  onChainId?: number | null;
  chainId?: number | null;
  beneficiaryAddress?: string | null;
  creatorAddress?: string | null;
  released?: boolean;
  cancelled?: boolean;
};

export type ActivityItem = {
  id: string;
  type: string;
  amount: number;
  counterparty?: string;
  note?: string;
  txId?: string;
  status: string;
  createdAt: number;
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Append a system / progress line into chat history (e.g. pot contributions). */
export function appendChatProgress(content: string): ChatMessage {
  const msg: ChatMessage = {
    id: uid(),
    type: 'system',
    content,
    timestamp: Date.now(),
  };
  saveChatMessages([...loadChatMessages(), msg]);
  try {
    window.dispatchEvent(new CustomEvent('paygram:chat-progress', { detail: msg }));
  } catch {
    /* ignore */
  }
  return msg;
}

export function loadChatMessages(): ChatMessage[] {
  return load<ChatMessage[]>('paygram_chat', []);
}

export function saveChatMessages(messages: ChatMessage[]): void {
  save('paygram_chat', messages);
}

export function clearChatMessages(): void {
  save('paygram_chat', []);
  try {
    window.dispatchEvent(new CustomEvent('paygram:chat-progress'));
  } catch {
    /* ignore */
  }
}

export function loadRequests(): PaymentRequest[] {
  return load<PaymentRequest[]>('paygram_requests', []);
}

export function saveRequests(requests: PaymentRequest[]): void {
  save('paygram_requests', requests);
}

export function loadPots(): CollectionPot[] {
  return load<CollectionPot[]>('paygram_pots', []);
}

export function savePots(pots: CollectionPot[]): void {
  save('paygram_pots', pots);
}

export function loadActivity(): ActivityItem[] {
  return load<ActivityItem[]>('paygram_activity', []);
}

export function saveActivity(items: ActivityItem[]): void {
  save('paygram_activity', items);
}

export function addActivity(item: Omit<ActivityItem, 'id' | 'createdAt'>): ActivityItem {
  const entry: ActivityItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const items = [entry, ...loadActivity()];
  saveActivity(items);
  return entry;
}

/** Persist a status update for a local activity row (by id or txId). */
export function updateActivityStatus(idOrTxId: string, status: string): void {
  const items = loadActivity().map((a) =>
    a.id === idOrTxId || a.txId === idOrTxId ? { ...a, status } : a,
  );
  saveActivity(items);
}

export function uid(): string {
  return crypto.randomUUID();
}
