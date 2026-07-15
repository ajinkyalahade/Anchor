/* GAMES — 6 cards, each 90s. Calm grid, monochrome visuals. */

const GAMES = [
  {
    id: 'echo',
    name: 'Echo',
    why: 'N-back. Holds a moving target in working memory.',
    level: 2,
    levelLabel: '1-back · letters',
    visual: 'echo',
    last: '2d ago',
  },
  {
    id: 'mirror',
    name: 'Mirror',
    why: 'Simon-style pattern recall. Trains sequence memory.',
    level: 3,
    levelLabel: '4-step sequence',
    visual: 'mirror',
    last: 'yesterday',
  },
  {
    id: 'spotter',
    name: 'Spotter',
    why: 'Spot-the-difference. Builds sustained, quiet attention.',
    level: 1,
    levelLabel: 'level 1',
    visual: 'spotter',
    last: 'new',
  },
  {
    id: 'lockstep',
    name: 'Lockstep',
    why: 'Go / no-go. Strengthens the pause before acting.',
    level: 2,
    levelLabel: '70% accuracy',
    visual: 'lockstep',
    last: '3d ago',
  },
  {
    id: 'switch',
    name: 'Switch',
    why: 'Rule-switching. Loosens stuck attention between modes.',
    level: 4,
    levelLabel: 'color → shape',
    visual: 'switchg',
    last: 'yesterday',
  },
  {
    id: 'tracker',
    name: 'Tracker',
    why: 'Multiple-object tracking. Widens the attentional field.',
    level: 2,
    levelLabel: '3 of 6 dots',
    visual: 'tracker',
    last: 'new',
  },
];

function Games() {
  return (
    <div className="screen">
      <div className="topline">
        <h1 className="page">Games</h1>
        <div className="now">90-second doses · difficulty adapts each round</div>
      </div>

      <div style={{
        padding: '16px 20px', borderRadius: 'var(--r)', background: 'var(--games-wash)',
        marginTop: 12, fontSize: 13.5, color: 'var(--games-ink)', letterSpacing: '-0.005em',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
      }}>
        <div>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>Today&rsquo;s warm-up</b>
          <span style={{ marginLeft: 10, color: 'var(--ink-3)' }}>Echo, then Switch. ~3 minutes, no streaks at stake.</span>
        </div>
        <button className="btn" style={{ background: 'var(--games-ink)' }}>
          <Ico.play /> Start warm-up
        </button>
      </div>

      <div className="games-grid">
        {GAMES.map(g => {
          const Visual = GameVisual[g.visual];
          return (
            <button key={g.id} className="game-card">
              <div className="game-visual">
                <Visual />
              </div>
              <div>
                <div className="game-meta">
                  <div className="game-name">{g.name}</div>
                  <div className="game-sec">90 sec</div>
                </div>
                <div className="game-why" style={{ marginTop: 6 }}>{g.why}</div>
              </div>
              <div className="game-foot">
                <span>{g.levelLabel}</span>
                <span className="level">
                  {[0,1,2,3,4].map(i => <i key={i} className={i < g.level ? 'on' : ''}></i>)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 36, fontSize: 12, color: 'var(--ink-3)', letterSpacing: '-0.005em', maxWidth: 560 }}>
        Games target the 70&ndash;85% accuracy band &mdash; just hard enough to engage attention, never hard enough to feel like school. No leaderboards. No timers ticking down to red.
      </div>
    </div>
  );
}
window.Games = Games;
