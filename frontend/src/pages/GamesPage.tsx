import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelativePlayedAt, readGameProgressSummary, recordGameSessionStart, recordGameXp, type GameId } from '../lib/gameProgress';
import { grantReward } from '../lib/rewards';

const EchoGame = lazy(() => import('../components/EchoGame'));
const LockstepGame = lazy(() => import('../components/LockstepGame'));
const MirrorGame = lazy(() => import('../components/MirrorGame'));
const SpotterGame = lazy(() => import('../components/SpotterGame'));
const SwitchGame = lazy(() => import('../components/SwitchGame'));
const TrackerGame = lazy(() => import('../components/TrackerGame'));

type GameMode = 'menu' | 'wordgym' | 'echo' | 'mirror' | 'spotter' | 'lockstep' | 'switch' | 'tracker';
type GameState = 'start' | 'playing' | 'done';

interface HistoryItem { userWord: string; score: number; reason: string; valid: boolean; }

function GameLoader() {
  return (
    <div style={{ padding: '40px 56px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading…</div>
    </div>
  );
}

/* ── Game card visuals ── */
const GameVisuals: Record<string, React.FC> = {
  echo: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g stroke="var(--games-ink)" strokeWidth="1.2" fill="none" opacity="0.9">
        <rect x="22" y="14" width="14" height="14" rx="3"/><rect x="42" y="14" width="14" height="14" rx="3" fill="var(--games)" stroke="none"/>
        <rect x="62" y="14" width="14" height="14" rx="3"/><rect x="82" y="14" width="14" height="14" rx="3"/>
        <rect x="22" y="32" width="14" height="14" rx="3"/><rect x="42" y="32" width="14" height="14" rx="3"/>
        <rect x="62" y="32" width="14" height="14" rx="3" fill="var(--games)" stroke="none"/><rect x="82" y="32" width="14" height="14" rx="3"/>
      </g>
    </svg>
  ),
  mirror: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <circle cx="46" cy="22" r="8" fill="var(--games)" opacity="0.9"/>
      <circle cx="74" cy="22" r="8" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
      <circle cx="46" cy="42" r="8" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
      <circle cx="74" cy="42" r="8" fill="var(--games)" opacity="0.9"/>
    </svg>
  ),
  spotter: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g stroke="var(--games-ink)" strokeWidth="1.3" fill="none">
        <circle cx="34" cy="22" r="4"/><circle cx="50" cy="34" r="4"/><circle cx="36" cy="44" r="4"/>
      </g>
      <g stroke="var(--games-ink)" strokeWidth="1.3" fill="none">
        <circle cx="78" cy="22" r="4"/><circle cx="94" cy="34" r="4" fill="var(--games)"/><circle cx="80" cy="44" r="4"/>
      </g>
      <line x1="60" y1="10" x2="60" y2="50" stroke="var(--hairline-strong)" strokeWidth="1" strokeDasharray="2 3"/>
    </svg>
  ),
  lockstep: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <circle cx="40" cy="30" r="11" fill="var(--games)" opacity="0.9"/>
      <circle cx="68" cy="30" r="11" stroke="var(--games-ink)" strokeWidth="1.4" fill="none"/>
      <line x1="63" y1="25" x2="73" y2="35" stroke="var(--games-ink)" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="73" y1="25" x2="63" y2="35" stroke="var(--games-ink)" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="96" cy="30" r="11" fill="var(--games)" opacity="0.9"/>
    </svg>
  ),
  switch: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <rect x="32" y="18" width="22" height="22" rx="4" fill="var(--games)" opacity="0.9"/>
      <path d="M58 30h10" stroke="var(--games-ink)" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M64 26l4 4-4 4" stroke="var(--games-ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="82" cy="29" r="11" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
    </svg>
  ),
  tracker: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <path d="M20 30c10-18 30-18 40 0s30 18 40 0" fill="none" stroke="var(--games-ink)" strokeWidth="1.2"/>
      <circle cx="28" cy="22" r="3.5" fill="var(--games)"/>
      <circle cx="56" cy="42" r="3.5" fill="var(--games)"/>
      <circle cx="84" cy="22" r="3.5" fill="var(--games)"/>
      <circle cx="100" cy="38" r="3.5" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
    </svg>
  ),
  wordgym: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <text x="18" y="36" fontFamily="Georgia,serif" fontSize="28" fill="var(--games)" opacity="0.9">W</text>
      <text x="54" y="36" fontFamily="Georgia,serif" fontSize="28" fill="var(--games-ink)" opacity="0.5">→</text>
      <text x="84" y="36" fontFamily="Georgia,serif" fontSize="28" fill="var(--games)" opacity="0.9">G</text>
    </svg>
  ),
};

