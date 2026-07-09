import { Sparkles } from 'lucide-react';
import Badge from './Badge';

interface AIBadgeProps {
  variant?: 'default' | 'coming-soon';
  className?: string;
}

export default function AIBadge({ variant = 'default', className = '' }: AIBadgeProps) {
  if (variant === 'coming-soon') {
    return (
      <Badge variant="muted" className={`gap-1 px-3 ${className}`}>
        AI — Coming Soon
      </Badge>
    );
  }

  return (
    <Badge variant="focus" className={`gap-1 px-3 shadow-[0_0_12px_rgba(var(--color-accent-focus-rgb),0.2)] ${className}`}>
      <Sparkles size={10} className="fill-current" />
      AI
    </Badge>
  );
}
