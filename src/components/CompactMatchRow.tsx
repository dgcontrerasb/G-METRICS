import React from 'react';
import { MatchFixture, MatchAnalysis } from '../types';
import { Check, BarChart2, Star } from 'lucide-react';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';
import { formatCompactTeamName } from '../services/leagueCategorizer';

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
  onOpenSimulator?: (fixture: MatchFixture) => void;
  viewMode?: 'SIMPLE' | 'EXPERT';
  isRecentlyUpdated?: boolean;
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
  onOpenSimulator,
  viewMode = 'SIMPLE',
  isRecentlyUpdated = false
}) => {
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

  // Reloj oficial sincronizado con topes de seguridad y estados estrictos
  const renderClock = () => {
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono tabular-nums tracking-tight text-[10px] font-bold border border-slate-200/80">
          FIN
        </span>
      );
    }

    if (isSuspended) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono tabular-nums tracking-tight text-[10px] font-bold border border-amber-300" title="Partido Suspendido">
          SUSP
        </span>
      );
    }

    if (isPostponed) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums tracking-tight text-[10px] font-bold border border-slate-300" title="Partido Aplazado">
          APLAZ
        </span>
      );
    }

    if (isCancelled) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-mono tabular-nums tracking-tight text-[10px] font-bold border border-rose-200" title="Partido Cancelado">
          CANC
        </span>
      );
    }

    // Tanda de Penales
    if (isPenaltyShootout) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono tabular-nums tracking-tight font-bold text-[10px] border border-purple-200" title="Tanda de Penales en curso (120')">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
          <span>PEN</span>
        </span>
      );
    }

    // Entretiempo / Pausa regular (Congelado estrictamente en 45')
    if (isHalfTime) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono tabular-nums tracking-tight font-bold text-[10px] border border-amber-200" title="Partido en Descanso / Entretiempo (45')">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-mono tabular-nums tracking-tight font-bold text-[10px] animate-pulse border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-mono tabular-nums tracking-tight font-semibold text-[10px] animate-pulse border border-rose-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          <span>{displayMin}</span>
        </span>
      );
    }

    return (
      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono tabular-nums tracking-tight font-medium text-[10px] border border-slate-200/70 shrink-0">
        {fixture.time}
      </span>
    );
  };

  return (
    <div className={`transition-all duration-200 rounded-xl overflow-hidden border shadow-2xs ${
      !isHaltOrInterrupted && isFreshEvent
        ? 'border-emerald-500 bg-emerald-50/95 ring-2 ring-emerald-400/70'
        : isSelected
        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30'
        : isValueBet
        ? 'border-emerald-300/90 bg-white/95 hover:bg-slate-50/95'
        : 'border-slate-200/80 bg-white/95 hover:bg-slate-50/95'
    } backdrop-blur-md`}>
      <div
        onClick={() => {
          if (onOpenDetail) onOpenDetail(fixture, analysis);
          else onToggleExpand();
        }}
        className="px-3 sm:px-4 py-2 flex flex-col gap-1.5 cursor-pointer select-none"
      >
        {/* LÍNEA 1: EJE SIMÉTRICO 3 COLUMNAS (LOCAL · VS/MARCADOR · VISITANTE) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
          {/* Columna 1: Local (Alineado a la derecha hacia el centro) */}
          <div className="flex items-center justify-end gap-1.5 min-w-0 text-right">
            <span
              className="font-sans font-medium text-xs sm:text-[13px] tracking-tight text-slate-900 truncate"
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
          <div className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/90 font-mono tabular-nums font-semibold text-[11px] sm:text-xs shrink-0 whitespace-nowrap text-center min-w-[44px] flex items-center justify-center gap-1">
            {isLive || isFinished || isSuspended ? (
              <>
                <span className={isLive && !isSuspended ? 'text-emerald-700 font-bold' : 'text-slate-900'}>
                  {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
                </span>
                {hasPenalties && (
                  <span className="text-[10px] text-amber-700 font-semibold" title="Tanda de Penales">
                    ({penaltyScore?.home ?? 0}-{penaltyScore?.away ?? 0})
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500 text-[10px] font-medium">VS</span>
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
              className="font-sans font-medium text-xs sm:text-[13px] tracking-tight text-slate-900 truncate"
              title={awayTeam.name}
            >
              {formatCompactTeamName(awayTeam.name)}
            </span>
          </div>
        </div>

        {/* LÍNEA 2: HORA COMPACTA + LIGA + VER CUOTAS + CHECKBOX SUTIL DE 20PX */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
          {/* Izquierda: Hora / Minuto + Liga + Estadísticas en vivo si aplica */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {!isHaltOrInterrupted && isFreshEvent && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-bold text-[9.5px] uppercase tracking-tight animate-bounce shrink-0 shadow-xs">
                ⚽ ¡GOL! {fixture.currentScore ? `${fixture.currentScore.home}-${fixture.currentScore.away}` : ''}
              </span>
            )}
            {renderClock()}
            <span className="text-slate-300 shrink-0">·</span>
            <span
              className="text-[11px] font-normal text-slate-500 truncate"
              title={fixture.league?.name || 'Liga'}
            >
              {fixture.league?.name || 'Liga'}
            </span>
            {fixture.liveStats && (isLive || isFinished) && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-[9.5px] font-mono tabular-nums text-slate-600 shrink-0">
                <span title="Tiros de esquina reales">🚩 {fixture.liveStats.home.corners + fixture.liveStats.away.corners}</span>
                <span className="text-slate-300">·</span>
                <span title="Tarjetas amarillas reales">🟨 {fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards}</span>
              </span>
            )}
          </div>

          {/* Derecha: Botón Ver Cuotas y Datos + Estrella Favorito + Checkbox fino de 20px */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 text-[10.5px] font-medium transition-colors shrink-0">
              <BarChart2 className="w-3 h-3 text-emerald-600" />
              <span>Ver Cuotas y Datos</span>
            </span>

            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(fixture.id);
                }}
                className={`w-6 h-6 rounded-md transition-colors cursor-pointer border flex items-center justify-center shrink-0 ${
                  isFavorite
                    ? 'bg-amber-50 text-amber-500 border-amber-300 shadow-2xs'
                    : 'bg-white text-slate-400 hover:text-amber-500 hover:border-amber-300 border-slate-200/90'
                }`}
                title={isFavorite ? 'Quitar de Favoritos (Alertas de Gol activas)' : 'Añadir a Favoritos para recibir alertas de gol en vivo'}
                aria-label={isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
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
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-transparent hover:border-slate-400 border-slate-300'
                }`}
                title={isSelected ? 'Quitar de selección' : 'Seleccionar partido'}
                aria-label={isSelected ? 'Quitar de selección' : 'Seleccionar partido'}
              >
                <Check className={`w-3 h-3 ${isSelected ? 'text-white stroke-[2.5]' : 'opacity-0'}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details: Renders only if onOpenDetail is not supplied */}
      {!onOpenDetail && isExpanded && (
        <div className="border-t border-slate-200/80 p-2 sm:p-3 bg-slate-50/70">
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

