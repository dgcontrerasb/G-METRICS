// server.ts
import express from "express";
import dotenv from "dotenv";
import path2 from "path";
import fs2 from "fs";
import crypto3 from "node:crypto";
import { fileURLToPath } from "url";
import webpush from "web-push";

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
  const isVipComputed = params.isVip !== void 0 ? params.isVip : params.role === "admin" || (params.expiresAt ? params.expiresAt > Date.now() : true);
  const payloadObj = {
    sub: params.userId,
    username: params.username,
    role: params.role,
    deviceId: String(params.deviceId || "").trim().toUpperCase(),
    iat: nowSec,
    exp: nowSec + ttlSec,
    isVip: isVipComputed,
    expiresAt: params.expiresAt ?? null
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
function parseCookies(req) {
  const list = {};
  const rc = req.headers?.cookie;
  if (!rc) return list;
  rc.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join("="));
    }
  });
  return list;
}
function setSecureSessionCookie(res, token, req) {
  const isHttps = Boolean(
    req?.secure || req?.headers?.["x-forwarded-proto"] === "https" || process.env.VERCEL && process.env.NODE_ENV === "production" && !req?.headers?.host?.includes("localhost")
  );
  const isLocalhost = Boolean(req?.headers?.host?.includes("localhost") || req?.headers?.host?.includes("127.0.0.1"));
  const secureFlag = isHttps && !isLocalhost ? "; Secure" : "";
  const maxAgeSec = 30 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `gmetrics_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`
  );
}
function clearSecureSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "gmetrics_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
}
function extractSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const cookieToken = cookies["gmetrics_session"];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = cookieToken || bearerToken;
  if (!token) return null;
  return verifySessionJwt(token);
}
function calculateSubnetHash(rawIp) {
  const clean = (rawIp || "127.0.0.1").split(",")[0].trim();
  const parts = clean.split(".");
  const subnet = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : clean;
  return crypto.createHash("sha256").update(`${subnet}::GMETRICS_FRAUD_SALT_2026_V1`).digest("hex").slice(0, 32);
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
    res.setHeader("Access-Control-Allow-Credentials", "true");
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
    if (cacheId.includes("_schedule_") || cacheId.startsWith("espn_schedule_")) {
      const threeDaysAgoIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString();
      client.from("sportstats_config").delete().eq("color_theme", "kv-cache").neq("id", "__server_telemetry_v1__").neq("id", "__deleted_users_v1__").neq("id", "__admin_user_feedback_v1__").lt("updated_at", threeDaysAgoIso).then(
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
ALTER TABLE sportstats_users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE sportstats_users ADD COLUMN IF NOT EXISTS ip_subnet_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON sportstats_users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_subnet_hash ON sportstats_users(ip_subnet_hash);


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

CREATE TABLE IF NOT EXISTS sportstats_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  match_ids JSONB DEFAULT '[]'::jsonb,
  user_id TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_endpoint ON sportstats_push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_updated ON sportstats_push_subscriptions(updated_at);
ALTER TABLE sportstats_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sportstats_feedback (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  rating INTEGER NOT NULL,
  category TEXT DEFAULT 'General',
  comment TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON sportstats_feedback(created_at DESC);
ALTER TABLE sportstats_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_users' AND policyname = 'Allow server full access users') THEN
    CREATE POLICY "Allow server full access users" ON sportstats_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_config' AND policyname = 'Allow server full access config') THEN
    CREATE POLICY "Allow server full access config" ON sportstats_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_push_subscriptions' AND policyname = 'Allow server full access push') THEN
    CREATE POLICY "Allow server full access push" ON sportstats_push_subscriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_feedback' AND policyname = 'Allow server full access feedback') THEN
    CREATE POLICY "Allow server full access feedback" ON sportstats_feedback FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
async function verifyOAuthIdentityToken(token, expectedEmail, client) {
  const cleanExpected = expectedEmail.toLowerCase().trim();
  if (!token || typeof token !== "string") {
    return { verified: false, error: "Token no proporcionado" };
  }
  if (client) {
    try {
      const { data: authData, error: authErr } = await client.auth.getUser(token);
      if (!authErr && authData?.user?.email) {
        const supEmail = authData.user.email.toLowerCase().trim();
        if (supEmail === cleanExpected) {
          const gSub = String(authData.user.id || authData.user.user_metadata?.sub || "");
          return { verified: true, email: supEmail, googleSub: gSub };
        }
      }
    } catch {
    }
  }
  try {
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (googleRes.ok) {
      const googleData = await googleRes.json();
      if (googleData?.email && googleData.email_verified !== false) {
        const gEmail = String(googleData.email).toLowerCase().trim();
        if (gEmail === cleanExpected) {
          const gSub = String(googleData.sub || "");
          return { verified: true, email: gEmail, googleSub: gSub };
        }
      }
    }
  } catch {
  }
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
      const payload = JSON.parse(jsonPayload);
      const nowSec = Math.floor(Date.now() / 1e3);
      const isNotExpired = !payload.exp || payload.exp > nowSec - 120;
      const isSupabaseIssuer = !payload.iss || payload.iss.includes("supabase");
      const isAuthRole = payload.aud === "authenticated" || payload.role === "authenticated";
      const jwtEmail = String(payload.email || payload.user_metadata?.email || "").toLowerCase().trim();
      if (isNotExpired && isSupabaseIssuer && isAuthRole && jwtEmail === cleanExpected) {
        const gSub = String(payload.sub || "");
        return { verified: true, email: jwtEmail, googleSub: gSub };
      }
    }
  } catch {
  }
  return { verified: false, error: "No se pudo certificar la autenticidad del token con ning\xFAn proveedor" };
}
async function loginOrRegisterGoogleUser(rawEmail, rawDisplayName, deviceId, deviceName, deviceFingerprint, accessToken, providerToken, clientSubnetHash) {
  const email = String(rawEmail || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return {
      success: false,
      code: "SERVER_ERROR",
      message: "Correo electr\xF3nico de Google inv\xE1lido."
    };
  }
  const tokenToVerify = accessToken || providerToken;
  if (!tokenToVerify) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "Acceso no autorizado: Se requiere verificaci\xF3n oficial con Google OAuth."
    };
  }
  const client = getSupabaseClient();
  const isLocalOrDev = process.env.NODE_ENV !== "production" || !process.env.VERCEL;
  let check = { verified: true, email };
  try {
    const inspected = await verifyOAuthIdentityToken(tokenToVerify, email, client);
    if (inspected.googleSub) check.googleSub = inspected.googleSub;
  } catch {
  }
  if (!isLocalOrDev) {
    check = await verifyOAuthIdentityToken(tokenToVerify, email, client);
    if (!check.verified && providerToken && providerToken !== tokenToVerify) {
      check = await verifyOAuthIdentityToken(providerToken, email, client);
    }
    if (!check.verified) {
      return {
        success: false,
        code: "UNAUTHORIZED",
        message: "Token de Google inv\xE1lido o no coincide con el usuario autenticado."
      };
    }
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
  if (!client) {
    return {
      success: false,
      code: "SERVER_ERROR",
      message: "Error de conexi\xF3n con el servidor de autenticaci\xF3n."
    };
  }
  try {
    let existingUser = null;
    try {
      if (check.googleSub) {
        const { data: userBySub } = await client.from("sportstats_users").select("*").eq("google_sub", check.googleSub).maybeSingle();
        if (userBySub) existingUser = userBySub;
      }
      if (!existingUser) {
        const { data: userByEmail } = await client.from("sportstats_users").select("*").ilike("email", email).maybeSingle();
        if (userByEmail) existingUser = userByEmail;
      }
    } catch {
      const { data: fallbackUser } = await client.from("sportstats_users").select("*").ilike("email", email).maybeSingle();
      existingUser = fallbackUser;
    }
    if (existingUser) {
      if (existingUser.status === "suspended") {
        return { success: false, code: "SUSPENDED", message: "Tu cuenta ha sido suspendida. Contacta al administrador." };
      }
      if (existingUser.status === "deleted") {
        return { success: false, code: "USER_NOT_FOUND", message: "Esta cuenta ha sido eliminada por el administrador." };
      }
      const isLocalOrDev3 = process.env.NODE_ENV !== "production" || !process.env.VERCEL;
      const isAdminTestDevice2 = isLocalOrDev3 || cleanDevice.startsWith("DEV-");
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
    const isLocalOrDev2 = process.env.NODE_ENV !== "production" || !process.env.VERCEL;
    const isAdminTestDevice = isLocalOrDev2 || cleanDevice.startsWith("DEV-");
    let hasUsedTrial = false;
    if (!isAdminTestDevice) {
      if (cleanDevice) {
        const { data: deviceUser } = await client.from("sportstats_users").select("id, username").eq("bound_device_id", cleanDevice).limit(1).maybeSingle();
        if (deviceUser) {
          hasUsedTrial = true;
        }
      }
      if (!hasUsedTrial && clientSubnetHash) {
        try {
          const { data: subnetUsers } = await client.from("sportstats_users").select("id").eq("ip_subnet_hash", clientSubnetHash).limit(3);
          if (Array.isArray(subnetUsers) && subnetUsers.length >= 2) {
            console.warn(`[Antifraude Activado]: Red IP ${clientSubnetHash.slice(0, 10)}... super\xF3 el l\xEDmite de pruebas gratis.`);
            hasUsedTrial = true;
          }
        } catch {
        }
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
      device_fingerprint: deviceFingerprint || cleanDevice,
      google_sub: check.googleSub || void 0,
      ip_subnet_hash: clientSubnetHash || void 0
    };
    let insertedUser = null;
    let insertError = null;
    const res = await client.from("sportstats_users").insert(newUserData).select().single();
    if (res.error && (res.error.message?.includes("google_sub") || res.error.message?.includes("ip_subnet_hash"))) {
      delete newUserData.google_sub;
      delete newUserData.ip_subnet_hash;
      const fallbackRes = await client.from("sportstats_users").insert(newUserData).select().single();
      insertedUser = fallbackRes.data;
      insertError = fallbackRes.error;
    } else {
      insertedUser = res.data;
      insertError = res.error;
    }
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
      newExpiresAt,
      user: {
        id: userData.id,
        username: userData.username,
        role: userData.role || "client",
        boundDeviceId: userData.bound_device_id,
        expiresAt: newExpiresAt
      }
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
var memoryPushSubscriptions = /* @__PURE__ */ new Map();
async function upsertPushSubscription(sub) {
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return false;
  }
  memoryPushSubscriptions.set(sub.endpoint, sub);
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const { error } = await client.from("sportstats_push_subscriptions").upsert(
      {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        match_ids: sub.matchIds || [],
        user_id: sub.userId || null,
        device_id: sub.deviceId || null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "endpoint" }
    );
    return !error;
  } catch {
    return true;
  }
}
async function removePushSubscription(endpoint) {
  if (!endpoint) return false;
  memoryPushSubscriptions.delete(endpoint);
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const { error } = await client.from("sportstats_push_subscriptions").delete().eq("endpoint", endpoint);
    return !error;
  } catch {
    return true;
  }
}
async function getActivePushSubscriptions(matchId) {
  const result = [];
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from("sportstats_push_subscriptions").select("*").limit(1e3);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const matchIds = Array.isArray(row.match_ids) ? row.match_ids : [];
          if (!matchId || matchIds.length === 0 || matchIds.includes(matchId)) {
            result.push({
              endpoint: row.endpoint,
              keys: {
                p256dh: row.p256dh,
                auth: row.auth
              },
              matchIds,
              userId: row.user_id,
              deviceId: row.device_id
            });
          }
        }
      }
    } catch {
    }
  }
  for (const [endpoint, sub] of memoryPushSubscriptions.entries()) {
    if (!result.some((r) => r.endpoint === endpoint)) {
      if (!matchId || !sub.matchIds || sub.matchIds.length === 0 || sub.matchIds.includes(matchId)) {
        result.push(sub);
      }
    }
  }
  return result;
}
async function savePermanentFeedbackList(items) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const serialized = JSON.stringify({ timestamp: Date.now(), data: items });
    const { error } = await client.from("sportstats_config").upsert({
      id: "__admin_user_feedback_v1__",
      admin_pin: "FEEDBACK_PERMANENT_LOCK",
      admin_whatsapp: String(items.length),
      support_name: "User Reviews Feedback",
      custom_logo_url: serialized,
      color_theme: "permanent-feedback",
      // Inmune por diseño: los limpiadores solo tocan 'kv-cache'
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return !error;
  } catch {
    return false;
  }
}
async function loadPermanentFeedbackList() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("sportstats_config").select("custom_logo_url").eq("id", "__admin_user_feedback_v1__").maybeSingle();
    if (error || !data || !data.custom_logo_url) return null;
    const parsed = JSON.parse(data.custom_logo_url);
    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {
  }
  return null;
}

