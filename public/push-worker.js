/* eslint-disable no-restricted-globals */
// G-METRICS Background Web Push Worker
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'G METRICS | Marcador', body: event.data.text() };
    }
  }

  const title = data.title || 'G METRICS | Alerta de Partido';
  const options = {
    body: data.body || 'Nuevo evento en tus partidos favoritos.',
    icon: data.icon || '/icon-512.png',
    badge: data.badge || '/icon.png',
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'g-metrics-match-alert',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
