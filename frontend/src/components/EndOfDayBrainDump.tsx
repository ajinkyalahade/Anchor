import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, MoonStar, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';

import {
  type BrainDumpEntry,
  loadBrainDumpEntries,
  saveBrainDumpEntries,
} from '../lib/planner';
import VoiceInput from './VoiceInput';
import { Badge, Button, Card, TimerBar } from './ui';

const DUMP_SCRIPT = [
  {
    title: 'Clear the static',
    duration: 30,
    cue: 'List every loose end still bouncing around.',
    body: 'Errands, tabs, admin, awkward messages, unfinished chores, random worries. Do not sort yet.',
  },
  {
    title: 'Name tomorrow pressure',
    duration: 30,
    cue: 'Write what tomorrow is already asking from you.',
    body: 'Meetings, deadlines, energy dips, prep work, people to reply to, things you are already bracing for.',
  },
  {
    title: 'Leave one anchor',
    duration: 30,
    cue: 'End with one small starting point for tomorrow.',
    body: 'One first move is enough. Name the anchor that gets the day unstuck fastest.',
  },
] as const;

const TOTAL_SECONDS = DUMP_SCRIPT.reduce((total, step) => total + step.duration, 0);

function getStepIndex(elapsedSeconds: number) {
  let cursor = 0;

  for (let index = 0; index < DUMP_SCRIPT.length; index += 1) {
    cursor += DUMP_SCRIPT[index].duration;
    if (elapsedSeconds < cursor) return index;
  }

  return DUMP_SCRIPT.length - 1;
}

function getStepElapsed(elapsedSeconds: number, stepIndex: number) {
  return DUMP_SCRIPT
    .slice(0, stepIndex)
    .reduce((total, step) => total + step.duration, elapsedSeconds * -1) * -1;
}

function formatStamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EndOfDayBrainDump() {
  const [entries, setEntries] = useState<BrainDumpEntry[]>(() => loadBrainDumpEntries());
  const [text, setText] = useState('');
  const [source, setSource] = useState<'text' | 'voice'>('text');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const isComplete = elapsedSeconds >= TOTAL_SECONDS;
  const activeStepIndex = getStepIndex(elapsedSeconds);
  const activeStep = DUMP_SCRIPT[activeStepIndex];
  const stepElapsed = getStepElapsed(elapsedSeconds, activeStepIndex);
  const totalProgress = Math.min(1, elapsedSeconds / TOTAL_SECONDS);
  const stepProgress = Math.min(1, stepElapsed / activeStep.duration);
  const secondsLeft = Math.max(0, TOTAL_SECONDS - elapsedSeconds);
  const latestEntry = entries[0];

  const queuedThemesCount = useMemo(
    () => entries.filter((entry) => entry.status === 'queued').length,
    [entries],
  );

  useEffect(() => {
    saveBrainDumpEntries(entries);
  }, [entries]);

  useEffect(() => {
    if (!isRunning || isComplete) return undefined;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((seconds) => {
        if (seconds >= TOTAL_SECONDS - 1) {
          setIsRunning(false);
          return TOTAL_SECONDS;
        }
        return seconds + 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isComplete, isRunning]);

  const reset = () => {
    setElapsedSeconds(0);
    setIsRunning(false);
    setText('');
    setSource('text');
    setSavedEntryId(null);
  };

  const handleTranscript = (transcript: string) => {
    setText((current) => (current ? `${current.trim()} ${transcript}` : transcript));
    setSource('voice');
  };

  const saveDump = () => {
    const nextText = text.trim();
    if (!nextText) return;

    const entry = {
      id: crypto.randomUUID(),
      text: nextText,
      createdAt: new Date().toISOString(),
      source,
      status: 'queued',
    } satisfies BrainDumpEntry;

    setEntries((current) => [entry, ...current].slice(0, 6));
    setSavedEntryId(entry.id);
    setIsRunning(false);
    setElapsedSeconds(TOTAL_SECONDS);
    setText('');
    setSource('text');
  };

  return (
    <Card padding="md" className="space-y-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            End-of-day brain dump
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Ninety seconds to empty the mental stack before tomorrow inherits it.
          </p>
        </div>
        <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-lilac)_14%,transparent)] p-3 text-[var(--color-accent-lilac)]">
          <MoonStar size={18} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Timer
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Morning themes
          </p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
            {queuedThemesCount} queued
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-surface-2)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Last dump
          </p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
            {latestEntry ? formatStamp(latestEntry.createdAt) : 'Not yet'}
          </p>
        </div>
      </div>

      <TimerBar progress={totalProgress} variant="lilac" height={8} animated={isRunning} />

      <div className="rounded-3xl bg-[color-mix(in_srgb,var(--color-accent-lilac)_8%,transparent)] p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={savedEntryId ?? activeStep.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent-lilac)]">
                  {savedEntryId ? 'Queued for morning themes' : activeStep.title}
                </p>
                <h3 className="mt-2 text-xl font-semibold leading-tight text-[var(--color-text-primary)]">
                  {savedEntryId ? 'Dump saved. Let tomorrow meet a cleaner desk.' : activeStep.cue}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {savedEntryId
                    ? 'Entries stay local for now and will be available for overnight clustering once the backend phase lands.'
                    : activeStep.body}
                </p>
              </div>
              {!savedEntryId && (
                <Badge variant="lilac">
                  Step {activeStepIndex + 1} / {DUMP_SCRIPT.length}
                </Badge>
              )}
            </div>

            {!savedEntryId && (
              <>
                <TimerBar progress={stepProgress} variant="lilac" height={4} animated={isRunning} />

                <div className="relative">
                  <textarea
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      setSource('text');
                    }}
                    placeholder="Loose ends, tomorrow pressure, one anchor..."
                    className="h-36 w-full resize-none rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] bg-[var(--color-bg-surface)] px-4 py-3 pr-12 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent-lilac)] focus:outline-none"
                  />
                  <VoiceInput onTranscript={handleTranscript} className="absolute bottom-3 right-3" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={source === 'voice' ? 'spark' : 'focus'}>
                      {source === 'voice' ? 'Voice' : 'Text'}
                    </Badge>
                    <Badge variant="muted">Local-first</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={reset}
                      disabled={elapsedSeconds === 0 && !text}
                    >
                      <RotateCcw size={16} /> Reset
                    </Button>
                    <Button
                      variant="lilac"
                      size="sm"
                      onClick={() => setIsRunning((running) => !running)}
                      disabled={isComplete}
                    >
                      {isRunning ? <Pause size={16} /> : <Play size={16} />}
                      {isRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start'}
                    </Button>
                    <Button
                      variant="focus"
                      size="sm"
                      onClick={saveDump}
                      disabled={!text.trim() || !isComplete}
                    >
                      <Sparkles size={16} /> Save dump
                    </Button>
                  </div>
                </div>
              </>
            )}

            {savedEntryId && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-lilac)_14%,transparent)] px-3 py-2 text-sm text-[var(--color-accent-lilac)]">
                  <CheckCircle2 size={16} /> Queued for next-morning theme pass
                </div>
                <Button variant="secondary" size="sm" onClick={reset}>
                  <RotateCcw size={16} /> New dump
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Recent dumps
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="muted">{entries.length} stored</Badge>
              <button
                type="button"
                onClick={() => setEntries([])}
                className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                Clear history
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {entries.slice(0, 2).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] bg-[var(--color-bg-surface-2)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="lilac">Queued</Badge>
                  <Badge variant={entry.source === 'voice' ? 'spark' : 'focus'}>
                    {entry.source === 'voice' ? 'Voice' : 'Text'}
                  </Badge>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatStamp(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
