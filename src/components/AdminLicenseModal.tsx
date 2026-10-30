import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Key,
  X,
  Lock,
  MessageCircle,
  Power,
  Database,
  Users,
  BarChart2,
  Eye,
  EyeOff,
  Ticket,
  Star
} from 'lucide-react';
import {
  createLicenseToken,
  getOrCreateDeviceId,
  saveActiveLicense,
  verifyLicenseToken,
  clearActiveLicense
} from '../services/licenseService';
import { MatchFixture } from '../types';
import { AdminMonitorTab } from './admin/AdminMonitorTab';
import { AdminAuditTab } from './admin/AdminAuditTab';
import { AdminParlaysBetaTab } from './admin/AdminParlaysBetaTab';
import { AdminFeedbackTab } from './admin/AdminFeedbackTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminSecurityTab } from './admin/AdminSecurityTab';

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

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({
  isOpen,
  onClose,
  onLicenseChanged,
  onLogout,
  fixtures = []
}) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('sportstats_admin_remember') === 'true';
  });
  const [pinInput, setPinInput] = useState(() => {
    return localStorage.getItem('sportstats_admin_saved_pin') || '';
  });
  const [showPinInput, setShowPinInput] = useState(false);
  const [showRecoveryNewPin, setShowRecoveryNewPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'USERS' | 'PARLAYS_BETA' | 'MONITOR' | 'AUDIT' | 'FEEDBACK' | 'CONFIG'
  >('USERS');

  // Server Telemetry & Diagnostic Monitor State
  const [serverTelemetry, setServerTelemetry] = useState<any | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  // Supabase User Management State
  const [appUsersList, setAppUsersList] = useState<SupabaseUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Config & Security PIN
  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');
  const [activeServerPin, setActiveServerPin] = useState(() => {
    return (
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      ''
    );
  });

  // Supabase Database Status & SQL Helper
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseProject, setSupabaseProject] = useState<string | null>(null);
  const [supabaseSqlSchema, setSupabaseSqlSchema] = useState<string | null>(null);

  // Emergency Recovery States (when PIN is forgotten)
  const [showRecoveryMode, setShowRecoveryMode] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null);

  const buildAdminHeaders = useCallback(
    (pin?: string, includeJson = false, idempotent = false): Record<string, string> => {
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
    },
    []
  );

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
  }, [buildAdminHeaders]);

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

  const getLocalDeletedUsernames = useCallback((): Set<string> => {
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
  }, []);

  const saveLocalDeletedUsernames = useCallback((set: Set<string>) => {
    try {
      localStorage.setItem('sportstats_deleted_usernames', JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  }, []);

  const loadAppUsers = useCallback(
    async (pin: string) => {
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
              if (
                !uname ||
                deletedSet.has(uname) ||
                u.status === 'deleted' ||
                u.planType === 'DELETED' ||
                u.notes === '[DELETED]'
              )
                continue;
              const isPending = u.status === 'pending';
              const sanitizedUser = {
                ...u,
                username: uname,
                planType: isPending ? 'PENDING' : u.planType || '30D',
                planLabel: isPending ? 'Pendiente de Activación' : u.planLabel || 'Pase Mensual',
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
                  if (
                    !uname ||
                    deletedSet.has(uname) ||
                    u.status === 'deleted' ||
                    u.planType === 'DELETED' ||
                    u.notes === '[DELETED]'
                  )
                    continue;
                  const isPending = u.status === 'pending';
                  const sanitizedUser = {
                    ...u,
                    username: uname,
                    planType: isPending ? 'PENDING' : u.planType || '30D',
                    planLabel: isPending ? 'Pendiente de Activación' : u.planLabel || 'Pase Mensual',
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
    },
    [buildAdminHeaders, getLocalDeletedUsernames]
  );

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
              <AdminUsersTab
                appUsersList={appUsersList}
                setAppUsersList={setAppUsersList}
                isLoadingUsers={isLoadingUsers}
                serverTelemetry={serverTelemetry}
                activePin={pinInput.trim() || activeServerPin}
                onRefreshUsers={loadAppUsers}
                buildAdminHeaders={buildAdminHeaders}
                getLocalDeletedUsernames={getLocalDeletedUsernames}
                saveLocalDeletedUsernames={saveLocalDeletedUsernames}
              />
            )}

            {/* TAB MONITOR: USUARIOS ONLINE, RÉCORD PICO, CUOTA API Y DIAGNÓSTICO */}
            {activeTab === 'MONITOR' && (
              <AdminMonitorTab
                serverTelemetry={serverTelemetry}
                isLoadingTelemetry={isLoadingTelemetry}
                onRefreshTelemetry={loadServerTelemetry}
              />
            )}

            {/* TAB 1: SEGURIDAD & PIN */}
            {activeTab === 'CONFIG' && (
              <AdminSecurityTab
                activeServerPin={activeServerPin}
                setActiveServerPin={setActiveServerPin}
                pinInput={pinInput}
                setPinInput={setPinInput}
                adminWhatsApp={adminWhatsApp}
                setAdminWhatsApp={setAdminWhatsApp}
                supabaseConfigured={supabaseConfigured}
                supabaseProject={supabaseProject}
                supabaseSqlSchema={supabaseSqlSchema}
                buildAdminHeaders={buildAdminHeaders}
              />
            )}

            {/* TAB 2: AUDIT & ALGORITHM ACCURACY */}
            {activeTab === 'AUDIT' && <AdminAuditTab />}

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
