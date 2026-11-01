// server.ts
import express from "express";
import dotenv from "dotenv";
import path2 from "path";
import fs2 from "fs";
import crypto3 from "node:crypto";
import { fileURLToPath } from "url";

// src/services/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";
import crypto2 from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// src/services/securityShield.ts
import crypto from "node:crypto";
var JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.ADMIN_MASTER_KEY || "SPORTSTATS_PRO_ZERO_TRUST_JWT_HMAC_KEY_2026_V4";
var SCRYPT_PREFIX = "scrypt$";
var KEY_LEN = 32;
function isHashedPin(stored) {
  return typeof stored === "string" && stored.startsWith(SCRYPT_PREFIX);
}
function hashUserPin(rawPin) {
  const clean = String(rawPin || "").trim();
  if (isHashedPin(clean)) return clean;
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(clean, salt, KEY_LEN).toString("hex");
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}
function verifyUserPin(inputPin, storedPinOrHash) {
  const cleanInput = String(inputPin || "").trim();
  const stored = String(storedPinOrHash || "").trim();
  if (!cleanInput || !stored) return false;
  if (isHashedPin(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const [, salt, storedHex] = parts;
    try {
      const derivedBuf = crypto.scryptSync(cleanInput, salt, KEY_LEN);
      const storedBuf = Buffer.from(storedHex, "hex");
      if (derivedBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, storedBuf);
    } catch {
      return false;
    }
  }
  return timingSafeCompare(cleanInput, stored);
}
function timingSafeCompare(a, b) {
  const strA = String(a || "");
  const strB = String(b || "");
  const bufA = Buffer.from(strA, "utf8");
  const bufB = Buffer.from(strB, "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(input) {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}
function createSessionJwt(params) {
  const nowSec = Math.floor(Date.now() / 1e3);
  const ttlSec = (params.ttlDays ?? 30) * 24 * 60 * 60;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadObj = {
    sub: params.userId,
    username: params.username,
    role: params.role,
    deviceId: String(params.deviceId || "").trim().toUpperCase(),
    iat: nowSec,
    exp: nowSec + ttlSec
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", JWT_SECRET).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}
function verifySessionJwt(token, expectedDeviceId) {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [header, payload, givenSig] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac("sha256", JWT_SECRET).update(signingInput).digest()
  );
  if (!timingSafeCompare(givenSig, expectedSig)) {
    return null;
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    const nowSec = Math.floor(Date.now() / 1e3);
    if (!decoded.exp || decoded.exp < nowSec) {
      return null;
    }
    if (expectedDeviceId && decoded.role !== "admin") {
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
var DANGEROUS_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function sanitizeText(input, maxLength = 120) {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001F\u007F]/g, "").replace(/<\s*\/?\s*script[^>]*>/gi, "").replace(/javascript\s*:/gi, "").replace(/on\w+\s*=/gi, "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}
function sanitizeAlphanumericId(input, maxLength = 32) {
  if (typeof input !== "string") return "";
  return input.replace(/[^a-zA-Z0-9_-]/g, "").trim().slice(0, maxLength);
}
function sanitizePhone(input) {
  if (typeof input !== "string") return "";
  return input.replace(/[^0-9]/g, "").slice(0, 18);
}
function sanitizeDeepPayload(obj) {
  if (obj === null || obj === void 0) return obj;
  if (typeof obj === "string") {
    if (obj.startsWith("data:image/")) {
      return obj;
    }
    return sanitizeText(obj, 1e3);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDeepPayload(item));
  }
  if (typeof obj === "object") {
    const cleanObj = {};
    for (const [k, v] of Object.entries(obj)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      cleanObj[k] = sanitizeDeepPayload(v);
    }
    return cleanObj;
  }
  return obj;
}
var dataRateBuckets = /* @__PURE__ */ new Map();
var ipNatRateBuckets = /* @__PURE__ */ new Map();
var authFailuresMap = /* @__PURE__ */ new Map();
var DATA_RATE_WINDOW_MS = 60 * 1e3;
var DATA_RATE_MAX_REQUESTS = 45;
var DATA_RATE_MAX_PER_NAT_IP = 240;
var AUTH_WINDOW_MS = 15 * 60 * 1e3;
var AUTH_MAX_FAILURES = 5;
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}
function dataRateLimitMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const rawDeviceId = typeof req.headers["x-device-id"] === "string" ? sanitizeAlphanumericId(req.headers["x-device-id"], 32) : "";
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
  res.setHeader("X-RateLimit-Limit", String(DATA_RATE_MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  if (bucket.timestamps.length >= DATA_RATE_MAX_REQUESTS || ipBucket.timestamps.length >= DATA_RATE_MAX_PER_NAT_IP) {
    const oldest = bucket.timestamps[0] || ipBucket.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((DATA_RATE_WINDOW_MS - (now - oldest)) / 1e3));
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      success: false,
      error: "Too Many Requests",
      message: `L\xEDmite de peticiones excedido (m\xE1x. ${DATA_RATE_MAX_REQUESTS}/min por dispositivo, ${DATA_RATE_MAX_PER_NAT_IP}/min por red). Intenta de nuevo en ${retryAfterSec} segundos.`
    });
    return;
  }
  bucket.timestamps.push(now);
  ipBucket.timestamps.push(now);
  next();
}
function checkAuthLockout(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = authFailuresMap.get(ip);
  if (!record) return false;
  if (record.lockedUntil > now) {
    const waitMinutes = Math.max(1, Math.ceil((record.lockedUntil - now) / 6e4));
    const waitSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1e3));
    res.setHeader("Retry-After", String(waitSeconds));
    res.status(429).json({
      success: false,
      isValid: false,
      code: "RATE_LIMITED",
      error: "Demasiados intentos fallidos",
      message: `Acceso bloqueado temporalmente por seguridad tras m\xFAltiples intentos fallidos. Intenta de nuevo en ${waitMinutes} min.`
    });
    return true;
  }
  if (now - record.firstFailureAt > AUTH_WINDOW_MS) {
    authFailuresMap.delete(ip);
  }
  return false;
}
async function recordAuthFailure(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = authFailuresMap.get(ip);
  if (!record || now - record.firstFailureAt > AUTH_WINDOW_MS) {
    record = {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0
    };
  } else {
    record.failures += 1;
    if (record.failures >= AUTH_MAX_FAILURES) {
      record.lockedUntil = now + AUTH_WINDOW_MS;
    }
  }
  authFailuresMap.set(ip, record);
  const delayMs = Math.min(1800, record.failures * 300);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
function clearAuthFailures(req) {
  const ip = getClientIp(req);
  authFailuresMap.delete(ip);
}
var idempotencyStore = /* @__PURE__ */ new Map();
var IDEMPOTENCY_TTL_MS = 5 * 60 * 1e3;
function idempotencyMiddleware(req, res, next) {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "DELETE") {
    next();
    return;
  }
  const rawKey = req.headers["idempotency-key"];
  if (!rawKey || typeof rawKey !== "string") {
    next();
    return;
  }
  const cleanKey = `${req.path}:${sanitizeAlphanumericId(rawKey, 64)}`;
  const now = Date.now();
  idempotencyStore.forEach((val, key) => {
    if (now - val.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  });
  const existing = idempotencyStore.get(cleanKey);
  if (existing) {
    res.setHeader("X-Idempotent-Replay", "true");
    res.status(existing.status).json(existing.body);
    return;
  }
  const originalJson = res.json.bind(res);
  res.json = ((body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cleanKey, {
        status: res.statusCode,
        body,
        createdAt: Date.now()
      });
    }
    return originalJson(body);
  });
  next();
}
function isAllowedOrigin(origin) {
  if (!origin) return true;
  const customAllowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (customAllowed.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "sportstats.pro" || host.endsWith(".sportstats.pro") || host.endsWith(".run.app") || host.endsWith(".google.com") || host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}
function securityHeadersMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-apisports-key, x-admin-pin, Idempotency-Key, x-device-id"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://*.google.com https://*.aistudio.google.com https://*.run.app;"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeepPayload(req.body);
  }
  next();
}

// src/services/supabaseServer.ts
var supabaseClient = null;
var IS_VERCEL = Boolean(process.env.VERCEL);
var LOCAL_USERS_FILE = IS_VERCEL ? path.resolve("/tmp", "sportstats_users_db.json") : path.resolve(process.cwd(), "sportstats_users_db.json");
var memoryUsersCache = null;
function getLocalUsersDb() {
  if (memoryUsersCache) return memoryUsersCache;
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const raw = fs.readFileSync(LOCAL_USERS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryUsersCache = parsed;
        return parsed;
      }
    }
  } catch {
  }
  memoryUsersCache = [];
  return memoryUsersCache;
}
function saveLocalUsersDb(users) {
  memoryUsersCache = users;
  try {
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch {
  }
}
function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;
  let clean = rawUrl.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}.supabase.co`;
  }
  return clean.replace(/\/$/, "");
}
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log("[Supabase] Cliente conectado exitosamente a:", url);
    } catch (err) {
      console.error("[Supabase] Error al inicializar cliente:", err);
      supabaseClient = null;
    }
  }
  return supabaseClient;
}
function isSupabaseConfigured() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}
async function fetchSupabaseAdminConfig() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("sportstats_config").select("*").eq("id", "main").maybeSingle();
    if (error) {
      console.warn("[Supabase Config] Advertencia al leer configuraci\xF3n:", error.message);
      return null;
    }
    if (data) {
      return {
        adminPin: data.admin_pin,
        adminWhatsApp: data.admin_whatsapp,
        supportName: data.support_name || void 0,
        customLogoUrl: data.custom_logo_url || void 0,
        colorTheme: data.color_theme || "cyan-emerald"
      };
    }
  } catch (err) {
    console.error("[Supabase Config] Excepci\xF3n:", err);
  }
  return null;
}
async function upsertSupabaseAdminConfig(cfg) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("sportstats_config").upsert({
      id: "main",
      admin_pin: cfg.adminPin,
      admin_whatsapp: cfg.adminWhatsApp,
      support_name: cfg.supportName || null,
      custom_logo_url: cfg.customLogoUrl || null,
      color_theme: cfg.colorTheme || "cyan-emerald",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) {
      console.warn("[Supabase Config] Error al guardar configuraci\xF3n:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Supabase Config] Excepci\xF3n al guardar:", err);
    return false;
  }
}
async function getSupabaseKvCache(cacheId) {
  const client = getSupabaseClient();
  if (!client || !cacheId || cacheId === "main") return null;
  try {
    const { data, error } = await client.from("sportstats_config").select("custom_logo_url, admin_whatsapp").eq("id", cacheId).maybeSingle();
    if (error || !data || !data.custom_logo_url) return null;
    const parsed = JSON.parse(data.custom_logo_url);
    if (parsed && typeof parsed === "object" && "timestamp" in parsed && "data" in parsed) {
      return parsed;
    }
  } catch {
  }
  return null;
}
async function setSupabaseKvCache(cacheId, payload, timestamp = Date.now()) {
  const client = getSupabaseClient();
  if (!client || !cacheId || cacheId === "main") return false;
  try {
    const serialized = JSON.stringify({ timestamp, data: payload });
    const { error } = await client.from("sportstats_config").upsert({
      id: cacheId,
      admin_pin: "KV_CACHE_LOCK",
      admin_whatsapp: String(timestamp),
      support_name: cacheId,
      custom_logo_url: serialized,
      color_theme: "kv-cache",
      updated_at: new Date(timestamp).toISOString()
    });
    if (cacheId.startsWith("apifootball_schedule_")) {
      const threeDaysAgoIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString();
      client.from("sportstats_config").delete().eq("color_theme", "kv-cache").neq("id", "__server_telemetry_v1__").neq("id", "__deleted_users_v1__").lt("updated_at", threeDaysAgoIso).then(
        () => {
        },
        () => {
        }
      );
    }
    return !error;
  } catch {
    return false;
  }
}
async function upsertSupabaseLicense(record) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("sportstats_licenses").upsert(
      {
        id: record.id,
        key: record.key,
        device_id: record.deviceId,
        client_note: record.clientNote || null,
        client_name: record.clientName || null,
        plan_type: record.planType,
        plan_label: record.planLabel,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
        last_active_timestamp: record.lastActiveTimestamp || null,
        device_info: record.deviceInfo || null,
        revoked: record.revoked
      },
      { onConflict: "key" }
    );
    if (error) {
      console.warn("[Supabase License] Error al guardar licencia:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Supabase License] Excepci\xF3n al guardar:", err);
    return false;
  }
}
async function updateSupabaseLicenseStatus(key, revoked) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("sportstats_licenses").update({ revoked }).eq("key", key);
    return !error;
  } catch {
    return false;
  }
}
async function verifyAndConsumeRecoveryOtp(deviceId, otpInput) {
  const client = getSupabaseClient();
  const cleanDev = deviceId.trim().toUpperCase();
  const cleanOtp = otpInput.trim();
  if (client) {
    try {
      const { data, error } = await client.from("sportstats_recovery_requests").select("*").eq("device_id", cleanDev).eq("otp_code", cleanOtp).eq("used", false).gt("expires_at", Date.now()).order("created_at", { ascending: false }).limit(1);
      if (!error && data && data.length > 0) {
        await client.from("sportstats_recovery_requests").update({ used: true }).eq("id", data[0].id);
        return true;
      }
    } catch (err) {
      console.error("[Supabase OTP Verify] Excepci\xF3n:", err);
    }
  }
  return false;
}
function normalizeUsername(input) {
  return String(input || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "").slice(0, 20);
}
async function loginAppUser(rawUsername, rawPin, deviceId, deviceName) {
  const rawClean = String(rawUsername || "").toLowerCase().trim();
  const isOwnerEmail = rawClean === "dgcontreras@gmail.com" || rawClean === "dgcontrerasb@gmail.com" || rawClean.startsWith("dgcontreras") || rawClean === "admin" || rawClean === "propietario" || rawClean === "geovanny";
  const isOwnerAdmin = isOwnerEmail || rawClean === "admin";
  const username = isOwnerAdmin ? "admin" : normalizeUsername(rawUsername);
  const pin = String(rawPin || "").trim();
  const cleanDevice = sanitizeText(String(deviceId || ""), 48).toUpperCase();
  const friendlyDevName = sanitizeText(String(deviceName || "Dispositivo Web / M\xF3vil"), 80) || "Dispositivo Web / M\xF3vil";
  if (!isOwnerAdmin && (!username || username.length < 3)) {
    return {
      success: false,
      code: "USER_NOT_FOUND",
      message: "El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras y n\xFAmeros)."
    };
  }
  if (!pin) {
    return {
      success: false,
      code: "INVALID_PIN",
      message: "Por favor ingresa tu PIN de acceso."
    };
  }
  const client = getSupabaseClient();
  const nowMs = Date.now();
  if (isOwnerAdmin) {
    const cfg = await fetchSupabaseAdminConfig();
    const envAdminPin = (process.env.ADMIN_PIN || "").trim();
    const envMasterKey = (process.env.ADMIN_MASTER_KEY || "").trim();
    const activeAdminPin = cfg?.adminPin || envAdminPin || "120328";
    const pinUpper = pin.toUpperCase();
    const isStrictProd = process.env.NODE_ENV === "production" && Boolean(envMasterKey);
    const isPinCorrect = timingSafeCompare(pin, activeAdminPin) || (envMasterKey ? timingSafeCompare(pin, envMasterKey) : false) || !isStrictProd && (timingSafeCompare(pin, "120328") || timingSafeCompare(pinUpper, "MASTER-2708") || timingSafeCompare(pinUpper, "2708"));
    if (isPinCorrect) {
      const sessionToken = createSessionJwt({
        userId: "admin-owner",
        username: "admin",
        role: "admin",
        deviceId: cleanDevice,
        ttlDays: 30
      });
      return {
        success: true,
        message: "Acceso de Propietario verificado con \xE9xito",
        sessionToken,
        user: {
          id: "admin-owner",
          username: "admin",
          displayName: "Geovanny Contreras (Propietario)",
          pin: "[PROTECTED]",
          role: "admin",
          status: "active",
          planType: "PERMANENT",
          planLabel: "Acceso Propietario Ilimitado",
          createdAt: nowMs,
          expiresAt: null,
          boundDeviceId: cleanDevice,
          boundDeviceName: friendlyDevName,
          whatsappNumber: cfg?.adminWhatsApp || "573213902708",
          lastActiveAt: nowMs
        }
      };
    } else {
      return {
        success: false,
        code: "INVALID_PIN",
        message: "Credenciales incorrectas para la cuenta de Administrador Propietario."
      };
    }
  }
  if (client) {
    try {
      const { data, error } = await client.from("sportstats_users").select("*").eq("username", username).maybeSingle();
      if (error) {
        console.warn("[Supabase User Login] Error:", error.message);
      }
      if (data) {
        if (!verifyUserPin(pin, data.pin_hash)) {
          return {
            success: false,
            code: "INVALID_PIN",
            message: "El PIN ingresado no es correcto para este usuario."
          };
        }
        if (!isHashedPin(data.pin_hash)) {
          const upgradedHash = hashUserPin(pin);
          await client.from("sportstats_users").update({ pin_hash: upgradedHash }).eq("id", data.id);
        }
        const isAdmin = data.role === "admin";
        const isExpired = !isAdmin && Boolean(data.expires_at && Number(data.expires_at) < nowMs);
        const isPro = !isExpired;
        if (!isAdmin) {
          const deletedSet = getDeletedUsernamesSet();
          if (deletedSet.has(username) || data.status === "deleted" || data.plan_type === "DELETED" || data.notes === "[DELETED]") {
            return {
              success: false,
              code: "USER_NOT_FOUND",
              message: "Esta cuenta ha sido eliminada por el administrador."
            };
          }
          if (data.status === "pending") {
            return {
              success: false,
              code: "PENDING_APPROVAL",
              message: "Tu cuenta est\xE1 pendiente de activaci\xF3n por el administrador."
            };
          }
          if (data.status === "suspended") {
            return {
              success: false,
              code: "SUSPENDED",
              message: "Tu cuenta ha sido suspendida. Contacta al administrador."
            };
          }
        }
        if (!data.bound_device_id) {
          await client.from("sportstats_users").update({
            bound_device_id: cleanDevice,
            bound_device_name: friendlyDevName,
            bound_device_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
            last_active_at: nowMs
          }).eq("id", data.id);
          data.bound_device_id = cleanDevice;
          data.bound_device_name = friendlyDevName;
        } else if (data.bound_device_id !== cleanDevice && !isAdmin) {
          return {
            success: false,
            code: "DEVICE_LOCKED",
            boundDeviceName: data.bound_device_name || "Dispositivo Principal",
            message: `Esta cuenta ya est\xE1 vinculada a otro dispositivo (${data.bound_device_name || "dispositivo principal"}). Para cambiar de equipo solicita la desvinculaci\xF3n a tu administrador.`
          };
        } else {
          await client.from("sportstats_users").update({
            last_active_at: nowMs,
            bound_device_name: friendlyDevName
          }).eq("id", data.id);
        }
        const daysRemaining = data.expires_at ? Math.max(0, Math.ceil((data.expires_at - nowMs) / (24 * 60 * 60 * 1e3))) : null;
        const resolvedUser = {
          id: data.id,
          username: data.username,
          email: data.email || null,
          displayName: data.display_name || void 0,
          pin: "[PROTECTED]",
          role: data.role || "client",
          status: isExpired ? "expired" : data.status || "active",
          planType: data.plan_type || "30D",
          planLabel: data.plan_label || (isPro ? "Pase Activo" : "Plan Vencido"),
          createdAt: Number(data.created_at || nowMs),
          expiresAt: data.expires_at ? Number(data.expires_at) : null,
          boundDeviceId: data.bound_device_id,
          boundDeviceName: data.bound_device_name,
          boundDeviceUpdatedAt: data.bound_device_updated_at,
          lastActiveAt: nowMs,
          whatsappNumber: data.whatsapp_number,
          notes: data.notes,
          daysRemaining,
          isExpired,
          isPro,
          authProvider: data.auth_provider || "pin",
          feedbackBonusClaimed: Boolean(data.feedback_bonus_claimed)
        };
        const sessionToken = createSessionJwt({
          userId: resolvedUser.id,
          username: resolvedUser.username,
          role: resolvedUser.role,
          deviceId: cleanDevice,
          ttlDays: 30
        });
        return {
          success: true,
          isPro,
          message: isPro ? "Autenticaci\xF3n exitosa" : "Tu plan de acceso ha vencido. Puedes ver marcadores b\xE1sicos o activar tu plan VIP.",
          sessionToken,
          user: resolvedUser
        };
      }
    } catch (err) {
      console.error("[Supabase User Login Excepci\xF3n]:", err);
    }
  }
  const localUsers = getLocalUsersDb();
  const localUser = localUsers.find((u) => u.username === username);
  if (localUser) {
    if (!verifyUserPin(pin, localUser.pin)) {
      return {
        success: false,
        code: "INVALID_PIN",
        message: "El PIN ingresado no es correcto para este usuario."
      };
    }
    if (!isHashedPin(localUser.pin)) {
      localUser.pin = hashUserPin(pin);
      saveLocalUsersDb(localUsers);
    }
    const isAdmin = localUser.role === "admin";
    if (!isAdmin) {
      if (localUser.status === "pending") {
        return {
          success: false,
          code: "PENDING_APPROVAL",
          message: "Tu cuenta est\xE1 pendiente de activaci\xF3n por el administrador."
        };
      }
      if (localUser.status === "suspended") {
        return {
          success: false,
          code: "SUSPENDED",
          message: "Tu cuenta ha sido suspendida. Contacta al administrador."
        };
      }
      if (localUser.expiresAt && localUser.expiresAt < nowMs) {
        return {
          success: false,
          code: "EXPIRED",
          message: "Tu plan de acceso ha vencido. Contacta al administrador para renovar."
        };
      }
    }
    if (!localUser.boundDeviceId) {
      localUser.boundDeviceId = cleanDevice;
      localUser.boundDeviceName = friendlyDevName;
      localUser.boundDeviceUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
      localUser.lastActiveAt = nowMs;
      saveLocalUsersDb(localUsers);
    } else if (localUser.boundDeviceId !== cleanDevice && !isAdmin) {
      return {
        success: false,
        code: "DEVICE_LOCKED",
        boundDeviceName: localUser.boundDeviceName || "Dispositivo Principal",
        message: `Esta cuenta ya est\xE1 vinculada a otro dispositivo (${localUser.boundDeviceName || "dispositivo principal"}). Para cambiar de equipo solicita la desvinculaci\xF3n a tu administrador.`
      };
    } else {
      localUser.lastActiveAt = nowMs;
      localUser.boundDeviceName = friendlyDevName;
      saveLocalUsersDb(localUsers);
    }
    const daysRemaining = localUser.expiresAt ? Math.max(0, Math.ceil((localUser.expiresAt - nowMs) / (24 * 60 * 60 * 1e3))) : null;
    const sessionToken = createSessionJwt({
      userId: localUser.id,
      username: localUser.username,
      role: localUser.role,
      deviceId: cleanDevice,
      ttlDays: 30
    });
    return {
      success: true,
      message: "Autenticaci\xF3n exitosa",
      sessionToken,
      user: {
        ...localUser,
        pin: "[PROTECTED]",
        daysRemaining,
        isExpired: localUser.expiresAt ? localUser.expiresAt < nowMs : false
      }
    };
  }
  return {
    success: false,
    code: "USER_NOT_FOUND",
    message: "El usuario no existe o las credenciales no son v\xE1lidas."
  };
}
async function registerAppUserRequest(rawUsername, rawPin, displayName, whatsapp, deviceId, deviceName) {
  const username = normalizeUsername(rawUsername);
  const pin = String(rawPin || "").trim();
  const cleanDeviceId = deviceId ? sanitizeText(String(deviceId), 48).toUpperCase() : null;
  const friendlyDevName = sanitizeText(String(deviceName || "Dispositivo Web / M\xF3vil"), 80) || "Dispositivo Web / M\xF3vil";
  if (!username || username.length < 3) {
    return {
      success: false,
      code: "INVALID_USERNAME",
      message: "El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras de a-z y n\xFAmeros)."
    };
  }
  if (!pin || pin.length < 4) {
    return {
      success: false,
      code: "INVALID_PIN",
      message: "El PIN debe tener al menos 4 d\xEDgitos."
    };
  }
  const client = getSupabaseClient();
  const nowMs = Date.now();
  const cleanDisplayName = displayName ? sanitizeText(displayName, 60) : void 0;
  const cleanWhatsapp = whatsapp ? sanitizePhone(whatsapp) : void 0;
  const hashedPin = hashUserPin(pin);
  const localUsers = getLocalUsersDb();
  if (cleanDeviceId) {
    const pendingOnDevice = localUsers.find(
      (u) => u.boundDeviceId === cleanDeviceId && u.status === "pending" && u.username !== username
    );
    if (pendingOnDevice) {
      return {
        success: false,
        code: "DEVICE_PENDING_EXISTS",
        message: `Ya tienes una solicitud pendiente (@${pendingOnDevice.username}) registrada desde este dispositivo. Espera a que el administrador la active o ingresa con tus credenciales.`
      };
    }
  }
  const existingLocal = localUsers.find((u) => u.username === username);
  if (existingLocal && existingLocal.status === "active") {
    return {
      success: false,
      code: "USER_EXISTS",
      message: "Este nombre de usuario ya est\xE1 activo y registrado. Elige otro o inicia sesi\xF3n."
    };
  }
  const newRecord = existingLocal || {
    id: crypto2.randomUUID ? crypto2.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username,
    displayName: cleanDisplayName,
    pin: hashedPin,
    role: "client",
    status: "pending",
    planType: "PENDING",
    planLabel: "Pendiente de Activaci\xF3n",
    createdAt: nowMs,
    expiresAt: null,
    boundDeviceId: cleanDeviceId,
    boundDeviceName: friendlyDevName,
    whatsappNumber: cleanWhatsapp || null,
    daysRemaining: 0,
    isExpired: false
  };
  if (existingLocal) {
    existingLocal.pin = hashedPin;
    if (cleanDisplayName) existingLocal.displayName = cleanDisplayName;
    if (cleanWhatsapp) existingLocal.whatsappNumber = cleanWhatsapp;
    if (cleanDeviceId) {
      existingLocal.boundDeviceId = cleanDeviceId;
      existingLocal.boundDeviceName = friendlyDevName;
    }
  } else {
    localUsers.unshift(newRecord);
  }
  saveLocalUsersDb(localUsers);
  if (client) {
    try {
      const { data: existing } = await client.from("sportstats_users").select("id, username, status").eq("username", username).maybeSingle();
      if (existing) {
        if (existing.status === "active") {
          return {
            success: false,
            code: "USER_EXISTS",
            message: "Este nombre de usuario ya est\xE1 registrado. Elige otro o inicia sesi\xF3n."
          };
        }
        await client.from("sportstats_users").update({
          pin_hash: hashedPin,
          display_name: cleanDisplayName || null,
          whatsapp_number: cleanWhatsapp || null
        }).eq("id", existing.id);
        return {
          success: true,
          message: "Solicitud actualizada con \xE9xito. Contacta al administrador para activar tu acceso.",
          username
        };
      }
      const { error } = await client.from("sportstats_users").insert({
        username,
        display_name: cleanDisplayName || null,
        pin_hash: hashedPin,
        role: "client",
        status: "pending",
        plan_type: "PENDING",
        plan_label: "Pendiente de Activaci\xF3n",
        created_at: nowMs,
        expires_at: null,
        bound_device_id: null,
        whatsapp_number: cleanWhatsapp || null
      });
      if (error) {
        console.warn("[Supabase Register Fallback Local]:", error.message);
      }
    } catch (err) {
      console.warn("[Supabase Register Excepci\xF3n Fallback Local]:", err);
    }
  }
  return {
    success: true,
    message: "Solicitud creada con \xE9xito. Contacta al administrador para activar tu acceso.",
    username
  };
}
var DELETED_USERS_FILE = IS_VERCEL ? path.resolve("/tmp", "sportstats_deleted_users.json") : path.resolve(process.cwd(), "sportstats_deleted_users.json");
var memoryDeletedUsernames = null;
var supabaseDeletedHydrated = false;
function getDeletedUsernamesSet() {
  if (memoryDeletedUsernames) return memoryDeletedUsernames;
  try {
    if (fs.existsSync(DELETED_USERS_FILE)) {
      const raw = fs.readFileSync(DELETED_USERS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryDeletedUsernames = new Set(parsed.map((item) => String(item).toLowerCase().trim()).filter(Boolean));
        return memoryDeletedUsernames;
      }
    }
  } catch {
  }
  memoryDeletedUsernames = /* @__PURE__ */ new Set();
  return memoryDeletedUsernames;
}
function saveDeletedUsernamesSet(set, syncRemote = true) {
  memoryDeletedUsernames = set;
  const list = Array.from(set).filter(Boolean);
  try {
    fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
  }
  if (syncRemote && isSupabaseConfigured()) {
    setSupabaseKvCache("__deleted_users_v1__", list).catch(() => {
    });
  }
}
async function hydrateDeletedUsersFromSupabaseIfNeeded() {
  const currentSet = getDeletedUsernamesSet();
  if (supabaseDeletedHydrated || !isSupabaseConfigured()) return currentSet;
  supabaseDeletedHydrated = true;
  try {
    const remote = await getSupabaseKvCache("__deleted_users_v1__");
    if (remote && Array.isArray(remote.data)) {
      let added = false;
      for (const item of remote.data) {
        const clean = String(item || "").toLowerCase().trim();
        if (clean && !currentSet.has(clean)) {
          currentSet.add(clean);
          added = true;
        }
      }
      if (added) {
        saveDeletedUsernamesSet(currentSet, false);
      }
    }
  } catch {
  }
  return currentSet;
}
function isValidUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}
async function adminListAppUsers() {
  const client = getSupabaseClient();
  const nowMs = Date.now();
  const deletedSet = await hydrateDeletedUsersFromSupabaseIfNeeded();
  const localUsers = getLocalUsersDb();
  const mergedMap = /* @__PURE__ */ new Map();
  for (const u of localUsers) {
    const uname = String(u.username || "").toLowerCase().trim();
    if (!uname || deletedSet.has(uname) || u.status === "deleted" || u.planType === "DELETED" || u.notes === "[DELETED]") continue;
    const isPending = u.status === "pending";
    const daysRemaining = isPending ? 0 : u.expiresAt ? Math.max(0, Math.ceil((u.expiresAt - nowMs) / (24 * 60 * 60 * 1e3))) : null;
    const isExpired = isPending ? false : u.expiresAt ? u.expiresAt < nowMs : false;
    mergedMap.set(uname, {
      ...u,
      username: uname,
      pin: "[PROTECTED]",
      planType: isPending ? "PENDING" : u.planType || "30D",
      planLabel: isPending ? "Pendiente de Activaci\xF3n" : u.planLabel || "Pase Mensual",
      expiresAt: isPending ? null : u.expiresAt,
      daysRemaining,
      isExpired
    });
  }
  if (client) {
    try {
      const { data, error } = await client.from("sportstats_users").select("*").neq("status", "deleted").order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const uname = String(row.username || "").toLowerCase().trim();
          if (!uname || deletedSet.has(uname) || row.status === "deleted" || row.plan_type === "DELETED" || row.notes === "[DELETED]") {
            continue;
          }
          const isPending = row.status === "pending";
          const daysRemaining = isPending ? 0 : row.expires_at ? Math.max(0, Math.ceil((row.expires_at - nowMs) / (24 * 60 * 60 * 1e3))) : null;
          const isExpired = isPending ? false : row.expires_at ? row.expires_at < nowMs : false;
          const item = {
            id: row.id,
            username: uname,
            displayName: row.display_name || void 0,
            pin: "[PROTECTED]",
            role: row.role || "client",
            status: row.status || "active",
            planType: isPending ? "PENDING" : row.plan_type || "30D",
            planLabel: isPending ? "Pendiente de Activaci\xF3n" : row.plan_label || "Pase Mensual",
            createdAt: Number(row.created_at || nowMs),
            expiresAt: isPending ? null : row.expires_at ? Number(row.expires_at) : null,
            boundDeviceId: row.bound_device_id,
            boundDeviceName: row.bound_device_name,
            boundDeviceUpdatedAt: row.bound_device_updated_at,
            lastActiveAt: row.last_active_at ? Number(row.last_active_at) : null,
            whatsappNumber: row.whatsapp_number,
            notes: row.notes,
            daysRemaining,
            isExpired
          };
          mergedMap.set(uname, item);
        }
      }
    } catch (err) {
      console.error("[adminListAppUsers Error]:", err);
    }
  }
  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}
async function adminResetAppUserDevice(userId, username) {
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : "";
  const localUsers = getLocalUsersDb();
  let matchedUsername = cleanUser;
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || cleanUser && u.username === cleanUser) {
      u.boundDeviceId = null;
      u.boundDeviceName = null;
      u.boundDeviceUpdatedAt = null;
      if (!matchedUsername) matchedUsername = u.username;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload = {
        bound_device_id: null,
        bound_device_name: null,
        bound_device_updated_at: null
      };
      if (isValidUuid(userId)) {
        const { error } = await client.from("sportstats_users").update(updatePayload).eq("id", userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client.from("sportstats_users").update(updatePayload).eq("username", matchedUsername);
        if (!error) return true;
      }
    } catch {
    }
  }
  return updatedLocal;
}
async function adminRenewAppUser(userId, addDays, username, mode = "SET") {
  const nowMs = Date.now();
  const isPermanent = Number(addDays) === 0;
  const daysMs = Number(addDays) * 24 * 60 * 60 * 1e3;
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : "";
  let matchedUsername = cleanUser;
  const planType = isPermanent ? "PERMANENT" : Number(addDays) === 1 ? "24H" : `${addDays}D`;
  const planLabel = isPermanent ? "Pase Permanente Vitalicio" : Number(addDays) === 1 ? "Muestra 24 Horas" : `Pase ${addDays} D\xEDas`;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || cleanUser && u.username === cleanUser) {
      if (isPermanent) {
        u.expiresAt = null;
      } else if (mode === "ADD" && u.expiresAt && u.expiresAt > nowMs) {
        u.expiresAt = u.expiresAt + daysMs;
      } else {
        u.expiresAt = nowMs + daysMs;
      }
      u.planType = planType;
      u.planLabel = planLabel;
      u.status = "active";
      if (!matchedUsername) matchedUsername = u.username;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      let newExpiry = null;
      if (!isPermanent) {
        if (mode === "ADD") {
          const query = client.from("sportstats_users").select("expires_at");
          const { data: user } = isValidUuid(userId) ? await query.eq("id", userId).maybeSingle() : await query.eq("username", matchedUsername || userId).maybeSingle();
          newExpiry = nowMs + daysMs;
          if (user && user.expires_at && user.expires_at > nowMs) {
            newExpiry = user.expires_at + daysMs;
          }
        } else {
          newExpiry = nowMs + daysMs;
        }
      }
      const updateData = {
        expires_at: newExpiry,
        plan_type: planType,
        plan_label: planLabel,
        status: "active"
      };
      if (isValidUuid(userId)) {
        const { error } = await client.from("sportstats_users").update(updateData).eq("id", userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client.from("sportstats_users").update(updateData).eq("username", matchedUsername);
        if (!error) return true;
      }
    } catch {
    }
  }
  return updatedLocal;
}
async function adminToggleAppUserStatus(userId, newStatus, username) {
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : "";
  let matchedUsername = cleanUser;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || cleanUser && u.username === cleanUser) {
      u.status = newStatus;
      if (!matchedUsername) matchedUsername = u.username;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      if (isValidUuid(userId)) {
        const { error } = await client.from("sportstats_users").update({ status: newStatus }).eq("id", userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client.from("sportstats_users").update({ status: newStatus }).eq("username", matchedUsername);
        if (!error) return true;
      }
    } catch {
    }
  }
  return updatedLocal;
}
async function adminUpsertAppUser(user) {
  if (!user.username) return false;
  const cleanUser = normalizeUsername(user.username);
  if (!cleanUser) return false;
  const deletedSet = getDeletedUsernamesSet();
  if (deletedSet.has(cleanUser)) {
    deletedSet.delete(cleanUser);
    saveDeletedUsernamesSet(deletedSet);
  }
  const nowMs = Date.now();
  const defaultExpiry = nowMs + 30 * 24 * 60 * 60 * 1e3;
  const localUsers = getLocalUsersDb();
  const existingIdx = localUsers.findIndex((u) => u.username === cleanUser);
  const incomingPin = user.pin && user.pin !== "[PROTECTED]" ? String(user.pin).trim() : "";
  const resolvedPinHash = incomingPin ? hashUserPin(incomingPin) : existingIdx >= 0 ? localUsers[existingIdx].pin : hashUserPin("1234");
  const localRecord = {
    id: existingIdx >= 0 ? localUsers[existingIdx].id : crypto2.randomUUID ? crypto2.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username: cleanUser,
    displayName: user.displayName ? sanitizeText(user.displayName, 60) : existingIdx >= 0 ? localUsers[existingIdx].displayName : void 0,
    pin: resolvedPinHash,
    role: user.role === "admin" ? "admin" : "client",
    status: user.status || "active",
    planType: sanitizeText(user.planType || "30D", 16),
    planLabel: sanitizeText(user.planLabel || "Pase Mensual (30 D\xEDas)", 48),
    createdAt: user.createdAt || (existingIdx >= 0 ? localUsers[existingIdx].createdAt : nowMs),
    expiresAt: user.expiresAt !== void 0 ? user.expiresAt : defaultExpiry,
    boundDeviceId: user.boundDeviceId !== void 0 ? user.boundDeviceId : existingIdx >= 0 ? localUsers[existingIdx].boundDeviceId : null,
    boundDeviceName: user.boundDeviceName !== void 0 ? user.boundDeviceName : existingIdx >= 0 ? localUsers[existingIdx].boundDeviceName : null,
    whatsappNumber: user.whatsappNumber ? sanitizePhone(user.whatsappNumber) : existingIdx >= 0 ? localUsers[existingIdx].whatsappNumber : null,
    notes: user.notes ? sanitizeText(user.notes, 200) : existingIdx >= 0 ? localUsers[existingIdx].notes : null
  };
  if (existingIdx >= 0) {
    localUsers[existingIdx] = localRecord;
  } else {
    localUsers.unshift(localRecord);
  }
  saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      const payloadToUpsert = {
        username: cleanUser,
        display_name: localRecord.displayName || null,
        role: localRecord.role,
        status: localRecord.status,
        plan_type: localRecord.planType,
        plan_label: localRecord.planLabel,
        created_at: localRecord.createdAt,
        expires_at: localRecord.expiresAt,
        bound_device_id: localRecord.boundDeviceId || null,
        bound_device_name: localRecord.boundDeviceName || null,
        whatsapp_number: localRecord.whatsappNumber || null,
        notes: localRecord.notes || null
      };
      if (incomingPin || existingIdx < 0) {
        payloadToUpsert.pin_hash = resolvedPinHash;
      }
      await client.from("sportstats_users").upsert(
        payloadToUpsert,
        { onConflict: "username" }
      );
    } catch {
    }
  }
  return true;
}
async function adminDeleteAppUser(userId, username) {
  const cleanId = String(userId || "").trim();
  const cleanUsername = username ? normalizeUsername(username) : "";
  let matchedUsername = cleanUsername;
  const localUsers = getLocalUsersDb();
  const remaining = [];
  for (const u of localUsers) {
    const uname = String(u.username || "").toLowerCase().trim();
    const isMatch = cleanId && (u.id === cleanId || uname === cleanId.toLowerCase()) || cleanUsername && uname === cleanUsername;
    if (isMatch) {
      if (!matchedUsername && uname) matchedUsername = uname;
    } else {
      remaining.push(u);
    }
  }
  if (remaining.length !== localUsers.length) {
    saveLocalUsersDb(remaining);
  }
  if (!matchedUsername && cleanId && !isValidUuid(cleanId) && !cleanId.startsWith("USR-")) {
    matchedUsername = normalizeUsername(cleanId);
  }
  const client = getSupabaseClient();
  if (client && !matchedUsername && isValidUuid(cleanId)) {
    try {
      const { data: existingRow } = await client.from("sportstats_users").select("username").eq("id", cleanId).maybeSingle();
      if (existingRow?.username) {
        matchedUsername = normalizeUsername(existingRow.username);
      }
    } catch {
    }
  }
  if (matchedUsername) {
    const deletedSet = await hydrateDeletedUsersFromSupabaseIfNeeded();
    deletedSet.add(matchedUsername);
    saveDeletedUsernamesSet(deletedSet, true);
  }
  if (client) {
    try {
      if (isValidUuid(cleanId)) {
        await client.from("sportstats_users").delete().eq("id", cleanId);
      }
      if (matchedUsername) {
        await client.from("sportstats_users").delete().eq("username", matchedUsername);
        await client.from("sportstats_users").delete().ilike("username", matchedUsername);
      }
      const primarySoftDelete = {
        status: "deleted",
        plan_type: "DELETED",
        plan_label: "ELIMINADO",
        notes: "[DELETED]",
        bound_device_id: null
      };
      const fallbackSoftDelete = {
        status: "suspended",
        plan_type: "DELETED",
        plan_label: "ELIMINADO",
        notes: "[DELETED]",
        bound_device_id: null
      };
      if (isValidUuid(cleanId)) {
        const { error } = await client.from("sportstats_users").update(primarySoftDelete).eq("id", cleanId);
        if (error) {
          await client.from("sportstats_users").update(fallbackSoftDelete).eq("id", cleanId);
        }
      }
      if (matchedUsername) {
        const { error } = await client.from("sportstats_users").update(primarySoftDelete).ilike("username", matchedUsername);
        if (error) {
          await client.from("sportstats_users").update(fallbackSoftDelete).ilike("username", matchedUsername);
        }
      }
    } catch (err) {
      console.warn("[adminDeleteAppUser Supabase warning]:", err);
    }
  }
  return true;
}
var SUPABASE_SQL_SCHEMA = `
-- =========================================================================
-- TABLAS OFICIALES PARA SPORTSTATS PRO EN SUPABASE (PostgreSQL)
-- =========================================================================

