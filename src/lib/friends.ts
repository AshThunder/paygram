export type Friend = {
  id: string;
  username: string;
  displayName?: string;
  walletAddress?: string;
  addedAt: number;
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

export function loadFriends(): Friend[] {
  return load<Friend[]>('paygram_friends', []);
}

export function saveFriends(friends: Friend[]): void {
  save('paygram_friends', friends);
}
