import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { loadInsightDashboard } from '../lib/insights';
import { computeModalityPreferences, personalizeSuggestion } from '../lib/personalization';
import { loadQuestStore } from '../lib/quests';

interface Suggestion {
  action: string;
  label: string;
  route: string;
  duration: string;
  reason: string;
  week_label: string | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function now() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function today() {
  return new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

const TODAY_LOG: { time: string; label: string; tag: string; state: string }[] = [];

export default function HomePage() {
  const navigate = useNavigate();
  const greeting = getGreeting();
  const firstName = localStorage.getItem('anchor_first_name') || '';

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [altSuggestions, setAltSuggestions] = useState<Suggestion[]>([]);

  const insightData = useMemo(() => loadInsightDashboard(), []);
  const questStore = useMemo(() => loadQuestStore(), []);
  const modalityPreferences = useMemo(
    () => computeModalityPreferences(insightData.sessions, questStore.logs),
    [insightData.sessions, questStore.logs],
  );

  useEffect(() => {
    const userId = window.localStorage.getItem('anchor_user_id');
    const suggestionParams = userId ? `?user_id=${userId}` : '';
    api.get<Suggestion>(`/ai/suggestion${suggestionParams}`)
      .then((s) => {
        const personalised = personalizeSuggestion(s, modalityPreferences, questStore.logs);
        setSuggestion(personalised);
        setAltSuggestions([
          { action: 'breathe', label: 'Two rounds of box breathing, then decide.', route: '/calm/breathe', duration: '3 min · Calm', reason: 'You\'ve only used Calm once this week.', week_label: null },
          { action: 'games', label: 'A 90-second round of Echo to warm up.', route: '/games/echo', duration: '90 sec · Games', reason: 'Low-stakes start before the big thing.', week_label: null },
        ]);
      })
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 429)) {
          setSuggestion({ action: 'focus', label: 'A 20-minute focus block.', route: '/focus', duration: '20 min · Focus', reason: 'Based on your usual rhythm.', week_label: null });
        }
      });
  }, [modalityPreferences, questStore.logs]);

  const allSuggestions = suggestion ? [suggestion, ...altSuggestions] : altSuggestions;
  const current = allSuggestions[suggestionIdx % Math.max(allSuggestions.length, 1)];

  const swapSuggestion = () => setSuggestionIdx((i) => i + 1);

  const quickTiles = [
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M2 6h7a2 2 0 1 0-2-2M2 10h10a2 2 0 1 1-2 2M2 8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
      bg: 'var(--calm-wash)', color: 'var(--calm-ink)',
      name: 'Breathe for 90 sec',
      why: 'Two rounds of box breathing. Lowers the noise before you decide anything.',
      to: '/calm/breathe',
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M8 9.5V14M5 3h6l-1 4.5H6L5 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      ),
      bg: 'var(--focus-wash)', color: 'var(--focus-ink)',
      name: 'Park a thought',
      why: 'Drop the intrusive thing into the inbox. It will still be there in 20 minutes.',
      to: '/focus',
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M8 2v4M8 10v4M3.5 5l3 3-3 3M12.5 5l-3 3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      bg: 'var(--reward-wash)', color: 'var(--reward-ink)',
      name: 'Energy Quest · 2 min',
      why: 'A quick physical reset that actually shifts your state. Mood-tracked, every time.',
      to: '/quests',
    },
  ];

  const dotColor = (state: string) =>
    state === 'done' ? 'var(--calm)' : state === 'now' ? 'var(--focus)' : 'var(--ink-4)';
  const dotShadow = (state: string) =>
    state === 'now' ? '0 0 0 4px var(--focus-wash)' : 'none';

  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Topline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '0.02em' }}>
          <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{today().split(',')[0]}</b>, {today().split(',').slice(1).join(',').trim()} ·{' '}
          <span style={{ color: 'var(--ink-3)' }}>{now()}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          Energy <b style={{ color: 'var(--calm-ink)', fontWeight: 500 }}>steady</b>
        </div>
      </div>

      {/* Greeting */}
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 8px' }}>
        {greeting}, <span style={{ color: 'var(--ink-3)' }}>{firstName ? `${firstName}.` : 'you.'}</span>
      </h1>
      <div style={{ color: 'var(--ink-3)', fontSize: 14.5, marginTop: 4 }}>
        Nothing urgent. Here's one good place to start.
      </div>

      {/* Suggestion card */}
      <div style={{
        marginTop: 28, padding: '28px 32px',
        borderRadius: 'var(--r-lg)',
        background: 'var(--paper)',
        border: '1px solid var(--hairline)',
        display: 'grid', gridTemplateColumns: '1fr auto',
        gap: 24, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '-0.005em', marginBottom: 6 }}>
            {current?.reason ?? 'Suggested · based on your rhythm'}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.25 }}>
            {current?.label ?? 'A 20-minute focus block.'}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ background: 'var(--focus-wash)', color: 'var(--focus-ink)', padding: '3px 10px', borderRadius: 999, fontSize: 12 }}>
              {current?.duration ?? '20 min · Focus'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <button
            onClick={() => current && navigate(current.route)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 999,
              fontSize: 14, fontWeight: 500,
              background: 'var(--ink)', color: 'var(--bone)',
              transition: 'transform 120ms ease, background 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1814')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
          >
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg>
            Start session
          </button>
          <button
            onClick={swapSuggestion}
            style={{ fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
          >
            Suggest something else
          </button>
        </div>
      </div>

      {/* Talk to Anchor — one tap deeper, per PRD §7.10 */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => navigate('/coach')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)', letterSpacing: '-0.005em', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M13 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM8 5v3l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Talk to Anchor
        </button>
      </div>

      {/* Quick tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 32 }}>
        {quickTiles.map((tile) => (
          <button
            key={tile.name}
            onClick={() => navigate(tile.to)}
            style={{
              padding: '18px 18px 22px',
              borderRadius: 'var(--r)',
              background: 'var(--paper)',
              border: '1px solid var(--hairline)',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 10,
              minHeight: 130,
              transition: 'transform 120ms ease, box-shadow 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 0 rgba(42,38,32,0.04), 0 8px 24px -8px rgba(42,38,32,0.10)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: tile.bg, color: tile.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tile.icon}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{tile.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.4, marginTop: 'auto' }}>{tile.why}</div>
          </button>
        ))}
      </div>

      {/* Today timeline */}
      <div style={{ marginTop: 40, padding: 24, background: 'var(--paper)', borderRadius: 'var(--r)', border: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>
            Today, gently
          </h2>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>your activity today</div>
        </div>
        {TODAY_LOG.length === 0 ? (
          <div style={{ padding: '16px 0', fontSize: 13.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>
            Nothing logged yet today. Start a session to see your activity here.
          </div>
        ) : TODAY_LOG.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'grid', gridTemplateColumns: '60px 16px 1fr auto',
              gap: 14, alignItems: 'center', padding: '10px 0',
              borderTop: i > 0 ? '1px dashed var(--hairline)' : 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{row.time}</div>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dotColor(row.state),
              boxShadow: dotShadow(row.state),
              justifySelf: 'center',
            }} />
            <div style={{ fontSize: 14, color: row.state === 'upcoming' ? 'var(--ink-3)' : 'var(--ink)' }}>{row.label}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{row.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