// src/services/nbaRostersData.ts
var NBA_30_TEAMS_ROSTERS = {
  // 1. Atlanta Hawks
  hawks: {
    coach: "Quin Snyder",
    starters: [
      { id: "atl1", name: "Trae Young", number: 11, position: "PG", ppg: 26.4, apg: 10.8, rpg: 3, threePm: 3.2 },
      { id: "atl2", name: "Dyson Daniels", number: 5, position: "SG", ppg: 14.1, apg: 3.5, rpg: 4.8, threePm: 1.3 },
      { id: "atl3", name: "Zaccharie Risacher", number: 10, position: "SF", ppg: 12, apg: 1.4, rpg: 3.8, threePm: 1.6 },
      { id: "atl4", name: "Jalen Johnson", number: 1, position: "PF", ppg: 19.2, apg: 5.4, rpg: 10.2, threePm: 1.4 },
      { id: "atl5", name: "Clint Capela", number: 15, position: "C", ppg: 10.8, apg: 1.2, rpg: 9.8, threePm: 0 }
    ],
    bench: [
      { id: "atl6", name: "Bogdan Bogdanovic", number: 13, position: "SG", ppg: 15.6, apg: 3.1, rpg: 3.4, threePm: 2.9 },
      { id: "atl7", name: "De'Andre Hunter", number: 12, position: "SF", ppg: 16.4, apg: 1.8, rpg: 4.2, threePm: 2.1 },
      { id: "atl8", name: "Onyeka Okongwu", number: 17, position: "C", ppg: 11.2, apg: 1.6, rpg: 7.2, threePm: 0.5 }
    ]
  },
  // 2. Boston Celtics
  celtics: {
    coach: "Joe Mazzulla",
    starters: [
      { id: "bos1", name: "Jrue Holiday", number: 4, position: "PG", ppg: 12.8, apg: 4.8, rpg: 5.4, threePm: 2 },
      { id: "bos2", name: "Derrick White", number: 9, position: "SG", ppg: 16.4, apg: 5.1, rpg: 4.2, threePm: 3.1 },
      { id: "bos3", name: "Jaylen Brown", number: 7, position: "SF", ppg: 23.8, apg: 3.8, rpg: 5.8, threePm: 2.4 },
      { id: "bos4", name: "Jayson Tatum", number: 0, position: "PF", ppg: 28.2, apg: 5.4, rpg: 8.6, threePm: 3.5 },
      { id: "bos5", name: "Kristaps Porzingis", number: 8, position: "C", ppg: 19.8, apg: 2, rpg: 7, threePm: 2.1 }
    ],
    bench: [
      { id: "bos6", name: "Al Horford", number: 42, position: "C", ppg: 8.6, apg: 2.6, rpg: 6.4, threePm: 1.5 },
      { id: "bos7", name: "Payton Pritchard", number: 11, position: "PG", ppg: 14.5, apg: 3.4, rpg: 3.2, threePm: 3.3 },
      { id: "bos8", name: "Sam Hauser", number: 30, position: "SF", ppg: 9, apg: 1, rpg: 3.5, threePm: 2.5 }
    ]
  },
  // 3. Brooklyn Nets
  nets: {
    coach: "Jordi Fernandez",
    starters: [
      { id: "bkn1", name: "Dennis Schroder", number: 17, position: "PG", ppg: 18.2, apg: 6.6, rpg: 3, threePm: 2.4 },
      { id: "bkn2", name: "Cam Thomas", number: 24, position: "SG", ppg: 24.6, apg: 3.2, rpg: 3.5, threePm: 2.8 },
      { id: "bkn3", name: "Cameron Johnson", number: 2, position: "SF", ppg: 17.5, apg: 2.8, rpg: 4.4, threePm: 2.7 },
      { id: "bkn4", name: "Dorian Finney-Smith", number: 28, position: "PF", ppg: 10.4, apg: 1.8, rpg: 4.8, threePm: 1.9 },
      { id: "bkn5", name: "Nicolas Claxton", number: 33, position: "C", ppg: 9.8, apg: 2.3, rpg: 8.2, threePm: 0 }
    ],
    bench: [
      { id: "bkn6", name: "Ben Simmons", number: 10, position: "PG", ppg: 6.2, apg: 6.8, rpg: 6, threePm: 0 },
      { id: "bkn7", name: "Jalen Wilson", number: 9, position: "SF", ppg: 9.6, apg: 1.8, rpg: 3.4, threePm: 1.6 },
      { id: "bkn8", name: "Day'Ron Sharpe", number: 20, position: "C", ppg: 7.2, apg: 1.4, rpg: 6.6, threePm: 0 }
    ]
  },
  // 4. Charlotte Hornets
  hornets: {
    coach: "Charles Lee",
    starters: [
      { id: "cha1", name: "LaMelo Ball", number: 1, position: "PG", ppg: 29.8, apg: 7.2, rpg: 5.1, threePm: 4.6 },
      { id: "cha2", name: "Brandon Miller", number: 24, position: "SG", ppg: 19.4, apg: 3.8, rpg: 4.8, threePm: 2.9 },
      { id: "cha3", name: "Josh Green", number: 10, position: "SF", ppg: 9.2, apg: 1.8, rpg: 2.8, threePm: 1.4 },
      { id: "cha4", name: "Miles Bridges", number: 0, position: "PF", ppg: 16.5, apg: 3.2, rpg: 7.2, threePm: 1.8 },
      { id: "cha5", name: "Nick Richards", number: 4, position: "C", ppg: 11, apg: 1.5, rpg: 10, threePm: 0 }
    ],
    bench: [
      { id: "cha6", name: "Tre Mann", number: 23, position: "PG", ppg: 14.8, apg: 3.2, rpg: 3.1, threePm: 2.2 },
      { id: "cha7", name: "Grant Williams", number: 2, position: "PF", ppg: 10.4, apg: 2.3, rpg: 5.1, threePm: 1.6 },
      { id: "cha8", name: "Cody Martin", number: 11, position: "SG", ppg: 7.5, apg: 2.1, rpg: 4.2, threePm: 0.9 }
    ]
  },
  // 5. Chicago Bulls
  bulls: {
    coach: "Billy Donovan",
    starters: [
      { id: "chi1", name: "Josh Giddey", number: 3, position: "PG", ppg: 13.5, apg: 6.8, rpg: 6.4, threePm: 1.3 },
      { id: "chi2", name: "Coby White", number: 0, position: "SG", ppg: 19.2, apg: 4.8, rpg: 3.6, threePm: 3 },
      { id: "chi3", name: "Zach LaVine", number: 8, position: "SF", ppg: 22.4, apg: 4.2, rpg: 4.8, threePm: 2.8 },
      { id: "chi4", name: "Patrick Williams", number: 44, position: "PF", ppg: 10.2, apg: 2.1, rpg: 4.4, threePm: 1.5 },
      { id: "chi5", name: "Nikola Vucevic", number: 9, position: "C", ppg: 20.8, apg: 3.2, rpg: 9.8, threePm: 1.9 }
    ],
    bench: [
      { id: "chi6", name: "Ayo Dosunmu", number: 12, position: "SG", ppg: 12, apg: 4.2, rpg: 3.5, threePm: 1.4 },
      { id: "chi7", name: "Lonzo Ball", number: 2, position: "PG", ppg: 6.8, apg: 4.2, rpg: 3, threePm: 1.5 },
      { id: "chi8", name: "Jalen Smith", number: 25, position: "PF", ppg: 10.1, apg: 1.1, rpg: 5.6, threePm: 1.2 }
    ]
  },
  // 6. Cleveland Cavaliers
  cavaliers: {
    coach: "Kenny Atkinson",
    starters: [
      { id: "cle1", name: "Darius Garland", number: 10, position: "PG", ppg: 20.5, apg: 6.8, rpg: 2.8, threePm: 2.6 },
      { id: "cle2", name: "Donovan Mitchell", number: 45, position: "SG", ppg: 24.2, apg: 4.2, rpg: 4.5, threePm: 3.4 },
      { id: "cle3", name: "Max Strus", number: 1, position: "SF", ppg: 12.2, apg: 3.8, rpg: 4.6, threePm: 2.4 },
      { id: "cle4", name: "Evan Mobley", number: 4, position: "PF", ppg: 18.4, apg: 2.8, rpg: 8.8, threePm: 0.9 },
      { id: "cle5", name: "Jarrett Allen", number: 31, position: "C", ppg: 14.5, apg: 1.9, rpg: 11.2, threePm: 0 }
    ],
    bench: [
      { id: "cle6", name: "Caris LeVert", number: 3, position: "SG", ppg: 11.8, apg: 4.1, rpg: 3, threePm: 1.5 },
      { id: "cle7", name: "Georges Niang", number: 20, position: "PF", ppg: 8.4, apg: 1.2, rpg: 3.2, threePm: 1.7 },
      { id: "cle8", name: "Ty Jerome", number: 2, position: "PG", ppg: 9.8, apg: 3.2, rpg: 2, threePm: 1.4 }
    ]
  },
  // 7. Dallas Mavericks
  mavericks: {
    coach: "Jason Kidd",
    starters: [
      { id: "dal1", name: "Luka Doncic", number: 77, position: "PG", ppg: 28.8, apg: 8.2, rpg: 8.4, threePm: 3.4 },
      { id: "dal2", name: "Kyrie Irving", number: 11, position: "SG", ppg: 24.5, apg: 5.2, rpg: 4.6, threePm: 3 },
      { id: "dal3", name: "Klay Thompson", number: 31, position: "SF", ppg: 14.2, apg: 1.9, rpg: 3.5, threePm: 3.1 },
      { id: "dal4", name: "P.J. Washington", number: 25, position: "PF", ppg: 11.8, apg: 1.8, rpg: 7.2, threePm: 1.5 },
      { id: "dal5", name: "Dereck Lively II", number: 2, position: "C", ppg: 9.2, apg: 2.4, rpg: 8, threePm: 0 }
    ],
    bench: [
      { id: "dal6", name: "Daniel Gafford", number: 21, position: "C", ppg: 11.5, apg: 1.4, rpg: 6.8, threePm: 0 },
      { id: "dal7", name: "Spencer Dinwiddie", number: 26, position: "PG", ppg: 7.8, apg: 3.2, rpg: 2.2, threePm: 1.2 },
      { id: "dal8", name: "Naji Marshall", number: 13, position: "SF", ppg: 9.4, apg: 2.6, rpg: 3.8, threePm: 0.8 }
    ]
  },
  // 8. Denver Nuggets
  nuggets: {
    coach: "Michael Malone",
    starters: [
      { id: "den1", name: "Jamal Murray", number: 27, position: "PG", ppg: 20.8, apg: 6.2, rpg: 4, threePm: 2.4 },
      { id: "den2", name: "Christian Braun", number: 0, position: "SG", ppg: 15.4, apg: 2.2, rpg: 5.2, threePm: 1.5 },
      { id: "den3", name: "Michael Porter Jr.", number: 1, position: "SF", ppg: 18.6, apg: 2.6, rpg: 7.4, threePm: 2.9 },
      { id: "den4", name: "Aaron Gordon", number: 50, position: "PF", ppg: 14.8, apg: 3.2, rpg: 6.8, threePm: 1 },
      { id: "den5", name: "Nikola Jokic", number: 15, position: "C", ppg: 29.5, apg: 11.2, rpg: 13.4, threePm: 2.1 }
    ],
    bench: [
      { id: "den6", name: "Russell Westbrook", number: 4, position: "PG", ppg: 11.2, apg: 5.8, rpg: 4.2, threePm: 0.9 },
      { id: "den7", name: "Peyton Watson", number: 8, position: "SF", ppg: 8.6, apg: 1.4, rpg: 3.4, threePm: 0.9 },
      { id: "den8", name: "Julian Strawther", number: 3, position: "SG", ppg: 8.9, apg: 1.1, rpg: 2.2, threePm: 1.4 }
    ]
  },
  // 9. Detroit Pistons
  pistons: {
    coach: "J.B. Bickerstaff",
    starters: [
      { id: "det1", name: "Cade Cunningham", number: 2, position: "PG", ppg: 23.4, apg: 8.8, rpg: 7.2, threePm: 1.9 },
      { id: "det2", name: "Jaden Ivey", number: 23, position: "SG", ppg: 18.5, apg: 4, rpg: 4.5, threePm: 2.1 },
      { id: "det3", name: "Tim Hardaway Jr.", number: 5, position: "SF", ppg: 12, apg: 1.8, rpg: 2.5, threePm: 2.2 },
      { id: "det4", name: "Tobias Harris", number: 12, position: "PF", ppg: 13.8, apg: 2.4, rpg: 7.1, threePm: 1.4 },
      { id: "det5", name: "Jalen Duren", number: 0, position: "C", ppg: 9.2, apg: 2.6, rpg: 9.8, threePm: 0 }
    ],
    bench: [
      { id: "det6", name: "Malik Beasley", number: 8, position: "SG", ppg: 14.5, apg: 1.8, rpg: 3.2, threePm: 3.2 },
      { id: "det7", name: "Isaiah Stewart", number: 28, position: "C", ppg: 6.2, apg: 1.4, rpg: 5.8, threePm: 0.6 },
      { id: "det8", name: "Simone Fontecchio", number: 19, position: "SF", ppg: 8.4, apg: 1.2, rpg: 3.4, threePm: 1.6 }
    ]
  },
  // 10. Golden State Warriors
  warriors: {
    coach: "Steve Kerr",
    starters: [
      { id: "gsw1", name: "Stephen Curry", number: 30, position: "PG", ppg: 23, apg: 6.5, rpg: 5.2, threePm: 4.2 },
      { id: "gsw2", name: "Brandin Podziemski", number: 2, position: "SG", ppg: 10.5, apg: 3.8, rpg: 4.6, threePm: 1.4 },
      { id: "gsw3", name: "Andrew Wiggins", number: 22, position: "SF", ppg: 17.2, apg: 2.4, rpg: 4.5, threePm: 2.2 },
      { id: "gsw4", name: "Jonathan Kuminga", number: 0, position: "PF", ppg: 16.5, apg: 2.1, rpg: 5, threePm: 1.1 },
      { id: "gsw5", name: "Draymond Green", number: 23, position: "C", ppg: 8.8, apg: 5.8, rpg: 5.6, threePm: 1.4 }
    ],
    bench: [
      { id: "gsw6", name: "Buddy Hield", number: 7, position: "SG", ppg: 15.8, apg: 1.8, rpg: 3.8, threePm: 3.4 },
      { id: "gsw7", name: "Moses Moody", number: 4, position: "SG", ppg: 9.2, apg: 1.2, rpg: 2.4, threePm: 1.5 },
      { id: "gsw8", name: "Kevon Looney", number: 5, position: "C", ppg: 5.6, apg: 1.8, rpg: 7.8, threePm: 0 }
    ]
  },
  // 11. Houston Rockets
  rockets: {
    coach: "Ime Udoka",
    starters: [
      { id: "hou1", name: "Fred VanVleet", number: 5, position: "PG", ppg: 14.8, apg: 6.2, rpg: 4, threePm: 2.4 },
      { id: "hou2", name: "Jalen Green", number: 4, position: "SG", ppg: 19.8, apg: 2.8, rpg: 5, threePm: 2.8 },
      { id: "hou3", name: "Dillon Brooks", number: 9, position: "SF", ppg: 12.5, apg: 1.6, rpg: 3.8, threePm: 1.8 },
      { id: "hou4", name: "Jabari Smith Jr.", number: 10, position: "PF", ppg: 12, apg: 1.2, rpg: 7, threePm: 1.6 },
      { id: "hou5", name: "Alperen Sengun", number: 28, position: "C", ppg: 19, apg: 5, rpg: 10.8, threePm: 0.3 }
    ],
    bench: [
      { id: "hou6", name: "Amen Thompson", number: 1, position: "SF", ppg: 12.4, apg: 2.2, rpg: 6.8, threePm: 0.2 },
      { id: "hou7", name: "Tari Eason", number: 17, position: "PF", ppg: 11.8, apg: 1.2, rpg: 6.2, threePm: 1.1 },
      { id: "hou8", name: "Reed Sheppard", number: 15, position: "PG", ppg: 4.8, apg: 1.8, rpg: 1.5, threePm: 0.8 }
    ]
  },
  // 12. Indiana Pacers
  pacers: {
    coach: "Rick Carlisle",
    starters: [
      { id: "ind1", name: "Tyrese Haliburton", number: 0, position: "PG", ppg: 17.5, apg: 8.8, rpg: 3.8, threePm: 2.5 },
      { id: "ind2", name: "Andrew Nembhard", number: 2, position: "SG", ppg: 10.2, apg: 5, rpg: 2.2, threePm: 1 },
      { id: "ind3", name: "Aaron Nesmith", number: 23, position: "SF", ppg: 11.4, apg: 1.5, rpg: 4, threePm: 1.8 },
      { id: "ind4", name: "Pascal Siakam", number: 43, position: "PF", ppg: 20.6, apg: 4.2, rpg: 6.8, threePm: 1.4 },
      { id: "ind5", name: "Myles Turner", number: 33, position: "C", ppg: 17.2, apg: 1.6, rpg: 7.2, threePm: 2.1 }
    ],
    bench: [
      { id: "ind6", name: "Bennedict Mathurin", number: 0, position: "SG", ppg: 18.8, apg: 2, rpg: 6.4, threePm: 1.6 },
      { id: "ind7", name: "Obi Toppin", number: 1, position: "PF", ppg: 10.2, apg: 1.8, rpg: 4, threePm: 1.4 },
      { id: "ind8", name: "T.J. McConnell", number: 9, position: "PG", ppg: 9.8, apg: 4.6, rpg: 2.6, threePm: 0.3 }
    ]
  },
  // 13. LA Clippers
  clippers: {
    coach: "Tyronn Lue",
    starters: [
      { id: "lac1", name: "James Harden", number: 1, position: "PG", ppg: 20.8, apg: 8.6, rpg: 7.2, threePm: 2.6 },
      { id: "lac2", name: "Norman Powell", number: 24, position: "SG", ppg: 23.5, apg: 2.4, rpg: 3.4, threePm: 3.4 },
      { id: "lac3", name: "Terance Mann", number: 14, position: "SF", ppg: 6.8, apg: 1.8, rpg: 3.8, threePm: 0.8 },
      { id: "lac4", name: "Derrick Jones Jr.", number: 55, position: "PF", ppg: 10.4, apg: 1, rpg: 3.5, threePm: 1.2 },
      { id: "lac5", name: "Ivica Zubac", number: 40, position: "C", ppg: 15.2, apg: 2.6, rpg: 12.4, threePm: 0 }
    ],
    bench: [
      { id: "lac6", name: "Kawhi Leonard", number: 2, position: "SF", ppg: 23.7, apg: 3.6, rpg: 6.1, threePm: 2.1, isInjured: true, injuryStatus: "Out" },
      { id: "lac7", name: "Kevin Porter Jr.", number: 7, position: "SG", ppg: 8.8, apg: 3.1, rpg: 3.2, threePm: 0.9 },
      { id: "lac8", name: "Nicolas Batum", number: 33, position: "PF", ppg: 5.6, apg: 1.8, rpg: 3, threePm: 1.2 }
    ]
  },
  // 14. Los Angeles Lakers
  lakers: {
    coach: "JJ Redick",
    starters: [
      { id: "lal1", name: "D'Angelo Russell", number: 1, position: "PG", ppg: 13.8, apg: 5.2, rpg: 2.6, threePm: 2.2 },
      { id: "lal2", name: "Austin Reaves", number: 15, position: "SG", ppg: 17.6, apg: 5.4, rpg: 3.8, threePm: 2.4 },
      { id: "lal3", name: "LeBron James", number: 23, position: "SF", ppg: 23.2, apg: 9.1, rpg: 8, threePm: 2.2 },
      { id: "lal4", name: "Rui Hachimura", number: 28, position: "PF", ppg: 12.8, apg: 1.6, rpg: 6.1, threePm: 1.6 },
      { id: "lal5", name: "Anthony Davis", number: 3, position: "C", ppg: 28.5, apg: 3.4, rpg: 11.4, threePm: 0.5 }
    ],
    bench: [
      { id: "lal6", name: "Dalton Knecht", number: 4, position: "SG", ppg: 11.4, apg: 1.2, rpg: 2.8, threePm: 2.3 },
      { id: "lal7", name: "Gabe Vincent", number: 7, position: "PG", ppg: 4.8, apg: 1.4, rpg: 1.2, threePm: 1 },
      { id: "lal8", name: "Jaxson Hayes", number: 11, position: "C", ppg: 6.4, apg: 0.8, rpg: 4.6, threePm: 0 }
    ]
  },
  // 15. Memphis Grizzlies
  grizzlies: {
    coach: "Taylor Jenkins",
    starters: [
      { id: "mem1", name: "Ja Morant", number: 12, position: "PG", ppg: 20.6, apg: 9.1, rpg: 5, threePm: 1.6 },
      { id: "mem2", name: "Desmond Bane", number: 22, position: "SG", ppg: 18.8, apg: 4.2, rpg: 5.6, threePm: 2.8 },
      { id: "mem3", name: "Marcus Smart", number: 36, position: "SF", ppg: 9.8, apg: 3.8, rpg: 2.5, threePm: 1.5 },
      { id: "mem4", name: "Jaren Jackson Jr.", number: 13, position: "PF", ppg: 23.2, apg: 1.8, rpg: 5.8, threePm: 2 },
      { id: "mem5", name: "Zach Edey", number: 14, position: "C", ppg: 11.2, apg: 0.8, rpg: 8.2, threePm: 0.6 }
    ],
    bench: [
      { id: "mem6", name: "Santi Aldama", number: 7, position: "PF", ppg: 12.5, apg: 3.2, rpg: 7.4, threePm: 1.8 },
      { id: "mem7", name: "Scotty Pippen Jr.", number: 1, position: "PG", ppg: 11.8, apg: 5.6, rpg: 3.8, threePm: 1.2 },
      { id: "mem8", name: "Luke Kennard", number: 10, position: "SG", ppg: 8.6, apg: 3.2, rpg: 2.2, threePm: 1.9 }
    ]
  },
  // 16. Miami Heat
  heat: {
    coach: "Erik Spoelstra",
    starters: [
      { id: "mia1", name: "Terry Rozier", number: 2, position: "PG", ppg: 14.2, apg: 3.8, rpg: 3.6, threePm: 2.1 },
      { id: "mia2", name: "Tyler Herro", number: 14, position: "SG", ppg: 24.2, apg: 5.2, rpg: 5, threePm: 3.6 },
      { id: "mia3", name: "Jimmy Butler", number: 22, position: "SF", ppg: 18, apg: 5, rpg: 5.4, threePm: 0.6 },
      { id: "mia4", name: "Nikola Jovic", number: 5, position: "PF", ppg: 9.8, apg: 2.8, rpg: 4.8, threePm: 1.4 },
      { id: "mia5", name: "Bam Adebayo", number: 13, position: "C", ppg: 16.4, apg: 4.4, rpg: 9.8, threePm: 1 }
    ],
    bench: [
      { id: "mia6", name: "Jaime Jaquez Jr.", number: 11, position: "SF", ppg: 10.2, apg: 2.6, rpg: 6.2, threePm: 0.8 },
      { id: "mia7", name: "Duncan Robinson", number: 55, position: "SG", ppg: 10.8, apg: 2.2, rpg: 2.4, threePm: 2.6 },
      { id: "mia8", name: "Haywood Highsmith", number: 24, position: "PF", ppg: 7.2, apg: 1.4, rpg: 3.6, threePm: 1.2 }
    ]
  },
  // 17. Milwaukee Bucks
  bucks: {
    coach: "Doc Rivers",
    starters: [
      { id: "mil1", name: "Damian Lillard", number: 0, position: "PG", ppg: 25.4, apg: 6.8, rpg: 4.4, threePm: 3.2 },
      { id: "mil2", name: "Gary Trent Jr.", number: 5, position: "SG", ppg: 9.8, apg: 1.2, rpg: 1.8, threePm: 1.8 },
      { id: "mil3", name: "Taurean Prince", number: 12, position: "SF", ppg: 8.5, apg: 1.8, rpg: 4.8, threePm: 1.6 },
      { id: "mil4", name: "Giannis Antetokounmpo", number: 34, position: "PF", ppg: 32.4, apg: 6.2, rpg: 12, threePm: 0.2 },
      { id: "mil5", name: "Brook Lopez", number: 11, position: "C", ppg: 12.8, apg: 1.8, rpg: 5.2, threePm: 2 }
    ],
    bench: [
      { id: "mil6", name: "Bobby Portis", number: 9, position: "PF", ppg: 13.6, apg: 1.2, rpg: 8, threePm: 1.1 },
      { id: "mil7", name: "Khris Middleton", number: 22, position: "SF", ppg: 15.1, apg: 5.3, rpg: 4.7, threePm: 1.7, isInjured: true, injuryStatus: "GTD" },
      { id: "mil8", name: "Pat Connaughton", number: 24, position: "SG", ppg: 5.8, apg: 1.8, rpg: 3, threePm: 1.2 }
    ]
  },
  // 18. Minnesota Timberwolves
  timberwolves: {
    coach: "Chris Finch",
    starters: [
      { id: "min1", name: "Mike Conley", number: 10, position: "PG", ppg: 8.8, apg: 4.8, rpg: 3, threePm: 1.8 },
      { id: "min2", name: "Anthony Edwards", number: 5, position: "SG", ppg: 28.1, apg: 3.8, rpg: 5.4, threePm: 4.6 },
      { id: "min3", name: "Jaden McDaniels", number: 3, position: "SF", ppg: 10.4, apg: 1.6, rpg: 3.6, threePm: 1.2 },
      { id: "min4", name: "Julius Randle", number: 30, position: "PF", ppg: 21.6, apg: 4.4, rpg: 6.8, threePm: 1.8 },
      { id: "min5", name: "Rudy Gobert", number: 27, position: "C", ppg: 11, apg: 1.8, rpg: 11.2, threePm: 0 }
    ],
    bench: [
      { id: "min6", name: "Naz Reid", number: 11, position: "C", ppg: 14.8, apg: 1.8, rpg: 5.6, threePm: 2.3 },
      { id: "min7", name: "Donte DiVincenzo", number: 0, position: "SG", ppg: 10.2, apg: 3.4, rpg: 3.2, threePm: 2.2 },
      { id: "min8", name: "Nickeil Alexander-Walker", number: 9, position: "SG", ppg: 9.6, apg: 2.6, rpg: 2.8, threePm: 1.9 }
    ]
  },
  // 19. New Orleans Pelicans
  pelicans: {
    coach: "Willie Green",
    starters: [
      { id: "nop1", name: "Dejounte Murray", number: 5, position: "PG", ppg: 18.4, apg: 6.8, rpg: 5.6, threePm: 1.8 },
      { id: "nop2", name: "CJ McCollum", number: 3, position: "SG", ppg: 19.2, apg: 3.8, rpg: 3.6, threePm: 3 },
      { id: "nop3", name: "Brandon Ingram", number: 14, position: "SF", ppg: 22.8, apg: 5.4, rpg: 5.8, threePm: 2.2 },
      { id: "nop4", name: "Zion Williamson", number: 1, position: "PF", ppg: 22.7, apg: 5.3, rpg: 8, threePm: 0.1, isInjured: true, injuryStatus: "GTD" },
      { id: "nop5", name: "Daniel Theis", number: 10, position: "C", ppg: 5.2, apg: 1.8, rpg: 4.8, threePm: 0.4 }
    ],
    bench: [
      { id: "nop6", name: "Trey Murphy III", number: 25, position: "SF", ppg: 15.6, apg: 2.4, rpg: 4.8, threePm: 2.8 },
      { id: "nop7", name: "Herb Jones", number: 5, position: "SF", ppg: 10.2, apg: 2.4, rpg: 3.6, threePm: 1.4 },
      { id: "nop8", name: "Jordan Hawkins", number: 24, position: "SG", ppg: 12.8, apg: 1.4, rpg: 3.2, threePm: 2.2 }
    ]
  },
  // 20. New York Knicks
  knicks: {
    coach: "Tom Thibodeau",
    starters: [
      { id: "nyk1", name: "Jalen Brunson", number: 11, position: "PG", ppg: 25.2, apg: 7.4, rpg: 3.2, threePm: 2.4 },
      { id: "nyk2", name: "Mikal Bridges", number: 25, position: "SG", ppg: 16.5, apg: 3.8, rpg: 3.8, threePm: 2.2 },
      { id: "nyk3", name: "OG Anunoby", number: 8, position: "SF", ppg: 17.4, apg: 2.4, rpg: 5, threePm: 2.4 },
      { id: "nyk4", name: "Josh Hart", number: 3, position: "PF", ppg: 13.8, apg: 5.8, rpg: 8.8, threePm: 1.2 },
      { id: "nyk5", name: "Karl-Anthony Towns", number: 32, position: "C", ppg: 25.8, apg: 3.2, rpg: 12.6, threePm: 2.5 }
    ],
    bench: [
      { id: "nyk6", name: "Miles McBride", number: 2, position: "PG", ppg: 10.8, apg: 2.4, rpg: 2.6, threePm: 2.4 },
      { id: "nyk7", name: "Cameron Payne", number: 1, position: "PG", ppg: 6.8, apg: 3.2, rpg: 1.8, threePm: 1.2 },
      { id: "nyk8", name: "Precious Achiuwa", number: 5, position: "C", ppg: 7.4, apg: 1.1, rpg: 6.2, threePm: 0.2 }
    ]
  },
  // 21. Oklahoma City Thunder
  thunder: {
    coach: "Mark Daigneault",
    starters: [
      { id: "okc1", name: "Shai Gilgeous-Alexander", number: 2, position: "PG", ppg: 28.5, apg: 6.4, rpg: 5.3, threePm: 1.9 },
      { id: "okc2", name: "Cason Wallace", number: 22, position: "SG", ppg: 7.2, apg: 2.2, rpg: 3.4, threePm: 1.2 },
      { id: "okc3", name: "Luguentz Dort", number: 5, position: "SF", ppg: 10.8, apg: 1.6, rpg: 3.8, threePm: 2.2 },
      { id: "okc4", name: "Jalen Williams", number: 8, position: "PF", ppg: 21.8, apg: 5.2, rpg: 6.4, threePm: 1.8 },
      { id: "okc5", name: "Chet Holmgren", number: 7, position: "C", ppg: 16.4, apg: 2.2, rpg: 8.7, threePm: 1.5, isInjured: true, injuryStatus: "Out" }
    ],
    bench: [
      { id: "okc6", name: "Alex Caruso", number: 9, position: "SG", ppg: 6.4, apg: 2.4, rpg: 3, threePm: 1.1 },
      { id: "okc7", name: "Isaiah Hartenstein", number: 55, position: "C", ppg: 12, apg: 3.8, rpg: 11, threePm: 0 },
      { id: "okc8", name: "Aaron Wiggins", number: 21, position: "SG", ppg: 10.4, apg: 1.8, rpg: 3.6, threePm: 1.5 }
    ]
  },
  // 22. Orlando Magic
  magic: {
    coach: "Jamahl Mosley",
    starters: [
      { id: "orl1", name: "Jalen Suggs", number: 4, position: "PG", ppg: 15, apg: 4, rpg: 4.8, threePm: 2.2 },
      { id: "orl2", name: "Kentavious Caldwell-Pope", number: 3, position: "SG", ppg: 8.8, apg: 2, rpg: 2.4, threePm: 1.5 },
      { id: "orl3", name: "Franz Wagner", number: 22, position: "SF", ppg: 23.5, apg: 5.6, rpg: 5.8, threePm: 2 },
      { id: "orl4", name: "Paolo Banchero", number: 5, position: "PF", ppg: 29, apg: 5.6, rpg: 8.8, threePm: 2.2, isInjured: true, injuryStatus: "Out" },
      { id: "orl5", name: "Wendell Carter Jr.", number: 34, position: "C", ppg: 8.6, apg: 2, rpg: 8.4, threePm: 0.8 }
    ],
    bench: [
      { id: "orl6", name: "Moritz Wagner", number: 21, position: "C", ppg: 12.6, apg: 1.6, rpg: 4.8, threePm: 0.8 },
      { id: "orl7", name: "Cole Anthony", number: 50, position: "PG", ppg: 6.8, apg: 2.8, rpg: 2.6, threePm: 0.9 },
      { id: "orl8", name: "Jonathan Isaac", number: 1, position: "PF", ppg: 6.2, apg: 0.8, rpg: 4.6, threePm: 0.8 }
    ]
  },
  // 23. Philadelphia 76ers
  sixers: {
    coach: "Nick Nurse",
    starters: [
      { id: "phi1", name: "Tyrese Maxey", number: 0, position: "PG", ppg: 27.6, apg: 4.2, rpg: 3.4, threePm: 3.2 },
      { id: "phi2", name: "Kelly Oubre Jr.", number: 9, position: "SG", ppg: 14.2, apg: 1.8, rpg: 4.8, threePm: 1.5 },
      { id: "phi3", name: "Paul George", number: 8, position: "SF", ppg: 16.5, apg: 5.2, rpg: 5.6, threePm: 2.2 },
      { id: "phi4", name: "Caleb Martin", number: 16, position: "PF", ppg: 9.8, apg: 2.4, rpg: 5, threePm: 1.1 },
      { id: "phi5", name: "Joel Embiid", number: 21, position: "C", ppg: 28, apg: 4.5, rpg: 10.2, threePm: 1.2 }
    ],
    bench: [
      { id: "phi6", name: "Kyle Lowry", number: 7, position: "PG", ppg: 6.5, apg: 3.8, rpg: 2.6, threePm: 1.2 },
      { id: "phi7", name: "Andre Drummond", number: 5, position: "C", ppg: 8.8, apg: 1.2, rpg: 9.2, threePm: 0 },
      { id: "phi8", name: "Guerschon Yabusele", number: 28, position: "PF", ppg: 9.4, apg: 2, rpg: 4.6, threePm: 1.2 }
    ]
  },
  // 24. Phoenix Suns
  suns: {
    coach: "Mike Budenholzer",
    starters: [
      { id: "phx1", name: "Tyus Jones", number: 21, position: "PG", ppg: 10.8, apg: 6.8, rpg: 2.8, threePm: 1.6 },
      { id: "phx2", name: "Devin Booker", number: 1, position: "SG", ppg: 24.8, apg: 6.6, rpg: 3.8, threePm: 2.6 },
      { id: "phx3", name: "Bradley Beal", number: 3, position: "SF", ppg: 18.2, apg: 3.6, rpg: 3.8, threePm: 2.4 },
      { id: "phx4", name: "Kevin Durant", number: 35, position: "PF", ppg: 27.6, apg: 3.4, rpg: 6.6, threePm: 2.8 },
      { id: "phx5", name: "Jusuf Nurkic", number: 20, position: "C", ppg: 9.2, apg: 1.8, rpg: 9.8, threePm: 0.5 }
    ],
    bench: [
      { id: "phx6", name: "Grayson Allen", number: 8, position: "SG", ppg: 11.2, apg: 1.8, rpg: 3.2, threePm: 2.5 },
      { id: "phx7", name: "Royce O'Neale", number: 0, position: "SF", ppg: 10.6, apg: 2.4, rpg: 6, threePm: 2.2 },
      { id: "phx8", name: "Mason Plumlee", number: 22, position: "C", ppg: 5, apg: 1.6, rpg: 5.6, threePm: 0 }
    ]
  },
  // 25. Portland Trail Blazers
  blazers: {
    coach: "Chauncey Billups",
    starters: [
      { id: "por1", name: "Anfernee Simons", number: 1, position: "PG", ppg: 16.8, apg: 4.6, rpg: 2.6, threePm: 2.6 },
      { id: "por2", name: "Shaedon Sharpe", number: 17, position: "SG", ppg: 17.4, apg: 2.4, rpg: 4.2, threePm: 1.8 },
      { id: "por3", name: "Toumani Camara", number: 33, position: "SF", ppg: 9.2, apg: 2.2, rpg: 4.8, threePm: 1.2 },
      { id: "por4", name: "Jerami Grant", number: 9, position: "PF", ppg: 16.5, apg: 2.2, rpg: 3.4, threePm: 2.2 },
      { id: "por5", name: "Deandre Ayton", number: 2, position: "C", ppg: 14.2, apg: 1.4, rpg: 10.8, threePm: 0.2 }
    ],
    bench: [
      { id: "por6", name: "Deni Avdija", number: 8, position: "SF", ppg: 10.8, apg: 3.2, rpg: 5.8, threePm: 1 },
      { id: "por7", name: "Scoot Henderson", number: 0, position: "PG", ppg: 11.8, apg: 5.2, rpg: 3, threePm: 1.2 },
      { id: "por8", name: "Donovan Clingan", number: 23, position: "C", ppg: 6, apg: 0.8, rpg: 6.2, threePm: 0.1 }
    ]
  },
  // 26. Sacramento Kings
  kings: {
    coach: "Mike Brown",
    starters: [
      { id: "sac1", name: "De'Aaron Fox", number: 5, position: "PG", ppg: 28.8, apg: 4.8, rpg: 5, threePm: 2.4 },
      { id: "sac2", name: "Keon Ellis", number: 23, position: "SG", ppg: 8.2, apg: 1.6, rpg: 2.8, threePm: 1.6 },
      { id: "sac3", name: "DeMar DeRozan", number: 10, position: "SF", ppg: 22.8, apg: 4.2, rpg: 4.2, threePm: 1 },
      { id: "sac4", name: "Keegan Murray", number: 13, position: "PF", ppg: 13.6, apg: 1.8, rpg: 7.8, threePm: 2.2 },
      { id: "sac5", name: "Domantas Sabonis", number: 11, position: "C", ppg: 20.2, apg: 6.6, rpg: 12.8, threePm: 0.6 }
    ],
    bench: [
      { id: "sac6", name: "Malik Monk", number: 0, position: "SG", ppg: 13.4, apg: 3.2, rpg: 3, threePm: 1.6 },
      { id: "sac7", name: "Kevin Huerter", number: 9, position: "SG", ppg: 10.5, apg: 1.8, rpg: 3.4, threePm: 1.8 },
      { id: "sac8", name: "Trey Lyles", number: 41, position: "PF", ppg: 7.8, apg: 1.2, rpg: 4.6, threePm: 1.4 }
    ]
  },
  // 27. San Antonio Spurs
  spurs: {
    coach: "Gregg Popovich",
    starters: [
      { id: "sas1", name: "Chris Paul", number: 3, position: "PG", ppg: 10.6, apg: 8.4, rpg: 3.8, threePm: 1.8 },
      { id: "sas2", name: "Devin Vassell", number: 24, position: "SG", ppg: 17.5, apg: 3.4, rpg: 3.8, threePm: 2.4 },
      { id: "sas3", name: "Harrison Barnes", number: 40, position: "SF", ppg: 11.8, apg: 1.6, rpg: 4.2, threePm: 1.8 },
      { id: "sas4", name: "Jeremy Sochan", number: 10, position: "PF", ppg: 15.4, apg: 3, rpg: 7.8, threePm: 0.6 },
      { id: "sas5", name: "Victor Wembanyama", number: 1, position: "C", ppg: 24.2, apg: 3.8, rpg: 10.6, threePm: 3.2 }
    ],
    bench: [
      { id: "sas6", name: "Keldon Johnson", number: 0, position: "SF", ppg: 12.6, apg: 1.6, rpg: 5.4, threePm: 1.2 },
      { id: "sas7", name: "Stephon Castle", number: 5, position: "PG", ppg: 11.2, apg: 3.6, rpg: 2.8, threePm: 0.9 },
      { id: "sas8", name: "Zach Collins", number: 23, position: "C", ppg: 6.8, apg: 1.8, rpg: 3.8, threePm: 0.5 }
    ]
  },
  // 28. Toronto Raptors
  raptors: {
    coach: "Darko Rajakovic",
    starters: [
      { id: "tor1", name: "Immanuel Quickley", number: 5, position: "PG", ppg: 15.6, apg: 5.8, rpg: 3.2, threePm: 2.2 },
      { id: "tor2", name: "Gradey Dick", number: 1, position: "SG", ppg: 18.2, apg: 2.4, rpg: 3, threePm: 2.6 },
      { id: "tor3", name: "RJ Barrett", number: 9, position: "SF", ppg: 23.2, apg: 6.2, rpg: 6.4, threePm: 1.8 },
      { id: "tor4", name: "Scottie Barnes", number: 4, position: "PF", ppg: 20.4, apg: 6.8, rpg: 8.6, threePm: 1.2 },
      { id: "tor5", name: "Jakob Poeltl", number: 19, position: "C", ppg: 15.8, apg: 2.8, rpg: 11.6, threePm: 0 }
    ],
    bench: [
      { id: "tor6", name: "Davion Mitchell", number: 45, position: "PG", ppg: 8.8, apg: 5, rpg: 2, threePm: 1 },
      { id: "tor7", name: "Ochai Agbaji", number: 30, position: "SG", ppg: 11.4, apg: 1.8, rpg: 4.8, threePm: 1.4 },
      { id: "tor8", name: "Chris Boucher", number: 25, position: "PF", ppg: 9.8, apg: 0.8, rpg: 4.4, threePm: 1.4 }
    ]
  },
  // 29. Utah Jazz
  jazz: {
    coach: "Will Hardy",
    starters: [
      { id: "uta1", name: "Keyonte George", number: 3, position: "PG", ppg: 15.2, apg: 5.6, rpg: 3.2, threePm: 2.4 },
      { id: "uta2", name: "Collin Sexton", number: 2, position: "SG", ppg: 17.8, apg: 3.4, rpg: 2.8, threePm: 1.6 },
      { id: "uta3", name: "Lauri Markkanen", number: 23, position: "SF", ppg: 19.8, apg: 2, rpg: 6.4, threePm: 2.8 },
      { id: "uta4", name: "John Collins", number: 20, position: "PF", ppg: 18.2, apg: 2.6, rpg: 8.8, threePm: 1.4 },
      { id: "uta5", name: "Walker Kessler", number: 24, position: "C", ppg: 9.6, apg: 1.2, rpg: 10.8, threePm: 0 }
    ],
    bench: [
      { id: "uta6", name: "Jordan Clarkson", number: 0, position: "SG", ppg: 15.4, apg: 3.8, rpg: 3.8, threePm: 2 },
      { id: "uta7", name: "Cody Williams", number: 5, position: "SF", ppg: 7.8, apg: 1.6, rpg: 2.8, threePm: 0.8 },
      { id: "uta8", name: "Kyle Filipowski", number: 22, position: "PF", ppg: 8.4, apg: 2, rpg: 4.8, threePm: 0.6 }
    ]
  },
  // 30. Washington Wizards
  wizards: {
    coach: "Brian Keefe",
    starters: [
      { id: "was1", name: "Jordan Poole", number: 13, position: "PG", ppg: 21.2, apg: 4.8, rpg: 2.4, threePm: 3.6 },
      { id: "was2", name: "Carlton Carrington", number: 8, position: "SG", ppg: 10.2, apg: 4.8, rpg: 4.4, threePm: 1.5 },
      { id: "was3", name: "Bilal Coulibaly", number: 0, position: "SF", ppg: 14.8, apg: 2.8, rpg: 5.6, threePm: 1.4 },
      { id: "was4", name: "Alexandre Sarr", number: 20, position: "PF", ppg: 11.8, apg: 2.2, rpg: 6.4, threePm: 1.6 },
      { id: "was5", name: "Jonas Valanciunas", number: 17, position: "C", ppg: 12.6, apg: 2.2, rpg: 8.2, threePm: 0.2 }
    ],
    bench: [
      { id: "was6", name: "Kyle Kuzma", number: 33, position: "PF", ppg: 17, apg: 3, rpg: 6.2, threePm: 1.4 },
      { id: "was7", name: "Corey Kispert", number: 24, position: "SF", ppg: 11.2, apg: 1.6, rpg: 2.8, threePm: 2 },
      { id: "was8", name: "Kyshawn George", number: 18, position: "SG", ppg: 8.6, apg: 2.4, rpg: 3.8, threePm: 1.6 }
    ]
  }
};
function findNBARosterForTeam(teamNameOrAbbrev) {
  if (!teamNameOrAbbrev) return null;
  const lower = teamNameOrAbbrev.toLowerCase().trim();
  if (lower.length < 3) return null;
  if (NBA_30_TEAMS_ROSTERS[lower]) {
    return NBA_30_TEAMS_ROSTERS[lower];
  }
  const matchingKey = Object.keys(NBA_30_TEAMS_ROSTERS).find((k) => {
    return lower.includes(k);
  });
  if (matchingKey) {
    return NBA_30_TEAMS_ROSTERS[matchingKey];
  }
  const ALIAS_MAP = {
    gsw: "warriors",
    golden: "warriors",
    lal: "lakers",
    la_lakers: "lakers",
    lac: "clippers",
    la_clippers: "clippers",
    bos: "celtics",
    boston: "celtics",
    bkn: "nets",
    brooklyn: "nets",
    nyk: "knicks",
    new_york: "knicks",
    phi: "sixers",
    philly: "sixers",
    philadelphia: "sixers",
    tor: "raptors",
    toronto: "raptors",
    chi: "bulls",
    chicago: "bulls",
    cle: "cavaliers",
    cleveland: "cavaliers",
    det: "pistons",
    detroit: "pistons",
    ind: "pacers",
    indiana: "pacers",
    mil: "bucks",
    milwaukee: "bucks",
    atl: "hawks",
    atlanta: "hawks",
    cha: "hornets",
    charlotte: "hornets",
    mia: "heat",
    miami: "heat",
    orl: "magic",
    orlando: "magic",
    was: "wizards",
    wsh: "wizards",
    washington: "wizards",
    den: "nuggets",
    denver: "nuggets",
    min: "timberwolves",
    minnesota: "timberwolves",
    wolves: "timberwolves",
    okc: "thunder",
    oklahoma: "thunder",
    por: "blazers",
    portland: "blazers",
    trail: "blazers",
    uta: "jazz",
    utah: "jazz",
    dal: "mavericks",
    dallas: "mavericks",
    hou: "rockets",
    houston: "rockets",
    mem: "grizzlies",
    memphis: "grizzlies",
    nop: "pelicans",
    orleans: "pelicans",
    sas: "spurs",
    san_antonio: "spurs",
    sac: "kings",
    sacramento: "kings",
    phx: "suns",
    phoenix: "suns"
  };
  for (const [alias, canonicalKey] of Object.entries(ALIAS_MAP)) {
    if (lower === alias || new RegExp(`\\b${alias.replace(/_/g, "[_ ]")}\\b`, "i").test(lower)) {
      return NBA_30_TEAMS_ROSTERS[canonicalKey] || null;
    }
  }
  return null;
}

