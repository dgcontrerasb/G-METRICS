// Servicio ligero 100% en cliente (localStorage + Web Notification API + Stadium Sound Engine)
// Cero costo de API y cero consumo de base de datos.

const FAVORITES_STORAGE_KEY = 'gmetrics_favorite_matches_v1';
const NOTIFICATIONS_ENABLED_KEY = 'gmetrics_fav_notifications_enabled_v1';

// Deduplicación de alertas entre Push en 2do plano y Detector en 1er plano
const recentDispatchedTags = new Map<string, number>();

function isDuplicateAlertTag(tag: string): boolean {
  const now = Date.now();
  for (const [k, ts] of recentDispatchedTags.entries()) {
    if (now - ts > 90_000) {
      recentDispatchedTags.delete(k);
    }
  }
  const existing = recentDispatchedTags.get(tag);
  if (existing && now - existing < 45_000) {
    return true;
  }
  recentDispatchedTags.set(tag, now);
  return false;
}

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

let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * 1. GOL: Rugido de Público en Estadio (Síntesis Formante de Multitud + Acorde Triunfal)
 */
function playStadiumCrowdGoalRoar(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const duration = 2.6;
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(2, bufferSize, sampleRate);

  // Generar ruido rosa/marrón cálido estéreo que emula 50,000 voces en estadio
  for (let ch = 0; ch < 2; ch++) {
    const output = noiseBuffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
  }

  const crowdSource = ctx.createBufferSource();
  crowdSource.buffer = noiseBuffer;

  // Filtro vocal formante 1 ("¡GOOOOL!" grave-medio)
  const formant1 = ctx.createBiquadFilter();
  formant1.type = 'bandpass';
  formant1.Q.setValueAtTime(1.8, now);
  formant1.frequency.setValueAtTime(380, now);
  formant1.frequency.exponentialRampToValueAtTime(720, now + 0.35);
  formant1.frequency.exponentialRampToValueAtTime(540, now + duration);

  // Filtro de ambiente de estadio abierto
  const stadiumHighcut = ctx.createBiquadFilter();
  stadiumHighcut.type = 'lowpass';
  stadiumHighcut.frequency.setValueAtTime(2400, now);

  const crowdGain = ctx.createGain();
  crowdGain.gain.setValueAtTime(0.01, now);
  crowdGain.gain.exponentialRampToValueAtTime(0.85, now + 0.22); // Explosión del público
  crowdGain.gain.setValueAtTime(0.82, now + 1.15);
  crowdGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  crowdSource.connect(formant1);
  formant1.connect(stadiumHighcut);
  stadiumHighcut.connect(crowdGain);
  crowdGain.connect(ctx.destination);

  crowdSource.start(now);
  crowdSource.stop(now + duration);

  // Acorde de celebración de estadio (C5 - E5 - G5 - C6)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startAt = now + idx * 0.09;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.22, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + 0.45);
  });
}

/**
 * 2. SILBATO DE ÁRBITRO: Inicio / Entretiempo (2 pitazos) / Final del Partido (3 pitazos)
 */
function playRefereeWhistleSound(ctx: AudioContext, whistleCount = 2): void {
  const now = ctx.currentTime;
  const pulses =
    whistleCount === 1
      ? [{ offset: 0, dur: 0.55 }]
      : whistleCount === 3
      ? [
          { offset: 0, dur: 0.26 },
          { offset: 0.36, dur: 0.26 },
          { offset: 0.72, dur: 0.78 },
        ]
      : [
          { offset: 0, dur: 0.32 },
          { offset: 0.42, dur: 0.65 },
        ];

  pulses.forEach(({ offset, dur }) => {
    const t0 = now + offset;
    const t1 = t0 + dur;

    // Portadoras duales de silbato Fox 40 (2860 Hz y 3140 Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2860, t0);
    osc2.frequency.setValueAtTime(3140, t0);

    // Modulación de trino de bolilla (52 Hz)
    const peaOsc = ctx.createOscillator();
    const peaGain = ctx.createGain();
    peaOsc.type = 'sine';
    peaOsc.frequency.setValueAtTime(52, t0);
    peaGain.gain.setValueAtTime(95, t0);
    peaOsc.connect(peaGain);
    peaGain.connect(osc1.frequency);
    peaGain.connect(osc2.frequency);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, t0);
    masterGain.gain.linearRampToValueAtTime(0.32, t0 + 0.025);
    masterGain.gain.setValueAtTime(0.3, t1 - 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t1);

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(t0);
    osc2.start(t0);
    peaOsc.start(t0);
    osc1.stop(t1);
    osc2.stop(t1);
    peaOsc.stop(t1);
  });
}

/**
 * 3. TARJETA ROJA: Silbato Seco de Infracción + Doble Pulso Grave de Expulsión
 */
function playRedCardAlertSound(ctx: AudioContext): void {
  const now = ctx.currentTime;

  // Pitazo corto y agudo de falta
  playRefereeWhistleSound(ctx, 1);

  // Doble impacto dramático grave (220 Hz -> 146.8 Hz)
  const tones = [
    { freq: 220, start: now + 0.45, dur: 0.25 },
    { freq: 146.83, start: now + 0.74, dur: 0.48 },
  ];

  tones.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, start);

    gain.gain.setValueAtTime(0.32, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + dur);
  });
}

