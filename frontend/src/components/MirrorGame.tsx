import { useState, useCallback } from 'react';

type Phase = 'idle' | 'showing' | 'input' | 'correct' | 'wrong' | 'done';

const COLORS = [
  'var(--color-accent-focus)',
  'var(--color-accent-calm)',
  'var(--color-accent-spark)',
  'var(--color-accent-lilac)',
];
const TILE_LABELS = ['A', 'B', 'C', 'D'];

function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

export default function MirrorGame({ onBack }: { onBack?: () => void }) {
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const tileCount = Math.min(4 + Math.floor(level / 3), 6);

  const buildSequence = useCallback((len: number) => {
    return Array.from({ length: len }, () => Math.floor(Math.random() * tileCount));
  }, [tileCount]);

  const startRound = useCallback(() => {
    const seq = buildSequence(level + 2);
    setSequence(seq);
    setUserInput([]);
    setPhase('showing');
    setHighlighted(null);

    let i = 0;
    const interval = setInterval(() => {
      if (i < seq.length) {
        setActiveIndex(seq[i]);
        setTimeout(() => setActiveIndex(null), 500);
        i++;
      } else {
        clearInterval(interval);
        setPhase('input');
      }
    }, 800);
  }, [level, buildSequence]);

  const handleTilePress = (idx: number) => {
    if (phase !== 'input') return;
    vibrate(30);
    setHighlighted(idx);
    setTimeout(() => setHighlighted(null), 150);

    const next = [...userInput, idx];
    setUserInput(next);

    if (next[next.length - 1] !== sequence[next.length - 1]) {
      setPhase('wrong');
      vibrate([100, 50, 100]);
      return;
    }

    if (next.length === sequence.length) {
      setScore((s) => s + level * 10);
      setPhase('correct');
      vibrate(80);
      setTimeout(() => {
        setLevel((l) => Math.min(l + 1, 20));
        startRound();
      }, 900);
    }
  };

  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-6 p-6">
        <h1 className="text-3xl font-bold">Mirror</h1>
        {onBack && <button onClick={onBack} className="text-sm opacity-50 absolute top-6 left-6">Back</button>}
        <p className="text-center text-sm opacity-70 max-w-xs">
          Watch the pattern, then tap the tiles in the same order. Builds the same circuits used
          for following multi-step instructions.
        </p>
        <button
          onClick={startRound}
          className="px-8 py-3 rounded-2xl font-semibold"
          style={{ background: COLORS[0], color: 'white' }}
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'wrong') {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="text-5xl">✗</div>
        <p className="text-lg font-semibold opacity-70">Wrong order — try again</p>
        <p className="text-sm opacity-50">Score: {score}</p>
        <button
          onClick={() => { setLevel(Math.max(1, level - 1)); setPhase('idle'); }}
          className="px-6 py-2 rounded-xl font-semibold bg-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 select-none">
      <div className="flex justify-between w-full max-w-xs text-sm opacity-60">
        <span>Level {level}</span>
        <span>{phase === 'showing' ? 'Watch…' : phase === 'correct' ? '✓ Correct!' : `${userInput.length}/${sequence.length}`}</span>
        <span>Score {score}</span>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(tileCount, 3)}, 1fr)` }}
      >
        {Array.from({ length: tileCount }, (_, i) => {
          const isActive = activeIndex === i || highlighted === i;
          return (
            <button
              key={i}
              onClick={() => handleTilePress(i)}
              disabled={phase !== 'input'}
              className="w-20 h-20 rounded-2xl font-bold text-white text-xl transition-all duration-150"
              style={{
                background: COLORS[i % COLORS.length],
                opacity: isActive ? 1 : 0.45,
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                boxShadow: isActive ? `0 0 24px ${COLORS[i % COLORS.length]}99` : 'none',
              }}
            >
              {TILE_LABELS[i]}
            </button>
          );
        })}
      </div>

      <p className="text-xs opacity-40">Max 90 seconds per round</p>
    </div>
  );
}
