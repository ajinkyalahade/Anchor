import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Animated ambient background — subtle, calm floating orbs.
 * Per PRD §5.1: "Calmer than productivity apps, warmer than meditation apps."
 * Respects prefers-reduced-motion via CSS (animations disabled).
 */
export default function AmbientBackground() {
  const prefersReducedMotion = useReducedMotion();
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ||
        document.documentElement.classList.contains('dark')
      : false,
  );
  const orbs = [
    { color: 'var(--color-accent-calm)', size: 400, x: '15%', y: '20%', delay: 0 },
    { color: 'var(--color-accent-focus)', size: 350, x: '70%', y: '60%', delay: 2 },
    { color: 'var(--color-accent-lilac)', size: 300, x: '50%', y: '10%', delay: 4 },
    { color: 'var(--color-accent-spark)', size: 250, x: '85%', y: '80%', delay: 1 },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncMode = () => {
      setIsDarkMode(
        mediaQuery.matches || document.documentElement.classList.contains('dark'),
      );
    };

    syncMode();
    mediaQuery.addEventListener('change', syncMode);

    return () => mediaQuery.removeEventListener('change', syncMode);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color}${isDarkMode ? '20' : '14'} 0%, transparent 72%)`,
            filter: prefersReducedMotion
              ? isDarkMode
                ? 'blur(96px)'
                : 'blur(112px)'
              : isDarkMode
                ? 'blur(80px)'
                : 'blur(104px)',
            opacity: prefersReducedMotion
              ? isDarkMode
                ? 0.5
                : 0.32
              : isDarkMode
                ? 1
                : 0.58,
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: [0, 30, -20, 0],
                  y: [0, -25, 15, 0],
                  scale: [1, 1.08, 0.95, 1],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: 20,
                  repeat: Infinity,
                  delay: orb.delay,
                  ease: 'easeInOut',
                }
          }
        />
      ))}
    </div>
  );
}
