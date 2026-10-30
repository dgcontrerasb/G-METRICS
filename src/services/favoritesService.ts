// Servicio ligero 100% en cliente (localStorage + Web Notification API)
// Cero costo de API y cero consumo de base de datos.

const FAVORITES_STORAGE_KEY = 'gmetrics_favorite_matches_v1';
const NOTIFICATIONS_ENABLED_KEY = 'gmetrics_fav_notifications_enabled_v1';

export function getStoredFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(String));
    }
  } catch {
    // ignore storage errors
  }
  return new Set();
}

export function saveStoredFavoriteIds(ids: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage errors
  }
}

export function getNotificationsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export type LiveAlertEventKind =
  | 'GOAL'
  | 'VAR_DISALLOWED'
  | 'RED_CARD'
  | 'PERIOD_CHANGE'
  | 'BASKET_1PT'
  | 'BASKET_2PT'
  | 'BASKET_3PT';

export interface LiveGoalAlertItem {
  id: string;
  fixtureId: string;
  sport: 'SOCCER' | 'NBA';
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number;
  awayScore: number;
  scoringTeam: 'HOME' | 'AWAY' | 'NEUTRAL';
  minuteOrQuarter: string;
  detailText?: string;
  alertKind?: LiveAlertEventKind;
  badgeText?: string;
  subtitleText?: string;
  iconEmoji?: string;
  timestamp: number;
  isFavorite: boolean;
}

export function playGoalSoundEffect(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Celebratory stadium chime tones (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.11);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.11 + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.11);
      osc.stop(ctx.currentTime + idx * 0.11 + 0.32);
    });
  } catch {
    // ignore audio restriction if user hasn't interacted yet
  }
}

export function triggerNativeSystemNotification(alert: LiveGoalAlertItem): void {
  if (!getNotificationsEnabled()) return;

  // 1. Play audio chime on PC / Mobile
  playGoalSoundEffect();

  // 2. Haptic vibration on mobile devices
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 100, 220, 100, 300]);
    }
  } catch {
    // ignore
  }

  // 3. System / Browser Native Notification
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const scoringTeamName =
    alert.scoringTeam === 'HOME'
      ? alert.homeTeam
      : alert.scoringTeam === 'AWAY'
      ? alert.awayTeam
      : `${alert.homeTeam} vs ${alert.awayTeam}`;

  const defaultHeader =
    alert.sport === 'SOCCER'
      ? '⚽ ¡GOL EN VIVO!'
      : `🏀 ${alert.detailText || '¡ANOTACIÓN EN VIVO!'}`;
  const notifTitle = `${alert.badgeText ? `${alert.iconEmoji || ''} ${alert.badgeText}`.trim() : defaultHeader} · ${alert.homeScore} - ${alert.awayScore}`;
  const notifBody = alert.subtitleText
    ? `${alert.homeTeam} ${alert.homeScore} - ${alert.awayScore} ${alert.awayTeam} (${alert.minuteOrQuarter})\n${alert.subtitleText}`
    : `${scoringTeamName} en ${alert.homeTeam} vs ${alert.awayTeam} (${alert.minuteOrQuarter})\n${alert.leagueName}`;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.showNotification) {
          reg.showNotification(notifTitle, {
            body: notifBody,
            icon: alert.scoringTeam === 'AWAY' ? alert.awayLogo : alert.homeLogo,
            badge: '/icono.png',
            tag: `gmetrics_score_${alert.fixtureId}_${alert.id}`
          });
        } else {
          new Notification(notifTitle, {
            body: notifBody,
            icon: alert.scoringTeam === 'AWAY' ? alert.awayLogo : alert.homeLogo,
            tag: `gmetrics_score_${alert.fixtureId}_${alert.id}`
          });
        }
      }).catch(() => {
        new Notification(notifTitle, {
          body: notifBody,
          icon: '/icono.png'
        });
      });
    } else {
      new Notification(notifTitle, {
        body: notifBody,
        icon: '/icono.png'
      });
    }
  } catch {
    // ignore notification errors in restricted contexts
  }
}

