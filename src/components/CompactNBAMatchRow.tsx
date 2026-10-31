import React from 'react';
import { NBAMatchFixture, NBAAnalysis } from '../types';
import { Check, BarChart2, Star } from 'lucide-react';
import { NBAPredictionCard } from './NBAPredictionCard';
import { formatCompactTeamName } from '../services/leagueCategorizer';
import { evaluateNBAMarketsLiveStatus } from '../services/nbaEngine';

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
  viewMode?: 'SIMPLE' | 'EXPERT';
  isRecentlyUpdated?: boolean;
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
  viewMode = 'SIMPLE',
  isRecentlyUpdated = false
}) => {
  const { homeTeam, awayTeam, status } = fixture;
  const isLive = status === 'IN_PLAY';
  const isFinished = status === 'FINISHED';
  if (!analysis) return null;
  const isValueBet = Boolean(analysis?.marketOdds?.valueBetDetected);
  const hasStarted = (isLive || isFinished) && Boolean(fixture.currentScore);
  const evaluatedMarkets = hasStarted ? evaluateNBAMarketsLiveStatus(fixture, analysis) : [];
  const hitsCount = evaluatedMarkets.filter((m) => m.isHit).length;
  const mainPickHit = evaluatedMarkets[0]?.isHit ?? false;

  return (
    <div className={`transition-all duration-200 rounded-xl overflow-hidden border shadow-2xs ${
      isRecentlyUpdated
        ? 'border-amber-500 bg-amber-50/95 ring-2 ring-amber-400/70'
        : isSelected
        ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/30'
        : isValueBet
        ? 'border-amber-300/90 bg-white/95 hover:bg-slate-50/95'
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
          <div className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/90 font-mono tabular-nums font-semibold text-[11px] sm:text-xs shrink-0 whitespace-nowrap text-center min-w-[44px] flex items-center justify-center">
            {isLive || isFinished ? (
              <span className={isLive ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
              </span>
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

        {/* LÍNEA 2: HORA COMPACTA + TORNEO + VER CUOTAS + CHECKBOX SUTIL */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
          {/* Izquierda: Hora / Estado + Liga + sede */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isRecentlyUpdated && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono font-bold text-[9.5px] uppercase tracking-tight animate-bounce shrink-0 shadow-xs">
                🏀 ¡PUNTOS! {fixture.currentScore ? `${fixture.currentScore.home}-${fixture.currentScore.away}` : ''}
              </span>
            )}
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-mono tabular-nums tracking-tight font-semibold text-[10px] animate-pulse border border-rose-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span>EN VIVO • {fixture.livePeriod === 'HT' ? 'MT' : fixture.livePeriod || 'Q1'}</span>
              </span>
            ) : isFinished ? (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono tabular-nums text-[10px] font-medium border border-slate-200/80 shrink-0">
                FIN
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono tabular-nums text-[10px] font-medium border border-slate-200/70 shrink-0">
                {fixture.time}
              </span>
            )}

            {hasStarted && (
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold border shrink-0 ${
                  mainPickHit
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
                title="Estado de las apuestas pre-partido y props de jugadores"
              >
                {mainPickHit ? '✅' : '❌'} {hitsCount}/6 Mercados
              </span>
            )}

            <span className="text-slate-300 shrink-0">·</span>

            <span
              className="text-[11px] font-normal text-slate-500 truncate"
              title={`${fixture.league?.name || 'NBA'} · ${fixture.arena?.name || ''}`}
            >
              {fixture.league?.name || 'NBA'}
              {fixture.arena?.name ? ` · ${fixture.arena.name}` : ''}
            </span>
          </div>

          {/* Derecha: Botón Ver Cuotas y Datos + Estrella Favorito + Checkbox fino de 20px */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50/90 hover:bg-amber-100 text-amber-800 border border-amber-200/90 text-[10.5px] font-medium transition-colors shrink-0">
              <BarChart2 className="w-3 h-3 text-amber-600" />
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
                title={isFavorite ? 'Quitar de Favoritos (Alertas activas)' : 'Añadir a Favoritos para recibir alertas en vivo'}
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
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-white text-transparent hover:border-slate-400 border-slate-300'
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

      {!onOpenDetail && isExpanded && (
        <div className="border-t border-slate-200/80 p-2 sm:p-3 bg-slate-50/70">
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

