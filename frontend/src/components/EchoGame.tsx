import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Brain, Check, X, Zap } from 'lucide-react';

import { Button, Card, TimerBar } from './ui';
import { recordGameXp } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';

type EchoState = 'intro' | 'playing' | 'done';

interface EchoTrial {
  letter: string;
  isMatch: boolean;
}

interface EchoStats {
  accuracy: number;
  rtMean: number;
  rtVar: number;
  nextLevel: number;
}

interface EchoGameProps {
  onBack: () => void;
}

const LETTERS = ['A', 'F', 'K', 'M', 'R', 'S', 'T', 'V'];
const TRIAL_COUNT = 20;
const ROUND_SECONDS = 90;

function pickLetter(excluding?: string) {
  const choices = excluding ? LETTERS.filter((letter) => letter !== excluding) : LETTERS;
  return choices[Math.floor(Math.random() * choices.length)];
}

function buildTrials(level: number): EchoTrial[] {
  const trials: EchoTrial[] = [];

  for (let index = 0; index < TRIAL_COUNT; index += 1) {
    const canMatch = index >= level;
    const shouldMatch = canMatch && Math.random() < 0.35;
    const targetLetter = canMatch ? trials[index - level].letter : undefined;
    const letter = shouldMatch && targetLetter ? targetLetter : pickLetter(targetLetter);

    trials.push({
      letter,
      isMatch: shouldMatch,
    });
  }

  return trials;
}

function variance(values: number[], mean: number) {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length,
  );
}

function computeStats(correctCount: number, answeredCount: number, reactionTimes: number[], level: number): EchoStats {
  const accuracy = Math.round((correctCount / Math.max(1, answeredCount)) * 100);
  const rtMean = reactionTimes.length
    ? Math.round(reactionTimes.reduce((total, value) => total + value, 0) / reactionTimes.length)
    : 0;

  return {
    accuracy,
    rtMean,
    rtVar: variance(reactionTimes, rtMean),
    nextLevel: accuracy > 85 ? Math.min(20, level + 1) : accuracy < 70 ? Math.max(1, level - 1) : level,
  };
}