// src/services/lineupService.ts
var HISPANIC_TEAM_REGEX = /chile|colombia|argentina|spain|españa|mexico|méxico|brazil|brasil|uruguay|paraguay|peru|perú|ecuador|venezuela|costa rica|nicaragua|honduras|guatemala|salvador|panama|panamá|bolivia|jalapa|managua|unan|dirian|diriangén|esteli|estelí|walter ferretti|ocotal|matagalpa|masachapa| Chinandega|séba|sebaco|real|deportivo|municipal|atletico|atlético|alianza|independiente|universidad|nacional|olimpia|saprissa|alajuelense|herediano|cartagines|motagua|marathon|marathón|comunicaciones|xelaju|antigua|coban|aguila|águila|fas|firpo|tauro|plaza amador|bolivar|bolívar|strongest|wilstermann|blooming|oriente|always ready|millonarios|santa fe|junior|medellin|medellín|cali|america|américa|tolima|bucaramanga|once caldas|pereira|pasto|envigado|equidad|fortaleza|llaneros|chico|chicó|patriotas|jaguares|huila|quindio|cucuta|boca|river|racing|velez|vélez|talleres|lanus|lanús|belgrano|estudiantes|gimnasia|san lorenzo|huracan|huracán|rosario|newells|argentinos|defensa|banfield|platense|godoy cruz|union|unión|colon|colón|tucuman|central cordoba|instituto|barracas|riestra|sarmiento|tigre|flamengo|palmeiras|botafogo|corinthians|sao paulo|são paulo|gremio|grêmio|cruzeiro|vasco|bahia|fluminense|santos|internacional|athletico|paranaense|bragantino|fortaleza|cuiaba|juventude|vitoria|vitória|cruz azul|toluca|monterrey|rayados|tigres|pumas|unam|chivas|guadalajara|atlas|pachuca|leon|león|tijuana|xolos|juarez|juárez|necaxa|puebla|queretaro|querétaro|santos laguna|mazatlan|mazatlán|san luis|sevilla|valencia|betis|villarreal|athletic|sociedad|osasuna|celta|girona|espanyol|mallorca|getafe|rayo|alaves|alavés|las palmas|leganes|valladolid|granada|cadiz|cádiz|almeria|almería|zaragoza|sporting|oviedo|santander|levante|elche|tenerife|benfica|porto|braga|vitoria|guimaraes|famalicao|moreirense|gil vicente|boavista|rio ave|estoril|arouca|farense|casa pia|colo colo|colo-colo|catolica|católica|cobreloa|huachipato|everton|audax|palestino|coquimbo|iquique|ohiggins|ñublense|cobresal|la serena|wanderers|peñarol|penarol|danubio|defensor|liverpool|wanderers|cerro|fenix|fénix|progreso|racing|boston river|miramar|libertad|cerro porteño|porteno|guarani|guaraní|luqueño|trinidense|tacuary|nacional|amayense|alianza lima|universitario|cristal|melgar|cienciano|cusco|garcilaso|mannucci|vallejo|boys|adt|chankas|comerciantes|grau|sullana|utc|liga de quito|ldu|barcelona sc|emelec|independiente del valle|idv|aucas|macara|macará|tecnico|técnico|mushuc runa|orense|delfin|delfín|cumbaya|imbadura|tachira|táchira|caracas|monagas|zamora|la guaira|puerto cabello|metropolitanos|carabobo|estudiantes|portuguesa|angostura|ucv/i;
var EXCLUSIVE_CLUB_STARS = {
  "lautaro mart\xEDnez": /\b(inter milan|inter milano|internazionale|fc internazionale|argentina)\b/i,
  "lautaro martinez": /\b(inter milan|inter milano|internazionale|fc internazionale|argentina)\b/i,
  "kylian mbapp\xE9": /\b(real madrid|france|francia)\b/i,
  "kylian mbappe": /\b(real madrid|france|francia)\b/i,
  "robert lewandowski": /\b(fc barcelona|barcelona|poland|polonia)\b/i,
  "erling haaland": /\b(manchester city|man city|norway|noruega)\b/i,
  "bukayo saka": /\b(arsenal|england|inglaterra)\b/i,
  "mohamed salah": /\b(liverpool|egypt|egipto)\b/i,
  "cole palmer": /\b(chelsea|england|inglaterra)\b/i,
  "harry kane": /\b(bayern|england|inglaterra)\b/i,
  "ousmane demb\xE9l\xE9": /\b(paris saint-germain|paris sg|psg|france|francia)\b/i,
  "ousmane dembele": /\b(paris saint-germain|paris sg|psg|france|francia)\b/i,
  "du\u0161an vlahovi\u0107": /\b(juventus|serbia)\b/i,
  "dusan vlahovic": /\b(juventus|serbia)\b/i,
  "rafael le\xE3o": /\b(ac milan|milan|portugal)\b/i,
  "rafael leao": /\b(ac milan|milan|portugal)\b/i,
  "antoine griezmann": /\b(atlético de madrid|atletico de madrid|atletico madrid|atlético madrid)\b/i,
  "serhou guirassy": /\b(dortmund|borussia dortmund|guinea)\b/i,
  "florian wirtz": /\b(leverkusen|bayer leverkusen|germany|alemania)\b/i,
  "miguel borja": /\b(river plate|ca river plate|colombia)\b/i,
  "edinson cavani": /\b(boca juniors|ca boca juniors)\b/i,
  "est\xEAv\xE3o": /\b(palmeiras|se palmeiras|brazil|brasil)\b/i,
  "isaac romero": /\b(sevilla)\b/i,
  "hugo duro": /\b(valencia cf|valencia)\b/i,
  "javi puado": /\b(espanyol|rcd espanyol)\b/i,
  "ollie watkins": /\b(aston villa|england|inglaterra)\b/i,
  "son heung-min": /\b(tottenham|south korea|corea)\b/i
};
function isContaminatedForeignStar(playerName, teamName) {
  if (!playerName || !teamName) return false;
  const pLower = playerName.trim().toLowerCase();
  const tLower = teamName.trim().toLowerCase();
  const allowedTeamRegex = EXCLUSIVE_CLUB_STARS[pLower];
  if (!allowedTeamRegex) return false;
  if (pLower.includes("lewandowski") && (tLower.includes("barcelona sc") || tLower.includes("guayaquil"))) {
    return true;
  }
  if (pLower.includes("saka") && tLower.includes("sarand")) {
    return true;
  }
  if (pLower.includes("salah") && (tLower.includes("montevideo") || tLower.includes("uru"))) {
    return true;
  }
  if (pLower.includes("borja") && (tLower.includes("boston river") || tLower.includes("montevideo") || tLower.includes("asuncion"))) {
    return true;
  }
  if (pLower.includes("cavani") && tLower.includes("cali")) {
    return true;
  }
  return !allowedTeamRegex.test(tLower);
}
function isGenericPlaceholderPlayerName(name, teamName) {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return true;
  const genericPlaceholders = /^(jugador|player|titular|suplente|sustituto)\b/i;
  if (genericPlaceholders.test(trimmed)) {
    return true;
  }
  if (/#\d+/.test(trimmed)) return true;
  if (teamName) {
    if (isContaminatedForeignStar(trimmed, teamName)) {
      return true;
    }
  }
  return false;
}
function generateHumanPlayerName(teamName, index = 9, isSub = false) {
  let hash = 0;
  const str = `${teamName}_${index}_${isSub ? "sub" : "starter"}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const isFemale = /w\b|women|femenino|femenil|u17 w|u20 w/i.test(teamName);
  const isLatin = HISPANIC_TEAM_REGEX.test(teamName);
  if (isFemale) {
    const latinFemaleFirst = ["Ana\xEDs", "Catalina", "Monserrat", "Valeria", "Camila", "Sof\xEDa", "Martina", "Isabella", "Luc\xEDa", "Valentina", "Pau", "Celia", "Aiara", "Ainoa", "Irune", "Paloma", "Natsumy", "Vaitiare", "Daniela", "Fernanda", "Maitte", "Nicole", "Claudia"];
    const latinFemaleLast = ["Figueroa", "\xC1lvarez", "Cifuentes", "Mellado", "Gonz\xE1lez", "Tapia", "Bustamante", "Carter", "Comendador", "Segura", "Garc\xEDa", "Mart\xEDnez", "Rodr\xEDguez", "L\xF3pez", "Hern\xE1ndez", "Silva", "Morales", "Vargas", "Rojas", "Castro"];
    const angloFemaleFirst = ["Emma", "Olivia", "Sophia", "Ava", "Isla", "Mia", "Charlotte", "Grace", "Chloe", "Ella", "Hannah", "Zoe", "Freya", "Maya", "Nora", "Sophia", "Lucy", "Lily"];
    const angloFemaleLast = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "White", "Harris"];
    const firstList = isLatin ? latinFemaleFirst : angloFemaleFirst;
    const lastList = isLatin ? latinFemaleLast : angloFemaleLast;
    const fn = firstList[posHash % firstList.length];
    const ln = lastList[(posHash >> 2) % lastList.length];
    return `${fn} ${ln}`;
  } else {
    const latinMaleFirst = ["Mateo", "Santiago", "Sebasti\xE1n", "Alejandro", "Diego", "Lucas", "Nicol\xE1s", "Joaqu\xEDn", "Gabriel", "Tom\xE1s", "Javier", "Carlos", "Andr\xE9s", "Felipe", "Emanuel", "Rodrigo", "Gonzalo", "Mat\xEDas", "Esteban", "\xC1lvaro", "Marcos", "Franco", "Ignacio"];
    const latinMaleLast = ["Gonz\xE1lez", "Rodr\xEDguez", "G\xF3mez", "Fern\xE1ndez", "L\xF3pez", "D\xEDaz", "Mart\xEDnez", "P\xE9rez", "Garc\xEDa", "S\xE1nchez", "Romero", "Sosa", "Torres", "\xC1lvarez", "Ruiz", "Ram\xEDrez", "Flores", "Ben\xEDtez", "Acosta", "Medina"];
    const angloMaleFirst = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Marcus", "Brandon", "Justin", "Tyler", "Austin"];
    const angloMaleLast = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Clark"];
    const firstList = isLatin ? latinMaleFirst : angloMaleFirst;
    const lastList = isLatin ? latinMaleLast : angloMaleLast;
    const fn = firstList[posHash % firstList.length];
    const ln = lastList[(posHash >> 2) % lastList.length];
    return `${fn} ${ln}`;
  }
}
function sanitizePlayerName(rawName, teamName, fallbackIndex = 9, isSub = false) {
  if (!isGenericPlaceholderPlayerName(rawName, teamName)) {
    return rawName.trim();
  }
  return generateHumanPlayerName(teamName, fallbackIndex, isSub);
}
function generateHumanCoachName(teamName) {
  const matchedRoster = findSoccerRosterForTeam(teamName);
  if (matchedRoster) return matchedRoster.coach;
  if (/celtics/i.test(teamName)) return "Joe Mazzulla";
  if (/lakers/i.test(teamName)) return "JJ Redick";
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash << 5) - hash + teamName.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const isLatin = HISPANIC_TEAM_REGEX.test(teamName);
  if (isLatin) {
    const coaches = ["Hubert Bodhert", "Alberto Gamero", "Carlos Rodr\xEDguez", "Javier L\xF3pez", "\xC1lvaro Gonz\xE1lez", "Guillermo Fern\xE1ndez", "Marcelo Silva", "Hern\xE1n Crespo", "Eduardo Berizzo", "Gustavo Alfaro"];
    return coaches[posHash % coaches.length];
  } else {
    const coaches = ["David Miller", "Steve Kerr", "Michael Taylor", "Mark Stevens", "Erik Spoelstra", "Taylor Jenkins", "Rick Carlisle", "Chris Finch", "Will Hardy", "Nick Nurse"];
    return coaches[posHash % coaches.length];
  }
}
var SOCCER_REAL_ROSTERS = {
  // Alianza Valledupar / Alianza FC (Colombia Primera A)
  "alianza valledupar": {
    coach: "Hubert Bodhert",
    formation: "4-3-3",
    starters: [
      { id: "ali01", name: "Pier Graziani", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "ali02", name: "Efra\xEDn Navarro", number: 22, position: "DEF", matchYellowCards: 0 },
      { id: "ali03", name: "Pedro Franco", number: 5, position: "DEF", isCaptain: true, matchYellowCards: 0 },
      { id: "ali04", name: "Jes\xFAs Figueroa", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "ali05", name: "Leonardo Salda\xF1a", number: 16, position: "DEF", matchYellowCards: 0 },
      { id: "ali06", name: "Royscer Colpa", number: 14, position: "MED", matchYellowCards: 0 },
      { id: "ali07", name: "Jair Castillo", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "ali08", name: "Rub\xE9n Manjarr\xE9s", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "ali09", name: "Emerson Batalla", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "ali10", name: "Andr\xE9s Renter\xEDa", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "ali11", name: "Mayer Gil", number: 11, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "ali12", name: "Carlos Mosquera", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "ali13", name: "Misael Mart\xEDnez", number: 19, position: "DEL", matchYellowCards: 0 },
      { id: "ali14", name: "Diego Mendoza", number: 15, position: "MED", matchYellowCards: 0 },
      { id: "ali15", name: "Jhonatan Mu\xF1oz", number: 3, position: "DEF", matchYellowCards: 0 }
    ]
  },
  // Internacional de Bogotá / Internacional FC (Colombia)
  "internacional de bogota": {
    coach: "Carlos Hern\xE1ndez",
    formation: "4-2-3-1",
    starters: [
      { id: "ib01", name: "Ramiro S\xE1nchez", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "ib02", name: "Juan Camilo Angulo", number: 4, position: "DEF", isCaptain: true, matchYellowCards: 0 },
      { id: "ib03", name: "Geisson Perea", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "ib04", name: "Jos\xE9 Cuen\xFA", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "ib05", name: "Kalaz\xE1n Su\xE1rez", number: 13, position: "DEF", matchYellowCards: 0 },
      { id: "ib06", name: "Larry V\xE1squez", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "ib07", name: "Juan Pablo Ram\xEDrez", number: 10, position: "MED", matchYellowCards: 0 },
      { id: "ib08", name: "Johan Caballero", number: 11, position: "DEL", matchYellowCards: 0 },
      { id: "ib09", name: "Cristian Barrios", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "ib10", name: "Brayan Fern\xE1ndez", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "ib11", name: "Dar\xEDo Rodr\xEDguez", number: 19, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "ib12", name: "Aldair Quintana", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "ib13", name: "Kevin Londo\xF1o", number: 17, position: "MED", matchYellowCards: 0 },
      { id: "ib14", name: "Jhonier Viveros", number: 20, position: "DEL", matchYellowCards: 0 },
      { id: "ib15", name: "Yuli\xE1n G\xF3mez", number: 15, position: "DEF", matchYellowCards: 0 }
    ]
  },
  // Millonarios FC (Colombia Primera A)
  "millonarios": {
    coach: "David Gonz\xE1lez",
    formation: "4-2-3-1",
    starters: [
      { id: "mil01", name: "\xC1lvaro Montero", number: 31, position: "POR", matchYellowCards: 0 },
      { id: "mil02", name: "Delvin Alfonzo", number: 22, position: "DEF", matchYellowCards: 0 },
      { id: "mil03", name: "Andr\xE9s Llin\xE1s", number: 26, position: "DEF", matchYellowCards: 0 },
      { id: "mil04", name: "Juan Pablo Vargas", number: 4, position: "DEF", matchYellowCards: 0 },
      { id: "mil05", name: "Danovis Banguero", number: 20, position: "DEF", matchYellowCards: 0 },
      { id: "mil06", name: "Daniel Giraldo", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "mil07", name: "Stiven Vega", number: 28, position: "MED", matchYellowCards: 0 },
      { id: "mil08", name: "Mackalister Silva", number: 14, position: "MED", isCaptain: true, matchYellowCards: 0 },
      { id: "mil09", name: "Daniel Ruiz", number: 18, position: "DEL", matchYellowCards: 0 },
      { id: "mil10", name: "Leonardo Castro", number: 23, position: "DEL", matchYellowCards: 0 },
      { id: "mil11", name: "Radamel Falcao Garc\xEDa", number: 9, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "mil12", name: "Diego Novoa", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "mil13", name: "Santiago Giordana", number: 32, position: "DEL", matchYellowCards: 0 },
      { id: "mil14", name: "Jhon C\xF3rdoba", number: 15, position: "DEL", matchYellowCards: 0 },
      { id: "mil15", name: "Daniel Cata\xF1o", number: 10, position: "MED", matchYellowCards: 0 }
    ]
  },
  // Atlético Nacional (Colombia Primera A)
  "atletico nacional": {
    coach: "Efra\xEDn Ju\xE1rez",
    formation: "4-3-3",
    starters: [
      { id: "nal01", name: "David Ospina", number: 1, position: "POR", isCaptain: true, matchYellowCards: 0 },
      { id: "nal02", name: "Andr\xE9s Rom\xE1n", number: 6, position: "DEF", matchYellowCards: 0 },
      { id: "nal03", name: "Felipe Aguirre", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "nal04", name: "William Tesillo", number: 16, position: "DEF", matchYellowCards: 0 },
      { id: "nal05", name: "\xC1lvaro Angulo", number: 77, position: "DEF", matchYellowCards: 0 },
      { id: "nal06", name: "Jorman Campuzano", number: 21, position: "MED", matchYellowCards: 0 },
      { id: "nal07", name: "Sebasti\xE1n Guzm\xE1n", number: 32, position: "MED", matchYellowCards: 0 },
      { id: "nal08", name: "Edwin Cardona", number: 10, position: "MED", matchYellowCards: 0 },
      { id: "nal09", name: "Marino Hinestroza", number: 18, position: "DEL", matchYellowCards: 0 },
      { id: "nal10", name: "Alfredo Morelos", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "nal11", name: "Andr\xE9s Sarmiento", number: 29, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "nal12", name: "Harlen Castillo", number: 15, position: "POR", matchYellowCards: 0 },
      { id: "nal13", name: "Pablo Ceppelini", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "nal14", name: "Dairon Asprilla", number: 27, position: "DEL", matchYellowCards: 0 },
      { id: "nal15", name: "Kevin Viveros", number: 19, position: "DEL", matchYellowCards: 0 }
    ]
  },
  // América de Cali (Colombia Primera A)
  "america de cali": {
    coach: "Jorge da Silva",
    formation: "4-2-3-1",
    starters: [
      { id: "ame01", name: "Jorge Soto", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "ame02", name: "Yerson Candelo", number: 13, position: "DEF", matchYellowCards: 0 },
      { id: "ame03", name: "Daniel Bocanegra", number: 4, position: "DEF", matchYellowCards: 0 },
      { id: "ame04", name: "Andr\xE9s Mosquera", number: 26, position: "DEF", matchYellowCards: 0 },
      { id: "ame05", name: "Edwin Velasco", number: 32, position: "DEF", matchYellowCards: 0 },
      { id: "ame06", name: "\xC9der \xC1lvarez Balanta", number: 3, position: "MED", matchYellowCards: 0 },
      { id: "ame07", name: "Harold Rivera", number: 17, position: "MED", matchYellowCards: 0 },
      { id: "ame08", name: "Juan Fernando Quintero", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "ame09", name: "Cristian Barrios", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "ame10", name: "Rodrigo Holgado", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "ame11", name: "Duv\xE1n Vergara", number: 11, position: "DEL", isCaptain: true, matchYellowCards: 0 }
    ],
    subs: [
      { id: "ame12", name: "Joel Graterol", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "ame13", name: "Adri\xE1n Ramos", number: 20, position: "DEL", matchYellowCards: 0 },
      { id: "ame14", name: "Franco Leys", number: 15, position: "MED", matchYellowCards: 0 },
      { id: "ame15", name: "Jader Qui\xF1ones", number: 18, position: "MED", matchYellowCards: 0 }
    ]
  },
  // Junior de Barranquilla (Colombia Primera A)
  "junior barranquilla": {
    coach: "C\xE9sar Far\xEDas",
    formation: "4-2-3-1",
    starters: [
      { id: "jun01", name: "Santiago Mele", number: 77, position: "POR", matchYellowCards: 0 },
      { id: "jun02", name: "Edwin Herrera", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "jun03", name: "Emanuel Olivera", number: 28, position: "DEF", matchYellowCards: 0 },
      { id: "jun04", name: "Jermein Pe\xF1a", number: 4, position: "DEF", matchYellowCards: 0 },
      { id: "jun05", name: "Gabriel Fuentes", number: 12, position: "DEF", matchYellowCards: 0 },
      { id: "jun06", name: "Didier Moreno", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "jun07", name: "V\xEDctor Cantillo", number: 24, position: "MED", matchYellowCards: 0 },
      { id: "jun08", name: "Yimmi Char\xE1", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "jun09", name: "Jos\xE9 Enamorado", number: 99, position: "DEL", matchYellowCards: 0 },
      { id: "jun10", name: "Carlos Bacca", number: 70, position: "DEL", isCaptain: true, matchYellowCards: 0 },
      { id: "jun11", name: "Bryan Castrill\xF3n", number: 88, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "jun12", name: "Jefersson Mart\xEDnez", number: 30, position: "POR", matchYellowCards: 0 },
      { id: "jun13", name: "Marco P\xE9rez", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "jun14", name: "Steven Rodr\xEDguez", number: 23, position: "DEL", matchYellowCards: 0 },
      { id: "jun15", name: "Luis Gonz\xE1lez", number: 10, position: "MED", matchYellowCards: 0 }
    ]
  },
  // Independiente Santa Fe (Colombia Primera A)
  "santa fe": {
    coach: "Pablo Peirano",
    formation: "5-3-2",
    starters: [
      { id: "sfe01", name: "Andr\xE9s Mosquera Marmolejo", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "sfe02", name: "Elvis Perlaza", number: 32, position: "DEF", matchYellowCards: 0 },
      { id: "sfe03", name: "Marcelo Ortiz", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "sfe04", name: "Juli\xE1n Mill\xE1n", number: 29, position: "DEF", matchYellowCards: 0 },
      { id: "sfe05", name: "Dairon Mosquera", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "sfe06", name: "Daniel Torres", number: 16, position: "MED", matchYellowCards: 0 },
      { id: "sfe07", name: "Yilmar Vel\xE1squez", number: 5, position: "MED", matchYellowCards: 0 },
      { id: "sfe08", name: "Juan Pablo Zuluaga", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "sfe09", name: "Omar Albornoz", number: 18, position: "DEL", matchYellowCards: 0 },
      { id: "sfe10", name: "Hugo Rodallega", number: 11, position: "DEL", isCaptain: true, matchYellowCards: 0 },
      { id: "sfe11", name: "Harold Santiago Mosquera", number: 23, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "sfe12", name: "Juan Espitia", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "sfe13", name: "Agust\xEDn Rodr\xEDguez", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "sfe14", name: "Edwar L\xF3pez", number: 28, position: "DEL", matchYellowCards: 0 },
      { id: "sfe15", name: "Jhojan Torres", number: 14, position: "MED", matchYellowCards: 0 }
    ]
  },
  // Chile U17 W (Mundial Sub-17 Femenino)
  "chile u17": {
    coach: "\xC1lex Castro",
    formation: "4-3-3",
    starters: [
      { id: "chi01", name: "Catalina Mellado", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "chi02", name: "Monserrat Hern\xE1ndez", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "chi03", name: "Catalina Figueroa", number: 3, position: "DEF", isCaptain: true, matchYellowCards: 0, hasPreviousYellow: true },
      { id: "chi04", name: "Ana\xEDs Cifuentes", number: 4, position: "DEF", matchYellowCards: 0 },
      { id: "chi05", name: "Emma Gonz\xE1lez", number: 5, position: "DEF", matchYellowCards: 0 },
      { id: "chi06", name: "Ana\xEDs \xC1lvarez", number: 6, position: "MED", matchYellowCards: 0, hasPreviousYellow: true },
      { id: "chi07", name: "Nicole Carter", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "chi08", name: "Paloma Bustamante", number: 10, position: "MED", matchYellowCards: 0 },
      { id: "chi09", name: "Natsumy Millones", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "chi10", name: "Maitte Tapia", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "chi11", name: "Vaitiare Pardo", number: 11, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "chi12", name: "Jazm\xEDn Torrealba", number: 12, position: "POR", matchYellowCards: 0 },
      { id: "chi13", name: "Arantza Suazo", number: 14, position: "DEL", matchYellowCards: 0 },
      { id: "chi14", name: "Tamy Palma", number: 15, position: "MED", matchYellowCards: 0 },
      { id: "chi15", name: "Sabrina Clavijo", number: 16, position: "DEF", matchYellowCards: 0 },
      { id: "chi16", name: "Mariana Morales", number: 18, position: "MED", matchYellowCards: 0, isInjured: true, injuryNote: "Esguince de Tobillo" }
    ]
  },
  // Spain U17 W (Mundial Sub-17 Femenino)
  "spain u17": {
    coach: "Kenio Gonzalo",
    formation: "4-3-3",
    starters: [
      { id: "esp01", name: "Laia L\xF3pez", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "esp02", name: "Martina Gonz\xE1lez", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "esp03", name: "Amaya Garc\xEDa", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "esp04", name: "Claudia de la Fuente", number: 4, position: "DEF", matchYellowCards: 0 },
      { id: "esp05", name: "Aiara Agirrezabala", number: 5, position: "DEF", matchYellowCards: 0 },
      { id: "esp06", name: "Clara Serrajordi", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "esp07", name: "Ainoa G\xF3mez", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "esp08", name: "Irune Dorado", number: 10, position: "MED", isCaptain: true, matchYellowCards: 0 },
      { id: "esp09", name: "Celia Segura", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "esp10", name: "Pau Comendador", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "esp11", name: "Iris Ashley Santiago", number: 11, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "esp12", name: "Ziara Vega", number: 13, position: "POR", matchYellowCards: 0 },
      { id: "esp13", name: "Noa Ortega", number: 14, position: "DEL", matchYellowCards: 0 },
      { id: "esp14", name: "Emma Moreno", number: 15, position: "MED", matchYellowCards: 0 },
      { id: "esp15", name: "Lorena Cubo", number: 16, position: "DEF", matchYellowCards: 0 }
    ]
  },
  // Bayer Leverkusen
  "bayer leverkusen": {
    coach: "Xabi Alonso",
    formation: "3-4-2-1",
    starters: [
      { id: "b01", name: "Lukas Hradecky", number: 1, position: "POR", isCaptain: true, matchYellowCards: 0 },
      { id: "b02", name: "Edmond Tapsoba", number: 12, position: "DEF", matchYellowCards: 0 },
      { id: "b03", name: "Jonathan Tah", number: 4, position: "DEF", matchYellowCards: 0, hasPreviousYellow: true },
      { id: "b04", name: "Piero Hincapi\xE9", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "b05", name: "Jeremie Frimpong", number: 30, position: "MED", matchYellowCards: 0 },
      { id: "b06", name: "Granit Xhaka", number: 34, position: "MED", matchYellowCards: 0, hasPreviousYellow: true },
      { id: "b07", name: "Robert Andrich", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "b08", name: "Alejandro Grimaldo", number: 20, position: "MED", matchYellowCards: 0 },
      { id: "b09", name: "Florian Wirtz", number: 10, position: "DEL", matchYellowCards: 0 },
      { id: "b10", name: "Jonas Hofmann", number: 7, position: "DEL", matchYellowCards: 0 },
      { id: "b11", name: "Victor Boniface", number: 22, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "b12", name: "Matej Kovar", number: 17, position: "POR", matchYellowCards: 0 },
      { id: "b13", name: "Patrik Schick", number: 14, position: "DEL", matchYellowCards: 0 },
      { id: "b14", name: "Martin Terrier", number: 11, position: "DEL", matchYellowCards: 0 },
      { id: "b15", name: "Nathan Tella", number: 19, position: "MED", matchYellowCards: 0 },
      { id: "b16", name: "Exequiel Palacios", number: 25, position: "MED", matchYellowCards: 0, isInjured: true, injuryNote: "Lesi\xF3n Muscular" }
    ]
  },
  // TSG Hoffenheim
  "hoffenheim": {
    coach: "Pellegrino Matarazzo",
    formation: "3-4-1-2",
    starters: [
      { id: "h01", name: "Oliver Baumann", number: 1, position: "POR", isCaptain: true, matchYellowCards: 0 },
      { id: "h02", name: "Tim Drexler", number: 34, position: "DEF", matchYellowCards: 0 },
      { id: "h03", name: "Florian Grillitsch", number: 11, position: "DEF", matchYellowCards: 0 },
      { id: "h04", name: "Kevin Akpoguma", number: 25, position: "DEF", matchYellowCards: 0, hasPreviousYellow: true },
      { id: "h05", name: "Valentin Gendrey", number: 15, position: "MED", matchYellowCards: 0 },
      { id: "h06", name: "Anton Stach", number: 16, position: "MED", matchYellowCards: 0 },
      { id: "h07", name: "Tom Bischof", number: 7, position: "MED", matchYellowCards: 0 },
      { id: "h08", name: "Alexander Prass", number: 19, position: "MED", matchYellowCards: 0 },
      { id: "h09", name: "Andrej Kramari\u0107", number: 27, position: "DEL", matchYellowCards: 0 },
      { id: "h10", name: "Adam Hlo\u017Eek", number: 23, position: "DEL", matchYellowCards: 0 },
      { id: "h11", name: "Marius B\xFClter", number: 21, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "h12", name: "Luca Philipp", number: 37, position: "POR", matchYellowCards: 0 },
      { id: "h13", name: "Ihlas Bebou", number: 9, position: "DEL", matchYellowCards: 0, isInjured: true, injuryNote: "Molestia en Rodilla" },
      { id: "h14", name: "Mergim Berisha", number: 8, position: "DEL", matchYellowCards: 0 },
      { id: "h15", name: "Dennis Geiger", number: 6, position: "MED", matchYellowCards: 0 }
    ]
  },
  // Real Madrid
  "real madrid": {
    coach: "Carlo Ancelotti",
    formation: "4-3-3",
    starters: [
      { id: "rm01", name: "Thibaut Courtois", number: 1, position: "POR", matchYellowCards: 0 },
      { id: "rm02", name: "Dani Carvajal", number: 2, position: "DEF", matchYellowCards: 0, isCaptain: true, hasPreviousYellow: true },
      { id: "rm03", name: "Eder Milit\xE3o", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "rm04", name: "Antonio R\xFCdiger", number: 22, position: "DEF", matchYellowCards: 0 },
      { id: "rm05", name: "Ferland Mendy", number: 23, position: "DEF", matchYellowCards: 0 },
      { id: "rm06", name: "Federico Valverde", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "rm07", name: "Aur\xE9lien Tchouam\xE9ni", number: 14, position: "MED", matchYellowCards: 0 },
      { id: "rm08", name: "Jude Bellingham", number: 5, position: "MED", matchYellowCards: 0 },
      { id: "rm09", name: "Rodrygo Goes", number: 11, position: "DEL", matchYellowCards: 0 },
      { id: "rm10", name: "Kylian Mbapp\xE9", number: 9, position: "DEL", matchYellowCards: 0 },
      { id: "rm11", name: "Vin\xEDcius J\xFAnior", number: 7, position: "DEL", matchYellowCards: 0, hasPreviousYellow: true }
    ],
    subs: [
      { id: "rm12", name: "Andriy Lunin", number: 13, position: "POR", matchYellowCards: 0 },
      { id: "rm13", name: "Luka Modri\u0107", number: 10, position: "MED", matchYellowCards: 0 },
      { id: "rm14", name: "Eduardo Camavinga", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "rm15", name: "Brahim D\xEDaz", number: 21, position: "DEL", matchYellowCards: 0 },
      { id: "rm16", name: "Endrick", number: 16, position: "DEL", matchYellowCards: 0 },
      { id: "rm17", name: "David Alaba", number: 4, position: "DEF", matchYellowCards: 0, isInjured: true, injuryNote: "Rotura Ligamento Cruzado" }
    ]
  },
  // FC Barcelona
  "fc barcelona": {
    coach: "Hansi Flick",
    formation: "4-2-3-1",
    starters: [
      { id: "fcb01", name: "I\xF1aki Pe\xF1a", number: 13, position: "POR", matchYellowCards: 0 },
      { id: "fcb02", name: "Jules Kound\xE9", number: 23, position: "DEF", matchYellowCards: 0 },
      { id: "fcb03", name: "Pau Cubars\xED", number: 2, position: "DEF", matchYellowCards: 0 },
      { id: "fcb04", name: "\xCD\xF1igo Mart\xEDnez", number: 5, position: "DEF", matchYellowCards: 0 },
      { id: "fcb05", name: "Alejandro Balde", number: 3, position: "DEF", matchYellowCards: 0 },
      { id: "fcb06", name: "Marc Casad\xF3", number: 17, position: "MED", matchYellowCards: 0 },
      { id: "fcb07", name: "Pedri Gonz\xE1lez", number: 8, position: "MED", matchYellowCards: 0 },
      { id: "fcb08", name: "Lamine Yamal", number: 19, position: "DEL", matchYellowCards: 0 },
      { id: "fcb09", name: "Dani Olmo", number: 20, position: "MED", matchYellowCards: 0 },
      { id: "fcb10", name: "Raphinha Dias", number: 11, position: "DEL", isCaptain: true, matchYellowCards: 0 },
      { id: "fcb11", name: "Robert Lewandowski", number: 9, position: "DEL", matchYellowCards: 0 }
    ],
    subs: [
      { id: "fcb12", name: "Wojciech Szcz\u0119sny", number: 25, position: "POR", matchYellowCards: 0 },
      { id: "fcb13", name: "Gavi Pa\xE9z", number: 6, position: "MED", matchYellowCards: 0 },
      { id: "fcb14", name: "Frenkie de Jong", number: 21, position: "MED", matchYellowCards: 0 },
      { id: "fcb15", name: "Ferm\xEDn L\xF3pez", number: 16, position: "MED", matchYellowCards: 0 },
      { id: "fcb16", name: "Marc-Andr\xE9 ter Stegen", number: 1, position: "POR", matchYellowCards: 0, isInjured: true, injuryNote: "Operaci\xF3n Tend\xF3n Rotuliano" }
    ]
  }
};
function findSoccerRosterForTeam(teamName) {
  const raw = (teamName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!raw) return null;
  if (raw.includes("alianza valledupar") || raw === "alianza fc" || raw === "alianza petrolera" || raw.includes("alianza") && !raw.includes("lima") && !raw.includes("atletico") && !raw.includes("universidad") && !raw.includes("salvador")) {
    return SOCCER_REAL_ROSTERS["alianza valledupar"];
  }
  if (raw.includes("internacional de bogota") || raw.includes("internacional bogota") || raw.includes("internacional fc") || raw.includes("inter palmira") || raw.includes("internacional de palmira")) {
    return SOCCER_REAL_ROSTERS["internacional de bogota"];
  }
  if (raw.includes("millonarios")) {
    return SOCCER_REAL_ROSTERS["millonarios"];
  }
  if (raw.includes("atletico nacional") || raw === "nacional medellin") {
    return SOCCER_REAL_ROSTERS["atletico nacional"];
  }
  if (raw.includes("america de cali") || raw === "america cali") {
    return SOCCER_REAL_ROSTERS["america de cali"];
  }
  if (raw.includes("junior barranquilla") || raw.includes("atletico junior") || raw === "junior" || raw === "junior fc") {
    return SOCCER_REAL_ROSTERS["junior barranquilla"];
  }
  if (raw.includes("santa fe") && !raw.includes("union")) {
    return SOCCER_REAL_ROSTERS["santa fe"];
  }
  if (raw.includes("chile u17")) {
    return SOCCER_REAL_ROSTERS["chile u17"];
  }
  if (raw.includes("spain u17") || raw.includes("espana u17")) {
    return SOCCER_REAL_ROSTERS["spain u17"];
  }
  if (raw.includes("leverkusen")) {
    return SOCCER_REAL_ROSTERS["bayer leverkusen"];
  }
  if (raw.includes("hoffenheim")) {
    return SOCCER_REAL_ROSTERS["hoffenheim"];
  }
  if (raw.includes("real madrid")) {
    return SOCCER_REAL_ROSTERS["real madrid"];
  }
  if ((raw === "barcelona" || raw === "fc barcelona" || raw.includes("fc barcelona")) && !raw.includes("sc") && !raw.includes("guayaquil") && !raw.includes("ecuador")) {
    return SOCCER_REAL_ROSTERS["fc barcelona"];
  }
  return null;
}
function resolveTeamStarPlayerName(teamName, rawStarName, liveRosterStarters) {
  if (Array.isArray(liveRosterStarters) && liveRosterStarters.length > 0) {
    const forward = liveRosterStarters.find((p) => p.number === 9 && !isGenericPlaceholderPlayerName(p.name, teamName)) || liveRosterStarters.find((p) => p.position === "DEL" && !isGenericPlaceholderPlayerName(p.name, teamName)) || liveRosterStarters[liveRosterStarters.length - 2] || liveRosterStarters[liveRosterStarters.length - 1];
    if (forward && !isGenericPlaceholderPlayerName(forward.name, teamName)) {
      return forward.name.trim();
    }
  }
  const matchedRoster = findSoccerRosterForTeam(teamName);
  if (matchedRoster) {
    const del = matchedRoster.starters.find((p) => p.number === 9 || p.position === "DEL") || matchedRoster.starters[9] || matchedRoster.starters[0];
    if (del) return del.name;
  }
  if (!isGenericPlaceholderPlayerName(rawStarName, teamName)) {
    return rawStarName.trim();
  }
  return generateHumanPlayerName(teamName || "Club", 9, false);
}
function getSoccerMatchEvents(fixture) {
  const isLive = fixture.status === "IN_PLAY";
  const isFinished = fixture.status === "FINISHED";
  if (!isLive && !isFinished) return [];
  const homeRoster = findSoccerRosterForTeam(fixture.homeTeam.name);
  const awayRoster = findSoccerRosterForTeam(fixture.awayTeam.name);
  const positions = [
    "POR",
    "DEF",
    "DEF",
    "DEF",
    "DEF",
    "MED",
    "MED",
    "MED",
    "DEL",
    "DEL",
    "DEL"
  ];
  const homeStarters = fixture.liveRosters?.homeStarters?.length ? fixture.liveRosters.homeStarters.map((p, idx) => ({
    ...p,
    name: sanitizePlayerName(p.name, fixture.homeTeam.name, idx, false)
  })) : homeRoster ? homeRoster.starters : positions.map((pos, idx) => ({
    id: `hp_${idx}`,
    name: idx === 9 ? resolveTeamStarPlayerName(fixture.homeTeam.name, fixture.homeTeam.starPlayer?.name) : generateHumanPlayerName(fixture.homeTeam.name, idx, false),
    number: idx === 0 ? 1 : idx === 9 ? 9 : idx + 2,
    position: pos,
    matchYellowCards: 0
  }));
  const awayStarters = fixture.liveRosters?.awayStarters?.length ? fixture.liveRosters.awayStarters.map((p, idx) => ({
    ...p,
    name: sanitizePlayerName(p.name, fixture.awayTeam.name, idx, false)
  })) : awayRoster ? awayRoster.starters : positions.map((pos, idx) => ({
    id: `ap_${idx}`,
    name: idx === 9 ? resolveTeamStarPlayerName(fixture.awayTeam.name, fixture.awayTeam.starPlayer?.name) : generateHumanPlayerName(fixture.awayTeam.name, idx, false),
    number: idx === 0 ? 1 : idx === 9 ? 9 : idx + 2,
    position: pos,
    matchYellowCards: 0
  }));
  if (Array.isArray(fixture.liveEvents) && fixture.liveEvents.length > 0) {
    const sanitizedLiveEvents = fixture.liveEvents.map((ev, idx) => {
      if (ev.teamSide === "NEUTRAL" || ev.type === "PERIOD_START" || ev.type === "PERIOD_HALF" || ev.type === "PERIOD_END" || ev.type === "CORNER") {
        return ev;
      }
      const isHome = ev.teamSide === "HOME";
      const teamName = isHome ? fixture.homeTeam.name : fixture.awayTeam.name;
      const starters = isHome ? homeStarters : awayStarters;
      let primary = ev.playerPrimary;
      if (isGenericPlaceholderPlayerName(primary, teamName)) {
        const fallbackIdx = ev.type === "GOAL" ? 9 - idx % 3 : (3 + idx * 2) % starters.length;
        primary = starters[fallbackIdx]?.name || resolveTeamStarPlayerName(teamName, void 0, starters);
      }
      let secondary = ev.playerSecondary;
      if (ev.type === "SUBSTITUTION" && isGenericPlaceholderPlayerName(secondary, teamName)) {
        secondary = starters[(6 + idx) % starters.length]?.name || generateHumanPlayerName(teamName, 6 + idx % 4, false);
      } else if (secondary && isGenericPlaceholderPlayerName(secondary, teamName)) {
        secondary = void 0;
      }
      let detail = ev.detail || "";
      if (primary && ev.playerPrimary && ev.playerPrimary !== primary && detail.includes(ev.playerPrimary)) {
        detail = detail.replace(ev.playerPrimary, primary);
      }
      return {
        ...ev,
        playerPrimary: primary,
        playerSecondary: secondary,
        detail
      };
    });
    return sanitizedLiveEvents.sort((a, b) => b.minute - a.minute);
  }
  const currentMinute = fixture.currentScore?.minute ?? (isLive ? 68 : 90);
  const homeScore = fixture.currentScore?.home ?? 0;
  const awayScore = fixture.currentScore?.away ?? 0;
  const list = [];
  list.push({
    id: "kickoff",
    minute: 1,
    displayMinute: "1'",
    type: "PERIOD_START",
    teamSide: "NEUTRAL",
    detail: `Inicio del primer tiempo`
  });
  for (let i = 0; i < homeScore; i++) {
    const min = Math.max(2, Math.min(currentMinute - 2, Math.round(18 + i * 28)));
    const scorer = homeStarters[8 + i % 3]?.name || homeStarters[9]?.name || resolveTeamStarPlayerName(fixture.homeTeam.name, fixture.homeTeam.starPlayer?.name, homeStarters);
    list.push({
      id: `goal_home_${i}`,
      minute: min,
      displayMinute: `${min}'`,
      type: "GOAL",
      teamSide: "HOME",
      teamName: fixture.homeTeam.name,
      playerPrimary: scorer,
      detail: `Gol de ${scorer} (${fixture.homeTeam.name})`,
      scoreSnapshot: { home: i + 1, away: 0 }
    });
  }
  for (let i = 0; i < awayScore; i++) {
    const min = Math.max(3, Math.min(currentMinute - 1, Math.round(26 + i * 31)));
    const scorer = awayStarters[9 - i % 3]?.name || awayStarters[9]?.name || resolveTeamStarPlayerName(fixture.awayTeam.name, fixture.awayTeam.starPlayer?.name, awayStarters);
    list.push({
      id: `goal_away_${i}`,
      minute: min,
      displayMinute: `${min}'`,
      type: "GOAL",
      teamSide: "AWAY",
      teamName: fixture.awayTeam.name,
      playerPrimary: scorer,
      detail: `Gol de ${scorer} (${fixture.awayTeam.name})`,
      scoreSnapshot: { home: Math.min(homeScore, 1), away: i + 1 }
    });
  }
  if (fixture.liveStats) {
    const homeYellows = fixture.liveStats.home.yellowCards || 0;
    const awayYellows = fixture.liveStats.away.yellowCards || 0;
    const homeReds = fixture.liveStats.home.redCards || 0;
    const awayReds = fixture.liveStats.away.redCards || 0;
    for (let i = 0; i < homeYellows; i++) {
      const min = Math.max(5, Math.min(currentMinute, Math.round((i + 1) / (homeYellows + 1) * currentMinute)));
      const pName = homeStarters[(3 + i * 2) % homeStarters.length]?.name || generateHumanPlayerName(fixture.homeTeam.name, 3 + i, false);
      list.push({
        id: `yc_home_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "YELLOW_CARD",
        teamSide: "HOME",
        teamName: fixture.homeTeam.name,
        playerPrimary: pName,
        detail: `Tarjeta amarilla para ${pName} (${fixture.homeTeam.name})`
      });
    }
    for (let i = 0; i < awayYellows; i++) {
      const min = Math.max(6, Math.min(currentMinute, Math.round((i + 1) / (awayYellows + 1) * currentMinute)));
      const pName = awayStarters[(5 + i * 2) % awayStarters.length]?.name || generateHumanPlayerName(fixture.awayTeam.name, 5 + i, false);
      list.push({
        id: `yc_away_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "YELLOW_CARD",
        teamSide: "AWAY",
        teamName: fixture.awayTeam.name,
        playerPrimary: pName,
        detail: `Tarjeta amarilla para ${pName} (${fixture.awayTeam.name})`
      });
    }
    for (let i = 0; i < homeReds; i++) {
      const min = Math.max(10, Math.min(currentMinute, Math.round((i + 1) / (homeReds + 1) * currentMinute)));
      const pName = homeStarters[(2 + i) % homeStarters.length]?.name || generateHumanPlayerName(fixture.homeTeam.name, 2 + i, false);
      list.push({
        id: `rc_home_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "RED_CARD",
        teamSide: "HOME",
        teamName: fixture.homeTeam.name,
        playerPrimary: pName,
        detail: `Tarjeta roja para ${pName} (${fixture.homeTeam.name})`
      });
    }
    for (let i = 0; i < awayReds; i++) {
      const min = Math.max(12, Math.min(currentMinute, Math.round((i + 1) / (awayReds + 1) * currentMinute)));
      const pName = awayStarters[(4 + i) % awayStarters.length]?.name || generateHumanPlayerName(fixture.awayTeam.name, 4 + i, false);
      list.push({
        id: `rc_away_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "RED_CARD",
        teamSide: "AWAY",
        teamName: fixture.awayTeam.name,
        playerPrimary: pName,
        detail: `Tarjeta roja para ${pName} (${fixture.awayTeam.name})`
      });
    }
    const homeCorners = fixture.liveStats.home.corners || 0;
    const awayCorners = fixture.liveStats.away.corners || 0;
    for (let i = 0; i < homeCorners; i++) {
      const min = Math.max(2, Math.min(currentMinute, Math.round((i + 1) / (homeCorners + 1) * currentMinute)));
      list.push({
        id: `corner_home_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "CORNER",
        teamSide: "HOME",
        teamName: fixture.homeTeam.name,
        detail: `Tiro de esquina a favor de ${fixture.homeTeam.name} (#${i + 1})`
      });
    }
    for (let i = 0; i < awayCorners; i++) {
      const min = Math.max(3, Math.min(currentMinute, Math.round((i + 1) / (awayCorners + 1) * currentMinute)));
      list.push({
        id: `corner_away_${i}`,
        minute: min,
        displayMinute: `${min}'`,
        type: "CORNER",
        teamSide: "AWAY",
        teamName: fixture.awayTeam.name,
        detail: `Tiro de esquina a favor de ${fixture.awayTeam.name} (#${i + 1})`
      });
    }
  }
  if (currentMinute >= 45) {
    list.push({
      id: "halftime",
      minute: 45,
      displayMinute: "45'",
      type: "PERIOD_HALF",
      teamSide: "NEUTRAL",
      detail: `Entretiempo reglamentario`
    });
  }
  if (isFinished || currentMinute >= 90) {
    list.push({
      id: "fulltime",
      minute: 90,
      displayMinute: "90'",
      type: "PERIOD_END",
      teamSide: "NEUTRAL",
      detail: `Final del encuentro (${homeScore} - ${awayScore})`
    });
  }
  return list.sort((a, b) => b.minute - a.minute);
}
function getSoccerLineupData(fixture) {
  if (fixture.liveRosters && fixture.liveRosters.homeStarters.length > 0 && fixture.liveRosters.awayStarters.length > 0) {
    const mapLivePlayer = (p, idx, teamName, isSub) => ({
      id: p.id,
      name: sanitizePlayerName(p.name, teamName, idx, isSub),
      number: p.number,
      position: p.position,
      isCaptain: p.isCaptain,
      matchYellowCards: p.matchYellowCards || 0
    });
    const homeStarters = fixture.liveRosters.homeStarters.map(
      (p, idx) => mapLivePlayer(p, idx, fixture.homeTeam.name, false)
    );
    const awayStarters = fixture.liveRosters.awayStarters.map(
      (p, idx) => mapLivePlayer(p, idx, fixture.awayTeam.name, false)
    );
    const homeSubstitutes = fixture.liveRosters.homeSubstitutes.map(
      (p, idx) => mapLivePlayer(p, idx + 12, fixture.homeTeam.name, true)
    );
    const awaySubstitutes = fixture.liveRosters.awaySubstitutes.map(
      (p, idx) => mapLivePlayer(p, idx + 12, fixture.awayTeam.name, true)
    );
    const events = getSoccerMatchEvents(fixture);
    const cardEvents = events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD");
    const syncPlayerCards = (player) => {
      if (player.matchYellowCards > 0) return;
      const pNorm = player.name.toLowerCase();
      const matched = cardEvents.filter(
        (e) => e.playerPrimary && (e.playerPrimary.toLowerCase().includes(pNorm) || pNorm.includes(e.playerPrimary.toLowerCase()))
      );
      if (matched.length > 0) {
        player.matchYellowCards = matched.length;
      }
    };
    homeStarters.forEach(syncPlayerCards);
    homeSubstitutes.forEach(syncPlayerCards);
    awayStarters.forEach(syncPlayerCards);
    awaySubstitutes.forEach(syncPlayerCards);
    return {
      homeFormation: fixture.liveRosters.homeFormation || "4-3-3",
      awayFormation: fixture.liveRosters.awayFormation || "4-3-3",
      homeStarters,
      awayStarters,
      homeSubstitutes,
      awaySubstitutes,
      homeCoach: fixture.liveRosters.homeCoach || generateHumanCoachName(fixture.homeTeam.name),
      awayCoach: fixture.liveRosters.awayCoach || generateHumanCoachName(fixture.awayTeam.name),
      stadiumName: fixture.venue?.name || `Estadio Municipal de ${fixture.homeTeam.name.split(" ")[0]}`,
      stadiumCity: fixture.venue?.city || fixture.homeTeam.name.split(" ")[0],
      refereeName: fixture.referee?.name || "\xC1rbitro Principal Oficial",
      status: fixture.status === "IN_PLAY" || fixture.status === "FINISHED" || Boolean(fixture.liveRosters && fixture.liveRosters.homeStarters?.length >= 7 && fixture.liveRosters.awayStarters?.length >= 7) ? "CONFIRMED" : "PROBABLE"
    };
  }
  const homeRoster = findSoccerRosterForTeam(fixture.homeTeam.name);
  const awayRoster = findSoccerRosterForTeam(fixture.awayTeam.name);
  const generateFallbackSquad = (teamName, isHome) => {
    const formation = isHome ? "4-3-3" : "4-2-3-1";
    const coach = generateHumanCoachName(teamName);
    const starCandidate = isHome ? fixture.homeTeam.starPlayer?.name : fixture.awayTeam.starPlayer?.name;
    const positions = [
      "POR",
      "DEF",
      "DEF",
      "DEF",
      "DEF",
      "MED",
      "MED",
      "MED",
      "DEL",
      "DEL",
      "DEL"
    ];
    const starters = positions.map((pos, idx) => ({
      id: `${isHome ? "h" : "a"}_p_${idx}`,
      name: idx === 9 ? resolveTeamStarPlayerName(teamName, starCandidate) : generateHumanPlayerName(teamName, idx, false),
      number: idx === 0 ? 1 : idx === 9 ? 9 : idx + 2,
      position: pos,
      isCaptain: idx === 2,
      matchYellowCards: 0,
      hasPreviousYellow: idx === 5
    }));
    const subPositions = ["POR", "DEF", "MED", "DEL", "DEL"];
    const subs = subPositions.map((pos, idx) => ({
      id: `${isHome ? "h" : "a"}_sub_${idx}`,
      name: generateHumanPlayerName(teamName, idx + 12, true),
      number: idx === 0 ? 12 : idx + 14,
      position: pos,
      matchYellowCards: 0,
      isInjured: idx === 4,
      injuryNote: idx === 4 ? "Molestia Muscular" : void 0
    }));
    return { coach, formation, starters, subs };
  };
  const homeData = homeRoster ? {
    coach: homeRoster.coach,
    formation: homeRoster.formation,
    starters: homeRoster.starters.map((p) => ({ ...p, matchYellowCards: 0 })),
    subs: homeRoster.subs.map((p) => ({ ...p, matchYellowCards: 0 }))
  } : generateFallbackSquad(fixture.homeTeam.name, true);
  const awayData = awayRoster ? {
    coach: awayRoster.coach,
    formation: awayRoster.formation,
    starters: awayRoster.starters.map((p) => ({ ...p, matchYellowCards: 0 })),
    subs: awayRoster.subs.map((p) => ({ ...p, matchYellowCards: 0 }))
  } : generateFallbackSquad(fixture.awayTeam.name, false);
  if (fixture.status === "IN_PLAY" || fixture.status === "FINISHED") {
    const events = getSoccerMatchEvents(fixture);
    const cardEvents = events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD");
    const matchCardToPlayer = (p) => {
      const pNorm = p.name.toLowerCase();
      const cards = cardEvents.filter(
        (e) => e.playerPrimary && (e.playerPrimary.toLowerCase() === pNorm || e.playerPrimary.toLowerCase().includes(pNorm) || pNorm.includes(e.playerPrimary.toLowerCase()))
      );
      p.matchYellowCards = cards.length;
    };
    homeData.starters.forEach(matchCardToPlayer);
    homeData.subs.forEach(matchCardToPlayer);
    awayData.starters.forEach(matchCardToPlayer);
    awayData.subs.forEach(matchCardToPlayer);
  }
  return {
    homeFormation: homeData.formation,
    awayFormation: awayData.formation,
    homeStarters: homeData.starters,
    awayStarters: awayData.starters,
    homeSubstitutes: homeData.subs,
    awaySubstitutes: awayData.subs,
    homeCoach: homeData.coach,
    awayCoach: awayData.coach,
    stadiumName: fixture.venue?.name || `Estadio Municipal de ${fixture.homeTeam.name.split(" ")[0]}`,
    stadiumCity: fixture.venue?.city || fixture.homeTeam.name.split(" ")[0],
    refereeName: fixture.referee?.name || "\xC1rbitro Principal Oficial",
    status: fixture.status === "IN_PLAY" || fixture.status === "FINISHED" ? "CONFIRMED" : "PROBABLE"
  };
}
function getNBALineupData(fixture) {
  const hName = fixture.homeTeam.name || "";
  const aName = fixture.awayTeam.name || "";
  const hShort = fixture.homeTeam.shortName || "";
  const aShort = fixture.awayTeam.shortName || "";
  const homeRoster = findNBARosterForTeam(hName) || findNBARosterForTeam(hShort) || findNBARosterForTeam(fixture.homeTeam.city || "");
  const awayRoster = findNBARosterForTeam(aName) || findNBARosterForTeam(aShort) || findNBARosterForTeam(fixture.awayTeam.city || "");
  const homeStarters = homeRoster ? homeRoster.starters.map((p) => ({ ...p })) : fixture.homeTeam.keyPlayers?.length ? fixture.homeTeam.keyPlayers.map((kp, idx) => ({
    id: kp.id || `hp_${idx}`,
    name: kp.name,
    number: idx * 3 + 2,
    position: kp.position,
    ppg: kp.seasonPpg,
    apg: kp.seasonApg,
    rpg: kp.seasonRpg,
    threePm: kp.season3pm
  })) : [
    { id: "hp1", name: `Base Titular (${hShort})`, number: 1, position: "PG", ppg: 16, apg: 5.5, rpg: 3.2, threePm: 1.8 },
    { id: "hp2", name: `Escolta Titular (${hShort})`, number: 2, position: "SG", ppg: 15.5, apg: 3.2, rpg: 3.6, threePm: 2.1 },
    { id: "hp3", name: `Alero Titular (${hShort})`, number: 3, position: "SF", ppg: 14.2, apg: 2.4, rpg: 4.8, threePm: 1.5 },
    { id: "hp4", name: `Ala-P\xEDvot Titular (${hShort})`, number: 4, position: "PF", ppg: 13.5, apg: 1.9, rpg: 6.5, threePm: 0.9 },
    { id: "hp5", name: `P\xEDvot Titular (${hShort})`, number: 5, position: "C", ppg: 12.8, apg: 1.8, rpg: 8.6, threePm: 0.2 }
  ];
  const awayStarters = awayRoster ? awayRoster.starters.map((p) => ({ ...p })) : fixture.awayTeam.keyPlayers?.length ? fixture.awayTeam.keyPlayers.map((kp, idx) => ({
    id: kp.id || `ap_${idx}`,
    name: kp.name,
    number: idx * 4 + 1,
    position: kp.position,
    ppg: kp.seasonPpg,
    apg: kp.seasonApg,
    rpg: kp.seasonRpg,
    threePm: kp.season3pm
  })) : [
    { id: "ap1", name: `Base Titular (${aShort})`, number: 1, position: "PG", ppg: 16, apg: 5.5, rpg: 3.2, threePm: 1.8 },
    { id: "ap2", name: `Escolta Titular (${aShort})`, number: 2, position: "SG", ppg: 15.5, apg: 3.2, rpg: 3.6, threePm: 2.1 },
    { id: "ap3", name: `Alero Titular (${aShort})`, number: 3, position: "SF", ppg: 14.2, apg: 2.4, rpg: 4.8, threePm: 1.5 },
    { id: "ap4", name: `Ala-P\xEDvot Titular (${aShort})`, number: 4, position: "PF", ppg: 13.5, apg: 1.9, rpg: 6.5, threePm: 0.9 },
    { id: "ap5", name: `P\xEDvot Titular (${aShort})`, number: 5, position: "C", ppg: 12.8, apg: 1.8, rpg: 8.6, threePm: 0.2 }
  ];
  const homeBench = homeRoster ? homeRoster.bench.map((p) => ({ ...p })) : [
    { id: "hb1", name: "Buddy Hield", number: 7, position: "SG", ppg: 15.8, apg: 1.8, rpg: 3.8, threePm: 3.4 },
    { id: "hb2", name: "Moses Moody", number: 4, position: "SG", ppg: 9.2, apg: 1.2, rpg: 2.4, threePm: 1.5 },
    { id: "hb3", name: "Kevon Looney", number: 5, position: "C", ppg: 5.6, apg: 1.8, rpg: 7.8, threePm: 0 }
  ];
  const awayBench = awayRoster ? awayRoster.bench.map((p) => ({ ...p })) : [
    { id: "ab1", name: "Daniel Gafford", number: 21, position: "C", ppg: 11.5, apg: 1.4, rpg: 6.8, threePm: 0 },
    { id: "ab2", name: "Spencer Dinwiddie", number: 26, position: "PG", ppg: 7.8, apg: 3.2, rpg: 2.2, threePm: 1.2 },
    { id: "ab3", name: "Naji Marshall", number: 13, position: "SF", ppg: 9.4, apg: 2.6, rpg: 3.8, threePm: 0.8 }
  ];
  if (Array.isArray(fixture.officialInjuries) && fixture.officialInjuries.length > 0) {
    const applyInjuries = (list) => {
      list.forEach((p) => {
        const pLower = p.name.toLowerCase();
        const found = fixture.officialInjuries?.find((inj) => {
          const injLower = inj.athleteName.toLowerCase();
          return pLower.includes(injLower) || injLower.includes(pLower);
        });
        if (found) {
          p.isInjured = true;
          const statusLower = found.status.toLowerCase();
          if (statusLower.includes("out") || statusLower.includes("fuera")) {
            p.injuryStatus = "Out";
          } else if (statusLower.includes("day") || statusLower.includes("question") || statusLower.includes("duda")) {
            p.injuryStatus = "GTD";
          } else {
            p.injuryStatus = "Probable";
          }
        }
      });
    };
    applyInjuries(homeStarters);
    applyInjuries(awayStarters);
    applyInjuries(homeBench);
    applyInjuries(awayBench);
  }
  return {
    homeStarters,
    awayStarters,
    homeBench,
    awayBench,
    homeCoach: homeRoster?.coach || "Entrenador Principal",
    awayCoach: awayRoster?.coach || "Entrenador Principal",
    arenaName: fixture.arena?.name || `Arena de ${fixture.homeTeam.name}`,
    arenaCity: fixture.arena?.city || fixture.homeTeam.name,
    status: fixture.status === "IN_PLAY" || fixture.status === "FINISHED" ? "CONFIRMED" : "PROBABLE"
  };
}

