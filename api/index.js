// server.ts
import express from "express";
import dotenv from "dotenv";
import path2 from "path";
import fs2 from "fs";
import crypto2 from "node:crypto";
import { fileURLToPath } from "url";

// src/services/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
  const cleanDevice = String(deviceId || "").trim().toUpperCase();
  const friendlyDevName = String(deviceName || "Dispositivo Web / M\xF3vil").trim();
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
    const activeAdminPin = cfg?.adminPin || process.env.ADMIN_PIN || "120328";
    const pinUpper = pin.toUpperCase();
    const isPinCorrect = pin === activeAdminPin || pin === "120328" || pinUpper === "MASTER-2708" || pinUpper === "2708";
    if (isPinCorrect) {
      return {
        success: true,
        message: "Acceso de Propietario verificado con \xE9xito",
        user: {
          id: "admin-owner",
          username: "admin",
          displayName: "Geovanny Contreras (Propietario)",
          pin,
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
        message: "PIN incorrecto para la cuenta de Administrador Propietario. Usa tu PIN o el C\xF3digo Maestro MASTER-2708."
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
        if (data.pin_hash !== pin) {
          return {
            success: false,
            code: "INVALID_PIN",
            message: "El PIN ingresado no es correcto para este usuario."
          };
        }
        const isAdmin = data.role === "admin";
        if (!isAdmin) {
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
          if (data.expires_at && data.expires_at < nowMs) {
            return {
              success: false,
              code: "EXPIRED",
              message: "Tu plan de acceso ha vencido. Contacta al administrador para renovar."
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
          displayName: data.display_name || void 0,
          pin: data.pin_hash,
          role: data.role || "client",
          status: data.status || "active",
          planType: data.plan_type || "30D",
          planLabel: data.plan_label || "Pase Activo",
          createdAt: Number(data.created_at || nowMs),
          expiresAt: data.expires_at ? Number(data.expires_at) : null,
          boundDeviceId: data.bound_device_id,
          boundDeviceName: data.bound_device_name,
          boundDeviceUpdatedAt: data.bound_device_updated_at,
          lastActiveAt: nowMs,
          whatsappNumber: data.whatsapp_number,
          notes: data.notes,
          daysRemaining,
          isExpired: data.expires_at ? data.expires_at < nowMs : false
        };
        return {
          success: true,
          message: "Autenticaci\xF3n exitosa",
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
    if (localUser.pin !== pin) {
      return {
        success: false,
        code: "INVALID_PIN",
        message: "El PIN ingresado no es correcto para este usuario."
      };
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
    return {
      success: true,
      message: "Autenticaci\xF3n exitosa",
      user: {
        ...localUser,
        daysRemaining,
        isExpired: localUser.expiresAt ? localUser.expiresAt < nowMs : false
      }
    };
  }
  if (username === "admin" && (pin === process.env.ADMIN_PIN || pin === "120328" || pin.toUpperCase() === "MASTER-2708")) {
    return {
      success: true,
      message: "Acceso de Administrador verificado (Modo Maestro)",
      user: {
        id: "admin-master",
        username: "admin",
        displayName: "Administrador Propietario",
        pin,
        role: "admin",
        status: "active",
        planType: "PERMANENT",
        planLabel: "Acceso Maestro Ilimitado",
        createdAt: nowMs,
        expiresAt: null,
        boundDeviceId: cleanDevice,
        boundDeviceName: friendlyDevName,
        lastActiveAt: nowMs
      }
    };
  }
  return {
    success: false,
    code: "USER_NOT_FOUND",
    message: "El usuario no existe o las credenciales no son v\xE1lidas."
  };
}
async function registerAppUserRequest(rawUsername, rawPin, displayName, whatsapp) {
  const username = normalizeUsername(rawUsername);
  const pin = String(rawPin || "").trim();
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
  const cleanDisplayName = displayName ? displayName.trim() : void 0;
  const cleanWhatsapp = whatsapp ? whatsapp.replace(/[^0-9]/g, "") : void 0;
  const localUsers = getLocalUsersDb();
  const existingLocal = localUsers.find((u) => u.username === username);
  if (existingLocal && existingLocal.status === "active") {
    return {
      success: false,
      code: "USER_EXISTS",
      message: "Este nombre de usuario ya est\xE1 activo y registrado. Elige otro o inicia sesi\xF3n."
    };
  }
  const newRecord = existingLocal || {
    id: crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username,
    displayName: cleanDisplayName,
    pin,
    role: "client",
    status: "pending",
    planType: "30D",
    planLabel: "Pase 30 D\xEDas",
    createdAt: nowMs,
    expiresAt: nowMs + 30 * 24 * 60 * 60 * 1e3,
    boundDeviceId: null,
    boundDeviceName: null,
    whatsappNumber: cleanWhatsapp || null,
    daysRemaining: 30,
    isExpired: false
  };
  if (existingLocal) {
    existingLocal.pin = pin;
    if (cleanDisplayName) existingLocal.displayName = cleanDisplayName;
    if (cleanWhatsapp) existingLocal.whatsappNumber = cleanWhatsapp;
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
          pin_hash: pin,
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
        pin_hash: pin,
        role: "client",
        status: "pending",
        plan_type: "30D",
        plan_label: "Pase 30 D\xEDas",
        created_at: nowMs,
        expires_at: nowMs + 30 * 24 * 60 * 60 * 1e3,
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
async function adminListAppUsers() {
  const client = getSupabaseClient();
  const nowMs = Date.now();
  const localUsers = getLocalUsersDb();
  const mergedMap = /* @__PURE__ */ new Map();
  for (const u of localUsers) {
    const daysRemaining = u.expiresAt ? Math.max(0, Math.ceil((u.expiresAt - nowMs) / (24 * 60 * 60 * 1e3))) : null;
    const isExpired = u.expiresAt ? u.expiresAt < nowMs : false;
    mergedMap.set(u.username, { ...u, daysRemaining, isExpired });
  }
  if (client) {
    try {
      const { data, error } = await client.from("sportstats_users").select("*").order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const daysRemaining = row.expires_at ? Math.max(0, Math.ceil((row.expires_at - nowMs) / (24 * 60 * 60 * 1e3))) : null;
          const isExpired = row.expires_at ? row.expires_at < nowMs : false;
          const item = {
            id: row.id,
            username: row.username,
            displayName: row.display_name || void 0,
            pin: row.pin_hash,
            role: row.role || "client",
            status: row.status || "active",
            planType: row.plan_type || "30D",
            planLabel: row.plan_label || "Pase Mensual",
            createdAt: Number(row.created_at || nowMs),
            expiresAt: row.expires_at ? Number(row.expires_at) : null,
            boundDeviceId: row.bound_device_id,
            boundDeviceName: row.bound_device_name,
            boundDeviceUpdatedAt: row.bound_device_updated_at,
            lastActiveAt: row.last_active_at ? Number(row.last_active_at) : null,
            whatsappNumber: row.whatsapp_number,
            notes: row.notes,
            daysRemaining,
            isExpired
          };
          mergedMap.set(item.username, item);
        }
      }
    } catch (err) {
      console.error("[adminListAppUsers Error]:", err);
    }
  }
  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}
async function adminResetAppUserDevice(userId) {
  let updatedLocal = false;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      u.boundDeviceId = null;
      u.boundDeviceName = null;
      u.boundDeviceUpdatedAt = null;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("sportstats_users").update({
        bound_device_id: null,
        bound_device_name: null,
        bound_device_updated_at: null
      }).eq("id", userId);
      if (!error) return true;
    } catch {
    }
  }
  return updatedLocal;
}
async function adminRenewAppUser(userId, addDays) {
  const nowMs = Date.now();
  const daysMs = Number(addDays) * 24 * 60 * 60 * 1e3;
  let updatedLocal = false;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      if (u.expiresAt && u.expiresAt > nowMs) {
        u.expiresAt = u.expiresAt + daysMs;
      } else {
        u.expiresAt = nowMs + daysMs;
      }
      u.status = "active";
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: user } = await client.from("sportstats_users").select("expires_at").eq("id", userId).single();
      let newExpiry = nowMs + daysMs;
      if (user && user.expires_at && user.expires_at > nowMs) {
        newExpiry = user.expires_at + daysMs;
      }
      const { error } = await client.from("sportstats_users").update({
        expires_at: newExpiry,
        status: "active"
      }).eq("id", userId);
      if (!error) return true;
    } catch {
    }
  }
  return updatedLocal;
}
async function adminToggleAppUserStatus(userId, newStatus) {
  let updatedLocal = false;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      u.status = newStatus;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("sportstats_users").update({ status: newStatus }).eq("id", userId);
      if (!error) return true;
    } catch {
    }
  }
  return updatedLocal;
}
async function adminUpsertAppUser(user) {
  if (!user.username) return false;
  const cleanUser = normalizeUsername(user.username);
  if (!cleanUser) return false;
  const nowMs = Date.now();
  const defaultExpiry = nowMs + 30 * 24 * 60 * 60 * 1e3;
  const localUsers = getLocalUsersDb();
  const existingIdx = localUsers.findIndex((u) => u.username === cleanUser);
  const localRecord = {
    id: existingIdx >= 0 ? localUsers[existingIdx].id : crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username: cleanUser,
    displayName: user.displayName || (existingIdx >= 0 ? localUsers[existingIdx].displayName : void 0),
    pin: user.pin || (existingIdx >= 0 ? localUsers[existingIdx].pin : "1234"),
    role: user.role || "client",
    status: user.status || "active",
    planType: user.planType || "30D",
    planLabel: user.planLabel || "Pase Mensual (30 D\xEDas)",
    createdAt: user.createdAt || (existingIdx >= 0 ? localUsers[existingIdx].createdAt : nowMs),
    expiresAt: user.expiresAt !== void 0 ? user.expiresAt : defaultExpiry,
    boundDeviceId: user.boundDeviceId !== void 0 ? user.boundDeviceId : existingIdx >= 0 ? localUsers[existingIdx].boundDeviceId : null,
    boundDeviceName: user.boundDeviceName !== void 0 ? user.boundDeviceName : existingIdx >= 0 ? localUsers[existingIdx].boundDeviceName : null,
    whatsappNumber: user.whatsappNumber || (existingIdx >= 0 ? localUsers[existingIdx].whatsappNumber : null),
    notes: user.notes || (existingIdx >= 0 ? localUsers[existingIdx].notes : null)
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
      await client.from("sportstats_users").upsert(
        {
          username: cleanUser,
          display_name: localRecord.displayName || null,
          pin_hash: localRecord.pin,
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
        },
        { onConflict: "username" }
      );
    } catch {
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

// server.ts
dotenv.config();
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = "true";
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
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});
var IS_VERCEL2 = Boolean(process.env.VERCEL);
var CACHE_DIR = IS_VERCEL2 ? path2.resolve("/tmp", ".cache") : path2.resolve(process.cwd(), ".cache");
var CACHE_FILE = path2.resolve(CACHE_DIR, "api_football_cache.json");
var memoryCache = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
var lastRemainingCalls = 100;
var quotaShieldActive = false;
var QUOTA_SHIELD_THRESHOLD = 10;
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
            memoryCache.set(k, v);
          }
        }
      }
      console.log(`[Cache] Cargadas ${memoryCache.size} entradas de cach\xE9 persistente en disco.`);
    }
  } catch (err) {
    console.warn("[Cache] No se pudo cargar cach\xE9 desde disco:", err);
  }
}
initDiskCache();
var persistTimeout = null;
function persistCacheToDisk() {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      if (!fs2.existsSync(CACHE_DIR)) {
        fs2.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const dump = {};
      memoryCache.forEach((val, key) => {
        dump[key] = val;
      });
      fs2.writeFileSync(CACHE_FILE, JSON.stringify(dump), "utf8");
    } catch (err) {
      console.warn("[Cache] Error al guardar cach\xE9 en disco:", err);
    }
  }, 1e3);
}
function getCacheItem(key) {
  return memoryCache.get(key);
}
function setCacheItem(key, data) {
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
function getColombiaDateStr(offsetDays = 0) {
  const d = /* @__PURE__ */ new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}
app.get("/api/upcoming", async (req, res) => {
  const apiKey = getSecretApiKey();
  const requestedDate = req.query.date || "";
  const query = (req.query.q || "").toLowerCase().trim();
  const force = req.query.force === "true";
  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;
  const cacheKey = `upcoming_${targetDate}`;
  const cached = getCacheItem(cacheKey);
  const cacheTTL = targetDate === todayColombia ? 25 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  if (cached && !query) {
    const isFresh = Date.now() - cached.timestamp < cacheTTL;
    if (isFresh && !force || quotaShieldActive) {
      let filtered = cached.data;
      return res.json({
        success: true,
        source: "persistent_disk_cache",
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        cachedAt: cached.timestamp,
        count: Array.isArray(filtered) ? filtered.length : 0,
        fixtures: filtered
      });
    }
  }
  if (quotaShieldActive && !force) {
    if (cached) {
      return res.json({
        success: true,
        source: "quota_shield_disk_cache",
        remainingCalls: lastRemainingCalls,
        quotaShieldActive: true,
        count: Array.isArray(cached.data) ? cached.data.length : 0,
        fixtures: cached.data
      });
    }
  }
  if (!apiKey) {
    return res.json({
      success: false,
      message: "No secret API key configured on server.",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: cached?.data || []
    });
  }
  try {
    const resultList = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${targetDate}&timezone=America/Bogota`, {
        method: "GET",
        headers: { "x-apisports-key": apiKey }
      });
      updateQuotaFromHeaders(apiRes.headers);
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const json = await apiRes.json();
      let rawList = Array.isArray(json.response) ? json.response : [];
      const now = Date.now();
      rawList = rawList.filter((f) => {
        const id = f?.fixture?.id;
        return id !== 991001 && id !== 991002 && id !== 991003;
      });
      const activeFinishedShorts = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
      let upcomingOnly = rawList.filter((f) => {
        const statusShort = String(f.fixture?.status?.short || "").toUpperCase();
        const matchTime = f.fixture?.timestamp ? f.fixture.timestamp * 1e3 : new Date(f.fixture?.date).getTime();
        const isLive = ["1H", "2H", "HT", "ET", "LIVE", "BT", "P", "INT"].includes(statusShort);
        if (isLive) return true;
        if (activeFinishedShorts.includes(statusShort)) return false;
        return matchTime > now - 45 * 60 * 1e3;
      });
      if (targetDate === todayColombia && upcomingOnly.length < 15 && lastRemainingCalls > QUOTA_SHIELD_THRESHOLD) {
        const tomorrowColombia = getColombiaDateStr(1);
        try {
          const tomorrowRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${tomorrowColombia}&timezone=America/Bogota`, {
            method: "GET",
            headers: { "x-apisports-key": apiKey }
          });
          updateQuotaFromHeaders(tomorrowRes.headers);
          if (tomorrowRes.ok) {
            const tomorrowJson = await tomorrowRes.json();
            if (Array.isArray(tomorrowJson.response)) {
              const tomorrowUpcoming = tomorrowJson.response.filter((f) => {
                const statusShort = String(f.fixture?.status?.short || "").toUpperCase();
                return !activeFinishedShorts.includes(statusShort);
              });
              upcomingOnly = [...upcomingOnly, ...tomorrowUpcoming];
            }
          }
        } catch {
        }
      }
      upcomingOnly.sort((a, b) => {
        const sA = String(a.fixture?.status?.short || "").toUpperCase();
        const sB = String(b.fixture?.status?.short || "").toUpperCase();
        const liveA = ["1H", "2H", "HT", "ET", "LIVE"].includes(sA) ? 0 : 1;
        const liveB = ["1H", "2H", "HT", "ET", "LIVE"].includes(sB) ? 0 : 1;
        if (liveA !== liveB) return liveA - liveB;
        const tA = a.fixture?.timestamp || 0;
        const tB = b.fixture?.timestamp || 0;
        return tA - tB;
      });
      setCacheItem(cacheKey, upcomingOnly);
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
      source: "api_football_coalesced",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      count: filtered.length,
      fixtures: filtered
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached) {
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
function normalizeTeamKey(name) {
  return (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|cf|sc|ac|cd|ud|club|deportivo|atletico|athletic|real|sporting)\b/g, "").replace(/[^a-z0-9]/g, "").trim();
}
app.get("/api/live-pulse", async (req, res) => {
  const requestedDate = req.query.date || "";
  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, "");
  const pulseCacheKey = `live_pulse_${espnDateStr}`;
  const cachedPulse = getCacheItem(pulseCacheKey);
  if (cachedPulse && Date.now() - cachedPulse.timestamp < 35 * 1e3) {
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
      const liveDeltas = [];
      try {
        const espnRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}`,
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
            const state = String(ev?.status?.type?.state || "").toLowerCase();
            const isLive = state === "in";
            const isPost = state === "post";
            if (!isLive && !isPost) continue;
            const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || "");
            const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || "");
            const homeScore = parseInt(String(homeComp?.score || "0"), 10) || 0;
            const awayScore = parseInt(String(awayComp?.score || "0"), 10) || 0;
            const rawClock = String(ev?.status?.displayClock || "45");
            const parsedMin = parseInt(rawClock.replace(/[^0-9]/g, ""), 10) || 45;
            liveDeltas.push({
              homeKey: normalizeTeamKey(homeName),
              awayKey: normalizeTeamKey(awayName),
              homeName,
              awayName,
              homeScore,
              awayScore,
              minute: Math.min(90, Math.max(1, parsedMin)),
              status: isLive ? "IN_PLAY" : "FINISHED"
            });
          }
        }
      } catch {
      }
      const upcomingCache = getCacheItem(`upcoming_${targetDate}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        const elapsedMinutesSinceCache = Math.max(
          0,
          Math.floor((Date.now() - upcomingCache.timestamp) / 6e4)
        );
        for (const f of upcomingCache.data) {
          const fId = String(f?.fixture?.id || "");
          const hName = String(f?.teams?.home?.name || "");
          const aName = String(f?.teams?.away?.name || "");
          const hKey = normalizeTeamKey(hName);
          const aKey = normalizeTeamKey(aName);
          const matched = liveDeltas.find(
            (d) => d.homeKey && hKey && (d.homeKey.includes(hKey) || hKey.includes(d.homeKey)) || d.awayKey && aKey && (d.awayKey.includes(aKey) || aKey.includes(d.awayKey))
          );
          if (matched) {
            matched.id = fId;
            if (f.goals) {
              f.goals.home = matched.homeScore;
              f.goals.away = matched.awayScore;
            }
            if (f.fixture?.status) {
              f.fixture.status.short = matched.status === "IN_PLAY" ? "2H" : "FT";
              f.fixture.status.elapsed = matched.minute;
            }
            continue;
          }
          const statusShort = String(f?.fixture?.status?.short || "").toUpperCase();
          if (["1H", "2H", "HT", "ET", "LIVE"].includes(statusShort)) {
            const baseElapsed = parseInt(String(f?.fixture?.status?.elapsed || "45"), 10) || 45;
            const currentMin = statusShort === "HT" ? 45 : Math.min(90, baseElapsed + elapsedMinutesSinceCache % 15);
            liveDeltas.push({
              id: fId,
              homeKey: hKey,
              awayKey: aKey,
              homeName: hName,
              awayName: aName,
              homeScore: Number(f?.goals?.home ?? 0),
              awayScore: Number(f?.goals?.away ?? 0),
              minute: currentMin,
              status: "IN_PLAY"
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
app.get("/api/nba/scoreboard", async (req, res) => {
  const dateQuery = req.query.date || "";
  const force = req.query.force === "true";
  const todayColombia = getColombiaDateStr(0);
  const targetDate = dateQuery || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, "");
  const cacheKey = `nba_sb_${espnDateStr}`;
  const cached = getCacheItem(cacheKey);
  const cacheTTL = targetDate === todayColombia ? 3 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
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
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDateStr}`;
      const apiRes = await fetch(espnUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0"
        }
      });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const data = await apiRes.json();
      const events = Array.isArray(data.events) ? data.events : [];
      setCacheItem(cacheKey, events);
      return events;
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
app.get("/api/fixtures", async (req, res) => {
  const date = req.query.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const force = req.query.force === "true";
  const apiKey = getSecretApiKey();
  const cacheKey = `fix_${date}`;
  const cached = getCacheItem(cacheKey);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const cacheTTL = date === todayStr ? 25 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  if (cached && (!force || quotaShieldActive)) {
    const isFresh = Date.now() - cached.timestamp < cacheTTL;
    if (isFresh || quotaShieldActive) {
      return res.status(200).json({
        success: true,
        source: "persistent_disk_cache",
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
  }
  if (quotaShieldActive && cached) {
    return res.status(200).json({
      success: true,
      source: "quota_shield_disk_cache",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive: true,
      fixtures: cached.data
    });
  }
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      message: "No secret API key configured on server. Fallback to cache.",
      hasKey: false,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: cached?.data || []
    });
  }
  try {
    const rawFixtures = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&timezone=America/Bogota`, {
        method: "GET",
        headers: { "x-apisports-key": apiKey }
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
      source: "api_football_coalesced",
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: rawFixtures
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.status(200).json({
        success: true,
        source: "fallback_disk_cache",
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
app.get("/api/status", (req, res) => {
  const apiFootballKey = getSecretKey("API_FOOTBALL_KEY");
  const footballDataKey = getSecretKey("FOOTBALL_DATA_KEY");
  const oddsApiKey = getSecretKey("ODDS_API_KEY");
  return res.json({
    apiFootball: Boolean(apiFootballKey && apiFootballKey.length > 5),
    footballData: Boolean(footballDataKey && footballDataKey.length > 5),
    oddsApi: Boolean(oddsApiKey && oddsApiKey.length > 5),
    remainingCalls: lastRemainingCalls,
    quotaShieldActive: lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD,
    quotaShieldThreshold: QUOTA_SHIELD_THRESHOLD,
    cachedEntriesCount: memoryCache.size,
    cacheTtlMinutes: 25,
    serverReady: true
  });
});
app.get("/api/market-odds", async (req, res) => {
  const oddsKey = getSecretKey("ODDS_API_KEY");
  const cacheKey = "odds_soccer";
  const cached = getCacheItem(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1e3) {
    return res.json({ success: true, source: "persistent_disk_cache", odds: cached.data });
  }
  if (!oddsKey) {
    return res.json({ success: false, message: "No The Odds API key configured.", odds: cached?.data || [] });
  }
  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${oddsKey}&regions=eu&markets=h2h`,
        { method: "GET" }
      );
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: "the_odds_api_coalesced", odds: data });
  } catch (err) {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", odds: cached.data });
    return res.json({ success: false, error: String(err), odds: [] });
  }
});
app.get("/api/standings", async (req, res) => {
  const fdKey = getSecretKey("FOOTBALL_DATA_KEY");
  const league = req.query.league || "PD";
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
      const apiRes = await fetch(`https://api.football-data.org/v4/competitions/${league}/standings`, {
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
  } catch (err) {
    if (cached) return res.json({ success: true, source: "fallback_disk_cache", standings: cached.data });
    return res.json({ success: false, error: String(err), standings: [] });
  }
});
app.post("/api/set-secret-key", (req, res) => {
  const { key, footballDataKey, oddsApiKey } = req.body;
  try {
    const envPath = path2.resolve(process.cwd(), ".env");
    let envContent = fs2.existsSync(envPath) ? fs2.readFileSync(envPath, "utf8") : "";
    if (key && typeof key === "string" && key.trim()) {
      const clean = key.trim();
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
      const clean = footballDataKey.trim();
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
      const clean = oddsApiKey.trim();
      process.env.ODDS_API_KEY = clean;
      if (envContent.includes("ODDS_API_KEY=")) {
        envContent = envContent.replace(/ODDS_API_KEY=.*/g, `ODDS_API_KEY="${clean}"`);
      } else {
        envContent += `
ODDS_API_KEY="${clean}"
`;
      }
    }
    fs2.writeFileSync(envPath, envContent, "utf8");
    return res.json({
      success: true,
      message: "Claves configuradas en el servidor de forma 100% segura y privada (nunca visibles en el cliente)."
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});
var LICENSES_FILE = IS_VERCEL2 ? path2.resolve("/tmp", "licenses_db.json") : path2.resolve(__dirname, "licenses_db.json");
var ADMIN_CONFIG_FILE = IS_VERCEL2 ? path2.resolve("/tmp", "admin_config.json") : path2.resolve(__dirname, "admin_config.json");
var BUNDLED_ADMIN_CONFIG_FILE = path2.resolve(__dirname, "admin_config.json");
var LICENSE_MASTER_SECRET = "FUTBOLSTATS_PRO_SECURE_HMAC_SALT_2026_X9";
var MASTER_RECOVERY_CODE = "MASTER-2708";
var memoryAdminConfig = null;
function getAdminConfig() {
  const defaultConfig = {
    adminPin: process.env.ADMIN_PIN || "120328",
    adminWhatsApp: process.env.ADMIN_WHATSAPP || "573213902708",
    supportName: "Administrador SportStats Pro",
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
function isValidAdminPin(pin, cfg) {
  if (!pin || typeof pin !== "string") return false;
  const clean = pin.trim();
  const upper = clean.toUpperCase();
  return clean === cfg.adminPin || clean === "120328" || upper === MASTER_RECOVERY_CODE || upper === "2708";
}
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
  const fullHmac = crypto2.createHmac("sha256", LICENSE_MASTER_SECRET).update(message).digest("hex");
  const sig8 = fullHmac.substring(0, 8).toUpperCase();
  const key = `FS-${planTag}-${cleanDev}-${expHex}-${sig8}`;
  return { key, expiresAt, planLabel };
}
app.get("/api/license/config", (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"];
  const cfg = getAdminConfig();
  const isAuthenticated = isValidAdminPin(pin, cfg);
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
app.post("/api/license/config", (req, res) => {
  const { currentPin, newPin, adminWhatsApp, supportName, customLogoUrl, colorTheme } = req.body || {};
  const currentCfg = getAdminConfig();
  if (!isValidAdminPin(currentPin, currentCfg)) {
    return res.status(403).json({ success: false, error: "PIN de administrador incorrecto" });
  }
  if (newPin && String(newPin).trim().length >= 4) {
    currentCfg.adminPin = String(newPin).trim();
  }
  if (adminWhatsApp && typeof adminWhatsApp === "string") {
    currentCfg.adminWhatsApp = adminWhatsApp.replace(/[^0-9]/g, "");
  }
  if (supportName && typeof supportName === "string") {
    currentCfg.supportName = supportName.trim();
  }
  if (typeof customLogoUrl === "string" || customLogoUrl === null) {
    currentCfg.customLogoUrl = customLogoUrl || void 0;
  }
  if (typeof colorTheme === "string") {
    currentCfg.colorTheme = colorTheme;
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
app.post("/api/license/generate", (req, res) => {
  const { adminPin, deviceId, clientNote, planType = "30D", customExpiryMs } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(adminPin, cfg)) {
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length < 4) {
    return res.status(400).json({ success: false, error: "C\xF3digo de dispositivo no v\xE1lido" });
  }
  const { key, expiresAt, planLabel } = serverGenerateToken(deviceId.trim(), planType, customExpiryMs);
  const db = getLicensesDb();
  const record = {
    id: `LIC-${Date.now().toString(36).toUpperCase()}`,
    key,
    deviceId: deviceId.trim().toUpperCase(),
    clientNote: clientNote ? String(clientNote).trim() : void 0,
    clientName: clientNote ? String(clientNote).trim() : void 0,
    planType,
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
  const whatsappReply = `\u{1F525} *SportStats Pro - Acceso Autorizado*

Hola! Tu acceso a la plataforma *SportStats Pro* ha sido activado con \xE9xito.
\u{1F4CC} *Plan:* ${planLabel}
\u23F3 *Vigencia:* ${formattedDate}
\u{1F511} *Tu Clave de Acceso:*
${key}

*Instrucciones:*
1. Abre la aplicaci\xF3n.
2. Pega tu clave de acceso en la casilla.
3. Presiona "Ingresar a SportStats Pro". \xA1Listo!`;
  return res.json({
    success: true,
    record,
    whatsappReply
  });
});
app.post("/api/license/heartbeat", (req, res) => {
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (!key && !deviceId) {
    return res.json({ success: false, error: "No se enviaron datos de identificaci\xF3n" });
  }
  const db = getLicensesDb();
  const cleanKey = key ? String(key).trim().toUpperCase() : "";
  const cleanDev = deviceId ? String(deviceId).trim().toUpperCase() : "";
  let found = db.find((item) => item.key === cleanKey || item.deviceId === cleanDev);
  if (found) {
    found.lastActiveTimestamp = Date.now();
    if (clientName && typeof clientName === "string" && clientName.trim()) {
      found.clientName = clientName.trim();
      if (!found.clientNote) found.clientNote = clientName.trim();
    }
    if (deviceInfo && typeof deviceInfo === "string") {
      found.deviceInfo = deviceInfo.trim();
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
app.post("/api/license/validate", (req, res) => {
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (!key || typeof key !== "string") {
    return res.status(400).json({ isValid: false, error: "Clave no proporcionada" });
  }
  const cfg = getAdminConfig();
  if (isValidAdminPin(key, cfg)) {
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
  const cleanKey = key.trim().toUpperCase();
  const cleanDev = deviceId ? String(deviceId).trim().toUpperCase() : "";
  let found = db.find((item) => item.key === cleanKey);
  if (found) {
    found.lastActiveTimestamp = Date.now();
    if (clientName && typeof clientName === "string" && clientName.trim()) {
      found.clientName = clientName.trim();
      if (!found.clientNote) found.clientNote = clientName.trim();
    }
    if (deviceInfo && typeof deviceInfo === "string") {
      found.deviceInfo = deviceInfo.trim();
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
    return res.json({
      isValid: false,
      status: "MALFORMED",
      message: "Formato de clave no v\xE1lido."
    });
  }
  const [, planTag, devClean, expHex, givenSig] = parts;
  const message = `${devClean}:${planTag}:${expHex}`;
  const expectedHmac = crypto2.createHmac("sha256", LICENSE_MASTER_SECRET).update(message).digest("hex").substring(0, 8).toUpperCase();
  if (givenSig !== expectedHmac) {
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
  const expSeconds = parseInt(expHex, 16);
  const isPermanent = expSeconds === 0;
  const nowMs = Date.now();
  const expiryTimestamp = isPermanent ? null : expSeconds * 1e3;
  const isExpired = !isPermanent && expiryTimestamp < nowMs;
  if (!found && !isExpired) {
    const autoRecord = {
      id: `LIC-${Date.now().toString(36).toUpperCase()}`,
      key: cleanKey,
      deviceId: cleanDev || `DEV-${devClean}`,
      clientNote: clientName ? String(clientName).trim() : "Cliente Registrado",
      clientName: clientName ? String(clientName).trim() : "Cliente Registrado",
      planType: planTag,
      planLabel: isPermanent ? "Pase Permanente Vitalicio" : `Pase ${planTag}`,
      createdAt: Date.now(),
      expiresAt: expiryTimestamp,
      lastActiveTimestamp: Date.now(),
      deviceInfo: typeof deviceInfo === "string" ? deviceInfo : void 0,
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
app.get("/api/license/list", (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"];
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
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
    currentPin: cfg.adminPin,
    masterRecoveryCode: MASTER_RECOVERY_CODE
  });
});
app.post("/api/license/renew", (req, res) => {
  const { adminPin, key, deviceId, addDays = 30 } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(adminPin, cfg)) {
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
  const db = getLicensesDb();
  const cleanKey = key ? String(key).trim().toUpperCase() : "";
  const cleanDev = deviceId ? String(deviceId).trim().toUpperCase() : "";
  let record = db.find((item) => item.key === cleanKey || item.deviceId === cleanDev);
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
  const { recoveryKey, deviceId } = req.body || {};
  const cfg = getAdminConfig();
  const cleanKey = String(recoveryKey || "").trim().toUpperCase();
  const last4Phone = cfg.adminWhatsApp.slice(-4);
  let isOtpValid = false;
  if (deviceId && cleanKey) {
    try {
      isOtpValid = await verifyAndConsumeRecoveryOtp(String(deviceId), cleanKey);
    } catch {
      isOtpValid = false;
    }
  }
  const isMasterOrOwner = cleanKey === MASTER_RECOVERY_CODE || cleanKey === last4Phone || cleanKey === cfg.adminPin;
  if (!isMasterOrOwner && !isOtpValid) {
    return res.status(403).json({
      success: false,
      error: "C\xF3digo de autorizaci\xF3n o clave incorrecta / expirada."
    });
  }
  if (req.body?.newPin && String(req.body.newPin).trim().length >= 4) {
    cfg.adminPin = String(req.body.newPin).trim();
    saveAdminConfig(cfg);
  }
  return res.json({
    success: true,
    adminPin: cfg.adminPin,
    masterRecoveryCode: MASTER_RECOVERY_CODE,
    adminWhatsApp: cfg.adminWhatsApp
  });
});
app.get("/api/admin/supabase-status", (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"];
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
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
app.post("/api/license/revoke", (req, res) => {
  const { adminPin, key, revoke = true } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(adminPin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
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
app.post("/api/admin/logo", (req, res) => {
  const { adminPin, imageData, pwa512, pwa192, pwaMaskable } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(adminPin, cfg)) {
    return res.status(403).json({ success: false, error: "PIN de administrador no v\xE1lido" });
  }
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
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error al procesar y guardar la imagen: " + err.message });
  }
});
app.delete("/api/admin/logo", (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"] || req.body?.adminPin;
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
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
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, pin, deviceId, deviceName } = req.body || {};
    const result = await loginAppUser(username, pin, deviceId, deviceName);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Error en inicio de sesi\xF3n" });
  }
});
app.post("/api/auth/register-request", async (req, res) => {
  try {
    const { username, pin, displayName, whatsapp } = req.body || {};
    const result = await registerAppUserRequest(username, pin, displayName, whatsapp);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Error al procesar solicitud" });
  }
});
app.get("/api/admin/users/list", async (req, res) => {
  const pin = req.query.pin || req.headers["x-admin-pin"];
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  try {
    const users = await adminListAppUsers();
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/admin/users/reset-device", async (req, res) => {
  const { pin, userId } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "ID de usuario requerido" });
  }
  const ok = await adminResetAppUserDevice(userId);
  return res.json({
    success: ok,
    message: ok ? "Dispositivo desvinculado con \xE9xito. El usuario ahora puede ingresar desde su nuevo equipo." : "No se pudo desvincular el dispositivo."
  });
});
app.post("/api/admin/users/renew", async (req, res) => {
  const { pin, userId, addDays = 30 } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "ID de usuario requerido" });
  }
  const ok = await adminRenewAppUser(userId, Number(addDays));
  return res.json({ success: ok, message: ok ? `Suscripci\xF3n extendida +${addDays} d\xEDas` : "Error al renovar" });
});
app.post("/api/admin/users/toggle-status", async (req, res) => {
  const { pin, userId, status } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  const ok = await adminToggleAppUserStatus(userId, status === "suspended" ? "suspended" : "active");
  return res.json({ success: ok, message: ok ? "Estado actualizado" : "Error al cambiar estado" });
});
app.post("/api/admin/users/upsert", async (req, res) => {
  const { pin, user } = req.body || {};
  const cfg = getAdminConfig();
  if (!isValidAdminPin(pin, cfg)) {
    return res.status(403).json({ success: false, error: "No autorizado" });
  }
  const ok = await adminUpsertAppUser(user);
  return res.json({ success: ok, message: ok ? "Usuario guardado" : "Error al guardar usuario" });
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
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !IS_VERCEL2) {
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
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
  app.use((err, _req, res, _next) => {
    console.error("[Express Error Handler]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err?.message || "Error interno en el servidor"
      });
    }
  });
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

// api/index.ts
var index_default = server_default;
export {
  index_default as default
};
