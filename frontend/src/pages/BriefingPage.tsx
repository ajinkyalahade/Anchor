import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface BriefingResponse {
  greeting: string;
  energy_read: string;
  suggested_first_action: string;
  affirmation: string;
  cached: boolean;
}

export default function BriefingPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('anchor_user_id');

  const { data, isLoading, error, refetch } = useQuery<BriefingResponse>({
    queryKey: ['daily-briefing', userId],
    queryFn: () => api.get<BriefingResponse>('/ai/briefing', userId ? { user_id: userId } : undefined),
    staleTime: 3_600_000,
    retry: false,
  });

  return (
    <div style={{ padding: '40px 56px 96px', maxWidth: 680 }}>

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
          <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>Daily Briefing</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>A read on where you are and what to do first.</div>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 80 + i * 20, borderRadius: 'var(--r-lg)', background: 'var(--bone-soft)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 28, textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 15, marginBottom: 14 }}>Couldn't load your briefing right now.</div>
          <button
            onClick={() => refetch()}
            style={{ fontSize: 13, padding: '8px 18px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--bone-soft)', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Greeting */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '32px 36px' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.3, color: 'var(--ink)', marginBottom: 16 }}>
              {data.greeting}
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65 }}>
              {data.energy_read}
            </div>
            {data.cached && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>cached · refreshes hourly</div>
            )}
          </div>

          {/* Suggested first action */}
          <div style={{ background: 'var(--focus-wash)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '22px 28px', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--focus-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <path d="M8 3v5l3 2" stroke="var(--bone)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="5.5" stroke="var(--bone)" strokeWidth="1.4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--focus-ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>First move</div>
              <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.5, letterSpacing: '-0.005em' }}>{data.suggested_first_action}</div>
            </div>
          </div>

          {/* Affirmation */}
          <div style={{ padding: '20px 28px', borderRadius: 'var(--r)', background: 'var(--bone-soft)', display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>◇</span>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '-0.01em', color: 'var(--ink-2)', lineHeight: 1.5, fontStyle: 'italic' }}>
              {data.affirmation}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={() => navigate('/focus')}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              Start a focus session →
            </button>
            <button
              onClick={() => navigate('/coach')}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 999, background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer' }}
            >
              Talk to Anchor
            </button>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', textAlign: 'center' }}>AI-generated. Refreshes daily.</div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
