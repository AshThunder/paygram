type Props = {
  size?: number;
  className?: string;
  /** Show rounded square background (default true) */
  framed?: boolean;
};

/**
 * PayGram mark — coin + send arrow. Simple, works at 16–80px.
 */
export function PayGramLogo({ size = 48, className = '', framed = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {framed && <rect width="48" height="48" rx="14" className="fill-primary" />}
      {/* coin */}
      <circle cx="17" cy="29" r="7" className="fill-on-primary" />
      {/* send arrow */}
      <path
        d="M23 23L35 13M35 13H27M35 13V21"
        className="stroke-on-primary"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  subtitle?: string;
};

export function PayGramBrand({ className = '', subtitle }: WordmarkProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <PayGramLogo size={80} />
      <h1 className="mt-4 text-display-amount tracking-tight text-primary">PayGram</h1>
      {subtitle ? (
        <p className="mt-2 max-w-[280px] text-center text-body-md text-on-surface-variant">{subtitle}</p>
      ) : null}
    </div>
  );
}
