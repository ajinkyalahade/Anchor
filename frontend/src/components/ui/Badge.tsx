import { type ReactNode } from 'react';

type BadgeVariant = 'calm' | 'focus' | 'spark' | 'warm' | 'lilac' | 'muted';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  calm: 'bg-[color-mix(in_srgb,var(--color-accent-calm)_15%,transparent)] text-[var(--color-accent-calm)]',
  focus: 'bg-[color-mix(in_srgb,var(--color-accent-focus)_15%,transparent)] text-[var(--color-accent-focus)]',
  spark: 'bg-[color-mix(in_srgb,var(--color-accent-spark)_15%,transparent)] text-[var(--color-accent-spark)]',
  warm: 'bg-[color-mix(in_srgb,var(--color-accent-warm)_15%,transparent)] text-[var(--color-accent-warm)]',
  lilac: 'bg-[color-mix(in_srgb,var(--color-accent-lilac)_15%,transparent)] text-[var(--color-accent-lilac)]',
  muted: 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)]',
};

export default function Badge({ children, variant = 'muted', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full
        text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
