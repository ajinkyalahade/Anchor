/* FOCUS — task input → AI micro-steps → shrinking time bar → distraction park */

function Focus({ task, setTask, steps, generateSteps, isGenerating, parked, parkThought, removeParked, sessionLen, setSessionLen, running, setRunning, secondsLeft, toggleStep, firstStepHighlight = true }) {
  const [parkInput, setParkInput] = React.useState("");
  const taskRef = React.useRef(null);

  const pct = sessionLen > 0 ? (secondsLeft / (sessionLen * 60)) * 100 : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <div className="screen">
      <div className="topline">
        <h1 className="page">Focus</h1>
        <div className="now">One task. First step under two minutes.</div>
      </div>

      <div className="focus-wrap">
        {/* LEFT — task + steps */}
        <div className="task-card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>What needs doing</div>
          <textarea
            ref={taskRef}
            className="task-input"
            rows={2}
            placeholder="Type it the way it lives in your head&hellip;"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              {task.length === 0 ? "or try a recent one →" : `${task.length} chars`}
            </div>
            <button
              className="btn tonal-focus"
              onClick={generateSteps}
              disabled={isGenerating || !task.trim()}
              style={{ opacity: (isGenerating || !task.trim()) ? 0.6 : 1 }}
            >
              <Ico.spark />
              {isGenerating ? 'Breaking it down…' : 'Break into micro-steps'}
            </button>
          </div>

          {!task && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {["Write the quarterly review draft", "Reply to Mom's text", "Read the long Patel paper"].map(s => (
                <button key={s}
                  onClick={() => setTask(s)}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, background: 'var(--bone-soft)', color: 'var(--ink-3)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {steps.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 28, marginBottom: 4 }}>Micro-steps</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 6 }}>
                You don&rsquo;t have to decide what&rsquo;s next. The next one is always already chosen.
              </div>
              <div className="steps">
                {steps.map((step, i) => {
                  const firstUndone = steps.findIndex(s => !s.done);
                  return (
                    <div key={i} className={`step ${step.done ? 'done' : ''} ${(i === firstUndone && firstStepHighlight) ? 'first' : ''}`}>
                      <button className="step-tick" onClick={() => toggleStep(i)} aria-label="toggle">
                        {step.done && (
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                            <path d="M4 8.5l3 3 5-6" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <div>
                        <span className="step-num">0{i + 1}</span>
                        <span className="step-label" style={{ marginLeft: 12 }}>{step.text}</span>
                      </div>
                      <span className="step-tiny">~{step.min}m</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* RIGHT — timer + distraction park */}
        <div className="timer-card">
          <div>
            <div className="timer-state">{running ? 'In flow' : 'Ready when you are'}</div>
            <div className="timer-readout" style={{ marginTop: 6 }}>
              {String(mm).padStart(2,'0')}<span style={{color:'var(--ink-4)'}}>:</span>{String(ss).padStart(2,'0')}
            </div>
          </div>

          {/* shrinking visual bar — the primary time signal */}
          <div className="timebar" aria-label="time remaining">
            <div className="timebar-fill" style={{ width: pct + '%' }}></div>
            <div className="timebar-ticks">
              {Array.from({ length: sessionLen }).map((_, i) => <span key={i}></span>)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: -10 }}>
            <span>now</span>
            <span>{sessionLen} min</span>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Session length</div>
            <div className="duration-picker">
              {[15, 20, 25].map(n => (
                <button key={n} className={sessionLen === n ? 'on' : ''} onClick={() => !running && setSessionLen(n)}>
                  {n} min
                </button>
              ))}
            </div>
          </div>

          <button className="btn" onClick={() => setRunning(!running)} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
            {running ? <><Ico.pause /> Pause</> : <><Ico.play /> {secondsLeft < sessionLen * 60 ? 'Resume' : 'Start session'}</>}
          </button>

          <div className="distraction-park">
            <div className="dp-head">
              <div>
                <div className="dp-title">Distraction park</div>
                <div className="dp-sub">It will still be there.</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{parked.length} parked</span>
            </div>
            <div className="dp-input-row">
              <input
                placeholder="buy birthday gift, email landlord…"
                value={parkInput}
                onChange={e => setParkInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && parkInput.trim()) {
                    parkThought(parkInput.trim()); setParkInput("");
                  }
                }}
              />
              <button onClick={() => { if (parkInput.trim()) { parkThought(parkInput.trim()); setParkInput(""); } }}>
                park
              </button>
            </div>
            {parked.length > 0 && (
              <div className="dp-list">
                {parked.map((p, i) => (
                  <div key={i} className="dp-item">
                    <span>{p}</span>
                    <span className="x" onClick={() => removeParked(i)}>release</span>
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
window.Focus = Focus;
