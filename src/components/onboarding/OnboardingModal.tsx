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

export function OnboardingModal({ onDone }: Props) {
  const finish = () => {
    markOnboardingDone();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm w-full space-y-4">
        <p className="text-xs text-brand-muted font-semibold uppercase tracking-wider">Welcome to PayGram</p>
        <h2 className="text-xl font-bold text-text-primary">Type it. Tap confirm. Paid.</h2>
        <ul className="text-sm text-text-secondary space-y-2 list-disc pl-4">
          <li>Log in with email — Magic creates your wallet (no seed phrase).</li>
          <li>First send needs a tiny bit of <strong className="text-text-primary">ETH on Arbitrum</strong> for one-time setup.</li>
          <li>Pay friends with <strong className="text-text-primary">@telegram_username</strong> once they&apos;ve opened PayGram.</li>
          <li>One USD balance — Particle routes across chains invisibly.</li>
        </ul>
        <button
          type="button"
          onClick={finish}
          className="w-full h-11 bg-brand text-white font-semibold rounded-xl"
        >
          Get started
        </button>
      </div>
    </div>
  );
}
