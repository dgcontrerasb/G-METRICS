// Servicio de suscripción a Notificaciones Push en segundo plano (Web Push API)
// Compatible con iOS 16.4+ (PWA en pantalla de inicio) y Android (Chrome/PWA) a $0 USD/mes

let cachedVapidKey: string | null = null;
let isSubscribing = false;

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
 * Activación pasiva e invisible al marcar favoritos
 * Solicita permiso y suscribe el dispositivo al APNs / FCM en segundo plano sin modales intrusivos
 */
export async function registerBackgroundPushSubscription(
  newFavoriteId?: string,
  existingFavoriteIds?: Set<string>
): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  if (isSubscribing) return false;

  try {
    isSubscribing = true;

    // 1. Validar permiso (sin bloquear al usuario si lo denegó previamente)
    if (Notification.permission === 'denied') {
      return false;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }
    }

    // 2. Obtener clave pública VAPID del servidor
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return false;

    // 3. Registrar suscripción en el Service Worker
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.pushManager) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    if (!subscription) return false;

    // 4. Compilar lista de partidos favoritos para enviar al backend
    const matchIds: string[] = existingFavoriteIds
      ? Array.from(existingFavoriteIds)
      : [];
    if (newFavoriteId && !matchIds.includes(newFavoriteId)) {
      matchIds.push(newFavoriteId);
    }

    // 5. Enviar suscripción al endpoint serverless
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
    // Falla silenciosa para no degradar la experiencia de usuario
    console.debug('[Push] Registro pasivo en segundo plano omitido:', err);
    return false;
  } finally {
    isSubscribing = false;
  }
}
