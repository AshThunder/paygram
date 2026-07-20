type Props = {
  name: string;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, className = '', filled }: Props) {
  return (
    <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}>{name}</span>
  );
}
