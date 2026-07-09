import assert from 'node:assert/strict';

import {
  buildWeeklyDigest,
  isWeeklyDigestDue,
  loadInsightDashboard,
  nextWeeklyDigestAt,
  saveInsightInputs,
  syncWeeklyDigestDelivery,
} from '../src/lib/insights.js';

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
        randomUUID: () => 'digest-id',
      },
      configurable: true,
    });
  }
}

function main() {
  resetStorage();

  const seeded = loadInsightDashboard();
  const preview = buildWeeklyDigest(seeded.sessions, seeded.inputs);
  const dueAt = new Date('2026-05-10T09:05:00');

  assert.equal(isWeeklyDigestDue(seeded.digests, dueAt), true);

  const delivered = syncWeeklyDigestDelivery(preview, {
    notify: false,
    now: dueAt,
  });

  assert.equal(delivered.digests.length, 1, 'digest should be persisted once due');
  assert.equal(isWeeklyDigestDue(delivered.digests, dueAt), false, 'same weekly window should not redeliver');
  assert.equal(delivered.digests[0]?.title, preview.title);

  const next = nextWeeklyDigestAt(new Date('2026-05-10T09:05:00'));
  assert.equal(next.getDay(), 0);
  assert.equal(next.getHours(), 9);
  assert.equal(next.getMinutes(), 0);

  const updated = saveInsightInputs({
    ...delivered.inputs,
    digestPushOptIn: true,
  });
  assert.equal(updated.inputs.digestPushOptIn, true, 'push opt-in should persist');

  console.log(
    JSON.stringify(
      {
        deliveredCount: delivered.digests.length,
        latestTitle: delivered.digests[0]?.title,
        nextDigestAt: next.toISOString(),
        pushOptIn: updated.inputs.digestPushOptIn,
      },
      null,
      2,
    ),
  );
}

main();