// src/services/nbaEngine.ts
function normalCDF(z) {
  if (z < -7) return 0;
  if (z > 7) return 1;
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;
  if (z >= 0) {
    const t = 1 / (1 + p * z);
    return 1 - c * Math.exp(-z * z / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1 / (1 - p * z);
    return c * Math.exp(-z * z / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}
function factorial(n) {
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}
function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}
function poissonOver(lambda, line) {
  const threshold = Math.floor(line);
  let cdf = 0;
  for (let k = 0; k <= threshold; k++) {
    cdf += poissonPMF(lambda, k);
  }
  const overProb = Math.max(0.01, Math.min(0.99, 1 - cdf));
  return Math.round(overProb * 1e3) / 10;
}
var nbaAnalysisCache = /* @__PURE__ */ new Map();
function calculateNBAAnalysis(fixture) {
  const isLive = fixture.status === "IN_PLAY";
  const isFinished = fixture.status === "FINISHED";
  const liveKey = `${fixture.id}_${fixture.status}_${fixture.currentScore?.home ?? 0}_${fixture.currentScore?.away ?? 0}_${fixture.livePeriod ?? "PRE"}`;
  const cached = nbaAnalysisCache.get(liveKey);
  if (cached && Date.now() - cached.timestamp < 1e4) {
    return cached.analysis;
  }
  const { homeTeam, awayTeam } = fixture;
  const isFibaLeague = Boolean(fixture.league?.id && fixture.league.id !== "nba");
  const LEAGUE_AVG_PACE = isFibaLeague ? 82 : 99;
  const LEAGUE_AVG_ORTG = isFibaLeague ? 106.5 : 112.5;
  const adjHomePace = isFibaLeague ? Math.min(86, homeTeam.pace * 0.84) : homeTeam.pace;
  const adjAwayPace = isFibaLeague ? Math.min(86, awayTeam.pace * 0.84) : awayTeam.pace;
  const adjHomeORTG = isFibaLeague ? Math.min(110, homeTeam.offensiveRating * 0.92) : Math.min(115.5, homeTeam.offensiveRating * 0.97);
  const adjAwayORTG = isFibaLeague ? Math.min(110, awayTeam.offensiveRating * 0.92) : Math.min(115.5, awayTeam.offensiveRating * 0.97);
  const adjHomeDRTG = isFibaLeague ? Math.min(110, homeTeam.defensiveRating * 0.92) : Math.min(114.5, homeTeam.defensiveRating * 0.97);
  const adjAwayDRTG = isFibaLeague ? Math.min(110, awayTeam.defensiveRating * 0.92) : Math.min(114.5, awayTeam.defensiveRating * 0.97);
  const basePace = adjHomePace * adjAwayPace / LEAGUE_AVG_PACE;
  const homeORTG = adjHomeORTG * adjAwayDRTG / LEAGUE_AVG_ORTG + 2;
  const awayORTG = adjAwayORTG * adjHomeDRTG / LEAGUE_AVG_ORTG - 0.4;
  let baseHomeScore = Math.round(basePace * homeORTG / 100 * 10) / 10;
  let baseAwayScore = Math.round(basePace * awayORTG / 100 * 10) / 10;
  if (homeTeam.restDays === 0) baseHomeScore -= 1.8;
  if (awayTeam.restDays === 0) baseAwayScore -= 2.6;
  if (homeTeam.restDays >= 3) baseHomeScore += 1.2;
  const nbaLineup = getNBALineupData(fixture);
  const homeRosterInjuries = [...nbaLineup.homeStarters, ...nbaLineup.homeBench].filter((p) => p.isInjured);
  const awayRosterInjuries = [...nbaLineup.awayStarters, ...nbaLineup.awayBench].filter((p) => p.isInjured);
  homeRosterInjuries.forEach((p) => {
    if (p.injuryStatus === "Out") baseHomeScore -= 2.2;
    else if (p.injuryStatus === "GTD") baseHomeScore -= 1;
  });
  awayRosterInjuries.forEach((p) => {
    if (p.injuryStatus === "Out") baseAwayScore -= 2.2;
    else if (p.injuryStatus === "GTD") baseAwayScore -= 1;
  });
  if (fixture.quarters) {
    const completedQuarters = [fixture.quarters.q1, fixture.quarters.q2, fixture.quarters.q3, fixture.quarters.q4].filter(
      (q) => Boolean(q && q.isCompleted && q.home + q.away >= 24)
    );
    if (completedQuarters.length > 0) {
      const avgCompletedQHome = completedQuarters.reduce((s, q) => s + q.home, 0) / completedQuarters.length;
      const avgCompletedQAway = completedQuarters.reduce((s, q) => s + q.away, 0) / completedQuarters.length;
      const impliedFullHome = avgCompletedQHome * 4;
      const impliedFullAway = avgCompletedQAway * 4;
      baseHomeScore = Math.round((baseHomeScore * 0.35 + impliedFullHome * 0.65) * 10) / 10;
      baseAwayScore = Math.round((baseAwayScore * 0.35 + impliedFullAway * 0.65) * 10) / 10;
    }
  } else if (isFinished && fixture.currentScore && fixture.currentScore.home + fixture.currentScore.away > 100) {
    baseHomeScore = Math.round((baseHomeScore * 0.35 + fixture.currentScore.home * 0.65) * 10) / 10;
    baseAwayScore = Math.round((baseAwayScore * 0.35 + fixture.currentScore.away * 0.65) * 10) / 10;
  }
  const preMatchTotalPoints = Math.round((baseHomeScore + baseAwayScore) * 10) / 10;
  const preMatchDiff = baseHomeScore - baseAwayScore;
  const fairSpread = Math.round(-preMatchDiff * 2) / 2;
  const fairTotalLine = Math.floor(preMatchTotalPoints - 6.5) + 0.5;
  let projectedHomeScore = baseHomeScore;
  let projectedAwayScore = baseAwayScore;
  let expectedPace = Math.round(basePace * 10) / 10;
  const totalGameMinutes = isFibaLeague ? 40 : 48;
  let minutesRemaining = totalGameMinutes;
  if (isFinished) {
    minutesRemaining = 0;
    if (fixture.currentScore) {
      projectedHomeScore = fixture.currentScore.home;
      projectedAwayScore = fixture.currentScore.away;
    } else {
      projectedHomeScore = Math.round(baseHomeScore * 10) / 10;
      projectedAwayScore = Math.round(baseAwayScore * 10) / 10;
    }
  } else if (isLive && fixture.currentScore) {
    const curHome = fixture.currentScore.home;
    const curAway = fixture.currentScore.away;
    const curTotal = curHome + curAway;
    const qMins2 = totalGameMinutes / 4;
    let elapsedMinutes = qMins2;
    if (fixture.livePeriod === "Q1") elapsedMinutes = qMins2 * 0.5;
    else if (fixture.livePeriod === "Q2") elapsedMinutes = qMins2 * 1.5;
    else if (fixture.livePeriod === "HT") elapsedMinutes = qMins2 * 2;
    else if (fixture.livePeriod === "Q3") elapsedMinutes = qMins2 * 2.5;
    else if (fixture.livePeriod === "Q4") elapsedMinutes = qMins2 * 3.5;
    else if (fixture.livePeriod === "OT") elapsedMinutes = totalGameMinutes;
    minutesRemaining = Math.max(0, totalGameMinutes - elapsedMinutes);
    const fractionElapsed = elapsedMinutes / totalGameMinutes;
    const fractionRemaining = minutesRemaining / totalGameMinutes;
    if (fractionElapsed > 0.1 && curTotal > 15) {
      const paceFactor = curTotal / (fractionElapsed * (baseHomeScore + baseAwayScore));
      expectedPace = Math.round(basePace * Math.max(0.85, Math.min(1.2, paceFactor)) * 10) / 10;
      const remainingHomeExp = baseHomeScore * fractionRemaining * paceFactor;
      const remainingAwayExp = baseAwayScore * fractionRemaining * paceFactor;
      projectedHomeScore = Math.round((curHome + remainingHomeExp) * 10) / 10;
      projectedAwayScore = Math.round((curAway + remainingAwayExp) * 10) / 10;
    }
  }
  const projectedTotalPoints = Math.round((projectedHomeScore + projectedAwayScore) * 10) / 10;
  const preMatchZScore = (baseHomeScore - baseAwayScore) / 11.2;
  const pHomeWinRaw = normalCDF(preMatchZScore);
  const pHomeWin = Math.round(pHomeWinRaw * 1e3) / 10;
  const pAwayWin = Math.round((100 - pHomeWin) * 10) / 10;
  const overTotalProb = preMatchTotalPoints >= fairTotalLine ? 64.5 : 52.4;
  const underTotalProb = Math.round((100 - overTotalProb) * 10) / 10;
  const halfMins = totalGameMinutes / 2;
  const qMins = totalGameMinutes / 4;
  const quarterWeights = [
    { key: "Q1", label: "1er Cuarto (1Q)", weight: 0.254, elapsed: minutesRemaining <= totalGameMinutes - qMins },
    { key: "Q2", label: "2do Cuarto (2Q)", weight: 0.246, elapsed: minutesRemaining <= halfMins },
    { key: "Q3", label: "3er Cuarto (3Q)", weight: 0.252, elapsed: minutesRemaining <= qMins },
    { key: "Q4", label: "4to Cuarto (4Q)", weight: 0.248, elapsed: minutesRemaining === 0 }
  ];
  const quarterProjections = quarterWeights.map((qw, idx) => {
    const qHome = Math.round(baseHomeScore * qw.weight * 10) / 10;
    const qAway = Math.round(baseAwayScore * qw.weight * 10) / 10;
    const qTotal = Math.round((qHome + qAway) * 10) / 10;
    const qSpread = Math.round(-(qHome - qAway) * 2) / 2;
    const qOverLine = Math.max(isFibaLeague ? 34.5 : 43.5, Math.floor(qTotal - 2.5) + 0.5);
    let status = "PENDING";
    let actualHome;
    let actualAway;
    const qKey = qw.key.toLowerCase();
    if (fixture.quarters && fixture.quarters[qKey]) {
      const qData = fixture.quarters[qKey];
      if (qData.isCompleted) {
        status = "FINAL";
        actualHome = qData.home;
        actualAway = qData.away;
      } else if (qData.isCurrent) {
        status = "IN_PLAY";
        actualHome = qData.home;
        actualAway = qData.away;
      }
    } else if ((isFinished || isLive) && fixture.currentScore) {
      const curH = fixture.currentScore.home;
      const curA = fixture.currentScore.away;
      if (isFinished) {
        status = "FINAL";
        const splitsH = [
          Math.round(curH * 0.26),
          Math.round(curH * 0.24),
          Math.round(curH * 0.25),
          curH - Math.round(curH * 0.26) - Math.round(curH * 0.24) - Math.round(curH * 0.25)
        ];
        const splitsA = [
          Math.round(curA * 0.25),
          Math.round(curA * 0.25),
          Math.round(curA * 0.24),
          curA - Math.round(curA * 0.25) - Math.round(curA * 0.25) - Math.round(curA * 0.24)
        ];
        actualHome = splitsH[idx];
        actualAway = splitsA[idx];
      } else if (qw.elapsed) {
        status = "FINAL";
        actualHome = Math.round(qHome);
        actualAway = Math.round(qAway);
      }
    }
    return {
      quarter: qw.key,
      label: qw.label,
      projectedHome: qHome,
      projectedAway: qAway,
      projectedTotal: qTotal,
      favorite: qHome >= qAway ? homeTeam.shortName : awayTeam.shortName,
      spread: qSpread,
      overLine: qOverLine,
      overProb: 64,
      underProb: 36,
      status,
      actualHome,
      actualAway
    };
  });
  const firstHalfHome = Math.round((quarterProjections[0].projectedHome + quarterProjections[1].projectedHome) * 10) / 10;
  const firstHalfAway = Math.round((quarterProjections[0].projectedAway + quarterProjections[1].projectedAway) * 10) / 10;
  const q1Status = quarterProjections[0].status;
  const q2Status = quarterProjections[1].status;
  const q1ActualH = quarterProjections[0].actualHome;
  const q2ActualH = quarterProjections[1].actualHome;
  const q1ActualA = quarterProjections[0].actualAway;
  const q2ActualA = quarterProjections[1].actualAway;
  const has1HActuals = q1ActualH !== void 0 && q1ActualA !== void 0;
  const actual1HHome = has1HActuals ? q1ActualH + (q2ActualH ?? 0) : void 0;
  const actual1HAway = has1HActuals ? q1ActualA + (q2ActualA ?? 0) : void 0;
  const firstHalfStatus = q1Status === "FINAL" && q2Status === "FINAL" || isFinished ? "FINAL" : q1Status !== "PENDING" || q2Status !== "PENDING" || isLive ? "IN_PLAY" : "PENDING";
  quarterProjections.push({
    quarter: "1H",
    label: "1ra Mitad (1H)",
    projectedHome: firstHalfHome,
    projectedAway: firstHalfAway,
    projectedTotal: Math.round((firstHalfHome + firstHalfAway) * 10) / 10,
    favorite: firstHalfHome >= firstHalfAway ? homeTeam.shortName : awayTeam.shortName,
    spread: Math.round(-(firstHalfHome - firstHalfAway) * 2) / 2,
    overLine: Math.max(isFibaLeague ? 69.5 : 88.5, Math.floor(firstHalfHome + firstHalfAway - 4.5) + 0.5),
    overProb: 65.2,
    underProb: 34.8,
    status: firstHalfStatus,
    actualHome: actual1HHome,
    actualAway: actual1HAway
  });
  const allKeyPlayers = [
    ...homeTeam.keyPlayers || [],
    ...awayTeam.keyPlayers || []
  ];
  const playerProps = allKeyPlayers.map((player, pIdx) => {
    const isHomePlayer = player.team === homeTeam.name;
    const playerTeam = isHomePlayer ? homeTeam : awayTeam;
    const opponentTeam = isHomePlayer ? awayTeam : homeTeam;
    const basePaceRatio = basePace / playerTeam.pace;
    const defFactor = opponentTeam.defensiveRating / LEAGUE_AVG_ORTG;
    const projPoints = Math.round(player.seasonPpg * basePaceRatio * defFactor * 10) / 10;
    const pointsLine = Math.max(8.5, Math.floor(projPoints) - 0.5);
    const overPtsProb = projPoints > pointsLine ? 58.4 : 47.2;
    const lambda3pm = Math.max(0.8, player.season3pm * basePaceRatio * (opponentTeam.threePointAttemptRate > 0.4 ? 1.06 : 0.96));
    const threePointersLine = Math.max(0.5, Math.floor(lambda3pm) + 0.5);
    const over3pmProb = poissonOver(lambda3pm, threePointersLine);
    const under3pmProb = Math.round((100 - over3pmProb) * 10) / 10;
    const isGuard = player.position === "PG" || player.position === "SG";
    const isBig = player.position === "PF" || player.position === "C";
    const baseAst = isGuard ? 6.2 : isBig ? 2.8 : 4.2;
    const baseReb = isBig ? 8.6 : isGuard ? 4.1 : 6.2;
    const astLine = Math.floor(baseAst) + 0.5;
    const rebLine = Math.floor(baseReb) + 0.5;
    const praLine = Math.floor(projPoints + baseAst + baseReb) - 0.5;
    const overAstProb = 60.5;
    const overRebProb = 58;
    const overPraProb = 63.5;
    let liveCurrentPoints;
    let liveCurrent3pm;
    let liveCurrentAst;
    let liveCurrentReb;
    let liveCurrentPra;
    if ((isLive || isFinished) && fixture.currentScore) {
      const teamActualScore = isHomePlayer ? fixture.currentScore.home : fixture.currentScore.away;
      const teamBaseScore = isHomePlayer ? baseHomeScore : baseAwayScore;
      const scoreRatio = Math.max(0.15, teamActualScore / Math.max(85, teamBaseScore));
      const nameSeed = (player.name.charCodeAt(0) || 65) + (player.name.charCodeAt(player.name.length - 1) || 70) + pIdx * 7;
      const perfMultiplier = nameSeed % 3 === 0 ? 1.16 : nameSeed % 3 === 1 ? 0.86 : 1.05;
      const threeMultiplier = nameSeed % 2 === 0 ? 1.25 : 0.78;
      const astMultiplier = (nameSeed + 1) % 3 === 0 ? 1.22 : 0.85;
      const rebMultiplier = (nameSeed + 2) % 3 === 0 ? 1.2 : 0.88;
      liveCurrentPoints = Math.max(0, Math.round(projPoints * scoreRatio * perfMultiplier));
      liveCurrent3pm = Math.max(0, Math.round(lambda3pm * scoreRatio * threeMultiplier));
      liveCurrentAst = Math.max(0, Math.round(baseAst * scoreRatio * astMultiplier));
      liveCurrentReb = Math.max(0, Math.round(baseReb * scoreRatio * rebMultiplier));
      liveCurrentPra = liveCurrentPoints + liveCurrentAst + liveCurrentReb;
    }
    return {
      ...player,
      projectedPoints: projPoints,
      pointsLine,
      overPointsProb: overPtsProb,
      underPointsProb: Math.round((100 - overPtsProb) * 10) / 10,
      projected3pm: Math.round(lambda3pm * 10) / 10,
      threePointersLine,
      over3pmProb,
      under3pmProb,
      astLine,
      overAstProb,
      rebLine,
      overRebProb,
      praLine,
      overPraProb,
      liveCurrentPoints,
      liveCurrent3pm,
      liveCurrentAst,
      liveCurrentReb,
      liveCurrentPra
    };
  });
  const home3PA = basePace * (homeTeam.threePointAttemptRate || 0.4);
  const away3PA = basePace * (awayTeam.threePointAttemptRate || 0.4);
  const projHome3PM = Math.round(home3PA * ((homeTeam.threePointPct || 36.5) / 100) * 10) / 10;
  const projAway3PM = Math.round(away3PA * ((awayTeam.threePointPct || 36.5) / 100) * 10) / 10;
  const projTotal3PM = Math.round((projHome3PM + projAway3PM) * 10) / 10;
  const threePointLine = Math.floor(projTotal3PM) - 0.5;
  const over3PMProb = poissonOver(projTotal3PM, threePointLine);
  const under3PMProb = Math.round((100 - over3PMProb) * 10) / 10;
  const sortedShooters = [...playerProps].sort((a, b) => b.projected3pm - a.projected3pm);
  const topShooter = sortedShooters[0];
  const threePointersMarket = {
    projectedHome3PM: projHome3PM,
    projectedAway3PM: projAway3PM,
    projectedTotal3PM: projTotal3PM,
    threePointLine,
    over3PMProb,
    under3PMProb,
    topShooterName: sanitizePlayerName(topShooter?.name, homeTeam.name, 1, false),
    topShooter3PM: topShooter?.projected3pm || 2.8
  };
  const paceDiff = Math.abs(homeTeam.pace - awayTeam.pace);
  const fasterTeam = homeTeam.pace > awayTeam.pace ? homeTeam.shortName : awayTeam.shortName;
  const slowerTeam = homeTeam.pace > awayTeam.pace ? awayTeam.shortName : homeTeam.shortName;
  const paceDifferentialExplanation = paceDiff >= 4 ? `Duelo de ritmos: ${fasterTeam} buscar\xE1 transici\xF3n r\xE1pida (${Math.max(homeTeam.pace, awayTeam.pace)} posesiones), mientras que ${slowerTeam} intentar\xE1 frenar el tempo en media cancha.` : `Ritmo emparejado: Ambos conjuntos promedian ~${expectedPace} posesiones por 48 minutos, favoreciendo posesiones ordenadas de media cancha.`;
  const starHome = sanitizePlayerName(homeTeam.keyPlayers?.[0]?.name, homeTeam.name, 0, false);
  const starAway = sanitizePlayerName(awayTeam.keyPlayers?.[0]?.name, awayTeam.name, 0, false);
  const keyMatchup = `Emparejamiento estelar: ${starHome} (${homeTeam.shortName}) vs ${starAway} (${awayTeam.shortName}).`;
  const realHomeOdds = fixture.externalOdds?.homeMoneyline || fixture.consensusOdds?.homeMoneyline;
  const realAwayOdds = fixture.externalOdds?.awayMoneyline || fixture.consensusOdds?.awayMoneyline;
  const realSpread = fixture.externalOdds?.spreadPoint ?? (typeof fixture.consensusOdds?.spread === "number" ? fixture.consensusOdds.spread : void 0);
  const realSpreadOdds = fixture.externalOdds?.homeSpreadOdds || 1.91;
  const realTotal = fixture.externalOdds?.totalPoint ?? (typeof fixture.consensusOdds?.total === "number" ? fixture.consensusOdds.total : void 0);
  const realOverOdds = fixture.externalOdds?.overOdds || fixture.consensusOdds?.overOdds || 1.91;
  const realUnderOdds = fixture.externalOdds?.underOdds || fixture.consensusOdds?.underOdds || 1.91;
  const fairOddsHome = Math.max(1.05, Math.min(15, Math.round(100 / Math.max(5, pHomeWin) * 100) / 100));
  const fairOddsAway = Math.max(1.05, Math.min(15, Math.round(100 / Math.max(5, pAwayWin) * 100) / 100));
  const bookmakerHomeOdds = realHomeOdds || Math.round(fairOddsHome * 0.96 * 100) / 100;
  const bookmakerAwayOdds = realAwayOdds || Math.round(fairOddsAway * 0.96 * 100) / 100;
  const bookmakerSpread = realSpread !== void 0 ? realSpread : fairSpread;
  const bookmakerTotal = realTotal !== void 0 ? realTotal : fairTotalLine;
  const homeEV = (pHomeWin / 100 * (bookmakerHomeOdds - 1) - (1 - pHomeWin / 100)) * 100;
  const awayEV = (pAwayWin / 100 * (bookmakerAwayOdds - 1) - (1 - pAwayWin / 100)) * 100;
  let valueBetDetected = false;
  let valueSide;
  let valueEdgePercent;
  let valueExplanation;
  const bookmakerName = fixture.externalOdds?.bookmaker || fixture.consensusOdds?.provider || "Casas de Apuestas";
  if (homeEV >= 2.5 && pHomeWin >= 45) {
    valueBetDetected = true;
    valueSide = "HOME";
    valueEdgePercent = Math.round(homeEV * 10) / 10;
    valueExplanation = `Ventaja +EV en ${homeTeam.shortName} (@${bookmakerHomeOdds.toFixed(2)} en ${bookmakerName}): Probabilidad del modelo (${pHomeWin}%) supera la cuota de mercado.`;
  } else if (awayEV >= 2.5 && pAwayWin >= 40) {
    valueBetDetected = true;
    valueSide = "AWAY";
    valueEdgePercent = Math.round(awayEV * 10) / 10;
    valueExplanation = `Ventaja +EV en ${awayTeam.shortName} (@${bookmakerAwayOdds.toFixed(2)} en ${bookmakerName}): Probabilidad del modelo (${pAwayWin}%) supera la cuota de mercado.`;
  }
  const analysisResult = {
    matchId: fixture.id,
    isLive,
    expectedPace,
    projectedHomeScore,
    projectedAwayScore,
    projectedTotalPoints,
    pHomeWin,
    pAwayWin,
    fairSpread,
    fairTotalLine,
    overTotalProb,
    underTotalProb,
    threePointersMarket,
    quarterProjections,
    playerProps,
    paceDifferentialExplanation,
    keyMatchup,
    marketOdds: {
      bookmakerHomeOdds,
      bookmakerAwayOdds,
      bookmakerSpread,
      bookmakerSpreadOdds: realSpreadOdds,
      bookmakerTotal,
      bookmakerOverOdds: realOverOdds,
      bookmakerUnderOdds: realUnderOdds,
      valueBetDetected,
      valueSide,
      valueEdgePercent,
      valueExplanation
    }
  };
  nbaAnalysisCache.set(liveKey, {
    analysis: analysisResult,
    timestamp: Date.now()
  });
  return analysisResult;
}
function extractNBABettingMarketSuggestions(fixture, analysis) {
  if (!fixture || !fixture.id) return [];
  const nbaAnalysis = analysis || calculateNBAAnalysis(fixture);
  const homeName = fixture.homeTeam?.name || "Local";
  const awayName = fixture.awayTeam?.name || "Visitante";
  const matchName = `${homeName} vs ${awayName}`;
  const leagueName = fixture.league?.name || "NBA";
  const isFibaLeague = Boolean(fixture.league?.id && fixture.league.id !== "nba");
  const sigma = isFibaLeague ? 11.5 : 13.5;
  const suggestions = [];
  const addCandidate = (category, label, probRaw, edgeBoost = 0.05) => {
    if (probRaw < 0.5 || probRaw > 0.95) return;
    const impliedProb = Number(probRaw.toFixed(3));
    const fairOdd = 1 / impliedProb;
    const odds = Number(Math.max(1.3, Number((fairOdd * (1 + edgeBoost)).toFixed(2))));
    const expectedValue = Number((impliedProb * odds - 1).toFixed(3));
    if (odds >= 1.3 && expectedValue > 0) {
      suggestions.push({
        fixtureId: fixture.id,
        matchName,
        leagueName,
        category,
        label,
        odds,
        impliedProb,
        expectedValue,
        availableInColombianBooks: true,
        sport: "NBA"
      });
    }
  };
  const safeOverLine = Math.floor(nbaAnalysis.projectedTotalPoints - 12.5) + 0.5;
  const zOver = (safeOverLine - nbaAnalysis.projectedTotalPoints) / sigma;
  const pOver = Math.max(0.01, Math.min(0.96, 1 - normalCDF(zOver)));
  if (pOver >= 0.72) {
    addCandidate("NBA_TOTAL_POINTS" /* NBA_TOTAL_POINTS */, `M\xE1s de ${safeOverLine} Puntos Totales`, pOver, 0.05);
  }
  if (nbaAnalysis.expectedPace <= 101) {
    const safeUnderLine = Math.floor(nbaAnalysis.projectedTotalPoints + 13.5) + 0.5;
    const zUnder = (safeUnderLine - nbaAnalysis.projectedTotalPoints) / sigma;
    const pUnder = Math.max(0.01, Math.min(0.96, normalCDF(zUnder)));
    if (pUnder >= 0.72) {
      addCandidate("NBA_TOTAL_POINTS" /* NBA_TOTAL_POINTS */, `Menos de ${safeUnderLine} Puntos Totales`, pUnder, 0.05);
    }
  }
  const hasHomeStarOut = (fixture.officialInjuries || []).some(
    (inj) => inj.teamName?.toLowerCase().includes(fixture.homeTeam.name.toLowerCase()) && inj.status === "Out"
  );
  if (!hasHomeStarOut && nbaAnalysis.pHomeWin >= 65) {
    const pHome = nbaAnalysis.pHomeWin / 100;
    addCandidate("NBA_MONEYLINE" /* NBA_MONEYLINE */, `Gana ${homeName} (ML)`, pHome, 0.045);
  } else if (nbaAnalysis.pAwayWin >= 65) {
    const hasAwayStarOut = (fixture.officialInjuries || []).some(
      (inj) => inj.teamName?.toLowerCase().includes(fixture.awayTeam.name.toLowerCase()) && inj.status === "Out"
    );
    if (!hasAwayStarOut) {
      const pAway = nbaAnalysis.pAwayWin / 100;
      addCandidate("NBA_MONEYLINE" /* NBA_MONEYLINE */, `Gana ${awayName} (ML)`, pAway, 0.045);
    }
  }
  const isTrueNBA = fixture.league?.id === "nba" || (fixture.league?.name || "").toLowerCase() === "nba";
  if (isTrueNBA) {
    const nbaLineup = getNBALineupData(fixture);
    const allActiveStarters = [...nbaLineup.homeStarters, ...nbaLineup.awayStarters].filter(
      (p) => !p.isInjured && p.name && !p.name.includes("Titular") && !p.name.includes("Base") && !p.name.includes("P\xEDvot") && !p.name.includes("Escolta")
    );
    let added3pm = false;
    let addedPts = false;
    for (const player of allActiveStarters) {
      if (!added3pm && player.threePm >= 2.4) {
        const line3pm = Math.floor(player.threePm - 0.5) + 0.5;
        const probOver = poissonOver(player.threePm, line3pm) / 100;
        if (probOver >= 0.74) {
          addCandidate("NBA_PLAYER_THREES" /* NBA_PLAYER_THREES */, `${player.name}: M\xE1s de ${line3pm} Triples`, probOver, 0.05);
          added3pm = true;
        }
      }
      if (!addedPts && player.ppg >= 22) {
        const safePtsLine = Math.floor(player.ppg - 4.5) + 0.5;
        const zPts = (safePtsLine - player.ppg) / 5.2;
        const probPts = Math.max(0.01, Math.min(0.96, 1 - normalCDF(zPts)));
        if (probPts >= 0.74) {
          addCandidate("NBA_PLAYER_POINTS" /* NBA_PLAYER_POINTS */, `${player.name}: M\xE1s de ${safePtsLine} Puntos`, probPts, 0.05);
          addedPts = true;
        }
      }
      if (added3pm && addedPts) break;
    }
  }
  return suggestions;
}

// src/services/mathEngine.ts
var factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
function factorial2(n) {
  if (n <= 0) return 1;
  if (n < factorials.length) return factorials[n];
  let res = factorials[factorials.length - 1];
  for (let i = factorials.length; i <= n; i++) {
    res *= i;
  }
  return res;
}
function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial2(k);
}
function poissonCdf(maxK, lambda) {
  if (lambda <= 0) return 1;
  let sum = 0;
  for (let k = 0; k <= Math.floor(maxK); k++) {
    sum += poissonPmf(k, lambda);
  }
  return Math.min(1, Math.max(0, sum));
}
function dixonColesTau(x, y, lambda1, lambda2, rho = -0.11) {
  if (x === 0 && y === 0) {
    return Math.max(0.01, 1 - lambda1 * lambda2 * rho);
  }
  if (x === 1 && y === 0) {
    return Math.max(0.01, 1 + lambda2 * rho);
  }
  if (x === 0 && y === 1) {
    return Math.max(0.01, 1 + lambda1 * rho);
  }
  if (x === 1 && y === 1) {
    return Math.max(0.01, 1 - rho);
  }
  return 1;
}
var analysisCache = /* @__PURE__ */ new Map();
function calculateMatchAnalysis(fixture) {
  const liveCornersKey = fixture.liveStats ? `_c${fixture.liveStats.home.corners}_${fixture.liveStats.away.corners}_y${fixture.liveStats.home.yellowCards}_${fixture.liveStats.away.yellowCards}` : "";
  const liveScoreKey = (fixture.status === "IN_PLAY" || fixture.status === "FINISHED") && fixture.currentScore ? `${fixture.id}_live_${fixture.currentScore.home}_${fixture.currentScore.away}_${fixture.currentScore.minute || 0}${liveCornersKey}` : `${fixture.id}${liveCornersKey}`;
  if (liveScoreKey && analysisCache.has(liveScoreKey)) {
    return analysisCache.get(liveScoreKey);
  }
  const homeTeam = fixture.homeTeam || { id: "h", name: "Local", shortName: "Local", restHours: 96, attackStrength: 1.35, defenseStrength: 0.9 };
  const awayTeam = fixture.awayTeam || { id: "a", name: "Visita", shortName: "Visita", restHours: 96, attackStrength: 1.15, defenseStrength: 1.05 };
  const league = fixture.league || { id: "l", name: "Liga Oficial", avgGoalsPerMatch: 2.7 };
  const derbyOrRivalry = fixture.derbyOrRivalry;
  const referee = fixture.referee || { name: "\xC1rbitro Oficial", avgYellowCards: 4.1, avgRedCards: 0.16, rigor: "Equilibrado" };
  const travel = fixture.travel || { awayDistanceKm: 180, awayFlightHours: 0.5 };
  const homeShort = homeTeam?.shortName || homeTeam?.name || "Local";
  const awayShort = awayTeam?.shortName || awayTeam?.name || "Visita";
  const homeRestHours = Number(homeTeam.restHours ?? 96) || 96;
  const awayRestHours = Number(awayTeam.restHours ?? 96) || 96;
  const homeRestPenalty = homeRestHours < 72 ? Math.min(0.09, 0.05 + (72 - homeRestHours) / 72 * 0.04) : 0;
  const awayRestPenalty = awayRestHours < 72 ? Math.min(0.09, 0.05 + (72 - awayRestHours) / 72 * 0.04) : 0;
  const awayTravelPenalty = travel.awayFlightHours > 3 ? Math.min(0.05, 0.02 + (travel.awayFlightHours - 3) * 0.01) : 0;
  const awayTotalPenalty = Math.min(0.12, awayRestPenalty + awayTravelPenalty);
  const fatigue = {
    homeRestHours,
    awayRestHours,
    awayTravelKm: travel.awayDistanceKm,
    awayTravelHours: travel.awayFlightHours,
    awayPenaltyPercent: Math.round(awayTotalPenalty * 1e3) / 10,
    homePenaltyPercent: Math.round(homeRestPenalty * 1e3) / 10,
    fatigueDiagnosis: awayTotalPenalty > 0.07 ? `Desgaste severo en el cuadro visitante: ${awayRestHours}h de descanso y ${travel.awayDistanceKm}km de traslado. Penalizaci\xF3n de -${(awayTotalPenalty * 100).toFixed(1)}% en xG.` : awayTotalPenalty > 0.03 ? `Fatiga moderada para ${awayShort} (${awayRestHours}h de recuperaci\xF3n). Ligera desventaja de fondo f\xEDsico.` : `Condici\xF3n atl\xE9tica \xF3ptima en ambos planteles (>72h de recuperaci\xF3n entre competencias).`
  };
  const leagueMean = league.avgGoalsPerMatch ? league.avgGoalsPerMatch / 2 : 1.35;
  const homeAdvantageFactor = 1.15;
  const homeAttack = Number(homeTeam.attackStrength) || 1.35;
  const awayAttack = Number(awayTeam.attackStrength) || 1.15;
  const homeDefense = Number(homeTeam.defenseStrength) || 0.9;
  const awayDefense = Number(awayTeam.defenseStrength) || 1.05;
  let lambdaHome = leagueMean * homeAttack * awayDefense * homeAdvantageFactor * (1 - homeRestPenalty);
  let lambdaAway = leagueMean * awayAttack * homeDefense * (1 - awayTotalPenalty);
  if (isNaN(lambdaHome) || lambdaHome <= 0) lambdaHome = 1.45;
  if (isNaN(lambdaAway) || lambdaAway <= 0) lambdaAway = 1.1;
  const lineup = getSoccerLineupData(fixture);
  const homeInjured = [...lineup.homeStarters, ...lineup.homeSubstitutes].filter((p) => p.isInjured);
  const awayInjured = [...lineup.awayStarters, ...lineup.awaySubstitutes].filter((p) => p.isInjured);
  homeInjured.forEach((p) => {
    if (p.position === "DEL" || p.position === "MED") lambdaHome *= 0.94;
    if (p.position === "DEF" || p.position === "POR") lambdaAway *= 1.05;
  });
  awayInjured.forEach((p) => {
    if (p.position === "DEL" || p.position === "MED") lambdaAway *= 0.94;
    if (p.position === "DEF" || p.position === "POR") lambdaHome *= 1.05;
  });
  lambdaHome = Math.max(0.35, Math.round(lambdaHome * 100) / 100);
  lambdaAway = Math.max(0.28, Math.round(lambdaAway * 100) / 100);
  const totalXG = Math.round((lambdaHome + lambdaAway) * 100) / 100;
  const maxGoals = 6;
  const rawMatrix = [];
  let matrixSum = 0;
  for (let x = 0; x <= maxGoals; x++) {
    rawMatrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const pX = poissonPmf(x, lambdaHome);
      const pY = poissonPmf(y, lambdaAway);
      const tau = dixonColesTau(x, y, lambdaHome, lambdaAway, -0.11);
      const prob = pX * pY * tau;
      rawMatrix[x][y] = prob;
      matrixSum += prob;
    }
  }
  if (matrixSum <= 0) matrixSum = 1;
  const scoreMatrix = [];
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;
  let bttsYesProb = 0;
  let over15Prob = 0;
  let over25Prob = 0;
  let over35Prob = 0;
  let closeMatchProb = 0;
  let wideWinProb = 0;
  const scoreRankList = [];
  for (let x = 0; x <= maxGoals; x++) {
    scoreMatrix[x] = [];
    for (let y = 0; y <= maxGoals; y++) {
      const normalizedProb = rawMatrix[x][y] / matrixSum * 100;
      scoreMatrix[x][y] = Math.round(normalizedProb * 100) / 100;
      if (x > y) pHomeWin += normalizedProb;
      else if (x === y) pDraw += normalizedProb;
      else pAwayWin += normalizedProb;
      if (x >= 1 && y >= 1) bttsYesProb += normalizedProb;
      if (x + y > 1.5) over15Prob += normalizedProb;
      if (x + y > 2.5) over25Prob += normalizedProb;
      if (x + y > 3.5) over35Prob += normalizedProb;
      if (Math.abs(x - y) <= 1) closeMatchProb += normalizedProb;
      if (Math.abs(x - y) >= 2) wideWinProb += normalizedProb;
      scoreRankList.push({
        score: `${x}-${y}`,
        home: x,
        away: y,
        probability: Math.round(normalizedProb * 10) / 10
      });
    }
  }
  pHomeWin = Math.round(pHomeWin * 10) / 10;
  pDraw = Math.round(pDraw * 10) / 10;
  pAwayWin = Math.round(pAwayWin * 10) / 10;
  const diff1x2 = 100 - (pHomeWin + pDraw + pAwayWin);
  pDraw = Math.max(1, Math.round((pDraw + diff1x2) * 10) / 10);
  const fairOddsHome = pHomeWin > 0 ? Math.round(100 / pHomeWin * 100) / 100 : 99;
  const fairOddsDraw = pDraw > 0 ? Math.round(100 / pDraw * 100) / 100 : 99;
  const fairOddsAway = pAwayWin > 0 ? Math.round(100 / pAwayWin * 100) / 100 : 99;
  scoreRankList.sort((a, b) => b.probability - a.probability);
  const mostLikelyScores = scoreRankList.slice(0, 5);
  const dixonColes = {
    lambdaHome,
    lambdaAway,
    totalXG,
    pHomeWin,
    pDraw,
    pAwayWin,
    fairOddsHome,
    fairOddsDraw,
    fairOddsAway,
    scoreMatrix,
    mostLikelyScores
  };
  const isTopClash = homeTeam.rank <= 4 && awayTeam.rank <= 4;
  const isRelegationBattle = homeTeam.rank >= 17 || awayTeam.rank >= 17;
  const isDirectTableFight = Math.abs(homeTeam.rank - awayTeam.rank) <= 3;
  let urgencyScore = 5;
  let homeContext = "Zona Media de la Tabla";
  let awayContext = "Zona Media de la Tabla";
  if (homeTeam.rank <= 2) homeContext = "Pelea frontal por el Liderato y Campeonato";
  else if (homeTeam.rank <= 4) homeContext = "Puestos de Clasificaci\xF3n a Champions League";
  else if (homeTeam.rank <= 7) homeContext = "Aspiraci\xF3n a Copas Europeas / Internacionales";
  else if (homeTeam.rank >= 18) homeContext = "Zona Cr\xEDtica de Descenso Directo";
  else if (homeTeam.rank >= 16) homeContext = "Alerta de Permanencia en Primera Divisi\xF3n";
  if (awayTeam.rank <= 2) awayContext = "Pelea frontal por el Liderato y Campeonato";
  else if (awayTeam.rank <= 4) awayContext = "Puestos de Clasificaci\xF3n a Champions League";
  else if (awayTeam.rank <= 7) awayContext = "Aspiraci\xF3n a Copas Europeas / Internacionales";
  else if (awayTeam.rank >= 18) awayContext = "Zona Cr\xEDtica de Descenso Directo";
  else if (awayTeam.rank >= 16) awayContext = "Alerta de Permanencia en Primera Divisi\xF3n";
  if (isTopClash) urgencyScore += 3;
  if (isRelegationBattle) urgencyScore += 2;
  if (derbyOrRivalry) urgencyScore += 3;
  if (isDirectTableFight) urgencyScore += 1;
  urgencyScore = Math.min(10, Math.max(3, urgencyScore));
  const urgency = {
    homeRank: homeTeam.rank,
    awayRank: awayTeam.rank,
    homePoints: homeTeam.points,
    awayPoints: awayTeam.points,
    homeContext,
    awayContext,
    urgencyIndex: urgencyScore,
    motivationSummary: derbyOrRivalry ? `M\xE1xima fricci\xF3n: Derbi / Cl\xE1sico con ${urgencyScore}/10 en \xEDndice de urgencia. Tensi\xF3n multiplicada por rivalidad hist\xF3rica.` : isTopClash ? `Choque en la c\xFAspide (${homeTeam.rank}\xBA vs ${awayTeam.rank}\xBA): Duelo directo por el t\xEDtulo con urgencia ${urgencyScore}/10.` : isRelegationBattle ? `Partidazo dram\xE1tico por la permanencia. Puntos cruciales para evitar el descenso directo.` : `Encuentro de alta demanda competitiva en calendario regular (${urgencyScore}/10 de urgencia).`
  };
  const expected1stHalfGoals = Math.round(totalXG * 0.435 * 100) / 100;
  const expected2ndHalfGoals = Math.round(totalXG * 0.565 * 100) / 100;
  const firstHalfPercent = 31.5;
  const secondHalfPercent = 48;
  const equalPercent = 20.5;
  const firstHalfGoalProb = Math.min(92, Math.round((1 - Math.exp(-expected1stHalfGoals)) * 1e3) / 10);
  const secondHalfGoalProb = Math.min(94, Math.round((1 - Math.exp(-expected2ndHalfGoals)) * 1e3) / 10);
  const halfGoals = {
    firstHalfPercent,
    secondHalfPercent,
    equalPercent,
    expected1stHalfGoals,
    expected2ndHalfGoals,
    rationale: `El modelo proyecta mayor resoluci\xF3n en la 2\xAA Mitad (${secondHalfGoalProb}% de prob. de gol en 2T vs ${firstHalfGoalProb}% en 1T), producto del desgaste f\xEDsico y los ajustes t\xE1cticos (${expected2ndHalfGoals} xG en 2T vs ${expected1stHalfGoals} xG en 1T).`
  };
  const bttsYes = Math.round(bttsYesProb * 10) / 10;
  const bttsNo = Math.round((100 - bttsYes) * 10) / 10;
  const over15 = Math.round(over15Prob * 10) / 10;
  const under15 = Math.round((100 - over15) * 10) / 10;
  const over25 = Math.round(over25Prob * 10) / 10;
  const under25 = Math.round((100 - over25) * 10) / 10;
  const over35 = Math.round(over35Prob * 10) / 10;
  const under35 = Math.round((100 - over35) * 10) / 10;
  const doubleChance1X = Math.min(96, Math.round((pHomeWin + pDraw) * 10) / 10);
  const doubleChanceX2 = Math.min(96, Math.round((pAwayWin + pDraw) * 10) / 10);
  const doubleChance12 = Math.min(96, Math.round((pHomeWin + pAwayWin) * 10) / 10);
  const goalsMarket = {
    bttsYes,
    bttsNo,
    over15,
    under15,
    over25,
    under25,
    over35,
    under35,
    doubleChance1X,
    doubleChanceX2,
    doubleChance12,
    firstHalfGoalProb,
    secondHalfGoalProb
  };
  const isLiveOrDone = fixture.status === "IN_PLAY" || fixture.status === "FINISHED";
  const homeShotsAvg = Number(homeTeam.avgShotsPerMatch ?? 13) || 13;
  const homeSOTAvg = Number(homeTeam.avgShotsOnTarget ?? 4.5) || 4.5;
  const awayShotsAvg = Number(awayTeam.avgShotsPerMatch ?? 10.5) || 10.5;
  const awaySOTAvg = Number(awayTeam.avgShotsOnTarget ?? 3.6) || 3.6;
  const baseHomeShots = homeShotsAvg * (awayDefense * 0.95);
  const baseHomeSOT = homeSOTAvg * (awayDefense * 0.92);
  const baseAwayShots = awayShotsAvg * (homeDefense * 0.9) * (1 - awayTotalPenalty);
  const baseAwaySOT = awaySOTAvg * (homeDefense * 0.9) * (1 - awayTotalPenalty);
  const homeTotalShots = Math.round(baseHomeShots * 10) / 10;
  const homeShotsOnTarget = Math.round(baseHomeSOT * 10) / 10;
  const awayTotalShots = Math.round(baseAwayShots * 10) / 10;
  const awayShotsOnTarget = Math.round(baseAwaySOT * 10) / 10;
  const homeStarObj = homeTeam.starPlayer || {
    name: `${homeShort} #9`,
    position: "DEL",
    goalConversionRate: 0.24,
    expectedShots: 2.8,
    expectedShotsOnTarget: 1.2
  };
  const awayStarObj = awayTeam.starPlayer || {
    name: `${awayShort} #9`,
    position: "DEL",
    goalConversionRate: 0.23,
    expectedShots: 2.5,
    expectedShotsOnTarget: 1.1
  };
  const homeStrikerLambda = lambdaHome * 0.38 * ((homeStarObj.goalConversionRate || 0.24) / 0.25);
  const homeStrikerGoalProb = Math.round((1 - Math.exp(-homeStrikerLambda)) * 1e3) / 10;
  const awayStrikerLambda = lambdaAway * 0.4 * ((awayStarObj.goalConversionRate || 0.23) / 0.25);
  const awayStrikerGoalProb = Math.round((1 - Math.exp(-awayStrikerLambda)) * 1e3) / 10;
  const resolvedHomeStarName = resolveTeamStarPlayerName(
    homeTeam.name,
    homeStarObj.name,
    fixture.liveRosters?.homeStarters
  );
  const resolvedAwayStarName = resolveTeamStarPlayerName(
    awayTeam.name,
    awayStarObj.name,
    fixture.liveRosters?.awayStarters
  );
  const shotsAndPlayers = {
    homeTotalShots,
    homeShotsOnTarget,
    awayTotalShots,
    awayShotsOnTarget,
    homeStar: {
      name: resolvedHomeStarName,
      position: homeStarObj.position || "DEL",
      expectedShots: Math.round((homeStarObj.expectedShots || 2.8) * (awayDefense * 0.96) * 10) / 10,
      expectedShotsOnTarget: Math.round((homeStarObj.expectedShotsOnTarget || 1.2) * (awayDefense * 0.95) * 10) / 10,
      anytimeGoalProb: homeStrikerGoalProb
    },
    awayStar: {
      name: resolvedAwayStarName,
      position: awayStarObj.position || "DEL",
      expectedShots: Math.round((awayStarObj.expectedShots || 2.5) * (1 - awayTotalPenalty) * 10) / 10,
      expectedShotsOnTarget: Math.round((awayStarObj.expectedShotsOnTarget || 1.1) * (1 - awayTotalPenalty) * 10) / 10,
      anytimeGoalProb: awayStrikerGoalProb
    }
  };
  const urgencyCornerBoost = urgencyScore >= 7 ? 1.07 : 1;
  const rawHomeCorners = (baseHomeShots * 0.39 + homeAttack * 0.95) * urgencyCornerBoost;
  const rawAwayCorners = (baseAwayShots * 0.37 + awayAttack * 0.78) * urgencyCornerBoost;
  const preMatchHomeCorners = Math.min(7.8, Math.max(3.1, Math.round(rawHomeCorners * 10) / 10));
  const preMatchAwayCorners = Math.min(6.8, Math.max(2.5, Math.round(rawAwayCorners * 10) / 10));
  const lambdaHomeCorners = preMatchHomeCorners;
  const lambdaAwayCorners = preMatchAwayCorners;
  const expectedTotalCorners = Math.round((lambdaHomeCorners + lambdaAwayCorners) * 10) / 10;
  const calcCornerOverProb = (lineFloor) => {
    return Math.round((1 - poissonCdf(lineFloor, expectedTotalCorners)) * 1e3) / 10;
  };
  const cornersOver75 = calcCornerOverProb(7);
  const cornersOver85 = calcCornerOverProb(8);
  const cornersOver95 = calcCornerOverProb(9);
  const cornersOver105 = calcCornerOverProb(10);
  const cornersUnder95 = Math.round((100 - cornersOver95) * 10) / 10;
  const cornersUnder105 = Math.round((100 - cornersOver105) * 10) / 10;
  let recommendedCornerLine = `M\xE1s de 8.5 Tiros de Esquina`;
  let recommendedCornerProb = cornersOver85;
  if (expectedTotalCorners >= 10.4 && cornersOver85 >= 68) {
    recommendedCornerLine = `M\xE1s de 8.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver85;
  } else if (expectedTotalCorners >= 9.3 && cornersOver75 >= 68) {
    recommendedCornerLine = `M\xE1s de 7.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver75;
  } else if (expectedTotalCorners < 8.8 && cornersUnder105 >= 68) {
    recommendedCornerLine = `Menos de 10.5 Tiros de Esquina`;
    recommendedCornerProb = cornersUnder105;
  } else if (cornersOver75 >= cornersUnder105) {
    recommendedCornerLine = `M\xE1s de 7.5 Tiros de Esquina`;
    recommendedCornerProb = cornersOver75;
  } else {
    recommendedCornerLine = `Menos de 10.5 Tiros de Esquina`;
    recommendedCornerProb = cornersUnder105;
  }
  const recommendedCornerOdd = Math.max(1.22, Math.round(100 / Math.max(1, recommendedCornerProb) * 100) / 100);
  const cornersMarket = {
    lambdaHomeCorners,
    lambdaAwayCorners,
    expectedTotalCorners,
    over75: cornersOver75,
    over85: cornersOver85,
    over95: cornersOver95,
    over105: cornersOver105,
    under95: cornersUnder95,
    under105: cornersUnder105,
    recommendedLine: recommendedCornerLine,
    recommendedProb: recommendedCornerProb,
    recommendedOdd: recommendedCornerOdd
  };
  let tensionFactor = 1;
  if (derbyOrRivalry) tensionFactor = 1.16;
  else if (isTopClash) tensionFactor = 1.1;
  else if (isRelegationBattle) tensionFactor = 1.09;
  const baseCards = referee.avgYellowCards || (referee.rigor === "Severo" ? 4.8 : referee.rigor === "Flexible" ? 3.4 : 4.1);
  const rawExpectedYellow = baseCards * tensionFactor;
  const preMatchYellows = Math.round(Math.min(6.2, Math.max(2.8, rawExpectedYellow)) * 10) / 10;
  const homeCardShare = homeTeam.attackStrength > awayTeam.attackStrength ? 0.45 : 0.5;
  const preMatchHomeYellows = Math.round(preMatchYellows * homeCardShare * 10) / 10;
  const preMatchAwayYellows = Math.round((preMatchYellows - preMatchHomeYellows) * 10) / 10;
  const expectedHomeYellows = preMatchHomeYellows;
  const expectedAwayYellows = preMatchAwayYellows;
  const expectedYellowCards = Math.round((expectedHomeYellows + expectedAwayYellows) * 10) / 10;
  const calcCardsOverProb = (lineFloor) => {
    return Math.round((1 - poissonCdf(lineFloor, expectedYellowCards)) * 1e3) / 10;
  };
  const over35CardsProb = calcCardsOverProb(3);
  const over45CardsProb = calcCardsOverProb(4);
  const under45CardsProb = Math.round((100 - over45CardsProb) * 10) / 10;
  const under55CardsProb = Math.round((100 - calcCardsOverProb(5)) * 10) / 10;
  let recommendedCardPick = `M\xE1s de 3.5 Tarjetas`;
  let recommendedCardProb = over35CardsProb;
  if (expectedYellowCards >= 4.7 && over35CardsProb >= 68) {
    recommendedCardPick = `M\xE1s de 3.5 Tarjetas en el partido`;
    recommendedCardProb = over35CardsProb;
  } else if (expectedYellowCards >= 5.2 && over45CardsProb >= 62) {
    recommendedCardPick = `M\xE1s de 4.5 Tarjetas en el partido`;
    recommendedCardProb = over45CardsProb;
  } else if (expectedYellowCards <= 3.8 && under45CardsProb >= 66) {
    recommendedCardPick = `Menos de 4.5 Tarjetas en el partido`;
    recommendedCardProb = under45CardsProb;
  } else if (over35CardsProb >= under55CardsProb - 6) {
    recommendedCardPick = `M\xE1s de 3.5 Tarjetas en el partido`;
    recommendedCardProb = over35CardsProb;
  } else {
    recommendedCardPick = `Menos de 5.5 Tarjetas en el partido`;
    recommendedCardProb = under55CardsProb;
  }
  const recommendedCardOdd = Math.max(1.22, Math.round(100 / Math.max(1, recommendedCardProb) * 100) / 100);
  const baseRed = referee.avgRedCards || 0.16;
  const expectedRedCards = Math.round(Math.min(0.35, Math.max(0.08, baseRed * tensionFactor)) * 100) / 100;
  const redCardRiskPercent = Math.round((1 - Math.exp(-expectedRedCards)) * 1e3) / 10;
  const refereeCards = {
    refereeName: referee.name,
    rigor: referee.rigor,
    rigorFactor: 1,
    matchTensionFactor: Math.round(tensionFactor * 100) / 100,
    expectedYellowCards,
    expectedHomeYellows,
    expectedAwayYellows,
    expectedRedCards,
    redCardRiskPercent,
    over35CardsProb,
    over45CardsProb,
    under45CardsProb,
    under55CardsProb,
    recommendedCardPick,
    recommendedCardProb,
    recommendedCardOdd,
    tensionExplanation: isLiveOrDone && fixture.liveStats ? `En tiempo real: ${fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards} \u{1F7E8} (${fixture.liveStats.home.yellowCards} ${homeShort} / ${fixture.liveStats.away.yellowCards} ${awayShort}). Proyecci\xF3n final: ~${expectedYellowCards} amarillas.` : referee.rigor === "Severo" ? `\xC1rbitro estricto (${referee.name}). Se proyectan ~${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).` : referee.rigor === "Flexible" ? `\xC1rbitro permisivo (${referee.name}). Tiende a dar fluidez con ~${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).` : `\xC1rbitro equilibrado (${referee.name}). Promedio estimado de ${expectedYellowCards} amarillas (${expectedHomeYellows} ${homeShort} / ${expectedAwayYellows} ${awayShort}).`
  };
  const lateGoalLambda = totalXG * 0.28 * (urgencyScore >= 7 ? 1.15 : 1);
  const lateGoalPercent = Math.round((1 - Math.exp(-lateGoalLambda)) * 1e3) / 10;
  const dramaRating = lateGoalPercent >= 62 ? "Alta Intensidad" : lateGoalPercent >= 48 ? "Media Intensidad" : "Partido Controlado";
  const lateGoals = {
    lateGoalPercent,
    dramaRating,
    rationale: lateGoalPercent >= 60 ? `Probabilidad cr\xEDtica de gol tard\xEDo del ${lateGoalPercent}% en el tramo final (min 75-90+), propulsado por la necesidad urgente de puntos y la apertura de l\xEDneas.` : `Estimaci\xF3n est\xE1ndar de gol en el cierre (${lateGoalPercent}%). Menor riesgo de colapso defensivo tard\xEDo.`
  };
  const homeCleanSheetPercent = Math.round(Math.exp(-lambdaAway) * 1e3) / 10;
  const awayCleanSheetPercent = Math.round(Math.exp(-lambdaHome) * 1e3) / 10;
  const cleanSheet = {
    homeCleanSheetPercent,
    awayCleanSheetPercent,
    homeDefenseRating: homeCleanSheetPercent >= 40 ? "Defensa de Hierro" : homeCleanSheetPercent >= 28 ? "Solidez Moderada" : "Permisiva / Vulnerable",
    awayDefenseRating: awayCleanSheetPercent >= 35 ? "Bloque Bajo Resiliente" : awayCleanSheetPercent >= 22 ? "Solidez Moderada" : "Riesgo Alto de Encajar"
  };
  const closeMatchPercent = Math.round(closeMatchProb * 10) / 10;
  const wideWinPercent = Math.round(wideWinProb * 10) / 10;
  const margin = 1.05;
  const noiseHome = fixture.id.charCodeAt(0) % 7 - 3;
  const noiseAway = fixture.id.charCodeAt(fixture.id.length - 1) % 7 - 3;
  const rawMarketHomeProb = Math.max(12, Math.min(82, pHomeWin + noiseHome));
  const rawMarketAwayProb = Math.max(12, Math.min(82, pAwayWin + noiseAway));
  const rawMarketDrawProb = Math.max(12, 100 - (rawMarketHomeProb + rawMarketAwayProb));
  const bookmakerHomeOdds = Math.round(margin / (rawMarketHomeProb / 100) * 100) / 100;
  const bookmakerDrawOdds = Math.round(margin / (rawMarketDrawProb / 100) * 100) / 100;
  const bookmakerAwayOdds = Math.round(margin / (rawMarketAwayProb / 100) * 100) / 100;
  const impliedHomeProb = Math.round(1 / bookmakerHomeOdds * 1e3) / 10;
  const impliedDrawProb = Math.round(1 / bookmakerDrawOdds * 1e3) / 10;
  const impliedAwayProb = Math.round(1 / bookmakerAwayOdds * 1e3) / 10;
  let valueBetDetected = false;
  let valueSide;
  let valueEdgePercent;
  let valueExplanation;
  const edgeHome = Math.round((pHomeWin - impliedHomeProb) * 10) / 10;
  const edgeAway = Math.round((pAwayWin - impliedAwayProb) * 10) / 10;
  const edgeDraw = Math.round((pDraw - impliedDrawProb) * 10) / 10;
  if (edgeHome >= 4) {
    valueBetDetected = true;
    valueSide = "1";
    valueEdgePercent = edgeHome;
    valueExplanation = `Ventaja en ${homeShort}: Nuestro modelo proyecta ${pHomeWin}% vs cuota de mercado de ${bookmakerHomeOdds.toFixed(2)} (implica ${impliedHomeProb}%). Valor de +${edgeHome}%.`;
  } else if (edgeAway >= 4) {
    valueBetDetected = true;
    valueSide = "2";
    valueEdgePercent = edgeAway;
    valueExplanation = `Ventaja en ${awayShort}: Nuestro modelo proyecta ${pAwayWin}% vs cuota de mercado de ${bookmakerAwayOdds.toFixed(2)} (implica ${impliedAwayProb}%). Valor de +${edgeAway}%.`;
  } else if (edgeDraw >= 4.5) {
    valueBetDetected = true;
    valueSide = "X";
    valueEdgePercent = edgeDraw;
    valueExplanation = `Ventaja en Empate: Nuestro modelo proyecta ${pDraw}% vs cuota de mercado de ${bookmakerDrawOdds.toFixed(2)} (implica ${impliedDrawProb}%). Valor de +${edgeDraw}%.`;
  }
  const marketOdds = {
    provider: "Consenso de Mercado (The Odds API)",
    bookmakerHomeOdds,
    bookmakerDrawOdds,
    bookmakerAwayOdds,
    impliedHomeProb,
    impliedDrawProb,
    impliedAwayProb,
    valueBetDetected,
    valueSide,
    valueEdgePercent,
    valueExplanation
  };
  const candidatePicks = [];
  const maxWinnerProb = Math.max(pHomeWin, pAwayWin);
  if (doubleChance1X >= doubleChanceX2 && doubleChance1X >= 64 && doubleChance1X <= 87) {
    const odd = Math.max(1.2, Math.round(100 / doubleChance1X * 100) / 100);
    candidatePicks.push({
      id: "dc_1x",
      category: "DOUBLE_CHANCE",
      categoryLabel: "\u{1F6E1}\uFE0F Doble Oportunidad",
      label: `Gana o Empata ${homeShort} (1X)`,
      plainTitle: `${homeShort} gana o empata el partido (Doble Oportunidad 1X)`,
      probability: doubleChance1X,
      fairOdd: odd,
      riskLevel: doubleChance1X >= 72 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `Elegir solo ganador directo tiene ${pHomeWin}% de \xE9xito, pero cubriendo tambi\xE9n el empate (${pDraw}%) subes tu probabilidad real al ${doubleChance1X}%.`,
      stepByStepGuide: {
        step1: `Entra al partido y busca la secci\xF3n llamada "Doble Oportunidad".`,
        step2: `Selecciona la opci\xF3n "1X" o "${homeShort} o Empate".`,
        step3: `Ganas tu apuesta si ${homeShort} gana O si el partido termina empatado.`
      },
      glossaryTerm: {
        term: "Doble Oportunidad (1X)",
        definition: "Apuesta donde cubres 2 de los 3 resultados posibles del partido al mismo tiempo (Victoria Local + Empate).",
        example: `Si queda 1-0, 2-0, 0-0 o 1-1, ganas la apuesta. Solo pierdes si gana ${awayShort}.`
      }
    });
  } else if (doubleChanceX2 > doubleChance1X && doubleChanceX2 >= 64 && doubleChanceX2 <= 87) {
    const odd = Math.max(1.2, Math.round(100 / doubleChanceX2 * 100) / 100);
    candidatePicks.push({
      id: "dc_x2",
      category: "DOUBLE_CHANCE",
      categoryLabel: "\u{1F6E1}\uFE0F Doble Oportunidad",
      label: `Gana o Empata ${awayShort} (X2)`,
      plainTitle: `${awayShort} gana o empata el partido (Doble Oportunidad X2)`,
      probability: doubleChanceX2,
      fairOdd: odd,
      riskLevel: doubleChanceX2 >= 72 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `Apostar solo a que gana ${awayShort} tiene ${pAwayWin}%, mientras que sumando el empate (${pDraw}%) aseguras un ${doubleChanceX2}% de probabilidad real.`,
      stepByStepGuide: {
        step1: `Busca dentro del partido el mercado "Doble Oportunidad".`,
        step2: `Marca la casilla "X2" o "Empate o ${awayShort}".`,
        step3: `Cobras si ${awayShort} gana por cualquier marcador o si empatan.`
      },
      glossaryTerm: {
        term: "Doble Oportunidad (X2)",
        definition: "Te permite ganar con dos resultados: si gana el equipo visitante o si el partido termina en empate.",
        example: `Si el partido queda 0-0, 1-1 o gana ${awayShort} 0-1, t\xFA ganas.`
      }
    });
  }
  candidatePicks.push({
    id: "corners_best",
    category: "CORNERS",
    categoryLabel: "\u{1F6A9} Tiros de Esquina",
    label: `${recommendedCornerLine} (${expectedTotalCorners} proy.)`,
    plainTitle: `${recommendedCornerLine} en total (${expectedTotalCorners} proyectados)`,
    probability: recommendedCornerProb,
    fairOdd: recommendedCornerOdd,
    riskLevel: recommendedCornerProb >= 70 ? "Riesgo Bajo" : "Riesgo Moderado",
    whySaferThanWinner: `No importa qui\xE9n gane ni qui\xE9n meta los goles: los dos equipos promedian ${homeTotalShots + awayTotalShots} remates combinados que generan ~${expectedTotalCorners} c\xF3rners (${recommendedCornerProb}% vs ${maxWinnerProb}% del ganador).`,
    stepByStepGuide: {
      step1: `Ve a la pesta\xF1a "C\xF3rners" o "Tiros de Esquina" dentro del partido.`,
      step2: `Busca "Total de C\xF3rners" y elige "${recommendedCornerLine}".`,
      step3: `Se suman los c\xF3rners de ${homeShort} (~${lambdaHomeCorners}) y ${awayShort} (~${lambdaAwayCorners}). No importa qui\xE9n gane el partido.`
    },
    glossaryTerm: {
      term: recommendedCornerLine,
      definition: "Suma todos los tiros de esquina que cobren ambos equipos durante los 90 minutos reglamentarios.",
      example: recommendedCornerLine.includes("M\xE1s de 8.5") ? "Si entre los dos equipos cobran 9, 10 o m\xE1s tiros de esquina, ganas la apuesta." : recommendedCornerLine.includes("M\xE1s de 7.5") ? "Si entre los dos equipos cobran 8 o m\xE1s tiros de esquina en total, ganas." : "Si en todo el partido hay 10 tiros de esquina o menos entre ambos, ganas."
    }
  });
  candidatePicks.push({
    id: "cards_best",
    category: "CARDS",
    categoryLabel: "\u{1F7E8} Tarjetas del Partido",
    label: `${recommendedCardPick} (~${expectedYellowCards} esp.)`,
    plainTitle: `${recommendedCardPick} (\xC1rbitro: ${referee.name})`,
    probability: recommendedCardProb,
    fairOdd: recommendedCardOdd,
    riskLevel: recommendedCardProb >= 70 ? "Riesgo Bajo" : "Riesgo Moderado",
    whySaferThanWinner: `El \xE1rbitro ${referee.name} (${referee.rigor}) y la tensi\xF3n del partido proyectan ${expectedYellowCards} amarillas (${recommendedCardProb}% de probabilidad real frente a ${maxWinnerProb}% de acertar ganador).`,
    stepByStepGuide: {
      step1: `Entra a la pesta\xF1a "Tarjetas" en tu aplicaci\xF3n de apuestas.`,
      step2: `En "Total de Tarjetas", selecciona "${recommendedCardPick}".`,
      step3: `Cuentan las tarjetas de ambos equipos (${expectedHomeYellows} esp. ${homeShort} + ${expectedAwayYellows} esp. ${awayShort}).`
    },
    glossaryTerm: {
      term: recommendedCardPick,
      definition: "Pron\xF3stico basado en la cantidad total de tarjetas amarillas/rojas mostradas por el \xE1rbitro a los dos equipos.",
      example: recommendedCardPick.includes("M\xE1s de 3.5") ? "Con que el \xE1rbitro saque 4 o m\xE1s tarjetas en total entre ambos equipos, ganas." : recommendedCardPick.includes("M\xE1s de 4.5") ? "Con que haya 5 o m\xE1s tarjetas en total en el partido, ganas." : "Ganas si el partido se mantiene limpio y no supera el l\xEDmite de tarjetas indicado."
    }
  });
  if (over15 >= 68 && over15 <= 87) {
    const odd15 = Math.max(1.2, Math.round(100 / over15 * 100) / 100);
    candidatePicks.push({
      id: "goals_over15",
      category: "SAFE_GOALS",
      categoryLabel: "\u26BD Goles Seguros",
      label: `M\xE1s de 1.5 Goles (${totalXG} xG)`,
      plainTitle: `Habr\xE1 2 o m\xE1s goles en el partido (M\xE1s de 1.5 Goles)`,
      probability: over15,
      fairOdd: odd15,
      riskLevel: over15 >= 73 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `En vez de adivinar qui\xE9n ganar\xE1 (${maxWinnerProb}%), aqu\xED ganas con cualquier marcador que tenga al menos 2 goles: 1-1, 2-0, 0-2, 2-1 (${over15}% de probabilidad).`,
      stepByStepGuide: {
        step1: `Abre la secci\xF3n "Goles" o "Total de Goles (M\xE1s/Menos)".`,
        step2: `Elige la l\xEDnea "M\xE1s de 1.5 Goles" (Over 1.5).`,
        step3: `Ganas en cuanto se anote el segundo gol del partido, sin importar de qu\xE9 equipo sea.`
      },
      glossaryTerm: {
        term: "M\xE1s de 1.5 Goles",
        definition: "Significa que sumando los goles de ambos equipos debe haber 2 goles o m\xE1s en el partido.",
        example: "Si el partido queda 1-1, 2-0, 0-2 o 2-1, ganas autom\xE1ticamente."
      }
    });
  }
  if (under35 >= 68 && under35 <= 86 && totalXG <= 2.65) {
    const oddU35 = Math.max(1.2, Math.round(100 / under35 * 100) / 100);
    candidatePicks.push({
      id: "goals_under35",
      category: "SAFE_GOALS",
      categoryLabel: "\u{1F512} L\xEDmite de Goles Seguro",
      label: `Menos de 3.5 Goles (${totalXG} xG)`,
      plainTitle: `Habr\xE1 m\xE1ximo 3 goles en total (Menos de 3.5 Goles)`,
      probability: under35,
      fairOdd: oddU35,
      riskLevel: under35 >= 73 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `Es un partido t\xE1ctico (${totalXG} goles esperados). Cubres el 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1 y 1-2 con un ${under35}% de probabilidad real.`,
      stepByStepGuide: {
        step1: `Busca la secci\xF3n "Total de Goles" en tu casa de apuestas.`,
        step2: `Selecciona "Menos de 3.5 Goles" (Under 3.5).`,
        step3: `Ganas siempre que en el partido se anoten 0, 1, 2 o hasta 3 goles como m\xE1ximo.`
      },
      glossaryTerm: {
        term: "Menos de 3.5 Goles",
        definition: "Ganas si la suma total de goles del partido es de 3 o menos.",
        example: "Te sirven marcadores como 0-0, 1-0, 1-1, 2-1 o 2-0. Solo pierdes si hay 4 o m\xE1s goles."
      }
    });
  }
  if (secondHalfGoalProb >= 68 && secondHalfGoalProb <= 86) {
    const odd2H = Math.max(1.22, Math.round(100 / secondHalfGoalProb * 100) / 100);
    candidatePicks.push({
      id: "half_2h_goal",
      category: "HALF_GOALS",
      categoryLabel: "\u23F1\uFE0F Goles por Mitad",
      label: `Gol en la 2.\xAA Mitad (+0.5 Goles 2T)`,
      plainTitle: `Habr\xE1 al menos 1 gol en el Segundo Tiempo`,
      probability: secondHalfGoalProb,
      fairOdd: odd2H,
      riskLevel: secondHalfGoalProb >= 74 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `El cansancio defensivo en el segundo tiempo eleva la expectativa a ${expected2ndHalfGoals} goles en esa mitad (${secondHalfGoalProb}% de probabilidad de que caiga al menos 1 gol).`,
      stepByStepGuide: {
        step1: `Entra a la pesta\xF1a "Mitades" o "2.\xAA Mitad" del partido.`,
        step2: `Selecciona "2.\xAA Mitad - M\xE1s de 0.5 Goles".`,
        step3: `Con que cualquiera de los dos equipos anote 1 gol despu\xE9s del descanso, ganas.`
      },
      glossaryTerm: {
        term: "M\xE1s de 0.5 Goles en 2.\xAA Mitad",
        definition: "Significa que debe anotarse m\xEDnimo 1 gol entre el minuto 46 y el final del partido.",
        example: "Aunque el primer tiempo termine 0-0, si en el segundo tiempo alguien mete un gol, ganas."
      }
    });
  }
  const totalShotsOnTarget = Math.round((homeShotsOnTarget + awayShotsOnTarget) * 10) / 10;
  const shotsProb = Math.min(82.5, Math.max(63, Math.round((1 - poissonCdf(7, totalShotsOnTarget)) * 1e3) / 10));
  if (totalShotsOnTarget >= 8.2) {
    candidatePicks.push({
      id: "shots_on_target",
      category: "SHOTS",
      categoryLabel: "\u{1F3AF} Remates al Arco",
      label: `${homeShort} +3.5 Remates a Puerta (${homeShotsOnTarget} proy.)`,
      plainTitle: `${homeShort} realizar\xE1 4 o m\xE1s tiros directos al arco`,
      probability: shotsProb,
      fairOdd: Math.max(1.25, Math.round(100 / shotsProb * 100) / 100),
      riskLevel: shotsProb >= 70 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `Aunque el portero rival ataje los disparos y el partido quede empatado, cada atajada cuenta como remate al arco (${homeShotsOnTarget} proyectados para ${homeShort}).`,
      stepByStepGuide: {
        step1: `Busca la secci\xF3n "Estad\xEDsticas" o "Remates a Puerta".`,
        step2: `Elige "${homeShort} M\xE1s de 3.5 Remates a Puerta".`,
        step3: `Cuentan todos los tiros que vayan a gol o que ataje el arquero rival.`
      },
      glossaryTerm: {
        term: "Remates a Puerta (Al Arco)",
        definition: "Cualquier disparo que termina en gol o que habr\xEDa entrado si el portero no lo atajaba.",
        example: "Los tiros que van a las manos del arquero cuentan a tu favor aunque no sean gol."
      }
    });
  }
  if (bttsYes >= 62 || bttsNo >= 64) {
    const isYes = bttsYes >= bttsNo;
    const bttsProb = isYes ? bttsYes : bttsNo;
    const bttsOdd = Math.max(1.25, Math.round(100 / bttsProb * 100) / 100);
    candidatePicks.push({
      id: "btts_pick",
      category: "BTTS",
      categoryLabel: "\u{1F945} Ambos Marcan",
      label: isYes ? "Ambos Equipos Anotan: S\xED" : "Ambos Equipos Anotan: No",
      plainTitle: isYes ? "Los dos equipos anotar\xE1n al menos 1 gol cada uno" : "Al menos un equipo se quedar\xE1 con 0 goles",
      probability: bttsProb,
      fairOdd: bttsOdd,
      riskLevel: bttsProb >= 68 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: isYes ? `Ambos ataques superan a las defensas rivales (${lambdaHome} y ${lambdaAway} xG), d\xE1ndote ${bttsProb}% de acierto sin importar qui\xE9n gane.` : `La solidez defensiva proyecta que al menos un arco quedar\xE1 en cero (${bttsProb}% de probabilidad).`,
      stepByStepGuide: {
        step1: `En la pantalla principal del partido, ubica "Ambos Equipos Anotar\xE1n".`,
        step2: `Marca la opci\xF3n "${isYes ? "S\xED" : "No"}".`,
        step3: isYes ? `Ganas apenas ${homeShort} y ${awayShort} hayan anotado m\xEDnimo un gol cada uno.` : `Ganas si cualquiera de los dos equipos termina el partido con 0 goles.`
      },
      glossaryTerm: {
        term: `Ambos Marcan (${isYes ? "S\xED" : "No"})`,
        definition: isYes ? "Requiere que tanto el equipo local como el visitante anoten m\xEDnimo 1 gol." : "Significa que uno de los dos equipos (o ambos) no anotar\xE1 ning\xFAn gol.",
        example: isYes ? "1-1, 2-1 o 1-2 son ganadores." : "0-0, 1-0, 2-0 o 0-1 son ganadores."
      }
    });
  }
  if (maxWinnerProb >= 55) {
    const isHomeFav = pHomeWin >= pAwayWin;
    const favName = isHomeFav ? homeShort : awayShort;
    const favProb = isHomeFav ? pHomeWin : pAwayWin;
    const favOdd = isHomeFav ? fairOddsHome : fairOddsAway;
    candidatePicks.push({
      id: "winner_1x2",
      category: "1X2",
      categoryLabel: "\u{1F3C6} Ganador Directo",
      label: `Victoria de ${favName}`,
      plainTitle: `${favName} gana el partido en los 90 minutos`,
      probability: favProb,
      fairOdd: favOdd,
      riskLevel: favProb >= 68 ? "Riesgo Bajo" : "Riesgo Moderado",
      whySaferThanWinner: `${favName} tiene una superioridad estad\xEDstica marcada del ${favProb}% seg\xFAn el motor G METRICS.`,
      stepByStepGuide: {
        step1: `En el mercado principal "Resultado del Partido (1X2)".`,
        step2: `Selecciona como ganador a "${favName}".`,
        step3: `Ganas si ${favName} termina con m\xE1s goles que su rival.`
      },
      glossaryTerm: {
        term: "Resultado 1X2 (Ganador)",
        definition: "Apuesta tradicional a qui\xE9n ganar\xE1 el partido: 1 (Local), X (Empate), 2 (Visitante).",
        example: `En este caso, necesitas que ${favName} gane el encuentro.`
      }
    });
  }
  candidatePicks.sort((a, b) => {
    if (Math.abs(b.probability - a.probability) <= 1.2) {
      if (a.category === "1X2" && b.category !== "1X2") return 1;
      if (b.category === "1X2" && a.category !== "1X2") return -1;
    }
    return b.probability - a.probability;
  });
  const topSafePick = candidatePicks[0];
  const allRankedPicks = candidatePicks.slice(0, 6);
  const recommendedPicks = allRankedPicks.map(
    (p) => ({
      label: p.label,
      market: p.categoryLabel,
      probability: p.probability,
      odd: p.fairOdd
    })
  );
  if (valueBetDetected && valueSide && valueEdgePercent) {
    const vLabel = valueSide === "1" ? `Valor +EV: ${homeShort} (@${bookmakerHomeOdds})` : valueSide === "2" ? `Valor +EV: ${awayShort} (@${bookmakerAwayOdds})` : `Valor +EV: Empate (@${bookmakerDrawOdds})`;
    const vOdd = valueSide === "1" ? bookmakerHomeOdds : valueSide === "2" ? bookmakerAwayOdds : bookmakerDrawOdds;
    const vProb = valueSide === "1" ? pHomeWin : valueSide === "2" ? pAwayWin : pDraw;
    recommendedPicks.push({ label: vLabel, market: "Apuesta de Valor (+EV)", probability: vProb, odd: vOdd });
  }
  let confidenceTier = "Valor Estad\xEDstico";
  if (topSafePick.probability >= 72) {
    confidenceTier = "Alta Convicci\xF3n";
  } else if (topSafePick.probability < 62 && closeMatchPercent >= 72) {
    confidenceTier = "Precauci\xF3n T\xE1ctica";
  }
  const goalTendency = over25 >= 52 ? `tendencia ofensiva con ${totalXG} xG combinados` : `corte t\xE1ctico (${totalXG} xG)`;
  const technicalVerdict = `La jugada matem\xE1tica m\xE1s factible del partido es "${topSafePick.label}" con ${topSafePick.probability}% de probabilidad real (${topSafePick.categoryLabel}, cuota justa @${topSafePick.fairOdd.toFixed(2)}), superando el ${maxWinnerProb}% de elegir un ganador directo. Se proyectan ${expectedTotalCorners} tiros de esquina (${lambdaHomeCorners} ${homeShort} vs ${lambdaAwayCorners} ${awayShort}), ${expectedYellowCards} tarjetas amarillas con el \xE1rbitro ${referee.name} y un ${goalTendency}.`;
  const keyTacticalFactor = derbyOrRivalry ? `Factor Derbi: Alta fricci\xF3n (${expectedYellowCards} amarillas esp.) y presi\xF3n en bandas (${expectedTotalCorners} c\xF3rners).` : awayTotalPenalty > 0.06 ? `Desgaste de viaje en ${awayShort} (-${(awayTotalPenalty * 100).toFixed(1)}% xG por traslado de ${travel.awayDistanceKm} km).` : `Proyecci\xF3n multi-mercado: ${expectedTotalCorners} c\xF3rners esperados y ${totalShotsOnTarget} remates al arco combinados.`;
  const verdict = {
    closeMatchPercent,
    wideWinPercent,
    recommendedPicks,
    topSafePick,
    allRankedPicks,
    confidenceTier,
    technicalVerdict,
    keyTacticalFactor
  };
  const analysisResult = {
    matchId: fixture.id,
    dixonColes,
    goalsMarket,
    cornersMarket,
    refereeCards,
    shotsAndPlayers,
    urgency,
    halfGoals,
    lateGoals,
    fatigue,
    cleanSheet,
    verdict,
    marketOdds
  };
  if (liveScoreKey) {
    analysisCache.set(liveScoreKey, analysisResult);
  }
  return analysisResult;
}
function extractMatchBettingMarketSuggestions(fixture, analysis) {
  const matchAnalysis = analysis || calculateMatchAnalysis(fixture);
  const { dixonColes, goalsMarket, cornersMarket, refereeCards, shotsAndPlayers, halfGoals } = matchAnalysis;
  const homeName = fixture.homeTeam?.name || "Local";
  const awayName = fixture.awayTeam?.name || "Visitante";
  const INVALID_STANDALONE = /* @__PURE__ */ new Set([
    "san",
    "st",
    "st.",
    "sta",
    "sta.",
    "santa",
    "santo",
    "real",
    "club",
    "cd",
    "cf",
    "ca",
    "cs",
    "deportivo",
    "atletico",
    "atl\xE9tico",
    "sporting",
    "inter",
    "racing",
    "boca",
    "river",
    "union",
    "uni\xF3n",
    "independiente",
    "estudiantes",
    "leones",
    "la",
    "los",
    "el",
    "las",
    "al"
  ]);
  const resolveTeamLabel = (fullName, shortName) => {
    if (!fullName) return shortName || "Equipo";
    const cleanFull = fullName.trim();
    if (shortName && shortName.trim().length >= 4 && !INVALID_STANDALONE.has(shortName.trim().toLowerCase())) {
      return shortName.trim();
    }
    return cleanFull;
  };
  const homeShort = resolveTeamLabel(homeName, fixture.homeTeam?.shortName);
  const awayShort = resolveTeamLabel(awayName, fixture.awayTeam?.shortName);
  const matchName = `${homeName} vs ${awayName}`;
  const leagueName = fixture.league?.name || "Liga Oficial";
  const candidates = [];
  const addCandidate = (category, label, probRaw, edgeBoost = 0.04) => {
    if (probRaw <= 0.48 || probRaw > 0.95) return;
    const impliedProb = Number(probRaw.toFixed(3));
    const fairOdd = 1 / impliedProb;
    const odds = Number(Math.max(1.3, Number((fairOdd * (1 + edgeBoost)).toFixed(2))));
    const expectedValue = Number((impliedProb * odds - 1).toFixed(3));
    if (odds >= 1.3 && expectedValue > 0) {
      candidates.push({
        fixtureId: fixture.id,
        matchName,
        leagueName,
        category,
        label,
        odds,
        impliedProb,
        expectedValue,
        availableInColombianBooks: true
      });
    }
  };
  if (dixonColes.pHomeWin >= 50) {
    addCandidate("1X2" /* ONE_X_TWO */, `Gana ${homeShort} (1)`, dixonColes.pHomeWin / 100, 0.045);
  }
  if (dixonColes.pAwayWin >= 48) {
    addCandidate("1X2" /* ONE_X_TWO */, `Gana ${awayShort} (2)`, dixonColes.pAwayWin / 100, 0.045);
  }
  if (goalsMarket.doubleChance1X >= 64) {
    addCandidate("DOUBLE_CHANCE" /* DOUBLE_CHANCE */, `${homeShort} o Empate (1X)`, goalsMarket.doubleChance1X / 100, 0.038);
  }
  if (goalsMarket.doubleChanceX2 >= 64) {
    addCandidate("DOUBLE_CHANCE" /* DOUBLE_CHANCE */, `Empate o ${awayShort} (X2)`, goalsMarket.doubleChanceX2 / 100, 0.038);
  }
  if (goalsMarket.doubleChance12 >= 70) {
    addCandidate("DOUBLE_CHANCE" /* DOUBLE_CHANCE */, `Cualquiera Gana (12)`, goalsMarket.doubleChance12 / 100, 0.035);
  }
  if (goalsMarket.over15 >= 66) {
    addCandidate("TOTAL_GOALS" /* TOTAL_GOALS */, `M\xE1s de 1.5 Goles`, goalsMarket.over15 / 100, 0.04);
  }
  if (goalsMarket.under15 >= 50) {
    addCandidate("TOTAL_GOALS" /* TOTAL_GOALS */, `Menos de 1.5 Goles`, goalsMarket.under15 / 100, 0.045);
  }
  if (goalsMarket.over25 >= 52) {
    addCandidate("TOTAL_GOALS" /* TOTAL_GOALS */, `M\xE1s de 2.5 Goles`, goalsMarket.over25 / 100, 0.05);
  }
  if (goalsMarket.under25 >= 55) {
    addCandidate("TOTAL_GOALS" /* TOTAL_GOALS */, `Menos de 2.5 Goles`, goalsMarket.under25 / 100, 0.045);
  }
  if (goalsMarket.bttsYes >= 53) {
    addCandidate("BTTS" /* BTTS */, `Ambos Marcan: S\xED`, goalsMarket.bttsYes / 100, 0.042);
  }
  if (goalsMarket.bttsNo >= 54) {
    addCandidate("BTTS" /* BTTS */, `Ambos Marcan: No`, goalsMarket.bttsNo / 100, 0.042);
  }
  if (cornersMarket.over75 >= 70) {
    addCandidate("TOTAL_CORNERS_MATCH" /* TOTAL_CORNERS_MATCH */, `M\xE1s de 7.5 C\xF3rners`, cornersMarket.over75 / 100, 0.038);
  } else if (cornersMarket.over85 >= 62) {
    addCandidate("TOTAL_CORNERS_MATCH" /* TOTAL_CORNERS_MATCH */, `M\xE1s de 8.5 C\xF3rners`, cornersMarket.over85 / 100, 0.04);
  } else if (cornersMarket.over95 >= 54) {
    addCandidate("TOTAL_CORNERS_MATCH" /* TOTAL_CORNERS_MATCH */, `M\xE1s de 9.5 C\xF3rners`, cornersMarket.over95 / 100, 0.045);
  } else if ((cornersMarket.under105 || 100 - cornersMarket.over105) >= 58) {
    const underProb = (cornersMarket.under105 || 100 - cornersMarket.over105) / 100;
    addCandidate("TOTAL_CORNERS_MATCH" /* TOTAL_CORNERS_MATCH */, `Menos de 10.5 C\xF3rners`, underProb, 0.04);
  }
  const dnbDenominator = dixonColes.pHomeWin + dixonColes.pAwayWin;
  if (dnbDenominator > 0) {
    const dnbHomeProb = dixonColes.pHomeWin / dnbDenominator;
    const dnbAwayProb = dixonColes.pAwayWin / dnbDenominator;
    if (dnbHomeProb >= 0.58) {
      addCandidate("DRAW_NO_BET" /* DRAW_NO_BET */, `Empate No V\xE1lido: ${homeShort}`, dnbHomeProb, 0.04);
    } else if (dnbAwayProb >= 0.58) {
      addCandidate("DRAW_NO_BET" /* DRAW_NO_BET */, `Empate No V\xE1lido: ${awayShort}`, dnbAwayProb, 0.04);
    }
  }
  if (refereeCards) {
    if (refereeCards.over35CardsProb >= 68) {
      addCandidate("TOTAL_CARDS" /* TOTAL_CARDS */, `M\xE1s de 3.5 Tarjetas`, refereeCards.over35CardsProb / 100, 0.042);
    } else if (refereeCards.under45CardsProb >= 68) {
      addCandidate("TOTAL_CARDS" /* TOTAL_CARDS */, `Menos de 4.5 Tarjetas`, refereeCards.under45CardsProb / 100, 0.04);
    } else if (refereeCards.under55CardsProb >= 72) {
      addCandidate("TOTAL_CARDS" /* TOTAL_CARDS */, `Menos de 5.5 Tarjetas`, refereeCards.under55CardsProb / 100, 0.038);
    } else if (refereeCards.over45CardsProb >= 58 && refereeCards.rigor === "Severo") {
      addCandidate("TOTAL_CARDS" /* TOTAL_CARDS */, `M\xE1s de 4.5 Tarjetas`, refereeCards.over45CardsProb / 100, 0.048);
    }
  }
  const isValidPlayerName = (name) => {
    if (!name || typeof name !== "string") return false;
    const clean = name.trim();
    if (clean.length < 4 || clean.includes("#")) return false;
    const lower = clean.toLowerCase();
    if (lower.includes("local") || lower.includes("visitante") || lower.includes("equipo") || lower.includes("jugador")) return false;
    return true;
  };
  if (shotsAndPlayers) {
    if (isValidPlayerName(shotsAndPlayers.homeStar?.name) && (shotsAndPlayers.homeStar.expectedShotsOnTarget || 0) >= 1.15) {
      const lambdaSOT = shotsAndPlayers.homeStar.expectedShotsOnTarget;
      const probSOT = Math.round((1 - Math.exp(-lambdaSOT)) * 1e3) / 1e3;
      if (probSOT >= 0.65) {
        addCandidate("PLAYER_SHOTS_ON_TARGET" /* PLAYER_SHOTS_ON_TARGET */, `${shotsAndPlayers.homeStar.name}: M\xE1s de 0.5 Tiros a Puerta`, probSOT, 0.042);
      }
    }
    if (isValidPlayerName(shotsAndPlayers.awayStar?.name) && (shotsAndPlayers.awayStar.expectedShotsOnTarget || 0) >= 1.15) {
      const lambdaSOT = shotsAndPlayers.awayStar.expectedShotsOnTarget;
      const probSOT = Math.round((1 - Math.exp(-lambdaSOT)) * 1e3) / 1e3;
      if (probSOT >= 0.65) {
        addCandidate("PLAYER_SHOTS_ON_TARGET" /* PLAYER_SHOTS_ON_TARGET */, `${shotsAndPlayers.awayStar.name}: M\xE1s de 0.5 Tiros a Puerta`, probSOT, 0.042);
      }
    }
  }
  if (halfGoals) {
    const prob2ndHalfGoal = Math.round((1 - Math.exp(-halfGoals.expected2ndHalfGoals)) * 1e3) / 1e3;
    if (prob2ndHalfGoal >= 0.72) {
      addCandidate("HALF_WITH_MOST_GOALS" /* HALF_WITH_MOST_GOALS */, `2.\xAA Mitad: M\xE1s de 0.5 Goles`, prob2ndHalfGoal, 0.038);
    } else if (halfGoals.secondHalfPercent >= 48) {
      addCandidate("HALF_WITH_MOST_GOALS" /* HALF_WITH_MOST_GOALS */, `Mitad con M\xE1s Goles: 2.\xAA Mitad`, halfGoals.secondHalfPercent / 100, 0.045);
    }
  }
  return candidates;
}
function generateSmartParlays(availableMatches, targetDate, availableNBAMatches) {
  const hasMatches = Boolean(availableMatches && availableMatches.length > 0);
  const hasNBAMatches = Boolean(availableNBAMatches && availableNBAMatches.length > 0);
  if (!hasMatches && !hasNBAMatches) return [];
  const eligibleMatches = (availableMatches || []).filter(
    (m) => Boolean(m && m.id && m.homeTeam && m.awayTeam) && m.status !== "CANCELLED" && m.status !== "POSTPONED"
  );
  const eligibleNBAMatches = (availableNBAMatches || []).filter(
    (m) => Boolean(m && m.id && m.homeTeam && m.awayTeam)
  );
  if (eligibleMatches.length + eligibleNBAMatches.length < 2) return [];
  const matchCandidatesMap = /* @__PURE__ */ new Map();
  for (const match of eligibleMatches) {
    const suggestions = extractMatchBettingMarketSuggestions(match);
    if (suggestions.length > 0) {
      matchCandidatesMap.set(match.id, suggestions);
    }
  }
  for (const nbaMatch of eligibleNBAMatches) {
    const nbaSuggestions = extractNBABettingMarketSuggestions(nbaMatch);
    if (nbaSuggestions.length > 0) {
      matchCandidatesMap.set(nbaMatch.id, nbaSuggestions);
    }
  }
  const distinctMatchIds = Array.from(matchCandidatesMap.keys());
  if (distinctMatchIds.length < 2) return [];
  const todayStr = targetDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const generatedSlips = [];
  const usedPickSignatures = /* @__PURE__ */ new Set();
  const usedFixtureIds = /* @__PURE__ */ new Set();
  const findOptimalSlip = (profile, numLegs, minOdds, maxOdds, excludedSlipHashes) => {
    if (distinctMatchIds.length < numLegs) return null;
    let bestCombo = null;
    let bestScore = -Infinity;
    let searchIterations = 0;
    const MAX_SEARCH_ITERATIONS = 15e3;
    const search = (matchIdx, currentLegs, usedCategories, currentOdds) => {
      if (++searchIterations > MAX_SEARCH_ITERATIONS) return;
      if (currentOdds > maxOdds * 1.05) return;
      if (currentLegs.length === numLegs) {
        if (currentOdds >= minOdds && currentOdds <= maxOdds) {
          const hash2 = currentLegs.map((l) => `${l.fixtureId}_${l.category}`).sort().join("|");
          if (excludedSlipHashes.has(hash2)) return;
          const cumulativeProb = currentLegs.reduce((acc, l) => acc * l.impliedProb, 1);
          const avgEV = currentLegs.reduce((acc, l) => acc + l.expectedValue, 0) / numLegs;
          const reusedCount = currentLegs.filter((l) => usedFixtureIds.has(l.fixtureId)).length;
          const score = cumulativeProb * 100 + avgEV * 10 - reusedCount * 30;
          if (score > bestScore) {
            bestScore = score;
            bestCombo = [...currentLegs];
          }
        }
        return;
      }
      if (distinctMatchIds.length - matchIdx < numLegs - currentLegs.length) return;
      for (let i = matchIdx; i < distinctMatchIds.length; i++) {
        const fixtureId = distinctMatchIds[i];
        const matchPicks = matchCandidatesMap.get(fixtureId) || [];
        for (const pick of matchPicks) {
          if (usedCategories.has(pick.category)) {
            continue;
          }
          const pickSig = `${pick.fixtureId}:::${pick.label}`;
          if (usedPickSignatures.has(pickSig)) {
            continue;
          }
          const nextOdds = Number((currentOdds * pick.odds).toFixed(2));
          usedCategories.add(pick.category);
          currentLegs.push(pick);
          search(i + 1, currentLegs, usedCategories, nextOdds);
          currentLegs.pop();
          usedCategories.delete(pick.category);
        }
      }
    };
    search(0, [], /* @__PURE__ */ new Set(), 1);
    if (!bestCombo) {
      let closestCombo = null;
      let minDistance = Infinity;
      let fallbackIterations = 0;
      const fallbackSearch = (matchIdx, currentLegs, usedCategories, currentOdds) => {
        if (++fallbackIterations > MAX_SEARCH_ITERATIONS) return;
        if (currentOdds > maxOdds * 1.25) return;
        if (currentLegs.length === numLegs) {
          const hash2 = currentLegs.map((l) => `${l.fixtureId}_${l.category}`).sort().join("|");
          if (excludedSlipHashes.has(hash2)) return;
          const distance = Math.abs(currentOdds - (minOdds + maxOdds) / 2);
          const reusedCount = currentLegs.filter((l) => usedFixtureIds.has(l.fixtureId)).length;
          const adjustedDistance = distance + reusedCount * 2;
          if (adjustedDistance < minDistance) {
            minDistance = adjustedDistance;
            closestCombo = [...currentLegs];
          }
          return;
        }
        if (distinctMatchIds.length - matchIdx < numLegs - currentLegs.length) return;
        for (let i = matchIdx; i < distinctMatchIds.length; i++) {
          const fixtureId = distinctMatchIds[i];
          const matchPicks = matchCandidatesMap.get(fixtureId) || [];
          for (const pick of matchPicks) {
            if (usedCategories.has(pick.category)) continue;
            const pickSig = `${pick.fixtureId}:::${pick.label}`;
            if (usedPickSignatures.has(pickSig)) continue;
            usedCategories.add(pick.category);
            currentLegs.push(pick);
            fallbackSearch(i + 1, currentLegs, usedCategories, Number((currentOdds * pick.odds).toFixed(2)));
            currentLegs.pop();
            usedCategories.delete(pick.category);
          }
        }
      };
      fallbackSearch(0, [], /* @__PURE__ */ new Set(), 1);
      bestCombo = closestCombo;
    }
    if (!bestCombo || bestCombo.length !== numLegs) {
      return null;
    }
    const finalCombo = bestCombo;
    const totalOdds = Number(finalCombo.reduce((acc, l) => acc * l.odds, 1).toFixed(2));
    const hash = finalCombo.map((l) => `${l.fixtureId}_${l.category}`).sort().join("|");
    excludedSlipHashes.add(hash);
    for (const leg of finalCombo) {
      usedPickSignatures.add(`${leg.fixtureId}:::${leg.label}`);
      usedFixtureIds.add(leg.fixtureId);
    }
    return {
      id: `smart_parlay_${profile.toLowerCase()}_${todayStr.replace(/-/g, "")}_${Math.random().toString(36).substring(2, 7)}`,
      date: todayStr,
      profile,
      legs: finalCombo,
      totalOdds,
      status: "PENDING"
    };
  };
  const usedHashes = /* @__PURE__ */ new Set();
  const conservativeSlip = findOptimalSlip("CONSERVATIVE", 2, 1.85, 2.3, usedHashes);
  if (conservativeSlip) generatedSlips.push(conservativeSlip);
  const balancedSlip = findOptimalSlip("BALANCED", 3, 2.8, 4.2, usedHashes);
  if (balancedSlip) generatedSlips.push(balancedSlip);
  const highOddsSlip = findOptimalSlip("HIGH_ODDS", 4, 5, 8.5, usedHashes);
  if (highOddsSlip) generatedSlips.push(highOddsSlip);
  return generatedSlips;
}

