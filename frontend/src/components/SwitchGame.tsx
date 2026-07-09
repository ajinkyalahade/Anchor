import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Shuffle, Zap } from 'lucide-react';

import { recordGameXp } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';
import { Button, Card, TimerBar } from './ui';

type SwitchState = 'intro' | 'playing' | 'done';
type RuleMode = 'color' | 'shape';

interface Stimulus {
  shape: 'circle' | 'triangle';
  color: 'focus' | 'spark';
  rule: RuleMode;
}

interface SwitchStats {
  accuracy: number;
  rtMean: number;
  switchCost: number;
  nextLevel: number;
}

interface SwitchGameProps {
  onBack: () => void;
}

const ROUND_SECONDS = 90;
const TRIALS_PER_SESSION = 18;
const SHAPES: Array<Stimulus['shape']> = ['circle', 'triangle'];
const COLORS: Array<Stimulus['color']> = ['focus', 'spark'];

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeStimulus(previousRule: RuleMode | null, level: number): Stimulus {
  const shouldSwitch = previousRule !== null && (level >= 8 ? Math.random() < 0.55 : Math.random() < 0.35);
  const rule: RuleMode = shouldSwitch
    ? previousRule === 'color' ? 'shape' : 'color'
    : previousRule ?? 'color';

  return {
    rule,
    shape: randomItem(SHAPES),
    color: randomItem(COLORS),
  };
}

function expectedAnswer(stimulus: Stimulus) {
  if (stimulus.rule === 'color') {
    return stimulus.color === 'focus' ? 'left' : 'right';
  }

  return stimulus.shape === 'circle' ? 'left' : 'right';
}

function shapeGlyph(shape: Stimulus['shape']) {
  return shape === 'circle' ? '●' : '▲';
}

function colorValue(color: Stimulus['color']) {
  return color === 'focus' ? 'var(--color-accent-focus)' : 'var(--color-accent-spark)';
}

function computeStats(
  correctResponses: number,
  attemptedTrials: number,
  repeatRts: number[],
  switchRts: number[],
  level: number,
): SwitchStats {
  const combined = [...repeatRts, ...switchRts];
  const accuracy = Math.round((correctResponses / Math.max(1, attemptedTrials)) * 100);
  const rtMean = combined.length
    ? Math.round(combined.reduce((sum, value) => sum + value, 0) / combined.length)
    : 0;
  const repeatMean = repeatRts.length
    ? repeatRts.reduce((sum, value) => sum + value, 0) / repeatRts.length
    : rtMean;
  const switchMean = switchRts.length
    ? switchRts.reduce((sum, value) => sum + value, 0) / switchRts.length
    : rtMean;
  const switchCost = Math.max(0, Math.round(switchMean - repeatMean));

  return {
    accuracy,
    rtMean,
    switchCost,
    nextLevel: accuracy > 85 && switchCost < 180 ? Math.min(20, level + 1) : accuracy < 70 ? Math.max(1, level - 1) : level,
  };
}

