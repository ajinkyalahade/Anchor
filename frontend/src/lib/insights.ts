export interface InsightSession {
  id: string;
  startedAt: string;
  durationMinutes: number;
  focusScore: number;
  moodBefore: number;
  moodAfter: number;
}

export interface InsightInputs {
  medicationTaken: boolean;
  sleepHours: number;
  caffeineLevel: 0 | 1 | 2 | 3;
  digestPushOptIn: boolean;
}

export interface HeatmapCell {
  dayLabel: string;
  bucketLabel: string;
  value: number;
}

export interface TrendPoint {
  label: string;
  minutes: number;
}

export interface CorrelationMetric {
  label: string;
  value: string;
  note: string;
}

export interface InsightDashboardData {
  sessions: InsightSession[];
  inputs: InsightInputs;
  digests: WeeklyDigestEntry[];
}

export interface WeeklyDigestEntry {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  deliveredAt: string;
  deliveryLabel: string;
}

const STORAGE_KEY = 'anchor_insight_dashboard_v1';

const DEFAULT_INPUTS: InsightInputs = {
  medicationTaken: false,
  sleepHours: 7,
  caffeineLevel: 1,
  digestPushOptIn: false,
};


const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BUCKETS = [
  { label: '8a', start: 8, end: 10 },
  { label: '10a', start: 10, end: 12 },
  { label: '12p', start: 12, end: 14 },
  { label: '2p', start: 14, end: 17 },
  { label: '5p', start: 17, end: 22 },
];

function isBrowser() {
  return typeof window !== 'undefined';
}

function loadStoredData(): InsightDashboardData | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InsightDashboardData>;
    return {
      sessions: parsed.sessions ?? [],
      inputs: { ...DEFAULT_INPUTS, ...(parsed.inputs ?? {}) },
      digests: parsed.digests ?? [],
    };
  } catch {
    return null;
  }
}

function saveStoredData(data: InsightDashboardData) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadInsightDashboard(): InsightDashboardData {
  const stored = loadStoredData();
  if (stored) return stored;

  const empty = {
    sessions: [],
    inputs: DEFAULT_INPUTS,
    digests: [],
  };
  saveStoredData(empty);
  return empty;
}

export function saveInsightInputs(inputs: InsightInputs) {
  const current = loadInsightDashboard();
  const next = { ...current, inputs };
  saveStoredData(next);
  return next;
}

export function saveWeeklyDigest(entry: Omit<WeeklyDigestEntry, 'id'>) {
  const current = loadInsightDashboard();
  const nextEntry: WeeklyDigestEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };
  const next = {
    ...current,
    digests: [nextEntry, ...current.digests].slice(0, 8),
  };
  saveStoredData(next);
  return next;
}

export function recordFocusInsightSession(durationMinutes: number) {
  const current = loadInsightDashboard();
  const now = new Date();
  const hour = now.getHours();
  const focusBoost = hour >= 8 && hour <= 11 ? 18 : hour >= 12 && hour <= 16 ? 6 : -4;
  const durationBoost = durationMinutes >= 25 ? 8 : durationMinutes >= 20 ? 4 : 0;
  const focusScore = clamp(58 + focusBoost + durationBoost, 35, 95);
  const moodBefore = hour >= 18 ? 2 : 3;
  const moodAfter = clamp(moodBefore + (durationMinutes >= 20 ? 1 : 0), 1, 5);

  const session: InsightSession = {
    id: crypto.randomUUID(),
    startedAt: now.toISOString(),
    durationMinutes,
    focusScore,
    moodBefore,
    moodAfter,
  };

  const next = {
    ...current,
    sessions: [...current.sessions, session].slice(-28),
  };
  saveStoredData(next);
  return session;
}

export function computeHeatmap(sessions: InsightSession[]): HeatmapCell[] {
  return DAY_LABELS.flatMap((dayLabel, dayIndex) =>
    BUCKETS.map((bucket) => {
      const matching = sessions.filter((session) => {
        const date = new Date(session.startedAt);
        const hour = date.getHours();
        return date.getDay() === dayIndex && hour >= bucket.start && hour < bucket.end;
      });

      const average = matching.length
        ? Math.round(
            matching.reduce((total, session) => total + session.focusScore, 0) / matching.length,
          )
        : 0;

      return {
        dayLabel,
        bucketLabel: bucket.label,
        value: average,
      };
    }),
  );
}

export function computeSessionTrend(sessions: InsightSession[]): TrendPoint[] {
  const byDay = new Map<string, number[]>();

  for (const session of sessions) {
    const label = new Date(session.startedAt).toLocaleDateString([], {
      weekday: 'short',
    });
    const existing = byDay.get(label) ?? [];
    existing.push(session.durationMinutes);
    byDay.set(label, existing);
  }

  return Array.from(byDay.entries()).map(([label, values]) => ({
    label,
    minutes: Math.round(values.reduce((total, value) => total + value, 0) / values.length),
  }));
}

