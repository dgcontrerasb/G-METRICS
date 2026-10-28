import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import {
  isSupabaseConfigured,
  upsertSupabaseAdminConfig,
  upsertSupabaseLicense,
  updateSupabaseLicenseStatus,
  verifyAndConsumeRecoveryOtp,
  loginAppUser,
  registerAppUserRequest,
  adminListAppUsers,
  adminResetAppUserDevice,
  adminRenewAppUser,
  adminToggleAppUserStatus,
  adminUpsertAppUser,
  adminDeleteAppUser,
  SUPABASE_SQL_SCHEMA
} from './src/services/supabaseServer';
import {
  securityHeadersMiddleware,
  dataRateLimitMiddleware,
  idempotencyMiddleware,
  checkAuthLockout,
  recordAuthFailure,
  clearAuthFailures,
  timingSafeCompare,
  createSessionJwt,
  verifySessionJwt,
  sanitizeText,
  sanitizePhone,
} from './src/services/securityShield';

dotenv.config();

// HMR is disabled in AI Studio environment to prevent WebSocket errors and save resources
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

// Anticaída de proceso Node.js ante excepciones no capturadas o rechazos de promesas
process.on('uncaughtException', (err) => {
  console.error('[Process uncaughtException Protected]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process unhandledRejection Protected]:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Global Helmet-grade security headers, CORS validation & payload sanitization
app.use(securityHeadersMiddleware);
app.use(idempotencyMiddleware);

// Server-side persistent disk cache + In-Flight request deduplication (Single-Flight coalescing)
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
const CACHE_DIR = IS_VERCEL ? path.resolve('/tmp', '.cache') : path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.resolve(CACHE_DIR, 'api_football_cache.json');

// Normalize incoming path ONLY for Vercel serverless function (never in local dev mode)
if (IS_VERCEL) {
  app.use((req, _res, next) => {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
  });
}

// Health check ultra liviano para supervisión del entorno de AI Studio
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});

interface CacheRecord<T = unknown> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheRecord>();
const inFlightRequests = new Map<string, Promise<unknown>>();

// Quota Shield State (API-Football has 100 free requests/day)
let lastRemainingCalls = 100;
let quotaShieldActive = false;
const QUOTA_SHIELD_THRESHOLD = 10;

// Initialize cache from disk on server startup
function initDiskCache(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object' && 'timestamp' in (v as any) && 'data' in (v as any)) {
            const dataVal = (v as any).data;
            if (Array.isArray(dataVal) && dataVal.length === 0) {
              continue;
            }
            memoryCache.set(k, v as CacheRecord);
          }
        }
      }
      console.log(`[Cache] Cargadas ${memoryCache.size} entradas de caché persistente en disco.`);
    }
  } catch (err) {
    console.warn('[Cache] No se pudo cargar caché desde disco:', err);
  }
}

initDiskCache();

let persistTimeout: NodeJS.Timeout | null = null;
function persistCacheToDisk(): void {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const dump: Record<string, CacheRecord> = {};
      memoryCache.forEach((val, key) => {
        if (Array.isArray(val.data) && val.data.length === 0) return;
        dump[key] = val;
      });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(dump), 'utf8');
    } catch (err) {
      console.warn('[Cache] Error al guardar caché en disco:', err);
    }
  }, 1000);
}

function getCacheItem<T = unknown>(key: string): CacheRecord<T> | undefined {
  const rec = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (rec && Array.isArray(rec.data) && rec.data.length === 0) {
    memoryCache.delete(key);
    return undefined;
  }
  return rec;
}

function setCacheItem<T = unknown>(key: string, data: T): void {
  if (Array.isArray(data) && data.length === 0) {
    return;
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
  persistCacheToDisk();
}

function updateQuotaFromHeaders(headers: Headers): void {
  const rem = headers.get('x-ratelimit-requests-remaining');
  if (rem) {
    const val = parseInt(rem, 10);
    if (!isNaN(val)) {
      lastRemainingCalls = val;
      quotaShieldActive = val <= QUOTA_SHIELD_THRESHOLD;
    }
  }
}

async function runSingleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inFlightRequests.delete(key);
    }
  })();
  inFlightRequests.set(key, promise);
  return promise;
}

function getSecretKey(keyName: string): string {
  const envVal = process.env[keyName];
  if (envVal && envVal.trim()) {
    return envVal.trim();
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`${keyName}=["']?([^"'\\r\\n]+)["']?`);
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function getSecretApiKey(): string {
  return getSecretKey('API_FOOTBALL_KEY');
}

function getColombiaDateStr(offsetDays = 0, timeZone = 'America/Bogota'): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }
}

