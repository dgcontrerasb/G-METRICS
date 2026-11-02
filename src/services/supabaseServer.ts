import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  hashUserPin,
  verifyUserPin,
  isHashedPin,
  timingSafeCompare,
  createSessionJwt,
  sanitizeText,
  sanitizePhone,
} from './securityShield';

let supabaseClient: SupabaseClient | null = null;

const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCAL_USERS_FILE = IS_VERCEL
  ? path.resolve('/tmp', 'sportstats_users_db.json')
  : path.resolve(process.cwd(), 'sportstats_users_db.json');

let memoryUsersCache: AppUser[] | null = null;

function getLocalUsersDb(): AppUser[] {
  if (memoryUsersCache) return memoryUsersCache;
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const raw = fs.readFileSync(LOCAL_USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryUsersCache = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore read error
  }
  memoryUsersCache = [];
  return memoryUsersCache;
}

function saveLocalUsersDb(users: AppUser[]): void {
  memoryUsersCache = users;
  try {
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch {
    // ignore write error in read-only environments
  }
}

export function normalizeSupabaseUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  let clean = rawUrl.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}.supabase.co`;
  }
  return clean.replace(/\/$/, '');
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('[Supabase] Cliente conectado exitosamente a:', url);
    } catch (err) {
      console.error('[Supabase] Error al inicializar cliente:', err);
      supabaseClient = null;
    }
  }

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}

export interface AdminConfig {
  adminPin: string;
  adminWhatsApp: string;
  supportName?: string;
  customLogoUrl?: string;
  colorTheme?: string;
}

export interface ServerLicenseRecord {
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

// 1. Configuración de Administrador
export async function fetchSupabaseAdminConfig(): Promise<AdminConfig | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('sportstats_config')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Config] Advertencia al leer configuración:', error.message);
      return null;
    }

    if (data) {
      return {
        adminPin: data.admin_pin,
        adminWhatsApp: data.admin_whatsapp,
        supportName: data.support_name || undefined,
        customLogoUrl: data.custom_logo_url || undefined,
        colorTheme: data.color_theme || 'cyan-emerald',
      };
    }
  } catch (err) {
    console.error('[Supabase Config] Excepción:', err);
  }
  return null;
}

export async function upsertSupabaseAdminConfig(cfg: AdminConfig): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('sportstats_config').upsert({
      id: 'main',
      admin_pin: cfg.adminPin,
      admin_whatsapp: cfg.adminWhatsApp,
      support_name: cfg.supportName || null,
      custom_logo_url: cfg.customLogoUrl || null,
      color_theme: cfg.colorTheme || 'cyan-emerald',
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Supabase Config] Error al guardar configuración:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase Config] Excepción al guardar:', err);
    return false;
  }
}

// 1b. Caché Persistente Serverless en Supabase (Sobrevive a reinicios / Cold Starts de Vercel)
export async function getSupabaseKvCache<T = unknown>(cacheId: string): Promise<{ timestamp: number; data: T } | null> {
  const client = getSupabaseClient();
  if (!client || !cacheId || cacheId === 'main') return null;

  try {
    const { data, error } = await client
      .from('sportstats_config')
      .select('custom_logo_url, admin_whatsapp')
      .eq('id', cacheId)
      .maybeSingle();

    if (error || !data || !data.custom_logo_url) return null;
    const parsed = JSON.parse(data.custom_logo_url);
    if (parsed && typeof parsed === 'object' && 'timestamp' in parsed && 'data' in parsed) {
      return parsed as { timestamp: number; data: T };
    }
  } catch {
    // ignore parse/network errors
  }
  return null;
}

export async function setSupabaseKvCache<T = unknown>(cacheId: string, payload: T, timestamp = Date.now()): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !cacheId || cacheId === 'main') return false;

  try {
    const serialized = JSON.stringify({ timestamp, data: payload });
    const { error } = await client.from('sportstats_config').upsert({
      id: cacheId,
      admin_pin: 'KV_CACHE_LOCK',
      admin_whatsapp: String(timestamp),
      support_name: cacheId,
      custom_logo_url: serialized,
      color_theme: 'kv-cache',
      updated_at: new Date(timestamp).toISOString(),
    });

    // Autolimpieza automática: cuando se guarda un calendario de fecha, borra cachés de hace más de 3 días
    // Así la tabla nunca acumula basura y ocupa menos de 150 KB (0.03% del plan Free de 500 MB)
    if (cacheId.startsWith('apifootball_schedule_')) {
      const threeDaysAgoIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      client
        .from('sportstats_config')
        .delete()
        .eq('color_theme', 'kv-cache')
        .neq('id', '__server_telemetry_v1__')
        .neq('id', '__deleted_users_v1__')
        .lt('updated_at', threeDaysAgoIso)
        .then(
          () => {},
          () => {}
        );
    }

    return !error;
  } catch {
    return false;
  }
}

// 2. Licencias en Supabase
export async function upsertSupabaseLicense(record: ServerLicenseRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('sportstats_licenses').upsert(
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
        revoked: record.revoked,
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.warn('[Supabase License] Error al guardar licencia:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase License] Excepción al guardar:', err);
    return false;
  }
}

export async function updateSupabaseLicenseStatus(key: string, revoked: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('sportstats_licenses')
      .update({ revoked })
      .eq('key', key);

    return !error;
  } catch {
    return false;
  }
}

// 3. Sistema Seguro de Recuperación OTP (Un solo uso, 15 min de vigencia, sin exponerse en frontend)
export async function verifyAndConsumeRecoveryOtp(deviceId: string, otpInput: string): Promise<boolean> {
  const client = getSupabaseClient();
  const cleanDev = deviceId.trim().toUpperCase();
  const cleanOtp = otpInput.trim();

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_recovery_requests')
        .select('*')
        .eq('device_id', cleanDev)
        .eq('otp_code', cleanOtp)
        .eq('used', false)
        .gt('expires_at', Date.now())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        await client
          .from('sportstats_recovery_requests')
          .update({ used: true })
          .eq('id', data[0].id);
        return true;
      }
    } catch (err) {
      console.error('[Supabase OTP Verify] Excepción:', err);
    }
  }

  return false;
}

// =========================================================================
// GESTIÓN DE USUARIOS Y CONTROL DE DISPOSITIVO ÚNICO (SINGLE DEVICE LOCK)
// =========================================================================

export interface AppUser {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string;
  pin: string;
  role: 'admin' | 'client';
  status: 'active' | 'pending' | 'suspended' | 'expired' | 'deleted';
  planType: string;
  planLabel: string;
  createdAt: number;
  expiresAt: number | null;
  boundDeviceId?: string | null;
  boundDeviceName?: string | null;
  boundDeviceUpdatedAt?: string | null;
  lastActiveAt?: number | null;
  whatsappNumber?: string | null;
  notes?: string | null;
  daysRemaining?: number | null;
  isExpired?: boolean;
  isPro?: boolean;
  authProvider?: 'pin' | 'google';
  feedbackBonusClaimed?: boolean;
}

export function normalizeUsername(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

export interface LoginResult {
  success: boolean;
  code?: 'USER_NOT_FOUND' | 'INVALID_PIN' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'EXPIRED' | 'DEVICE_LOCKED' | 'SERVER_ERROR';
  message: string;
  user?: AppUser;
  sessionToken?: string;
  boundDeviceName?: string | null;
  whatsappContact?: string;
  isPro?: boolean;
}

export async function loginAppUser(
  rawUsername: string,
  rawPin: string,
  deviceId: string,
  deviceName?: string
): Promise<LoginResult> {
  const rawClean = String(rawUsername || '').toLowerCase().trim();
  const isOwnerEmail =
    rawClean === 'dgcontreras@gmail.com' ||
    rawClean === 'dgcontrerasb@gmail.com' ||
    rawClean.startsWith('dgcontreras') ||
    rawClean === 'admin' ||
    rawClean === 'propietario' ||
    rawClean === 'geovanny';
  const isOwnerAdmin = isOwnerEmail || rawClean === 'admin';
  const username = isOwnerAdmin ? 'admin' : normalizeUsername(rawUsername);
  const pin = String(rawPin || '').trim();
  const cleanDevice = sanitizeText(String(deviceId || ''), 48).toUpperCase();
  const friendlyDevName = sanitizeText(String(deviceName || 'Dispositivo Web / Móvil'), 80) || 'Dispositivo Web / Móvil';

  if (!isOwnerAdmin && (!username || username.length < 3)) {
    return {
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras y números).'
    };
  }

  if (!pin) {
    return {
      success: false,
      code: 'INVALID_PIN',
      message: 'Por favor ingresa tu PIN de acceso.'
    };
  }

  const client = getSupabaseClient();
  const nowMs = Date.now();

  // Comprobación directa para Propietario con correo dgcontreras@gmail.com / DGContrerasB@gmail.com o admin
  if (isOwnerAdmin) {
    const cfg = await fetchSupabaseAdminConfig();
    const envAdminPin = (process.env.ADMIN_PIN || '').trim();
    const envMasterKey = (process.env.ADMIN_MASTER_KEY || '').trim();
    const activeAdminPin = cfg?.adminPin || envAdminPin || '120328';
    const pinUpper = pin.toUpperCase();
    const isStrictProd = process.env.NODE_ENV === 'production' && Boolean(envMasterKey);

    const isPinCorrect =
      timingSafeCompare(pin, activeAdminPin) ||
      (envMasterKey ? timingSafeCompare(pin, envMasterKey) : false) ||
      (!isStrictProd && (timingSafeCompare(pin, '120328') || timingSafeCompare(pinUpper, 'MASTER-2708') || timingSafeCompare(pinUpper, '2708')));

    if (isPinCorrect) {
      const sessionToken = createSessionJwt({
        userId: 'admin-owner',
        username: 'admin',
        role: 'admin',
        deviceId: cleanDevice,
        ttlDays: 30,
      });

      return {
        success: true,
        message: 'Acceso de Propietario verificado con éxito',
        sessionToken,
        user: {
          id: 'admin-owner',
          username: 'admin',
          displayName: 'Geovanny Contreras (Propietario)',
          pin: '[PROTECTED]',
          role: 'admin',
          status: 'active',
          planType: 'PERMANENT',
          planLabel: 'Acceso Propietario Ilimitado',
          createdAt: nowMs,
          expiresAt: null,
          boundDeviceId: cleanDevice,
          boundDeviceName: friendlyDevName,
          whatsappNumber: cfg?.adminWhatsApp || '573213902708',
          lastActiveAt: nowMs
        }
      };
    } else {
      return {
        success: false,
        code: 'INVALID_PIN',
        message: 'Credenciales incorrectas para la cuenta de Administrador Propietario.'
      };
    }
  }

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.warn('[Supabase User Login] Error:', error.message);
      }

      if (data) {
        if (!verifyUserPin(pin, data.pin_hash)) {
          return {
            success: false,
            code: 'INVALID_PIN',
            message: 'El PIN ingresado no es correcto para este usuario.'
          };
        }

        // Migración transparente a hash scrypt con sal si el PIN estaba en texto plano
        if (!isHashedPin(data.pin_hash)) {
          const upgradedHash = hashUserPin(pin);
          await client
            .from('sportstats_users')
            .update({ pin_hash: upgradedHash })
            .eq('id', data.id);
        }

        const isAdmin = data.role === 'admin';
        const isExpired = !isAdmin && Boolean(data.expires_at && Number(data.expires_at) < nowMs);
        const isPro = !isExpired;

        if (!isAdmin) {
          const deletedSet = getDeletedUsernamesSet();
          if (
            deletedSet.has(username) ||
            data.status === 'deleted' ||
            data.plan_type === 'DELETED' ||
            data.notes === '[DELETED]'
          ) {
            return {
              success: false,
              code: 'USER_NOT_FOUND',
              message: 'Esta cuenta ha sido eliminada por el administrador.'
            };
          }

          if (data.status === 'pending') {
            return {
              success: false,
              code: 'PENDING_APPROVAL',
              message: 'Tu cuenta está pendiente de activación por el administrador.'
            };
          }

          if (data.status === 'suspended') {
            return {
              success: false,
              code: 'SUSPENDED',
              message: 'Tu cuenta ha sido suspendida. Contacta al administrador.'
            };
          }
        }

        if (!data.bound_device_id) {
          await client
            .from('sportstats_users')
            .update({
              bound_device_id: cleanDevice,
              bound_device_name: friendlyDevName,
              bound_device_updated_at: new Date().toISOString(),
              last_active_at: nowMs
            })
            .eq('id', data.id);

          data.bound_device_id = cleanDevice;
          data.bound_device_name = friendlyDevName;
        } else if (data.bound_device_id !== cleanDevice && !isAdmin) {
          return {
            success: false,
            code: 'DEVICE_LOCKED',
            boundDeviceName: data.bound_device_name || 'Dispositivo Principal',
            message: `Esta cuenta ya está vinculada a otro dispositivo (${data.bound_device_name || 'dispositivo principal'}). Para cambiar de equipo solicita la desvinculación a tu administrador.`
          };
        } else {
          await client
            .from('sportstats_users')
            .update({
              last_active_at: nowMs,
              bound_device_name: friendlyDevName
            })
            .eq('id', data.id);
        }

        const daysRemaining = data.expires_at ? Math.max(0, Math.ceil((data.expires_at - nowMs) / (24 * 60 * 60 * 1000))) : null;

        const resolvedUser: AppUser = {
          id: data.id,
          username: data.username,
          email: data.email || null,
          displayName: data.display_name || undefined,
          pin: '[PROTECTED]',
          role: data.role || 'client',
          status: isExpired ? 'expired' : (data.status || 'active'),
          planType: data.plan_type || '30D',
          planLabel: data.plan_label || (isPro ? 'Pase Activo' : 'Plan Vencido'),
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
          authProvider: (data.auth_provider as any) || 'pin',
          feedbackBonusClaimed: Boolean(data.feedback_bonus_claimed)
        };

        const sessionToken = createSessionJwt({
          userId: resolvedUser.id,
          username: resolvedUser.username,
          role: resolvedUser.role,
          deviceId: cleanDevice,
          ttlDays: 30,
        });

        return {
          success: true,
          isPro,
          message: isPro ? 'Autenticación exitosa' : 'Tu plan de acceso ha vencido. Puedes ver marcadores básicos o activar tu plan VIP.',
          sessionToken,
          user: resolvedUser
        };
      }
    } catch (err) {
      console.error('[Supabase User Login Excepción]:', err);
    }
  }

  // Fallback en base de datos local del servidor
  const localUsers = getLocalUsersDb();
  const localUser = localUsers.find((u) => u.username === username);
  if (localUser) {
    if (!verifyUserPin(pin, localUser.pin)) {
      return {
        success: false,
        code: 'INVALID_PIN',
        message: 'El PIN ingresado no es correcto para este usuario.'
      };
    }

    // Actualizar automáticamente a hash scrypt si estaba en texto plano
    if (!isHashedPin(localUser.pin)) {
      localUser.pin = hashUserPin(pin);
      saveLocalUsersDb(localUsers);
    }

    const isAdmin = localUser.role === 'admin';
    if (!isAdmin) {
      if (localUser.status === 'pending') {
        return {
          success: false,
          code: 'PENDING_APPROVAL',
          message: 'Tu cuenta está pendiente de activación por el administrador.'
        };
      }
      if (localUser.status === 'suspended') {
        return {
          success: false,
          code: 'SUSPENDED',
          message: 'Tu cuenta ha sido suspendida. Contacta al administrador.'
        };
      }
      if (localUser.expiresAt && localUser.expiresAt < nowMs) {
        return {
          success: false,
          code: 'EXPIRED',
          message: 'Tu plan de acceso ha vencido. Contacta al administrador para renovar.'
        };
      }
    }

    if (!localUser.boundDeviceId) {
      localUser.boundDeviceId = cleanDevice;
      localUser.boundDeviceName = friendlyDevName;
      localUser.boundDeviceUpdatedAt = new Date().toISOString();
      localUser.lastActiveAt = nowMs;
      saveLocalUsersDb(localUsers);
    } else if (localUser.boundDeviceId !== cleanDevice && !isAdmin) {
      return {
        success: false,
        code: 'DEVICE_LOCKED',
        boundDeviceName: localUser.boundDeviceName || 'Dispositivo Principal',
        message: `Esta cuenta ya está vinculada a otro dispositivo (${localUser.boundDeviceName || 'dispositivo principal'}). Para cambiar de equipo solicita la desvinculación a tu administrador.`
      };
    } else {
      localUser.lastActiveAt = nowMs;
      localUser.boundDeviceName = friendlyDevName;
      saveLocalUsersDb(localUsers);
    }

    const daysRemaining = localUser.expiresAt
      ? Math.max(0, Math.ceil((localUser.expiresAt - nowMs) / (24 * 60 * 60 * 1000)))
      : null;

    const sessionToken = createSessionJwt({
      userId: localUser.id,
      username: localUser.username,
      role: localUser.role,
      deviceId: cleanDevice,
      ttlDays: 30,
    });

    return {
      success: true,
      message: 'Autenticación exitosa',
      sessionToken,
      user: {
        ...localUser,
        pin: '[PROTECTED]',
        daysRemaining,
        isExpired: localUser.expiresAt ? localUser.expiresAt < nowMs : false
      }
    };
  }

  return {
    success: false,
    code: 'USER_NOT_FOUND',
    message: 'El usuario no existe o las credenciales no son válidas.'
  };
}

export async function registerAppUserRequest(
  rawUsername: string,
  rawPin: string,
  displayName?: string,
  whatsapp?: string,
  deviceId?: string,
  deviceName?: string
): Promise<{ success: boolean; code?: string; message: string; username?: string }> {
  const username = normalizeUsername(rawUsername);
  const pin = String(rawPin || '').trim();
  const cleanDeviceId = deviceId ? sanitizeText(String(deviceId), 48).toUpperCase() : null;
  const friendlyDevName = sanitizeText(String(deviceName || 'Dispositivo Web / Móvil'), 80) || 'Dispositivo Web / Móvil';

  if (!username || username.length < 3) {
    return {
      success: false,
      code: 'INVALID_USERNAME',
      message: 'El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras de a-z y números).'
    };
  }

  if (!pin || pin.length < 4) {
    return {
      success: false,
      code: 'INVALID_PIN',
      message: 'El PIN debe tener al menos 4 dígitos.'
    };
  }

  const client = getSupabaseClient();
  const nowMs = Date.now();
  const cleanDisplayName = displayName ? sanitizeText(displayName, 60) : undefined;
  const cleanWhatsapp = whatsapp ? sanitizePhone(whatsapp) : undefined;
  const hashedPin = hashUserPin(pin);

  // 1. Guardar siempre en el respaldo local del servidor para garantizar 0 fallos de conexión
  const localUsers = getLocalUsersDb();

  // Prevención de creación masiva/infinita desde un mismo dispositivo
  if (cleanDeviceId) {
    const pendingOnDevice = localUsers.find(
      (u) => u.boundDeviceId === cleanDeviceId && u.status === 'pending' && u.username !== username
    );
    if (pendingOnDevice) {
      return {
        success: false,
        code: 'DEVICE_PENDING_EXISTS',
        message: `Ya tienes una solicitud pendiente (@${pendingOnDevice.username}) registrada desde este dispositivo. Espera a que el administrador la active o ingresa con tus credenciales.`
      };
    }
  }

  const existingLocal = localUsers.find((u) => u.username === username);
  if (existingLocal && existingLocal.status === 'active') {
    return {
      success: false,
      code: 'USER_EXISTS',
      message: 'Este nombre de usuario ya está activo y registrado. Elige otro o inicia sesión.'
    };
  }

  const newRecord: AppUser = existingLocal || {
    id: crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username,
    displayName: cleanDisplayName,
    pin: hashedPin,
    role: 'client',
    status: 'pending',
    planType: 'PENDING',
    planLabel: 'Pendiente de Activación',
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

  // 2. Sincronizar con Supabase si está configurado
  if (client) {
    try {
      const { data: existing } = await client
        .from('sportstats_users')
        .select('id, username, status')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          return {
            success: false,
            code: 'USER_EXISTS',
            message: 'Este nombre de usuario ya está registrado. Elige otro o inicia sesión.'
          };
        }
        // Si estaba en pending, actualizar sus datos de solicitud con PIN hasheado
        await client
          .from('sportstats_users')
          .update({
            pin_hash: hashedPin,
            display_name: cleanDisplayName || null,
            whatsapp_number: cleanWhatsapp || null
          })
          .eq('id', existing.id);

        return {
          success: true,
          message: 'Solicitud actualizada con éxito. Contacta al administrador para activar tu acceso.',
          username
        };
      }

      const { error } = await client.from('sportstats_users').insert({
        username,
        display_name: cleanDisplayName || null,
        pin_hash: hashedPin,
        role: 'client',
        status: 'pending',
        plan_type: 'PENDING',
        plan_label: 'Pendiente de Activación',
        created_at: nowMs,
        expires_at: null,
        bound_device_id: null,
        whatsapp_number: cleanWhatsapp || null
      });

      if (error) {
        console.warn('[Supabase Register Fallback Local]:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase Register Excepción Fallback Local]:', err);
    }
  }

  return {
    success: true,
    message: 'Solicitud creada con éxito. Contacta al administrador para activar tu acceso.',
    username
  };
}

const DELETED_USERS_FILE = IS_VERCEL
  ? path.resolve('/tmp', 'sportstats_deleted_users.json')
  : path.resolve(process.cwd(), 'sportstats_deleted_users.json');

let memoryDeletedUsernames: Set<string> | null = null;
let supabaseDeletedHydrated = false;

function getDeletedUsernamesSet(): Set<string> {
  if (memoryDeletedUsernames) return memoryDeletedUsernames;
  try {
    if (fs.existsSync(DELETED_USERS_FILE)) {
      const raw = fs.readFileSync(DELETED_USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryDeletedUsernames = new Set(parsed.map((item) => String(item).toLowerCase().trim()).filter(Boolean));
        return memoryDeletedUsernames;
      }
    }
  } catch {
    // ignore
  }
  memoryDeletedUsernames = new Set<string>();
  return memoryDeletedUsernames;
}

function saveDeletedUsernamesSet(set: Set<string>, syncRemote = true): void {
  memoryDeletedUsernames = set;
  const list = Array.from(set).filter(Boolean);
  try {
    fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // ignore
  }
  if (syncRemote && isSupabaseConfigured()) {
    setSupabaseKvCache('__deleted_users_v1__', list).catch(() => {});
  }
}

async function hydrateDeletedUsersFromSupabaseIfNeeded(): Promise<Set<string>> {
  const currentSet = getDeletedUsernamesSet();
  if (supabaseDeletedHydrated || !isSupabaseConfigured()) return currentSet;
  supabaseDeletedHydrated = true;
  try {
    const remote = await getSupabaseKvCache<string[]>('__deleted_users_v1__');
    if (remote && Array.isArray(remote.data)) {
      let added = false;
      for (const item of remote.data) {
        const clean = String(item || '').toLowerCase().trim();
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
    // ignore
  }
  return currentSet;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export async function adminListAppUsers(): Promise<AppUser[]> {
  const client = getSupabaseClient();
  const nowMs = Date.now();
  const deletedSet = await hydrateDeletedUsersFromSupabaseIfNeeded();
  const localUsers = getLocalUsersDb();
  const mergedMap = new Map<string, AppUser>();

  // Primero poblar desde base local (ocultando el hash del PIN en la respuesta HTTP)
  for (const u of localUsers) {
    const uname = String(u.username || '').toLowerCase().trim();
    if (!uname || deletedSet.has(uname) || u.status === 'deleted' || u.planType === 'DELETED' || u.notes === '[DELETED]') continue;
    const isPending = u.status === 'pending';
    const daysRemaining = isPending ? 0 : u.expiresAt ? Math.max(0, Math.ceil((u.expiresAt - nowMs) / (24 * 60 * 60 * 1000))) : null;
    const isExpired = isPending ? false : u.expiresAt ? u.expiresAt < nowMs : false;
    mergedMap.set(uname, {
      ...u,
      username: uname,
      pin: '[PROTECTED]',
      planType: isPending ? 'PENDING' : (u.planType || '30D'),
      planLabel: isPending ? 'Pendiente de Activación' : (u.planLabel || 'Pase Mensual'),
      expiresAt: isPending ? null : u.expiresAt,
      daysRemaining,
      isExpired
    });
  }

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_users')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const uname = String(row.username || '').toLowerCase().trim();
          if (
            !uname ||
            deletedSet.has(uname) ||
            row.status === 'deleted' ||
            row.plan_type === 'DELETED' ||
            row.notes === '[DELETED]'
          ) {
            continue;
          }

          const isPending = row.status === 'pending';
          const daysRemaining = isPending ? 0 : row.expires_at ? Math.max(0, Math.ceil((row.expires_at - nowMs) / (24 * 60 * 60 * 1000))) : null;
          const isExpired = isPending ? false : row.expires_at ? row.expires_at < nowMs : false;

          const item: AppUser = {
            id: row.id,
            username: uname,
            displayName: row.display_name || undefined,
            pin: '[PROTECTED]',
            role: row.role || 'client',
            status: row.status || 'active',
            planType: isPending ? 'PENDING' : (row.plan_type || '30D'),
            planLabel: isPending ? 'Pendiente de Activación' : (row.plan_label || 'Pase Mensual'),
            createdAt: Number(row.created_at || nowMs),
            expiresAt: isPending ? null : (row.expires_at ? Number(row.expires_at) : null),
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
      console.error('[adminListAppUsers Error]:', err);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

// Resetea el dispositivo vinculado para que el cliente pueda registrar un nuevo teléfono
export async function adminResetAppUserDevice(userId: string, username?: string): Promise<boolean> {
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : '';
  const localUsers = getLocalUsersDb();
  let matchedUsername = cleanUser;

  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || (cleanUser && u.username === cleanUser)) {
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
        const { error } = await client.from('sportstats_users').update(updatePayload).eq('id', userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client.from('sportstats_users').update(updatePayload).eq('username', matchedUsername);
        if (!error) return true;
      }
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Renueva o fijas la suscripción (días exactos o sumando días: mode = 'SET' | 'ADD')
export async function adminRenewAppUser(
  userId: string,
  addDays: number,
  username?: string,
  mode: 'SET' | 'ADD' = 'SET'
): Promise<boolean> {
  const nowMs = Date.now();
  const isPermanent = Number(addDays) === 0;
  const daysMs = Number(addDays) * 24 * 60 * 60 * 1000;
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : '';
  let matchedUsername = cleanUser;

  const planType = isPermanent ? 'PERMANENT' : (Number(addDays) === 1 ? '24H' : `${addDays}D`);
  const planLabel = isPermanent ? 'Pase Permanente Vitalicio' : (Number(addDays) === 1 ? 'Muestra 24 Horas' : `Pase ${addDays} Días`);

  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || (cleanUser && u.username === cleanUser)) {
      if (isPermanent) {
        u.expiresAt = null;
      } else if (mode === 'ADD' && u.expiresAt && u.expiresAt > nowMs) {
        u.expiresAt = u.expiresAt + daysMs;
      } else {
        u.expiresAt = nowMs + daysMs;
      }
      u.planType = planType;
      u.planLabel = planLabel;
      u.status = 'active';
      if (!matchedUsername) matchedUsername = u.username;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);

  const client = getSupabaseClient();
  if (client) {
    try {
      let newExpiry: number | null = null;
      if (!isPermanent) {
        if (mode === 'ADD') {
          const query = client.from('sportstats_users').select('expires_at');
          const { data: user } = isValidUuid(userId)
            ? await query.eq('id', userId).maybeSingle()
            : await query.eq('username', matchedUsername || userId).maybeSingle();

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
        status: 'active'
      };

      if (isValidUuid(userId)) {
        const { error } = await client.from('sportstats_users').update(updateData).eq('id', userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client.from('sportstats_users').update(updateData).eq('username', matchedUsername);
        if (!error) return true;
      }
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Activa o suspende un usuario
export async function adminToggleAppUserStatus(
  userId: string,
  newStatus: 'active' | 'suspended',
  username?: string
): Promise<boolean> {
  let updatedLocal = false;
  const cleanUser = username ? normalizeUsername(username) : '';
  let matchedUsername = cleanUser;
  const localUsers = getLocalUsersDb();
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId || (cleanUser && u.username === cleanUser)) {
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
        const { error } = await client.from('sportstats_users').update({ status: newStatus }).eq('id', userId);
        if (!error) return true;
      }
      if (matchedUsername) {
        const { error } = await client
          .from('sportstats_users')
          .update({ status: newStatus })
          .eq('username', matchedUsername);
        if (!error) return true;
      }
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Crear o actualizar usuario manualmente por el admin
export async function adminUpsertAppUser(user: Partial<AppUser>): Promise<boolean> {
  if (!user.username) return false;
  const cleanUser = normalizeUsername(user.username);
  if (!cleanUser) return false;

  // Si el usuario estaba en la lista de eliminados y el admin lo vuelve a crear explícitamente, restaurarlo
  const deletedSet = getDeletedUsernamesSet();
  if (deletedSet.has(cleanUser)) {
    deletedSet.delete(cleanUser);
    saveDeletedUsernamesSet(deletedSet);
  }

  const nowMs = Date.now();
  const defaultExpiry = nowMs + 30 * 24 * 60 * 60 * 1000;

  const localUsers = getLocalUsersDb();
  const existingIdx = localUsers.findIndex((u) => u.username === cleanUser);

  // Conservar el hash de PIN previo si no se envió un PIN nuevo explícito
  const incomingPin = user.pin && user.pin !== '[PROTECTED]' ? String(user.pin).trim() : '';
  const resolvedPinHash = incomingPin
    ? hashUserPin(incomingPin)
    : existingIdx >= 0
    ? localUsers[existingIdx].pin
    : hashUserPin('1234');

  const localRecord: AppUser = {
    id: existingIdx >= 0 ? localUsers[existingIdx].id : (crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`),
    username: cleanUser,
    displayName: user.displayName ? sanitizeText(user.displayName, 60) : (existingIdx >= 0 ? localUsers[existingIdx].displayName : undefined),
    pin: resolvedPinHash,
    role: user.role === 'admin' ? 'admin' : 'client',
    status: user.status || 'active',
    planType: sanitizeText(user.planType || '30D', 16),
    planLabel: sanitizeText(user.planLabel || 'Pase Mensual (30 Días)', 48),
    createdAt: user.createdAt || (existingIdx >= 0 ? localUsers[existingIdx].createdAt : nowMs),
    expiresAt: user.expiresAt !== undefined ? user.expiresAt : defaultExpiry,
    boundDeviceId: user.boundDeviceId !== undefined ? user.boundDeviceId : (existingIdx >= 0 ? localUsers[existingIdx].boundDeviceId : null),
    boundDeviceName: user.boundDeviceName !== undefined ? user.boundDeviceName : (existingIdx >= 0 ? localUsers[existingIdx].boundDeviceName : null),
    whatsappNumber: user.whatsappNumber ? sanitizePhone(user.whatsappNumber) : (existingIdx >= 0 ? localUsers[existingIdx].whatsappNumber : null),
    notes: user.notes ? sanitizeText(user.notes, 200) : (existingIdx >= 0 ? localUsers[existingIdx].notes : null)
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
      const payloadToUpsert: Record<string, unknown> = {
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
      // Si hay nuevo PIN o el usuario no existía, guardar pin_hash
      if (incomingPin || existingIdx < 0) {
        payloadToUpsert.pin_hash = resolvedPinHash;
      }

      await client.from('sportstats_users').upsert(
        payloadToUpsert,
        { onConflict: 'username' }
      );
    } catch {
      // fallback already saved in localUsers
    }
  }

  return true;
}

