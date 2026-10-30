import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, Key, X, Lock, Check, Copy, UserCheck, RefreshCw, Smartphone, MessageCircle, Power, Sparkles, Database, Users, Search, Unlock, Download, BarChart2, Printer, CheckCircle2, Trophy, Trash2, Eye, EyeOff, Ticket, Star } from 'lucide-react';
import { createLicenseToken, getOrCreateDeviceId, saveActiveLicense, verifyLicenseToken, clearActiveLicense } from '../services/licenseService';
import {
  AccuracyEvaluatorService,
  OverallAccuracySummary,
  CompactParlayAuditRecord,
  MonthlyParlayEffectivenessSummary
} from '../services/accuracyEvaluatorService';
import { MatchFixture, ParlayPick } from '../types';
import { generateGMetricsAdminParlays, GMetricsParlaySuggestion } from '../services/mathEngine';
import { getLocalUpcomingCache, getColombiaDateString } from '../services/apiService';
import { useParlay } from '../context/ParlayContext';

interface AdminLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseChanged?: () => void;
  onLogout?: () => void;
  fixtures?: MatchFixture[];
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

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({ isOpen, onClose, onLicenseChanged, onLogout, fixtures = [] }) => {
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

  const [activeTab, setActiveTab] = useState<'USERS' | 'PARLAYS_BETA' | 'MONITOR' | 'AUDIT' | 'FEEDBACK' | 'CONFIG'>('USERS');

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
  const [showSqlGuide, setShowSqlGuide] = useState(false);

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
    let loadedFromServer = false;

    // 1. Consultar primero al servidor (Supabase + base del servidor) como única fuente de verdad
    try {
      const res = await fetch('/api/admin/users/list', {
        headers: buildAdminHeaders(pin)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        loadedFromServer = true;
        for (const u of data.users) {
          if (u && u.username) {
            const uname = String(u.username).toLowerCase().trim();
            if (!uname || deletedSet.has(uname) || u.status === 'deleted' || u.planType === 'DELETED' || u.notes === '[DELETED]') continue;
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
      // ignore network error, fallback to local cache below
    }

    // 2. Solo usar caché local del navegador como respaldo offline si el servidor no respondió
    if (!loadedFromServer) {
      try {
        const rawLocal = localStorage.getItem('sportstats_local_users_cache');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              if (u && u.username) {
                const uname = String(u.username).toLowerCase().trim();
                if (!uname || deletedSet.has(uname) || u.status === 'deleted' || u.planType === 'DELETED' || u.notes === '[DELETED]') continue;
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
    }

    const finalUsers = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setAppUsersList(finalUsers);
    try {
      localStorage.setItem('sportstats_local_users_cache', JSON.stringify(finalUsers));
    } catch {
      // ignore
    }
    setIsLoadingUsers(false);
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
    const msg = `🔐 *Respaldo Privado de Administrador · G METRICS*\n\n📌 *Tu PIN Actual Activo:* ${pinToSend}\n\n_Guarda este mensaje en tu chat personal para tener siempre tu llave de acceso a la mano._`;
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
    link.download = `Listado_Usuarios_G_METRICS_${dateStr}.csv`;
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

  // STATE 1: Discrete Security Verification Box (Fintech Light White)
  if (!isAdminAuthenticated) {
    return (
      <div
        onClick={handleCloseModal}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center text-slate-800"
        >
          <button
            onClick={handleCloseModal}
            type="button"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>

          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1">
            {showRecoveryMode ? 'Recuperación de Acceso' : 'Verificación de Seguridad'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            {showRecoveryMode
              ? 'Solicita tu código de recuperación por WhatsApp o ingresa tu clave.'
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-11 py-2.5 text-center text-lg font-mono tabular-nums tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPinInput(!showPinInput)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPinInput ? 'Ocultar PIN' : 'Ver PIN'}
                >
                  {showPinInput ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {pinError && (
                <div className="space-y-2">
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 py-2 px-3 rounded-lg font-medium">
                    {pinError}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryMode(true);
                      setRecoveryError(null);
                      setRecoverySuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 transition cursor-pointer"
                  >
                    ¿Olvidaste tu código? Recuperar acceso
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs active:scale-95 cursor-pointer"
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
                  const msg = `⚠️ *Solicitud de Autorización / Recuperación · G METRICS*\n\nHola Administrador, se solicita verificación de seguridad para el dispositivo:\n📱 *Dispositivo:* ${devId}\n\nSi reconoces este intento, envía la clave de acceso correspondiente.`;
                  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Solicitar código por WhatsApp</span>
              </button>

              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Código de autorización recibido:
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-center text-xs font-mono tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Nuevo PIN (Opcional):
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRecoveryNewPin(!showRecoveryNewPin)}
                      className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      {showRecoveryNewPin ? <EyeOff className="w-3 h-3 text-emerald-600" /> : <Eye className="w-3 h-3" />}
                      <span>{showRecoveryNewPin ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showRecoveryNewPin ? 'text' : 'password'}
                      value={recoveryNewPin}
                      onChange={(e) => setRecoveryNewPin(e.target.value)}
                      placeholder="Mínimo 4 dígitos"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3.5 pr-10 py-2 text-center text-xs font-mono tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryNewPin(!showRecoveryNewPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showRecoveryNewPin ? 'Ocultar PIN' : 'Ver PIN'}
                    >
                      {showRecoveryNewPin ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {recoveryError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 py-2 px-3 rounded-lg text-center font-medium">
                  {recoveryError}
                </div>
              )}

              {recoverySuccessMsg && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 py-2 px-3 rounded-lg text-center font-semibold">
                  {recoverySuccessMsg}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleEmergencyRecovery}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Verificar y Desbloquear</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryMode(false);
                    setRecoveryKeyInput('');
                    setRecoveryError(null);
                  }}
                  className="w-full py-2 px-4 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer text-center"
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

  // STATE 2: Full Authenticated Admin Panel (Fintech Light White)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-slate-800">
        {/* Top Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
                <span>Panel de Administración · G METRICS</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                Gestión de cuentas, monitor de cuota API, auditoría +EV y seguridad.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            title="Cerrar panel"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Authenticated Panel Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Pinned Responsive Tabs Bar */}
          <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-100/70 px-2 sm:px-4 pt-1.5 pb-0 flex items-center gap-1 sm:gap-2 text-xs font-semibold overflow-x-auto scrollbar-none shrink-0">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'USERS'
                  ? 'border-indigo-600 text-indigo-800 bg-white font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Usuarios ({appUsersList.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('MONITOR');
                loadServerTelemetry();
              }}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'MONITOR'
                  ? 'border-amber-600 text-amber-900 bg-white font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Monitor & API</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                🟢 {serverTelemetry?.onlineNowCount ?? 1}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'AUDIT'
                  ? 'border-emerald-600 text-emerald-800 bg-white font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Eficiencia (+EV)</span>
            </button>
            <button
              onClick={() => setActiveTab('PARLAYS_BETA')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'PARLAYS_BETA'
                  ? 'border-amber-500 text-amber-900 bg-amber-50/80 font-extrabold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ticket className="w-3.5 h-3.5 text-amber-600" />
              <span>Parlays IA (Beta)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-black uppercase">
                BETA
              </span>
            </button>
            <button
              onClick={() => setActiveTab('FEEDBACK')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'FEEDBACK'
                  ? 'border-amber-500 text-amber-900 bg-white font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>Feedback</span>
            </button>
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs ${
                activeTab === 'CONFIG'
                  ? 'border-cyan-600 text-cyan-800 bg-white font-bold shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-cyan-600" />
              <span>Seguridad & PIN</span>
            </button>

            <button
              onClick={handleLogoutAdmin}
              className="ml-auto my-auto px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Bloquear panel y cerrar sesión"
            >
              <Power className="w-3.5 h-3.5 text-rose-600" />
              <span>Salir</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable independently) */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-white">
            {/* TAB 0: SUPABASE USERS */}
            {activeTab === 'USERS' && (
              <div className="space-y-3.5">
                {/* Feedback Toast */}
                {actionFeedback && (
                  <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{actionFeedback}</span>
                    </div>
                    <button
                      onClick={() => setActionFeedback(null)}
                      className="text-slate-400 hover:text-slate-700 text-xs px-2 py-0.5 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Quick Create / Activate User Form */}
                <form
                  onSubmit={handleCreateOrUpdateQuickUser}
                  className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/90 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Crear o Activar Usuario Rápido</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Si no indicas PIN, conserva el actual o asigna 1234
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      value={newQuickUsername}
                      onChange={(e) => setNewQuickUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20))}
                      placeholder="Usuario (ej. carlos99)"
                      required
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={newQuickPin}
                      onChange={(e) => setNewQuickPin(e.target.value)}
                      placeholder="PIN (opcional)"
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={newQuickName}
                      onChange={(e) => setNewQuickName(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={newQuickDays}
                      onChange={(e) => setNewQuickDays(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value={1}>⚡ Muestra 24h</option>
                      <option value={3}>⚡ 3 Días</option>
                      <option value={7}>📅 7 Días</option>
                      <option value={15}>📅 15 Días</option>
                      <option value={30}>🗓️ 30 Días</option>
                      <option value={60}>🗓️ 60 Días</option>
                      <option value={90}>🗓️ 90 Días</option>
                      <option value={365}>🏆 365 Días</option>
                      <option value={0}>♾️ Vitalicio</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>+ Activar</span>
                    </button>
                  </div>
                </form>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/90">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-semibold">
                    {[
                      { id: 'ALL', label: `Todos (${appUsersList.length})` },
                      { id: 'ONLINE', label: `🟢 Online (${serverTelemetry?.onlineNowCount ?? 0})` },
                      { id: 'ACTIVE', label: '✅ Activos' },
                      { id: 'BOUND', label: '📱 Vinculados' },
                      { id: 'PENDING', label: '⏳ Pendientes' },
                      { id: 'SUSPENDED', label: '🚫 Suspendidos' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setUserFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                          userFilter === f.id
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar @usuario o nombre..."
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadUsersExcel}
                      disabled={appUsersList.length === 0}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 shrink-0 transition cursor-pointer disabled:opacity-50"
                      title="Descargar usuarios en Excel (.csv)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const p = pinInput.trim() || activeServerPin || localStorage.getItem('sportstats_admin_saved_pin') || '';
                        loadAppUsers(p);
                      }}
                      className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shrink-0 transition cursor-pointer"
                      title="Actualizar lista"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Users Cards List */}
                {isLoadingUsers && appUsersList.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Cargando usuarios...</span>
                  </div>
                ) : appUsersList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-1.5">
                    <Users className="w-7 h-7 text-slate-400 mx-auto" />
                    <p className="font-bold text-slate-800">No hay usuarios registrados aún</p>
                    <p className="text-[11px] text-slate-500">
                      Crea una cuenta arriba o espera solicitudes desde la pantalla de ingreso.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
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
                            className={`p-3.5 rounded-2xl border space-y-2.5 text-xs transition ${
                              isSuspended
                                ? 'bg-rose-50/40 border-rose-200'
                                : isExpired
                                ? 'bg-amber-50/40 border-amber-200'
                                : isUserOnline
                                ? 'bg-emerald-50/30 border-emerald-300'
                                : 'bg-slate-50/70 border-slate-200/90'
                            }`}
                          >
                            {/* Header Row: Username, Role, Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs sm:text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                  @{u.username}
                                </span>
                                {u.displayName && (
                                  <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                                    {u.displayName}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-slate-200 text-slate-600">
                                  {u.role === 'admin' ? '🛡️ Admin' : '👤 Cliente'}
                                </span>
                                {isUserOnline && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <span>🟢 EN LÍNEA</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    isSuspended
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : isExpired
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : u.status === 'pending'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Plan & Expiry */}
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                                    Plan
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {u.status === 'pending' ? 'Pendiente' : u.planLabel}
                                  </span>
                                </div>
                                <div className="flex flex-col mt-1.5 pt-1.5 border-t border-slate-100 gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-semibold text-slate-500">
                                      Vigencia
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`font-mono font-bold text-xs ${
                                          u.status === 'pending'
                                            ? 'text-amber-700'
                                            : isSuspended || isExpired
                                            ? 'text-rose-700'
                                            : daysLeft !== null && daysLeft !== undefined && daysLeft <= 3
                                            ? 'text-amber-700'
                                            : 'text-emerald-700'
                                        }`}
                                      >
                                        {u.status === 'pending'
                                          ? '0 días (Por aprobar)'
                                          : daysLeft === null || daysLeft === undefined
                                          ? 'Vitalicio'
                                          : `${daysLeft} días`}
                                      </span>
                                      {editingDaysUserId !== u.id && u.status !== 'pending' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingDaysUserId(u.id);
                                            setCustomDaysInputValue(String(daysLeft ?? 15));
                                          }}
                                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-semibold cursor-pointer transition"
                                        >
                                          ✏️ Editar
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {editingDaysUserId === u.id && (
                                    <div className="mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-1 flex-wrap animate-fadeIn">
                                      <span className="text-[10px] text-slate-700 font-semibold">Días:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="3650"
                                        value={customDaysInputValue}
                                        onChange={(e) => setCustomDaysInputValue(e.target.value)}
                                        className="w-16 bg-white border border-slate-300 rounded-md px-2 py-0.5 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:border-emerald-600"
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
                                          className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold cursor-pointer"
                                        >
                                          Fijar
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
                                          className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold cursor-pointer"
                                        >
                                          + Sumar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingDaysUserId(null)}
                                          className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Bound Device Info */}
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
                                    <Smartphone className="w-3 h-3 text-cyan-600" />
                                    <span>Dispositivo (1/1)</span>
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                                      isBound
                                        ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {isBound ? 'Vinculado' : 'Libre'}
                                  </span>
                                </div>

                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                  {isBound ? (
                                    <>
                                      <p className="text-[11px] font-mono text-slate-700 truncate font-medium" title={u.boundDeviceId || ''}>
                                        {u.boundDeviceName || u.boundDeviceId}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => handleResetUserDevice(u.id, u.username)}
                                        className="shrink-0 px-2 py-0.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
                                        title="Permitir inicio de sesión en otro equipo"
                                      >
                                        <Unlock className="w-3 h-3" />
                                        <span>Liberar</span>
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Se vinculará al primer ingreso
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                                  <select
                                    value={userRenewDays[u.id] ?? 30}
                                    onChange={(e) => setUserRenewDays((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                                    className="bg-transparent text-slate-800 text-[11px] font-semibold px-1.5 py-1 focus:outline-none cursor-pointer"
                                  >
                                    <option value={1}>⚡ 1 Día</option>
                                    <option value={3}>⚡ 3 Días</option>
                                    <option value={7}>📅 7 Días</option>
                                    <option value={15}>📅 15 Días</option>
                                    <option value={30}>🗓️ 30 Días</option>
                                    <option value={60}>🗓️ 60 Días</option>
                                    <option value={90}>🗓️ 90 Días</option>
                                    <option value={365}>🏆 365 Días</option>
                                    <option value={0}>♾️ Vitalicio</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'SET')}
                                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>{u.status === 'pending' ? 'Aprobar' : 'Fijar'}</span>
                                  </button>
                                  {u.status !== 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'ADD')}
                                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                                    >
                                      + Sumar
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRenewUser(u.id, u.username, 1, 'SET')}
                                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  ⚡ 1d
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRenewUser(u.id, u.username, 15, 'SET')}
                                  className="px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  15d
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRenewUser(u.id, u.username, 30, 'SET')}
                                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  30d
                                </button>

                                {u.status !== 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserStatus(u.id, u.status, u.username)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                                      isSuspended
                                        ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                                    }`}
                                  >
                                    {isSuspended ? 'Reactivar' : 'Suspender'}
                                  </button>
                                )}

                                {confirmDeleteUserKey === (u.username || u.id) ? (
                                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-lg px-2 py-0.5 animate-fadeIn">
                                    <span className="text-[10px] font-bold text-rose-800 mr-1">
                                      ¿Eliminar @{u.username}?
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u.id, u.username)}
                                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition cursor-pointer"
                                    >
                                      Sí
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserKey(null)}
                                      className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserKey(u.username || u.id)}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                    title={`Eliminar @${u.username}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Eliminar</span>
                                  </button>
                                )}
                              </div>

                              {u.whatsappNumber && (
                                <a
                                  href={`https://wa.me/${u.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Hola ${u.displayName || u.username}, tu cuenta de G METRICS (@${u.username}) está activa.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1 transition"
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-600" />
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
                    : 'Ninguno en ventana de 3 min';
                const recentApiCallsFormatted =
                  apiLogList.length > 0
                    ? apiLogList
                        .slice(0, 8)
                        .map(
                          (c) =>
                            `  - [${new Date(c.at).toLocaleTimeString('es-CO')}] ${c.endpoint} | Fecha: ${c.targetDate} | Partidos: ${c.fixturesCount} | Libres: ${c.remainingAfter ?? '?'}`
                        )
                        .join('\n')
                    : '  - 0 llamadas a API-Football en sesión (100% Caché/ESPN)';

                return [
                  `📊 DIAGNÓSTICO SPORTSTATS PRO (${nowStr})`,
                  `🛡️ Blindaje Backend: ${serverTelemetry?.bundleVersion || 'v2.6-shield-6h'} (TTL: ${serverTelemetry?.scheduleTTLHours || 6}h)`,
                  `🟢 Online Ahora: ${onlineNow} (${onlineUsersFormatted}) | Pico: ${peakUsers} (${peakTimeStr})`,
                  `📡 Cuota API-Football: ${remainingQuota !== null ? `${remainingQuota}/100 libres` : `${callsSinceBoot} llamadas en sesión`}`,
                  `⚡ Eficiencia Caché: ${cacheHitRate}% (${cacheHits} hits / ${cacheMisses} misses) | Pulsos ESPN: ${espnPulses}`,
                  `📋 Últimas llamadas API:\n${recentApiCallsFormatted}`
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
                <div className="space-y-3.5">
                  {/* Header Banner + Refresh */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Monitor de Tráfico y Cuota API en Tiempo Real</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Sesiones activas, ahorro de caché y registro de consumo API-Football.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadServerTelemetry}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
                      <span>Refrescar</span>
                    </button>
                  </div>

                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        🟢 Online Ahora
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">{onlineNow}</span>
                        <span className="text-[10px] text-slate-500">activos</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5">Ventana 3 min</span>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-600" />
                        <span>Récord Online</span>
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">{peakUsers}</span>
                        <span className="text-[10px] text-slate-500">pico</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 truncate">{peakTimeStr}</span>
                    </div>

                    <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
                        <Database className="w-3 h-3 text-cyan-600" />
                        <span>Cuota API Hoy</span>
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {remainingQuota !== null ? `${consumedEst}/100` : callsSinceBoot}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {remainingQuota !== null ? `(${remainingQuota} libres)` : 'sesión'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 mt-0.5 font-semibold">Blindaje 6h activo</span>
                    </div>

                    <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Ahorro Caché</span>
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">{cacheHitRate}%</span>
                        <span className="text-[10px] text-slate-500">({cacheHits} hits)</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5">ESPN Gratis: {espnPulses}</span>
                    </div>
                  </div>

                  {/* Informe Corto para Copiar */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Copy className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Resumen de Diagnóstico Rápido</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Copia este estado resumido con un clic si necesitas soporte técnico.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
                          copiedDiagnosticReport
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {copiedDiagnosticReport ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Diagnóstico</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="bg-white border border-slate-200 rounded-xl p-2.5 text-[10.5px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                      {buildDiagnosticReportText()}
                    </pre>
                  </div>

                  {/* Two Columns: Connected Users Now & Recent API-Football Audit Log */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h4 className="text-xs font-bold text-slate-800">
                          🟢 Conectados Ahora ({onlineList.length})
                        </h4>
                        <span className="text-[10px] text-slate-400">Pulso 45s</span>
                      </div>
                      {onlineList.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Sincronizando sesiones...
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {onlineList.map((ou, idx) => (
                            <div
                              key={`${ou.deviceId || idx}`}
                              className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-indigo-800 truncate block">
                                  @{ou.username || 'usuario'}
                                </span>
                                <p className="text-[10px] text-slate-500 truncate">
                                  📱 {ou.deviceName || ou.deviceId}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                                {ou.secondsAgo ?? 0}s
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h4 className="text-xs font-bold text-slate-800">
                          📡 Llamadas API-Football ({apiLogList.length})
                        </h4>
                        <span className="text-[10px] text-slate-400">Tiempo real</span>
                      </div>
                      {apiLogList.length === 0 ? (
                        <div className="py-4 text-center space-y-1">
                          <p className="text-xs font-bold text-emerald-700">
                            ✅ 0 llamadas nuevas en esta sesión
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Sirviendo 100% desde caché de 6h y pulso gratuito ESPN.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {apiLogList.map((entry, idx) => (
                            <div
                              key={`${entry.at}-${idx}`}
                              className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-cyan-800">
                                  {entry.targetDate} ({entry.fixturesCount} juegos)
                                </span>
                                <p className="text-[10px] text-slate-500 font-mono truncate">
                                  {new Date(entry.at).toLocaleTimeString('es-CO')} · {entry.endpoint}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
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
              <div className="space-y-4">
                {/* Credenciales Actuales */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>Credenciales Actuales de Administrador</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                      PIN Activo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          PIN Actual
                        </span>
                        <span className="font-mono text-base font-bold text-slate-900 tracking-widest">
                          {activeServerPin || pinInput || '••••'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeServerPin);
                          setCopiedCurrentPin(true);
                          setTimeout(() => setCopiedCurrentPin(false), 2000);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedCurrentPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCurrentPin ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Respaldo Personal
                        </span>
                        <span className="text-xs text-slate-600">
                          Enviar copia privada a tu WhatsApp
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendCredentialsToWhatsApp(activeServerPin)}
                        className="shrink-0 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Enviar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cambiar PIN y WhatsApp */}
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Actualizar PIN y WhatsApp de Contacto</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Nuevo PIN:
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowNewPin(!showNewPin)}
                            className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                          >
                            {showNewPin ? <EyeOff className="w-3 h-3 text-amber-600" /> : <Eye className="w-3 h-3" />}
                            <span>{showNewPin ? 'Ocultar' : 'Ver'}</span>
                          </button>
                        </div>
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          value={newPin}
                          onChange={(e) => {
                            setNewPin(e.target.value);
                            setConfigError(null);
                          }}
                          placeholder="Mínimo 4 dígitos"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Confirmar PIN:
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                            className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                          >
                            {showConfirmPin ? <EyeOff className="w-3 h-3 text-amber-600" /> : <Eye className="w-3 h-3" />}
                            <span>{showConfirmPin ? 'Ocultar' : 'Ver'}</span>
                          </button>
                        </div>
                        <input
                          type={showConfirmPin ? 'text' : 'password'}
                          value={confirmPin}
                          onChange={(e) => {
                            setConfirmPin(e.target.value);
                            setConfigError(null);
                          }}
                          placeholder="Repite el nuevo PIN"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          WhatsApp Admin:
                        </label>
                        <input
                          type="text"
                          value={adminWhatsApp}
                          onChange={(e) => setAdminWhatsApp(e.target.value)}
                          placeholder="Ej: 573213902708"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                          required
                        />
                      </div>
                    </div>

                    {configError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                        {configError}
                      </div>
                    )}

                    {configSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>{configSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs active:scale-95 cursor-pointer"
                    >
                      Guardar Configuración
                    </button>
                  </div>
                </form>

                {/* Base de Datos Supabase (Plegable para evitar ruido visual) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Conexión Base de Datos (Supabase)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          supabaseConfigured
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        {supabaseConfigured ? `Conectado · ${supabaseProject || 'Cloud'}` : 'Modo Local'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSqlGuide((prev) => !prev)}
                      className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      {showSqlGuide ? 'Ocultar guía técnica ▲' : 'Ver guía SQL de instalación ▼'}
                    </button>
                  </div>

                  {showSqlGuide && (
                    <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px] text-slate-600">
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                        <span>Script SQL de creación de tablas:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (supabaseSqlSchema) {
                              navigator.clipboard.writeText(supabaseSqlSchema);
                              setCopiedSql(true);
                              setTimeout(() => setCopiedSql(false), 2500);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                        SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en variables de entorno.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: AUDIT & ALGORITHM ACCURACY */}
            {activeTab === 'AUDIT' && <AuditTabContent />}

            {/* TAB 3: PARLAYS SUGERIDOS G METRICS (SOLO BETA ADMIN) */}
            {activeTab === 'PARLAYS_BETA' && (
              <AdminParlaysBetaTab fixtures={fixtures} onCloseAdmin={handleCloseModal} />
            )}

            {/* TAB 4: BUZÓN PRIVADO DE FEEDBACK Y CALIFICACIONES (SOLO ADMIN) */}
            {activeTab === 'FEEDBACK' && <AdminFeedbackTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

const LOCAL_MONTHLY_PARLAYS_CACHE_KEY = 'sportstats_monthly_parlays_ledger_v2';

const AdminParlaysBetaTab: React.FC<{
  fixtures: MatchFixture[];
  onCloseAdmin: () => void;
}> = ({ fixtures, onCloseAdmin }) => {
  const { loadSuggestedParlay, setIsOpen } = useParlay();
  const [copiedComboId, setCopiedComboId] = useState<string | null>(null);
  const [legsFilter, setLegsFilter] = useState<'ALL' | 2 | 3>('ALL');
  const [monthlyRecords, setMonthlyRecords] = useState<CompactParlayAuditRecord[]>([]);
  const [monthKey, setMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(true);
  const [showHistoryTable, setShowHistoryTable] = useState<boolean>(false);
  const [confirmResetMonth, setConfirmResetMonth] = useState<boolean>(false);

  const getAdminAuthHeaders = useCallback((withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    const pin =
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      '';
    if (pin.trim()) headers['x-admin-pin'] = pin.trim();
    const jwt = sessionStorage.getItem('sportstats_session_jwt');
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    return headers;
  }, []);

  const syncMonthlyParlayEffectiveness = useCallback(async () => {
    setIsLoadingLedger(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    setMonthKey(currentMonth);

    const mergedMap = new Map<string, CompactParlayAuditRecord>();

    // 1. Limpiar cualquier rastro de versión previa y cargar respaldo local limpio del mes
    try {
      localStorage.removeItem('sportstats_monthly_parlays_ledger_v1');
      const rawLocal = localStorage.getItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && parsed.monthKey === currentMonth && Array.isArray(parsed.records)) {
          parsed.records.forEach((r: CompactParlayAuditRecord) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
        } else {
          localStorage.removeItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
        }
      }
    } catch {
      // ignore
    }

    // 2. Consultar ledger mensual en Base de Datos (Supabase / backend)
    try {
      const res = await fetch('/api/admin/parlays-beta', {
        headers: getAdminAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.ledger && Array.isArray(data.ledger.records)) {
          if (data.ledger.monthKey) setMonthKey(data.ledger.monthKey);
          data.ledger.records.forEach((r: CompactParlayAuditRecord) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
        }
      }
    } catch {
      // ignore offline
    }

    // 3. Evaluar nuevos parlays sobre partidos finalizados del mes ($0 cuota API)
    try {
      const newlyEvaluated = await AccuracyEvaluatorService.evaluateCompletedParlaysForMonth(fixtures);
      let hasNewRecords = false;
      for (const rec of newlyEvaluated) {
        if (!mergedMap.has(rec.id)) {
          hasNewRecords = true;
        }
        mergedMap.set(rec.id, rec);
      }

      const finalRecords = Array.from(mergedMap.values()).sort((a, b) => b.d.localeCompare(a.d));
      setMonthlyRecords(finalRecords);

      try {
        localStorage.setItem(
          LOCAL_MONTHLY_PARLAYS_CACHE_KEY,
          JSON.stringify({ monthKey: currentMonth, records: finalRecords })
        );
      } catch {
        // ignore
      }

      // 4. Sincronizar registros nuevos hacia la Base de Datos de forma ultra-compacta
      if (hasNewRecords && newlyEvaluated.length > 0) {
        const pin =
          sessionStorage.getItem('futbolstats_admin_pin') ||
          localStorage.getItem('sportstats_admin_saved_pin') ||
          '';
        await fetch('/api/admin/parlays-beta', {
          method: 'POST',
          headers: getAdminAuthHeaders(true),
          body: JSON.stringify({ pin, records: newlyEvaluated })
        }).catch(() => {});
      }
    } catch {
      setMonthlyRecords(Array.from(mergedMap.values()).sort((a, b) => b.d.localeCompare(a.d)));
    } finally {
      setIsLoadingLedger(false);
    }
  }, [fixtures, getAdminAuthHeaders]);

  useEffect(() => {
    syncMonthlyParlayEffectiveness();
  }, [syncMonthlyParlayEffectiveness]);

  const handleResetMonthlyParlays = async () => {
    setConfirmResetMonth(false);
    try {
      localStorage.removeItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
    } catch {
      // ignore
    }
    setMonthlyRecords([]);

    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      await fetch('/api/admin/parlays-beta', {
        method: 'POST',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, resetMonth: true })
      });
    } catch {
      // ignore
    }
  };

  const monthlyStats = useMemo<MonthlyParlayEffectivenessSummary>(() => {
    return AccuracyEvaluatorService.computeMonthlyParlaySummary(monthlyRecords, monthKey);
  }, [monthlyRecords, monthKey]);

  const effectiveFixtures = useMemo(() => {
    if (fixtures && fixtures.length > 0) return fixtures;
    const cached = getLocalUpcomingCache(getColombiaDateString(0));
    return cached?.fixtures || [];
  }, [fixtures]);

  const suggestedParlays = useMemo<GMetricsParlaySuggestion[]>(() => {
    return generateGMetricsAdminParlays(effectiveFixtures);
  }, [effectiveFixtures]);

  const filteredSuggestions = useMemo(() => {
    if (legsFilter === 'ALL') return suggestedParlays;
    return suggestedParlays.filter((c) => c.legsCount === legsFilter);
  }, [suggestedParlays, legsFilter]);

  const handleLoadToSlip = (combo: GMetricsParlaySuggestion) => {
    const mappedPicks: ParlayPick[] = combo.legs.map((leg) => ({
      id: `${leg.fixtureId}_${leg.marketKey}`,
      fixtureId: leg.fixtureId,
      sport: 'SOCCER',
      matchTitle: leg.matchTitle,
      homeTeamName: leg.homeTeamName,
      awayTeamName: leg.awayTeamName,
      matchDate: leg.matchDate,
      matchTime: leg.matchTime,
      marketKey: leg.marketKey,
      selectionLabel: leg.selectionLabel,
      referenceOdd: leg.estimatedBookieOdd,
      userOdd: leg.estimatedBookieOdd,
      probability: leg.probability,
      isEV: true
    }));

    loadSuggestedParlay(
      mappedPicks,
      `🎫 Parlay "${combo.title}" (${combo.legs.length} selecciones) cargado al boleto (${combo.combinedEstimatedOdd.toFixed(2)}x).`
    );
    onCloseAdmin();
    setTimeout(() => setIsOpen(true), 150);
  };

  const handleCopyCombo = async (combo: GMetricsParlaySuggestion) => {
    let text = `🎫 *PARLAY G METRICS · BETA ADMIN*\n`;
    text += `📌 *${combo.title}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    combo.legs.forEach((leg, i) => {
      text += `${i + 1}. ⚽ *${leg.matchTitle}* (${leg.leagueName})\n`;
      text += `   ▪️ Pick: *${leg.selectionLabel}* (${leg.probability}%) | Fair Mín: *@${leg.fairMinOdd.toFixed(2)}x*\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *Cuota Est.:* @${combo.combinedEstimatedOdd.toFixed(2)}x | *Fair Mín.:* @${combo.combinedFairMinOdd.toFixed(2)}x+\n`;
    text += `🎯 *Prob. Conjunta:* ${combo.jointProbability}% (${combo.stressTest.simulatedWinsPer100}/100 sim.)\n`;
    text += `💰 *Inversión Sugerida (Stake):* ${combo.recommendedKellyStakePct}% de banca`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedComboId(combo.id);
      setTimeout(() => setCopiedComboId(null), 2500);
    } catch {
      // ignore
    }
  };

  const count3Legs = suggestedParlays.filter((c) => c.legsCount === 3).length;
  const count2Legs = suggestedParlays.filter((c) => c.legsCount === 2).length;

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Resumen Mensual de Efectividad de Parlays (Persistente en BD con Auto-Reset Mensual) */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                📊 Control Mensual BD ({monthlyStats.monthKey})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
                ⚡ Auto-limpieza mensual (&lt;15 KB en BD)
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                Efectividad Mensual Parlays:{' '}
                <span className="text-emerald-700">{monthlyStats.accuracyPercentage}%</span>
              </h3>
              <span className="text-xs font-medium text-slate-500">
                ({monthlyStats.hits} aciertos de {monthlyStats.totalEvaluated} boletos cerrados)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {monthlyStats.totalEvaluated > 0 && (
              <button
                type="button"
                onClick={() => setShowHistoryTable(!showHistoryTable)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                {showHistoryTable ? 'Ocultar Historial' : `Historial (${monthlyStats.totalEvaluated})`}
              </button>
            )}

            {confirmResetMonth ? (
              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
                <span className="text-[11px] text-rose-800 font-bold">¿Reiniciar mes?</span>
                <button
                  type="button"
                  onClick={handleResetMonthlyParlays}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetMonth(false)}
                  className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetMonth(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                title="Reiniciar efectividad mensual de parlays"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Nuevo Mes</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Indicadores Rápidos Compactos (Mismo diseño limpio que Eficiencia +EV) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Boletos Mes</span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {isLoadingLedger ? '...' : `${monthlyStats.hits}/${monthlyStats.totalEvaluated}`}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
            <span className="text-emerald-800 block text-[10px] uppercase font-semibold">Efect. Dúos (2P)</span>
            <span className="text-sm font-bold font-mono text-emerald-700">
              {monthlyStats.duoAccuracyPct}% ({monthlyStats.duoHits}/{monthlyStats.duoEvaluated})
            </span>
          </div>

          <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs">
            <span className="text-indigo-800 block text-[10px] uppercase font-semibold">Efect. Tríos (3P)</span>
            <span className="text-sm font-bold font-mono text-indigo-700">
              {monthlyStats.trioAccuracyPct}% ({monthlyStats.trioHits}/{monthlyStats.trioEvaluated})
            </span>
          </div>

          <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
            <span className="text-amber-800 block text-[10px] uppercase font-semibold">Cuota Prom.</span>
            <span className="text-sm font-bold font-mono text-amber-800">
              {monthlyStats.avgHitOdd > 0 ? `@${monthlyStats.avgHitOdd.toFixed(2)}x` : '@1.85x'}
            </span>
          </div>
        </div>

        {/* Tabla Plegable de Parlays Evaluados en el Mes */}
        {showHistoryTable && monthlyStats.records.length > 0 && (
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 max-h-52 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] uppercase">
                  <th className="py-1.5 px-2.5">Fecha</th>
                  <th className="py-1.5 px-2">Boleto</th>
                  <th className="py-1.5 px-2">Selecciones</th>
                  <th className="py-1.5 px-2">Cuota</th>
                  <th className="py-1.5 px-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {monthlyStats.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2.5 text-[11px] text-slate-500">{rec.d}</td>
                    <td className="py-1.5 px-2 font-sans font-semibold text-slate-900 text-[11px]">
                      {rec.t} ({rec.l}P)
                    </td>
                    <td className="py-1.5 px-2 font-sans text-[10px] text-slate-600">
                      {rec.legs.map((l, idx) => (
                        <span key={idx} className="block truncate max-w-xs">
                          {l.h ? '✓' : '✕'} {l.m}: <strong>{l.p}</strong>
                        </span>
                      ))}
                    </td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">@{Number(rec.o).toFixed(2)}x</td>
                    <td className="py-1.5 px-2.5 text-right">
                      {rec.s === 'HIT' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ ACIERTO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          ✕ FALLO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Filtro Compacto de Boletos Sugeridos (2 y 3 Selecciones · Cuotas > 1.50x) */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setLegsFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              legsFilter === 'ALL'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({suggestedParlays.length})
          </button>
          <button
            type="button"
            onClick={() => setLegsFilter(3)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              legsFilter === 3
                ? 'bg-white text-indigo-800 border border-indigo-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 3 Selecciones ({count3Legs})
          </button>
          <button
            type="button"
            onClick={() => setLegsFilter(2)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              legsFilter === 2
                ? 'bg-white text-emerald-800 border border-emerald-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔥 2 Selecciones ({count2Legs})
          </button>
        </div>

        <span className="text-[10px] font-mono text-slate-500 px-2">
          Consenso 3 Sub-Modelos · Cuotas &gt; 1.50x
        </span>
      </div>

      {/* 3. Tarjetas Compactas de Parlays Sugeridos */}
      {filteredSuggestions.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
          <Ticket className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">
            Sin partidos activos suficientes para armar parlays en esta fecha.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredSuggestions.map((combo) => (
            <div
              key={combo.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
            >
              {/* Cabecera Ultra-Compacta */}
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border shrink-0 ${
                      combo.legsCount === 3
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {combo.legsCount} Selecciones
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {combo.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    Est: @{combo.combinedEstimatedOdd.toFixed(2)}x
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                    Fair Mín: @{combo.combinedFairMinOdd.toFixed(2)}x+
                  </span>
                </div>
              </div>

              {/* Lista Compacta de Selecciones (Sin párrafos largos) */}
              <div className="px-3.5 py-2 divide-y divide-slate-100">
                {combo.legs.map((leg, idx) => (
                  <div
                    key={leg.fixtureId}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 truncate">{leg.matchTitle}</span>
                      <span className="text-[10px] text-slate-400">({leg.matchTime})</span>
                      <span className="font-extrabold text-emerald-700">{leg.selectionLabel}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                        {leg.probability}%
                      </span>
                      <span className="text-[10px] font-mono text-amber-800">
                        Mín @{leg.fairMinOdd.toFixed(2)}x
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-[11px] shrink-0">
                      ~@{leg.estimatedBookieOdd.toFixed(2)}x
                    </span>
                  </div>
                ))}
              </div>

              {/* Barra Inferior Compacta: Prueba de Estrés en 1 línea + Acciones */}
              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {combo.stressTest.trafficLight === 'GREEN'
                      ? '🟢'
                      : combo.stressTest.trafficLight === 'YELLOW'
                      ? '🟡'
                      : '🔴'}{' '}
                    Estrés: <strong>{combo.stressTest.simulatedWinsPer100}/100</strong> aciertos
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    Stake Sugerido: {combo.recommendedKellyStakePct}%
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyCombo(combo)}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedComboId === combo.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadToSlip(combo)}
                    className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Cargar al Boleto</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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

  if (isLoading || !summary) {
    return (
      <div className="py-12 text-center space-y-2">
        <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-700">
          Calculando efectividad real por competición...
        </p>
      </div>
    );
  }

  const activeStats =
    sportFilter === 'PRIME_SOCCER'
      ? summary.primeSoccer
      : sportFilter === 'SECONDARY_SOCCER'
      ? summary.secondarySoccer
      : sportFilter === 'NBA'
      ? summary.nbaBasketball
      : summary.consolidated;

  const allSampleMatches = summary.metricsByCategory.flatMap((c) => c.sampleMatches);
  const filteredMatches = allSampleMatches.filter((rec) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'PRIME_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'SECONDARY';
    if (sportFilter === 'NBA') return rec.sport === 'NBA';
    return true;
  });

  const filteredTopLeagues = summary.topLeagues.filter((l) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return l.sport === 'NBA';
    if (sportFilter === 'PRIME_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'SECONDARY';
    return true;
  });

  const filteredCategories = summary.metricsByCategory.filter((cat) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return cat.sport === 'NBA';
    return cat.sport === 'SOCCER';
  });

  const getSegmentHeaderLabel = () => {
    if (sportFilter === 'PRIME_SOCCER') return '⚽ Fútbol · Ligas Principales';
    if (sportFilter === 'SECONDARY_SOCCER') return '🌍 Fútbol · Ligas Secundarias';
    if (sportFilter === 'NBA') return '🏀 Baloncesto · NBA';
    return '🌐 Consolidado Global';
  };

  return (
    <div className="space-y-3.5 font-sans text-slate-800">
      {/* 0. Selector de Segmento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 text-center text-xs">
        <button
          type="button"
          onClick={() => setSportFilter('PRIME_SOCCER')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'PRIME_SOCCER'
              ? 'bg-white text-emerald-800 border border-emerald-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>⚽ Principales</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('SECONDARY_SOCCER')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'SECONDARY_SOCCER'
              ? 'bg-white text-indigo-800 border border-indigo-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🌍 Secundarias</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('NBA')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'NBA'
              ? 'bg-white text-amber-800 border border-amber-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🏀 Baloncesto</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('ALL')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'ALL'
              ? 'bg-white text-cyan-800 border border-cyan-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🌐 Global</span>
        </button>
      </div>

      {/* 1. Resumen Principal y Exportación */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {getSegmentHeaderLabel()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
              📅 Acta Oficial Cerrada
            </span>
          </div>

          <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              Efectividad:{' '}
              <span className="text-emerald-700">
                {activeStats.accuracyPercentage}%
              </span>
            </h3>
            <span className="text-xs font-medium text-slate-500">
              ({activeStats.hits} aciertos de {activeStats.evaluatedMatches} verificados)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          {confirmResetCycle ? (
            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 animate-fadeIn">
              <span className="text-[11px] text-rose-800 font-bold">¿Reiniciar mes?</span>
              <button
                type="button"
                onClick={handleResetMonthlyCycle}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetCycle(false)}
                className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetCycle(true)}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="Reiniciar ciclo mensual"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo Mes</span>
            </button>
          )}
        </div>
      </div>

      {/* 1.5 Indicadores Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Muestras</span>
          <span className="text-base font-bold font-mono text-slate-900">{activeStats.totalMatches}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs">
          <span className="text-emerald-800 block text-[10px] uppercase font-semibold">Aciertos</span>
          <span className="text-base font-bold font-mono text-emerald-700">{activeStats.hits}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs">
          <span className="text-rose-800 block text-[10px] uppercase font-semibold">Fallos</span>
          <span className="text-base font-bold font-mono text-rose-700">{activeStats.misses}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
          <span className="text-amber-800 block text-[10px] uppercase font-semibold">
            {sportFilter === 'SECONDARY_SOCCER' ? 'Sin Acta' : 'Cobertura'}
          </span>
          <span className="text-base font-bold font-mono text-amber-800">
            {sportFilter === 'SECONDARY_SOCCER' ? `${activeStats.unverifiedCount}` : `${activeStats.coveragePercentage}%`}
          </span>
        </div>
      </div>

      {/* 2. Top 5 Ligas */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Top 5 Ligas con Mayor Efectividad</span>
          </span>
        </div>

        <div className="space-y-1.5">
          {filteredTopLeagues.length === 0 ? (
            <p className="text-xs text-slate-500 p-2 text-center">Sin registros verificados en este segmento.</p>
          ) : (
            filteredTopLeagues.map((league, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={league.leagueName}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {medal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900 truncate block">{league.leagueName}</span>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            league.sport === 'NBA' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(10, league.accuracyPercentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="font-bold text-slate-900 text-xs">{league.accuracyPercentage}%</span>
                    <span className="text-[10px] text-slate-500 block">{league.hits}/{league.evaluatedMatches}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Efectividad por Mercado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredCategories.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{m.categoryLabel}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {m.accuracyPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${m.accuracyPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Evaluados: {m.evaluatedMatches}</span>
              <span className="text-emerald-700 font-semibold">✓ {m.hits}</span>
              <span className="text-rose-600">✕ {m.misses}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Tabla Detallada de Partidos Evaluados */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Historial Verificado ({filteredMatches.length})</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{summary.lastUpdated}</span>
        </div>

        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] uppercase">
                <th className="py-2 px-2.5">Partido</th>
                <th className="py-2 px-2">Mercado</th>
                <th className="py-2 px-2">Pronóstico</th>
                <th className="py-2 px-2">Real</th>
                <th className="py-2 px-2.5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredMatches.map((rec, i) => (
                <tr key={`${rec.fixtureId}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-2.5 font-sans font-semibold text-slate-900">
                    <div>{rec.matchTitle}</div>
                    <span className="text-[10px] text-slate-400 font-normal block">{rec.leagueName}</span>
                  </td>
                  <td className="py-2 px-2 text-slate-600 text-[11px]">{rec.marketType}</td>
                  <td className="py-2 px-2 text-slate-900 font-semibold text-[11px]">{rec.predictionLabel}</td>
                  <td className="py-2 px-2 text-slate-600 text-[11px]">{rec.actualResult}</td>
                  <td className="py-2 px-2.5 text-right">
                    {rec.status === 'UNVERIFIED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ANULADO
                      </span>
                    ) : rec.isHit ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ ACIERTO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        ✕ FALLO
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

interface AdminFeedbackRecord {
  id: string;
  u: string;
  n: string;
  r: number;
  c: string;
  m: string;
  t: number;
}

const AdminFeedbackTab: React.FC = () => {
  const [items, setItems] = useState<AdminFeedbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStarFilter, setSelectedStarFilter] = useState<'ALL' | number>('ALL');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const getAdminAuthHeaders = useCallback((withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    const pin =
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      '';
    if (pin.trim()) headers['x-admin-pin'] = pin.trim();
    const jwt = sessionStorage.getItem('sportstats_session_jwt');
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    return headers;
  }, []);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        headers: getAdminAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch {
      // ignore offline
    } finally {
      setIsLoading(false);
    }
  }, [getAdminAuthHeaders]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleDeleteItem = async (id: string) => {
    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    setConfirmClearAll(false);
    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, clearAll: true })
      });
      if (res.ok) {
        setItems([]);
      }
    } catch {
      // ignore
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    if (total === 0) {
      return { total: 0, avg: '0.0', fiveStars: 0, fiveStarPct: 0 };
    }
    const sum = items.reduce((acc, it) => acc + (Number(it.r) || 5), 0);
    const fiveStars = items.filter((it) => Number(it.r) === 5).length;
    return {
      total,
      avg: (sum / total).toFixed(1),
      fiveStars,
      fiveStarPct: Math.round((fiveStars / total) * 100)
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedStarFilter === 'ALL') return items;
    return items.filter((it) => Number(it.r) === selectedStarFilter);
  }, [items, selectedStarFilter]);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Resumen KPI del Buzón Privado de Calificaciones */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                ⭐ Exclusivo Administrador
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
                ⚡ Persistente en BD (&lt;10 KB)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              Calificaciones y Buzón de Usuarios · G METRICS
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadFeedback}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            {items.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
                  <span className="text-[11px] text-rose-800 font-bold">¿Vaciar buzón?</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 3 Tarjetas de Resumen */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Promedio Global</span>
            <span className="text-base font-bold font-mono text-amber-700 flex items-center gap-1 mt-0.5">
              <span>{stats.avg}</span>
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Reseñas</span>
            <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
              {stats.total}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
            <span className="text-emerald-800 block text-[10px] uppercase font-semibold">5 Estrellas</span>
            <span className="text-base font-bold font-mono text-emerald-700 mt-0.5 block">
              {stats.fiveStarPct}% ({stats.fiveStars})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtro por Estrellas */}
      <div className="flex items-center gap-1 flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setSelectedStarFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
            selectedStarFilter === 'ALL'
              ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todas ({items.length})
        </button>
        {[5, 4, 3, 2, 1].map((st) => {
          const count = items.filter((i) => Number(i.r) === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStarFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                selectedStarFilter === st
                  ? 'bg-white text-amber-900 border border-amber-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st} ⭐ ({count})
            </button>
          );
        })}
      </div>

      {/* 3. Lista de Comentarios y Calificaciones */}
      {isLoading ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
          Cargando comentarios de usuarios...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
          <Star className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">
            Aún no hay calificaciones registradas en esta vista.
          </p>
          <p className="text-[11px] text-slate-500">
            Cuando un usuario envíe su calificación desde la notificación o el botón &quot;⭐ Calificar App&quot; del pie de página, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                    @{item.u}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
                    {'⭐'.repeat(Math.min(5, Math.max(1, Number(item.r) || 5)))} ({item.r}/5)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[10px]">
                    {item.c}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(item.t).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>

                {item.m ? (
                  <p className="text-xs text-slate-700 leading-relaxed pt-0.5 break-words">
                    &ldquo;{item.m}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] italic text-slate-400 pt-0.5">
                    Calificación enviada sin comentario escrito.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                title="Eliminar comentario"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