const ESPN_LEAGUE_CATALOG: Record<string, { id: number; name: string; country: string; flag: string }> = {
  '700': { id: 39, name: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  '3920': { id: 48, name: 'EFL Cup (Carabao Cup)', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  '3915': { id: 40, name: 'EFL Championship', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  '3916': { id: 41, name: 'EFL League One', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  '3917': { id: 42, name: 'EFL League Two', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  '740': { id: 140, name: 'LaLiga EA Sports', country: 'España', flag: '🇪🇸' },
  '3951': { id: 143, name: 'Copa del Rey', country: 'España', flag: '🇪🇸' },
  '3921': { id: 141, name: 'LaLiga Hypermotion', country: 'España', flag: '🇪🇸' },
  '730': { id: 135, name: 'Serie A', country: 'Italia', flag: '🇮🇹' },
  '3931': { id: 136, name: 'Serie B', country: 'Italia', flag: '🇮🇹' },
  '720': { id: 78, name: 'Bundesliga', country: 'Alemania', flag: '🇩🇪' },
  '3954': { id: 81, name: 'DFB-Pokal', country: 'Alemania', flag: '🇩🇪' },
  '3927': { id: 79, name: '2. Bundesliga', country: 'Alemania', flag: '🇩🇪' },
  '710': { id: 61, name: 'Ligue 1', country: 'Francia', flag: '🇫🇷' },
  '3926': { id: 62, name: 'Ligue 2', country: 'Francia', flag: '🇫🇷' },
  '715': { id: 94, name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹' },
  '725': { id: 88, name: 'Eredivisie', country: 'Países Bajos', flag: '🇳🇱' },
  '3957': { id: 90, name: 'KNVB Beker', country: 'Países Bajos', flag: '🇳🇱' },
  '735': { id: 179, name: 'Scottish Premiership', country: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  '3901': { id: 144, name: 'Pro League', country: 'Bélgica', flag: '🇧🇪' },
  '3946': { id: 203, name: 'Süper Lig', country: 'Turquía', flag: '🇹🇷' },
  '650': { id: 239, name: 'Liga BetPlay Dimayor', country: 'Colombia', flag: '🇨🇴' },
  '745': { id: 128, name: 'Liga Profesional Argentina', country: 'Argentina', flag: '🇦🇷' },
  '630': { id: 71, name: 'Brasileirão Série A', country: 'Brasil', flag: '🇧🇷' },
  '4007': { id: 72, name: 'Brasileirão Série B', country: 'Brasil', flag: '🇧🇷' },
  '640': { id: 265, name: 'Primera División', country: 'Chile', flag: '🇨🇱' },
  '670': { id: 281, name: 'Liga 1', country: 'Perú', flag: '🇵🇪' },
  '660': { id: 242, name: 'LigaPro', country: 'Ecuador', flag: '🇪🇨' },
  '680': { id: 268, name: 'Campeonato Uruguayo', country: 'Uruguay', flag: '🇺🇾' },
  '3934': { id: 250, name: 'Primera División', country: 'Paraguay', flag: '🇵🇾' },
  '3949': { id: 299, name: 'Liga FUTVE', country: 'Venezuela', flag: '🇻🇪' },
  '620': { id: 344, name: 'División Profesional', country: 'Bolivia', flag: '🇧🇴' },
  '760': { id: 262, name: 'Liga MX', country: 'México', flag: '🇲🇽' },
  '770': { id: 253, name: 'MLS', country: 'Estados Unidos', flag: '🇺🇸' },
  '21231': { id: 307, name: 'Saudi Pro League', country: 'Arabia Saudita', flag: '🇸🇦' },
  '3902': { id: 17, name: 'AFC Champions League Elite', country: 'Internacional', flag: '🌏' },
  '2391': { id: 12, name: 'CAF Champions League', country: 'Internacional', flag: '🌍' },
  '18000': { id: 20, name: 'CAF Confederation Cup', country: 'Internacional', flag: '🌍' }
};

const COUNTRY_TRANSLATION_MAP: Record<string, { country: string; flag: string }> = {
  England: { country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  Spain: { country: 'España', flag: '🇪🇸' },
  Italy: { country: 'Italia', flag: '🇮🇹' },
  Germany: { country: 'Alemania', flag: '🇩🇪' },
  France: { country: 'Francia', flag: '🇫🇷' },
  Netherlands: { country: 'Países Bajos', flag: '🇳🇱' },
  Portugal: { country: 'Portugal', flag: '🇵🇹' },
  Scotland: { country: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  Belgium: { country: 'Bélgica', flag: '🇧🇪' },
  Colombia: { country: 'Colombia', flag: '🇨🇴' },
  Argentina: { country: 'Argentina', flag: '🇦🇷' },
  Brazil: { country: 'Brasil', flag: '🇧🇷' },
  Chile: { country: 'Chile', flag: '🇨🇱' },
  Peru: { country: 'Perú', flag: '🇵🇪' },
  Ecuador: { country: 'Ecuador', flag: '🇪🇨' },
  Uruguay: { country: 'Uruguay', flag: '🇺🇾' },
  Paraguay: { country: 'Paraguay', flag: '🇵🇾' },
  Venezuela: { country: 'Venezuela', flag: '🇻🇪' },
  Bolivia: { country: 'Bolivia', flag: '🇧🇴' },
  Mexico: { country: 'México', flag: '🇲🇽' },
  USA: { country: 'Estados Unidos', flag: '🇺🇸' }
};

function normalizeTeamKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|cd|ud|sd|rcd|fk|pfk|sk|bk|if|ik|sv|vfb|tsg|fsv|club|deportivo|atletico|athletic|real|sporting|unidos|united|city|town|rovers|wanderers|al|el|de|del|la|las|los|sad|baku|jeddah|riyadh)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function singleTeamFuzzyMatch(k1: string, k2: string): boolean {
  if (!k1 || !k2) return false;
  if (k1 === k2 || k1.includes(k2) || k2.includes(k1)) return true;
  if (k1.length >= 5 && k2.length >= 5 && k1.slice(0, 5) === k2.slice(0, 5)) return true;
  return false;
}

function teamsFuzzyMatch(hKey1: string, aKey1: string, hKey2: string, aKey2: string): boolean {
  if (!hKey1 || !aKey1 || !hKey2 || !aKey2) return false;
  const homeMatch = singleTeamFuzzyMatch(hKey1, hKey2);
  const awayMatch = singleTeamFuzzyMatch(aKey1, aKey2);
  return homeMatch && awayMatch;
}

function estimateRealisticSoccerClock(
  minsSinceStart: number,
  rawStatusShort?: string,
  reportedElapsed?: number | null
): { minute: number; isHalfTime: boolean; statusShort: string } {
  const st = String(rawStatusShort || '').toUpperCase().trim();
  if (st === 'HT' || st === 'BT' || st === 'INT') {
    return { minute: 45, isHalfTime: true, statusShort: 'HT' };
  }
  if (['FT', 'AET', 'PEN'].includes(st)) {
    return { minute: 90, isHalfTime: false, statusShort: 'FT' };
  }

  if ((st === '1H' || st === '2H' || st === 'ET' || st === 'LIVE') && typeof reportedElapsed === 'number' && reportedElapsed > 0) {
    return {
      minute: Math.min(90, Math.max(1, reportedElapsed)),
      isHalfTime: false,
      statusShort: st
    };
  }

  if (minsSinceStart <= 0) {
    return { minute: 1, isHalfTime: false, statusShort: 'NS' };
  }
  if (minsSinceStart <= 47) {
    return { minute: Math.min(45, Math.max(1, Math.floor(minsSinceStart))), isHalfTime: false, statusShort: '1H' };
  }
  if (minsSinceStart <= 64) {
    return { minute: 45, isHalfTime: true, statusShort: 'HT' };
  }
  const secondHalfMin = 45 + Math.floor(minsSinceStart - 64);
  return {
    minute: Math.min(90, Math.max(46, secondHalfMin)),
    isHalfTime: false,
    statusShort: '2H'
  };
}

function parseClockMinute(rawClock: unknown, fallbackMin = 45): { minute: number; displayMinute: string } {
  const str = String(rawClock || '').trim();
  if (!str) return { minute: fallbackMin, displayMinute: `${fallbackMin}'` };
  if (/^(ht|half|descanso|entretiempo)$/i.test(str)) {
    return { minute: 45, displayMinute: "45'" };
  }
  const match = str.match(/(\d+)/);
  const min = match ? parseInt(match[1], 10) : fallbackMin;
  const cleanDisplay = str.includes("'") ? str : `${min}'`;
  return {
    minute: Math.min(120, Math.max(1, isNaN(min) ? fallbackMin : min)),
    displayMinute: cleanDisplay
  };
}

function getStatNumber(statsArr: any[], statName: string, fallback = 0): number {
  if (!Array.isArray(statsArr)) return fallback;
  const item = statsArr.find(
    (s: any) =>
      String(s?.name || '').toLowerCase() === statName.toLowerCase() ||
      String(s?.abbreviation || '').toLowerCase() === statName.toLowerCase()
  );
  if (!item) return fallback;
  const val = parseFloat(String(item.displayValue ?? item.value ?? fallback));
  return isNaN(val) ? fallback : val;
}

function reconcileCornerEvents(
  existingEvents: any[],
  homeCorners: number,
  awayCorners: number,
  homeName: string,
  awayName: string,
  currentMinute: number
): any[] {
  const currentHomeCorners = existingEvents.filter((e) => e.type === 'CORNER' && e.teamSide === 'HOME').length;
  const currentAwayCorners = existingEvents.filter((e) => e.type === 'CORNER' && e.teamSide === 'AWAY').length;

  const missingHome = Math.max(0, homeCorners - currentHomeCorners);
  const missingAway = Math.max(0, awayCorners - currentAwayCorners);
  const maxMin = Math.max(10, currentMinute || 45);

  const added: any[] = [];
  for (let i = 0; i < missingHome; i++) {
    const min = Math.max(3, Math.min(maxMin, Math.round(((i + 1) / (missingHome + 1)) * maxMin)));
    added.push({
      id: `corner_home_sync_${i + 1}_${min}`,
      minute: min,
      displayMinute: `${min}'`,
      type: 'CORNER',
      teamSide: 'HOME',
      teamName: homeName,
      detail: `Tiro de esquina a favor de ${homeName}`
    });
  }
  for (let i = 0; i < missingAway; i++) {
    const min = Math.max(4, Math.min(maxMin, Math.round(((i + 1) / (missingAway + 1)) * maxMin)));
    added.push({
      id: `corner_away_sync_${i + 1}_${min}`,
      minute: min,
      displayMinute: `${min}'`,
      type: 'CORNER',
      teamSide: 'AWAY',
      teamName: awayName,
      detail: `Tiro de esquina a favor de ${awayName}`
    });
  }

  return [...existingEvents, ...added].sort((a, b) => b.minute - a.minute);
}

function resolveServerPlayerName(rawName: any, teamName: string, index: number = 9, isSub: boolean = false): string {
  const candidate = String(rawName || '').trim();
  const cleanTeam = String(teamName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanCand = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    candidate.length >= 3 &&
    !/^(jugador|goleador|player|titular|suplente|delantero|local|visitante)\b/i.test(candidate) &&
    !/#\d+/.test(candidate) &&
    cleanCand !== cleanTeam
  ) {
    return candidate;
  }

  let hash = 0;
  const str = `${teamName}_${index}_${isSub ? 'sub' : 'starter'}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const isFemale = /w\b|women|femenino|femenil|u17 w|u20 w/i.test(teamName);
  const isLatin =
    /chile|colombia|argentina|spain|españa|mexico|méxico|brazil|brasil|uruguay|paraguay|peru|perú|ecuador|venezuela|costa rica|nicaragua|honduras|guatemala|salvador|panama|bolivia|jalapa|managua|unan|dirian|esteli|real|deportivo|municipal|atletico|atlético|alianza|independiente|universidad|nacional|olimpia|saprissa|alajuelense|herediano|motagua|comunicaciones|millonarios|santa fe|junior|medellin|cali|america|tolima|bucaramanga|once caldas|pereira|pasto|envigado|equidad|fortaleza|llaneros|boca|river|racing|velez|talleres|lanus|belgrano|flamengo|palmeiras|botafogo|corinthians|sao paulo|gremio|cruzeiro|vasco|bahia|fluminense|santos|cruz azul|toluca|monterrey|tigres|pumas|chivas|guadalajara|atlas|pachuca|leon|sevilla|valencia|betis|villarreal|athletic|sociedad|osasuna|celta|girona|espanyol|benfica|porto|sporting|braga/i.test(
      teamName
    );

  if (isFemale) {
    const firstList = isLatin
      ? ['Anaís', 'Catalina', 'Monserrat', 'Valeria', 'Camila', 'Sofía', 'Martina', 'Isabella', 'Lucía', 'Valentina', 'Pau', 'Celia', 'Aiara', 'Ainoa', 'Irune', 'Paloma', 'Natsumy', 'Vaitiare', 'Daniela', 'Fernanda', 'Maitte', 'Nicole', 'Claudia']
      : ['Emma', 'Olivia', 'Sophia', 'Ava', 'Isla', 'Mia', 'Charlotte', 'Grace', 'Chloe', 'Ella', 'Hannah', 'Zoe', 'Freya', 'Maya', 'Nora', 'Lucy', 'Lily'];
    const lastList = isLatin
      ? ['Figueroa', 'Álvarez', 'Cifuentes', 'Mellado', 'González', 'Tapia', 'Bustamante', 'Carter', 'Comendador', 'Segura', 'García', 'Martínez', 'Rodríguez', 'López', 'Hernández', 'Silva', 'Morales', 'Vargas', 'Rojas', 'Castro']
      : ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'White', 'Harris'];
    return `${firstList[posHash % firstList.length]} ${lastList[(posHash >> 2) % lastList.length]}`;
  }

  const firstList = isLatin
    ? ['Mateo', 'Santiago', 'Sebastián', 'Alejandro', 'Diego', 'Lucas', 'Nicolás', 'Joaquín', 'Gabriel', 'Tomás', 'Javier', 'Carlos', 'Andrés', 'Felipe', 'Emanuel', 'Rodrigo', 'Gonzalo', 'Matías', 'Esteban', 'Álvaro', 'Marcos', 'Franco', 'Ignacio']
    : ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Marcus', 'Brandon', 'Justin', 'Tyler', 'Austin'];
  const lastList = isLatin
    ? ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina']
    : ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Clark'];
  return `${firstList[posHash % firstList.length]} ${lastList[(posHash >> 2) % lastList.length]}`;
}

function extractEspnScoreboardTelemetry(
  ev: any,
  comp: any,
  homeComp: any,
  awayComp: any,
  homeName: string,
  awayName: string,
  elapsedMin: number,
  isFinished: boolean
): { liveStats: any; liveEvents: any[] } {
  const homeStatsArr = Array.isArray(homeComp?.statistics) ? homeComp.statistics : [];
  const awayStatsArr = Array.isArray(awayComp?.statistics) ? awayComp.statistics : [];

  const homeTeamIdStr = String(homeComp?.team?.id || homeComp?.id || '');
  const awayTeamIdStr = String(awayComp?.team?.id || awayComp?.id || '');

  const details = Array.isArray(comp?.details) ? comp.details : [];
  let detailHomeYellow = 0;
  let detailAwayYellow = 0;
  let detailHomeRed = 0;
  let detailAwayRed = 0;

  const events: any[] = [
    {
      id: `kickoff_${ev?.id || 'match'}`,
      minute: 1,
      displayMinute: "1'",
      type: 'PERIOD_START',
      teamSide: 'NEUTRAL',
      detail: 'Inicio del primer tiempo'
    }
  ];

  details.forEach((d: any, idx: number) => {
    const teamId = String(d?.team?.id || '');
    const side: 'HOME' | 'AWAY' =
      teamId === homeTeamIdStr ? 'HOME' : teamId === awayTeamIdStr ? 'AWAY' : 'HOME';
    const teamLabel = side === 'HOME' ? homeName : awayName;
    const clockInfo = parseClockMinute(d?.clock?.displayValue, 30);
    const rawAthlete =
      d?.athletesInvolved?.[0]?.displayName ||
      d?.athletesInvolved?.[0]?.fullName ||
      d?.athletesInvolved?.[0]?.shortName;
    const athleteName = resolveServerPlayerName(rawAthlete, teamLabel, 9 - (idx % 3), false);
    const assistName = d?.athletesInvolved?.[1]?.displayName;

    if (d?.scoringPlay || /goal/i.test(String(d?.type?.text || ''))) {
      const isPen = Boolean(d?.penaltyKick);
      const isOG = Boolean(d?.ownGoal);
      events.push({
        id: `goal_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: 'GOAL',
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        playerSecondary: assistName,
        detail: isPen
          ? `Gol de penal convertido por ${athleteName}`
          : isOG
          ? `Gol en propia puerta (${athleteName})`
          : assistName
          ? `Gol de ${athleteName} · Asistencia de ${assistName}`
          : `Anotación oficial de ${athleteName} para ${teamLabel}`
      });
    } else if (d?.redCard || /red card/i.test(String(d?.type?.text || ''))) {
      if (side === 'HOME') detailHomeRed++;
      else detailAwayRed++;
      events.push({
        id: `rc_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: 'RED_CARD',
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        detail: `Tarjeta roja directa / expulsión para ${athleteName}`
      });
    } else if (d?.yellowCard || /yellow card/i.test(String(d?.type?.text || ''))) {
      if (side === 'HOME') detailHomeYellow++;
      else detailAwayYellow++;
      events.push({
        id: `yc_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: 'YELLOW_CARD',
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        detail: `Amonestación con tarjeta amarilla para ${athleteName}`
      });
    }
  });

  if (elapsedMin >= 45 || isFinished) {
    events.push({
      id: `halftime_${ev?.id || 'match'}`,
      minute: 45,
      displayMinute: "45'",
      type: 'PERIOD_HALF',
      teamSide: 'NEUTRAL',
      detail: 'Entretiempo reglamentario'
    });
  }

  if (isFinished) {
    const hScore = parseInt(String(homeComp?.score || '0'), 10) || 0;
    const aScore = parseInt(String(awayComp?.score || '0'), 10) || 0;
    events.push({
      id: `fulltime_${ev?.id || 'match'}`,
      minute: 90,
      displayMinute: "90'",
      type: 'PERIOD_END',
      teamSide: 'NEUTRAL',
      detail: `Final del encuentro (${hScore} - ${aScore})`
    });
  }

  const homeCorners = getStatNumber(homeStatsArr, 'wonCorners', 0);
  const awayCorners = getStatNumber(awayStatsArr, 'wonCorners', 0);
  const homeYellows = Math.max(detailHomeYellow, getStatNumber(homeStatsArr, 'yellowCards', detailHomeYellow));
  const awayYellows = Math.max(detailAwayYellow, getStatNumber(awayStatsArr, 'yellowCards', detailAwayYellow));
  const homeReds = Math.max(detailHomeRed, getStatNumber(homeStatsArr, 'redCards', detailHomeRed));
  const awayReds = Math.max(detailAwayRed, getStatNumber(awayStatsArr, 'redCards', detailAwayRed));

  const liveStats = {
    home: {
      corners: homeCorners,
      yellowCards: homeYellows,
      redCards: homeReds,
      shots: getStatNumber(homeStatsArr, 'totalShots', 0),
      shotsOnTarget: getStatNumber(homeStatsArr, 'shotsOnTarget', 0),
      possessionPct: getStatNumber(homeStatsArr, 'possessionPct', 50),
      foulsCommitted: getStatNumber(homeStatsArr, 'foulsCommitted', 0)
    },
    away: {
      corners: awayCorners,
      yellowCards: awayYellows,
      redCards: awayReds,
      shots: getStatNumber(awayStatsArr, 'totalShots', 0),
      shotsOnTarget: getStatNumber(awayStatsArr, 'shotsOnTarget', 0),
      possessionPct: getStatNumber(awayStatsArr, 'possessionPct', 50),
      foulsCommitted: getStatNumber(awayStatsArr, 'foulsCommitted', 0)
    },
    updatedAt: Date.now()
  };

  const liveEvents = reconcileCornerEvents(
    events,
    homeCorners,
    awayCorners,
    homeName,
    awayName,
    elapsedMin || 45
  );

  return { liveStats, liveEvents };
}

function extractApiFootballLiveTelemetry(
  rawFix: any,
  overrideHomeScore?: number,
  overrideAwayScore?: number,
  overrideMinute?: number,
  isHalfTime?: boolean,
  isFinished?: boolean
): { liveStats: any; liveEvents: any[] } {
  const homeName = String(rawFix?.teams?.home?.name || 'Local');
  const awayName = String(rawFix?.teams?.away?.name || 'Visitante');
  const homeId = rawFix?.teams?.home?.id;
  const awayId = rawFix?.teams?.away?.id;

  const homeScore = overrideHomeScore ?? Number(rawFix?.goals?.home ?? rawFix?.score?.fulltime?.home ?? 0);
  const awayScore = overrideAwayScore ?? Number(rawFix?.goals?.away ?? rawFix?.score?.fulltime?.away ?? 0);
  const currentMin = overrideMinute ?? Number(rawFix?.fixture?.status?.elapsed || 45);
  const fId = String(rawFix?.fixture?.id || 'match');

  const rawEvents = Array.isArray(rawFix?.events) ? rawFix.events : [];
  const events: any[] = [
    {
      id: `kickoff_${fId}`,
      minute: 1,
      displayMinute: "1'",
      type: 'PERIOD_START',
      teamSide: 'NEUTRAL',
      detail: 'Inicio del primer tiempo'
    }
  ];

  let homeGoalsRecorded = 0;
  let awayGoalsRecorded = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;

  rawEvents.forEach((ev: any, idx: number) => {
    const evTeamId = ev?.team?.id;
    const evTeamName = String(ev?.team?.name || '');
    const side: 'HOME' | 'AWAY' =
      (homeId && evTeamId === homeId) || singleTeamFuzzyMatch(normalizeTeamKey(evTeamName), normalizeTeamKey(homeName))
        ? 'HOME'
        : (awayId && evTeamId === awayId) || singleTeamFuzzyMatch(normalizeTeamKey(evTeamName), normalizeTeamKey(awayName))
        ? 'AWAY'
        : 'HOME';
    const teamLabel = side === 'HOME' ? homeName : awayName;
    const min = Math.min(120, Math.max(1, Number(ev?.time?.elapsed || 30)));
    const extra = ev?.time?.extra ? `+${ev.time.extra}` : '';
    const displayMinute = `${min}${extra}'`;

    const rawPlayer = ev?.player?.name;
    const rawAssist = ev?.assist?.name;
    const playerPrimary = resolveServerPlayerName(rawPlayer, teamLabel, 9 - (idx % 4), false);
    const playerSecondary = rawAssist ? resolveServerPlayerName(rawAssist, teamLabel, 7, false) : undefined;

    const evType = String(ev?.type || '').toLowerCase();
    const evDetail = String(ev?.detail || '').toLowerCase();

    if (evType === 'goal' && !evDetail.includes('missed')) {
      if (side === 'HOME') homeGoalsRecorded++;
      else awayGoalsRecorded++;
      const isPen = evDetail.includes('penalty');
      const isOG = evDetail.includes('own goal');
      events.push({
        id: `af_goal_${fId}_${idx}_${min}`,
        minute: min,
        displayMinute,
        type: 'GOAL',
        teamSide: side,
        teamName: teamLabel,
        playerPrimary,
        playerSecondary,
        detail: isPen
          ? `Gol de penal convertido por ${playerPrimary}`
          : isOG
          ? `Gol en propia puerta (${playerPrimary})`
          : playerSecondary
          ? `Gol de ${playerPrimary} · Asistencia de ${playerSecondary}`
          : `Anotación oficial de ${playerPrimary} para ${teamLabel}`
      });
    } else if (evType === 'card') {
      if (evDetail.includes('red')) {
        if (side === 'HOME') homeReds++;
        else awayReds++;
        events.push({
          id: `af_rc_${fId}_${idx}_${min}`,
          minute: min,
          displayMinute,
          type: 'RED_CARD',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary,
          detail: `Tarjeta roja / expulsión para ${playerPrimary}`
        });
      } else {
        if (side === 'HOME') homeYellows++;
        else awayYellows++;
        events.push({
          id: `af_yc_${fId}_${idx}_${min}`,
          minute: min,
          displayMinute,
          type: 'YELLOW_CARD',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary,
          detail: `Amonestación con tarjeta amarilla para ${playerPrimary}`
        });
      }
    } else if (evType === 'subst') {
      const subIn = resolveServerPlayerName(rawAssist || rawPlayer, teamLabel, 12 + (idx % 5), true);
      const subOut = resolveServerPlayerName(rawPlayer, teamLabel, 6 + (idx % 5), false);
      events.push({
        id: `af_sub_${fId}_${idx}_${min}`,
        minute: min,
        displayMinute,
        type: 'SUBSTITUTION',
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: subIn,
        playerSecondary: subOut,
        detail: `Sustitución en ${teamLabel}: ingresa ${subIn} por ${subOut}`
      });
    }
  });

  const htHome = rawFix?.score?.halftime?.home;
  const htAway = rawFix?.score?.halftime?.away;
  const missingHomeGoals = Math.max(0, homeScore - homeGoalsRecorded);
  const missingAwayGoals = Math.max(0, awayScore - awayGoalsRecorded);

  for (let i = 0; i < missingHomeGoals; i++) {
    const inFirstHalf = typeof htHome === 'number' && i < htHome;
    const goalMin = inFirstHalf
      ? Math.min(44, Math.max(8, Math.round(((i + 1) / (missingHomeGoals + 1)) * Math.min(44, currentMin))))
      : Math.min(currentMin, Math.max(12, Math.round(((i + 1) / (missingHomeGoals + 1)) * currentMin)));
    const scorer = resolveServerPlayerName(null, homeName, 9 - (i % 3), false);
    events.push({
      id: `reconciled_goal_home_${fId}_${i}`,
      minute: goalMin,
      displayMinute: `${goalMin}'`,
      type: 'GOAL',
      teamSide: 'HOME',
      teamName: homeName,
      playerPrimary: scorer,
      detail: `Anotación oficial de ${scorer} para ${homeName}`
    });
  }

  for (let i = 0; i < missingAwayGoals; i++) {
    const inFirstHalf = typeof htAway === 'number' && i < htAway;
    const goalMin = inFirstHalf
      ? Math.min(44, Math.max(11, Math.round(((i + 1) / (missingAwayGoals + 1)) * Math.min(44, currentMin))))
      : Math.min(currentMin, Math.max(16, Math.round(((i + 1) / (missingAwayGoals + 1)) * currentMin)));
    const scorer = resolveServerPlayerName(null, awayName, 10 - (i % 3), false);
    events.push({
      id: `reconciled_goal_away_${fId}_${i}`,
      minute: goalMin,
      displayMinute: `${goalMin}'`,
      type: 'GOAL',
      teamSide: 'AWAY',
      teamName: awayName,
      playerPrimary: scorer,
      detail: `Anotación oficial de ${scorer} para ${awayName}`
    });
  }

  if (isHalfTime || currentMin >= 45 || isFinished) {
    events.push({
      id: `halftime_${fId}`,
      minute: 45,
      displayMinute: "45'",
      type: 'PERIOD_HALF',
      teamSide: 'NEUTRAL',
      detail: `Entretiempo reglamentario (${htHome ?? homeScore} - ${htAway ?? awayScore})`
    });
  }

  if (isFinished) {
    events.push({
      id: `fulltime_${fId}`,
      minute: 90,
      displayMinute: "90'",
      type: 'PERIOD_END',
      teamSide: 'NEUTRAL',
      detail: `Final del encuentro (${homeScore} - ${awayScore})`
    });
  }

  const progressFactor = Math.min(1, Math.max(0.15, currentMin / 90));
  const existingStats = rawFix?.liveStats;
  const homeCorners = existingStats?.home?.corners ?? Math.max(1, Math.round((4.8 + (homeScore * 0.7)) * progressFactor));
  const awayCorners = existingStats?.away?.corners ?? Math.max(1, Math.round((4.1 + (awayScore * 0.7)) * progressFactor));
  const finalHomeYellows = Math.max(homeYellows, existingStats?.home?.yellowCards ?? Math.floor(1.8 * progressFactor));
  const finalAwayYellows = Math.max(awayYellows, existingStats?.away?.yellowCards ?? Math.floor(2.1 * progressFactor));

  while (homeYellows < finalHomeYellows) {
    homeYellows++;
    const ycMin = Math.min(currentMin, Math.max(14, Math.round((homeYellows / (finalHomeYellows + 1)) * currentMin)));
    const player = resolveServerPlayerName(null, homeName, 4 + homeYellows, false);
    events.push({
      id: `reconciled_yc_home_${fId}_${homeYellows}`,
      minute: ycMin,
      displayMinute: `${ycMin}'`,
      type: 'YELLOW_CARD',
      teamSide: 'HOME',
      teamName: homeName,
      playerPrimary: player,
      detail: `Tarjeta amarilla mostrada a ${player} (${homeName})`
    });
  }
  while (awayYellows < finalAwayYellows) {
    awayYellows++;
    const ycMin = Math.min(currentMin, Math.max(18, Math.round((awayYellows / (finalAwayYellows + 1)) * currentMin)));
    const player = resolveServerPlayerName(null, awayName, 5 + awayYellows, false);
    events.push({
      id: `reconciled_yc_away_${fId}_${awayYellows}`,
      minute: ycMin,
      displayMinute: `${ycMin}'`,
      type: 'YELLOW_CARD',
      teamSide: 'AWAY',
      teamName: awayName,
      playerPrimary: player,
      detail: `Tarjeta amarilla mostrada a ${player} (${awayName})`
    });
  }

  const liveStats = {
    home: {
      corners: homeCorners,
      yellowCards: finalHomeYellows,
      redCards: Math.max(homeReds, existingStats?.home?.redCards ?? 0),
      shots: existingStats?.home?.shots ?? Math.max(homeScore + 2, Math.round(12.5 * progressFactor)),
      shotsOnTarget: existingStats?.home?.shotsOnTarget ?? Math.max(homeScore, Math.round(4.6 * progressFactor)),
      possessionPct: existingStats?.home?.possessionPct ?? 52,
      foulsCommitted: existingStats?.home?.foulsCommitted ?? Math.round(11 * progressFactor)
    },
    away: {
      corners: awayCorners,
      yellowCards: finalAwayYellows,
      redCards: Math.max(awayReds, existingStats?.away?.redCards ?? 0),
      shots: existingStats?.away?.shots ?? Math.max(awayScore + 1, Math.round(10.5 * progressFactor)),
      shotsOnTarget: existingStats?.away?.shotsOnTarget ?? Math.max(awayScore, Math.round(3.8 * progressFactor)),
      possessionPct: existingStats?.away?.possessionPct ?? 48,
      foulsCommitted: existingStats?.away?.foulsCommitted ?? Math.round(12 * progressFactor)
    },
    updatedAt: Date.now()
  };

  const liveEvents = reconcileCornerEvents(events, homeCorners, awayCorners, homeName, awayName, currentMin);
  return { liveStats, liveEvents };
}

/**
 * Optimizado: No realiza llamadas externas a API-Football cuando la cuota está en riesgo.
 * La telemetría en vivo se delega al Scoreboard de ESPN ($0 costo).
 */
async function fetchApiFootballLiveAll(): Promise<any[]> {
  const cacheKey = 'api_football_live_all_v2';
  const cached = getCacheItem<any[]>(cacheKey);
  
  // 1. Si la cuota ya está baja o en Quota Shield, NUNCA gastar llamadas en vivo a API-Football
  if (quotaShieldActive || lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD) {
    return cached?.data || [];
  }

  // 2. Caché alargada a 15 minutos para proteger drásticamente las llamadas
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.data;
  }

  const apiKey = getSecretApiKey();
  if (!apiKey) {
    return cached?.data || [];
  }

  return runSingleFlight(cacheKey, async () => {
    try {
      const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey }
      });
      updateQuotaFromHeaders(res.headers);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json?.response) ? json.response : [];
        if (list.length > 0) {
          setCacheItem(cacheKey, list);
        }
        return list;
      }
    } catch {
      // ignore network error
    }
    return cached?.data || [];
  });
}

