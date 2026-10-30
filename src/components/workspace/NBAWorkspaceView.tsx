import React from 'react';
import {
  ChevronDown,
  CheckSquare,
  Square,
  Clock,
  Sparkles,
  Flame,
  Star
} from 'lucide-react';
import { NBAMatchFixture, NBAAnalysis } from '../../types';
import { calculateNBAAnalysis } from '../../services/nbaEngine';
import { CompactNBAMatchRow } from '../CompactNBAMatchRow';
import { NBAPredictionCard } from '../NBAPredictionCard';

interface NBATopPickItem {
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
  advice: any;
}

interface NBAWorkspaceViewProps {
  isNBALoading: boolean;
  nbaFixtures: NBAMatchFixture[];
  filteredNBAFixtures: NBAMatchFixture[];
  nbaAnalysesMap: Record<string, NBAAnalysis>;
  nbaTopPicks: NBATopPickItem[];
  nbaLiveFixtures: NBAMatchFixture[];
  mainTab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE';
  onSelectMainTab: (tab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE') => void;
  selectedFixtureIds: Set<string>;
  onToggleSelect: (fixtureId: string) => void;
  onSelectAll: () => void;
  expandedCardIds: Set<string>;
  onToggleCardExpand: (fixtureId: string) => void;
  favoriteFixtureIds: Set<string>;
  onToggleFavorite: (fixtureId: string) => void;
  showFavoritesOnly: boolean;
  onToggleShowFavoritesOnly: () => void;
  visibleMatchLimit: number;
  setVisibleMatchLimit: React.Dispatch<React.SetStateAction<number>>;
  viewMode: 'SIMPLE' | 'EXPERT';
  densityView: 'CARDS' | 'COMPACT';
  recentlyUpdatedFixtureIds: Set<string>;
  onOpenNBADetail: (fixture: NBAMatchFixture, analysis: NBAAnalysis) => void;
  onClearNBAFilters: () => void;
}

export const NBAWorkspaceView: React.FC<NBAWorkspaceViewProps> = ({
  isNBALoading,
  nbaFixtures,
  filteredNBAFixtures,
  nbaAnalysesMap,
  nbaTopPicks,
  nbaLiveFixtures,
  mainTab,
  onSelectMainTab,
  selectedFixtureIds,
  onToggleSelect,
  onSelectAll,
  expandedCardIds,
  onToggleCardExpand,
  favoriteFixtureIds,
  onToggleFavorite,
  showFavoritesOnly,
  onToggleShowFavoritesOnly,
  visibleMatchLimit,
  setVisibleMatchLimit,
  viewMode,
  densityView,
  recentlyUpdatedFixtureIds,
  onOpenNBADetail,
  onClearNBAFilters
}) => {
  const hasSelection = selectedFixtureIds.size > 0;

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Results Bar NBA */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/95 border border-slate-200/90 shadow-2xs text-xs text-slate-600 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono tabular-nums tracking-tight font-bold text-slate-900">
            {isNBALoading ? 'Calculando proyecciones...' : `${filteredNBAFixtures.length} partidos de Baloncesto`}
          </span>
          {hasSelection && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-bold text-amber-700">
                {selectedFixtureIds.size} seleccionados
              </span>
            </>
          )}
          {filteredNBAFixtures.some((f) => f.status === 'IN_PLAY') && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-mono tabular-nums font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <span>En Vivo</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleShowFavoritesOnly}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors border cursor-pointer text-xs font-bold ${
              showFavoritesOnly
                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                : 'bg-amber-50/90 hover:bg-amber-100 text-amber-800 border-amber-200/90'
            }`}
            title="Ver solo mis partidos favoritos de Baloncesto"
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-500'}`} />
            <span>Favoritos</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-white/80 text-slate-900">
              {nbaFixtures.filter((f) => favoriteFixtureIds.has(f.id)).length}
            </span>
          </button>

          {filteredNBAFixtures.length > 0 && (
            <button
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200/80 cursor-pointer text-xs font-medium"
            >
              {selectedFixtureIds.size === filteredNBAFixtures.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
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

      {/* Loading State */}
      {isNBALoading && (
        <div className="py-16 text-center space-y-3 bg-white/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-700 font-semibold">
            Calculando ritmo de posesiones, cuartos y probabilidades de jugadores...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isNBALoading && filteredNBAFixtures.length === 0 && (
        <div className="py-14 px-6 text-center bg-white/95 rounded-2xl border border-slate-200/90 space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-amber-600 text-xl">
            🏀
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {nbaFixtures.length > 0
              ? 'No se encontraron partidos de Baloncesto con este filtro'
              : 'No hay partidos de Baloncesto programados para esta fecha'}
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            {nbaFixtures.length > 0
              ? `Hay ${nbaFixtures.length} partidos oficiales de Baloncesto en esta fecha. Prueba cambiando la conferencia en el menú lateral.`
              : 'El calendario oficial de Baloncesto no reporta partidos para esta fecha. Explora los próximos días en el selector de 5 días.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={onClearNBAFilters}
              className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors cursor-pointer"
            >
              {nbaFixtures.length > 0 ? `Ver todos (${nbaFixtures.length})` : 'Limpiar filtros'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: 🔥 BALONCESTO TOP PICKS */}
      {mainTab === 'TOP_PICKS' && !isNBALoading && (
        <div className="space-y-3">
          <div className="px-4 py-3.5 rounded-2xl bg-gradient-to-b from-amber-50/95 via-white/95 to-white/95 border border-amber-300/90 shadow-xs text-center space-y-1 backdrop-blur-md">
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/90 border border-amber-200 text-amber-800 text-[10px] font-mono uppercase tracking-wider font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
              <span>Top Picks Baloncesto · {nbaTopPicks.length} Oportunidades</span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Pronósticos Destacados de Baloncesto (&ge;68% y +EV)
            </h2>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              Encuentros seleccionados y ordenados por mayor ventaja probabilística en Moneyline, Hándicap o Puntos.
            </p>
          </div>

          {nbaTopPicks.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white/95 rounded-2xl border border-slate-200/90 space-y-2 shadow-2xs">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-900">No hay apuestas NBA con filtro verde en este momento</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Explora la Cartelera Completa para ver todos los encuentros y props de jugadores.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ver Cartelera NBA Completa
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {nbaTopPicks.slice(0, visibleMatchLimit).map(({ fixture, analysis }) => (
                <CompactNBAMatchRow
                  key={fixture.id}
                  fixture={fixture}
                  analysis={analysis!}
                  isSelected={selectedFixtureIds.has(fixture.id)}
                  onToggleSelect={onToggleSelect}
                  isExpanded={expandedCardIds.has(fixture.id)}
                  onToggleExpand={() => onToggleCardExpand(fixture.id)}
                  onOpenDetail={onOpenNBADetail}
                  viewMode={viewMode}
                  isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  isFavorite={favoriteFixtureIds.has(fixture.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}

              {nbaTopPicks.length > visibleMatchLimit && (
                <div className="pt-2 flex flex-row items-center justify-center gap-2">
                  {nbaTopPicks.length - visibleMatchLimit > 10 && (
                    <button
                      type="button"
                      onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                      className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Ver 10 más</span>
                      <span className="font-mono text-[10px] opacity-85">
                        ({Math.min(visibleMatchLimit, nbaTopPicks.length)}/{nbaTopPicks.length})
                      </span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisibleMatchLimit(nbaTopPicks.length)}
                    className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      nbaTopPicks.length - visibleMatchLimit <= 10
                        ? 'w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-2xs'
                        : 'flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90'
                    }`}
                  >
                    <span>Mostrar todos ({nbaTopPicks.length})</span>
                    {nbaTopPicks.length - visibleMatchLimit <= 10 && (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 🔴 NBA EN VIVO */}
      {mainTab === 'LIVE' && !isNBALoading && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-white/95 border border-rose-200/90 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span className="text-xs font-bold text-slate-900">
                Duelos en Directo de Baloncesto ({nbaLiveFixtures.length})
              </span>
            </div>
          </div>

          {nbaLiveFixtures.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white/95 rounded-2xl border border-slate-200/90 space-y-2 shadow-2xs">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-900">No hay partidos de Baloncesto en juego en este momento</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                La jornada de Baloncesto se actualizará cuarto a cuarto en vivo aquí.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => onSelectMainTab('TOP_PICKS')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ver Top Picks Baloncesto
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
              {nbaLiveFixtures.map((fixture) => {
                const nbaAnalysis = nbaAnalysesMap[fixture.id] || calculateNBAAnalysis(fixture);
                return (
                  <CompactNBAMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={nbaAnalysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={onToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => onToggleCardExpand(fixture.id)}
                    onOpenDetail={onOpenNBADetail}
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
              {nbaLiveFixtures.map((fixture) => {
                const nbaAnalysis = nbaAnalysesMap[fixture.id] || calculateNBAAnalysis(fixture);
                return (
                  <NBAPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={nbaAnalysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={onToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => onToggleCardExpand(fixture.id)}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 🌐 CARTELERA NBA COMPLETA */}
      {mainTab === 'ALL_LEAGUES' && !isNBALoading && filteredNBAFixtures.length > 0 && (
        <div className="space-y-2">
          {filteredNBAFixtures.slice(0, visibleMatchLimit).map((fixture) => {
            const analysis = nbaAnalysesMap[fixture.id];
            if (!analysis) return null;
            return (
              <CompactNBAMatchRow
                key={fixture.id}
                fixture={fixture}
                analysis={analysis}
                isSelected={selectedFixtureIds.has(fixture.id)}
                onToggleSelect={onToggleSelect}
                isExpanded={expandedCardIds.has(fixture.id)}
                onToggleExpand={() => onToggleCardExpand(fixture.id)}
                onOpenDetail={onOpenNBADetail}
                viewMode={viewMode}
                isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                isFavorite={favoriteFixtureIds.has(fixture.id)}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}

          {filteredNBAFixtures.length > visibleMatchLimit && (
            <div className="pt-2 flex flex-row items-center justify-center gap-2">
              {filteredNBAFixtures.length - visibleMatchLimit > 10 && (
                <button
                  type="button"
                  onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                  className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ver 10 más</span>
                  <span className="font-mono text-[10px] opacity-85">
                    ({Math.min(visibleMatchLimit, filteredNBAFixtures.length)}/{filteredNBAFixtures.length})
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setVisibleMatchLimit(filteredNBAFixtures.length)}
                className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  filteredNBAFixtures.length - visibleMatchLimit <= 10
                    ? 'w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-2xs'
                    : 'flex-1 sm:flex-initial bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90'
                }`}
              >
                <span>Mostrar todos ({filteredNBAFixtures.length})</span>
                {filteredNBAFixtures.length - visibleMatchLimit <= 10 && (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
