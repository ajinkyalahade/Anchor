export interface QuestDefinition {
  id: string;
  label: string;
  description: string;
  durationSeconds: number;
  accent: 'focus' | 'calm' | 'spark' | 'warm' | 'lilac';
}

export interface QuestLog {
  id: string;
  questId: string;
  moodBefore: number;
  moodAfter: number;
  completedAt: string;
  durationSeconds: number;
}

export interface QuestStore {
  logs: QuestLog[];
}

export interface QuestHeatmapCell {
  questLabel: string;
  dayLabel: string;
  delta: number | null;
}

export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: 'desk-reset',
    label: 'Desk reset',
    description: 'Stand, reset posture, and clear one thing from your desk.',
    durationSeconds: 90,
    accent: 'focus',
  },
  {
    id: 'cold-splash',
    label: 'Cold splash',
    description: 'Cold water on wrists or face to interrupt the stall.',
    durationSeconds: 90,
    accent: 'calm',
  },
  {
    id: 'dance-break',
    label: 'Dance break',
    description: 'Move hard enough to change state, not to optimize cardio.',
    durationSeconds: 120,
    accent: 'spark',
  },
  {
    id: 'step-outside',
    label: 'Step outside',
    description: 'Get daylight or air for two minutes with no task attached.',
    durationSeconds: 120,
    accent: 'lilac',
  },
  {
    id: 'hydrate',
    label: 'Hydrate',
    description: 'Finish a glass of water before you negotiate with yourself.',
    durationSeconds: 90,
    accent: 'focus',
  },
  {
    id: 'power-pose',
    label: 'Power pose',
    description: 'Open posture, slow breath, and hold it long enough to settle.',
    durationSeconds: 180,
    accent: 'warm',
  },
];

const STORAGE_KEY = 'anchor_energy_quests_v1';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isBrowser() {
  return typeof window !== 'undefined';
}

function saveStore(store: QuestStore) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadQuestStore(): QuestStore {
  if (!isBrowser()) {
    return { logs: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { logs: [] };
    return JSON.parse(raw) as QuestStore;
  } catch {
    return { logs: [] };
  }
}

export function recordQuestCompletion(
  questId: string,
  moodBefore: number,
  moodAfter: number,
  durationSeconds: number,
) {
  const current = loadQuestStore();
  const log: QuestLog = {
    id: crypto.randomUUID(),
    questId,
    moodBefore,
    moodAfter,
    completedAt: new Date().toISOString(),
    durationSeconds,
  };
  const next = {
    logs: [...current.logs, log].slice(-60),
  };
  saveStore(next);
  return log;
}

export function questCountToday(logs: QuestLog[]) {
  const today = new Date().toDateString();
  return logs.filter((log) => new Date(log.completedAt).toDateString() === today).length;
}

export function bestQuestInsight(logs: QuestLog[]) {
  const byQuest = new Map<string, number[]>();

  for (const log of logs) {
    const questLogs = byQuest.get(log.questId) ?? [];
    questLogs.push(log.moodAfter - log.moodBefore);
    byQuest.set(log.questId, questLogs);
  }

  const ranked = Array.from(byQuest.entries())
    .map(([questId, deltas]) => ({
      quest: QUEST_CATALOG.find((entry) => entry.id === questId) ?? QUEST_CATALOG[0],
      averageDelta: Number(
        (deltas.reduce((total, value) => total + value, 0) / deltas.length).toFixed(1),
      ),
      runs: deltas.length,
    }))
    .sort((left, right) => right.averageDelta - left.averageDelta);

  return ranked[0] ?? null;
}

export function computeQuestHeatmap(logs: QuestLog[]): QuestHeatmapCell[] {
  return QUEST_CATALOG.flatMap((quest) =>
    DAY_LABELS.map((dayLabel, dayIndex) => {
      const matches = logs.filter((log) => {
        const date = new Date(log.completedAt);
        return date.getDay() === dayIndex && log.questId === quest.id;
      });

      if (matches.length === 0) {
        return {
          questLabel: quest.label,
          dayLabel,
          delta: null,
        };
      }

      const averageDelta = Number(
        (
          matches.reduce((total, log) => total + (log.moodAfter - log.moodBefore), 0) /
          matches.length
        ).toFixed(1),
      );

      return {
        questLabel: quest.label,
        dayLabel,
        delta: averageDelta,
      };
    }),
  );
}
