export type ChatMessageType =
  | 'user'
  | 'system'
  | 'confirm'
  | 'receipt'
  | 'error'
  | 'balance';

export type ConfirmPayload = {
  intentType: 'send' | 'tip' | 'request' | 'split' | 'collect' | 'contribute' | 'gift';
  amount: number;
  recipient?: string;
  recipients?: string[];
  from?: string;
  title?: string;
  note?: string;
  resolvedAddress?: string;
};

export type ReceiptPayload = {
  intentType: string;
  amount: number;
  counterparty?: string;
  note?: string;
  txId?: string;
  status: 'confirmed' | 'failed' | 'pending';
};

export type ChatMessage = {
  id: string;
  type: ChatMessageType;
  content: string;
  timestamp: number;
  confirm?: ConfirmPayload;
  receipt?: ReceiptPayload;
};

export type PaymentRequest = {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: number;
};

export type CollectionPot = {
  id: string;
  title: string;
  goal: number;
  collected: number;
  creator: string;
  createdAt: number;
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

export function loadChatMessages(): ChatMessage[] {
  return load<ChatMessage[]>('paygram_chat', []);
}

export function saveChatMessages(messages: ChatMessage[]): void {
  save('paygram_chat', messages);
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

export function uid(): string {
  return crypto.randomUUID();
}
