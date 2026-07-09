/* CALM — tool picker + active stage (breath orb, grounding, RSD, spiral) */

const CALM_TOOLS = [
  { id: 'breathe',  name: 'Breathe',         sub: '4-7-8 · box · sigh',         icon: 'wind' },
  { id: 'ground',   name: 'Ground',           sub: '5-4-3-2-1 senses',           icon: 'hand' },
  { id: 'rsd',      name: 'Something just hurt', sub: 'RSD interrupt',          icon: 'heart', emphasised: true },
  { id: 'spiral',   name: 'Stop the spiral',  sub: '90-second guided script',    icon: 'cloud' },
];

const GROUND_STEPS = [
  { n: 5, label: 'things you can see',  small: 'name them out loud or in your head' },
  { n: 4, label: 'things you can feel', small: 'fabric on your skin, weight in your shoes' },
  { n: 3, label: 'things you can hear', small: 'one near, one mid, one far' },
  { n: 2, label: 'things you can smell',small: 'coffee, soap, the air itself' },
  { n: 1, label: 'thing you can taste', small: 'this is enough' },
];

const EMOTIONS = ['Rejected', 'Dismissed', 'Embarrassed', 'Invisible', 'Misread', 'Ashamed'];

function Calm() {
  const [tool, setTool] = React.useState('breathe');
  const [groundStep, setGroundStep] = React.useState(0);
  const [pattern, setPattern] = React.useState('4-7-8');
  const [breathPhase, setBreathPhase] = React.useState('Inhale');
  const [rsdEmotion, setRsdEmotion] = React.useState(null);
  const [rsdIntensity, setRsdIntensity] = React.useState(60);
  const [showRsdResponse, setShowRsdResponse] = React.useState(false);

  // Cycle breath phases (4s inhale, 7s hold, 8s exhale — matches CSS keyframe)
  React.useEffect(() => {
    if (tool !== 'breathe') return;
    const cycle = [
      { p: 'Inhale', d: 4000 },
      { p: 'Hold',   d: 7000 },
      { p: 'Exhale', d: 8000 },
    ];
    let i = 0;
    setBreathPhase(cycle[0].p);
    const tick = () => {
      i = (i + 1) % cycle.length;
      setBreathPhase(cycle[i].p);
      timer = setTimeout(tick, cycle[i].d);
    };
    let timer = setTimeout(tick, cycle[0].d);
    return () => clearTimeout(timer);
  }, [tool]);

  return (
    <div className="screen">
      <div className="topline">
        <h1 className="page">Calm</h1>
        <div className="now">No voice unless you ask for one</div>
      </div>

      <div className="calm-wrap">
        <div className="calm-picker">
          {CALM_TOOLS.map(t => {
            const Icon = Ico[t.icon];
            return (
              <button
                key={t.id}
                className={`calm-tool ${tool === t.id ? 'on' : ''} ${t.emphasised ? 'rsd-tool' : ''}`}
                onClick={() => { setTool(t.id); setShowRsdResponse(false); setGroundStep(0); }}
              >
                <div className="ic"><Icon /></div>
                <div>
                  <div className="nm">{t.name}</div>
                  <div className="sub">{t.sub}</div>
                </div>
              </button>
            );
          })}

          <div className="safety-card">
            <b>Crisis safety layer</b>
            <div style={{ marginTop: 4 }}>Anything you write is screened before any AI sees it. If you&rsquo;re in danger, the app puts <b style={{color:'var(--ink)'}}>988</b> and your local lines in front instead.</div>
          </div>
        </div>

        <div className="calm-stage">
          {tool === 'breathe' && (
            <>
              <div className="stage-head">
                <div className="stage-title">Breath coach</div>
                <div className="stage-sub">
                  <select
                    value={pattern}
                    onChange={e => setPattern(e.target.value)}
                    style={{
                      background: 'var(--bone-soft)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 6, padding: '5px 8px',
                      fontSize: 12, color: 'var(--ink-2)',
                      fontFamily: 'var(--mono)'
                    }}
                  >
                    <option>4-7-8</option>
                    <option>Box (4-4-4-4)</option>
                    <option>Physiological sigh</option>
                  </select>
                </div>
              </div>
              <div className="breath-stage">
                <div className="orb-wrap">
                  <div className="orb-ring"></div>
                  <div className="orb"></div>
                </div>
                <div className="breath-cue">{breathPhase}</div>
                <div className="breath-pattern">{pattern} · round 2 of 4</div>
              </div>
            </>
          )}

          {tool === 'ground' && (
            <>
              <div className="stage-head">
                <div>
                  <div className="stage-title">5 &middot; 4 &middot; 3 &middot; 2 &middot; 1</div>
                  <div className="stage-sub" style={{marginTop:4}}>Voice or thought. Both work.</div>
                </div>
                <button className="btn ghost" onClick={() => setGroundStep(Math.min(groundStep + 1, GROUND_STEPS.length - 1))}>
                  Next <Ico.arrow />
                </button>
              </div>
              <div className="grounding">
                {GROUND_STEPS.map((s, i) => (
                  <div key={i} className={`ground-step ${i === groundStep ? 'on' : ''}`}>
                    <div className="num">{s.n}</div>
                    <div className="ground-prompt">
                      {s.label}
                      <small>{s.small}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tool === 'rsd' && !showRsdResponse && (
            <>
              <div className="stage-head">
                <div className="stage-title">Something just hurt.</div>
                <div className="stage-sub">No diagnosis. No homework.</div>
              </div>
              <div className="rsd-stage">
                <div className="rsd-button" onClick={() => rsdEmotion && setShowRsdResponse(true)}>
                  <div className="rsd-headline">It makes sense that you&rsquo;re here.</div>
                  <div className="rsd-sub">Pick what&rsquo;s closest. Approximate is fine.</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Closest feeling</div>
                  <div className="emo-wheel">
                    {EMOTIONS.map(e => (
                      <button key={e} className={rsdEmotion === e ? 'on' : ''} onClick={() => setRsdEmotion(e)}>{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>How loud is it</div>
                  <div className="intensity-row">
                    <span>quiet</span>
                    <div className="intensity-bar">
                      <div className="intensity-fill" style={{ width: rsdIntensity + '%' }}></div>
                    </div>
                    <span>roaring</span>
                  </div>
                  <input type="range" min="0" max="100" value={rsdIntensity} onChange={e => setRsdIntensity(+e.target.value)} style={{ width: '100%', marginTop: 8, accentColor: 'var(--rsd)' }}/>
                </div>
              </div>
            </>
          )}

          {tool === 'rsd' && showRsdResponse && (
            <>
              <div className="stage-head">
                <div className="stage-title">Heard.</div>
                <button className="btn ghost" onClick={() => { setShowRsdResponse(false); setRsdEmotion(null); }}>start over</button>
              </div>
              <div className="rsd-stage">
                <div className="rsd-response">
                  Feeling <b style={{fontWeight:500}}>{rsdEmotion?.toLowerCase()}</b> right now &mdash; especially at that volume &mdash; doesn&rsquo;t make you fragile, and it doesn&rsquo;t mean the read on the situation is right. Both can be true. The wave is real. It&rsquo;s also moving. Stay close to yourself for the next sixty seconds and we&rsquo;ll see where it lands.
                </div>
                <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                  <button className="btn ghost">Sit with it</button>
                  <button className="btn ghost">Send myself a kind note</button>
                  <button className="btn ghost">Move my body for 60 sec</button>
                </div>
                <div style={{fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic'}}>Nothing here is recorded. This conversation closes when you close it.</div>
              </div>
            </>
          )}

          {tool === 'spiral' && (
            <>
              <div className="stage-head">
                <div className="stage-title">Stop the spiral</div>
                <div className="stage-sub">90 seconds · ends with one small thing</div>
              </div>
              <div className="spiral-stage">
                <div className="spiral-script">
                  Notice you&rsquo;re spiralling. That&rsquo;s already half of it. The thought is repeating because it wants you safe, not because it&rsquo;s true. Soften the jaw. Drop the shoulders an inch. One slow exhale &mdash; longer than the inhale. The room is still here. You are still here. The next minute is the only one that matters.
                </div>
                <div className="spiral-action">
                  <b>One small thing</b>
                  Stand up. Drink half a glass of water. That&rsquo;s the whole exit ramp.
                </div>
                <div className="timebar" style={{height: 10}}>
                  <div className="timebar-fill" style={{ width: '38%', background: 'var(--calm)' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                  <span>0:34</span><span>1:30</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
window.Calm = Calm;
