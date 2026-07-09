const VAPID_PUBLIC_KEY_ENV = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

async function getVapidPublicKey(): Promise<string> {
  if (VAPID_PUBLIC_KEY_ENV) return VAPID_PUBLIC_KEY_ENV;
  try {
    const res = await fetch('/v1/notifications/vapid-public-key');
    if (res.ok) {
      const data = await res.json() as { public_key: string };
      return data.public_key ?? '';
    }
  } catch { /* fall through */ }
  return '';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  const key = await getVapidPublicKey();
  if (!key) return null;
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
    });
  } catch {
    return null;
  }
}

export async function sendSubscriptionToServer(
  sub: PushSubscription,
  crashWindow: string
): Promise<void> {
  await fetch('/api/v1/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), crash_window: crashWindow }),
  });
}

export async function initPushNotifications(crashWindow: string): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  const sub = await subscribeToPush(reg);
  if (sub) await sendSubscriptionToServer(sub, crashWindow);
}
