import React, { useState } from 'react';
import { DetailMatchPayload } from './MatchDetailModal';
import { getSoccerLineupData, getNBALineupData, SoccerPlayerInfo } from '../services/lineupService';
import { UserCheck, BarChart2, LayoutGrid, List } from 'lucide-react';
import { useParlay } from '../context/ParlayContext';
import { PlayerStatsModal, PlayerModalPayload } from './PlayerStatsModal';
import { BasketballCourt25D, BasketballStarterPlayer, BasketballBenchPlayer } from './BasketballCourt25D';
import { SoccerPitch2D } from './SoccerPitch2D';

interface LineupRosterTabProps {
  payload: DetailMatchPayload;
}

export const LineupRosterTab: React.FC<LineupRosterTabProps> = ({ payload }) => {
  const { isPickInParlay } = useParlay();
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<PlayerModalPayload | null>(null);
  const isSoccer = payload.type === 'SOCCER';
  const [selectedTeam, setSelectedTeam] = useState<'HOME' | 'AWAY'>('HOME');
  const [courtViewMode, setCourtViewMode] = useState<'COURT' | 'LIST'>('COURT');

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

    const handleOpenPlayerFromSoccerPitch = (player: SoccerPlayerInfo, teamName: string) => {
      setSelectedPlayerModal({
        sport: 'SOCCER',
        fixtureId: payload.fixture.id,
        matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam.name,
        matchDate: payload.fixture.date,
        matchTime: payload.fixture.time,
        matchStatus: payload.fixture.status,
        player: {
          id: String(player.id),
          name: player.name,
          number: player.number,
          position: player.position || 'DEL',
          teamName,
          isCaptain: player.isCaptain,
          matchYellowCards: player.matchYellowCards,
          hasPreviousYellow: player.hasPreviousYellow,
          isInjured: player.isInjured,
          injuryNote: player.injuryNote
        }
      });
    };

    return (
      <div className="space-y-2.5 text-xs">
        {/* View Mode Conmutador (Vista Cancha vs Lista por Equipo) */}
        <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl border border-slate-200/90 gap-1 font-mono">
          <button
            type="button"
            onClick={() => setCourtViewMode('COURT')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border whitespace-nowrap ${
              courtViewMode === 'COURT'
                ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3 h-3 shrink-0 text-emerald-600" />
            <span>Vista Cancha</span>
          </button>
          <button
            type="button"
            onClick={() => setCourtViewMode('LIST')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border whitespace-nowrap ${
              courtViewMode === 'LIST'
                ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <List className="w-3 h-3 shrink-0 text-emerald-600" />
            <span>Lista por Equipo</span>
          </button>
        </div>

        {/* 2D HORIZONTAL SOCCER PITCH VIEW */}
        {courtViewMode === 'COURT' && (
          <SoccerPitch2D
            fixture={payload.fixture}
            homeStarters={soccerData.homeStarters}
            awayStarters={soccerData.awayStarters}
            homeSubstitutes={soccerData.homeSubstitutes}
            awaySubstitutes={soccerData.awaySubstitutes}
            homeFormation={soccerData.homeFormation}
            awayFormation={soccerData.awayFormation}
            homeCoach={soccerData.homeCoach}
            awayCoach={soccerData.awayCoach}
            stadiumName={soccerData.stadiumName}
            stadiumCity={soccerData.stadiumCity}
            refereeName={soccerData.refereeName}
            onSelectPlayer={handleOpenPlayerFromSoccerPitch}
          />
        )}

        {/* LIST VIEW BY TEAM */}
        {courtViewMode === 'LIST' && (
          <div className="space-y-3">
            {/* Team Selector Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/90 gap-1 text-center font-mono">
              <button
                type="button"
                onClick={() => setSelectedTeam('HOME')}
                className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                  selectedTeam === 'HOME'
                    ? 'bg-white text-slate-900 border border-slate-200/90 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {homeTeam.logo?.trim() ? (
                  <img
                    src={homeTeam.logo}
                    alt=""
                    className="w-4 h-4 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="truncate">{homeTeam.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeam('AWAY')}
                className={`py-1.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                  selectedTeam === 'AWAY'
                    ? 'bg-white text-slate-900 border border-slate-200/90 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {awayTeam.logo?.trim() ? (
                  <img
                    src={awayTeam.logo}
                    alt=""
                    className="w-4 h-4 object-contain shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="truncate">{awayTeam.name}</span>
              </button>
            </div>

            {/* Header: Formation & DT */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-2">
                {currentLogo?.trim() ? (
                  <img
                    src={currentLogo}
                    alt=""
                    className="w-4 h-4 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <span className="font-semibold text-slate-900 text-xs">{currentTeamName}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-semibold text-[10px] border border-emerald-200">
                  Esquema {currentFormation}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                📋 {currentCoach}
              </div>
            </div>

        {/* 11 Titulares (Starting XI) Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alineación Confirmada (11 Titulares)</span>
            </span>
            <span className="text-emerald-700 font-semibold text-[10px]">OFICIAL</span>
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
                  matchStatus: payload.fixture.status,
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
                  className="p-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <div
                    onClick={handleOpenModal}
                    className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/90 flex items-center justify-center font-mono font-semibold text-xs text-slate-800 shrink-0 group-hover:border-emerald-400 transition-colors">
                      {player.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 text-xs flex items-center gap-1.5 flex-wrap group-hover:text-emerald-700 transition-colors">
                        <span className="truncate">{player.name}</span>
                        {player.isCaptain && (
                          <span className="px-1 rounded bg-amber-100 text-amber-800 font-mono text-[9px] font-bold shrink-0">C</span>
                        )}
                        {isMatchStarted ? (
                          <>
                            {player.matchYellowCards === 1 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-mono text-[9.5px] font-semibold border border-amber-300 shrink-0" title="Tarjeta Amarilla recibida en este partido">
                                🟨 1
                              </span>
                            )}
                            {player.matchYellowCards >= 2 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-800 font-mono text-[9.5px] font-semibold border border-rose-300 shrink-0" title="Doble Amarilla - Expulsado del partido">
                                🟨🟨 📕 Expulsado
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {player.hasPreviousYellow && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-mono text-[9.5px] font-semibold border border-amber-300 shrink-0" title="Llega con 1 amarilla del partido anterior">
                                🟨 1
                              </span>
                            )}
                          </>
                        )}
                        {player.isInjured && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-mono text-[9.5px] font-semibold border border-rose-200 shrink-0" title={player.injuryNote || 'Baja por lesión'}>
                            🚑 Baja
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                        Posición: {player.position}
                      </span>
                    </div>
                  </div>

                  {/* Symmetric Right Action Button */}
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                        isPickInParlay(payload.fixture.id)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/90'
                      }`}
                      title="Ver estadísticas completas y mercados del jugador para el boleto"
                    >
                      <BarChart2 className="w-3 h-3 text-emerald-600" />
                      <span>Stats & Props</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Substitutes & Bajas (Banco de Suplentes) */}
        <div className="space-y-2 pt-2 border-t border-slate-200/90">
          <span className="text-[11px] font-mono text-slate-600 font-medium block px-1">
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
                  matchStatus: payload.fixture.status,
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
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors group shadow-2xs ${
                    sub.isInjured
                      ? 'bg-rose-50/70 hover:bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
                  }`}
                  title="Haz clic para ver estadísticas y cuotas del jugador"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded bg-slate-100 border border-slate-200/90 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0 group-hover:border-emerald-400">
                      {sub.number}
                    </span>
                    <span className="text-xs truncate font-medium group-hover:text-emerald-700 transition-colors">{sub.name}</span>
                    {sub.isInjured && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200 text-[9.5px] font-mono font-semibold shrink-0">
                        🚑 {sub.injuryNote || 'Baja'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 group-hover:underline shrink-0 font-semibold flex items-center gap-1">
                    <BarChart2 className="w-3 h-3 text-emerald-600" />
                    <span>Stats</span>
                  </span>
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
  }

  // NBA Roster & Starting 5 View
  const nbaData = getNBALineupData(payload.fixture);
  const homeTeam = payload.fixture.homeTeam;
  const awayTeam = payload.fixture.awayTeam;
  const isNBALive = payload.fixture.status === 'IN_PLAY';
  const isNBAFinished = payload.fixture.status === 'FINISHED';
  const isNBAMatchStarted = isNBALive || isNBAFinished;

  const currentTeamName = selectedTeam === 'HOME' ? homeTeam.name : awayTeam.name;
  const currentLogo = selectedTeam === 'HOME' ? homeTeam.logo : awayTeam.logo;
  const currentStarters = selectedTeam === 'HOME' ? nbaData.homeStarters : nbaData.awayStarters;
  const currentBench = selectedTeam === 'HOME' ? nbaData.homeBench : nbaData.awayBench;
  const currentCoach = selectedTeam === 'HOME' ? nbaData.homeCoach : nbaData.awayCoach;

  const resolveNBAPlayerLiveProps = (starter: BasketballStarterPlayer | BasketballBenchPlayer, teamName: string) => {
    const matchedProp = payload.analysis.playerProps.find(
      (p) => p.name.toLowerCase() === starter.name.toLowerCase()
    );
    const ppg = starter.ppg || matchedProp?.seasonPpg || 14.5;
    const threePm = ('threePm' in starter ? starter.threePm : undefined) || matchedProp?.season3pm || 1.8;
    const apg = ('apg' in starter ? starter.apg : undefined) || 3.5;

    const ptsLine = matchedProp?.pointsLine ?? Math.max(8.5, Math.floor(ppg) - 0.5);
    const threePointersLine = matchedProp?.threePointersLine ?? Math.max(0.5, Math.floor(threePm) + 0.5);
    const astLine = matchedProp?.astLine ?? Math.floor(apg) + 0.5;
    const rebLine = matchedProp?.rebLine ?? 5.5;
    const praLine = matchedProp?.praLine ?? Math.floor(ptsLine + astLine + rebLine) - 0.5;

    const nameSeed = (starter.name.charCodeAt(0) || 65) + (starter.number || 23);
    const liveCurrentPoints = matchedProp?.liveCurrentPoints ?? (isNBAMatchStarted ? Math.round(ptsLine * (nameSeed % 2 === 0 ? 1.15 : 0.84)) : undefined);
    const liveCurrent3pm = matchedProp?.liveCurrent3pm ?? (isNBAMatchStarted ? Math.round(threePointersLine * (nameSeed % 3 === 0 ? 1.25 : 0.75)) : undefined);
    const liveCurrentAst = matchedProp?.liveCurrentAst ?? (isNBAMatchStarted ? Math.round(astLine * ((nameSeed + 1) % 2 === 0 ? 1.2 : 0.8)) : undefined);
    const liveCurrentReb = matchedProp?.liveCurrentReb ?? (isNBAMatchStarted ? Math.round(rebLine * ((nameSeed + 2) % 2 === 0 ? 1.2 : 0.85)) : undefined);
    const liveCurrentPra = matchedProp?.liveCurrentPra ?? (
      liveCurrentPoints !== undefined && liveCurrentAst !== undefined && liveCurrentReb !== undefined
        ? liveCurrentPoints + liveCurrentAst + liveCurrentReb
        : undefined
    );

    return {
      id: String(starter.id),
      name: starter.name,
      number: starter.number,
      position: starter.position,
      teamName: teamName || currentTeamName,
      ppg,
      threePm,
      apg,
      projectedPoints: matchedProp?.projectedPoints ?? ppg,
      pointsLine: ptsLine,
      overPointsProb: matchedProp?.overPointsProb ?? 60,
      projected3pm: matchedProp?.projected3pm ?? threePm,
      threePointersLine,
      over3pmProb: matchedProp?.over3pmProb ?? 56,
      astLine,
      overAstProb: matchedProp?.overAstProb ?? 60,
      rebLine,
      overRebProb: matchedProp?.overRebProb ?? 58,
      praLine,
      overPraProb: matchedProp?.overPraProb ?? 63,
      liveCurrentPoints,
      liveCurrent3pm,
      liveCurrentAst,
      liveCurrentReb,
      liveCurrentPra,
      isInjured: starter.isInjured,
      injuryStatus: starter.injuryStatus
    };
  };

  const handleOpenPlayerFromCourt = (starter: BasketballStarterPlayer | BasketballBenchPlayer, teamName: string) => {
    setSelectedPlayerModal({
      sport: 'NBA',
      fixtureId: payload.fixture.id,
      matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      matchDate: payload.fixture.date,
      matchTime: payload.fixture.time,
      matchStatus: payload.fixture.status,
      player: resolveNBAPlayerLiveProps(starter, teamName)
    });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* View Mode Conmutador (Vista Cancha vs Lista por Equipo) */}
      <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl border border-slate-200/90 gap-1 font-mono">
        <button
          type="button"
          onClick={() => setCourtViewMode('COURT')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border whitespace-nowrap ${
            courtViewMode === 'COURT'
              ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
              : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutGrid className="w-3 h-3 shrink-0 text-amber-600" />
          <span>Vista Cancha</span>
        </button>
        <button
          type="button"
          onClick={() => setCourtViewMode('LIST')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border whitespace-nowrap ${
            courtViewMode === 'LIST'
              ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
              : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <List className="w-3 h-3 shrink-0 text-amber-600" />
          <span>Lista por Equipo</span>
        </button>
      </div>

      {/* 2D HORIZONTAL COURT VIEW */}
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
          quarters={payload.fixture.quarters}
          liveSituation={payload.fixture.liveSituation}
          arenaName={nbaData.arenaName}
          arenaCity={nbaData.arenaCity}
          leagueName={payload.fixture.league?.name || 'NBA · Temporada Regular'}
          matchDateLabel={payload.fixture.date}
          matchTimeLabel={payload.fixture.time}
          onSelectPlayer={handleOpenPlayerFromCourt}
        />
      )}

      {/* LIST VIEW (Team by Team) */}
      {courtViewMode === 'LIST' && (
        <div className="space-y-3">
          {/* Team Selector Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/90 gap-1 text-center font-mono">
            <button
              type="button"
              onClick={() => setSelectedTeam('HOME')}
              className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                selectedTeam === 'HOME'
                  ? 'bg-white text-slate-900 border border-slate-200/90 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {homeTeam.logo?.trim() ? (
                <img
                  src={homeTeam.logo}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span className="truncate">{homeTeam.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTeam('AWAY')}
              className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-semibold ${
                selectedTeam === 'AWAY'
                  ? 'bg-white text-slate-900 border border-slate-200/90 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {awayTeam.logo?.trim() ? (
                <img
                  src={awayTeam.logo}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span className="truncate">{awayTeam.name}</span>
            </button>
          </div>

          {/* Header: DT */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2">
              {currentLogo?.trim() ? (
                <img
                  src={currentLogo}
                  alt=""
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span className="font-semibold text-slate-900 text-xs">{currentTeamName}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              📋 {currentCoach}
            </div>
          </div>

          {/* Starters List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Quinteto Inicial Titular</span>
              </span>
              <span className="text-amber-700 font-semibold text-[10px]">OFICIAL</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentStarters.map((player) => {
                const resolvedPlayer = resolveNBAPlayerLiveProps(player, currentTeamName);

                const handleOpenNBAModal = () => {
                  setSelectedPlayerModal({
                    sport: 'NBA',
                    fixtureId: payload.fixture.id,
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: payload.fixture.date,
                    matchTime: payload.fixture.time,
                    matchStatus: payload.fixture.status,
                    player: resolvedPlayer
                  });
                };

                return (
                  <div
                    key={player.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <div
                      onClick={handleOpenNBAModal}
                      className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center font-mono font-semibold text-xs text-amber-800 shrink-0 group-hover:border-amber-400 transition-colors">
                        {player.position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 text-xs flex items-center gap-1.5 flex-wrap group-hover:text-amber-700 transition-colors">
                          <span className="truncate">#{player.number} {player.name}</span>
                          {player.isInjured && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-mono text-[9.5px] font-semibold border border-rose-200 shrink-0">
                              🚑 {player.injuryStatus || 'GTD'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 tracking-tight flex items-center gap-1.5 flex-wrap">
                          <span className="text-amber-700 font-semibold">{player.ppg} PPG</span>
                          <span>·</span>
                          <span>{player.threePm} 3PM</span>
                          <span>·</span>
                          <span>{player.apg} APG</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenNBAModal}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                          isPickInParlay(payload.fixture.id)
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/90'
                        }`}
                        title="Ver estadísticas completas y mercados del jugador para el boleto"
                      >
                        <BarChart2 className="w-3 h-3 text-amber-600" />
                        <span>Stats & Props</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench & Injuries for List View */}
          <div className="space-y-2 pt-2 border-t border-slate-200/90">
            <span className="text-[11px] font-mono text-slate-600 font-medium block px-1">
              🔄 Rotación de Banco & Bajas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentBench.map((sub) => {
                const resolvedBench = resolveNBAPlayerLiveProps(sub, currentTeamName);
                const handleOpenNBABenchModal = () => {
                  setSelectedPlayerModal({
                    sport: 'NBA',
                    fixtureId: payload.fixture.id,
                    matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                    homeTeamName: homeTeam.name,
                    awayTeamName: awayTeam.name,
                    matchDate: payload.fixture.date,
                    matchTime: payload.fixture.time,
                    matchStatus: payload.fixture.status,
                    player: resolvedBench
                  });
                };

                return (
                  <div
                    key={sub.id}
                    onClick={handleOpenNBABenchModal}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors group shadow-2xs ${
                      sub.isInjured
                        ? 'bg-rose-50/70 hover:bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
                    }`}
                    title="Haz clic para ver estadísticas y cuotas del jugador"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded bg-slate-100 border border-slate-200/90 text-slate-700 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0 group-hover:border-amber-400">
                        {sub.position}
                      </span>
                      <span className="text-xs truncate font-medium group-hover:text-amber-700 transition-colors">#{sub.number} {sub.name}</span>
                      {sub.isInjured && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200 text-[9.5px] font-mono font-semibold shrink-0">
                          🚑 {sub.injuryStatus || 'Out'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-amber-700 group-hover:underline shrink-0 font-semibold flex items-center gap-1">
                      <BarChart2 className="w-3 h-3 text-amber-600" />
                      <span>{sub.ppg} PTS</span>
                    </span>
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
