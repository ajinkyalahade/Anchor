import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { recordAIFeedback } from '../lib/aiFeedback';

type CalmTool = 'breathe' | 'ground' | 'rsd' | 'spiral';
type BreathPattern = '4-7-8' | 'Box (4-4-4-4)' | 'Physiological sigh';

interface RsdResponse {
  is_crisis?: boolean;
  crisis_message?: string;
  resources?: { name: string; number: string; action: string; region: string }[];
  validation?: string;
  normalization?: string;
  reframe?: string | null;
}

const GROUND_STEPS = [
  { n: 5, label: 'things you can see',   small: 'name them out loud or in your head' },
  { n: 4, label: 'things you can feel',  small: 'fabric on your skin, weight in your shoes' },
  { n: 3, label: 'things you can hear',  small: 'one near, one mid, one far' },
  { n: 2, label: 'things you can smell', small: 'coffee, soap, the air itself' },
  { n: 1, label: 'thing you can taste',  small: 'this is enough' },
];

const EMOTIONS = ['Rejected', 'Dismissed', 'Embarrassed', 'Invisible', 'Misread', 'Ashamed'];

const TOOLS: { id: CalmTool; name: string; sub: string; icon: React.ReactNode; rsd?: boolean }[] = [
  {
    id: 'breathe', name: 'Breathe', sub: '4-7-8 · box · sigh',
    icon: <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M2 6h7a2 2 0 1 0-2-2M2 10h10a2 2 0 1 1-2 2M2 8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    id: 'ground', name: 'Ground', sub: '5-4-3-2-1 senses',
    icon: <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 8V4.5a1 1 0 1 1 2 0V8M7 8V3.5a1 1 0 1 1 2 0V8M9 8V4a1 1 0 1 1 2 0v4M11 6.5a1 1 0 1 1 2 0V11c0 2-1.5 3-3.5 3H7c-1.5 0-2.5-.5-3-2L3 9.5a1 1 0 0 1 1.7-1L5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'rsd', name: 'Something just hurt', sub: 'RSD interrupt', rsd: true,
    icon: <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M8 13S2.5 9.5 2.5 6.2A2.7 2.7 0 0 1 8 5.5a2.7 2.7 0 0 1 5.5.7C13.5 9.5 8 13 8 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  },
  {
    id: 'spiral', name: 'Stop the spiral', sub: '90-second guided script',
    icon: <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M4 11h7a3 3 0 0 0 .3-6A4 4 0 0 0 4 7v.1A2.5 2.5 0 1 0 4 11Z" stroke="currentColor" strokeWidth="1.3"/></svg>,
  },
];

function BreathStage({ pattern, setPattern }: { pattern: BreathPattern; setPattern: (p: BreathPattern) => void }) {
  const [phase, setPhase] = useState('Inhale');

  // Drives the breathing animation via a self-scheduling timer loop —
  // a genuine external-system sync, so the initial setPhase is intentional.
  useEffect(() => {
    const cycles: Record<BreathPattern, { p: string; d: number }[]> = {
      '4-7-8':            [{ p: 'Inhale', d: 4000 }, { p: 'Hold', d: 7000 }, { p: 'Exhale', d: 8000 }],
      'Box (4-4-4-4)':    [{ p: 'Inhale', d: 4000 }, { p: 'Hold', d: 4000 }, { p: 'Exhale', d: 4000 }, { p: 'Hold', d: 4000 }],
      'Physiological sigh':[{ p: 'Inhale', d: 2000 }, { p: 'Inhale', d: 1000 }, { p: 'Exhale slowly', d: 6000 }],
    };
    let i = 0;
    const cycle = cycles[pattern];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(cycle[0].p);
    const tick = () => { i = (i + 1) % cycle.length; setPhase(cycle[i].p); timer = setTimeout(tick, cycle[i].d); };
    let timer = setTimeout(tick, cycle[0].d);
    return () => clearTimeout(timer);
  }, [pattern]);

  const orbClass = pattern === 'Box (4-4-4-4)' ? 'orb box' : pattern === 'Physiological sigh' ? 'orb sigh' : 'orb';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em' }}>Breath coach</div>
        <select
          value={pattern}
          onChange={(e) => setPattern(e.target.value as BreathPattern)}
          style={{ background: 'var(--bone-soft)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--mono)', outline: 'none' }}
        >
          <option>4-7-8</option>
          <option>Box (4-4-4-4)</option>
          <option>Physiological sigh</option>
        </select>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <div style={{ width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '1px dashed var(--hairline-strong)' }} />
          <div className={orbClass} />
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink-2)' }}>{phase}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{pattern} · round 2 of 4</div>
      </div>
    </>
  );
}

