import assert from 'node:assert/strict';

import {
  buildAnchorExportBundle,
  buildAnchorExportCsv,
  buildClinicianReportHtml,
  buildClinicianPdfBlob,
  buildClinicianSummary,
  buildClinicianSummaryText,
  createReadOnlySharePacket,
  getReadOnlySharePacket,
  loadReadOnlySharePackets,
  revokeReadOnlySharePacket,
} from '../src/lib/export.js';
import { saveInsightInputs, syncWeeklyDigestDelivery } from '../src/lib/insights.js';
import { saveBrainDumpEntries, saveCaptureInboxItems, saveTimeBlocks } from '../src/lib/planner.js';
import { recordQuestCompletion } from '../src/lib/quests.js';

function resetEnvironment() {
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

  const atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
  const btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage, location: { origin: 'http://localhost:4173' }, atob, btoa },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: async () =>
      new Response(
        JSON.stringify({
          total_xp: 80,
          catalog: [],
          active_theme: 'theme_focus_blue',
          active_sound: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    configurable: true,
  });

  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => 'export-id',
      },
      configurable: true,
    });
  }

  Object.defineProperty(globalThis, 'atob', {
    value: atob,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'btoa', {
    value: btoa,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'self', {
    value: globalThis.window,
    configurable: true,
  });
}

async function main() {
  resetEnvironment();

  localStorage.setItem('anchor_user_id', 'user-123');
  localStorage.setItem('anchor_active_theme', 'theme_focus_blue');
  localStorage.setItem('anchor_dyslexia_font', 'true');

  saveTimeBlocks([
    {
      id: 'block-1',
      date: '2026-05-06',
      startTime: '09:00',
      durationMinutes: 45,
      title: 'Write summary',
      quadrant: 'do',
      completed: true,
    },
  ]);
  saveCaptureInboxItems([{ id: 'cap-1', text: 'Ask about refill', createdAt: '2026-05-06T09:00:00.000Z', source: 'text' }]);
  saveBrainDumpEntries([
    {
      id: 'dump-1',
      text: 'Need to sort sleep routine and inbox backlog.',
      createdAt: '2026-05-06T21:00:00.000Z',
      source: 'text',
      status: 'queued',
    },
  ]);
  recordQuestCompletion('dance-break', 1, 4, 120);
  saveInsightInputs({
    medicationTaken: false,
    sleepHours: 7.5,
    caffeineLevel: 1,
    digestPushOptIn: true,
  });
  syncWeeklyDigestDelivery(
    {
      title: 'Weekly pattern read',
      summary: 'Mornings are cleaner than afternoons.',
      bullets: ['One', 'Two', 'Three'],
      deliveryLabel: 'Sunday, 9:00 AM',
    },
    { notify: false, now: new Date('2026-05-10T09:05:00') },
  );

  const bundle = await buildAnchorExportBundle();
  assert.equal(bundle.user.userId, 'user-123');
  assert.equal(bundle.user.dyslexiaFont, true);
  assert.equal(bundle.planner.timeBlocks.length, 1);
  assert.equal(bundle.quests.logs.length, 1);
  assert.equal(bundle.insights.digests.length, 1);

  const csv = buildAnchorExportCsv(bundle);
  assert.ok(csv.includes('focus_session'));
  assert.ok(csv.includes('quest'));
  assert.ok(csv.includes('time_block'));

  const summary = buildClinicianSummary(bundle);
  assert.equal(summary.topQuest, 'dance-break');
  assert.equal(summary.plannerBlocksCompleted, 1);
  assert.ok(summary.notes.length > 0);

  const text = buildClinicianSummaryText(summary);
  assert.ok(text.includes('Anchor Clinician Summary'));
  assert.ok(text.includes('Top quest: dance-break'));

  const html = buildClinicianReportHtml(bundle, summary);
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('Recent focus sessions'));
  assert.ok(html.includes('Recent quest runs'));

  const pdfBlob = await buildClinicianPdfBlob(bundle, summary);
  const pdfText = await pdfBlob.text();
  assert.ok(pdfText.startsWith('%PDF-'), 'pdf export should start with PDF header');

  const sharePacket = createReadOnlySharePacket(bundle, summary, 'Partner share');
  assert.equal(loadReadOnlySharePackets().length, 1);
  assert.equal(getReadOnlySharePacket(sharePacket.id)?.label, 'Partner share');
  assert.equal(revokeReadOnlySharePacket(sharePacket.id).length, 0);

  console.log(
    JSON.stringify(
      {
        rewardsXp: bundle.rewards?.total_xp,
        digestCount: bundle.insights.digests.length,
        csvRows: csv.split('\n').length,
        clinicianTopQuest: summary.topQuest,
        htmlLength: html.length,
        pdfBytes: pdfBlob.size,
        sharePacketId: sharePacket.id,
      },
      null,
      2,
    ),
  );
}

await main();
