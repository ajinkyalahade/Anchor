import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends HTMLMotionProps<'button'> {
  icon: ReactNode;
  label: string; // accessibility
  size?: IconButtonSize;
  active?: boolean;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

export default function IconButton({
  icon,
  label,
  size = 'md',
  active = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <motion.button
      aria-label={label}
      className={`
        inline-flex items-center justify-center rounded-xl
        transition-colors duration-[var(--duration-standard)] ease-[var(--ease-standard)]
        ${active
          ? 'bg-[var(--color-accent-focus)] text-white'
          : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)]'
        }
        ${sizeStyles[size]}
        cursor-pointer
        ${className}
      `}
      whileTap={{ scale: 0.9 }}
      {...props}
    >
      {icon}
    </motion.button>
  );
}
