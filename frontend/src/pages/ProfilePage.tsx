import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fetchUnlocks, type UnlocksResponse } from '../lib/rewards';
import { buildWeeklyDigest, loadInsightDashboard } from '../lib/insights';
import { computeModalityPreferences } from '../lib/personalization';
import { loadQuestStore } from '../lib/quests';

interface RewardsSummary {
  total_xp: number;
  current_streak: number;
  streak_state: string;
  comeback_bonus_active: boolean;
  message?: string | null;
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<UnlocksResponse | null>(null);
  const [rewardsSummary, setRewardsSummary] = useState<RewardsSummary | null>(null);

  const insights = useMemo(() => loadInsightDashboard(), []);
  const questLogs = useMemo(() => loadQuestStore().logs, []);
  const modalityPreferences = useMemo(
    () => computeModalityPreferences(insights.sessions, questLogs),
    [insights.sessions, questLogs],
  );
  const digestPreview = useMemo(
    () => buildWeeklyDigest(insights.sessions, insights.inputs),
    [insights.inputs, insights.sessions],
  );

  useEffect(() => {
    void fetchUnlocks().then(setData);
    const userId = window.localStorage.getItem('anchor_user_id');
    const params = userId ? { user_id: userId } : undefined;
    api.get<RewardsSummary>('/rewards/summary', params).then(setRewardsSummary).catch(() => {});
  }, []);

  const totalXp = data?.total_xp ?? rewardsSummary?.total_xp ?? 0;
  const streak = rewardsSummary?.current_streak ?? 0;
  const comebackActive = rewardsSummary?.comeback_bonus_active ?? false;
  const themes = data?.catalog.filter((i) => i.type === 'theme') ?? [];

  // Build week dots — last 7 days synthetic from streak
  const weekDots = WEEK_LABELS.map((d, i) => {
    const daysAgo = 6 - i;
    const state = daysAgo === 0 ? 'today' : daysAgo <= streak ? 'done' : (comebackActive && daysAgo <= 3 ? 'miss' : 'miss');
    return { d, state };
  });
  // Override last day to "today"
  weekDots[6].state = 'today';

  // Level computation
  const level = Math.max(1, Math.floor(totalXp / 100) + 1);
  const xpThisLevel = totalXp % 100;
  const xpPct = xpThisLevel;

  const insight = digestPreview?.summary
    ?? (modalityPreferences.length > 0
      ? `You used ${modalityPreferences[0]} most this week. Keep building that habit.`
      : 'You focused longest on days you opened Calm Zone first — about 6 extra minutes per session.');

  // Theme swatches
  const THEME_SWATCHES: Record<string, string[]> = {
    bone:   ['#F5F0E7', '#E8E1D2', '#2A2620', '#9A9081'],
    dusk:   ['#E8E4DC', '#C5C9D4', '#3A3D4A', '#8A8FA0'],
    sage:   ['#EEEDE4', '#C7D2C0', '#3A4738', '#8FA088'],
    ember:  ['#F2E9DC', '#E0C8B0', '#5C3F30', '#A07C66'],
  };
  const themeCatalog = themes.length > 0 ? themes : [
    { id: 'bone',  name: 'Bone',  unlocked: true,  xp_required: 0 },
    { id: 'dusk',  name: 'Dusk',  unlocked: true,  xp_required: 50 },
    { id: 'sage',  name: 'Sage',  unlocked: true,  xp_required: 100 },
    { id: 'ember', name: 'Ember', unlocked: false, xp_required: 200 },
  ];

