/* eslint-disable no-restricted-globals */
// G-METRICS Background Web Push & Live Sync Worker ($0 USD/mes)

function getVibrationByKind(alertKind) {
  switch (alertKind) {
    case 'GOAL':
      return [300, 100, 300, 100, 600];
    case 'PERIOD_CHANGE':
      return [180, 90, 180, 90, 450];
    case 'RED_CARD':
      return [450, 80, 450];
    case 'VAR_DISALLOWED':
      return [120, 60, 120, 60, 350];
    default:
      return [200, 100, 200];
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'G METRICS | Marcador en Vivo', body: event.data.text() };
    }
  }

  const alertKind = data.alertKind || (data.data && data.data.alertKind) || 'GOAL';
  const whistleCount = Number(data.whistleCount || (data.data && data.data.whistleCount) || 1);
  const title = data.title || 'G METRICS | Alerta de Partido';
  const tag = data.tag || 'g-metrics-match-alert';

  const options = {
    body: data.body || 'Nuevo evento en tus partidos favoritos.',
    icon: data.icon || '/icon-512.png',
    badge: data.badge || '/icon.png',
    data: {
      ...(data.data || {}),
      url: (data.data && data.data.url) || '/',
      alertKind,
      whistleCount,
      tag,
    },
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : getVibrationByKind(alertKind),
    tag,
    renotify: true,
    requireInteraction: alertKind === 'GOAL' || alertKind === 'RED_CARD',
    actions: [
      {
        action: 'open_match',
        title: '⚡ Ver Partido en Vivo',
      },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Notificar a cualquier pestaña/ventana en memoria para disparar el motor acústico de estadio
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            try {
              client.postMessage({
                type: 'GMETRICS_PUSH_ALERT_RECEIVED',
                alertKind,
                whistleCount,
                tag,
                matchId: data.data && data.data.matchId,
              });
            } catch {
              // ignore postMessage errors
            }
          }
        })
        .catch(() => {}),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';
  const alertKind = notifData.alertKind || 'GOAL';
  const whistleCount = Number(notifData.whistleCount || 1);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          try {
            client.postMessage({
              type: 'GMETRICS_PUSH_ALERT_CLICKED',
              alertKind,
              whistleCount,
              matchId: notifData.matchId,
            });
          } catch {
            // ignore
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Sincronización periódica en segundo plano (Periodic Background Sync API en Android/Chrome PWA)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gmetrics-live-favorites-sync') {
    event.waitUntil(
      fetch('/api/live-pulse', { cache: 'no-store' }).catch(() => {})
    );
  }
});

// Background Sync one-off cuando el dispositivo recupera conectividad
self.addEventListener('sync', (event) => {
  if (event.tag === 'gmetrics-live-favorites-sync') {
    event.waitUntil(
      fetch('/api/live-pulse', { cache: 'no-store' }).catch(() => {})
    );
  }
});