export function computeMoodCorrelations(
  sessions: InsightSession[],
  inputs: InsightInputs,
): CorrelationMetric[] {
  const averageMoodDelta = sessions.length
    ? sessions.reduce((total, session) => total + (session.moodAfter - session.moodBefore), 0) /
      sessions.length
    : 0;
  const averageFocus = sessions.length
    ? sessions.reduce((total, session) => total + session.focusScore, 0) / sessions.length
    : 0;

  const sleepLift = inputs.sleepHours >= 7 ? '+8%' : inputs.sleepHours >= 6 ? '+3%' : '-6%';
  const caffeineEffect = ['steady', 'mild lift', 'helpful for noon slump', 'watch the crash'][inputs.caffeineLevel];

  return [
    {
      label: 'Mood lift',
      value: `${averageMoodDelta.toFixed(1)} pts`,
      note: 'Average self-reported change from start to finish.',
    },
    {
      label: 'Focus quality',
      value: `${Math.round(averageFocus)} / 100`,
      note: 'Derived from session length and completion pattern.',
    },
    {
      label: 'Sleep effect',
      value: sleepLift,
      note: `Based on your current ${inputs.sleepHours.toFixed(1)}h baseline.`,
    },
    {
      label: 'Caffeine signal',
      value: caffeineEffect,
      note: 'Optional input only. Never required to get insights.',
    },
  ];
}

export function buildWeeklyDigest(
  sessions: InsightSession[],
  inputs: InsightInputs,
) {
  const trend = computeSessionTrend(sessions);
  const best = [...sessions].sort((left, right) => right.focusScore - left.focusScore)[0];
  const morningSessions = sessions.filter((session) => new Date(session.startedAt).getHours() < 12);
  const morningAverage = morningSessions.length
    ? Math.round(
        morningSessions.reduce((total, session) => total + session.focusScore, 0) /
          morningSessions.length,
      )
    : 0;

  return {
    deliveryLabel: 'Sunday, 9:00 AM',
    title: 'Weekly pattern read',
    summary: `Your cleanest focus is still showing up earlier in the day. Morning sessions averaged ${morningAverage}/100 this week, and your best completed block hit ${best?.focusScore ?? 0}/100.`,
    bullets: [
      trend.length > 0
        ? `${trend[trend.length - 1].label} sessions averaged ${trend[trend.length - 1].minutes} minutes.`
        : 'No sessions logged yet.',
      inputs.sleepHours >= 7
        ? 'Sleep looks supportive right now. Protect the first session before noon.'
        : 'Sleep is probably constraining your first session. Keep the first block shorter.',
      inputs.caffeineLevel >= 2
        ? 'Caffeine is helping midday activation, but the evening crash risk is rising.'
        : 'Caffeine use looks moderate enough to avoid a late-day drop.',
    ],
  };
}

export function nextWeeklyDigestAt(now = new Date()) {
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  const day = next.getDay();
  const daysUntilSunday = (7 - day) % 7;
  next.setDate(next.getDate() + daysUntilSunday);

  if (daysUntilSunday === 0 && now >= next) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

export function isWeeklyDigestDue(
  digests: WeeklyDigestEntry[],
  now = new Date(),
) {
  const deliveredThisWeek = digests.some((digest) => {
    const deliveredAt = new Date(digest.deliveredAt);
    return deliveredAt >= startOfDigestWindow(now) && deliveredAt <= now;
  });

  return now >= digestSlotForDate(now) && !deliveredThisWeek;
}

export function syncWeeklyDigestDelivery(
  payload: {
    title: string;
    summary: string;
    bullets: string[];
    deliveryLabel: string;
  },
  options: {
    notify: boolean;
    now?: Date;
  },
) {
  const current = loadInsightDashboard();
  const now = options.now ?? new Date();
  if (!isWeeklyDigestDue(current.digests, now)) {
    return current;
  }

  const next = saveWeeklyDigest({
    ...payload,
    deliveredAt: now.toISOString(),
  });

  if (
    options.notify &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    const bullet = payload.bullets[0] ?? 'Your weekly read is ready.';
    new Notification('Anchor weekly digest', {
      body: `${payload.summary} ${bullet}`,
    });
  }

  return next;
}

export async function requestDigestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported' as const;
  }
  return Notification.requestPermission();
}

export function readDigestPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported' as const;
  }
  return Notification.permission;
}

function digestSlotForDate(now: Date) {
  const slot = new Date(now);
  slot.setHours(9, 0, 0, 0);
  slot.setDate(slot.getDate() - slot.getDay());
  return slot;
}

function startOfDigestWindow(now: Date) {
  const start = digestSlotForDate(now);
  start.setDate(start.getDate() - 7);
  return start;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
