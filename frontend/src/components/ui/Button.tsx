import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'calm'
  | 'focus'
  | 'spark'
  | 'warm'
  | 'lilac';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-accent-focus)] text-white shadow-[var(--shadow-md)] hover:brightness-110 active:brightness-95 active:shadow-[var(--shadow-xs)]',
  secondary: 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] border border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] hover:bg-[var(--color-bg-surface)] shadow-[var(--shadow-xs)]',
  ghost: 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)] hover:text-[var(--color-text-primary)]',
  calm: 'bg-[var(--color-accent-calm)] text-white shadow-[var(--shadow-md)] hover:brightness-110',
  focus: 'bg-[var(--color-accent-focus)] text-white shadow-[var(--shadow-md)] hover:brightness-110',
  spark: 'bg-[var(--color-accent-spark)] text-white shadow-[var(--shadow-md)] hover:brightness-110',
  warm: 'bg-[var(--color-accent-warm)] text-white shadow-[var(--shadow-md)] hover:brightness-110',
  lilac: 'bg-[var(--color-accent-lilac)] text-white shadow-[var(--shadow-md)] hover:brightness-110',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-sm font-semibold rounded-xl gap-1.5',
  md: 'px-5 py-2.5 text-base font-semibold rounded-xl gap-2',
  lg: 'px-7 py-4 text-base font-bold rounded-2xl gap-2.5 tracking-wide',
};

const spinnerSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

function Spinner({ size }: { size: number }) {
  return (
    <svg
      className="animate-spin shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center font-medium
        transition-colors duration-[var(--duration-standard)] ease-[var(--ease-standard)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Spinner size={spinnerSizes[size]} />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </motion.button>
  );
}
