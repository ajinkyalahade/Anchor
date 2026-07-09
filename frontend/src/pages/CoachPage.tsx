import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import VoiceInput from '../components/VoiceInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
}

interface CoachSession {
  id: string;
  started_at: string;
  summary: string | null;
}

interface CoachResponse {
  session_id: string;
  is_crisis?: boolean;
  crisis_message?: string;
  resources?: Array<{ name: string; number: string; action: string; region: string }>;
  opening?: string;
  reflection?: string;
  next_steps?: string[];
}

interface UserState {
  energy_level: number;
  emotional_load: number;
  cognitive_freshness: number;
  current_streak_state: string;
}

const PROMPTS = [
  'I know what to do, but I cannot start.',
  'Everything feels equally urgent right now.',
  'I keep switching tasks and not landing anywhere.',
  "I'm frustrated with myself today.",
];

function assembleText(r: CoachResponse): string {
  const parts: string[] = [];
  if (r.opening) parts.push(r.opening);
  if (r.reflection) parts.push(r.reflection);
  if (r.next_steps?.length) {
    r.next_steps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  }
  return parts.filter(Boolean).join('\n\n');
}

function energyLabel(n: number) {
  if (n >= 4) return 'high';
  if (n >= 3) return 'steady';
  if (n >= 2) return 'low';
  return 'very low';
}

export default function CoachPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [crisisPayload, setCrisisPayload] = useState<CoachResponse | null>(null);

  const userId = localStorage.getItem('anchor_user_id');

  const { data: userState } = useQuery<UserState>({
    queryKey: ['user-state', userId],
    queryFn: () => api.get<UserState>('/ai/user-state', userId ? { user_id: userId } : undefined),
    staleTime: 60_000,
    retry: false,
  });

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: (msg: string) =>
      api.post<CoachResponse>('/ai/coach', {
        message: msg,
        ...(sessionId ? { session_id: sessionId } : {}),
      }),
    onSuccess: (res, msg) => {
      if (!sessionId) setSessionId(res.session_id);

      if (res.is_crisis) {
        setCrisisPayload(res);
        return;
      }

      const assistantText = assembleText(res);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: msg, ts: new Date().toISOString() },
        { role: 'assistant', content: assistantText, ts: new Date().toISOString() },
      ]);
    },
    onError: (_err, msg) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: msg },
        {
          role: 'assistant',
          content:
            'You are carrying a lot right now, and it makes sense that your system is locking up.\n\nThis looks like overload plus friction, not laziness.\n\n1. Cut the task down to a two-minute entry step.\n2. Start one short timer instead of waiting to feel ready.\n3. Move one distraction out of reach before you begin.',
        },
      ]);
    },
  });

  const submit = () => {
    const msg = input.trim();
    if (!msg || isPending) return;
    setInput('');
    sendMessage(msg);
  };

  const reset = () => {
    setSessionId(null);
    setMessages([]);
    setCrisisPayload(null);
    setInput('');
    qc.invalidateQueries({ queryKey: ['user-state'] });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '28px 40px 20px', borderBottom: '1px solid var(--hairline)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 28, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>Talk to Anchor</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>A deeper pass when the lighter tools aren't enough.</div>
          </div>
          {/* Context pill */}
          {userState && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Energy</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>{energyLabel(userState.energy_level)}</div>
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={reset}
              style={{ fontSize: 12, color: 'var(--ink-3)', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--hairline)', cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bone-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Crisis overlay */}
      {crisisPayload && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          <div style={{ background: 'var(--rsd-wash)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--rsd-ink)' }}>You're not alone.</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6 }}>{crisisPayload.crisis_message}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {crisisPayload.resources?.map((r) => (
                <a key={r.number} href={`tel:${r.number}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--paper)', borderRadius: 'var(--r)', border: '1px solid var(--hairline)', textDecoration: 'none', color: 'var(--rsd-ink)' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.region}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 500 }}>{r.number}</div>
                </a>
              ))}
            </div>
            <button onClick={reset} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', textAlign: 'left' }}>
              Start a new conversation
            </button>
          </div>
        </div>
      )}

      {/* Message thread */}
      {!crisisPayload && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 24, paddingBottom: 16 }}>
              {/* Context card */}
              {userState && (
                <div style={{ background: 'var(--bone-soft)', borderRadius: 'var(--r)', padding: '14px 18px', display: 'flex', gap: 24, fontSize: 12.5, color: 'var(--ink-3)' }}>
                  <div><span style={{ color: 'var(--ink-4)', marginRight: 6 }}>Energy</span>{energyLabel(userState.energy_level)}</div>
                  <div><span style={{ color: 'var(--ink-4)', marginRight: 6 }}>Load</span>{userState.emotional_load}/5</div>
                  <div><span style={{ color: 'var(--ink-4)', marginRight: 6 }}>Streak</span>{userState.current_streak_state}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Quick starts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setInput(p); }}
                      style={{ fontSize: 12.5, padding: '7px 13px', borderRadius: 999, background: 'var(--paper)', border: '1px solid var(--hairline)', color: 'var(--ink-3)', cursor: 'pointer', transition: 'background 120ms' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bone-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--paper)')}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10, marginTop: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)' }} />
                </div>
              )}
              <div
                style={{
                  maxWidth: '78%',
                  padding: m.role === 'user' ? '10px 16px' : '14px 18px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'var(--ink)' : 'var(--paper)',
                  border: m.role === 'assistant' ? '1px solid var(--hairline)' : 'none',
                  color: m.role === 'user' ? 'var(--bone)' : 'var(--ink)',
                  fontSize: m.role === 'user' ? 14 : 15,
                  lineHeight: 1.6,
                  letterSpacing: '-0.005em',
                  whiteSpace: 'pre-wrap',
                  fontFamily: m.role === 'assistant' ? 'var(--serif)' : 'inherit',
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isPending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)' }} />
              </div>
              <div style={{ padding: '10px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-3)', animation: `bounce 1.2s ${d * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      {!crisisPayload && (
        <div style={{ padding: '16px 40px 28px', borderTop: '1px solid var(--hairline)', flexShrink: 0, background: 'var(--bone)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '12px 14px' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Type it the way it lives in your head…"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 0, outline: 0,
                fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '-0.01em',
                lineHeight: 1.5, color: 'var(--ink)', resize: 'none',
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 140) + 'px';
              }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <VoiceInput onTranscript={(t) => setInput((c) => c ? `${c} ${t}` : t)} />
              <button
                onClick={submit}
                disabled={isPending || !input.trim()}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: (isPending || !input.trim()) ? 'var(--bone-deep)' : 'var(--ink)',
                  color: (isPending || !input.trim()) ? 'var(--ink-4)' : 'var(--bone)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (isPending || !input.trim()) ? 'default' : 'pointer',
                  transition: 'background 120ms',
                  flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-4)', textAlign: 'center' }}>
            AI-generated. Not a substitute for clinical support. ·{' '}
            <button onClick={() => navigate('/calm')} style={{ color: 'var(--calm-ink)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontSize: 11.5 }}>
              Crisis support
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
