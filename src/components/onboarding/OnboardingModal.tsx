import { Icon } from '@/components/ui/Icon';

const ONBOARDING_KEY = 'paygram_onboarding_done';

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

type Props = {
  onDone: () => void;
};

const FEATURES = [
  {
    icon: 'qr_code_2',
    title: 'Add money once',
    desc: 'Scan your QR and deposit USDC or ETH — any major chain works.',
  },
  {
    icon: 'lock_open',
    title: 'Unlock your wallet',
    desc: 'One-time setup. Sometimes you need a tiny ETH on Arbitrum (~$0.01).',
  },
  {
    icon: 'send',
    title: 'Send, split, collect',
    desc: 'Type in chat or use the buttons. No chains or gas to think about.',
  },
] as const;

/** Matches stitch onboarding_modal — bottom sheet over blurred home chrome */
export function OnboardingModal({ onDone }: Props) {
  const finish = () => {
    markOnboardingDone();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-hidden">

      <div className="relative mx-auto flex min-h-screen w-full max-w-[390px] flex-col overflow-hidden bg-background">
        {/* Fake blurred dashboard */}
        <div className="pointer-events-none flex flex-1 flex-col opacity-40">
          <header className="flex h-16 items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-surface-container-highest" />
            <div className="text-headline-lg font-bold text-primary">PayGram</div>
            <div className="h-6 w-6 animate-pulse rounded-full bg-surface-container-highest" />
          </header>
          <main className="flex flex-1 flex-col gap-6 px-container-padding py-stack-gap-lg">
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5">
              <span className="text-body-md text-on-surface-variant">Total Balance</span>
              <h2 className="text-display-amount text-on-surface">$0.00</h2>
              <div className="mt-2 flex gap-2">
                <div className="h-10 w-24 animate-pulse rounded-full bg-surface-container-highest" />
                <div className="h-10 w-24 animate-pulse rounded-full bg-surface-container-highest" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-headline-md text-on-surface">Recent</h3>
              <div className="flex flex-col gap-4 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-surface-container-highest" />
                    <div className="flex-1">
                      <div className="mb-1 h-4 w-20 animate-pulse rounded bg-surface-container-highest" />
                      <div className="h-3 w-16 animate-pulse rounded bg-surface-container-highest" />
                    </div>
                    <div className="h-4 w-12 animate-pulse rounded bg-surface-container-highest" />
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>

        <div className="absolute inset-0 z-40 bg-on-surface/30 onboarding-overlay-enter" />

        <div className="absolute bottom-0 left-0 z-50 flex w-full flex-col rounded-t-[32px] border-t border-surface-variant bg-surface-container-lowest pb-safe onboarding-sheet-enter">
          <div className="flex w-full justify-center pb-2 pt-4">
            <div className="h-1.5 w-12 rounded-full bg-surface-container-highest" />
          </div>

          <div className="flex flex-col gap-6 px-container-padding pb-8 pt-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed/30">
                <Icon name="rocket_launch" className="text-3xl text-primary" filled />
              </div>
              <h1 className="text-headline-lg text-on-surface">Welcome to PayGram</h1>
              <p className="max-w-[280px] text-body-md text-on-surface-variant">
                Fund once, unlock once — then pay friends like messaging.
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-4">
              {FEATURES.map((f) => (
                <div key={f.icon} className="flex items-start gap-4 rounded-2xl p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed/50">
                    <Icon name={f.icon} className="text-secondary" />
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="text-body-lg font-medium text-on-surface">{f.title}</span>
                    <span className="text-body-md text-on-surface-variant">{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-2">
              <button
                type="button"
                onClick={finish}
                className="w-full rounded-full bg-cta py-4 text-headline-md text-on-primary transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
