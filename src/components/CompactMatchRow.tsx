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
  const isLive = status === 'IN_PLAY';
  const isFinished = status === 'FINISHED';
  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);

  return (
    <div className={`transition-all duration-300 rounded-xl overflow-hidden border ${
      isRecentlyUpdated
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
            {isRecentlyUpdated && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black font-mono font-black text-[10px] uppercase tracking-tight animate-bounce shadow-md flex items-center gap-1">
                <span>⚡</span>
                <span className="hidden sm:inline">¡Marcador!</span>
              </span>
            )}
            {isLive ? (
              fixture.currentScore?.isHalfTime ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono tracking-tight font-bold text-[10px] border border-amber-500/40" title="Partido en Descanso / Entretiempo (45')">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>DESCANSO</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse border border-rose-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span>{fixture.currentScore?.minute ? `${fixture.currentScore.minute}'` : 'VIVO'}</span>
                </span>
              )
            ) : isFinished ? (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono tracking-tight text-[10px] font-semibold border border-slate-700/50">
                FIN
              </span>
            ) : (
              <span className="font-mono tracking-tight font-semibold text-amber-400 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{fixture.time}</span>
              </span>
            )}
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
            <div className="px-2.5 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono font-bold text-xs sm:text-sm shrink-0 whitespace-nowrap text-center shadow-inner">
              {isLive || isFinished ? (
                <span className={isLive ? 'text-emerald-400' : 'text-slate-200'}>
                  {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
                </span>
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
