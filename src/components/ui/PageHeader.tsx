import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';

type Props = {
  title: string;
  /** Default: navigate back. Pass `null` to hide the back control. */
  onBack?: (() => void) | null;
  right?: ReactNode;
};

export function PageHeader({ title, onBack, right }: Props) {
  const navigate = useNavigate();
  const showBack = onBack !== null;
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
      {showBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="-ml-2 rounded-full p-2 text-primary active:scale-95"
          aria-label="Go back"
        >
          <Icon name="arrow_back" className="text-[24px]" />
        </button>
      ) : (
        <div className="w-10" />
      )}
      <h1 className="truncate text-headline-md font-semibold text-on-surface">{title}</h1>
      {right ?? <div className="w-10 shrink-0" />}
    </header>
  );
}
