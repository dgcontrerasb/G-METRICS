import React, { useEffect } from 'react';
import {
  X,
  BarChart2,
  Ticket,
  Target
} from 'lucide-react';
import { useParlay } from '../context/ParlayContext';

export interface SoccerPlayerPayload {
  id: string;
  name: string;
  number: number;
  position: string; // 'DEL' | 'MED' | 'DEF' | 'POR'
  teamName: string;
  teamLogo?: string;
  isCaptain?: boolean;
  matchYellowCards?: number;
  hasPreviousYellow?: boolean;
  isInjured?: boolean;
  injuryNote?: string;
  matchGoals?: number;
  matchShotsOnTarget?: number;
}

export interface NBAPlayerPayload {
  id: string;
  name: string;
  number: number;
  position: string; // 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  teamName: string;
  teamLogo?: string;
  ppg?: number;
  threePm?: number;
  apg?: number;
  rpg?: number;
  spg?: number;
  usageRate?: number;
  projectedPoints?: number;
  pointsLine?: number;
  overPointsProb?: number;
  projected3pm?: number;
  threePointersLine?: number;
  over3pmProb?: number;
  astLine?: number;
  overAstProb?: number;
  rebLine?: number;
  overRebProb?: number;
  praLine?: number;
  overPraProb?: number;
  liveCurrentPoints?: number;
  liveCurrent3pm?: number;
  liveCurrentAst?: number;
  liveCurrentReb?: number;
  liveCurrentPra?: number;
  isInjured?: boolean;
  injuryStatus?: string;
}

export type PlayerModalPayload =
  | {
      sport: 'SOCCER';
      fixtureId: string;
      matchTitle: string;
      homeTeamName: string;
      awayTeamName: string;
      matchDate: string;
      matchTime: string;
      matchStatus?: string;
      player: SoccerPlayerPayload;
    }
  | {
      sport: 'NBA';
      fixtureId: string;
      matchTitle: string;
      homeTeamName: string;
      awayTeamName: string;
      matchDate: string;
      matchTime: string;
      matchStatus?: string;
      player: NBAPlayerPayload;
    };

