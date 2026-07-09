import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import ProfilePage from '../src/pages/ProfilePage.js';

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

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      location: { origin: 'http://localhost:4173' },
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
          total_xp: 80,
          catalog: [],
          active_theme: null,
          active_sound: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    configurable: true,
  });

  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => 'profile-check-id',
      },
      configurable: true,
    });
  }
}

function main() {
  resetEnvironment();

  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });

  const start = performance.now();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const elapsedMs = performance.now() - start;

  const bestFocusIndex = html.indexOf('Best focus times');
  const avgSessionIndex = html.indexOf('Average session length');
  const moodIndex = html.indexOf('Mood × performance');
  const digestIndex = html.indexOf('Weekly digest');

  assert.ok(elapsedMs < 1000, `dashboard should render in under 1s, got ${elapsedMs.toFixed(1)}ms`);
  assert.ok(bestFocusIndex !== -1, 'dashboard should include focus heatmap');
  assert.ok(avgSessionIndex !== -1, 'dashboard should include session trend');
  assert.ok(moodIndex !== -1, 'dashboard should include correlations');
  assert.ok(digestIndex !== -1, 'dashboard should include weekly digest');
  assert.ok(bestFocusIndex < avgSessionIndex, 'charts should read top-to-bottom');
  assert.ok(avgSessionIndex < moodIndex, 'charts should keep stable order');
  assert.ok(moodIndex < digestIndex, 'digest should come after the data cards');

  console.log(
    JSON.stringify(
      {
        elapsedMs: Number(elapsedMs.toFixed(1)),
        ordering: {
          bestFocusIndex,
          avgSessionIndex,
          moodIndex,
          digestIndex,
        },
      },
      null,
      2,
    ),
  );
}

main();
