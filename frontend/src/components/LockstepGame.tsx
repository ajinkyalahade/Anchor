import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Hand, ShieldBan, Zap } from 'lucide-react';

import { recordGameXp } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';
import { Button, Card, TimerBar } from './ui';

type LockstepState = 'intro' | 'playing' | 'done';
type StimulusKind = 'go' | 'no-go';

interface Stimulus {
  kind: StimulusKind;
  symbol: string;
  label: string;
}

interface LockstepStats {
  accuracy: number;
  rtMean: number;
  falseTaps: number;
  nextLevel: number;
}

interface LockstepGameProps {
  onBack: () => void;
}

const ROUND_SECONDS = 90;
const TRIALS_PER_SESSION = 20;
const GO_STIMULI: Stimulus[] = [
  { kind: 'go', symbol: 'GO', label: 'Tap now' },
  { kind: 'go', symbol: '▲', label: 'Tap now' },
  { kind: 'go', symbol: '●', label: 'Tap now' },
];
const NO_GO_STIMULI: Stimulus[] = [
  { kind: 'no-go', symbol: 'WAIT', label: 'Hold' },
  { kind: 'no-go', symbol: '■', label: 'Hold' },
];

function randomStimulus(level: number): Stimulus {
  const noGoRate = level >= 10 ? 0.4 : 0.3;
  const pool = Math.random() < noGoRate ? NO_GO_STIMULI : GO_STIMULI;
  return pool[Math.floor(Math.random() * pool.length)];
}

function variance(values: number[], mean: number) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function computeStats(correctResponses: number, attemptedTrials: number, reactionTimes: number[], falseTaps: number, level: number): LockstepStats {
  const accuracy = Math.round((correctResponses / Math.max(1, attemptedTrials)) * 100);
  const rtMean = reactionTimes.length
    ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
    : 0;
  const rtSpread = Math.sqrt(variance(reactionTimes, rtMean));
  const performancePenalty = falseTaps * 2 + (rtSpread > 240 ? 6 : 0);

  return {
    accuracy,
    rtMean,
    falseTaps,
    nextLevel:
      accuracy > 85 && performancePenalty < 8
        ? Math.min(20, level + 1)
        : accuracy < 70
          ? Math.max(1, level - 1)
          : level,
  };
}

