import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';

import { recordGameXp } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';
import { Button, Card, TimerBar } from './ui';

type SpotterState = 'intro' | 'playing' | 'done';

interface SpotterRound {
  baseTiles: number[];
  changedIndices: number[];
}

interface SpotterStats {
  accuracy: number;
  score: number;
  nextLevel: number;
}

interface SpotterGameProps {
  onBack: () => void;
}

const ROUND_SECONDS = 90;
const ROUNDS_PER_SESSION = 6;
const PALETTE = [
  'var(--color-accent-focus)',
  'var(--color-accent-calm)',
  'var(--color-accent-spark)',
  'var(--color-accent-warm)',
  'var(--color-accent-lilac)',
  'var(--color-text-muted)',
];

function gridSizeForLevel(level: number) {
  return level >= 8 ? 4 : 3;
}

function diffCountForLevel(level: number) {
  if (level >= 12) return 3;
  if (level >= 6) return 2;
  return 1;
}

function randomTile() {
  return Math.floor(Math.random() * PALETTE.length);
}

function buildRound(level: number): SpotterRound {
  const size = gridSizeForLevel(level);
  const cellCount = size * size;
  const diffCount = diffCountForLevel(level);
  const baseTiles = Array.from({ length: cellCount }, () => randomTile());
  const changedIndices: number[] = [];

  while (changedIndices.length < diffCount) {
    const index = Math.floor(Math.random() * cellCount);
    if (!changedIndices.includes(index)) {
      changedIndices.push(index);
    }
  }

  return { baseTiles, changedIndices };
}

function tileVariant(baseTile: number) {
  return (baseTile + 2) % PALETTE.length;
}

function computeStats(foundCount: number, tapCount: number, roundsCompleted: number, level: number): SpotterStats {
  const accuracy = Math.round((foundCount / Math.max(1, tapCount)) * 100);
  const score = foundCount * 14 + roundsCompleted * 8 - Math.max(0, tapCount - foundCount) * 3;

  return {
    accuracy,
    score,
    nextLevel: accuracy > 85 ? Math.min(20, level + 1) : accuracy < 70 ? Math.max(1, level - 1) : level,
  };
}

