/* Quadline Mobile & Desktop Web Push Service Worker Handler */
/* Loaded by vite-plugin-pwa via workbox.importScripts and as standalone fallback */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Quadline',
    body: 'You have a new message on Quadline.',
    url: '/',
    roomId: '',
    tab: '',
    tag: 'quadline-notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    category: 'message',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          ...payload,
          ...parsed,
        };
      }
    } catch {
      try {
        const text = event.data.text();
        if (text) payload.body = text;
      } catch {
        // Use default payload
      }
    }
  }

  const isCall = payload.category === 'call';
  const notificationOptions = {
    body: payload.body || 'Open Quadline to view.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || (payload.roomId ? `room-${payload.roomId}` : 'quadline-notification'),
    renotify: true,
    silent: false,
    requireInteraction: Boolean(payload.requireInteraction || isCall),
    vibrate: Array.isArray(payload.vibrate)
      ? payload.vibrate
      : isCall
        ? [400, 200, 400, 200, 400]
        : [200, 100, 200],
    timestamp: Date.now(),
    data: {
      url: payload.url || '/',
      roomId: payload.roomId || '',
      tab: payload.tab || '',
      category: payload.category || 'message',
    },
    actions: isCall
      ? [
          { action: 'open', title: 'Answer Call' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [
          { action: 'open', title: 'Open Quadline' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || 'Quadline', notificationOptions),
      typeof self.navigator !== 'undefined' && typeof self.navigator.setAppBadge === 'function'
        ? self.navigator.setAppBadge().catch(() => {})
        : Promise.resolve(),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = (event.notification && event.notification.data) || {};
  const targetUrl = typeof data.url === 'string' && data.url ? data.url : '/';

  event.waitUntil(
    (async () => {
      if (typeof self.navigator !== 'undefined' && typeof self.navigator.clearAppBadge === 'function') {
        await self.navigator.clearAppBadge().catch(() => {});
      }

      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const resolvedTarget = new URL(targetUrl, self.location.origin).href;

      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          try {
            client.postMessage({
              type: 'quadline:open-notification',
              url: targetUrl,
              roomId: data.roomId || '',
              tab: data.tab || '',
              category: data.category || 'message',
            });
          } catch {
            // Ignore postMessage failure
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(resolvedTarget);
      }
      return undefined;
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          client.postMessage({ type: 'quadline:push-subscription-changed' });
        } catch {
          // Ignore
        }
      }
    })
  );
});
