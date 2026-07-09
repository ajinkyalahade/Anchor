export type GameId =
  | 'word-gym'
  | 'echo'
  | 'mirror'
  | 'spotter'
  | 'lockstep'
  | 'switch'
  | 'tracker';

interface GameSessionLog {
  gameId: GameId;
  startedAt: string;
  xpEarned: number;
}

interface GameProgressSummary {
  totalXp: number;
  streakDays: number;
  lastPlayedByGame: Partial<Record<GameId, string>>;
}

const STORAGE_KEY = 'anchor_game_progress_v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

function loadLogs(): GameSessionLog[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GameSessionLog[]) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: GameSessionLog[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-120)));
}

export function recordGameSessionStart(gameId: GameId) {
  const logs = loadLogs();
  logs.push({
    gameId,
    startedAt: new Date().toISOString(),
    xpEarned: 0,
  });
  saveLogs(logs);
}

export function recordGameXp(gameId: GameId, xpEarned: number) {
  const logs = loadLogs();
  const nextXp = Math.max(0, xpEarned);

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (logs[index].gameId === gameId && logs[index].xpEarned === 0) {
      logs[index] = { ...logs[index], xpEarned: nextXp };
      saveLogs(logs);
      return;
    }
  }

  logs.push({
    gameId,
    startedAt: new Date().toISOString(),
    xpEarned: nextXp,
  });
  saveLogs(logs);
}

export function readGameProgressSummary(): GameProgressSummary {
  const logs = loadLogs();
  const lastPlayedByGame: Partial<Record<GameId, string>> = {};

  logs.forEach((log) => {
    const previous = lastPlayedByGame[log.gameId];
    if (!previous || new Date(log.startedAt) > new Date(previous)) {
      lastPlayedByGame[log.gameId] = log.startedAt;
    }
  });

  const uniqueDays = Array.from(
    new Set(logs.map((log) => new Date(log.startedAt).toDateString())),
  )
    .map((day) => new Date(day))
    .sort((left, right) => right.getTime() - left.getTime());

  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of uniqueDays) {
    day.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (cursor.getTime() - day.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (diffDays === 1 && streakDays > 0) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (streakDays === 0 && diffDays === 1) {
      break;
    }
    break;
  }

  return {
    totalXp: logs.reduce((total, log) => total + log.xpEarned, 0),
    streakDays,
    lastPlayedByGame,
  };
}

export function formatRelativePlayedAt(isoTimestamp?: string) {
  if (!isoTimestamp) return 'Not played yet';

  const playedAt = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - playedAt.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Played just now';
  if (diffHours < 24) return `Played ${diffHours}h ago`;
  if (diffDays === 1) return 'Played yesterday';
  return `Played ${diffDays}d ago`;
}