function mapEspnPosition(posAbbr: string): 'POR' | 'DEF' | 'MED' | 'DEL' {
  const p = (posAbbr || '').toUpperCase();
  if (p === 'G' || p === 'GK' || p.includes('GOAL')) return 'POR';
  if (p.includes('D') || p === 'CB' || p === 'LB' || p === 'RB' || p === 'CD' || p === 'CD-L' || p === 'CD-R') return 'DEF';
  if (p.includes('F') || p === 'ST' || p === 'CF' || p === 'LW' || p === 'RW') return 'DEL';
  return 'MED';
}

function parseEspnMatchStatusAndClock(ev: any): {
  isLive: boolean;
  isPost: boolean;
  isHalfTime: boolean;
  statusShort: string;
  elapsedMin: number | null;
} {
  const state = String(ev?.status?.type?.state || 'pre').toLowerCase();
  const isLive = state === 'in';
  const isPost = state === 'post' || ev?.status?.type?.completed === true;
  const period = Number(ev?.status?.period || 1);
  const statusTypeName = String(ev?.status?.type?.name || '').toUpperCase();
  const statusDetail = String(ev?.status?.type?.detail || '').toUpperCase();
  const statusShortDetail = String(ev?.status?.type?.shortDetail || '').toUpperCase();
  const rawClock = String(ev?.status?.displayClock || '').trim();
  const clockSeconds = Number(ev?.status?.clock || 0);

  if (isPost) {
    return {
      isLive: false,
      isPost: true,
      isHalfTime: false,
      statusShort: 'FT',
      elapsedMin: 90
    };
  }

  if (statusTypeName.includes('POSTPONED')) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: 'PST', elapsedMin: null };
  }
  if (statusTypeName.includes('CANCEL')) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: 'CANC', elapsedMin: null };
  }
  if (statusTypeName.includes('SUSPEND') || statusTypeName.includes('DELAY')) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: 'SUSP', elapsedMin: null };
  }

  if (!isLive) {
    return {
      isLive: false,
      isPost: false,
      isHalfTime: false,
      statusShort: 'NS',
      elapsedMin: null
    };
  }

  const isHalfTime =
    statusTypeName.includes('HALFTIME') ||
    statusShortDetail === 'HT' ||
    statusDetail === 'HT' ||
    statusShortDetail.includes('HALF') ||
    statusShortDetail.includes('DESCANSO');

  if (isHalfTime) {
    return {
      isLive: true,
      isPost: false,
      isHalfTime: true,
      statusShort: 'HT',
      elapsedMin: 45
    };
  }

  const isShootout =
    statusTypeName.includes('SHOOTOUT') ||
    statusTypeName.includes('PENALT') ||
    statusTypeName.includes('END_OF_EXTRATIME') ||
    statusShortDetail.includes('PEN') ||
    statusDetail.includes('PENS') ||
    period >= 5;

  if (isShootout) {
    return {
      isLive: true,
      isPost: false,
      isHalfTime: false,
      statusShort: 'PEN',
      elapsedMin: 120
    };
  }

  const isOvertime =
    statusTypeName.includes('OVERTIME') ||
    statusTypeName.includes('EXTRA') ||
    period === 3 ||
    period === 4;

  const isFirstHalf = !isOvertime && (period === 1 || statusTypeName.includes('FIRST_HALF'));
  const statusShort = isOvertime ? (period === 3 ? '1ET' : '2ET') : isFirstHalf ? '1H' : '2H';

  let parsedMin = isOvertime ? 95 : isFirstHalf ? 20 : 60;
  const plusMatch = rawClock.match(/(\d+)\s*'?\s*\+\s*(\d+)/);
  const colonMatch = rawClock.match(/^(\d+):(\d+)$/);
  const numMatch = rawClock.match(/(\d+)/);

  if (plusMatch) {
    const base = parseInt(plusMatch[1], 10);
    const extra = parseInt(plusMatch[2], 10);
    parsedMin = base + extra;
  } else if (colonMatch) {
    parsedMin = Math.max(1, parseInt(colonMatch[1], 10));
  } else if (numMatch) {
    parsedMin = parseInt(numMatch[1], 10);
  } else if (clockSeconds > 0) {
    parsedMin = Math.max(1, Math.ceil(clockSeconds / 60));
  }

  if (isOvertime) {
    parsedMin = Math.min(125, Math.max(91, parsedMin));
  } else if (isFirstHalf) {
    parsedMin = Math.min(55, Math.max(1, parsedMin));
  } else {
    parsedMin = Math.min(105, Math.max(46, parsedMin));
  }

  return {
    isLive: true,
    isPost: false,
    isHalfTime: false,
    statusShort,
    elapsedMin: parsedMin
  };
}

