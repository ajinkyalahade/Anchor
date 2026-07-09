/* ME — XP, comeback streak, themes, weekly insight */

const WEEK = [
  { d: 'M', state: 'done', xp: 38 },
  { d: 'T', state: 'done', xp: 24 },
  { d: 'W', state: 'miss', xp: 0 },
  { d: 'T', state: 'miss', xp: 0 },
  { d: 'F', state: 'miss', xp: 0 },
  { d: 'S', state: 'done', xp: 52 },  /* comeback day */
  { d: 'S', state: 'today', xp: 18 },
];

const THEMES = [
  { id: 'bone',   name: 'Bone',     state: 'active', swatch: ['#F5F0E7','#E8E1D2','#2A2620','#9A9081'] },
  { id: 'dusk',   name: 'Dusk',     state: 'unlocked', swatch: ['#E8E4DC','#C5C9D4','#3A3D4A','#8A8FA0'] },
  { id: 'sage',   name: 'Sage',     state: 'unlocked', swatch: ['#EEEDE4','#C7D2C0','#3A4738','#8FA088'] },
  { id: 'ember',  name: 'Ember',    state: 'locked', xp: 200, swatch: ['#F2E9DC','#E0C8B0','#5C3F30','#A07C66'] },
];

function Me({ showWeeklyInsight = true }) {
  return (
    <div className="screen">
      <div className="topline">
        <h1 className="page">Me</h1>
        <div className="now">Effort over outcome · always</div>
      </div>

      <div className="me-grid">
        <div className="xp-card">
          <div className="eyebrow">This week</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div className="xp-num">132<small>xp</small></div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '-0.005em' }}>
              shown up <b style={{color:'var(--ink)', fontWeight:500}}>4 of 7 days</b> &mdash; that&rsquo;s plenty
            </div>
          </div>
          <div className="xp-bar"><i style={{ width: '46%' }}></i></div>
          <div className="xp-foot">
            <span>level 7 · the steady hand</span>
            <span>156 to level 8</span>
          </div>
          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--hairline)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18,
          }}>
            {[
              { l: 'Focus', v: '4h 12m', s: 'this week' },
              { l: 'Calm tools used', v: '7', s: 'mostly Breath' },
              { l: 'Words unstuck', v: '23', s: 'Word Gym' },
            ].map((s,i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontFamily: 'var(--serif)', letterSpacing: '-0.015em' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.l}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 2 }}>{s.s}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="streak-card">
          <div className="eyebrow">Showing up</div>
          <div style={{ marginTop: 6, fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            You came back.
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>That&rsquo;s the one that counts.</div>

          <div className="streak-week">
            {WEEK.map((d, i) => (
              <div key={i} className={`streak-day ${d.state}`}>
                {d.d}
              </div>
            ))}
          </div>

          <div className="comeback">
            <b>Comeback bonus active</b> &mdash; today and tomorrow earn 2&times; XP. No streak was lost. There&rsquo;s no streak to lose.
          </div>
        </div>

        {showWeeklyInsight && (
        <div className="insight-card">
          <div>
            <div className="insight-eyebrow">Weekly insight</div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
              from 19 sessions · Apr 14 &ndash; May 22
            </div>
          </div>
          <div>
            <div className="insight-quote">
              You focused longest on days you opened <span>Calm Zone</span> first &mdash; about <span>6 extra minutes</span> per session, on average. The signal&rsquo;s small but it&rsquo;s real.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn ghost"><Ico.arrow /> See the data</button>
              <button className="btn ghost">Try it tomorrow</button>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="themes">
        <div className="spread" style={{ marginBottom: 14 }}>
          <h2 className="section" style={{ margin: 0 }}>Themes &amp; sound packs</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>unlock by showing up · no leaderboards</div>
        </div>
        <div className="theme-grid">
          {THEMES.map(t => (
            <div key={t.id} className={`theme-card ${t.state === 'locked' ? 'locked' : ''} ${t.state === 'active' ? 'active' : ''}`}>
              <div className="theme-swatch">
                {t.swatch.map((c,i) => <i key={i} style={{background:c}}></i>)}
              </div>
              <div className="theme-foot">
                <div className="theme-name">{t.name}</div>
                <div className="theme-state">
                  {t.state === 'active' && 'in use'}
                  {t.state === 'unlocked' && 'tap to use'}
                  {t.state === 'locked' && `${t.xp} xp`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.Me = Me;
