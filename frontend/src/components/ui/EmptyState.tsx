import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PackageOpen } from 'lucide-react';
import { Button } from './index';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCtaClick,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`flex flex-col items-center text-center py-12 px-6 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-focus)_8%,transparent)] flex items-center justify-center mb-5 text-[var(--color-accent-focus)]">
        {icon ?? <PackageOpen size={28} />}
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] max-w-xs leading-relaxed">{body}</p>
      {ctaLabel && onCtaClick && (
        <div className="mt-6">
          <Button variant="primary" size="sm" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
