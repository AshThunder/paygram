import { PayGramLogo } from '@/components/ui/PayGramLogo';

type Props = {
  title?: string;
  message?: string;
  subtitle?: string;
};

/** Solid loading — PayGram mark + ripple */
export function LoadingScreen({
  message = 'Setting up your secure USD wallet...',
  subtitle = 'Encrypting keys and establishing connection to the network.',
}: Props) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-container-padding text-on-surface antialiased">
      <main className="flex w-full max-w-sm flex-col items-center">
        <div className="relative mb-12 flex h-32 w-32 items-center justify-center">
          <div className="wallet-ripple absolute inset-0 rounded-[28px] border-2 border-primary-fixed opacity-0" />
          <div className="wallet-ripple-delayed absolute inset-0 rounded-[28px] border-2 border-primary-container opacity-0" />
          <div className="relative z-10">
            <PayGramLogo size={64} />
          </div>
        </div>

        <h1 className="wallet-text-pulse mb-stack-gap-sm text-center text-headline-md text-on-surface">
          {message}
        </h1>
        {subtitle && (
          <p className="max-w-[280px] text-center text-body-md text-on-surface-variant opacity-80">
            {subtitle}
          </p>
        )}
      </main>
    </div>
  );
}