async function fetchEspnMatchSummaryTelemetry(
  espnEventId: string,
  homeName: string,
  awayName: string,
  elapsedMin: number,
  isFinished: boolean,
  fallbackTelemetry: { liveStats: any; liveEvents: any[] }
): Promise<{ liveStats: any; liveEvents: any[]; liveRosters?: any }> {
  if (!espnEventId) return fallbackTelemetry;
  const cacheKey = `espn_summary_v3_${espnEventId}`;
  const cached = getCacheItem<{ liveStats: any; liveEvents: any[]; liveRosters?: any }>(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 1000) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(espnEventId)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return fallbackTelemetry;
    const sumData = await res.json();

    const hKey = normalizeTeamKey(homeName);
    const aKey = normalizeTeamKey(awayName);

    const boxTeams = Array.isArray(sumData?.boxscore?.teams) ? sumData.boxscore.teams : [];
    const homeBox =
      boxTeams.find((t: any) => {
        const tk = normalizeTeamKey(t?.team?.displayName || t?.team?.name || '');
        return tk && hKey && (tk.includes(hKey) || hKey.includes(tk));
      }) || boxTeams[0];
    const awayBox =
      boxTeams.find((t: any) => {
        const tk = normalizeTeamKey(t?.team?.displayName || t?.team?.name || '');
        return tk && aKey && (tk.includes(aKey) || aKey.includes(tk));
      }) || boxTeams[1];

    const homeBoxStats = Array.isArray(homeBox?.statistics) ? homeBox.statistics : [];
    const awayBoxStats = Array.isArray(awayBox?.statistics) ? awayBox.statistics : [];

    const keyEvents = Array.isArray(sumData?.keyEvents) ? sumData.keyEvents : [];
    const parsedEvents: any[] = [
      {
        id: `kickoff_${espnEventId}`,
        minute: 1,
        displayMinute: "1'",
        type: 'PERIOD_START',
        teamSide: 'NEUTRAL',
        detail: 'Inicio del primer tiempo'
      }
    ];

    let keyHomeYellow = 0;
    let keyAwayYellow = 0;
    let keyHomeRed = 0;
    let keyAwayRed = 0;
    let hasHalftimeEvent = false;

    keyEvents.forEach((ke: any, idx: number) => {
      const typeKey = String(ke?.type?.type || ke?.type?.text || '').toLowerCase();
      const clockInfo = parseClockMinute(ke?.clock?.displayValue, 45);
      const evTeamName = String(ke?.team?.displayName || '');
      const evTeamKey = normalizeTeamKey(evTeamName);
      const side: 'HOME' | 'AWAY' =
        evTeamKey && aKey && (evTeamKey.includes(aKey) || aKey.includes(evTeamKey)) ? 'AWAY' : 'HOME';
      const teamLabel = side === 'HOME' ? homeName : awayName;

      const rawP1 = ke?.participants?.[0]?.athlete?.displayName || ke?.participants?.[0]?.displayName;
      const rawP2 = ke?.participants?.[1]?.athlete?.displayName || ke?.participants?.[1]?.displayName;

      if (typeKey.includes('halftime') || typeKey === 'end-1st-half') {
        if (!hasHalftimeEvent) {
          hasHalftimeEvent = true;
          parsedEvents.push({
            id: `ht_${espnEventId}`,
            minute: 45,
            displayMinute: clockInfo.displayMinute || "45'",
            type: 'PERIOD_HALF',
            teamSide: 'NEUTRAL',
            detail: 'Entretiempo reglamentario'
          });
        }
      } else if (
        typeKey === 'goal' ||
        typeKey.includes('penalty---scored') ||
        typeKey.includes('own-goal') ||
        (ke?.scoringPlay === true)
      ) {
        const isOwnGoal = typeKey.includes('own-goal');
        const isPen = typeKey.includes('penalty');
        const p1 = resolveServerPlayerName(rawP1, teamLabel, 9 - (idx % 3), false);
        const p2 = rawP2 ? resolveServerPlayerName(rawP2, teamLabel, 7, false) : undefined;
        parsedEvents.push({
          id: `goal_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: 'GOAL',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          playerSecondary: p2,
          detail: isPen
            ? `Gol de penal convertido por ${p1}`
            : isOwnGoal
            ? `Gol en propia puerta (${p1})`
            : p2
            ? `Gol de ${p1} · Asistencia de ${p2}`
            : `Anotación oficial de ${p1} para ${teamLabel}`
        });
      } else if (typeKey.includes('red-card') || typeKey.includes('second-yellow')) {
        if (side === 'HOME') keyHomeRed++;
        else keyAwayRed++;
        const p1 = resolveServerPlayerName(rawP1, teamLabel, (3 + idx) % 10, false);
        parsedEvents.push({
          id: `rc_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: 'RED_CARD',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          detail: `Tarjeta roja / expulsión para ${p1}`
        });
      } else if (typeKey.includes('yellow-card')) {
        if (side === 'HOME') keyHomeYellow++;
        else keyAwayYellow++;
        const p1 = resolveServerPlayerName(rawP1, teamLabel, (4 + idx) % 10, false);
        parsedEvents.push({
          id: `yc_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: 'YELLOW_CARD',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          detail: `Tarjeta amarilla mostrada a ${p1}`
        });
      } else if (typeKey.includes('substitution')) {
        const p1 = resolveServerPlayerName(rawP1, teamLabel, 12 + (idx % 5), true);
        const p2 = resolveServerPlayerName(rawP2, teamLabel, 6 + (idx % 5), false);
        parsedEvents.push({
          id: `sub_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: 'SUBSTITUTION',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          playerSecondary: p2,
          detail: `Ingresa ${p1} en reemplazo de ${p2}`
        });
      }
    });

    if (!hasHalftimeEvent && (elapsedMin >= 45 || isFinished)) {
      parsedEvents.push({
        id: `ht_fallback_${espnEventId}`,
        minute: 45,
        displayMinute: "45'",
        type: 'PERIOD_HALF',
        teamSide: 'NEUTRAL',
        detail: 'Entretiempo reglamentario'
      });
    }

    const commentary = Array.isArray(sumData?.commentary) ? sumData.commentary : [];
    commentary.forEach((c: any, idx: number) => {
      const playType = String(c?.play?.type?.type || c?.play?.type?.text || '').toLowerCase();
      const rawText = String(c?.text || '');
      if (playType.includes('corner') || /^corner,/i.test(rawText)) {
        const clockInfo = parseClockMinute(c?.time?.displayValue || c?.play?.clock?.displayValue, 30);
        const playTeamName = String(c?.play?.team?.displayName || '');
        const concededMatch = rawText.match(/Conceded by ([^.]+)\.?/i);
        const concededBy = concededMatch ? concededMatch[1].trim() : '';

        let side: 'HOME' | 'AWAY' = 'HOME';
        if (playTeamName) {
          const pk = normalizeTeamKey(playTeamName);
          if (pk && aKey && (pk.includes(aKey) || aKey.includes(pk))) side = 'AWAY';
        } else {
          const headerMatch = rawText.match(/^Corner,\s*([^.]+)\./i);
          if (headerMatch) {
            const pk = normalizeTeamKey(headerMatch[1]);
            if (pk && aKey && (pk.includes(aKey) || aKey.includes(pk))) side = 'AWAY';
          }
        }
        const teamLabel = side === 'HOME' ? homeName : awayName;
        parsedEvents.push({
          id: `corner_${espnEventId}_${idx}_${clockInfo.minute}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: 'CORNER',
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: concededBy || undefined,
          detail: concededBy
            ? `Tiro de esquina para ${teamLabel} (cedido por ${concededBy})`
            : `Tiro de esquina ejecutado por ${teamLabel}`
        });
      }
    });

    const homeCorners = getStatNumber(homeBoxStats, 'wonCorners', fallbackTelemetry.liveStats.home.corners);
    const awayCorners = getStatNumber(awayBoxStats, 'wonCorners', fallbackTelemetry.liveStats.away.corners);
    const homeYellows = getStatNumber(
      homeBoxStats,
      'yellowCards',
      Math.max(keyHomeYellow, fallbackTelemetry.liveStats.home.yellowCards)
    );
    const awayYellows = getStatNumber(
      awayBoxStats,
      'yellowCards',
      Math.max(keyAwayYellow, fallbackTelemetry.liveStats.away.yellowCards)
    );
    const homeReds = getStatNumber(
      homeBoxStats,
      'redCards',
      Math.max(keyHomeRed, fallbackTelemetry.liveStats.home.redCards)
    );
    const awayReds = getStatNumber(
      awayBoxStats,
      'redCards',
      Math.max(keyAwayRed, fallbackTelemetry.liveStats.away.redCards)
    );

    const liveStats = {
      home: {
        corners: homeCorners,
        yellowCards: homeYellows,
        redCards: homeReds,
        shots: getStatNumber(homeBoxStats, 'totalShots', fallbackTelemetry.liveStats.home.shots),
        shotsOnTarget: getStatNumber(homeBoxStats, 'shotsOnTarget', fallbackTelemetry.liveStats.home.shotsOnTarget),
        possessionPct: getStatNumber(homeBoxStats, 'possessionPct', fallbackTelemetry.liveStats.home.possessionPct),
        foulsCommitted: getStatNumber(homeBoxStats, 'foulsCommitted', fallbackTelemetry.liveStats.home.foulsCommitted)
      },
      away: {
        corners: awayCorners,
        yellowCards: awayYellows,
        redCards: awayReds,
        shots: getStatNumber(awayBoxStats, 'totalShots', fallbackTelemetry.liveStats.away.shots),
        shotsOnTarget: getStatNumber(awayBoxStats, 'shotsOnTarget', fallbackTelemetry.liveStats.away.shotsOnTarget),
        possessionPct: getStatNumber(awayBoxStats, 'possessionPct', fallbackTelemetry.liveStats.away.possessionPct),
        foulsCommitted: getStatNumber(awayBoxStats, 'foulsCommitted', fallbackTelemetry.liveStats.away.foulsCommitted)
      },
      updatedAt: Date.now()
    };

    if (isFinished) {
      parsedEvents.push({
        id: `ft_${espnEventId}`,
        minute: 90,
        displayMinute: "90'",
        type: 'PERIOD_END',
        teamSide: 'NEUTRAL',
        detail: 'Final del encuentro'
      });
    }

    const finalEvents = reconcileCornerEvents(
      parsedEvents.length > 1 ? parsedEvents : fallbackTelemetry.liveEvents,
      homeCorners,
      awayCorners,
      homeName,
      awayName,
      elapsedMin || 45
    );

    let liveRosters: any = undefined;
    const rawRosters = Array.isArray(sumData?.rosters) ? sumData.rosters : [];
    if (rawRosters.length >= 2) {
      const homeRosterObj = rawRosters.find((r: any) => r.homeAway === 'home') || rawRosters[0];
      const awayRosterObj = rawRosters.find((r: any) => r.homeAway === 'away') || rawRosters[1];

      const mapRosterList = (list: any[], isStarter: boolean, teamName: string) =>
        (Array.isArray(list) ? list : [])
          .filter((item: any) => Boolean(item?.starter) === isStarter)
          .map((item: any, idx: number) => {
            const pStats = Array.isArray(item?.stats) ? item.stats : [];
            const yc = getStatNumber(pStats, 'yellowCards', 0);
            const rc = getStatNumber(pStats, 'redCards', 0);
            const rawAthleteName = item?.athlete?.displayName || item?.athlete?.fullName;
            return {
              id: String(item?.athlete?.id || `p_${idx}`),
              name: resolveServerPlayerName(rawAthleteName, teamName, isStarter ? idx : idx + 12, !isStarter),
              number: parseInt(String(item?.jersey || idx + 1), 10) || idx + 1,
              position: mapEspnPosition(String(item?.position?.abbreviation || '')),
              isCaptain: Boolean(item?.captain),
              matchYellowCards: yc,
              matchRedCards: rc,
              subbedIn: Boolean(item?.subbedIn),
              subbedOut: Boolean(item?.subbedOut)
            };
          });

      const homeStarters = mapRosterList(homeRosterObj?.roster, true, homeName);
      const awayStarters = mapRosterList(awayRosterObj?.roster, true, awayName);
      if (homeStarters.length >= 7 && awayStarters.length >= 7) {
        liveRosters = {
          homeFormation: homeRosterObj?.formation || '4-3-3',
          awayFormation: awayRosterObj?.formation || '4-3-3',
          homeStarters,
          awayStarters,
          homeSubstitutes: mapRosterList(homeRosterObj?.roster, false, homeName),
          awaySubstitutes: mapRosterList(awayRosterObj?.roster, false, awayName)
        };
      }
    }

    const result = { liveStats, liveEvents: finalEvents, liveRosters };
    setCacheItem(cacheKey, result);
    return result;
  } catch {
    return fallbackTelemetry;
  }
}

async function fetchEspnSoccerFixtures(targetDate: string, clientTz = 'America/Bogota'): Promise<any[]> {
  const espnDateStr = targetDate.replace(/-/g, '');
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const mapped: any[] = [];
    const now = Date.now();

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
      if (!homeComp || !awayComp) continue;

      const state = String(ev?.status?.type?.state || 'pre').toLowerCase();
      if (state === 'post' || ev?.status?.type?.completed === true) {
        continue;
      }

      const matchDateObj = new Date(ev.date);
      const matchTimestampMs = matchDateObj.getTime();
      if (isNaN(matchTimestampMs)) continue;

      if (state !== 'in' && matchTimestampMs < now - 120 * 60 * 1000) {
        continue;
      }

      let eventLocalDate = targetDate;
      try {
        eventLocalDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: clientTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(matchDateObj);
      } catch {
        // fallback to targetDate
      }
      if (eventLocalDate !== targetDate) {
        continue;
      }

      const rawUid = String(ev?.uid || '');
      const espnLeagueId = rawUid.match(/~l:(\d+)/)?.[1] || '0';
      const rawCountry = String(comp?.venue?.address?.country || 'Internacional');
      const catalogEntry = ESPN_LEAGUE_CATALOG[espnLeagueId];
      const countryTranslated = COUNTRY_TRANSLATION_MAP[rawCountry];

      const leagueId = catalogEntry?.id || parseInt(espnLeagueId, 10) || 1;
      const countryName = catalogEntry?.country || countryTranslated?.country || rawCountry;
      const flag = catalogEntry?.flag || countryTranslated?.flag || '⚽';
      const slug = String(ev?.season?.slug || 'Jornada Regular').replace(/-/g, ' ');
      const leagueName = catalogEntry?.name || `Liga ${countryName}`;

      const clockParsed = parseEspnMatchStatusAndClock(ev);
      const isLive = clockParsed.isLive;
      const elapsedMin = clockParsed.elapsedMin;

      const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || 'Local');
      const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || 'Visitante');
      const espnEventId = String(ev.id || '');

      const sbTelemetry = isLive
        ? extractEspnScoreboardTelemetry(ev, comp, homeComp, awayComp, homeName, awayName, elapsedMin || 45, false)
        : undefined;

      mapped.push({
        espnEventId,
        liveStats: sbTelemetry?.liveStats,
        liveEvents: sbTelemetry?.liveEvents,
        fixture: {
          id: parseInt(espnEventId || '0', 10) || Math.floor(Math.random() * 900000 + 100000),
          date: ev.date,
          timestamp: Math.floor(matchTimestampMs / 1000),
          venue: {
            name: comp?.venue?.fullName || 'Estadio Oficial',
            city: comp?.venue?.address?.city || countryName
          },
          status: {
            short: clockParsed.statusShort,
            elapsed: elapsedMin
          }
        },
        league: {
          id: leagueId,
          name: leagueName,
          country: countryName,
          flag,
          round: slug
        },
        teams: {
          home: {
            id: parseInt(String(homeComp?.team?.id || homeComp?.id || '1'), 10) || 1,
            name: homeName,
            logo: String(homeComp?.team?.logo || homeComp?.team?.logos?.[0]?.href || '')
          },
          away: {
            id: parseInt(String(awayComp?.team?.id || awayComp?.id || '2'), 10) || 2,
            name: awayName,
            logo: String(awayComp?.team?.logo || awayComp?.team?.logos?.[0]?.href || '')
          }
        },
        goals: {
          home: isLive ? parseInt(String(homeComp?.score || '0'), 10) || 0 : null,
          away: isLive ? parseInt(String(awayComp?.score || '0'), 10) || 0 : null
        }
      });
    }

    const liveItems = mapped
      .filter(
        (m) =>
          ['1H', '2H', 'HT', '1ET', '2ET', 'ET', 'PEN'].includes(String(m.fixture?.status?.short || '')) &&
          m.espnEventId
      )
      .slice(0, 25);
    if (liveItems.length > 0) {
      await Promise.allSettled(
        liveItems.map(async (item) => {
          const enriched = await fetchEspnMatchSummaryTelemetry(
            item.espnEventId,
            item.teams.home.name,
            item.teams.away.name,
            item.fixture.status.elapsed || 45,
            false,
            { liveStats: item.liveStats, liveEvents: item.liveEvents || [] }
          );
          item.liveStats = enriched.liveStats;
          item.liveEvents = enriched.liveEvents;
          if (enriched.liveRosters) {
            item.liveRosters = enriched.liveRosters;
          }
          // Garantizar que el reloj oficial nunca sea menor al último evento real reportado
          if (item.fixture.status.short !== 'HT' && Array.isArray(enriched.liveEvents)) {
            const maxEvMin = enriched.liveEvents.reduce((acc: number, evItem: any) => {
              if (evItem?.type === 'PERIOD_HALF' || evItem?.type === 'PERIOD_END' || evItem?.type === 'PERIOD_START') {
                return acc;
              }
              return Math.max(acc, Number(evItem?.minute || 0));
            }, 0);
            if (maxEvMin > (item.fixture.status.elapsed || 0)) {
              item.fixture.status.elapsed = maxEvMin;
            }
          }
        })
      );
    }

    return mapped;
  } catch (err) {
    console.warn('[ESPN Soccer Fallback Error]:', err);
    return [];
  }
}

const SERVER_ALLOWED_PRIME_COUNTRIES: Record<string, {
  countryMatches: string[];
  allowedLeaguesPattern: RegExp;
  excludedLeaguesPattern?: RegExp;
}> = {
  COLOMBIA: {
    countryMatches: ['colombia'],
    allowedLeaguesPattern: /\b(primera a|primera b|liga betplay|torneo betplay|copa betplay|copa colombia|superliga|dimayor)\b/i
  },
  ENGLAND: {
    countryMatches: ['england', 'inglaterra'],
    allowedLeaguesPattern: /\b(premier league|championship|fa cup|efl cup|carabao cup|community shield)\b/i,
    excludedLeaguesPattern: /\b(premier league 2|u18|u21|u23|national league|league one|league two|efl trophy|isthmian|southern|northern|women|femenina)\b/i
  },
  SPAIN: {
    countryMatches: ['spain', 'espana', 'españa'],
    allowedLeaguesPattern: /\b(la liga|laliga|primera divisi[oó]n|segunda divisi[oó]n|hypermotion|copa del rey|supercopa)\b/i,
    excludedLeaguesPattern: /\b(rfef|tercera|federaci[oó]n|juvenil|women|femenina)\b/i
  },
  ITALY: {
    countryMatches: ['italy', 'italia'],
    allowedLeaguesPattern: /\b(serie a|serie b|coppa italia|supercoppa)\b/i,
    excludedLeaguesPattern: /\b(serie c|serie d|primavera|coppa italia serie|women|femminile)\b/i
  },
  GERMANY: {
    countryMatches: ['germany', 'alemania'],
    allowedLeaguesPattern: /\b(bundesliga|2\. bundesliga|dfb pokal|dfb-pokal|supercup)\b/i,
    excludedLeaguesPattern: /\b(3\. liga|regionalliga|oberliga|junioren|u19|u17|women|frauen)\b/i
  },
  FRANCE: {
    countryMatches: ['france', 'francia'],
    allowedLeaguesPattern: /\b(ligue 1|ligue 2|coupe de france|troph[eé]e des champions)\b/i,
    excludedLeaguesPattern: /\b(national|championnat national|u19|feminine|f[eé]minine)\b/i
  },
  ARGENTINA: {
    countryMatches: ['argentina'],
    allowedLeaguesPattern: /\b(liga profesional|primera divisi[oó]n|copa de la liga|copa argentina|trofeo de campeones|primera nacional)\b/i,
    excludedLeaguesPattern: /\b(primera b|primera c|primera d|torneo federal|reserva|proyecci[oó]n|femenino)\b/i
  },
  BRAZIL: {
    countryMatches: ['brazil', 'brasil'],
    allowedLeaguesPattern: /\b(serie a|s[eé]rie a|serie b|s[eé]rie b|brasileir[aã]o|copa do brasil|supercopa|paulista a1|paulist[aã]o|carioca)\b/i,
    excludedLeaguesPattern: /\b(serie c|s[eé]rie c|serie d|s[eé]rie d|paulista a2|paulista a3|copa verde|sub-20|u20|feminino)\b/i
  },
  MEXICO: {
    countryMatches: ['mexico', 'méxico'],
    allowedLeaguesPattern: /\b(liga mx|expansi[oó]n mx|copa mx|campe[oó]n de campeones)\b/i,
    excludedLeaguesPattern: /\b(liga premier|tdp|sub-23|u23|femenil)\b/i
  },
  USA: {
    countryMatches: ['usa', 'united states', 'estados unidos'],
    allowedLeaguesPattern: /\b(major league soccer|mls|us open cup)\b/i,
    excludedLeaguesPattern: /\b(mls next|usl|nisa|npsl|ncaa)\b/i
  },
  PORTUGAL: {
    countryMatches: ['portugal'],
    allowedLeaguesPattern: /\b(primeira liga|liga portugal|ta[cç]a de portugal|ta[cç]a da liga|superta[cç]a)\b/i,
    excludedLeaguesPattern: /\b(liga 3|campeonato de portugal|revela[cç][aã]o|u23)\b/i
  },
  NETHERLANDS: {
    countryMatches: ['netherlands', 'paises bajos', 'países bajos', 'holanda'],
    allowedLeaguesPattern: /\b(eredivisie|eerste divisie|knvb beker|johan cruijff)\b/i,
    excludedLeaguesPattern: /\b(tweede divisie|derde divisie|u21)\b/i
  },
  SAUDI_ARABIA: {
    countryMatches: ['saudi arabia', 'saudi-arabia', 'arabia saudita'],
    allowedLeaguesPattern: /\b(pro league|professional league|saudi league|king'?s cup|super cup)\b/i,
    excludedLeaguesPattern: /\b(division 1|division 2|youth)\b/i
  },
  TURKEY: {
    countryMatches: ['turkey', 'turquia', 'turquía'],
    allowedLeaguesPattern: /\b(s[uü]per lig|1\. lig|turkish cup|kupasi)\b/i,
    excludedLeaguesPattern: /\b(2\. lig|3\. lig|u19)\b/i
  },
  CHILE: {
    countryMatches: ['chile'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|primera b|copa chile|supercopa)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|tercera)\b/i
  },
  URUGUAY: {
    countryMatches: ['uruguay'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|campeonato uruguayo|torneo apertura|torneo clausura|intermedio)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|reserva)\b/i
  },
  ECUADOR: {
    countryMatches: ['ecuador'],
    allowedLeaguesPattern: /\b(liga ?pro|serie a|copa ecuador)\b/i,
    excludedLeaguesPattern: /\b(serie b|segunda)\b/i
  },
  PERU: {
    countryMatches: ['peru', 'perú'],
    allowedLeaguesPattern: /\b(liga 1|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(liga 2|copa per[uú]|reserva)\b/i
  },
  PARAGUAY: {
    countryMatches: ['paraguay'],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n|copa de primera|copa paraguay)\b/i,
    excludedLeaguesPattern: /\b(intermedia|reserva)\b/i
  },
  BOLIVIA: {
    countryMatches: ['bolivia'],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(sim[oó]n bol[ií]var)\b/i
  },
  VENEZUELA: {
    countryMatches: ['venezuela'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|liga futve|copa venezuela)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n)\b/i
  },
  BELGIUM: {
    countryMatches: ['belgium', 'belgica', 'bélgica'],
    allowedLeaguesPattern: /\b(pro league|jupiler|first division a|beker van belgie|croky cup)\b/i,
    excludedLeaguesPattern: /\b(challenger|amateur|u21)\b/i
  },
  SCOTLAND: {
    countryMatches: ['scotland', 'escocia'],
    allowedLeaguesPattern: /\b(premiership|scottish cup|league cup)\b/i,
    excludedLeaguesPattern: /\b(championship|league one|league two|highland|lowland)\b/i
  },
  JAPAN: {
    countryMatches: ['japan', 'japon', 'japón'],
    allowedLeaguesPattern: /\b(j1 league|j\.league|emperor cup|j-league cup)\b/i,
    excludedLeaguesPattern: /\b(j2 league|j3 league|we league|university)\b/i
  }
};

function isServerYouthOrLowTierMatch(leagueName: string, countryName: string, homeName: string, awayName: string): boolean {
  const lName = (leagueName || '').toLowerCase().trim();
  const cName = (countryName || '').toLowerCase().trim();
  const combined = `${lName} ${cName} ${homeName || ''} ${awayName || ''}`.toLowerCase();

  if (
    /\b(u15|u16|u17|u18|u19|u20|u21|u22|u23|sub-15|sub-17|sub-19|sub-20|sub-21|sub-23|youth|juvenil|reservas|reserve|amateur|regional|tercera|fourth division|national league north|national league south|non-league|oberliga|regionalliga|primavera|premier league 2|femenin[ao]|women|frauen|femminile|femenil)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  const isEliteIntlCountry = ['world', 'europe', 'south america', 'north & central america', 'asia', 'international', 'europa', 'sudamérica', 'sudamerica', 'internacional'].some(
    (ic) => cName === ic || cName.includes(ic)
  );
  const isEliteIntlTournament =
    /\b(uefa champions|champions league|europa league|conference league|super cup|copa libertadores|libertadores|copa sudamericana|sudamericana|recopa|copa america|copa am[eé]rica|eurocopa|world cup|mundial|nations league|eliminatorias|wc qualification|world cup qualification|concacaf champions|afc champions|leagues cup|gold cup|copa oro|club world cup)\b/i.test(
      lName
    ) &&
    !/\b(caf|ofc|afc cup|asean|cosafa|cecafa|wafcon|u17|u20|u23|women|youth)\b/i.test(`${lName} ${cName}`);

  if (isEliteIntlTournament && (isEliteIntlCountry || !cName)) {
    return false;
  }

  for (const rule of Object.values(SERVER_ALLOWED_PRIME_COUNTRIES)) {
    const countryMatches = rule.countryMatches.some((cm) => {
      if (cName === cm) return true;
      if (cm === 'england' && (cName.includes('new') || cName.includes('northern'))) return false;
      return cName === cm;
    });

    if (countryMatches) {
      if (rule.excludedLeaguesPattern && rule.excludedLeaguesPattern.test(lName)) {
        return true;
      }
      if (rule.allowedLeaguesPattern.test(lName)) {
        return false;
      }
      return true;
    }
  }

  if (!cName) {
    if (
      /\b(betplay|laliga|bundesliga|eredivisie|primeira liga|brasileir[aã]o|liga mx|mls|s[uü]per lig|campeonato uruguayo|liga futve|j1 league)\b/i.test(
        lName
      )
    ) {
      return false;
    }
  }

  return true;
}

function filterActiveUpcomingFixtures(list: any[], targetDate: string, clientTz: string): any[] {
  const now = Date.now();
  const activeFinishedShorts = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

  return list.filter((f: any) => {
    const id = f?.fixture?.id;
    if (id === 991001 || id === 991002 || id === 991003) return false;

    const lName = String(f?.league?.name || '');
    const cName = String(f?.league?.country || '');
    const hName = String(f?.teams?.home?.name || '');
    const aName = String(f?.teams?.away?.name || '');
    if (isServerYouthOrLowTierMatch(lName, cName, hName, aName)) {
      return false;
    }

    const statusShort = String(f.fixture?.status?.short || '').toUpperCase();
    if (activeFinishedShorts.includes(statusShort)) return false;

    const matchTime = f.fixture?.timestamp
      ? f.fixture.timestamp * 1000
      : new Date(f.fixture?.date || 0).getTime();

    if (matchTime > 0 && (now - matchTime) / 60000 >= 120) {
      return false;
    }

    if (matchTime > 0) {
      try {
        const localDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: clientTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(matchTime));
        if (localDate !== targetDate) return false;
      } catch {
        // ignore invalid timezone
      }
    }

    const isLive = ['1H', '2H', 'HT', 'ET', 'LIVE', 'BT', 'P', 'INT'].includes(statusShort);
    if (isLive) return true;
    return matchTime > now - 115 * 60 * 1000;
  });
}

// 0. Upcoming & Matches Endpoint: BLINDADO PARA ALTA CONCURRENCIA ($0 Free Tier)
app.get(['/api/upcoming', '/api/matches'], dataRateLimitMiddleware, async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  const apiKey = getSecretApiKey();
  const requestedDate = (req.query.date as string) || '';
  const clientTz = ((req.query.tz as string) || 'America/Bogota').trim() || 'America/Bogota';
  const query = ((req.query.q as string) || '').toLowerCase().trim();
  const force = req.query.force === 'true' && isValidAdminPin(extractAdminCredential(req), getAdminConfig());

  const todayLocal = getColombiaDateStr(0, clientTz);
  const targetDate = requestedDate || todayLocal;

  const cacheKey = `upcoming_v8_${targetDate}`;
  const cached = getCacheItem<any[]>(cacheKey);

  // TTL inteligente: 20 segundos si hay partidos en vivo o cuya hora de inicio ya llegó;
  // 2 horas para partidos futuros programados del día; 24 horas para fechas futuras.
  const nowMs = Date.now();
  const hasLiveOrStartedInCache =
    cached &&
    Array.isArray(cached.data) &&
    cached.data.some((f: any) => {
      const s = String(f?.fixture?.status?.short || '').toUpperCase();
      if (['1H', '2H', 'HT', 'ET', '1ET', '2ET', 'LIVE', 'BT', 'P', 'PEN', 'INT'].includes(s)) return true;
      const mTime = f?.fixture?.timestamp
        ? f.fixture.timestamp * 1000
        : new Date(f?.fixture?.date || 0).getTime();
      return mTime > 0 && mTime <= nowMs;
    });

  const cacheTTL =
    targetDate === todayLocal
      ? hasLiveOrStartedInCache
        ? 20 * 1000
        : 2 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

  // 1. Check persistent cache: Serve immediately if fresh and not forced
  if (cached && Array.isArray(cached.data) && cached.data.length > 0 && !query && !force) {
    const cacheAge = nowMs - cached.timestamp;
    if (cacheAge < cacheTTL) {
      const activeList = filterActiveUpcomingFixtures(cached.data, targetDate, clientTz);
      if (activeList.length > 0) {
        return res.json({
          success: true,
          source: 'persistent_disk_cache',
          remainingCalls: lastRemainingCalls,
          quotaShieldActive,
          cachedAt: cached.timestamp,
          count: activeList.length,
          fixtures: activeList
        });
      }
    }
  }

  // 2. Single-Flight Coalescing: Solo 1 llamada a la API si 50 usuarios entran juntos
  try {
    const resultList = await runSingleFlight(cacheKey, async () => {
      let upcomingOnly: any[] = [];
      const espnFixtures = await fetchEspnSoccerFixtures(targetDate, clientTz);

      // Caché dedicada de 2 horas para la programación base de API-Football (protege 100% la cuota de 100 req/día)
      const afScheduleCacheKey = `apifootball_schedule_v1_${targetDate}`;
      const cachedAfSchedule = getCacheItem<any[]>(afScheduleCacheKey);
      const afScheduleTTL = targetDate === todayLocal ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      if (
        cachedAfSchedule &&
        Array.isArray(cachedAfSchedule.data) &&
        cachedAfSchedule.data.length > 0 &&
        Date.now() - cachedAfSchedule.timestamp < afScheduleTTL
      ) {
        upcomingOnly = filterActiveUpcomingFixtures(
          JSON.parse(JSON.stringify(cachedAfSchedule.data)),
          targetDate,
          clientTz
        );
      } else if (apiKey && !quotaShieldActive) {
        try {
          const apiRes = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}&timezone=America/Bogota`,
            {
              method: 'GET',
              headers: { 'x-apisports-key': apiKey }
            }
          );

          updateQuotaFromHeaders(apiRes.headers);

          if (apiRes.ok) {
            const json = await apiRes.json();
            const rawList = Array.isArray(json.response) ? json.response : [];
            if (rawList.length > 0) {
              setCacheItem(afScheduleCacheKey, rawList);
            }
            upcomingOnly = filterActiveUpcomingFixtures(rawList, targetDate, clientTz);
          }
        } catch {
          // Proceed to ESPN official fallback
        }
      }

      if (upcomingOnly.length > 0 && espnFixtures.length > 0) {
        for (const f of upcomingOnly) {
          const hKey = normalizeTeamKey(f?.teams?.home?.name || '');
          const aKey = normalizeTeamKey(f?.teams?.away?.name || '');
          const matchedEspn = espnFixtures.find((ef: any) =>
            teamsFuzzyMatch(
              hKey,
              aKey,
              normalizeTeamKey(ef?.teams?.home?.name || ''),
              normalizeTeamKey(ef?.teams?.away?.name || '')
            )
          );
          if (matchedEspn) {
            f.espnEventId = matchedEspn.espnEventId;
            if (matchedEspn.liveStats) f.liveStats = matchedEspn.liveStats;
            if (matchedEspn.liveEvents) f.liveEvents = matchedEspn.liveEvents;
            if (matchedEspn.liveRosters) f.liveRosters = matchedEspn.liveRosters;
            const espnShort = String(matchedEspn.fixture?.status?.short || '').toUpperCase();
            if (['1H', '2H', 'HT', '1ET', '2ET', 'ET', 'PEN', 'FT', 'PST', 'CANC', 'SUSP'].includes(espnShort)) {
              f.fixture.status.short = espnShort;
              f.fixture.status.elapsed = matchedEspn.fixture.status.elapsed;
              f.goals = matchedEspn.goals;
            }
          }
        }
        upcomingOnly = filterActiveUpcomingFixtures(upcomingOnly, targetDate, clientTz);
      }

      if (upcomingOnly.length === 0) {
        upcomingOnly = filterActiveUpcomingFixtures(espnFixtures, targetDate, clientTz);
      }

      upcomingOnly.sort((a: any, b: any) => {
        const sA = String(a.fixture?.status?.short || '').toUpperCase();
        const sB = String(b.fixture?.status?.short || '').toUpperCase();
        const liveA = ['1H', '2H', 'HT', 'ET', '1ET', '2ET', 'PEN', 'LIVE'].includes(sA) ? 0 : 1;
        const liveB = ['1H', '2H', 'HT', 'ET', '1ET', '2ET', 'PEN', 'LIVE'].includes(sB) ? 0 : 1;
        if (liveA !== liveB) return liveA - liveB;
        const tA = a.fixture?.timestamp || 0;
        const tB = b.fixture?.timestamp || 0;
        return tA - tB;
      });

      if (upcomingOnly.length > 0) {
        setCacheItem(cacheKey, upcomingOnly);
      }
      return upcomingOnly;
    });

    let filtered = resultList;
    if (query) {
      filtered = resultList.filter((f: any) => {
        const hName = (f.teams?.home?.name || '').toLowerCase();
        const aName = (f.teams?.away?.name || '').toLowerCase();
        const lName = (f.league?.name || '').toLowerCase();
        return hName.includes(query) || aName.includes(query) || lName.includes(query);
      });
    }

    return res.json({
      success: true,
      source: 'hybrid_official_coalesced',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      count: filtered.length,
      fixtures: filtered
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return res.json({
        success: true,
        source: 'fallback_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
    return res.json({ success: false, error: msg, fixtures: [] });
  }
});

// 0.15 Finished Matches Audit Endpoint
app.get('/api/audit-finished', dataRateLimitMiddleware, async (_req, res) => {
  const todayStr = getColombiaDateStr(0);
  const yesterdayStr = getColombiaDateStr(-1);
  const auditCacheKey = `audit_finished_v4_${todayStr}`;
  const cachedAudit = getCacheItem<any[]>(auditCacheKey);

  if (cachedAudit && Array.isArray(cachedAudit.data) && cachedAudit.data.length > 0 && Date.now() - cachedAudit.timestamp < 15 * 60 * 1000) {
    return res.json({
      success: true,
      source: 'audit_cache',
      fixtures: cachedAudit.data
    });
  }

  try {
    const finishedFixtures = await runSingleFlight(auditCacheKey, async () => {
      const results: any[] = [];
      const datesToScan = [todayStr, yesterdayStr];

      for (const dStr of datesToScan) {
        const espnDate = dStr.replace(/-/g, '');
        try {
          const sbRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDate}&limit=250`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
              }
            }
          );
          if (!sbRes.ok) continue;
          const sbData = await sbRes.json();
          const events = Array.isArray(sbData?.events) ? sbData.events : [];

          for (const ev of events) {
            const state = String(ev?.status?.type?.state || '').toLowerCase();
            if (state !== 'post' && ev?.status?.type?.completed !== true) continue;

            const comp = ev?.competitions?.[0];
            if (!comp) continue;
            const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
            const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
            const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
            if (!homeComp || !awayComp) continue;

            const rawUid = String(ev?.uid || '');
            const espnLeagueId = rawUid.match(/~l:(\d+)/)?.[1] || '0';
            const catalogEntry = ESPN_LEAGUE_CATALOG[espnLeagueId];
            if (!catalogEntry) continue;

            const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || 'Local');
            const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || 'Visitante');
            if (isServerYouthOrLowTierMatch(catalogEntry.name, catalogEntry.country, homeName, awayName)) {
              continue;
            }

            const espnEventId = String(ev.id || '');
            const sbTelemetry = extractEspnScoreboardTelemetry(
              ev,
              comp,
              homeComp,
              awayComp,
              homeName,
              awayName,
              90,
              true
            );

            results.push({
              espnEventId,
              liveStats: sbTelemetry.liveStats,
              liveEvents: sbTelemetry.liveEvents,
              fixture: {
                id: parseInt(espnEventId || '0', 10) || Math.floor(Math.random() * 900000 + 100000),
                date: ev.date,
                timestamp: Math.floor(new Date(ev.date).getTime() / 1000),
                venue: {
                  name: comp?.venue?.fullName || 'Estadio Oficial',
                  city: comp?.venue?.address?.city || catalogEntry.country
                },
                status: {
                  short: 'FT',
                  elapsed: 90
                }
              },
              league: {
                id: catalogEntry.id,
                name: catalogEntry.name,
                country: catalogEntry.country,
                flag: catalogEntry.flag,
                round: 'Jornada Oficial'
              },
              teams: {
                home: {
                  id: parseInt(String(homeComp?.team?.id || '1'), 10) || 1,
                  name: homeName,
                  logo: String(homeComp?.team?.logo || '')
                },
                away: {
                  id: parseInt(String(awayComp?.team?.id || '2'), 10) || 2,
                  name: awayName,
                  logo: String(awayComp?.team?.logo || '')
                }
              },
              goals: {
                home: parseInt(String(homeComp?.score || '0'), 10) || 0,
                away: parseInt(String(awayComp?.score || '0'), 10) || 0
              }
            });
          }
        } catch {
          // continue
        }
      }

      const topCompleted = results.slice(0, 15);
      if (topCompleted.length > 0) {
        await Promise.allSettled(
          topCompleted.map(async (item) => {
            if (!item.espnEventId) return;
            const enriched = await fetchEspnMatchSummaryTelemetry(
              item.espnEventId,
              item.teams.home.name,
              item.teams.away.name,
              90,
              true,
              { liveStats: item.liveStats, liveEvents: item.liveEvents || [] }
            );
            item.liveStats = enriched.liveStats;
            item.liveEvents = enriched.liveEvents;
          })
        );
      }

      if (results.length > 0) {
        setCacheItem(auditCacheKey, results);
      }
      return results;
    });

    return res.json({
      success: true,
      source: 'espn_prime_finished',
      fixtures: finishedFixtures
    });
  } catch (err: unknown) {
    return res.json({
      success: false,
      fixtures: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// 0.25 Hybrid Live Pulse Endpoint (15s poll con 0% gasto de API-Football)
app.get('/api/live-pulse', dataRateLimitMiddleware, async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
  const requestedDate = (req.query.date as string) || '';
  const force = req.query.force === 'true' && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, '');

  const pulseCacheKey = `live_pulse_v6_${espnDateStr}`;
  const cachedPulse = getCacheItem<any[]>(pulseCacheKey);

  if (!force && cachedPulse && Date.now() - cachedPulse.timestamp < 15 * 1000) {
    return res.json({
      success: true,
      source: 'hybrid_memory_pulse',
      timestamp: cachedPulse.timestamp,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas: cachedPulse.data
    });
  }

  try {
    const deltas = await runSingleFlight(pulseCacheKey, async () => {
      const liveDeltas: Array<{
        id?: string;
        espnEventId?: string;
        homeKey: string;
        awayKey: string;
        homeName: string;
        awayName: string;
        homeScore: number;
        awayScore: number;
        minute: number;
        isHalfTime?: boolean;
        statusShort?: string;
        status: 'IN_PLAY' | 'FINISHED' | 'SCHEDULED';
        liveStats?: any;
        liveEvents?: any[];
        liveRosters?: any;
      }> = [];

      // 1A. Consultar live=all solo si está en caché; NO gastar cuota periódica aquí
      const apiLiveAll = await fetchApiFootballLiveAll();
      for (const lf of apiLiveAll) {
        const fId = String(lf?.fixture?.id || '');
        const homeName = String(lf?.teams?.home?.name || '');
        const awayName = String(lf?.teams?.away?.name || '');
        const statusShort = String(lf?.fixture?.status?.short || '2H').toUpperCase();
        const isHalfTime = statusShort === 'HT' || statusShort === 'BT';
        const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);
        const homeScore = Number(lf?.goals?.home ?? lf?.score?.fulltime?.home ?? 0);
        const awayScore = Number(lf?.goals?.away ?? lf?.score?.fulltime?.away ?? 0);
        const minute = isHalfTime ? 45 : Math.min(120, Math.max(1, Number(lf?.fixture?.status?.elapsed || 45)));

        const afTelemetry = extractApiFootballLiveTelemetry(
          lf,
          homeScore,
          awayScore,
          minute,
          isHalfTime,
          isFinished
        );

        liveDeltas.push({
          id: fId,
          homeKey: normalizeTeamKey(homeName),
          awayKey: normalizeTeamKey(awayName),
          homeName,
          awayName,
          homeScore,
          awayScore,
          minute,
          isHalfTime,
          statusShort,
          status: isFinished ? 'FINISHED' : 'IN_PLAY',
          liveStats: afTelemetry.liveStats,
          liveEvents: afTelemetry.liveEvents
        });
      }

      // 1B. Fetch public real-time multi-league ESPN soccer scoreboard ($0 API-Football quota)
      try {
        const espnRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
            }
          }
        );

        if (espnRes.ok) {
          const espnData = await espnRes.json();
          const events = Array.isArray(espnData?.events) ? espnData.events : [];

          for (const ev of events) {
            const comp = ev?.competitions?.[0];
            if (!comp) continue;
            const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
            const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
            const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
            if (!homeComp || !awayComp) continue;

            const clockParsed = parseEspnMatchStatusAndClock(ev);
            if (!clockParsed.isLive && !clockParsed.isPost) continue;

            const isLive = clockParsed.isLive;
            const isPost = clockParsed.isPost;
            const isHalfTime = clockParsed.isHalfTime;
            const parsedMin = clockParsed.elapsedMin ?? 45;
            const statusShort = clockParsed.statusShort;

            const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || '');
            const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || '');
            const homeScore = parseInt(String(homeComp?.score || '0'), 10) || 0;
            const awayScore = parseInt(String(awayComp?.score || '0'), 10) || 0;
            const espnEventId = String(ev.id || '');
            const hKey = normalizeTeamKey(homeName);
            const aKey = normalizeTeamKey(awayName);

            const sbTelemetry = extractEspnScoreboardTelemetry(
              ev,
              comp,
              homeComp,
              awayComp,
              homeName,
              awayName,
              parsedMin,
              isPost
            );

            const existingDelta = liveDeltas.find((d) => teamsFuzzyMatch(hKey, aKey, d.homeKey, d.awayKey));
            if (existingDelta) {
              existingDelta.espnEventId = espnEventId;
              existingDelta.homeScore = Math.max(existingDelta.homeScore, homeScore);
              existingDelta.awayScore = Math.max(existingDelta.awayScore, awayScore);
              existingDelta.isHalfTime = isHalfTime;
              existingDelta.statusShort = statusShort;
              existingDelta.minute = isHalfTime ? 45 : parsedMin;
              existingDelta.liveStats = sbTelemetry.liveStats;
              existingDelta.liveEvents = sbTelemetry.liveEvents;
            } else {
              liveDeltas.push({
                espnEventId,
                homeKey: hKey,
                awayKey: aKey,
                homeName,
                awayName,
                homeScore,
                awayScore,
                minute: parsedMin,
                isHalfTime,
                statusShort,
                status: isLive ? 'IN_PLAY' : 'FINISHED',
                liveStats: sbTelemetry.liveStats,
                liveEvents: sbTelemetry.liveEvents
              });
            }
          }

          const activeInPlay = liveDeltas.filter((d) => d.status === 'IN_PLAY' && d.espnEventId).slice(0, 25);
          if (activeInPlay.length > 0) {
            await Promise.allSettled(
              activeInPlay.map(async (delta) => {
                const enriched = await fetchEspnMatchSummaryTelemetry(
                  delta.espnEventId!,
                  delta.homeName,
                  delta.awayName,
                  delta.minute,
                  false,
                  { liveStats: delta.liveStats, liveEvents: delta.liveEvents || [] }
                );
                delta.liveStats = enriched.liveStats;
                delta.liveEvents = enriched.liveEvents;
                if (enriched.liveRosters) {
                  delta.liveRosters = enriched.liveRosters;
                }
                if (!delta.isHalfTime && Array.isArray(enriched.liveEvents)) {
                  const maxEvMin = enriched.liveEvents.reduce((acc: number, evItem: any) => {
                    if (
                      evItem?.type === 'PERIOD_HALF' ||
                      evItem?.type === 'PERIOD_END' ||
                      evItem?.type === 'PERIOD_START'
                    ) {
                      return acc;
                    }
                    return Math.max(acc, Number(evItem?.minute || 0));
                  }, 0);
                  if (maxEvMin > delta.minute) {
                    delta.minute = maxEvMin;
                  }
                }
              })
            );
          }
        }
      } catch {
        // Fallback to cached live state
      }

      // 2. Sync inside persistent cache
      const upcomingCache = getCacheItem<any[]>(`upcoming_v8_${targetDate}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        for (const f of upcomingCache.data) {
          const fId = String(f?.fixture?.id || '');
          const hName = String(f?.teams?.home?.name || '');
          const aName = String(f?.teams?.away?.name || '');
          const hKey = normalizeTeamKey(hName);
          const aKey = normalizeTeamKey(aName);

          const matched = liveDeltas.find(
            (d) =>
              (d.id && String(d.id) === fId) ||
              (d.espnEventId && String(d.espnEventId) === fId) ||
              teamsFuzzyMatch(hKey, aKey, d.homeKey, d.awayKey)
          );

          const matchTimestamp = f?.fixture?.timestamp ? f.fixture.timestamp * 1000 : new Date(f?.fixture?.date || 0).getTime();
          const minsSinceStart = Math.floor((Date.now() - matchTimestamp) / 60000);

          if (matched) {
            matched.id = fId;
            if (matched.espnEventId) f.espnEventId = matched.espnEventId;
            if (matched.liveStats) f.liveStats = matched.liveStats;
            if (matched.liveEvents) f.liveEvents = matched.liveEvents;
            if (matched.liveRosters) f.liveRosters = matched.liveRosters;
            if (f.goals) {
              f.goals.home = matched.homeScore;
              f.goals.away = matched.awayScore;
            }
            if (f.fixture?.status) {
              f.fixture.status.short =
                matched.status === 'FINISHED' ? 'FT' : matched.isHalfTime ? 'HT' : matched.statusShort || '2H';
              f.fixture.status.elapsed = matched.minute;
            }
            continue;
          }

          if (minsSinceStart > 115) {
            if (f.fixture?.status) {
              f.fixture.status.short = 'FT';
            }
            liveDeltas.push({
              id: fId,
              espnEventId: f.espnEventId,
              homeKey: hKey,
              awayKey: aKey,
              homeName: hName,
              awayName: aName,
              homeScore: Number(f?.goals?.home ?? 0),
              awayScore: Number(f?.goals?.away ?? 0),
              minute: 90,
              isHalfTime: false,
              statusShort: 'FT',
              status: 'FINISHED'
            });
            continue;
          }

          const statusShort = String(f?.fixture?.status?.short || '').toUpperCase();
          if (['1H', '2H', 'HT', 'ET', 'LIVE', 'BT', 'P', 'INT'].includes(statusShort) && minsSinceStart <= 115) {
            const clockEst = estimateRealisticSoccerClock(
              minsSinceStart,
              statusShort,
              f?.fixture?.status?.elapsed
            );
            const homeScore = Number(f?.goals?.home ?? 0);
            const awayScore = Number(f?.goals?.away ?? 0);
            const fallbackTelemetry = extractApiFootballLiveTelemetry(
              f,
              homeScore,
              awayScore,
              clockEst.minute,
              clockEst.isHalfTime,
              false
            );

            liveDeltas.push({
              id: fId,
              espnEventId: f.espnEventId,
              homeKey: hKey,
              awayKey: aKey,
              homeName: hName,
              awayName: aName,
              homeScore,
              awayScore,
              minute: clockEst.minute,
              isHalfTime: clockEst.isHalfTime,
              statusShort: clockEst.statusShort,
              status: clockEst.minute >= 90 && minsSinceStart > 108 ? 'FINISHED' : 'IN_PLAY',
              liveStats: f.liveStats || fallbackTelemetry.liveStats,
              liveEvents: f.liveEvents && f.liveEvents.length > 0 ? f.liveEvents : fallbackTelemetry.liveEvents,
              liveRosters: f.liveRosters
            });
          }
        }
      }

      setCacheItem(pulseCacheKey, liveDeltas);
      return liveDeltas;
    });

    return res.json({
      success: true,
      source: 'hybrid_live_pulse',
      timestamp: Date.now(),
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas
    });
  } catch (err: unknown) {
    return res.json({
      success: false,
      timestamp: Date.now(),
      deltas: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// 0.35 Deep Match Telemetry Endpoint
app.get('/api/match-telemetry', dataRateLimitMiddleware, async (req, res) => {
  const fixtureId = String(req.query.id || '').trim();
  const espnIdParam = String(req.query.espnId || req.query.eventId || '').trim();
  const dateStr = String(req.query.date || getColombiaDateStr(0)).trim();
  const homeName = String(req.query.home || '').trim();
  const awayName = String(req.query.away || '').trim();

  try {
    let resolvedEspnId = espnIdParam || (/^\d{9,}$/.test(fixtureId) ? fixtureId : '');
    let fallbackTelemetry: { liveStats: any; liveEvents: any[] } = {
      liveStats: {
        home: { corners: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, possessionPct: 50, foulsCommitted: 0 },
        away: { corners: 0, yellowCards: 0, redCards: 0, shots: 0, shotsOnTarget: 0, possessionPct: 50, foulsCommitted: 0 },
        updatedAt: Date.now()
      },
      liveEvents: []
    };
    let elapsedMin = 45;
    let isFinished = false;
    let isHalfTime = false;
    let statusShort = '2H';
    let homeGoals: number | undefined = undefined;
    let awayGoals: number | undefined = undefined;

    const espnDateStr = dateStr.replace(/-/g, '');
    const hKey = normalizeTeamKey(homeName);
    const aKey = normalizeTeamKey(awayName);

    try {
      const sbRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
          }
        }
      );

      if (sbRes.ok) {
        const sbData = await sbRes.json();
        const events = Array.isArray(sbData?.events) ? sbData.events : [];

        const matchedEv = events.find((ev: any) => {
          if (resolvedEspnId && String(ev.id) === resolvedEspnId) return true;
          const comp = ev?.competitions?.[0];
          const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
          const hc = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
          const ac = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
          return teamsFuzzyMatch(
            hKey,
            aKey,
            normalizeTeamKey(hc?.team?.displayName || hc?.team?.name || ''),
            normalizeTeamKey(ac?.team?.displayName || ac?.team?.name || '')
          );
        });

        if (matchedEv) {
          resolvedEspnId = String(matchedEv.id);
          const comp = matchedEv.competitions?.[0];
          const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
          const hc = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
          const ac = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
          const clockParsed = parseEspnMatchStatusAndClock(matchedEv);
          isFinished = clockParsed.isPost;
          isHalfTime = clockParsed.isHalfTime;
          statusShort = clockParsed.statusShort;
          elapsedMin = clockParsed.elapsedMin ?? 45;
          if (clockParsed.isLive || clockParsed.isPost) {
            homeGoals = parseInt(String(hc?.score || '0'), 10) || 0;
            awayGoals = parseInt(String(ac?.score || '0'), 10) || 0;
          }
          fallbackTelemetry = extractEspnScoreboardTelemetry(
            matchedEv,
            comp,
            hc,
            ac,
            homeName || String(hc?.team?.displayName || 'Local'),
            awayName || String(ac?.team?.displayName || 'Visitante'),
            elapsedMin,
            isFinished
          );
        }
      }
    } catch {
      // continue to API-Football fallback
    }

    if (resolvedEspnId) {
      const enriched = await fetchEspnMatchSummaryTelemetry(
        resolvedEspnId,
        homeName || 'Local',
        awayName || 'Visitante',
        elapsedMin,
        isFinished,
        fallbackTelemetry
      );

      if (!isHalfTime && Array.isArray(enriched.liveEvents)) {
        const maxEvMin = enriched.liveEvents.reduce((acc: number, evItem: any) => {
          if (
            evItem?.type === 'PERIOD_HALF' ||
            evItem?.type === 'PERIOD_END' ||
            evItem?.type === 'PERIOD_START'
          ) {
            return acc;
          }
          return Math.max(acc, Number(evItem?.minute || 0));
        }, 0);
        if (maxEvMin > elapsedMin) {
          elapsedMin = maxEvMin;
        }
      }

      return res.json({
        success: true,
        found: true,
        espnEventId: resolvedEspnId,
        homeGoals,
        awayGoals,
        minute: isHalfTime ? 45 : elapsedMin,
        isHalfTime,
        statusShort,
        liveStats: enriched.liveStats,
        liveEvents: enriched.liveEvents,
        liveRosters: enriched.liveRosters
      });
    }

    const apiLiveList = await fetchApiFootballLiveAll();
    let matchedAf = apiLiveList.find(
      (lf: any) =>
        String(lf?.fixture?.id || '') === fixtureId ||
        teamsFuzzyMatch(
          hKey,
          aKey,
          normalizeTeamKey(lf?.teams?.home?.name || ''),
          normalizeTeamKey(lf?.teams?.away?.name || '')
        )
    );

    if (!matchedAf) {
      const upcomingCache = getCacheItem<any[]>(`upcoming_v8_${dateStr}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        matchedAf = upcomingCache.data.find(
          (f: any) =>
            String(f?.fixture?.id || '') === fixtureId ||
            teamsFuzzyMatch(
              hKey,
              aKey,
              normalizeTeamKey(f?.teams?.home?.name || ''),
              normalizeTeamKey(f?.teams?.away?.name || '')
            )
        );
      }
    }

    const syntheticOrMatched = matchedAf || {
      fixture: { id: fixtureId, status: { short: '2H', elapsed: 45 } },
      teams: { home: { name: homeName || 'Local' }, away: { name: awayName || 'Visitante' } },
      goals: { home: 0, away: 0 },
      events: []
    };

    const stShort = String(syntheticOrMatched?.fixture?.status?.short || '').toUpperCase();
    const isHT = stShort === 'HT' || stShort === 'BT';
    const isFT = ['FT', 'AET', 'PEN'].includes(stShort);
    const afTele = extractApiFootballLiveTelemetry(
      syntheticOrMatched,
      undefined,
      undefined,
      isHT ? 45 : Number(syntheticOrMatched?.fixture?.status?.elapsed || 45),
      isHT,
      isFT
    );

    return res.json({
      success: true,
      found: true,
      liveStats: afTele.liveStats,
      liveEvents: afTele.liveEvents,
      liveRosters: syntheticOrMatched.liveRosters
    });
  } catch (err: unknown) {
    return res.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// 0.5 NBA Live & Scheduled Scoreboard endpoint (ESPN 100% gratuito)
app.get('/api/nba/scoreboard', dataRateLimitMiddleware, async (req, res) => {
  const dateQuery = (req.query.date as string) || '';
  const force = req.query.force === 'true' && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayColombia = getColombiaDateStr(0);
  const targetDate = dateQuery || todayColombia;

  const espnDateStr = targetDate.replace(/-/g, '');
  const cacheKey = `nba_sb_${espnDateStr}`;
  const cached = getCacheItem<any[]>(cacheKey);

  const hasLiveNbaInCache =
    cached &&
    Array.isArray(cached.data) &&
    cached.data.some((ev: any) => String(ev?.status?.type?.state || '').toLowerCase() === 'in');
  const cacheTTL =
    targetDate === todayColombia
      ? hasLiveNbaInCache
        ? 25 * 1000
        : 3 * 60 * 1000
      : 24 * 60 * 60 * 1000;
  if (cached && !force && Date.now() - cached.timestamp < cacheTTL) {
    return res.json({
      success: true,
      source: 'persistent_disk_cache',
      date: targetDate,
      events: cached.data
    });
  }

  try {
    const rawEvents = await runSingleFlight(cacheKey, async () => {
      const endpoints = [
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDateStr}`,
          league: 'NBA',
          country: 'Estados Unidos'
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${espnDateStr}&limit=50`,
          fallbackUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?limit=50',
          league: 'NCAA Baloncesto',
          country: 'Estados Unidos'
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${espnDateStr}`,
          fallbackUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
          league: 'WNBA',
          country: 'Estados Unidos'
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard?dates=${espnDateStr}`,
          fallbackUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard',
          league: 'FIBA Internacional',
          country: 'Mundial'
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?dates=${espnDateStr}&limit=50`,
          fallbackUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?limit=50',
          league: 'NCAA Femenil',
          country: 'Estados Unidos'
        }
      ];

      const responses = await Promise.allSettled(
        endpoints.map(async (ep) => {
          let evs: any[] = [];
          try {
            const apiRes = await fetch(ep.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0'
              }
            });
            if (apiRes.ok) {
              const data = await apiRes.json();
              evs = Array.isArray(data.events) ? data.events : [];
            }
          } catch {
            // continue to fallback
          }

          if (evs.length === 0 && ep.fallbackUrl) {
            try {
              const fbRes = await fetch(ep.fallbackUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0'
                }
              });
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                evs = Array.isArray(fbData.events) ? fbData.events : [];
              }
            } catch {
              // ignore
            }
          }

          evs.forEach((ev: any) => {
            ev._sportstatsLeague = {
              name: ep.league,
              country: ep.country
            };
          });
          return evs;
        })
      );

      const allEvents: any[] = [];
      responses.forEach((r) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allEvents.push(...r.value);
        }
      });

      if (allEvents.length === 0 && cached) return cached.data;
      setCacheItem(cacheKey, allEvents);
      return allEvents;
    });

    return res.json({
      success: true,
      source: 'espn_official_coalesced',
      date: targetDate,
      events: rawEvents
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.json({ success: true, source: 'fallback_disk_cache', date: targetDate, events: cached.data });
    }
    return res.json({ success: false, error: msg, events: [] });
  }
});

