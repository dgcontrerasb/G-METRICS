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
  onOpenSimulator: (fixture: MatchFixture) => void;
}

export const SoccerWorkspaceView: React.FC<SoccerWorkspaceViewProps> = ({
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
  onOpenSimulator
}) => {
  const hasSelection = selectedFixtureIds.size > 0;

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Contextual Toolbar: Metrics & View Density Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/95 border border-slate-200/90 shadow-2xs text-xs text-slate-600 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono tabular-nums tracking-tight font-bold text-slate-900">
            {isLoading ? 'Buscando partidos...' : `${filteredFixtures.length} partidos`}
          </span>
          {!isLoading && availableCompetitionGroups.length > 0 && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                {selectedLeague === 'ALL' && !searchQuery.trim()
                  ? `${availableCompetitionGroups.length} ${availableCompetitionGroups.length === 1 ? 'competición' : 'competiciones'}`
                  : `${groupedFilteredFixtures.length} ${groupedFilteredFixtures.length === 1 ? 'competición' : 'competiciones'}`}
              </span>
            </>
          )}
          {hasSelection && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-bold text-emerald-700">
                {selectedFixtureIds.size} seleccionados
              </span>
            </>
          )}
          {filteredFixtures.some((f) => f.status === 'IN_PLAY') && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSelectMainTab('LIVE')}
                className="inline-flex items-center gap-1.5 text-rose-600 font-mono tabular-nums font-bold text-xs cursor-pointer hover:underline"
              >
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <span>{soccerLiveFixtures.length} En Vivo</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Favorites Quick Filter Button */}
          <button
            type="button"
            onClick={onToggleShowFavoritesOnly}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors border cursor-pointer text-xs font-bold ${
              showFavoritesOnly
                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                : 'bg-amber-50/90 hover:bg-amber-100 text-amber-800 border-amber-200/90'
            }`}
            title="Ver solo mis partidos favoritos con alertas de gol en vivo"
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-500'}`} />
            <span>Favoritos</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-white/80 text-slate-900">
              {fixtures.filter((f) => favoriteFixtureIds.has(f.id)).length}
            </span>
          </button>

          {/* Toggle all league blocks */}
          {groupedFilteredFixtures.length > 1 && mainTab === 'ALL_LEAGUES' && (
            <button
              onClick={onToggleAllGroupsCollapse}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200/80 cursor-pointer text-xs font-medium"
              title={groupedFilteredFixtures.every((g) => collapsedGroupKeys.has(g.key)) ? 'Desplegar todas las ligas' : 'Colapsar todas las ligas'}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">
                {groupedFilteredFixtures.every((g) => collapsedGroupKeys.has(g.key)) ? 'Desplegar ligas' : 'Colapsar ligas'}
              </span>
            </button>
          )}

          {/* Select all button */}
          {filteredFixtures.length > 0 && (
            <button
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200/80 cursor-pointer text-xs font-medium"
            >
              {selectedFixtureIds.size === filteredFixtures.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Deseleccionar</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>Seleccionar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Banner de Filtro Activo por Liga */}
      {selectedLeague !== 'ALL' && mainTab === 'ALL_LEAGUES' && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/95 border border-emerald-300 text-slate-800 text-xs shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Competición activa: <strong className="text-slate-900 font-bold">{activeLeagueLabel}</strong> ({filteredFixtures.length} {filteredFixtures.length === 1 ? 'partido' : 'partidos'})
            </span>
          </div>
          <button
            onClick={() => onSelectLeague('ALL')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200 text-xs transition-colors flex items-center gap-1 cursor-pointer"
            title="Ver todas las ligas del día"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
            <span>Ver todas</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center space-y-3 bg-white/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-700 font-semibold">
            Consultando programación oficial y calculando probabilidades...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredFixtures.length === 0 && crossDaySearchMatches.length === 0 && (
        <div className="py-12 px-6 text-center bg-white/95 border border-slate-200/90 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isSearchingOtherDays
                ? `Buscando "${searchQuery.trim()}" en los próximos 5 días...`
                : fixtures.length > 0
                  ? 'Sin partidos en esta fecha para tu búsqueda'
                  : 'No hay partidos programados en esta fecha'}
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
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
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Ver todos los partidos ({fixtures.length})
              </button>
            )}
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(1))}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Ver Mañana
            </button>
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(2))}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Ver +2 Días
            </button>
            <button
              onClick={() => onSmartDateChange(getColombiaDateString(3))}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Ver +3 Días
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: 🔥 TOP PICKS / JOYAS DEL DÍA */}
      {mainTab === 'TOP_PICKS' && !isLoading && (
        <div className="space-y-3">
          <div className="px-4 py-3.5 rounded-2xl bg-gradient-to-b from-emerald-50/95 via-white/95 to-white/95 border border-emerald-300/90 shadow-xs text-center space-y-1 backdrop-blur-md">
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/90 border border-emerald-200 text-emerald-800 text-[10px] font-mono uppercase tracking-wider font-bold">
              <Flame className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500/20" />
              <span>Top Picks del Día · {soccerTopPicks.length} Oportunidades</span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Pronósticos Destacados de Mayor Certeza (&ge;68%) y Valor (+EV)
            </h2>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              Partidos filtrados automáticamente y ordenados de mayor a menor probabilidad estadística.
            </p>
          </div>

          {soccerTopPicks.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white/95 rounded-2xl border border-slate-200/90 space-y-2 shadow-2xs">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-900">No hay apuestas con filtro verde (&ge;68%) en este momento</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Explora la Cartelera Completa en el menú lateral o selecciona otra fecha próxima.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Ver Cartelera Completa
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {soccerTopPicks.slice(0, visibleMatchLimit).map(({ fixture, analysis }) => (
                <CompactMatchRow
                  key={fixture.id}
                  fixture={fixture}
                  analysis={analysis!}
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
                />
              ))}

              {soccerTopPicks.length > visibleMatchLimit && (
                <div className="pt-2 flex flex-row items-center justify-center gap-2">
                  {soccerTopPicks.length - visibleMatchLimit > 10 && (
                    <button
                      type="button"
                      onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                      className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Ver 10 más</span>
                      <span className="font-mono text-[10px] opacity-85">
                        ({Math.min(visibleMatchLimit, soccerTopPicks.length)}/{soccerTopPicks.length})
                      </span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisibleMatchLimit(soccerTopPicks.length)}
                    className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      soccerTopPicks.length - visibleMatchLimit <= 10
                        ? 'w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        : 'flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90'
                    }`}
                  >
                    <span>Mostrar todos ({soccerTopPicks.length})</span>
                    {soccerTopPicks.length - visibleMatchLimit <= 10 && (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 🔴 EN VIVO */}
      {mainTab === 'LIVE' && !isLoading && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-white/95 border border-rose-200/90 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span className="text-xs font-bold text-slate-900">
                Partidos en Juego en Directo ({soccerLiveFixtures.length})
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-rose-700 font-semibold">
              Pulso en tiempo real
            </span>
          </div>

          {soccerLiveFixtures.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white/95 rounded-2xl border border-slate-200/90 space-y-2 shadow-2xs">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-900">No hay partidos en juego en este instante</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                El pulso en vivo actualizará los marcadores automáticamente tan pronto ruede el balón.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => onSelectMainTab('TOP_PICKS')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Ver Top Picks de Hoy
                </button>
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Ver Cartelera Completa
                </button>
              </div>
            </div>
          ) : densityView === 'COMPACT' ? (
            <div className="space-y-2">
              {soccerLiveFixtures.map((fixture) => {
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
        <div className="space-y-4">
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
                  className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ver 10 más</span>
                  <span className="font-mono text-[10px] opacity-85">
                    ({displayFixtures.length}/{filteredFixtures.length})
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setVisibleMatchLimit(filteredFixtures.length)}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  filteredFixtures.length - displayFixtures.length <= 10
                    ? 'w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                    : 'flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90'
                }`}
              >
                <span>Mostrar todos ({filteredFixtures.length})</span>
                {filteredFixtures.length - displayFixtures.length <= 10 && (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🌐 BUSCADOR GLOBAL MULTIFECHA (PRÓXIMOS 5 DÍAS) */}
      {searchQuery.trim().length >= 2 && crossDaySearchMatches.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/95 border border-emerald-300/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-slate-900">
                {filteredFixtures.length === 0
                  ? `No juega en la fecha actual (${currentDate}), pero encontramos ${crossDaySearchMatches.length} ${crossDaySearchMatches.length === 1 ? 'partido' : 'partidos'} en otras fechas:`
                  : `Más partidos de "${searchQuery.trim()}" en los próximos 5 días (${crossDaySearchMatches.length}):`}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
              Calendario 5 Días
            </span>
          </div>

          <div className="space-y-2">
            {crossDaySearchMatches.map(({ dateStr, dateLabel, fixture, analysis }) => (
              <div key={`${dateStr}-${fixture.id}`} className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 bg-white/95 px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span>{dateLabel}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600">{dateStr}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSmartDateChange(dateStr)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white/95 hover:bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
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
};
