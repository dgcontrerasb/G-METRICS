import React from 'react';
import {
  Search,
  ChevronDown,
  CheckSquare,
  Square,
  Clock,
  Calendar,
  Filter,
  Layers,
  X,
  Sparkles,
  Flame,
  Star
} from 'lucide-react';
import { MatchFixture, MatchAnalysis } from '../../types';
import { getColombiaDateString } from '../../services/apiService';
import { calculateMatchAnalysis } from '../../services/mathEngine';
import { CompetitionGroup } from '../../services/leagueCategorizer';
import { CompactMatchRow } from '../CompactMatchRow';
import { FriendlyPredictionCard } from '../FriendlyPredictionCard';
import { CompetitionBlock } from '../CompetitionBlock';

interface CrossDaySearchMatchItem {
  dateStr: string;
  dateLabel: string;
  fixture: MatchFixture;
  analysis: MatchAnalysis;
}

interface SoccerTopPickItem {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  advice: any;
}

interface SoccerWorkspaceViewProps {
  isLoading: boolean;
  fixtures: MatchFixture[];
  filteredFixtures: MatchFixture[];
  displayFixtures: MatchFixture[];
  availableCompetitionGroups: CompetitionGroup[];
  groupedFilteredFixtures: CompetitionGroup[];
  selectedLeague: string;
  onSelectLeague: (league: string) => void;
  activeLeagueLabel: string;
  searchQuery: string;
  onClearFilters: () => void;
  currentDate: string;
  onSmartDateChange: (dateStr: string) => void;
  isSearchingOtherDays: boolean;
  crossDaySearchMatches: CrossDaySearchMatchItem[];
  mainTab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE';
  onSelectMainTab: (tab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE') => void;
  soccerTopPicks: SoccerTopPickItem[];
  soccerLiveFixtures: MatchFixture[];
  analysesMap: Record<string, MatchAnalysis>;
  selectedFixtureIds: Set<string>;
  onToggleSelect: (fixtureId: string) => void;
  onToggleSelectGroupFixtures: (fixtureIds: string[], selectAll: boolean) => void;
  onSelectAll: () => void;
  expandedCardIds: Set<string>;
  onToggleCardExpand: (fixtureId: string) => void;
  collapsedGroupKeys: Set<string>;
  onToggleGroupCollapse: (groupKey: string) => void;
  onToggleAllGroupsCollapse: () => void;
  favoriteFixtureIds: Set<string>;
  onToggleFavorite: (fixtureId: string) => void;
  showFavoritesOnly: boolean;
  onToggleShowFavoritesOnly: () => void;
  visibleMatchLimit: number;
  setVisibleMatchLimit: React.Dispatch<React.SetStateAction<number>>;
  viewMode: 'SIMPLE' | 'EXPERT';
  densityView: 'CARDS' | 'COMPACT';
  isLightweightMode: boolean;
  recentlyUpdatedFixtureIds: Set<string>;
  onOpenSoccerDetail: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
  onSelectSpotlight?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
  activeSpotlightFixtureId?: string | null;
  isSpotlightOpen?: boolean;
  onOpenSimulator: (fixture: MatchFixture) => void;
}

export const SoccerWorkspaceView: React.FC<SoccerWorkspaceViewProps> = React.memo(({
  isLoading,
  fixtures,
  filteredFixtures,
  displayFixtures,
  availableCompetitionGroups,
  groupedFilteredFixtures,
  selectedLeague,
  onSelectLeague,
  activeLeagueLabel,
  searchQuery,
  onClearFilters,
  currentDate,
  onSmartDateChange,
  isSearchingOtherDays,
  crossDaySearchMatches,
  mainTab,
  onSelectMainTab,
  soccerTopPicks,
  soccerLiveFixtures,
  analysesMap,
  selectedFixtureIds,
  onToggleSelect,
  onToggleSelectGroupFixtures,
  onSelectAll,
  expandedCardIds,
  onToggleCardExpand,
  collapsedGroupKeys,
  onToggleGroupCollapse,
  onToggleAllGroupsCollapse,
  favoriteFixtureIds,
  onToggleFavorite,
  showFavoritesOnly,
  onToggleShowFavoritesOnly,
  visibleMatchLimit,
  setVisibleMatchLimit,
  viewMode,
  densityView,
  isLightweightMode,
  recentlyUpdatedFixtureIds,
  onOpenSoccerDetail,
  onSelectSpotlight,
  activeSpotlightFixtureId,
  isSpotlightOpen = false,
  onOpenSimulator
}) => {
  const hasSelection = selectedFixtureIds.size > 0;

  return (
    <main
      className={`flex-1 min-w-0 w-full space-y-2.5 sm:space-y-4 transition-all duration-300 ease-out ${
        isSpotlightOpen ? 'xl:max-w-none' : 'max-w-5xl mx-auto'
      }`}
    >
      {/* Contextual Toolbar: Unified Metrics, Active League Pill (Mobile) & Controls */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-md text-xs text-[#8b949e] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="font-mono tabular-nums tracking-tight font-bold text-white">
              {isLoading ? 'Buscando...' : `${filteredFixtures.length} partidos`}
            </span>
            {!isLoading && availableCompetitionGroups.length > 0 && (
              <>
                <span className="hidden sm:inline text-[#30363d]" aria-hidden="true">·</span>
                <span className="hidden sm:inline font-mono tabular-nums text-[#8b949e]">
                  {selectedLeague === 'ALL' && !searchQuery.trim()
                    ? `${availableCompetitionGroups.length} ${availableCompetitionGroups.length === 1 ? 'competición' : 'competiciones'}`
                    : `${groupedFilteredFixtures.length} ${groupedFilteredFixtures.length === 1 ? 'competición' : 'competiciones'}`}
                </span>
              </>
            )}
            {hasSelection && (
              <>
                <span className="text-[#30363d]" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-bold text-[#d9b114]">
                  {selectedFixtureIds.size} sel.
                </span>
              </>
            )}
            {filteredFixtures.some((f) => f.status === 'IN_PLAY') && (
              <>
                <span className="text-[#30363d]" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onSelectMainTab('LIVE')}
                  className="inline-flex items-center gap-1 text-rose-500 font-mono tabular-nums font-bold text-[11px] sm:text-xs cursor-pointer hover:underline"
                >
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>{soccerLiveFixtures.length} En Vivo</span>
                </button>
              </>
            )}
          </div>

          {selectedLeague !== 'ALL' && mainTab === 'ALL_LEAGUES' && (
            <button
              type="button"
              onClick={() => onSelectLeague('ALL')}
              className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#d9b114]/15 hover:bg-[#d9b114]/25 border border-[#d9b114]/40 text-[#d9b114] font-semibold text-[10.5px] shrink-0 max-w-[150px] cursor-pointer transition-colors"
              title={`Filtro activo: ${activeLeagueLabel} (Toca para ver todas)`}
            >
              <Filter className="w-3 h-3 shrink-0" strokeWidth={2} />
              <span className="truncate">
                {activeLeagueLabel
                  .replace(' - Casas de Apuestas Colombia (Alta Precisión)', '')
                  .replace('Casas de Apuestas Colombia (Alta Precisión)', 'Ligas Top')}
              </span>
              <X className="w-3 h-3 shrink-0" strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Favorites Quick Filter Button */}
          <button
            type="button"
            onClick={onToggleShowFavoritesOnly}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors border cursor-pointer text-xs font-bold ${
              showFavoritesOnly
                ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] shadow-2xs font-bold'
                : 'bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] hover:text-[#d9b114] border-[#30363d]'
            }`}
            title="Ver solo mis partidos favoritos con alertas de gol en vivo"
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-slate-950 text-slate-950' : 'text-[#d9b114]'}`} strokeWidth={2} />
            <span>Favoritos</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[#161b22] text-white">
              {fixtures.filter((f) => favoriteFixtureIds.has(f.id)).length}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Toggle all league blocks */}
            {groupedFilteredFixtures.length > 1 && mainTab === 'ALL_LEAGUES' && (
              <button
                onClick={onToggleAllGroupsCollapse}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-slate-300 hover:text-white transition-colors border border-[#30363d] cursor-pointer text-xs font-medium"
                title={groupedFilteredFixtures.every((g) => collapsedGroupKeys.has(g.key)) ? 'Desplegar todas las ligas' : 'Colapsar todas las ligas'}
              >
                <Layers className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                <span className="hidden sm:inline">
                  {groupedFilteredFixtures.every((g) => collapsedGroupKeys.has(g.key)) ? 'Desplegar ligas' : 'Colapsar ligas'}
                </span>
              </button>
            )}

            {/* Select all button */}
            {filteredFixtures.length > 0 && (
              <button
                onClick={onSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-slate-300 hover:text-white transition-colors border border-[#30363d] cursor-pointer text-xs font-medium"
              >
                {selectedFixtureIds.size === filteredFixtures.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                    <span>Deseleccionar</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-[#8b949e]" strokeWidth={2} />
                    <span>Seleccionar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner de Filtro Activo por Liga (PC: barra completa; Móvil: integrado como píldora arriba) */}
      {selectedLeague !== 'ALL' && mainTab === 'ALL_LEAGUES' && (
        <div className="hidden sm:flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-[#161b22] border border-[#d9b114]/40 text-slate-300 text-xs shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-[#d9b114] shrink-0" strokeWidth={2} />
            <span className="truncate">
              Competición activa: <strong className="text-white font-bold">{activeLeagueLabel}</strong> ({filteredFixtures.length} {filteredFixtures.length === 1 ? 'partido' : 'partidos'})
            </span>
          </div>
          <button
            onClick={() => onSelectLeague('ALL')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-white font-semibold border border-[#30363d] text-xs transition-colors flex items-center gap-1 cursor-pointer"
            title="Ver todas las ligas del día"
          >
            <X className="w-3.5 h-3.5 text-[#8b949e]" strokeWidth={2} />
            <span>Ver todas</span>
          </button>
        </div>
      )}

      {/* Loading State Unificado G METRICS */}
      {isLoading && (
        <div className="py-16 px-4 text-center flex flex-col items-center justify-center bg-[#0b0e14]/90 rounded-2xl border border-[#30363d] shadow-md select-none">
          <img
            src="/icon.png?v=4"
            alt="G METRICS"
            className="w-16 h-16 object-contain mb-3 drop-shadow-[0_0_16px_rgba(217,177,20,0.45)]"
          />
          <div className="gmetrics-dark-pulse">G METRICS</div>
          <p className="mt-2 text-xs text-[#8b949e] font-medium">
            Calculando probabilidades de gol esperado (xG) y valor (+EV)...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredFixtures.length === 0 && crossDaySearchMatches.length === 0 && (
        <div className="py-12 px-6 text-center bg-[#161b22] border border-[#30363d] rounded-2xl space-y-4 max-w-lg mx-auto shadow-md">
          <div className="w-12 h-12 rounded-full bg-[#0b0e14] text-[#d9b114] border border-[#30363d] flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isSearchingOtherDays
                ? `Buscando "${searchQuery.trim()}" en los próximos 5 días...`
                : fixtures.length > 0
                  ? 'Sin partidos en esta fecha para tu búsqueda'
                  : 'No hay partidos programados en esta fecha'}
            </h3>
            <p className="text-xs text-[#8b949e] mt-1.5 leading-relaxed">
              {isSearchingOtherDays
                ? 'Explorando automáticamente todo el calendario de 5 días sin recargar.'
                : fixtures.length > 0
                  ? `No encontramos "${searchQuery.trim() || 'partidos'}" hoy (${currentDate}), pero hay ${fixtures.length} partidos activos en esta fecha.`
                  : `Para la fecha (${currentDate}) no quedan partidos pendientes en esta selección. Puedes elegir otra fecha en el calendario de 5 días.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {fixtures.length > 0 && (
              <button
                onClick={onClearFilters}
                className="px-4 py-2 text-xs font-bold bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Ver todos los partidos ({fixtures.length})
              </button>
            )}
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(1))}
              className="px-4 py-2 text-xs font-semibold bg-[#0b0e14] hover:bg-[#1c2129] text-white rounded-xl transition-colors cursor-pointer border border-[#30363d]"
            >
              Ver Mañana
            </button>
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(2))}
              className="px-4 py-2 text-xs font-semibold bg-[#0b0e14] hover:bg-[#1c2129] text-white rounded-xl transition-colors cursor-pointer border border-[#30363d]"
            >
              Ver +2 Días
            </button>
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(3))}
              className="px-4 py-2 text-xs font-semibold bg-[#0b0e14] hover:bg-[#1c2129] text-white rounded-xl transition-colors cursor-pointer border border-[#30363d]"
            >
              Ver +3 Días
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: 🔥 TOP PICKS / JOYAS DEL DÍA */}
      {mainTab === 'TOP_PICKS' && !isLoading && (
        <div key="tab-top-picks" className="space-y-3 animate-tab-content">
          <div className="px-4 py-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md text-center space-y-1 backdrop-blur-md">
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] text-[10px] font-mono uppercase tracking-wider font-bold">
              <Flame className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              <span>Top Picks del Día · {soccerTopPicks.length} Oportunidades</span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Pronósticos Destacados de Mayor Certeza (&ge;68%) y Valor (+EV)
            </h2>
            <p className="text-[11px] text-[#8b949e] max-w-lg mx-auto">
              Partidos filtrados automáticamente y ordenados de mayor a menor probabilidad estadística.
            </p>
          </div>

          {soccerTopPicks.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-2 shadow-md">
              <Sparkles className="w-8 h-8 text-[#8b949e] mx-auto mb-1" strokeWidth={2} />
              <p className="text-sm font-bold text-white">No hay apuestas con filtro verde (&ge;68%) en este momento</p>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                Explora la Cartelera Completa en el menú lateral o selecciona otra fecha próxima.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-4 py-2 rounded-xl bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Ver Cartelera Completa
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Hero Card "Joya del Día": Partido #1 con Mayor Ventaja Probabilística */}
              {soccerTopPicks.length > 0 && soccerTopPicks[0].analysis && (
                <div className="rounded-3xl p-4 sm:p-5 transition-all bg-[#161b22] border border-[#d9b114]/50 shadow-xl">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#d9b114]/20 border border-[#d9b114]/50 text-[#d9b114] font-black text-xs flex items-center justify-center shadow-2xs">
                        ⭐
                      </span>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#d9b114] bg-[#d9b114]/15 px-2 py-0.5 rounded-full border border-[#d9b114]/40">
                          Joya del Día · Algoritmo Dixon-Coles
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-white tracking-tight mt-1">
                          {soccerTopPicks[0].fixture.homeTeam?.name} vs {soccerTopPicks[0].fixture.awayTeam?.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[#00ff66]/15 border border-[#00ff66]/40 text-[#00ff66] font-black text-[10.5px] uppercase tracking-wider shadow-xs">
                        +EV Estrella
                      </span>
                    </div>
                  </div>

                  {/* Fila Métrica Hero: xG Total + Probabilidad Radial + Botón Directo */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-[#21262d]">
                    <div className="sm:col-span-8 flex flex-wrap items-center gap-3">
                      <div className="px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs">
                        <span className="text-[9.5px] text-[#8b949e] font-bold block uppercase">Pronóstico Principal</span>
                        <span className="text-xs font-black text-white">
                          {soccerTopPicks[0].analysis.verdict?.topSafePick?.plainTitle || soccerTopPicks[0].analysis.verdict?.topSafePick?.label || 'Más de 1.5 Goles'}
                        </span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs font-mono">
                        <span className="text-[9.5px] text-[#8b949e] font-bold block uppercase">Cuota / Prob.</span>
                        <span className="text-xs font-black font-mono tabular-nums text-[#00ff66]">
                          @{soccerTopPicks[0].analysis.verdict?.topSafePick?.fairOdd?.toFixed(2) || '1.65'} ({soccerTopPicks[0].analysis.verdict?.topSafePick?.probability || 84}%)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium">
                        {soccerTopPicks[0].analysis.verdict?.technicalVerdict || 'Proyección de alta solidez basada en métricas Dixon-Coles y simulación Poisson.'}
                      </div>
                    </div>

                    <div className="sm:col-span-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.innerWidth >= 1280 && onSelectSpotlight) {
                            onSelectSpotlight(soccerTopPicks[0].fixture, soccerTopPicks[0].analysis!);
                          } else {
                            onOpenSoccerDetail(soccerTopPicks[0].fixture, soccerTopPicks[0].analysis!);
                          }
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] border border-[#d9b114]/60 text-[#d9b114] font-bold text-xs tracking-tight shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Ver Radar Completo</span>
                        <span className="text-xs">⚡</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Grilla Bento 2 Columnas de Top Picks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {soccerTopPicks.slice(0, visibleMatchLimit).map(({ fixture, analysis }, idx, arr) => (
                  <CompactMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={onToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => onToggleCardExpand(fixture.id)}
                    onOpenDetail={onOpenSoccerDetail}
                    onSelectSpotlight={onSelectSpotlight}
                    isSpotlightActive={activeSpotlightFixtureId === fixture.id}
                    onOpenSimulator={onOpenSimulator}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                    isFavorite={favoriteFixtureIds.has(fixture.id)}
                    onToggleFavorite={onToggleFavorite}
                    isFullWidthDesktop={arr.length % 2 === 1 && idx === arr.length - 1}
                  />
                ))}
              </div>

              {soccerTopPicks.length > visibleMatchLimit && (
                <div className="pt-2 flex flex-row items-center justify-center gap-2">
                  {soccerTopPicks.length - visibleMatchLimit > 10 && (
                    <button
                      type="button"
                      onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                      className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white border border-[#30363d] text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Ver 10 más</span>
                      <span className="font-mono text-[10px] opacity-85">
                        ({Math.min(visibleMatchLimit, soccerTopPicks.length)}/{soccerTopPicks.length})
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisibleMatchLimit(soccerTopPicks.length)}
                    className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white border border-[#30363d] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Mostrar todos ({soccerTopPicks.length})</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 🔴 EN VIVO */}
      {mainTab === 'LIVE' && !isLoading && (
        <div key="tab-live" className="space-y-3 animate-tab-content">
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-rose-500/30 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-white">
                Partidos en Juego en Directo ({soccerLiveFixtures.length})
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-rose-400 font-semibold">
              Pulso en tiempo real
            </span>
          </div>

          {soccerLiveFixtures.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-2 shadow-md">
              <Clock className="w-8 h-8 text-[#8b949e] mx-auto mb-1" strokeWidth={2} />
              <p className="text-sm font-bold text-white">No hay partidos en juego en este instante</p>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                El pulso en vivo actualizará los marcadores automáticamente tan pronto ruede el balón.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => onSelectMainTab('TOP_PICKS')}
                  className="px-3.5 py-2 rounded-xl bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Ver Top Picks de Hoy
                </button>
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-3.5 py-2 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white text-xs font-semibold cursor-pointer border border-[#30363d]"
                >
                  Ver Cartelera Completa
                </button>
              </div>
            </div>
          ) : densityView === 'COMPACT' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {soccerLiveFixtures.map((fixture, idx, arr) => {
                const matchAnalysis = analysesMap[fixture.id] || calculateMatchAnalysis(fixture);
                return (
                  <CompactMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={matchAnalysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={onToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => onToggleCardExpand(fixture.id)}
                    onOpenDetail={onOpenSoccerDetail}
                    onOpenSimulator={onOpenSimulator}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                    isFavorite={favoriteFixtureIds.has(fixture.id)}
                    onToggleFavorite={onToggleFavorite}
                    isFullWidthDesktop={arr.length % 2 === 1 && idx === arr.length - 1}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {soccerLiveFixtures.map((fixture) => {
                const matchAnalysis = analysesMap[fixture.id] || calculateMatchAnalysis(fixture);
                return (
                  <FriendlyPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={matchAnalysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={onToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => onToggleCardExpand(fixture.id)}
                    onOpenDetail={onOpenSoccerDetail}
                    onOpenSimulator={onOpenSimulator}
                    viewMode={viewMode}
                    mobileLightweight={isLightweightMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 🌐 CARTELERA COMPLETA (ORGANIZADA POR COMPETICIONES) */}
      {mainTab === 'ALL_LEAGUES' && !isLoading && filteredFixtures.length > 0 && (
        <div key={`tab-all-leagues-${selectedLeague}`} className="space-y-2.5 sm:space-y-4 animate-tab-content">
          {groupedFilteredFixtures.map((group) => (
            <CompetitionBlock
              key={group.key}
              group={group}
              analysesMap={analysesMap}
              selectedFixtureIds={selectedFixtureIds}
              expandedCardIds={expandedCardIds}
              isGroupCollapsed={
                Boolean(searchQuery.trim()) || selectedLeague !== 'ALL' || groupedFilteredFixtures.length === 1
                  ? false
                  : collapsedGroupKeys.has(group.key)
              }
              viewMode={viewMode}
              isLightweightMode={isLightweightMode}
              densityView={densityView}
              recentlyUpdatedIds={recentlyUpdatedFixtureIds}
              onToggleGroupCollapse={onToggleGroupCollapse}
              onToggleSelectFixture={onToggleSelect}
              onToggleSelectGroupFixtures={onToggleSelectGroupFixtures}
              onOpenSimulator={onOpenSimulator}
              onToggleCardExpand={onToggleCardExpand}
              onOpenDetailModal={onOpenSoccerDetail}
              onSelectSpotlight={onSelectSpotlight}
              activeSpotlightFixtureId={activeSpotlightFixtureId}
              favoriteFixtureIds={favoriteFixtureIds}
              onToggleFavoriteFixture={onToggleFavorite}
            />
          ))}

          {/* Progressive Batch Loading Controls */}
          {filteredFixtures.length > displayFixtures.length && (
            <div className="pt-2 flex flex-row items-center justify-center gap-2">
              {filteredFixtures.length - displayFixtures.length > 10 && (
                <button
                  type="button"
                  onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                  className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white text-xs font-semibold transition-all border border-[#30363d] shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ver 10 más</span>
                  <span className="font-mono text-[10px] opacity-85">
                    ({displayFixtures.length}/{filteredFixtures.length})
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setVisibleMatchLimit(filteredFixtures.length)}
                className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white border border-[#30363d] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Mostrar todos ({filteredFixtures.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🌐 BUSCADOR GLOBAL MULTIFECHA (PRÓXIMOS 5 DÍAS) */}
      {searchQuery.trim().length >= 2 && crossDaySearchMatches.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="px-3.5 py-2.5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-md flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#d9b114] shrink-0" strokeWidth={2} />
              <span className="text-xs font-bold text-white">
                {filteredFixtures.length === 0
                  ? `No juega en la fecha actual (${currentDate}), pero encontramos ${crossDaySearchMatches.length} ${crossDaySearchMatches.length === 1 ? 'partido' : 'partidos'} en otras fechas:`
                  : `Más partidos de "${searchQuery.trim()}" en los próximos 5 días (${crossDaySearchMatches.length}):`}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#d9b114] bg-[#d9b114]/15 px-2 py-0.5 rounded-md border border-[#d9b114]/40">
              Calendario 5 Días
            </span>
          </div>

          <div className="space-y-2">
            {crossDaySearchMatches.map(({ dateStr, dateLabel, fixture, analysis }) => (
              <div key={`${dateStr}-${fixture.id}`} className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200 bg-[#161b22] px-2.5 py-0.5 rounded-lg border border-[#30363d] shadow-2xs">
                    <Calendar className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                    <span>{dateLabel}</span>
                    <span className="text-[#30363d]">·</span>
                    <span className="font-mono tabular-nums text-[#8b949e]">{dateStr}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSmartDateChange(dateStr)}
                    className="text-[11px] font-bold text-[#d9b114] hover:text-white bg-[#0b0e14] hover:bg-[#1c2129] px-2.5 py-0.5 rounded-lg border border-[#30363d] transition-colors cursor-pointer"
                  >
                    Ir a {dateLabel} &rarr;
                  </button>
                </div>
                <CompactMatchRow
                  fixture={fixture}
                  analysis={analysis}
                  isSelected={selectedFixtureIds.has(fixture.id)}
                  onToggleSelect={onToggleSelect}
                  isExpanded={expandedCardIds.has(fixture.id)}
                  onToggleExpand={() => onToggleCardExpand(fixture.id)}
                  onOpenDetail={onOpenSoccerDetail}
                  onSelectSpotlight={onSelectSpotlight}
                  isSpotlightActive={activeSpotlightFixtureId === fixture.id}
                  onOpenSimulator={onOpenSimulator}
                  viewMode={viewMode}
                  isRecentlyUpdated={false}
                  isFavorite={favoriteFixtureIds.has(fixture.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
});
