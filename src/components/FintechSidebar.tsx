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
    const internationalGroups = availableCompetitionGroups.filter((g) => g.category === 'INTERNATIONAL');
    if (internationalGroups.length > 0) {
      const allInternationalFixtures = internationalGroups.flatMap((g) => g.fixtures);
      const allInternationalLeagues = internationalGroups.flatMap((g) => g.leagues);
      const allInternationalGroup: CompetitionGroup = {
        ...internationalGroups[0],
        key: 'INTL',
        name: 'Torneos Internacionales',
        displayName: '🏆 Torneos Internacionales',
        flag: '🏆',
        totalMatches: allInternationalFixtures.length,
        leagues: allInternationalLeagues,
        fixtures: allInternationalFixtures
      };
      map.set('INTL', allInternationalGroup);
      map.set('GROUP_INTL', allInternationalGroup);
    }
    return map;
  }, [availableCompetitionGroups]);

  // Extra dynamic soccer groups not in the static catalog (preventing any duplicate entries)
  const extraDynamicSoccerGroups = React.useMemo(() => {
    const staticNormalizedKeys = new Set(
      STATIC_SOCCER_CATALOG.map((item) => normalizeCatalogKey(item.key))
    );
    return availableCompetitionGroups.filter(
      (g) => g.category !== 'INTERNATIONAL' && !staticNormalizedKeys.has(normalizeCatalogKey(g.key))
    );
  }, [availableCompetitionGroups, normalizeCatalogKey]);

  const primarySoccerCatalog = React.useMemo(
    () =>
      STATIC_SOCCER_CATALOG.filter((item) => item.tier === 'PRIMARY' && !item.key.startsWith('INTL_')).sort(
        (a, b) => {
          if (a.key === 'GROUP_INTL') return -1;
          if (b.key === 'GROUP_INTL') return 1;
          return a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' });
        }
      ),
    []
  );

  const secondarySoccerCatalog = React.useMemo(
    () =>
      STATIC_SOCCER_CATALOG.filter((item) => item.tier === 'SECONDARY').sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' })
      ),
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
      <div className="mt-1 mb-1.5 ml-2 pl-2 border-l border-[#d9b114]/45 space-y-1">
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
              className="w-full px-2 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] hover:border-[#d9b114]/55 transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer group"
              title="Haz clic para abrir probabilidades, goles, árbitro y alineaciones"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
                <span className="text-[10.5px] font-medium text-[#8b949e] group-hover:text-white truncate">
                  {formatCompactTeamName(f.homeTeam.name)}
                </span>
                <span className="text-[9px] font-mono text-[#6e7681] shrink-0">vs</span>
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
                <span className="text-[10.5px] font-medium text-[#8b949e] group-hover:text-white truncate">
                  {formatCompactTeamName(f.awayTeam.name)}
                </span>
              </div>
              <span
                className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${
                  isLive
                    ? 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                    : 'bg-[#0b0e14] text-white border border-[#30363d]'
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
      <div className="mt-1 mb-1.5 ml-2 pl-2 border-l border-[#d9b114]/45 space-y-1">
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
              className="w-full px-2 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] hover:border-[#d9b114]/55 transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer group"
              title="Haz clic para abrir probabilidades, cuartos, ritmo y quintetos"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
                <span className="text-[10.5px] font-medium text-[#8b949e] group-hover:text-white truncate">
                  {f.homeTeam.shortName || f.homeTeam.name}
                </span>
                <span className="text-[9px] font-mono text-[#6e7681] shrink-0">vs</span>
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
                <span className="text-[10.5px] font-medium text-[#8b949e] group-hover:text-white truncate">
                  {f.awayTeam.shortName || f.awayTeam.name}
                </span>
              </div>
              <span
                className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${
                  isLive
                    ? 'bg-rose-950/60 text-rose-400 border border-rose-500/50'
                    : 'bg-[#0b0e14] text-white border border-[#30363d]'
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
        <div className="flex flex-col items-center justify-between h-full py-3 px-1.5 select-none bg-[#0b0e14] text-white">
          {/* Zona Superior: Isotipo + Toggle + Selector de Deportes + Navegación */}
          <div className="flex flex-col items-center gap-2.5 w-full">
            {/* Isotipo reducido en modo colapsado (Paso 2.5) */}
            <button
              type="button"
              onClick={onSecretAdminLogoClick}
              className="cursor-pointer transition-transform hover:scale-105"
              title="G METRICS"
            >
              <SportStatsLogo size="sm" activeSport={activeSport} withGlow={false} />
            </button>

            {/* Toggle Expansión */}
            <div className="group relative flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onToggleDesktopCollapse}
                className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#30363d] hover:border-[#d9b114]/50 active:scale-95"
                aria-label="Expandir menú lateral"
              >
                <PanelLeftOpen className="w-4 h-4" strokeWidth={2} />
              </button>
              <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                Expandir menú lateral
              </div>
            </div>

            {/* Sport Switcher Vectorial */}
            <div className="p-1 rounded-2xl bg-[#161b22] border border-[#30363d] flex flex-col gap-1 w-11 items-center">
              {/* Fútbol */}
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => onSelectSport('SOCCER')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    activeSport === 'SOCCER'
                      ? 'bg-[#1c2129] text-[#d9b114] border-[#d9b114]/65'
                      : 'bg-transparent border-transparent text-[#8b949e] hover:text-white hover:bg-[#1c2129]'
                  }`}
                  aria-label="Fútbol"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m12 7 3.5 2.5v4L12 16l-3.5-2.5v-4z" />
                    <path d="M12 7V2" />
                    <path d="m15.5 9.5 4.5-1.5" />
                    <path d="m15.5 13.5 4 3" />
                    <path d="m8.5 13.5-4 3" />
                    <path d="m8.5 9.5-4.5-1.5" />
                    <path d="M12 16v6" />
                  </svg>
                </button>
                <div className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Fútbol Pro
                </div>
              </div>

              {/* Baloncesto NBA */}
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => onSelectSport('NBA')}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    activeSport === 'NBA'
                      ? 'bg-[#1c2129] text-[#d9b114] border-[#d9b114]/65'
                      : 'bg-transparent border-transparent text-[#8b949e] hover:text-white hover:bg-[#1c2129]'
                  }`}
                  aria-label="Baloncesto NBA"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2.1 12h19.8" />
                    <path d="M12 2.1v19.8" />
                    <path d="M4.93 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M19.07 4.93a10 10 0 0 0 0 14.14" />
                  </svg>
                </button>
                <div className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Baloncesto NBA
                </div>
              </div>
            </div>

            {/* Separador fino */}
            <div className="w-8 h-px bg-[#21262d] my-0.5" />

            {/* Navegación Principal (En Vivo, Joyas, Cartelera) */}
            <div className="flex flex-col gap-2 w-full items-center">
              {/* Partidos en Vivo (Rojo exclusivo para En Vivo) */}
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => onSelectMainTab('LIVE')}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                    mainTab === 'LIVE'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/70'
                      : 'bg-[#161b22] text-rose-400 border-[#30363d] hover:bg-[#1c2129] hover:border-rose-500/50'
                  }`}
                  aria-label={`Partidos en Vivo (${liveMatchesCount})`}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                  {liveMatchesCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono tabular-nums text-[9px] font-bold">
                      {liveMatchesCount}
                    </span>
                  )}
                </button>
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Partidos en Vivo ({liveMatchesCount})
                </div>
              </div>

              {/* Joyas del Día (Top Picks) */}
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => onSelectMainTab('TOP_PICKS')}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                    mainTab === 'TOP_PICKS'
                      ? 'bg-[#1c2129] text-[#d9b114] border-[#d9b114]/65'
                      : 'bg-[#161b22] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
                  }`}
                  aria-label={`Joyas del Día (${topPicksCount})`}
                >
                  <Flame className="w-4.5 h-4.5" strokeWidth={2} />
                </button>
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Top Picks ({topPicksCount})
                </div>
              </div>

              {/* Cartelera Completa */}
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                    mainTab === 'ALL_LEAGUES'
                      ? 'bg-[#1c2129] text-[#d9b114] border-[#d9b114]/65'
                      : 'bg-[#161b22] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
                  }`}
                  aria-label={`Cartelera Completa (${allLeaguesCount})`}
                >
                  <Globe className="w-4.5 h-4.5" strokeWidth={2} />
                </button>
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Cartelera ({allLeaguesCount})
                </div>
              </div>
            </div>
          </div>

          {/* Zona Inferior: Boletos + Guía + Fondo + Salir + (Admin si aplica) */}
          <div className="flex flex-col items-center gap-2 w-full pt-2.5 border-t border-[#21262d]">
            {isAdminVisible && (
              <div className="group relative flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={onOpenAdminModal}
                  className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#d9b114] border border-[#d9b114]/55 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  aria-label="Panel de Administración"
                >
                  <ShieldCheck className="w-4.5 h-4.5" strokeWidth={2} />
                </button>
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                  Panel de Administración
                </div>
              </div>
            )}

            <div className="group relative flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onOpenSavedSlips}
                className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                aria-label="Mis Boletos Guardados"
              >
                <History className="w-4.5 h-4.5" strokeWidth={2} />
              </button>
              <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                Mis Boletos Guardados
              </div>
            </div>

            <div className="group relative flex items-center justify-center w-full">
              <button
                type="button"
                onClick={() => onOpenGuideModal('GUIDE')}
                className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                aria-label="Guía Didáctica y Glosario A-Z"
              >
                <BookOpen className="w-4.5 h-4.5" strokeWidth={2} />
              </button>
              <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                Guía y Glosario A-Z
              </div>
            </div>

            <div className="group relative flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onOpenWallpaperModal}
                className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                aria-label="Cambiar Fondo de Pantalla"
              >
                <ImageIcon className="w-4.5 h-4.5" strokeWidth={2} />
              </button>
              <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                Fondo Cinematográfico
              </div>
            </div>

            <div className="group relative flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onLogoutSession}
                className="w-10 h-10 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] flex items-center justify-center transition-all cursor-pointer active:scale-95"
                aria-label="Cerrar sesión en este dispositivo"
              >
                <Power className="w-4.5 h-4.5" strokeWidth={2} />
              </button>
              <div className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-xl bg-[#161b22] text-white border border-[#30363d] px-2.5 py-1 text-[11px] font-semibold shadow-2xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                Cerrar Sesión
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full select-none bg-[#0b0e14] text-white">
        {/* 1. Encabezado Canónico de Marca (Paso 2.5): G ampliada + Titular + Switcher */}
        <div className="p-3 border-b border-[#21262d] space-y-2.5 bg-[#0b0e14]">
          <div className="flex items-center justify-between gap-2">
            <div
              onClick={onSecretAdminLogoClick}
              className="flex items-center gap-2 min-w-0 select-none cursor-pointer group"
              title="G METRICS · La Ciencia Detrás de la Victoria"
            >
              <SportStatsLogo size="md" activeSport={activeSport} withGlow={true} />
              <div className="min-w-0 flex flex-col justify-center">
                <span className="gmetrics-brand-title text-[14px] leading-none block whitespace-nowrap">
                  G METRICS
                </span>
                <span className="text-[6.8px] font-bold uppercase tracking-tight text-[#8b949e] group-hover:text-white/90 transition-colors block whitespace-nowrap leading-none mt-1">
                  LA CIENCIA DETRÁS DE LA VICTORIA ({activeSport === 'NBA' ? 'Baloncesto' : 'Fútbol'})
                </span>
              </div>
            </div>

            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={onToggleDesktopCollapse}
              className="hidden lg:flex w-8 h-8 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] text-[#8b949e] hover:text-white items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Colapsar menú lateral"
            >
              <PanelLeftClose className="w-4 h-4" strokeWidth={2} />
            </button>

            {/* Mobile Close Drawer Button */}
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="lg:hidden w-8 h-8 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar menú lateral"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Switcher Unificado de Deporte (.cyber-chrome-chip lenguaje único del Chrome) */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onSelectSport('SOCCER')}
              className={`cyber-chrome-chip w-full ${
                activeSport === 'SOCCER' ? 'cyber-chrome-chip-active' : ''
              }`}
            >
              <span className="text-xs leading-none">⚽</span>
              <span>Fútbol</span>
              {activeSport === 'SOCCER' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114] shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectSport('NBA')}
              className={`cyber-chrome-chip w-full ${
                activeSport === 'NBA' ? 'cyber-chrome-chip-active' : ''
              }`}
            >
              <span className="text-xs leading-none">🏀</span>
              <span>Baloncesto</span>
              {activeSport === 'NBA' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114] shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Cuerpo Scrollable: Botones Principales + Calendario (5 días) + Catálogo Completo de Ligas */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3">
          {/* Botones Prioritarios Compactos */}
          <div className="space-y-1.5">
            {/* Rojo reservado exclusivamente para En Vivo */}
            <button
              type="button"
              onClick={() => {
                onSelectMainTab('LIVE');
                onCloseMobileDrawer();
              }}
              className={`w-full h-8 px-3 rounded-xl flex items-center justify-between text-xs font-semibold tracking-tight transition-all cursor-pointer border ${
                mainTab === 'LIVE'
                  ? 'bg-rose-950/60 text-white border-rose-500/75 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                  : 'bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border-[#30363d]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <span className="truncate">Partidos en Vivo</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-lg font-mono tabular-nums text-[10px] font-bold leading-none flex items-center gap-1 shrink-0 bg-rose-600/20 text-rose-400 border border-rose-500/45">
                <span>{liveMatchesCount}</span>
                <span className="text-[8px] uppercase tracking-wider">VIVO</span>
              </span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onSelectMainTab('TOP_PICKS');
                  onCloseMobileDrawer();
                }}
                className={`cyber-chrome-chip w-full !justify-between !px-2.5 ${
                  mainTab === 'TOP_PICKS' ? 'cyber-chrome-chip-active' : ''
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      mainTab === 'TOP_PICKS' ? 'text-[#d9b114]' : 'text-[#8b949e]'
                    }`}
                    strokeWidth={2}
                  />
                  <span className="truncate">Top Picks</span>
                </span>
                <span className="px-1.5 py-0.5 rounded-lg font-mono tabular-nums text-[10px] font-bold leading-none shrink-0 bg-[#0b0e14] text-white border border-[#30363d]">
                  {topPicksCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectMainTab('ALL_LEAGUES');
                  onCloseMobileDrawer();
                }}
                className={`cyber-chrome-chip w-full !justify-between !px-2.5 ${
                  mainTab === 'ALL_LEAGUES' ? 'cyber-chrome-chip-active' : ''
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Globe
                    className={`w-3.5 h-3.5 shrink-0 ${
                      mainTab === 'ALL_LEAGUES' ? 'text-[#d9b114]' : 'text-[#8b949e]'
                    }`}
                    strokeWidth={2}
                  />
                  <span className="truncate">Cartelera</span>
                </span>
                <span className="px-1.5 py-0.5 rounded-lg font-mono tabular-nums text-[10px] font-bold leading-none shrink-0 bg-[#0b0e14] text-white border border-[#30363d]">
                  {allLeaguesCount}
                </span>
              </button>
            </div>
          </div>

          {/* Horizonte de Programación: 5 Días Adelante */}
          <div className="space-y-1.5 pt-2 border-t border-[#21262d]">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10.5px] font-semibold text-[#8b949e] flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>Calendario (5 Días)</span>
              </span>
              <span className="text-[10px] font-mono tabular-nums text-[#6e7681]">{currentDate}</span>
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
                    className={`min-h-[40px] py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      isSelectedDate
                        ? 'bg-[#1c2129] text-white border-[#d9b114]/70 shadow-[0_0_12px_rgba(217,177,20,0.18)] font-semibold'
                        : 'bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border-[#30363d]'
                    }`}
                  >
                    <span
                      className={`text-[9px] leading-none truncate max-w-full ${
                        isSelectedDate ? 'text-[#d9b114] font-bold' : 'text-[#8b949e]'
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold leading-tight mt-0.5 text-white">
                      {item.dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enfoque de Mercado Cuantitativo */}
          <div className="space-y-1.5 pt-2 border-t border-[#21262d]">
            <label className="text-[10.5px] font-semibold text-[#8b949e] flex items-center gap-1.5 px-0.5">
              <Filter className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
              <span>Filtro de Mercado</span>
            </label>
            {activeSport === 'SOCCER' ? (
              <select
                value={selectedFilter}
                onChange={(e) => {
                  onFilterChange(e.target.value as SoccerFilterType);
                  onCloseMobileDrawer();
                }}
                className="w-full h-8.5 bg-[#161b22] border border-[#30363d] hover:border-[#484f58] focus:border-[#d9b114] rounded-xl px-2.5 text-xs font-medium text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#161b22] text-white">En Vivo y Próximos (Todos)</option>
                <option value="LIVE_ONLY" className="bg-[#161b22] text-white">Solo En Vivo Ahora</option>
                <option value="UPCOMING_ONLY" className="bg-[#161b22] text-white">Solo Próximos por Jugar</option>
                <option value="RECOMMENDED" className="bg-[#161b22] text-white">Recomendados (Certeza &ge;68%)</option>
                <option value="CORNERS_SAFE" className="bg-[#161b22] text-white">Especial Córners (&ge;65%)</option>
                <option value="CARDS_SAFE" className="bg-[#161b22] text-white">Especial Tarjetas (&ge;65%)</option>
                <option value="DOUBLE_CHANCE" className="bg-[#161b22] text-white">Doble Oportunidad Segura (&ge;72%)</option>
                <option value="FAVORITES" className="bg-[#161b22] text-white">Favoritos Claros (&ge;55%)</option>
                <option value="HIGH_GOALS" className="bg-[#161b22] text-white">Alta Probabilidad de Goles</option>
              </select>
            ) : (
              <select
                value={selectedNBAFilter}
                onChange={(e) => {
                  onNBAFilterChange(e.target.value as NBAFilterType);
                  onCloseMobileDrawer();
                }}
                className="w-full h-8.5 bg-[#161b22] border border-[#30363d] hover:border-[#484f58] focus:border-[#d9b114] rounded-xl px-2.5 text-xs font-medium text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#161b22] text-white">Todos los Mercados Baloncesto</option>
                <option value="RECOMMENDED" className="bg-[#161b22] text-white">Selecciones Seguras (&ge;65%)</option>
                <option value="HIGH_POINTS" className="bg-[#161b22] text-white">Ritmo Alto (Over Puntos)</option>
                <option value="FAVORITES" className="bg-[#161b22] text-white">Favoritos Claros (Moneyline)</option>
              </select>
            )}
          </div>

          {/* 3. Catálogo Completo de Competiciones */}
          <div className="space-y-2 pt-2 border-t border-[#21262d]">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10.5px] font-semibold text-[#8b949e] flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>Catálogo de Competiciones</span>
              </span>
              <span className="text-[10px] font-mono tabular-nums font-bold text-[#6e7681]">
                {activeSport === 'SOCCER'
                  ? STATIC_SOCCER_CATALOG.length + extraDynamicSoccerGroups.length
                  : STATIC_BASKETBALL_CATALOG.length}
              </span>
            </div>

            {activeSport === 'SOCCER' ? (
              <div className="space-y-2">
                {/* Accesos Rápidos Globales */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSelectLeagueAndView('ALL')}
                    className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                      selectedLeague === 'ALL' && mainTab === 'ALL_LEAGUES'
                        ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                        : 'bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border-[#30363d]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-[#8b949e] shrink-0" strokeWidth={2} />
                      <span className="truncate">Todas las Competiciones</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-lg font-bold bg-[#0b0e14] text-white border border-[#30363d]">
                      {totalFixturesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLeagueAndView('PRIME_CO')}
                    className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                      selectedLeague === 'PRIME_CO' && mainTab === 'ALL_LEAGUES'
                        ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                        : 'bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border-[#30363d]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Star className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
                      <span className="truncate">Solo Ligas Top + Colombia</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-lg bg-[#0b0e14] text-white border border-[#30363d] font-bold">
                      {primeFixturesCount}
                    </span>
                  </button>
                </div>

                {/* SECCIÓN A: LIGAS PRINCIPALES */}
                <div className="space-y-1 pt-1">
                  <div className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d9b114] flex items-center justify-between">
                    <span>⭐ Ligas Principales</span>
                    <span className="text-[9px] text-[#6e7681] font-normal normal-case">Toca para ver juegos</span>
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
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                              : count > 0
                              ? 'bg-[#161b22] hover:bg-[#1c2129] text-[#c9d1d9] hover:text-white border-[#30363d] font-medium'
                              : 'hover:bg-[#161b22]/70 text-[#6e7681] border-transparent font-normal'
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
                                className="w-1.5 h-1.5 rounded-full animate-pulse bg-rose-500"
                                title="Partidos en vivo"
                              />
                            )}
                            <span
                              className={`font-mono tabular-nums text-[10.5px] px-1.5 py-0.2 rounded-md ${
                                count > 0
                                  ? 'bg-[#0b0e14] text-white border border-[#30363d] font-bold'
                                  : 'text-[#6e7681]'
                              }`}
                            >
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-[#d9b114]' : 'text-[#6e7681]'}`}
                                strokeWidth={2}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && dynamicGroup && item.key === 'GROUP_INTL' ? (
                          <div className="mt-1 mb-1.5 ml-2 pl-2 border-l border-[#d9b114]/45 space-y-0.5">
                            {availableCompetitionGroups
                              .filter((group) => group.category === 'INTERNATIONAL')
                              .map((tournament) => {
                                const isTournamentSelected = selectedLeague === tournament.key && mainTab === 'ALL_LEAGUES';
                                return (
                                  <button
                                    key={tournament.key}
                                    type="button"
                                    onClick={() => handleSelectLeagueAndView(tournament.key, tournament.totalMatches)}
                                    className={`w-full min-h-[30px] px-2 py-1 rounded-lg flex items-center justify-between gap-2 text-[10.5px] text-left cursor-pointer border ${
                                      isTournamentSelected
                                        ? 'bg-[#1c2129] text-white border-[#d9b114]/55 font-semibold'
                                        : 'border-transparent text-[#8b949e] hover:text-white hover:bg-[#161b22]'
                                    }`}
                                  >
                                    <span className="truncate">{tournament.flag} {tournament.name}</span>
                                    <span className="shrink-0 font-mono tabular-nums font-bold text-white">
                                      {tournament.totalMatches}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        ) : isExpanded && dynamicGroup ? (
                          renderInlineSoccerMatches(dynamicGroup.fixtures)
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* SECCIÓN B: LIGAS SECUNDARIAS Y RESTO DEL MUNDO */}
                <div className="space-y-1 pt-2 border-t border-[#21262d]">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8b949e] flex items-center justify-between">
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
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                              : count > 0
                              ? 'bg-[#161b22] hover:bg-[#1c2129] text-[#c9d1d9] hover:text-white border-[#30363d] font-medium'
                              : 'hover:bg-[#161b22]/70 text-[#6e7681] border-transparent font-normal'
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
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-rose-500" />
                            )}
                            <span
                              className={`font-mono tabular-nums text-[10.5px] px-1.5 py-0.2 rounded-md ${
                                count > 0
                                  ? 'bg-[#0b0e14] text-white border border-[#30363d] font-bold'
                                  : 'text-[#6e7681]'
                              }`}
                            >
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-[#d9b114]' : 'text-[#6e7681]'}`}
                                strokeWidth={2}
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
                    const filterKey = group.category === 'INTERNATIONAL'
                      ? `LEAGUE_${group.leagues[0]?.name ?? group.name}`
                      : `COUNTRY_${group.key}`;
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
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between gap-1.5 text-[11.5px] transition-all cursor-pointer border ${
                            isSelectedGroup
                              ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                              : 'bg-[#161b22] hover:bg-[#1c2129] text-[#c9d1d9] hover:text-white border-[#30363d] font-medium'
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
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-rose-500" />
                            )}
                            <span className="font-mono tabular-nums text-[10.5px] px-1.5 py-0.2 rounded-md bg-[#0b0e14] text-white border border-[#30363d] font-bold">
                              {count}
                            </span>
                            {count > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelectedGroup ? 'text-[#d9b114]' : 'text-[#6e7681]'}`}
                                strokeWidth={2}
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
                  className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                    selectedNBAConference === 'ALL'
                      ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                      : 'bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border-[#30363d]'
                  }`}
                >
                  <span>🏀 Todas las Competiciones</span>
                  <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-lg bg-[#0b0e14] text-white border border-[#30363d] font-bold">
                    {totalNBAFixturesCount}
                  </span>
                </button>

                <div className="space-y-1 pt-1">
                  <div className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d9b114] flex items-center justify-between">
                    <span>⭐ Ligas Principales</span>
                    <span className="text-[9px] text-[#6e7681] font-normal normal-case">Toca para ver juegos</span>
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
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                              : count > 0
                              ? 'bg-[#161b22] hover:bg-[#1c2129] text-[#c9d1d9] hover:text-white border-[#30363d] font-medium'
                              : 'hover:bg-[#161b22]/70 text-[#6e7681] border-transparent font-normal'
                          }`}
                        >
                          <span className="truncate">
                            {item.flag} {item.displayName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`font-mono tabular-nums text-[10.5px] px-1.5 py-0.2 rounded-md ${
                                count > 0
                                  ? 'bg-[#0b0e14] text-white border border-[#30363d] font-bold'
                                  : 'text-[#6e7681]'
                              }`}
                            >
                              {count}
                            </span>
                            {matchesForKey.length > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelected ? 'text-[#d9b114]' : 'text-[#6e7681]'}`}
                                strokeWidth={2}
                              />
                            )}
                          </div>
                        </button>
                        {isExpanded && renderInlineNBAMatches(matchesForKey)}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 pt-2 border-t border-[#21262d]">
                  <div className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8b949e]">
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
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl flex items-center justify-between text-[11.5px] transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#1c2129] text-white border-[#d9b114]/65 font-semibold'
                              : count > 0
                              ? 'bg-[#161b22] hover:bg-[#1c2129] text-[#c9d1d9] hover:text-white border-[#30363d] font-medium'
                              : 'hover:bg-[#161b22]/70 text-[#6e7681] border-transparent font-normal'
                          }`}
                        >
                          <span className="truncate">
                            {item.flag} {item.displayName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`font-mono tabular-nums text-[10.5px] px-1.5 py-0.2 rounded-md ${
                                count > 0
                                  ? 'bg-[#0b0e14] text-white border border-[#30363d] font-bold'
                                  : 'text-[#6e7681]'
                              }`}
                            >
                              {count}
                            </span>
                            {matchesForKey.length > 0 && (
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                } ${isSelected ? 'text-[#d9b114]' : 'text-[#6e7681]'}`}
                                strokeWidth={2}
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

        {/* 4. Pie del Menú Lateral (Lenguaje unificado .cyber-chrome-chip) */}
        <div className="p-2.5 border-t border-[#21262d] bg-[#0b0e14] space-y-1.5 shrink-0">
          {isAdminVisible && (
            <button
              type="button"
              onClick={() => {
                onOpenAdminModal();
                onCloseMobileDrawer();
              }}
              className="cyber-chrome-chip cyber-chrome-chip-gold w-full"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
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
              className="cyber-chrome-chip !h-8 !px-1 !text-[10px] w-full whitespace-nowrap"
              title="Mis Boletos Guardados"
            >
              <History className="w-3 h-3 text-[#d9b114] shrink-0" strokeWidth={2} />
              <span>Boletos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenWallpaperModal();
                onCloseMobileDrawer();
              }}
              className="cyber-chrome-chip !h-8 !px-1 !text-[10px] w-full whitespace-nowrap"
              title="Personalizar Fondo"
            >
              <ImageIcon className="w-3 h-3 text-[#8b949e] shrink-0" strokeWidth={2} />
              <span>Fondo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenGuideModal('GUIDE');
                onCloseMobileDrawer();
              }}
              className="cyber-chrome-chip !h-8 !px-1 !text-[10px] w-full whitespace-nowrap"
              title="Guía y Glosario A-Z"
            >
              <BookOpen className="w-3 h-3 text-[#d9b114] shrink-0" strokeWidth={2} />
              <span>Guía</span>
            </button>

            <button
              type="button"
              onClick={onLogoutSession}
              className="cyber-chrome-chip !h-8 !px-1 !text-[10px] w-full whitespace-nowrap"
              title="Cerrar sesión en este dispositivo"
            >
              <Power className="w-3 h-3 text-[#8b949e] shrink-0" strokeWidth={2} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Floating Bento Sidebar (lg and up) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bento-floating-dock fixed top-2.5 left-2.5 bottom-2.5 h-[calc(100vh-20px)] rounded-3xl overflow-hidden z-30 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDesktopCollapsed ? 'w-[68px]' : 'w-72'
        }`}
      >
        {renderSidebarContent(isDesktopCollapsed)}
      </aside>

      {/* Espaciador Desktop para reservar el ancho del Riel Flotante */}
      <div
        aria-hidden="true"
        className={`hidden lg:block shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDesktopCollapsed ? 'w-[82px]' : 'w-[302px]'
        }`}
      />

      {/* Mobile Slide-Over Drawer (< lg) */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileDrawerOpen}
      >
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300"
          onClick={onCloseMobileDrawer}
          aria-hidden="true"
        />
        <aside
          className={`relative w-72 max-w-[85vw] bg-[#0b0e14] h-full shadow-2xl border-r border-[#30363d] flex flex-col z-10 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent(false)}
        </aside>
      </div>
    </>
  );
};
