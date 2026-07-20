import type { ReactNode } from 'react';

export function TactileCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-surface-container-highest/50 bg-surface-container-lowest p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-section-label text-section-label uppercase tracking-widest text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
}

export function AvatarCircle({ label, className = 'w-12 h-12' }: { label: string; className?: string }) {
  const initials = label.replace('@', '').slice(0, 2).toUpperCase();
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-high font-bold text-primary`}
    >
      {initials}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: 'confirmed' | 'pending' | 'failed';
}) {
  const styles = {
    confirmed: 'bg-secondary-container/30 text-secondary',
    pending: 'bg-primary-fixed text-on-primary-fixed-variant',
    failed: 'bg-error-container text-error',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}
