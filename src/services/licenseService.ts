/**
 * FutbolStats Pro - Sistema Criptográfico de Licencias Autónomas
 * Funciona 100% sin base de datos externa (usa HMAC-SHA256 matemático determinista).
 * Puede validar tanto online como completamente offline.
 */

export interface LicenseValidationResult {
  isValid: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'INVALID_DEVICE' | 'INVALID_SIGNATURE' | 'MALFORMED' | 'REVOKED';
  message: string;
  isPermanent: boolean;
  isExpired: boolean;
  expiryTimestamp: number | null; // ms epoch or null if permanent
  expiryDateFormatted: string;
  daysRemaining: number | null;
  targetDeviceId: string;
  planLabel: string;
  clientName?: string;
}

export interface StoredLicense {
  key: string;
  activatedAt: number;
  cachedResult: LicenseValidationResult;
}

export interface IssuedLicenseRecord {
  id: string;
  key: string;
  deviceId: string;
  clientNote?: string;
  planType: '24H' | '7D' | '15D' | '30D' | '90D' | 'PERMANENT' | 'CUSTOM';
  planLabel: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
}

// Master secret salt used to sign the tokens.
// In production, matching salt is used in server.ts
export const LICENSE_MASTER_SECRET = 'FUTBOLSTATS_PRO_SECURE_HMAC_SALT_2026_X9';

const STORAGE_KEY_DEVICE_ID = 'futbolstats_device_id';
const STORAGE_KEY_ACTIVE_LICENSE = 'futbolstats_active_license';

// --- Pure TypeScript SHA-256 & HMAC (Zero external dependencies) ---
function sha256(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0, j = 0;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words.push((asciiBitLength / maxWord) | 0);
  words.push(asciiBitLength | 0);

  for (j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));

    for (i = 16; i < 64; i++) {
      const s0 = (rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)) | 0;
      const s1 = (rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)) | 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (i = 0; i < 64; i++) {
      const s1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) | 0;
      const ch = ((e & f) ^ (~e & g)) | 0;
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) | 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function hmacSha256(key: string, message: string): string {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) {
    k = sha256(k);
  }
  while (k.length < blockSize) {
    k += '\x00';
  }
  let oPad = '';
  let iPad = '';
  for (let i = 0; i < blockSize; i++) {
    oPad += String.fromCharCode(k.charCodeAt(i) ^ 0x5c);
    iPad += String.fromCharCode(k.charCodeAt(i) ^ 0x36);
  }
  const innerHash = sha256(iPad + message);
  let innerBinary = '';
  for (let i = 0; i < innerHash.length; i += 2) {
    innerBinary += String.fromCharCode(parseInt(innerHash.substr(i, 2), 16));
  }
  return sha256(oPad + innerBinary);
}

// Clean device id string (e.g. DEV-4A7B-9E2F -> 4A7B9E2F)
export function sanitizeDeviceId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^DEV/, '');
}

/**
 * Returns or generates a persistent Device ID for the client browser.
 * Format: DEV-XXXX-YYYY (e.g. DEV-8B3F-2A9C)
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (existing && /^DEV-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(existing)) {
      return existing.toUpperCase();
    }
  } catch {
    // ignore
  }

  const randomPart1 = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const randomPart2 = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const generated = `DEV-${randomPart1}-${randomPart2}`;

  try {
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, generated);
  } catch {
    // fallback
  }

  return generated;
}

/**
 * Generates an HMAC-based cryptographic license token.
 * Token Format: FS-{PLAN}-{CLEAN_DEV}-{EXP_HEX}-{SIGNATURE_8}
 * Example: FS-30D-8B3F2A9C-675F1A80-7A3D9E2F
 * If permanent: FS-VIP-8B3F2A9C-00000000-8F12C3A1
 */
export function createLicenseToken(
  deviceId: string,
  planType: '24H' | '7D' | '15D' | '30D' | '90D' | 'PERMANENT' | 'CUSTOM',
  customExpiryTimestampMs?: number,
  customSecret: string = LICENSE_MASTER_SECRET
): { key: string; expiresAt: number | null; planLabel: string } {
  const cleanDev = sanitizeDeviceId(deviceId);
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
      expiresAt = customExpiryTimestampMs || (nowMs + 30 * 24 * 60 * 60 * 1000);
      planTag = 'CUS';
      const days = Math.max(1, Math.round((expiresAt - nowMs) / (24 * 60 * 60 * 1000)));
      planLabel = `Pase Personalizado (${days} días)`;
      break;
  }

  const expSeconds = expiresAt === null ? 0 : Math.floor(expiresAt / 1000);
  const expHex = expSeconds.toString(16).toUpperCase().padStart(8, '0');

  const message = `${cleanDev}:${planTag}:${expHex}`;
  const fullHmac = hmacSha256(customSecret, message);
  const sig8 = fullHmac.substring(0, 8).toUpperCase();

  const key = `FS-${planTag}-${cleanDev}-${expHex}-${sig8}`;
  return { key, expiresAt, planLabel };
}

