import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '../lib/api';

const MOODS = [
  { score: 1, emoji: '😵', label: 'Overwhelmed' },
  { score: 2, emoji: '😟', label: 'Struggling' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '😊', label: 'Good' },
  { score: 5, emoji: '🚀', label: 'Energised' },
];

const CHECKIN_KEY = 'anchor_last_checkin';
const CHECKIN_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

// eslint-disable-next-line react-refresh/only-export-components
export function shouldShowCheckin(): boolean {
  const last = localStorage.getItem(CHECKIN_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > CHECKIN_GAP_MS;
}

interface Props {
  onDismiss: () => void;
}

export default function MoodCheckin({ onDismiss }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    try {
      await api.post('/ai/checkin', { score: selected, note: note.trim() || undefined });
      localStorage.setItem(CHECKIN_KEY, String(Date.now()));
      setDone(true);
      setTimeout(onDismiss, 1200);
    } catch {
      // silent — don't block the user
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-lilac)_20%,transparent)] bg-[var(--color-bg-surface)] p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-lilac)]">
          Quick check-in
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)]"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.p
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm font-medium text-[var(--color-text-primary)] py-2"
          >
            Noted 🙏
          </motion.p>
        ) : (
          <motion.div key="form" className="space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              How are you feeling right now?
            </p>

            <div className="flex justify-between gap-1">
              {MOODS.map(({ score, emoji, label }) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => { setSelected(score); setShowNote(true); }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all ${
                    selected === score
                      ? 'bg-[color-mix(in_srgb,var(--color-accent-lilac)_15%,transparent)] ring-1 ring-[var(--color-accent-lilac)]'
                      : 'hover:bg-[var(--color-bg-surface-2)]'
                  }`}
                  title={label}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)]">{label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence>
              {showNote && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    placeholder="What's weighing on you? (optional)"
                    className="w-full resize-none rounded-xl border border-[color-mix(in_srgb,var(--color-text-muted)_14%,transparent)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-lilac)]"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="w-full rounded-xl bg-[var(--color-accent-lilac)] py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  >
                    {submitting ? 'Saving…' : 'Save check-in'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