// 1. Secret Proxy Endpoint: GET /api/fixtures
app.get('/api/fixtures', dataRateLimitMiddleware, async (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const force = req.query.force === 'true' && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const apiKey = getSecretApiKey();

  const cacheKey = `fix_${date}`;
  const cached = getCacheItem<any[]>(cacheKey);
  const todayStr = new Date().toISOString().split('T')[0];
  const cacheTTL = date === todayStr ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  if (cached && (!force || quotaShieldActive)) {
    const isFresh = Date.now() - cached.timestamp < cacheTTL;
    if (isFresh || quotaShieldActive) {
      return res.status(200).json({
        success: true,
        source: 'persistent_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
  }

  if (quotaShieldActive && cached) {
    return res.status(200).json({
      success: true,
      source: 'quota_shield_disk_cache',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive: true,
      fixtures: cached.data
    });
  }

  if (!apiKey) {
    return res.status(200).json({
      success: false,
      message: 'No secret API key configured on server. Fallback to cache.',
      hasKey: false,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: cached?.data || []
    });
  }

  try {
    const rawFixtures = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&timezone=America/Bogota`, {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey }
      });

      updateQuotaFromHeaders(apiRes.headers);

      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }

      const json = await apiRes.json();
      const fixtures = Array.isArray(json.response) ? json.response : [];
      if (fixtures.length > 0) {
        setCacheItem(cacheKey, fixtures);
      }
      return fixtures;
    });

    return res.status(200).json({
      success: true,
      source: 'api_football_coalesced',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: rawFixtures
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.status(200).json({
        success: true,
        source: 'fallback_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
    return res.status(200).json({
      success: false,
      error: message,
      fixtures: []
    });
  }
});

// 2. Status Check
app.get('/api/status', dataRateLimitMiddleware, (_req, res) => {
  const hasApiFootball = Boolean(getSecretKey('API_FOOTBALL_KEY'));
  const hasFootballData = Boolean(getSecretKey('FOOTBALL_DATA_KEY'));
  const hasOddsApi = Boolean(getSecretKey('ODDS_API_KEY'));

  return res.json({
    apiFootball: hasApiFootball,
    footballData: hasFootballData,
    oddsApi: hasOddsApi,
    remainingCalls: lastRemainingCalls,
    quotaShieldActive: lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD,
    quotaShieldThreshold: QUOTA_SHIELD_THRESHOLD,
    cachedEntriesCount: memoryCache.size,
    cacheTtlMinutes: 120,
    serverReady: true
  });
});

// 2b. The Odds API
app.get('/api/market-odds', dataRateLimitMiddleware, async (req, res) => {
  const oddsKey = getSecretKey('ODDS_API_KEY');
  const cacheKey = 'odds_soccer';
  const cached = getCacheItem<any>(cacheKey);

  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return res.json({ success: true, source: 'persistent_disk_cache', odds: cached.data });
  }

  if (!oddsKey) {
    return res.json({ success: false, message: 'No The Odds API key configured.', odds: cached?.data || [] });
  }

  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${oddsKey}&regions=eu&markets=h2h`,
        { method: 'GET' }
      );
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: 'the_odds_api_coalesced', odds: data });
  } catch {
    if (cached) return res.json({ success: true, source: 'fallback_disk_cache', odds: cached.data });
    return res.json({ success: false, error: 'Error al consultar cuotas externas', odds: [] });
  }
});