export default function SpotterGame({ onBack }: SpotterGameProps) {
  const [state, setState] = useState<SpotterState>('intro');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<SpotterRound>(() => buildRound(1));
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [foundCount, setFoundCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalStats, setFinalStats] = useState<SpotterStats | null>(null);

  const gridSize = gridSizeForLevel(level);
  const progress = roundIndex / ROUNDS_PER_SESSION;
  const remainingChanges = round.changedIndices.length - selectedIndices.length;
  const stats = finalStats ?? computeStats(foundCount, tapCount, roundIndex, level);

  const finishSession = useCallback((
    finalFoundCount = foundCount,
    finalTapCount = tapCount,
    finalRounds = roundIndex,
  ) => {
    const sessionStats = computeStats(finalFoundCount, finalTapCount, finalRounds, level);
    setFinalStats(sessionStats);
    setState('done');

    if (!rewardGranted) {
      const xpEarned = Math.max(8, Math.ceil(sessionStats.score / 16));
      setRewardGranted(true);
      recordGameXp('spotter', xpEarned);
      void grantReward('games', xpEarned, 'completed Spotter round');
    }
  }, [foundCount, level, rewardGranted, roundIndex, tapCount]);

  const advanceRound = useCallback((nextRoundIndex: number) => {
    if (nextRoundIndex >= ROUNDS_PER_SESSION) {
      finishSession(foundCount, tapCount, nextRoundIndex);
      return;
    }

    setRoundIndex(nextRoundIndex);
    setRound(buildRound(level));
    setSelectedIndices([]);
    setFeedback(null);
  }, [finishSession, foundCount, level, tapCount]);

  useEffect(() => {
    if (state !== 'playing' || timeLeft <= 0) return undefined;

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

  const start = (targetLevel = level) => {
    setLevel(targetLevel);
    setTimeLeft(ROUND_SECONDS);
    setRoundIndex(0);
    setRound(buildRound(targetLevel));
    setSelectedIndices([]);
    setFoundCount(0);
    setTapCount(0);
    setFeedback(null);
    setRewardGranted(false);
    setFinalStats(null);
    setState('playing');
  };

  const handleTap = (index: number) => {
    if (state !== 'playing' || selectedIndices.includes(index)) return;

    const nextTapCount = tapCount + 1;
    setTapCount(nextTapCount);

    if (!round.changedIndices.includes(index)) {
      setFeedback('Not that one');
      if (navigator.vibrate) navigator.vibrate([25, 30, 25]);
      return;
    }

    const nextSelected = [...selectedIndices, index];
    const nextFoundCount = foundCount + 1;
    setSelectedIndices(nextSelected);
    setFoundCount(nextFoundCount);
    setFeedback('Found one');
    if (navigator.vibrate) navigator.vibrate(25);

    if (nextSelected.length >= round.changedIndices.length) {
      const nextRoundIndex = roundIndex + 1;
      window.setTimeout(() => {
        advanceRound(nextRoundIndex);
      }, 350);
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
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-calm)_15%,transparent)]">
              <Search size={42} className="text-[var(--color-accent-calm)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Spotter</h1>
              <p className="mt-2 text-lg text-[var(--color-text-muted)]">
                Find the tiles that changed before the clock moves on.
              </p>
            </div>
            <Card padding="md" className="text-left">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                Spotter trains sustained attention by making your eyes hold a layout steady
                long enough to catch what shifted.
              </p>
            </Card>
            <Button size="lg" fullWidth variant="calm" onClick={() => start()}>
              Start Spotter
            </Button>
          </motion.div>
        )}

        {state === 'playing' && (
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
            <TimerBar progress={progress} variant="calm" animated={false} />

            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">
                {remainingChanges} change{remainingChanges === 1 ? '' : 's'} left
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Tap only the changed tiles on the right grid.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <GridPanel
                title="Before"
                gridSize={gridSize}
                tiles={round.baseTiles}
                changedIndices={[]}
                selectedIndices={[]}
                interactive={false}
                onTap={() => undefined}
              />
              <GridPanel
                title="After"
                gridSize={gridSize}
                tiles={round.baseTiles.map((tile, index) => (
                  round.changedIndices.includes(index) ? tileVariant(tile) : tile
                ))}
                changedIndices={round.changedIndices}
                selectedIndices={selectedIndices}
                interactive
                onTap={handleTap}
              />
            </div>

            <div className="h-6 text-center text-sm font-medium">
              {feedback === 'Found one' && <span className="text-[var(--color-accent-calm)]">Found one</span>}
              {feedback === 'Not that one' && <span className="text-[var(--color-accent-warm)]">Not that one</span>}
            </div>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Why this matters: catching small changes builds the kind of steady attention that
              keeps details from slipping by.
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
              <Sparkles size={44} className="text-[var(--color-accent-spark)]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Round complete</h2>
              <p className="mt-2 text-[var(--color-text-muted)]">You held on to the details.</p>
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
              <Button size="lg" fullWidth variant="calm" onClick={() => start(stats.nextLevel)}>
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

function GridPanel({
  title,
  gridSize,
  tiles,
  changedIndices,
  selectedIndices,
  interactive,
  onTap,
}: {
  title: string;
  gridSize: number;
  tiles: number[];
  changedIndices: number[];
  selectedIndices: number[];
  interactive: boolean;
  onTap: (index: number) => void;
}) {
  return (
    <Card padding="md" className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile, index) => {
          const selected = selectedIndices.includes(index);
          const changed = changedIndices.includes(index);

          return (
            <button
              key={`${title}-${index}`}
              type="button"
              disabled={!interactive || selected}
              onClick={() => onTap(index)}
              className={`aspect-square rounded-2xl border transition-transform ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                backgroundColor: PALETTE[tile],
                borderColor: selected
                  ? 'var(--color-accent-calm)'
                  : 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)',
                boxShadow: selected && changed ? '0 0 0 2px color-mix(in srgb, var(--color-accent-calm) 45%, transparent)' : undefined,
                opacity: interactive && selected ? 0.82 : 1,
              }}
            >
              <span className="sr-only">
                {interactive ? `Tap changed tile ${index + 1}` : `Reference tile ${index + 1}`}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
