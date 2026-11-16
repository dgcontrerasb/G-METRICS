// Servicio de suscripción a Notificaciones Push en segundo plano (Web Push API + Periodic Sync + Wake Lock)
// Compatible con iOS 16.4+ (PWA en pantalla de inicio) y Android (Chrome/PWA) a $0 USD/mes

import { playLiveAlertSound, LiveAlertEventKind } from './favoritesService';

let cachedVapidKey: string | null = null;
let isSubscribing = false;
let swListenerAttached = false;
let activeWakeLock: any = null;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getVapidPublicKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.publicKey) {
      cachedVapidKey = data.publicKey;
      return cachedVapidKey;
    }
  } catch {
    // Network or serverless cold-start error
  }
  return null;
}

/**
 * Conecta el puente acústico entre el Service Worker en segundo plano y el motor de sonido de estadio
 */
export function initServiceWorkerAudioBridge(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || swListenerAttached) {
    return;
  }
  swListenerAttached = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (
      msg.type === 'GMETRICS_PUSH_ALERT_RECEIVED' ||
      msg.type === 'GMETRICS_PUSH_ALERT_CLICKED'
    ) {
      const alertKind = (msg.alertKind as LiveAlertEventKind) || 'GOAL';
      const whistleCount = Number(msg.whistleCount || 2);
      playLiveAlertSound(alertKind, whistleCount);
    }
  });
}

/**
 * Mantiene la pantalla encendida (Screen Wake Lock API) sin consumir recursos cuando el usuario
 * tiene partidos favoritos EN VIVO abiertos en la PWA.
 */
export async function syncLiveFavoritesWakeLock(hasLiveFavorites: boolean): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

  try {
    if (hasLiveFavorites && document.visibilityState === 'visible') {
      if (!activeWakeLock) {
        activeWakeLock = await (navigator as any).wakeLock.request('screen');
        activeWakeLock.addEventListener('release', () => {
          activeWakeLock = null;
        });
      }
    } else if (!hasLiveFavorites && activeWakeLock) {
      await activeWakeLock.release();
      activeWakeLock = null;
    }
  } catch {
    // Wake lock puede ser rechazado en modo ahorro extremo de batería; se ignora silenciosamente
  }
}

/**
 * Activación y sincronización en segundo plano al marcar o desmarcar favoritos
 * Auto-repara suscripciones antiguas si la llave VAPID cambió y registra Periodic Background Sync
 */
export async function registerBackgroundPushSubscription(
  newFavoriteId?: string,
  existingFavoriteIds?: Set<string>,
  promptIfNeeded = true
): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  initServiceWorkerAudioBridge();

  if (isSubscribing) return false;

  try {
    isSubscribing = true;

    // 1. Validar permiso
    if (Notification.permission === 'denied') {
      return false;
    }

    if (Notification.permission !== 'granted') {
      if (!promptIfNeeded) return false;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }
    }

    // 2. Obtener clave pública VAPID determinística del servidor
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return false;

    // 3. Registrar suscripción en el Service Worker
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.pushManager) return false;

    const expectedServerKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await registration.pushManager.getSubscription();

    // Auto-reparación: si el dispositivo tenía una suscripción con una llave VAPID anterior, renovarla
    if (subscription && subscription.options?.applicationServerKey) {
      const currentKey = new Uint8Array(subscription.options.applicationServerKey);
      if (!uint8ArraysEqual(currentKey, expectedServerKey)) {
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedServerKey as any,
      });
    }

    if (!subscription) return false;

    // Registrar Periodic Background Sync si el navegador lo soporta (Android PWA)
    try {
      if ('periodicSync' in registration) {
        await (registration as any).periodicSync.register('gmetrics-live-favorites-sync', {
          minInterval: 60 * 1000, // 1 minuto mínimo
        });
      }
    } catch {
      // PeriodicSync es opcional según permisos del navegador
    }

    // 4. Compilar lista exacta de partidos favoritos para enviar al backend
    const matchIds: string[] = existingFavoriteIds
      ? Array.from(existingFavoriteIds)
      : [];
    if (newFavoriteId && !matchIds.includes(newFavoriteId)) {
      matchIds.push(newFavoriteId);
    }

    // 5. Enviar suscripción actualizada al endpoint serverless
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription.toJSON ? subscription.toJSON() : subscription,
        matchIds,
      }),
    });

    return true;
  } catch (err) {
    console.debug('[Push] Sincronización en segundo plano omitida:', err);
    return false;
  } finally {
    isSubscribing = false;
  }
}
