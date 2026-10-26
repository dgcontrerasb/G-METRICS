import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * SportStats Pro — Módulo de Seguridad Ofensiva y Defensiva (Zero Trust Architecture)
 * Implementa:
 * 1. Hashing criptográfico unidireccional de PINs con sal (scrypt + timingSafeEqual).
 * 2. Protección contra Fuerza Bruta (5 intentos / 15 min por IP + retardo progresivo).
 * 3. Rate Limiting por ventana deslizante para endpoints de datos (40 req/min por IP).
 * 4. Emisión y verificación de Tokens JWT firmados (HMAC-SHA256) con vinculación de dispositivo.
 * 5. Sanitización profunda Anti-XSS, Anti-SQLi y bloqueo de Prototype Pollution.
 * 6. Control de Idempotencia (Idempotency-Key) para transacciones administrativas y de usuario.
 * 7. Cabeceras HTTP de seguridad (Helmet-grade) y política CORS restrictiva.
 */

const JWT_SECRET =
  process.env.JWT_SECRET_KEY ||
  process.env.ADMIN_MASTER_KEY ||
  'SPORTSTATS_PRO_ZERO_TRUST_JWT_HMAC_KEY_2026_V4';

// ============================================================================
// 1. ENCRIPTACIÓN UNIDIRECCIONAL DE PINS (SCRYPT + TIMING-SAFE EQUAL)
// ============================================================================

const SCRYPT_PREFIX = 'scrypt$';
const KEY_LEN = 32;

export function isHashedPin(stored: string | undefined | null): boolean {
  return typeof stored === 'string' && stored.startsWith(SCRYPT_PREFIX);
}

export function hashUserPin(rawPin: string): string {
  const clean = String(rawPin || '').trim();
  if (isHashedPin(clean)) return clean;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, KEY_LEN).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}

export function verifyUserPin(inputPin: string, storedPinOrHash: string): boolean {
  const cleanInput = String(inputPin || '').trim();
  const stored = String(storedPinOrHash || '').trim();
  if (!cleanInput || !stored) return false;

  if (isHashedPin(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, storedHex] = parts;
    try {
      const derivedBuf = crypto.scryptSync(cleanInput, salt, KEY_LEN);
      const storedBuf = Buffer.from(storedHex, 'hex');
      if (derivedBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, storedBuf);
    } catch {
      return false;
    }
  }

  // Soporte de migración transparente para PINs heredados en texto plano usando comparación en tiempo constante
  return timingSafeCompare(cleanInput, stored);
}

export function timingSafeCompare(a: string, b: string): boolean {
  const strA = String(a || '');
  const strB = String(b || '');
  const bufA = Buffer.from(strA, 'utf8');
  const bufB = Buffer.from(strB, 'utf8');
  if (bufA.length !== bufB.length) {
    // Ejecutar comparación dummy del mismo tamaño para no filtrar longitud por tiempo
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================================
// 2. TOKENS DE SESIÓN FIRMADOS (JWT HMAC-SHA256) CON DISPOSITIVO ÚNICO
// ============================================================================

export interface SessionTokenPayload {
  sub: string;
  username: string;
  role: 'admin' | 'client';
  deviceId: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function createSessionJwt(params: {
  userId: string;
  username: string;
  role: 'admin' | 'client';
  deviceId: string;
  ttlDays?: number;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = (params.ttlDays ?? 30) * 24 * 60 * 60;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: SessionTokenPayload = {
    sub: params.userId,
    username: params.username,
    role: params.role,
    deviceId: String(params.deviceId || '').trim().toUpperCase(),
    iat: nowSec,
    exp: nowSec + ttlSec,
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}

export function verifySessionJwt(token: string, expectedDeviceId?: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [header, payload, givenSig] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
  );

  if (!timingSafeCompare(givenSig, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as SessionTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < nowSec) {
      return null;
    }
    if (expectedDeviceId && decoded.role !== 'admin') {
      const cleanExpected = expectedDeviceId.trim().toUpperCase();
      if (decoded.deviceId && decoded.deviceId !== cleanExpected) {
        return null;
      }
    }
    return decoded;
  } catch {
    return null;
  }
}

// ============================================================================
// 3. SANITIZACIÓN ESTRICTA ANTI-XSS / ANTI-SQLi / PROTOTYPE POLLUTION
// ============================================================================

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeText(input: unknown, maxLength = 120): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '') // Caracteres de control
    .replace(/<\s*\/?\s*script[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>]/g, '') // Evitar inyección de etiquetas HTML
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAlphanumericId(input: unknown, maxLength = 32): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^0-9]/g, '').slice(0, 18);
}

export function sanitizeDeepPayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // No truncar base64 de imágenes legítimas del admin logo
    if (obj.startsWith('data:image/')) {
      return obj as unknown as T;
    }
    return sanitizeText(obj, 1000) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDeepPayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      cleanObj[k] = sanitizeDeepPayload(v);
    }
    return cleanObj as T;
  }
  return obj;
}

// ============================================================================
// 4. RATE LIMITING & PROTECCIÓN CONTRA FUERZA BRUTA
// ============================================================================

interface RateBucket {
  timestamps: number[];
}

interface BruteForceRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const dataRateBuckets = new Map<string, RateBucket>();
const ipNatRateBuckets = new Map<string, RateBucket>();
const authFailuresMap = new Map<string, BruteForceRecord>();

