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
  onSelectNBASpotlight?: (fixture: NBAMatchFixture, analysis: NBAAnalysis) => void;
  activeSpotlightFixtureId?: string | null;
  isSpotlightOpen?: boolean;
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
  onSelectNBASpotlight,
  activeSpotlightFixtureId,
  isSpotlightOpen = false,
  onClearNBAFilters
}) => {
  const hasSelection = selectedFixtureIds.size > 0;

  return (
    <main
      className={`flex-1 min-w-0 w-full space-y-4 transition-all duration-300 ease-out ${
        isSpotlightOpen ? 'xl:max-w-none' : 'max-w-5xl mx-auto'
      }`}
    >
      {/* Results Bar NBA */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-md text-xs text-[#8b949e] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono tabular-nums tracking-tight font-bold text-white">
            {isNBALoading ? 'Calculando proyecciones...' : `${filteredNBAFixtures.length} partidos de Baloncesto`}
          </span>
          {hasSelection && (
            <>
              <span className="text-[#30363d]" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-bold text-[#d9b114]">
                {selectedFixtureIds.size} seleccionados
              </span>
            </>
          )}
          {filteredNBAFixtures.some((f) => f.status === 'IN_PLAY') && (
            <>
              <span className="text-[#30363d]" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-rose-500 font-mono tabular-nums font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
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
                ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] shadow-2xs font-bold'
                : 'bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] hover:text-[#d9b114] border-[#30363d]'
            }`}
            title="Ver solo mis partidos favoritos de Baloncesto"
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-slate-950 text-slate-950' : 'text-[#d9b114]'}`} strokeWidth={2} />
            <span>Favoritos</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[#161b22] text-white">
              {nbaFixtures.filter((f) => favoriteFixtureIds.has(f.id)).length}
            </span>
          </button>

          {filteredNBAFixtures.length > 0 && (
            <button
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-slate-300 hover:text-white transition-colors border border-[#30363d] cursor-pointer text-xs font-medium"
            >
              {selectedFixtureIds.size === filteredNBAFixtures.length ? (
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

      {/* Loading State Unificado G METRICS */}
      {isNBALoading && (
        <div className="py-16 px-4 text-center flex flex-col items-center justify-center bg-[#0b0e14]/90 rounded-2xl border border-[#30363d] shadow-md select-none">
          <img
            src="/icon.png?v=4"
            alt="G METRICS"
            className="w-16 h-16 object-contain mb-3 drop-shadow-[0_0_16px_rgba(217,177,20,0.45)]"
          />
          <div className="gmetrics-dark-pulse">G METRICS</div>
          <p className="mt-2 text-xs text-[#8b949e] font-medium">
            Calculando ritmo de posesiones, cuartos y proyecciones NBA...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isNBALoading && filteredNBAFixtures.length === 0 && (
        <div className="py-14 px-6 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-3 shadow-md">
          <div className="w-12 h-12 bg-[#0b0e14] border border-[#30363d] rounded-full flex items-center justify-center mx-auto text-[#d9b114] text-xl">
            🏀
          </div>
          <h3 className="text-base font-bold text-white">
            {nbaFixtures.length > 0
              ? 'No se encontraron partidos de Baloncesto con este filtro'
              : 'No hay partidos de Baloncesto programados para esta fecha'}
          </h3>
          <p className="text-xs text-[#8b949e] max-w-sm mx-auto">
            {nbaFixtures.length > 0
              ? `Hay ${nbaFixtures.length} partidos oficiales de Baloncesto en esta fecha. Prueba cambiando la conferencia en el menú lateral.`
              : 'El calendario oficial de Baloncesto no reporta partidos para esta fecha. Explora los próximos días en el selector de 5 días.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={onClearNBAFilters}
              className="px-4 py-2 text-xs font-bold bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 rounded-xl transition-colors cursor-pointer"
            >
              {nbaFixtures.length > 0 ? `Ver todos (${nbaFixtures.length})` : 'Limpiar filtros'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: 🔥 BALONCESTO TOP PICKS */}
      {mainTab === 'TOP_PICKS' && !isNBALoading && (
        <div className="space-y-3">
          <div className="px-4 py-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md text-center space-y-1 backdrop-blur-md">
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] text-[10px] font-mono uppercase tracking-wider font-bold">
              <Flame className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              <span>Top Picks Baloncesto · {nbaTopPicks.length} Oportunidades</span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Pronósticos Destacados de Baloncesto (&ge;68% y +EV)
            </h2>
            <p className="text-[11px] text-[#8b949e] max-w-lg mx-auto">
              Encuentros seleccionados y ordenados por mayor ventaja probabilística en Moneyline, Hándicap o Puntos.
            </p>
          </div>

          {nbaTopPicks.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-2 shadow-md">
              <Sparkles className="w-8 h-8 text-[#8b949e] mx-auto mb-1" strokeWidth={2} />
              <p className="text-sm font-bold text-white">No hay apuestas NBA con filtro verde en este momento</p>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                Explora la Cartelera Completa para ver todos los encuentros y props de jugadores.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onSelectMainTab('ALL_LEAGUES')}
                  className="px-4 py-2 rounded-xl bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ver Cartelera NBA Completa
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {nbaTopPicks.slice(0, visibleMatchLimit).map(({ fixture, analysis }, idx, arr) => (
                <CompactNBAMatchRow
                  key={fixture.id}
                  fixture={fixture}
                  analysis={analysis!}
                  isSelected={selectedFixtureIds.has(fixture.id)}
                  onToggleSelect={onToggleSelect}
                  isExpanded={expandedCardIds.has(fixture.id)}
                  onToggleExpand={() => onToggleCardExpand(fixture.id)}
                  onOpenDetail={onOpenNBADetail}
                  onSelectSpotlight={onSelectNBASpotlight}
                  isSpotlightActive={activeSpotlightFixtureId === fixture.id}
                  viewMode={viewMode}
                  isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  isFavorite={favoriteFixtureIds.has(fixture.id)}
                  onToggleFavorite={onToggleFavorite}
                  isFullWidthDesktop={arr.length % 2 === 1 && idx === arr.length - 1}
                />
              ))}

              {nbaTopPicks.length > visibleMatchLimit && (
                <div className="md:col-span-2 pt-2 flex flex-row items-center justify-center gap-2">
                  {nbaTopPicks.length - visibleMatchLimit > 10 && (
                    <button
                      type="button"
                      onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                      className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white text-xs font-semibold shadow-md transition-all border border-[#30363d] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Ver 10 más</span>
                      <span className="font-mono text-[10px] opacity-85">
                        ({Math.min(visibleMatchLimit, nbaTopPicks.length)}/{nbaTopPicks.length})
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVisibleMatchLimit(nbaTopPicks.length)}
                    className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white border border-[#30363d] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Mostrar todos ({nbaTopPicks.length})</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
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
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-rose-500/30 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-white">
                Duelos en Directo de Baloncesto ({nbaLiveFixtures.length})
              </span>
            </div>
          </div>

          {nbaLiveFixtures.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-2 shadow-md">
              <Clock className="w-8 h-8 text-[#8b949e] mx-auto mb-1" strokeWidth={2} />
              <p className="text-sm font-bold text-white">No hay partidos de Baloncesto en juego en este momento</p>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                La jornada de Baloncesto se actualizará cuarto a cuarto en vivo aquí.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => onSelectMainTab('TOP_PICKS')}
                  className="px-3.5 py-2 rounded-xl bg-[#d9b114] hover:bg-[#e6be20] text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ver Top Picks Baloncesto
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
              {nbaLiveFixtures.map((fixture, idx, arr) => {
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
                    onSelectSpotlight={onSelectNBASpotlight}
                    isSpotlightActive={activeSpotlightFixtureId === fixture.id}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredNBAFixtures.slice(0, visibleMatchLimit).map((fixture, idx, arr) => {
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
                onSelectSpotlight={onSelectNBASpotlight}
                isSpotlightActive={activeSpotlightFixtureId === fixture.id}
                viewMode={viewMode}
                isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                isFavorite={favoriteFixtureIds.has(fixture.id)}
                onToggleFavorite={onToggleFavorite}
                isFullWidthDesktop={arr.length % 2 === 1 && idx === arr.length - 1}
              />
            );
          })}

          {filteredNBAFixtures.length > visibleMatchLimit && (
            <div className="md:col-span-2 pt-2 flex flex-row items-center justify-center gap-2">
              {filteredNBAFixtures.length - visibleMatchLimit > 10 && (
                <button
                  type="button"
                  onClick={() => setVisibleMatchLimit((prev) => prev + 10)}
                  className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white text-xs font-semibold shadow-md transition-all border border-[#30363d] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ver 10 más</span>
                  <span className="font-mono text-[10px] opacity-85">
                    ({Math.min(visibleMatchLimit, filteredNBAFixtures.length)}/{filteredNBAFixtures.length})
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setVisibleMatchLimit(filteredNBAFixtures.length)}
                className="flex-1 sm:flex-initial min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white border border-[#30363d] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Mostrar todos ({filteredNBAFixtures.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
