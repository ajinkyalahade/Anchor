import { useState } from 'react';
import { Menu, Sparkles, Flame } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import SideDrawer from './SideDrawer';
import { api } from '../lib/api';

interface RewardsSummary {
  total_xp: number;
  current_streak: number;
  streak_state: string;
  comeback_bonus_active: boolean;
  message?: string | null;
}

const SECTION_MAP: Record<string, string> = {
  '/': 'Today',
  '/focus': 'Focus',
  '/structure': 'Structure',
  '/structure/capture': 'Capture',
  '/structure/blocks': 'Time Blocks',
  '/calm': 'Calm',
  '/calm/breathe': 'Breathe',
  '/calm/ground': 'Ground',
  '/calm/spiral': 'Anxiety Stop',
  '/calm/rsd': 'RSD Support',
  '/calm/ambient': 'Ambient',
  '/quests': 'Quests',
  '/games': 'Games',
  '/games/word-gym': 'Word Gym',
  '/games/echo': 'Echo',
  '/games/lockstep': 'Lockstep',
  '/games/mirror': 'Mirror',
  '/games/spotter': 'Spotter',
  '/games/switch': 'Switch',
  '/games/tracker': 'Tracker',
  '/coach': 'AI Coach',
  '/rooms': 'Study Rooms',
  '/me': 'Progress',
  '/me/settings': 'Settings',
};

export default function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const userId = typeof window !== 'undefined' ? localStorage.getItem('anchor_user_id') : null;
  const { data: rewards } = useQuery<RewardsSummary>({
    queryKey: ['rewards-summary', userId],
    queryFn: () => api.get<RewardsSummary>('/rewards/summary', userId ? { user_id: userId } : undefined),
    staleTime: 30_000,
    retry: false,
  });

  const totalXp = rewards?.total_xp ?? 0;
  const streak = rewards?.current_streak ?? 0;
  const comebackActive = rewards?.comeback_bonus_active ?? false;

  const currentSection = SECTION_MAP[location.pathname] ?? 'Anchor';

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center px-4 gap-3"
        style={{
          height: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'color-mix(in srgb, var(--color-bg-canvas) 90%, transparent)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid color-mix(in srgb, var(--color-text-muted) 7%, transparent)',
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center w-9 h-9 -ml-1 rounded-xl transition-colors hover:bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)]"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-haspopup="true"
        >
          <Menu size={18} strokeWidth={2} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--color-text-muted)] tracking-wide">
            {currentSection}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {comebackActive ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent-calm)] bg-[color-mix(in_srgb,var(--color-accent-calm)_12%,transparent)] px-2.5 py-1 rounded-full">
              <Sparkles size={10} className="fill-current" />
              Comeback
            </span>
          ) : streak > 0 ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent-spark)] bg-[color-mix(in_srgb,var(--color-accent-spark)_12%,transparent)] px-2.5 py-1 rounded-full">
              <Flame size={10} className="fill-current" />
              {streak}d
            </span>
          ) : null}
          {(totalXp > 0 || rewards !== undefined) && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent-focus)] bg-[color-mix(in_srgb,var(--color-accent-focus)_10%,transparent)] px-2.5 py-1 rounded-full">
              <Sparkles size={10} className="fill-current" />
              {totalXp} XP
            </span>
          )}
        </div>
      </header>

      <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