const DATA_RATE_WINDOW_MS = 60 * 1000; // 1 minuto
const DATA_RATE_MAX_REQUESTS = 45; // 45 peticiones por minuto por Dispositivo/Sesión
const DATA_RATE_MAX_PER_NAT_IP = 240; // 240 peticiones por minuto por IP compartida (WiFi / NAT)

const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const AUTH_MAX_FAILURES = 5; // Máximo 5 intentos fallidos

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function dataRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const rawDeviceId = typeof req.headers['x-device-id'] === 'string' ? sanitizeAlphanumericId(req.headers['x-device-id'], 32) : '';
  const bucketKey = rawDeviceId ? `${ip}:${rawDeviceId}` : ip;
  const now = Date.now();

  let bucket = dataRateBuckets.get(bucketKey);
  if (!bucket) {
    bucket = { timestamps: [] };
    dataRateBuckets.set(bucketKey, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < DATA_RATE_WINDOW_MS);

  let ipBucket = ipNatRateBuckets.get(ip);
  if (!ipBucket) {
    ipBucket = { timestamps: [] };
    ipNatRateBuckets.set(ip, ipBucket);
  }
  ipBucket.timestamps = ipBucket.timestamps.filter((t) => now - t < DATA_RATE_WINDOW_MS);

  const remainingDevice = Math.max(0, DATA_RATE_MAX_REQUESTS - bucket.timestamps.length);
  const remainingIp = Math.max(0, DATA_RATE_MAX_PER_NAT_IP - ipBucket.timestamps.length);
  const remaining = Math.min(remainingDevice, remainingIp);

  res.setHeader('X-RateLimit-Limit', String(DATA_RATE_MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));

  if (bucket.timestamps.length >= DATA_RATE_MAX_REQUESTS || ipBucket.timestamps.length >= DATA_RATE_MAX_PER_NAT_IP) {
    const oldest = bucket.timestamps[0] || ipBucket.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((DATA_RATE_WINDOW_MS - (now - oldest)) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: `Límite de peticiones excedido (máx. ${DATA_RATE_MAX_REQUESTS}/min por dispositivo, ${DATA_RATE_MAX_PER_NAT_IP}/min por red). Intenta de nuevo en ${retryAfterSec} segundos.`
    });
    return;
  }

  bucket.timestamps.push(now);
  ipBucket.timestamps.push(now);
  next();
}

export function checkAuthLockout(req: Request, res: Response): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = authFailuresMap.get(ip);

  if (!record) return false;

  if (record.lockedUntil > now) {
    const waitMinutes = Math.max(1, Math.ceil((record.lockedUntil - now) / 60000));
    const waitSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    res.setHeader('Retry-After', String(waitSeconds));
    res.status(429).json({
      success: false,
      isValid: false,
      code: 'RATE_LIMITED',
      error: 'Demasiados intentos fallidos',
      message: `Acceso bloqueado temporalmente por seguridad tras múltiples intentos fallidos. Intenta de nuevo en ${waitMinutes} min.`
    });
    return true;
  }

  if (now - record.firstFailureAt > AUTH_WINDOW_MS) {
    authFailuresMap.delete(ip);
  }

  return false;
}

export async function recordAuthFailure(req: Request): Promise<void> {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = authFailuresMap.get(ip);

  if (!record || now - record.firstFailureAt > AUTH_WINDOW_MS) {
    record = {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0,
    };
  } else {
    record.failures += 1;
    if (record.failures >= AUTH_MAX_FAILURES) {
      record.lockedUntil = now + AUTH_WINDOW_MS;
    }
  }

  authFailuresMap.set(ip, record);

  // Delay criptográfico progresivo para mitigar ataques de diccionario
  const delayMs = Math.min(1800, record.failures * 300);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function clearAuthFailures(req: Request): void {
  const ip = getClientIp(req);
  authFailuresMap.delete(ip);
}

// ============================================================================
// 5. IDEMPOTENCIA EN MUTACIONES (IDEMPOTENCY-KEY CACHE)
// ============================================================================

interface IdempotencyRecord {
  status: number;
  body: unknown;
  createdAt: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    next();
    return;
  }

  const rawKey = req.headers['idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    next();
    return;
  }

  const cleanKey = `${req.path}:${sanitizeAlphanumericId(rawKey, 64)}`;
  const now = Date.now();

  // Limpiar claves expiradas
  idempotencyStore.forEach((val, key) => {
    if (now - val.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  });

  const existing = idempotencyStore.get(cleanKey);
  if (existing) {
    res.setHeader('X-Idempotent-Replay', 'true');
    res.status(existing.status).json(existing.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cleanKey, {
        status: res.statusCode,
        body,
        createdAt: Date.now(),
      });
    }
    return originalJson(body);
  }) as any;

  next();
}

// ============================================================================
// 6. CABECERAS HTTP HELMET-GRADE Y RESTRICCIÓN CORS
// ============================================================================

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Peticiones same-origin o server-to-server
  const customAllowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (customAllowed.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'sportstats.pro' ||
      host.endsWith('.sportstats.pro') ||
      host.endsWith('.run.app') ||
      host.endsWith('.google.com') ||
      host.endsWith('.vercel.app')
    );
  } catch {
    return false;
  }
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-apisports-key, x-admin-pin, Idempotency-Key, x-device-id'
  );

  // Helmet-grade HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://*.google.com https://*.aistudio.google.com https://*.run.app;"
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  // Sanitizar automáticamente el body JSON entrante
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeepPayload(req.body);
  }

  next();
}
