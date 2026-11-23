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
import { MatchFixture, NBAMatchFixture } from '../types';
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
  nbaFixtures?: NBAMatchFixture[];
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
  fixtures = [],
  nbaFixtures = []
}) => {
  const isCurrentGoogleUserAdmin = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem('sportstats_auth_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.role === 'admin') return true;
      }
    } catch {
      // ignore
    }
    return localStorage.getItem('sportstats_admin_remember') === 'true';
  }, []);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => isCurrentGoogleUserAdmin());
  const [pinInput, setPinInput] = useState('');

  const [activeTab, setActiveTab] = useState<
    'USERS' | 'PARLAYS_BETA' | 'MONITOR' | 'AUDIT' | 'FEEDBACK' | 'CONFIG'
  >('USERS');

  // Server Telemetry & Diagnostic Monitor State
  const [serverTelemetry, setServerTelemetry] = useState<any | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  // Supabase User Management State
  const [appUsersList, setAppUsersList] = useState<SupabaseUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Config
  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');
  const [freeAccessMode, setFreeAccessMode] = useState<boolean>(true);
  const [activeServerPin, setActiveServerPin] = useState('');

  // Supabase Database Status & SQL Helper
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseProject, setSupabaseProject] = useState<string | null>(null);
  const [supabaseSqlSchema, setSupabaseSqlSchema] = useState<string | null>(null);

  const buildAdminHeaders = useCallback(
    (_pin?: string, includeJson = false, idempotent = false): Record<string, string> => {
      const headers: Record<string, string> = {};
      if (includeJson) {
        headers['Content-Type'] = 'application/json';
      }
      const jwt = sessionStorage.getItem('sportstats_session_jwt') || localStorage.getItem('sportstats_session_jwt');
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
      const res = await fetch('/api/license/config', {
        headers: buildAdminHeaders()
      });
      const data = await res.json();
      if (data.success) {
        if (data.adminWhatsApp) setAdminWhatsApp(data.adminWhatsApp);
        if (typeof data.freeAccessMode === 'boolean') setFreeAccessMode(data.freeAccessMode);
        if (data.isAdminSession) {
          setIsAdminAuthenticated(true);
        }
      }

      fetch('/api/admin/supabase-status', {
        headers: buildAdminHeaders()
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
    } catch {
      // fallback
    }
  }, [buildAdminHeaders]);

  const loadServerTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch('/api/admin/telemetry', {
        headers: buildAdminHeaders(activeServerPin)
      });
      const data = await res.json();
      if (data && (data.status === 'ok' || data.onlineNowCount !== undefined)) {
        setServerTelemetry(data);
      }
    } catch {
      // ignore network error
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, [activeServerPin, buildAdminHeaders]);

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
      const hasAdmin = isCurrentGoogleUserAdmin();
      setIsAdminAuthenticated(hasAdmin);
      loadConfig();
      if (hasAdmin) {
        loadServerTelemetry();
        loadAppUsers('');
      }
      const interval = setInterval(() => {
        if (isCurrentGoogleUserAdmin()) {
          loadServerTelemetry();
        }
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isCurrentGoogleUserAdmin, loadConfig, loadAppUsers, loadServerTelemetry]);

  const handleCloseModal = () => {
    onClose();
  };

  const handleLogoutAdmin = () => {
    try {
      clearActiveLicense();
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_client_name');
      localStorage.removeItem('sportstats_session_jwt');
      sessionStorage.removeItem('sportstats_session_jwt');
      sessionStorage.removeItem('futbolstats_admin_pin');
      sessionStorage.removeItem('sportstats_exp_alert_dismissed');
    } catch {
      // ignore storage errors
    }
    setIsAdminAuthenticated(false);
    setPinInput('');
    setActiveServerPin('');
    onClose();
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  // STATE 1: Acceso Restringido (Exclusivo Google OAuth de Administrador)
  if (!isAdminAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          onClick={handleCloseModal}
          className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center text-white animate-in zoom-in-95 duration-200"
        >
          <button
            onClick={handleCloseModal}
            type="button"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[#0b0e14] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="w-11 h-11 rounded-xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-[#d9b114]" />
          </div>

          <h3 className="text-base font-bold text-white tracking-tight mb-1">
            Acceso Restringido
          </h3>
          <p className="text-xs text-[#8b949e] mb-5 leading-relaxed">
            El Panel de Administración ahora utiliza verificación exclusiva por <span className="text-white font-semibold">Google OAuth</span>. Inicia sesión con tu cuenta de Google de administrador para continuar.
          </p>

          <button
            type="button"
            onClick={handleCloseModal}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#d9b114] hover:bg-[#c29e10] text-[#0b0e14] transition shadow-xs cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // STATE 2: Full Authenticated Admin Panel (Cyber-Fintech Dark)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop blur independiente (fondo visible y difuminado cristalino) */}
      <div
        onClick={handleCloseModal}
        className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />
      <div className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-2xl sm:rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-3 sm:p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[#d9b114]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-white flex items-center gap-2 truncate">
                <span>Panel de Administración · G METRICS</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-[#8b949e] font-mono truncate">
                Sesión Propietario · Modo Privado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={handleLogoutAdmin}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Bloquear panel y cerrar sesión"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
            <button
              onClick={handleCloseModal}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0b0e14] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition cursor-pointer shrink-0"
              title="Cerrar panel"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Authenticated Panel Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Pinned Responsive Tabs Bar (Sin cortes, espacio amplio para todas las pestañas) */}
          <div className="sticky top-0 z-20 border-b border-[#30363d] bg-[#0b0e14] px-3 sm:px-5 pt-1.5 pb-0 flex items-center gap-1 sm:gap-2 text-xs font-semibold overflow-x-auto scrollbar-thin shrink-0 pr-6">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs ${
                activeTab === 'USERS'
                  ? 'border-[#d9b114] text-white bg-[#161b22] font-bold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Usuarios ({appUsersList.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('MONITOR');
                loadServerTelemetry();
              }}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs ${
                activeTab === 'MONITOR'
                  ? 'border-[#d9b114] text-white bg-[#161b22] font-bold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Monitor & API</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#161b22] border border-[#30363d] text-[10px] font-bold text-[#00ff66] tabular-nums">
                🟢 {serverTelemetry?.onlineNowCount ?? 1}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs ${
                activeTab === 'AUDIT'
                  ? 'border-[#d9b114] text-white bg-[#161b22] font-bold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Eficiencia (+EV)</span>
            </button>
            <button
              onClick={() => setActiveTab('PARLAYS_BETA')}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs ${
                activeTab === 'PARLAYS_BETA'
                  ? 'border-[#d9b114] text-[#d9b114] bg-[#161b22] font-extrabold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <Ticket className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Parlays (Beta)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#d9b114] text-[#0b0e14] font-mono text-[9px] font-black uppercase">
                BETA
              </span>
            </button>
            <button
              onClick={() => setActiveTab('FEEDBACK')}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs ${
                activeTab === 'FEEDBACK'
                  ? 'border-[#d9b114] text-white bg-[#161b22] font-bold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-[#d9b114] fill-[#d9b114]" />
              <span>Feedback</span>
            </button>
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`px-3 py-2 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer text-xs mr-2 ${
                activeTab === 'CONFIG'
                  ? 'border-[#d9b114] text-white bg-[#161b22] font-bold shadow-2xs'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Seguridad & PIN</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable independently) */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-[#0b0e14]/50 text-white">
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
                freeAccessMode={freeAccessMode}
                setFreeAccessMode={setFreeAccessMode}
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
              <AdminParlaysBetaTab fixtures={fixtures} nbaFixtures={nbaFixtures} onCloseAdmin={handleCloseModal} />
            )}

            {/* TAB 4: BUZÓN PRIVADO DE FEEDBACK Y CALIFICACIONES (SOLO ADMIN) */}
            {activeTab === 'FEEDBACK' && <AdminFeedbackTab />}
          </div>
        </div>
      </div>
    </div>
  );
};