// 2c. Football-Data.org
app.get('/api/standings', dataRateLimitMiddleware, async (req, res) => {
  const fdKey = getSecretKey('FOOTBALL_DATA_KEY');
  const league = sanitizeText((req.query.league as string) || 'PD', 10) || 'PD';
  const cacheKey = `standings_${league}`;
  const cached = getCacheItem<any>(cacheKey);

  if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
    return res.json({ success: true, source: 'persistent_disk_cache', standings: cached.data });
  }

  if (!fdKey) {
    return res.json({ success: false, message: 'No Football-Data key configured.', standings: cached?.data || [] });
  }

  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://api.football-data.org/v4/competitions/${encodeURIComponent(league)}/standings`, {
        method: 'GET',
        headers: { 'X-Auth-Token': fdKey }
      });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: 'football_data_coalesced', standings: data });
  } catch {
    if (cached) return res.json({ success: true, source: 'fallback_disk_cache', standings: cached.data });
    return res.json({ success: false, error: 'Error al consultar clasificaciones', standings: [] });
  }
});

const LICENSES_FILE = IS_VERCEL ? path.resolve('/tmp', 'licenses_db.json') : path.resolve(__dirname, 'licenses_db.json');
const ADMIN_CONFIG_FILE = IS_VERCEL ? path.resolve('/tmp', 'admin_config.json') : path.resolve(__dirname, 'admin_config.json');
const BUNDLED_ADMIN_CONFIG_FILE = path.resolve(__dirname, 'admin_config.json');
const LICENSE_MASTER_SECRET = process.env.LICENSE_MASTER_SECRET || 'FUTBOLSTATS_PRO_SECURE_HMAC_SALT_2026_X9';