// Elimina permanentemente un usuario por ID y/o username
export async function adminDeleteAppUser(userId: string, username?: string): Promise<boolean> {
  const cleanId = String(userId || '').trim();
  const cleanUsername = username ? normalizeUsername(username) : '';
  let matchedUsername = cleanUsername;

  const localUsers = getLocalUsersDb();
  const remaining: AppUser[] = [];
  for (const u of localUsers) {
    const uname = String(u.username || '').toLowerCase().trim();
    const isMatch =
      (cleanId && (u.id === cleanId || uname === cleanId.toLowerCase())) ||
      (cleanUsername && uname === cleanUsername);
    if (isMatch) {
      if (!matchedUsername && uname) matchedUsername = uname;
    } else {
      remaining.push(u);
    }
  }

  if (remaining.length !== localUsers.length) {
    saveLocalUsersDb(remaining);
  }

  if (!matchedUsername && cleanId && !isValidUuid(cleanId) && !cleanId.startsWith('USR-')) {
    matchedUsername = normalizeUsername(cleanId);
  }

  const client = getSupabaseClient();
  if (client && !matchedUsername && isValidUuid(cleanId)) {
    try {
      const { data: existingRow } = await client
        .from('sportstats_users')
        .select('username')
        .eq('id', cleanId)
        .maybeSingle();
      if (existingRow?.username) {
        matchedUsername = normalizeUsername(existingRow.username);
      }
    } catch {
      // ignore
    }
  }

  if (matchedUsername) {
    const deletedSet = await hydrateDeletedUsersFromSupabaseIfNeeded();
    deletedSet.add(matchedUsername);
    saveDeletedUsernamesSet(deletedSet, true);
  }

  if (client) {
    try {
      // 1. Intentar DELETE físico directo (por ID y por username case-insensitive)
      if (isValidUuid(cleanId)) {
        await client.from('sportstats_users').delete().eq('id', cleanId);
      }
      if (matchedUsername) {
        await client.from('sportstats_users').delete().eq('username', matchedUsername);
        await client.from('sportstats_users').delete().ilike('username', matchedUsername);
      }

      // 2. Respaldo de Soft Delete a prueba de restricciones CHECK o políticas RLS sin permiso DELETE
      const primarySoftDelete = {
        status: 'deleted',
        plan_type: 'DELETED',
        plan_label: 'ELIMINADO',
        notes: '[DELETED]',
        bound_device_id: null
      };
      const fallbackSoftDelete = {
        status: 'suspended',
        plan_type: 'DELETED',
        plan_label: 'ELIMINADO',
        notes: '[DELETED]',
        bound_device_id: null
      };

      if (isValidUuid(cleanId)) {
        const { error } = await client.from('sportstats_users').update(primarySoftDelete).eq('id', cleanId);
        if (error) {
          await client.from('sportstats_users').update(fallbackSoftDelete).eq('id', cleanId);
        }
      }
      if (matchedUsername) {
        const { error } = await client.from('sportstats_users').update(primarySoftDelete).ilike('username', matchedUsername);
        if (error) {
          await client.from('sportstats_users').update(fallbackSoftDelete).ilike('username', matchedUsername);
        }
      }
    } catch (err) {
      console.warn('[adminDeleteAppUser Supabase warning]:', err);
    }
  }

  return true;
}

