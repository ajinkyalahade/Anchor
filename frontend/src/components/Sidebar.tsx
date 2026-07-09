import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface RewardsSummary {
  total_xp: number;
  current_streak: number;
  streak_state: string;
  comeback_bonus_active: boolean;
}

type SubItem = { id: string; label: string; to: string };

const NAV: {
  id: string;
  label: string;
  to: string;
  icon: React.ReactNode;
  children?: SubItem[];
}[] = [
  {
    id: 'home', label: 'Home', to: '/',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <path d="M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1V9.5Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'focus', label: 'Focus', to: '/focus',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="10" cy="10" r="2.2" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'games', label: 'Games', to: '/games',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <rect x="3" y="6" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 10.5h2M8 9.5v2M12.5 10h.01M14.5 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'calm', label: 'Calm', to: '/calm',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <path d="M4 12c0-3 2.5-5 6-5s6 2 6 5-2.5 4-6 4-6-1-6-4Z" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7.5 10.5c.6.4 1.5.4 2.5 0M12 10.5c-.6.4-1.5.4-2.5 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    children: [
      { id: 'quests', label: 'Energy Quests', to: '/quests' },
    ],
  },
  {
    id: 'anchor-ai', label: 'Anchor AI', to: '/ai',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <path d="M10 3c0 0 1.5 3 5 4-3.5 1-5 4-5 4S8.5 8 5 7c3.5-1 5-4 5-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5 14c0 0 .8 1.5 2.5 2-1.7.5-2.5 2-2.5 2S4.2 16.5 2.5 16c1.7-.5 2.5-2 2.5-2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
    children: [
      { id: 'coach',    label: 'Talk to Anchor',  to: '/coach' },
      { id: 'briefing', label: 'Daily Briefing',  to: '/ai/briefing' },
      { id: 'insights', label: 'Weekly Insights', to: '/ai/insights' },
    ],
  },
  {
    id: 'me', label: 'Me', to: '/me',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <circle cx="10" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4.5 16c.8-2.8 3-4.2 5.5-4.2S14.7 13.2 15.5 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    children: [
      { id: 'settings', label: 'Settings', to: '/me/settings' },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const userId = typeof window !== 'undefined' ? localStorage.getItem('anchor_user_id') : null;
  const { data: rewards } = useQuery<RewardsSummary>({
    queryKey: ['rewards-summary', userId],
    queryFn: () => api.get<RewardsSummary>('/rewards/summary', userId ? { user_id: userId } : undefined),
    staleTime: 30_000,
    retry: false,
  });

  const activePath = location.pathname;

  function isParentActive(n: typeof NAV[0]) {
    if (n.id === 'home') return activePath === '/';
    if (n.children?.some((c) => activePath.startsWith(c.to))) return false; // child is active, not parent
    return activePath.startsWith('/' + n.id) || activePath.startsWith(n.to);
  }

  function isChildActive(to: string) {
    return activePath === to || activePath.startsWith(to + '/');
  }

  function isParentOrChildActive(n: typeof NAV[0]) {
    if (n.id === 'home') return activePath === '/';
    if (n.children?.some((c) => isChildActive(c.to))) return true;
    return activePath.startsWith('/' + n.id) || activePath.startsWith(n.to);
  }

  function renderNavItem(n: typeof NAV[0]) {
    const parentActive = isParentActive(n);
    const sectionActive = isParentOrChildActive(n);
    return (
      <div key={n.id}>
        <button
          onClick={() => navigate(n.to)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 'var(--r-sm)',
            color: sectionActive ? 'var(--ink)' : 'var(--ink-2)',
            fontSize: 14.5, letterSpacing: '-0.005em',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            transition: 'background 120ms ease, color 120ms ease',
            background: parentActive ? 'var(--paper)' : sectionActive ? 'var(--bone-soft)' : 'transparent',
            boxShadow: parentActive ? 'inset 0 0 0 1px var(--hairline)' : 'none',
          }}
          onMouseEnter={(e) => { if (!sectionActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bone-soft)'; }}
          onMouseLeave={(e) => { if (!sectionActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: sectionActive ? 1 : 0.7, flexShrink: 0 }}>
            {n.icon}
          </span>
          {n.label}
        </button>
        {n.children && (
          <div style={{ marginLeft: 18, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {n.children.map((child) => {
              const childActive = isChildActive(child.to);
              return (
                <button
                  key={child.id}
                  onClick={() => navigate(child.to)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', borderRadius: 'var(--r-sm)',
                    fontSize: 13, letterSpacing: '-0.005em',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 120ms ease, color 120ms ease',
                    color: childActive ? 'var(--ink)' : 'var(--ink-3)',
                    background: childActive ? 'var(--paper)' : 'transparent',
                    boxShadow: childActive ? 'inset 0 0 0 1px var(--hairline)' : 'none',
                    fontWeight: childActive ? 500 : 400,
                  }}
                  onMouseEnter={(e) => { if (!childActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bone-soft)'; }}
                  onMouseLeave={(e) => { if (!childActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: childActive ? 'var(--ink)' : 'var(--ink-4)', flexShrink: 0 }} />
                  {child.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      style={{
        borderRight: '1px solid var(--hairline)',
        padding: '28px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        background: 'var(--bone)',
        overflowY: 'auto',
        justifyContent: 'space-between',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 8px 28px', flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 22, height: 22, alignSelf: 'center', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid var(--ink)' }} />
          <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 1.5, height: 12, background: 'var(--ink)' }} />
        </div>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Anchor
        </span>
      </div>

      {/* Top nav — Home, Focus, Games, Calm */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.filter(n => n.id !== 'me').map((n) => renderNavItem(n))}
      </div>

      {/* Bottom section — Me + footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Divider */}
        <div style={{ height: 1, background: 'var(--hairline)', margin: '8px 12px 8px' }} />

        {/* Me with sub-items */}
        {NAV.filter(n => n.id === 'me').map((n) => renderNavItem(n))}

        {/* Footer */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Energy</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--calm)', display: 'inline-block' }} />
              steady
            </span>
          </div>
          {rewards && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>XP</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--reward-ink)' }}>{rewards.total_xp}</span>
            </div>
          )}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
            v0.4 · MVP
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('anchor_token');
              localStorage.removeItem('anchor_user_id');
              localStorage.removeItem('anchor_first_name');
              window.location.href = '/login';
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: 'var(--ink-4)', cursor: 'pointer',
              background: 'transparent', padding: '4px 0',
              transition: 'color 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-4)')}
          >
            <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
              <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
