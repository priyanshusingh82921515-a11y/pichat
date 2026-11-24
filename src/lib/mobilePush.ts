/**
 * Mobile Phone & Desktop Web Push Notifications helper for Quadline.
 * Supports Android Chrome, installed Android/iOS PWAs, and Desktop browsers.
 * Uses ServiceWorkerRegistration.showNotification() so Android Chrome never throws
 * `Illegal constructor` on `new Notification(...)`.
 */

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface MobilePushResult {
  ok: boolean;
  permission: PushPermissionState;
  deviceCount?: number;
  error?: string;
}

export interface MobilePushStatus {
  supported: boolean;
  subscribed: boolean;
  deviceCount: number;
  devices: Array<{ deviceLabel: string; updatedAt: number }>;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOSNeedsHomeScreenInstall(): boolean {
  return isIOSDevice() && !isStandalonePWA();
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
}

export function getNotificationPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function getFriendlyDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Mobile Device';
  const ua = navigator.userAgent || '';
  const standalone = isStandalonePWA() ? ' App' : '';
  if (/Android/i.test(ua)) return `Android Phone${standalone}`;
  if (/iPhone/i.test(ua)) return `iPhone${standalone}`;
  if (/iPad/i.test(ua)) return `iPad${standalone}`;
  if (/Mac OS X/i.test(ua)) return `Mac${standalone}`;
  if (/Windows/i.test(ua)) return `Windows${standalone}`;
  if (/Linux/i.test(ua)) return `Linux${standalone}`;
  return `Browser${standalone}`;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) {
      if (existing.active) return existing;
    }

    const readyWithTimeout = Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
    ]);

    const readyReg = await readyWithTimeout;
    if (readyReg) return readyReg;

    // Fallback: register standalone push-sw.js directly if VitePWA SW is not active yet
    const directReg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return directReg;
  } catch {
    return null;
  }
}

