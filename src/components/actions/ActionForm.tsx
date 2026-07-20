import {
  forwardRef,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { isAddress } from '@/lib/constants';
import type { RefObject } from 'react';
import { ConfettiBurst } from '@/components/chat/ConfettiBurst';

/** Centered title header matching stitch send_money / form pages */
export function ActionPageShell({
  title,
  subtitle = 'no chat required',
  children,
  backTo = '/',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backTo?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-touch bg-background">
      <header className="relative z-10 sticky top-0 flex items-center justify-between border-b border-surface-variant bg-background px-container-padding py-2">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-container-low"
          aria-label="Go back"
        >
          <Icon name="arrow_back" className="text-[22px] text-on-surface" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-headline-sm font-semibold text-primary">{title}</h1>
          {subtitle && (
            <p className="text-[11px] font-medium text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        <div className="h-10 w-10" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[390px] flex-1 px-container-padding pb-8 pb-safe pt-4">
        {children}
      </main>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">
      {children}
    </label>
  );
}

export const FieldInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function FieldInput({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded-[16px] border border-surface-variant bg-surface-container-lowest py-3 pl-10 pr-4 text-body-md text-on-surface outline-none placeholder:text-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container ${className}`}
      />
    );
  },
);

export function FieldTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full resize-none rounded-[16px] border border-surface-variant bg-surface-container-lowest py-3 pl-10 pr-4 text-body-md text-on-surface outline-none placeholder:text-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container ${className}`}
    />
  );
}

/** Stitch CTA — #3D95CE pill */
export function PrimaryButton({
  children,
  busy,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`flex w-full items-center justify-center gap-2 rounded-full bg-cta py-4 text-headline-sm font-semibold text-on-primary transition active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 rounded-[24px] border border-surface-variant bg-surface-container-lowest p-5 soft-shadow">
      {children}
    </div>
  );
}

export function SuccessPanel({
  message,
  link,
  onDone,
  secondaryLabel,
  onSecondary,
}: {
  message: string;
  link?: string;
  onDone: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const [burst, setBurst] = useState(true);
  useEffect(() => {
    setBurst(true);
    const t = window.setTimeout(() => setBurst(false), 1400);
    return () => window.clearTimeout(t);
  }, [message]);

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-surface-variant bg-surface-container-lowest p-6 text-center soft-shadow">
      <ConfettiBurst active={burst} />
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary-container">
        <Icon name="check_circle" className="text-[36px]" filled />
      </div>
      <p className="text-headline-sm text-on-surface">{message}</p>
      {link && (
        <p className="mt-2 break-all rounded-xl bg-surface-container-low p-3 text-body-sm text-primary">
          {link}
        </p>
      )}
      <PrimaryButton className="mt-5" onClick={onDone}>
        Done
      </PrimaryButton>
      {secondaryLabel && onSecondary && (
        <button
          type="button"
          onClick={onSecondary}
          className="mt-3 w-full text-label-md font-semibold text-primary"
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-error-container bg-error-container/40 px-4 py-3 text-body-sm text-error">
      {message}
    </div>
  );
}

export function FriendChips({
  friends,
  selected,
  onPick,
}: {
  friends: Array<{ username: string }>;
  selected?: string;
  onPick: (handle: string) => void;
}) {
  if (friends.length === 0) return null;
  const sel = selected?.replace(/^@/, '').toLowerCase();
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {friends.slice(0, 8).map((f) => {
        const active = sel === f.username.toLowerCase();
        return (
          <button
            key={f.username}
            type="button"
            onClick={() => onPick(`@${f.username}`)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 transition active:scale-95 ${
              active
                ? 'border border-transparent bg-secondary-fixed'
                : 'border border-surface-variant bg-surface hover:bg-surface-container-low'
            }`}
          >
            <AvatarLetter name={f.username} />
            <span
              className={`text-body-sm ${active ? 'text-on-secondary-container' : 'text-on-surface'}`}
            >
              @{f.username}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FriendAvatarRow({
  friends,
  selected,
  onPick,
  onAdd,
}: {
  friends: Array<{ username: string; displayName?: string }>;
  selected?: string;
  onPick: (handle: string) => void;
  onAdd?: () => void;
}) {
  const sel = selected?.replace(/^@/, '').toLowerCase();
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-w-[64px] flex-col items-center gap-2"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-outline-variant text-outline">
            <Icon name="add" className="text-[28px]" />
          </div>
          <span className="text-[12px] font-medium text-on-surface-variant">New</span>
        </button>
      )}
      {friends.slice(0, 10).map((f) => {
        const active = sel === f.username.toLowerCase();
        const label = f.displayName || f.username;
        return (
          <button
            key={f.username}
            type="button"
            onClick={() => onPick(`@${f.username}`)}
            className="flex min-w-[64px] flex-col items-center gap-2"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold ${
                active
                  ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2'
                  : 'bg-primary-fixed text-primary'
              }`}
            >
              {f.username.slice(0, 2).toUpperCase()}
            </div>
            <span
              className={`max-w-[64px] truncate text-[12px] font-medium ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AvatarLetter({ name }: { name: string }) {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-container text-[10px] font-bold text-on-tertiary">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/** Large amount field — hero (on primary), card (forms), compact (inline). */
export function AmountInput({
  value,
  onChange,
  variant = 'card',
  label,
  autoFocus,
  placeholder = '0.00',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  variant?: 'hero' | 'card' | 'compact';
  label?: string;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const inputProps = {
    inputMode: 'decimal' as const,
    autoFocus,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    placeholder,
    'aria-label': 'Amount',
  };

  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        {label ? <p className="mb-3 text-body-sm font-medium text-on-primary/85">{label}</p> : null}
        <div className="flex items-center justify-center gap-1 rounded-[20px] bg-white/12 px-5 py-2 ring-1 ring-inset ring-white/25">
          <span className="self-start pt-3 text-[28px] font-bold text-white">$</span>
          <input
            {...inputProps}
            className="min-w-[140px] max-w-[240px] border-none bg-transparent p-0 text-center text-[56px] font-extrabold leading-none tracking-tight text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-headline-sm font-bold text-primary">$</span>
        <input
          {...inputProps}
          className="min-w-0 flex-1 border-none bg-transparent text-[28px] font-bold text-on-surface outline-none placeholder:text-outline-variant"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center py-2 ${className}`}>
      {label ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
      ) : null}
      <div className="flex items-center justify-center gap-0.5">
        <span className="self-start pt-4 text-[32px] font-bold text-primary">$</span>
        <input
          {...inputProps}
          className="w-[200px] border-none bg-transparent p-0 text-center text-[52px] font-extrabold leading-none tracking-tight text-primary outline-none placeholder:text-primary/25"
        />
      </div>
      <div className="mt-3 h-1 w-24 rounded-full bg-primary/25" aria-hidden />
    </div>
  );
}

export function normalizeHandleInput(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  if (!t) return '';
  if (t.startsWith('0x')) return t;
  return t.startsWith('@') ? t : `@${t}`;
}

/** @username or 0x wallet — for send / tip / request forms. */
export function RecipientInput({
  value,
  onChange,
  inputRef,
  placeholder = '@username or 0x wallet address',
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
}) {
  const trimmed = value.trim();
  const isAddr = trimmed.startsWith('0x');

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Icon
          name={isAddr ? 'account_balance_wallet' : 'alternate_email'}
          className="text-[20px] text-outline"
        />
      </span>
      <FieldInput
        ref={inputRef}
        placeholder={placeholder}
        value={isAddr ? trimmed : trimmed.replace(/^@/, '')}
        onChange={(e) => {
          const v = e.target.value.replace(/\s+/g, '');
          onChange(v.startsWith('0x') ? v : v.replace(/^@/, ''));
        }}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
}

export function isRecipientValid(raw: string): boolean {
  const t = normalizeHandleInput(raw);
  if (!t) return false;
  if (t.startsWith('0x')) return isAddress(t);
  return t.replace(/^@/, '').length >= 3;
}

export function parseHandlesList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => normalizeHandleInput(p));
}
