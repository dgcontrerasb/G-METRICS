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
      <div className="py-7 px-4 text-center bg-[#161b22] rounded-2xl border border-[#30363d] space-y-3.5">
        <div className="w-11 h-11 mx-auto rounded-full bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[#d9b114]">
          <Clock className="w-5 h-5 text-[#d9b114]" />
        </div>

        <div className="space-y-1">
          <h4 className="font-sans font-bold text-sm text-white">
            Partido programado
          </h4>
          <p className="font-sans text-xs text-[#8b949e] max-w-sm mx-auto leading-relaxed">
            Inicio hoy a las <strong className="text-white font-mono">{fixture.time}</strong>.
          </p>
        </div>

        {/* Pre-match Context Strip */}
        <div className="p-3 rounded-xl bg-[#0b0e14] border border-[#30363d] text-left space-y-1.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span>Árbitro Oficial:</span>
            <span className="font-semibold text-white">{fixture.referee.name} ({fixture.referee.rigor})</span>
          </div>
          <div className="flex items-center justify-between text-[#8b949e]">
            <span>Estadio:</span>
            <span className="font-semibold text-white truncate max-w-[200px]">{fixture.venue.name}</span>
          </div>
          <div className="flex items-center justify-between text-[#8b949e]">
            <span>Ciudad:</span>
            <span className="font-semibold text-white">{fixture.venue.city}</span>
          </div>
        </div>

        <p className="text-[11px] font-sans text-[#d9b114] font-medium">
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
      {/* 1. Panel de Estadísticas Oficiales en Tiempo Real */}
      {liveStats && (
        <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#8b949e] border-b border-[#30363d] pb-1.5">
            <span className="text-[#00ff66] font-bold truncate max-w-[115px]">
              {fixture.homeTeam.shortName || fixture.homeTeam.name}
            </span>
            <span className="text-white font-semibold">Estadísticas en Vivo</span>
            <span className="text-sky-400 font-bold truncate max-w-[115px] text-right">
              {fixture.awayTeam.shortName || fixture.awayTeam.name}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs">
              <div className="text-[10px] font-sans text-[#8b949e] font-medium">🚩 Córners ({totalRealCorners})</div>
              <div className="font-mono tabular-nums font-bold text-xs text-white mt-0.5 whitespace-nowrap">
                <span className="text-[#00ff66]">{liveStats.home.corners}</span>
                <span className="text-[#30363d] mx-1.5">-</span>
                <span className="text-sky-400">{liveStats.away.corners}</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs">
              <div className="text-[10px] font-sans text-[#8b949e] font-medium">🟨 Tarjetas ({liveStats.home.yellowCards + liveStats.away.yellowCards})</div>
              <div className="font-mono tabular-nums font-bold text-xs text-white mt-0.5 whitespace-nowrap">
                <span className="text-[#d9b114]">{liveStats.home.yellowCards}</span>
                <span className="text-[#30363d] mx-1.5">-</span>
                <span className="text-[#d9b114]">{liveStats.away.yellowCards}</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs">
              <div className="text-[10px] font-sans text-[#8b949e] font-medium">🎯 A Puerta</div>
              <div className="font-mono tabular-nums font-bold text-xs text-white mt-0.5 whitespace-nowrap">
                <span className="text-[#00ff66]">{liveStats.home.shotsOnTarget}</span>
                <span className="text-[#30363d] mx-1.5">-</span>
                <span className="text-sky-400">{liveStats.away.shotsOnTarget}</span>
              </div>
            </div>
          </div>

          {(liveStats.home.shots > 0 || liveStats.away.shots > 0 || liveStats.home.possessionPct !== 50) && (
            <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
              <div className="px-2 py-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-[10px] font-mono text-[#8b949e]">
                <span className="block text-[9px] text-[#8b949e] uppercase">Posesión</span>
                <strong className="text-white tabular-nums whitespace-nowrap">{Math.round(liveStats.home.possessionPct)}% - {Math.round(liveStats.away.possessionPct)}%</strong>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-[10px] font-mono text-[#8b949e]">
                <span className="block text-[9px] text-[#8b949e] uppercase">Remates</span>
                <strong className="text-white tabular-nums whitespace-nowrap">{liveStats.home.shots} - {liveStats.away.shots}</strong>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-[10px] font-mono text-[#8b949e]">
                <span className="block text-[9px] text-[#8b949e] uppercase">Faltas</span>
                <strong className="text-white tabular-nums whitespace-nowrap">{liveStats.home.foulsCommitted} - {liveStats.away.foulsCommitted}</strong>
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
              ? 'bg-[#161b22] text-white border-[#d9b114]/60 font-bold shadow-2xs'
              : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
          }`}
        >
          Todos ({events.length})
        </button>
        <button
          onClick={() => setFilter('GOALS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'GOALS'
              ? 'bg-[#161b22] text-[#00ff66] border-[#00ff66]/60 font-bold shadow-2xs'
              : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
          }`}
        >
          ⚽ Goles ({events.filter((e) => e.type === 'GOAL').length})
        </button>
        <button
          onClick={() => setFilter('CARDS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'CARDS'
              ? 'bg-[#161b22] text-[#d9b114] border-[#d9b114]/60 font-bold shadow-2xs'
              : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
          }`}
        >
          🟨 Tarj. ({totalRealCards})
        </button>
        <button
          onClick={() => setFilter('CORNERS')}
          type="button"
          className={`py-1.5 px-2 rounded-xl text-[11px] font-sans font-semibold transition-colors cursor-pointer border text-center truncate ${
            filter === 'CORNERS'
              ? 'bg-[#161b22] text-white border-[#30363d] font-bold shadow-2xs'
              : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:bg-[#1c2129] hover:text-white'
          }`}
        >
          🚩 Córners ({totalRealCorners})
        </button>
      </div>

      {/* 3. Línea de Tiempo Vertical Histórica */}
      <div className="relative pl-6 space-y-2 pt-1">
        {/* Línea vertical conectora */}
        <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#30363d]" />

        {filteredEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#8b949e] bg-[#0b0e14] rounded-xl border border-[#30363d]">
            No hay eventos registrados para este filtro.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const minLabel = ev.displayMinute || `${ev.minute}'`;

            // Inicio / Entretiempo / Final
            if (ev.type === 'PERIOD_START' || ev.type === 'PERIOD_HALF' || ev.type === 'PERIOD_END') {
              return (
                <div key={ev.id} className="relative flex items-center gap-3 py-0.5">
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[#8b949e] text-[10px]">
                    ⏱️
                  </div>
                  <div className="w-full py-1.5 px-3 rounded-xl bg-[#0b0e14] border border-[#30363d] text-center">
                    <span className="text-[11px] font-sans font-semibold text-[#8b949e]">
                      {ev.detail}
                    </span>
                  </div>
                </div>
              );
            }

            if (ev.type === 'GOAL') {
              return (
                <div key={ev.id} className="relative flex items-start gap-2.5 py-0.5">
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/40 flex items-center justify-center text-[#00ff66] font-bold text-[10px] shadow-2xs">
                    ⚽
                  </div>

                  <div className="w-full p-2.5 sm:p-3 rounded-xl bg-[#161b22] border border-[#00ff66]/40 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-[#00ff66] text-slate-950 font-mono font-bold text-[10px]">
                          {minLabel}
                        </span>
                        <span className="font-sans font-bold text-xs text-white truncate">
                          GOL · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#00ff66] font-mono text-[10px] font-bold shrink-0 border border-[#00ff66]/30">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>

                    <p className="text-[11px] font-sans text-[#8b949e] leading-snug">
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
                    isRed ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-[#d9b114]/10 border-[#d9b114]/40 text-[#d9b114]'
                  }`}>
                    {isRed ? '🟥' : '🟨'}
                  </div>

                  <div className="w-full p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] border ${
                          isRed
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-[#d9b114]/10 text-[#d9b114] border-[#d9b114]/30'
                        }`}>
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-white truncate">
                          {isRed ? 'Tarjeta Roja' : 'Tarjeta Amarilla'} · {ev.playerPrimary}
                        </span>
                      </div>
                      <span className="text-[10px] font-sans font-medium text-[#8b949e] shrink-0">
                        {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                      </span>
                    </div>
                    {ev.detail && (
                      <p className="text-[11px] font-sans text-[#8b949e] leading-tight">
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
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[#8b949e] text-[10px]">
                    🔄
                  </div>

                  <div className="w-full p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-[#161b22] text-[#8b949e] border border-[#30363d] font-mono font-bold text-[10px]">
                          {minLabel}
                        </span>
                        <span className="font-sans font-semibold text-xs text-white truncate">
                          Cambio en {ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-[#00ff66] font-medium min-w-0">
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ev.playerPrimary}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-400 font-medium min-w-0">
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
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[#d9b114] text-[10px]">
                    🚩
                  </div>

                  <div className="w-full py-2 px-3 rounded-xl bg-[#0b0e14] border border-[#30363d] shadow-2xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#161b22] text-white border border-[#30363d] font-mono font-bold text-[10px] shrink-0">
                        {minLabel}
                      </span>
                      <span className="font-sans font-medium text-xs text-white truncate">
                        {ev.detail || `Tiro de esquina · ${ev.teamSide === 'HOME' ? fixture.homeTeam.shortName : fixture.awayTeam.shortName}`}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[10px] font-sans font-medium text-[#8b949e] shrink-0">
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