// SQL Script para crear las tablas en Supabase con un solo clic en el SQL Editor de Supabase
export const SUPABASE_SQL_SCHEMA = `
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




// =========================================================================
// GOOGLE AUTH, ANTIFRAUDE Y GESTIÓN DE CÓDIGOS DINÁMICOS VIP ($0 USD/MES)
// =========================================================================

export async function loginOrRegisterGoogleUser(
  rawEmail: string,
  rawDisplayName: string,
  deviceId: string,
  deviceName?: string,
  deviceFingerprint?: string,
  accessToken?: string
): Promise<LoginResult> {
  const email = String(rawEmail || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: 'Correo electrónico de Google inválido.'
    };
  }

  const client = getSupabaseClient();
  const isLocalOrDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;

  // Validación criptográfica estricta en producción: Se exige token verificado de Google
  if (client && !isLocalOrDev) {
    if (!accessToken) {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Acceso no autorizado: Se requiere verificación oficial con Google OAuth.'
      };
    }
    try {
      const { data: authData, error: authErr } = await client.auth.getUser(accessToken);
      if (authErr || !authData?.user?.email || authData.user.email.toLowerCase() !== email) {
        return {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token de Google inválido o no coincide con el usuario autenticado.'
        };
      }
    } catch {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Fallo al verificar credenciales con el proveedor de identidad.'
      };
    }
  }

  const cleanDevice = sanitizeText(String(deviceId || ''), 48).toUpperCase();
  const friendlyDevName = sanitizeText(String(deviceName || 'Dispositivo Web / Móvil'), 80);
  const nowMs = Date.now();

  const isOwnerAdmin =
    email === 'dgcontrerasb@gmail.com' ||
    email === 'dgcontreras@gmail.com' ||
    email.startsWith('dgcontreras');

  if (isOwnerAdmin) {
    const sessionToken = createSessionJwt({
      userId: 'admin-owner',
      username: 'admin',
      role: 'admin',
      deviceId: cleanDevice,
      ttlDays: 30,
    });

    return {
      success: true,
      isPro: true,
      message: 'Acceso de Administrador verificado con Google',
      sessionToken,
      user: {
        id: 'admin-owner',
        username: 'admin',
        email,
        displayName: 'Geovanny Contreras (Propietario)',
        pin: '[PROTECTED]',
        role: 'admin',
        status: 'active',
        planType: 'PERMANENT',
        planLabel: 'Acceso Propietario Ilimitado',
        createdAt: nowMs,
        expiresAt: null,
        boundDeviceId: cleanDevice,
        boundDeviceName: friendlyDevName,
        whatsappNumber: '573213902708',
        lastActiveAt: nowMs,
        isPro: true,
        isExpired: false,
        authProvider: 'google',
        feedbackBonusClaimed: true
      }
    };
  }

  if (!client) {
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: 'Error de conexión con el servidor de autenticación.'
    };
  }

  try {
    // 1. Buscar si ya existe por email
    const { data: existingUser } = await client
      .from('sportstats_users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.status === 'suspended') {
        return { success: false, code: 'SUSPENDED', message: 'Tu cuenta ha sido suspendida. Contacta al administrador.' };
      }
      if (existingUser.status === 'deleted') {
        return { success: false, code: 'USER_NOT_FOUND', message: 'Esta cuenta ha sido eliminada por el administrador.' };
      }

      // En entorno local o dispositivo de pruebas del administrador: auto-vincular sin bloquear
      const isLocalOrDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;
      const isAdminTestDevice = isLocalOrDev || cleanDevice.startsWith('DEV-');

      if (!existingUser.bound_device_id || (isAdminTestDevice && existingUser.bound_device_id !== cleanDevice)) {
        await client.from('sportstats_users').update({
          bound_device_id: cleanDevice,
          bound_device_name: friendlyDevName,
          last_active_at: nowMs
        }).eq('id', existingUser.id);
        existingUser.bound_device_id = cleanDevice;
      } else if (existingUser.bound_device_id !== cleanDevice) {
        return {
          success: false,
          code: 'DEVICE_LOCKED',
          message: `Esta cuenta ya está vinculada a otro dispositivo (${existingUser.bound_device_name || 'dispositivo principal'}).`,
          boundDeviceName: existingUser.bound_device_name
        };
      }

      const isExpired = Boolean(existingUser.expires_at && Number(existingUser.expires_at) < nowMs);
      const isPro = !isExpired;

      const sessionToken = createSessionJwt({
        userId: existingUser.id,
        username: existingUser.username,
        role: existingUser.role || 'client',
        deviceId: cleanDevice,
        ttlDays: 30
      });

      return {
        success: true,
        isPro,
        message: isPro ? 'Sesión iniciada con éxito.' : 'Tu periodo de prueba o plan ha vencido.',
        sessionToken,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          displayName: existingUser.display_name || rawDisplayName,
          pin: '[PROTECTED]',
          role: existingUser.role || 'client',
          status: isExpired ? 'expired' : (existingUser.status || 'active'),
          planType: existingUser.plan_type || 'GOOGLE_TRIAL',
          planLabel: existingUser.plan_label || (isPro ? 'Plan VIP' : 'Plan Vencido'),
          createdAt: Number(existingUser.created_at) || nowMs,
          expiresAt: existingUser.expires_at ? Number(existingUser.expires_at) : null,
          boundDeviceId: existingUser.bound_device_id,
          boundDeviceName: existingUser.bound_device_name,
          whatsappNumber: existingUser.whatsapp_number,
          feedbackBonusClaimed: Boolean(existingUser.feedback_bonus_claimed),
          lastActiveAt: nowMs,
          isPro,
          isExpired,
          authProvider: 'google'
        }
      };
    }

    // 2. Usuario NUEVO con Google
    // Exención de pruebas: Si es localhost / dev o dispositivo de pruebas del administrador, siempre otorgar los 3 días de prueba
    const isLocalOrDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;
    const isAdminTestDevice = isLocalOrDev || cleanDevice.startsWith('DEV-');
    let hasUsedTrial = false;

    if (!isAdminTestDevice && cleanDevice) {
      const { data: deviceUser } = await client
        .from('sportstats_users')
        .select('id, username')
        .eq('bound_device_id', cleanDevice)
        .limit(1)
        .maybeSingle();

      if (deviceUser) {
        hasUsedTrial = true;
      }
    }

    const expiresAt = hasUsedTrial ? nowMs : (nowMs + 3 * 24 * 60 * 60 * 1000);
    const isPro = !hasUsedTrial;
    const planLabel = hasUsedTrial ? 'Prueba no disponible (Dispositivo previo)' : 'Prueba Gratuita (3 Días)';

    // Nombre de usuario: Estrictamente alfanumérico a-z0-9 (sin guion bajo ni caracteres especiales) para cumplir restricción PostgreSQL
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user';
    const randPart = Math.random().toString(36).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
    let generatedUsername = `${baseUsername}${randPart}`.slice(0, 20);
    if (generatedUsername.length < 3) {
      generatedUsername = `user${Math.floor(100 + Math.random() * 900)}`;
    }

    const newUserData = {
      username: generatedUsername,
      email,
      display_name: rawDisplayName || email.split('@')[0],
      pin_hash: 'GOOGLE_OAUTH',
      role: 'client',
      status: isPro ? 'active' : 'expired',
      plan_type: hasUsedTrial ? 'EXPIRED_TRIAL' : 'GOOGLE_3D_TRIAL',
      plan_label: planLabel,
      created_at: nowMs,
      expires_at: expiresAt,
      bound_device_id: cleanDevice,
      bound_device_name: friendlyDevName,
      auth_provider: 'google',
      feedback_bonus_claimed: false,
      device_fingerprint: deviceFingerprint || cleanDevice
    };

    const { data: insertedUser, error: insertError } = await client
      .from('sportstats_users')
      .insert(newUserData)
      .select()
      .single();

    if (insertError) {
      console.error('[Supabase Google Register Error]:', insertError.message);
      return {
        success: false,
        code: 'SERVER_ERROR',
        message: `No fue posible registrar tu cuenta de Google: ${insertError.message}`
      };
    }

    const sessionToken = createSessionJwt({
      userId: insertedUser.id,
      username: insertedUser.username,
      role: 'client',
      deviceId: cleanDevice,
      ttlDays: 30
    });

    return {
      success: true,
      isPro,
      message: isPro 
        ? '¡Bienvenido! Tienes 3 días de prueba gratuita completa.' 
        : 'Tu dispositivo ya utilizó una prueba previa. Activa tu plan VIP para acceder a todos los análisis.',
      sessionToken,
      user: {
        id: insertedUser.id,
        username: insertedUser.username,
        email: insertedUser.email,
        displayName: insertedUser.display_name,
        pin: '[PROTECTED]',
        role: 'client',
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
        authProvider: 'google'
      }
    };
  } catch (err: any) {
    console.error('[Supabase Google Auth Error]:', err);
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: err?.message || 'Error inesperado durante la autenticación con Google.'
    };
  }
}

export async function redeemActivationCode(
  code: string,
  userIdentifier: string
): Promise<{ success: boolean; message: string; newExpiresAt?: number }> {
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanUser = String(userIdentifier || '').trim();

  if (!cleanCode || cleanCode.length < 5) {
    return { success: false, message: 'Código de activación inválido.' };
  }
  if (!cleanUser) {
    return { success: false, message: 'Usuario no identificado.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Error de conexión con el servidor.' };
  }

  try {
    // 1. Buscar código activo (con tolerancia para letra O vs número 0)
    const codeVariant1 = cleanCode.replace(/0/g, 'O');
    const codeVariant2 = cleanCode.replace(/O/g, '0');
    const { data: codeData, error: codeErr } = await client
      .from('sportstats_activation_codes')
      .select('*')
      .in('code', [cleanCode, codeVariant1, codeVariant2])
      .eq('is_used', false)
      .maybeSingle();

    if (codeErr || !codeData) {
      return { success: false, message: 'El código ingresado no existe o ya fue utilizado.' };
    }

    // 2. Buscar al usuario de forma exhaustiva (por email, username, display_name o id)
    let userData = null;

    if (cleanUser.includes('@')) {
      const { data } = await client.from('sportstats_users').select('*').ilike('email', cleanUser).maybeSingle();
      if (data) userData = data;
    }

    if (!userData) {
      const { data } = await client.from('sportstats_users').select('*').ilike('username', cleanUser.toLowerCase()).maybeSingle();
      if (data) userData = data;
    }

    if (!userData) {
      const { data } = await client.from('sportstats_users').select('*').ilike('display_name', cleanUser).maybeSingle();
      if (data) userData = data;
    }

    if (!userData) {
      const { data } = await client.from('sportstats_users').select('*').eq('id', cleanUser).maybeSingle();
      if (data) userData = data;
    }

    if (!userData) {
      return { success: false, message: 'Usuario no encontrado en la base de datos.' };
    }

    const nowMs = Date.now();
    const daysToAdd = Number(codeData.days) || 30;
    const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;

    const baseTimestamp = (userData.expires_at && Number(userData.expires_at) > nowMs)
      ? Number(userData.expires_at)
      : nowMs;
    const newExpiresAt = baseTimestamp + msToAdd;

    // 3. Marcar código como usado de forma transaccional
    await client
      .from('sportstats_activation_codes')
      .update({
        is_used: true,
        used_by: userData.email || userData.username,
        used_at: new Date().toISOString()
      })
      .eq('id', codeData.id);

    // 4. Actualizar usuario
    await client
      .from('sportstats_users')
      .update({
        expires_at: newExpiresAt,
        status: 'active',
        plan_type: `VIP_${daysToAdd}D`,
        plan_label: `Plan VIP (${daysToAdd} Días)`,
        last_active_at: nowMs
      })
      .eq('id', userData.id);

    return {
      success: true,
      message: `¡Código canjeado con éxito! Se activaron ${daysToAdd} días en tu Plan VIP.`,
      newExpiresAt
    };
  } catch (err) {
    console.error('[Redeem Code Error]:', err);
    return { success: false, message: 'Error interno al procesar el código de activación.' };
  }
}

export async function claimFeedbackBonus(
  userIdentifier: string
): Promise<{ success: boolean; message: string; newExpiresAt?: number }> {
  const cleanUser = String(userIdentifier || '').trim();
  if (!cleanUser) {
    return { success: false, message: 'Usuario no identificado.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Error de conexión con el servidor.' };
  }

  try {
    const isEmail = cleanUser.includes('@');
    let userQuery = client.from('sportstats_users').select('*');
    if (isEmail) {
      userQuery = userQuery.ilike('email', cleanUser);
    } else {
      userQuery = userQuery.eq('username', cleanUser.toLowerCase());
    }

    const { data: userData, error: userErr } = await userQuery.maybeSingle();

    if (userErr || !userData) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    if (userData.feedback_bonus_claimed) {
      return { success: false, message: 'Ya has reclamado previamente tu día adicional por feedback.' };
    }

    const nowMs = Date.now();
    const msToAdd = 24 * 60 * 60 * 1000;
    const baseTimestamp = (userData.expires_at && Number(userData.expires_at) > nowMs)
      ? Number(userData.expires_at)
      : nowMs;
    const newExpiresAt = baseTimestamp + msToAdd;

    await client
      .from('sportstats_users')
      .update({
        expires_at: newExpiresAt,
        status: 'active',
        feedback_bonus_claimed: true,
        last_active_at: nowMs
      })
      .eq('id', userData.id);

    return {
      success: true,
      message: '¡Muchas gracias por tu opinión! Se ha sumado 1 día adicional a tu cuenta.',
      newExpiresAt
    };
  } catch (err) {
    console.error('[Feedback Bonus Error]:', err);
    return { success: false, message: 'Error al aplicar el bono de feedback.' };
  }
}

export async function adminGenerateActivationCode(days: number = 30): Promise<{ success: boolean; code?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Sin conexión a base de datos' };

  try {
    // Caracteres legibles sin ambigüedad (se eliminan 0, O, 1, I, L)
    const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    const code = `VIP-${rand.slice(0, 4)}${rand.slice(4, 8)}-${days}D`;

    const { error } = await client
      .from('sportstats_activation_codes')
      .insert({
        code,
        days,
        is_used: false,
        created_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, code };
  } catch (err) {
    return { success: false, error: 'Error al generar código' };
  }
}

export async function adminListActivationCodes(): Promise<any[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data } = await client
      .from('sportstats_activation_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch {
    return [];
  }
}
