import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Key, X, Lock, Check, Copy, UserCheck, RefreshCw, Smartphone, MessageCircle, Power, Sparkles, Database, Users, Search, Unlock, Download, BarChart2, Printer, CheckCircle2, Trophy, Trash2, Eye, EyeOff } from 'lucide-react';
import { createLicenseToken, getOrCreateDeviceId, saveActiveLicense, verifyLicenseToken, clearActiveLicense } from '../services/licenseService';
import { AccuracyEvaluatorService, OverallAccuracySummary } from '../services/accuracyEvaluatorService';

interface AdminLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseChanged?: () => void;
  onLogout?: () => void;
}

export interface SupabaseUserItem {
  id: string;
  username: string;
  displayName?: string;
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
}

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({ isOpen, onClose, onLicenseChanged, onLogout }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('sportstats_admin_remember') === 'true';
  });
  const [pinInput, setPinInput] = useState(() => {
    return localStorage.getItem('sportstats_admin_saved_pin') || '';
  });
  const [showPinInput, setShowPinInput] = useState(false);
  const [showRecoveryNewPin, setShowRecoveryNewPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'USERS' | 'MONITOR' | 'AUDIT' | 'CONFIG'>('USERS');

  // Server Telemetry & Diagnostic Monitor State
  const [serverTelemetry, setServerTelemetry] = useState<any | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [copiedDiagnosticReport, setCopiedDiagnosticReport] = useState(false);

  // Supabase User Management State
  const [appUsersList, setAppUsersList] = useState<SupabaseUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<'ALL' | 'ONLINE' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BOUND'>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [confirmDeleteUserKey, setConfirmDeleteUserKey] = useState<string | null>(null);
  const [newQuickUsername, setNewQuickUsername] = useState('');
  const [newQuickPin, setNewQuickPin] = useState('');
  const [newQuickName, setNewQuickName] = useState('');
  const [newQuickDays, setNewQuickDays] = useState<number>(30);
  const [userRenewDays, setUserRenewDays] = useState<Record<string, number>>({});
  const [editingDaysUserId, setEditingDaysUserId] = useState<string | null>(null);
  const [customDaysInputValue, setCustomDaysInputValue] = useState<string>('15');

  // Config & Security PIN
  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');
  const [activeServerPin, setActiveServerPin] = useState(() => {
    return (
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      ''
    );
  });
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedCurrentPin, setCopiedCurrentPin] = useState(false);

  // Supabase Database Status & SQL Helper
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseProject, setSupabaseProject] = useState<string | null>(null);
  const [supabaseSqlSchema, setSupabaseSqlSchema] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Emergency Recovery States (when PIN is forgotten)
  const [showRecoveryMode, setShowRecoveryMode] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null);

  const buildAdminHeaders = (pin?: string, includeJson = false, idempotent = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (pin && pin.trim()) {
      headers['x-admin-pin'] = pin.trim();
    }
    const jwt = sessionStorage.getItem('sportstats_session_jwt');
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    }
    if (idempotent) {
      headers['Idempotency-Key'] = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return headers;
  };

  // Declare helpers BEFORE effects to prevent TDZ errors
  const loadConfig = useCallback(async () => {
    try {
      const storedPin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      const res = await fetch('/api/license/config', {
        headers: buildAdminHeaders(storedPin)
      });
      const data = await res.json();
      if (data.success) {
        if (data.adminWhatsApp) setAdminWhatsApp(data.adminWhatsApp);
        if (data.currentPin) {
          setActiveServerPin(data.currentPin);
          localStorage.setItem('sportstats_admin_saved_pin', data.currentPin);
        }
      }

      if (storedPin) {
        fetch('/api/admin/supabase-status', {
          headers: buildAdminHeaders(storedPin)
        })
          .then((r) => r.json())
          .then((sb) => {
            if (sb && sb.success) {
              setSupabaseConfigured(Boolean(sb.configured));
              setSupabaseProject(sb.supabaseProject || null);
              if (sb.sqlSchema) setSupabaseSqlSchema(sb.sqlSchema);
            }
          })
          .catch(() => {});
      }
    } catch {
      // fallback
    }
  }, []);

  const loadServerTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch('/api/admin/telemetry');
      const data = await res.json();
      if (data && (data.status === 'ok' || data.onlineNowCount !== undefined)) {
        setServerTelemetry(data);
      }
    } catch {
      // ignore network error
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  const getLocalDeletedUsernames = (): Set<string> => {
    try {
      const raw = localStorage.getItem('sportstats_deleted_usernames');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map((item) => String(item).toLowerCase().trim()));
        }
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  };

  const saveLocalDeletedUsernames = (set: Set<string>) => {
    try {
      localStorage.setItem('sportstats_deleted_usernames', JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  };

  const loadAppUsers = useCallback(async (pin: string) => {
    setIsLoadingUsers(true);
    const mergedMap = new Map<string, SupabaseUserItem>();
    const deletedSet = getLocalDeletedUsernames();

    // 1. Cargar solicitudes o usuarios guardados en caché local del navegador (excluyendo eliminados)
    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (u && u.username) {
              const uname = String(u.username).toLowerCase().trim();
              if (!uname || deletedSet.has(uname) || u.status === 'deleted') continue;
              const isPending = u.status === 'pending';
              const sanitizedUser = {
                ...u,
                username: uname,
                planType: isPending ? 'PENDING' : (u.planType || '30D'),
                planLabel: isPending ? 'Pendiente de Activación' : (u.planLabel || 'Pase Mensual'),
                expiresAt: isPending ? null : u.expiresAt,
                daysRemaining: isPending ? 0 : u.daysRemaining
              };
              delete (sanitizedUser as any).pin;
              mergedMap.set(uname, sanitizedUser);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Consultar servidor (Supabase + base del servidor) vía cabecera x-admin-pin
    try {
      const res = await fetch('/api/admin/users/list', {
        headers: buildAdminHeaders(pin)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        for (const u of data.users) {
          if (u && u.username) {
            const uname = String(u.username).toLowerCase().trim();
            if (!uname || deletedSet.has(uname) || u.status === 'deleted') continue;
            const isPending = u.status === 'pending';
            const sanitizedUser = {
              ...u,
              username: uname,
              planType: isPending ? 'PENDING' : (u.planType || '30D'),
              planLabel: isPending ? 'Pendiente de Activación' : (u.planLabel || 'Pase Mensual'),
              expiresAt: isPending ? null : u.expiresAt,
              daysRemaining: isPending ? 0 : u.daysRemaining
            };
            delete (sanitizedUser as any).pin;
            mergedMap.set(uname, sanitizedUser);
          }
        }
      }
    } catch {
      // ignore network error, keep local cache
    } finally {
      const finalUsers = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAppUsersList(finalUsers);
      try {
        localStorage.setItem('sportstats_local_users_cache', JSON.stringify(finalUsers));
      } catch {
        // ignore
      }
      setIsLoadingUsers(false);
    }
  }, []);

  const handleCreateOrUpdateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newQuickUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanUser || cleanUser.length < 3) {
      setActionFeedback('El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }

    // Si estaba eliminado previamente y el admin lo vuelve a crear explícitamente, quitar de eliminados
    const deletedSet = getLocalDeletedUsernames();
    if (deletedSet.has(cleanUser)) {
      deletedSet.delete(cleanUser);
      saveLocalDeletedUsernames(deletedSet);
    }

    const existingUser = appUsersList.find((u) => u.username === cleanUser);

    let cleanPin = newQuickPin.trim();
    if (!cleanPin) {
      cleanPin = existingUser ? '[PROTECTED]' : '1234';
    } else if (cleanPin.length < 4) {
      setActionFeedback('Si ingresas un PIN nuevo o deseas cambiarlo, debe tener al menos 4 dígitos.');
      return;
    }

    const currentPin = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
    const nowMs = Date.now();
    const isPermanent = newQuickDays === 0;
    const expiresAt = isPermanent ? null : nowMs + newQuickDays * 24 * 60 * 60 * 1000;
    const planType = isPermanent ? 'PERMANENT' : (newQuickDays === 1 ? '24H' : `${newQuickDays}D`);
    const planLabel = isPermanent 
      ? 'Pase Permanente Vitalicio' 
      : newQuickDays === 1 
      ? 'Muestra 24 Horas' 
      : `Pase ${newQuickDays} Días`;

    const userPayload: SupabaseUserItem & { pin?: string } = {
      id: existingUser?.id || `USR-${nowMs.toString(36).toUpperCase()}`,
      username: cleanUser,
      displayName: newQuickName.trim() || existingUser?.displayName || undefined,
      pin: cleanPin,
      role: existingUser?.role || 'client',
      status: 'active',
      planType,
      planLabel,
      createdAt: existingUser?.createdAt || nowMs,
      expiresAt,
      boundDeviceId: existingUser?.boundDeviceId || null,
      boundDeviceName: existingUser?.boundDeviceName || null,
      daysRemaining: isPermanent ? null : newQuickDays,
      isExpired: false
    };

    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      const list = rawLocal ? JSON.parse(rawLocal) : [];
      const safeList = Array.isArray(list) ? list : [];
      const idx = safeList.findIndex((u: any) => u.username === cleanUser);
      const localCopy = { ...userPayload };
      delete localCopy.pin;
      if (idx >= 0) {
        safeList[idx] = { ...safeList[idx], ...localCopy };
      } else {
        safeList.unshift(localCopy);
      }
      localStorage.setItem('sportstats_local_users_cache', JSON.stringify(safeList));
    } catch {
      // ignore
    }

    try {
      await fetch('/api/admin/users/upsert', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({ user: userPayload })
      });
    } catch {
      // ignore offline
    }

    const durationText = isPermanent ? 'Vitalicio' : newQuickDays === 1 ? 'Muestra 24 Horas' : `${newQuickDays} días`;
    const pinNote = !newQuickPin.trim() && !existingUser ? ' (PIN inicial encriptado: 1234)' : '';
    setNewQuickUsername('');
    setNewQuickPin('');
    setNewQuickName('');
    setActionFeedback(`Cuenta @${cleanUser} activada con éxito por ${durationText}${pinNote}.`);
    loadAppUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleResetUserDevice = async (userId: string, username: string) => {
    const currentPin = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const list = JSON.parse(rawLocal);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u.id === userId || u.username === username) {
              u.boundDeviceId = null;
              u.boundDeviceName = null;
            }
          }
          localStorage.setItem('sportstats_local_users_cache', JSON.stringify(list));
        }
      }
    } catch {
      // ignore
    }

    try {
      await fetch('/api/admin/users/reset-device', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({ userId, username })
      });
    } catch {
      // ignore
    }

    setActionFeedback(`Dispositivo desvinculado con éxito para @${username}. Ya puede registrar su nuevo equipo.`);
    loadAppUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleRenewUser = async (
    userId: string,
    username: string,
    targetDays = 30,
    mode: 'SET' | 'ADD' = 'SET'
  ) => {
    const currentPin = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
    const nowMs = Date.now();
    const isPermanent = Number(targetDays) === 0;
    const daysMs = Number(targetDays) * 24 * 60 * 60 * 1000;
    const planType = isPermanent ? 'PERMANENT' : (Number(targetDays) === 1 ? '24H' : `${targetDays}D`);
    const planLabel = isPermanent ? 'Pase Permanente Vitalicio' : (Number(targetDays) === 1 ? 'Muestra 24 Horas' : `Pase ${targetDays} Días`);

    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const list = JSON.parse(rawLocal);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u.id === userId || u.username === username) {
              if (isPermanent) {
                u.expiresAt = null;
                u.daysRemaining = null;
              } else if (mode === 'ADD' && u.expiresAt && u.expiresAt > nowMs) {
                u.expiresAt = u.expiresAt + daysMs;
                u.daysRemaining = Math.max(0, Math.ceil((u.expiresAt - nowMs) / (24 * 60 * 60 * 1000)));
              } else {
                u.expiresAt = nowMs + daysMs;
                u.daysRemaining = Number(targetDays);
              }
              u.planType = planType;
              u.planLabel = planLabel;
              u.status = 'active';
              u.isExpired = false;
            }
          }
          localStorage.setItem('sportstats_local_users_cache', JSON.stringify(list));
        }
      }
    } catch {
      // ignore
    }

    try {
      await fetch('/api/admin/users/renew', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({ userId, username, addDays: targetDays, mode })
      });
    } catch {
      // ignore
    }

    const durationNotice = isPermanent
      ? 'Acceso Permanente Vitalicio'
      : mode === 'SET'
      ? `Días fijados a ${targetDays} día(s)`
      : `+${targetDays} días agregados`;
    setActionFeedback(`Suscripción actualizada (${durationNotice}) para @${username}`);
    loadAppUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string, username?: string) => {
    const currentPin = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const list = JSON.parse(rawLocal);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u.id === userId || (username && u.username === username)) {
              u.status = newStatus;
            }
          }
          localStorage.setItem('sportstats_local_users_cache', JSON.stringify(list));
        }
      }
    } catch {
      // ignore
    }

    try {
      await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({ userId, username, status: newStatus })
      });
    } catch {
      // ignore
    }

    setActionFeedback(
      newStatus === 'active'
        ? `Cuenta ${username ? `@${username}` : ''} activada con éxito.`
        : `Cuenta ${username ? `@${username}` : ''} suspendida.`
    );
    loadAppUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    const cleanUser = String(username || '').toLowerCase().trim();
    setConfirmDeleteUserKey(null);

    // 1. Registrar en lista local de eliminados para evitar que reaparezca desde caché
    if (cleanUser) {
      const deletedSet = getLocalDeletedUsernames();
      deletedSet.add(cleanUser);
      saveLocalDeletedUsernames(deletedSet);
    }

    // 2. Eliminar inmediatamente de la lista en pantalla
    setAppUsersList((prev) =>
      prev.filter((u) => u.id !== userId && String(u.username || '').toLowerCase().trim() !== cleanUser)
    );

    // 3. Eliminar de la caché local de usuarios del navegador y sesiones activas
    try {
      const activeAuth = localStorage.getItem('sportstats_auth_user');
      if (activeAuth && activeAuth.toLowerCase().includes(cleanUser)) {
        localStorage.removeItem('sportstats_auth_user');
        localStorage.removeItem('sportstats_client_name');
      }
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const list = JSON.parse(rawLocal);
        if (Array.isArray(list)) {
          const filtered = list.filter(
            (u: any) => u.id !== userId && String(u?.username || '').toLowerCase().trim() !== cleanUser
          );
          localStorage.setItem('sportstats_local_users_cache', JSON.stringify(filtered));
        }
      }
    } catch {
      // ignore
    }

    // 4. Notificar al backend / Supabase enviando tanto userId como username
    try {
      const currentPin = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({ userId, username: cleanUser })
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(`Usuario @${cleanUser || username} eliminado definitivamente.`);
      } else {
        setActionFeedback(`Usuario @${cleanUser || username} eliminado correctamente.`);
      }
    } catch {
      setActionFeedback(`Usuario @${cleanUser || username} eliminado correctamente.`);
    }

    setTimeout(() => setActionFeedback(null), 4000);
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadServerTelemetry();
      const isRemembered = localStorage.getItem('sportstats_admin_remember') === 'true';
      const savedPin = localStorage.getItem('sportstats_admin_saved_pin') || '';
      if (isRemembered && savedPin) {
        setIsAdminAuthenticated(true);
        setActiveServerPin(savedPin);
        loadAppUsers(savedPin);
      }
      const interval = setInterval(() => {
        loadServerTelemetry();
      }, 15000);
      return () => clearInterval(interval);
    } else {
      setShowRecoveryMode(false);
      setRecoveryKeyInput('');
      setRecoveryError(null);
      setRecoverySuccessMsg(null);
    }
  }, [isOpen, loadConfig, loadAppUsers, loadServerTelemetry]);

  const unlockAdminDeviceAndAuthenticate = (validPinUsed: string) => {
    localStorage.setItem('sportstats_admin_remember', 'true');
    localStorage.setItem('sportstats_admin_saved_pin', validPinUsed);
    sessionStorage.setItem('futbolstats_admin_pin', validPinUsed);
    setActiveServerPin(validPinUsed);
    setIsAdminAuthenticated(true);

    // Unlock admin device permanently with VIP license
    const devId = getOrCreateDeviceId();
    const masterToken = createLicenseToken(devId, 'PERMANENT');
    const check = verifyLicenseToken(masterToken.key, devId);
    saveActiveLicense(masterToken.key, check);

    loadAppUsers(validPinUsed);
    loadConfig();
    if (onLicenseChanged) onLicenseChanged();
  };

  // Handle Admin PIN verification against server via x-admin-pin header
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const pin = pinInput.trim();

    if (!pin) {
      setPinError('Ingresa tu PIN de Administrador.');
      return;
    }

    try {
      const res = await fetch('/api/license/list', {
        headers: buildAdminHeaders(pin)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.currentPin) {
          setActiveServerPin(data.currentPin);
        }
        unlockAdminDeviceAndAuthenticate(pin);
        return;
      } else if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        setPinError(errData.message || 'Demasiados intentos fallidos. Espera unos minutos.');
        return;
      } else {
        setPinError('Código o credencial no válida.');
      }
    } catch {
      if (activeServerPin && pin === activeServerPin) {
        unlockAdminDeviceAndAuthenticate(pin);
      } else {
        setPinError('Error de conexión al verificar credenciales.');
      }
    }
  };

  const handleSendCredentialsToWhatsApp = (pinToSend: string) => {
    const cleanPhone = (adminWhatsApp || '573213902708').replace(/[^0-9]/g, '');
    const msg = `🔐 *Respaldo Privado de Administrador · SportStats Pro*\n\n📌 *Tu PIN Actual Activo:* ${pinToSend}\n\n_Guarda este mensaje en tu chat personal para tener siempre tu llave de acceso a la mano._`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmergencyRecovery = async () => {
    setRecoveryError(null);
    setRecoverySuccessMsg(null);
    const cleanKey = recoveryKeyInput.trim();

    if (!cleanKey) {
      setRecoveryError('Ingresa tu clave maestra de recuperación.');
      return;
    }

    if (recoveryNewPin.trim() && recoveryNewPin.trim().length < 4) {
      setRecoveryError('El nuevo PIN debe tener al menos 4 caracteres.');
      return;
    }

    try {
      const res = await fetch('/api/license/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAdminHeaders(undefined, false, true) },
        body: JSON.stringify({
          recoveryKey: cleanKey,
          deviceId: getOrCreateDeviceId(),
          newPin: recoveryNewPin.trim() || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        const pinToUse = recoveryNewPin.trim() || data.adminPin;
        setActiveServerPin(pinToUse);
        setPinInput(pinToUse);
        sessionStorage.setItem('futbolstats_admin_pin', pinToUse);
        localStorage.setItem('sportstats_admin_saved_pin', pinToUse);
        unlockAdminDeviceAndAuthenticate(pinToUse);
        setShowRecoveryMode(false);
        setRecoveryKeyInput('');
        setRecoveryNewPin('');
        return;
      } else if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        setRecoveryError(errData.message || 'Demasiados intentos fallidos. Espera 15 minutos.');
        return;
      } else {
        setRecoveryError('Clave de recuperación no válida.');
        return;
      }
    } catch {
      setRecoveryError('Error de conexión con el servidor al validar la clave de recuperación.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    setConfigError(null);

    const currentPin =
      pinInput.trim() ||
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      activeServerPin;

    if (newPin && newPin.trim().length < 4) {
      setConfigError('El nuevo PIN debe tener al menos 4 caracteres.');
      return;
    }

    if (newPin && newPin !== confirmPin) {
      setConfigError('El nuevo PIN y su confirmación no coinciden.');
      return;
    }

    try {
      const res = await fetch('/api/license/config', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({
          newPin: newPin.trim() || undefined,
          adminWhatsApp: adminWhatsApp.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        if (newPin.trim()) {
          const updatedPin = newPin.trim();
          setPinInput(updatedPin);
          setActiveServerPin(updatedPin);
          sessionStorage.setItem('futbolstats_admin_pin', updatedPin);
          localStorage.setItem('sportstats_admin_saved_pin', updatedPin);
          setNewPin('');
          setConfirmPin('');
          setConfigSuccess(`¡PIN de administrador actualizado con éxito! Tu nuevo PIN activo es: ${updatedPin}`);
        } else {
          setConfigSuccess('¡Configuración guardada con éxito!');
        }
        setTimeout(() => setConfigSuccess(null), 5000);
      } else {
        setConfigError(data.error || 'Error al guardar configuración');
      }
    } catch {
      setConfigError('Error de conexión con el servidor.');
    }
  };

  // Excel Export: Descarga directa de la base de usuarios en archivo Excel (.csv con BOM)
  const handleDownloadUsersExcel = () => {
    if (!appUsersList || appUsersList.length === 0) return;

    const headers = [
      'ID Usuario',
      'Usuario (@)',
      'Nombre Completo',
      'Rol',
      'Estado',
      'Tipo de Plan',
      'Nombre del Plan',
      'Días Restantes',
      'Fecha Creación',
      'Fecha Vencimiento',
      'Dispositivo Vinculado',
      'WhatsApp / Teléfono',
      'Última Actividad'
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      const s = String(str ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = appUsersList.map((u) => {
      const createdStr = u.createdAt ? new Date(u.createdAt).toLocaleString('es-CO') : '';
      const expiresStr = u.expiresAt ? new Date(u.expiresAt).toLocaleString('es-CO') : 'Vitalicio (Sin vencimiento)';
      const lastActiveStr = u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('es-CO') : 'Sin actividad';
      const daysStr = u.expiresAt === null ? 'Vitalicio' : String(u.daysRemaining ?? 0);
      const statusLabel =
        u.status === 'active'
          ? 'Activo'
          : u.status === 'suspended'
          ? 'Suspendido'
          : u.status === 'pending'
          ? 'Pendiente de activación'
          : 'Vencido';

      return [
        escapeCsv(u.id),
        escapeCsv(`@${u.username}`),
        escapeCsv(u.displayName || u.username),
        escapeCsv(u.role === 'admin' ? 'Administrador' : 'Cliente'),
        escapeCsv(statusLabel),
        escapeCsv(u.planType || '30D'),
        escapeCsv(u.planLabel || 'Pase 30 Días'),
        escapeCsv(daysStr),
        escapeCsv(createdStr),
        escapeCsv(expiresStr),
        escapeCsv(u.boundDeviceName || u.boundDeviceId || 'Sin vincular'),
        escapeCsv(u.whatsappNumber || ''),
        escapeCsv(lastActiveStr)
      ].join(';');
    });

    // UTF-8 BOM (\uFEFF) para visualización nativa y automática en Microsoft Excel
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Listado_Usuarios_SportStats_Pro_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCloseModal = () => {
    setPinError(null);
    onClose();
  };

  const handleLogoutAdmin = () => {
    try {
      clearActiveLicense();
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_client_name');
      sessionStorage.removeItem('futbolstats_admin_pin');
      sessionStorage.removeItem('sportstats_exp_alert_dismissed');
    } catch {
      // ignore storage errors
    }
    setIsAdminAuthenticated(false);
    setPinInput('');
    setActiveServerPin('');
    setPinError(null);
    onClose();
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  // STATE 1: Discrete Security Verification Box (Camouflaged - No mention of Admin Panel)
  if (!isAdminAuthenticated) {
    return (
      <div
        onClick={handleCloseModal}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0B111E] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center"
        >
          <button
            onClick={handleCloseModal}
            type="button"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center mx-auto mb-3.5">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>

          <h3 className="text-base font-bold text-white tracking-tight mb-1">
            {showRecoveryMode ? 'Recuperación de Acceso' : 'Verificación de Seguridad'}
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            {showRecoveryMode
              ? 'Solicita el envío del código de recuperación a tu WhatsApp o ingresa tu clave recibida.'
              : 'Ingresa el código de autorización para continuar.'}
          </p>

          {!showRecoveryMode ? (
            <form onSubmit={handleVerifyPin} className="space-y-3.5">
              <div className="relative">
                <input
                  type={showPinInput ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="••••••"
                  autoFocus
                  className="w-full bg-[#070B14] border border-slate-700/80 rounded-xl pl-4 pr-11 py-2.5 text-center text-lg font-mono tabular-nums tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPinInput(!showPinInput)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  title={showPinInput ? 'Ocultar PIN' : 'Ver PIN'}
                >
                  {showPinInput ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {pinError && (
                <div className="space-y-2">
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg">
                    {pinError}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryMode(true);
                      setRecoveryError(null);
                      setRecoverySuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition cursor-pointer"
                  >
                    ¿Olvidaste tu código? Recuperar acceso
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
                >
                  Verificar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3.5 text-left">
              <button
                type="button"
                onClick={() => {
                  const devId = getOrCreateDeviceId();
                  const cleanPhone = (adminWhatsApp || '573213902708').replace(/[^0-9]/g, '');
                  const msg = `⚠️ *Solicitud de Autorización / Recuperación · SportStats Pro*\n\nHola Administrador, se solicita verificación de seguridad para el dispositivo:\n📱 *Dispositivo:* ${devId}\n\nSi reconoces este intento, envía la clave de acceso correspondiente.`;
                  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Solicitar autorización al WhatsApp del Administrador</span>
              </button>

              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Ingresa código de autorización recibido:
                  </label>
                  <input
                    type="text"
                    value={recoveryKeyInput}
                    onChange={(e) => {
                      setRecoveryKeyInput(e.target.value);
                      setRecoveryError(null);
                    }}
                    placeholder="Código o clave de autorización"
                    autoFocus
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg px-3.5 py-2 text-center text-xs font-mono tracking-wider text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Nuevo PIN que deseas asignar (Opcional):
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRecoveryNewPin(!showRecoveryNewPin)}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showRecoveryNewPin ? <EyeOff className="w-3 h-3 text-emerald-400" /> : <Eye className="w-3 h-3" />}
                      <span>{showRecoveryNewPin ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showRecoveryNewPin ? 'text' : 'password'}
                      value={recoveryNewPin}
                      onChange={(e) => setRecoveryNewPin(e.target.value)}
                      placeholder="Mínimo 4 dígitos"
                      className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg pl-3.5 pr-10 py-2 text-center text-xs font-mono tracking-wider text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryNewPin(!showRecoveryNewPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                      title={showRecoveryNewPin ? 'Ocultar PIN' : 'Ver PIN'}
                    >
                      {showRecoveryNewPin ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {recoveryError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg text-center">
                  {recoveryError}
                </div>
              )}

              {recoverySuccessMsg && (
                <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-lg text-center font-semibold">
                  {recoverySuccessMsg}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleEmergencyRecovery}
                  className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-black transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Verificar y Desbloquear Acceso</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryMode(false);
                    setRecoveryKeyInput('');
                    setRecoveryError(null);
                  }}
                  className="w-full py-2 px-4 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer text-center"
                >
                  Volver a ingresar PIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STATE 2: Full Authenticated Admin Panel (Only visible after entering the valid PIN)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0C121E] border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Header */}
        <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-white flex items-center gap-2 truncate">
                <span>Panel de Administración · SportStats Pro</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Genera licencias, personaliza el logo y gestiona accesos.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            title="Cerrar y bloquear panel"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Authenticated Panel Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Pinned Responsive Tabs Bar */}
          <div className="sticky top-0 z-20 border-b border-slate-800 bg-[#0A101C] px-2 sm:px-4 pt-1.5 pb-0 flex items-center gap-1 sm:gap-2 text-xs font-bold overflow-x-auto scrollbar-none shrink-0">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${
                activeTab === 'USERS'
                  ? 'border-indigo-400 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Usuarios ({appUsersList.length})</span>
              <span className="inline sm:hidden">Usuarios ({appUsersList.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('MONITOR');
                loadServerTelemetry();
              }}
              className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${
                activeTab === 'MONITOR'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Monitor & API</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black text-emerald-300">
                🟢 {serverTelemetry?.onlineNowCount ?? 1}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${
                activeTab === 'AUDIT'
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Eficiencia (+EV)</span>
            </button>
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${
                activeTab === 'CONFIG'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Seguridad & PIN</span>
            </button>

            <button
              onClick={handleLogoutAdmin}
              className="ml-auto my-auto px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Cerrar sesión por completo y volver a la pantalla de inicio de sesión"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable independently) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* TAB 0: SUPABASE USERS */}
              {activeTab === 'USERS' && (
                <div className="space-y-4">
                  {/* Feedback Toast */}
                  {actionFeedback && (
                    <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{actionFeedback}</span>
                      </div>
                      <button
                        onClick={() => setActionFeedback(null)}
                        className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Quick Create / Activate User Form */}
                  <form
                    onSubmit={handleCreateOrUpdateQuickUser}
                    className="bg-[#080D16] p-3.5 rounded-xl border border-indigo-500/30 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Crear o Activar Usuario Rápido</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Activa al instante a cualquier cliente
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={newQuickUsername}
                        onChange={(e) => setNewQuickUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20))}
                        placeholder="Usuario (ej. carlos99)"
                        required
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="text"
                        value={newQuickPin}
                        onChange={(e) => setNewQuickPin(e.target.value)}
                        placeholder="PIN (opcional / privado)"
                        title="Opcional. Déjalo vacío si el cliente ya tiene su PIN personal (se mantendrá intacto) o para asignar 1234 por defecto."
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="text"
                        value={newQuickName}
                        onChange={(e) => setNewQuickName(e.target.value)}
                        placeholder="Nombre (opcional)"
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                      />
                      <select
                        value={newQuickDays}
                        onChange={(e) => setNewQuickDays(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                      >
                        <option value={1}>⚡ Muestra 24 Horas</option>
                        <option value={3}>⚡ 3 Días (Muestra)</option>
                        <option value={7}>📅 7 Días (Semanal)</option>
                        <option value={15}>📅 15 Días (Quincenal)</option>
                        <option value={30}>🗓️ 30 Días (Mensual)</option>
                        <option value={60}>🗓️ 60 Días (Bimestral)</option>
                        <option value={90}>🗓️ 90 Días (Trimestral)</option>
                        <option value={365}>🏆 365 Días (1 Año)</option>
                        <option value={0}>♾️ Vitalicio (Permanente)</option>
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>+ Activar Días</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <span className="text-amber-400 font-bold">🔒 PIN Secreto:</span> No necesitas pedirle el PIN al usuario. Si ya está registrado se conserva su PIN; si es nuevo y no se especifica, se le asigna 1234.
                    </p>
                  </form>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#080D16] p-2.5 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-bold">
                      {[
                        { id: 'ALL', label: `Todos (${appUsersList.length})` },
                        { id: 'ONLINE', label: `🟢 En Línea (${serverTelemetry?.onlineNowCount ?? 0})` },
                        { id: 'ACTIVE', label: '✅ Activos' },
                        { id: 'BOUND', label: '📱 Vinculados' },
                        { id: 'PENDING', label: '⏳ Pendientes' },
                        { id: 'SUSPENDED', label: '🚫 Suspendidos' }
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setUserFilter(f.id as any)}
                          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                            userFilter === f.id
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Buscar @usuario o nombre..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadUsersExcel}
                        disabled={appUsersList.length === 0}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center gap-1.5 shrink-0 transition cursor-pointer disabled:opacity-50"
                        title="Descargar listado completo de usuarios en archivo Excel (.csv compatible)"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Descargar Excel</span>
                        <span className="inline sm:hidden">Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const p = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
                          loadAppUsers(p);
                        }}
                        className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800 shrink-0 transition cursor-pointer"
                        title="Actualizar lista de usuarios"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Users Cards List */}
                  {isLoadingUsers && appUsersList.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Cargando usuarios desde Supabase...</span>
                    </div>
                  ) : appUsersList.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs bg-[#080D16] rounded-2xl border border-slate-800 p-6 space-y-2">
                      <Users className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-bold text-slate-300">No hay cuentas de usuario registradas aún</p>
                      <p className="text-[11px] text-slate-500">
                        Los clientes pueden registrarse directamente solicitando su cuenta o iniciando sesión desde la pantalla de bienvenida.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {appUsersList
                        .filter((u) => {
                          const isUserOnline =
                            (u.lastActiveAt ? Date.now() - u.lastActiveAt < 3 * 60 * 1000 : false) ||
                            (Array.isArray(serverTelemetry?.onlineUsers) &&
                              serverTelemetry.onlineUsers.some(
                                (ou: any) =>
                                  (ou.username && ou.username.toLowerCase() === (u.username || '').toLowerCase()) ||
                                  (ou.deviceId && u.boundDeviceId && ou.deviceId === u.boundDeviceId)
                              ));
                          if (userFilter === 'ONLINE' && !isUserOnline) return false;
                          if (userFilter === 'ACTIVE' && u.status !== 'active') return false;
                          if (userFilter === 'BOUND' && !u.boundDeviceId) return false;
                          if (userFilter === 'PENDING' && u.status !== 'pending') return false;
                          if (userFilter === 'SUSPENDED' && u.status !== 'suspended') return false;

                          if (userSearch.trim()) {
                            const q = userSearch.toLowerCase();
                            const userMatch = (u.username || '').toLowerCase().includes(q);
                            const nameMatch = (u.displayName || '').toLowerCase().includes(q);
                            const notesMatch = (u.notes || '').toLowerCase().includes(q);
                            const phoneMatch = (u.whatsappNumber || '').toLowerCase().includes(q);
                            return userMatch || nameMatch || notesMatch || phoneMatch;
                          }
                          return true;
                        })
                        .map((u) => {
                          const isSuspended = u.status === 'suspended';
                          const isExpired = u.isExpired || (u.expiresAt ? u.expiresAt < Date.now() : false);
                          const isBound = !!u.boundDeviceId;
                          const daysLeft = u.daysRemaining;
                          const isUserOnline =
                            (u.lastActiveAt ? Date.now() - u.lastActiveAt < 3 * 60 * 1000 : false) ||
                            (Array.isArray(serverTelemetry?.onlineUsers) &&
                              serverTelemetry.onlineUsers.some(
                                (ou: any) =>
                                  (ou.username && ou.username.toLowerCase() === (u.username || '').toLowerCase()) ||
                                  (ou.deviceId && u.boundDeviceId && ou.deviceId === u.boundDeviceId)
                              ));

                          return (
                            <div
                              key={u.id}
                              className={`p-4 rounded-2xl border space-y-3 text-xs transition ${
                                isSuspended
                                  ? 'bg-rose-950/10 border-rose-500/30'
                                  : isExpired
                                  ? 'bg-amber-950/10 border-amber-500/30'
                                  : isUserOnline
                                  ? 'bg-[#081218] border-emerald-500/40'
                                  : 'bg-[#080D16] border-slate-800'
                              }`}
                            >
                              {/* Header Row: Username, Role, Status */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-black text-sm text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                    @{u.username}
                                  </span>
                                  {u.displayName && (
                                    <span className="font-bold text-slate-100 text-sm">
                                      {u.displayName}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                                    {u.role === 'admin' ? '🛡️ Admin' : '👤 Cliente'}
                                  </span>
                                  {isUserOnline && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                                      <span>🟢 EN LÍNEA</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                      isSuspended
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : isExpired
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : u.status === 'pending'
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                  >
                                    {isSuspended
                                      ? 'Suspendido'
                                      : isExpired
                                      ? 'Vencido'
                                      : u.status === 'pending'
                                      ? 'Pendiente'
                                      : 'Activo'}
                                  </span>
                                </div>
                              </div>

                              {/* Details Grid: Plan & Device Binding */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                 {/* Plan & Expiry */}
                                <div className="bg-[#050810] p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">
                                      Plan Activo
                                    </span>
                                    <span className="font-bold text-slate-200">
                                      {u.status === 'pending' ? 'Pendiente de Activación' : u.planLabel}
                                    </span>
                                  </div>
                                  <div className="flex flex-col mt-2 pt-1.5 border-t border-slate-800/40 gap-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase font-bold text-slate-400">
                                        Días Restantes
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`font-mono font-black text-xs ${
                                            u.status === 'pending'
                                              ? 'text-amber-400 font-bold'
                                              : isSuspended || isExpired
                                              ? 'text-rose-400'
                                              : daysLeft !== null && daysLeft !== undefined && daysLeft <= 3
                                              ? 'text-amber-400 font-bold'
                                              : 'text-emerald-400'
                                          }`}
                                        >
                                          {u.status === 'pending'
                                            ? '0 días (Pendiente de aprobación)'
                                            : daysLeft === null || daysLeft === undefined
                                            ? 'Vitalicio (Sin Fin)'
                                            : `${daysLeft} días`}
                                        </span>
                                        {editingDaysUserId !== u.id && u.status !== 'pending' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingDaysUserId(u.id);
                                              setCustomDaysInputValue(String(daysLeft ?? 15));
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                                            title="Fijar o modificar cantidad exacta de días restantes"
                                          >
                                            <span>✏️ Editar</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {editingDaysUserId === u.id && (
                                      <div className="mt-1 p-1.5 bg-slate-950 border border-cyan-500/50 rounded-xl flex items-center justify-between gap-1 flex-wrap animate-fadeIn">
                                        <span className="text-[10px] text-cyan-300 font-bold">Fijar Días:</span>
                                        <input
                                          type="number"
                                          min="0"
                                          max="3650"
                                          value={customDaysInputValue}
                                          onChange={(e) => setCustomDaysInputValue(e.target.value)}
                                          className="w-16 bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-cyan-400"
                                          placeholder="Días"
                                        />
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = parseInt(customDaysInputValue, 10);
                                              if (!isNaN(val) && val >= 0) {
                                                handleRenewUser(u.id, u.username, val, 'SET');
                                                setEditingDaysUserId(null);
                                              }
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer transition shadow-xs"
                                            title="Fijar exactamente esta cantidad de días a partir de hoy (remplaza días anteriores)"
                                          >
                                            ✅ Fijar Días
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = parseInt(customDaysInputValue, 10);
                                              if (!isNaN(val) && val > 0) {
                                                handleRenewUser(u.id, u.username, val, 'ADD');
                                                setEditingDaysUserId(null);
                                              }
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition"
                                            title="Sumar estos días a la vigencia actual"
                                          >
                                            + Sumar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingDaysUserId(null)}
                                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bound Device Info (Strict Single-Device Protection) */}
                                <div className="bg-[#050810] p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                      <Smartphone className="w-3 h-3 text-cyan-400" />
                                      <span>Dispositivo Único</span>
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        isBound
                                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      }`}
                                    >
                                      {isBound ? '1 Vinculado' : 'Sin Vincular'}
                                    </span>
                                  </div>

                                  <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex items-center justify-between gap-2">
                                    {isBound ? (
                                      <>
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-mono text-slate-300 truncate font-semibold" title={u.boundDeviceId || ''}>
                                            {u.boundDeviceName || u.boundDeviceId}
                                          </p>
                                          <span className="text-[9px] text-slate-500 block truncate">
                                            Bloqueado a este equipo
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleResetUserDevice(u.id, u.username)}
                                          className="shrink-0 px-2 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                          title="Permitir que el cliente inicie sesión en otro equipo"
                                        >
                                          <Unlock className="w-3 h-3" />
                                          <span>Desvincular</span>
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">
                                        Listo para vincular al iniciar sesión
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons Toolbar */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Flexible Duration Selector & Apply/Set Buttons */}
                                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                                    <select
                                      value={userRenewDays[u.id] ?? 30}
                                      onChange={(e) => setUserRenewDays((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                                      className="bg-transparent text-white text-[11px] font-bold px-1.5 py-1 focus:outline-none cursor-pointer"
                                      title="Selecciona la cantidad de días para fijar o renovar"
                                    >
                                      <option value={1}>⚡ 1 Día (Muestra 24h)</option>
                                      <option value={3}>⚡ 3 Días</option>
                                      <option value={5}>📅 5 Días</option>
                                      <option value={7}>📅 7 Días</option>
                                      <option value={15}>📅 15 Días</option>
                                      <option value={30}>🗓️ 30 Días (Mes)</option>
                                      <option value={60}>🗓️ 60 Días</option>
                                      <option value={90}>🗓️ 90 Días</option>
                                      <option value={365}>🏆 365 Días (Año)</option>
                                      <option value={0}>♾️ Vitalicio</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'SET')}
                                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                                      title="Fijar exactamente esta cantidad de días desde hoy"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>{u.status === 'pending' ? '✅ Aprobar & Activar' : '✅ Fijar Días'}</span>
                                    </button>
                                    {u.status !== 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'ADD')}
                                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold transition cursor-pointer"
                                        title="Sumar estos días a los días restantes actuales"
                                      >
                                        + Sumar
                                      </button>
                                    )}
                                  </div>

                                  {/* Quick 1-Click 1 Day Sample Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRenewUser(u.id, u.username, 1, 'SET')}
                                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                    title="Fijar 1 día exacto de prueba (24 horas)"
                                  >
                                    <span>⚡ 1 Día</span>
                                  </button>

                                  {/* Quick 1-Click 15 Days Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRenewUser(u.id, u.username, 15, 'SET')}
                                    className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                    title="Fijar exactamente 15 días restantes desde hoy"
                                  >
                                    <span>📅 15d</span>
                                  </button>

                                  {/* Quick 1-Click 30 Days Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRenewUser(u.id, u.username, 30, 'SET')}
                                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer"
                                    title="Fijar exactamente 30 días restantes desde hoy"
                                  >
                                    <span>30d</span>
                                  </button>

                                  {/* Toggle Active / Suspended */}
                                  {u.status !== 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleUserStatus(u.id, u.status, u.username)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                        isSuspended
                                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                                          : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'
                                      }`}
                                    >
                                      {isSuspended ? 'Reactivar Cuenta' : 'Suspender'}
                                    </button>
                                  )}

                                  {/* Delete User Profile Permanently (Inline confirmation compatible with iframes/mobile) */}
                                  {confirmDeleteUserKey === (u.username || u.id) ? (
                                    <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-500/50 rounded-lg px-2 py-0.5 animate-fadeIn">
                                      <span className="text-[10px] font-bold text-rose-200 mr-1">
                                        ¿Eliminar @{u.username}?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition cursor-pointer shadow-xs"
                                      >
                                        Sí, Eliminar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteUserKey(null)}
                                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserKey(u.username || u.id)}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                      title={`Eliminar permanentemente la cuenta de @${u.username}`}
                                    >
                                      <Trash2 className="w-3 h-3 text-rose-400" />
                                      <span>Eliminar</span>
                                    </button>
                                  )}
                                </div>

                                {/* Send WhatsApp notification */}
                                {u.whatsappNumber && (
                                  <a
                                    href={`https://wa.me/${u.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                      `Hola ${u.displayName || u.username}, tu cuenta de SportStats Pro (@${u.username}) está activa. Puedes ingresar desde cualquier navegador.`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB MONITOR: USUARIOS ONLINE, RÉCORD PICO, CUOTA API Y DIAGNÓSTICO */}
              {activeTab === 'MONITOR' && (() => {
                const onlineNow = serverTelemetry?.onlineNowCount ?? 1;
                const peakUsers = serverTelemetry?.peakOnlineUsers ?? onlineNow;
                const peakTimeStr = serverTelemetry?.peakOnlineAt
                  ? new Date(serverTelemetry.peakOnlineAt).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })
                  : 'Hoy';
                const remainingQuota =
                  serverTelemetry?.remainingCalls !== null && serverTelemetry?.remainingCalls !== undefined
                    ? Number(serverTelemetry.remainingCalls)
                    : null;
                const consumedEst =
                  serverTelemetry?.consumedTodayEst !== null && serverTelemetry?.consumedTodayEst !== undefined
                    ? Number(serverTelemetry.consumedTodayEst)
                    : serverTelemetry?.apiFootballCallsSinceBoot ?? 0;
                const callsSinceBoot = serverTelemetry?.apiFootballCallsSinceBoot ?? 0;
                const cacheHits = serverTelemetry?.serverCacheHits ?? 0;
                const cacheMisses = serverTelemetry?.serverCacheMisses ?? 0;
                const cacheHitRate = serverTelemetry?.cacheHitRatePct ?? 100;
                const espnPulses = serverTelemetry?.espnPulseCallsCount ?? 0;
                const onlineList: any[] = Array.isArray(serverTelemetry?.onlineUsers)
                  ? serverTelemetry.onlineUsers
                  : [];
                const apiLogList: any[] = Array.isArray(serverTelemetry?.apiFootballAuditLog)
                  ? serverTelemetry.apiFootballAuditLog
                  : [];

                const buildDiagnosticReportText = () => {
                  const nowStr = new Date().toLocaleString('es-CO');
                  const onlineUsersFormatted =
                    onlineList.length > 0
                      ? onlineList
                          .map((u) => `@${u.username || 'invitado'} (${u.deviceName || u.deviceId || 'equipo'} - hace ${u.secondsAgo ?? 0}s)`)
                          .join(', ')
                      : 'Ninguno registrado en ventana de 3 min';
                  const recentApiCallsFormatted =
                    apiLogList.length > 0
                      ? apiLogList
                          .slice(0, 8)
                          .map(
                            (c) =>
                              `  - [${new Date(c.at).toLocaleTimeString('es-CO')}] ${c.endpoint} | Fecha: ${c.targetDate} | Partidos: ${c.fixturesCount} | Restantes: ${c.remainingAfter ?? '?'}`
                          )
                          .join('\n')
                      : '  - 0 llamadas directas a API-Football en esta sesión (100% servido desde Caché/ESPN)';

                  return [
                    `📊 INFORME DE DIAGNÓSTICO SPORTSTATS PRO (${nowStr})`,
                    `==========================================================`,
                    `🛡️ Versión Blindaje Backend: ${serverTelemetry?.bundleVersion || 'v2.6-shield-6h'} (TTL: ${serverTelemetry?.scheduleTTLHours || 6}h)`,
                    `🟢 Usuarios Online Ahora (ventana 3m): ${onlineNow} (${onlineUsersFormatted})`,
                    `🏆 Récord Máximo Usuarios Online: ${peakUsers} (alcanzado: ${peakTimeStr})`,
                    `👥 Total Usuarios Registrados: ${appUsersList.length}`,
                    `----------------------------------------------------------`,
                    `📡 ESTADO DE CUOTA API-FOOTBALL (Límite 100/día):`,
                    `• Llamadas API-Football en esta sesión: ${callsSinceBoot}`,
                    `• Cuota Restante Reportada por API-Sports: ${remainingQuota !== null ? `${remainingQuota} / 100` : 'Sin consumo en sesión actual (100% Caché)'}`,
                    `• Consumo Diario Estimado: ${remainingQuota !== null ? `${consumedEst}% (${consumedEst}/100)` : `${callsSinceBoot} llamadas locales`}`,
                    `• Eficiencia de Caché Servidor: ${cacheHitRate}% (${cacheHits} aciertos en caché vs ${cacheMisses} llamadas nuevas)`,
                    `• Pulsos en Vivo Gratuitos (ESPN/TheSportsDB): ${espnPulses} (0 costo de cuota)`,
                    `• Tiempo activo servidor (Uptime): ${serverTelemetry?.uptimeMinutes ?? 0} min | RAM: ${serverTelemetry?.memoryMb ?? 0} MB`,
                    `----------------------------------------------------------`,
                    `📋 ÚLTIMAS LLAMADAS REALES A API-FOOTBALL:`,
                    recentApiCallsFormatted,
                    `==========================================================`
                  ].join('\n');
                };

                const handleCopyReport = () => {
                  const text = buildDiagnosticReportText();
                  navigator.clipboard.writeText(text).then(() => {
                    setCopiedDiagnosticReport(true);
                    setTimeout(() => setCopiedDiagnosticReport(false), 4000);
                  });
                };

                return (
                  <div className="space-y-4">
                    {/* Header Banner + Refresh */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>Centro de Control en Tiempo Real · Usuarios & Cuota API</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Monitorea quién está conectado, el pico máximo de tráfico y cada llamada a API-Football.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={loadServerTelemetry}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
                          <span>Refrescar Monitor</span>
                        </button>
                      </div>
                    </div>

                    {/* 4 KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Card 1: Online Now */}
                      <div className="bg-[#080D16] border border-emerald-500/30 rounded-2xl p-3 flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <span>🟢 Usuarios Online</span>
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black font-mono text-white">{onlineNow}</span>
                          <span className="text-[10px] text-slate-400">conectados ahora</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">
                          Ventana activa: últimos 3 min
                        </span>
                      </div>

                      {/* Card 2: Peak Online Record */}
                      <div className="bg-[#080D16] border border-amber-500/30 rounded-2xl p-3 flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span>Máximo Online</span>
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black font-mono text-amber-300">{peakUsers}</span>
                          <span className="text-[10px] text-slate-400">récord pico</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 truncate" title={peakTimeStr}>
                          Pico: {peakTimeStr}
                        </span>
                      </div>

                      {/* Card 3: API-Football Quota */}
                      <div className="bg-[#080D16] border border-cyan-500/30 rounded-2xl p-3 flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                          <Database className="w-3 h-3 text-cyan-400" />
                          <span>Llamadas API Hoy</span>
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black font-mono text-cyan-300">
                            {remainingQuota !== null ? `${consumedEst}/100` : callsSinceBoot}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {remainingQuota !== null ? `(${remainingQuota} libres)` : 'en sesión'}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-400 mt-1 font-semibold">
                          Blindaje 6h activo (0 fugas)
                        </span>
                      </div>

                      {/* Card 4: Server Cache Hit Rate */}
                      <div className="bg-[#080D16] border border-indigo-500/30 rounded-2xl p-3 flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Ahorro en Caché</span>
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black font-mono text-indigo-300">{cacheHitRate}%</span>
                          <span className="text-[10px] text-slate-400">({cacheHits} hits)</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">
                          ESPN Gratis: {espnPulses} pulsos
                        </span>
                      </div>
                    </div>

                    {/* Section: Generador de Informe Corto para Copiar y Pegar en el Chat */}
                    <div className="bg-gradient-to-br from-indigo-950/35 via-[#080D16] to-slate-900 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Informe Corto de Diagnóstico (Listo para Copiar y Pegar)</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Copia este resumen con 1 clic y pégalo en el chat para analizar juntos si la página está trabajando en óptimo estado.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyReport}
                          className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-md ${
                            copiedDiagnosticReport
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-indigo-500 hover:bg-indigo-400 text-white'
                          }`}
                        >
                          {copiedDiagnosticReport ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>¡Informe Copiado al Portapapeles!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>📋 Copiar Informe de Diagnóstico</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="bg-[#050810] border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                        {buildDiagnosticReportText()}
                      </pre>
                    </div>

                    {/* Two Columns: Connected Users Now & Recent API-Football Audit Log */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Online Users List */}
                      <div className="bg-[#080D16] border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🟢 Usuarios Conectados Ahora ({onlineList.length})</span>
                          </h4>
                          <span className="text-[10px] text-slate-500">Pulso cada 45s</span>
                        </div>
                        {onlineList.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">
                            Sincronizando sesiones activas...
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {onlineList.map((ou, idx) => (
                              <div
                                key={`${ou.deviceId || idx}`}
                                className="p-2.5 rounded-xl bg-[#050810] border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="font-mono font-bold text-indigo-300 truncate">
                                      @{ou.username || 'admin_o_cliente'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    📱 {ou.deviceName || ou.deviceId}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                                  hace {ou.secondsAgo ?? 0}s
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* API-Football Audit Log */}
                      <div className="bg-[#080D16] border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>📡 Registro de Llamadas API-Football ({apiLogList.length})</span>
                          </h4>
                          <span className="text-[10px] text-slate-500">Solo llamadas reales</span>
                        </div>
                        {apiLogList.length === 0 ? (
                          <div className="py-5 text-center space-y-1">
                            <p className="text-xs font-bold text-emerald-400">
                              ✅ 0 llamadas nuevas a API-Football en esta sesión
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Todos los usuarios y botones Actualizar están leyendo desde la caché blindada de 6 horas y el pulso gratuito de ESPN.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {apiLogList.map((entry, idx) => (
                              <div
                                key={`${entry.at}-${idx}`}
                                className="p-2.5 rounded-xl bg-[#050810] border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-cyan-300">
                                      Fecha: {entry.targetDate}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      ({entry.fixturesCount} partidos)
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                                    {new Date(entry.at).toLocaleTimeString('es-CO')} · {entry.endpoint}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                                  Libres: {entry.remainingAfter ?? '?'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 1: SEGURIDAD & PIN */}
              {activeTab === 'CONFIG' && (
                <div className="space-y-5">
                  {/* Card 2: Current PIN & Emergency Master Code Backup */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/25 via-slate-900/70 to-slate-900/50 border border-amber-500/30 space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span>Tus Credenciales Actuales & Respaldo de Emergencia</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                        PIN Activo Verificado
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            PIN Actual Activo
                          </span>
                          <span className="font-mono text-base font-black text-amber-300 tracking-widest">
                            {activeServerPin || pinInput || 'Cargando...'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activeServerPin);
                            setCopiedCurrentPin(true);
                            setTimeout(() => setCopiedCurrentPin(false), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedCurrentPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCurrentPin ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>

                      <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Recuperación de Emergencia
                          </span>
                          <span className="font-mono text-xs font-bold text-cyan-300">
                            Protegido en Servidor (ADMIN_MASTER_KEY)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Puedes enviarte un respaldo privado de tu PIN activo directamente a tu propio WhatsApp personal.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSendCredentialsToWhatsApp(activeServerPin)}
                        className="shrink-0 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Guardar en mi WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 2.5: Supabase Cloud Database Status & Quick Setup */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/20 via-slate-900/70 to-slate-900/50 border border-teal-500/30 space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-teal-400" />
                        <span>Base de Datos en la Nube (Supabase Free)</span>
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          supabaseConfigured
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        }`}
                      >
                        {supabaseConfigured ? `Conectado · ${supabaseProject || 'Supabase'}` : 'Almacenamiento Local (Listo para Supabase)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Conectar una base de datos gratuita de <strong>Supabase</strong> permite sincronizar en la nube todos los registros de licencias, presencia de dispositivos, PIN seguro y códigos de autorización OTP de un solo uso sin exponer llaves maestras en WhatsApp ni en el navegador.
                    </p>

                    <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-200">
                          1. Script SQL para Crear Tablas en Supabase:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (supabaseSqlSchema) {
                              navigator.clipboard.writeText(supabaseSqlSchema);
                              setCopiedSql(true);
                              setTimeout(() => setCopiedSql(false), 2500);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSql ? '¡SQL Copiado!' : 'Copiar Script SQL'}</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Copia este script y pégalo en el <strong>SQL Editor</strong> de tu proyecto en Supabase para crear las tablas con un solo clic.
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 bg-[#070B14] p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-200 block text-[10px] uppercase tracking-wider mb-1">
                        2. Variables a configurar en tu entorno (.env / Vercel):
                      </span>
                      <div className="font-mono text-[10px] text-teal-300 space-y-0.5">
                        <div>SUPABASE_URL=https://tu-proyecto.supabase.co</div>
                        <div>SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: PIN & WhatsApp Form */}
                  <form onSubmit={handleSaveConfig} className="space-y-5">
                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cambiar PIN de Administrador</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Este PIN es tu llave privada y secreta para acceder a este panel (actualmente <strong>{activeServerPin}</strong>).
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-300">
                              Nuevo PIN (mínimo 4 dígitos):
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowNewPin(!showNewPin)}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              {showNewPin ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                              <span>{showNewPin ? 'Ocultar' : 'Ver'}</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showNewPin ? 'text' : 'password'}
                              value={newPin}
                              onChange={(e) => {
                                setNewPin(e.target.value);
                                setConfigError(null);
                              }}
                              placeholder="Escribe nuevo PIN"
                              className="w-full bg-[#080D16] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPin(!showNewPin)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                              title={showNewPin ? 'Ocultar PIN' : 'Ver PIN'}
                            >
                              {showNewPin ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-300">
                              Confirmar Nuevo PIN:
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowConfirmPin(!showConfirmPin)}
                              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              {showConfirmPin ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                              <span>{showConfirmPin ? 'Ocultar' : 'Ver'}</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showConfirmPin ? 'text' : 'password'}
                              value={confirmPin}
                              onChange={(e) => {
                                setConfirmPin(e.target.value);
                                setConfigError(null);
                              }}
                              placeholder="Repite el nuevo PIN"
                              className="w-full bg-[#080D16] border border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPin(!showConfirmPin)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                              title={showConfirmPin ? 'Ocultar PIN' : 'Ver PIN'}
                            >
                              {showConfirmPin ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Número de WhatsApp para Solicitudes</span>
                      </h4>
                      <input
                        type="text"
                        value={adminWhatsApp}
                        onChange={(e) => setAdminWhatsApp(e.target.value)}
                        placeholder="Ej: 573213902708"
                        className="w-full bg-[#080D16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                        required
                      />
                      <span className="text-[11px] text-slate-500 block">
                        Canal oficial configurado para solicitudes de clientes
                      </span>
                    </div>

                    {configError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
                        {configError}
                      </div>
                    )}

                    {configSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{configSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
                    >
                      Guardar Cambios de PIN y WhatsApp
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: AUDIT & ALGORITHM ACCURACY */}
              {activeTab === 'AUDIT' && <AuditTabContent />}
            </div>
          </div>
      </div>
    </div>
  );
};

const AuditTabContent: React.FC = () => {
  const [summary, setSummary] = useState<OverallAccuracySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sportFilter, setSportFilter] = useState<'PRIME_SOCCER' | 'SECONDARY_SOCCER' | 'NBA' | 'ALL'>('PRIME_SOCCER');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    AccuracyEvaluatorService.getRealTimeAuditSummary()
      .then((res) => {
        if (isMounted) {
          setSummary(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [confirmResetCycle, setConfirmResetCycle] = useState<boolean>(false);

  const handleDownloadExcel = () => {
    if (!summary) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const sportName =
      sportFilter === 'PRIME_SOCCER'
        ? 'Futbol_Ligas_Principales'
        : sportFilter === 'SECONDARY_SOCCER'
        ? 'Futbol_Ligas_Secundarias'
        : sportFilter === 'NBA'
        ? 'NBA_Baloncesto'
        : 'Consolidado_Global';
    AccuracyEvaluatorService.exportToExcelFile(summary, `Auditoria_Mensual_${sportName}_${dateStr}.xlsx`);
  };

  const handleResetMonthlyCycle = () => {
    AccuracyEvaluatorService.resetMonthlyCycle();
    setConfirmResetCycle(false);
    setIsLoading(true);
    AccuracyEvaluatorService.getRealTimeAuditSummary()
      .then((res) => {
        setSummary(res);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  const handlePrintPDF = () => {
    window.print();
  };

  if (isLoading || !summary) {
    return (
      <div className="py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs font-mono font-bold text-slate-300">
          Procesando auditoría 100% real: Ligas Principales, Secundarias y Baloncesto NBA...
        </p>
        <span className="text-[10px] text-slate-500 block">
          Evaluando fuentes oficiales ($0 cuota API-Football · Cero plantillas precargadas)
        </span>
      </div>
    );
  }

  // Active Segment Stats
  const activeStats =
    sportFilter === 'PRIME_SOCCER'
      ? summary.primeSoccer
      : sportFilter === 'SECONDARY_SOCCER'
      ? summary.secondarySoccer
      : sportFilter === 'NBA'
      ? summary.nbaBasketball
      : summary.consolidated;

  // Filter Match Records by Selected Segment
  const allSampleMatches = summary.metricsByCategory.flatMap((c) => c.sampleMatches);
  const filteredMatches = allSampleMatches.filter((rec) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'PRIME_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'SECONDARY';
    if (sportFilter === 'NBA') return rec.sport === 'NBA';
    return true;
  });

  // Filter Top Leagues by Selected Segment
  const filteredTopLeagues = summary.topLeagues.filter((l) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return l.sport === 'NBA';
    if (sportFilter === 'PRIME_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'SECONDARY';
    return true;
  });

  // Filter Categories by Selected Sport
  const filteredCategories = summary.metricsByCategory.filter((cat) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return cat.sport === 'NBA';
    return cat.sport === 'SOCCER';
  });

  const getSegmentHeaderLabel = () => {
    if (sportFilter === 'PRIME_SOCCER') return '⚽ Fútbol · Ligas Principales (Tier 1 & 2)';
    if (sportFilter === 'SECONDARY_SOCCER') return '🌍 Fútbol · Ligas Secundarias / Menores';
    if (sportFilter === 'NBA') return '🏀 Baloncesto · NBA (Triples & Puntos Jugador)';
    return '🌐 Consolidado Global de la Plataforma';
  };

  const getSegmentThemeColor = () => {
    if (sportFilter === 'NBA') return 'amber';
    if (sportFilter === 'SECONDARY_SOCCER') return 'indigo';
    if (sportFilter === 'ALL') return 'cyan';
    return 'emerald';
  };

  const theme = getSegmentThemeColor();

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* 0. Multi-Segment Switcher Bar (Separación Profesional de Informes) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 gap-1 text-center font-mono text-xs">
        <button
          type="button"
          onClick={() => setSportFilter('PRIME_SOCCER')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            sportFilter === 'PRIME_SOCCER'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>⚽</span>
          <span>Principales</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('SECONDARY_SOCCER')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            sportFilter === 'SECONDARY_SOCCER'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🌍</span>
          <span>Secundarias</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('NBA')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            sportFilter === 'NBA'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🏀</span>
          <span>NBA</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('ALL')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            sportFilter === 'ALL'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🌐</span>
          <span>Global</span>
        </button>
      </div>

      {/* 1. Metric Header Card con Exportación a Excel (Sin botón de imprimir) */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
        theme === 'amber'
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/30'
          : theme === 'indigo'
          ? 'bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 border-indigo-500/30'
          : theme === 'cyan'
          ? 'bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-950 border-cyan-500/30'
          : 'bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border-emerald-500/30'
      }`}>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border flex items-center gap-1.5 ${
              theme === 'amber'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : theme === 'indigo'
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : theme === 'cyan'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>{getSegmentHeaderLabel()}</span>
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              📅 Modo Día Vencido (Acta Oficial Cerrada)
            </span>
          </div>

          <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono">
              Efectividad Verificada:{' '}
              <span className={
                theme === 'amber'
                  ? 'text-amber-400'
                  : theme === 'indigo'
                  ? 'text-indigo-400'
                  : theme === 'cyan'
                  ? 'text-cyan-400'
                  : 'text-emerald-400'
              }>
                {activeStats.accuracyPercentage}%
              </span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              ({activeStats.hits} aciertos / {activeStats.evaluatedMatches} verificados)
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            {sportFilter === 'SECONDARY_SOCCER'
              ? 'Se respeta el pronóstico original del algoritmo. Los partidos sin acta oficial se marcan como anulados sin distorsionar el porcentaje.'
              : sportFilter === 'NBA'
              ? 'Estadísticas oficiales boxscore segundo a segundo: Triples de jugadores, puntos individuales y totales ($0 costo de cuota).'
              : 'Resultados oficiales consolidados a día vencido con actas completas de córners, tarjetas y goles.'}
          </p>
        </div>

        {/* Action Buttons: Download XLSX & Reset Cycle (Sin botón de imprimir) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadExcel}
            className={`px-4 py-2.5 rounded-xl text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${
              theme === 'amber'
                ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/25'
                : theme === 'indigo'
                ? 'bg-indigo-400 hover:bg-indigo-300 shadow-indigo-400/25'
                : theme === 'cyan'
                ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-400/25'
                : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25'
            }`}
            title="Descargar libro Excel oficial (.xlsx) con 4 hojas separadas por categoría"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Libro Excel (.xlsx)</span>
          </button>

          {confirmResetCycle ? (
            <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/50 rounded-xl px-2.5 py-1.5 animate-fadeIn">
              <span className="text-[11px] text-rose-200 font-bold">¿Reiniciar mes?</span>
              <button
                type="button"
                onClick={handleResetMonthlyCycle}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer transition shadow-xs"
              >
                Sí, Limpiar
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetCycle(false)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetCycle(true)}
              className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              title="Reiniciar el historial para comenzar un nuevo mes desde cero"
            >
              <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-400" />
              <span className="hidden sm:inline">Nuevo Mes</span>
            </button>
          )}
        </div>
      </div>

      {/* 1.5 Segment Detail KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Muestras</span>
          <span className="text-base font-bold font-mono text-white">{activeStats.totalMatches}</span>
          <span className="text-[10px] text-slate-500 block">partidos en registro</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-xs">
          <span className="text-emerald-400 block text-[10px] uppercase font-bold">Aciertos Reales</span>
          <span className="text-base font-bold font-mono text-emerald-300">{activeStats.hits}</span>
          <span className="text-[10px] text-slate-400 block">pronósticos cumplidos</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-rose-500/20 text-xs">
          <span className="text-rose-400 block text-[10px] uppercase font-bold">Fallos</span>
          <span className="text-base font-bold font-mono text-rose-300">{activeStats.misses}</span>
          <span className="text-[10px] text-slate-400 block">no acertados</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/20 text-xs">
          <span className="text-amber-400 block text-[10px] uppercase font-bold">
            {sportFilter === 'SECONDARY_SOCCER' ? '⚠️ Sin Acta Oficial' : 'Tasa de Cobertura'}
          </span>
          <span className="text-base font-bold font-mono text-amber-300">
            {sportFilter === 'SECONDARY_SOCCER' ? `${activeStats.unverifiedCount} (Anulados)` : `${activeStats.coveragePercentage}%`}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {sportFilter === 'SECONDARY_SOCCER' ? 'no restan al promedio' : 'verificación oficial'}
          </span>
        </div>
      </div>

      {/* 2. Top 5 Ligas o Torneos con Mayor Efectividad (Ordenadas de Mayor a Menor) */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-tight flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Top 5 Ligas con Mayor Acierto (Ranking de Mayor a Menor)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">Ordenado por % Efectividad (+EV)</span>
        </div>

        <div className="space-y-2">
          {filteredTopLeagues.length === 0 ? (
            <p className="text-xs text-slate-400 p-3 text-center">No hay ligas con partidos verificados en este segmento.</p>
          ) : (
            filteredTopLeagues.map((league, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={league.leagueName}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {medal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{league.leagueName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({league.sport === 'NBA' ? '🏀 NBA' : league.leagueTier === 'SECONDARY' ? '🌍 Menor' : '⚽ Prime'})
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            league.sport === 'NBA'
                              ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-300'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(10, league.accuracyPercentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className={`font-bold block text-sm ${league.sport === 'NBA' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {league.accuracyPercentage}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">{league.hits}/{league.evaluatedMatches} aciertos</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Gráfica Comparativa de Mercados (Ordenados de Mayor a Menor) */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>Efectividad por Tipo de Pronóstico (De Mayor a Menor)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">Rendimiento Estadístico Real</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredCategories.map((m) => {
            const actualProb = m.accuracyPercentage;
            const isNba = m.sport === 'NBA';

            return (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{m.categoryLabel}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isNba
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {m.accuracyPercentage}% Acierto
                  </span>
                </div>

                <div className="space-y-1.5 text-[10px] font-mono">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-0.5">
                      <span>Efectividad Verificada:</span>
                      <span className={`font-bold ${isNba ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {actualProb}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isNba ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${actualProb}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Muestras: <strong className="text-white">{m.evaluatedMatches}</strong></span>
                  <span>Aciertos: <strong className={isNba ? 'text-amber-300' : 'text-emerald-400'}>{m.hits}</strong></span>
                  <span>Fallos: <strong className="text-rose-400">{m.misses}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Tabla Detallada de Partidos Evaluados (con Estado Transparente) */}
      <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Detalle Partido a Partido ({filteredMatches.length} registros)</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Actualizado: {summary.lastUpdated}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="py-2 px-2">Categoría</th>
                <th className="py-2 px-2">Partido</th>
                <th className="py-2 px-2">Mercado</th>
                <th className="py-2 px-2">Pronóstico Original</th>
                <th className="py-2 px-2">Resultado Real</th>
                <th className="py-2 px-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredMatches.map((rec, i) => (
                <tr key={`${rec.fixtureId}-${i}`} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-2 text-[10px] text-slate-400">
                    {rec.sport === 'NBA'
                      ? '🏀 NBA'
                      : rec.leagueTier === 'SECONDARY'
                      ? '🌍 L. Menor'
                      : '⚽ L. Prime'}
                  </td>
                  <td className="py-2 px-2 font-semibold text-white">
                    <div>{rec.matchTitle}</div>
                    <span className="text-[9px] text-slate-500 block">{rec.leagueName}</span>
                  </td>
                  <td className="py-2 px-2 text-slate-300">{rec.marketType}</td>
                  <td className="py-2 px-2 text-amber-300">{rec.predictionLabel}</td>
                  <td className="py-2 px-2 text-slate-200">{rec.actualResult}</td>
                  <td className="py-2 px-2 text-right">
                    {rec.status === 'UNVERIFIED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30">
                        ⚠️ SIN ACTA (ANULADO)
                      </span>
                    ) : rec.isHit ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        rec.sport === 'NBA'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        ✓ ACERTADO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-rose-500/20 text-rose-300 border-rose-500/30">
                        ✕ FALLADO
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

