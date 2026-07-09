import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquarePlus, Trash2, Wifi, WifiOff, X } from 'lucide-react';

import { type CaptureInboxItem, loadCaptureInboxItems, saveCaptureInboxItems } from '../lib/planner';
import VoiceInput from './VoiceInput';
import { Badge, Button, Card, IconButton } from './ui';

function formatCapturedAt(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function QuickCaptureInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftSource, setDraftSource] = useState<'text' | 'voice'>('text');
  const [items, setItems] = useState<CaptureInboxItem[]>(() => loadCaptureInboxItems());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    saveCaptureInboxItems(items);
  }, [items]);

  useEffect(() => {
    const syncStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);
    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;

    setItems((current) => [
      {
        id: crypto.randomUUID(),
        text,
        createdAt: new Date().toISOString(),
        source: draftSource,
      },
      ...current,
    ]);
    setDraft('');
    setDraftSource('text');
    setIsOpen(false);
  };

  const handleTranscript = (transcript: string) => {
    setDraft((current) => (current ? `${current.trim()} ${transcript}` : transcript));
    setDraftSource('voice');
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const clearInbox = () => {
    setItems([]);
  };

  return (
    <>
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Quick-capture inbox
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Park stray tasks before they fracture the plan. Stored locally first, sync later.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsOpen(true)}
            className="shrink-0 whitespace-nowrap"
          >
            <MessageSquarePlus size={16} /> Park it
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOnline ? 'calm' : 'warm'}>
            {isOnline ? (
              <>
                <Wifi size={12} className="mr-1" /> Local-first
              </>
            ) : (
              <>
                <WifiOff size={12} className="mr-1" /> Offline ready
              </>
            )}
          </Badge>
          <Badge variant="focus">{items.length} parked</Badge>
          <Badge variant="muted">Voice or text</Badge>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--color-text-muted)_18%,transparent)] p-5 text-sm text-[var(--color-text-muted)]">
            Nothing parked yet. Capture it here instead of reshuffling the planner midstream.
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--color-bg-surface-2)] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.source === 'voice' ? 'spark' : 'focus'}>
                      {item.source === 'voice' ? 'Voice' : 'Text'}
                    </Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatCapturedAt(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
                    {item.text}
                  </p>
                </div>
                <IconButton
                  icon={<Trash2 size={16} />}
                  label="Delete parked item"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                />
              </div>
            ))}

            {items.length > 1 && (
              <button
                type="button"
                onClick={clearInbox}
                className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                Clear inbox
              </button>
            )}
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg-canvas)_80%,transparent)] p-5 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              className="w-full max-w-md"
            >
              <Card padding="lg" variant="glass" className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
                      Park a thought
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Capture it, get it out of working memory, keep moving.
                    </p>
                  </div>
                  <IconButton
                    icon={<X size={18} />}
                    label="Close quick-capture inbox"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  />
                </div>

                <div className="relative">
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setDraftSource('text');
                    }}
                    placeholder="Loose task, reminder, errand, follow-up..."
                    className="h-32 w-full resize-none rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-canvas)] px-4 py-3 pr-12 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent-focus)] focus:outline-none"
                  />
                  <VoiceInput
                    onTranscript={handleTranscript}
                    className="absolute bottom-3 right-3"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Badge variant={isOnline ? 'calm' : 'warm'}>
                    {isOnline ? 'Saved locally now' : 'Offline save only'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="focus"
                    onClick={handleSave}
                    disabled={!draft.trim()}
                  >
                    <MessageSquarePlus size={16} /> Park it
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