/**
 * 4. GOL ANULADO (VAR): Doble Pitido de Monitor VAR + Tono Descendente de Cancelación
 */
function playVarDisallowedAlertSound(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const sequence = [
    { freq: 987.77, start: 0, dur: 0.11, type: 'sine' as OscillatorType },      // Beep VAR 1
    { freq: 987.77, start: 0.15, dur: 0.11, type: 'sine' as OscillatorType },   // Beep VAR 2
    { freq: 587.33, start: 0.34, dur: 0.18, type: 'triangle' as OscillatorType }, // Caída 1
    { freq: 369.99, start: 0.54, dur: 0.38, type: 'triangle' as OscillatorType }, // Caída grave anulación
  ];

  sequence.forEach(({ freq, start, dur, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = now + start;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.28, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur);
  });
}

/**
 * Reproductor centralizado por tipo de evento deportivo
 */
export function playLiveAlertSound(
  alertKind: LiveAlertEventKind = 'GOAL',
  whistleCount = 2
): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    switch (alertKind) {
      case 'GOAL':
      case 'BASKET_3PT':
      case 'BASKET_2PT':
      case 'BASKET_1PT':
        playStadiumCrowdGoalRoar(ctx);
        break;
      case 'PERIOD_CHANGE':
        playRefereeWhistleSound(ctx, whistleCount);
        break;
      case 'RED_CARD':
        playRedCardAlertSound(ctx);
        break;
      case 'VAR_DISALLOWED':
        playVarDisallowedAlertSound(ctx);
        break;
      default:
        playStadiumCrowdGoalRoar(ctx);
        break;
    }
  } catch {
    // ignore audio restriction if user hasn't interacted yet
  }
}

export function playGoalSoundEffect(): void {
  playLiveAlertSound('GOAL');
}

function getVibrationPattern(alertKind?: LiveAlertEventKind): number[] {
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
      return [200, 100, 250];
  }
}

export function triggerNativeSystemNotification(alert: LiveGoalAlertItem): void {
  if (!getNotificationsEnabled()) return;

  // Tag determinístico para deduplicar entre Web Push y Polling en primer plano
  const dedupeKey =
    alert.alertKind === 'GOAL'
      ? `gmetrics_evt_goal_${alert.fixtureId}_${alert.homeScore}_${alert.awayScore}`
      : alert.alertKind === 'VAR_DISALLOWED'
      ? `gmetrics_evt_var_${alert.fixtureId}_${alert.homeScore}_${alert.awayScore}`
      : alert.alertKind === 'RED_CARD'
      ? `gmetrics_evt_red_${alert.fixtureId}_${alert.minuteOrQuarter}`
      : `gmetrics_evt_period_${alert.fixtureId}_${alert.minuteOrQuarter}`;

  if (isDuplicateAlertTag(dedupeKey)) {
    return;
  }

  // Determinar cantidad de pitazos si es cambio de periodo
  const whistleCount =
    alert.minuteOrQuarter === 'FINAL'
      ? 3
      : alert.minuteOrQuarter === 'MT' || alert.minuteOrQuarter.includes('MT')
      ? 2
      : 1;

  // 1. Reproducir efecto acústico especializado (Público en gol, Silbato en periodo, Roja o VAR)
  playLiveAlertSound(alert.alertKind || 'GOAL', whistleCount);

  // 2. Vibración háptica diferenciada en dispositivos móviles
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(getVibrationPattern(alert.alertKind));
    }
  } catch {
    // ignore
  }

  // 3. Notificación nativa del sistema / navegador
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
  const notifTitle = `${
    alert.badgeText ? `${alert.iconEmoji || ''} ${alert.badgeText}`.trim() : defaultHeader
  } · ${alert.homeScore} - ${alert.awayScore}`;
  const notifBody = alert.subtitleText
    ? `${alert.homeTeam} ${alert.homeScore} - ${alert.awayScore} ${alert.awayTeam} (${alert.minuteOrQuarter})\n${alert.subtitleText}`
    : `${scoringTeamName} en ${alert.homeTeam} vs ${alert.awayTeam} (${alert.minuteOrQuarter})\n${alert.leagueName}`;

  const resolvedIcon =
    (alert.scoringTeam === 'AWAY' ? alert.awayLogo : alert.homeLogo) || '/icon-512.png';

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg && reg.showNotification) {
            reg.showNotification(notifTitle, {
              body: notifBody,
              icon: resolvedIcon,
              badge: '/icon.png',
              tag: dedupeKey,
            });
          } else {
            new Notification(notifTitle, {
              body: notifBody,
              icon: resolvedIcon,
              tag: dedupeKey,
            });
          }
        })
        .catch(() => {
          new Notification(notifTitle, {
            body: notifBody,
            icon: '/icon-512.png',
          });
        });
    } else {
      new Notification(notifTitle, {
        body: notifBody,
        icon: '/icon-512.png',
      });
    }
  } catch {
    // ignore notification errors in restricted contexts
  }
}
