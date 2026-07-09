import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface FeatureHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: ReactNode;
  className?: string;
}

export default function FeatureHeader({ 
  title, 
  subtitle, 
  description, 
  badge,
  className = '' 
}: FeatureHeaderProps) {
  return (
    <div className={`mb-5 space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg font-medium text-[var(--color-text-muted)] mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <div className="shrink-0">
            {badge}
          </div>
        )}
      </div>
      
      {description && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm leading-relaxed text-[var(--color-text-muted)] opacity-80 pt-2 border-t border-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)]"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
