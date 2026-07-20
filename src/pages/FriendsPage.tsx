import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriends } from '@/hooks/useFriends';
import { inviteLink } from '@/lib/links';
import { shareUrl } from '@/lib/telegram';
import { Icon } from '@/components/ui/Icon';
import { AvatarCircle } from '@/components/ui/stitch';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/actions/ActionForm';

export function FriendsPage() {
  const navigate = useNavigate();
  const { friends, addFriend, removeFriend } = useFriends();
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return friends;
    return friends.filter(
      (f) => f.username.includes(q) || f.displayName?.toLowerCase().includes(q),
    );
  }, [friends, query]);

  const sections = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const f of filtered) {
      const letter = (f.displayName || f.username).charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const closeAdd = () => {
    setShowAdd(false);
    setError(null);
    setHandleInput('');
  };

  const submitAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      await addFriend(handleInput);
      closeAdd();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add friend');
    } finally {
      setAdding(false);
    }
  };

  const goPay = (username: string) => {
    navigate('/send', { state: { recipient: `@${username}`, amount: 5 } });
  };

  const goRequest = (username: string) => {
    navigate('/request', { state: { from: `@${username}`, amount: 10 } });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader
        title="Friends"
        right={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="-mr-2 rounded-full bg-secondary-fixed/50 p-2 text-primary active:scale-95"
            aria-label="Add new friend"
          >
            <Icon name="person_add" />
          </button>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto scroll-touch px-container-padding py-stack-gap-md pb-tab-bar">
        <div className="relative mb-stack-gap-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Icon name="search" className="text-outline" />
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search @username"
            className="w-full rounded-[16px] border border-surface-variant bg-surface-container-lowest py-3 pl-12 pr-4 text-body-lg text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && !showAdd && (
          <div className="mb-3 rounded-xl border border-error-container bg-error-container/40 p-3 text-body-sm text-error">
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon="group"
            title={query ? 'No matches' : 'No friends yet'}
            body={
              query
                ? 'Try another name or @username.'
                : 'Add people you pay often. They stay here even when chat is cleared.'
            }
            ctaLabel={query ? undefined : 'Add friend'}
            onCta={query ? undefined : () => setShowAdd(true)}
          />
        ) : (
          <div className="space-y-stack-gap-lg">
            {sections.map(([letter, list]) => (
              <section key={letter}>
                <h2 className="mb-stack-gap-sm px-2 text-section-label uppercase tracking-wider text-on-surface-variant">
                  {letter}
                </h2>
                <div className="overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest">
                  {list.map((friend, i) => (
                    <div
                      key={friend.id}
                      className={`flex items-center justify-between p-4 transition-colors hover:bg-surface-container-low/50 ${
                        i < list.length - 1 ? 'border-b border-surface-variant/50' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarCircle label={friend.username} className="h-10 w-10 shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-body-lg font-medium text-on-surface capitalize">
                            {friend.displayName || friend.username}
                          </span>
                          <span className="text-sm text-on-surface-variant">@{friend.username}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goRequest(friend.username)}
                          className="rounded-full bg-secondary-fixed px-3 py-2 text-label-sm font-semibold text-on-secondary-fixed-variant active:scale-95"
                        >
                          Request
                        </button>
                        <button
                          type="button"
                          onClick={() => goPay(friend.username)}
                          className="rounded-full bg-primary px-3 py-2 text-label-sm font-semibold text-on-primary active:scale-95"
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFriend(friend.username)}
                          className="rounded-full p-2 text-outline hover:text-error"
                          aria-label={`Remove @${friend.username}`}
                        >
                          <Icon name="close" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-stack-gap-lg flex justify-center">
          <button
            type="button"
            onClick={() => shareUrl(inviteLink(), 'Join me on PayGram')}
            className="flex items-center gap-2 rounded-full border border-surface-variant bg-surface-container-lowest px-6 py-3 text-body-lg text-primary transition-colors hover:bg-surface-container-low active:scale-95"
          >
            <Icon name="person_add" />
            <span>Invite Friends</span>
          </button>
        </div>
      </main>

      {showAdd && (
        <BottomSheet title="Add friend" subtitle="They must already use PayGram" onClose={closeAdd}>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Enter their Telegram @username.
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-full border border-surface-variant bg-surface-container-low px-4 py-3">
            <span className="text-body-md text-outline">@</span>
            <input
              type="text"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value.replace(/^@/, ''))}
              placeholder="username"
              autoFocus
              className="flex-1 bg-transparent text-body-md text-on-surface focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAdd();
              }}
            />
          </div>
          {error && <p className="mb-3 text-body-sm text-error">{error}</p>}
          <PrimaryButton
            disabled={adding || !handleInput.trim()}
            busy={adding}
            onClick={() => void submitAdd()}
          >
            Add to friends
          </PrimaryButton>
        </BottomSheet>
      )}
    </div>
  );
}