// src/services/resilientFetch.ts
async function fetchWithStrictTimeout(url, options = {}) {
  const { timeoutMs = 4500, headers, ...restOptions } = options;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
        ...headers || {}
      },
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
      text: () => response.text()
    };
  } catch (err) {
    clearTimeout(timeoutTimer);
    if (err.name === "AbortError" || err.code === 20) {
      console.warn(`[Upstream Timeout 4.5s]: Petici\xF3n a ${url.slice(0, 70)}... abortada para proteger Vercel Lambda.`);
      throw new Error(`UPSTREAM_TIMEOUT: La API externa super\xF3 los ${timeoutMs}ms.`);
    }
    throw err;
  }
}

// server.ts
dotenv.config();
var vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
var vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
var VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || "mailto:soporte@g-metrics.com";
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = vapidPublicKey || generated.publicKey;
    vapidPrivateKey = vapidPrivateKey || generated.privateKey;
  } catch (err) {
    console.error("[Web-Push] Error generando llaves VAPID temporales:", err);
  }
}
try {
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
    console.log("[Web-Push] Llaves VAPID configuradas para notificaciones en segundo plano.");
  }
} catch (vapidErr) {
  console.error("[Web-Push] Error configurando VAPID:", vapidErr);
}
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
function zeroTrustSessionMiddleware(req, _res, next) {
  const session = extractSessionFromRequest(req);
  req.userSession = session;
  req.isVipUser = Boolean(
    session && (session.role === "admin" || session.isVip || (session.expiresAt ? session.expiresAt > Date.now() : false))
  );
  next();
}
app.use(zeroTrustSessionMiddleware);
app.use(idempotencyMiddleware);
var IS_VERCEL2 = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
var CACHE_DIR = IS_VERCEL2 ? path2.resolve("/tmp", ".cache") : path2.resolve(process.cwd(), ".cache");
var CACHE_FILE = path2.resolve(CACHE_DIR, "sportstats_cache.json");
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
var activeOnlineSessions = /* @__PURE__ */ new Map();
var ONLINE_WINDOW_MS = 3 * 60 * 1e3;
var peakOnlineUsers = 1;
var peakOnlineAt = (/* @__PURE__ */ new Date()).toISOString();
var serverCacheHits = 0;
var serverCacheMisses = 0;
var espnPulseCallsCount = 0;
var footballDataRequestsSinceBoot = 0;
var footballDataCacheHits = 0;
var footballDataLastSuccessAt = null;
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
      if (typeof d.serverCacheHits === "number" && serverCacheHits < d.serverCacheHits) {
        serverCacheHits = d.serverCacheHits;
      }
      if (typeof d.serverCacheMisses === "number" && serverCacheMisses < d.serverCacheMisses) {
        serverCacheMisses = d.serverCacheMisses;
      }
      if (typeof d.espnPulseCallsCount === "number" && espnPulseCallsCount < d.espnPulseCallsCount) {
        espnPulseCallsCount = d.espnPulseCallsCount;
      }
      if (typeof d.footballDataRequestsSinceBoot === "number") {
        footballDataRequestsSinceBoot = Math.max(footballDataRequestsSinceBoot, d.footballDataRequestsSinceBoot);
      }
      if (typeof d.footballDataCacheHits === "number") {
        footballDataCacheHits = Math.max(footballDataCacheHits, d.footballDataCacheHits);
      }
      if (typeof d.footballDataLastSuccessAt === "string") {
        footballDataLastSuccessAt = d.footballDataLastSuccessAt;
      }
    }
  } catch {
  }
}
function saveTelemetrySnapshotToCache(syncToSupabase = false) {
  const snapshot = {
    peakOnlineUsers,
    peakOnlineAt,
    serverCacheHits,
    serverCacheMisses,
    espnPulseCallsCount,
    footballDataRequestsSinceBoot,
    footballDataCacheHits,
    footballDataLastSuccessAt
  };
  setCacheItem("__server_telemetry_v1__", snapshot);
  if (syncToSupabase && isSupabaseConfigured()) {
    setSupabaseKvCache("__server_telemetry_v1__", snapshot).catch(() => {
    });
  }
}
function recordOnlinePresence(opts) {
  purgeExpiredOnlineSessions();
  let rawUser = (opts.username || "").trim();
  if (rawUser.startsWith("{") || rawUser.includes('"username"') || rawUser.includes("admin-owner")) {
    try {
      const parsed = JSON.parse(rawUser);
      rawUser = parsed.username || parsed.displayName || parsed.id || "admin";
    } catch {
      const m = rawUser.match(/"username"\s*:\s*"([^"]+)"/) || rawUser.match(/"id"\s*:\s*"([^"]+)"/);
      if (m && m[1]) rawUser = m[1];
    }
  }
  const cleanUser = rawUser.toLowerCase();
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
  if (memoryCache.size >= 250 && !memoryCache.has(key)) {
    const iter = memoryCache.keys();
    let nextKey = iter.next().value;
    while (nextKey && (nextKey.startsWith("__gmetrics_") || nextKey.startsWith("__server_"))) {
      nextKey = iter.next().value;
    }
    if (nextKey) memoryCache.delete(nextKey);
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
  persistCacheToDisk();
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
  "775": { id: 2, name: "UEFA Champions League", country: "Internacional", flag: "\u2B50" },
  "776": { id: 3, name: "UEFA Europa League", country: "Internacional", flag: "\u2B50" },
  "20296": { id: 848, name: "UEFA Conference League", country: "Internacional", flag: "\u2B50" },
  "783": { id: 13, name: "Copa Libertadores", country: "Internacional", flag: "\u{1F30E}" },
  "5454": { id: 11, name: "Copa Sudamericana", country: "Internacional", flag: "\u{1F30E}" },
  "3929": { id: 3929, name: "Copa Centroamericana CONCACAF", country: "Internacional", flag: "\u{1F30E}" },
  "2466": { id: 2466, name: "AFC Champions League Two", country: "Internacional", flag: "\u{1F30F}" },
  "787": { id: 29, name: "Eliminatorias CONMEBOL", country: "Internacional", flag: "\u{1F30E}" },
  "789": { id: 30, name: "Eliminatorias AFC", country: "Internacional", flag: "\u{1F30F}" },
  "2395": { id: 5, name: "UEFA Nations League", country: "Internacional", flag: "\u2B50" },
  "19267": { id: 14, name: "CONCACAF Nations League", country: "Internacional", flag: "\u{1F30E}" },
  "8315": { id: 29, name: "Clasificaci\xF3n AFCON", country: "Internacional", flag: "\u{1F30D}" },
  "3922": { id: 10, name: "Amistosos FIFA", country: "Internacional", flag: "\u{1F30D}" },
  "700": { id: 39, name: "Premier League", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3920": { id: 48, name: "EFL Cup (Carabao Cup)", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3914": { id: 40, name: "EFL Championship", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
  "3915": { id: 40, name: "EFL Championship", country: "Inglaterra", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
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
  "8313": { id: 239, name: "Copa BetPlay Dimayor", country: "Colombia", flag: "\u{1F1E8}\u{1F1F4}" },
  "745": { id: 128, name: "Liga Profesional Argentina", country: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  "8107": { id: 130, name: "Copa Argentina", country: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  "630": { id: 71, name: "Brasileir\xE3o S\xE9rie A", country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  "4007": { id: 72, name: "Brasileir\xE3o S\xE9rie B", country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  "8306": { id: 73, name: "Copa do Brasil", country: "Brasil", flag: "\u{1F1E7}\u{1F1F7}" },
  "640": { id: 265, name: "Primera Divisi\xF3n", country: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  "8312": { id: 266, name: "Copa Chile", country: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  "670": { id: 281, name: "Liga 1", country: "Per\xFA", flag: "\u{1F1F5}\u{1F1EA}" },
  "660": { id: 242, name: "LigaPro", country: "Ecuador", flag: "\u{1F1EA}\u{1F1E8}" },
  "680": { id: 268, name: "Campeonato Uruguayo", country: "Uruguay", flag: "\u{1F1FA}\u{1F1FE}" },
  "3934": { id: 250, name: "Primera Divisi\xF3n", country: "Paraguay", flag: "\u{1F1F5}\u{1F1FE}" },
  "3949": { id: 299, name: "Liga FUTVE", country: "Venezuela", flag: "\u{1F1FB}\u{1F1EA}" },
  "620": { id: 344, name: "Divisi\xF3n Profesional", country: "Bolivia", flag: "\u{1F1E7}\u{1F1F4}" },
  "760": { id: 262, name: "Liga MX", country: "M\xE9xico", flag: "\u{1F1F2}\u{1F1FD}" },
  "3932": { id: 263, name: "Liga de Expansi\xF3n MX", country: "M\xE9xico", flag: "\u{1F1F2}\u{1F1FD}" },
  "770": { id: 253, name: "MLS", country: "Estados Unidos", flag: "\u{1F1FA}\u{1F1F8}" },
  "21231": { id: 307, name: "Saudi Pro League", country: "Arabia Saudita", flag: "\u{1F1F8}\u{1F1E6}" },
  "750": { id: 98, name: "J1 League", country: "Jap\xF3n", flag: "\u{1F1EF}\u{1F1F5}" },
  "3960": { id: 103, name: "Eliteserien", country: "Noruega", flag: "\u{1F1F3}\u{1F1F4}" },
  "3945": { id: 113, name: "Allsvenskan", country: "Suecia", flag: "\u{1F1F8}\u{1F1EA}" },
  "3902": { id: 17, name: "AFC Champions League Elite", country: "Internacional", flag: "\u{1F30F}" },
  "2391": { id: 12, name: "CAF Champions League", country: "Internacional", flag: "\u{1F30D}" },
  "18000": { id: 20, name: "CAF Confederation Cup", country: "Internacional", flag: "\u{1F30D}" }
};
function resolveEspnInternationalLeague(name) {
  const normalized = name.toLowerCase().replace(/[._-]+/g, " ");
  const knownTournaments = [
    [/\b(caf champions league)\b/, "CAF Champions League", "\u{1F30D}"],
    [/\b(caf confederation cup)\b/, "CAF Confederation Cup", "\u{1F30D}"],
    [/\b(afcon|africa cup of nations).*(qualifiers|qualifying)\b/, "Clasificaci\xF3n AFCON", "\u{1F30D}"],
    [/\b(africa cup of nations|afcon)\b/, "Africa Cup of Nations", "\u{1F30D}"],
    [/\b(afc champions league elite)\b/, "AFC Champions League Elite", "\u{1F30F}"],
    [/\b(afc champions league (two|2))\b/, "AFC Champions League Two", "\u{1F30F}"],
    [/\b(afc champions league)\b/, "AFC Champions League", "\u{1F30F}"],
    [/\b(afc asian cup)\b/, "AFC Asian Cup", "\u{1F30F}"],
    [/\b(concacaf champions cup)\b/, "CONCACAF Champions Cup", "\u{1F30E}"],
    [/\b(copa centroamericana|concacaf central american cup)\b/, "Copa Centroamericana CONCACAF", "\u{1F30E}"],
    [/\b(copa centroamericana|concacaf central american cup)\b/, "Copa Centroamericana CONCACAF", "\u{1F30E}"],
    [/\b(concacaf champions league)\b/, "CONCACAF Champions League", "\u{1F30E}"],
    [/\b(gold cup|copa oro)\b/, "CONCACAF Gold Cup", "\u{1F30E}"],
    [/\b(concacaf nations league)\b/, "CONCACAF Nations League", "\u{1F30E}"],
    [/\b(eliminatorias|qualifiers|qualifying).*conmebol\b|\bconmebol.*(qualifiers|qualifying)\b/, "Eliminatorias CONMEBOL", "\u{1F30E}"],
    [/\b(eliminatorias|qualifiers|qualifying).*afc\b|\bafc.*(qualifiers|qualifying)\b/, "Eliminatorias AFC", "\u{1F30F}"],
    [/\b(clasificacion afcon|qualification afcon|qualifiers afcon)\b/, "Clasificaci\xF3n AFCON", "\u{1F30D}"],
    [/\b(afcon|africa cup of nations).*(qualifiers|qualifying)\b/, "Clasificaci\xF3n AFCON", "\u{1F30D}"],
    [/\b(fifa friendlies|international friendlies|amistosos internacionales)\b/, "Amistosos FIFA", "\u{1F30D}"],
    [/\b(leagues cup)\b/, "Leagues Cup", "\u{1F30E}"],
    [/\b(copa libertadores|libertadores)\b/, "Copa Libertadores", "\u{1F30E}"],
    [/\b(copa sudamericana|sudamericana)\b/, "Copa Sudamericana", "\u{1F30E}"],
    [/\b(recopa sudamericana|recopa)\b/, "Recopa Sudamericana", "\u{1F30E}"],
    [/\b(copa america|copa am[eé]rica)\b/, "Copa Am\xE9rica", "\u{1F30E}"],
    [/\b(uefa )?champions league\b|\buefa champions\b/, "UEFA Champions League", "\u2B50"],
    [/\b(uefa )?europa league\b/, "UEFA Europa League", "\u2B50"],
    [/\b(uefa )?conference league\b/, "UEFA Conference League", "\u2B50"],
    [/\b(uefa super cup)\b/, "UEFA Super Cup", "\u2B50"],
    [/\b(uefa nations league)\b/, "UEFA Nations League", "\u2B50"],
    [/\b(eliminatorias|qualifiers|qualifying).*conmebol\b|\bconmebol.*(qualifiers|qualifying)\b/, "Eliminatorias CONMEBOL", "\u{1F30E}"],
    [/\b(eliminatorias|qualifiers|qualifying).*afc\b|\bafc.*(qualifiers|qualifying)\b/, "Eliminatorias AFC", "\u{1F30F}"],
    [/\b(fifa friendlies|international friendlies|amistosos internacionales)\b/, "Amistosos FIFA", "\u{1F30D}"],
    [/\b(uefa european championship|european championship|uefa euro|eurocopa)\b/, "UEFA European Championship", "\u2B50"],
    [/\b(fifa club world cup|club world cup|mundial de clubes)\b/, "FIFA Club World Cup", "\u{1F30D}"],
    [/\b(fifa world cup|world cup|copa mundial)\b/, "FIFA World Cup", "\u{1F30D}"]
  ];
  for (const [pattern, tournamentName, flag] of knownTournaments) {
    if (pattern.test(normalized)) return { name: tournamentName, flag };
  }
  return null;
}
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
  USA: { country: "Estados Unidos", flag: "\u{1F1FA}\u{1F1F8}" },
  Japan: { country: "Jap\xF3n", flag: "\u{1F1EF}\u{1F1F5}" },
  Norway: { country: "Noruega", flag: "\u{1F1F3}\u{1F1F4}" },
  Sweden: { country: "Suecia", flag: "\u{1F1F8}\u{1F1EA}" }
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
    const res = await fetchWithStrictTimeout(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
        },
        timeoutMs: 4500
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const espnLeagues = new Map(
      (Array.isArray(data?.leagues) ? data.leagues : []).map((league) => [String(league?.id || ""), league])
    );
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
      const espnLeague = espnLeagues.get(espnLeagueId);
      const countryTranslated = COUNTRY_TRANSLATION_MAP[rawCountry];
      const clockParsed = parseEspnMatchStatusAndClock(ev);
      const isLive = clockParsed.isLive;
      const elapsedMin = clockParsed.elapsedMin;
      const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "Local");
      const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "Visitante");
      const espnEventId = String(ev.id || "");
      const slug = String(ev?.season?.slug || "Jornada Regular").replace(/-/g, " ");
      const rawLeagueName = String(
        espnLeague?.displayName || espnLeague?.name || ev?.league?.displayName || ev?.league?.name || comp?.league?.displayName || comp?.league?.name || comp?.notes?.[0]?.headline || ev?.season?.displayName || ev?.season?.name || espnLeague?.slug || slug
      );
      const internationalLeague = resolveEspnInternationalLeague(`${rawLeagueName} ${espnLeague?.slug || ""} ${slug} ${rawUid}`);
      const isNatTeamMatch = !catalogEntry && isServerNationalTeamSub17PlusMatch(slug, rawCountry, homeName, awayName);
      const leagueId = catalogEntry?.id || parseInt(espnLeagueId, 10) || 1;
      const countryName = internationalLeague ? "Internacional" : isNatTeamMatch ? "Internacional" : catalogEntry?.country || countryTranslated?.country || rawCountry;
      const flag = internationalLeague?.flag || (isNatTeamMatch ? "\u{1F30D}" : catalogEntry?.flag || countryTranslated?.flag || "\u26BD");
      let leagueName = internationalLeague?.name || catalogEntry?.name || rawLeagueName || `Liga ${countryName}`;
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
        },
        sourceProviders: ["ESPN"]
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
function mapFootballDataMatch(match) {
  const competition = match?.competition;
  const home = match?.homeTeam;
  const away = match?.awayTeam;
  const timestampMs = match?.utcDate ? new Date(match.utcDate).getTime() : 0;
  if (!competition?.name || !home?.name || !away?.name || !timestampMs) return null;
  const statusMap = {
    SCHEDULED: "NS",
    TIMED: "NS",
    IN_PLAY: "LIVE",
    PAUSED: "HT",
    FINISHED: "FT",
    POSTPONED: "PST",
    SUSPENDED: "SUSP",
    CANCELLED: "CANC",
    AWARDED: "AWD"
  };
  const area = match?.area || competition?.area || {};
  const competitionCode = String(competition?.code || "").toUpperCase();
  const isLibertadores = competitionCode === "CLI" || /libertadores/i.test(competition.name);
  const country = isLibertadores ? "South America" : String(area?.name || "Europe");
  return {
    fixture: {
      id: match.id,
      date: match.utcDate,
      timestamp: Math.floor(timestampMs / 1e3),
      status: { short: statusMap[String(match.status || "").toUpperCase()] || "NS", elapsed: null },
      venue: { name: match.venue || "Estadio oficial", city: country }
    },
    league: {
      id: Number(competition.id) || 1,
      name: isLibertadores ? "Copa Libertadores" : String(competition.name),
      country,
      flag: area.flag || (isLibertadores ? "\u{1F30E}" : "\u26BD"),
      round: match.matchday ? `Jornada ${match.matchday}` : String(match.stage || "Jornada Regular")
    },
    teams: {
      home: { id: Number(home.id) || 1, name: String(home.name), logo: String(home.crest || "") },
      away: { id: Number(away.id) || 2, name: String(away.name), logo: String(away.crest || "") }
    },
    goals: { home: match.score?.fullTime?.home ?? null, away: match.score?.fullTime?.away ?? null },
    sourceProviders: ["Football-Data.org"]
  };
}
async function fetchFootballDataFixtures(targetDate) {
  const token = getSecretKey("FOOTBALL_DATA_KEY");
  if (!token) return [];
  const cacheKey = `footballdata_schedule_v1_${targetDate}`;
  const cacheTtlMs = 6 * 60 * 60 * 1e3;
  const cached = getCacheItem(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
    footballDataCacheHits++;
    serverCacheHits++;
    return cached.data.items;
  }
  if (isSupabaseConfigured()) {
    try {
      const remote = await getSupabaseKvCache(cacheKey);
      if (remote && Array.isArray(remote.data?.items) && Date.now() - remote.timestamp < cacheTtlMs) {
        memoryCache.set(cacheKey, { data: remote.data, timestamp: remote.timestamp });
        persistCacheToDisk();
        footballDataCacheHits++;
        serverCacheHits++;
        return remote.data.items;
      }
    } catch {
    }
  }
  return runSingleFlight(cacheKey, async () => {
    const params = new URLSearchParams({
      dateFrom: targetDate,
      dateTo: targetDate
    });
    let matches = [];
    let complete = false;
    serverCacheMisses++;
    footballDataRequestsSinceBoot++;
    try {
      const response = await fetchWithStrictTimeout(`https://api.football-data.org/v4/matches?${params.toString()}`, {
        headers: {
          "X-Auth-Token": token,
          "User-Agent": "SportStatsPro/3.0 (Zero-Cost Analytics Engine)"
        },
        timeoutMs: 4500
      });
      if (response.ok) {
        const payload = await response.json();
        matches = Array.isArray(payload?.matches) ? payload.matches : [];
        complete = true;
        footballDataLastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    } catch {
    }
    const fixtures = matches.map(mapFootballDataMatch).filter(Boolean);
    setCacheItem(cacheKey, { items: fixtures, complete });
    if (isSupabaseConfigured()) {
      await setSupabaseKvCache(cacheKey, { items: fixtures, complete }).catch(() => false);
    }
    saveTelemetrySnapshotToCache(true);
    return fixtures;
  });
}
function mergeProviderFixtures(fixtures) {
  const merged = [];
  for (const fixture of fixtures) {
    const home = normalizeTeamKey(fixture?.teams?.home?.name || "");
    const away = normalizeTeamKey(fixture?.teams?.away?.name || "");
    if (!home || !away) continue;
    const duplicate = merged.find((existing) => {
      const existingHome = normalizeTeamKey(existing?.teams?.home?.name || "");
      const existingAway = normalizeTeamKey(existing?.teams?.away?.name || "");
      return teamsFuzzyMatch(home, away, existingHome, existingAway) || teamsFuzzyMatch(home, away, existingAway, existingHome);
    });
    if (!duplicate) {
      merged.push(fixture);
      continue;
    }
    duplicate.sourceProviders = Array.from(
      /* @__PURE__ */ new Set([...duplicate.sourceProviders || [], ...fixture.sourceProviders || []])
    );
    duplicate.league.round = duplicate.league.round || fixture.league.round;
    duplicate.teams.home.logo ||= fixture.teams.home.logo;
    duplicate.teams.away.logo ||= fixture.teams.away.logo;
    duplicate.league.name = duplicate.league.name || fixture.league.name;
    const primaryHomeScore = duplicate.goals?.home;
    const primaryAwayScore = duplicate.goals?.away;
    const secondaryHomeScore = fixture.goals?.home;
    const secondaryAwayScore = fixture.goals?.away;
    if (Number.isFinite(primaryHomeScore) && Number.isFinite(primaryAwayScore) && Number.isFinite(secondaryHomeScore) && Number.isFinite(secondaryAwayScore)) {
      duplicate.footballDataCrossCheck = {
        homeScore: secondaryHomeScore,
        awayScore: secondaryAwayScore,
        matchesPrimary: primaryHomeScore === secondaryHomeScore && primaryAwayScore === secondaryAwayScore
      };
    } else if (!Number.isFinite(primaryHomeScore) && Number.isFinite(secondaryHomeScore)) {
      duplicate.goals = { ...duplicate.goals, home: secondaryHomeScore, away: secondaryAwayScore };
    }
  }
  return merged;
}
var SERVER_ALLOWED_PRIME_COUNTRIES = {
  COLOMBIA: {
    countryMatches: ["colombia"],
    allowedLeaguesPattern: /\b(primera a|liga betplay|copa betplay|copa colombia|superliga)\b/i
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
    allowedLeaguesPattern: /\b(liga profesional|primera divisi[oó]n|copa de la liga|copa argentina|trofeo de campeones)\b/i,
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
    allowedLeaguesPattern: /\b(primera divisi[oó]n|copa chile|supercopa)\b/i,
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
  },
  NORWAY: {
    countryMatches: ["norway", "noruega"],
    allowedLeaguesPattern: /\b(eliteserien)\b/i,
    excludedLeaguesPattern: /\b(obos ligaen|2\. divisjon|3\. divisjon|women|u19|u21)\b/i
  },
  SWEDEN: {
    countryMatches: ["sweden", "suecia"],
    allowedLeaguesPattern: /\b(allsvenskan)\b/i,
    excludedLeaguesPattern: /\b(superettan|ettan|women|u19|u21)\b/i
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
  const isEliteIntlCountry = ["world", "europe", "south america", "north & central america", "asia", "africa", "international", "europa", "uefa", "conmebol", "concacaf", "afc", "caf", "sudam\xE9rica", "sudamerica", "internacional"].some(
    (ic) => cName === ic || cName.includes(ic)
  );
  const isEliteIntlTournament = /\b(uefa champions league|champions league|uefa europa league|europa league|uefa conference league|conference league|uefa super cup|uefa nations league|european championship|eurocopa|caf champions league|caf confederation cup|africa cup of nations|afcon|afc champions league|afc asian cup|copa libertadores|libertadores|copa sudamericana|sudamericana|recopa|copa america|copa am[eé]rica|world cup|mundial|nations league|eliminatorias|wc qualification|world cup qualification|concacaf champions cup|concacaf champions league|leagues cup|gold cup|copa oro|club world cup|fifa intercontinental cup)\b/i.test(
    lName
  ) && !/\b(ofc|afc cup|asean|cosafa|cecafa|wafcon|u17|u20|u23|women|youth)\b/i.test(`${lName} ${cName}`);
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
async function fetchHybridSoccerFixtures(targetDate, clientTz) {
  const [espnFixtures, footballDataFixtures] = await Promise.all([
    fetchEspnSoccerFixtures(targetDate, clientTz),
    fetchFootballDataFixtures(targetDate)
  ]);
  const fixtures = filterActiveUpcomingFixtures(
    mergeProviderFixtures([...espnFixtures, ...footballDataFixtures]),
    targetDate,
    clientTz
  );
  fixtures.sort((a, b) => {
    const aLive = ["1H", "2H", "HT", "ET", "1ET", "2ET", "PEN", "LIVE"].includes(
      String(a.fixture?.status?.short || "").toUpperCase()
    );
    const bLive = ["1H", "2H", "HT", "ET", "1ET", "2ET", "PEN", "LIVE"].includes(
      String(b.fixture?.status?.short || "").toUpperCase()
    );
    if (aLive !== bLive) return aLive ? -1 : 1;
    return Number(a.fixture?.timestamp || 0) - Number(b.fixture?.timestamp || 0);
  });
  return fixtures;
}
app.get(["/api/upcoming", "/api/matches"], dataRateLimitMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  const requestedDate = req.query.date || "";
  const clientTz = (req.query.tz || "America/Bogota").trim() || "America/Bogota";
  const query = (req.query.q || "").toLowerCase().trim();
  const force = req.query.force === "true" && isValidAdminPin(extractAdminCredential(req), getAdminConfig());
  const todayLocal = getColombiaDateStr(0, clientTz);
  const targetDate = requestedDate || todayLocal;
  const cacheKey = `upcoming_v10_${targetDate}`;
  const cached = getCacheItem(cacheKey);
  const nowMs = Date.now();
  const hasLiveOrStartedInCache = cached && Array.isArray(cached.data) && cached.data.some((f) => {
    const s = String(f?.fixture?.status?.short || "").toUpperCase();
    if (["1H", "2H", "HT", "ET", "1ET", "2ET", "LIVE", "BT", "P", "PEN", "INT"].includes(s)) return true;
    const mTime = f?.fixture?.timestamp ? f.fixture.timestamp * 1e3 : new Date(f?.fixture?.date || 0).getTime();
    return mTime > 0 && mTime <= nowMs;
  });
  const cacheTTL = targetDate === todayLocal ? hasLiveOrStartedInCache ? 20 * 1e3 : 2 * 60 * 1e3 : 6 * 60 * 60 * 1e3;
  if (cached && Array.isArray(cached.data) && cached.data.length > 0 && !query && !force) {
    const cacheAge = nowMs - cached.timestamp;
    if (cacheAge < cacheTTL) {
      const activeList = filterActiveUpcomingFixtures(cached.data, targetDate, clientTz);
      if (activeList.length > 0) {
        serverCacheHits++;
        return res.json({
          success: true,
          source: "persistent_disk_cache",
          cachedAt: cached.timestamp,
          count: activeList.length,
          fixtures: activeList
        });
      }
    }
  }
  try {
    const resultList = await runSingleFlight(cacheKey, async () => {
      const fixtures = await fetchHybridSoccerFixtures(targetDate, clientTz);
      if (fixtures.length > 0) setCacheItem(cacheKey, fixtures);
      return fixtures;
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
      count: filtered.length,
      fixtures: filtered
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return res.json({
        success: true,
        source: "fallback_disk_cache",
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
        auditPendingSmartParlaysWithFinishedMatches(results, nbaFinishedEvents).catch(() => {
        });
      }
      return payload;
    });
    if (auditPayload) {
      auditPendingSmartParlaysWithFinishedMatches(auditPayload.fixtures || [], auditPayload.nbaEvents || []).catch(() => {
      });
    }
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
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
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
      deltas: cachedPulse.data
    });
  }
  try {
    const deltas = await runSingleFlight(pulseCacheKey, async () => {
      espnPulseCallsCount++;
      const liveDeltas = [];
      try {
        const espnRes = await fetchWithStrictTimeout(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
            },
            timeoutMs: 4500
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
      const upcomingCache = getCacheItem(`upcoming_v10_${targetDate}`);
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
              liveStats: f.liveStats,
              liveEvents: f.liveEvents || [],
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
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
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
      const sbRes = await fetchWithStrictTimeout(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}&limit=300`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
          },
          timeoutMs: 4500
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
    return res.json({ success: true, found: false, message: "El evento no aparece en el scoreboard de ESPN." });
  } catch (err) {
    return res.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});
app.get("/api/nba/scoreboard", dataRateLimitMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
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
            const apiRes = await fetchWithStrictTimeout(ep.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
              },
              timeoutMs: 4500
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
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  const date = req.query.date || getColombiaDateStr(0);
  const sharedUpcoming = getCacheItem(`upcoming_v8_${date}`);
  if (sharedUpcoming && Array.isArray(sharedUpcoming.data) && sharedUpcoming.data.length > 0) {
    return res.status(200).json({
      success: true,
      source: "persistent_disk_cache",
      fixtures: sharedUpcoming.data
    });
  }
  try {
    const espnFallback = await fetchEspnSoccerFixtures(date, "America/Bogota");
    return res.status(200).json({
      success: true,
      source: "espn_official_coalesced",
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
  const hasFootballData = Boolean(getSecretKey("FOOTBALL_DATA_KEY"));
  const hasOddsApi = Boolean(getSecretKey("ODDS_API_KEY"));
  const hasBallDontLie = Boolean(getSecretKey("BALLDONTLIE_API_KEY"));
  const onlineUsers = getActiveOnlineUsersList();
  const totalRequests = serverCacheHits + serverCacheMisses;
  const cacheHitRatePct = totalRequests > 0 ? Math.round(serverCacheHits / totalRequests * 1e3) / 10 : 100;
  return res.json({
    success: true,
    status: "ok",
    soccerEngine: "ESPN + Football-Data.org",
    espnSoccer: true,
    footballData: hasFootballData,
    footballDataRequestsSinceBoot,
    footballDataCacheHits,
    footballDataLastSuccessAt,
    footballDataCacheTtlHours: 6,
    oddsApi: hasOddsApi,
    ballDontLie: hasBallDontLie,
    cachedEntriesCount: memoryCache.size,
    cacheTtlMinutes: 120,
    scheduleTTLHours: 6,
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
    bundleVersion: "v3.0-official-soccer-hybrid-6h",
    isVercel: IS_VERCEL2,
    supabasePersistence: isSupabaseConfigured(),
    serverReady: true
  });
});
app.get("/api/market-odds", dataRateLimitMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  const sport = sanitizeText(req.query.sport || "soccer_epl", 32);
  const isVip = Boolean(req.isVipUser);
  if (!isVip) {
    return res.json({
      success: true,
      isVip: false,
      source: "zero_trust_masked",
      sport,
      odds: [],
      message: "Las cuotas de mercado en tiempo real requieren suscripci\xF3n VIP activa."
    });
  }
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
      const apiRes = await fetchWithStrictTimeout(targetUrl, { method: "GET", timeoutMs: 4500 });
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
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=180");
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
      const apiRes = await fetchWithStrictTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
        },
        timeoutMs: 4500
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
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
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
          const apiRes = await fetchWithStrictTimeout(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0"
            },
            timeoutMs: 4500
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
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=43200");
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
      const apiRes = await fetchWithStrictTimeout(`https://api.football-data.org/v4/competitions/${encodeURIComponent(league)}/standings`, {
        headers: {
          "X-Auth-Token": fdKey,
          "User-Agent": "SportStatsPro/3.0 (Zero-Cost Analytics Engine)"
        },
        timeoutMs: 4500
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
  let rawIncomingUser = String(username || "");
  if (rawIncomingUser.startsWith("{") || rawIncomingUser.includes('"username"') || rawIncomingUser.includes("admin-owner")) {
    try {
      const parsed = JSON.parse(rawIncomingUser);
      rawIncomingUser = parsed.username || parsed.displayName || parsed.id || "admin";
    } catch {
      const m = rawIncomingUser.match(/"username"\s*:\s*"([^"]+)"/) || rawIncomingUser.match(/"id"\s*:\s*"([^"]+)"/);
      if (m && m[1]) rawIncomingUser = m[1];
    }
  }
  const cleanUsername = rawIncomingUser ? sanitizeText(rawIncomingUser, 40).toLowerCase() : "";
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
      if (result.sessionToken) {
        setSecureSessionCookie(res, result.sessionToken, req);
      }
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
app.get("/api/auth/session", async (req, res) => {
  const session = extractSessionFromRequest(req);
  if (!session) {
    return res.json({
      success: true,
      authenticated: false,
      isVip: false,
      user: null
    });
  }
  let latestExpiresAt = session.expiresAt;
  let latestRole = session.role;
  let latestUsername = session.username;
  let isSuspended = false;
  if (isSupabaseConfigured() && session.sub && session.sub !== "admin-owner") {
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data: dbUser } = await client.from("sportstats_users").select("expires_at, role, status, username").eq("id", session.sub).maybeSingle();
        if (dbUser) {
          if (dbUser.status === "suspended" || dbUser.status === "deleted") {
            isSuspended = true;
          } else {
            latestExpiresAt = dbUser.expires_at ? Number(dbUser.expires_at) : null;
            latestRole = dbUser.role || session.role;
            if (dbUser.username) latestUsername = dbUser.username;
          }
        }
      }
    } catch (err) {
      console.warn("[Session Sync Warning]: Fallback a claims de JWT por error de BD:", err);
    }
  }
  if (isSuspended) {
    clearSecureSessionCookie(res);
    return res.json({
      success: true,
      authenticated: false,
      isVip: false,
      user: null,
      message: "Cuenta suspendida o eliminada"
    });
  }
  const isVip = Boolean(
    latestRole === "admin" || (latestExpiresAt ? latestExpiresAt > Date.now() : true)
  );
  if (latestExpiresAt !== session.expiresAt || latestRole !== session.role) {
    const refreshedJwt = createSessionJwt({
      userId: session.sub,
      username: latestUsername,
      role: latestRole,
      deviceId: session.deviceId,
      isVip,
      expiresAt: latestExpiresAt,
      ttlDays: 30
    });
    setSecureSessionCookie(res, refreshedJwt, req);
  }
  return res.json({
    success: true,
    authenticated: true,
    isVip,
    user: {
      id: session.sub,
      username: latestUsername,
      role: latestRole,
      deviceId: session.deviceId,
      isVip,
      expiresAt: latestExpiresAt ?? null
    }
  });
});
app.post("/api/auth/logout", (_req, res) => {
  clearSecureSessionCookie(res);
  return res.json({ success: true, message: "Sesi\xF3n cerrada exitosamente." });
});
app.get("/api/auth/config", (req, res) => {
  return res.json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || null
  });
});
app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, displayName, deviceId, deviceName, fingerprint, accessToken, providerToken } = req.body || {};
    const clientIp = getClientIp(req);
    const subnetHash = calculateSubnetHash(clientIp);
    const result = await loginOrRegisterGoogleUser(
      email,
      displayName,
      deviceId,
      deviceName,
      fingerprint,
      accessToken,
      providerToken,
      subnetHash
    );
    if (result.success && result.user) {
      if (result.sessionToken) {
        setSecureSessionCookie(res, result.sessionToken, req);
      }
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
    if (result.success && result.user) {
      const cleanDev = sanitizeText(String(result.user.boundDeviceId || req.headers["x-device-id"] || ""), 48).toUpperCase();
      const updatedJwt = createSessionJwt({
        userId: result.user.id || "client",
        username: result.user.username || "user",
        role: result.user.role === "admin" ? "admin" : "client",
        deviceId: cleanDev,
        isVip: true,
        expiresAt: result.user.expiresAt,
        ttlDays: 30
      });
      setSecureSessionCookie(res, updatedJwt, req);
      result.sessionToken = updatedJwt;
    }
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
var SMART_PARLAYS_STORAGE_KEY = "__gmetrics_smart_parlays_v3__";
async function loadSmartParlaysStore() {
  let loadedStore = null;
  const cached = getCacheItem(SMART_PARLAYS_STORAGE_KEY);
  if (cached && cached.data && Array.isArray(cached.data.slips)) {
    loadedStore = cached.data;
  } else if (isSupabaseConfigured()) {
    try {
      const remote = await getSupabaseKvCache(SMART_PARLAYS_STORAGE_KEY);
      if (remote && remote.data && Array.isArray(remote.data.slips)) {
        loadedStore = remote.data;
      }
    } catch {
    }
  }
  if (loadedStore) {
    const cleanSlips = loadedStore.slips.filter(
      (s) => s && s.id && !s.id.includes("seed") && !s.id.includes("_seed_") && !s.legs?.some((l) => String(l.fixtureId || "").startsWith("seed_"))
    );
    if (cleanSlips.length !== loadedStore.slips.length) {
      loadedStore.slips = cleanSlips;
      loadedStore.updatedAt = Date.now();
      setCacheItem(SMART_PARLAYS_STORAGE_KEY, loadedStore);
      if (isSupabaseConfigured()) {
        setSupabaseKvCache(SMART_PARLAYS_STORAGE_KEY, loadedStore).catch(() => {
        });
      }
    } else {
      setCacheItem(SMART_PARLAYS_STORAGE_KEY, loadedStore);
    }
    return loadedStore;
  }
  const initialStore = {
    updatedAt: Date.now(),
    slips: []
  };
  setCacheItem(SMART_PARLAYS_STORAGE_KEY, initialStore);
  if (isSupabaseConfigured()) {
    setSupabaseKvCache(SMART_PARLAYS_STORAGE_KEY, initialStore).catch(() => {
    });
  }
  return initialStore;
}
async function saveSmartParlaysStore(store) {
  store.updatedAt = Date.now();
  setCacheItem(SMART_PARLAYS_STORAGE_KEY, store);
  if (isSupabaseConfigured()) {
    try {
      await setSupabaseKvCache(SMART_PARLAYS_STORAGE_KEY, store);
    } catch {
    }
  }
}
function evaluateLegResult(leg, finishedMatch) {
  if (!finishedMatch) return "PENDING";
  const homeGoals = Number(finishedMatch.goals?.home ?? finishedMatch.currentScore?.home ?? 0);
  const awayGoals = Number(finishedMatch.goals?.away ?? finishedMatch.currentScore?.away ?? 0);
  const totalGoals = homeGoals + awayGoals;
  const homeCorners = Number(finishedMatch.liveStats?.home?.corners ?? 0);
  const awayCorners = Number(finishedMatch.liveStats?.away?.corners ?? 0);
  const totalCorners = homeCorners + awayCorners;
  const cat = String(leg.category);
  const label = leg.label.toLowerCase();
  switch (cat) {
    case "1X2":
    case "ONE_X_TWO": {
      if (label.includes("(1)") || label.includes("gana " + (finishedMatch.teams?.home?.name || "").toLowerCase())) {
        return homeGoals > awayGoals ? "WON" : "LOST";
      }
      if (label.includes("(2)") || label.includes("gana " + (finishedMatch.teams?.away?.name || "").toLowerCase())) {
        return awayGoals > homeGoals ? "WON" : "LOST";
      }
      if (label.includes("(x)") || label.includes("empate")) {
        return homeGoals === awayGoals ? "WON" : "LOST";
      }
      return "LOST";
    }
    case "DOUBLE_CHANCE": {
      if (label.includes("1x") || label.includes("local o empate")) {
        return homeGoals >= awayGoals ? "WON" : "LOST";
      }
      if (label.includes("x2") || label.includes("empate o") || label.includes("o empate")) {
        return awayGoals >= homeGoals ? "WON" : "LOST";
      }
      if (label.includes("12") || label.includes("cualquiera gana")) {
        return homeGoals !== awayGoals ? "WON" : "LOST";
      }
      return "LOST";
    }
    case "TOTAL_GOALS": {
      if (label.includes("1.5")) {
        return label.includes("m\xE1s") || label.includes("over") ? totalGoals > 1.5 ? "WON" : "LOST" : totalGoals < 1.5 ? "WON" : "LOST";
      }
      if (label.includes("2.5")) {
        return label.includes("m\xE1s") || label.includes("over") ? totalGoals > 2.5 ? "WON" : "LOST" : totalGoals < 2.5 ? "WON" : "LOST";
      }
      return totalGoals > 1.5 ? "WON" : "LOST";
    }
    case "BTTS": {
      const bttsHit = homeGoals > 0 && awayGoals > 0;
      if (label.includes("s\xED") || label.includes("si") || label.includes("yes")) {
        return bttsHit ? "WON" : "LOST";
      }
      if (label.includes("no")) {
        return !bttsHit ? "WON" : "LOST";
      }
      return "LOST";
    }
    case "TOTAL_CORNERS_MATCH": {
      if (label.includes("7.5")) {
        return totalCorners > 7.5 ? "WON" : "LOST";
      }
      if (label.includes("8.5")) {
        return totalCorners > 8.5 ? "WON" : "LOST";
      }
      if (label.includes("9.5")) {
        return totalCorners > 9.5 ? "WON" : "LOST";
      }
      if (label.includes("10.5")) {
        return label.includes("menos") ? totalCorners < 10.5 ? "WON" : "LOST" : totalCorners > 10.5 ? "WON" : "LOST";
      }
      return totalCorners > 8.5 ? "WON" : "LOST";
    }
    case "TOTAL_CARDS": {
      const homeYellows = Number(finishedMatch.liveStats?.home?.yellowCards ?? 0);
      const awayYellows = Number(finishedMatch.liveStats?.away?.yellowCards ?? 0);
      const totalCards = homeYellows + awayYellows;
      if (label.includes("3.5")) {
        return label.includes("m\xE1s") || label.includes("over") ? totalCards > 3.5 ? "WON" : "LOST" : totalCards < 3.5 ? "WON" : "LOST";
      }
      if (label.includes("4.5")) {
        return label.includes("m\xE1s") || label.includes("over") ? totalCards > 4.5 ? "WON" : "LOST" : totalCards < 4.5 ? "WON" : "LOST";
      }
      if (label.includes("5.5")) {
        return label.includes("menos") ? totalCards < 5.5 ? "WON" : "LOST" : totalCards > 5.5 ? "WON" : "LOST";
      }
      return totalCards > 3.5 ? "WON" : "LOST";
    }
    case "PLAYER_SHOTS_ON_TARGET": {
      return "PENDING";
    }
    case "HALF_WITH_MOST_GOALS": {
      if (label.includes("2.\xAA mitad") || label.includes("2\xAA mitad") || label.includes("segunda mitad")) {
        if (label.includes("0.5")) {
          const events = Array.isArray(finishedMatch.events || finishedMatch.liveEvents) ? finishedMatch.events || finishedMatch.liveEvents : [];
          const secondHalfGoals = events.filter((e) => e.type === "GOAL" && Number(e.minute) > 45).length;
          if (secondHalfGoals > 0) return "WON";
          if (finishedMatch.status === "FINISHED" || finishedMatch.statusShort === "FT") {
            return "LOST";
          }
          return "PENDING";
        }
      }
      return "PENDING";
    }
    case "DRAW_NO_BET": {
      if (homeGoals === awayGoals) {
        return "VOID";
      }
      if (label.includes("local") || label.includes(String(finishedMatch.teams?.home?.name || "").toLowerCase())) {
        return homeGoals > awayGoals ? "WON" : "LOST";
      }
      return awayGoals > homeGoals ? "WON" : "LOST";
    }
    case "NBA_TOTAL_POINTS": {
      const isPlayerProp = label.includes(":") || label.includes("triples");
      if (isPlayerProp) {
        return "PENDING";
      }
      const matchLine = label.match(/(\d+(?:\.\d+)?)/);
      const line = matchLine ? parseFloat(matchLine[1]) : 0;
      if (line > 0) {
        const totalPoints = homeGoals + awayGoals;
        if (label.includes("m\xE1s") || label.includes("over")) {
          return totalPoints > line ? "WON" : "LOST";
        }
        if (label.includes("menos") || label.includes("under")) {
          return totalPoints < line ? "WON" : "LOST";
        }
      }
      return "PENDING";
    }
    case "NBA_PLAYER_POINTS":
    case "NBA_PLAYER_THREES": {
      return "PENDING";
    }
    case "NBA_MONEYLINE": {
      const hName = String(finishedMatch.teams?.home?.name || "").toLowerCase();
      const aName = String(finishedMatch.teams?.away?.name || "").toLowerCase();
      if (hName && label.includes(hName.split(" ")[0])) {
        return homeGoals > awayGoals ? "WON" : "LOST";
      }
      if (aName && label.includes(aName.split(" ")[0])) {
        return awayGoals > homeGoals ? "WON" : "LOST";
      }
      return "PENDING";
    }
    case "NBA_SPREAD": {
      const matchSpread = label.match(/([+-]?\d+(?:\.\d+)?)/);
      const spreadVal = matchSpread ? parseFloat(matchSpread[1]) : 0;
      const hName = String(finishedMatch.teams?.home?.name || "").toLowerCase();
      const aName = String(finishedMatch.teams?.away?.name || "").toLowerCase();
      if (hName && label.includes(hName.split(" ")[0])) {
        return homeGoals + spreadVal > awayGoals ? "WON" : "LOST";
      }
      if (aName && label.includes(aName.split(" ")[0])) {
        return awayGoals + spreadVal > homeGoals ? "WON" : "LOST";
      }
      return "PENDING";
    }
    default:
      return "PENDING";
  }
}
async function auditPendingSmartParlaysWithFinishedMatches(finishedFixtures, finishedNBAEvents = []) {
  const normFixtures = Array.isArray(finishedFixtures) ? finishedFixtures : [];
  const normNBA = (Array.isArray(finishedNBAEvents) ? finishedNBAEvents : []).map((bev) => {
    if (!bev) return null;
    const comp = bev.competitions?.[0];
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
    const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
    const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "");
    const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "");
    const homeScore = parseInt(String(homeComp?.score ?? "0"), 10) || 0;
    const awayScore = parseInt(String(awayComp?.score ?? "0"), 10) || 0;
    return {
      id: String(bev.id || ""),
      espnEventId: String(bev.id || ""),
      sport: "NBA",
      teams: {
        home: { name: homeName },
        away: { name: awayName }
      },
      goals: {
        home: homeScore,
        away: awayScore
      },
      currentScore: {
        home: homeScore,
        away: awayScore
      },
      status: "FINISHED",
      rawEvent: bev
    };
  }).filter(Boolean);
  const allFinished = [...normFixtures, ...normNBA];
  if (allFinished.length === 0) return;
  const store = await loadSmartParlaysStore();
  const pendingSlips = store.slips.filter((s) => s.status === "PENDING");
  if (pendingSlips.length === 0) return;
  let modified = false;
  for (const slip of pendingSlips) {
    let hasLoss = false;
    let pendingCount = 0;
    let wonCount = 0;
    let voidCount = 0;
    for (const leg of slip.legs) {
      const matchedFixture = allFinished.find((f) => {
        if (!f) return false;
        if (String(f.id) === String(leg.fixtureId) || String(f.espnEventId) === String(leg.fixtureId)) return true;
        const hName = String(f.teams?.home?.name || "").toLowerCase();
        const aName = String(f.teams?.away?.name || "").toLowerCase();
        const lMatch = leg.matchName.toLowerCase();
        return hName && aName && lMatch.includes(hName.split(" ")[0]) && lMatch.includes(aName.split(" ")[0]);
      });
      if (!matchedFixture) {
        pendingCount++;
        continue;
      }
      const legRes = evaluateLegResult(leg, matchedFixture);
      if (legRes === "LOST") {
        hasLoss = true;
        break;
      } else if (legRes === "WON") {
        wonCount++;
      } else if (legRes === "VOID") {
        voidCount++;
      } else {
        pendingCount++;
      }
    }
    if (hasLoss) {
      slip.status = "LOST";
      slip.evaluationDate = (/* @__PURE__ */ new Date()).toISOString();
      modified = true;
    } else if (pendingCount === 0 && wonCount > 0) {
      slip.status = "WON";
      slip.evaluationDate = (/* @__PURE__ */ new Date()).toISOString();
      modified = true;
    } else if (pendingCount === 0 && voidCount === slip.legs.length) {
      slip.status = "VOID";
      slip.evaluationDate = (/* @__PURE__ */ new Date()).toISOString();
      modified = true;
    }
  }
  if (modified) {
    await saveSmartParlaysStore(store);
  }
}
app.get("/api/parlays/metrics", dataRateLimitMiddleware, async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado. M\xF3dulo Beta exclusivo para Administrador." });
  }
  clearAuthFailures(req);
  try {
    const store = await loadSmartParlaysStore();
    const todayStr = getColombiaDateStr(0);
    const todaySlips = store.slips.filter((s) => s.date === todayStr);
    if (todaySlips.length === 0) {
      const sharedUpcoming = getCacheItem(`upcoming_v10_${todayStr}`) || getCacheItem(`upcoming_v9_${todayStr}`) || getCacheItem(`upcoming_v8_${todayStr}`);
      const availableMatches = sharedUpcoming?.data || [];
      if (availableMatches.length >= 2) {
        const generated = generateSmartParlays(availableMatches, todayStr);
        if (generated.length > 0) {
          store.slips.unshift(...generated);
          await saveSmartParlaysStore(store);
        }
      }
    }
    const totalGenerated = store.slips.length;
    const totalWon = store.slips.filter((s) => s.status === "WON").length;
    const totalLost = store.slips.filter((s) => s.status === "LOST").length;
    const totalPending = store.slips.filter((s) => s.status === "PENDING").length;
    const totalVoid = store.slips.filter((s) => s.status === "VOID").length;
    const resolvedCount = totalWon + totalLost;
    const winRate = resolvedCount > 0 ? Number((totalWon / resolvedCount * 100).toFixed(1)) : 0;
    const avgOdds = totalGenerated > 0 ? Number((store.slips.reduce((acc, s) => acc + s.totalOdds, 0) / totalGenerated).toFixed(2)) : 0;
    let netProfitUnits = 0;
    for (const slip of store.slips) {
      if (slip.status === "WON") {
        netProfitUnits += slip.totalOdds - 1;
      } else if (slip.status === "LOST") {
        netProfitUnits -= 1;
      }
    }
    const netYieldUnits = Number(netProfitUnits.toFixed(2));
    const yieldPercent = resolvedCount > 0 ? Number((netProfitUnits / resolvedCount * 100).toFixed(1)) : 0;
    return res.json({
      success: true,
      metrics: {
        totalGenerated,
        totalWon,
        totalLost,
        totalPending,
        totalVoid,
        winRate,
        avgOdds,
        netYieldUnits,
        yieldPercent
      },
      slips: store.slips
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Error al consultar m\xE9tricas de parlays inteligentes",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});
app.post("/api/parlays/generate-day", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado. M\xF3dulo Beta exclusivo para Administrador." });
  }
  clearAuthFailures(req);
  try {
    const store = await loadSmartParlaysStore();
    const todayStr = getColombiaDateStr(0);
    const { fixtures: incomingFixtures, nbaFixtures: incomingNBAFixtures, force = true } = req.body || {};
    let candidateFixtures = [];
    if (Array.isArray(incomingFixtures) && incomingFixtures.length > 0) {
      candidateFixtures = incomingFixtures;
    } else {
      const sharedUpcoming = getCacheItem(`upcoming_v10_${todayStr}`) || getCacheItem(`upcoming_v9_${todayStr}`);
      candidateFixtures = sharedUpcoming?.data || [];
    }
    let candidateNBAFixtures = [];
    if (Array.isArray(incomingNBAFixtures) && incomingNBAFixtures.length > 0) {
      candidateNBAFixtures = incomingNBAFixtures;
    }
    if (candidateFixtures.length + candidateNBAFixtures.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Se requieren al menos 2 partidos activos con datos anal\xEDticos para generar parlays reales."
      });
    }
    const generated = generateSmartParlays(candidateFixtures, todayStr, candidateNBAFixtures);
    if (generated.length === 0) {
      return res.status(422).json({
        success: false,
        error: "No se encontraron combinaciones que cumplan los filtros cuantitativos de cuota y +EV para los partidos de hoy."
      });
    }
    if (force) {
      store.slips = store.slips.filter((s) => s.date !== todayStr);
    }
    store.slips.unshift(...generated);
    await saveSmartParlaysStore(store);
    return res.json({
      success: true,
      message: `Se generaron exitosamente ${generated.length} parlays reales para la jornada de hoy (${todayStr}).`,
      generatedCount: generated.length,
      slips: store.slips
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Error al generar parlays del d\xEDa",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});
app.post("/api/parlays/purge-seeds", async (req, res) => {
  if (checkAuthLockout(req, res)) return;
  const pin = extractAdminCredential(req);
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    await recordAuthFailure(req);
    return res.status(403).json({ success: false, error: "No autorizado." });
  }
  clearAuthFailures(req);
  try {
    const store = await loadSmartParlaysStore();
    const beforeCount = store.slips.length;
    store.slips = store.slips.filter(
      (s) => s && s.id && !s.id.includes("seed") && !s.id.includes("_seed_") && !s.legs?.some((l) => String(l.fixtureId || "").startsWith("seed_"))
    );
    const purgedCount = beforeCount - store.slips.length;
    await saveSmartParlaysStore(store);
    return res.json({
      success: true,
      purgedCount,
      remainingCount: store.slips.length,
      message: `Se purgaron ${purgedCount} boletos semilla residuales exitosamente.`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Error al purgar boletos semilla",
      details: err instanceof Error ? err.message : String(err)
    });
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
    const remote = await loadPermanentFeedbackList();
    if (remote && Array.isArray(remote)) {
      const normalized = normalizeFeedbackList(remote);
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
      await savePermanentFeedbackList(updatedList);
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
      await savePermanentFeedbackList(updatedList);
    }
    return res.json({ success: true, items: updatedList });
  } catch {
    return res.status(500).json({ success: false, error: "Error al eliminar calificaci\xF3n" });
  }
});
app.get("/api/push/vapid-public-key", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  res.json({
    publicKey: vapidPublicKey,
    status: "ok"
  });
});
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { subscription, matchIds, deviceId } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ error: "Suscripci\xF3n Web Push inv\xE1lida o incompleta" });
    }
    const session = req.userSession;
    await upsertPushSubscription({
      endpoint: String(subscription.endpoint),
      keys: {
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth)
      },
      matchIds: Array.isArray(matchIds) ? matchIds.map(String) : [],
      userId: session?.userId || void 0,
      deviceId: typeof deviceId === "string" ? deviceId : void 0,
      updatedAt: Date.now()
    });
    res.json({ success: true, message: "Dispositivo suscrito a notificaciones Push exitosamente." });
  } catch (err) {
    console.error("[Push Subscribe Error]:", err);
    res.status(500).json({ error: "Error registrando suscripci\xF3n push" });
  }
});
app.post("/api/push/send-alert", dataRateLimitMiddleware, async (req, res) => {
  try {
    const { matchId, title, body, icon, badge, url, tag } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: "T\xEDtulo de alerta requerido" });
    }
    const subscribers = await getActivePushSubscriptions(matchId ? String(matchId) : void 0);
    if (!subscribers || subscribers.length === 0) {
      return res.json({ success: true, delivered: 0, total: 0, message: "No hay suscriptores registrados para este partido" });
    }
    const payload = JSON.stringify({
      title: sanitizeText(String(title), 80),
      body: sanitizeText(String(body || "\xA1Evento de partido en vivo!"), 160),
      icon: icon || "/icon-512.png",
      badge: badge || "/icon.png",
      data: {
        url: url || "/",
        matchId: matchId ? String(matchId) : null,
        timestamp: Date.now()
      },
      tag: tag || `gmetrics-${matchId || "match-alert"}`
    });
    let delivered = 0;
    let failed = 0;
    let cleaned = 0;
    await Promise.allSettled(
      subscribers.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            },
            payload,
            {
              TTL: 60,
              urgency: "high"
            }
          );
          delivered++;
        } catch (err) {
          failed++;
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            cleaned++;
            await removePushSubscription(sub.endpoint);
          }
        }
      })
    );
    res.json({
      success: true,
      delivered,
      failed,
      cleaned,
      total: subscribers.length
    });
  } catch (err) {
    console.error("[Push Send Alert Error]:", err);
    res.status(500).json({ error: "Error enviando notificaciones push" });
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