CREATE TABLE IF NOT EXISTS sportstats_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL CONSTRAINT chk_valid_username CHECK (username ~ '^[a-z0-9]{3,20}$'),
  display_name TEXT,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  status TEXT NOT NULL DEFAULT 'pending',
  plan_type TEXT NOT NULL DEFAULT '30D',
  plan_label TEXT NOT NULL DEFAULT 'Pase Mensual',
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  bound_device_id TEXT,
  bound_device_name TEXT,
  bound_device_updated_at TIMESTAMPTZ,
  last_active_at BIGINT,
  whatsapp_number TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON sportstats_users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON sportstats_users(status);
CREATE INDEX IF NOT EXISTS idx_users_device ON sportstats_users(bound_device_id);

CREATE TABLE IF NOT EXISTS sportstats_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  admin_pin TEXT NOT NULL DEFAULT '120328',
  admin_whatsapp TEXT NOT NULL DEFAULT '573213902708',
  support_name TEXT DEFAULT 'SportStats Pro VIP',
  custom_logo_url TEXT,
  color_theme TEXT DEFAULT 'cyan-emerald',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sportstats_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sportstats_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_users' AND policyname = 'Allow server full access users') THEN
    CREATE POLICY "Allow server full access users" ON sportstats_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_config' AND policyname = 'Allow server full access config') THEN
    CREATE POLICY "Allow server full access config" ON sportstats_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
async function loginOrRegisterGoogleUser(rawEmail, rawDisplayName, deviceId, deviceName, deviceFingerprint) {
  const email = String(rawEmail || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return {
      success: false,
      code: "SERVER_ERROR",
      message: "Correo electr\xF3nico de Google inv\xE1lido."
    };
  }
  const cleanDevice = sanitizeText(String(deviceId || ""), 48).toUpperCase();
  const friendlyDevName = sanitizeText(String(deviceName || "Dispositivo Web / M\xF3vil"), 80);
  const nowMs = Date.now();
  const isOwnerAdmin = email === "dgcontrerasb@gmail.com" || email === "dgcontreras@gmail.com" || email.startsWith("dgcontreras");
  if (isOwnerAdmin) {
    const sessionToken = createSessionJwt({
      userId: "admin-owner",
      username: "admin",
      role: "admin",
      deviceId: cleanDevice,
      ttlDays: 30
    });
    return {
      success: true,
      isPro: true,
      message: "Acceso de Administrador verificado con Google",
      sessionToken,
      user: {
        id: "admin-owner",
        username: "admin",
        email,
        displayName: "Geovanny Contreras (Propietario)",
        pin: "[PROTECTED]",
        role: "admin",
        status: "active",
        planType: "PERMANENT",
        planLabel: "Acceso Propietario Ilimitado",
        createdAt: nowMs,
        expiresAt: null,
        boundDeviceId: cleanDevice,
        boundDeviceName: friendlyDevName,
        whatsappNumber: "573213902708",
        lastActiveAt: nowMs,
        isPro: true,
        isExpired: false,
        authProvider: "google",
        feedbackBonusClaimed: true
      }
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      code: "SERVER_ERROR",
      message: "Error de conexi\xF3n con el servidor de autenticaci\xF3n."
    };
  }
  try {
    const { data: existingUser } = await client.from("sportstats_users").select("*").ilike("email", email).maybeSingle();
    if (existingUser) {
      if (existingUser.status === "suspended") {
        return { success: false, code: "SUSPENDED", message: "Tu cuenta ha sido suspendida. Contacta al administrador." };
      }
      if (existingUser.status === "deleted") {
        return { success: false, code: "USER_NOT_FOUND", message: "Esta cuenta ha sido eliminada por el administrador." };
      }
      const isLocalOrDev2 = process.env.NODE_ENV !== "production" || !process.env.VERCEL;
      const isAdminTestDevice2 = isLocalOrDev2 || cleanDevice.startsWith("DEV-");
      if (!existingUser.bound_device_id || isAdminTestDevice2 && existingUser.bound_device_id !== cleanDevice) {
        await client.from("sportstats_users").update({
          bound_device_id: cleanDevice,
          bound_device_name: friendlyDevName,
          last_active_at: nowMs
        }).eq("id", existingUser.id);
        existingUser.bound_device_id = cleanDevice;
      } else if (existingUser.bound_device_id !== cleanDevice) {
        return {
          success: false,
          code: "DEVICE_LOCKED",
          message: `Esta cuenta ya est\xE1 vinculada a otro dispositivo (${existingUser.bound_device_name || "dispositivo principal"}).`,
          boundDeviceName: existingUser.bound_device_name
        };
      }
      const isExpired = Boolean(existingUser.expires_at && Number(existingUser.expires_at) < nowMs);
      const isPro2 = !isExpired;
      const sessionToken2 = createSessionJwt({
        userId: existingUser.id,
        username: existingUser.username,
        role: existingUser.role || "client",
        deviceId: cleanDevice,
        ttlDays: 30
      });
      return {
        success: true,
        isPro: isPro2,
        message: isPro2 ? "Sesi\xF3n iniciada con \xE9xito." : "Tu periodo de prueba o plan ha vencido.",
        sessionToken: sessionToken2,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          displayName: existingUser.display_name || rawDisplayName,
          pin: "[PROTECTED]",
          role: existingUser.role || "client",
          status: isExpired ? "expired" : existingUser.status || "active",
          planType: existingUser.plan_type || "GOOGLE_TRIAL",
          planLabel: existingUser.plan_label || (isPro2 ? "Plan VIP" : "Plan Vencido"),
          createdAt: Number(existingUser.created_at) || nowMs,
          expiresAt: existingUser.expires_at ? Number(existingUser.expires_at) : null,
          boundDeviceId: existingUser.bound_device_id,
          boundDeviceName: existingUser.bound_device_name,
          whatsappNumber: existingUser.whatsapp_number,
          feedbackBonusClaimed: Boolean(existingUser.feedback_bonus_claimed),
          lastActiveAt: nowMs,
          isPro: isPro2,
          isExpired,
          authProvider: "google"
        }
      };
    }
    const isLocalOrDev = process.env.NODE_ENV !== "production" || !process.env.VERCEL;
    const isAdminTestDevice = isLocalOrDev || cleanDevice.startsWith("DEV-");
    let hasUsedTrial = false;
    if (!isAdminTestDevice && cleanDevice) {
      const { data: deviceUser } = await client.from("sportstats_users").select("id, username").eq("bound_device_id", cleanDevice).limit(1).maybeSingle();
      if (deviceUser) {
        hasUsedTrial = true;
      }
    }
    const expiresAt = hasUsedTrial ? nowMs : nowMs + 3 * 24 * 60 * 60 * 1e3;
    const isPro = !hasUsedTrial;
    const planLabel = hasUsedTrial ? "Prueba no disponible (Dispositivo previo)" : "Prueba Gratuita (3 D\xEDas)";
    const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "user";
    const randPart = Math.random().toString(36).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4);
    let generatedUsername = `${baseUsername}${randPart}`.slice(0, 20);
    if (generatedUsername.length < 3) {
      generatedUsername = `user${Math.floor(100 + Math.random() * 900)}`;
    }
    const newUserData = {
      username: generatedUsername,
      email,
      display_name: rawDisplayName || email.split("@")[0],
      pin_hash: "GOOGLE_OAUTH",
      role: "client",
      status: isPro ? "active" : "expired",
      plan_type: hasUsedTrial ? "EXPIRED_TRIAL" : "GOOGLE_3D_TRIAL",
      plan_label: planLabel,
      created_at: nowMs,
      expires_at: expiresAt,
      bound_device_id: cleanDevice,
      bound_device_name: friendlyDevName,
      auth_provider: "google",
      feedback_bonus_claimed: false,
      device_fingerprint: deviceFingerprint || cleanDevice
    };
    const { data: insertedUser, error: insertError } = await client.from("sportstats_users").insert(newUserData).select().single();
    if (insertError) {
      console.error("[Supabase Google Register Error]:", insertError.message);
      return {
        success: false,
        code: "SERVER_ERROR",
        message: `No fue posible registrar tu cuenta de Google: ${insertError.message}`
      };
    }
    const sessionToken = createSessionJwt({
      userId: insertedUser.id,
      username: insertedUser.username,
      role: "client",
      deviceId: cleanDevice,
      ttlDays: 30
    });
    return {
      success: true,
      isPro,
      message: isPro ? "\xA1Bienvenido! Tienes 3 d\xEDas de prueba gratuita completa." : "Tu dispositivo ya utiliz\xF3 una prueba previa. Activa tu plan VIP para acceder a todos los an\xE1lisis.",
      sessionToken,
      user: {
        id: insertedUser.id,
        username: insertedUser.username,
        email: insertedUser.email,
        displayName: insertedUser.display_name,
        pin: "[PROTECTED]",
        role: "client",
        status: insertedUser.status,
        planType: insertedUser.plan_type,
        planLabel: insertedUser.plan_label,
        createdAt: Number(insertedUser.created_at),
        expiresAt: Number(insertedUser.expires_at),
        boundDeviceId: insertedUser.bound_device_id,
        boundDeviceName: insertedUser.bound_device_name,
        whatsappNumber: null,
        feedbackBonusClaimed: false,
        lastActiveAt: nowMs,
        isPro,
        isExpired: !isPro,
        authProvider: "google"
      }
    };
  } catch (err) {
    console.error("[Supabase Google Auth Error]:", err);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: err?.message || "Error inesperado durante la autenticaci\xF3n con Google."
    };
  }
}
async function redeemActivationCode(code, userIdentifier) {
  const cleanCode = String(code || "").trim().toUpperCase();
  const cleanUser = String(userIdentifier || "").trim();
  if (!cleanCode || cleanCode.length < 5) {
    return { success: false, message: "C\xF3digo de activaci\xF3n inv\xE1lido." };
  }
  if (!cleanUser) {
    return { success: false, message: "Usuario no identificado." };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: "Error de conexi\xF3n con el servidor." };
  }
  try {
    const codeVariant1 = cleanCode.replace(/0/g, "O");
    const codeVariant2 = cleanCode.replace(/O/g, "0");
    const { data: codeData, error: codeErr } = await client.from("sportstats_activation_codes").select("*").in("code", [cleanCode, codeVariant1, codeVariant2]).eq("is_used", false).maybeSingle();
    if (codeErr || !codeData) {
      return { success: false, message: "El c\xF3digo ingresado no existe o ya fue utilizado." };
    }
    let userData = null;
    if (cleanUser.includes("@")) {
      const { data } = await client.from("sportstats_users").select("*").ilike("email", cleanUser).maybeSingle();
      if (data) userData = data;
    }
    if (!userData) {
      const { data } = await client.from("sportstats_users").select("*").ilike("username", cleanUser.toLowerCase()).maybeSingle();
      if (data) userData = data;
    }
    if (!userData) {
      const { data } = await client.from("sportstats_users").select("*").ilike("display_name", cleanUser).maybeSingle();
      if (data) userData = data;
    }
    if (!userData) {
      const { data } = await client.from("sportstats_users").select("*").eq("id", cleanUser).maybeSingle();
      if (data) userData = data;
    }
    if (!userData) {
      return { success: false, message: "Usuario no encontrado en la base de datos." };
    }
    const nowMs = Date.now();
    const daysToAdd = Number(codeData.days) || 30;
    const msToAdd = daysToAdd * 24 * 60 * 60 * 1e3;
    const baseTimestamp = userData.expires_at && Number(userData.expires_at) > nowMs ? Number(userData.expires_at) : nowMs;
    const newExpiresAt = baseTimestamp + msToAdd;
    await client.from("sportstats_activation_codes").update({
      is_used: true,
      used_by: userData.email || userData.username,
      used_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", codeData.id);
    await client.from("sportstats_users").update({
      expires_at: newExpiresAt,
      status: "active",
      plan_type: `VIP_${daysToAdd}D`,
      plan_label: `Plan VIP (${daysToAdd} D\xEDas)`,
      last_active_at: nowMs
    }).eq("id", userData.id);
    return {
      success: true,
      message: `\xA1C\xF3digo canjeado con \xE9xito! Se activaron ${daysToAdd} d\xEDas en tu Plan VIP.`,
      newExpiresAt
    };
  } catch (err) {
    console.error("[Redeem Code Error]:", err);
    return { success: false, message: "Error interno al procesar el c\xF3digo de activaci\xF3n." };
  }
}
async function claimFeedbackBonus(userIdentifier) {
  const cleanUser = String(userIdentifier || "").trim();
  if (!cleanUser) {
    return { success: false, message: "Usuario no identificado." };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: "Error de conexi\xF3n con el servidor." };
  }
  try {
    const isEmail = cleanUser.includes("@");
    let userQuery = client.from("sportstats_users").select("*");
    if (isEmail) {
      userQuery = userQuery.ilike("email", cleanUser);
    } else {
      userQuery = userQuery.eq("username", cleanUser.toLowerCase());
    }
    const { data: userData, error: userErr } = await userQuery.maybeSingle();
    if (userErr || !userData) {
      return { success: false, message: "Usuario no encontrado." };
    }
    if (userData.feedback_bonus_claimed) {
      return { success: false, message: "Ya has reclamado previamente tu d\xEDa adicional por feedback." };
    }
    const nowMs = Date.now();
    const msToAdd = 24 * 60 * 60 * 1e3;
    const baseTimestamp = userData.expires_at && Number(userData.expires_at) > nowMs ? Number(userData.expires_at) : nowMs;
    const newExpiresAt = baseTimestamp + msToAdd;
    await client.from("sportstats_users").update({
      expires_at: newExpiresAt,
      status: "active",
      feedback_bonus_claimed: true,
      last_active_at: nowMs
    }).eq("id", userData.id);
    return {
      success: true,
      message: "\xA1Muchas gracias por tu opini\xF3n! Se ha sumado 1 d\xEDa adicional a tu cuenta.",
      newExpiresAt
    };
  } catch (err) {
    console.error("[Feedback Bonus Error]:", err);
    return { success: false, message: "Error al aplicar el bono de feedback." };
  }
}
async function adminGenerateActivationCode(days = 30) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: "Sin conexi\xF3n a base de datos" };
  try {
    const CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let rand = "";
    for (let i = 0; i < 8; i++) {
      rand += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    const code = `VIP-${rand.slice(0, 4)}${rand.slice(4, 8)}-${days}D`;
    const { error } = await client.from("sportstats_activation_codes").insert({
      code,
      days,
      is_used: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, code };
  } catch (err) {
    return { success: false, error: "Error al generar c\xF3digo" };
  }
}
async function adminListActivationCodes() {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data } = await client.from("sportstats_activation_codes").select("*").order("created_at", { ascending: false }).limit(50);
    return data || [];
  } catch {
    return [];
  }
}

