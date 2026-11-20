import React from 'react';
import { MatchFixture, MatchAnalysis } from '../types';
import { Check, BarChart2, Star, Flame, Ticket } from 'lucide-react';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';
import { formatCompactTeamName } from '../services/leagueCategorizer';
import { useParlay } from '../context/ParlayContext';

interface CompactMatchRowProps {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (fixtureId: string) => void;
  isExpanded?: boolean;
  onToggleExpand: () => void;
  onOpenDetail?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
  onSelectSpotlight?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
  isSpotlightActive?: boolean;
  onOpenSimulator?: (fixture: MatchFixture) => void;
  viewMode?: 'SIMPLE' | 'EXPERT';
  isRecentlyUpdated?: boolean;
  isFullWidthDesktop?: boolean;
}

export const CompactMatchRow: React.FC<CompactMatchRowProps> = React.memo(({
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
  onOpenSimulator,
  viewMode = 'SIMPLE',
  isRecentlyUpdated = false,
  isFullWidthDesktop = false
}) => {
  const { isPickInParlay, togglePick } = useParlay();
  const { homeTeam, awayTeam, status } = fixture;
  const isFinished = status === 'FINISHED' || (status as string) === 'AWARDED';
  const isSuspended = status === 'SUSPENDED';
  const isPostponed = status === 'POSTPONED';
  const isCancelled = status === 'CANCELLED';
  const isHaltOrInterrupted = isSuspended || isPostponed || isCancelled;

  const isHalfTime = Boolean(
    status === 'HALFTIME' ||
    status === 'PAUSED' ||
    fixture.currentScore?.isHalfTime ||
    fixture.currentScore?.statusShort === 'HT'
  );

  const isPenaltyShootout =
    status === 'PENALTY_SHOOTOUT' ||
    fixture.currentScore?.statusShort === 'PEN' ||
    fixture.currentScore?.statusShort === 'PK';

  const isExtraTime =
    status === 'EXTRA_TIME' ||
    fixture.currentScore?.statusShort === 'ET' ||
    fixture.currentScore?.statusShort === '1ET' ||
    fixture.currentScore?.statusShort === '2ET' ||
    fixture.currentScore?.statusShort === 'ET_HT';

  const isLive =
    (status === 'IN_PLAY' || isExtraTime || isPenaltyShootout || isHalfTime) &&
    !isFinished &&
    !isHaltOrInterrupted;

  const isValueBet = Boolean(analysis?.marketOdds?.valueBetDetected);

  // Control anti-obsolescencia: no alertar jugadas/goles si el evento ocurrió hace más de 3 minutos (180s)
  const isFreshEvent = React.useMemo(() => {
    if (!isRecentlyUpdated || isHaltOrInterrupted) return false;
    const updatedAt = fixture.liveStats?.updatedAt || (fixture as any).lastScoreUpdateTimestamp;
    if (updatedAt && Date.now() - updatedAt > 3 * 60 * 1000) {
      return false; // Descartar alertas viejas tras recarga de caché
    }
    return true;
  }, [isRecentlyUpdated, fixture, isHaltOrInterrupted]);

  const penaltyScore = fixture.score?.penalties || fixture.currentScore?.penalties;
  const hasPenalties = Boolean(
    penaltyScore &&
    penaltyScore.home !== null &&
    penaltyScore.away !== null &&
    (penaltyScore.home !== undefined || penaltyScore.away !== undefined)
  );

  // Base minute reconciliado fielmente con la señal en vivo y eventos reales (sin adelantar artificialmente)
  const reconciledBaseMinute = React.useMemo(() => {
    const base = fixture.currentScore?.minute ?? 0;
    if (isHalfTime) return 45;
    if (!Array.isArray(fixture.liveEvents) || fixture.liveEvents.length === 0) return base;
    const maxEvMin = fixture.liveEvents.reduce((acc, ev) => {
      if (ev.type === 'PERIOD_HALF' || ev.type === 'PERIOD_END' || ev.type === 'PERIOD_START') return acc;
      return Math.max(acc, Number(ev.minute || 0));
    }, 0);
    return Math.max(base, maxEvMin);
  }, [fixture.currentScore?.minute, fixture.liveEvents, isHalfTime]);

  if (!analysis) return null;

  const topPick = analysis.verdict?.topSafePick;
  const topPickMarketKey = topPick?.category || 'SAFE_GOALS';
  const rawTopLabel = topPick?.plainTitle || topPick?.label || 'Más de 1.5 Goles';
  const compactTopLabel = rawTopLabel
    .replace(' en el partido', '')
    .replace('Tiros de Esquina', 'Córners');
  const topPickProb = Math.round(
    topPick?.probability ||
      Math.max(analysis.dixonColes.pHomeWin, analysis.dixonColes.pAwayWin)
  );
  const topPickOdd =
    topPick?.fairOdd || Number((100 / Math.max(topPickProb, 1)).toFixed(2));
  const inParlay = isPickInParlay(fixture.id, topPickMarketKey);

  // Reloj oficial sincronizado con topes de seguridad y estados estrictos
  const renderClock = () => {
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#8b949e] font-mono tabular-nums tracking-tight text-[10px] font-bold border border-[#30363d]">
          FIN
        </span>
      );
    }

    if (isSuspended) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#d9b114]/15 text-[#d9b114] font-mono tabular-nums tracking-tight text-[10px] font-bold border border-[#d9b114]/40" title="Partido Suspendido">
          SUSP
        </span>
      );
    }

    if (isPostponed) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#8b949e] font-mono tabular-nums tracking-tight text-[10px] font-bold border border-[#30363d]" title="Partido Aplazado">
          APLAZ
        </span>
      );
    }

    if (isCancelled) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-mono tabular-nums tracking-tight text-[10px] font-bold border border-rose-500/30" title="Partido Cancelado">
          CANC
        </span>
      );
    }

    // Tanda de Penales
    if (isPenaltyShootout) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 font-mono tabular-nums tracking-tight font-bold text-[10px] border border-purple-500/30" title="Tanda de Penales en curso (120')">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          <span>PEN</span>
        </span>
      );
    }

    // Entretiempo / Pausa regular (Congelado estrictamente en 45')
    if (isHalfTime) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d9b114]/15 text-[#d9b114] font-mono tabular-nums tracking-tight font-bold text-[10px] border border-[#d9b114]/40" title="Partido en Descanso / Entretiempo (45')">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114]"></span>
          <span>HT</span>
        </span>
      );
    }

    // Tiempo Extra (Prórroga 90' a 120')
    if (isExtraTime) {
      const rawMin = reconciledBaseMinute || 91;
      const statusShort = fixture.currentScore?.statusShort;
      let displayET = 'ET';
      if (statusShort === 'ET_HT' || statusShort === 'BT') {
        displayET = 'ET HT';
      } else if (statusShort === '1ET' || rawMin <= 105) {
        if (rawMin > 105) {
          displayET = `105+${rawMin - 105}'`;
        } else {
          displayET = `${Math.max(90, Math.min(105, rawMin))}'`;
        }
      } else {
        if (rawMin > 120) {
          displayET = `120+${rawMin - 120}'`;
        } else {
          displayET = `${Math.max(105, Math.min(120, rawMin))}'`;
        }
      }

      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-mono tabular-nums tracking-tight font-bold text-[10px] animate-pulse border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          <span>{displayET}</span>
        </span>
      );
    }

    // Tiempo Regular En Vivo
    if (status === 'IN_PLAY') {
      const statusShort = fixture.currentScore?.statusShort;
      const rawMin = reconciledBaseMinute;
      let displayMin = 'VIVO';
      if (typeof rawMin === 'number' && rawMin > 0) {
        const isFirstHalf = statusShort === '1H' || (statusShort !== '2H' && rawMin <= 45);
        if (isFirstHalf) {
          if (rawMin > 45) {
            displayMin = `45+${rawMin - 45}'`;
          } else {
            displayMin = `${Math.min(45, Math.max(1, rawMin))}'`;
          }
        } else {
          if (rawMin > 90) {
            displayMin = `90+${rawMin - 90}'`;
          } else {
            displayMin = `${Math.min(90, Math.max(46, rawMin))}'`;
          }
        }
      }

      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-mono tabular-nums tracking-tight font-semibold text-[10px] animate-pulse border border-rose-500/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          <span>{displayMin}</span>
        </span>
      );
    }

    return (
      <span className="px-1.5 py-0.5 rounded bg-[#0b0e14] text-[#8b949e] font-mono tabular-nums tracking-tight font-medium text-[10px] border border-[#30363d] shrink-0">
        {fixture.time}
      </span>
    );
  };

  return (
    <div data-tour="tour-match-card" className={`transition-all duration-200 rounded-2xl overflow-hidden bg-[#161b22] border ${
      isFullWidthDesktop ? 'md:col-span-2' : ''
    } ${
      !isHaltOrInterrupted && isFreshEvent
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
        <div className="@container w-full flex flex-col gap-1.5 min-w-0">
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
            <div className="px-2 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] font-mono tabular-nums font-semibold text-[11px] sm:text-xs shrink-0 whitespace-nowrap text-center min-w-[44px] flex items-center justify-center gap-1">
              {isLive || isFinished || isSuspended ? (
                <>
                  <span className={isLive && !isSuspended ? 'text-rose-400 font-bold' : 'text-white'}>
                    {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
                  </span>
                  {hasPenalties && (
                    <span className="text-[10px] text-[#d9b114] font-semibold" title="Tanda de Penales">
                      ({penaltyScore?.home ?? 0}-{penaltyScore?.away ?? 0})
                    </span>
                  )}
                </>
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
            {/* Izquierda: Hora / Minuto + LiveStats o Pick Cuantitativo Móvil + Liga en PC */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {!isHaltOrInterrupted && isFreshEvent && (
                <span className="px-2 py-0.5 rounded-md bg-[#00ff66] text-slate-950 font-mono font-bold text-[9.5px] uppercase tracking-tight animate-bounce shrink-0 shadow-xs">
                  ⚽ ¡GOL! {fixture.currentScore ? `${fixture.currentScore.home}-${fixture.currentScore.away}` : ''}
                </span>
              )}
              {renderClock()}
              <span className={fixture.liveStats && (isLive || isFinished) ? 'hidden @min-[480px]:inline text-[#30363d] shrink-0' : 'hidden sm:inline text-[#30363d] shrink-0'}>·</span>
              <span
                className={fixture.liveStats && (isLive || isFinished) ? 'hidden @min-[480px]:inline text-[11px] font-normal text-[#8b949e] truncate' : 'hidden sm:inline text-[11px] font-normal text-[#8b949e] truncate'}
                title={fixture.league?.name || 'Liga'}
              >
                {fixture.league?.name || 'Liga'}
              </span>
              {fixture.liveStats && (isLive || isFinished) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0b0e14] border border-[#30363d] text-[9.5px] font-mono tabular-nums text-[#8b949e] shrink-0">
                  <span title="Tiros de esquina reales">🚩 {fixture.liveStats.home.corners + fixture.liveStats.away.corners}</span>
                  <span className="text-[#30363d]">·</span>
                  <span title="Tarjetas amarillas reales">🟨 {fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards}</span>
                </span>
              ) : (
                <span
                  className="inline-flex sm:hidden items-center gap-1 px-1.5 py-0.5 rounded bg-[#0b0e14] text-slate-300 border border-[#30363d] font-mono text-[9.5px] font-semibold truncate min-w-0"
                  title={`${rawTopLabel} (${topPickProb}%)`}
                >
                  ⚡ {compactTopLabel} <strong className="font-mono tabular-nums text-white">{topPickProb}%</strong>
                </span>
              )}
            </div>

            {/* Derecha: Botón Cuotas (adaptativo por ancho de tarjeta) + Estrella Favorito + Checkbox fino de 20px */}
            <div className="flex items-center gap-1 sm:gap-1.5 @min-[435px]:gap-2 shrink-0 ml-auto">
              <button
                data-tour="tour-h2h-btn"
                type="button"
                title="Ver cuotas, estadísticas y datos completos"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectSpotlight) onSelectSpotlight(fixture, analysis);
                  if (onOpenDetail) onOpenDetail(fixture, analysis);
                  else onToggleExpand();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0b0e14] hover:bg-[#1c2129] text-slate-300 hover:text-white border border-[#30363d] text-[10.5px] font-medium transition-colors shrink-0 cursor-pointer"
              >
                <BarChart2 className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span className="hidden @min-[435px]:inline">Ver Cuotas y Datos</span>
                <span className="hidden @min-[305px]:@max-[435px]:inline">Ver Cuotas</span>
                <span className="hidden @max-[305px]:inline">Cuotas</span>
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
                  title={isFavorite ? 'Quitar de Favoritos (Alertas de Gol activas)' : 'Añadir a Favoritos para recibir alertas de gol en vivo'}
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

        {/* TELEMETRÍA RÁPIDA +EV (Opción 1: solo visible en PC cuando la tarjeta cierra fila en md:col-span-2) */}
        {isFullWidthDesktop && (
          <div className="hidden md:flex flex-col justify-between gap-1.5 pl-4 border-l border-[#21262d] min-w-0">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
              <span className="inline-flex items-center gap-1 font-bold text-slate-300 uppercase tracking-wider">
                <Flame className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>Telemetría Rápida</span>
                {isValueBet && (
                  <span className="px-1.5 py-0.2 rounded bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/30 text-[9px] font-bold">
                    +EV
                  </span>
                )}
              </span>
              <span className="text-[#8b949e] tabular-nums">
                xG: <strong className="text-white font-mono tabular-nums">{analysis.dixonColes.lambdaHome.toFixed(2)}</strong> vs{' '}
                <strong className="text-white font-mono tabular-nums">{analysis.dixonColes.lambdaAway.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[10px]">
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e]">
                1: <strong className="text-white font-mono tabular-nums">{Math.round(analysis.dixonColes.pHomeWin)}%</strong>
              </div>
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e]">
                X: <strong className="text-white font-mono tabular-nums">{Math.round(analysis.dixonColes.pDraw)}%</strong>
              </div>
              <div className="px-1.5 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[#8b949e]">
                2: <strong className="text-white font-mono tabular-nums">{Math.round(analysis.dixonColes.pAwayWin)}%</strong>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0b0e14] text-slate-300 border border-[#30363d] text-[10.5px] font-semibold truncate min-w-0"
                title={rawTopLabel}
              >
                ⚡ {compactTopLabel} · <strong className="font-mono tabular-nums text-white">{topPickProb}%</strong>
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePick({
                    id: `${fixture.id}_${topPickMarketKey}`,
                    fixtureId: fixture.id,
                    sport: 'SOCCER',
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: fixture.date,
                    matchTime: fixture.time,
                    marketKey: topPickMarketKey,
                    selectionLabel: rawTopLabel,
                    referenceOdd: topPickOdd,
                    userOdd: topPickOdd,
                    probability: topPickProb,
                    isEV: isValueBet
                  });
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer inline-flex items-center gap-1 border shrink-0 ${
                  inParlay
                    ? 'bg-[#d9b114] text-slate-950 border-[#d9b114]'
                    : 'bg-[#0b0e14] hover:bg-[#1c2129] text-white border-[#30363d]'
                }`}
                title="Añadir pronóstico destacado al boleto combinada"
              >
                <Ticket className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
                <span>{inParlay ? '✓ Boleto' : '+ Boleto'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details: Renders only if onOpenDetail is not supplied */}
      {!onOpenDetail && isExpanded && (
        <div className="border-t border-[#21262d] p-2 sm:p-3 bg-[#0b0e14]/80 animate-row-enter">
          <FriendlyPredictionCard
            fixture={fixture}
            analysis={analysis}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onOpenSimulator={onOpenSimulator}
            isExpanded={true}
            onToggleExpand={onToggleExpand}
            viewMode={viewMode}
          />
        </div>
      )}
    </div>
  );
});

