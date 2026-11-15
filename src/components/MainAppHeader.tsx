import React, { useRef, useState, useEffect } from 'react';
import { ActiveSport } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { GuideModalTab } from './DidacticGuideModal';
import { LicenseValidationResult } from '../services/licenseService';
import { getColombiaDateString } from '../services/apiService';
import { SportStatsLogo } from './SportStatsLogo';
import {
  ShieldCheck,
  BookOpen,
  RefreshCw,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Power,
  Search,
  Download,
  Clock,
  Crown
} from 'lucide-react';

export interface MainAppHeaderProps {
  freeAccessMode?: boolean;
  activeSport: ActiveSport;
  onSelectSport: (sport: ActiveSport) => void;
  viewMode: 'SIMPLE' | 'EXPERT';
  onToggleViewMode: (mode: 'SIMPLE' | 'EXPERT') => void;
  paletteTextAccentClass: string;
  activeLicenseInfo: LicenseValidationResult | null;
  onSecretAdminLogoClick: () => void;
  onOpenAdminModal: () => void;
  onOpenGuideModal: (tab?: GuideModalTab) => void;
  onRefreshMatches: () => void;
  isLoading: boolean;
  refreshCooldown: number;
  currentTotalVisible: number;
  selectedCount: number;
  onClearSelection: () => void;
  onDownloadExcel: (onlySelected: boolean) => void;
  onDownloadPDF: (onlySelected: boolean) => void;
  onOpenSavedSlips: () => void;
  onOpenWallpaperModal: () => void;
  onOpenDefaultSimulator: () => void;
  onLogoutSession: () => void;
  mainTab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE';
  onSelectMainTab: (tab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE') => void;
  topPicksCount: number;
  allLeaguesCount: number;
  liveMatchesCount: number;
  // Fintech Clean Deck new props
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  currentDate?: string;
  onDateChange?: (dateStr: string) => void;
  onOpenMobileDrawer?: () => void;
}

function getShortDayLabel(offset: number, dateStr: string): string {
  if (offset === 0) return 'Hoy';
  if (offset === 1) return 'Mañana';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[dt.getDay()]} ${String(d).padStart(2, '0')}`;
  } catch {
    return dateStr.slice(5);
  }
}

export const MainAppHeader: React.FC<MainAppHeaderProps> = ({
  freeAccessMode = true,
  activeSport,
  activeLicenseInfo,
  onSecretAdminLogoClick,
  onOpenAdminModal,
  onOpenGuideModal,
  onRefreshMatches,
  isLoading,
  refreshCooldown,
  currentTotalVisible,
  selectedCount,
  onClearSelection,
  onDownloadExcel,
  onDownloadPDF,
  onOpenSavedSlips,
  onOpenWallpaperModal,
  onOpenDefaultSimulator,
  onLogoutSession,
  searchQuery = '',
  onSearchChange,
  currentDate,
  onDateChange,
  onOpenMobileDrawer
}) => {
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedCount > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
        setIsDownloadMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdminVisible =
    Boolean(activeLicenseInfo?.clientName && activeLicenseInfo.clientName.toLowerCase().includes('propietario')) ||
    (localStorage.getItem('sportstats_admin_remember') === 'true' &&
      JSON.parse(localStorage.getItem('sportstats_auth_user') || '{}')?.role === 'admin');

  const userPlanData = React.useMemo(() => {
    // 1. Verificar si es administrador propietario
    let storedUser: any = null;
    try {
      const raw = localStorage.getItem('sportstats_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      // ignore
    }

    const isActualAdmin =
      Boolean(storedUser?.role === 'admin') ||
      (localStorage.getItem('sportstats_admin_remember') === 'true') ||
      Boolean(
        activeLicenseInfo?.clientName &&
        (activeLicenseInfo.clientName.toLowerCase().includes('propietario') ||
         activeLicenseInfo.clientName.toLowerCase().includes('admin'))
      );

    if (isActualAdmin) {
      return { daysRemaining: null, isPermanent: true, isExpired: false, label: 'VIP Vitalicio' };
    }

    // 1b. Acceso Libre Promocional para la comunidad
    const isFreePromoUser = Boolean(
      storedUser?.planType === 'FREE_PROMO' ||
      storedUser?.planLabel === 'Acceso Libre Promocional' ||
      activeLicenseInfo?.planLabel === 'Acceso Libre Promocional'
    );
    if (isFreePromoUser) {
      return {
        daysRemaining: null,
        isPermanent: true,
        isExpired: false,
        isFreePromo: true,
        label: 'Acceso Libre Promocional'
      };
    }

    // 2. Calcular días restantes desde expiryTimestamp o activeLicenseInfo
    let expiryTimestamp: number | null = null;
    if (activeLicenseInfo?.expiryTimestamp) {
      expiryTimestamp = Number(activeLicenseInfo.expiryTimestamp);
    } else if (storedUser?.expiresAt) {
      expiryTimestamp = Number(storedUser.expiresAt);
    }

    if (expiryTimestamp) {
      const nowMs = Date.now();
      const diff = expiryTimestamp - nowMs;
      const days = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
      return {
        daysRemaining: days,
        isPermanent: false,
        isExpired: days <= 0,
        label: activeLicenseInfo?.planLabel || storedUser?.planLabel || `Pase VIP (${days}d)`
      };
    }

    // 3. Si activeLicenseInfo tiene daysRemaining numérico explícito
    if (activeLicenseInfo && activeLicenseInfo.daysRemaining !== null && activeLicenseInfo.daysRemaining !== undefined) {
      return {
        daysRemaining: activeLicenseInfo.daysRemaining,
        isPermanent: false,
        isExpired: Boolean(activeLicenseInfo.isExpired),
        label: activeLicenseInfo.planLabel || 'Plan VIP'
      };
    }

    // 4. Si tiene usuario activo pero sin expiry registrado, calcular por defecto de prueba
    if (storedUser) {
      return {
        daysRemaining: 3,
        isPermanent: false,
        isExpired: false,
        label: 'Prueba Gratuita (3 Días)'
      };
    }

    return null;
  }, [activeLicenseInfo]);

  const fiveDays = React.useMemo(() => {
    return [0, 1, 2, 3, 4].map((offset) => {
      const dStr = getColombiaDateString(offset);
      return { offset, dateStr: dStr, label: getShortDayLabel(offset, dStr) };
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full cyber-glass-nav transition-colors duration-200">
      {/* Fila 1: Cabecera Principal Compacta */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Zone: Isotipo compacto solo en móvil (en PC el lockup canónico vive en el Sidebar) */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="lg:hidden flex items-center gap-2 select-none"
            title="G METRICS"
          >
            <SportStatsLogo size="xs" activeSport={activeSport} withGlow={false} />
            <span className="gmetrics-brand-title text-[12px] leading-none whitespace-nowrap">
              G METRICS
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#8b949e] select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114]" />
            <span>
              Terminal Cuantitativo · <strong className="text-white">{activeSport === 'NBA' ? 'NBA' : 'Fútbol'}</strong>
            </span>
          </div>
        </div>

        {/* Center Zone: Botón Admin unificado con el sistema de chips */}
        <div className="flex-1 flex items-center justify-center">
          {isAdminVisible && (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="cyber-chrome-chip cyber-chrome-chip-gold active:scale-95"
              title="Abrir Panel de Administración"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
              <span className="font-mono text-xs font-bold tracking-tight">Admin</span>
            </button>
          )}
        </div>

        {/* Right Zone: Membresía + Sincronizar + Fondo + Exportar (Lenguaje unificado .cyber-chrome-chip) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Indicador de Tiempo de Membresía / Prueba VIP (Oculto mientras el cobro esté suspendido) */}
          {!freeAccessMode && userPlanData && (
            userPlanData.isPermanent ? (
              <div
                className="cyber-chrome-chip cyber-chrome-chip-gold cursor-default select-none"
                title="Acceso Propietario / Vitalicio Activo"
              >
                <Crown className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline font-mono tabular-nums font-bold">Vitalicio</span>
                <span className="sm:hidden font-mono tabular-nums text-[11px] font-bold">VIP</span>
              </div>
            ) : userPlanData.isExpired || userPlanData.daysRemaining === 0 ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-vip-payment-modal'))}
                className="cyber-chrome-chip cyber-chrome-chip-gold"
                title="Tu acceso VIP ha finalizado. Clic para reactivar tu pase"
              >
                <Clock className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="font-mono tabular-nums font-bold text-white text-xs">0d</span>
                <span className="hidden sm:inline font-sans text-[11px] font-semibold">Renovar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-vip-payment-modal'))}
                className="cyber-chrome-chip cyber-chrome-chip-gold"
                title={`Te quedan ${userPlanData.daysRemaining ?? 0} ${(userPlanData.daysRemaining ?? 0) === 1 ? 'día' : 'días'} de acceso VIP. Clic para recargar o ver opciones`}
              >
                <Clock className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="font-mono tabular-nums font-bold text-white text-xs">
                  {userPlanData.daysRemaining ?? 0}d
                </span>
                <span className="hidden sm:inline font-sans text-[11px] font-semibold">VIP</span>
              </button>
            )
          )}

          {/* Refresh / Connection status button */}
          <button
            type="button"
            onClick={onRefreshMatches}
            disabled={isLoading || refreshCooldown > 0}
            className="cyber-chrome-chip disabled:opacity-50 font-mono tabular-nums"
            title={
              refreshCooldown > 0
                ? `Sincronizado hace poco. Espera ${refreshCooldown}s`
                : 'Sincronizar marcadores y cuotas'
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#d9b114] ${isLoading ? 'animate-spin' : ''}`}
              strokeWidth={2}
            />
            <span className="hidden md:inline font-sans">
              {refreshCooldown > 0 ? `${refreshCooldown}s` : 'Sincronizar'}
            </span>
          </button>

          {/* Wallpaper / Appearance Quick Button */}
          <button
            type="button"
            onClick={onOpenWallpaperModal}
            className="hidden sm:inline-flex cyber-chrome-chip"
            title="Personalizar fondo de pantalla y opacidad"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#8b949e]" strokeWidth={2} />
            <span className="hidden xl:inline">Fondo</span>
          </button>

          {/* Export Dropdown (Excel / PDF) */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
              disabled={currentTotalVisible === 0}
              className="cyber-chrome-chip disabled:opacity-40"
              title="Exportar pronósticos y estadísticas a Excel o PDF"
            >
              <Download className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
              <span className="hidden md:inline font-mono tabular-nums">
                {hasSelection ? `Exportar (${selectedCount})` : 'Exportar'}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-[#6e7681] transition-transform ${
                  isDownloadMenuOpen ? 'rotate-180' : ''
                }`}
                strokeWidth={2}
              />
            </button>

            {isDownloadMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl cyber-glass-dropdown py-2 z-50 text-white shadow-2xl">
                <div className="px-3.5 py-1.5 border-b border-[#30363d] flex items-center justify-between">
                  <span className="text-[11px] font-mono tabular-nums font-bold text-[#8b949e]">
                    {hasSelection ? `${selectedCount} seleccionados` : `Todos (${currentTotalVisible})`}
                  </span>
                  {hasSelection && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSelection();
                        setIsDownloadMenuOpen(false);
                      }}
                      className="text-[11px] text-[#d9b114] hover:underline font-medium cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onDownloadExcel(hasSelection);
                    setIsDownloadMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#1c2129] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#d9b114] shrink-0" strokeWidth={2} />
                  <div>
                    <div className="font-semibold text-white">Descargar Excel (.csv)</div>
                    <div className="text-[10px] text-[#8b949e]">Tabla completa de probabilidades</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDownloadPDF(hasSelection);
                    setIsDownloadMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#1c2129] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#8b949e] shrink-0" strokeWidth={2} />
                  <div>
                    <div className="font-semibold text-white">Descargar Informe PDF</div>
                    <div className="text-[10px] text-[#8b949e]">Resumen ejecutivo listo para compartir</div>
                  </div>
                </button>

                <div className="border-t border-[#30363d] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSavedSlips();
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-[#1c2129] flex items-center gap-2.5 text-[#8b949e] hover:text-white cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                    <span>Mis Boletos Guardados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenGuideModal('GUIDE');
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-[#1c2129] flex items-center gap-2.5 text-[#8b949e] hover:text-white cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                    <span>Guía y Glosario A-Z</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogoutSession();
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-[#1c2129] flex items-center gap-2.5 text-[#8b949e] hover:text-white font-medium cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <PWAInstallButton />
        </div>
      </div>

      {/* Fila 2: Sub-barra Compacta de Búsqueda y Selector de Días */}
      <div className="border-t border-[#21262d] bg-[#0b0e14]/90 px-3 sm:px-6 py-1.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {onSearchChange && (
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7681] pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  activeSport === 'NBA'
                    ? 'Buscar equipo o jugador NBA (ej. Lakers, Curry)...'
                    : 'Buscar equipo o competición (ej. Real Madrid, Premier)...'
                }
                className="w-full h-8 bg-[#161b22] border border-[#30363d] focus:border-[#d9b114] rounded-xl pl-8 pr-7 text-xs font-sans text-white placeholder-[#6e7681] focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white text-xs p-0.5 cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {currentDate && onDateChange && (
            <select
              value={currentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] focus:border-[#d9b114] rounded-xl px-3 text-xs font-mono tabular-nums font-bold text-white focus:outline-none cursor-pointer shrink-0 transition-colors"
              title="Consultar programación (hasta 5 días)"
            >
              {fiveDays.map((d) => (
                <option key={d.dateStr} value={d.dateStr} className="bg-[#161b22] text-white">
                  {d.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
};
