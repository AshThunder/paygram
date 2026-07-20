export const DEMO_USER = {
  name: 'Alex Chen',
  username: 'alex',
  email: 'alex@paygram.app',
  balance: 0,
  wallet: '0x742d…5f0bEb',
  smartAccount: '0x9a1c…7702',
  chains: [] as { name: string; amount: number; color: string }[],
};

export const FRIENDS: { id: string; username: string; displayName: string }[] = [];

export const OPEN_REQUESTS: {
  id: string;
  from: string;
  to: string;
  amount: number;
  note: string;
  type: string;
}[] = [];

export const HISTORY: {
  id: string;
  type: string;
  amount: number;
  counterparty: string;
  note: string;
  when: string;
}[] = [];

export const POT: {
  id: string;
  title: string;
  goal: number;
  collected: number;
  creator: string;
  contributors: { user: string; amount: number }[];
} | null = null;

export const CIRCLE: {
  id: string;
  name: string;
  contribution: number;
  members: string[];
  currentRound: number;
  memberCount: number;
  paidRounds: number;
  status: string;
  onChainId: number;
} | null = null;

export const TAB_DEBT: {
  id: string;
  lender: string;
  borrower: string;
  principal: number;
  repaid: number;
  outstanding: number;
  due: string;
  onChainId: number;
  note: string;
} | null = null;

export const CONTRACTS = [
  { name: 'PayGramPot', addr: '0x6D58560966914637565B4a10ebDADD56ea49E2cF', short: '0x6D58…E2cF' },
  { name: 'PayGramBillEscrow', addr: '0xe927742DBfFa80Df2575B5220cc74d91459A86A8', short: '0xe927…86A8' },
  { name: 'PayGramRosca', addr: '0xd6aCb0ef288001c171FCA29300f001970B2e5a45', short: '0xd6aC…5a45' },
  { name: 'PayGramTab', addr: '0xcfbb48A1C3890BB9a550d92A3dC0A02571B0A4bE', short: '0xcfbb…A4bE' },
  { name: 'PayGramAllowance', addr: '0x1d19aD900A157d83982816B48f4452bD01eF8B7b', short: '0x1d19…8B7b' },
];

export type ChatMsg =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'confirm';
      intent: 'send' | 'split' | 'collect' | 'tip';
      amount: number;
      to?: string;
      recipients?: string[];
      title?: string;
      note?: string;
      balanceBefore: number;
    }
  | { id: string; role: 'receipt'; amount: number; to: string; note?: string; txId: string; status: 'confirmed' };

export const INITIAL_CHAT: ChatMsg[] = [];

export const SERVICES = [
  { label: 'Send', icon: 'send', path: '/send' },
  { label: 'Request', icon: 'request_quote', path: '/request' },
  { label: 'Split', icon: 'call_split', path: '/split' },
  { label: 'Tip', icon: 'volunteer_activism', path: '/tip' },
  { label: 'Swap', icon: 'currency_exchange', path: '/swap' },
  { label: 'Collect', icon: 'group_add', path: '/collect' },
  { label: 'Loans', icon: 'handshake', path: '/tabs' },
  { label: 'Circles', icon: 'donut_large', path: '/circles' },
] as const;

export const FEATURE_TABS = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'send', label: 'Send', icon: 'send' },
  { id: 'receive', label: 'Receive', icon: 'south_west' },
  { id: 'tip', label: 'Tip', icon: 'volunteer_activism' },
  { id: 'request', label: 'Request', icon: 'request_quote' },
] as const;

export const MORE_FEATURES = [
  { id: 'split', label: 'Split', icon: 'call_split' },
  { id: 'lend', label: 'Loans', icon: 'handshake' },
  { id: 'collect', label: 'Collect', icon: 'savings' },
  { id: 'circles', label: 'Circles', icon: 'donut_large' },
  { id: 'swap', label: 'Swap', icon: 'currency_exchange' },
] as const;
