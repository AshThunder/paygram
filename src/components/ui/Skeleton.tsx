type Props = {
  className?: string;
};

export function Skeleton({ className = '' }: Props) {
  return <div className={`animate-pulse bg-surface-border/60 rounded-lg ${className}`} />;
}

export function BalanceSkeleton() {
  return (
    <div className="px-4 pt-4 pb-2 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-3 w-40" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}