const GAMES = [
  { id: 'echo',     name: 'Echo',     why: 'N-back. Holds a moving target in working memory.', level: 2, levelLabel: '1-back · letters',   visual: 'echo',     last: '2d ago',   mode: 'echo'     as Exclude<GameMode,'menu'> },
  { id: 'mirror',   name: 'Mirror',   why: 'Simon-style pattern recall. Trains sequence memory.', level: 3, levelLabel: '4-step sequence', visual: 'mirror',   last: 'yesterday', mode: 'mirror'   as Exclude<GameMode,'menu'> },
  { id: 'spotter',  name: 'Spotter',  why: 'Spot-the-difference. Builds sustained, quiet attention.', level: 1, levelLabel: 'level 1',   visual: 'spotter',  last: 'new',       mode: 'spotter'  as Exclude<GameMode,'menu'> },
  { id: 'lockstep', name: 'Lockstep', why: 'Go / no-go. Strengthens the pause before acting.', level: 2, levelLabel: '70% accuracy',     visual: 'lockstep', last: '3d ago',    mode: 'lockstep' as Exclude<GameMode,'menu'> },
  { id: 'switch',   name: 'Switch',   why: 'Rule-switching. Loosens stuck attention between modes.', level: 4, levelLabel: 'color → shape', visual: 'switch',  last: 'yesterday', mode: 'switch'   as Exclude<GameMode,'menu'> },
  { id: 'tracker',  name: 'Tracker',  why: 'Multiple-object tracking. Widens the attentional field.', level: 2, levelLabel: '3 of 6 dots', visual: 'tracker', last: 'new',       mode: 'tracker'  as Exclude<GameMode,'menu'> },
];

