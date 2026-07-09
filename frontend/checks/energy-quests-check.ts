import assert from 'node:assert/strict';

import {
  bestQuestInsight,
  computeQuestHeatmap,
  loadQuestStore,
  QUEST_CATALOG,
  recordQuestCompletion,
} from '../src/lib/quests.js';

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

function main() {
  resetStorage();

  const suggestedQuest = QUEST_CATALOG[0];
  assert.equal(suggestedQuest.id, 'desk-reset', 'catalog should expose the one-tap starter quest');

  recordQuestCompletion('desk-reset', 2, 3, 90);
  recordQuestCompletion('dance-break', 1, 4, 120);
  recordQuestCompletion('dance-break', 2, 5, 120);

  const logs = loadQuestStore().logs;
  assert.equal(logs.length, 3, 'quest completion should persist mood delta logs');

  const bestQuest = bestQuestInsight(logs);
  assert.ok(bestQuest, 'best quest insight should be available after multiple runs');
  assert.equal(bestQuest.quest.id, 'dance-break');
  assert.equal(bestQuest.averageDelta, 3);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  const heatmapCell = computeQuestHeatmap(logs).find(
    (cell) => cell.questLabel === 'Dance break' && cell.dayLabel === todayLabel,
  );
  assert.ok(heatmapCell, 'heatmap should include a cell for today');
  assert.equal(heatmapCell.delta, 3, 'heatmap should reflect logged mood lift');

  console.log(
    JSON.stringify(
      {
        suggestedQuest: suggestedQuest.label,
        logCount: logs.length,
        bestQuest: bestQuest.quest.label,
        bestDelta: bestQuest.averageDelta,
        todayHeatmapDelta: heatmapCell.delta,
      },
      null,
      2,
    ),
  );
}

main();
