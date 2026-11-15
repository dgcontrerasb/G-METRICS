import React from 'react';
import { NBAMatchFixture, NBAAnalysis } from '../types';
import { Check, BarChart2, Star, Flame, Ticket } from 'lucide-react';
import { NBAPredictionCard } from './NBAPredictionCard';
import { formatCompactTeamName } from '../services/leagueCategorizer';
import { evaluateNBAMarketsLiveStatus } from '../services/nbaEngine';
import { useParlay } from '../context/ParlayContext';

interface CompactNBAMatchRowProps {
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (fixtureId: string) => void;
  isExpanded?: boolean;
  onToggleExpand: () => void;
  onOpenDetail?: (fixture: NBAMatchFixture, analysis: NBAAnalysis) => void;
  onSelectSpotlight?: (fixture: NBAMatchFixture, analysis: NBAAnalysis) => void;
  isSpotlightActive?: boolean;
  viewMode?: 'SIMPLE' | 'EXPERT';
  isRecentlyUpdated?: boolean;
  isFullWidthDesktop?: boolean;
}

export const CompactNBAMatchRow: React.FC<CompactNBAMatchRowProps> = React.memo(({
  fixture,
  analysis,
  isSelected = false,
  onToggleSelect,
  isFavorite = false,
  onToggleFavorite,
  isExpanded = false,
  onToggleExpand,
  onOpenDetail,
  onSelectSpotlight,
  isSpotlightActive = false,
  viewMode = 'SIMPLE',
  isRecentlyUpdated = false,
  isFullWidthDesktop = false
}) => {
  const { isPickInParlay, togglePick } = useParlay();
  const { homeTeam, awayTeam, status } = fixture;
  const isLive = status === 'IN_PLAY';
  const isFinished = status === 'FINISHED';
  if (!analysis) return null;
  const isValueBet = Boolean(analysis?.marketOdds?.valueBetDetected);
  const hasStarted = (isLive || isFinished) && Boolean(fixture.currentScore);
  const evaluatedMarkets = hasStarted ? evaluateNBAMarketsLiveStatus(fixture, analysis) : [];
  const hitsCount = evaluatedMarkets.filter((m) => m.isHit).length;
  const mainPickHit = evaluatedMarkets[0]?.isHit ?? false;
  const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? homeTeam : awayTeam;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);
  const bestOdd = favProb > 50 ? Number((100 / favProb).toFixed(2)) : 1.90;
  const inParlay = isPickInParlay(fixture.id, 'NBA_ML');

  return (
    <div className={`transition-all duration-200 rounded-2xl overflow-hidden bg-[#161b22] border ${
      isFullWidthDesktop ? 'md:col-span-2' : ''
    } ${
      isRecentlyUpdated
        ? 'border-[#00ff66] ring-2 ring-[#00ff66]/60 shadow-lg'
        : isSpotlightActive
        ? 'border-[#d9b114] ring-2 ring-[#d9b114]/50 shadow-md bg-[#161b22]'
        : isSelected
        ? 'border-[#d9b114] ring-1 ring-[#d9b114]/40 bg-[#161b22]'
        : isValueBet
        ? 'border-[#00ff66]/50 hover:border-[#00ff66]'
        : 'border-[#30363d] hover:border-[#8b949e]/50 hover:bg-[#1c2129]'
    }`}>
      <div
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1280 && onSelectSpotlight) {
            onSelectSpotlight(fixture, analysis);
          } else if (onOpenDetail) {
            onOpenDetail(fixture, analysis);
          } else {
            onToggleExpand();
          }
        }}
        className={`px-3 sm:px-4 py-2 cursor-pointer select-none ${
          isFullWidthDesktop
            ? 'flex flex-col gap-1.5 md:grid md:grid-cols-[1.08fr_1fr] md:items-center md:gap-4'
            : 'flex flex-col gap-1.5'
        }`}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* LÍNEA 1: EJE SIMÉTRICO 3 COLUMNAS (LOCAL · VS/MARCADOR · VISITANTE) */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
            {/* Columna 1: Local (Alineado a la derecha hacia el centro) */}
            <div className="flex items-center justify-end gap-1.5 min-w-0 text-right">
              <span
                className="font-sans font-medium text-xs sm:text-[13px] tracking-tight text-white truncate"
                title={homeTeam.name}
              >
                {formatCompactTeamName(homeTeam.name)}
              </span>
              {homeTeam.logo?.trim() ? (
                <img
                  src={homeTeam.logo}
                  alt=""
                  className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>

            {/* Columna 2: Marcador Central Simétrico (100% centrado respecto a la tarjeta) */}
            <div className="px-2 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] font-mono tabular-nums font-semibold text-[11px] sm:text-xs shrink-0 whitespace-nowrap text-center min-w-[44px] flex items-center justify-center">
              {isLive || isFinished ? (
                <span className={isLive ? 'text-rose-400 font-bold' : 'text-white'}>
                  {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
                </span>
              ) : (
                <span className="text-[#8b949e] text-[10px] font-medium">VS</span>
              )}
            </div>

            {/* Columna 3: Visitante (Alineado a la izquierda desde el centro) */}
            <div className="flex items-center justify-start gap-1.5 min-w-0 text-left">
              {awayTeam.logo?.trim() ? (
                <img
                  src={awayTeam.logo}
                  alt=""
                  className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span
                className="font-sans font-medium text-xs sm:text-[13px] tracking-tight text-white truncate"
                title={awayTeam.name}
              >
                {formatCompactTeamName(awayTeam.name)}
              </span>
            </div>
          </div>

          {/* LÍNEA 2: HORA COMPACTA + PICK MÓVIL / LIGA PC + CUOTAS + FAVORITO + CHECKBOX */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-1 border-t border-[#21262d] text-[11px]">
            {/* Izquierda: Hora / Estado + Liga o Pick en Móvil */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {isRecentlyUpdated && (
                <span className="px-2 py-0.5 rounded-md bg-[#00ff66] text-slate-950 font-mono font-bold text-[9.5px] uppercase tracking-tight animate-bounce shrink-0 shadow-xs">
                  🏀 ¡PUNTOS! {fixture.currentScore ? `${fixture.currentScore.home}-${fixture.currentScore.away}` : ''}
                </span>
              )}
              {isLive ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-mono tabular-nums tracking-tight font-semibold text-[10px] animate-pulse border border-rose-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span>VIVO • {fixture.livePeriod === 'HT' ? 'MT' : fixture.livePeriod || 'Q1'}</span>
                </span>
              ) : isFinished ? (
                <span className="px-1.5 py-0.5 rounded bg-[#0b0e14] text-[#8b949e] font-mono tabular-nums text-[10px] font-medium border border-[#30363d] shrink-0">
                  FIN
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-[#0b0e14] text-[#8b949e] font-mono tabular-nums text-[10px] font-medium border border-[#30363d] shrink-0">
                  {fixture.time}
                </span>
              )}

              {hasStarted ? (
                <span
                  className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold border shrink-0 ${
                    mainPickHit
                      ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/40'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                  }`}
                  title="Estado de las apuestas pre-partido y props de jugadores"
                >
                  {mainPickHit ? '✅' : '❌'} {hitsCount}/6 <span className="hidden sm:inline">Mercados</span>
                </span>
              ) : (
                <span
                  className="inline-flex sm:hidden items-center gap-1 px-1.5 py-0.5 rounded bg-[#0b0e14] text-slate-300 border border-[#30363d] font-mono text-[9.5px] font-semibold truncate min-w-0"
                  title={`Gana ${favTeam.name} (${favProb}%)`}
                >
                  🏀 {favTeam.shortName || formatCompactTeamName(favTeam.name)} <strong className="font-mono tabular-nums text-white">{favProb}%</strong>
                </span>
              )}

              <span className="hidden sm:inline text-[#30363d] shrink-0">·</span>

              <span
                className="hidden sm:inline text-[11px] font-normal text-[#8b949e] truncate"
                title={`${fixture.league?.name || 'NBA'} · ${fixture.arena?.name || ''}`}
              >
                {fixture.league?.name || 'NBA'}
                {fixture.arena?.name ? ` · ${fixture.arena.name}` : ''}
              </span>
            </div>

            {/* Derecha: Botón Cuotas (compacto en móvil) + Estrella Favorito + Checkbox fino de 20px */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectSpotlight) onSelectSpotlight(fixture, analysis);
                  if (onOpenDetail) onOpenDetail(fixture, analysis);
                  else onToggleExpand();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0b0e14] hover:bg-[#1c2129] text-slate-300 hover:text-white border border-[#30363d] text-[10.5px] font-medium transition-colors shrink-0 cursor-pointer"
              >
                <BarChart2 className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span className="sm:hidden">Cuotas</span>
                <span className="hidden sm:inline">Ver Cuotas y Datos</span>
              </button>

              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(fixture.id);
                  }}
                  className={`w-6 h-6 rounded-md transition-colors cursor-pointer border flex items-center justify-center shrink-0 ${
                    isFavorite
                      ? 'bg-[#d9b114]/15 text-[#d9b114] border-[#d9b114]/50 shadow-2xs'
                      : 'bg-[#0b0e14] text-[#8b949e] hover:text-[#d9b114] hover:border-[#d9b114]/40 border-[#30363d]'
                  }`}
                  title={isFavorite ? 'Quitar de Favoritos (Alertas activas)' : 'Añadir a Favoritos para recibir alertas en vivo'}
                  aria-label={isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}
                >
                  <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#d9b114] text-[#d9b114]' : ''}`} strokeWidth={2} />
                </button>
              )}

              {onToggleSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(fixture.id);
                  }}
                  className={`w-5 h-5 rounded-md transition-colors cursor-pointer border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-[#d9b114] text-slate-950 border-[#d9b114]'
                      : 'bg-[#0b0e14] text-transparent hover:border-[#8b949e] border-[#30363d]'
                  }`}
                  title={isSelected ? 'Quitar de selección' : 'Seleccionar partido'}
                  aria-label={isSelected ? 'Quitar de selección' : 'Seleccionar partido'}
                >
                  <Check className={`w-3 h-3 ${isSelected ? 'text-slate-950 stroke-[2.5]' : 'opacity-0'}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TELEMETRÍA RÁPIDA NBA +EV (Opción 1: solo visible en PC cuando cierra fila en md:col-span-2) */}
        {isFullWidthDesktop && (
          <div className="hidden md:flex flex-col justify-between gap-1.5 pl-4 border-l border-[#21262d] min-w-0">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
              <span className="inline-flex items-center gap-1 font-bold text-slate-300 uppercase tracking-wider">
                <Flame className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>Telemetría Rápida NBA</span>
                {isValueBet && (
                  <span className="px-1.5 py-0.2 rounded bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/30 text-[9px] font-bold">
                    +EV
                  </span>
                )}
              </span>
              <span className="text-[#8b949e] tabular-nums">
                Pace: <strong className="text-white font-mono tabular-nums">{analysis.expectedPace}</strong> · Total:{' '}
                <strong className="text-white font-mono tabular-nums">{analysis.projectedTotalPoints} pts</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[10px]">
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e] truncate">
                {homeTeam.shortName || 'LOC'}: <strong className="text-white font-mono tabular-nums">{analysis.pHomeWin}%</strong>
              </div>
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e] truncate">
                O/{analysis.fairTotalLine}: <strong className="text-white font-mono tabular-nums">{analysis.overTotalProb}%</strong>
              </div>
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e] truncate">
                {awayTeam.shortName || 'VIS'}: <strong className="text-white font-mono tabular-nums">{analysis.pAwayWin}%</strong>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0b0e14] text-slate-300 border border-[#30363d] text-[10.5px] font-semibold truncate min-w-0"
                title={`Gana ${favTeam.name}`}
              >
                🏀 Gana {favTeam.shortName || formatCompactTeamName(favTeam.name)} ·{' '}
                <strong className="font-mono tabular-nums text-white">{favProb}%</strong>
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePick({
                    id: `${fixture.id}_NBA_ML`,
                    fixtureId: fixture.id,
                    sport: 'NBA',
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: fixture.date,
                    matchTime: fixture.time,
                    marketKey: 'NBA_ML',
                    selectionLabel: `Gana ${favTeam.name}`,
                    referenceOdd: bestOdd,
                    userOdd: bestOdd,
                    probability: favProb,
                    isEV: isValueBet
                  });
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer inline-flex items-center gap-1 border shrink-0 ${
                  inParlay
                    ? 'bg-[#d9b114] text-slate-950 border-[#d9b114]'
                    : 'bg-[#0b0e14] hover:bg-[#1c2129] text-white border-[#30363d]'
                }`}
                title="Añadir Moneyline destacado al boleto combinada"
              >
                <Ticket className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>{inParlay ? '✓ Boleto' : '+ Boleto'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!onOpenDetail && isExpanded && (
        <div className="border-t border-[#21262d] p-2 sm:p-3 bg-[#0b0e14]/80">
          <NBAPredictionCard
            fixture={fixture}
            analysis={analysis}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            isExpanded={true}
            onToggleExpand={onToggleExpand}
            viewMode={viewMode}
          />
        </div>
      )}
    </div>
  );
});

