interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] ${className}`}
    />
  );
}
