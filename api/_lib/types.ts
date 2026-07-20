export type PayGramUser = {
  id: string;
  telegramId?: string;
  username: string | null;
  displayName: string;
  walletAddress: string;
  email?: string;
  /** Saved friend handles (no @), synced across devices. */
  friends?: string[];
  createdAt: number;
};

export type PaymentRequest = {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: number;
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
  onChainId?: number | null;
  chainId?: number | null;
  beneficiaryAddress?: string | null;
  creatorAddress?: string | null;
  released?: boolean;
  cancelled?: boolean;
};

/** Cross-device send/tip ledger so recipients see incoming activity. */
export type SharedActivity = {
  id: string;
  type: string;
  fromUser: string;
  toUser: string;
  amount: number;
  note?: string;
  txId?: string;
  status: string;
  createdAt: number;
};

/** Shared lend/borrow tab — visible to both lender and borrower. */
export type SharedTabDebt = {
  id: string;
  onChainId?: number | null;
  chainId?: number | null;
  lender: string;
  borrower: string;
  lenderAddress: string;
  borrowerAddress: string;
  principal: number;
  repaid: number;
  dueAt: number | null;
  note?: string;
  closed: boolean;
  fundTxId?: string | null;
  createdAt: number;
};

/** Shared ROSCA circle — visible to creator, members, and pending invites. */
export type SharedCircle = {
  id: string;
  name: string;
  contribution: number;
  memberCount: number;
  members: string[];
  pendingInvites?: string[];
  currentRound: number;
  paidRounds: number;
  status: 'forming' | 'active' | 'paused' | 'completed' | 'dissolved';
  roundDeadline?: number;
  createdAt: number;
  onChainId?: number | null;
  chainId?: number | null;
  memberAddresses?: string[];
  pendingAddresses?: string[];
  creatorAddress?: string | null;
  creatorHandle?: string | null;
  roundPeriodSec?: number;
};