export default function GamesPage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId?: string }>();
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameState, setGameState] = useState<GameState>('start');
  const [baseWord, setBaseWord] = useState('');
  const [inputWord, setInputWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [progressSummary] = useState(() => readGameProgressSummary());
  const inputRef = useRef<HTMLInputElement>(null);
  const [brainGameSessionId, setBrainGameSessionId] = useState<string | null>(null);
  const brainGameStartTime = useRef<number>(0);

  const openGame = useCallback(async (nextMode: Exclude<GameMode, 'menu'>) => {
    const sessionGameId: GameId = nextMode === 'wordgym' ? 'word-gym' : nextMode;
    recordGameSessionStart(sessionGameId);
    setGameState('start');
    setMode(nextMode);
    setBrainGameSessionId(null);
    brainGameStartTime.current = Date.now();
    navigate(`/games/${sessionGameId}`);
    // Start a server-side session for brain games (not word gym — handled separately)
    if (nextMode !== 'wordgym') {
      try {
        const res = await api.post<{ session_id: string }>('/games/sessions', { game_key: nextMode });
        setBrainGameSessionId(res.session_id);
      } catch { /* non-fatal */ }
    }
  }, [navigate]);

  // Sync the active game mode to the :gameId route param (external source).
  useEffect(() => {
    if (!gameId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('menu');
      return;
    }
    const routeMap: Record<string, Exclude<GameMode, 'menu'>> = {
      'word-gym': 'wordgym', echo: 'echo', mirror: 'mirror',
      spotter: 'spotter', lockstep: 'lockstep', switch: 'switch', tracker: 'tracker',
    };
    const m = routeMap[gameId];
    if (m) {
      setMode(m);
      setGameState('start');
    }
  }, [gameId]);

  const finishGame = useCallback(() => {
    setGameState('done');
    if (!rewardGranted) {
      const xpEarned = Math.max(5, Math.ceil(score / 10));
      setRewardGranted(true);
      recordGameXp('word-gym', xpEarned);
      void grantReward('wordgym', xpEarned, 'completed Word Gym round');
      // Persist word gym session
      const rtMean = brainGameStartTime.current
        ? Math.round((Date.now() - brainGameStartTime.current) / Math.max(history.length, 1))
        : 2000;
      if (brainGameSessionId) {
        void api.patch(`/games/sessions/${brainGameSessionId}`, {
          score,
          accuracy: Math.round((history.filter((h) => h.valid).length / Math.max(history.length, 1)) * 100),
          rt_mean: rtMean,
          rt_var: 500,
          completed: true,
        }).catch(() => {});
      }
    }
  }, [rewardGranted, score, brainGameSessionId, history]);

  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) return undefined;
    const id = window.setTimeout(() => {
      if (timeLeft <= 1) { finishGame(); return; }
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [finishGame, gameState, timeLeft]);

  const startWordGym = async () => {
    setPageError(null);
    try {
      const res = await api.get<{ base_word: string; time_limit_seconds: number }>('/games/wordgym/start');
      setBaseWord(res.base_word);
      setTimeLeft(res.time_limit_seconds);
    } catch {
      setBaseWord('ocean');
      setTimeLeft(60);
    }
    setScore(0); setHistory([]); setRewardGranted(false);
    setGameState('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !inputWord.trim() || isEvaluating) return;
    const word = inputWord.trim();
    setInputWord(''); setIsEvaluating(true);
    try {
      const res = await api.post<{ valid: boolean; score: number; reason: string; next_word: string }>('/games/wordgym/evaluate', { base_word: baseWord, user_word: word });
      if (res.valid) { setScore((s) => s + res.score); setBaseWord(res.next_word); }
      setHistory((h) => [{ userWord: word, score: res.score, reason: res.reason, valid: res.valid }, ...h]);
    } catch { setPageError('Could not score that word. Try another one.'); }
    finally { setIsEvaluating(false); inputRef.current?.focus(); }
  };

  if (mode === 'echo')     return <Suspense fallback={<GameLoader />}><EchoGame     onBack={() => navigate('/games')} /></Suspense>;
  if (mode === 'mirror')   return <Suspense fallback={<GameLoader />}><MirrorGame   onBack={() => navigate('/games')} /></Suspense>;
  if (mode === 'spotter')  return <Suspense fallback={<GameLoader />}><SpotterGame  onBack={() => navigate('/games')} /></Suspense>;
  if (mode === 'lockstep') return <Suspense fallback={<GameLoader />}><LockstepGame onBack={() => navigate('/games')} /></Suspense>;
  if (mode === 'switch')   return <Suspense fallback={<GameLoader />}><SwitchGame   onBack={() => navigate('/games')} /></Suspense>;
  if (mode === 'tracker')  return <Suspense fallback={<GameLoader />}><TrackerGame  onBack={() => navigate('/games')} /></Suspense>;

  /* ── Word Gym ── */
  if (mode === 'wordgym') {
    if (gameState === 'start') return (
      <div className="screen" style={{ padding: '40px 56px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', gap: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--games-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {<GameVisuals.wordgym />}
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Word Gym</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 15 }}>Fast-paced word association. Warm up your brain in 60 seconds.</p>
        </div>
        <button onClick={startWordGym} style={{ padding: '12px 28px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg>
          Play Now
        </button>
        <button onClick={() => navigate('/games')} style={{ fontSize: 12.5, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Back to Games
        </button>
      </div>
    );

    if (gameState === 'playing') return (
      <div className="screen" style={{ padding: '40px 56px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: 'var(--rsd-ink)' }}>{timeLeft}s</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: 'var(--reward-ink)' }}>{score} pts</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{baseWord}</div>
          <input
            ref={inputRef}
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isEvaluating}
            placeholder={isEvaluating ? 'Evaluating…' : 'Type an association…'}
            style={{
              width: '100%', maxWidth: 480, textAlign: 'center', fontSize: 20,
              background: 'var(--paper)', border: '2px solid var(--games)',
              borderRadius: 'var(--r-lg)', padding: '16px 24px',
              outline: 'none', color: 'var(--ink)',
            }}
            autoComplete="off"
          />
          {pageError && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{pageError}</div>}
        </div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, margin: '40px auto 0' }}>
          {history.slice(0, 4).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--r-sm)', background: item.valid ? 'var(--games-wash)' : 'var(--bone-soft)', opacity: Math.max(0.2, 1 - idx * 0.22) }}>
              <span style={{ textDecoration: item.valid ? 'none' : 'line-through', color: item.valid ? 'var(--ink)' : 'var(--ink-3)' }}>{item.userWord}</span>
              {item.valid ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--reward-ink)' }}>+{item.score}</span> : <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{item.reason}</span>}
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div className="screen" style={{ padding: '40px 56px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', gap: 24 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 400 }}>Time's up.</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, color: 'var(--reward-ink)' }}>{score}</div>
        <div style={{ color: 'var(--ink-3)' }}>points · your brain is warmed up</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, marginTop: 16 }}>
          <button onClick={startWordGym} style={{ padding: '12px', borderRadius: 999, background: 'var(--ink)', color: 'var(--bone)', fontSize: 14, fontWeight: 500 }}>Play Again</button>
          <button onClick={() => navigate('/games')} style={{ padding: '12px', borderRadius: 999, background: 'transparent', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--hairline-strong)', fontSize: 14 }}>Back to Games</button>
        </div>
      </div>
    );
  }

  /* ── Menu ── */
  return (
    <div className="screen" style={{ padding: '40px 56px 96px' }}>

      {/* Topline */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', margin: 0 }}>Games</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>90-second doses · difficulty adapts each round</div>
      </div>

      {/* Warm-up banner */}
      <div style={{ padding: '16px 20px', borderRadius: 'var(--r)', background: 'var(--games-wash)', marginTop: 12, fontSize: 13.5, color: 'var(--games-ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>Today's warm-up</b>
          <span style={{ marginLeft: 10, color: 'var(--ink-3)' }}>Echo, then Switch. ~3 minutes, no streaks at stake.</span>
        </div>
        <button
          onClick={() => openGame('echo')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, fontWeight: 500, background: 'var(--games-ink)', color: 'var(--bone)' }}
        >
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/></svg>
          Start warm-up
        </button>
      </div>

      {/* Word Gym card */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>Word Gym</h2>
        <button
          onClick={() => openGame('wordgym')}
          style={{
            width: '100%', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r)', padding: '22px 22px 20px',
            textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: '140px 1fr', gap: 20, alignItems: 'center',
            transition: 'transform 140ms ease, box-shadow 140ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(42,38,32,0.04), 0 8px 24px -8px rgba(42,38,32,0.10)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
          <div style={{ height: 76, background: 'var(--games-wash)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {<GameVisuals.wordgym />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.015em' }}>Word Gym</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', background: 'var(--bone-soft)', padding: '3px 8px', borderRadius: 4 }}>60 sec</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 6 }}>
              Fast word chains. Trains the retrieval pathway — the words are in there, this unsticks the path to them.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              {formatRelativePlayedAt(progressSummary.lastPlayedByGame['word-gym'])}
            </div>
          </div>
        </button>
      </div>

      {/* Brain games grid */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>Brain Games</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {GAMES.map((g) => {
            const Visual = GameVisuals[g.visual];
            return (
              <button
                key={g.id}
                onClick={() => openGame(g.mode)}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--r)',
                  padding: '22px 22px 20px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 18, minHeight: 220,
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(42,38,32,0.04), 0 8px 24px -8px rgba(42,38,32,0.10)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ height: 76, background: 'var(--games-wash)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Visual />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.015em' }}>{g.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', background: 'var(--bone-soft)', padding: '3px 8px', borderRadius: 4 }}>90 sec</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 6 }}>{g.why}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                  <span>{g.levelLabel}</span>
                  <span style={{ display: 'flex', gap: 2 }}>
                    {[0,1,2,3,4].map((i) => (
                      <span key={i} style={{ width: 16, height: 2, background: i < g.level ? 'var(--games)' : 'var(--bone-deep)', borderRadius: 1, display: 'inline-block' }} />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 36, fontSize: 12, color: 'var(--ink-3)', letterSpacing: '-0.005em', maxWidth: 560 }}>
        Games target the 70–85% accuracy band — just hard enough to engage attention, never hard enough to feel like school. No leaderboards. No timers ticking down to red.
      </div>
    </div>
  );
}
