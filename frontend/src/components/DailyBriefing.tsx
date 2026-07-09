import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { Skeleton } from './ui';

interface Briefing {
  greeting: string;
  energy_read: string;
  suggested_first_action: string;
  affirmation: string;
  cached: boolean;
}

const BRIEFING_DISMISSED_KEY = 'anchor_briefing_dismissed_date';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function shouldShowBriefing(): boolean {
  return localStorage.getItem(BRIEFING_DISMISSED_KEY) !== todayStr();
}

interface Props {
  onDismiss: () => void;
}

export default function DailyBriefing({ onDismiss }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Briefing>('/ai/briefing')
      .then(setBriefing)
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false));
  }, []);

  const dismiss = () => {
    localStorage.setItem(BRIEFING_DISMISSED_KEY, todayStr());
    onDismiss();
  };

  if (!loading && !briefing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-focus)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-focus)_5%,var(--color-bg-surface))] p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-accent-focus)_15%,transparent)] text-[var(--color-accent-focus)]">
          <Sparkles size={14} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-focus)]">
          Your briefing
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : briefing ? (
        <div className="space-y-2">
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            {briefing.greeting}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">{briefing.energy_read}</p>
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-accent-focus)_8%,transparent)] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent-focus)] mb-1">
              Start here
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {briefing.suggested_first_action}
            </p>
          </div>
          <p className="text-xs italic text-[var(--color-text-muted)]">{briefing.affirmation}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        Dismiss for today
      </button>
    </motion.div>
  );
}
