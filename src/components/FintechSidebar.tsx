import React from 'react';
import { ActiveSport, MatchFixture, NBAMatchFixture } from '../types';
import {
  CompetitionGroup,
  STATIC_SOCCER_CATALOG,
  STATIC_BASKETBALL_CATALOG,
  formatCompactTeamName
} from '../services/leagueCategorizer';
import { getColombiaDateString } from '../services/apiService';
import { SoccerFilterType } from './SoccerFilterBar';
import { NBAFilterType } from './NBAFilterBar';
import { CountryFlag } from './CountryFlag';
import { SportStatsLogo } from './SportStatsLogo';
import { GuideModalTab } from './DidacticGuideModal';
import {
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Flame,
  Globe,
  Calendar,
  Filter,
  History,
  Image as ImageIcon,
  BookOpen,
  ShieldCheck,
  Power,
  Trophy,
  Star,
  ChevronDown
} from 'lucide-react';

export interface FintechSidebarProps {
  isDesktopCollapsed: boolean;
  onToggleDesktopCollapse: () => void;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  activeSport: ActiveSport;
  onSelectSport: (sport: ActiveSport) => void;
  mainTab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE';
  onSelectMainTab: (tab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE') => void;
  liveMatchesCount: number;
  topPicksCount: number;
  allLeaguesCount: number;
  currentDate: string;
  onDateChange: (dateStr: string) => void;
  // Soccer specific
  selectedLeague: string;
  onLeagueChange: (leagueKey: string) => void;
  primeFixturesCount: number;
  totalFixturesCount: number;
  availableCompetitionGroups: CompetitionGroup[];
  selectedFilter: SoccerFilterType;
  onFilterChange: (filter: SoccerFilterType) => void;
  // NBA specific
  selectedNBAConference: string;
  onNBAConferenceChange: (conf: string) => void;
  totalNBAFixturesCount: number;
  nbaEsteCount: number;
  nbaOesteCount: number;
  availableBasketballLeagues: Array<{ key: string; name: string; count: number; icon: string }>;
  selectedNBAFilter: NBAFilterType;
  onNBAFilterChange: (filter: NBAFilterType) => void;
  nbaFixtures?: NBAMatchFixture[];
  onOpenSoccerMatchFromMenu?: (fixture: MatchFixture) => void;
  onOpenNBAMatchFromMenu?: (fixture: NBAMatchFixture) => void;
  // Global actions
  viewMode: 'SIMPLE' | 'EXPERT';
  onToggleViewMode: (mode: 'SIMPLE' | 'EXPERT') => void;
  isAdminVisible: boolean;
  onSecretAdminLogoClick: () => void;
  onOpenAdminModal: () => void;
  onOpenSavedSlips: () => void;
  onOpenDefaultSimulator: () => void;
  onOpenWallpaperModal: () => void;
  onOpenGuideModal: (tab?: GuideModalTab) => void;
  onLogoutSession: () => void;
}

function formatDayChipLabel(offset: number, dateStr: string): { shortLabel: string; dayNum: string } {
  if (offset === 0) return { shortLabel: 'Hoy', dayNum: dateStr.slice(8, 10) };
  if (offset === 1) return { shortLabel: 'Mañ', dayNum: dateStr.slice(8, 10) };
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return {
      shortLabel: days[dt.getDay()] || `+${offset}d`,
      dayNum: String(d).padStart(2, '0')
    };
  } catch {
    return { shortLabel: `+${offset}d`, dayNum: dateStr.slice(8, 10) };
  }
}

