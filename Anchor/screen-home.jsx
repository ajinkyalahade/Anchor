/* HOME — single suggested action, 3 quick tiles, today timeline */

function Home({ goto, suggestion, swapSuggestion, todayLog }) {
  const hour = new Date().getHours();
  const greet = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="screen">
      <div className="topline">
        <div className="now">
          <b>Thursday</b>, May 22 · <span style={{ color: "var(--ink-3)" }}>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
        <div className="now">Energy <b style={{color:"var(--calm-ink)"}}>steady</b></div>
      </div>

      <h1 className="greeting">{greet}, <span className="em">Mara.</span></h1>
      <div style={{ color: "var(--ink-3)", fontSize: 14.5, marginTop: 4 }}>
        Nothing urgent. Here&rsquo;s one good place to start.
      </div>

      <div className="suggest">
        <div>
          <div className="why">Suggested · based on your usual Thursday rhythm</div>
          <div className="what">A 20-minute focus block on the <em style={{ fontStyle: 'italic', color: 'var(--focus-ink)' }}>quarterly review draft</em>.</div>
          <div className="meta">
            <span className="pill">20 min · Focus</span>
            <span>Calm Zone first usually adds ~6 min to your session.</span>
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => goto('focus')}>
            <Ico.play /> Start session
          </button>
          <button className="swap" onClick={swapSuggestion}>Suggest something else</button>
        </div>
      </div>

      <div className="quick-tiles">
        <button className="tile" onClick={() => goto('calm')}>
          <div className="tile-mark" style={{ background: 'var(--calm-wash)', color: 'var(--calm-ink)' }}>
            <Ico.wind />
          </div>
          <div className="tile-name">Breathe for 90 sec</div>
          <div className="tile-why">Two rounds of box breathing. Lowers the noise before you decide anything.</div>
        </button>
        <button className="tile" onClick={() => goto('focus')}>
          <div className="tile-mark" style={{ background: 'var(--focus-wash)', color: 'var(--focus-ink)' }}>
            <Ico.pin />
          </div>
          <div className="tile-name">Park a thought</div>
          <div className="tile-why">Drop the intrusive thing into the inbox. It will still be there in 20 minutes.</div>
        </button>
        <button className="tile" onClick={() => goto('games')}>
          <div className="tile-mark" style={{ background: 'var(--games-wash)', color: 'var(--games-ink)' }}>
            <Ico.book />
          </div>
          <div className="tile-name">Word Gym · Tip-of-tongue</div>
          <div className="tile-why">90 seconds. You have the words today &mdash; this just unsticks the path to them.</div>
        </button>
      </div>

      <div className="timeline">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h2 className="section" style={{ margin: 0 }}>Today, gently</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>3 done · 1 in flight</div>
        </div>
        {todayLog.map((row, i) => (
          <div key={i} className={`timeline-row ${row.state}`}>
            <div className="timeline-time">{row.time}</div>
            <div className={`timeline-dot ${row.state}`}></div>
            <div className="timeline-label">{row.label}</div>
            <div className="timeline-tag">{row.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.Home = Home;