export async function fetchPushStatus(uid: string): Promise<MobilePushStatus> {
  try {
    const res = await fetch(`/api/push/status?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) {
      return { supported: false, subscribed: false, deviceCount: 0, devices: [] };
    }
    return (await res.json()) as MobilePushStatus;
  } catch {
    return { supported: false, subscribed: false, deviceCount: 0, devices: [] };
  }
}

async function registerSubscriptionOnServer(
  uid: string,
  subscription: PushSubscription
): Promise<{ ok: boolean; deviceCount: number }> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, deviceCount: 0 };
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid,
      subscription: {
        endpoint: json.endpoint,
        expirationTime: json.expirationTime ?? null,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      },
      deviceLabel: getFriendlyDeviceLabel(),
    }),
  });
  if (!res.ok) return { ok: false, deviceCount: 0 };
  const data = (await res.json()) as { ok?: boolean; deviceCount?: number };
  return { ok: Boolean(data.ok), deviceCount: Number(data.deviceCount || 0) };
}

export async function subscribeDeviceToMobilePush(uid: string): Promise<MobilePushResult> {
  if (!uid) {
    return { ok: false, permission: getNotificationPermission(), error: 'Sign in first.' };
  }

  if (isIOSNeedsHomeScreenInstall()) {
    return {
      ok: false,
      permission: getNotificationPermission(),
      error: 'On iPhone/iPad, tap Share → Add to Home Screen first, then open Quadline from your Home Screen to turn on phone notifications.',
    };
  }

  if (!('Notification' in window)) {
    return {
      ok: false,
      permission: 'unsupported',
      error: 'This browser does not support mobile push notifications.',
    };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return {
        ok: false,
        permission: 'denied',
        error: 'Unable to request notification permission.',
      };
    }
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      error: 'Notification permission is blocked. Allow notifications in your phone browser site settings.',
    };
  }

  if (!isPushSupported()) {
    return { ok: true, permission: 'granted', deviceCount: 1 };
  }

  try {
    const vapidRes = await fetch('/api/push/vapid-public-key');
    const vapidData = (await vapidRes.json()) as { supported?: boolean; publicKey?: string };
    if (!vapidData.supported || !vapidData.publicKey) {
      return {
        ok: true,
        permission: 'granted',
        error: 'Browser alerts enabled (background push key unavailable).',
      };
    }

    const registration = await ensurePushServiceWorker();
    if (!registration || !registration.pushManager) {
      return {
        ok: true,
        permission: 'granted',
        error: 'Local notifications enabled (service worker unavailable in this view).',
      };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
    }

    const saved = await registerSubscriptionOnServer(uid, subscription);
    return {
      ok: saved.ok,
      permission: 'granted',
      deviceCount: saved.deviceCount,
      error: saved.ok ? undefined : 'Could not save device push subscription on server.',
    };
  } catch (err) {
    return {
      ok: false,
      permission: 'granted',
      error:
        err instanceof Error
          ? err.message
          : 'Could not register background push on this device.',
    };
  }
}

/**
 * Silent background sync on login: if the user already granted notification permission,
 * ensures this phone's PushSubscription is registered & fresh on the server without prompting.
 */
export async function syncExistingMobilePushSubscription(
  uid: string
): Promise<{ subscribed: boolean; deviceCount: number }> {
  if (!uid || !isPushSupported() || Notification.permission !== 'granted') {
    return { subscribed: false, deviceCount: 0 };
  }
  try {
    const registration = await ensurePushServiceWorker();
    if (!registration || !registration.pushManager) {
      return { subscribed: false, deviceCount: 0 };
    }
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const vapidData = (await vapidRes.json()) as { supported?: boolean; publicKey?: string };
      if (!vapidData.supported || !vapidData.publicKey) {
        return { subscribed: false, deviceCount: 0 };
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
    }
    const saved = await registerSubscriptionOnServer(uid, subscription);
    return { subscribed: saved.ok, deviceCount: saved.deviceCount };
  } catch {
    return { subscribed: false, deviceCount: 0 };
  }
}

export async function unsubscribeDeviceFromMobilePush(uid: string): Promise<void> {
  if (!uid) return;
  let endpoint = '';
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
      }
    }
  } catch {
    // Ignore
  }
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, endpoint }),
    });
  } catch {
    // Ignore
  }
}

export async function sendTestPhoneNotification(
  uid: string
): Promise<{ ok: boolean; sent: number; deviceCount: number; usedLocalFallback?: boolean }> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    const data = (await res.json()) as { ok?: boolean; sent?: number; deviceCount?: number };
    if (data.ok && Number(data.sent || 0) > 0) {
      return {
        ok: true,
        sent: Number(data.sent || 1),
        deviceCount: Number(data.deviceCount || 1),
      };
    }
  } catch {
    // Fall through to local SW notification test
  }

  // Fallback: trigger directly through the Service Worker so Android/Desktop still shows a native phone tray notification
  const shown = await showLocalServiceWorkerNotification({
    title: 'Quadline Phone Alerts Active',
    body: 'Notifications are ready on your device for messages, calls, and friend requests!',
    url: '/',
    tag: 'quadline-test',
    category: 'system',
  });
  return { ok: shown, sent: shown ? 1 : 0, deviceCount: shown ? 1 : 0, usedLocalFallback: shown };
}

export function sendBackgroundRoomPush(payload: {
  senderUid: string;
  recipientIds: string[];
  roomId: string;
  title: string;
  body: string;
  category?: 'message' | 'call' | 'social' | 'story' | 'system';
}): void {
  if (!payload.recipientIds || payload.recipientIds.length === 0) return;
  void fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Displays a native system notification safely on Android Chrome, iOS PWA, and Desktop.
 * Uses ServiceWorkerRegistration.showNotification first because Android Chrome throws
 * `Illegal constructor` on `new Notification(...)`.
 */
export async function showLocalServiceWorkerNotification(opts: {
  title: string;
  body: string;
  url?: string;
  roomId?: string;
  tab?: string;
  tag?: string;
  category?: 'message' | 'call' | 'social' | 'story' | 'system';
  requireInteraction?: boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const isCall = opts.category === 'call';
  const notifOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body: opts.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: opts.tag || (opts.roomId ? `room-${opts.roomId}` : 'quadline-notification'),
    renotify: true,
    requireInteraction: Boolean(opts.requireInteraction || isCall),
    vibrate: isCall ? [400, 200, 400, 200, 400] : [200, 100, 200],
    data: {
      url: opts.url || (opts.roomId ? `/?room=${encodeURIComponent(opts.roomId)}` : '/'),
      roomId: opts.roomId || '',
      tab: opts.tab || '',
      category: opts.category || 'message',
    },
  };

  try {
    const reg = await ensurePushServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(opts.title, notifOptions);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    // Desktop fallback only
    new Notification(opts.title, {
      body: opts.body,
      icon: '/pwa-192x192.png',
      tag: notifOptions.tag,
    });
    return true;
  } catch {
    return false;
  }
}

export function clearAppBadgeIfSupported(): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  if (typeof nav.clearAppBadge === 'function') {
    void nav.clearAppBadge().catch(() => {});
  }
}
