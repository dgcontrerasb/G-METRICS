import React from 'react';
import { MatchFixture, MatchAnalysis } from '../types';
import { Clock, ChevronDown, ChevronUp, CheckSquare, Square, BarChart2 } from 'lucide-react';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';

interface CompactMatchRowProps {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
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

  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);

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

  // Base minute reconciliado con los eventos reales reportados en la cronología
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

  // Avance local de 60 segundos entre sincronizaciones de red, respetando topes estrictos
  const [liveMinuteOffset, setLiveMinuteOffset] = React.useState<number>(0);

  React.useEffect(() => {
    setLiveMinuteOffset(0);
  }, [fixture.id, reconciledBaseMinute, isHalfTime, status]);

  React.useEffect(() => {
    if (status !== 'IN_PLAY' || isHalfTime || isFinished || isHaltOrInterrupted) {
      return;
    }
    const ticker = setInterval(() => {
      setLiveMinuteOffset((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(ticker);
  }, [status, isHalfTime, isFinished, isHaltOrInterrupted]);

  // Reloj oficial sincronizado con topes de seguridad y estados estrictos
  const renderClock = () => {
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono tracking-tight text-[10px] font-semibold border border-slate-700/50">
          FIN
        </span>
      );
    }

    if (isSuspended) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 font-mono tracking-tight text-[10px] font-bold border border-amber-600/60" title="Partido Suspendido">
          SUSP
        </span>
      );
    }

    if (isPostponed) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-mono tracking-tight text-[10px] font-bold border border-slate-700/60" title="Partido Aplazado">
          APLAZ
        </span>
      );
    }

    if (isCancelled) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 font-mono tracking-tight text-[10px] font-bold border border-rose-600/60" title="Partido Cancelado">
          CANC
        </span>
      );
    }

    // Tanda de Penales
    if (isPenaltyShootout) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono tracking-tight font-bold text-[10px] border border-purple-500/40" title="Tanda de Penales en curso (120')">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          <span>PEN</span>
        </span>
      );
    }

    // Entretiempo / Pausa regular (Congelado estrictamente en 45')
    if (isHalfTime) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono tracking-tight font-bold text-[10px] border border-amber-500/40" title="Partido en Descanso / Entretiempo (45')">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse border border-rose-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
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
          // Tope estricto 1T en 45' (formato 45+X' si la API reportó adición oficial)
          if (rawMin > 45) {
            displayMin = `45+${rawMin - 45}'`;
          } else {
            const progressed = Math.min(45, Math.max(1, rawMin + liveMinuteOffset));
            displayMin = `${progressed}'`;
          }
        } else {
          // Tope estricto 2T en 90' (formato 90+X' si la API reportó compensación)
          if (rawMin > 90) {
            displayMin = `90+${rawMin - 90}'`;
          } else {
            const progressed = Math.min(90, Math.max(46, rawMin + liveMinuteOffset));
            displayMin = `${progressed}'`;
          }
        }
      }

      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse border border-rose-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          <span>{displayMin}</span>
        </span>
      );
    }

    return (
      <span className="font-mono tracking-tight font-semibold text-amber-400 text-xs flex items-center gap-1">
        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
        <span>{fixture.time}</span>
      </span>
    );
  };

  return (
    <div className={`transition-all duration-300 rounded-xl overflow-hidden border ${
      !isHaltOrInterrupted && isFreshEvent
        ? 'border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse'
        : isSelected
        ? 'border-emerald-500/60 bg-slate-950/60 ring-1 ring-emerald-500/30'
        : isValueBet
        ? 'border-emerald-500/30 bg-slate-950/40 hover:bg-slate-900/40'
        : 'border-slate-800/40 bg-slate-950/30 hover:bg-slate-900/40'
    } backdrop-blur-md`}>
      {/* 2-Tier Clean Row: Línea 1 Duelo y Marcador / Línea 2 Datos y Acciones */}
      <div
        onClick={() => {
          if (onOpenDetail) onOpenDetail(fixture, analysis);
          else onToggleExpand();
        }}
        className="px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-2 cursor-pointer select-none"
      >
        {/* LÍNEA 1: ESTADO + DUELO DE EQUIPOS + MARCADOR CENTRAL */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Minuto / Tiempo / Estado */}
          <div className="shrink-0 flex items-center gap-1.5">
            {!isHaltOrInterrupted && isFreshEvent && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black font-mono font-black text-[10px] uppercase tracking-tight animate-bounce shadow-md flex items-center gap-1">
                <span>⚡</span>
                <span className="hidden sm:inline">¡Marcador!</span>
              </span>
            )}
            {renderClock()}
          </div>

          {/* Duelo de Equipos con Marcador Central en Cápsula */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            {/* Local */}
            <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right">
              <span className="font-sans font-semibold text-xs sm:text-sm text-slate-100 truncate" title={homeTeam.name}>
                {homeTeam.name}
              </span>
              <img
                src={homeTeam.logo}
                alt=""
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Marcador Central en Recuadro / Cápsula Elegante */}
            <div className="px-2.5 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono font-bold text-xs sm:text-sm shrink-0 whitespace-nowrap text-center shadow-inner flex items-center justify-center gap-1.5">
              {isLive || isFinished || isSuspended ? (
                <>
                  <span className={isLive && !isSuspended ? 'text-emerald-400' : 'text-slate-200'}>
                    {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
                  </span>
                  {hasPenalties && (
                    <span className="text-[10.5px] text-amber-400 font-bold" title="Tanda de Penales">
                      ({penaltyScore?.home ?? 0} - {penaltyScore?.away ?? 0})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 text-[10px]">VS</span>
              )}
            </div>

            {/* Visitante */}
            <div className="flex items-center justify-start gap-1.5 min-w-0 flex-1 text-left">
              <img
                src={awayTeam.logo}
                alt=""
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="font-sans font-semibold text-xs sm:text-sm text-slate-100 truncate" title={awayTeam.name}>
                {awayTeam.name}
              </span>
            </div>
          </div>
        </div>

        {/* LÍNEA 2: LIGA Y ACCESO DIRECTO A CUOTAS Y MERCADOS */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/40 text-xs">
          {/* Izquierda: Liga y botón visual para entrar a cuotas y datos */}
          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
            <span className="text-[11px] font-medium text-slate-400 truncate max-w-[130px] sm:max-w-[200px]" title={fixture.league?.name || 'Liga'}>
              {fixture.league?.name || 'Liga'}
            </span>
            {fixture.liveStats && (isLive || isFinished) && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700/70 text-[10px] font-mono text-slate-300 shrink-0">
                <span title="Tiros de esquina reales">🚩 {fixture.liveStats.home.corners + fixture.liveStats.away.corners}</span>
                <span className="text-slate-600">·</span>
                <span title="Tarjetas amarillas reales">🟨 {fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-colors shrink-0">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Cuotas y Datos</span>
            </span>
          </div>

          {/* Derecha: Checkbox de selección rápida y chevron */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onToggleSelect && (
              <button
                type="button"
                onClick={() => onToggleSelect(fixture.id)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer border flex items-center justify-center min-w-[32px] min-h-[32px] ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white border-slate-700/80 hover:bg-slate-800'
                }`}
                title={isSelected ? 'Quitar de selección' : 'Añadir a mi selección'}
              >
                {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-slate-950" /> : <Square className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onOpenDetail) onOpenDetail(fixture, analysis);
                else onToggleExpand();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center min-w-[32px] min-h-[32px]"
              aria-label={onOpenDetail ? 'Ver análisis detallado' : isExpanded ? 'Contraer' : 'Expandir'}
              title="Ver análisis completo"
            >
              {onOpenDetail ? (
                <ChevronDown className="w-4 h-4 text-emerald-400" />
              ) : isExpanded ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details: Renders only if onOpenDetail is not supplied */}
      {!onOpenDetail && isExpanded && (
        <div className="border-t border-slate-800/40 p-2 sm:p-3 bg-slate-950/40">
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
