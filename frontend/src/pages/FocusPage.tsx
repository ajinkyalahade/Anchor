import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api';
import { recordAIFeedback } from '../lib/aiFeedback';
import { recordFocusInsightSession } from '../lib/insights';
import { grantReward } from '../lib/rewards';

const TASK_TEXT_MAX_LENGTH = 500;

interface DecompositionStep {
  label: string;
  est_minutes: number;
  first: boolean;
  completed?: boolean;
}

interface DecompositionResponse {
  steps: DecompositionStep[];
  why_first_step_matters: string;
}

function TimerBar({ pct, sessionLen }: { pct: number; sessionLen: number }) {
  return (
    <div>
      <div className="timebar" aria-label="time remaining">
        <div className="timebar-fill" style={{ width: pct + '%' }} />
        <div className="timebar-ticks">
          {Array.from({ length: sessionLen }).map((_, i) => <span key={i} />)}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: 4 }}>
        <span>now</span><span>{sessionLen} min</span>
      </div>
    </div>
  );
}

export default function FocusPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [taskText, setTaskText] = useState('');
  const [durationPreset, setDurationPreset] = useState(20);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decomposition, setDecomposition] = useState<DecompositionResponse | null>(null);
  const [decomposeError, setDecomposeError] = useState('');

  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(20 * 60);
  const [totalSeconds, setTotalSeconds] = useState(20 * 60);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [distractions, setDistractions] = useState<string[]>([]);
  const decomposeStartTime = useRef<number>(0);
  const [done, setDone] = useState(false);

  const [parkInput, setParkInput] = useState('');
  const [parked, setParked] = useState<string[]>([]);

  useEffect(() => {
    const prefill = (location.state as { prefillTask?: string } | null)?.prefillTask?.trim();
    if (prefill && !taskText) {
      setTaskText(prefill.slice(0, TASK_TEXT_MAX_LENGTH));
      window.history.replaceState({}, document.title);
    }
  }, [location.state, taskText]);

  const finishSession = useCallback(() => {
    setRunning(false);
    setDone(true);
    if (!rewardGranted) {
      setRewardGranted(true);
      recordFocusInsightSession(durationPreset);
      void grantReward('focus', Math.max(10, Math.round(durationPreset / 2)), 'completed focus session')
        .then(() => qc.invalidateQueries({ queryKey: ['rewards-summary'] }))
        .catch(() => {});
    }
    if (serverSessionId) {
      const elapsed = totalSeconds - secondsLeft;
      const completedSteps = decomposition?.steps.filter((s) => s.completed).length ?? 0;
      void api.patch(`/focus/sessions/${serverSessionId}`, {
        duration_actual: elapsed,
        completed_steps_int: completedSteps,
        distractions_jsonb: distractions,
      }).catch(() => {});
    }
  }, [durationPreset, rewardGranted, serverSessionId, totalSeconds, secondsLeft, decomposition, distractions]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setTimeout(() => {
      if (secondsLeft <= 1) { finishSession(); return; }
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [running, secondsLeft, finishSession]);

  const selectDuration = (mins: number) => {
    if (running) return;
    setDurationPreset(mins);
    setSecondsLeft(mins * 60);
    setTotalSeconds(mins * 60);
    setRewardGranted(false);
  };

  const toggleStep = (i: number) => {
    if (!decomposition) return;
    const next = [...decomposition.steps];
    next[i] = { ...next[i], completed: !next[i].completed };
    setDecomposition({ ...decomposition, steps: next });
  };

  const handleDecompose = async () => {
    if (!taskText.trim() || isDecomposing) return;
    setDecomposeError('');
    setIsDecomposing(true);
    decomposeStartTime.current = Date.now();
    try {
      const res = await api.post<DecompositionResponse>('/focus/decompose', { task_text: taskText.trim() });
      setDecomposition(res);
      void recordAIFeedback({
        task: 'decompose',
        promptId: 'decompose@v1',
        content: JSON.stringify(res.steps),
        latencyMs: Date.now() - decomposeStartTime.current,
        helpful: 1,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setDecomposeError("Give the AI a moment, or start the timer without the breakdown.");
      } else {
        setDecomposeError("We'll skip the breakdown for now. Start the timer when you're ready.");
      }
    } finally {
      setIsDecomposing(false);
    }
  };

  const resetSession = () => {
    setDone(false);
    setRunning(false);
    setSecondsLeft(durationPreset * 60);
    setTotalSeconds(durationPreset * 60);
    setRewardGranted(false);
  };

  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  const parkThought = (t: string) => {
    if (t.trim()) {
      setParked((p) => [...p, t.trim()]);
      setDistractions((d) => [...d, t.trim()]);
    }
  };
  const removeParked = (i: number) => setParked((p) => p.filter((_, ii) => ii !== i));

  // Done state
  if (done) {
    return (
      <div className="screen" style={{ padding: '40px 56px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', gap: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--reward-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✓</div>
        <div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Focus complete.</h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 15 }}>You showed up. That's what counts.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 16 }}>
          <button onClick={resetSession} style={{ padding: '12px 20px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500 }}>
            New Session
          </button>
          <button onClick={() => navigate('/calm')} style={{ padding: '12px 20px', borderRadius: 999, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', fontSize: 14 }}>
            Take a Break (Calm Zone)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Topline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>Focus</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>One task. First step under two minutes.</div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>

        {/* LEFT — task + steps */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>What needs doing</div>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value.slice(0, TASK_TEXT_MAX_LENGTH))}
            placeholder="Type it the way it lives in your head…"
            rows={2}
            style={{
              width: '100%', background: 'transparent', border: 0, outline: 0,
              fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '-0.015em',
              lineHeight: 1.3, color: 'var(--ink)', resize: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              {taskText.length === 0 ? 'or try a recent one →' : `${taskText.length} chars`}
            </div>
            <button
              onClick={handleDecompose}
              disabled={isDecomposing || !taskText.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 999,
                fontSize: 14, fontWeight: 500,
                background: 'var(--focus-wash)', color: 'var(--focus-ink)',
                opacity: (isDecomposing || !taskText.trim()) ? 0.5 : 1,
                transition: 'opacity 120ms',
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {isDecomposing ? 'Breaking it down…' : 'Break into micro-steps'}
            </button>
          </div>

          {!taskText && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {['Write the quarterly review draft', "Reply to Mom's text", 'Read the long paper'].map((s) => (
                <button key={s} onClick={() => setTaskText(s)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, background: 'var(--bone-soft)', color: 'var(--ink-3)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {decomposeError && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--reward-wash)', fontSize: 13, color: 'var(--reward-ink)' }}>
              {decomposeError}
            </div>
          )}

          {decomposition && (
            <>
              <div className="eyebrow" style={{ marginTop: 28, marginBottom: 4 }}>Micro-steps</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 6 }}>
                You don't have to decide what's next. The next one is always already chosen.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {decomposition.steps.map((step, i) => {
                  const firstUndone = decomposition.steps.findIndex((s) => !s.completed);
                  const isFirst = i === firstUndone;
                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr auto',
                      gap: 14, alignItems: 'center', padding: '14px 4px',
                      borderTop: '1px solid var(--hairline)',
                      opacity: step.completed ? 0.4 : 1,
                      transition: 'opacity 200ms ease',
                    }}>
                      <button
                        onClick={() => toggleStep(i)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          border: step.completed ? 'none' : '1.5px solid var(--hairline-strong)',
                          background: step.completed ? 'var(--calm)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {step.completed && (
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                            <path d="M4 8.5l3 3 5-6" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 12 }}>0{i + 1}</span>
                        <span style={{ fontSize: 15, lineHeight: 1.4, letterSpacing: '-0.005em', textDecoration: step.completed ? 'line-through' : 'none' }}>
                          {step.label}
                        </span>
                        {isFirst && !step.completed && (
                          <span style={{ marginLeft: 10, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--focus-ink)', background: 'var(--focus-wash)', padding: '2px 8px', borderRadius: 4, verticalAlign: 'middle' }}>
                            start here
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)' }}>~{step.est_minutes}m</span>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid var(--hairline)' }} />
              </div>
            </>
          )}
        </div>

        {/* RIGHT — timer + distraction park */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24, height: 'fit-content' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                {running ? 'In flow' : 'Ready when you are'}
              </div>
              <div style={{ marginTop: 6, fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {String(mm).padStart(2, '0')}<span style={{ color: 'var(--ink-4)' }}>:</span>{String(ss).padStart(2, '0')}
              </div>
            </div>

            <TimerBar pct={pct} sessionLen={durationPreset} />

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Session length</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[15, 20, 25].map((n) => (
                  <button
                    key={n}
                    onClick={() => selectDuration(n)}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 'var(--r-sm)',
                      background: durationPreset === n ? 'var(--ink)' : 'var(--bone-soft)',
                      color: durationPreset === n ? 'var(--bone)' : 'var(--ink-2)',
                      fontSize: 13, fontFamily: 'var(--mono)',
                      transition: 'background 120ms',
                    }}
                  >
                    {n} min
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={async () => {
              if (running) {
                setRunning(false);
              } else {
                setRunning(true);
                if (!serverSessionId) {
                  try {
                    const res = await api.post<{ id: string }>('/focus/sessions', {
                      duration_planned: durationPreset * 60,
                      task_text: taskText.trim() || null,
                      decomposition_jsonb: decomposition ?? null,
                    });
                    setServerSessionId(res.id);
                  } catch { /* non-fatal */ }
                }
              }
            }}
              style={{
                width: '100%', padding: 14,
                borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)',
                fontSize: 14, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {running ? (
                <><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><rect x="4" y="3" width="3" height="10" fill="currentColor" rx="0.5"/><rect x="9" y="3" width="3" height="10" fill="currentColor" rx="0.5"/></svg> Pause</>
              ) : (
                <><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg> {secondsLeft < durationPreset * 60 ? 'Resume' : 'Start session'}</>
              )}
            </button>

            {running && (
              <button
                onClick={finishSession}
                style={{ fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'center' }}
              >
                I'm done early
              </button>
            )}
          </div>

          {/* Distraction park */}
          <div style={{ padding: '18px 20px', borderRadius: 'var(--r)', background: 'var(--bone-soft)', border: '1px dashed var(--hairline-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '-0.01em' }}>Distraction park</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>It will still be there.</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{parked.length} parked</span>
            </div>
            <div style={{ display: 'flex', gap: 8, background: 'var(--paper)', padding: '8px 10px 8px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)' }}>
              <input
                placeholder="buy birthday gift, email landlord…"
                value={parkInput}
                onChange={(e) => setParkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parkInput.trim()) { parkThought(parkInput); setParkInput(''); }
                }}
                style={{ flex: 1, background: 'transparent', border: 0, outline: 0, fontSize: 13.5 }}
              />
              <button
                onClick={() => { parkThought(parkInput); setParkInput(''); }}
                style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 6, background: 'var(--bone-soft)' }}
              >
                park
              </button>
            </div>
            {parked.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parked.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--paper)', borderRadius: 6, fontSize: 13, border: '1px solid var(--hairline)' }}>
                    <span>{p}</span>
                    <button
                      onClick={() => removeParked(i)}
                      style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-4)')}
                    >
                      release
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