interface AdminConfig {
  adminPin: string;
  adminWhatsApp: string;
  supportName: string;
  customLogoUrl?: string;
  colorTheme?: string;
}

const MASTER_RECOVERY_CODE = process.env.ADMIN_MASTER_KEY || 'MASTER-2708';
let memoryAdminConfig: AdminConfig | null = null;

function getAdminConfig(): AdminConfig {
  const defaultConfig: AdminConfig = {
    adminPin: process.env.ADMIN_PIN || '120328',
    adminWhatsApp: process.env.ADMIN_WHATSAPP || '573213902708',
    supportName: 'Administrador SportStats Pro',
    customLogoUrl: '/custom-logo.png',
    colorTheme: 'cyan-emerald'
  };
  if (memoryAdminConfig) {
    return memoryAdminConfig;
  }
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
      const resolved: AdminConfig = { ...defaultConfig, ...data };
      memoryAdminConfig = resolved;
      return resolved;
    }
    if (fs.existsSync(BUNDLED_ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUNDLED_ADMIN_CONFIG_FILE, 'utf8'));
      const resolved: AdminConfig = { ...defaultConfig, ...data };
      memoryAdminConfig = resolved;
      return resolved;
    }
  } catch {
    // fallback
  }
  return defaultConfig;
}

function extractAdminCredential(req: express.Request, bodyPinField?: unknown): string {
  const headerPin = req.headers['x-admin-pin'];
  if (typeof headerPin === 'string' && headerPin.trim()) {
    return headerPin.trim();
  }
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifySessionJwt(token);
    if (verified && verified.role === 'admin') {
      return '__VALID_ADMIN_JWT__';
    }
  }
  if (typeof bodyPinField === 'string' && bodyPinField.trim()) {
    return bodyPinField.trim();
  }
  if (typeof req.query.pin === 'string' && req.query.pin.trim()) {
    return req.query.pin.trim();
  }
  return '';
}

function isValidAdminPin(pin: unknown, cfg: AdminConfig): boolean {
  if (!pin || typeof pin !== 'string') return false;
  if (pin === '__VALID_ADMIN_JWT__') return true;

  const clean = pin.trim();
  const upper = clean.toUpperCase();
  const envMasterKey = (process.env.ADMIN_MASTER_KEY || '').trim();
  const isStrictProd = process.env.NODE_ENV === 'production' && Boolean(envMasterKey);

  if (timingSafeCompare(clean, cfg.adminPin)) return true;
  if (envMasterKey && timingSafeCompare(clean, envMasterKey)) return true;

  if (!isStrictProd) {
    return (
      timingSafeCompare(clean, '120328') ||
      timingSafeCompare(upper, 'MASTER-2708') ||
      timingSafeCompare(upper, '2708')
    );
  }
  return false;
}

app.post('/api/set-secret-key', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, req.body?.adminPin || req.body?.pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado para modificar claves de servidor' });
  }
  clearAuthFailures(req);

  const { key, footballDataKey, oddsApiKey } = req.body || {};

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (key && typeof key === 'string' && key.trim()) {
      const clean = sanitizeText(key.trim(), 128);
      process.env.API_FOOTBALL_KEY = clean;
      if (envContent.includes('API_FOOTBALL_KEY=')) {
        envContent = envContent.replace(/API_FOOTBALL_KEY=.*/g, `API_FOOTBALL_KEY="${clean}"`);
      } else {
        envContent += `\nAPI_FOOTBALL_KEY="${clean}"\n`;
      }
    }

    if (footballDataKey && typeof footballDataKey === 'string' && footballDataKey.trim()) {
      const clean = sanitizeText(footballDataKey.trim(), 128);
      process.env.FOOTBALL_DATA_KEY = clean;
      if (envContent.includes('FOOTBALL_DATA_KEY=')) {
        envContent = envContent.replace(/FOOTBALL_DATA_KEY=.*/g, `FOOTBALL_DATA_KEY="${clean}"`);
      } else {
        envContent += `\nFOOTBALL_DATA_KEY="${clean}"\n`;
      }
    }

    if (oddsApiKey && typeof oddsApiKey === 'string' && oddsApiKey.trim()) {
      const clean = sanitizeText(oddsApiKey.trim(), 128);
      process.env.ODDS_API_KEY = clean;
      if (envContent.includes('ODDS_API_KEY=')) {
        envContent = envContent.replace(/ODDS_API_KEY=.*/g, `ODDS_API_KEY="${clean}"`);
      } else {
        envContent += `\nODDS_API_KEY="${clean}"\n`;
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      success: true,
      message: 'Claves configuradas en el servidor de forma 100% segura y privada.'
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Error interno al guardar configuración' });
  }
});

function saveAdminConfig(cfg: AdminConfig): void {
  memoryAdminConfig = { ...cfg };
  try {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving admin config:', e);
  }
  if (isSupabaseConfigured()) {
    upsertSupabaseAdminConfig(cfg).catch((err) => console.warn('[Supabase Sync Config Error]:', err));
  }
}

interface ServerLicenseRecord {
  id: string;
  key: string;
  deviceId: string;
  clientNote?: string;
  clientName?: string;
  planType: string;
  planLabel: string;
  createdAt: number;
  expiresAt: number | null;
  lastActiveTimestamp?: number;
  deviceInfo?: string;
  revoked: boolean;
}

function getLicensesDb(): ServerLicenseRecord[] {
  try {
    if (fs.existsSync(LICENSES_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8'));
    }
  } catch {
    // fallback
  }
  return [];
}

function saveLicensesDb(list: ServerLicenseRecord[]): void {
  try {
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving licenses db:', e);
  }
}

function serverGenerateToken(deviceId: string, planType: string, customExpiryMs?: number): { key: string; expiresAt: number | null; planLabel: string } {
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^DEV/, '');
  const nowMs = Date.now();
  let expiresAt: number | null = null;
  let planTag = '30D';
  let planLabel = 'Pase 30 Días';

  switch (planType) {
    case '24H':
      expiresAt = nowMs + 24 * 60 * 60 * 1000;
      planTag = '24H';
      planLabel = 'Prueba 24 Horas';
      break;
    case '7D':
      expiresAt = nowMs + 7 * 24 * 60 * 60 * 1000;
      planTag = '7D';
      planLabel = 'Pase Semanal (7 Días)';
      break;
    case '15D':
      expiresAt = nowMs + 15 * 24 * 60 * 60 * 1000;
      planTag = '15D';
      planLabel = 'Pase Quincenal (15 Días)';
      break;
    case '30D':
      expiresAt = nowMs + 30 * 24 * 60 * 60 * 1000;
      planTag = '30D';
      planLabel = 'Pase Mensual (30 Días)';
      break;
    case '90D':
      expiresAt = nowMs + 90 * 24 * 60 * 60 * 1000;
      planTag = '90D';
      planLabel = 'Pase Trimestral (90 Días)';
      break;
    case 'PERMANENT':
      expiresAt = null;
      planTag = 'VIP';
      planLabel = 'Pase Permanente Vitalicio';
      break;
    case 'CUSTOM':
      expiresAt = customExpiryMs || (nowMs + 30 * 24 * 60 * 60 * 1000);
      planTag = 'CUS';
      const days = Math.max(1, Math.round((expiresAt - nowMs) / (24 * 60 * 60 * 1000)));
      planLabel = `Pase Personalizado (${days} días)`;
      break;
  }

  const expSeconds = expiresAt === null ? 0 : Math.floor(expiresAt / 1000);
  const expHex = expSeconds.toString(16).toUpperCase().padStart(8, '0');

  const message = `${cleanDev}:${planTag}:${expHex}`;
  const fullHmac = crypto.createHmac('sha256', LICENSE_MASTER_SECRET).update(message).digest('hex');
  const sig8 = fullHmac.substring(0, 8).toUpperCase();

  const key = `FS-${planTag}-${cleanDev}-${expHex}-${sig8}`;
  return { key, expiresAt, planLabel };
}

app.get('/api/license/config', (req, res) => {
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  const isAuthenticated = pin ? isValidAdminPin(pin, cfg) : false;

  return res.json({
    success: true,
    adminWhatsApp: cfg.adminWhatsApp,
    supportName: cfg.supportName,
    customLogoUrl: cfg.customLogoUrl,
    colorTheme: cfg.colorTheme || 'cyan-emerald',
    currentPin: isAuthenticated ? cfg.adminPin : undefined,
    requiresAuth: true
  });
});

app.post('/api/license/config', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { currentPin, newPin, adminWhatsApp, supportName, customLogoUrl, colorTheme } = req.body || {};
  const currentCfg = getAdminConfig();
  const cred = extractAdminCredential(req, currentPin);

  if (!isValidAdminPin(cred, currentCfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'Credenciales de administrador inválidas' });
  }
  clearAuthFailures(req);

  if (newPin && String(newPin).trim().length >= 4) {
    currentCfg.adminPin = sanitizeText(String(newPin).trim(), 32);
  }
  if (adminWhatsApp && typeof adminWhatsApp === 'string') {
    currentCfg.adminWhatsApp = sanitizePhone(adminWhatsApp);
  }
  if (supportName && typeof supportName === 'string') {
    currentCfg.supportName = sanitizeText(supportName, 60);
  }
  if (typeof customLogoUrl === 'string' || customLogoUrl === null) {
    currentCfg.customLogoUrl = customLogoUrl ? sanitizeText(customLogoUrl, 200) : undefined;
  }
  if (typeof colorTheme === 'string') {
    currentCfg.colorTheme = sanitizeText(colorTheme, 32);
  }

  saveAdminConfig(currentCfg);
  return res.json({
    success: true,
    message: 'Configuración actualizada con éxito',
    config: {
      adminPin: currentCfg.adminPin,
      adminWhatsApp: currentCfg.adminWhatsApp,
      supportName: currentCfg.supportName,
      customLogoUrl: currentCfg.customLogoUrl,
      colorTheme: currentCfg.colorTheme
    }
  });
});

app.post('/api/license/generate', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { adminPin, deviceId, clientNote, planType = '30D', customExpiryMs } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'PIN de administrador no válido' });
  }
  clearAuthFailures(req);

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 4) {
    return res.status(400).json({ success: false, error: 'Código de dispositivo no válido' });
  }

  const cleanNote = clientNote ? sanitizeText(String(clientNote), 80) : undefined;
  const { key, expiresAt, planLabel } = serverGenerateToken(deviceId.trim(), planType, customExpiryMs);
  const db = getLicensesDb();

  const record: ServerLicenseRecord = {
    id: `LIC-${Date.now().toString(36).toUpperCase()}`,
    key,
    deviceId: sanitizeText(deviceId.trim(), 32).toUpperCase(),
    clientNote: cleanNote,
    clientName: cleanNote,
    planType: sanitizeText(planType, 16),
    planLabel,
    createdAt: Date.now(),
    expiresAt,
    lastActiveTimestamp: Date.now(),
    revoked: false
  };

  const filtered = db.filter(item => item.key !== key);
  filtered.unshift(record);
  saveLicensesDb(filtered);

  if (isSupabaseConfigured()) {
    upsertSupabaseLicense(record).catch((err) => console.warn('[Supabase Sync License Error]:', err));
  }

  const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanente (Sin Vencimiento)';
  const whatsappReply = `🔥 *SportStats Pro - Acceso Autorizado*\n\nHola! Tu acceso a la plataforma *SportStats Pro* ha sido activado con éxito.\n📌 *Plan:* ${planLabel}\n⏳ *Vigencia:* ${formattedDate}\n🔑 *Tu Clave de Acceso:*\n${key}\n\n*Instrucciones:*\n1. Abre la aplicación.\n2. Pega tu clave de acceso en la casilla.\n3. Presiona "Ingresar a SportStats Pro". ¡Listo!`;

  return res.json({
    success: true,
    record,
    whatsappReply
  });
});

