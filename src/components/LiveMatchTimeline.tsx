import React, { useState, useMemo } from 'react';
import { MatchFixture, MatchAnalysis, TimelineEventItem } from '../types';
import { getSoccerMatchEvents } from '../services/lineupService';
import {
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface LiveMatchTimelineProps {
  fixture: MatchFixture;
  analysis?: MatchAnalysis;
}

type EventFilter = 'ALL' | 'GOALS' | 'CARDS' | 'CORNERS';

export const LiveMatchTimeline: React.FC<LiveMatchTimelineProps> = ({
  fixture,
  analysis
}) => {
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const isLive = fixture.status === 'IN_PLAY';
  const isFinished = fixture.status === 'FINISHED';
  const currentMinute = fixture.currentScore?.minute ?? (isLive ? 68 : isFinished ? 90 : 0);
  const homeScore = fixture.currentScore?.home ?? 0;
  const awayScore = fixture.currentScore?.away ?? 0;

  // Retrieve 1:1 synchronized match events with real player names from lineupService
  const events: TimelineEventItem[] = useMemo(() => {
    return getSoccerMatchEvents(fixture);
  }, [fixture]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (filter === 'ALL') return events;
    if (filter === 'GOALS') return events.filter((e) => e.type === 'GOAL');
    if (filter === 'CARDS') return events.filter((e) => e.type === 'YELLOW_CARD' || e.type === 'RED_CARD');
    if (filter === 'CORNERS') return events.filter((e) => e.type === 'CORNER');
    return events;
  }, [events, filter]);

  // If match is scheduled (has not started yet)
  if (!isLive && !isFinished) {
    return (
      <div className="py-8 px-4 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-amber-400">
          <Clock className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h4 className="font-sans font-bold text-sm text-slate-100">
            Partido no iniciado
          </h4>
          <p className="font-sans text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            El encuentro está programado para hoy a las <strong className="text-white font-mono">{fixture.time}</strong>.
          </p>
        </div>

        {/* Pre-match Context Strip */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Árbitro Oficial:</span>
            <span className="font-semibold text-white">{fixture.referee.name} ({fixture.referee.rigor})</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Estadio:</span>
            <span className="font-semibold text-white truncate max-w-[200px]">{fixture.venue.name}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Ciudad:</span>
            <span className="font-semibold text-white">{fixture.venue.city}</span>
          </div>
        </div>

        <p className="text-[11px] font-sans text-emerald-400/90">
          Tan pronto ruede el balón, aquí se registrarán los goles, tarjetas, córners y cambios en tiempo real.
        </p>
      </div>
    );
  }

  const liveStats = fixture.liveStats;
  const totalRealCorners = liveStats
    ? liveStats.home.corners + liveStats.away.corners
    : events.filter((e) => e.type === 'CORNER').length;
  const totalRealCards = liveStats
    ? liveStats.home.yellowCards + liveStats.away.yellowCards + liveStats.home.redCards + liveStats.away.redCards
    : events.filter((e) => e.type === 'YELLOW_CARD' || e.type === 'RED_CARD').length;

  return (
    <div className="space-y-3.5">
      {/* 1. Header del Minuto a Minuto: Estado, Marcador y Reloj */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 shrink-0">
            {isLive ? (
              fixture.currentScore?.isHalfTime ? (
                <span className="flex items-center gap-1.5 text-amber-400 font-mono font-bold text-xs">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>DESCANSO · 45'</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-400 font-mono font-bold text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                  <span>{currentMinute}' EN VIVO</span>
                </span>
              )
            ) : (
              <span className="text-slate-400 font-mono font-bold text-xs">FINALIZADO</span>
            )}
          </div>

          <span className="text-xs font-sans text-slate-300 truncate">
            {fixture.homeTeam.shortName || fixture.homeTeam.name} vs {fixture.awayTeam.shortName || fixture.awayTeam.name}
          </span>
        </div>

        {/* Marcador prominente */}
        <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-700/80 font-mono font-black text-sm text-white shrink-0">
          <span className={homeScore > 0 ? 'text-emerald-400' : 'text-slate-300'}>{homeScore}</span>
          <span className="text-slate-500 mx-1">-</span>
          <span className={awayScore > 0 ? 'text-emerald-400' : 'text-slate-300'}>{awayScore}</span>
        </div>
      </div>

      {/* 1.5 Panel de Estadísticas Oficiales en Tiempo Real */}
      {liveStats && (
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-1.5">
            <span className="text-emerald-400 font-bold truncate max-w-[120px]">
              {fixture.homeTeam.shortName || fixture.homeTeam.name}
            </span>
            <span className="text-slate-300 font-semibold">Estadísticas Oficiales</span>
            <span className="text-cyan-400 font-bold truncate max-w-[120px] text-right">
              {fixture.awayTeam.shortName || fixture.awayTeam.name}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
              <div className="text-[10px] font-sans text-slate-400">🚩 Córners ({totalRealCorners})</div>
              <div className="font-mono font-bold text-xs text-white mt-0.5">
                <span className="text-emerald-400">{liveStats.home.corners}</span>
                <span className="text-slate-600 mx-1.5">-</span>
                <span className="text-cyan-400">{liveStats.away.corners}</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
              <div className="text-[10px] font-sans text-slate-400">🟨 Amarillas ({liveStats.home.yellowCards + liveStats.away.yellowCards})</div>
              <div className="font-mono font-bold text-xs text-white mt-0.5">
                <span className="text-amber-300">{liveStats.home.yellowCards}</span>
                <span className="text-slate-600 mx-1.5">-</span>
                <span className="text-amber-300">{liveStats.away.yellowCards}</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
              <div className="text-[10px] font-sans text-slate-400">🎯 Tiros a Puerta</div>
              <div className="font-mono font-bold text-xs text-white mt-0.5">
                <span className="text-emerald-400">{liveStats.home.shotsOnTarget}</span>
                <span className="text-slate-600 mx-1.5">-</span>
                <span className="text-cyan-400">{liveStats.away.shotsOnTarget}</span>
              </div>
            </div>
          </div>

          {(liveStats.home.shots > 0 || liveStats.away.shots > 0 || liveStats.home.possessionPct !== 50) && (
            <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
              <div className="px-2 py-1 rounded bg-slate-950/50 border border-slate-800/50 text-[10px] font-mono text-slate-300">
                Posesión: <strong className="text-white">{liveStats.home.possessionPct}% - {liveStats.away.possessionPct}%</strong>
              </div>
              <div className="px-2 py-1 rounded bg-slate-950/50 border border-slate-800/50 text-[10px] font-mono text-slate-300">
                Remates: <strong className="text-white">{liveStats.home.shots} - {liveStats.away.shots}</strong>
              </div>
              <div className="px-2 py-1 rounded bg-slate-950/50 border border-slate-800/50 text-[10px] font-mono text-slate-300">
                Faltas: <strong className="text-white">{liveStats.home.foulsCommitted} - {liveStats.away.foulsCommitted}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Filtros de Jugadas (Todos, Goles, Tarjetas, Córners) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          onClick={() => setFilter('ALL')}
          type="button"
          className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer shrink-0 border ${
            filter === 'ALL'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          Todos ({events.length})
        </button>
        <button
          onClick={() => setFilter('GOALS')}
          type="button"
          className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer shrink-0 border ${
            filter === 'GOALS'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          ⚽ Goles ({events.filter((e) => e.type === 'GOAL').length})
        </button>
        <button
          onClick={() => setFilter('CARDS')}
          type="button"
          className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer shrink-0 border ${
            filter === 'CARDS'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          🟨 Tarjetas ({totalRealCards})
        </button>
        <button
          onClick={() => setFilter('CORNERS')}
          type="button"
          className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-colors cursor-pointer shrink-0 border ${
            filter === 'CORNERS'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          🚩 Córners ({totalRealCorners})
        </button>
      </div>

      {/* 3. Línea de Tiempo Vertical Histórica */}
      <div className="relative pl-6 space-y-3 pt-1">
        {/* Línea vertical conectora */}
        <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-800" />

        {filteredEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No hay eventos registrados para este filtro.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const minLabel = ev.displayMinute || `${ev.minute}'`;

            // Render specific design according to event type
            if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_HALF' || ev.type === 'PERIOD_END') {
              return (
                <div key={ev.id} className="relative flex items-center gap-3 py-1">
                  {/* Timeline Node */}
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                    ⏱️
                  </div>
                  <div className="w-full py-1.5 px-3 rounded-lg bg-slate-900/90 border border-slate-800/80 text-center">
                    <span className="text-[11px] font-sans font-semibold text-slate-300">
                      {ev.detail}
                    </span>
                  </div>
                </div>
              );
            }

            if (ev.type === 'GOAL') {
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  {/* Timeline Node */}
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-slate-950 font-bold text-[10px] shadow-md shadow-emerald-500/30">
                    ⚽
                  </div>

                  {/* Card Evento Gol */}
                  <div className="w-full p-2.5 sm:p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 shadow-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-xs text-emerald-400">
                          {minLabel}
                        </span>
                        <span className="font-sans font-bold text-xs text-white truncate">
                          GOL · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black shrink-0 border border-emerald-500/30">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>

                    <p className="text-[11px] font-sans text-slate-300 leading-snug">
                      {ev.detail}
                    </p>
                  </div>
                </div>
              );
            }

            if (ev.type === 'YELLOW_CARD' || ev.type === 'RED_CARD') {
              const isRed = ev.type === 'RED_CARD';
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  {/* Timeline Node */}
                  <div className={`absolute -left-6 w-5 h-5 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] shadow-sm ${
                    isRed ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'
                  }`}>
                    {isRed ? '🟥' : '🟨'}
                  </div>

                  {/* Card Evento Tarjeta */}
                  <div className="w-full p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-amber-400">
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-slate-200 truncate">
                          {isRed ? 'Tarjeta Roja' : 'Tarjeta Amarilla'} · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="text-[10px] font-sans text-slate-400 shrink-0">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>
                    {ev.detail && (
                      <p className="text-[11px] font-sans text-slate-400 leading-tight">
                        {ev.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            if (ev.type === 'SUBSTITUTION') {
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  {/* Timeline Node */}
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 text-[10px]">
                    🔄
                  </div>

                  {/* Card Evento Sustitución */}
                  <div className="w-full p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-400">
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-slate-200 truncate">
                          Cambio en {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-emerald-400 min-w-0">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ev.playerPrimary}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-400 min-w-0">
                        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ev.playerSecondary}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (ev.type === 'CORNER') {
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  {/* Timeline Node */}
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-cyan-500/20 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-300 text-[10px]">
                    🚩
                  </div>

                  {/* Card Evento Córner */}
                  <div className="w-full p-2 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {minLabel}
                      </span>
                      <span className="font-sans font-semibold text-xs text-slate-300 truncate">
                        {ev.detail || `Tiro de Esquina · ${ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-sans text-slate-500 shrink-0">
                      Córner
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
};
