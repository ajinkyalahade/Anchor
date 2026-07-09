import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button, Card, TimerBar } from './ui';
import { grantReward } from '../lib/rewards';

const SPIRAL_SCRIPT = [
  {
    title: 'Name the spiral',
    duration: 20,
    cue: 'This is an anxiety spiral. It is loud, and it will pass.',
    body: 'Put one hand somewhere steady. Name what is happening without arguing with it.',
  },
  {
    title: 'Slow breath',
    duration: 50,
    cue: 'In for four. Out for six. Let the exhale be longer.',
    body: 'No need to breathe perfectly. Just give your nervous system one slower signal at a time.',
  },
  {
    title: 'One micro-action',
    duration: 20,
    cue: 'Pick the next action so small it almost feels silly.',
    body: 'Open the tab, drink water, write one sentence, stand up, or send one simple message.',
  },
] as const;

const TOTAL_SECONDS = SPIRAL_SCRIPT.reduce((total, step) => total + step.duration, 0);

function getStepIndex(elapsedSeconds: number) {
  let cursor = 0;

  for (let index = 0; index < SPIRAL_SCRIPT.length; index += 1) {
    cursor += SPIRAL_SCRIPT[index].duration;
    if (elapsedSeconds < cursor) return index;
  }

  return SPIRAL_SCRIPT.length - 1;
}

function getStepElapsed(elapsedSeconds: number, stepIndex: number) {
  return SPIRAL_SCRIPT
    .slice(0, stepIndex)
    .reduce((total, step) => total + step.duration, elapsedSeconds * -1) * -1;
}

export default function AnxietySpiralStop() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [rewardGranted, setRewardGranted] = useState(false);

  const isComplete = elapsedSeconds >= TOTAL_SECONDS;
  const activeStepIndex = getStepIndex(elapsedSeconds);
  const activeStep = SPIRAL_SCRIPT[activeStepIndex];
  const stepElapsed = getStepElapsed(elapsedSeconds, activeStepIndex);
  const stepProgress = Math.min(1, stepElapsed / activeStep.duration);
  const totalProgress = Math.min(1, elapsedSeconds / TOTAL_SECONDS);
  const secondsLeft = Math.max(0, TOTAL_SECONDS - elapsedSeconds);

  const transcript = useMemo(
    () => SPIRAL_SCRIPT.map((step) => `${step.title}. ${step.cue} ${step.body}`).join(' '),
    [],
  );

  useEffect(() => {
    if (!isRunning || isComplete) return undefined;

    const interval = window.setInterval(() => {
      if (elapsedSeconds >= TOTAL_SECONDS - 1) {
        setElapsedSeconds(TOTAL_SECONDS);
        setIsRunning(false);

        if (!rewardGranted) {
          setRewardGranted(true);
          void grantReward('calm', 12, 'completed anxiety spiral reset');
        }
        return;
      }

      setElapsedSeconds((seconds) => Math.min(TOTAL_SECONDS, seconds + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [elapsedSeconds, isComplete, isRunning, rewardGranted]);

  useEffect(() => {
    if (!voiceEnabled || !isRunning || isComplete || !('speechSynthesis' in window)) {
      return undefined;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(`${activeStep.cue} ${activeStep.body}`);
    utterance.rate = 0.82;
    utterance.pitch = 0.9;
    utterance.volume = 0.85;
    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }, [activeStep, activeStepIndex, isComplete, isRunning, voiceEnabled]);

  const reset = () => {
    window.speechSynthesis?.cancel();
    setElapsedSeconds(0);
    setIsRunning(false);
    setRewardGranted(false);
  };

  return (
    <div className="space-y-5">
      <Card padding="lg" variant="glass" className="overflow-hidden">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent-calm)]">
              90-second reset
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
              Anxiety Spiral Stop
            </h2>
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-[var(--color-text-muted)]">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </div>
        </div>

        <TimerBar progress={totalProgress} variant="calm" height={10} animated={isRunning} />

        <div className="relative my-8 flex min-h-64 items-center justify-center">
          <motion.div
            className="absolute h-52 w-52 rounded-full border border-[color-mix(in_srgb,var(--color-accent-calm)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-calm)_14%,transparent)]"
            animate={{
              scale: activeStepIndex === 1 && isRunning ? [0.92, 1.12, 0.92] : 1,
              opacity: isRunning ? [0.72, 1, 0.72] : 0.8,
            }}
            transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
          />
          <div className="relative z-10 max-w-xs text-center">
            <motion.div
              key={activeStep.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-accent-calm)]">
                {activeStep.title}
              </p>
              <h3 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-text-primary)]">
                {isComplete ? 'You made it through.' : activeStep.cue}
              </h3>
              <p className="mt-4 text-[var(--color-text-muted)]">{activeStep.body}</p>
            </motion.div>
          </div>
        </div>

        <TimerBar progress={stepProgress} variant="calm" height={4} animated={isRunning} />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="calm"
            size="lg"
            onClick={() => setIsRunning((running) => !running)}
            disabled={isComplete}
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
            {isRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start'}
          </Button>
          <Button variant="secondary" size="lg" onClick={reset}>
            <RotateCcw size={20} /> Reset
          </Button>
        </div>

        {isComplete && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent-calm)_12%,transparent)] px-4 py-3 text-sm font-medium text-[var(--color-accent-calm)]">
            <CheckCircle2 size={18} /> One small next step is enough.
          </div>
        )}
      </Card>

      <Card padding="md" variant="surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setVoiceEnabled((enabled) => !enabled)}
            role="switch"
            aria-checked={voiceEnabled}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)]"
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            Voice {voiceEnabled ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => setShowTranscript((visible) => !visible)}
            aria-expanded={showTranscript}
            className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)]"
          >
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
        </div>

        {showTranscript && (
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">{transcript}</p>
        )}
      </Card>
    </div>
  );
}
