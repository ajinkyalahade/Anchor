// SPDX-License-Identifier: MIT
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Crosshair,
  Calendar,
  Clock3,
  Wind,
  MapPin,
  Waves,
  Heart,
  AudioLines,
  Zap,
  Gamepad2,
  BookOpen,
  Plus,
  Radio,
  LayoutGrid,
  Repeat2,
  Eye,
  Shuffle,
  Target,
  User,
  Bot,
  Users,
  Settings,
  X,
} from 'lucide-react';
import AnchorWordmark from './AnchorWordmark';

interface NavItem {
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    color?: string;
  }>;
  to: string;
  color: string;
}

interface NavSection {
  label: string | null;
  color: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: null,
    color: 'var(--color-accent-focus)',
    items: [
      { label: 'Today', icon: Home, to: '/', color: 'var(--color-accent-focus)' },
    ],
  },
  {
    label: 'FOCUS',
    color: 'var(--color-accent-focus)',
    items: [
      { label: 'Focus Engine', icon: Crosshair, to: '/focus', color: 'var(--color-accent-focus)' },
      { label: 'Structure Hub', icon: Calendar, to: '/structure', color: 'var(--color-accent-focus)' },
      { label: 'Capture & Dump', icon: Plus, to: '/structure/capture', color: 'var(--color-accent-focus)' },
      { label: 'Time Blocks', icon: Clock3, to: '/structure/blocks', color: 'var(--color-accent-focus)' },
    ],
  },
  {
    label: 'RECHARGE',
    color: 'var(--color-accent-calm)',
    items: [
      { label: 'Recharge Hub', icon: Heart, to: '/calm', color: 'var(--color-accent-calm)' },
      { label: 'Breathe', icon: Wind, to: '/calm/breathe', color: 'var(--color-accent-calm)' },
      { label: 'Ground (5-4-3-2-1)', icon: MapPin, to: '/calm/ground', color: 'var(--color-accent-calm)' },
      { label: 'Anxiety Stop', icon: Waves, to: '/calm/spiral', color: 'var(--color-accent-calm)' },
      { label: 'RSD Support', icon: Heart, to: '/calm/rsd', color: 'var(--color-accent-calm)' },
      { label: 'Ambient Sounds', icon: AudioLines, to: '/calm/ambient', color: 'var(--color-accent-calm)' },
      { label: 'Energy Quests', icon: Zap, to: '/quests', color: 'var(--color-accent-calm)' },
    ],
  },
  {
    label: 'BRAIN TRAIN',
    color: 'var(--color-accent-spark)',
    items: [
      { label: 'Games Hub', icon: Gamepad2, to: '/games', color: 'var(--color-accent-spark)' },
      { label: 'Word Gym', icon: BookOpen, to: '/games/word-gym', color: 'var(--color-accent-spark)' },
      { label: 'Echo', icon: Radio, to: '/games/echo', color: 'var(--color-accent-spark)' },
      { label: 'Lockstep', icon: Repeat2, to: '/games/lockstep', color: 'var(--color-accent-spark)' },
      { label: 'Mirror', icon: LayoutGrid, to: '/games/mirror', color: 'var(--color-accent-spark)' },
      { label: 'Spotter', icon: Eye, to: '/games/spotter', color: 'var(--color-accent-spark)' },
      { label: 'Switch', icon: Shuffle, to: '/games/switch', color: 'var(--color-accent-spark)' },
      { label: 'Tracker', icon: Target, to: '/games/tracker', color: 'var(--color-accent-spark)' },
    ],
  },
  {
    label: 'MY SPACE',
    color: 'var(--color-accent-lilac)',
    items: [
      { label: 'Profile & XP', icon: User, to: '/me', color: 'var(--color-accent-lilac)' },
      { label: 'AI Coach', icon: Bot, to: '/coach', color: 'var(--color-accent-lilac)' },
      { label: 'Study Rooms', icon: Users, to: '/rooms', color: 'var(--color-accent-lilac)' },
      { label: 'Settings', icon: Settings, to: '/me/settings', color: 'var(--color-accent-lilac)' },
    ],
  },
];

function DrawerItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClose}
      className="no-underline"
    >
      {({ isActive }) => (
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            isActive
              ? 'bg-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)]'
              : 'hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)]'
          }`}
        >
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            color={isActive ? item.color : 'var(--color-text-muted)'}
          />
          <span
            className="text-sm font-medium"
            style={{
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {item.label}
          </span>
          {isActive && (
            <div
              className="ml-auto w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
        </div>
      )}
    </NavLink>
  );
}

export default function SideDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useLocation(); // re-render on route change
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: reducedMotion ? 0 : '-100%', opacity: reducedMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : '-100%', opacity: reducedMotion ? 0 : 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
            className="
              fixed left-0 top-0 bottom-0 z-50
              w-72 max-w-[85vw]
              bg-[var(--color-bg-surface)]
              border-r border-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)]
              flex flex-col
              shadow-2xl
            "
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-safe pt-5 pb-4 border-b border-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)]">
              <AnchorWordmark className="h-6 w-auto" />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)] transition-colors"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {SECTIONS.map((section, si) => (
                <div key={si} className={si > 0 ? 'pt-3' : ''}>
                  {section.label && (
                    <p
                      className="px-3 mb-1 text-[10px] font-bold tracking-[0.15em] uppercase"
                      style={{ color: section.color }}
                    >
                      {section.label}
                    </p>
                  )}
                  {section.items.map((item) => (
                    <DrawerItem key={item.to} item={item} onClose={onClose} />
                  ))}
                </div>
              ))}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
