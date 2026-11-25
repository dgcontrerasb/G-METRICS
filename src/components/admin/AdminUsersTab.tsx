import React, { useState, useMemo } from 'react';
import {
  Check,
  UserCheck,
  RefreshCw,
  Smartphone,
  MessageCircle,
  Users,
  Search,
  Unlock,
  Download,
  Trash2,
  Sparkles,
  Gift,
  Copy,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import type { SupabaseUserItem } from '../AdminLicenseModal';

function formatLastConnectionInfo(lastActiveAt?: number | null, createdAt?: number | null): {
  dateText: string;
  relativeText: string;
  inactiveDays: number;
  toneClass: string;
  isFallbackCreated: boolean;
} {
  const hasRealLastActive = Boolean(lastActiveAt && Number(lastActiveAt) > 0);
  const refTs = hasRealLastActive ? Number(lastActiveAt) : Number(createdAt || 0);
  if (!refTs) {
    return {
      dateText: 'Sin registro',
      relativeText: '',
      inactiveDays: 0,
      toneClass: 'text-[#8b949e]',
      isFallbackCreated: false
    };
  }
  const now = Date.now();
  const diffMs = Math.max(0, now - refTs);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  const dateText = new Date(refTs).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  let relativeText = 'Ahora';
  if (diffDays >= 1) {
    relativeText = `hace ${diffDays}d`;
  } else if (diffHours >= 1) {
    relativeText = `hace ${diffHours}h`;
  } else if (diffMins >= 1) {
    relativeText = `hace ${diffMins}m`;
  }

  const toneClass =
    diffDays >= 28
      ? 'text-rose-400'
      : diffDays >= 20
      ? 'text-amber-400'
      : 'text-[#8b949e]';

  return {
    dateText: hasRealLastActive ? dateText : `Reg. ${dateText}`,
    relativeText,
    inactiveDays: diffDays,
    toneClass,
    isFallbackCreated: !hasRealLastActive
  };
}

interface AdminUsersTabProps {
  appUsersList: SupabaseUserItem[];
  setAppUsersList: React.Dispatch<React.SetStateAction<SupabaseUserItem[]>>;
  isLoadingUsers: boolean;
  serverTelemetry: any | null;
  activePin: string;
  onRefreshUsers: (pin: string) => Promise<void>;
  buildAdminHeaders: (pin?: string, includeJson?: boolean, idempotent?: boolean) => Record<string, string>;
  getLocalDeletedUsernames: () => Set<string>;
  saveLocalDeletedUsernames: (set: Set<string>) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  appUsersList,
  setAppUsersList,
  isLoadingUsers,
  serverTelemetry,
  activePin,
  onRefreshUsers,
  buildAdminHeaders,
  getLocalDeletedUsernames,
  saveLocalDeletedUsernames
}) => {
  const [userFilter, setUserFilter] = useState<'ALL' | 'ONLINE' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BOUND'>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [adminUserViewMode, setAdminUserViewMode] = useState<'CARDS' | 'COMPACT'>('COMPACT');
  const [activeToolPanel, setActiveToolPanel] = useState<'NONE' | 'VIP_CODE' | 'QUICK_USER'>('NONE');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [confirmDeleteUserKey, setConfirmDeleteUserKey] = useState<string | null>(null);
  const [newQuickUsername, setNewQuickUsername] = useState('');
  const [newQuickPin, setNewQuickPin] = useState('');
  const [newQuickName, setNewQuickName] = useState('');
  const [newQuickDays, setNewQuickDays] = useState<number>(30);
  const [userRenewDays, setUserRenewDays] = useState<Record<string, number>>({});
  const [editingDaysUserId, setEditingDaysUserId] = useState<string | null>(null);
  const [customDaysInputValue, setCustomDaysInputValue] = useState<string>('15');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeDays, setCodeDays] = useState<number>(30);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch('/api/admin/codes/generate', {
        method: 'POST',
        headers: buildAdminHeaders(resolveCurrentPin(), true),
        body: JSON.stringify({ days: codeDays })
      });
      const data = await res.json();
      if (data.success && data.code) {
        setGeneratedCode(data.code);
        setCodeCopied(false);
      } else {
        setActionFeedback(data.error || 'Error al generar código');
      }
    } catch {
      setActionFeedback('Error de red al generar código');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyGeneratedCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const resolveCurrentPin = () =>
    activePin.trim() || localStorage.getItem('sportstats_admin_saved_pin') || '';

  const handleCreateOrUpdateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newQuickUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanUser || cleanUser.length < 3) {
      setActionFeedback('El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }

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

    const currentPin = resolveCurrentPin();
    const nowMs = Date.now();
    const isPermanent = newQuickDays === 0;
    const expiresAt = isPermanent ? null : nowMs + newQuickDays * 24 * 60 * 60 * 1000;
    const planType = isPermanent ? 'PERMANENT' : newQuickDays === 1 ? '24H' : `${newQuickDays}D`;
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
    onRefreshUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleResetUserDevice = async (userId: string, username: string) => {
    const currentPin = resolveCurrentPin();
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
    onRefreshUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleRenewUser = async (
    userId: string,
    username: string,
    targetDays = 30,
    mode: 'SET' | 'ADD' = 'SET'
  ) => {
    const currentPin = resolveCurrentPin();
    const nowMs = Date.now();
    const isPermanent = Number(targetDays) === 0;
    const daysMs = Number(targetDays) * 24 * 60 * 60 * 1000;
    const planType = isPermanent ? 'PERMANENT' : Number(targetDays) === 1 ? '24H' : `${targetDays}D`;
    const planLabel = isPermanent
      ? 'Pase Permanente Vitalicio'
      : Number(targetDays) === 1
      ? 'Muestra 24 Horas'
      : `Pase ${targetDays} Días`;

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
    onRefreshUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string, username?: string) => {
    const currentPin = resolveCurrentPin();
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
    onRefreshUsers(currentPin);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    const cleanUser = String(username || '').toLowerCase().trim();
    setConfirmDeleteUserKey(null);

    if (cleanUser) {
      const deletedSet = getLocalDeletedUsernames();
      deletedSet.add(cleanUser);
      saveLocalDeletedUsernames(deletedSet);
    }

    setAppUsersList((prev) =>
      prev.filter((u) => u.id !== userId && String(u.username || '').toLowerCase().trim() !== cleanUser)
    );

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

    try {
      const currentPin = resolveCurrentPin();
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

  // Filtrado y paginación reactiva de usuarios
  const filteredUsersList = useMemo(() => {
    return appUsersList.filter((u) => {
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
    });
  }, [appUsersList, userFilter, userSearch, serverTelemetry]);

  const totalPages = Math.max(1, Math.ceil(filteredUsersList.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredUsersList.slice(start, start + pageSize);
  }, [filteredUsersList, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-3.5">
      {/* Feedback Toast */}
      {actionFeedback && (
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#d9b114]/40 text-[#d9b114] text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#d9b114] shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-white/40 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra compacta de herramientas colapsables (da protagonismo a la lista de usuarios) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161b22] px-3 py-2 rounded-xl border border-[#30363d]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveToolPanel((p) => (p === 'VIP_CODE' ? 'NONE' : 'VIP_CODE'))}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              activeToolPanel === 'VIP_CODE'
                ? 'bg-[#00ff66] text-black border-[#00ff66]'
                : 'bg-[#0b0e14] text-[#00ff66] border-[#00ff66]/30 hover:bg-[#00ff66]/10'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Generar Código VIP</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveToolPanel((p) => (p === 'QUICK_USER' ? 'NONE' : 'QUICK_USER'))}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              activeToolPanel === 'QUICK_USER'
                ? 'bg-[#d9b114] text-black border-[#d9b114]'
                : 'bg-[#0b0e14] text-[#d9b114] border-[#d9b114]/30 hover:bg-[#d9b114]/10'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Crear / Activar Usuario</span>
          </button>
        </div>
        <span className="text-[10.5px] text-[#8b949e] hidden sm:inline">
          Auto-limpieza: cuentas con &gt;30 días sin conexión se eliminan automáticamente
        </span>
      </div>

      {/* Generador de Códigos VIP Dinámicos (Desplegable) */}
      {activeToolPanel === 'VIP_CODE' && (
      <div className="bg-[#161b22] p-3 rounded-xl border border-[#30363d] space-y-2 shadow-xl animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66] shrink-0">
              <Gift className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Generar Código VIP Dinámico</span>
                <span className="text-[10px] font-bold text-[#00ff66] bg-[#00ff66]/10 border border-[#00ff66]/30 px-1.5 py-0.2 rounded-full">
                  1 solo uso
                </span>
              </div>
              <p className="text-[10.5px] text-[#8b949e]">
                Genera un código para enviar por WhatsApp tras recibir el pago ($9.900 COP / $3.50 USD).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <select
              value={codeDays}
              onChange={(e) => setCodeDays(Number(e.target.value))}
              className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-[#00ff66] shadow-inner"
            >
              <option value={30}>🗓️ 30 Días (Mensual)</option>
              <option value={60}>🗓️ 60 Días</option>
              <option value={90}>🗓️ 90 Días (Trimestral)</option>
              <option value={7}>📅 7 Días</option>
            </select>

            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={isGeneratingCode}
              className="px-3 py-1.5 rounded-lg bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-md active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>{isGeneratingCode ? 'Generando...' : 'Generar'}</span>
            </button>
          </div>
        </div>

        {generatedCode && (
          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#00ff66]/40 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-[#00ff66] shrink-0">Código Generado:</span>
              <span className="font-mono text-xs font-extrabold text-[#00ff66] bg-[#161b22] px-2 py-0.5 rounded border border-[#00ff66]/40 tracking-wider select-all truncate">
                {generatedCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyGeneratedCode}
              className="px-2.5 py-1 rounded-lg bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-bold text-xs flex items-center gap-1 shadow-md transition shrink-0 cursor-pointer"
            >
              {codeCopied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{codeCopied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        )}
      </div>
      )}

      {/* Quick Create / Activate User Form (Desplegable) */}
      {activeToolPanel === 'QUICK_USER' && (
      <form
        onSubmit={handleCreateOrUpdateQuickUser}
        className="bg-[#161b22] p-3 rounded-xl border border-[#30363d] space-y-2 shadow-xl animate-fadeIn"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#d9b114]" />
            <span>Crear o Activar Usuario Rápido</span>
          </span>
          <span className="text-[10px] text-[#8b949e]">
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
            className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
          />
          <input
            type="text"
            value={newQuickPin}
            onChange={(e) => setNewQuickPin(e.target.value)}
            placeholder="PIN (opcional)"
            className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
          />
          <input
            type="text"
            value={newQuickName}
            onChange={(e) => setNewQuickName(e.target.value)}
            placeholder="Nombre (opcional)"
            className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
          />
          <select
            value={newQuickDays}
            onChange={(e) => setNewQuickDays(Number(e.target.value))}
            className="bg-[#0b0e14] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#d9b114] cursor-pointer"
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
            className="px-3 py-1.5 rounded-lg bg-[#d9b114] hover:bg-[#d9b114]/90 text-black font-black text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1 active:scale-95"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>+ Activar</span>
          </button>
        </div>
      </form>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#161b22] p-2.5 rounded-xl border border-[#30363d] shadow-lg">
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
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer font-bold ${
                userFilter === f.id
                  ? 'bg-[#d9b114] text-black shadow-md'
                  : 'text-[#8b949e] hover:text-white hover:bg-[#0b0e14]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-[#8b949e] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar @usuario o nombre..."
              className="w-full bg-[#0b0e14] border border-[#30363d] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
            />
          </div>
          {/* Toggle Vista Tarjetas / Tabla */}
          <div className="flex items-center rounded-lg border border-[#30363d] bg-[#0b0e14] p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setAdminUserViewMode('CARDS')}
              className={`p-1 px-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                adminUserViewMode === 'CARDS' ? 'bg-[#d9b114] text-black font-black' : 'text-[#8b949e] hover:text-white'
              }`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminUserViewMode('COMPACT')}
              className={`p-1 px-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                adminUserViewMode === 'COMPACT' ? 'bg-[#d9b114] text-black font-black' : 'text-[#8b949e] hover:text-white'
              }`}
              title="Vista de Tabla Compacta"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Tabla</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadUsersExcel}
            disabled={appUsersList.length === 0}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#00ff66] bg-[#00ff66]/10 hover:bg-[#00ff66]/20 border border-[#00ff66]/30 flex items-center gap-1 shrink-0 transition cursor-pointer disabled:opacity-50"
            title="Descargar usuarios en Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-[#00ff66]" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => onRefreshUsers(resolveCurrentPin())}
            className="p-1.5 rounded-lg text-xs text-[#8b949e] hover:text-white bg-[#0b0e14] border border-[#30363d] shrink-0 transition cursor-pointer"
            title="Actualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Cards List */}
      {isLoadingUsers && appUsersList.length === 0 ? (
        <div className="text-center py-10 text-[#8b949e] text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#d9b114]" />
          <span>Cargando usuarios...</span>
        </div>
      ) : appUsersList.length === 0 ? (
        <div className="text-center py-8 text-[#8b949e] text-xs bg-[#161b22] rounded-2xl border border-[#30363d] p-6 space-y-1.5">
          <Users className="w-7 h-7 text-[#8b949e] mx-auto" />
          <p className="font-black text-white">No hay usuarios registrados aún</p>
          <p className="text-[11px] text-[#8b949e]">
            Crea una cuenta arriba o espera solicitudes desde la pantalla de ingreso.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedUsers.length === 0 ? (
            <div className="text-center py-6 text-[#8b949e] text-xs bg-[#161b22] rounded-xl border border-[#30363d]">
              No se encontraron usuarios coincidentes con el filtro o búsqueda.
            </div>
          ) : adminUserViewMode === 'COMPACT' ? (
            <div className="overflow-x-auto rounded-xl border border-[#30363d] bg-[#161b22] shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b0e14] border-b border-[#30363d] text-[#8b949e] font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-2.5">Usuario</th>
                    <th className="py-2 px-2.5">Estado</th>
                    <th className="py-2 px-2.5">Dispositivo</th>
                    <th className="py-2 px-2.5">Últ. conexión</th>
                    <th className="py-2 px-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]/70">
                  {paginatedUsers.map((u) => {
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
                    const conn = formatLastConnectionInfo(u.lastActiveAt, u.createdAt);
                    return (
                      <tr key={u.id} className="hover:bg-[#0b0e14]/70 transition">
                        <td className="py-1.5 px-2.5 max-w-[240px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-[11px] text-[#d9b114] bg-[#d9b114]/10 px-1.5 py-0.5 rounded border border-[#d9b114]/30 shrink-0">
                              @{u.username}
                            </span>
                            {u.displayName && (
                              <span className="text-white/90 font-medium text-[11px] truncate">
                                {u.displayName}
                              </span>
                            )}
                            {u.role === 'admin' && (
                              <span className="text-[9.5px] bg-[#d9b114]/20 text-[#d9b114] border border-[#d9b114]/40 px-1 rounded font-black shrink-0">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                            isSuspended
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isExpired
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30'
                          }`}>
                            {isSuspended ? 'SUSP.' : isExpired ? 'VENC.' : `${daysLeft != null ? daysLeft + 'd' : 'ACTIVO'}`}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-[10.5px] whitespace-nowrap">
                          {isBound ? (
                            <span className="inline-flex items-center gap-1 text-white/85 font-mono text-[10px]" title={u.boundDeviceName || u.boundDeviceId || ''}>
                              <Smartphone className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="truncate max-w-[85px]">{u.boundDeviceName || u.boundDeviceId?.slice(0, 8)}</span>
                            </span>
                          ) : (
                            <span className="text-[#8b949e] text-[10px]">Libre</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          {isUserOnline ? (
                            <span className="text-[#00ff66] font-black text-[10.5px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse"></span> En línea
                            </span>
                          ) : (
                            <span className={`font-mono text-[10.5px] tabular-nums ${conn.toneClass}`} title={conn.isFallbackCreated ? 'Fecha de registro (sin conexión posterior registrada aún)' : 'Última conexión registrada'}>
                              {conn.dateText}
                              {conn.relativeText ? ` · ${conn.relativeText}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleRenewUser(u.id, u.username, 30, 'ADD')}
                              className="px-1.5 py-0.5 rounded bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/30 text-[10px] font-black transition cursor-pointer"
                              title="+30 Días"
                            >
                              +30d
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u.id, u.status, u.username)}
                              className="px-1.5 py-0.5 rounded bg-[#0b0e14] hover:bg-[#30363d] text-white border border-[#30363d] text-[10px] font-semibold transition cursor-pointer"
                              title={isSuspended ? 'Reactivar' : 'Pausar'}
                            >
                              {isSuspended ? 'Activar' : 'Pausar'}
                            </button>
                            {isBound && (
                              <button
                                type="button"
                                onClick={() => handleResetUserDevice(u.id, u.username)}
                                className="px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-medium transition cursor-pointer"
                                title="Desvincular Dispositivo"
                              >
                                Liberar
                              </button>
                            )}
                            {confirmDeleteUserKey === (u.username || u.id) ? (
                              <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="text-rose-400 font-bold text-[10px] cursor-pointer"
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserKey(null)}
                                  className="text-[#8b949e] text-[10px] cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserKey(u.username || u.id)}
                                className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer transition"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {paginatedUsers.map((u) => {
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
                  className={`p-3.5 rounded-2xl border space-y-2.5 text-xs transition shadow-lg ${
                    isSuspended
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : isExpired
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : isUserOnline
                      ? 'bg-[#00ff66]/5 border-[#00ff66]/40'
                      : 'bg-[#161b22] border-[#30363d]'
                  }`}
                >
                  {/* Header Row: Username, Role, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363d] pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs sm:text-sm text-[#d9b114] bg-[#d9b114]/10 border border-[#d9b114]/30 px-2 py-0.5 rounded-md">
                        @{u.username}
                      </span>
                      {u.displayName && (
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {u.displayName}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0b0e14] border border-[#30363d] text-[#8b949e]">
                        {u.role === 'admin' ? '🛡️ Admin' : '👤 Cliente'}
                      </span>
                      {isUserOnline && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 flex items-center gap-1">
                          <span>🟢 EN LÍNEA</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isSuspended
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : isExpired
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : u.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30'
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
                    <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#30363d] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-semibold text-[#8b949e]">
                          Plan
                        </span>
                        <span className="font-bold text-white">
                          {u.status === 'pending' ? 'Pendiente' : u.planLabel}
                        </span>
                      </div>
                      <div className="flex flex-col mt-1.5 pt-1.5 border-t border-[#30363d] gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-[#8b949e]">
                            Vigencia
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono font-bold text-xs ${
                                u.status === 'pending'
                                  ? 'text-amber-400'
                                  : isSuspended || isExpired
                                  ? 'text-rose-400'
                                  : daysLeft !== null && daysLeft !== undefined && daysLeft <= 3
                                  ? 'text-amber-400'
                                  : 'text-[#00ff66]'
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
                                className="px-1.5 py-0.5 rounded bg-[#161b22] hover:bg-[#30363d] text-white border border-[#30363d] text-[10px] font-semibold cursor-pointer transition"
                              >
                                ✏️ Editar
                              </button>
                            )}
                          </div>
                        </div>

                        {editingDaysUserId === u.id && (
                          <div className="mt-1 p-1.5 bg-[#161b22] border border-[#30363d] rounded-xl flex items-center justify-between gap-1 flex-wrap animate-fadeIn">
                            <span className="text-[10px] text-[#8b949e] font-semibold">Días:</span>
                            <input
                              type="number"
                              min="0"
                              max="3650"
                              value={customDaysInputValue}
                              onChange={(e) => setCustomDaysInputValue(e.target.value)}
                              className="w-16 bg-[#0b0e14] border border-[#30363d] rounded-md px-2 py-0.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-[#00ff66]"
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
                                className="px-2 py-0.5 rounded-md bg-[#00ff66] hover:bg-[#00ff66]/90 text-black text-[10px] font-black cursor-pointer shadow-sm"
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
                                className="px-2 py-0.5 rounded-md bg-[#0b0e14] hover:bg-[#30363d] text-white border border-[#30363d] text-[10px] font-semibold cursor-pointer"
                              >
                                + Sumar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDaysUserId(null)}
                                className="px-1.5 py-0.5 rounded bg-[#30363d] text-white/70 hover:text-white text-[10px] font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bound Device Info */}
                    <div className="bg-[#0b0e14] p-2.5 rounded-xl border border-[#30363d] flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-semibold text-[#8b949e] flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-cyan-400" />
                          <span>Dispositivo (1/1)</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            isBound
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30'
                          }`}
                        >
                          {isBound ? 'Vinculado' : 'Libre'}
                        </span>
                      </div>

                      <div className="mt-1.5 pt-1.5 border-t border-[#30363d] flex items-center justify-between gap-2">
                        {isBound ? (
                          <>
                            <p className="text-[11px] font-mono text-white/90 truncate font-medium" title={u.boundDeviceId || ''}>
                              {u.boundDeviceName || u.boundDeviceId}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleResetUserDevice(u.id, u.username)}
                              className="shrink-0 px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
                              title="Permitir inicio de sesión en otro equipo"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Liberar</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#8b949e]">
                            Se vinculará al primer ingreso
                          </span>
                        )}
                      </div>

                      {/* Última conexión (auto-purga tras 30 días de inactividad) */}
                      {(() => {
                        const conn = formatLastConnectionInfo(u.lastActiveAt, u.createdAt);
                        return (
                          <div className="mt-1.5 pt-1.5 border-t border-[#30363d] flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-semibold text-[#8b949e] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#8b949e]" />
                              <span>Últ. conexión</span>
                            </span>
                            {isUserOnline ? (
                              <span className="font-mono text-[10.5px] font-bold text-[#00ff66]">
                                Ahora (En línea)
                              </span>
                            ) : (
                              <span className={`font-mono text-[10.5px] tabular-nums font-semibold ${conn.toneClass}`}>
                                {conn.dateText}
                                {conn.relativeText ? ` · ${conn.relativeText}` : ''}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#30363d]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 bg-[#0b0e14] border border-[#30363d] rounded-lg p-0.5">
                        <select
                          value={userRenewDays[u.id] ?? 30}
                          onChange={(e) => setUserRenewDays((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                          className="bg-transparent text-white text-[11px] font-semibold px-1.5 py-1 focus:outline-none cursor-pointer"
                        >
                          <option value={1} className="bg-[#161b22] text-white">⚡ 1 Día</option>
                          <option value={3} className="bg-[#161b22] text-white">⚡ 3 Días</option>
                          <option value={7} className="bg-[#161b22] text-white">📅 7 Días</option>
                          <option value={15} className="bg-[#161b22] text-white">📅 15 Días</option>
                          <option value={30} className="bg-[#161b22] text-white">🗓️ 30 Días</option>
                          <option value={60} className="bg-[#161b22] text-white">🗓️ 60 Días</option>
                          <option value={90} className="bg-[#161b22] text-white">🗓️ 90 Días</option>
                          <option value={365} className="bg-[#161b22] text-white">🏆 365 Días</option>
                          <option value={0} className="bg-[#161b22] text-white">♾️ Vitalicio</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'SET')}
                          className="px-2.5 py-1 rounded-md bg-[#00ff66] hover:bg-[#00ff66]/90 text-black text-[11px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{u.status === 'pending' ? 'Aprobar' : 'Fijar'}</span>
                        </button>
                        {u.status !== 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleRenewUser(u.id, u.username, userRenewDays[u.id] ?? 30, 'ADD')}
                            className="px-2 py-1 rounded-md bg-[#161b22] hover:bg-[#30363d] text-white text-[11px] font-semibold transition cursor-pointer"
                          >
                            + Sumar
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRenewUser(u.id, u.username, 1, 'SET')}
                        className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer"
                      >
                        ⚡ 1d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRenewUser(u.id, u.username, 15, 'SET')}
                        className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-semibold transition cursor-pointer"
                      >
                        15d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRenewUser(u.id, u.username, 30, 'SET')}
                        className="px-2 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#30363d] text-white border border-[#30363d] text-[11px] font-semibold transition cursor-pointer"
                      >
                        30d
                      </button>

                      {u.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u.id, u.status, u.username)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                            isSuspended
                              ? 'bg-[#00ff66]/10 text-[#00ff66] hover:bg-[#00ff66]/20 border-[#00ff66]/30'
                              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                          }`}
                        >
                          {isSuspended ? 'Reactivar' : 'Suspender'}
                        </button>
                      )}

                      {confirmDeleteUserKey === (u.username || u.id) ? (
                        <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-0.5 animate-fadeIn">
                          <span className="text-[10px] font-bold text-rose-400 mr-1">
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
                            className="px-2 py-0.5 rounded bg-[#0b0e14] text-[#8b949e] hover:text-white border border-[#30363d] text-[10px] font-semibold transition cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUserKey(u.username || u.id)}
                          className="px-2 py-1 rounded-lg bg-[#0b0e14] hover:bg-rose-500/10 text-rose-400 border border-[#30363d] hover:border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
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
                        className="px-2.5 py-1 rounded-lg bg-[#00ff66]/10 hover:bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/30 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <MessageCircle className="w-3 h-3 text-[#00ff66]" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}

          {/* Barra de Paginación */}
          {filteredUsersList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-[#30363d] text-xs">
              <div className="flex items-center gap-2 text-[#8b949e] flex-wrap">
                <span>Mostrando</span>
                <span className="font-bold text-white">
                  {(safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize, filteredUsersList.length)}
                </span>
                <span>de</span>
                <span className="font-bold text-white">{filteredUsersList.length}</span>
                <span>usuarios</span>

                <span className="mx-1 text-[#30363d]">|</span>
                <span className="text-[#8b949e]">Por pág:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#0b0e14] border border-[#30363d] rounded-md px-1.5 py-0.5 text-xs text-white font-medium focus:outline-none focus:border-[#d9b114]"
                >
                  <option value={10} className="bg-[#161b22] text-white">10</option>
                  <option value={25} className="bg-[#161b22] text-white">25</option>
                  <option value={50} className="bg-[#161b22] text-white">50</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#30363d] bg-[#0b0e14] text-white hover:bg-[#161b22] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-2.5 py-1 text-xs font-semibold text-[#8b949e]">
                  Pág. <span className="text-white font-bold">{safeCurrentPage}</span> de {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#30363d] bg-[#0b0e14] text-white hover:bg-[#161b22] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Página Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
