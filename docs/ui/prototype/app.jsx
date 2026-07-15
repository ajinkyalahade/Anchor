/* App shell — sidebar, routing, focus session state, tweaks wiring */

const NAV = [
  { id: 'home',  label: 'Home',  icon: 'home' },
  { id: 'focus', label: 'Focus', icon: 'focus' },
  { id: 'games', label: 'Games', icon: 'games' },
  { id: 'calm',  label: 'Calm',  icon: 'calm' },
  { id: 'me',    label: 'Me',    icon: 'me' },
];

const DEFAULT_STEPS = [
  { text: "Open the Q1 doc and read the first paragraph", min: 2, done: false },
  { text: "Copy last quarter's headers into a new section", min: 3, done: false },
  { text: "Write one sentence under 'Highlights' — any sentence", min: 4, done: false },
  { text: "List three projects, no order", min: 5, done: false },
  { text: "Pick the one that&rsquo;s easiest to describe; expand it", min: 6, done: false },
];

const SUGGESTIONS = [
  { what: <>A 20-minute focus block on the <em style={{ fontStyle: 'italic', color: 'var(--focus-ink)' }}>quarterly review draft</em>.</>, pill: '20 min · Focus', why: 'Suggested · based on your usual Thursday rhythm', meta: 'Calm Zone first usually adds ~6 min to your session.' },
  { what: <>Two rounds of <em style={{ fontStyle: 'italic', color: 'var(--calm-ink)' }}>box breathing</em>, then decide.</>, pill: '3 min · Calm', why: 'Suggested · your heart rate has been a little high', meta: 'You&rsquo;ve only opened Calm once this week.' },
  { what: <>A 90-second round of <em style={{ fontStyle: 'italic', color: 'var(--games-ink)' }}>Echo</em> to warm up.</>, pill: '90 sec · Games', why: 'Suggested · low-stakes start', meta: 'Yesterday you went straight to Focus &mdash; that&rsquo;s ok too.' },
];

const TODAY_LOG_BY_VIEW = {
  default: [
    { time: '08:14', label: 'Morning breath · 3 rounds box',         tag: 'Calm',     state: 'done' },
    { time: '09:02', label: 'Focus · Patel paper, 25 min',           tag: 'Focus',    state: 'done' },
    { time: '10:30', label: 'Echo · 1-back, 90 sec',                 tag: 'Games',    state: 'done' },
    { time: '11:45', label: 'Quarterly review draft · 20 min',       tag: 'Focus',    state: 'now' },
    { time: '14:00', label: 'Reply to Mom',                          tag: 'parked',   state: 'upcoming' },
    { time: '16:30', label: 'Word Gym · tip-of-tongue',              tag: 'planned',  state: 'upcoming' },
  ],
};

