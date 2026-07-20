import type { ChatMessage } from '@/lib/storage';

export function derivePaymentContext(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === 'receipt' && m.receipt?.counterparty) {
      return {
        counterparty: m.receipt.counterparty,
        status: m.receipt.status,
        txId: m.receipt.txId,
      };
    }
    if (m.type === 'confirm' && m.confirm?.recipient) {
      return {
        counterparty: m.confirm.recipient,
        status: 'confirming' as const,
        txId: undefined,
      };
    }
  }
  return null;
}

export function parseCounterparty(counterparty: string) {
  const handle = counterparty.replace(/^@/, '');
  return {
    handle,
    at: `@${handle}`,
    displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
  };
}
