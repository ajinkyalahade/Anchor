import { NavLink } from 'react-router-dom';
import { Home, Crosshair, Wind, Gamepad2, User } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { label: 'Today', icon: Home, to: '/', end: true },
  { label: 'Focus', icon: Crosshair, to: '/focus', end: false },
  { label: 'Calm', icon: Wind, to: '/calm', end: false },
  { label: 'Games', icon: Gamepad2, to: '/games', end: false },
  { label: 'Me', icon: User, to: '/me', end: false },
] as const;

export default function BottomNav() {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'color-mix(in srgb, var(--color-bg-surface) 88%, transparent)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid color-mix(in srgb, var(--color-text-muted) 8%, transparent)',
        boxShadow: '0 -1px 0 color-mix(in srgb, var(--color-bg-surface) 50%, transparent), var(--shadow-lg)',
      }}
    >
      {TABS.map(({ label, icon: Icon, to, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="flex-1 no-underline"
        >
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200">
              {/* Active background pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-x-2 top-1.5 h-8 rounded-xl"
                  style={{
                    background: `color-mix(in srgb, var(--color-accent-focus) 12%, transparent)`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  color={isActive ? 'var(--color-accent-focus)' : 'var(--color-text-muted)'}
                />
              </span>
              <span
                className="relative z-10 text-[10px] font-semibold tracking-wide leading-none"
                style={{
                  color: isActive ? 'var(--color-accent-focus)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
