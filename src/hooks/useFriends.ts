import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { lookupUserByWalletApi, resolveUserApi, syncFriendsApi } from '@/lib/api';
import { normalizeHandle } from '@/lib/constants';
import { loadFriends, saveFriends, type Friend } from '@/lib/friends';
import { uid } from '@/lib/storage';

function handlesFromFriends(friends: Friend[]): string[] {
  return friends.map((f) => f.username.toLowerCase());
}

function mergeFriendLists(local: Friend[], remoteHandles: string[]): Friend[] {
  const byUser = new Map<string, Friend>();
  for (const f of local) {
    byUser.set(f.username.toLowerCase(), f);
  }
  for (const raw of remoteHandles) {
    const username = normalizeHandle(raw);
    if (!username || byUser.has(username)) continue;
    byUser.set(username, {
      id: uid(),
      username,
      displayName: username,
      addedAt: Date.now(),
    });
  }
  return [...byUser.values()].sort((a, b) => a.username.localeCompare(b.username));
}

export function useFriends() {
  const { telegramUser, walletAddress } = useAuth();
  const [friends, setFriends] = useState<Friend[]>(() => loadFriends());
  const [hydrated, setHydrated] = useState(false);

  const persist = useCallback(
    (next: Friend[], syncRemote = true) => {
      const sorted = [...next].sort((a, b) => a.username.localeCompare(b.username));
      saveFriends(sorted);
      setFriends(sorted);
      if (syncRemote && walletAddress) {
        void syncFriendsApi(walletAddress, handlesFromFriends(sorted));
      }
    },
    [walletAddress],
  );

  // Restore friends from registry (Telegram WebViews wipe localStorage).
  useEffect(() => {
    if (!walletAddress || hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await lookupUserByWalletApi(walletAddress);
        if (cancelled) return;
        const remoteHandles = remote?.friends ?? [];
        if (remoteHandles.length || loadFriends().length) {
          const merged = mergeFriendLists(loadFriends(), remoteHandles);
          saveFriends(merged);
          setFriends(merged);
          // Push local-only friends up if remote was missing them.
          if (walletAddress && merged.length) {
            void syncFriendsApi(walletAddress, handlesFromFriends(merged));
          }
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, hydrated]);

  const addFriend = useCallback(
    async (rawHandle: string) => {
      const username = normalizeHandle(rawHandle);
      if (!username || username.length < 3) {
        throw new Error('Enter a valid Telegram @username (3+ characters).');
      }
      if (telegramUser?.username?.toLowerCase() === username) {
        throw new Error("You can't add yourself.");
      }
      if (friends.some((f) => f.username === username)) {
        throw new Error('@' + username + ' is already in your list.');
      }

      const wallet = await resolveUserApi(username);
      if (!wallet || wallet === '0x') {
        throw new Error(`@${username} isn't on PayGram yet. Invite them first.`);
      }

      const friend: Friend = {
        id: uid(),
        username,
        displayName: username,
        walletAddress: wallet,
        addedAt: Date.now(),
      };
      persist([...friends, friend]);
      return friend;
    },
    [friends, persist, telegramUser?.username],
  );

  /** Soft-add after a successful send — no error if already saved or not on PayGram. */
  const rememberHandle = useCallback(
    async (rawHandle: string) => {
      const username = normalizeHandle(rawHandle);
      if (!username || username.length < 3) return;
      if (friends.some((f) => f.username === username)) return;
      if (telegramUser?.username?.toLowerCase() === username) return;
      try {
        const wallet = await resolveUserApi(username);
        if (!wallet || wallet === '0x') return;
        const friend: Friend = {
          id: uid(),
          username,
          displayName: username,
          walletAddress: wallet,
          addedAt: Date.now(),
        };
        persist([...loadFriends(), friend]);
      } catch {
        /* ignore */
      }
    },
    [friends, persist, telegramUser?.username],
  );

  const removeFriend = useCallback(
    (username: string) => {
      persist(friends.filter((f) => f.username !== username));
    },
    [friends, persist],
  );

  const refreshWallet = useCallback(
    async (username: string) => {
      const wallet = await resolveUserApi(username);
      if (!wallet || wallet === '0x') return null;
      const next = friends.map((f) =>
        f.username === username ? { ...f, walletAddress: wallet } : f,
      );
      persist(next);
      return wallet;
    },
    [friends, persist],
  );

  return { friends, addFriend, removeFriend, refreshWallet, rememberHandle };
}
