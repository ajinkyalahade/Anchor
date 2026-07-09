import assert from 'node:assert/strict';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import SharedReportPage from '../src/pages/SharedReportPage.js';
import {
  buildAnchorExportBundle,
  buildClinicianSummary,
  createReadOnlySharePacket,
  revokeReadOnlySharePacket,
} from '../src/lib/export.js';
import { saveInsightInputs, syncWeeklyDigestDelivery } from '../src/lib/insights.js';
import { saveTimeBlocks } from '../src/lib/planner.js';
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
    value: {
      localStorage,
      location: { origin: 'http://localhost:4173' },
      atob,
      btoa,
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: {
      documentElement: {
        classList: {
          add() {},
          remove() {},
          toggle() {},
        },
      },
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: async () =>
      new Response(
        JSON.stringify({
          total_xp: 120,
          catalog: [],
          active_theme: 'theme_focus_blue',
          active_sound: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'atob', {
    value: atob,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'btoa', {
    value: btoa,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'shared-check-id',
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'React', {
    value: React,
    configurable: true,
  });
}

function renderPath(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shared/:packetId" element={<SharedReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function main() {
  resetEnvironment();

  localStorage.setItem('anchor_user_id', 'user-123');
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
  recordQuestCompletion('dance-break', 2, 4, 120);
  saveInsightInputs({
    medicationTaken: false,
    sleepHours: 8,
    caffeineLevel: 1,
    digestPushOptIn: true,
  });
  syncWeeklyDigestDelivery(
    {
      title: 'Weekly pattern read',
      summary: 'Morning focus still wins.',
      bullets: ['One', 'Two'],
      deliveryLabel: 'Sunday, 9:00 AM',
    },
    { notify: false, now: new Date('2026-05-10T09:05:00') },
  );

  const bundle = await buildAnchorExportBundle();
  const summary = buildClinicianSummary(bundle);
  const packet = createReadOnlySharePacket(bundle, summary, 'Partner share');

  const availableHtml = renderPath(`/shared/${packet.id}`);
  assert.ok(availableHtml.includes('Partner share'));
  assert.ok(availableHtml.includes('Read only'));
  assert.ok(availableHtml.includes('Top quest'));
  assert.ok(availableHtml.includes('Morning focus still wins.'));

  revokeReadOnlySharePacket(packet.id);
  const revokedHtml = renderPath(`/shared/${packet.id}`);
  assert.ok(revokedHtml.includes('Share unavailable'));
  assert.ok(revokedHtml.includes('has been revoked'));

  console.log(
    JSON.stringify(
      {
        packetId: packet.id,
        availableLength: availableHtml.length,
        revokedLength: revokedHtml.length,
      },
      null,
      2,
    ),
  );
}

await main();
