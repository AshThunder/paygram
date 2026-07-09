export type PayGramUser = {
  id: string;
  telegramId?: string;
  username: string | null;
  displayName: string;
  walletAddress: string;
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
};

export type GiftLink = {
  id: string;
  amount: number;
  creator: string;
  creatorAddress: string;
  claimed: boolean;
  createdAt: number;
};
