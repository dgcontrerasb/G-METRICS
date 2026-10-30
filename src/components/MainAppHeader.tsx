import React, { useRef, useState, useEffect } from 'react';
import { ActiveSport } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { GuideModalTab } from './DidacticGuideModal';
import { LicenseValidationResult } from '../services/licenseService';
import { getColombiaDateString } from '../services/apiService';
import {
  ShieldCheck,
  BookOpen,
  RefreshCw,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Sliders,
  Power,
  Menu,
  Search,
  Download
} from 'lucide-react';

export interface MainAppHeaderProps {
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
    localStorage.getItem('sportstats_admin_remember') === 'true' ||
    Boolean(activeLicenseInfo?.clientName && activeLicenseInfo.clientName.toLowerCase().includes('propietario'));

  const fiveDays = React.useMemo(() => {
    return [0, 1, 2, 3, 4].map((offset) => {
      const dStr = getColombiaDateString(offset);
      return { offset, dateStr: dStr, label: getShortDayLabel(offset, dStr) };
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs transition-colors duration-200">
      {/* Fila 1: Cabecera Principal Compacta */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Zone: Mobile Menu Trigger + Brand */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenMobileDrawer && (
            <button
              type="button"
              onClick={onOpenMobileDrawer}
              className="lg:hidden h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/90 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Abrir menú de navegación y ligas"
              title="Abrir menú de ligas y deportes"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div
            className="flex items-center select-none"
            title="G METRICS · La Ciencia Detrás de la Victoria"
          >
            <img
              src="/logo.png"
              alt="G METRICS · La Ciencia Detrás de la Victoria"
              className="h-8 sm:h-9 w-auto max-w-[170px] sm:max-w-[220px] object-contain drop-shadow-xs"
              onError={(e) => {
                e.currentTarget.src = '/icon.png';
              }}
            />
          </div>
        </div>

        {/* Center Zone: Espaciador o Botón de Admin (Solo visible cuando la sesión es Administrador) */}
        <div className="flex-1 flex items-center justify-center">
          {isAdminVisible && (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
              title="Abrir Panel de Administración"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-mono text-xs font-bold tracking-tight">Admin</span>
            </button>
          )}
        </div>

        {/* Right Zone: Sincronizar + Fondo + Exportar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Refresh / Connection status button */}
          <button
            type="button"
            onClick={onRefreshMatches}
            disabled={isLoading || refreshCooldown > 0}
            className="h-8 px-2.5 sm:px-3 rounded-lg bg-slate-100 hover:bg-slate-200/80 disabled:opacity-50 text-slate-800 border border-slate-200/90 text-xs font-mono tabular-nums font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={
              refreshCooldown > 0
                ? `Sincronizado hace poco. Espera ${refreshCooldown}s`
                : 'Sincronizar marcadores y cuotas'
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                activeSport === 'NBA' ? 'text-amber-600' : 'text-emerald-600'
              } ${isLoading ? 'animate-spin' : ''}`}
            />
            <span className="hidden md:inline">
              {refreshCooldown > 0 ? `${refreshCooldown}s` : 'Sincronizar'}
            </span>
          </button>

          {/* Wallpaper / Appearance Quick Button */}
          <button
            type="button"
            onClick={onOpenWallpaperModal}
            className="hidden sm:flex h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 text-xs font-medium items-center gap-1.5 transition-colors cursor-pointer"
            title="Personalizar fondo de pantalla y opacidad"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden xl:inline">Fondo</span>
          </button>

          {/* Export Dropdown (Excel / PDF) */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
              disabled={currentTotalVisible === 0}
              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Exportar pronósticos en Excel o PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {hasSelection ? `Exportar (${selectedCount})` : 'Exportar'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDownloadMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-slate-800">
                <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    {hasSelection ? `${selectedCount} seleccionados` : `Todos (${currentTotalVisible})`}
                  </span>
                  {hasSelection && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSelection();
                        setIsDownloadMenuOpen(false);
                      }}
                      className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Descargar Excel (.csv)</div>
                    <div className="text-[10px] text-slate-500">Tabla completa de probabilidades</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDownloadPDF(hasSelection);
                    setIsDownloadMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Descargar Informe PDF</div>
                    <div className="text-[10px] text-slate-500">Resumen ejecutivo listo para compartir</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSavedSlips();
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mis Boletos Guardados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenGuideModal('GUIDE');
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Guía y Glosario A-Z</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogoutSession();
                      setIsDownloadMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-medium cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
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
      <div className="border-t border-slate-100 bg-slate-50/90 px-3 sm:px-6 py-1.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {onSearchChange && (
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  activeSport === 'NBA'
                    ? 'Buscar equipo o jugador NBA (ej. Lakers, Curry)...'
                    : 'Buscar equipo o competición (ej. Real Madrid, Premier)...'
                }
                style={{ color: '#0f172a' }}
                className="w-full h-8 bg-white border border-slate-200/90 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-8 pr-7 text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 text-xs p-0.5 cursor-pointer"
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
              style={{ color: '#0f172a' }}
              className="h-8 bg-white hover:bg-slate-50 border border-slate-200/90 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-lg px-2.5 text-xs font-mono tabular-nums font-semibold text-slate-800 focus:outline-none cursor-pointer shrink-0 transition-colors"
              title="Consultar programación (hasta 5 días)"
            >
              {fiveDays.map((d) => (
                <option key={d.dateStr} value={d.dateStr} className="bg-white text-slate-900">
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
