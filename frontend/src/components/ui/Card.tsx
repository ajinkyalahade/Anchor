import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type CardVariant = 'surface' | 'glass' | 'outline';

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  description?: string;
}

const variantStyles: Record<CardVariant, string> = {
  surface: 'bg-[var(--color-bg-surface)] border border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] shadow-[var(--shadow-sm)]',
  glass: 'glass-card',
  outline: 'border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-transparent',
};

const paddingStyles = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export default function Card({
  children,
  variant = 'surface',
  padding = 'md',
  hover = false,
  description,
  className = '',
  ...props
}: CardProps) {
  return (
    <motion.div
      className={`rounded-2xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      whileHover={hover ? { y: -2, boxShadow: '0 8px 32px color-mix(in srgb, #000 12%, transparent)' } : undefined}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      {...props}
    >
      {children}
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {description}
        </p>
      )}
    </motion.div>
  );
}