// server.ts
dotenv.config();
process.on("uncaughtException", (err) => {
  console.error("[Process uncaughtException Protected]:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Process unhandledRejection Protected]:", reason);
});
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(securityHeadersMiddleware);
app.use(idempotencyMiddleware);
var IS_VERCEL2 = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
var CACHE_DIR = IS_VERCEL2 ? path2.resolve("/tmp", ".cache") : path2.resolve(process.cwd(), ".cache");
var CACHE_FILE = path2.resolve(CACHE_DIR, "api_football_cache.json");
if (IS_VERCEL2) {
  app.use((req, _res, next) => {
    if (req.url && !req.url.startsWith("/api")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    next();
  });
}
app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});
var memoryCache = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
var lastRemainingCalls = 100;
var quotaShieldActive = false;
var QUOTA_SHIELD_THRESHOLD = 15;
var apiFootballAuditLog = [];
var activeOnlineSessions = /* @__PURE__ */ new Map();
var ONLINE_WINDOW_MS = 3 * 60 * 1e3;
var peakOnlineUsers = 1;
var peakOnlineAt = (/* @__PURE__ */ new Date()).toISOString();
var serverCacheHits = 0;
var serverCacheMisses = 0;
var espnPulseCallsCount = 0;
var supabaseTelemetryHydrated = false;
var serverBootTimeIso = (/* @__PURE__ */ new Date()).toISOString();
function purgeExpiredOnlineSessions() {
  const now = Date.now();
  activeOnlineSessions.forEach((entry, key) => {
    if (now - entry.lastSeenAt > ONLINE_WINDOW_MS) {
      activeOnlineSessions.delete(key);
    }
  });
}
async function hydrateTelemetryFromSupabaseIfNeeded() {
  if (supabaseTelemetryHydrated) return;
  supabaseTelemetryHydrated = true;
  if (!isSupabaseConfigured()) return;
  try {
    const remote = await getSupabaseKvCache("__server_telemetry_v1__");
    if (remote && remote.data && typeof remote.data === "object") {
      const d = remote.data;
      if (typeof d.peakOnlineUsers === "number" && d.peakOnlineUsers > peakOnlineUsers) {
        peakOnlineUsers = d.peakOnlineUsers;
        if (d.peakOnlineAt) peakOnlineAt = d.peakOnlineAt;
      }
      if (typeof d.lastRemainingCalls === "number" && lastRemainingCalls === 100) {
        lastRemainingCalls = d.lastRemainingCalls;
        quotaShieldActive = lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD;
      }
      if (Array.isArray(d.apiFootballAuditLog) && apiFootballAuditLog.length === 0) {
        apiFootballAuditLog.push(...d.apiFootballAuditLog.slice(0, 30));
      }
      if (typeof d.serverCacheHits === "number" && serverCacheHits < d.serverCacheHits) {
        serverCacheHits = d.serverCacheHits;
      }
      if (typeof d.serverCacheMisses === "number" && serverCacheMisses < d.serverCacheMisses) {
        serverCacheMisses = d.serverCacheMisses;
      }
      if (typeof d.espnPulseCallsCount === "number" && espnPulseCallsCount < d.espnPulseCallsCount) {
        espnPulseCallsCount = d.espnPulseCallsCount;
      }
    }
  } catch {
  }
}
function saveTelemetrySnapshotToCache(syncToSupabase = false) {
  const snapshot = {
    peakOnlineUsers,
    peakOnlineAt,
    lastRemainingCalls,
    apiFootballAuditLog,
    serverCacheHits,
    serverCacheMisses,
    espnPulseCallsCount
  };
  setCacheItem("__server_telemetry_v1__", snapshot);
  if (syncToSupabase && isSupabaseConfigured()) {
    setSupabaseKvCache("__server_telemetry_v1__", snapshot).catch(() => {
    });
  }
}
function recordOnlinePresence(opts) {
  purgeExpiredOnlineSessions();
  const cleanUser = (opts.username || "").trim().toLowerCase();
  const cleanDev = (opts.deviceId || "").trim().toUpperCase();
  const sessionKey = cleanDev || cleanUser || `anon_${Date.now()}`;
  const existing = activeOnlineSessions.get(sessionKey);
  activeOnlineSessions.set(sessionKey, {
    sessionKey,
    username: cleanUser || existing?.username || "usuario",
    displayName: (opts.displayName || "").trim() || existing?.displayName || cleanUser || "Cliente Activo",
    deviceId: cleanDev || existing?.deviceId || "WEB",
    deviceInfo: (opts.deviceInfo || "").trim() || existing?.deviceInfo || "Navegador Web",
    lastSeenAt: Date.now()
  });
  const currentCount = activeOnlineSessions.size;
  if (currentCount > peakOnlineUsers) {
    peakOnlineUsers = currentCount;
    peakOnlineAt = (/* @__PURE__ */ new Date()).toISOString();
    saveTelemetrySnapshotToCache(true);
  }
}
function getActiveOnlineUsersList() {
  purgeExpiredOnlineSessions();
  const now = Date.now();
  return Array.from(activeOnlineSessions.values()).map((s) => ({
    ...s,
    deviceName: s.deviceInfo || s.deviceId,
    secondsAgo: Math.max(0, Math.round((now - s.lastSeenAt) / 1e3))
  })).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
function initDiskCache() {
  try {
    if (!fs2.existsSync(CACHE_DIR)) {
      fs2.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs2.existsSync(CACHE_FILE)) {
      const raw = fs2.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && "timestamp" in v && "data" in v) {
            const dataVal = v.data;
            if (Array.isArray(dataVal) && dataVal.length === 0) {
              continue;
            }
            memoryCache.set(k, v);
          }
        }
      }
      const savedTele = memoryCache.get("__server_telemetry_v1__")?.data;
      if (savedTele && typeof savedTele === "object") {
        if (typeof savedTele.peakOnlineUsers === "number" && savedTele.peakOnlineUsers > peakOnlineUsers) {
          peakOnlineUsers = savedTele.peakOnlineUsers;
          if (savedTele.peakOnlineAt) peakOnlineAt = savedTele.peakOnlineAt;
        }
        if (typeof savedTele.lastRemainingCalls === "number") {
          lastRemainingCalls = savedTele.lastRemainingCalls;
          quotaShieldActive = lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD;
        }
        if (Array.isArray(savedTele.apiFootballAuditLog)) {
          apiFootballAuditLog.splice(0, apiFootballAuditLog.length, ...savedTele.apiFootballAuditLog.slice(0, 30));
        }
        if (typeof savedTele.serverCacheHits === "number") serverCacheHits = savedTele.serverCacheHits;
        if (typeof savedTele.serverCacheMisses === "number") serverCacheMisses = savedTele.serverCacheMisses;
        if (typeof savedTele.espnPulseCallsCount === "number") espnPulseCallsCount = savedTele.espnPulseCallsCount;
      }
      console.log(`[Cache] Cargadas ${memoryCache.size} entradas de cach\xE9 persistente en disco.`);
    }
  } catch (err) {
    console.warn("[Cache] No se pudo cargar cach\xE9 desde disco:", err);
  }
}
initDiskCache();
var persistTimeout = null;
function writeDiskCacheNow() {
  try {
    if (!fs2.existsSync(CACHE_DIR)) {
      fs2.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const dump = {};
    memoryCache.forEach((val, key) => {
      if (Array.isArray(val.data) && val.data.length === 0) return;
      dump[key] = val;
    });
    fs2.writeFileSync(CACHE_FILE, JSON.stringify(dump), "utf8");
  } catch (err) {
    console.warn("[Cache] Error al guardar cach\xE9 en disco:", err);
  }
}
function persistCacheToDisk() {
  if (IS_VERCEL2) {
    writeDiskCacheNow();
    return;
  }
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(writeDiskCacheNow, 250);
}
function getCacheItem(key) {
  const rec = memoryCache.get(key);
  if (rec && Array.isArray(rec.data) && rec.data.length === 0) {
    memoryCache.delete(key);
    return void 0;
  }
  return rec;
}
function setCacheItem(key, data) {
  if (Array.isArray(data) && data.length === 0) {
    return;
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
  persistCacheToDisk();
}
function updateQuotaFromHeaders(headers) {
  const rem = headers.get("x-ratelimit-requests-remaining");
  if (rem) {
    const val = parseInt(rem, 10);
    if (!isNaN(val)) {
      lastRemainingCalls = val;
      quotaShieldActive = val <= QUOTA_SHIELD_THRESHOLD;
    }
  }
}
async function runSingleFlight(key, fn) {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing;
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
function getSecretKey(keyName) {
  const envVal = process.env[keyName];
  if (envVal && envVal.trim()) {
    return envVal.trim();
  }
  try {
    const envPath = path2.resolve(process.cwd(), ".env");
    if (fs2.existsSync(envPath)) {
      const content = fs2.readFileSync(envPath, "utf8");
      const regex = new RegExp(`${keyName}=["']?([^"'\\r\\n]+)["']?`);
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
  }
  return "";
}
function getSecretApiKey() {
  return getSecretKey("API_FOOTBALL_KEY");
}
function getColombiaDateStr(offsetDays = 0, timeZone = "America/Bogota") {
  const d = /* @__PURE__ */ new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  }
}
var ESPN_LEAGUE_CATALOG = {
  "700": { id: 39, name: "Premier League", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3920": { id: 48, name: "EFL Cup (Carabao Cup)", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3915": { id: 40, name: "EFL Championship", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3916": { id: 41, name: "EFL League One", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3917": { id: 42, name: "EFL League Two", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "740": { id: 140, name: "LaLiga EA Sports", country: "Espa\xF1a", flag: "\u{1F1EA}\u{1F1F8}" },
  "3951": { id: 143, name: "Copa del Rey", country: "Espa\xF1a", flag: "\u{1F1EA}\u{1F1F8}" },
  "3921": { id: 141, name: "LaLiga Hypermotion", country: "Espa\xF1a", flag: "\u{1F1EA}\u{1F1F8}" },
  "730": { id: 135, name: "Serie A", country: "Italia", flag: "\u{1F1EE}\u{1F1F9}" },
  "3931": { id: 136, name: "Serie B", country: "Italia", flag: "\u{1F1EE}\u{1F1F9}" },
  "720": { id: 78, name: "Bundesliga", country: "Alemania", flag: "\u{1F1E9}\u{1F1EA}" },
  "3954": { id: 81, name: "DFB-Pokal", country: "Alemania", flag: "\u{1F1E9}\u{1F1EA}" },
  "3927": { id: 79, name: "2. Bundesliga", country: "Alemania", flag: "\u{1F1E9}\u{1F1EA}" },
  "710": { id: 61, name: "Ligue 1", country: "Francia", flag: "\u{1F1EB}\u{1F1F7}" },
  "3926": { id: 62, name: "Ligue 2", country: "Francia", flag: "\u{1F1EB}\u{1F1F7}" },
  "715": { id: 94, name: "Primeira Liga", country: "Portugal", flag: "\u{1F1F5}\u{1F1F9}" },
  "725": { id: 88, name: "Eredivisie", country: "Pa\xEDses Bajos", flag: "\u{1F1F3}\u{1F1F1}" },
  "3957": { id: 90, name: "KNVB Beker", country: "Pa\xEDses Bajos", flag: "\u{1F1F3}\u{1F1F1}" },
  "735": { id: 179, name: "Scottish Premiership", country: "Escocia", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}" },
  "3901": { id: 144, name: "Pro League", country: "B\xE9lgica", flag: "\u{1F1E7}\u{1F1EA}" },
  "3946": { id: 203, name: "S\xFCper Lig", country: "Turqu\xEDa", flag: "\u{1F1F9}\u{1F1F7}" },
  "650": { id: 239, name: "Liga BetPlay Dimayor", country: "Colombia", flag: "\u{1F1E8}\u{1F1F4}" },
  "745": { id: 128, name: "Liga Profesional Argentina", country: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  "630": { id: 71, name: "Brasileir\xE3o S\xE9rie A", country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  "4007": { id: 72, name: "Brasileir\xE3o S\xE9rie B", country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  "640": { id: 265, name: "Primera Divisi\xF3n", country: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  "670": { id: 281, name: "Liga 1", country: "Per\xFA", flag: "\u{1F1F5}\u{1F1EA}" },
  "660": { id: 242, name: "LigaPro", country: "Ecuador", flag: "\u{1F1EA}\u{1F1E8}" },
  "680": { id: 268, name: "Campeonato Uruguayo", country: "Uruguay", flag: "\u{1F1FA}\u{1F1FE}" },
  "3934": { id: 250, name: "Primera Divisi\xF3n", country: "Paraguay", flag: "\u{1F1F5}\u{1F1FE}" },
  "3949": { id: 299, name: "Liga FUTVE", country: "Venezuela", flag: "\u{1F1FB}\u{1F1EA}" },
  "620": { id: 344, name: "Divisi\xF3n Profesional", country: "Bolivia", flag: "\u{1F1E7}\u{1F1F4}" },
  "760": { id: 262, name: "Liga MX", country: "M\xE9xico", flag: "\u{1F1F2}\u{1F1FD}" },
  "770": { id: 253, name: "MLS", country: "Estados Unidos", flag: "\u{1F1FA}\u{1F1F8}" },
  "21231": { id: 307, name: "Saudi Pro League", country: "Arabia Saudita", flag: "\u{1F1F8}\u{1F1E6}" },
  "3902": { id: 17, name: "AFC Champions League Elite", country: "Internacional", flag: "\u{1F30F}" },
  "2391": { id: 12, name: "CAF Champions League", country: "Internacional", flag: "\u{1F30D}" },
  "18000": { id: 20, name: "CAF Confederation Cup", country: "Internacional", flag: "\u{1F30D}" }
};
var COUNTRY_TRANSLATION_MAP = {
  England: { country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  Spain: { country: "Espa\xF1a", flag: "\u{1F1EA}\u{1F1F8}" },
  Italy: { country: "Italia", flag: "\u{1F1EE}\u{1F1F9}" },
  Germany: { country: "Alemania", flag: "\u{1F1E9}\u{1F1EA}" },
  France: { country: "Francia", flag: "\u{1F1EB}\u{1F1F7}" },
  Netherlands: { country: "Pa\xEDses Bajos", flag: "\u{1F1F3}\u{1F1F1}" },
  Portugal: { country: "Portugal", flag: "\u{1F1F5}\u{1F1F9}" },
  Scotland: { country: "Escocia", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}" },
  Belgium: { country: "B\xE9lgica", flag: "\u{1F1E7}\u{1F1EA}" },
  Colombia: { country: "Colombia", flag: "\u{1F1E8}\u{1F1F4}" },
  Argentina: { country: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  Brazil: { country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  Chile: { country: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  Peru: { country: "Per\xFA", flag: "\u{1F1F5}\u{1F1EA}" },
  Ecuador: { country: "Ecuador", flag: "\u{1F1EA}\u{1F1E8}" },
  Uruguay: { country: "Uruguay", flag: "\u{1F1FA}\u{1F1FE}" },
  Paraguay: { country: "Paraguay", flag: "\u{1F1F5}\u{1F1FE}" },
  Venezuela: { country: "Venezuela", flag: "\u{1F1FB}\u{1F1EA}" },
  Bolivia: { country: "Bolivia", flag: "\u{1F1E7}\u{1F1F4}" },
  Mexico: { country: "M\xE9xico", flag: "\u{1F1F2}\u{1F1FD}" },
  USA: { country: "Estados Unidos", flag: "\u{1F1FA}\u{1F1F8}" }
};
function normalizeTeamKey(name) {
  return (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|cf|sc|ac|cd|ud|sd|rcd|fk|pfk|sk|bk|if|ik|sv|vfb|tsg|fsv|club|deportivo|atletico|athletic|real|sporting|unidos|united|city|town|rovers|wanderers|al|el|de|del|la|las|los|sad|baku|jeddah|riyadh)\b/g, "").replace(/[^a-z0-9]/g, "").trim();
}
function singleTeamFuzzyMatch(k1, k2) {
  if (!k1 || !k2) return false;
  if (k1 === k2 || k1.includes(k2) || k2.includes(k1)) return true;
  if (k1.length >= 5 && k2.length >= 5 && k1.slice(0, 5) === k2.slice(0, 5)) return true;
  return false;
}
function teamsFuzzyMatch(hKey1, aKey1, hKey2, aKey2) {
  if (!hKey1 || !aKey1 || !hKey2 || !aKey2) return false;
  const homeMatch = singleTeamFuzzyMatch(hKey1, hKey2);
  const awayMatch = singleTeamFuzzyMatch(aKey1, aKey2);
  return homeMatch && awayMatch;
}
function estimateRealisticSoccerClock(minsSinceStart, rawStatusShort, reportedElapsed) {
  const st = String(rawStatusShort || "").toUpperCase().trim();
  if (st === "HT" || st === "BT" || st === "INT") {
    return { minute: 45, isHalfTime: true, statusShort: "HT" };
  }
  if (["FT", "AET", "PEN"].includes(st)) {
    return { minute: 90, isHalfTime: false, statusShort: "FT" };
  }
  if ((st === "1H" || st === "2H" || st === "ET" || st === "LIVE") && typeof reportedElapsed === "number" && reportedElapsed > 0) {
    return {
      minute: Math.min(90, Math.max(1, reportedElapsed)),
      isHalfTime: false,
      statusShort: st
    };
  }
  if (minsSinceStart <= 0) {
    return { minute: 1, isHalfTime: false, statusShort: "NS" };
  }
  if (minsSinceStart <= 47) {
    return { minute: Math.min(45, Math.max(1, Math.floor(minsSinceStart))), isHalfTime: false, statusShort: "1H" };
  }
  if (minsSinceStart <= 64) {
    return { minute: 45, isHalfTime: true, statusShort: "HT" };
  }
  const secondHalfMin = 45 + Math.floor(minsSinceStart - 64);
  return {
    minute: Math.min(90, Math.max(46, secondHalfMin)),
    isHalfTime: false,
    statusShort: "2H"
  };
}
function parseClockMinute(rawClock, fallbackMin = 45) {
  const str = String(rawClock || "").trim();
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
function getStatNumber(statsArr, statName, fallback = 0) {
  if (!Array.isArray(statsArr)) return fallback;
  const item = statsArr.find(
    (s) => String(s?.name || "").toLowerCase() === statName.toLowerCase() || String(s?.abbreviation || "").toLowerCase() === statName.toLowerCase()
  );
  if (!item) return fallback;
  const val = parseFloat(String(item.displayValue ?? item.value ?? fallback));
  return isNaN(val) ? fallback : val;
}
function reconcileCornerEvents(existingEvents, homeCorners, awayCorners, homeName, awayName, currentMinute) {
  const currentHomeCorners = existingEvents.filter((e) => e.type === "CORNER" && e.teamSide === "HOME").length;
  const currentAwayCorners = existingEvents.filter((e) => e.type === "CORNER" && e.teamSide === "AWAY").length;
  const missingHome = Math.max(0, homeCorners - currentHomeCorners);
  const missingAway = Math.max(0, awayCorners - currentAwayCorners);
  const maxMin = Math.max(10, currentMinute || 45);
  const added = [];
  for (let i = 0; i < missingHome; i++) {
    const min = Math.max(3, Math.min(maxMin, Math.round((i + 1) / (missingHome + 1) * maxMin)));
    added.push({
      id: `corner_home_sync_${i + 1}_${min}`,
      minute: min,
      displayMinute: `${min}'`,
      type: "CORNER",
      teamSide: "HOME",
      teamName: homeName,
      detail: `Tiro de esquina a favor de ${homeName}`
    });
  }
  for (let i = 0; i < missingAway; i++) {
    const min = Math.max(4, Math.min(maxMin, Math.round((i + 1) / (missingAway + 1) * maxMin)));
    added.push({
      id: `corner_away_sync_${i + 1}_${min}`,
      minute: min,
      displayMinute: `${min}'`,
      type: "CORNER",
      teamSide: "AWAY",
      teamName: awayName,
      detail: `Tiro de esquina a favor de ${awayName}`
    });
  }
  return [...existingEvents, ...added].sort((a, b) => b.minute - a.minute);
}
function resolveServerPlayerName(rawName, teamName, index = 9, isSub = false) {
  const candidate = String(rawName || "").trim();
  const cleanTeam = String(teamName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanCand = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (candidate.length >= 3 && !/^(jugador|goleador|player|titular|suplente|delantero|local|visitante)\b/i.test(candidate) && !/#\d+/.test(candidate) && cleanCand !== cleanTeam) {
    return candidate;
  }
  let hash = 0;
  const str = `${teamName}_${index}_${isSub ? "sub" : "starter"}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const isFemale = /w\b|women|femenino|femenil|u17 w|u20 w/i.test(teamName);
  const isLatin = /chile|colombia|argentina|spain|españa|mexico|méxico|brazil|brasil|uruguay|paraguay|peru|perú|ecuador|venezuela|costa rica|nicaragua|honduras|guatemala|salvador|panama|bolivia|jalapa|managua|unan|dirian|esteli|real|deportivo|municipal|atletico|atlético|alianza|independiente|universidad|nacional|olimpia|saprissa|alajuelense|herediano|motagua|comunicaciones|millonarios|santa fe|junior|medellin|cali|america|tolima|bucaramanga|once caldas|pereira|pasto|envigado|equidad|fortaleza|llaneros|boca|river|racing|velez|talleres|lanus|belgrano|flamengo|palmeiras|botafogo|corinthians|sao paulo|gremio|cruzeiro|vasco|bahia|fluminense|santos|cruz azul|toluca|monterrey|tigres|pumas|chivas|guadalajara|atlas|pachuca|leon|sevilla|valencia|betis|villarreal|athletic|sociedad|osasuna|celta|girona|espanyol|benfica|porto|sporting|braga/i.test(
    teamName
  );
  if (isFemale) {
    const firstList2 = isLatin ? ["Ana\xEDs", "Catalina", "Monserrat", "Valeria", "Camila", "Sof\xEDa", "Martina", "Isabella", "Luc\xEDa", "Valentina", "Pau", "Celia", "Aiara", "Ainoa", "Irune", "Paloma", "Natsumy", "Vaitiare", "Daniela", "Fernanda", "Maitte", "Nicole", "Claudia"] : ["Emma", "Olivia", "Sophia", "Ava", "Isla", "Mia", "Charlotte", "Grace", "Chloe", "Ella", "Hannah", "Zoe", "Freya", "Maya", "Nora", "Lucy", "Lily"];
    const lastList2 = isLatin ? ["Figueroa", "\xC1lvarez", "Cifuentes", "Mellado", "Gonz\xE1lez", "Tapia", "Bustamante", "Carter", "Comendador", "Segura", "Garc\xEDa", "Mart\xEDnez", "Rodr\xEDguez", "L\xF3pez", "Hern\xE1ndez", "Silva", "Morales", "Vargas", "Rojas", "Castro"] : ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "White", "Harris"];
    return `${firstList2[posHash % firstList2.length]} ${lastList2[(posHash >> 2) % lastList2.length]}`;
  }
  const firstList = isLatin ? ["Mateo", "Santiago", "Sebasti\xE1n", "Alejandro", "Diego", "Lucas", "Nicol\xE1s", "Joaqu\xEDn", "Gabriel", "Tom\xE1s", "Javier", "Carlos", "Andr\xE9s", "Felipe", "Emanuel", "Rodrigo", "Gonzalo", "Mat\xEDas", "Esteban", "\xC1lvaro", "Marcos", "Franco", "Ignacio"] : ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Marcus", "Brandon", "Justin", "Tyler", "Austin"];
  const lastList = isLatin ? ["Gonz\xE1lez", "Rodr\xEDguez", "G\xF3mez", "Fern\xE1ndez", "L\xF3pez", "D\xEDaz", "Mart\xEDnez", "P\xE9rez", "Garc\xEDa", "S\xE1nchez", "Romero", "Sosa", "Torres", "\xC1lvarez", "Ruiz", "Ram\xEDrez", "Flores", "Ben\xEDtez", "Acosta", "Medina"] : ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Clark"];
  return `${firstList[posHash % firstList.length]} ${lastList[(posHash >> 2) % lastList.length]}`;
}
function extractEspnScoreboardTelemetry(ev, comp, homeComp, awayComp, homeName, awayName, elapsedMin, isFinished) {
  const homeStatsArr = Array.isArray(homeComp?.statistics) ? homeComp.statistics : [];
  const awayStatsArr = Array.isArray(awayComp?.statistics) ? awayComp.statistics : [];
  const homeTeamIdStr = String(homeComp?.team?.id || homeComp?.id || "");
  const awayTeamIdStr = String(awayComp?.team?.id || awayComp?.id || "");
  const details = Array.isArray(comp?.details) ? comp.details : [];
  let detailHomeYellow = 0;
  let detailAwayYellow = 0;
  let detailHomeRed = 0;
  let detailAwayRed = 0;
  const events = [
    {
      id: `kickoff_${ev?.id || "match"}`,
      minute: 1,
      displayMinute: "1'",
      type: "PERIOD_START",
      teamSide: "NEUTRAL",
      detail: "Inicio del primer tiempo"
    }
  ];
  details.forEach((d, idx) => {
    const teamId = String(d?.team?.id || "");
    const side = teamId === homeTeamIdStr ? "HOME" : teamId === awayTeamIdStr ? "AWAY" : "HOME";
    const teamLabel = side === "HOME" ? homeName : awayName;
    const clockInfo = parseClockMinute(d?.clock?.displayValue, 30);
    const rawAthlete = d?.athletesInvolved?.[0]?.displayName || d?.athletesInvolved?.[0]?.fullName || d?.athletesInvolved?.[0]?.shortName;
    const athleteName = resolveServerPlayerName(rawAthlete, teamLabel, 9 - idx % 3, false);
    const assistName = d?.athletesInvolved?.[1]?.displayName;
    if (d?.scoringPlay || /goal/i.test(String(d?.type?.text || ""))) {
      const isPen = Boolean(d?.penaltyKick);
      const isOG = Boolean(d?.ownGoal);
      events.push({
        id: `goal_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: "GOAL",
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        playerSecondary: assistName,
        detail: isPen ? `Gol de penal convertido por ${athleteName}` : isOG ? `Gol en propia puerta (${athleteName})` : assistName ? `Gol de ${athleteName} \xB7 Asistencia de ${assistName}` : `Anotaci\xF3n oficial de ${athleteName} para ${teamLabel}`
      });
    } else if (d?.redCard || /red card/i.test(String(d?.type?.text || ""))) {
      if (side === "HOME") detailHomeRed++;
      else detailAwayRed++;
      events.push({
        id: `rc_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: "RED_CARD",
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        detail: `Tarjeta roja directa / expulsi\xF3n para ${athleteName}`
      });
    } else if (d?.yellowCard || /yellow card/i.test(String(d?.type?.text || ""))) {
      if (side === "HOME") detailHomeYellow++;
      else detailAwayYellow++;
      events.push({
        id: `yc_${ev?.id}_${idx}_${clockInfo.minute}`,
        minute: clockInfo.minute,
        displayMinute: clockInfo.displayMinute,
        type: "YELLOW_CARD",
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: athleteName,
        detail: `Amonestaci\xF3n con tarjeta amarilla para ${athleteName}`
      });
    }
  });
  if (elapsedMin >= 45 || isFinished) {
    events.push({
      id: `halftime_${ev?.id || "match"}`,
      minute: 45,
      displayMinute: "45'",
      type: "PERIOD_HALF",
      teamSide: "NEUTRAL",
      detail: "Entretiempo reglamentario"
    });
  }
  if (isFinished) {
    const hScore = parseInt(String(homeComp?.score || "0"), 10) || 0;
    const aScore = parseInt(String(awayComp?.score || "0"), 10) || 0;
    events.push({
      id: `fulltime_${ev?.id || "match"}`,
      minute: 90,
      displayMinute: "90'",
      type: "PERIOD_END",
      teamSide: "NEUTRAL",
      detail: `Final del encuentro (${hScore} - ${aScore})`
    });
  }
  const homeCorners = getStatNumber(homeStatsArr, "wonCorners", 0);
  const awayCorners = getStatNumber(awayStatsArr, "wonCorners", 0);
  const homeYellows = Math.max(detailHomeYellow, getStatNumber(homeStatsArr, "yellowCards", detailHomeYellow));
  const awayYellows = Math.max(detailAwayYellow, getStatNumber(awayStatsArr, "yellowCards", detailAwayYellow));
  const homeReds = Math.max(detailHomeRed, getStatNumber(homeStatsArr, "redCards", detailHomeRed));
  const awayReds = Math.max(detailAwayRed, getStatNumber(awayStatsArr, "redCards", detailAwayRed));
  const liveStats = {
    home: {
      corners: homeCorners,
      yellowCards: homeYellows,
      redCards: homeReds,
      shots: getStatNumber(homeStatsArr, "totalShots", 0),
      shotsOnTarget: getStatNumber(homeStatsArr, "shotsOnTarget", 0),
      possessionPct: getStatNumber(homeStatsArr, "possessionPct", 50),
      foulsCommitted: getStatNumber(homeStatsArr, "foulsCommitted", 0)
    },
    away: {
      corners: awayCorners,
      yellowCards: awayYellows,
      redCards: awayReds,
      shots: getStatNumber(awayStatsArr, "totalShots", 0),
      shotsOnTarget: getStatNumber(awayStatsArr, "shotsOnTarget", 0),
      possessionPct: getStatNumber(awayStatsArr, "possessionPct", 50),
      foulsCommitted: getStatNumber(awayStatsArr, "foulsCommitted", 0)
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
function extractApiFootballLiveTelemetry(rawFix, overrideHomeScore, overrideAwayScore, overrideMinute, isHalfTime, isFinished) {
  const homeName = String(rawFix?.teams?.home?.name || "Local");
  const awayName = String(rawFix?.teams?.away?.name || "Visitante");
  const homeId = rawFix?.teams?.home?.id;
  const awayId = rawFix?.teams?.away?.id;
  const homeScore = overrideHomeScore ?? Number(rawFix?.goals?.home ?? rawFix?.score?.fulltime?.home ?? 0);
  const awayScore = overrideAwayScore ?? Number(rawFix?.goals?.away ?? rawFix?.score?.fulltime?.away ?? 0);
  const currentMin = overrideMinute ?? Number(rawFix?.fixture?.status?.elapsed || 45);
  const fId = String(rawFix?.fixture?.id || "match");
  const rawEvents = Array.isArray(rawFix?.events) ? rawFix.events : [];
  const events = [
    {
      id: `kickoff_${fId}`,
      minute: 1,
      displayMinute: "1'",
      type: "PERIOD_START",
      teamSide: "NEUTRAL",
      detail: "Inicio del primer tiempo"
    }
  ];
  let homeGoalsRecorded = 0;
  let awayGoalsRecorded = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;
  rawEvents.forEach((ev, idx) => {
    const evTeamId = ev?.team?.id;
    const evTeamName = String(ev?.team?.name || "");
    const side = homeId && evTeamId === homeId || singleTeamFuzzyMatch(normalizeTeamKey(evTeamName), normalizeTeamKey(homeName)) ? "HOME" : awayId && evTeamId === awayId || singleTeamFuzzyMatch(normalizeTeamKey(evTeamName), normalizeTeamKey(awayName)) ? "AWAY" : "HOME";
    const teamLabel = side === "HOME" ? homeName : awayName;
    const min = Math.min(120, Math.max(1, Number(ev?.time?.elapsed || 30)));
    const extra = ev?.time?.extra ? `+${ev.time.extra}` : "";
    const displayMinute = `${min}${extra}'`;
    const rawPlayer = ev?.player?.name;
    const rawAssist = ev?.assist?.name;
    const playerPrimary = resolveServerPlayerName(rawPlayer, teamLabel, 9 - idx % 4, false);
    const playerSecondary = rawAssist ? resolveServerPlayerName(rawAssist, teamLabel, 7, false) : void 0;
    const evType = String(ev?.type || "").toLowerCase();
    const evDetail = String(ev?.detail || "").toLowerCase();
    if (evType === "goal" && !evDetail.includes("missed")) {
      if (side === "HOME") homeGoalsRecorded++;
      else awayGoalsRecorded++;
      const isPen = evDetail.includes("penalty");
      const isOG = evDetail.includes("own goal");
      events.push({
        id: `af_goal_${fId}_${idx}_${min}`,
        minute: min,
        displayMinute,
        type: "GOAL",
        teamSide: side,
        teamName: teamLabel,
        playerPrimary,
        playerSecondary,
        detail: isPen ? `Gol de penal convertido por ${playerPrimary}` : isOG ? `Gol en propia puerta (${playerPrimary})` : playerSecondary ? `Gol de ${playerPrimary} \xB7 Asistencia de ${playerSecondary}` : `Anotaci\xF3n oficial de ${playerPrimary} para ${teamLabel}`
      });
    } else if (evType === "card") {
      if (evDetail.includes("red")) {
        if (side === "HOME") homeReds++;
        else awayReds++;
        events.push({
          id: `af_rc_${fId}_${idx}_${min}`,
          minute: min,
          displayMinute,
          type: "RED_CARD",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary,
          detail: `Tarjeta roja / expulsi\xF3n para ${playerPrimary}`
        });
      } else {
        if (side === "HOME") homeYellows++;
        else awayYellows++;
        events.push({
          id: `af_yc_${fId}_${idx}_${min}`,
          minute: min,
          displayMinute,
          type: "YELLOW_CARD",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary,
          detail: `Amonestaci\xF3n con tarjeta amarilla para ${playerPrimary}`
        });
      }
    } else if (evType === "subst") {
      const subIn = resolveServerPlayerName(rawAssist || rawPlayer, teamLabel, 12 + idx % 5, true);
      const subOut = resolveServerPlayerName(rawPlayer, teamLabel, 6 + idx % 5, false);
      events.push({
        id: `af_sub_${fId}_${idx}_${min}`,
        minute: min,
        displayMinute,
        type: "SUBSTITUTION",
        teamSide: side,
        teamName: teamLabel,
        playerPrimary: subIn,
        playerSecondary: subOut,
        detail: `Sustituci\xF3n en ${teamLabel}: ingresa ${subIn} por ${subOut}`
      });
    }
  });
  const htHome = rawFix?.score?.halftime?.home;
  const htAway = rawFix?.score?.halftime?.away;
  const missingHomeGoals = Math.max(0, homeScore - homeGoalsRecorded);
  const missingAwayGoals = Math.max(0, awayScore - awayGoalsRecorded);
  for (let i = 0; i < missingHomeGoals; i++) {
    const inFirstHalf = typeof htHome === "number" && i < htHome;
    const goalMin = inFirstHalf ? Math.min(44, Math.max(8, Math.round((i + 1) / (missingHomeGoals + 1) * Math.min(44, currentMin)))) : Math.min(currentMin, Math.max(12, Math.round((i + 1) / (missingHomeGoals + 1) * currentMin)));
    const scorer = resolveServerPlayerName(null, homeName, 9 - i % 3, false);
    events.push({
      id: `reconciled_goal_home_${fId}_${i}`,
      minute: goalMin,
      displayMinute: `${goalMin}'`,
      type: "GOAL",
      teamSide: "HOME",
      teamName: homeName,
      playerPrimary: scorer,
      detail: `Anotaci\xF3n oficial de ${scorer} para ${homeName}`
    });
  }
  for (let i = 0; i < missingAwayGoals; i++) {
    const inFirstHalf = typeof htAway === "number" && i < htAway;
    const goalMin = inFirstHalf ? Math.min(44, Math.max(11, Math.round((i + 1) / (missingAwayGoals + 1) * Math.min(44, currentMin)))) : Math.min(currentMin, Math.max(16, Math.round((i + 1) / (missingAwayGoals + 1) * currentMin)));
    const scorer = resolveServerPlayerName(null, awayName, 10 - i % 3, false);
    events.push({
      id: `reconciled_goal_away_${fId}_${i}`,
      minute: goalMin,
      displayMinute: `${goalMin}'`,
      type: "GOAL",
      teamSide: "AWAY",
      teamName: awayName,
      playerPrimary: scorer,
      detail: `Anotaci\xF3n oficial de ${scorer} para ${awayName}`
    });
  }
  if (isHalfTime || currentMin >= 45 || isFinished) {
    events.push({
      id: `halftime_${fId}`,
      minute: 45,
      displayMinute: "45'",
      type: "PERIOD_HALF",
      teamSide: "NEUTRAL",
      detail: `Entretiempo reglamentario (${htHome ?? homeScore} - ${htAway ?? awayScore})`
    });
  }
  if (isFinished) {
    events.push({
      id: `fulltime_${fId}`,
      minute: 90,
      displayMinute: "90'",
      type: "PERIOD_END",
      teamSide: "NEUTRAL",
      detail: `Final del encuentro (${homeScore} - ${awayScore})`
    });
  }
  const progressFactor = Math.min(1, Math.max(0.15, currentMin / 90));
  const existingStats = rawFix?.liveStats;
  const homeCorners = existingStats?.home?.corners ?? Math.max(1, Math.round((4.8 + homeScore * 0.7) * progressFactor));
  const awayCorners = existingStats?.away?.corners ?? Math.max(1, Math.round((4.1 + awayScore * 0.7) * progressFactor));
  const finalHomeYellows = Math.max(homeYellows, existingStats?.home?.yellowCards ?? Math.floor(1.8 * progressFactor));
  const finalAwayYellows = Math.max(awayYellows, existingStats?.away?.yellowCards ?? Math.floor(2.1 * progressFactor));
  while (homeYellows < finalHomeYellows) {
    homeYellows++;
    const ycMin = Math.min(currentMin, Math.max(14, Math.round(homeYellows / (finalHomeYellows + 1) * currentMin)));
    const player = resolveServerPlayerName(null, homeName, 4 + homeYellows, false);
    events.push({
      id: `reconciled_yc_home_${fId}_${homeYellows}`,
      minute: ycMin,
      displayMinute: `${ycMin}'`,
      type: "YELLOW_CARD",
      teamSide: "HOME",
      teamName: homeName,
      playerPrimary: player,
      detail: `Tarjeta amarilla mostrada a ${player} (${homeName})`
    });
  }
  while (awayYellows < finalAwayYellows) {
    awayYellows++;
    const ycMin = Math.min(currentMin, Math.max(18, Math.round(awayYellows / (finalAwayYellows + 1) * currentMin)));
    const player = resolveServerPlayerName(null, awayName, 5 + awayYellows, false);
    events.push({
      id: `reconciled_yc_away_${fId}_${awayYellows}`,
      minute: ycMin,
      displayMinute: `${ycMin}'`,
      type: "YELLOW_CARD",
      teamSide: "AWAY",
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
async function fetchApiFootballLiveAll() {
  const cached = getCacheItem("api_football_live_all_v2");
  return cached?.data || [];
}
function mapEspnPosition(posAbbr) {
  const p = (posAbbr || "").toUpperCase();
  if (p === "G" || p === "GK" || p.includes("GOAL")) return "POR";
  if (p.includes("D") || p === "CB" || p === "LB" || p === "RB" || p === "CD" || p === "CD-L" || p === "CD-R") return "DEF";
  if (p.includes("F") || p === "ST" || p === "CF" || p === "LW" || p === "RW") return "DEL";
  return "MED";
}
function parseEspnMatchStatusAndClock(ev) {
  const state = String(ev?.status?.type?.state || "pre").toLowerCase();
  const isLive = state === "in";
  const isPost = state === "post" || ev?.status?.type?.completed === true;
  const period = Number(ev?.status?.period || 1);
  const statusTypeName = String(ev?.status?.type?.name || "").toUpperCase();
  const statusDetail = String(ev?.status?.type?.detail || "").toUpperCase();
  const statusShortDetail = String(ev?.status?.type?.shortDetail || "").toUpperCase();
  const rawClock = String(ev?.status?.displayClock || "").trim();
  const clockSeconds = Number(ev?.status?.clock || 0);
  if (isPost) {
    return {
      isLive: false,
      isPost: true,
      isHalfTime: false,
      statusShort: "FT",
      elapsedMin: 90
    };
  }
  if (statusTypeName.includes("POSTPONED")) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: "PST", elapsedMin: null };
  }
  if (statusTypeName.includes("CANCEL")) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: "CANC", elapsedMin: null };
  }
  if (statusTypeName.includes("SUSPEND") || statusTypeName.includes("DELAY")) {
    return { isLive: false, isPost: false, isHalfTime: false, statusShort: "SUSP", elapsedMin: null };
  }
  if (!isLive) {
    return {
      isLive: false,
      isPost: false,
      isHalfTime: false,
      statusShort: "NS",
      elapsedMin: null
    };
  }
  const isHalfTime = statusTypeName.includes("HALFTIME") || statusShortDetail === "HT" || statusDetail === "HT" || statusShortDetail.includes("HALF") || statusShortDetail.includes("DESCANSO");
  if (isHalfTime) {
    return {
      isLive: true,
      isPost: false,
      isHalfTime: true,
      statusShort: "HT",
      elapsedMin: 45
    };
  }
  const isShootout = statusTypeName.includes("SHOOTOUT") || statusTypeName.includes("PENALT") || statusTypeName.includes("END_OF_EXTRATIME") || statusShortDetail.includes("PEN") || statusDetail.includes("PENS") || period >= 5;
  if (isShootout) {
    return {
      isLive: true,
      isPost: false,
      isHalfTime: false,
      statusShort: "PEN",
      elapsedMin: 120
    };
  }
  const isOvertime = statusTypeName.includes("OVERTIME") || statusTypeName.includes("EXTRA") || period === 3 || period === 4;
  const isFirstHalf = !isOvertime && (period === 1 || statusTypeName.includes("FIRST_HALF"));
  const statusShort = isOvertime ? period === 3 ? "1ET" : "2ET" : isFirstHalf ? "1H" : "2H";
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
async function fetchEspnMatchSummaryTelemetry(espnEventId, homeName, awayName, elapsedMin, isFinished, fallbackTelemetry) {
  if (!espnEventId) return fallbackTelemetry;
  const cacheKey = `espn_summary_v3_${espnEventId}`;
  const cached = getCacheItem(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 1e3) {
    return cached.data;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e3);
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(espnEventId)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
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
    const homeBox = boxTeams.find((t) => {
      const tk = normalizeTeamKey(t?.team?.displayName || t?.team?.name || "");
      return tk && hKey && (tk.includes(hKey) || hKey.includes(tk));
    }) || boxTeams[0];
    const awayBox = boxTeams.find((t) => {
      const tk = normalizeTeamKey(t?.team?.displayName || t?.team?.name || "");
      return tk && aKey && (tk.includes(aKey) || aKey.includes(tk));
    }) || boxTeams[1];
    const homeBoxStats = Array.isArray(homeBox?.statistics) ? homeBox.statistics : [];
    const awayBoxStats = Array.isArray(awayBox?.statistics) ? awayBox.statistics : [];
    const keyEvents = Array.isArray(sumData?.keyEvents) ? sumData.keyEvents : [];
    const parsedEvents = [
      {
        id: `kickoff_${espnEventId}`,
        minute: 1,
        displayMinute: "1'",
        type: "PERIOD_START",
        teamSide: "NEUTRAL",
        detail: "Inicio del primer tiempo"
      }
    ];
    let keyHomeYellow = 0;
    let keyAwayYellow = 0;
    let keyHomeRed = 0;
    let keyAwayRed = 0;
    let hasHalftimeEvent = false;
    keyEvents.forEach((ke, idx) => {
      const typeKey = String(ke?.type?.type || ke?.type?.text || "").toLowerCase();
      const clockInfo = parseClockMinute(ke?.clock?.displayValue, 45);
      const evTeamName = String(ke?.team?.displayName || "");
      const evTeamKey = normalizeTeamKey(evTeamName);
      const side = evTeamKey && aKey && (evTeamKey.includes(aKey) || aKey.includes(evTeamKey)) ? "AWAY" : "HOME";
      const teamLabel = side === "HOME" ? homeName : awayName;
      const rawP1 = ke?.participants?.[0]?.athlete?.displayName || ke?.participants?.[0]?.displayName;
      const rawP2 = ke?.participants?.[1]?.athlete?.displayName || ke?.participants?.[1]?.displayName;
      if (typeKey.includes("halftime") || typeKey === "end-1st-half") {
        if (!hasHalftimeEvent) {
          hasHalftimeEvent = true;
          parsedEvents.push({
            id: `ht_${espnEventId}`,
            minute: 45,
            displayMinute: clockInfo.displayMinute || "45'",
            type: "PERIOD_HALF",
            teamSide: "NEUTRAL",
            detail: "Entretiempo reglamentario"
          });
        }
      } else if (typeKey === "goal" || typeKey.includes("penalty---scored") || typeKey.includes("own-goal") || ke?.scoringPlay === true) {
        const isOwnGoal = typeKey.includes("own-goal");
        const isPen = typeKey.includes("penalty");
        const p1 = resolveServerPlayerName(rawP1, teamLabel, 9 - idx % 3, false);
        const p2 = rawP2 ? resolveServerPlayerName(rawP2, teamLabel, 7, false) : void 0;
        parsedEvents.push({
          id: `goal_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: "GOAL",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          playerSecondary: p2,
          detail: isPen ? `Gol de penal convertido por ${p1}` : isOwnGoal ? `Gol en propia puerta (${p1})` : p2 ? `Gol de ${p1} \xB7 Asistencia de ${p2}` : `Anotaci\xF3n oficial de ${p1} para ${teamLabel}`
        });
      } else if (typeKey.includes("red-card") || typeKey.includes("second-yellow")) {
        if (side === "HOME") keyHomeRed++;
        else keyAwayRed++;
        const p1 = resolveServerPlayerName(rawP1, teamLabel, (3 + idx) % 10, false);
        parsedEvents.push({
          id: `rc_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: "RED_CARD",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          detail: `Tarjeta roja / expulsi\xF3n para ${p1}`
        });
      } else if (typeKey.includes("yellow-card")) {
        if (side === "HOME") keyHomeYellow++;
        else keyAwayYellow++;
        const p1 = resolveServerPlayerName(rawP1, teamLabel, (4 + idx) % 10, false);
        parsedEvents.push({
          id: `yc_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: "YELLOW_CARD",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: p1,
          detail: `Tarjeta amarilla mostrada a ${p1}`
        });
      } else if (typeKey.includes("substitution")) {
        const p1 = resolveServerPlayerName(rawP1, teamLabel, 12 + idx % 5, true);
        const p2 = resolveServerPlayerName(rawP2, teamLabel, 6 + idx % 5, false);
        parsedEvents.push({
          id: `sub_${espnEventId}_${idx}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: "SUBSTITUTION",
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
        type: "PERIOD_HALF",
        teamSide: "NEUTRAL",
        detail: "Entretiempo reglamentario"
      });
    }
    const commentary = Array.isArray(sumData?.commentary) ? sumData.commentary : [];
    commentary.forEach((c, idx) => {
      const playType = String(c?.play?.type?.type || c?.play?.type?.text || "").toLowerCase();
      const rawText = String(c?.text || "");
      if (playType.includes("corner") || /^corner,/i.test(rawText)) {
        const clockInfo = parseClockMinute(c?.time?.displayValue || c?.play?.clock?.displayValue, 30);
        const playTeamName = String(c?.play?.team?.displayName || "");
        const concededMatch = rawText.match(/Conceded by ([^.]+)\.?/i);
        const concededBy = concededMatch ? concededMatch[1].trim() : "";
        let side = "HOME";
        if (playTeamName) {
          const pk = normalizeTeamKey(playTeamName);
          if (pk && aKey && (pk.includes(aKey) || aKey.includes(pk))) side = "AWAY";
        } else {
          const headerMatch = rawText.match(/^Corner,\s*([^.]+)\./i);
          if (headerMatch) {
            const pk = normalizeTeamKey(headerMatch[1]);
            if (pk && aKey && (pk.includes(aKey) || aKey.includes(pk))) side = "AWAY";
          }
        }
        const teamLabel = side === "HOME" ? homeName : awayName;
        parsedEvents.push({
          id: `corner_${espnEventId}_${idx}_${clockInfo.minute}`,
          minute: clockInfo.minute,
          displayMinute: clockInfo.displayMinute,
          type: "CORNER",
          teamSide: side,
          teamName: teamLabel,
          playerPrimary: concededBy || void 0,
          detail: concededBy ? `Tiro de esquina para ${teamLabel} (cedido por ${concededBy})` : `Tiro de esquina ejecutado por ${teamLabel}`
        });
      }
    });
    const homeCorners = getStatNumber(homeBoxStats, "wonCorners", fallbackTelemetry.liveStats.home.corners);
    const awayCorners = getStatNumber(awayBoxStats, "wonCorners", fallbackTelemetry.liveStats.away.corners);
    const homeYellows = getStatNumber(
      homeBoxStats,
      "yellowCards",
      Math.max(keyHomeYellow, fallbackTelemetry.liveStats.home.yellowCards)
    );
    const awayYellows = getStatNumber(
      awayBoxStats,
      "yellowCards",
      Math.max(keyAwayYellow, fallbackTelemetry.liveStats.away.yellowCards)
    );
    const homeReds = getStatNumber(
      homeBoxStats,
      "redCards",
      Math.max(keyHomeRed, fallbackTelemetry.liveStats.home.redCards)
    );
    const awayReds = getStatNumber(
      awayBoxStats,
      "redCards",
      Math.max(keyAwayRed, fallbackTelemetry.liveStats.away.redCards)
    );
    const liveStats = {
      home: {
        corners: homeCorners,
        yellowCards: homeYellows,
        redCards: homeReds,
        shots: getStatNumber(homeBoxStats, "totalShots", fallbackTelemetry.liveStats.home.shots),
        shotsOnTarget: getStatNumber(homeBoxStats, "shotsOnTarget", fallbackTelemetry.liveStats.home.shotsOnTarget),
        possessionPct: getStatNumber(homeBoxStats, "possessionPct", fallbackTelemetry.liveStats.home.possessionPct),
        foulsCommitted: getStatNumber(homeBoxStats, "foulsCommitted", fallbackTelemetry.liveStats.home.foulsCommitted)
      },
      away: {
        corners: awayCorners,
        yellowCards: awayYellows,
        redCards: awayReds,
        shots: getStatNumber(awayBoxStats, "totalShots", fallbackTelemetry.liveStats.away.shots),
        shotsOnTarget: getStatNumber(awayBoxStats, "shotsOnTarget", fallbackTelemetry.liveStats.away.shotsOnTarget),
        possessionPct: getStatNumber(awayBoxStats, "possessionPct", fallbackTelemetry.liveStats.away.possessionPct),
        foulsCommitted: getStatNumber(awayBoxStats, "foulsCommitted", fallbackTelemetry.liveStats.away.foulsCommitted)
      },
      updatedAt: Date.now()
    };
    if (isFinished) {
      parsedEvents.push({
        id: `ft_${espnEventId}`,
        minute: 90,
        displayMinute: "90'",
        type: "PERIOD_END",
        teamSide: "NEUTRAL",
        detail: "Final del encuentro"
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
    let liveRosters = void 0;
    const rawRosters = Array.isArray(sumData?.rosters) ? sumData.rosters : [];
    if (rawRosters.length >= 2) {
      const homeRosterObj = rawRosters.find((r) => r.homeAway === "home") || rawRosters[0];
      const awayRosterObj = rawRosters.find((r) => r.homeAway === "away") || rawRosters[1];
      const mapRosterList = (list, isStarter, teamName) => (Array.isArray(list) ? list : []).filter((item) => Boolean(item?.starter) === isStarter).map((item, idx) => {
        const pStats = Array.isArray(item?.stats) ? item.stats : [];
        const yc = getStatNumber(pStats, "yellowCards", 0);
        const rc = getStatNumber(pStats, "redCards", 0);
        const rawAthleteName = item?.athlete?.displayName || item?.athlete?.fullName;
        return {
          id: String(item?.athlete?.id || `p_${idx}`),
          name: resolveServerPlayerName(rawAthleteName, teamName, isStarter ? idx : idx + 12, !isStarter),
          number: parseInt(String(item?.jersey || idx + 1), 10) || idx + 1,
          position: mapEspnPosition(String(item?.position?.abbreviation || "")),
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
          homeFormation: homeRosterObj?.formation || "4-3-3",
          awayFormation: awayRosterObj?.formation || "4-3-3",
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
async function fetchEspnSoccerFixtures(targetDate, clientTz = "America/Bogota") {
  const espnDateStr = targetDate.replace(/-/g, "");
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const mapped = [];
    const now = Date.now();
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
      const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
      if (!homeComp || !awayComp) continue;
      const state = String(ev?.status?.type?.state || "pre").toLowerCase();
      if (state === "post" || ev?.status?.type?.completed === true) {
        continue;
      }
      const matchDateObj = new Date(ev.date);
      const matchTimestampMs = matchDateObj.getTime();
      if (isNaN(matchTimestampMs)) continue;
      if (state !== "in" && matchTimestampMs < now - 120 * 60 * 1e3) {
        continue;
      }
      let eventLocalDate = targetDate;
      try {
        eventLocalDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: clientTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(matchDateObj);
      } catch {
      }
      if (eventLocalDate !== targetDate) {
        continue;
      }
      const rawUid = String(ev?.uid || "");
      const espnLeagueId = rawUid.match(/~l:(\d+)/)?.[1] || "0";
      const rawCountry = String(comp?.venue?.address?.country || "Internacional");
      const catalogEntry = ESPN_LEAGUE_CATALOG[espnLeagueId];
      const countryTranslated = COUNTRY_TRANSLATION_MAP[rawCountry];
      const clockParsed = parseEspnMatchStatusAndClock(ev);
      const isLive = clockParsed.isLive;
      const elapsedMin = clockParsed.elapsedMin;
      const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "Local");
      const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "Visitante");
      const espnEventId = String(ev.id || "");
      const slug = String(ev?.season?.slug || "Jornada Regular").replace(/-/g, " ");
      const isNatTeamMatch = !catalogEntry && isServerNationalTeamSub17PlusMatch(slug, rawCountry, homeName, awayName);
      const leagueId = catalogEntry?.id || parseInt(espnLeagueId, 10) || 1;
      const countryName = isNatTeamMatch ? "Internacional" : catalogEntry?.country || countryTranslated?.country || rawCountry;
      const flag = isNatTeamMatch ? "\u{1F30D}" : catalogEntry?.flag || countryTranslated?.flag || "\u26BD";
      let leagueName = catalogEntry?.name || `Liga ${countryName}`;
      if (isNatTeamMatch) {
        const natCtx = `${slug} ${homeName} ${awayName}`.toLowerCase();
        const isW = /\b(women'?s?|femenin[ao]s?|femenil|frauen|femminile|w)\b/i.test(natCtx);
        if (/\b(u-?17|sub-?17)\b/i.test(natCtx)) {
          leagueName = isW ? "Selecciones Sub-17 Femenino" : "Selecciones Sub-17 (FIFA)";
        } else if (/\b(u-?20|sub-?20)\b/i.test(natCtx)) {
          leagueName = isW ? "Selecciones Sub-20 Femenino" : "Selecciones Sub-20 (FIFA)";
        } else if (/\b(u-?19|sub-?19)\b/i.test(natCtx)) {
          leagueName = isW ? "Selecciones Sub-19 Femenino" : "Selecciones Sub-19";
        } else if (/\b(u-?21|sub-?21)\b/i.test(natCtx)) {
          leagueName = "Selecciones Sub-21";
        } else if (/\b(u-?23|sub-?23|ol[ií]mpic|olympic)\b/i.test(natCtx)) {
          leagueName = "Selecciones Sub-23 / Ol\xEDmpico";
        } else if (isW) {
          leagueName = "Selecciones Nacionales Femenino";
        } else {
          leagueName = "Selecciones Nacionales (FIFA)";
        }
      }
      const sbTelemetry = isLive ? extractEspnScoreboardTelemetry(ev, comp, homeComp, awayComp, homeName, awayName, elapsedMin || 45, false) : void 0;
      mapped.push({
        espnEventId,
        liveStats: sbTelemetry?.liveStats,
        liveEvents: sbTelemetry?.liveEvents,
        fixture: {
          id: parseInt(espnEventId || "0", 10) || Math.floor(Math.random() * 9e5 + 1e5),
          date: ev.date,
          timestamp: Math.floor(matchTimestampMs / 1e3),
          venue: {
            name: comp?.venue?.fullName || "Estadio Oficial",
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
            id: parseInt(String(homeComp?.team?.id || homeComp?.id || "1"), 10) || 1,
            name: homeName,
            logo: String(homeComp?.team?.logo || homeComp?.team?.logos?.[0]?.href || "")
          },
          away: {
            id: parseInt(String(awayComp?.team?.id || awayComp?.id || "2"), 10) || 2,
            name: awayName,
            logo: String(awayComp?.team?.logo || awayComp?.team?.logos?.[0]?.href || "")
          }
        },
        goals: {
          home: isLive ? parseInt(String(homeComp?.score || "0"), 10) || 0 : null,
          away: isLive ? parseInt(String(awayComp?.score || "0"), 10) || 0 : null
        }
      });
    }
    const liveItems = mapped.filter(
      (m) => ["1H", "2H", "HT", "1ET", "2ET", "ET", "PEN"].includes(String(m.fixture?.status?.short || "")) && m.espnEventId
    ).slice(0, 25);
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
          if (item.fixture.status.short !== "HT" && Array.isArray(enriched.liveEvents)) {
            const maxEvMin = enriched.liveEvents.reduce((acc, evItem) => {
              if (evItem?.type === "PERIOD_HALF" || evItem?.type === "PERIOD_END" || evItem?.type === "PERIOD_START") {
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
    console.warn("[ESPN Soccer Fallback Error]:", err);
    return [];
  }
}
var SERVER_ALLOWED_PRIME_COUNTRIES = {
  COLOMBIA: {
    countryMatches: ["colombia"],
    allowedLeaguesPattern: /\b(primera a|primera b|liga betplay|torneo betplay|copa betplay|copa colombia|superliga|dimayor)\b/i
  },
  ENGLAND: {
    countryMatches: ["england", "inglaterra"],
    allowedLeaguesPattern: /\b(premier league|championship|fa cup|efl cup|carabao cup|community shield)\b/i,
    excludedLeaguesPattern: /\b(premier league 2|u18|u21|u23|national league|league one|league two|efl trophy|isthmian|southern|northern|women|femenina)\b/i
  },
  SPAIN: {
    countryMatches: ["spain", "espana", "espa\xF1a"],
    allowedLeaguesPattern: /\b(la liga|laliga|primera divisi[oó]n|segunda divisi[oó]n|hypermotion|copa del rey|supercopa)\b/i,
    excludedLeaguesPattern: /\b(rfef|tercera|federaci[oó]n|juvenil|women|femenina)\b/i
  },
  ITALY: {
    countryMatches: ["italy", "italia"],
    allowedLeaguesPattern: /\b(serie a|serie b|coppa italia|supercoppa)\b/i,
    excludedLeaguesPattern: /\b(serie c|serie d|primavera|coppa italia serie|women|femminile)\b/i
  },
  GERMANY: {
    countryMatches: ["germany", "alemania"],
    allowedLeaguesPattern: /\b(bundesliga|2\. bundesliga|dfb pokal|dfb-pokal|supercup)\b/i,
    excludedLeaguesPattern: /\b(3\. liga|regionalliga|oberliga|junioren|u19|u17|women|frauen)\b/i
  },
  FRANCE: {
    countryMatches: ["france", "francia"],
    allowedLeaguesPattern: /\b(ligue 1|ligue 2|coupe de france|troph[eé]e des champions)\b/i,
    excludedLeaguesPattern: /\b(national|championnat national|u19|feminine|f[eé]minine)\b/i
  },
  ARGENTINA: {
    countryMatches: ["argentina"],
    allowedLeaguesPattern: /\b(liga profesional|primera divisi[oó]n|copa de la liga|copa argentina|trofeo de campeones|primera nacional)\b/i,
    excludedLeaguesPattern: /\b(primera b|primera c|primera d|torneo federal|reserva|proyecci[oó]n|femenino)\b/i
  },
  BRAZIL: {
    countryMatches: ["brazil", "brasil"],
    allowedLeaguesPattern: /\b(serie a|s[eé]rie a|serie b|s[eé]rie b|brasileir[aã]o|copa do brasil|supercopa|paulista a1|paulist[aã]o|carioca)\b/i,
    excludedLeaguesPattern: /\b(serie c|s[eé]rie c|serie d|s[eé]rie d|paulista a2|paulista a3|copa verde|sub-20|u20|feminino)\b/i
  },
  MEXICO: {
    countryMatches: ["mexico", "m\xE9xico"],
    allowedLeaguesPattern: /\b(liga mx|expansi[oó]n mx|copa mx|campe[oó]n de campeones)\b/i,
    excludedLeaguesPattern: /\b(liga premier|tdp|sub-23|u23|femenil)\b/i
  },
  USA: {
    countryMatches: ["usa", "united states", "estados unidos"],
    allowedLeaguesPattern: /\b(major league soccer|mls|us open cup)\b/i,
    excludedLeaguesPattern: /\b(mls next|usl|nisa|npsl|ncaa)\b/i
  },
  PORTUGAL: {
    countryMatches: ["portugal"],
    allowedLeaguesPattern: /\b(primeira liga|liga portugal|ta[cç]a de portugal|ta[cç]a da liga|superta[cç]a)\b/i,
    excludedLeaguesPattern: /\b(liga 3|campeonato de portugal|revela[cç][aã]o|u23)\b/i
  },
  NETHERLANDS: {
    countryMatches: ["netherlands", "paises bajos", "pa\xEDses bajos", "holanda"],
    allowedLeaguesPattern: /\b(eredivisie|eerste divisie|knvb beker|johan cruijff)\b/i,
    excludedLeaguesPattern: /\b(tweede divisie|derde divisie|u21)\b/i
  },
  SAUDI_ARABIA: {
    countryMatches: ["saudi arabia", "saudi-arabia", "arabia saudita"],
    allowedLeaguesPattern: /\b(pro league|professional league|saudi league|king'?s cup|super cup)\b/i,
    excludedLeaguesPattern: /\b(division 1|division 2|youth)\b/i
  },
  TURKEY: {
    countryMatches: ["turkey", "turquia", "turqu\xEDa"],
    allowedLeaguesPattern: /\b(s[uü]per lig|1\. lig|turkish cup|kupasi)\b/i,
    excludedLeaguesPattern: /\b(2\. lig|3\. lig|u19)\b/i
  },
  CHILE: {
    countryMatches: ["chile"],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|primera b|copa chile|supercopa)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|tercera)\b/i
  },
  URUGUAY: {
    countryMatches: ["uruguay"],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|campeonato uruguayo|torneo apertura|torneo clausura|intermedio)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|reserva)\b/i
  },
  ECUADOR: {
    countryMatches: ["ecuador"],
    allowedLeaguesPattern: /\b(liga ?pro|serie a|copa ecuador)\b/i,
    excludedLeaguesPattern: /\b(serie b|segunda)\b/i
  },
  PERU: {
    countryMatches: ["peru", "per\xFA"],
    allowedLeaguesPattern: /\b(liga 1|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(liga 2|copa per[uú]|reserva)\b/i
  },
  PARAGUAY: {
    countryMatches: ["paraguay"],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n|copa de primera|copa paraguay)\b/i,
    excludedLeaguesPattern: /\b(intermedia|reserva)\b/i
  },
  BOLIVIA: {
    countryMatches: ["bolivia"],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(sim[oó]n bol[ií]var)\b/i
  },
  VENEZUELA: {
    countryMatches: ["venezuela"],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|liga futve|copa venezuela)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n)\b/i
  },
  BELGIUM: {
    countryMatches: ["belgium", "belgica", "b\xE9lgica"],
    allowedLeaguesPattern: /\b(pro league|jupiler|first division a|beker van belgie|croky cup)\b/i,
    excludedLeaguesPattern: /\b(challenger|amateur|u21)\b/i
  },
  SCOTLAND: {
    countryMatches: ["scotland", "escocia"],
    allowedLeaguesPattern: /\b(premiership|scottish cup|league cup)\b/i,
    excludedLeaguesPattern: /\b(championship|league one|league two|highland|lowland)\b/i
  },
  JAPAN: {
    countryMatches: ["japan", "japon", "jap\xF3n"],
    allowedLeaguesPattern: /\b(j1 league|j\.league|emperor cup|j-league cup)\b/i,
    excludedLeaguesPattern: /\b(j2 league|j3 league|we league|university)\b/i
  }
};
var SERVER_NATIONAL_TEAM_COUNTRIES = /* @__PURE__ */ new Set([
  "colombia",
  "argentina",
  "brazil",
  "brasil",
  "uruguay",
  "chile",
  "ecuador",
  "peru",
  "paraguay",
  "bolivia",
  "venezuela",
  "spain",
  "espana",
  "england",
  "inglaterra",
  "france",
  "francia",
  "germany",
  "alemania",
  "italy",
  "italia",
  "portugal",
  "netherlands",
  "paises bajos",
  "holanda",
  "belgium",
  "belgica",
  "croatia",
  "croacia",
  "switzerland",
  "suiza",
  "austria",
  "denmark",
  "dinamarca",
  "sweden",
  "suecia",
  "norway",
  "noruega",
  "poland",
  "polonia",
  "serbia",
  "ukraine",
  "ucrania",
  "turkey",
  "turquia",
  "turkiye",
  "scotland",
  "escocia",
  "wales",
  "gales",
  "ireland",
  "republic of ireland",
  "irlanda",
  "northern ireland",
  "irlanda del norte",
  "czech republic",
  "czechia",
  "republica checa",
  "hungary",
  "hungria",
  "romania",
  "rumania",
  "greece",
  "grecia",
  "slovakia",
  "eslovaquia",
  "slovenia",
  "eslovenia",
  "finland",
  "finlandia",
  "iceland",
  "islandia",
  "georgia",
  "albania",
  "north macedonia",
  "macedonia del norte",
  "montenegro",
  "bosnia and herzegovina",
  "bosnia",
  "israel",
  "bulgaria",
  "kosovo",
  "LUXEMBOURG".toLowerCase(),
  "belarus",
  "armenia",
  "azerbaijan",
  "kazakhstan",
  "cyprus",
  "estonia",
  "latvia",
  "lithuania",
  "malta",
  "moldova",
  "usa",
  "u.s.",
  "us",
  "united states",
  "estados unidos",
  "ee. uu.",
  "ee.uu.",
  "mexico",
  "canada",
  "costa rica",
  "panama",
  "honduras",
  "jamaica",
  "el salvador",
  "guatemala",
  "nicaragua",
  "dominican republic",
  "republica dominicana",
  "haiti",
  "cuba",
  "trinidad and tobago",
  "puerto rico",
  "curacao",
  "suriname",
  "japan",
  "japon",
  "south korea",
  "korea republic",
  "corea del sur",
  "rep. of korea",
  "north korea",
  "korea dpr",
  "corea del norte",
  "australia",
  "new zealand",
  "nueva zelanda",
  "saudi arabia",
  "arabia saudita",
  "qatar",
  "catar",
  "iran",
  "iraq",
  "irak",
  "uzbekistan",
  "jordan",
  "jordania",
  "united arab emirates",
  "uae",
  "emiratos arabes unidos",
  "bahrain",
  "oman",
  "syria",
  "siria",
  "palestine",
  "palestina",
  "china",
  "china pr",
  "thailand",
  "tailandia",
  "vietnam",
  "indonesia",
  "malaysia",
  "philippines",
  "filipinas",
  "india",
  "tajikistan",
  "morocco",
  "marruecos",
  "senegal",
  "nigeria",
  "ghana",
  "cameroon",
  "camerun",
  "egypt",
  "egipto",
  "algeria",
  "argelia",
  "tunisia",
  "tunez",
  "ivory coast",
  "cote d ivoire",
  "costa de marfil",
  "south africa",
  "sudafrica",
  "mali",
  "zambia",
  "kenya",
  "kenia",
  "guinea",
  "burkina faso",
  "cape verde",
  "dr congo",
  "congo dr",
  "angola",
  "tanzania",
  "uganda",
  "zimbabwe"
]);
function isServerNationalTeamName(teamName) {
  const norm = (teamName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`]/g, " ").trim();
  if (!norm) return false;
  if (/\b(fc|cf|sc|ac|cd|ud|sd|rcd|ca|club|sporting|atletico|real|deportivo|dynamo|dinamo|borussia|bayern|inter|milan|juventus|arsenal|chelsea|liverpool|barcelona|madrid|psg|benfica|porto|ajax|boca|river|flamengo|palmeiras|corinthians|santos|gremio|nacional|millonarios|junior|medellin|cali|tolima|once caldas|santa fe|pachuca|chivas|tigres|monterrey|cruz azul|pumas|al ahly|al hilal|al nassr)\b/i.test(
    norm
  )) {
    return false;
  }
  const base = norm.replace(
    /\b(u-?17|u-?18|u-?19|u-?20|u-?21|u-?22|u-?23|sub-?17|sub-?18|sub-?19|sub-?20|sub-?21|sub-?22|sub-?23|women s?|femenin[ao]s?|femenil|frauen|femminile|feminino|olimpic[oa]|olympic|national team|seleccion|selecao|w)\b/gi,
    " "
  ).replace(/[()[\]\-_/.,]/g, " ").replace(/\s+/g, " ").trim();
  return SERVER_NATIONAL_TEAM_COUNTRIES.has(base);
}
function isServerNationalTeamSub17PlusMatch(leagueName, countryName, homeName, awayName) {
  const combined = `${leagueName || ""} ${countryName || ""} ${homeName || ""} ${awayName || ""}`.toLowerCase();
  if (/\b(u-?1[1-6]|sub-?1[1-6])\b/i.test(combined)) {
    return false;
  }
  return isServerNationalTeamName(homeName) && isServerNationalTeamName(awayName);
}
function isServerYouthOrLowTierMatch(leagueName, countryName, homeName, awayName) {
  const lName = (leagueName || "").toLowerCase().trim();
  const cName = (countryName || "").toLowerCase().trim();
  const combined = `${lName} ${cName} ${homeName || ""} ${awayName || ""}`.toLowerCase();
  if (/\b(u-?1[1-6]|sub-?1[1-6])\b/i.test(combined)) {
    return true;
  }
  if (isServerNationalTeamSub17PlusMatch(lName, cName, homeName, awayName)) {
    return false;
  }
  if (/\b(u15|u16|u17|u18|u19|u20|u21|u22|u23|sub-15|sub-17|sub-19|sub-20|sub-21|sub-23|youth|juvenil|reservas|reserve|amateur|regional|tercera|fourth division|national league north|national league south|non-league|oberliga|regionalliga|primavera|premier league 2|femenin[ao]|women|frauen|femminile|femenil)\b/i.test(
    combined
  )) {
    return true;
  }
  const isEliteIntlCountry = ["world", "europe", "south america", "north & central america", "asia", "international", "europa", "sudam\xE9rica", "sudamerica", "internacional"].some(
    (ic) => cName === ic || cName.includes(ic)
  );
  const isEliteIntlTournament = /\b(uefa champions|champions league|europa league|conference league|super cup|copa libertadores|libertadores|copa sudamericana|sudamericana|recopa|copa america|copa am[eé]rica|eurocopa|world cup|mundial|nations league|eliminatorias|wc qualification|world cup qualification|concacaf champions|afc champions|leagues cup|gold cup|copa oro|club world cup)\b/i.test(
    lName
  ) && !/\b(caf|ofc|afc cup|asean|cosafa|cecafa|wafcon|u17|u20|u23|women|youth)\b/i.test(`${lName} ${cName}`);
  if (isEliteIntlTournament && (isEliteIntlCountry || !cName)) {
    return false;
  }
  for (const rule of Object.values(SERVER_ALLOWED_PRIME_COUNTRIES)) {
    const countryMatches = rule.countryMatches.some((cm) => {
      if (cName === cm) return true;
      if (cm === "england" && (cName.includes("new") || cName.includes("northern"))) return false;
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
    if (/\b(betplay|laliga|bundesliga|eredivisie|primeira liga|brasileir[aã]o|liga mx|mls|s[uü]per lig|campeonato uruguayo|liga futve|j1 league)\b/i.test(
      lName
    )) {
      return false;
    }
  }
  return true;
}
function filterActiveUpcomingFixtures(list, targetDate, clientTz) {
  const now = Date.now();
  const activeFinishedShorts = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
  return list.filter((f) => {
    const id = f?.fixture?.id;
    if (id === 991001 || id === 991002 || id === 991003) return false;
    const lName = String(f?.league?.name || "");
    const cName = String(f?.league?.country || "");
    const hName = String(f?.teams?.home?.name || "");
    const aName = String(f?.teams?.away?.name || "");
    if (isServerYouthOrLowTierMatch(lName, cName, hName, aName)) {
      return false;
    }
    const statusShort = String(f.fixture?.status?.short || "").toUpperCase();
    if (activeFinishedShorts.includes(statusShort)) return false;
    const matchTime = f.fixture?.timestamp ? f.fixture.timestamp * 1e3 : new Date(f.fixture?.date || 0).getTime();
    if (matchTime > 0 && (now - matchTime) / 6e4 >= 120) {
      return false;
    }
    if (matchTime > 0) {
      try {
        const localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: clientTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(new Date(matchTime));
        if (localDate !== targetDate) return false;
      } catch {
      }
    }
    const isLive = ["1H", "2H", "HT", "ET", "LIVE", "BT", "P", "INT"].includes(statusShort);
    if (isLive) return true;
    return matchTime > now - 115 * 60 * 1e3;
  });
}
app.get(["/api/upcoming", "/api/matches"], dataRateLimitMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  const apiKey = getSecretApiKey();
  const requestedDate = req.query.date || "";
  const clientTz = (req.query.tz || "America/Bogota").trim() || "America/Bogota";
  const query = (req.query.q || "").toLowerCase().trim();
  const force = req.query.force === "true" && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayLocal = getColombiaDateStr(0, clientTz);
  const targetDate = requestedDate || todayLocal;
  const cacheKey = `upcoming_v9_${targetDate}`;
  const cached = getCacheItem(cacheKey);
  const nowMs = Date.now();
  const hasLiveOrStartedInCache = cached && Array.isArray(cached.data) && cached.data.some((f) => {
    const s = String(f?.fixture?.status?.short || "").toUpperCase();
    if (["1H", "2H", "HT", "ET", "1ET", "2ET", "LIVE", "BT", "P", "PEN", "INT"].includes(s)) return true;
    const mTime = f?.fixture?.timestamp ? f.fixture.timestamp * 1e3 : new Date(f?.fixture?.date || 0).getTime();
    return mTime > 0 && mTime <= nowMs;
  });
  const cacheTTL = targetDate === todayLocal ? hasLiveOrStartedInCache ? 20 * 1e3 : 2 * 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  if (cached && Array.isArray(cached.data) && cached.data.length > 0 && !query && !force) {
    const cacheAge = nowMs - cached.timestamp;
    if (cacheAge < cacheTTL) {
      const activeList = filterActiveUpcomingFixtures(cached.data, targetDate, clientTz);
      if (activeList.length > 0) {
        serverCacheHits++;
        return res.json({
          success: true,
          source: "persistent_disk_cache",
          remainingCalls: lastRemainingCalls,
          quotaShieldActive,
          cachedAt: cached.timestamp,
          count: activeList.length,
          fixtures: activeList
        });
      }
    }
  }
  try {
    const resultList = await runSingleFlight(cacheKey, async () => {
      let upcomingOnly = [];
      const espnFixtures = await fetchEspnSoccerFixtures(targetDate, clientTz);
      await hydrateTelemetryFromSupabaseIfNeeded();
      const afScheduleCacheKey = `apifootball_schedule_v3_${targetDate}`;
      let cachedAfEnvelope = getCacheItem(afScheduleCacheKey);
      const afScheduleTTL = targetDate === todayLocal ? 8 * 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
      if ((!cachedAfEnvelope || Date.now() - cachedAfEnvelope.timestamp >= afScheduleTTL) && isSupabaseConfigured()) {
        const supaSchedule = await getSupabaseKvCache(
          afScheduleCacheKey
        );
        if (supaSchedule && supaSchedule.data && Array.isArray(supaSchedule.data.items) && Date.now() - supaSchedule.timestamp < afScheduleTTL) {
          memoryCache.set(afScheduleCacheKey, {
            data: supaSchedule.data,
            timestamp: supaSchedule.timestamp
          });
          cachedAfEnvelope = memoryCache.get(afScheduleCacheKey);
          if (typeof supaSchedule.data.remainingCalls === "number") {
            lastRemainingCalls = supaSchedule.data.remainingCalls;
            quotaShieldActive = lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD;
          }
        }
      }
      if (cachedAfEnvelope && typeof cachedAfEnvelope.data === "object" && Array.isArray(cachedAfEnvelope.data.items) && Date.now() - cachedAfEnvelope.timestamp < afScheduleTTL) {
        serverCacheHits++;
        upcomingOnly = filterActiveUpcomingFixtures(
          JSON.parse(JSON.stringify(cachedAfEnvelope.data.items)),
          targetDate,
          clientTz
        );
      } else if (apiKey && !quotaShieldActive && lastRemainingCalls > QUOTA_SHIELD_THRESHOLD) {
        try {
          serverCacheMisses++;
          const apiRes = await fetch(
            `https://v3.football.api-sports.io/fixtures?date=${targetDate}&timezone=America/Bogota`,
            {
              method: "GET",
              headers: { "x-apisports-key": apiKey }
            }
          );
          updateQuotaFromHeaders(apiRes.headers);
          if (apiRes.ok) {
            const json = await apiRes.json();
            const rawList = Array.isArray(json.response) ? json.response : [];
            const compactPrimeList = rawList.filter((f) => {
              const lName = String(f?.league?.name || "");
              const cName = String(f?.league?.country || "");
              const hName = String(f?.teams?.home?.name || "");
              const aName = String(f?.teams?.away?.name || "");
              return !isServerYouthOrLowTierMatch(lName, cName, hName, aName);
            });
            const envelopePayload = {
              fetchedAt: Date.now(),
              remainingCalls: lastRemainingCalls,
              items: compactPrimeList
            };
            setCacheItem(afScheduleCacheKey, envelopePayload);
            if (isSupabaseConfigured()) {
              await setSupabaseKvCache(afScheduleCacheKey, envelopePayload);
            }
            const nowIso = (/* @__PURE__ */ new Date()).toISOString();
            apiFootballAuditLog.unshift({
              at: nowIso,
              timestamp: nowIso,
              targetDate,
              date: targetDate,
              endpoint: `/fixtures?date=${targetDate}`,
              status: apiRes.status,
              fixturesCount: compactPrimeList.length,
              itemsCount: compactPrimeList.length,
              remainingAfter: lastRemainingCalls
            });
            if (apiFootballAuditLog.length > 30) apiFootballAuditLog.pop();
            saveTelemetrySnapshotToCache(true);
            upcomingOnly = filterActiveUpcomingFixtures(compactPrimeList, targetDate, clientTz);
          } else {
            const emptyEnvelope = { fetchedAt: Date.now(), remainingCalls: lastRemainingCalls, items: [] };
            setCacheItem(afScheduleCacheKey, emptyEnvelope);
            if (isSupabaseConfigured()) {
              await setSupabaseKvCache(afScheduleCacheKey, emptyEnvelope);
            }
          }
        } catch {
        }
      }
      if (upcomingOnly.length > 0 && espnFixtures.length > 0) {
        for (const f of upcomingOnly) {
          const hKey = normalizeTeamKey(f?.teams?.home?.name || "");
          const aKey = normalizeTeamKey(f?.teams?.away?.name || "");
          const matchedEspn = espnFixtures.find(
            (ef) => teamsFuzzyMatch(
              hKey,
              aKey,
              normalizeTeamKey(ef?.teams?.home?.name || ""),
              normalizeTeamKey(ef?.teams?.away?.name || "")
            )
          );
          if (matchedEspn) {
            f.espnEventId = matchedEspn.espnEventId;
            if (matchedEspn.liveStats) f.liveStats = matchedEspn.liveStats;
            if (matchedEspn.liveEvents) f.liveEvents = matchedEspn.liveEvents;
            if (matchedEspn.liveRosters) f.liveRosters = matchedEspn.liveRosters;
            const espnShort = String(matchedEspn.fixture?.status?.short || "").toUpperCase();
            if (["1H", "2H", "HT", "1ET", "2ET", "ET", "PEN", "FT", "PST", "CANC", "SUSP"].includes(espnShort)) {
              f.fixture.status.short = espnShort;
              f.fixture.status.elapsed = matchedEspn.fixture.status.elapsed;
              f.goals = matchedEspn.goals;
            }
          }
        }
        const validEspnExtras = filterActiveUpcomingFixtures(espnFixtures, targetDate, clientTz);
        for (const ef of validEspnExtras) {
          const ehKey = normalizeTeamKey(ef?.teams?.home?.name || "");
          const eaKey = normalizeTeamKey(ef?.teams?.away?.name || "");
          const alreadyExists = upcomingOnly.some(
            (f) => teamsFuzzyMatch(
              ehKey,
              eaKey,
              normalizeTeamKey(f?.teams?.home?.name || ""),
              normalizeTeamKey(f?.teams?.away?.name || "")
            )
          );
          if (!alreadyExists) {
            upcomingOnly.push(ef);
          }
        }
        upcomingOnly = filterActiveUpcomingFixtures(upcomingOnly, targetDate, clientTz);
      }
      if (upcomingOnly.length === 0) {
        upcomingOnly = filterActiveUpcomingFixtures(espnFixtures, targetDate, clientTz);
      }
      upcomingOnly.sort((a, b) => {
        const sA = String(a.fixture?.status?.short || "").toUpperCase();
        const sB = String(b.fixture?.status?.short || "").toUpperCase();
        const liveA = ["1H", "2H", "HT", "ET", "1ET", "2ET", "PEN", "LIVE"].includes(sA) ? 0 : 1;
        const liveB = ["1H", "2H", "HT", "ET", "1ET", "2ET", "PEN", "LIVE"].includes(sB) ? 0 : 1;
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
      filtered = resultList.filter((f) => {
        const hName = (f.teams?.home?.name || "").toLowerCase();
        const aName = (f.teams?.away?.name || "").toLowerCase();
        const lName = (f.league?.name || "").toLowerCase();
        return hName.includes(query) || aName.includes(query) || lName.includes(query);
      });
    }
    return res.json({
      success: true,
      source: "hybrid_official_coalesced",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      count: filtered.length,
      fixtures: filtered
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return res.json({
        success: true,
        source: "fallback_disk_cache",
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
    return res.json({ success: false, error: msg, fixtures: [] });
  }
});
app.get("/api/audit-finished", dataRateLimitMiddleware, async (_req, res) => {
  const yesterdayStr = getColombiaDateStr(-1);
  const auditCacheKey = `audit_finished_dia_vencido_v8_${yesterdayStr}`;
  const cachedAudit = getCacheItem(auditCacheKey);
  if (cachedAudit && cachedAudit.data && Array.isArray(cachedAudit.data.fixtures) && cachedAudit.data.fixtures.length > 0 && Date.now() - cachedAudit.timestamp < 30 * 60 * 1e3) {
    return res.json({
      success: true,
      source: "audit_cache_dia_vencido",
      fixtures: cachedAudit.data.fixtures,
      nbaEvents: cachedAudit.data.nbaEvents || []
    });
  }
  try {
    const auditPayload = await runSingleFlight(auditCacheKey, async () => {
      const results = [];
      const nbaFinishedEvents = [];
      const datesToScan = [
        getColombiaDateStr(-1),
        getColombiaDateStr(-2),
        getColombiaDateStr(-3),
        getColombiaDateStr(-4),
        getColombiaDateStr(-5)
      ];
      for (const dStr of datesToScan) {
        const espnDate = dStr.replace(/-/g, "");
        try {
          const sbRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDate}&limit=300`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
              }
            }
          );
          if (sbRes.ok) {
            const sbData = await sbRes.json();
            const events = Array.isArray(sbData?.events) ? sbData.events : [];
            for (const ev of events) {
              const state = String(ev?.status?.type?.state || "").toLowerCase();
              if (state !== "post" && ev?.status?.type?.completed !== true) continue;
              const comp = ev?.competitions?.[0];
              if (!comp) continue;
              const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
              const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
              const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
              if (!homeComp || !awayComp) continue;
              const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "Local");
              const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "Visitante");
              const rawUid = String(ev?.uid || "");
              const espnLeagueId = rawUid.match(/~l:(\d+)/)?.[1] || "0";
              const catalogEntry = ESPN_LEAGUE_CATALOG[espnLeagueId];
              const rawCountry = String(comp?.venue?.address?.country || "Internacional");
              const countryTranslated = COUNTRY_TRANSLATION_MAP[rawCountry];
              const resolvedCountry = catalogEntry?.country || countryTranslated?.country || rawCountry || "Internacional";
              const resolvedFlag = catalogEntry?.flag || countryTranslated?.flag || "\u{1F30D}";
              const rawSlug = String(ev?.season?.slug || "Liga Oficial").replace(/-/g, " ");
              const resolvedLeagueName = catalogEntry?.name || String(ev?.league?.name || comp?.league?.name || `Torneo ${resolvedCountry}`);
              const resolvedLeagueId = catalogEntry?.id || parseInt(espnLeagueId, 10) || 10500;
              const combinedCheck = `${resolvedLeagueName} ${rawSlug} ${homeName} ${awayName}`.toLowerCase();
              if (/\b(u-?1[1-6]|sub-?1[1-6]|primavera|premier league 2|youth|juvenil|reservas|reserve)\b/i.test(combinedCheck)) {
                continue;
              }
              const espnEventId = String(ev.id || "");
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
                  id: parseInt(espnEventId || "0", 10) || Math.floor(Math.random() * 9e5 + 1e5),
                  date: ev.date,
                  timestamp: Math.floor(new Date(ev.date).getTime() / 1e3),
                  venue: {
                    name: comp?.venue?.fullName || "Estadio Oficial",
                    city: comp?.venue?.address?.city || resolvedCountry
                  },
                  status: {
                    short: "FT",
                    elapsed: 90
                  }
                },
                league: {
                  id: resolvedLeagueId,
                  name: resolvedLeagueName,
                  country: resolvedCountry,
                  flag: resolvedFlag,
                  round: "Jornada Oficial"
                },
                teams: {
                  home: {
                    id: parseInt(String(homeComp?.team?.id || "1"), 10) || 1,
                    name: homeName,
                    logo: String(homeComp?.team?.logo || "")
                  },
                  away: {
                    id: parseInt(String(awayComp?.team?.id || "2"), 10) || 2,
                    name: awayName,
                    logo: String(awayComp?.team?.logo || "")
                  }
                },
                goals: {
                  home: parseInt(String(homeComp?.score || "0"), 10) || 0,
                  away: parseInt(String(awayComp?.score || "0"), 10) || 0
                }
              });
            }
          }
        } catch {
        }
        try {
          const nbaRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0"
              }
            }
          );
          if (nbaRes.ok) {
            const nbaData = await nbaRes.json();
            const bEvents = Array.isArray(nbaData?.events) ? nbaData.events : [];
            for (const bev of bEvents) {
              const bState = String(bev?.status?.type?.state || "").toLowerCase();
              const bDesc = String(bev?.status?.type?.description || "").toLowerCase();
              if (bState === "post" || bev?.status?.type?.completed === true || bDesc.includes("final")) {
                bev._sportstatsLeague = { name: "NBA", country: "Estados Unidos" };
                bev._auditDateStr = dStr;
                nbaFinishedEvents.push(bev);
              }
            }
          }
        } catch {
        }
      }
      const toEnrich = results.filter((item) => {
        if (!item.espnEventId) return false;
        const cHome = item.liveStats?.home?.corners ?? 0;
        const cAway = item.liveStats?.away?.corners ?? 0;
        return cHome + cAway === 0;
      }).slice(0, 60);
      if (toEnrich.length > 0) {
        await Promise.allSettled(
          toEnrich.map(async (item) => {
            try {
              const enriched = await fetchEspnMatchSummaryTelemetry(
                item.espnEventId,
                item.teams.home.name,
                item.teams.away.name,
                90,
                true,
                { liveStats: item.liveStats, liveEvents: item.liveEvents || [] }
              );
              if (enriched && enriched.liveStats) {
                item.liveStats = enriched.liveStats;
                item.liveEvents = enriched.liveEvents;
              }
            } catch {
            }
          })
        );
      }
      const payload = { fixtures: results, nbaEvents: nbaFinishedEvents };
      if (results.length > 0 || nbaFinishedEvents.length > 0) {
        setCacheItem(auditCacheKey, payload);
      }
      return payload;
    });
    return res.json({
      success: true,
      source: "espn_prime_and_secondary_finished_dia_vencido",
      fixtures: auditPayload.fixtures,
      nbaEvents: auditPayload.nbaEvents
    });
  } catch (err) {
    return res.json({
      success: false,
      fixtures: [],
      nbaEvents: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
app.get("/api/live-pulse", dataRateLimitMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  const requestedDate = req.query.date || "";
  const force = req.query.force === "true" && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, "");
  const pulseCacheKey = `live_pulse_v6_${espnDateStr}`;
  const cachedPulse = getCacheItem(pulseCacheKey);
  if (!force && cachedPulse && Date.now() - cachedPulse.timestamp < 15 * 1e3) {
    serverCacheHits++;
    return res.json({
      success: true,
      source: "hybrid_memory_pulse",
      timestamp: cachedPulse.timestamp,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas: cachedPulse.data
    });
  }
  try {
    const deltas = await runSingleFlight(pulseCacheKey, async () => {
      espnPulseCallsCount++;
      const liveDeltas = [];
      const apiLiveAll = await fetchApiFootballLiveAll();
      for (const lf of apiLiveAll) {
        const fId = String(lf?.fixture?.id || "");
        const homeName = String(lf?.teams?.home?.name || "");
        const awayName = String(lf?.teams?.away?.name || "");
        const statusShort = String(lf?.fixture?.status?.short || "2H").toUpperCase();
        const isHalfTime = statusShort === "HT" || statusShort === "BT";
        const isFinished = ["FT", "AET", "PEN"].includes(statusShort);
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
          status: isFinished ? "FINISHED" : "IN_PLAY",
          liveStats: afTelemetry.liveStats,
          liveEvents: afTelemetry.liveEvents
        });
      }
      try {
        const espnRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
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
            const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
            const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
            if (!homeComp || !awayComp) continue;
            const clockParsed = parseEspnMatchStatusAndClock(ev);
            if (!clockParsed.isLive && !clockParsed.isPost) continue;
            const isLive = clockParsed.isLive;
            const isPost = clockParsed.isPost;
            const isHalfTime = clockParsed.isHalfTime;
            const parsedMin = clockParsed.elapsedMin ?? 45;
            const statusShort = clockParsed.statusShort;
            const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "");
            const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "");
            const homeScore = parseInt(String(homeComp?.score || "0"), 10) || 0;
            const awayScore = parseInt(String(awayComp?.score || "0"), 10) || 0;
            const espnEventId = String(ev.id || "");
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
                status: isLive ? "IN_PLAY" : "FINISHED",
                liveStats: sbTelemetry.liveStats,
                liveEvents: sbTelemetry.liveEvents
              });
            }
          }
          const activeInPlay = liveDeltas.filter((d) => d.status === "IN_PLAY" && d.espnEventId).slice(0, 25);
          if (activeInPlay.length > 0) {
            await Promise.allSettled(
              activeInPlay.map(async (delta) => {
                const enriched = await fetchEspnMatchSummaryTelemetry(
                  delta.espnEventId,
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
                  const maxEvMin = enriched.liveEvents.reduce((acc, evItem) => {
                    if (evItem?.type === "PERIOD_HALF" || evItem?.type === "PERIOD_END" || evItem?.type === "PERIOD_START") {
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
      }
      const upcomingCache = getCacheItem(`upcoming_v8_${targetDate}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        for (const f of upcomingCache.data) {
          const fId = String(f?.fixture?.id || "");
          const hName = String(f?.teams?.home?.name || "");
          const aName = String(f?.teams?.away?.name || "");
          const hKey = normalizeTeamKey(hName);
          const aKey = normalizeTeamKey(aName);
          const matched = liveDeltas.find(
            (d) => d.id && String(d.id) === fId || d.espnEventId && String(d.espnEventId) === fId || teamsFuzzyMatch(hKey, aKey, d.homeKey, d.awayKey)
          );
          const matchTimestamp = f?.fixture?.timestamp ? f.fixture.timestamp * 1e3 : new Date(f?.fixture?.date || 0).getTime();
          const minsSinceStart = Math.floor((Date.now() - matchTimestamp) / 6e4);
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
              f.fixture.status.short = matched.status === "FINISHED" ? "FT" : matched.isHalfTime ? "HT" : matched.statusShort || "2H";
              f.fixture.status.elapsed = matched.minute;
            }
            continue;
          }
          if (minsSinceStart > 115) {
            if (f.fixture?.status) {
              f.fixture.status.short = "FT";
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
              statusShort: "FT",
              status: "FINISHED"
            });
            continue;
          }
          const statusShort = String(f?.fixture?.status?.short || "").toUpperCase();
          if (["1H", "2H", "HT", "ET", "LIVE", "BT", "P", "INT"].includes(statusShort) && minsSinceStart <= 115) {
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
              status: clockEst.minute >= 90 && minsSinceStart > 108 ? "FINISHED" : "IN_PLAY",
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
      source: "hybrid_live_pulse",
      timestamp: Date.now(),
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas
    });
  } catch (err) {
    return res.json({
      success: false,
      timestamp: Date.now(),
      deltas: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
app.get("/api/match-telemetry", dataRateLimitMiddleware, async (req, res) => {
  const fixtureId = String(req.query.id || "").trim();
  const espnIdParam = String(req.query.espnId || req.query.eventId || "").trim();
  const dateStr = String(req.query.date || getColombiaDateStr(0)).trim();
  const homeName = String(req.query.home || "").trim();
  const awayName = String(req.query.away || "").trim();
  try {
    let resolvedEspnId = espnIdParam || (/^\d{9,}$/.test(fixtureId) ? fixtureId : "");
    let fallbackTelemetry = {
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
    let statusShort = "2H";
    let homeGoals = void 0;
    let awayGoals = void 0;
    const espnDateStr = dateStr.replace(/-/g, "");
    const hKey = normalizeTeamKey(homeName);
    const aKey = normalizeTeamKey(awayName);
    try {
      const sbRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
          }
        }
      );
      if (sbRes.ok) {
        const sbData = await sbRes.json();
        const events = Array.isArray(sbData?.events) ? sbData.events : [];
        const matchedEv = events.find((ev) => {
          if (resolvedEspnId && String(ev.id) === resolvedEspnId) return true;
          const comp = ev?.competitions?.[0];
          const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
          const hc = competitors.find((c) => c.homeAway === "home") || competitors[0];
          const ac = competitors.find((c) => c.homeAway === "away") || competitors[1];
          return teamsFuzzyMatch(
            hKey,
            aKey,
            normalizeTeamKey(hc?.team?.displayName || hc?.team?.name || ""),
            normalizeTeamKey(ac?.team?.displayName || ac?.team?.name || "")
          );
        });
        if (matchedEv) {
          resolvedEspnId = String(matchedEv.id);
          const comp = matchedEv.competitions?.[0];
          const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
          const hc = competitors.find((c) => c.homeAway === "home") || competitors[0];
          const ac = competitors.find((c) => c.homeAway === "away") || competitors[1];
          const clockParsed = parseEspnMatchStatusAndClock(matchedEv);
          isFinished = clockParsed.isPost;
          isHalfTime = clockParsed.isHalfTime;
          statusShort = clockParsed.statusShort;
          elapsedMin = clockParsed.elapsedMin ?? 45;
          if (clockParsed.isLive || clockParsed.isPost) {
            homeGoals = parseInt(String(hc?.score || "0"), 10) || 0;
            awayGoals = parseInt(String(ac?.score || "0"), 10) || 0;
          }
          fallbackTelemetry = extractEspnScoreboardTelemetry(
            matchedEv,
            comp,
            hc,
            ac,
            homeName || String(hc?.team?.displayName || "Local"),
            awayName || String(ac?.team?.displayName || "Visitante"),
            elapsedMin,
            isFinished
          );
        }
      }
    } catch {
    }
    if (resolvedEspnId) {
      const enriched = await fetchEspnMatchSummaryTelemetry(
        resolvedEspnId,
        homeName || "Local",
        awayName || "Visitante",
        elapsedMin,
        isFinished,
        fallbackTelemetry
      );
      if (!isHalfTime && Array.isArray(enriched.liveEvents)) {
        const maxEvMin = enriched.liveEvents.reduce((acc, evItem) => {
          if (evItem?.type === "PERIOD_HALF" || evItem?.type === "PERIOD_END" || evItem?.type === "PERIOD_START") {
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
      (lf) => String(lf?.fixture?.id || "") === fixtureId || teamsFuzzyMatch(
        hKey,
        aKey,
        normalizeTeamKey(lf?.teams?.home?.name || ""),
        normalizeTeamKey(lf?.teams?.away?.name || "")
      )
    );
    if (!matchedAf) {
      const upcomingCache = getCacheItem(`upcoming_v8_${dateStr}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        matchedAf = upcomingCache.data.find(
          (f) => String(f?.fixture?.id || "") === fixtureId || teamsFuzzyMatch(
            hKey,
            aKey,
            normalizeTeamKey(f?.teams?.home?.name || ""),
            normalizeTeamKey(f?.teams?.away?.name || "")
          )
        );
      }
    }
    const syntheticOrMatched = matchedAf || {
      fixture: { id: fixtureId, status: { short: "2H", elapsed: 45 } },
      teams: { home: { name: homeName || "Local" }, away: { name: awayName || "Visitante" } },
      goals: { home: 0, away: 0 },
      events: []
    };
    const stShort = String(syntheticOrMatched?.fixture?.status?.short || "").toUpperCase();
    const isHT = stShort === "HT" || stShort === "BT";
    const isFT = ["FT", "AET", "PEN"].includes(stShort);
    const afTele = extractApiFootballLiveTelemetry(
      syntheticOrMatched,
      void 0,
      void 0,
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
  } catch (err) {
    return res.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
app.get("/api/nba/scoreboard", dataRateLimitMiddleware, async (req, res) => {
  const dateQuery = req.query.date || "";
  const force = req.query.force === "true" && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayColombia = getColombiaDateStr(0);
  const targetDate = dateQuery || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, "");
  const cacheKey = `nba_sb_v3_${espnDateStr}`;
  const cached = getCacheItem(cacheKey);
  const hasLiveNbaInCache = cached && Array.isArray(cached.data) && cached.data.some((ev) => String(ev?.status?.type?.state || "").toLowerCase() === "in");
  const cacheTTL = targetDate === todayColombia ? hasLiveNbaInCache ? 25 * 1e3 : 3 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  if (cached && !force && Date.now() - cached.timestamp < cacheTTL) {
    return res.json({
      success: true,
      source: "persistent_disk_cache",
      date: targetDate,
      events: cached.data
    });
  }
  try {
    const rawEvents = await runSingleFlight(cacheKey, async () => {
      const endpoints = [
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDateStr}`,
          league: "NBA",
          country: "Estados Unidos"
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${espnDateStr}&limit=50`,
          league: "NCAA Baloncesto",
          country: "Estados Unidos"
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${espnDateStr}`,
          league: "WNBA",
          country: "Estados Unidos"
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard?dates=${espnDateStr}`,
          league: "FIBA Internacional",
          country: "Mundial"
        },
        {
          url: `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?dates=${espnDateStr}&limit=50`,
          league: "NCAA Femenil",
          country: "Estados Unidos"
        }
      ];
      const targetRefMs = (/* @__PURE__ */ new Date(`${targetDate}T12:00:00-05:00`)).getTime();
      const responses = await Promise.allSettled(
        endpoints.map(async (ep) => {
          let evs = [];
          try {
            const apiRes = await fetch(ep.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0"
              }
            });
            if (apiRes.ok) {
              const data = await apiRes.json();
              const rawList = Array.isArray(data.events) ? data.events : [];
              evs = rawList.filter((ev) => {
                if (!ev?.date) return false;
                const evMs = new Date(ev.date).getTime();
                if (isNaN(evMs)) return false;
                return Math.abs(evMs - targetRefMs) <= 36 * 60 * 60 * 1e3;
              });
            }
          } catch {
          }
          evs.forEach((ev) => {
            ev._sportstatsLeague = {
              name: ep.league,
              country: ep.country
            };
          });
          return evs;
        })
      );
      const allEvents = [];
      responses.forEach((r) => {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          allEvents.push(...r.value);
        }
      });
      if (allEvents.length === 0 && cached) return cached.data;
      setCacheItem(cacheKey, allEvents);
      return allEvents;
    });
    return res.json({
      success: true,
      source: "espn_official_coalesced",
      date: targetDate,
      events: rawEvents
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.json({ success: true, source: "fallback_disk_cache", date: targetDate, events: cached.data });
    }
    return res.json({ success: false, error: msg, events: [] });
  }
});
app.get("/api/fixtures", dataRateLimitMiddleware, async (req, res) => {
  const date = req.query.date || getColombiaDateStr(0);
  const sharedUpcoming = getCacheItem(`upcoming_v8_${date}`);
  if (sharedUpcoming && Array.isArray(sharedUpcoming.data) && sharedUpcoming.data.length > 0) {
    return res.status(200).json({
      success: true,
      source: "persistent_disk_cache",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: sharedUpcoming.data
    });
  }
  const afEnvelope = getCacheItem(`apifootball_schedule_v2_${date}`);
  if (afEnvelope && Array.isArray(afEnvelope.data?.items) && afEnvelope.data.items.length > 0) {
    return res.status(200).json({
      success: true,
      source: "persistent_disk_cache",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: afEnvelope.data.items
    });
  }
  try {
    const espnFallback = await fetchEspnSoccerFixtures(date, "America/Bogota");
    return res.status(200).json({
      success: true,
      source: "espn_official_coalesced",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: espnFallback
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(200).json({
      success: false,
      error: message,
      fixtures: []
    });
  }
});
app.get(["/api/status", "/api/admin/telemetry"], dataRateLimitMiddleware, async (_req, res) => {
  await hydrateTelemetryFromSupabaseIfNeeded();
  const hasApiFootball = Boolean(getSecretKey("API_FOOTBALL_KEY"));
  const hasFootballData = Boolean(getSecretKey("FOOTBALL_DATA_KEY"));
  const hasOddsApi = Boolean(getSecretKey("ODDS_API_KEY"));
  const hasBallDontLie = Boolean(getSecretKey("BALLDONTLIE_API_KEY"));
  const onlineUsers = getActiveOnlineUsersList();
  const totalRequests = serverCacheHits + serverCacheMisses;
  const cacheHitRatePct = totalRequests > 0 ? Math.round(serverCacheHits / totalRequests * 1e3) / 10 : 100;
  return res.json({
    success: true,
    status: "ok",
    apiFootball: hasApiFootball,
    footballData: hasFootballData,
    oddsApi: hasOddsApi,
    ballDontLie: hasBallDontLie,
    remainingCalls: lastRemainingCalls,
    consumedTodayEst: Math.max(0, 100 - lastRemainingCalls),
    quotaShieldActive: lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD,
    quotaShieldThreshold: QUOTA_SHIELD_THRESHOLD,
    cachedEntriesCount: memoryCache.size,
    cacheTtlMinutes: 480,
    scheduleTTLHours: 8,
    apiFootballCallsSinceBoot: apiFootballAuditLog.length,
    apiFootballAuditLog,
    onlineNowCount: onlineUsers.length,
    onlineUsers,
    peakOnlineUsers: Math.max(peakOnlineUsers, onlineUsers.length),
    peakOnlineAt,
    serverCacheHits,
    serverCacheMisses,
    cacheHitRatePct,
    espnPulseCallsCount,
    uptimeMinutes: Math.max(1, Math.round(process.uptime() / 60)),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    serverBootTimeIso,
    bundleVersion: "v2.7-supabase-serverless-shield-8h",
    isVercel: IS_VERCEL2,
    supabasePersistence: isSupabaseConfigured(),
    serverReady: true
  });
});
app.get("/api/market-odds", dataRateLimitMiddleware, async (req, res) => {
  const sport = sanitizeText(req.query.sport || "soccer_epl", 32);
  const oddsKey = getSecretKey("ODDS_API_KEY");
  const isNBA = sport.includes("nba") || sport.includes("basketball");
  const cacheKey = isNBA ? "odds_nba_v1" : "odds_soccer";
  const cached = getCacheItem(cacheKey);
  const cacheTTL = isNBA ? 10 * 60 * 1e3 : 60 * 60 * 1e3;
  if (cached && Date.now() - cached.timestamp < cacheTTL) {
    return res.json({ success: true, source: "persistent_disk_cache", sport: isNBA ? "basketball_nba" : "soccer_epl", odds: cached.data });
  }
  if (!oddsKey) {
    return res.json({ success: false, message: "No The Odds API key configured.", sport, odds: cached?.data || [] });
  }
  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const targetUrl = isNBA ? `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${oddsKey}&regions=us,eu&markets=h2h,spreads,totals` : `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${oddsKey}&regions=eu&markets=h2h`;
      const apiRes = await fetch(targetUrl, { method: "GET" });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({
      success: true,
      source: "the_odds_api_coalesced",
      sport: isNBA ? "basketball_nba" : "soccer_epl",
      odds: data
    });
  } catch {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", sport, odds: cached.data });
    return res.json({ success: false, error: "Error al consultar cuotas externas", odds: [] });
  }
});
app.get("/api/nba/summary", dataRateLimitMiddleware, async (req, res) => {
  const eventId = sanitizeText(req.query.eventId || req.query.id || "", 32);
  if (!eventId) {
    return res.status(400).json({ success: false, error: "Se requiere eventId de ESPN" });
  }
  const cacheKey = `nba_summary_${eventId}`;
  const cached = getCacheItem(cacheKey);
  const isFinished = cached?.data?.header?.competitions?.[0]?.status?.type?.completed;
  const isLive = cached?.data?.header?.competitions?.[0]?.status?.type?.state === "in";
  const ttl = isFinished ? 24 * 60 * 60 * 1e3 : isLive ? 25 * 1e3 : 5 * 60 * 1e3;
  if (cached && Date.now() - cached.timestamp < ttl) {
    return res.json({ success: true, source: "persistent_disk_cache", data: cached.data });
  }
  try {
    const summary = await runSingleFlight(cacheKey, async () => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`;
      const apiRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0"
        }
      });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return null;
      }
      const data = await apiRes.json();
      setCacheItem(cacheKey, data);
      return data;
    });
    if (!summary && cached) {
      return res.json({ success: true, source: "fallback_disk_cache", data: cached.data });
    }
    return res.json({
      success: true,
      source: "espn_official_summary",
      data: summary
    });
  } catch (err) {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", data: cached.data });
    return res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/nba/rosters", dataRateLimitMiddleware, async (req, res) => {
  const teamIdParam = sanitizeText(req.query.teamId || req.query.teamIds || "", 64);
  if (!teamIdParam) {
    return res.status(400).json({ success: false, error: "Se requiere teamId o teamIds" });
  }
  const teamIds = teamIdParam.split(",").map((id) => id.trim()).filter(Boolean);
  const results = {};
  try {
    await Promise.all(
      teamIds.map(async (tId) => {
        const cacheKey = `nba_roster_${tId}`;
        const cached = getCacheItem(cacheKey);
        if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1e3) {
          results[tId] = cached.data;
          return;
        }
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${tId}/roster`;
          const apiRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0"
            }
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            setCacheItem(cacheKey, data);
            results[tId] = data;
          } else if (cached) {
            results[tId] = cached.data;
          }
        } catch {
          if (cached) results[tId] = cached.data;
        }
      })
    );
    return res.json({
      success: true,
      source: "espn_official_rosters",
      rosters: results
    });
  } catch (err) {
    return res.json({ success: false, error: err instanceof Error ? err.message : String(err), rosters: {} });
  }
});
app.get("/api/nba/bdl/*", dataRateLimitMiddleware, async (req, res) => {
  const bdlKey = getSecretKey("BALLDONTLIE_API_KEY");
  const subPath = req.params[0] || "teams";
  const queryStr = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  if (!bdlKey) {
    return res.json({
      success: false,
      hasKey: false,
      message: "BALLDONTLIE_API_KEY no configurada. Usando base de datos interna y ESPN como refuerzo principal."
    });
  }
  const cacheKey = `bdl_${subPath}_${queryStr}`;
  const cached = getCacheItem(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1e3) {
    return res.json({ success: true, source: "persistent_disk_cache", data: cached.data });
  }
  try {
    const targetUrl = `https://api.balldontlie.io/v1/${subPath}${queryStr}`;
    const apiRes = await fetch(targetUrl, {
      headers: {
        Authorization: bdlKey
      }
    });
    if (!apiRes.ok) {
      if (cached) return res.json({ success: true, source: "fallback_disk_cache", data: cached.data });
      return res.status(apiRes.status).json({ success: false, error: `Error de BallDontLie: ${apiRes.status}` });
    }
    const data = await apiRes.json();
    setCacheItem(cacheKey, data);
    return res.json({ success: true, source: "balldontlie_live", data });
  } catch (err) {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", data: cached.data });
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
app.get("/api/standings", dataRateLimitMiddleware, async (req, res) => {
  const fdKey = getSecretKey("FOOTBALL_DATA_KEY");
  const league = sanitizeText(req.query.league || "PD", 10) || "PD";
  const cacheKey = `standings_${league}`;
  const cached = getCacheItem(cacheKey);
  if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1e3) {
    return res.json({ success: true, source: "persistent_disk_cache", standings: cached.data });
  }
  if (!fdKey) {
    return res.json({ success: false, message: "No Football-Data key configured.", standings: cached?.data || [] });
  }
  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://api.football-data.org/v4/competitions/${encodeURIComponent(league)}/standings`, {
        method: "GET",
        headers: { "X-Auth-Token": fdKey }
      });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: "football_data_coalesced", standings: data });
  } catch {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", standings: cached.data });
    return res.json({ success: false, error: "Error al consultar clasificaciones", standings: [] });
  }
});
var LICENSES_FILE = IS_VERCEL2 ? path2.resolve("/tmp", "licenses_db.json") : path2.resolve(__dirname, "licenses_db.json");
var ADMIN_CONFIG_FILE = IS_VERCEL2 ? path2.resolve("/tmp", "admin_config.json") : path2.resolve(__dirname, "admin_config.json");
var BUNDLED_ADMIN_CONFIG_FILE = path2.resolve(__dirname, "admin_config.json");
var LICENSE_MASTER_SECRET = process.env.LICENSE_MASTER_SECRET || "FUTBOLSTATS_PRO_SECURE_HMAC_SALT_2026_X9";
var MASTER_RECOVERY_CODE = process.env.ADMIN_MASTER_KEY || "MASTER-2708";
var memoryAdminConfig = null;
function getAdminConfig() {
  const defaultConfig = {
    adminPin: process.env.ADMIN_PIN || "120328",
    adminWhatsApp: process.env.ADMIN_WHATSAPP || "573213902708",
    supportName: "Administrador G METRICS",
    customLogoUrl: "/custom-logo.png",
    colorTheme: "cyan-emerald"
  };
  if (memoryAdminConfig) {
    return memoryAdminConfig;
  }
  try {
    if (fs2.existsSync(ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs2.readFileSync(ADMIN_CONFIG_FILE, "utf8"));
      const resolved = { ...defaultConfig, ...data };
      memoryAdminConfig = resolved;
      return resolved;
    }
    if (fs2.existsSync(BUNDLED_ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs2.readFileSync(BUNDLED_ADMIN_CONFIG_FILE, "utf8"));
      const resolved = { ...defaultConfig, ...data };
      memoryAdminConfig = resolved;
      return resolved;
    }
  } catch {
  }
  return defaultConfig;
}
function extractAdminCredential(req, bodyPinField) {
  const headerPin = req.headers["x-admin-pin"];
  if (typeof headerPin === "string" && headerPin.trim()) {
    return headerPin.trim();
  }
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifySessionJwt(token);
    if (verified && verified.role === "admin") {
      return "__VALID_ADMIN_JWT__";
    }
  }
  if (typeof bodyPinField === "string" && bodyPinField.trim()) {
    return bodyPinField.trim();
  }
  if (typeof req.query.pin === "string" && req.query.pin.trim()) {
    return req.query.pin.trim();
  }
  return "";
}
function isValidAdminPin(pin, cfg) {
  if (!pin || typeof pin !== "string") return false;
  if (pin === "__VALID_ADMIN_JWT__") return true;
  const clean = pin.trim();
  const upper = clean.toUpperCase();
  const envMasterKey = (process.env.ADMIN_MASTER_KEY || "").trim();
  const isStrictProd = process.env.NODE_ENV === "production" && Boolean(envMasterKey);
  if (timingSafeCompare(clean, cfg.adminPin)) return true;
  if (envMasterKey && timingSafeCompare(clean, envMasterKey)) return true;
  if (!isStrictProd) {
    return timingSafeCompare(clean, "120328") || timingSafeCompare(upper, "MASTER-2708") || timingSafeCompare(upper, "2708");
  }
  return false;
}
app.post("/api/set-secret-key", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, req.body?.adminPin || req.body?.pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado para modificar claves de servidor" });
  }
  clearAuthFailures(req);
  const { key, footballDataKey, oddsApiKey, ballDontLieKey } = req.body || {};
  try {
    const envPath = path2.resolve(process.cwd(), ".env");
    let envContent = fs2.existsSync(envPath) ? fs2.readFileSync(envPath, "utf8") : "";
    if (key && typeof key === "string" && key.trim()) {
      const clean = sanitizeText(key.trim(), 128);
      process.env.API_FOOTBALL_KEY = clean;
      if (envContent.includes("API_FOOTBALL_KEY=")) {
        envContent = envContent.replace(/API_FOOTBALL_KEY=.*/g, `API_FOOTBALL_KEY="${clean}"`);
      } else {
        envContent += `
API_FOOTBALL_KEY="${clean}"
`;
      }
    }
    if (footballDataKey && typeof footballDataKey === "string" && footballDataKey.trim()) {
      const clean = sanitizeText(footballDataKey.trim(), 128);
      process.env.FOOTBALL_DATA_KEY = clean;
      if (envContent.includes("FOOTBALL_DATA_KEY=")) {
        envContent = envContent.replace(/FOOTBALL_DATA_KEY=.*/g, `FOOTBALL_DATA_KEY="${clean}"`);
      } else {
        envContent += `
FOOTBALL_DATA_KEY="${clean}"
`;
      }
    }
    if (oddsApiKey && typeof oddsApiKey === "string" && oddsApiKey.trim()) {
      const clean = sanitizeText(oddsApiKey.trim(), 128);
      process.env.ODDS_API_KEY = clean;
      if (envContent.includes("ODDS_API_KEY=")) {
        envContent = envContent.replace(/ODDS_API_KEY=.*/g, `ODDS_API_KEY="${clean}"`);
      } else {
        envContent += `
ODDS_API_KEY="${clean}"
`;
      }
    }
    if (ballDontLieKey && typeof ballDontLieKey === "string" && ballDontLieKey.trim()) {
      const clean = sanitizeText(ballDontLieKey.trim(), 128);
      process.env.BALLDONTLIE_API_KEY = clean;
      if (envContent.includes("BALLDONTLIE_API_KEY=")) {
        envContent = envContent.replace(/BALLDONTLIE_API_KEY=.*/g, `BALLDONTLIE_API_KEY="${clean}"`);
      } else {
        envContent += `
BALLDONTLIE_API_KEY="${clean}"
`;
      }
    }
    fs2.writeFileSync(envPath, envContent, "utf8");
    return res.json({
      success: true,
      message: "Claves configuradas en el servidor de forma 100% segura y privada."
    });
  } catch {
    return res.status(500).json({ success: false, error: "Error interno al guardar configuraci\xF3n" });
  }
});
function saveAdminConfig(cfg) {
  memoryAdminConfig = { ...cfg };
  try {
    fs2.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving admin config:", e);
  }
  if (isSupabaseConfigured()) {
    upsertSupabaseAdminConfig(cfg).catch((err) => console.warn("[Supabase Sync Config Error]:", err));
  }
}
function getLicensesDb() {
  try {
    if (fs2.existsSync(LICENSES_FILE)) {
      return JSON.parse(fs2.readFileSync(LICENSES_FILE, "utf8"));
    }
  } catch {
  }
  return [];
}
function saveLicensesDb(list) {
  try {
    fs2.writeFileSync(LICENSES_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving licenses db:", e);
  }
}
function serverGenerateToken(deviceId, planType, customExpiryMs) {
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().replace(/^DEV/, "");
  const nowMs = Date.now();
  let expiresAt = null;
  let planTag = "30D";
  let planLabel = "Pase 30 D\xEDas";
  switch (planType) {
    case "24H":
      expiresAt = nowMs + 24 * 60 * 60 * 1e3;
      planTag = "24H";
      planLabel = "Prueba 24 Horas";
      break;
    case "7D":
      expiresAt = nowMs + 7 * 24 * 60 * 60 * 1e3;
      planTag = "7D";
      planLabel = "Pase Semanal (7 D\xEDas)";
      break;
    case "15D":
      expiresAt = nowMs + 15 * 24 * 60 * 60 * 1e3;
      planTag = "15D";
      planLabel = "Pase Quincenal (15 D\xEDas)";
      break;
    case "30D":
      expiresAt = nowMs + 30 * 24 * 60 * 60 * 1e3;
      planTag = "30D";
      planLabel = "Pase Mensual (30 D\xEDas)";
      break;
    case "90D":
      expiresAt = nowMs + 90 * 24 * 60 * 60 * 1e3;
      planTag = "90D";
      planLabel = "Pase Trimestral (90 D\xEDas)";
      break;
    case "PERMANENT":
      expiresAt = null;
      planTag = "VIP";
      planLabel = "Pase Permanente Vitalicio";
      break;
    case "CUSTOM":
      expiresAt = customExpiryMs || nowMs + 30 * 24 * 60 * 60 * 1e3;
      planTag = "CUS";
      const days = Math.max(1, Math.round((expiresAt - nowMs) / (24 * 60 * 60 * 1e3)));
      planLabel = `Pase Personalizado (${days} d\xEDas)`;
      break;
  }
  const expSeconds = expiresAt === null ? 0 : Math.floor(expiresAt / 1e3);
  const expHex = expSeconds.toString(16).toUpperCase().padStart(8, "0");
  const message = `${cleanDev}:${planTag}:${expHex}`;
  const fullHmac = crypto3.createHmac("sha256", LICENSE_MASTER_SECRET).update(message).digest("hex");
  const sig8 = fullHmac.substring(0, 8).toUpperCase();
  const key = `FS-${planTag}-${cleanDev}-${expHex}-${sig8}`;
  return { key, expiresAt, planLabel };
}
app.get("/api/license/config", (req, res) => {
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  const isAuthenticated = pin ? isValidAdminPin(pin, cfg) : false;
  return res.json({
    success: true,
    adminWhatsApp: cfg.adminWhatsApp,
    supportName: cfg.supportName,
    customLogoUrl: cfg.customLogoUrl,
    colorTheme: cfg.colorTheme || "cyan-emerald",
    currentPin: isAuthenticated ? cfg.adminPin : void 0,
    requiresAuth: true
  });
});
app.post("/api/license/config", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { currentPin, newPin, adminWhatsApp, supportName, customLogoUrl, colorTheme } = req.body || {};
  const currentCfg = getAdminConfig();
  const cred = extractAdminCredential(req, currentPin);
  if (!isValidAdminPin(cred, currentCfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "Credenciales de administrador inv\xE1lidas" });
  }
  clearAuthFailures(req);
  if (newPin && String(newPin).trim().length >= 4) {
    currentCfg.adminPin = sanitizeText(String(newPin).trim(), 32);
  }
  if (adminWhatsApp && typeof adminWhatsApp === "string") {
    currentCfg.adminWhatsApp = sanitizePhone(adminWhatsApp);
  }
  if (supportName && typeof supportName === "string") {
    currentCfg.supportName = sanitizeText(supportName, 60);
  }
  if (typeof customLogoUrl === "string" || customLogoUrl === null) {
    currentCfg.customLogoUrl = customLogoUrl ? sanitizeText(customLogoUrl, 200) : void 0;
  }
  if (typeof colorTheme === "string") {
    currentCfg.colorTheme = sanitizeText(colorTheme, 32);
  }
  saveAdminConfig(currentCfg);
  return res.json({
    success: true,
    message: "Configuraci\xF3n actualizada con \xE9xito",
    config: {
      adminPin: currentCfg.adminPin,
      adminWhatsApp: currentCfg.adminWhatsApp,
      supportName: currentCfg.supportName,
      customLogoUrl: currentCfg.customLogoUrl,
      colorTheme: currentCfg.colorTheme
    }
  });
});
app.post("/api/license/generate", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { adminPin, deviceId, clientNote, planType = "30D", customExpiryMs } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
  clearAuthFailures(req);
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length < 4) {
    return res.status(400).json({ success: false, error: "C\xF3digo de dispositivo no v\xE1lido" });
  }
  const cleanNote = clientNote ? sanitizeText(String(clientNote), 80) : void 0;
  const { key, expiresAt, planLabel } = serverGenerateToken(deviceId.trim(), planType, customExpiryMs);
  const db = getLicensesDb();
  const record = {
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
  const filtered = db.filter((item) => item.key !== key);
  filtered.unshift(record);
  saveLicensesDb(filtered);
  if (isSupabaseConfigured()) {
    upsertSupabaseLicense(record).catch((err) => console.warn("[Supabase Sync License Error]:", err));
  }
  const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "Permanente (Sin Vencimiento)";
  const whatsappReply = `\u{1F525} *G METRICS - Acceso Autorizado*

Hola! Tu acceso al software *G METRICS* ha sido activado con \xE9xito.
\u{1F4CC} *Plan:* ${planLabel}
\u23F3 *Vigencia:* ${formattedDate}
\u{1F511} *Tu Clave de Acceso:*
${key}

*Instrucciones:*
1. Abre la aplicaci\xF3n.
2. Pega tu clave de acceso en la casilla.
3. Presiona "Ingresar a G METRICS". \xA1Listo!`;
  return res.json({
    success: true,
    record,
    whatsappReply
  });
});
app.post("/api/license/heartbeat", (req, res) => {
  const { key, deviceId, username, clientName, deviceInfo } = req.body || {};
  if (!key && !deviceId && !username) {
    return res.json({ success: false, error: "No se enviaron datos de identificaci\xF3n" });
  }
  const db = getLicensesDb();
  const cleanKey = key ? sanitizeText(String(key), 64).toUpperCase() : "";
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : "";
  const cleanUsername = username ? sanitizeText(String(username), 40).toLowerCase() : "";
  const cleanClientName = clientName ? sanitizeText(String(clientName), 60) : "";
  const cleanDevInfo = deviceInfo ? sanitizeText(String(deviceInfo), 80) : "";
  recordOnlinePresence({
    username: cleanUsername || cleanClientName || void 0,
    displayName: cleanClientName || cleanUsername || void 0,
    deviceId: cleanDev || void 0,
    deviceInfo: cleanDevInfo || void 0
  });
  const found = db.find((item) => item.key === cleanKey || item.deviceId === cleanDev);
  if (found) {
    if (cleanKey && cleanDev && found.deviceId && !found.deviceId.includes("ALL")) {
      const normFoundDev = found.deviceId.replace(/[^A-Z0-9]/g, "").replace(/^DEV/, "");
      const normIncomingDev = cleanDev.replace(/[^A-Z0-9]/g, "").replace(/^DEV/, "");
      if (normFoundDev && normIncomingDev && normFoundDev !== normIncomingDev) {
        return res.json({
          success: false,
          revoked: true,
          deviceMismatch: true,
          error: "Dispositivo no coincide con el titular de la licencia"
        });
      }
    }
    found.lastActiveTimestamp = Date.now();
    if (cleanClientName) {
      found.clientName = cleanClientName;
      if (!found.clientNote) found.clientNote = cleanClientName;
    }
    if (cleanDevInfo) {
      found.deviceInfo = cleanDevInfo;
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
app.post("/api/license/validate", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (!key || typeof key !== "string") {
    return res.status(400).json({ isValid: false, error: "Clave no proporcionada" });
  }
  const cfg = getAdminConfig();
  if (isValidAdminPin(key, cfg)) {
    clearAuthFailures(req);
    return res.json({
      isValid: true,
      isAdminUnlock: true,
      status: "ACTIVE",
      message: "Acceso de Administrador verificado",
      isPermanent: true,
      isExpired: false,
      expiryTimestamp: null,
      daysRemaining: null,
      planLabel: "Pase Permanente Vitalicio"
    });
  }
  const db = getLicensesDb();
  const cleanKey = sanitizeText(key, 64).toUpperCase();
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : "";
  let found = db.find((item) => item.key === cleanKey);
  if (found) {
    found.lastActiveTimestamp = Date.now();
    if (clientName && typeof clientName === "string" && clientName.trim()) {
      const cleanName = sanitizeText(clientName, 60);
      found.clientName = cleanName;
      if (!found.clientNote) found.clientNote = cleanName;
    }
    if (deviceInfo && typeof deviceInfo === "string") {
      found.deviceInfo = sanitizeText(deviceInfo, 80);
    }
    saveLicensesDb(db);
    if (found.revoked) {
      return res.json({
        isValid: false,
        status: "REVOKED",
        message: "Esta licencia ha sido revocada o suspendida por el administrador.",
        isPermanent: false,
        isExpired: false,
        expiryTimestamp: found.expiresAt,
        daysRemaining: 0,
        planLabel: found.planLabel
      });
    }
  }
  const parts = cleanKey.split("-");
  if (parts.length !== 5 || parts[0] !== "FS") {
    await recordAuthFailure(req);
    return res.json({
      isValid: false,
      status: "MALFORMED",
      message: "Formato de clave no v\xE1lido."
    });
  }
  const [, planTag, devClean, expHex, givenSig] = parts;
  const message = `${devClean}:${planTag}:${expHex}`;
  const expectedHmac = crypto3.createHmac("sha256", LICENSE_MASTER_SECRET).update(message).digest("hex").substring(0, 8).toUpperCase();
  if (!timingSafeCompare(givenSig, expectedHmac)) {
    await recordAuthFailure(req);
    return res.json({
      isValid: false,
      status: "INVALID_SIGNATURE",
      message: "Firma criptogr\xE1fica inv\xE1lida. La clave no es aut\xE9ntica."
    });
  }
  if (deviceId) {
    const cleanCurrentDev = cleanDev.replace(/[^a-zA-Z0-9]/g, "").replace(/^DEV/, "");
    if (devClean !== "ALL" && devClean !== cleanCurrentDev) {
      return res.json({
        isValid: false,
        status: "INVALID_DEVICE",
        message: "Esta clave fue emitida para otro dispositivo."
      });
    }
  }
  clearAuthFailures(req);
  const expSeconds = parseInt(expHex, 16);
  const isPermanent = expSeconds === 0;
  const nowMs = Date.now();
  const expiryTimestamp = isPermanent ? null : expSeconds * 1e3;
  const isExpired = !isPermanent && expiryTimestamp < nowMs;
  if (!found && !isExpired) {
    const cleanName = clientName ? sanitizeText(String(clientName), 60) : "Cliente Registrado";
    const autoRecord = {
      id: `LIC-${Date.now().toString(36).toUpperCase()}`,
      key: cleanKey,
      deviceId: cleanDev || `DEV-${devClean}`,
      clientNote: cleanName,
      clientName: cleanName,
      planType: planTag,
      planLabel: isPermanent ? "Pase Permanente Vitalicio" : `Pase ${planTag}`,
      createdAt: Date.now(),
      expiresAt: expiryTimestamp,
      lastActiveTimestamp: Date.now(),
      deviceInfo: typeof deviceInfo === "string" ? sanitizeText(deviceInfo, 80) : void 0,
      revoked: false
    };
    db.unshift(autoRecord);
    saveLicensesDb(db);
    found = autoRecord;
  }
  return res.json({
    isValid: !isExpired,
    status: isExpired ? "EXPIRED" : "ACTIVE",
    message: isExpired ? "Licencia expirada" : "Licencia activa",
    isPermanent,
    isExpired,
    expiryTimestamp,
    daysRemaining: expiryTimestamp ? Math.max(0, Math.ceil((expiryTimestamp - nowMs) / (24 * 60 * 60 * 1e3))) : null,
    planLabel: found?.planLabel || "Pase Activo",
    clientName: found?.clientName || found?.clientNote
  });
});
app.get("/api/license/list", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  const list = getLicensesDb();
  const nowMs = Date.now();
  const enriched = list.map((item) => {
    const isOnline = item.lastActiveTimestamp ? nowMs - item.lastActiveTimestamp < 3 * 60 * 1e3 : false;
    const daysRemaining = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - nowMs) / (24 * 60 * 60 * 1e3))) : null;
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
app.post("/api/license/renew", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { adminPin, key, deviceId, addDays = 30 } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
  clearAuthFailures(req);
  const db = getLicensesDb();
  const cleanKey = key ? sanitizeText(String(key), 64).toUpperCase() : "";
  const cleanDev = deviceId ? sanitizeText(String(deviceId), 32).toUpperCase() : "";
  const record = db.find((item) => item.key === cleanKey || item.deviceId === cleanDev);
  if (!record) {
    return res.status(404).json({ success: false, error: "No se encontr\xF3 el registro de la licencia" });
  }
  const nowMs = Date.now();
  const daysToAddMs = Number(addDays) * 24 * 60 * 60 * 1e3;
  if (!record.expiresAt || record.expiresAt < nowMs) {
    record.expiresAt = nowMs + daysToAddMs;
  } else {
    record.expiresAt += daysToAddMs;
  }
  record.revoked = false;
  record.planLabel = `Extensi\xF3n +${addDays} D\xEDas`;
  saveLicensesDb(db);
  const formattedDate = new Date(record.expiresAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  return res.json({
    success: true,
    message: `Acceso renovado exitosamente por +${addDays} d\xEDas (Nuevo vencimiento: ${formattedDate})`,
    record
  });
});
app.post("/api/license/recover", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { recoveryKey, deviceId } = req.body || {};
  const cfg = getAdminConfig();
  const cleanKey = String(recoveryKey || "").trim().toUpperCase();
  const last4Phone = cfg.adminWhatsApp.slice(-4);
  const envMasterKey = (process.env.ADMIN_MASTER_KEY || "").trim().toUpperCase();
  const isStrictProd = process.env.NODE_ENV === "production" && Boolean(envMasterKey);
  let isOtpValid = false;
  if (deviceId && cleanKey) {
    try {
      isOtpValid = await verifyAndConsumeRecoveryOtp(String(deviceId), cleanKey);
    } catch {
      isOtpValid = false;
    }
  }
  const isMasterOrOwner = (envMasterKey ? timingSafeCompare(cleanKey, envMasterKey) : false) || timingSafeCompare(cleanKey, cfg.adminPin.toUpperCase()) || !isStrictProd && (timingSafeCompare(cleanKey, MASTER_RECOVERY_CODE.toUpperCase()) || timingSafeCompare(cleanKey, last4Phone));
  if (!isMasterOrOwner && !isOtpValid) {
    await recordAuthFailure(req);
    return res.status(403).json({
      success: false,
      error: "C\xF3digo de autorizaci\xF3n o clave incorrecta / expirada."
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
app.get("/api/admin/supabase-status", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  const isConfigured = isSupabaseConfigured();
  const rawUrl = process.env.SUPABASE_URL || "";
  const maskedUrl = rawUrl ? rawUrl.replace(/^https?:\/\//, "").split(".")[0] + ".supabase.co" : null;
  return res.json({
    success: true,
    configured: isConfigured,
    supabaseProject: maskedUrl,
    sqlSchema: SUPABASE_SQL_SCHEMA
  });
});
app.post("/api/license/revoke", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { adminPin, key, revoke = true } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  const db = getLicensesDb();
  let updated = false;
  const modified = db.map((item) => {
    if (item.key === key) {
      item.revoked = !!revoke;
      updated = true;
    }
    return item;
  });
  if (updated) {
    saveLicensesDb(modified);
    if (isSupabaseConfigured()) {
      updateSupabaseLicenseStatus(key, !!revoke).catch((err) => console.warn("[Supabase Sync Revoke Error]:", err));
    }
  }
  return res.json({ success: true, message: revoke ? "Licencia revocada" : "Licencia reactivada", updated });
});
app.post("/api/admin/logo", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { adminPin, imageData, pwa512, pwa192, pwaMaskable } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, adminPin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
  clearAuthFailures(req);
  if (!imageData || typeof imageData !== "string" || !imageData.startsWith("data:image/")) {
    return res.status(400).json({ success: false, error: "Formato de imagen inv\xE1lido" });
  }
  const saveBase64File = (dataUrl, targetFile) => {
    const m = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (m && m.length === 3) {
      const buf = Buffer.from(m[2], "base64");
      fs2.writeFileSync(path2.resolve(__dirname, "public", targetFile), buf);
    }
  };
  try {
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: "Datos de imagen corruptos" });
    }
    const ext = matches[1].includes("jpeg") || matches[1].includes("jpg") ? "jpg" : "png";
    const filename = `custom-logo.${ext}`;
    saveBase64File(imageData, filename);
    saveBase64File(pwa512 || imageData, "pwa-512x512.png");
    saveBase64File(pwa192 || imageData, "pwa-192x192.png");
    saveBase64File(pwa192 || imageData, "apple-touch-icon.png");
    saveBase64File(pwaMaskable || pwa512 || imageData, "pwa-maskable-512x512.png");
    const logoUrl = `/${filename}?t=${Date.now()}`;
    cfg.customLogoUrl = logoUrl;
    saveAdminConfig(cfg);
    return res.json({ success: true, logoUrl, message: "Logo e icono m\xF3vil de Chrome/iPhone actualizados con \xE9xito" });
  } catch {
    return res.status(500).json({ success: false, error: "Error al procesar y guardar la imagen" });
  }
});
app.delete("/api/admin/logo", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req, req.body?.adminPin);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    cfg.customLogoUrl = void 0;
    saveAdminConfig(cfg);
    ["custom-logo.png", "custom-logo.jpg"].forEach((f) => {
      const p = path2.resolve(__dirname, "public", f);
      if (fs2.existsSync(p)) {
        try {
          fs2.unlinkSync(p);
        } catch {
        }
      }
    });
    return res.json({ success: true, message: "Logo restaurado al predeterminado" });
  } catch {
    return res.status(500).json({ success: false, error: "Error al restaurar logo" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  try {
    const { username, pin, deviceId, deviceName } = req.body || {};
    const result = await loginAppUser(username, pin, deviceId, deviceName);
    if (!result.success && (result.code === "INVALID_PIN" || result.code === "USER_NOT_FOUND")) {
      await recordAuthFailure(req);
    } else if (result.success) {
      clearAuthFailures(req);
      recordOnlinePresence({
        username: String(username || "").toLowerCase(),
        displayName: result.user?.displayName || String(username || ""),
        deviceId: String(deviceId || ""),
        deviceInfo: String(deviceName || "")
      });
    }
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: "Error interno en inicio de sesi\xF3n" });
  }
});
app.post("/api/auth/register-request", dataRateLimitMiddleware, async (req, res) => {
  try {
    const { username, pin, displayName, whatsapp, deviceId, deviceName } = req.body || {};
    const result = await registerAppUserRequest(username, pin, displayName, whatsapp, deviceId, deviceName);
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: "Error al procesar solicitud" });
  }
});
app.get("/api/auth/config", (req, res) => {
  return res.json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null
  });
});
app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, displayName, deviceId, deviceName, fingerprint } = req.body || {};
    const result = await loginOrRegisterGoogleUser(email, displayName, deviceId, deviceName, fingerprint);
    if (result.success && result.user) {
      recordOnlinePresence({
        username: String(result.user.username || result.user.email || "").toLowerCase(),
        displayName: result.user.displayName || String(result.user.email || ""),
        deviceId: String(deviceId || ""),
        deviceInfo: String(deviceName || "")
      });
    }
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: "Error al procesar autenticaci\xF3n con Google" });
  }
});
app.post("/api/user/redeem-code", async (req, res) => {
  try {
    const { code, userIdentifier } = req.body || {};
    const result = await redeemActivationCode(code, userIdentifier);
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: "Error al canjear c\xF3digo" });
  }
});
app.post("/api/user/feedback-bonus", async (req, res) => {
  try {
    const { userIdentifier } = req.body || {};
    const result = await claimFeedbackBonus(userIdentifier);
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, message: "Error al aplicar bono de feedback" });
  }
});
app.post("/api/admin/codes/generate", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const { days = 30 } = req.body || {};
    const result = await adminGenerateActivationCode(Number(days) || 30);
    return res.json(result);
  } catch {
    return res.status(500).json({ success: false, error: "Error al generar c\xF3digo de activaci\xF3n" });
  }
});
app.get("/api/admin/codes/list", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const codes = await adminListActivationCodes();
    return res.json({ success: true, codes });
  } catch {
    return res.status(500).json({ success: false, error: "Error al listar c\xF3digos de activaci\xF3n" });
  }
});
app.get("/api/admin/users/list", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const users = await adminListAppUsers();
    const onlineList = getActiveOnlineUsersList();
    const enrichedUsers = users.map((u) => {
      const uname = String(u.username || "").toLowerCase().trim();
      const devId = String(u.boundDeviceId || "").toUpperCase().trim();
      const onlineMatch = onlineList.find(
        (o) => uname && o.username.toLowerCase() === uname || devId && o.deviceId.toUpperCase() === devId
      );
      if (onlineMatch && (!u.lastActiveAt || onlineMatch.lastSeenAt > u.lastActiveAt)) {
        return {
          ...u,
          lastActiveAt: onlineMatch.lastSeenAt
        };
      }
      return u;
    });
    return res.json({ success: true, users: enrichedUsers });
  } catch {
    return res.status(500).json({ success: false, error: "Error al consultar listado de usuarios" });
  }
});
app.post("/api/admin/users/reset-device", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, userId, username } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  if (!userId && !username) {
    return res.status(400).json({ success: false, error: "ID o nombre de usuario requerido" });
  }
  const ok = await adminResetAppUserDevice(
    sanitizeText(String(userId || ""), 64),
    username ? sanitizeText(String(username), 40) : void 0
  );
  return res.json({
    success: ok,
    message: ok ? "Dispositivo desvinculado con \xE9xito. El usuario ahora puede ingresar desde su nuevo equipo." : "No se pudo desvincular el dispositivo."
  });
});
app.post("/api/admin/users/renew", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, userId, username, addDays = 30, mode = "SET" } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  if (!userId && !username) {
    return res.status(400).json({ success: false, error: "ID o nombre de usuario requerido" });
  }
  const ok = await adminRenewAppUser(
    sanitizeText(String(userId || ""), 64),
    Number(addDays),
    username ? sanitizeText(String(username), 40) : void 0,
    mode === "ADD" ? "ADD" : "SET"
  );
  return res.json({
    success: ok,
    message: ok ? mode === "ADD" ? `Suscripci\xF3n extendida +${addDays} d\xEDas` : `D\xEDas del usuario fijados a ${addDays} d\xEDas` : "Error al actualizar d\xEDas"
  });
});
app.post("/api/admin/users/toggle-status", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, userId, username, status } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  const ok = await adminToggleAppUserStatus(
    sanitizeText(String(userId || ""), 64),
    status === "suspended" ? "suspended" : "active",
    username ? sanitizeText(String(username), 40) : void 0
  );
  return res.json({ success: ok, message: ok ? "Estado actualizado" : "Error al cambiar estado" });
});
app.post("/api/admin/users/upsert", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, user } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  const ok = await adminUpsertAppUser(user);
  return res.json({ success: ok, message: ok ? "Usuario guardado" : "Error al guardar usuario" });
});
app.post("/api/admin/users/delete", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, userId, username } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  if (!userId && !username) {
    return res.status(400).json({ success: false, error: "ID o nombre de usuario requerido" });
  }
  const cleanId = sanitizeText(String(userId || ""), 64);
  const cleanUser = username ? sanitizeText(String(username), 40).toLowerCase().trim() : void 0;
  const ok = await adminDeleteAppUser(cleanId, cleanUser);
  activeOnlineSessions.forEach((entry, key) => {
    if (cleanUser && entry.username.toLowerCase() === cleanUser || cleanId && (entry.username.toLowerCase() === cleanId.toLowerCase() || entry.deviceId.toUpperCase() === cleanId.toUpperCase())) {
      activeOnlineSessions.delete(key);
    }
  });
  return res.json({
    success: ok,
    message: ok ? "Usuario eliminado permanentemente" : "No se pudo eliminar el usuario"
  });
});
var ADMIN_MONTHLY_PARLAYS_CACHE_KEY = "__admin_monthly_parlays_v2__";
function getColombiaCurrentMonthKey() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit"
    }).formatToParts(/* @__PURE__ */ new Date());
    const y = parts.find((p) => p.type === "year")?.value || "2026";
    const m = parts.find((p) => p.type === "month")?.value || "01";
    return `${y}-${m}`;
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  }
}
async function loadAndPruneMonthlyParlayLedger() {
  const currentMonth = getColombiaCurrentMonthKey();
  const now = Date.now();
  let ledger = {
    monthKey: currentMonth,
    updatedAt: now,
    records: []
  };
  const cached = getCacheItem(ADMIN_MONTHLY_PARLAYS_CACHE_KEY);
  if (cached && cached.data && typeof cached.data === "object") {
    ledger = cached.data;
  } else if (isSupabaseConfigured()) {
    const remote = await getSupabaseKvCache(ADMIN_MONTHLY_PARLAYS_CACHE_KEY);
    if (remote && remote.data && typeof remote.data === "object") {
      ledger = remote.data;
    }
  }
  if (ledger.monthKey !== currentMonth || !Array.isArray(ledger.records)) {
    ledger = {
      monthKey: currentMonth,
      updatedAt: now,
      records: []
    };
    setCacheItem(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger);
    if (isSupabaseConfigured()) {
      setSupabaseKvCache(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger).catch(() => {
      });
    }
  } else {
    const cleanRecords = ledger.records.filter((r) => r && typeof r === "object" && r.id && String(r.d || "").startsWith(currentMonth)).slice(0, 120);
    if (cleanRecords.length !== ledger.records.length) {
      ledger.records = cleanRecords;
      ledger.updatedAt = now;
      setCacheItem(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger);
    } else if (!cached) {
      setCacheItem(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger);
    }
  }
  return ledger;
}
app.get("/api/admin/parlays-beta", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const ledger = await loadAndPruneMonthlyParlayLedger();
    return res.json({ success: true, ledger });
  } catch {
    return res.status(500).json({ success: false, error: "Error al consultar efectividad mensual de parlays" });
  }
});
app.post("/api/admin/parlays-beta", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, records, resetMonth } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const currentMonth = getColombiaCurrentMonthKey();
    const now = Date.now();
    let ledger = await loadAndPruneMonthlyParlayLedger();
    if (resetMonth === true) {
      ledger = {
        monthKey: currentMonth,
        updatedAt: now,
        records: []
      };
    } else if (Array.isArray(records) && records.length > 0) {
      const map = /* @__PURE__ */ new Map();
      for (const existing of ledger.records) {
        if (existing && existing.id) map.set(existing.id, existing);
      }
      for (const incoming of records) {
        if (!incoming || typeof incoming !== "object" || !incoming.id) continue;
        const cleanDate = sanitizeText(String(incoming.d || ""), 10);
        if (!cleanDate.startsWith(currentMonth)) continue;
        const compactRec = {
          id: sanitizeText(String(incoming.id), 90),
          d: cleanDate,
          t: sanitizeText(String(incoming.t || "Parlay G METRICS"), 55),
          l: Number(incoming.l) === 3 ? 3 : 2,
          o: Number(Number(incoming.o || 1.6).toFixed(2)),
          f: Number(Number(incoming.f || 1.5).toFixed(2)),
          s: incoming.s === "HIT" ? "HIT" : "MISS",
          legs: Array.isArray(incoming.legs) ? incoming.legs.slice(0, 3).map((leg) => ({
            m: sanitizeText(String(leg?.m || ""), 45),
            p: sanitizeText(String(leg?.p || ""), 45),
            h: Boolean(leg?.h)
          })) : []
        };
        map.set(compactRec.id, compactRec);
      }
      ledger = {
        monthKey: currentMonth,
        updatedAt: now,
        records: Array.from(map.values()).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 120)
      };
    }
    setCacheItem(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger);
    if (isSupabaseConfigured()) {
      await setSupabaseKvCache(ADMIN_MONTHLY_PARLAYS_CACHE_KEY, ledger);
    }
    return res.json({ success: true, ledger });
  } catch {
    return res.status(500).json({ success: false, error: "Error al actualizar efectividad mensual de parlays" });
  }
});
var ADMIN_USER_FEEDBACK_CACHE_KEY = "__admin_user_feedback_v1__";
function cleanFeedbackUserIdentity(rawUser, rawName) {
  let u = String(rawUser || "usuario").trim();
  let n = String(rawName || u).trim();
  if (u.startsWith("{") || u.includes('"id":')) {
    try {
      const parsed = JSON.parse(u);
      u = parsed.username || parsed.email || "usuario";
      if (!n || n.startsWith("{") || n.includes('"id":')) {
        n = parsed.displayName || parsed.name || u;
      }
    } catch {
      u = "usuario";
    }
  }
  if (n.startsWith("{") || n.includes('"id":')) {
    try {
      const parsed = JSON.parse(n);
      n = parsed.displayName || parsed.name || parsed.username || "Usuario";
    } catch {
      n = u !== "usuario" ? u : "Usuario";
    }
  }
  const cleanUser = sanitizeText(u.toLowerCase(), 32) || "usuario";
  const cleanName = sanitizeText(n, 45) || cleanUser;
  return { cleanUser, cleanName };
}
function normalizeFeedbackList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    if (!it || typeof it !== "object") return it;
    if (String(it.u || "").startsWith("{") || String(it.u || "").includes('"id":') || String(it.n || "").startsWith("{")) {
      const { cleanUser, cleanName } = cleanFeedbackUserIdentity(it.u, it.n);
      return { ...it, u: cleanUser, n: cleanName };
    }
    return it;
  });
}
async function loadUserFeedbackList() {
  const cached = getCacheItem(ADMIN_USER_FEEDBACK_CACHE_KEY);
  if (cached && Array.isArray(cached.data)) {
    return normalizeFeedbackList(cached.data);
  }
  if (isSupabaseConfigured()) {
    const remote = await getSupabaseKvCache(ADMIN_USER_FEEDBACK_CACHE_KEY);
    if (remote && Array.isArray(remote.data)) {
      const normalized = normalizeFeedbackList(remote.data);
      setCacheItem(ADMIN_USER_FEEDBACK_CACHE_KEY, normalized);
      return normalized;
    }
  }
  return [];
}
app.post("/api/feedback", dataRateLimitMiddleware, async (req, res) => {
  try {
    const { username, displayName, rating, category, comment } = req.body || {};
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    const { cleanUser, cleanName } = cleanFeedbackUserIdentity(username, displayName);
    const cleanCat = sanitizeText(String(category || "General"), 40) || "General";
    const cleanMsg = sanitizeText(String(comment || ""), 250);
    const newItem = {
      id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      u: cleanUser,
      n: cleanName,
      r: numRating,
      c: cleanCat,
      m: cleanMsg,
      t: Date.now()
    };
    const currentList = await loadUserFeedbackList();
    const updatedList = [newItem, ...currentList.filter((item) => item && item.id)].slice(0, 100);
    setCacheItem(ADMIN_USER_FEEDBACK_CACHE_KEY, updatedList);
    if (isSupabaseConfigured()) {
      await setSupabaseKvCache(ADMIN_USER_FEEDBACK_CACHE_KEY, updatedList);
    }
    return res.json({ success: true, item: newItem });
  } catch {
    return res.status(500).json({ success: false, error: "Error al registrar calificaci\xF3n" });
  }
});
app.get("/api/admin/feedback", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    const list = await loadUserFeedbackList();
    return res.json({ success: true, items: list });
  } catch {
    return res.status(500).json({ success: false, error: "Error al consultar calificaciones" });
  }
});
app.delete("/api/admin/feedback", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const { pin, id, clearAll } = req.body || {};
  const cfg = getAdminConfig();
  const cred = extractAdminCredential(req, pin);
  if (!isValidAdminPin(cred, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  clearAuthFailures(req);
  try {
    let updatedList = [];
    if (clearAll !== true) {
      const currentList = await loadUserFeedbackList();
      const targetId = sanitizeText(String(id || ""), 64);
      updatedList = currentList.filter((item) => item && item.id !== targetId);
    }
    setCacheItem(ADMIN_USER_FEEDBACK_CACHE_KEY, updatedList);
    if (isSupabaseConfigured()) {
      await setSupabaseKvCache(ADMIN_USER_FEEDBACK_CACHE_KEY, updatedList);
    }
    return res.json({ success: true, items: updatedList });
  } catch {
    return res.status(500).json({ success: false, error: "Error al eliminar calificaci\xF3n" });
  }
});
app.use(express.static(path2.resolve(__dirname, "public"), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));
app.use((err, _req, res, _next) => {
  console.error("[Express Error Handler]:", err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Error interno procesando la solicitud."
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !IS_VERCEL2) {
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path2.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path2.resolve(__dirname, "dist/index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`FutbolStats Pro server listening on port ${PORT}`);
  });
  server.on("error", (err) => {
    console.error("[Server Listen Error]:", err);
  });
}
if (!IS_VERCEL2) {
  startServer().catch((err) => {
    console.error("[Fatal Error Starting Server]:", err);
  });
}
var server_default = app;
export {
  server_default as default
};
