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
      <div className="py-7 px-4 text-center bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3.5">
        <div className="w-11 h-11 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <Clock className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <h4 className="font-sans font-bold text-sm text-slate-900">
            Partido programado
          </h4>
          <p className="font-sans text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Inicio hoy a las <strong className="text-slate-900 font-mono">{fixture.time}</strong>.
          </p>
        </div>

        {/* Pre-match Context Strip */}
        <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-left space-y-1.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">Árbitro Oficial:</span>
            <span className="font-semibold text-slate-900">{fixture.referee.name} ({fixture.referee.rigor})</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">Estadio:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[200px]">{fixture.venue.name}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">Ciudad:</span>
            <span className="font-semibold text-slate-900">{fixture.venue.city}</span>
          </div>
        </div>

        <p className="text-[11px] font-sans text-emerald-700 font-medium">
          Aquí se registrarán goles, tarjetas, córners y cambios en tiempo real.
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
    <div className="space-y-3">
      {/* 1. Panel de Estadísticas Oficiales en Tiempo Real (Fondo claro y limpio) */}
      {liveStats && (
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200/80 pb-1.5">
            <span className="text-emerald-700 font-bold truncate max-w-[115px]">
              {fixture.homeTeam.shortName || fixture.homeTeam.name}
            </span>
            <span className="text-slate-600 font-semibold">Estadísticas en Vivo</span>
            <span className="text-sky-700 font-bold truncate max-w-[115px] text-right">
              {fixture.awayTeam.shortName || fixture.awayTeam.name}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] font-sans text-slate-500 font-medium">🚩 Córners ({totalRealCorners})</div>
              <div className="font-mono font-bold text-xs text-slate-900 mt-0.5 whitespace-nowrap">
                <span className="text-emerald-700">{liveStats.home.corners}</span>
                <span className="text-slate-300 mx-1.5">-</span>
                <span className="text-sky-700">{liveStats.away.corners}</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] font-sans text-slate-500 font-medium">🟨 Tarjetas ({liveStats.home.yellowCards + liveStats.away.yellowCards})</div>
              <div className="font-mono font-bold text-xs text-slate-900 mt-0.5 whitespace-nowrap">
                <span className="text-amber-700">{liveStats.home.yellowCards}</span>
                <span className="text-slate-300 mx-1.5">-</span>
                <span className="text-amber-700">{liveStats.away.yellowCards}</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="text-[10px] font-sans text-slate-500 font-medium">🎯 A Puerta</div>
              <div className="font-mono font-bold text-xs text-slate-900 mt-0.5 whitespace-nowrap">
                <span className="text-emerald-700">{liveStats.home.shotsOnTarget}</span>
                <span className="text-slate-300 mx-1.5">-</span>
                <span className="text-sky-700">{liveStats.away.shotsOnTarget}</span>
              </div>
            </div>
          </div>

          {(liveStats.home.shots > 0 || liveStats.away.shots > 0 || liveStats.home.possessionPct !== 50) && (
            <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
              <div className="px-2 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] font-mono text-slate-600">
                <span className="block text-[9px] text-slate-400 uppercase">Posesión</span>
                <strong className="text-slate-900 whitespace-nowrap">{Math.round(liveStats.home.possessionPct)}% - {Math.round(liveStats.away.possessionPct)}%</strong>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] font-mono text-slate-600">
                <span className="block text-[9px] text-slate-400 uppercase">Remates</span>
                <strong className="text-slate-900 whitespace-nowrap">{liveStats.home.shots} - {liveStats.away.shots}</strong>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] font-mono text-slate-600">
                <span className="block text-[9px] text-slate-400 uppercase">Faltas</span>
                <strong className="text-slate-900 whitespace-nowrap">{liveStats.home.foulsCommitted} - {liveStats.away.foulsCommitted}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Filtros de Jugadas (Todos, Goles, Tarjetas, Córners) */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          onClick={() => setFilter('ALL')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'ALL'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Todos ({events.length})
        </button>
        <button
          onClick={() => setFilter('GOALS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'GOALS'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          ⚽ Goles ({events.filter((e) => e.type === 'GOAL').length})
        </button>
        <button
          onClick={() => setFilter('CARDS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'CARDS'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          🟨 Tarj. ({totalRealCards})
        </button>
        <button
          onClick={() => setFilter('CORNERS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'CORNERS'
              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          🚩 Córners ({totalRealCorners})
        </button>
      </div>

      {/* 3. Línea de Tiempo Vertical Histórica (Clara, limpia y descansada a la vista) */}
      <div className="relative pl-6 space-y-2 pt-1">
        {/* Línea vertical conectora suave */}
        <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200" />

        {filteredEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200/80">
            No hay eventos registrados para este filtro.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const minLabel = ev.displayMinute || `${ev.minute}'`;

            // Inicio / Entretiempo / Final
            if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_HALF' || ev.type === 'PERIOD_END') {
              return (
                <div key={ev.id} className="relative flex items-center gap-3 py-0.5">
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 text-[10px]">
                    ⏱️
                  </div>
                  <div className="w-full py-1.5 px-3 rounded-xl bg-slate-100/90 border border-slate-200/90 text-center">
                    <span className="text-[11px] font-sans font-semibold text-slate-700">
                      {ev.detail}
                    </span>
                  </div>
                </div>
              );
            }

            if (ev.type === 'GOAL') {
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold text-[10px] shadow-2xs">
                    ⚽
                  </div>

                  <div className="w-full p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-bold text-[10px]">
                          {minLabel}
                        </span>
                        <span className="font-sans font-bold text-xs text-slate-900 truncate">
                          GOL · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white text-emerald-800 font-mono text-[10px] font-bold shrink-0 border border-emerald-200">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>

                    <p className="text-[11px] font-sans text-slate-600 leading-snug">
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
                  <div className={`absolute -left-6 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shadow-2xs ${
                    isRed ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-amber-100 border-amber-300 text-amber-800'
                  }`}>
                    {isRed ? '🟥' : '🟨'}
                  </div>

                  <div className="w-full p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] border ${
                          isRed
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-slate-800 truncate">
                          {isRed ? 'Tarjeta Roja' : 'Tarjeta Amarilla'} · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="text-[10px] font-sans font-medium text-slate-500 shrink-0">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>
                    {ev.detail && (
                      <p className="text-[11px] font-sans text-slate-500 leading-tight">
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
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 text-[10px]">
                    🔄
                  </div>

                  <div className="w-full p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-[10px]">
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-slate-800 truncate">
                          Cambio en {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-emerald-700 font-medium min-w-0">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ev.playerPrimary}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-600 font-medium min-w-0">
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
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 text-[10px]">
                    🚩
                  </div>

                  <div className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold text-[10px] shrink-0">
                        {minLabel}
                      </span>
                      <span className="font-sans font-medium text-xs text-slate-800 truncate">
                        {ev.detail || `Tiro de esquina · ${ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}`}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/80 text-[10px] font-sans font-medium text-slate-500 shrink-0">
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