export default function EchoGame({ onBack }: EchoGameProps) {
  const [state, setState] = useState<EchoState>('intro');
  const [level, setLevel] = useState(1);
  const [trials, setTrials] = useState<EchoTrial[]>(() => buildTrials(1));
  const [trialIndex, setTrialIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [correctCount, setCorrectCount] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalStats, setFinalStats] = useState<EchoStats | null>(null);

  const trialStartedAt = useRef<number>(0);
  const currentTrial = trials[trialIndex];
  const progress = trialIndex / TRIAL_COUNT;
  const liveStats = computeStats(correctCount, trialIndex, reactionTimes, level);
  const stats = finalStats ?? liveStats;

  const finishRound = useCallback((finalCorrectCount = correctCount, answeredCount = trialIndex, finalRts = reactionTimes) => {
    const roundStats = computeStats(finalCorrectCount, answeredCount, finalRts, level);
    setFinalStats(roundStats);
    setState('done');

    if (!rewardGranted) {
      const xpEarned = Math.max(8, Math.round(roundStats.accuracy / 8));
      setRewardGranted(true);
      recordGameXp('echo', xpEarned);
      void grantReward('games', xpEarned, 'completed Echo round');
    }
  }, [correctCount, level, reactionTimes, rewardGranted, trialIndex]);

  useEffect(() => {
    if (state !== 'playing' || timeLeft <= 0) return undefined;

    const timeout = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        finishRound();
        return;
      }

      setTimeLeft((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [finishRound, state, timeLeft]);

  const start = (targetLevel = level) => {
    setLevel(targetLevel);
    setTrials(buildTrials(targetLevel));
    setTrialIndex(0);
    setTimeLeft(ROUND_SECONDS);
    setCorrectCount(0);
    setReactionTimes([]);
    setLastAnswerCorrect(null);
    setRewardGranted(false);
    setFinalStats(null);
    trialStartedAt.current = Date.now();
    setState('playing');
  };

  const answer = (userSaysMatch: boolean) => {
    if (!currentTrial) return;

    const isCorrect = userSaysMatch === currentTrial.isMatch;
    const rt = Date.now() - trialStartedAt.current;
    const nextIndex = trialIndex + 1;
    const nextCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    const nextReactionTimes = [...reactionTimes, rt];

    setLastAnswerCorrect(isCorrect);
    setReactionTimes(nextReactionTimes);
    setCorrectCount(nextCorrectCount);

    if (navigator.vibrate) navigator.vibrate(isCorrect ? 35 : [25, 30, 25]);

    if (nextIndex >= TRIAL_COUNT) {
      finishRound(nextCorrectCount, nextIndex, nextReactionTimes);
      return;
    }

    setTrialIndex(nextIndex);
    trialStartedAt.current = Date.now();
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
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-lilac)_15%,transparent)]">
              <Brain size={42} className="text-[var(--color-accent-lilac)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Echo</h1>
              <p className="mt-2 text-lg text-[var(--color-text-muted)]">
                Tap Match when the current letter matches the one {level} back.
              </p>
            </div>
            <Card padding="md" className="text-left">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                Echo trains working memory, the part that holds the second half of a sentence
                while the first half is still fading.
              </p>
            </Card>
            <Button
              size="lg"
              fullWidth
              variant="lilac"
              onClick={() => start()}
            >
              Start Echo
            </Button>
          </motion.div>
        )}

        {state === 'playing' && currentTrial && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col gap-6 pt-2"
          >
            <div className="grid grid-cols-3 items-center gap-3 text-sm font-semibold text-[var(--color-text-muted)]">
              <div>Level {level}-back</div>
              <div className="text-center font-mono tabular-nums">{timeLeft}s</div>
              <div className="text-right">{trialIndex + 1}/{TRIAL_COUNT}</div>
            </div>
            <TimerBar progress={progress} variant="lilac" animated={false} />

            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <motion.div
                key={`${trialIndex}-${currentTrial.letter}`}
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-40 w-40 items-center justify-center rounded-[2rem] bg-[var(--color-bg-surface)] text-7xl font-bold text-[var(--color-accent-lilac)] shadow-sm"
              >
                {currentTrial.letter}
              </motion.div>

              <div className="grid w-full grid-cols-2 gap-3">
                <Button size="lg" variant="secondary" onClick={() => answer(false)}>
                  <X size={20} /> No match
                </Button>
                <Button size="lg" variant="spark" onClick={() => answer(true)}>
                  <Check size={20} /> Match
                </Button>
              </div>

              <div className="h-6 text-sm font-medium">
                {lastAnswerCorrect === true && (
                  <span className="text-[var(--color-accent-calm)]">Correct</span>
                )}
                {lastAnswerCorrect === false && (
                  <span className="text-[var(--color-accent-warm)]">Keep going</span>
                )}
              </div>
            </div>
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
              <p className="mt-2 text-[var(--color-text-muted)]">You showed up for a working-memory rep.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">Accuracy</p>
                <p className="text-xl font-bold">{stats.accuracy}%</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">RT mean</p>
                <p className="text-xl font-bold">{stats.rtMean}ms</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs text-[var(--color-text-muted)]">Next</p>
                <p className="text-xl font-bold">{stats.nextLevel}-back</p>
              </Card>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              RT spread: {Math.round(Math.sqrt(stats.rtVar))}ms
            </p>
            <div className="space-y-3">
              <Button
                size="lg"
                fullWidth
                variant="lilac"
                onClick={() => {
                  start(stats.nextLevel);
                }}
              >
                Play again
              </Button>
              <Button size="lg" fullWidth variant="secondary" onClick={() => setState('intro')}>
                Back to Echo
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