function GroundStage() {
  const [step, setStep] = useState(0);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em' }}>5 · 4 · 3 · 2 · 1</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Voice or thought. Both work.</div>
        </div>
        <button
          onClick={() => setStep((s) => Math.min(s + 1, GROUND_STEPS.length - 1))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}
        >
          Next
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M4 8h8M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {GROUND_STEPS.map((s, i) => (
          <div key={i} style={{
            padding: '18px 22px', borderRadius: 'var(--r)',
            background: i === step ? 'var(--calm-wash)' : 'var(--bone-soft)',
            display: 'grid', gridTemplateColumns: '36px 1fr', gap: 16, alignItems: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: i === step ? 'var(--calm)' : 'var(--paper)',
              border: i === step ? 'none' : '1px solid var(--hairline)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--serif)', fontSize: 18, color: i === step ? 'var(--paper)' : 'var(--ink-2)',
            }}>
              {s.n}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '-0.005em' }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{s.small}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RsdStage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [emotion, setEmotion] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(60);
  const [rsdText, setRsdText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rsdResponse, setRsdResponse] = useState<RsdResponse | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const rsdStartTime = useRef<number>(0);

  const submitRSD = async () => {
    setIsSubmitting(true);
    rsdStartTime.current = Date.now();
    try {
      const res = await api.post<RsdResponse>('/calm/rsd', { trigger_text: rsdText || (emotion ?? 'feeling hurt'), intensity: Math.round(intensity / 10) });
      setRsdResponse(res);
      if (!res.is_crisis) {
        void recordAIFeedback({
          task: 'rsd',
          promptId: 'rsd@v1',
          content: res.validation ?? '',
          latencyMs: Date.now() - rsdStartTime.current,
          helpful: 1,
        });
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 429)) {
        setRsdResponse({ validation: "I'm so sorry you're hurting.", normalization: "Your feelings are valid. Take a slow breath.", reframe: null });
      }
    } finally {
      setIsSubmitting(false);
      setShowResponse(true);
    }
  };

  if (showResponse && rsdResponse) {
    if (rsdResponse.is_crisis) {
      return (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em', color: 'var(--rsd-ink)' }}>You're not alone.</div>
            <button onClick={() => { setShowResponse(false); setRsdResponse(null); }} style={{ fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 3 }}>start over</button>
          </div>
          <div style={{ padding: 22, borderRadius: 'var(--r)', background: 'var(--rsd-wash)', fontSize: 15, lineHeight: 1.6, color: 'var(--rsd-ink)', marginBottom: 16 }}>
            {t('calm.crisis.message')}
          </div>
          <div style={{ padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'var(--paper)', border: '1px solid var(--hairline)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 13 }}>Crisis safety layer</b>
            <div style={{ marginTop: 4 }}>If you're in danger, call <b style={{ color: 'var(--ink)' }}>988</b> or your local emergency line.</div>
          </div>
        </>
      );
    }
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em' }}>Heard.</div>
          <button onClick={() => { setShowResponse(false); setRsdResponse(null); setEmotion(null); setRsdText(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)' }}>start over</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--rsd-wash)', padding: 22, borderRadius: 'var(--r)', fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.55, color: 'var(--rsd-ink)' }}>
            {rsdResponse.validation} {rsdResponse.normalization}
          </div>
          {rsdResponse.reframe && (
            <div style={{ background: 'var(--bone-soft)', padding: 20, borderRadius: 'var(--r)', fontSize: 14, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.55 }}>
              {rsdResponse.reframe}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/calm')} style={{ padding: '10px 16px', borderRadius: 999, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', fontSize: 14 }}>Sit with it</button>
            <button onClick={() => navigate('/calm')} style={{ padding: '10px 16px', borderRadius: 999, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', fontSize: 14 }}>Move my body for 60 sec</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>Nothing here is recorded. This conversation closes when you close it.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em' }}>Something just hurt.</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>No diagnosis. No homework.</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ padding: 36, borderRadius: 'var(--r-lg)', background: 'var(--rsd-wash)', border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--rsd-ink)', lineHeight: 1.2 }}>It makes sense that you're here.</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>Pick what's closest. Approximate is fine.</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Closest feeling</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {EMOTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmotion(e)}
                style={{
                  padding: '14px 8px', borderRadius: 'var(--r-sm)', fontSize: 13, color: emotion === e ? 'var(--rsd-ink)' : 'var(--ink-2)',
                  background: emotion === e ? 'var(--rsd-wash)' : 'var(--bone-soft)',
                  boxShadow: emotion === e ? 'inset 0 0 0 1px var(--rsd)' : 'none',
                  transition: 'background 120ms',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>How loud is it</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ink-3)' }}>
            <span>quiet</span>
            <div style={{ flex: 1, height: 10, background: 'var(--bone-soft)', borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'var(--rsd)', borderRadius: 999, width: intensity + '%', transition: 'width 60ms' }} />
            </div>
            <span>roaring</span>
          </div>
          <input type="range" min="0" max="100" value={intensity} onChange={(e) => setIntensity(+e.target.value)} style={{ width: '100%', marginTop: 8, accentColor: 'var(--rsd)' }} />
        </div>
        {emotion && (
          <button
            onClick={submitRSD}
            disabled={isSubmitting}
            style={{ padding: '12px 20px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500 }}
          >
            {isSubmitting ? 'A moment…' : 'Help me process this'}
          </button>
        )}
      </div>
    </>
  );
}

function SpiralStage() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPct((p) => Math.min(p + 100 / 90, 100)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.015em' }}>Stop the spiral</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>90 seconds · ends with one small thing</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: 'var(--calm-wash)', padding: 22, borderRadius: 'var(--r)', fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.6, color: 'var(--calm-ink)', minHeight: 200 }}>
          Notice you're spiralling. That's already half of it. The thought is repeating because it wants you safe, not because it's true. Soften the jaw. Drop the shoulders an inch. One slow exhale — longer than the inhale. The room is still here. You are still here. The next minute is the only one that matters.
        </div>
        <div style={{ padding: 20, border: '1px dashed var(--hairline-strong)', borderRadius: 'var(--r)', fontSize: 14, color: 'var(--ink-2)' }}>
          <b style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 17, display: 'block', marginBottom: 4 }}>One small thing</b>
          Stand up. Drink half a glass of water. That's the whole exit ramp.
        </div>
        <div className="timebar" style={{ height: 10 }}>
          <div className="timebar-fill" style={{ width: pct + '%', background: 'var(--calm)', transition: 'width 1s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
          <span>0:00</span><span>1:30</span>
        </div>
      </div>
    </>
  );
}

export default function CalmPage() {
  const [tool, setTool] = useState<CalmTool>('breathe');
  const [breathPattern, setBreathPattern] = useState<BreathPattern>('4-7-8');

  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Topline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0 }}>Calm</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No voice unless you ask for one</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>

        {/* LEFT — tool picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              style={{
                display: 'grid', gridTemplateColumns: '38px 1fr', alignItems: 'center', gap: 14,
                padding: '18px 20px', borderRadius: 'var(--r)', textAlign: 'left', cursor: 'pointer',
                background: t.rsd ? 'var(--rsd-wash)' : (tool === t.id ? 'var(--calm-wash)' : 'var(--paper)'),
                border: '1px solid ' + (tool === t.id ? (t.rsd ? 'var(--rsd)' : 'var(--calm)') : 'var(--hairline)'),
                transition: 'background 140ms ease',
              }}
              onMouseEnter={(e) => { if (tool !== t.id) e.currentTarget.style.background = t.rsd ? 'var(--rsd-wash)' : 'var(--calm-wash)'; }}
              onMouseLeave={(e) => { if (tool !== t.id) e.currentTarget.style.background = t.rsd ? 'var(--rsd-wash)' : 'var(--paper)'; }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: tool === t.id ? 'var(--paper)' : (t.rsd ? 'var(--paper)' : 'var(--calm-wash)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.rsd ? 'var(--rsd-ink)' : 'var(--calm-ink)',
              }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em', color: t.rsd ? 'var(--rsd-ink)' : 'var(--ink)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t.sub}</div>
              </div>
            </button>
          ))}

          {/* Safety card */}
          <div style={{ marginTop: 4, padding: '14px 18px', borderRadius: 'var(--r-sm)', background: 'var(--paper)', border: '1px solid var(--hairline)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 13 }}>Crisis safety layer</b>
            <div style={{ marginTop: 4 }}>Anything you write is screened before any AI sees it. If you're in danger, the app puts <b style={{ color: 'var(--ink)' }}>988</b> and your local lines in front instead.</div>
          </div>
        </div>

        {/* RIGHT — active stage */}
        <div style={{
          background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: 36,
          minHeight: 540, display: 'flex', flexDirection: 'column',
        }}>
          {tool === 'breathe'  && <BreathStage pattern={breathPattern} setPattern={setBreathPattern} />}
          {tool === 'ground'   && <GroundStage />}
          {tool === 'rsd'      && <RsdStage />}
          {tool === 'spiral'   && <SpiralStage />}
        </div>
      </div>
    </div>
  );
}
