type Props = {
  className?: string;
};

export function Skeleton({ className = '' }: Props) {
  return <div className={`animate-pulse rounded-lg bg-surface-container-high ${className}`} />;
}

export function BalanceSkeleton() {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-surface-container-highest/60 bg-surface-container-lowest px-container-padding py-3">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
