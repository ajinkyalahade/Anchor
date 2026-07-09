import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

interface WeeklyDigest {
  title: string;
  summary: string;
  bullets: string[];
  delivery_label: string;
}

interface QuestPreview {
  title: string;
  summary: string;
  recommendation: string;
}

const CAFFEINE_OPTIONS = ['none', '1 cup', '2 cups', '3+ cups'];

export default function WeeklyInsightsPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState(5);
  const [morningScore, setMorningScore] = useState(70);
  const [sleepHours, setSleepHours] = useState(7.0);
  const [caffeine, setCaffeine] = useState('1 cup');
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [questPreview, setQuestPreview] = useState<QuestPreview | null>(null);

  const { mutate: generateDigest, isPending: digestPending } = useMutation({
    mutationFn: () =>
      api.post<WeeklyDigest>('/ai/weekly-digest/preview', {
        sessions_count: sessions,
        morning_focus_score: morningScore,
        best_focus_score: Math.min(morningScore + 15, 100),
        avg_session_minutes: 22,
        sleep_hours: sleepHours,
        caffeine_label: caffeine,
        delivery_label: 'Sunday, 9:00 AM',
      }),
    onSuccess: setDigest,
  });

  const { mutate: generateQuest, isPending: questPending } = useMutation({
    mutationFn: () =>
      api.post<QuestPreview>('/ai/quests/weekly-preview', {
        best_quest_label: 'Dance break',
        best_average_delta: 1.4,
        total_runs: sessions,
      }),
    onSuccess: setQuestPreview,
  });

  return (
    <div style={{ padding: '40px 56px 96px', maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--paper)', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bone-soft)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--paper)')}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>Weekly Insights</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Patterns from your week, read back to you.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — inputs + focus digest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats input */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>This week</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Focus sessions</span>
                <input
                  type="number" min={0} max={50} value={sessions}
                  onChange={(e) => setSessions(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--bone-soft)', fontSize: 14, color: 'var(--ink)', outline: 'none', width: '100%' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Morning focus score (0–100)</span>
                <input
                  type="number" min={0} max={100} value={morningScore}
                  onChange={(e) => setMorningScore(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--bone-soft)', fontSize: 14, color: 'var(--ink)', outline: 'none', width: '100%' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Avg sleep (hours)</span>
                <input
                  type="number" min={0} max={24} step={0.5} value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--bone-soft)', fontSize: 14, color: 'var(--ink)', outline: 'none', width: '100%' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Caffeine</span>
                <select
                  value={caffeine}
                  onChange={(e) => setCaffeine(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)', background: 'var(--bone-soft)', fontSize: 14, color: 'var(--ink)', outline: 'none', width: '100%' }}
                >
                  {CAFFEINE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>

            <button
              onClick={() => generateDigest()}
              disabled={digestPending}
              style={{ marginTop: 16, width: '100%', padding: '11px 16px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 13.5, fontWeight: 500, cursor: digestPending ? 'wait' : 'pointer', opacity: digestPending ? 0.6 : 1 }}
            >
              {digestPending ? 'Analysing…' : 'Generate focus digest'}
            </button>
          </div>

          {/* Quest preview */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Energy quests</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>
              See which quests actually moved your state this week.
            </div>
            <button
              onClick={() => generateQuest()}
              disabled={questPending}
              style={{ width: '100%', padding: '10px 16px', borderRadius: 999, background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', color: 'var(--ink-2)', fontSize: 13.5, cursor: questPending ? 'wait' : 'pointer', opacity: questPending ? 0.6 : 1 }}
            >
              {questPending ? 'Thinking…' : 'Quest personalisation'}
            </button>
          </div>
        </div>

        {/* Right — results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {digest ? (
            <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 28 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.015em', lineHeight: 1.3, color: 'var(--ink)', marginBottom: 12 }}>
                {digest.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 18 }}>
                {digest.summary}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {digest.bullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-4)', flexShrink: 0, marginTop: 6 }} />
                    {b}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{digest.delivery_label}</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bone-soft)', border: '1px dashed var(--hairline-strong)', borderRadius: 'var(--r-lg)', padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>
                Fill in your week and generate a digest to see patterns.
              </div>
            </div>
          )}

          {questPreview ? (
            <div style={{ background: 'var(--calm-wash)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 24 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 10 }}>
                {questPreview.title}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 14 }}>
                {questPreview.summary}
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--paper)', borderRadius: 'var(--r-sm)', fontSize: 13.5, color: 'var(--calm-ink)', lineHeight: 1.5 }}>
                <strong>Try:</strong> {questPreview.recommendation}
              </div>
              <button
                onClick={() => navigate('/quests')}
                style={{ marginTop: 12, fontSize: 13, color: 'var(--calm-ink)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', background: 'transparent' }}
              >
                Browse quests →
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
