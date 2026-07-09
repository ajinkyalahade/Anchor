import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'idle';

const PHASE_SECONDS: Record<Exclude<BreathPhase, 'idle'>, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
};

function getNextPhase(phase: BreathPhase): Exclude<BreathPhase, 'idle'> {
  if (phase === 'inhale') return 'hold';
  if (phase === 'hold') return 'exhale';
  return 'inhale';
}

export default function BreathCoach() {
  // Simple 4-7-8 breathing logic
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const startBreathing = () => {
    setPhase('inhale');
    setSecondsLeft(PHASE_SECONDS.inhale);
  };

  useEffect(() => {
    if (phase === 'idle') return undefined;

    const timeout = window.setTimeout(() => {
      if (secondsLeft > 1) {
        setSecondsLeft((s) => s - 1);
        return;
      }

      const nextPhase = getNextPhase(phase);
      setPhase(nextPhase);
      setSecondsLeft(PHASE_SECONDS[nextPhase]);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [phase, secondsLeft]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full relative">
      <AnimatePresence>
        {phase === 'idle' ? (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={startBreathing}
            className="w-48 h-48 rounded-full bg-[color-mix(in_srgb,var(--color-accent-calm)_20%,transparent)] border-4 border-[var(--color-accent-calm)] text-[var(--color-accent-calm)] text-xl font-bold flex items-center justify-center cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-accent-calm)_30%,transparent)] transition-colors shadow-lg"
          >
            Start Breathing
          </motion.button>
        ) : (
          <motion.div
            key="orb"
            className="relative flex items-center justify-center"
            initial={{ scale: 1 }}
            animate={{ 
              scale: phase === 'inhale' ? 1.8 : phase === 'hold' ? 1.8 : 1,
              opacity: phase === 'hold' ? 0.8 : 1
            }}
            transition={{ 
              duration: phase === 'inhale' ? 4 : phase === 'hold' ? 7 : 8,
              ease: "linear"
            }}
          >
            <div className="w-48 h-48 rounded-full bg-[color-mix(in_srgb,var(--color-accent-calm)_40%,transparent)] shadow-[0_0_60px_var(--color-accent-calm)] backdrop-blur-sm border border-[color-mix(in_srgb,var(--color-accent-calm)_50%,transparent)] flex items-center justify-center relative z-10">
              <div className="text-center absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold tracking-widest uppercase text-[var(--color-accent-calm)] opacity-80 mb-1">
                  {phase}
                </span>
                <span className="text-4xl font-mono font-bold text-[var(--color-text-primary)]">
                  {secondsLeft}
                </span>
              </div>
            </div>
            {/* Ripple effect */}
            <motion.div 
              className="absolute w-48 h-48 rounded-full border-2 border-[var(--color-accent-calm)] z-0"
              animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {phase !== 'idle' && (
        <button 
          onClick={() => setPhase('idle')}
          className="absolute bottom-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Stop
        </button>
      )}
    </div>
  );
}
