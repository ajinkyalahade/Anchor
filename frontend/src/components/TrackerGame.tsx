import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Orbit, Zap } from 'lucide-react';

import { recordGameXp } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';
import { Button, Card, TimerBar } from './ui';

type TrackerState = 'intro' | 'tracking' | 'answering' | 'done';

interface TrackerRound {
  targetIndices: number[];
  revealIndices: number[];
}

interface TrackerStats {
  accuracy: number;
  score: number;
  nextLevel: number;
}

interface TrackerGameProps {
  onBack: () => void;
}

const ROUND_SECONDS = 90;
const ROUNDS_PER_SESSION = 5;
const GRID_SIZE = 9;

function targetCountForLevel(level: number) {
  if (level >= 12) return 4;
  if (level >= 6) return 3;
  return 2;
}

function revealCountForLevel(level: number) {
  return Math.min(GRID_SIZE, 4 + Math.floor(level / 3));
}

function uniqueIndices(count: number) {
  const selected: number[] = [];
  while (selected.length < count) {
    const index = Math.floor(Math.random() * GRID_SIZE);
    if (!selected.includes(index)) {
      selected.push(index);
    }
  }
  return selected;
}

function buildRound(level: number): TrackerRound {
  const targetIndices = uniqueIndices(targetCountForLevel(level));
  const distractorsNeeded = Math.max(0, revealCountForLevel(level) - targetIndices.length);
  const distractors = uniqueIndices(GRID_SIZE)
    .filter((index) => !targetIndices.includes(index))
    .slice(0, distractorsNeeded);

  return {
    targetIndices,
    revealIndices: [...targetIndices, ...distractors].sort((a, b) => a - b),
  };
}

function computeStats(correctRounds: number, totalHits: number, totalSelections: number, level: number): TrackerStats {
  const accuracy = Math.round((totalHits / Math.max(1, totalSelections)) * 100);
  const score = correctRounds * 22 + totalHits * 8 - Math.max(0, totalSelections - totalHits) * 4;

  return {
    accuracy,
    score,
    nextLevel: accuracy > 85 ? Math.min(20, level + 1) : accuracy < 70 ? Math.max(1, level - 1) : level,
  };
}