export default function SwitchGame({ onBack }: SwitchGameProps) {
  const [state, setState] = useState<SwitchState>('intro');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [trialIndex, setTrialIndex] = useState(0);
  const [stimulus, setStimulus] = useState<Stimulus>(() => makeStimulus(null, 1));
  const [previousRule, setPreviousRule] = useState<RuleMode | null>(null);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [repeatRts, setRepeatRts] = useState<number[]>([]);
  const [switchRts, setSwitchRts] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalStats, setFinalStats] = useState<SwitchStats | null>(null);

  const startedAt = useRef(0);
  const nextTrialTimeout = useRef<number | null>(null);
  const progress = trialIndex / TRIALS_PER_SESSION;
  const stats = useMemo(
    () => finalStats ?? computeStats(correctResponses, trialIndex, repeatRts, switchRts, level),
    [correctResponses, finalStats, level, repeatRts, switchRts, trialIndex],
  );

  const clearNextTrialTimeout = () => {
    if (nextTrialTimeout.current !== null) {
      window.clearTimeout(nextTrialTimeout.current);
      nextTrialTimeout.current = null;
    }
  };

  const finishSession = useCallback((
    finalCorrectResponses = correctResponses,
    finalTrialIndex = trialIndex,
    finalRepeatRts = repeatRts,
    finalSwitchRts = switchRts,
  ) => {
    const sessionStats = computeStats(
      finalCorrectResponses,
      finalTrialIndex,
      finalRepeatRts,
      finalSwitchRts,
      level,
    );
    setFinalStats(sessionStats);
    setState('done');
    clearNextTrialTimeout();

    if (!rewardGranted) {
      const xpEarned = Math.max(8, Math.ceil(sessionStats.accuracy / 10));
      setRewardGranted(true);
      recordGameXp('switch', xpEarned);
      void grantReward('games', xpEarned, 'completed Switch round');
    }
  }, [correctResponses, level, repeatRts, rewardGranted, switchRts, trialIndex]);

  const startTrial = useCallback((rule: RuleMode | null, targetLevel = level, nextTrialIndex = 0) => {
    const nextStimulus = makeStimulus(rule, targetLevel);
    setStimulus(nextStimulus);
    setPreviousRule(nextStimulus.rule);
    setTrialIndex(nextTrialIndex);
    setFeedback(null);
    startedAt.current = Date.now();
  }, [level]);

  useEffect(() => () => clearNextTrialTimeout(), []);

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
    clearNextTrialTimeout();
    setLevel(targetLevel);
    setTimeLeft(ROUND_SECONDS);
    setTrialIndex(0);
    setPreviousRule(null);
    setCorrectResponses(0);
    setRepeatRts([]);
    setSwitchRts([]);
    setFeedback(null);
    setRewardGranted(false);
    setFinalStats(null);
    setState('playing');
    startTrial(null, targetLevel, 0);
  };

  const answer = (direction: 'left' | 'right') => {
    if (state !== 'playing') return;

    const rt = Date.now() - startedAt.current;
    const correct = direction === expectedAnswer(stimulus);
    const isRuleSwitch = trialIndex > 0 && stimulus.rule !== previousRule;
    const nextTrialIndex = trialIndex + 1;
    const nextCorrectResponses = correct ? correctResponses + 1 : correctResponses;
    const nextRepeatRts = !isRuleSwitch ? [...repeatRts, rt] : repeatRts;
    const nextSwitchRts = isRuleSwitch ? [...switchRts, rt] : switchRts;

    if (!isRuleSwitch) {
      setRepeatRts(nextRepeatRts);
    } else {
      setSwitchRts(nextSwitchRts);
    }

    if (correct) {
      setCorrectResponses(nextCorrectResponses);
      setFeedback(isRuleSwitch ? 'Good switch' : 'On track');
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      setFeedback(isRuleSwitch ? 'Switch miss' : 'Miss');
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    }

    if (nextTrialIndex >= TRIALS_PER_SESSION) {
      finishSession(nextCorrectResponses, nextTrialIndex, nextRepeatRts, nextSwitchRts);
      return;
    }

    nextTrialTimeout.current = window.setTimeout(() => {
      startTrial(stimulus.rule, level, nextTrialIndex);
    }, 350);
  };

  const leftLabel = stimulus.rule === 'color'
    ? 'Blue / focus'
    : 'Circle';
  const rightLabel = stimulus.rule === 'color'
    ? 'Gold / spark'
    : 'Triangle';

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
              <Shuffle size={42} className="text-[var(--color-accent-lilac)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Switch</h1>
              <p className="mt-2 text-lg text-[var(--color-text-muted)]">
                Shift between color and shape rules without losing your place.
              </p>
            </div>
            <Card padding="md" className="text-left">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                Switch trains cognitive flexibility. Some rounds ask what color you see,
                others ask what shape you see, and the cost of switching is part of the score.
              </p>
            </Card>
            <Button size="lg" fullWidth variant="lilac" onClick={() => start()}>
              Start Switch
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
            <TimerBar progress={progress} variant="lilac" animated={false} />

            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">
                Rule: {stimulus.rule === 'color' ? 'Color' : 'Shape'}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {stimulus.rule === 'color' ? 'Choose by color, ignore shape.' : 'Choose by shape, ignore color.'}
              </p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <motion.div
                key={`${trialIndex}-${stimulus.rule}-${stimulus.shape}-${stimulus.color}`}
                initial={{ scale: 0.84, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-44 w-44 items-center justify-center rounded-[2rem] bg-[var(--color-bg-surface)] shadow-sm"
                style={{ color: colorValue(stimulus.color) }}
              >
                <span className="text-7xl font-bold">{shapeGlyph(stimulus.shape)}</span>
              </motion.div>

              <div className="grid w-full grid-cols-2 gap-3">
                <Button size="lg" variant="secondary" onClick={() => answer('left')}>
                  {leftLabel}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => answer('right')}>
                  {rightLabel}
                </Button>
              </div>

              <div className="h-6 text-sm font-medium">
                {feedback === 'On track' && <span className="text-[var(--color-accent-calm)]">On track</span>}
                {feedback === 'Good switch' && <span className="text-[var(--color-accent-calm)]">Good switch</span>}
                {feedback === 'Miss' && <span className="text-[var(--color-accent-warm)]">Miss</span>}
                {feedback === 'Switch miss' && <span className="text-[var(--color-accent-warm)]">Switch miss</span>}
              </div>
            </div>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Why this matters: switching cleanly between rules reduces the mental stall
              that can happen when priorities change mid-task.
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
              <p className="mt-2 text-[var(--color-text-muted)]">You kept up with the rule shifts.</p>
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
                <p className="text-xs text-[var(--color-text-muted)]">Switch cost</p>
                <p className="text-xl font-bold">{stats.switchCost}ms</p>
              </Card>
            </div>
            <div className="space-y-3">
              <Button size="lg" fullWidth variant="lilac" onClick={() => start(stats.nextLevel)}>
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
