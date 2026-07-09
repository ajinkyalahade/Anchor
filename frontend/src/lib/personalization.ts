import { type InsightSession } from './insights.js';
import { QUEST_CATALOG, type QuestLog } from './quests.js';

export type ModalityId = 'focus' | 'quests' | 'calm' | 'games';

export interface ModalityPreference {
  modality: ModalityId;
  label: string;
  averageDelta: number | null;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  note: string;
}

export interface SuggestedAction {
  action: string;
  label: string;
  route: string;
  duration: string;
  reason: string;
  week_label: string | null;
}

const MODALITY_LABELS: Record<ModalityId, string> = {
  focus: 'Focus',
  quests: 'Energy Quests',
  calm: 'Calm',
  games: 'Games',
};

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function confidenceForSamples(sampleCount: number): 'high' | 'medium' | 'low' {
  if (sampleCount >= 6) return 'high';
  if (sampleCount >= 3) return 'medium';
  return 'low';
}

export function computeModalityPreferences(
  focusSessions: InsightSession[],
  questLogs: QuestLog[],
): ModalityPreference[] {
  const focusDeltas = focusSessions.map((session) => session.moodAfter - session.moodBefore);
  const questDeltas = questLogs.map((log) => log.moodAfter - log.moodBefore);

  const raw: Array<{ modality: ModalityId; deltas: number[] }> = [
    { modality: 'focus', deltas: focusDeltas },
    { modality: 'quests', deltas: questDeltas },
    { modality: 'calm', deltas: [] },
    { modality: 'games', deltas: [] },
  ];

  return raw
    .map(({ modality, deltas }) => {
      const sampleCount = deltas.length;
      const averageDelta = sampleCount > 0 ? Number(average(deltas).toFixed(1)) : null;
      const confidence = confidenceForSamples(sampleCount);
      const score = averageDelta === null ? -1 : averageDelta + Math.min(sampleCount / 10, 1);
      const note =
        averageDelta === null
          ? 'Need a few logged runs before this can rank.'
          : averageDelta > 0
            ? `Average lift of ${averageDelta} across ${sampleCount} logged runs.`
            : `Not consistently lifting mood yet across ${sampleCount} runs.`;

      return {
        modality,
        label: MODALITY_LABELS[modality],
        averageDelta,
        sampleCount,
        confidence,
        score,
        note,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function topHelpfulQuestLabel(questLogs: QuestLog[]) {
  const byQuest = new Map<string, number[]>();

  for (const log of questLogs) {
    const deltas = byQuest.get(log.questId) ?? [];
    deltas.push(log.moodAfter - log.moodBefore);
    byQuest.set(log.questId, deltas);
  }

  const ranked = Array.from(byQuest.entries())
    .map(([questId, deltas]) => ({
      questLabel:
        QUEST_CATALOG.find((quest: (typeof QUEST_CATALOG)[number]) => quest.id === questId)?.label ??
        'Energy quest',
      averageDelta: average(deltas),
    }))
    .sort((left, right) => right.averageDelta - left.averageDelta);

  return ranked[0]?.questLabel ?? 'Energy quest';
}

export function personalizeSuggestion(
  suggestion: SuggestedAction | null,
  preferences: ModalityPreference[],
  questLogs: QuestLog[],
): SuggestedAction | null {
  if (!suggestion) return null;

  const top = preferences[0];
  if (!top || top.averageDelta === null || top.averageDelta < 0.6 || top.sampleCount < 3) {
    return suggestion;
  }

  if (top.modality === 'focus' && suggestion.action !== 'focus') {
    return {
      ...suggestion,
      action: 'focus',
      label: 'Start a focus session',
      route: '/focus',
      duration: '15-25 min',
      reason: `Focus is giving you the strongest lift right now: ${top.averageDelta} on average.`,
    };
  }

  if (top.modality === 'quests' && suggestion.route !== '/quests') {
    return {
      ...suggestion,
      action: 'quests',
      label: topHelpfulQuestLabel(questLogs),
      route: '/quests',
      duration: '90 sec-3 min',
      reason: `Energy Quests are moving mood best right now: ${top.averageDelta} on average.`,
    };
  }

  return suggestion;
}
