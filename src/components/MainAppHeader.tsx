import React, { useRef, useState, useEffect } from 'react';
import { ActiveSport } from '../types';
import { SportStatsLogo } from './SportStatsLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { GuideModalTab } from './DidacticGuideModal';
import { LicenseValidationResult } from '../services/licenseService';
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
  MoreHorizontal,
  Sparkles,
  Flame,
  Trophy
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
}

export const MainAppHeader: React.FC<MainAppHeaderProps> = ({
  activeSport,
  onSelectSport,
  viewMode,
  onToggleViewMode,
  paletteTextAccentClass,
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
  mainTab,
  onSelectMainTab,
  topPicksCount,
  allLeaguesCount,
  liveMatchesCount
}) => {
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const mobileDownloadMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedCount > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inDesktopDownload = downloadMenuRef.current && downloadMenuRef.current.contains(target);
      const inMobileDownload = mobileDownloadMenuRef.current && mobileDownloadMenuRef.current.contains(target);
      if (!inDesktopDownload && !inMobileDownload) {
        setIsDownloadMenuOpen(false);
      }
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(target)) {
        setIsMobileMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdminVisible =
    localStorage.getItem('sportstats_admin_remember') === 'true' ||
    Boolean(activeLicenseInfo?.clientName && activeLicenseInfo.clientName.toLowerCase().includes('propietario'));

  return (
    <>
      {/* 1. Header: Editorial Deportivo & Menú de Descarga (Glassmorphic) */}
      <header className="border-b border-slate-800/40 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40 shadow-2xl w-full transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Brand & Subtitle + Sport Switcher */}
          <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <div
                onClick={onSecretAdminLogoClick}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none active:scale-98 transition-transform"
                title="SportStats Pro"
              >
                <SportStatsLogo size="sm" activeSport={activeSport} withGlow={true} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="text-sm sm:text-lg font-black tracking-tight text-white uppercase truncate">
                      SportStats <span className={paletteTextAccentClass}>Pro</span>
                      {activeSport === 'NBA' && (
                        <span className="ml-1.5 text-xs font-mono font-bold text-amber-400">· Baloncesto</span>
                      )}
                    </h1>
                  </div>
                  <p className="hidden md:block text-[11px] text-slate-400 font-sans truncate">
                    {activeSport === 'NBA'
                      ? 'Baloncesto en Vivo: NBA, NCAA y WNBA con Modelos Adaptativos & Props'
                      : 'Pronósticos & Estadísticas de Partidos por Jugar'}
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de Deporte: Fútbol vs Baloncesto */}
            <div className="flex items-center p-1 rounded-full bg-slate-900/50 border border-slate-800/40 backdrop-blur-md shrink-0">
              <button
                onClick={() => onSelectSport('SOCCER')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer ${
                  activeSport === 'SOCCER'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>⚽</span>
                <span>Fútbol</span>
              </button>
              <button
                onClick={() => onSelectSport('NBA')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer ${
                  activeSport === 'NBA'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🏀</span>
                <span>Baloncesto</span>
                <span className="hidden xs:inline px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-mono tracking-tight font-bold uppercase">
                  En Vivo
                </span>
              </button>
            </div>

            {/* Selector de Modo: Fácil (Principiante) vs Pro (Analista) */}
            <div className="flex items-center p-1 rounded-full bg-slate-900/50 border border-slate-800/40 backdrop-blur-md shrink-0">
              <button
                onClick={() => onToggleViewMode('SIMPLE')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === 'SIMPLE'
                    ? 'bg-slate-800/80 text-white border border-slate-700/50 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="Modo Fácil: Para principiantes. Semáforos, explicaciones claras y dinero real sin jerga técnica"
              >
                <span>🌱</span>
                <span>Fácil</span>
              </button>
              <button
                onClick={() => onToggleViewMode('EXPERT')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === 'EXPERT'
                    ? 'bg-slate-800/80 text-white border border-slate-700/50 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="Modo Pro: Para analistas y apostadores avanzados. Matrices, xG, Dixon-Coles y +EV"
              >
                <span>⚡</span>
                <span>Pro</span>
              </button>
            </div>
          </div>

          {/* 1. Desktop & Tablet Bar */}
          <div className="hidden sm:flex items-center justify-end gap-2 shrink-0">
            {isAdminVisible && (
              <button
                onClick={onOpenAdminModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer shadow-sm"
                title="Abrir Panel de Administración"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Panel Admin</span>
              </button>
            )}

            <button
              onClick={() => onOpenGuideModal('GUIDE')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/40 hover:bg-white/5 text-amber-300 border border-slate-800/40 text-xs font-mono tracking-tight font-semibold transition-all duration-200 cursor-pointer shadow-sm backdrop-blur-sm"
              title="Guía rápida, calculadora de cuotas y glosario técnico A-Z"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Guía y Glosario</span>
            </button>

            <PWAInstallButton />

            <button
              onClick={onRefreshMatches}
              disabled={isLoading || refreshCooldown > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/40 hover:bg-white/5 text-xs font-mono tracking-tight font-medium text-white transition-all duration-200 border border-slate-800/40 cursor-pointer shadow-sm disabled:opacity-50 backdrop-blur-sm"
              title={
                refreshCooldown > 0
                  ? `Actualización reciente: espera ${refreshCooldown}s para refrescar de nuevo`
                  : 'Actualizar partidos y pronósticos en vivo'
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  activeSport === 'NBA' ? 'text-amber-400' : 'text-emerald-400'
                } ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>{refreshCooldown > 0 ? `Espera (${refreshCooldown}s)` : 'Actualizar'}</span>
            </button>

            {/* Menú Desplegable de Descarga */}
            <div className="relative" ref={downloadMenuRef}>
              <button
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                disabled={currentTotalVisible === 0}
                className={`justify-center flex items-center gap-1.5 px-3.5 py-1.5 rounded-full disabled:opacity-40 text-xs font-mono tracking-tight font-semibold text-white transition-all duration-200 shadow-sm cursor-pointer ${
                  activeSport === 'NBA'
                    ? 'bg-amber-600/90 hover:bg-amber-500 border border-amber-500/40'
                    : 'bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-500/40'
                }`}
                title="Descargar pronósticos en Excel o PDF"
              >
                <span>Descargar</span>
                {hasSelection && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tracking-tight font-bold ${
                      activeSport === 'NBA' ? 'bg-white text-amber-900' : 'bg-white text-emerald-800'
                    }`}
                  >
                    {selectedCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDownloadMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-slate-950/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/40">
                    <span className="text-xs font-semibold text-white block">
                      {hasSelection
                        ? `Descargar ${selectedCount} partidos seleccionados`
                        : `Descargar los ${currentTotalVisible} partidos mostrados`}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-mono tracking-tight">
                      Horarios ajustados a Hora Colombiana (COT)
                    </span>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        onDownloadExcel(hasSelection);
                        setIsDownloadMenuOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <div
                        className={`p-2 rounded-lg transition-colors shrink-0 ${
                          activeSport === 'NBA'
                            ? 'bg-amber-500/15 text-amber-400 group-hover:bg-amber-500 group-hover:text-black'
                            : 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black'
                        }`}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">Descargar en Excel (.csv)</span>
                        <span className="text-[11px] text-slate-400 block">
                          Hoja compatible con Microsoft Excel y Google Sheets
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onDownloadPDF(hasSelection);
                        setIsDownloadMenuOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">Descargar en PDF (.pdf)</span>
                        <span className="text-[11px] text-slate-400 block">
                          Informe en formato horizontal listo para compartir
                        </span>
                      </div>
                    </button>
                  </div>

                  {hasSelection && (
                    <div className="p-2 bg-slate-900/60 border-t border-slate-800/40 text-center">
                      <button
                        onClick={onClearSelection}
                        className="text-[11px] text-slate-400 hover:text-white font-mono tracking-tight font-medium cursor-pointer"
                      >
                        Limpiar selección ({selectedCount})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onOpenSavedSlips}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/40 hover:bg-white/5 text-xs font-mono tracking-tight font-medium text-emerald-400 transition-all duration-200 border border-emerald-500/30 cursor-pointer shadow-sm backdrop-blur-sm"
              title="Ver historial de boletos guardados"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Historial</span>
            </button>

            <button
              onClick={onOpenWallpaperModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/40 hover:bg-white/5 text-xs font-mono tracking-tight font-medium text-white transition-all duration-200 border border-slate-800/40 cursor-pointer shadow-sm backdrop-blur-sm"
              title="Escoger fondo temático"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fondo</span>
            </button>

            {activeSport === 'SOCCER' && (
              <button
                onClick={onOpenDefaultSimulator}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/40 hover:bg-white/5 text-xs font-mono tracking-tight font-medium text-white transition-all duration-200 border border-slate-800/40 cursor-pointer shadow-sm backdrop-blur-sm"
                title="Simulador de partidos personalizados"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulador</span>
              </button>
            )}

            <button
              onClick={onLogoutSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white text-xs font-mono tracking-tight font-semibold transition-all duration-200 border border-rose-500/30 cursor-pointer shadow-sm"
              title="Cerrar sesión y bloquear acceso"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span>Salir</span>
            </button>
          </div>

          {/* 2. Mobile Clean Action Bar */}
          <div className="flex sm:hidden items-center justify-between gap-2 w-full pt-1">
            <div className="relative flex-1" ref={mobileDownloadMenuRef}>
              <button
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                disabled={currentTotalVisible === 0}
                className={`w-full justify-center flex items-center gap-1.5 px-3 py-2 rounded-xl disabled:opacity-40 text-xs font-bold text-white transition-all shadow-md cursor-pointer ${
                  activeSport === 'NBA' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <span>Descargar</span>
                {hasSelection && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-emerald-800">
                    {selectedCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDownloadMenuOpen && (
                <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-[#101827]/98 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 bg-slate-950/50 border-b border-white/10">
                    <span className="text-xs font-bold text-white block">
                      {hasSelection
                        ? `Descargar (${selectedCount} seleccionados)`
                        : `Descargar (${currentTotalVisible} partidos)`}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        onDownloadExcel(hasSelection);
                        setIsDownloadMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 text-left transition text-xs font-bold text-slate-100"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel (.csv)</span>
                    </button>
                    <button
                      onClick={() => {
                        onDownloadPDF(hasSelection);
                        setIsDownloadMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 text-left transition text-xs font-bold text-slate-100"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Descargar PDF (.pdf)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onRefreshMatches}
              disabled={isLoading || refreshCooldown > 0}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/15 flex items-center justify-center cursor-pointer shadow-sm shrink-0"
              title="Actualizar partidos"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  activeSport === 'NBA' ? 'text-amber-400' : 'text-emerald-400'
                } ${isLoading ? 'animate-spin' : ''}`}
              />
              {refreshCooldown > 0 && (
                <span className="text-[10px] text-amber-400 font-mono ml-1 font-bold">{refreshCooldown}s</span>
              )}
            </button>

            <div className="relative shrink-0" ref={mobileMoreRef}>
              <button
                onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer shadow-sm ${
                  isMobileMoreOpen
                    ? 'bg-slate-800 text-white border-emerald-400/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/15'
                }`}
                title="Más Opciones"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span>Opciones</span>
              </button>

              {isMobileMoreOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#101827]/98 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 p-2 space-y-1">
                  {activeSport === 'SOCCER' && (
                    <button
                      onClick={() => {
                        onOpenDefaultSimulator();
                        setIsMobileMoreOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white text-xs font-bold transition text-left cursor-pointer"
                    >
                      <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Simulador de Partidos</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onOpenSavedSlips();
                      setIsMobileMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white text-xs font-bold transition text-left cursor-pointer"
                  >
                    <History className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Historial de Boletos</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenWallpaperModal();
                      setIsMobileMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white text-xs font-bold transition text-left cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Cambiar Fondo</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenGuideModal('GUIDE');
                      setIsMobileMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white text-xs font-bold transition text-left cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>¿Cómo funciona? (Guía)</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenGuideModal('GLOSSARY');
                      setIsMobileMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-cyan-300 hover:text-white text-xs font-bold transition text-left cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Glosario Técnico (A-Z)</span>
                  </button>
                  <div className="border-t border-white/10 my-1 pt-1">
                    <button
                      onClick={onLogoutSession}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-bold transition text-left cursor-pointer"
                    >
                      <Power className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Primary Navigation Tabs (🔥 Top Picks | 🌐 Cartelera | 🔴 En Vivo) */}
      <section className="bg-slate-950/40 backdrop-blur-md border-b border-slate-800/40 px-3 sm:px-6 pt-3 pb-2.5 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between p-1 rounded-2xl bg-slate-900/60 border border-slate-800/70 backdrop-blur-md shadow-lg">
            <button
              onClick={() => onSelectMainTab('TOP_PICKS')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mainTab === 'TOP_PICKS'
                  ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Flame className="w-4 h-4 text-emerald-400" />
              <span>Top Picks</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                {topPicksCount}
              </span>
            </button>

            <button
              onClick={() => onSelectMainTab('ALL_LEAGUES')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mainTab === 'ALL_LEAGUES'
                  ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span>Cartelera</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {allLeaguesCount}
              </span>
            </button>

            <button
              onClick={() => onSelectMainTab('LIVE')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mainTab === 'LIVE'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`${
                    liveMatchesCount > 0 ? 'animate-ping' : ''
                  } absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75`}
                ></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>En Vivo</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                {liveMatchesCount}
              </span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
