import { motion } from 'framer-motion';

type TimerBarVariant = 'focus' | 'calm' | 'spark' | 'warm' | 'lilac';

interface TimerBarProps {
  /** Progress from 0 to 1 (1 = full, 0 = empty) */
  progress: number;
  variant?: TimerBarVariant;
  height?: number;
  className?: string;
  /** Show the shrinking visual per PRD §5.4 — time-blindness aid */
  animated?: boolean;
}

const colorMap: Record<TimerBarVariant, string> = {
  focus: 'var(--color-accent-focus)',
  calm: 'var(--color-accent-calm)',
  spark: 'var(--color-accent-spark)',
  warm: 'var(--color-accent-warm)',
  lilac: 'var(--color-accent-lilac)',
};

export default function TimerBar({
  progress,
  variant = 'focus',
  height = 6,
  className = '',
  animated = true,
}: TimerBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <div
      className={`w-full rounded-full overflow-hidden bg-[var(--color-bg-surface-2)] ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clampedProgress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: colorMap[variant] }}
        initial={false}
        animate={{ width: `${clampedProgress * 100}%` }}
        transition={animated ? { duration: 1, ease: 'linear' } : { duration: 0 }}
      />
    </div>
  );
}