/**
 * Validates a license token cryptographically.
 */
export function verifyLicenseToken(
  rawKey: string,
  currentDeviceId?: string,
  customSecret: string = LICENSE_MASTER_SECRET
): LicenseValidationResult {
  const trimmed = (rawKey || '').trim().toUpperCase();
  const parts = trimmed.split('-');

  if (parts.length !== 5 || parts[0] !== 'FS') {
    return {
      isValid: false,
      status: 'MALFORMED',
      message: 'Formato de clave inválido. Debe comenzar con FS- y tener 5 segmentos.',
      isPermanent: false,
      isExpired: false,
      expiryTimestamp: null,
      expiryDateFormatted: '',
      daysRemaining: null,
      targetDeviceId: '',
      planLabel: 'Desconocido',
    };
  }

  const [, planTag, devClean, expHex, givenSig] = parts;

  // Verify HMAC signature
  const message = `${devClean}:${planTag}:${expHex}`;
  const expectedHmac = hmacSha256(customSecret, message);
  const expectedSig8 = expectedHmac.substring(0, 8).toUpperCase();

  if (givenSig !== expectedSig8) {
    return {
      isValid: false,
      status: 'INVALID_SIGNATURE',
      message: 'Firma de licencia inválida o manipulada. Esta clave no es auténtica.',
      isPermanent: false,
      isExpired: false,
      expiryTimestamp: null,
      expiryDateFormatted: '',
      daysRemaining: null,
      targetDeviceId: devClean,
      planLabel: 'Clave No Autorizada',
    };
  }

  // Verify Device Binding (if currentDeviceId is passed)
  if (currentDeviceId) {
    const currentClean = sanitizeDeviceId(currentDeviceId);
    // Allow master device wildcard "ALL" or exact match
    if (devClean !== 'ALL' && devClean !== currentClean) {
      return {
        isValid: false,
        status: 'INVALID_DEVICE',
        message: `Esta clave fue generada para el dispositivo DEV-${devClean.substring(0, 4)}-${devClean.substring(4)}, no para este navegador.`,
        isPermanent: false,
        isExpired: false,
        expiryTimestamp: null,
        expiryDateFormatted: '',
        daysRemaining: null,
        targetDeviceId: devClean,
        planLabel: 'Dispositivo No Coincide',
      };
    }
  }

  // Parse Expiry
  const expSeconds = parseInt(expHex, 16);
  const isPermanent = expSeconds === 0;
  const nowMs = Date.now();
  const expiryTimestamp = isPermanent ? null : expSeconds * 1000;
  const isExpired = !isPermanent && (expiryTimestamp! < nowMs);

  let daysRemaining: number | null = null;
  let expiryDateFormatted = 'Permanente (Sin Vencimiento)';

  if (!isPermanent && expiryTimestamp) {
    daysRemaining = Math.max(0, Math.ceil((expiryTimestamp - nowMs) / (24 * 60 * 60 * 1000)));
    const dateObj = new Date(expiryTimestamp);
    expiryDateFormatted = dateObj.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  let planLabel = 'Pase Activo';
  if (planTag === 'VIP') planLabel = 'Pase Permanente Vitalicio';
  else if (planTag === '24H') planLabel = 'Prueba 24 Horas';
  else if (planTag === '7D') planLabel = 'Pase Semanal';
  else if (planTag === '15D') planLabel = 'Pase Quincenal';
  else if (planTag === '30D') planLabel = 'Pase Mensual';
  else if (planTag === '90D') planLabel = 'Pase Trimestral';
  else if (planTag === 'CUS') planLabel = 'Pase Personalizado';

  if (isExpired) {
    return {
      isValid: false,
      status: 'EXPIRED',
      message: `Tu licencia venció el ${expiryDateFormatted}. Solicita una renovación para continuar ingresando.`,
      isPermanent: false,
      isExpired: true,
      expiryTimestamp,
      expiryDateFormatted,
      daysRemaining: 0,
      targetDeviceId: devClean,
      planLabel,
    };
  }

  return {
    isValid: true,
    status: 'ACTIVE',
    message: isPermanent ? 'Licencia permanente activa' : `Licencia activa hasta el ${expiryDateFormatted}`,
    isPermanent,
    isExpired: false,
    expiryTimestamp,
    expiryDateFormatted,
    daysRemaining,
    targetDeviceId: devClean,
    planLabel,
  };
}

// Storage helpers
export function saveActiveLicense(key: string, result: LicenseValidationResult): void {
  try {
    const payload: StoredLicense = {
      key,
      activatedAt: Date.now(),
      cachedResult: result,
    };
    localStorage.setItem(STORAGE_KEY_ACTIVE_LICENSE, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function getActiveStoredLicense(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_LICENSE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearActiveLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_LICENSE);
  } catch {
    // ignore
  }
}
