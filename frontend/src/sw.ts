/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    revision: string | null;
    url: string;
  }>;
};

// registerType: 'autoUpdate' only takes effect if the new worker activates and
// claims open pages — otherwise a fresh bundle sits "waiting" and users keep
// running stale code until every tab closes. Take over immediately.
void self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'anchor-app-shell',
  }),
);

// Offline fallback: when a navigation can't be served from network or cache
// (e.g. first visit while offline, or an uncached deep link), return the
// precached SPA shell so the app still boots and shows its own offline UI
// instead of the browser's dinosaur.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const shell = await matchPrecache('index.html');
    if (shell) return shell;
  }
  return Response.error();
});

registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'anchor-static-assets',
  }),
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'anchor-images',
  }),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'Time to check in.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open Anchor' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  } as NotificationOptions & {
    actions: Array<{ action: string; title: string }>;
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Anchor', options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(url) && 'focus' in client);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