interface PlayerStatsModalProps {
  payload: PlayerModalPayload | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = React.memo(({
  payload,
  isOpen,
  onClose
}) => {
  const { isPickInParlay, togglePick } = useParlay();

  // Scroll Lock when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !payload) return null;

  const isSoccer = payload.sport === 'SOCCER';
  const player = payload.player;
  const isLive = payload.matchStatus === 'IN_PLAY';
  const isFinished = payload.matchStatus === 'FINISHED';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in transition-all"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Floating Modal Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] my-auto bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden overscroll-contain text-slate-900"
      >
        {/* 1. Header: Datos del Jugador y Equipo */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 bg-white shrink-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Dorsal Badge */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 border ${
                  isSoccer
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                #{player.number}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-sans font-semibold text-sm sm:text-base text-slate-900 leading-tight break-words">
                    {player.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase shrink-0 border ${
                      isSoccer
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {player.position}
                  </span>
                  {isLive && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[9.5px] font-bold animate-pulse">
                      ● EN VIVO
                    </span>
                  )}
                  {isFinished && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-mono text-[9.5px] font-bold">
                      FINALIZADO
                    </span>
                  )}
                  {isSoccer && (player as SoccerPlayerPayload).isCaptain && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[9px] font-bold shrink-0">
                      Capitán
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-sans mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-medium text-slate-700">{player.teamName}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500 font-mono text-[10px]">{payload.matchTitle}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 border border-slate-200/90 transition-colors cursor-pointer shrink-0 mt-0.5"
              aria-label="Cerrar modal"
              title="Cerrar (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body: Estadísticas Recientes + Mercados de Casas de Apuestas */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 bg-slate-50/60 text-slate-800 overscroll-contain pb-6">
          {/* A. SECCIÓN DE ESTADÍSTICAS Y PROMEDIOS BASE */}
          <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-mono font-semibold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <BarChart2 className={`w-4 h-4 ${isSoccer ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>Estadísticas & Promedios Temporada</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Datos Oficiales Opta/ESPN</span>
            </div>

            {isSoccer ? (
              /* Soccer Player Stats Grid */
              <SoccerStatsGrid player={player as SoccerPlayerPayload} />
            ) : (
              /* NBA Player Stats Grid */
              <NBAStatsGrid player={player as NBAPlayerPayload} />
            )}
          </div>

          {/* B. SECCIÓN DE MERCADOS DISPONIBLES PARA EL PARLAY BUILDER */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 px-1">
              <span className="text-xs font-mono font-semibold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Target className={`w-4 h-4 ${isSoccer ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>Mercados Individuales del Jugador</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Añade elecciones al Boleto
              </span>
            </div>

            {isSoccer ? (
              <SoccerMarketsList
                payload={payload as Extract<PlayerModalPayload, { sport: 'SOCCER' }>}
                isPickInParlay={isPickInParlay}
                togglePick={togglePick}
              />
            ) : (
              <NBAMarketsList
                payload={payload as Extract<PlayerModalPayload, { sport: 'NBA' }>}
                isPickInParlay={isPickInParlay}
                togglePick={togglePick}
              />
            )}
          </div>
        </div>

        {/* 3. Footer Informativo */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200/90 shrink-0 flex flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">💡</span>
            <span className="truncate">Selecciona mercados para tu Boleto Combinada</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold transition-all cursor-pointer shrink-0 text-xs shadow-2xs"
          >
            Listo / Volver
          </button>
        </div>
      </div>
    </div>
  );
});

// ===================================================
// SUBCOMPONENTES DE ESTADÍSTICAS Y MERCADOS
// ===================================================

const SoccerStatsGrid: React.FC<{ player: SoccerPlayerPayload }> = ({ player }) => {
  const isFW = player.position === 'DEL';
  const isMF = player.position === 'MED';

  const gpg = isFW ? 0.52 : isMF ? 0.24 : 0.08;
  const sot = isFW ? 1.8 : isMF ? 0.9 : 0.3;
  const fouls = isFW ? 1.2 : isMF ? 1.8 : 2.1;
  const cards = player.hasPreviousYellow ? 4 : 2;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Goles / Part.</span>
        <span className="text-xs font-bold text-emerald-700 mt-0.5 block">{gpg} GPG</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Tiros Arco/90'</span>
        <span className="text-xs font-bold text-slate-900 mt-0.5 block">{sot} SOT</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Faltas Recibidas</span>
        <span className="text-xs font-bold text-amber-700 mt-0.5 block">{fouls} / part.</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Amarillas Temp.</span>
        <span className="text-xs font-bold text-amber-700 mt-0.5 block">🟨 {cards}</span>
      </div>
    </div>
  );
};

const NBAStatsGrid: React.FC<{ player: NBAPlayerPayload }> = ({ player }) => {
  const ppg = player.ppg || player.projectedPoints || 22.5;
  const threePm = player.threePm || player.projected3pm || 2.5;
  const apg = player.apg || 5.2;
  const rpg = player.rpg || 6.1;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Puntos Promedio</span>
        <span className="text-xs font-bold text-amber-700 mt-0.5 block">{ppg} PPG</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Triples Encestados</span>
        <span className="text-xs font-bold text-amber-800 mt-0.5 block">{threePm} 3PM</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Asistencias</span>
        <span className="text-xs font-bold text-slate-900 mt-0.5 block">{apg} APG</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/90">
        <span className="text-[9px] text-slate-500 uppercase block">Rebotes</span>
        <span className="text-xs font-bold text-slate-700 mt-0.5 block">{rpg} RPG</span>
      </div>
    </div>
  );
};

const SoccerMarketsList: React.FC<{
  payload: Extract<PlayerModalPayload, { sport: 'SOCCER' }>;
  isPickInParlay: (fixtureId: string, marketKey?: string) => boolean;
  togglePick: (pick: any) => void;
}> = ({ payload, isPickInParlay, togglePick }) => {
  const { fixtureId, matchTitle, homeTeamName, awayTeamName, matchDate, matchTime, player } = payload;
  const safeName = player.name.replace(/\s+/g, '_');

  const isFW = player.position === 'DEL';
  const isMF = player.position === 'MED';

  const markets = [
    {
      key: `PROP_GOAL_ANYTIME_${safeName}`,
      label: `${player.name}: Anotará 1+ Gol`,
      odd: isFW ? 2.10 : isMF ? 3.40 : 5.50,
      prob: isFW ? 55 : isMF ? 32 : 18,
      category: '⚽ Goles'
    },
    {
      key: `PROP_SHOT_TARGET_${safeName}`,
      label: `${player.name}: 1+ Disparo a Puerta`,
      odd: isFW ? 1.45 : isMF ? 1.75 : 2.20,
      prob: isFW ? 75 : isMF ? 62 : 48,
      category: '🎯 Tiros a Puerta'
    },
    {
      key: `PROP_SHOT_TARGET_2_${safeName}`,
      label: `${player.name}: 2+ Disparos a Puerta`,
      odd: isFW ? 2.20 : isMF ? 3.10 : 4.80,
      prob: isFW ? 52 : isMF ? 35 : 21,
      category: '🎯 Tiros a Puerta'
    },
    {
      key: `PROP_CARD_${safeName}`,
      label: `${player.name}: Recibirá Tarjeta Amarilla`,
      odd: player.hasPreviousYellow ? 2.20 : 3.20,
      prob: player.hasPreviousYellow ? 48 : 34,
      category: '🟨 Tarjetas'
    }
  ];

  return (
    <div className="space-y-2">
      {markets.map((m) => {
        const inParlay = isPickInParlay(fixtureId, m.key);

        return (
          <div
            key={m.key}
            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs ${
              inParlay
                ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-200'
                : 'bg-white hover:bg-slate-50 border-slate-200/90'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  {m.category}
                </span>
                <span className="text-xs font-sans font-semibold text-slate-900 leading-snug break-words">
                  {m.label}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span>Probabilidad: <strong className="text-emerald-700">{m.prob}%</strong></span>
                <span className="text-slate-300">·</span>
                <span>Cuota ref: <strong className="text-slate-900">@{m.odd.toFixed(2)}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                togglePick({
                  id: `${fixtureId}_${m.key}`,
                  fixtureId,
                  sport: 'SOCCER',
                  matchTitle,
                  homeTeamName,
                  awayTeamName,
                  matchDate,
                  matchTime,
                  marketKey: m.key,
                  selectionLabel: m.label,
                  referenceOdd: m.odd,
                  userOdd: m.odd,
                  probability: m.prob,
                  isEV: m.prob >= 50
                });
              }}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border ${
                inParlay
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{inParlay ? '✓ En Boleto' : '+ Boleto'}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

const NBAMarketsList: React.FC<{
  payload: Extract<PlayerModalPayload, { sport: 'NBA' }>;
  isPickInParlay: (fixtureId: string, marketKey?: string) => boolean;
  togglePick: (pick: any) => void;
}> = ({ payload, isPickInParlay, togglePick }) => {
  const { fixtureId, matchTitle, homeTeamName, awayTeamName, matchDate, matchTime, player } = payload;
  const safeName = player.name.replace(/\s+/g, '_');

  const ptsLine = player.pointsLine ?? Math.max(8.5, Math.floor(player.ppg || player.projectedPoints || 18.5) - 0.5);
  const ptsProb = player.overPointsProb ?? 62;

  const threeLine = player.threePointersLine ?? Math.max(0.5, Math.floor(player.threePm || player.projected3pm || 2.2) + 0.5);
  const threeProb = player.over3pmProb ?? 58;

  const isGuard = player.position === 'PG' || player.position === 'SG';
  const isBig = player.position === 'PF' || player.position === 'C';
  const astLine = player.astLine ?? (isGuard ? 6.5 : isBig ? 2.5 : 4.5);
  const astProb = player.overAstProb ?? 60;
  const rebLine = player.rebLine ?? (isBig ? 8.5 : isGuard ? 4.5 : 6.5);
  const rebProb = player.overRebProb ?? 58;
  const praLine = player.praLine ?? Math.floor(ptsLine + astLine + rebLine) - 0.5;
  const praProb = player.overPraProb ?? 64;

  const markets = [
    {
      key: `PROP_PTS_${safeName}`,
      label: `${player.name}: +${ptsLine} Puntos`,
      odd: Number((100 / Math.max(10, ptsProb)).toFixed(2)),
      prob: ptsProb,
      category: '🏀 Puntos'
    },
    {
      key: `PROP_3PM_${safeName}`,
      label: `${player.name}: +${threeLine} Triples`,
      odd: Number((100 / Math.max(10, threeProb)).toFixed(2)),
      prob: threeProb,
      category: '🎯 Triples'
    },
    {
      key: `PROP_AST_${safeName}`,
      label: `${player.name}: +${astLine} Asistencias`,
      odd: 1.85,
      prob: astProb,
      category: '🅰️ Asistencias'
    },
    {
      key: `PROP_REB_${safeName}`,
      label: `${player.name}: +${rebLine} Rebotes`,
      odd: 1.90,
      prob: rebProb,
      category: '🛡️ Rebotes'
    },
    {
      key: `PROP_PRA_${safeName}`,
      label: `${player.name}: +${praLine} Combo (PTS+REB+AST)`,
      odd: 1.80,
      prob: praProb,
      category: '⚡ Combo PRA'
    }
  ];

  return (
    <div className="space-y-2">
      {markets.map((m) => {
        const inParlay = isPickInParlay(fixtureId, m.key);

        return (
          <div
            key={m.key}
            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs ${
              inParlay
                ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-200'
                : 'bg-white hover:bg-slate-50 border-slate-200/90'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold text-amber-900 bg-white px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                  {m.category}
                </span>
                <span className="text-xs font-sans font-semibold text-slate-900 leading-snug break-words">
                  {m.label}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span>Probabilidad: <strong className="text-amber-800">{m.prob}%</strong></span>
                <span className="text-slate-300">·</span>
                <span>Cuota ref: <strong className="text-slate-900">@{m.odd.toFixed(2)}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                togglePick({
                  id: `${fixtureId}_${m.key}`,
                  fixtureId,
                  sport: 'NBA',
                  matchTitle,
                  homeTeamName,
                  awayTeamName,
                  matchDate,
                  matchTime,
                  marketKey: m.key,
                  selectionLabel: m.label,
                  referenceOdd: m.odd,
                  userOdd: m.odd,
                  probability: m.prob,
                  isEV: m.prob >= 50
                });
              }}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border ${
                inParlay
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{inParlay ? '✓ En Boleto' : '+ Boleto'}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