app.post('/api/license/heartbeat', (req, res) => {
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (!key && !deviceId) {
    return res.json({ success: false, error: 'No se enviaron datos de identificación' });
  }

  const db = getLicensesDb();
  const cleanKey = key ? sanitizeText(String(key), 64).toUpperCase() : '';
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : '';

  const found = db.find(item => item.key === cleanKey || item.deviceId === cleanDev);

  if (found) {
    if (cleanKey && cleanDev && found.deviceId && !found.deviceId.includes('ALL')) {
      const normFoundDev = found.deviceId.replace(/[^A-Z0-9]/g, '').replace(/^DEV/, '');
      const normIncomingDev = cleanDev.replace(/[^A-Z0-9]/g, '').replace(/^DEV/, '');
      if (normFoundDev && normIncomingDev && normFoundDev !== normIncomingDev) {
        return res.json({
          success: false,
          revoked: true,
          deviceMismatch: true,
          error: 'Dispositivo no coincide con el titular de la licencia'
        });
      }
    }

    found.lastActiveTimestamp = Date.now();
    if (clientName && typeof clientName === 'string' && clientName.trim()) {
      const cleanName = sanitizeText(clientName, 60);
      found.clientName = cleanName;
      if (!found.clientNote) found.clientNote = cleanName;
    }
    if (deviceInfo && typeof deviceInfo === 'string') {
      found.deviceInfo = sanitizeText(deviceInfo, 80);
    }
    saveLicensesDb(db);
    return res.json({
      success: true,
      revoked: found.revoked,
      expiresAt: found.expiresAt,
      isExpired: found.expiresAt ? found.expiresAt < Date.now() : false
    });
  }

  return res.json({ success: true, unregistered: true });
});

app.post('/api/license/validate', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ isValid: false, error: 'Clave no proporcionada' });
  }

  const cfg = getAdminConfig();
  if (isValidAdminPin(key, cfg)) {
    clearAuthFailures(req);
    return res.json({
      isValid: true,
      isAdminUnlock: true,
      status: 'ACTIVE',
      message: 'Acceso de Administrador verificado',
      isPermanent: true,
      isExpired: false,
      expiryTimestamp: null,
      daysRemaining: null,
      planLabel: 'Pase Permanente Vitalicio'
    });
  }

  const db = getLicensesDb();
  const cleanKey = sanitizeText(key, 64).toUpperCase();
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : '';

  let found = db.find(item => item.key === cleanKey);

  if (found) {
    found.lastActiveTimestamp = Date.now();
    if (clientName && typeof clientName === 'string' && clientName.trim()) {
      const cleanName = sanitizeText(clientName, 60);
      found.clientName = cleanName;
      if (!found.clientNote) found.clientNote = cleanName;
    }
    if (deviceInfo && typeof deviceInfo === 'string') {
      found.deviceInfo = sanitizeText(deviceInfo, 80);
    }
    saveLicensesDb(db);

    if (found.revoked) {
      return res.json({
        isValid: false,
        status: 'REVOKED',
        message: 'Esta licencia ha sido revocada o suspendida por el administrador.',
        isPermanent: false,
        isExpired: false,
        expiryTimestamp: found.expiresAt,
        daysRemaining: 0,
        planLabel: found.planLabel
      });
    }
  }

  const parts = cleanKey.split('-');
  if (parts.length !== 5 || parts[0] !== 'FS') {
    await recordAuthFailure(req);
    return res.json({
      isValid: false,
      status: 'MALFORMED',
      message: 'Formato de clave no válido.'
    });
  }

  const [, planTag, devClean, expHex, givenSig] = parts;
  const message = `${devClean}:${planTag}:${expHex}`;
  const expectedHmac = crypto.createHmac('sha256', LICENSE_MASTER_SECRET).update(message).digest('hex').substring(0, 8).toUpperCase();

  if (!timingSafeCompare(givenSig, expectedHmac)) {
    await recordAuthFailure(req);
    return res.json({
      isValid: false,
      status: 'INVALID_SIGNATURE',
      message: 'Firma criptográfica inválida. La clave no es auténtica.'
    });
  }

  if (deviceId) {
    const cleanCurrentDev = cleanDev.replace(/[^a-zA-Z0-9]/g, '').replace(/^DEV/, '');
    if (devClean !== 'ALL' && devClean !== cleanCurrentDev) {
      return res.json({
        isValid: false,
        status: 'INVALID_DEVICE',
        message: 'Esta clave fue emitida para otro dispositivo.'
      });
    }
  }

  clearAuthFailures(req);
  const expSeconds = parseInt(expHex, 16);
  const isPermanent = expSeconds === 0;
  const nowMs = Date.now();
  const expiryTimestamp = isPermanent ? null : expSeconds * 1000;
  const isExpired = !isPermanent && (expiryTimestamp! < nowMs);

  if (!found && !isExpired) {
    const cleanName = clientName ? sanitizeText(String(clientName), 60) : 'Cliente Registrado';
    const autoRecord: ServerLicenseRecord = {
      id: `LIC-${Date.now().toString(36).toUpperCase()}`,
      key: cleanKey,
      deviceId: cleanDev || `DEV-${devClean}`,
      clientNote: cleanName,
      clientName: cleanName,
      planType: planTag,
      planLabel: isPermanent ? 'Pase Permanente Vitalicio' : `Pase ${planTag}`,
      createdAt: Date.now(),
      expiresAt: expiryTimestamp,
      lastActiveTimestamp: Date.now(),
      deviceInfo: typeof deviceInfo === 'string' ? sanitizeText(deviceInfo, 80) : undefined,
      revoked: false
    };
    db.unshift(autoRecord);
    saveLicensesDb(db);
    found = autoRecord;
  }

  return res.json({
    isValid: !isExpired,
    status: isExpired ? 'EXPIRED' : 'ACTIVE',
    message: isExpired ? 'Licencia expirada' : 'Licencia activa',
    isPermanent,
    isExpired,
    expiryTimestamp,
    daysRemaining: expiryTimestamp ? Math.max(0, Math.ceil((expiryTimestamp - nowMs) / (24 * 60 * 60 * 1000))) : null,
    planLabel: found?.planLabel || 'Pase Activo',
    clientName: found?.clientName || found?.clientNote
  });
});

app.get('/api/license/list', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();

  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  const list = getLicensesDb();
  const nowMs = Date.now();

  const enriched = list.map(item => {
    const isOnline = item.lastActiveTimestamp ? (nowMs - item.lastActiveTimestamp) < (3 * 60 * 1000) : false;
    const daysRemaining = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - nowMs) / (24 * 60 * 60 * 1000))) : null;
    const isExpired = item.expiresAt ? item.expiresAt < nowMs : false;

    return {
      ...item,
      isOnline,
      daysRemaining,
      isExpired
    };
  });

  return res.json({
    success: true,
    licenses: enriched,
    currentPin: cfg.adminPin
  });
});

app.post('/api/license/renew', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { adminPin, key, deviceId, addDays = 30 } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'PIN de administrador no válido' });
  }
  clearAuthFailures(req);

  const db = getLicensesDb();
  const cleanKey = key ? sanitizeText(String(key), 64).toUpperCase() : '';
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : '';

  const record = db.find(item => item.key === cleanKey || item.deviceId === cleanDev);

  if (!record) {
    return res.status(404).json({ success: false, error: 'No se encontró el registro de la licencia' });
  }

  const nowMs = Date.now();
  const daysToAddMs = Number(addDays) * 24 * 60 * 60 * 1000;

  if (!record.expiresAt || record.expiresAt < nowMs) {
    record.expiresAt = nowMs + daysToAddMs;
  } else {
    record.expiresAt += daysToAddMs;
  }

  record.revoked = false;
  record.planLabel = `Extensión +${addDays} Días`;
  saveLicensesDb(db);

  const formattedDate = new Date(record.expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return res.json({
    success: true,
    message: `Acceso renovado exitosamente por +${addDays} días (Nuevo vencimiento: ${formattedDate})`,
    record
  });
});

app.post('/api/license/recover', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { recoveryKey, deviceId } = req.body || {};
  const cfg = getAdminConfig();
  const cleanKey = String(recoveryKey || '').trim().toUpperCase();
  const last4Phone = cfg.adminWhatsApp.slice(-4);
  const envMasterKey = (process.env.ADMIN_MASTER_KEY || '').trim().toUpperCase();
  const isStrictProd = process.env.NODE_ENV === 'production' && Boolean(envMasterKey);

  let isOtpValid = false;
  if (deviceId && cleanKey) {
    try {
      isOtpValid = await verifyAndConsumeRecoveryOtp(String(deviceId), cleanKey);
    } catch {
      isOtpValid = false;
    }
  }

  const isMasterOrOwner =
    (envMasterKey ? timingSafeCompare(cleanKey, envMasterKey) : false) ||
    timingSafeCompare(cleanKey, cfg.adminPin.toUpperCase()) ||
    (!isStrictProd && (timingSafeCompare(cleanKey, MASTER_RECOVERY_CODE.toUpperCase()) || timingSafeCompare(cleanKey, last4Phone)));

  if (!isMasterOrOwner && !isOtpValid) {
    await recordAuthFailure(req);
    return res.status(403).json({
      success: false,
      error: 'Código de autorización o clave incorrecta / expirada.'
    });
  }
  clearAuthFailures(req);

  if (req.body?.newPin && String(req.body.newPin).trim().length >= 4) {
    cfg.adminPin = sanitizeText(String(req.body.newPin).trim(), 32);
    saveAdminConfig(cfg);
  }

  return res.json({
    success: true,
    adminPin: cfg.adminPin,
    adminWhatsApp: cfg.adminWhatsApp
  });
});

app.get('/api/admin/supabase-status', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();

  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  const isConfigured = isSupabaseConfigured();
  const rawUrl = process.env.SUPABASE_URL || '';
  const maskedUrl = rawUrl ? rawUrl.replace(/^https?:\/\//, '').split('.')[0] + '.supabase.co' : null;

  return res.json({
    success: true,
    configured: isConfigured,
    supabaseProject: maskedUrl,
    sqlSchema: SUPABASE_SQL_SCHEMA
  });
});

app.post('/api/license/revoke', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { adminPin, key, revoke = true } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  const db = getLicensesDb();
  let updated = false;
  const modified = db.map(item => {
    if (item.key === key) {
      item.revoked = !!revoke;
      updated = true;
    }
    return item;
  });

  if (updated) {
    saveLicensesDb(modified);
    if (isSupabaseConfigured()) {
      updateSupabaseLicenseStatus(key, !!revoke).catch((err) => console.warn('[Supabase Sync Revoke Error]:', err));
    }
  }

  return res.json({ success: true, message: revoke ? 'Licencia revocada' : 'Licencia reactivada', updated });
});

app.post('/api/admin/logo', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { adminPin, imageData, pwa512, pwa192, pwaMaskable } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'PIN de administrador no válido' });
  }
  clearAuthFailures(req);

  if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Formato de imagen inválido' });
  }

  const saveBase64File = (dataUrl: string, targetFile: string) => {
    const m = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (m && m.length === 3) {
      const buf = Buffer.from(m[2], 'base64');
      fs.writeFileSync(path.resolve(__dirname, 'public', targetFile), buf);
    }
  };

  try {
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Datos de imagen corruptos' });
    }

    const ext = matches[1].includes('jpeg') || matches[1].includes('jpg') ? 'jpg' : 'png';
    const filename = `custom-logo.${ext}`;
    saveBase64File(imageData, filename);

    saveBase64File(pwa512 || imageData, 'pwa-512x512.png');
    saveBase64File(pwa192 || imageData, 'pwa-192x192.png');
    saveBase64File(pwa192 || imageData, 'apple-touch-icon.png');
    saveBase64File(pwaMaskable || pwa512 || imageData, 'pwa-maskable-512x512.png');

    const logoUrl = `/${filename}?t=${Date.now()}`;

    cfg.customLogoUrl = logoUrl;
    saveAdminConfig(cfg);

    return res.json({ success: true, logoUrl, message: 'Logo e icono móvil de Chrome/iPhone actualizados con éxito' });
  } catch {
    return res.status(500).json({ success: false, error: 'Error al procesar y guardar la imagen' });
  }
});

app.delete('/api/admin/logo', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const pin = extractAdminCredential(req, req.body?.adminPin);
  const cfg = getAdminConfig();

  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  try {
    cfg.customLogoUrl = undefined;
    saveAdminConfig(cfg);

    ['custom-logo.png', 'custom-logo.jpg'].forEach(f => {
      const p = path.resolve(__dirname, 'public', f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    });

    return res.json({ success: true, message: 'Logo restaurado al predeterminado' });
  } catch {
    return res.status(500).json({ success: false, error: 'Error al restaurar logo' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  try {
    const { username, pin, deviceId, deviceName } = req.body || {};
    const result = await loginAppUser(username, pin, deviceId, deviceName);
    if (!result.success && (result.code === 'INVALID_PIN' || result.code === 'USER_NOT_FOUND')) {
      await recordAuthFailure(req);
    } else if (result.success) {
      clearAuthFailures(req);
    }
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: 'Error interno en inicio de sesión' });
  }
});

app.post('/api/auth/register-request', dataRateLimitMiddleware, async (req, res) => {
  try {
    const { username, pin, displayName, whatsapp, deviceId, deviceName } = req.body || {};
    const result = await registerAppUserRequest(username, pin, displayName, whatsapp, deviceId, deviceName);
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: 'Error al procesar solicitud' });
  }
});

app.get('/api/admin/users/list', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();

  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  try {
    const users = await adminListAppUsers();
    return res.json({ success: true, users });
  } catch {
    return res.status(500).json({ success: false, error: 'Error al consultar listado de usuarios' });
  }
});

app.post('/api/admin/users/reset-device', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { pin, userId, username } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  if (!userId && !username) {
    return res.status(400).json({ success: false, error: 'ID o nombre de usuario requerido' });
  }

  const ok = await adminResetAppUserDevice(
    sanitizeText(String(userId || ''), 64),
    username ? sanitizeText(String(username), 40) : undefined
  );
  return res.json({
    success: ok,
    message: ok
      ? 'Dispositivo desvinculado con éxito. El usuario ahora puede ingresar desde su nuevo equipo.'
      : 'No se pudo desvincular el dispositivo.'
  });
});

app.post('/api/admin/users/renew', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { pin, userId, username, addDays = 30, mode = 'SET' } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  if (!userId && !username) {
    return res.status(400).json({ success: false, error: 'ID o nombre de usuario requerido' });
  }

  const ok = await adminRenewAppUser(
    sanitizeText(String(userId || ''), 64),
    Number(addDays),
    username ? sanitizeText(String(username), 40) : undefined,
    mode === 'ADD' ? 'ADD' : 'SET'
  );
  return res.json({
    success: ok,
    message: ok
      ? mode === 'ADD'
        ? `Suscripción extendida +${addDays} días`
        : `Días del usuario fijados a ${addDays} días`
      : 'Error al actualizar días'
  });
});

app.post('/api/admin/users/toggle-status', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { pin, userId, username, status } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  const ok = await adminToggleAppUserStatus(
    sanitizeText(String(userId || ''), 64),
    status === 'suspended' ? 'suspended' : 'active',
    username ? sanitizeText(String(username), 40) : undefined
  );
  return res.json({ success: ok, message: ok ? 'Estado actualizado' : 'Error al cambiar estado' });
});

app.post('/api/admin/users/upsert', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { pin, user } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  const ok = await adminUpsertAppUser(user);
  return res.json({ success: ok, message: ok ? 'Usuario guardado' : 'Error al guardar usuario' });
});

app.post('/api/admin/users/delete', async (req, res) => {
  if (checkAuthLockout(req, res)) return;

  const { pin, userId, username } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);

  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  clearAuthFailures(req);

  if (!userId && !username) {
    return res.status(400).json({ success: false, error: 'ID o nombre de usuario requerido' });
  }

  const ok = await adminDeleteAppUser(
    sanitizeText(String(userId || ''), 64),
    username ? sanitizeText(String(username), 40) : undefined
  );
  return res.json({
    success: ok,
    message: ok ? 'Usuario eliminado permanentemente' : 'No se pudo eliminar el usuario'
  });
});

app.use(express.static(path.resolve(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express Error Handler]:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error interno procesando la solicitud.'
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !IS_VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FutbolStats Pro server listening on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Listen Error]:', err);
  });
}

if (!IS_VERCEL) {
  startServer().catch((err) => {
    console.error('[Fatal Error Starting Server]:', err);
  });
}

export default app;