export const FintechSidebar: React.FC<FintechSidebarProps> = ({
  isDesktopCollapsed,
  onToggleDesktopCollapse,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  activeSport,
  onSelectSport,
  mainTab,
  onSelectMainTab,
  liveMatchesCount,
  topPicksCount,
  allLeaguesCount,
  currentDate,
  onDateChange,
  selectedLeague,
  onLeagueChange,
  primeFixturesCount,
  totalFixturesCount,
  availableCompetitionGroups,
  selectedFilter,
  onFilterChange,
  selectedNBAConference,
  onNBAConferenceChange,
  totalNBAFixturesCount,
  nbaEsteCount,
  nbaOesteCount,
  availableBasketballLeagues,
  selectedNBAFilter,
  onNBAFilterChange,
  nbaFixtures = [],
  onOpenSoccerMatchFromMenu,
  onOpenNBAMatchFromMenu,
  isAdminVisible,
  onSecretAdminLogoClick,
  onOpenAdminModal,
  onOpenSavedSlips,
  onOpenWallpaperModal,
  onOpenGuideModal,
  onLogoutSession
}) => {
  const [expandedLeagueKey, setExpandedLeagueKey] = React.useState<string | null>(null);

  const fiveDayOptions = React.useMemo(() => {
    return [0, 1, 2, 3, 4].map((offset) => {
      const dateStr = getColombiaDateString(offset);
      const { shortLabel, dayNum } = formatDayChipLabel(offset, dateStr);
      return { offset, dateStr, shortLabel, dayNum };
    });
  }, []);

  // Normalize catalog keys (e.g. COUNTRY_COLOMBIA -> COLOMBIA, GROUP_INTL -> INTL) so they match CompetitionGroup.key
  const normalizeCatalogKey = React.useCallback((key: string) => {
    return key.replace(/^COUNTRY_/, '').replace(/^GROUP_/, '');
  }, []);

  // Map active dynamic competition groups by both raw key and prefixed key for instant lookup
  const dynamicGroupMap = React.useMemo(() => {
    const map = new Map<string, CompetitionGroup>();
    for (const g of availableCompetitionGroups) {
      map.set(g.key, g);
      map.set(`COUNTRY_${g.key}`, g);
      map.set(`GROUP_${g.key}`, g);
    }
    return map;
  }, [availableCompetitionGroups]);

  // Extra dynamic soccer groups not in the static catalog (preventing any duplicate entries)
  const extraDynamicSoccerGroups = React.useMemo(() => {
    const staticNormalizedKeys = new Set(
      STATIC_SOCCER_CATALOG.map((item) => normalizeCatalogKey(item.key))
    );
    return availableCompetitionGroups.filter((g) => !staticNormalizedKeys.has(normalizeCatalogKey(g.key)));
  }, [availableCompetitionGroups, normalizeCatalogKey]);

  const primarySoccerCatalog = React.useMemo(
    () => STATIC_SOCCER_CATALOG.filter((item) => item.tier === 'PRIMARY'),
    []
  );

  const secondarySoccerCatalog = React.useMemo(
    () => STATIC_SOCCER_CATALOG.filter((item) => item.tier === 'SECONDARY'),
    []
  );

  const handleSelectLeagueAndView = (leagueKey: string, matchCount = 0) => {
    onLeagueChange(leagueKey);
    if (mainTab !== 'ALL_LEAGUES') {
      onSelectMainTab('ALL_LEAGUES');
    }
    if (matchCount > 0) {
      setExpandedLeagueKey((prev) => (prev === leagueKey ? null : leagueKey));
    } else {
      setExpandedLeagueKey(null);
      onCloseMobileDrawer();
    }
  };

  const handleSelectNBALeagueAndView = (confKey: string, matchCount = 0) => {
    onNBAConferenceChange(confKey);
    if (mainTab !== 'ALL_LEAGUES') {
      onSelectMainTab('ALL_LEAGUES');
    }
    if (matchCount > 0) {
      setExpandedLeagueKey((prev) => (prev === confKey ? null : confKey));
    } else {
      setExpandedLeagueKey(null);
      onCloseMobileDrawer();
    }
  };

  const getNBAMatchesForCatalogKey = React.useCallback(
    (key: string): NBAMatchFixture[] => {
      if (!nbaFixtures || nbaFixtures.length === 0) return [];
      if (key === 'ALL') return nbaFixtures;
      if (key === 'Este' || key === 'Oeste') {
        return nbaFixtures.filter(
          (f) => f.homeTeam.conference === key || f.awayTeam.conference === key
        );
      }
      if (key === 'NBA') {
        return nbaFixtures.filter((f) => {
          const id = (f.league?.id || 'NBA').toUpperCase();
          return id === 'NBA' || !f.league?.id;
        });
      }
      return nbaFixtures.filter((f) => (f.league?.id || '').toUpperCase().includes(key.toUpperCase()));
    },
    [nbaFixtures]
  );

  const renderInlineSoccerMatches = (matches: MatchFixture[]) => {
    if (!matches || matches.length === 0) return null;
    return (
      <div className="mt-1 mb-1.5 ml-2 pl-2 border-l-2 border-emerald-300 space-y-1">
        {matches.map((f) => {
          const isLive = f.status === 'IN_PLAY';
          return (
            <button
              key={f.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenSoccerMatchFromMenu) {
                  onOpenSoccerMatchFromMenu(f);
                }
                onCloseMobileDrawer();
              }}
              className="w-full px-2 py-1.5 rounded-lg bg-white hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer group shadow-2xs"
              title="Haz clic para abrir probabilidades, goles, árbitro y alineaciones"
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {f.homeTeam.logo?.trim() ? (
                  <img
                    src={f.homeTeam.logo}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="text-[10.5px] font-medium text-slate-800 group-hover:text-emerald-800 truncate">
                  {formatCompactTeamName(f.homeTeam.name)}
                </span>
                <span className="text-[9px] font-mono text-slate-400 shrink-0">vs</span>
                {f.awayTeam.logo?.trim() ? (
                  <img
                    src={f.awayTeam.logo}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="text-[10.5px] font-medium text-slate-800 group-hover:text-emerald-800 truncate">
                  {formatCompactTeamName(f.awayTeam.name)}
                </span>
              </div>
              <span
                className={`font-mono text-[9.5px] px-1 py-0.2 rounded shrink-0 ${
                  isLive
                    ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isLive && f.currentScore
                  ? `${f.currentScore.home}-${f.currentScore.away}`
                  : f.time}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderInlineNBAMatches = (matches: NBAMatchFixture[]) => {
    if (!matches || matches.length === 0) return null;
    return (
      <div className="mt-1 mb-1.5 ml-2 pl-2 border-l-2 border-amber-400 space-y-1">
        {matches.map((f) => {
          const isLive = f.status === 'IN_PLAY';
          return (
            <button
              key={f.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenNBAMatchFromMenu) {
                  onOpenNBAMatchFromMenu(f);
                }
                onCloseMobileDrawer();
              }}
              className="w-full px-2 py-1.5 rounded-lg bg-white hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer group shadow-2xs"
              title="Haz clic para abrir probabilidades, cuartos, ritmo y quintetos"
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {f.homeTeam.logo?.trim() ? (
                  <img
                    src={f.homeTeam.logo}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="text-[10.5px] font-medium text-slate-800 group-hover:text-amber-900 truncate">
                  {f.homeTeam.shortName || f.homeTeam.name}
                </span>
                <span className="text-[9px] font-mono text-slate-400 shrink-0">vs</span>
                {f.awayTeam.logo?.trim() ? (
                  <img
                    src={f.awayTeam.logo}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="text-[10.5px] font-medium text-slate-800 group-hover:text-amber-900 truncate">
                  {f.awayTeam.shortName || f.awayTeam.name}
                </span>
              </div>
              <span
                className={`font-mono text-[9.5px] px-1 py-0.2 rounded shrink-0 ${
                  isLive
                    ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isLive && f.currentScore
                  ? `${f.currentScore.home}-${f.currentScore.away}`
                  : f.time}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderSidebarContent = (isCompactRail: boolean) => {
    if (isCompactRail) {
      return (
        <div className="flex flex-col items-center justify-between h-full py-2.5 px-1.5 select-none">
          <div className="flex flex-col items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={onToggleDesktopCollapse}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
              title="Desplegar menú lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Sport Switcher Compact */}
            <div className="flex flex-col gap-1 w-full items-center pt-1.5 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => onSelectSport('SOCCER')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer border ${
                  activeSport === 'SOCCER'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Fútbol"
              >
                ⚽
              </button>
              <button
                type="button"
                onClick={() => onSelectSport('NBA')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer border ${
                  activeSport === 'NBA'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Baloncesto NBA"
              >
                🏀
              </button>
            </div>

            {/* Priority Navigation Compact */}
            <div className="flex flex-col gap-1 w-full items-center pt-1.5 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => onSelectMainTab('LIVE')}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                  mainTab === 'LIVE'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                }`}
                title={`Partidos en Vivo (${liveMatchesCount})`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                </span>
                {liveMatchesCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-slate-900 text-white font-mono text-[9px] font-bold">
                    {liveMatchesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectMainTab('TOP_PICKS')}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                  mainTab === 'TOP_PICKS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title={`Joyas del Día (${topPicksCount})`}
              >
                <Flame className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onSelectMainTab('ALL_LEAGUES')}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                  mainTab === 'ALL_LEAGUES'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title={`Cartelera Completa (${allLeaguesCount})`}
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 border-t border-slate-200/80 pt-2">
            <button
              type="button"
              onClick={onOpenSavedSlips}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Mis Boletos Guardados"
            >
              <History className="w-4 h-4 text-emerald-600" />
            </button>
            <button
              type="button"
              onClick={onOpenWallpaperModal}
              className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Cambiar Fondo de Pantalla"
            >
              <ImageIcon className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full select-none text-slate-900">
        {/* 1. Encabezado Compacto: Marca + Switcher Fútbol / Baloncesto */}
        <div className="p-2.5 border-b border-slate-200/80 space-y-2 bg-slate-50/70">
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-1.5 min-w-0 select-none"
              title="G METRICS · La Ciencia Detrás de la Victoria"
            >
              <SportStatsLogo size="sm" activeSport={activeSport} withGlow={false} />
              <div className="min-w-0 flex flex-col justify-center">
                <span className="gmetrics-brand-title text-[12.5px] leading-none block whitespace-nowrap">
                  G METRICS
                </span>
                <span className="text-[6.2px] font-extrabold uppercase tracking-tight text-slate-600 block whitespace-nowrap leading-none mt-1">
                  LA CIENCIA DETRÁS DE LA VICTORIA ({activeSport === 'NBA' ? 'Baloncesto' : 'Fútbol'})
                </span>
              </div>
            </div>

            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={onToggleDesktopCollapse}
              className="hidden lg:flex w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 items-center justify-center transition-colors cursor-pointer"
              title="Colapsar menú lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile Close Drawer Button */}
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="lg:hidden w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Switcher Destacado de Alto Contraste: FÚTBOL vs BALONCESTO */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/95 border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => onSelectSport('SOCCER')}
              className={`h-[30px] px-2.5 rounded-lg text-[11px] font-bold tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeSport === 'SOCCER'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm ring-1 ring-emerald-300/60'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <span className="text-xs leading-none">⚽</span>
              <span>Fútbol</span>
              {activeSport === 'SOCCER' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-2xs shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectSport('NBA')}
              className={`h-[30px] px-2.5 rounded-lg text-[11px] font-bold tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeSport === 'NBA'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm ring-1 ring-amber-300/70'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <span className="text-xs leading-none">🏀</span>
              <span>Baloncesto</span>
              {activeSport === 'NBA' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shadow-2xs shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Cuerpo Scrollable: Botones Principales + Calendario (5 días) + Catálogo Completo de Ligas */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5">
          {/* Botones Prioritarios Compactos: 🔴 Partidos en Vivo + Top Picks / Cartelera */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                onSelectMainTab('LIVE');
                onCloseMobileDrawer();
              }}
              className={`w-full h-[29px] px-2.5 rounded-lg flex items-center justify-between text-[11px] font-bold tracking-tight transition-all cursor-pointer border ${
                mainTab === 'LIVE'
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-500 text-white border-rose-600 shadow-xs ring-1 ring-rose-400/40'
                  : 'bg-gradient-to-r from-rose-50 via-white to-rose-50/70 hover:from-rose-100/80 hover:to-rose-50 text-rose-800 border-rose-200/90 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      mainTab === 'LIVE' ? 'bg-white' : 'bg-rose-500'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      mainTab === 'LIVE' ? 'bg-white' : 'bg-rose-600'
                    }`}
                  ></span>
                </span>
                <span className="truncate">Partidos en Vivo</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[9.5px] font-extrabold leading-none flex items-center gap-1 shrink-0 ${
                  mainTab === 'LIVE'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'bg-rose-600 text-white shadow-2xs'
                }`}
              >
                <span>{liveMatchesCount}</span>
                <span className="text-[8px] uppercase tracking-wider opacity-90">VIVO</span>
              </span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onSelectMainTab('TOP_PICKS');
                  onCloseMobileDrawer();
                }}
                className={`h-[29px] px-2 rounded-lg flex items-center justify-between text-[11px] font-bold tracking-tight transition-all cursor-pointer border ${
                  mainTab === 'TOP_PICKS'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-white to-emerald-50/50 hover:to-emerald-100/60 text-slate-800 border-emerald-200/80 shadow-2xs'
                }`}
              >
                <span className="flex items-center gap-1 truncate">
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      mainTab === 'TOP_PICKS' ? 'text-amber-300 fill-amber-300/30' : 'text-emerald-600 fill-emerald-500/20'
                    }`}
                  />
                  <span className="truncate">Top Picks</span>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[9.5px] font-extrabold leading-none shrink-0 ${
                    mainTab === 'TOP_PICKS'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                  }`}
                >
                  {topPicksCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectMainTab('ALL_LEAGUES');
                  onCloseMobileDrawer();
                }}
                className={`h-[29px] px-2 rounded-lg flex items-center justify-between text-[11px] font-bold tracking-tight transition-all cursor-pointer border ${
                  mainTab === 'ALL_LEAGUES'
                    ? 'bg-gradient-to-r from-indigo-600 to-slate-900 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400/40'
                    : 'bg-gradient-to-b from-white to-indigo-50/40 hover:to-indigo-100/50 text-slate-800 border-indigo-200/70 shadow-2xs'
                }`}
              >
                <span className="flex items-center gap-1 truncate">
                  <Globe
                    className={`w-3.5 h-3.5 shrink-0 ${
                      mainTab === 'ALL_LEAGUES' ? 'text-sky-300' : 'text-indigo-600'
                    }`}
                  />
                  <span className="truncate">Cartelera</span>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[9.5px] font-extrabold leading-none shrink-0 ${
                    mainTab === 'ALL_LEAGUES'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100/80 text-indigo-900 border border-indigo-200/80'
                  }`}
                >
                  {allLeaguesCount}
                </span>
              </button>
            </div>
          </div>

          {/* Horizonte de Programación: 5 Días Adelante */}
          <div className="space-y-1 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10.5px] font-medium text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Calendario (5 Días)</span>
              </span>
              <span className="text-[9.5px] font-mono tabular-nums text-slate-400">{currentDate}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {fiveDayOptions.map((item) => {
                const isSelectedDate = currentDate === item.dateStr;
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => {
                      onDateChange(item.dateStr);
                      onCloseMobileDrawer();
                    }}
                    className={`min-h-[36px] py-1 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      isSelectedDate
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span className="text-[9px] leading-none truncate max-w-full opacity-85">{item.shortLabel}</span>
                    <span className="text-[11px] font-mono tabular-nums font-bold leading-tight mt-0.5">{item.dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enfoque de Mercado Cuantitativo */}
          <div className="space-y-1 pt-2 border-t border-slate-200/80">
            <label className="text-[10.5px] font-medium text-slate-500 flex items-center gap-1 px-0.5">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Filtro de Mercado</span>
            </label>
            {activeSport === 'SOCCER' ? (
              <select
                value={selectedFilter}
                onChange={(e) => {
                  onFilterChange(e.target.value as SoccerFilterType);
                  onCloseMobileDrawer();
                }}
                className="w-full min-h-[34px] bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg px-2 py-1 text-[11.5px] font-medium text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="ALL">En Vivo y Próximos (Todos)</option>
                <option value="LIVE_ONLY">Solo En Vivo Ahora</option>
                <option value="UPCOMING_ONLY">Solo Próximos por Jugar</option>
                <option value="RECOMMENDED">Recomendados (Certeza &ge;68%)</option>
                <option value="CORNERS_SAFE">Especial Córners (&ge;65%)</option>
                <option value="CARDS_SAFE">Especial Tarjetas (&ge;65%)</option>
                <option value="DOUBLE_CHANCE">Doble Oportunidad Segura (&ge;72%)</option>
                <option value="FAVORITES">Favoritos Claros (&ge;55%)</option>
                <option value="HIGH_GOALS">Alta Probabilidad de Goles</option>
              </select>
            ) : (
              <select
                value={selectedNBAFilter}
                onChange={(e) => {
                  onNBAFilterChange(e.target.value as NBAFilterType);
                  onCloseMobileDrawer();
                }}
                className="w-full min-h-[34px] bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg px-2 py-1 text-[11.5px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">Todos los Mercados Baloncesto</option>
                <option value="RECOMMENDED">Selecciones Seguras (&ge;65%)</option>
                <option value="HIGH_POINTS">Ritmo Alto (Over Puntos)</option>
                <option value="FAVORITES">Favoritos Claros (Moneyline)</option>
              </select>
            )}
          </div>

          {/* 3. Catálogo Completo de Competiciones (Principales y Secundarias siempre visibles) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10.5px] font-medium text-slate-500 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-slate-400" />
                <span>Catálogo de Competiciones</span>
              </span>
              <span className="text-[9.5px] font-mono tabular-nums text-slate-400">
                {activeSport === 'SOCCER'
                  ? STATIC_SOCCER_CATALOG.length + extraDynamicSoccerGroups.length
                  : STATIC_BASKETBALL_CATALOG.length}
              </span>
            </div>

            {activeSport === 'SOCCER' ? (
              <div className="space-y-2">
                {/* Accesos Rápidos Globales */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectLeagueAndView('ALL')}
                    className={`w-full min-h-[34px] px-2.5 py-1 rounded-lg flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                      selectedLeague === 'ALL' && mainTab === 'ALL_LEAGUES'
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
                        : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Todas las Competiciones</span>
                    </span>
                    <span
                      className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        selectedLeague === 'ALL' && mainTab === 'ALL_LEAGUES'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {totalFixturesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLeagueAndView('PRIME_CO')}
                    className={`w-full min-h-[34px] px-2.5 py-1 rounded-lg flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                      selectedLeague === 'PRIME_CO' && mainTab === 'ALL_LEAGUES'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                        : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-400" />
                      <span className="truncate">Solo Ligas Top + Colombia</span>
                    </span>
                    <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold">
                      {primeFixturesCount}
                    </span>
                  </button>
                </div>

                {/* SECCIÓN A: LIGAS PRINCIPALES */}
                <div className="space-y-0.5 pt-1">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                    <span>⭐ Ligas Principales</span>
                    <span className="text-[9px] text-slate-400 font-normal normal-case">Toca para ver juegos</span>
                  </div>
                  {primarySoccerCatalog.map((item) => {
                    const dynamicGroup = dynamicGroupMap.get(item.key);
                    const count = dynamicGroup ? dynamicGroup.fixtures.length : 0;
                    const hasLive = dynamicGroup ? dynamicGroup.fixtures.some((f) => f.status === 'IN_PLAY') : false;
                    const isSelectedGroup = selectedLeague === item.key && mainTab === 'ALL_LEAGUES';
                    const isExpanded = expandedLeagueKey === item.key && count > 0;

                    return (
                      <div key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectLeagueAndView(item.key, count)}
                          className={`w-full min-h-[32px] px-2 py-1 rounded-lg flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                              : count > 0
                              ? 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200/70 font-medium'
                              : 'hover:bg-slate-100/70 text-slate-500 border-transparent font-normal'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                            <span className="shrink-0">
                              <CountryFlag country={item.key} fallbackEmoji={item.flag} size="sm" />
                            </span>
                            <span className="truncate">{item.displayName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasLive && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  isSelectedGroup ? 'bg-white' : 'bg-rose-500'
                                }`}
                                title="Partidos en vivo"
                              />
                            )}
                            <span
                              className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                                isSelectedGroup
                                  ? 'bg-white/20 text-white font-bold'
                                  : count > 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold'
                                  : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-white' : 'text-slate-400'}`}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && dynamicGroup && renderInlineSoccerMatches(dynamicGroup.fixtures)}
                      </div>
                    );
                  })}
                </div>

                {/* SECCIÓN B: LIGAS SECUNDARIAS Y RESTO DEL MUNDO */}
                <div className="space-y-0.5 pt-1 border-t border-slate-200/60">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>🌍 Ligas Secundarias y Copas</span>
                  </div>
                  {secondarySoccerCatalog.map((item) => {
                    const dynamicGroup = dynamicGroupMap.get(item.key);
                    const count = dynamicGroup ? dynamicGroup.fixtures.length : 0;
                    const hasLive = dynamicGroup ? dynamicGroup.fixtures.some((f) => f.status === 'IN_PLAY') : false;
                    const isSelectedGroup = selectedLeague === item.key && mainTab === 'ALL_LEAGUES';
                    const isExpanded = expandedLeagueKey === item.key && count > 0;

                    return (
                      <div key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectLeagueAndView(item.key, count)}
                          className={`w-full min-h-[32px] px-2 py-1 rounded-lg flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                              : count > 0
                              ? 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200/70 font-medium'
                              : 'hover:bg-slate-100/70 text-slate-500 border-transparent font-normal'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                            <span className="shrink-0">
                              <CountryFlag country={item.key} fallbackEmoji={item.flag} size="sm" />
                            </span>
                            <span className="truncate">{item.displayName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasLive && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  isSelectedGroup ? 'bg-white' : 'bg-rose-500'
                                }`}
                              />
                            )}
                            <span
                              className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                                isSelectedGroup
                                  ? 'bg-white/20 text-white font-bold'
                                  : count > 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold'
                                  : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-white' : 'text-slate-400'}`}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && dynamicGroup && renderInlineSoccerMatches(dynamicGroup.fixtures)}
                      </div>
                    );
                  })}

                  {/* Cualquier liga adicional con partidos hoy que no esté en la lista fija */}
                  {extraDynamicSoccerGroups.map((group) => {
                    const filterKey = group.key === 'INTL' ? 'GROUP_INTL' : `COUNTRY_${group.key}`;
                    const isSelectedGroup =
                      (selectedLeague === group.key || selectedLeague === filterKey) && mainTab === 'ALL_LEAGUES';
                    const hasLiveInGroup = group.fixtures.some((f) => f.status === 'IN_PLAY');
                    const count = group.fixtures.length;
                    const isExpanded = expandedLeagueKey === filterKey && count > 0;
                    const displayTitle =
                      group.leagues.length === 1 && !group.leagues[0].name.toLowerCase().includes(group.name.toLowerCase())
                        ? `${group.name} (${group.leagues[0].name})`
                        : group.displayName || group.name;

                    return (
                      <div key={group.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectLeagueAndView(filterKey, count)}
                          className={`w-full min-h-[32px] px-2 py-1 rounded-lg flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                              : 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200/70 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                            <span className="shrink-0">
                              <CountryFlag country={group.key} fallbackEmoji={group.flag} size="sm" />
                            </span>
                            <span className="truncate">{displayTitle}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasLiveInGroup && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  isSelectedGroup ? 'bg-white' : 'bg-rose-500'
                                }`}
                              />
                            )}
                            <span
                              className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                                isSelectedGroup
                                  ? 'bg-white/20 text-white font-bold'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold'
                              }`}
                            >
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-white' : 'text-slate-400'}`}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && renderInlineSoccerMatches(group.fixtures)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Catálogo Completo de Baloncesto (Principales y Secundarias) */
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectNBALeagueAndView('ALL', 0)}
                  className={`w-full min-h-[34px] px-2.5 py-1 rounded-lg flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                    selectedNBAConference === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/60'
                  }`}
                >
                  <span>🏀 Todas las Competiciones</span>
                  <span className="font-mono tabular-nums text-[10px]">{totalNBAFixturesCount}</span>
                </button>

                <div className="space-y-0.5 pt-1">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 flex items-center justify-between">
                    <span>⭐ Ligas Principales</span>
                    <span className="text-[9px] text-slate-400 font-normal normal-case">Toca para ver juegos</span>
                  </div>
                  {STATIC_BASKETBALL_CATALOG.filter((c) => c.tier === 'PRIMARY').map((item) => {
                    const matchesForKey = getNBAMatchesForCatalogKey(item.key);
                    const dynamicMatch = availableBasketballLeagues.find((l) => l.key === item.key);
                    const count =
                      item.key === 'Este'
                        ? nbaEsteCount
                        : item.key === 'Oeste'
                        ? nbaOesteCount
                        : dynamicMatch
                        ? dynamicMatch.count
                        : matchesForKey.length;
                    const isSelected = selectedNBAConference === item.key;
                    const isExpanded = expandedLeagueKey === item.key && matchesForKey.length > 0;

                    return (
                      <div key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectNBALeagueAndView(item.key, matchesForKey.length)}
                          className={`w-full min-h-[32px] px-2 py-1 rounded-lg flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                              : count > 0
                              ? 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200/70 font-medium'
                              : 'hover:bg-slate-100/70 text-slate-500 border-transparent font-normal'
                          }`}
                        >
                          <span className="truncate">
                            {item.flag} {item.displayName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                                isSelected
                                  ? 'bg-slate-950/15 text-slate-950 font-bold'
                                  : count > 0
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                                  : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                            {matchesForKey.length > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelected ? 'text-slate-950' : 'text-slate-400'}`}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && renderInlineNBAMatches(matchesForKey)}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-0.5 pt-1 border-t border-slate-200/60">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    🌍 Ligas Secundarias
                  </div>
                  {STATIC_BASKETBALL_CATALOG.filter((c) => c.tier === 'SECONDARY').map((item) => {
                    const matchesForKey = getNBAMatchesForCatalogKey(item.key);
                    const dynamicMatch = availableBasketballLeagues.find((l) => l.key === item.key);
                    const count = dynamicMatch ? dynamicMatch.count : matchesForKey.length;
                    const isSelected = selectedNBAConference === item.key;
                    const isExpanded = expandedLeagueKey === item.key && matchesForKey.length > 0;

                    return (
                      <div key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectNBALeagueAndView(item.key, matchesForKey.length)}
                          className={`w-full min-h-[32px] px-2 py-1 rounded-lg flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                              : count > 0
                              ? 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200/70 font-medium'
                              : 'hover:bg-slate-100/70 text-slate-500 border-transparent font-normal'
                          }`}
                        >
                          <span className="truncate">
                            {item.flag} {item.displayName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                                isSelected
                                  ? 'bg-slate-950/15 text-slate-950 font-bold'
                                  : count > 0
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                                  : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                            {matchesForKey.length > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelected ? 'text-slate-950' : 'text-slate-400'}`}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && renderInlineNBAMatches(matchesForKey)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Pie del Menú Lateral Compacto en 1 Sola Fila: Boletos, Fondo, Guía, Salir */}
        <div className="p-2 border-t border-slate-200/80 bg-slate-50/90 space-y-1.5 shrink-0">
          {isAdminVisible && (
            <button
              type="button"
              onClick={() => {
                onOpenAdminModal();
                onCloseMobileDrawer();
              }}
              className="w-full min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Panel Admin</span>
            </button>
          )}

          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => {
                onOpenSavedSlips();
                onCloseMobileDrawer();
              }}
              className="min-h-[32px] px-1 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 flex items-center justify-center gap-0.5 font-medium cursor-pointer whitespace-nowrap"
              title="Mis Boletos Guardados"
            >
              <History className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Boletos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenWallpaperModal();
                onCloseMobileDrawer();
              }}
              className="min-h-[32px] px-1 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 flex items-center justify-center gap-0.5 font-medium cursor-pointer whitespace-nowrap"
              title="Personalizar Fondo"
            >
              <ImageIcon className="w-3 h-3 text-purple-600 shrink-0" />
              <span>Fondo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenGuideModal('GUIDE');
                onCloseMobileDrawer();
              }}
              className="min-h-[32px] px-1 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 flex items-center justify-center gap-0.5 font-medium cursor-pointer whitespace-nowrap"
              title="Guía y Glosario A-Z"
            >
              <BookOpen className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Guía</span>
            </button>

            <button
              type="button"
              onClick={onLogoutSession}
              className="min-h-[32px] px-1 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-0.5 font-medium cursor-pointer whitespace-nowrap"
              title="Cerrar sesión en este dispositivo"
            >
              <Power className="w-3 h-3 shrink-0" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Collapsible Sidebar (lg and up) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white/95 backdrop-blur-md border-r border-slate-200/90 shadow-xs sticky top-0 h-screen z-30 transition-all duration-200 ${
          isDesktopCollapsed ? 'w-[68px]' : 'w-72'
        }`}
      >
        {renderSidebarContent(isDesktopCollapsed)}
      </aside>

      {/* Mobile Slide-Over Drawer (< lg) */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex transition-opacity duration-200 ${
          isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileDrawerOpen}
      >
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
          onClick={onCloseMobileDrawer}
          aria-hidden="true"
        />
        <aside
          className={`relative w-72 max-w-[85vw] bg-white h-full shadow-2xl border-r border-slate-200 flex flex-col z-10 transition-transform duration-200 ${
            isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent(false)}
        </aside>
      </div>
    </>
  );
};