  const stats = [
    { l: 'Focus',          v: `${insights.sessions.length * 20}m`, s: 'this week' },
    { l: 'Sessions',       v: `${insights.sessions.length}`,        s: 'total' },
    { l: 'Avg score',      v: insights.sessions.length ? `${Math.round(insights.sessions.reduce((a, s) => a + s.focusScore, 0) / insights.sessions.length)}` : '—', s: 'focus score' },
  ];

  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Topline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0 }}>Me</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Effort over outcome · always</div>
      </div>

      {/* Two-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>

        {/* XP card */}
        <div style={{ padding: 28, borderRadius: 'var(--r-lg)', background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
          <div className="eyebrow">This week</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--reward-ink)' }}>
              {totalXp}
              <small style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-3)', fontWeight: 400, letterSpacing: 0, marginLeft: 8 }}>xp</small>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '-0.005em' }}>
              shown up <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{Math.min(streak + (comebackActive ? 1 : 0), 7)} of 7 days</b> — that's plenty
            </div>
          </div>
          <div style={{ marginTop: 18, height: 8, background: 'var(--bone-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--reward)', borderRadius: 999, width: xpPct + '%', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
            <span>level {level}</span>
            <span>{100 - xpThisLevel} to level {level + 1}</span>
          </div>

          {/* Stat row */}
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--hairline)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {stats.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontFamily: 'var(--serif)', letterSpacing: '-0.015em' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.l}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 2 }}>{s.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Streak card */}
        <div style={{ padding: 28, borderRadius: 'var(--r-lg)', background: 'var(--paper)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
          <div className="eyebrow">Showing up</div>
          <div style={{ marginTop: 6, fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {comebackActive ? 'You came back.' : streak > 3 ? 'On a roll.' : 'Keep going.'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            {comebackActive ? "That's the one that counts." : `${streak} day${streak !== 1 ? 's' : ''} and counting.`}
          </div>

          {/* Week dots */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 16 }}>
            {weekDots.map((d, i) => (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 8,
                background: d.state === 'done' ? 'var(--reward-wash)' : 'var(--bone-soft)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 10, padding: 6, color: 'var(--ink-4)',
                boxShadow: d.state === 'today' ? 'inset 0 0 0 1.5px var(--ink)' : 'none',
                position: 'relative',
              }}>
                {d.state === 'done' && (
                  <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--reward)' }} />
                )}
                {d.d}
              </div>
            ))}
          </div>

          {comebackActive && (
            <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--reward-wash)', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--reward-ink)', lineHeight: 1.5 }}>
              <b style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>Comeback bonus active</b> — today and tomorrow earn 2× XP. No streak was lost. There's no streak to lose.
            </div>
          )}
        </div>

        {/* Weekly insight — full width */}
        <div style={{ gridColumn: 'span 2', padding: 32, background: 'var(--paper)', borderRadius: 'var(--r-lg)', border: '1px solid var(--hairline)', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Weekly insight</div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
              from your sessions this week
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.35, textWrap: 'pretty', margin: '10px 0 0' }}>
              {insight.split(' ').map((word: string, i: number) => {
                const highlight = /\d+|longer|best|calm|focus/i.test(word);
                return highlight
                  ? <span key={i} style={{ color: 'var(--focus-ink)' }}>{word} </span>
                  : <span key={i}>{word} </span>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}>
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M4 8h8M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                See the data
              </button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}>
                Try it tomorrow
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Themes */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>Themes &amp; sound packs</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>unlock by showing up · no leaderboards</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {themeCatalog.map((t) => {
            const swatches = THEME_SWATCHES[t.id] ?? THEME_SWATCHES.bone;
            const isActive = t.id === 'bone';
            return (
              <div
                key={t.id}
                style={{
                  borderRadius: 'var(--r)', border: '1px solid var(--hairline)',
                  background: 'var(--paper)', overflow: 'hidden', cursor: 'pointer',
                  opacity: t.unlocked ? 1 : 0.6,
                  boxShadow: isActive ? 'inset 0 0 0 1.5px var(--ink)' : 'none',
                  transition: 'transform 140ms ease',
                }}
                onMouseEnter={(e) => { if (t.unlocked) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
              >
                <div style={{ height: 78, display: 'flex' }}>
                  {swatches.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 15, letterSpacing: '-0.01em' }}>{(t as {id:string;label?:string;name?:string}).label ?? (t as {id:string;label?:string;name?:string}).name ?? t.id}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {isActive ? 'in use' : t.unlocked ? 'tap to use' : `${t.xp_required} xp`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Talk to Anchor — PRD §7.10: chat affordance one tap deeper */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>AI Coach</h2>
        <button
          onClick={() => navigate('/coach')}
          style={{
            width: '100%', padding: '22px 28px',
            background: 'var(--paper)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-lg)', textAlign: 'left', cursor: 'pointer',
            display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 24,
            transition: 'box-shadow 140ms ease, transform 140ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 0 rgba(42,38,32,0.04), 0 8px 24px -8px rgba(42,38,32,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
        >
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '-0.01em', marginBottom: 4 }}>Talk to Anchor</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              A deeper coaching pass when the lighter tools aren't enough. Type or speak what's happening.
            </div>
          </div>
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16" style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
            <path d="M4 8h8M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Settings link */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/me/settings')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Settings & preferences
        </button>
        <button
          onClick={() => navigate('/quests')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M8 2v4M8 10v4M3.5 5l3 3-3 3M12.5 5l-3 3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Energy Quests
        </button>
      </div>
    </div>
  );
}