export default function LockstepGame({ onBack }: LockstepGameProps) {
  const [state, setState] = useState<LockstepState>('intro');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [trialIndex, setTrialIndex] = useState(0);
  const [stimulus, setStimulus] = useState<Stimulus>(() => randomStimulus(1));
  const [stimulusActive, setStimulusActive] = useState(false);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [falseTaps, setFalseTaps] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalStats, setFinalStats] = useState<LockstepStats | null>(null);

  const stimulusStartedAt = useRef(0);
  const trialTimeout = useRef<number | null>(null);
  const resolvedTrial = useRef(false);
  const progress = trialIndex / TRIALS_PER_SESSION;
  const stats = useMemo(
    () => finalStats ?? computeStats(correctResponses, trialIndex, reactionTimes, falseTaps, level),
    [correctResponses, falseTaps, finalStats, level, reactionTimes, trialIndex],
  );

  const clearTrialTimeout = () => {
    if (trialTimeout.current !== null) {
      window.clearTimeout(trialTimeout.current);
      trialTimeout.current = null;
    }
  };

  const finishSession = useCallback((
    finalCorrectResponses = correctResponses,
    finalTrialIndex = trialIndex,
    finalReactionTimes = reactionTimes,
    finalFalseTaps = falseTaps,
  ) => {
    const sessionStats = computeStats(
      finalCorrectResponses,
      finalTrialIndex,
      finalReactionTimes,
      finalFalseTaps,
      level,
    );
    setFinalStats(sessionStats);
    setState('done');
    setStimulusActive(false);
    clearTrialTimeout();

    if (!rewardGranted) {
      const xpEarned = Math.max(8, Math.ceil(sessionStats.accuracy / 10));
      setRewardGranted(true);
      recordGameXp('lockstep', xpEarned);
      void grantReward('games', xpEarned, 'completed Lockstep round');
    }
  }, [correctResponses, falseTaps, level, reactionTimes, rewardGranted, trialIndex]);

  const startTrial = useCallback((targetLevel = level, nextTrialIndex = 0) => {
    resolvedTrial.current = false;
    setTrialIndex(nextTrialIndex);
    setStimulus(randomStimulus(targetLevel));
    setStimulusActive(true);
    setFeedback(null);
    stimulusStartedAt.current = Date.now();
  }, [level]);

  const resolveTrial = useCallback((wasCorrect: boolean, registeredRt?: number) => {
    if (resolvedTrial.current) return;
    resolvedTrial.current = true;
    clearTrialTimeout();

    const nextTrialIndex = trialIndex + 1;
    const nextCorrect = wasCorrect ? correctResponses + 1 : correctResponses;
    const nextReactionTimes = registeredRt !== undefined ? [...reactionTimes, registeredRt] : reactionTimes;

    if (registeredRt !== undefined) {
      setReactionTimes(nextReactionTimes);
    }
    if (wasCorrect) {
      setCorrectResponses(nextCorrect);
    }

    setStimulusActive(false);
    if (nextTrialIndex >= TRIALS_PER_SESSION) {
      finishSession(nextCorrect, nextTrialIndex, nextReactionTimes, falseTaps);
      return;
    }

    trialTimeout.current = window.setTimeout(() => {
      startTrial(level, nextTrialIndex);
    }, 350);
  }, [correctResponses, falseTaps, finishSession, level, reactionTimes, startTrial, trialIndex]);

  useEffect(() => () => clearTrialTimeout(), []);

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

  useEffect(() => {
    if (state !== 'playing' || !stimulusActive) return undefined;

    const timeout = window.setTimeout(() => {
      if (stimulus.kind === 'no-go') {
        setFeedback('Good hold');
        resolveTrial(true);
        return;
      }

      setFeedback('Missed it');
      resolveTrial(false);
    }, level >= 10 ? 900 : 1100);

    return () => window.clearTimeout(timeout);
  }, [level, resolveTrial, state, stimulus, stimulusActive]);

  const start = (targetLevel = level) => {
    clearTrialTimeout();
    setLevel(targetLevel);
    setTimeLeft(ROUND_SECONDS);
    setCorrectResponses(0);
    setReactionTimes([]);
    setFalseTaps(0);
    setFeedback(null);
    setRewardGranted(false);
    setFinalStats(null);
    setState('playing');
    startTrial(targetLevel, 0);
  };

  const tap = () => {
    if (state !== 'playing' || !stimulusActive) return;

    if (stimulus.kind === 'no-go') {
      const nextFalseTaps = falseTaps + 1;
      setFalseTaps(nextFalseTaps);
      setFeedback('Too early');
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
      resolvedTrial.current = false;
      finishSession(correctResponses, trialIndex + 1, reactionTimes, nextFalseTaps);
      return;
    }

    const rt = Date.now() - stimulusStartedAt.current;
    setFeedback('On beat');
    if (navigator.vibrate) navigator.vibrate(18);
    resolveTrial(true, rt);
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
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-warm)_15%,transparent)]">
              <Hand size={42} className="text-[var(--color-accent-warm)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lockstep</h1>
              <p className="mt-2 text-lg text-[var(--color-text-muted)]">
                Tap for go cues. Hold for wait cues.
              </p>
            </div>
            <Card padding="md" className="text-left">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                Lockstep trains response control, the split second between noticing a cue and
                deciding whether your body should move.
              </p>
            </Card>
            <Button size="lg" fullWidth variant="warm" onClick={() => start()}>
              Start Lockstep
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
              <div className="text-right">{trialIndex + 1}/{TRIALS_PER_SESSION}</div>
            </div>
            <TimerBar progress={progress} variant="warm" animated={false} />

            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <motion.div
                key={`${trialIndex}-${stimulus.symbol}`}
                initial={{ scale: 0.84, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`
                  flex h-44 w-44 items-center justify-center rounded-[2rem] border text-5xl font-bold shadow-sm
                  ${stimulus.kind === 'go'
                    ? 'border-[color-mix(in_srgb,var(--color-accent-focus)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-focus)_10%,transparent)] text-[var(--color-accent-focus)]'
                    : 'border-[color-mix(in_srgb,var(--color-accent-warm)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-warm)_10%,transparent)] text-[var(--color-accent-warm)]'}
                `}
              >
                {stimulus.symbol}
              </motion.div>

              <div className="text-center">
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">{stimulus.label}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  False taps end the round early.
                </p>
              </div>

              <Button size="lg" fullWidth variant={stimulus.kind === 'go' ? 'focus' : 'secondary'} onClick={tap}>
                {stimulus.kind === 'go' ? <Zap size={20} /> : <ShieldBan size={20} />}
                Tap
              </Button>

              <div className="h-6 text-sm font-medium">
                {feedback === 'On beat' && <span className="text-[var(--color-accent-calm)]">On beat</span>}
                {feedback === 'Good hold' && <span className="text-[var(--color-accent-calm)]">Good hold</span>}
                {feedback === 'Missed it' && <span className="text-[var(--color-accent-warm)]">Missed it</span>}
                {feedback === 'Too early' && <span className="text-[var(--color-accent-warm)]">Too early</span>}
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
              <p className="mt-2 text-[var(--color-text-muted)]">Impulse checked.</p>
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
                <p className="text-xl font-bold">Lv {stats.nextLevel}</p>
              </Card>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              False taps: {stats.falseTaps}
            </p>
            <div className="space-y-3">
              <Button size="lg" fullWidth variant="warm" onClick={() => start(stats.nextLevel)}>
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
