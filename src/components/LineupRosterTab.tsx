import React, { useState } from 'react';
import { DetailMatchPayload } from './MatchDetailModal';
import { getSoccerLineupData, getNBALineupData } from '../services/lineupService';
import { UserCheck, MapPin, BarChart2, LayoutGrid, List } from 'lucide-react';
import { useParlay } from '../context/ParlayContext';
import { PlayerStatsModal, PlayerModalPayload } from './PlayerStatsModal';
import { BasketballCourt25D, BasketballStarterPlayer, BasketballBenchPlayer } from './BasketballCourt25D';

interface LineupRosterTabProps {
  payload: DetailMatchPayload;
}

export const LineupRosterTab: React.FC<LineupRosterTabProps> = ({ payload }) => {
  const { isPickInParlay } = useParlay();
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<PlayerModalPayload | null>(null);
  const isSoccer = payload.type === 'SOCCER';
  const [selectedTeam, setSelectedTeam] = useState<'HOME' | 'AWAY'>('HOME');

  if (isSoccer) {
    const soccerData = getSoccerLineupData(payload.fixture);
    const homeTeam = payload.fixture.homeTeam;
    const awayTeam = payload.fixture.awayTeam;

    const isMatchStarted = payload.fixture.status === 'IN_PLAY' || payload.fixture.status === 'FINISHED';

    const currentTeamName = selectedTeam === 'HOME' ? homeTeam.name : awayTeam.name;
    const currentLogo = selectedTeam === 'HOME' ? homeTeam.logo : awayTeam.logo;
    const currentStarters = selectedTeam === 'HOME' ? soccerData.homeStarters : soccerData.awayStarters;
    const currentSubs = selectedTeam === 'HOME' ? soccerData.homeSubstitutes : soccerData.awaySubstitutes;
    const currentFormation = selectedTeam === 'HOME' ? soccerData.homeFormation : soccerData.awayFormation;
    const currentCoach = selectedTeam === 'HOME' ? soccerData.homeCoach : soccerData.awayCoach;

    return (
      <div className="space-y-4 text-xs">
        {/* Stadium & Referee Info Banner */}
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-sm text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              <strong className="text-white font-semibold">{soccerData.stadiumName}</strong> ({soccerData.stadiumCity})
            </span>
          </div>
          {soccerData.refereeName && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>⚖️ Árbitro:</span>
              <span className="text-amber-300 font-mono font-medium">{soccerData.refereeName}</span>
            </div>
          )}
        </div>

        {/* Team Selector Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 gap-1 text-center font-mono">
          <button
            type="button"
            onClick={() => setSelectedTeam('HOME')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
              selectedTeam === 'HOME'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <img
              src={homeTeam.logo}
              alt=""
              className="w-4 h-4 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="truncate">{homeTeam.name}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTeam('AWAY')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
              selectedTeam === 'AWAY'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <img
              src={awayTeam.logo}
              alt=""
              className="w-4 h-4 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="truncate">{awayTeam.name}</span>
          </button>
        </div>

        {/* Header: Formation & DT */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <img
              src={currentLogo}
              alt=""
              className="w-5 h-5 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="font-bold text-white text-xs">{currentTeamName}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/30">
              Esquema {currentFormation}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            📋 {currentCoach}
          </div>
        </div>

        {/* 11 Titulares (Starting XI) Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Alineación Confirmada (11 Titulares)</span>
            </span>
            <span className="text-emerald-400 font-bold text-[10px]">OFICIAL</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentStarters.map((player) => {
              const handleOpenModal = () => {
                setSelectedPlayerModal({
                  sport: 'SOCCER',
                  fixtureId: payload.fixture.id,
                  matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                  homeTeamName: homeTeam.name,
                  awayTeamName: awayTeam.name,
                  matchDate: payload.fixture.date,
                  matchTime: payload.fixture.time,
                  player: {
                    id: String(player.id),
                    name: player.name,
                    number: player.number,
                    position: player.position,
                    teamName: currentTeamName,
                    isCaptain: player.isCaptain,
                    matchYellowCards: player.matchYellowCards,
                    hasPreviousYellow: player.hasPreviousYellow,
                    isInjured: player.isInjured,
                    injuryNote: player.injuryNote
                  }
                });
              };

              return (
                <div
                  key={player.id}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2 hover:bg-slate-800/60 transition-colors"
                >
                  <div
                    onClick={handleOpenModal}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-amber-300 shrink-0 shadow-inner group-hover:border-emerald-500/50 transition-colors">
                      {player.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 text-xs truncate flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                        <span>{player.name}</span>
                        {player.isCaptain && (
                          <span className="px-1 rounded bg-amber-500/30 text-amber-300 font-mono text-[9px] font-bold">C</span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">
                        Posición: {player.position}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges & Stats & Props Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                        isPickInParlay(payload.fixture.id)
                          ? 'bg-emerald-400 text-black border-emerald-400 shadow-xs'
                          : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700 hover:border-emerald-500/40'
                      }`}
                      title="Ver estadísticas completas y mercados del jugador para el boleto"
                    >
                      <BarChart2 className="w-3 h-3 text-emerald-400" />
                      <span>Stats & Props</span>
                    </button>

                    {isMatchStarted ? (
                      // EN VIVO O FINALIZADO: Muestra únicamente tarjetas recibidas en ESTE partido
                      <>
                        {player.matchYellowCards === 1 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-[10px] font-bold border border-yellow-500/40" title="Tarjeta Amarilla recibida en este partido">
                            🟨 1
                          </span>
                        )}
                        {player.matchYellowCards >= 2 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/40" title="Doble Amarilla - Expulsado del partido">
                            🟨🟨 📕 Expulsado
                          </span>
                        )}
                      </>
                    ) : (
                      // PRE-PARTIDO (SCHEDULED): Muestra si llega con 1 amarilla del partido anterior
                      <>
                        {player.hasPreviousYellow && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/40" title="Llega con 1 amarilla del partido anterior">
                            🟨 1
                          </span>
                        )}
                      </>
                    )}

                    {player.isInjured && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/40" title={player.injuryNote || 'Baja por lesión'}>
                        🚑 Baja
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Substitutes & Bajas (Banco de Suplentes) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/60">
          <span className="text-[11px] font-mono text-slate-400 block px-1">
            🔄 Banco de Suplentes & Bajas
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentSubs.map((sub) => {
              const handleOpenSubModal = () => {
                setSelectedPlayerModal({
                  sport: 'SOCCER',
                  fixtureId: payload.fixture.id,
                  matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                  homeTeamName: homeTeam.name,
                  awayTeamName: awayTeam.name,
                  matchDate: payload.fixture.date,
                  matchTime: payload.fixture.time,
                  player: {
                    id: String(sub.id),
                    name: sub.name,
                    number: sub.number,
                    position: sub.position || 'DEL',
                    teamName: currentTeamName,
                    isInjured: sub.isInjured,
                    injuryNote: sub.injuryNote
                  }
                });
              };

              return (
                <div
                  key={sub.id}
                  onClick={handleOpenSubModal}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors group ${
                    sub.isInjured
                      ? 'bg-rose-950/20 hover:bg-rose-900/30 border-rose-500/30 text-rose-200'
                      : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                  }`}
                  title="Haz clic para ver estadísticas y cuotas del jugador"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 group-hover:border group-hover:border-emerald-500/50">
                      {sub.number}
                    </span>
                    <span className="text-xs truncate font-medium group-hover:text-emerald-300 transition-colors">{sub.name}</span>
                  </div>
                  {sub.isInjured ? (
                    <span className="text-[10px] font-mono text-rose-400 font-bold shrink-0">
                      🚑 {sub.injuryNote || 'Lesionado'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 group-hover:underline shrink-0 font-semibold flex items-center gap-1">
                      <BarChart2 className="w-3 h-3 text-emerald-400" />
                      <span>Stats</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Player Stats & Props Modal */}
        <PlayerStatsModal
          payload={selectedPlayerModal}
          isOpen={Boolean(selectedPlayerModal)}
          onClose={() => setSelectedPlayerModal(null)}
        />
      </div>
    );
  }

  // NBA Roster & Starting 5 View
  const nbaData = getNBALineupData(payload.fixture);
  const homeTeam = payload.fixture.homeTeam;
  const awayTeam = payload.fixture.awayTeam;

  const currentTeamName = selectedTeam === 'HOME' ? homeTeam.name : awayTeam.name;
  const currentLogo = selectedTeam === 'HOME' ? homeTeam.logo : awayTeam.logo;
  const currentStarters = selectedTeam === 'HOME' ? nbaData.homeStarters : nbaData.awayStarters;
  const currentBench = selectedTeam === 'HOME' ? nbaData.homeBench : nbaData.awayBench;
  const currentCoach = selectedTeam === 'HOME' ? nbaData.homeCoach : nbaData.awayCoach;

  const [courtViewMode, setCourtViewMode] = useState<'COURT' | 'LIST'>('COURT');

  const handleOpenPlayerFromCourt = (starter: BasketballStarterPlayer | BasketballBenchPlayer, teamName: string) => {
    setSelectedPlayerModal({
      sport: 'NBA',
      fixtureId: payload.fixture.id,
      matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      matchDate: payload.fixture.date,
      matchTime: payload.fixture.time,
      player: {
        id: String(starter.id),
        name: starter.name,
        number: starter.number,
        position: starter.position,
        teamName: teamName || currentTeamName,
        ppg: starter.ppg || 10.5,
        threePm: starter.threePm || 1.5,
        apg: starter.apg || 2.5,
        isInjured: starter.isInjured,
        injuryStatus: starter.injuryStatus
      }
    });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Arena Banner */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 shadow-sm text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            <strong className="text-white font-semibold">{nbaData.arenaName}</strong> ({nbaData.arenaCity})
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
          BALONCESTO
        </span>
      </div>

      {/* View Mode Conmutador (Cancha Completa vs Lista) */}
      <div className="flex items-center justify-between p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 gap-1.5 font-mono">
        <button
          type="button"
          onClick={() => setCourtViewMode('COURT')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            courtViewMode === 'COURT'
              ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-xs'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Cancha Completa 2.5D (5 vs 5)</span>
        </button>
        <button
          type="button"
          onClick={() => setCourtViewMode('LIST')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            courtViewMode === 'LIST'
              ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-xs'
              : 'bg-transparent border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Lista por Equipo</span>
        </button>
      </div>

      {/* 2.5D FULL COURT VIEW */}
      {courtViewMode === 'COURT' && (
        <BasketballCourt25D
          homeStarters={nbaData.homeStarters}
          awayStarters={nbaData.awayStarters}
          homeTeam={{ name: homeTeam.name, logo: homeTeam.logo }}
          awayTeam={{ name: awayTeam.name, logo: awayTeam.logo }}
          homeBench={nbaData.homeBench}
          awayBench={nbaData.awayBench}
          isLive={payload.fixture.status === 'IN_PLAY'}
          liveScore={payload.fixture.currentScore}
          liveClock={payload.fixture.liveClock}
          livePeriod={payload.fixture.livePeriod}
          onSelectPlayer={handleOpenPlayerFromCourt}
        />
      )}

      {/* LIST VIEW (Team by Team) */}
      {courtViewMode === 'LIST' && (
        <div className="space-y-4">
          {/* Team Selector Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 gap-1 text-center font-mono">
            <button
              type="button"
              onClick={() => setSelectedTeam('HOME')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                selectedTeam === 'HOME'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <img
                src={homeTeam.logo}
                alt=""
                className="w-4 h-4 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="truncate">{homeTeam.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTeam('AWAY')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                selectedTeam === 'AWAY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <img
                src={awayTeam.logo}
                alt=""
                className="w-4 h-4 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="truncate">{awayTeam.name}</span>
            </button>
          </div>

          {/* Header: DT */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <img
                src={currentLogo}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="font-bold text-white text-xs">{currentTeamName}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              📋 {currentCoach}
            </div>
          </div>

          {/* Starters List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Quinteto Inicial Titular</span>
              </span>
              <span className="text-amber-400 font-bold text-[10px]">OFICIAL</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentStarters.map((player) => {
                const handleOpenNBAModal = () => {
                  setSelectedPlayerModal({
                    sport: 'NBA',
                    fixtureId: payload.fixture.id,
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: payload.fixture.date,
                    matchTime: payload.fixture.time,
                    player: {
                      id: String(player.id),
                      name: player.name,
                      number: player.number,
                      position: player.position,
                      teamName: currentTeamName,
                      ppg: player.ppg,
                      threePm: player.threePm,
                      apg: player.apg,
                      isInjured: player.isInjured,
                      injuryStatus: player.injuryStatus
                    }
                  });
                };

                return (
                  <div
                    key={player.id}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2 hover:bg-slate-800/60 transition-colors"
                  >
                    <div
                      onClick={handleOpenNBAModal}
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-xs text-amber-300 shrink-0 shadow-inner group-hover:border-amber-400/60 transition-colors">
                        {player.position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-100 text-xs truncate group-hover:text-amber-300 transition-colors">
                          #{player.number} {player.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tracking-tight flex items-center gap-1.5">
                          <span className="text-amber-300 font-bold">{player.ppg} PPG</span>
                          <span>·</span>
                          <span>{player.threePm} 3PM</span>
                          <span>·</span>
                          <span>{player.apg} APG</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenNBAModal}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                          isPickInParlay(payload.fixture.id)
                            ? 'bg-amber-400 text-black border-amber-400 shadow-xs'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-amber-500/40'
                        }`}
                        title="Ver estadísticas completas y mercados del jugador para el boleto"
                      >
                        <BarChart2 className="w-3 h-3 text-amber-400" />
                        <span>Stats & Props</span>
                      </button>

                      {player.isInjured && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/40 shrink-0">
                          🚑 {player.injuryStatus || 'GTD'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench & Injuries for List View */}
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <span className="text-[11px] font-mono text-slate-400 block px-1">
              🔄 Rotación de Banco & Bajas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentBench.map((sub) => {
                const handleOpenNBABenchModal = () => {
                  setSelectedPlayerModal({
                    sport: 'NBA',
                    fixtureId: payload.fixture.id,
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: payload.fixture.date,
                    matchTime: payload.fixture.time,
                    player: {
                      id: String(sub.id),
                      name: sub.name,
                      number: sub.number,
                      position: sub.position,
                      teamName: currentTeamName,
                      ppg: sub.ppg || 8.5,
                      isInjured: sub.isInjured,
                      injuryStatus: sub.injuryStatus
                    }
                  });
                };

                return (
                  <div
                    key={sub.id}
                    onClick={handleOpenNBABenchModal}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors group ${
                      sub.isInjured
                        ? 'bg-rose-950/20 hover:bg-rose-900/30 border-rose-500/30 text-rose-200'
                        : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                    }`}
                    title="Haz clic para ver estadísticas y cuotas del jugador"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 group-hover:border group-hover:border-amber-500/50">
                        {sub.position}
                      </span>
                      <span className="text-xs truncate font-medium group-hover:text-amber-300 transition-colors">#{sub.number} {sub.name}</span>
                    </div>
                    {sub.isInjured ? (
                      <span className="text-[10px] font-mono text-rose-400 font-bold shrink-0">
                        🚑 {sub.injuryStatus || 'Out'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-400 group-hover:underline shrink-0 font-semibold flex items-center gap-1">
                        <BarChart2 className="w-3 h-3 text-amber-400" />
                        <span>{sub.ppg} PTS</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Player Stats & Props Modal */}
      <PlayerStatsModal
        payload={selectedPlayerModal}
        isOpen={Boolean(selectedPlayerModal)}
        onClose={() => setSelectedPlayerModal(null)}
      />
    </div>
  );
};