function App() {
  // Tweaks
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "dust",
    "density": "comfortable",
    "showWeeklyInsight": true,
    "firstStepHighlight": true,
    "ambient": "off"
  }/*EDITMODE-END*/);

  // Route
  const [view, setView] = React.useState('home');

  // Suggestion
  const [suggestionIdx, setSuggestionIdx] = React.useState(0);
  const suggestion = SUGGESTIONS[suggestionIdx];
  const swapSuggestion = () => setSuggestionIdx((suggestionIdx + 1) % SUGGESTIONS.length);

  // Focus state
  const [task, setTask] = React.useState("Write the quarterly review draft");
  const [steps, setSteps] = React.useState(DEFAULT_STEPS);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [parked, setParked] = React.useState(["Buy birthday gift for J", "Email landlord about the radiator"]);

  const [sessionLen, setSessionLen] = React.useState(20);
  const [secondsLeft, setSecondsLeft] = React.useState(20 * 60);
  const [running, setRunning] = React.useState(false);

  // Reset timer when session length changes (and not running)
  React.useEffect(() => {
    if (!running) setSecondsLeft(sessionLen * 60);
  }, [sessionLen]);

  // Tick
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setRunning(false); return sessionLen * 60; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, sessionLen]);

  const generateSteps = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setSteps(DEFAULT_STEPS.map(s => ({ ...s, done: false })));
      setIsGenerating(false);
    }, 900);
  };
  const toggleStep = i => setSteps(steps.map((s, ii) => ii === i ? { ...s, done: !s.done } : s));
  const parkThought = t => setParked([...parked, t]);
  const removeParked = i => setParked(parked.filter((_, ii) => ii !== i));

  // Apply tweaks
  React.useEffect(() => {
    const root = document.documentElement;
    const accentMap = {
      dust:  { focus: 'oklch(0.72 0.055 235)', ink: 'oklch(0.42 0.06 235)',  wash: 'oklch(0.93 0.025 235)' },
      slate: { focus: 'oklch(0.70 0.03 250)',  ink: 'oklch(0.40 0.04 250)',  wash: 'oklch(0.93 0.012 250)' },
      moss:  { focus: 'oklch(0.70 0.06 165)',  ink: 'oklch(0.40 0.07 165)',  wash: 'oklch(0.93 0.025 165)' },
      ochre: { focus: 'oklch(0.74 0.08 78)',   ink: 'oklch(0.46 0.09 65)',   wash: 'oklch(0.94 0.035 78)' },
    };
    const a = accentMap[t.accent] || accentMap.dust;
    root.style.setProperty('--focus', a.focus);
    root.style.setProperty('--focus-ink', a.ink);
    root.style.setProperty('--focus-wash', a.wash);

    root.style.setProperty('--pad', t.density === 'cozy' ? '20px' : '32px');
  }, [t.accent, t.density]);

  return (
    <div className="app" data-screen-label="anchor">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"></div>
          <div className="brand-name">Anchor</div>
        </div>
        {NAV.map(n => {
          const Icon = Ico[n.icon];
          return (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => setView(n.id)}
            >
              <span className="glyph"><Icon /></span>
              {n.label}
            </button>
          );
        })}

        <div className="nav-foot">
          <div className="quiet-row">
            <span>Ambient</span>
            <span style={{ fontFamily: 'var(--mono)', color: t.ambient === 'off' ? 'var(--ink-4)' : 'var(--ink-2)' }}>
              {t.ambient === 'off' ? '— off' : t.ambient}
            </span>
          </div>
          <div className="quiet-row">
            <span>Energy</span>
            <span className="row"><span className="dot"></span><span style={{color:'var(--ink-2)'}}>steady</span></span>
          </div>
          <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
            v0.4 · MVP
          </div>
        </div>
      </aside>

      <main className="main" data-screen-label={view}>
        {view === 'home' && (
          <Home
            goto={setView}
            suggestion={suggestion}
            swapSuggestion={swapSuggestion}
            todayLog={TODAY_LOG_BY_VIEW.default}
          />
        )}
        {view === 'focus' && (
          <Focus
            task={task} setTask={setTask}
            steps={steps} generateSteps={generateSteps} isGenerating={isGenerating}
            parked={parked} parkThought={parkThought} removeParked={removeParked}
            sessionLen={sessionLen} setSessionLen={setSessionLen}
            running={running} setRunning={setRunning}
            secondsLeft={secondsLeft}
            toggleStep={toggleStep}
            firstStepHighlight={t.firstStepHighlight}
          />
        )}
        {view === 'games' && <Games />}
        {view === 'calm'  && <Calm />}
        {view === 'me'    && <Me showWeeklyInsight={t.showWeeklyInsight} />}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Focus accent">
          <TweakRadio
            label="Hue"
            value={t.accent}
            options={['dust','slate','moss','ochre']}
            onChange={v => setTweak('accent', v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            options={['cozy','comfortable']}
            onChange={v => setTweak('density', v)}
          />
        </TweakSection>
        <TweakSection label="Body double">
          <TweakSelect
            label="Ambient"
            value={t.ambient}
            options={['off','rain','cafe','fireplace','library']}
            onChange={v => setTweak('ambient', v)}
          />
        </TweakSection>
        <TweakSection label="Variants">
          <TweakToggle
            label="Mark first micro-step"
            value={t.firstStepHighlight}
            onChange={v => setTweak('firstStepHighlight', v)}
          />
          <TweakToggle
            label="Weekly insight on Me"
            value={t.showWeeklyInsight}
            onChange={v => setTweak('showWeeklyInsight', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
