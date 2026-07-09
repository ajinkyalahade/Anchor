import assert from 'node:assert/strict';

import {
  type SuggestedAction,
  computeModalityPreferences,
  personalizeSuggestion,
} from '../src/lib/personalization.js';
import { loadQuestStore, recordQuestCompletion } from '../src/lib/quests.js';

function resetStorage() {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });

  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => 'quest-log-id',
      },
      configurable: true,
    });
  }
}

function buildFocusSessions() {
  return [
    {
      id: 'f1',
      startedAt: '2026-05-05T09:00:00Z',
      durationMinutes: 25,
      focusScore: 84,
      moodBefore: 2,
      moodAfter: 3,
    },
    {
      id: 'f2',
      startedAt: '2026-05-05T10:00:00Z',
      durationMinutes: 20,
      focusScore: 79,
      moodBefore: 2,
      moodAfter: 3,
    },
    {
      id: 'f3',
      startedAt: '2026-05-05T11:00:00Z',
      durationMinutes: 25,
      focusScore: 86,
      moodBefore: 2,
      moodAfter: 3,
    },
  ];
}

function main() {
  resetStorage();

  recordQuestCompletion('dance-break', 1, 4, 120);
  recordQuestCompletion('dance-break', 2, 4, 120);
  recordQuestCompletion('dance-break', 2, 5, 120);

  const questStore = loadQuestStore();
  assert.equal(questStore.logs.length, 3, 'quest mood deltas should be logged');
  assert.equal(questStore.logs[0].questId, 'dance-break');

  const preferences = computeModalityPreferences(buildFocusSessions(), questStore.logs);
  assert.equal(preferences[0]?.modality, 'quests', 'quests should rank first when mood lift is strongest');

  const baselineSuggestion: SuggestedAction = {
    action: 'games',
    label: 'Word Gym',
    route: '/games',
    duration: '1 min',
    reason: 'baseline',
    week_label: null,
  };

  const personalized = personalizeSuggestion(baselineSuggestion, preferences, questStore.logs);
  assert.equal(personalized?.route, '/quests', 'suggestion should shift toward quests when they are most effective');

  console.log(
    JSON.stringify(
      {
        questLogs: questStore.logs.length,
        topModality: preferences[0],
        personalized,
      },
      null,
      2,
    ),
  );
}

main();
