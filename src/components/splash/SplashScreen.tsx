import { PayGramBrand } from '@/components/ui/PayGramLogo';

/** Solid splash — PayGram mark */
export function SplashScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background antialiased">
      <div className="w-full flex-1" />

      <main className="splash-fade-in relative z-10 flex flex-col items-center justify-center">
        <PayGramBrand subtitle="Seamless payments inside Telegram" />
      </main>

      <footer className="relative z-10 flex w-full flex-1 flex-col items-center justify-end pb-12 pb-safe">
        <p
          className="splash-fade-in text-section-label uppercase tracking-widest text-outline"
          style={{ animationDelay: '0.2s' }}
        >
          Peer payments in Telegram
        </p>
      </footer>
    </div>
  );
}