export default function TrackerGame({ onBack }: TrackerGameProps) {
  const [state, setState] = useState<TrackerState>('intro');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<TrackerRound>(() => buildRound(1));
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [totalSelections, setTotalSelections] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalStats, setFinalStats] = useState<TrackerStats | null>(null);

  const progress = roundIndex / ROUNDS_PER_SESSION;
  const targetsToSelect = round.targetIndices.length;
  const stats = useMemo(
    () => finalStats ?? computeStats(correctRounds, totalHits, totalSelections, level),
    [correctRounds, finalStats, level, totalHits, totalSelections],
  );

  const finishSession = useCallback((
    finalCorrectRounds = correctRounds,
    finalHits = totalHits,
    finalSelections = totalSelections,
  ) => {
    const sessionStats = computeStats(finalCorrectRounds, finalHits, finalSelections, level);
    setFinalStats(sessionStats);
    setState('done');

    if (!rewardGranted) {
      const xpEarned = Math.max(8, Math.ceil(sessionStats.score / 18));
      setRewardGranted(true);
      recordGameXp('tracker', xpEarned);
      void grantReward('games', xpEarned, 'completed Tracker round');
    }
  }, [correctRounds, level, rewardGranted, totalHits, totalSelections]);

  const beginRound = useCallback((nextRoundIndex: number, targetLevel = level) => {
    setRoundIndex(nextRoundIndex);
    setRound(buildRound(targetLevel));
    setSelectedIndices([]);
    setFeedback(null);
    setState('tracking');
  }, [level]);

  useEffect(() => {
    if ((state !== 'tracking' && state !== 'answering') || timeLeft <= 0) return undefined;

    const timeout = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        finishSession();
        return;
      }

      setTimeLeft((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [finishSession, state, timeLeft]);

  useEffect(() => {
    if (state !== 'tracking') return undefined;

    const timeout = window.setTimeout(() => {
      setState('answering');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [state, roundIndex]);

  const start = (targetLevel = level) => {
    setLevel(targetLevel);
    setTimeLeft(ROUND_SECONDS);
    setCorrectRounds(0);
    setTotalHits(0);
    setTotalSelections(0);
    setFeedback(null);
    setRewardGranted(false);
    setFinalStats(null);
    beginRound(0, targetLevel);
  };

  const submitRound = (nextSelectedIndices: number[]) => {
    const hits = nextSelectedIndices.filter((index) => round.targetIndices.includes(index)).length;
    const roundPerfect = hits === round.targetIndices.length && nextSelectedIndices.length === round.targetIndices.length;
    const nextCorrectRounds = roundPerfect ? correctRounds + 1 : correctRounds;
    const nextHits = totalHits + hits;
    const nextSelections = totalSelections + nextSelectedIndices.length;
    const nextRoundIndex = roundIndex + 1;

    setCorrectRounds(nextCorrectRounds);
    setTotalHits(nextHits);
    setTotalSelections(nextSelections);
    setFeedback(roundPerfect ? 'Tracked cleanly' : 'Close');
    if (navigator.vibrate) navigator.vibrate(roundPerfect ? 25 : [20, 30, 20]);

    if (nextRoundIndex >= ROUNDS_PER_SESSION) {
      window.setTimeout(() => {
        finishSession(nextCorrectRounds, nextHits, nextSelections);
      }, 350);
      return;
    }

    window.setTimeout(() => {
      beginRound(nextRoundIndex);
    }, 350);
  };

  const toggleSelection = (index: number) => {
    if (state !== 'answering') return;

    const alreadySelected = selectedIndices.includes(index);
    const nextSelectedIndices = alreadySelected
      ? selectedIndices.filter((value) => value !== index)
      : [...selectedIndices, index];

    setSelectedIndices(nextSelectedIndices);

    if (nextSelectedIndices.length >= targetsToSelect) {
      submitRound(nextSelectedIndices);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]"
      >
        <ArrowLeft size={16} /> Games
      </button>

      <AnimatePresence mode="wait">
        {state === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-1 flex-col justify-center space-y-6 text-center"
          >
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-focus)_15%,transparent)]">
              <Orbit size={42} className="text-[var(--color-accent-focus)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Tracker</h1>
              <p className="mt-2 text-lg text-[var(--color-text-muted)]">
                Hold target positions in mind while distractors compete for attention.
              </p>
            </div>
            <Card padding="md" className="text-left">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                Tracker trains the part of attention that keeps several moving or shifting targets
                active at once without letting distractors take over.
              </p>
            </Card>
            <Button size="lg" fullWidth variant="focus" onClick={() => start()}>
              Start Tracker
            </Button>
          </motion.div>
        )}

        {(state === 'tracking' || state === 'answering') && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col gap-6 pt-2"
          >
            <div className="grid grid-cols-3 items-center gap-3 text-sm font-semibold text-[var(--color-text-muted)]">
              <div>Level {level}</div>
              <div className="text-center font-mono tabular-nums">{timeLeft}s</div>
              <div className="text-right">{roundIndex + 1}/{ROUNDS_PER_SESSION}</div>
            </div>
            <TimerBar progress={progress} variant="focus" animated={false} />

            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">
                {state === 'tracking' ? `Memorize ${targetsToSelect} targets` : `Select ${targetsToSelect} targets`}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {state === 'tracking' ? 'Bright tiles are the targets.' : 'Tap the tiles you think were targets.'}
              </p>
            </div>

            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
              {Array.from({ length: GRID_SIZE }, (_, index) => {
                const reveal = round.revealIndices.includes(index);
                const target = round.targetIndices.includes(index);
                const selected = selectedIndices.includes(index);
                const isTracking = state === 'tracking';

                return (
                  <motion.button
                    key={`${roundIndex}-${index}`}
                    type="button"
                    onClick={() => toggleSelection(index)}
                    disabled={state !== 'answering'}
                    className="aspect-square rounded-3xl border transition-colors"
                    style={{
                      backgroundColor: isTracking && reveal
                        ? target
                          ? 'color-mix(in srgb, var(--color-accent-focus) 28%, var(--color-bg-surface))'
                          : 'color-mix(in srgb, var(--color-text-muted) 14%, var(--color-bg-surface))'
                        : selected
                          ? 'color-mix(in srgb, var(--color-accent-focus) 18%, var(--color-bg-surface))'
                          : 'var(--color-bg-surface)',
                      borderColor: selected
                        ? 'var(--color-accent-focus)'
                        : 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)',
                    }}
                    animate={{ scale: isTracking && target ? 1.04 : 1 }}
                    whileTap={state === 'answering' ? { scale: 0.97 } : undefined}
                  >
                    {isTracking && target && (
                      <span className="text-2xl font-bold text-[var(--color-accent-focus)]">●</span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="h-6 text-center text-sm font-medium">
              {feedback === 'Tracked cleanly' && <span className="text-[var(--color-accent-calm)]">Tracked cleanly</span>}
              {feedback === 'Close' && <span className="text-[var(--color-accent-warm)]">Close</span>}
            </div>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Why this matters: holding multiple targets steady helps when several steps or moving pieces
              have to stay active at once.
            </p>
          </motion.div>
        )}

        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col justify-center space-y-6 text-center"
          >
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-accent-spark)_15%,transparent)]">
              <Zap size={44} className="text-[var(--color-accent-spark)]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Round complete</h2>
              <p className="mt-2 text-[var(--color-text-muted)]">You held the targets in view.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">Accuracy</p>
                <p className="text-xl font-bold">{stats.accuracy}%</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">Score</p>
                <p className="text-xl font-bold">{stats.score}</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">Next</p>
                <p className="text-xl font-bold">Lv {stats.nextLevel}</p>
              </Card>
            </div>
            <div className="space-y-3">
              <Button size="lg" fullWidth variant="focus" onClick={() => start(stats.nextLevel)}>
                Play again
              </Button>
              <Button size="lg" fullWidth variant="secondary" onClick={onBack}>
                Back to games
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
