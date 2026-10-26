import React, { useState, useEffect } from 'react';
import { UserCheck, Sparkles, ChevronDown, ChevronUp, BarChart2, Shield, Flame, Zap, Radio } from 'lucide-react';

export interface BasketballStarterPlayer {
  id: string | number;
  name: string;
  number: number;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C' | string;
  ppg: number;
  threePm: number;
  apg: number;
  rpg?: number;
  isInjured?: boolean;
  injuryStatus?: string;
}

export interface BasketballBenchPlayer {
  id: string | number;
  name: string;
  number: number;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C' | string;
  ppg?: number;
  threePm?: number;
  apg?: number;
  rpg?: number;
  isInjured?: boolean;
  injuryStatus?: string;
}

export interface BasketballCourt25DProps {
  // Support both full court (dual teams) and backwards compatibility
  homeStarters?: BasketballStarterPlayer[];
  awayStarters?: BasketballStarterPlayer[];
  homeTeam?: { name: string; logo?: string; primaryColor?: string };
  awayTeam?: { name: string; logo?: string; primaryColor?: string };
  homeBench?: BasketballBenchPlayer[];
  awayBench?: BasketballBenchPlayer[];
  isLive?: boolean;
  liveScore?: { home: number; away: number };
  liveClock?: string;
  livePeriod?: string;
  onSelectPlayer: (player: BasketballStarterPlayer | BasketballBenchPlayer, teamName: string) => void;
  // Legacy props fallback
  starters?: BasketballStarterPlayer[];
  teamName?: string;
  teamLogo?: string;
}

export interface CourtLiveAction {
  id: string;
  team: 'HOME' | 'AWAY';
  playerName: string;
  playerNumber: number;
  shotType: '3PT' | 'PAINT' | 'MID_RANGE';
  points: number;
  zone: string;
  timestamp: string;
}

export const BasketballCourt25D: React.FC<BasketballCourt25DProps> = ({
  homeStarters = [],
  awayStarters = [],
  homeTeam = { name: 'Equipo Local' },
  awayTeam = { name: 'Equipo Visitante' },
  homeBench = [],
  awayBench = [],
  isLive = false,
  liveScore,
  liveClock,
  livePeriod,
  onSelectPlayer,
  // Fallbacks
  starters,
  teamName,
  teamLogo
}) => {
  // Resolved starters
  const effectiveHomeStarters = homeStarters.length > 0 ? homeStarters : starters || [];
  const effectiveAwayStarters = awayStarters.length > 0 ? awayStarters : [];
  const effectiveHomeName = homeTeam?.name || teamName || 'Local';
  const effectiveAwayName = awayTeam?.name || 'Visitante';
  const effectiveHomeLogo = homeTeam?.logo || teamLogo;
  const effectiveAwayLogo = awayTeam?.logo;

  // Visual density toggle (Detailed Pre-match / Tactical Compact / Hot Zones Heatmap)
  const [displayMode, setDisplayMode] = useState<'DETAILED' | 'TACTICAL' | 'HEATMAP'>(
    isLive ? 'TACTICAL' : 'DETAILED'
  );

  // Active bench drawer: null | 'HOME' | 'AWAY'
  const [activeBench, setActiveBench] = useState<'HOME' | 'AWAY' | null>(null);

  // Active Live Shot / Scoring Play on Court
  const [activeLiveAction, setActiveLiveAction] = useState<CourtLiveAction | null>(null);

  // Initialize or trigger realistic live scoring action if match is live
  useEffect(() => {
    if (!isLive) return;

    // Pick a primary shooter from starters to represent recent court dynamic
    const pickAction = () => {
      const isHome = Math.random() > 0.45;
      const targetStarters = isHome ? effectiveHomeStarters : effectiveAwayStarters;
      if (!targetStarters || targetStarters.length === 0) return;

      const randomIdx = Math.floor(Math.random() * Math.min(targetStarters.length, 5));
      const shooter = targetStarters[randomIdx];
      const isThree = shooter.position === 'PG' || shooter.position === 'SG' || shooter.threePm > 2.0 || Math.random() > 0.6;
      const isPaint = !isThree && (shooter.position === 'C' || shooter.position === 'PF' || Math.random() > 0.5);

      const shotType: '3PT' | 'PAINT' | 'MID_RANGE' = isThree ? '3PT' : isPaint ? 'PAINT' : 'MID_RANGE';
      const points = shotType === '3PT' ? 3 : 2;
      const zoneLabel = shotType === '3PT' ? 'Perímetro 3P' : shotType === 'PAINT' ? 'Pintura' : 'Media Distancia';

      setActiveLiveAction({
        id: `shot-${Date.now()}`,
        team: isHome ? 'HOME' : 'AWAY',
        playerName: shooter.name.split(' ').pop() || shooter.name,
        playerNumber: shooter.number,
        shotType,
        points,
        zone: zoneLabel,
        timestamp: liveClock ? `${livePeriod || 'Q2'} ${liveClock}` : 'En Juego'
      });
    };

    // Initial trigger
    pickAction();

    // Pulse interval every 14 seconds to reflect dynamic court rhythm in live matches
    const interval = setInterval(pickAction, 14000);
    return () => clearInterval(interval);
  }, [isLive, effectiveHomeStarters, effectiveAwayStarters, liveClock, livePeriod]);

  // Tactical coordinates on FULL VERTICAL COURT (Percentages: 0-100% X, 0-100% Y)
  // Away team attacks/defends in North Half (Y: 12% to 44%)
  const getAwayCoordinates = (pos: string, index: number) => {
    const cleanPos = (pos || '').toUpperCase();
    if (cleanPos.includes('C') || cleanPos === 'PIVOT' || cleanPos === 'PÍVOT') return { x: 50, y: 15 };
    if (cleanPos.includes('PF') || cleanPos === 'ALA') return { x: 30, y: 24 };
    if (cleanPos.includes('SF') || cleanPos === 'ALERO') return { x: 70, y: 24 };
    if (cleanPos.includes('SG') || cleanPos === 'ESCOLTA') return { x: 20, y: 38 };
    if (cleanPos.includes('PG') || cleanPos === 'BASE') return { x: 62, y: 44 };

    // Fallbacks
    const fallbacks = [
      { x: 50, y: 15 },
      { x: 30, y: 24 },
      { x: 70, y: 24 },
      { x: 20, y: 38 },
      { x: 62, y: 44 }
    ];
    return fallbacks[index % fallbacks.length];
  };

  // Home team attacks/defends in South Half (Y: 56% to 88%)
  const getHomeCoordinates = (pos: string, index: number) => {
    const cleanPos = (pos || '').toUpperCase();
    if (cleanPos.includes('PG') || cleanPos === 'BASE') return { x: 38, y: 56 };
    if (cleanPos.includes('SG') || cleanPos === 'ESCOLTA') return { x: 80, y: 62 };
    if (cleanPos.includes('SF') || cleanPos === 'ALERO') return { x: 22, y: 76 };
    if (cleanPos.includes('PF') || cleanPos === 'ALA') return { x: 70, y: 76 };
    if (cleanPos.includes('C') || cleanPos === 'PIVOT' || cleanPos === 'PÍVOT') return { x: 50, y: 85 };

    // Fallbacks
    const fallbacks = [
      { x: 38, y: 56 },
      { x: 80, y: 62 },
      { x: 22, y: 76 },
      { x: 70, y: 76 },
      { x: 50, y: 85 }
    ];
    return fallbacks[index % fallbacks.length];
  };

  // Manual trigger for users to test / simulate a live shot action
  const handleTriggerSimulatedPlay = () => {
    const isHome = Math.random() > 0.5;
    const targetStarters = isHome ? effectiveHomeStarters : effectiveAwayStarters;
    if (!targetStarters || targetStarters.length === 0) return;

    const randomIdx = Math.floor(Math.random() * Math.min(targetStarters.length, 5));
    const shooter = targetStarters[randomIdx];
    const shotType: '3PT' | 'PAINT' | 'MID_RANGE' = Math.random() > 0.5 ? '3PT' : 'PAINT';

    setActiveLiveAction({
      id: `manual-${Date.now()}`,
      team: isHome ? 'HOME' : 'AWAY',
      playerName: shooter.name.split(' ').pop() || shooter.name,
      playerNumber: shooter.number,
      shotType,
      points: shotType === '3PT' ? 3 : 2,
      zone: shotType === '3PT' ? 'Perímetro 3P' : 'Pintura',
      timestamp: liveClock ? `${livePeriod || 'Q'} ${liveClock}` : 'Jugada en Vivo'
    });
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#0a0f18] via-[#0f172a] to-[#0a0f18] border border-amber-500/30 p-3 sm:p-4 shadow-2xl">
      {/* Top Header: Centered Full Court Matchup & Badges */}
      <div className="mb-2 px-1 flex flex-col items-center justify-center text-center">
        {/* Row 1: Full Court Tag + Live Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] sm:text-[11px] font-bold border border-amber-500/30 shrink-0">
            Cancha Completa 2.5D (5 vs 5)
          </span>

          {isLive ? (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              EN VIVO {liveClock ? `· ${livePeriod || 'Q'} ${liveClock}` : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
              Pre-Partido
            </span>
          )}

          {liveScore && (
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono text-[11px] font-black text-amber-300">
              {liveScore.away} - {liveScore.home}
            </span>
          )}
        </div>

        {/* Row 2: Matchup Escudos y Nombres */}
        <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-bold text-white tracking-wide mt-1">
          {/* Away Team Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-300">
            {effectiveAwayLogo && (
              <img
                src={effectiveAwayLogo}
                alt=""
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="truncate max-w-[110px] sm:max-w-[150px]">{effectiveAwayName}</span>
            <span className="text-[10px] font-mono text-sky-400/80 font-normal">(Visita)</span>
          </div>

          <span className="text-slate-500 font-mono text-xs font-black">VS</span>

          {/* Home Team Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300">
            {effectiveHomeLogo && (
              <img
                src={effectiveHomeLogo}
                alt=""
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="truncate max-w-[110px] sm:max-w-[150px]">{effectiveHomeName}</span>
            <span className="text-[10px] font-mono text-amber-400/80 font-normal">(Local)</span>
          </div>
        </div>

        {/* Row 3: Live Action Flash Banner (When a shot occurs) */}
        {activeLiveAction && (
          <div className="w-full max-w-md mt-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 shadow-lg flex items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                +{activeLiveAction.points} PTS
              </span>
              <span className="truncate font-semibold text-slate-100">
                #{activeLiveAction.playerNumber} {activeLiveAction.playerName}
              </span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                ({activeLiveAction.zone})
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-slate-400">
              <span>{activeLiveAction.timestamp}</span>
            </div>
          </div>
        )}

        {/* Row 4: Mode Switcher (Fichas vs Compacto vs Zonas de Calor) & Trigger */}
        <div className="mt-2.5 flex items-center justify-between w-full max-w-md gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-slate-200 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-700/70 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span>Toca un jugador para Props</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono font-bold">
            <button
              type="button"
              onClick={() => setDisplayMode('DETAILED')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                displayMode === 'DETAILED'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Muestra nombres completos, dorsales y promedios por partido"
            >
              Fichas
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('TACTICAL')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                displayMode === 'TACTICAL'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista limpia en círculos tácticos con dorsal"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Compacto</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('HEATMAP')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                displayMode === 'HEATMAP'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Zonas de calor con efectividad ofensiva"
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Calor</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2.5D Full Court Vertical Canvas */}
      <div className="relative w-full aspect-[9/13] sm:aspect-[10/14] max-w-md mx-auto flex items-center justify-center [perspective:950px] my-1">
        {/* Full Court Floor in Isometric Space */}
        <div
          className="relative w-full h-full rounded-2xl border-2 border-amber-400/50 shadow-2xl overflow-hidden transition-transform duration-500"
          style={{
            transform: 'rotateX(22deg) scale(0.97)',
            transformOrigin: '50% 50%',
            background: 'linear-gradient(180deg, #78350f 0%, #92400e 25%, #b45309 50%, #92400e 75%, #78350f 100%)',
            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.8), inset 0 0 50px rgba(0, 0, 0, 0.65)'
          }}
        >
          {/* Wood Planks Pattern */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #000 0px, #000 1px, transparent 1px, transparent 16px)'
            }}
          />

          {/* SVG Official Full Court Markings & Dynamic Hot Zones */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 150"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Gradients for Hot Zones */}
              <radialGradient id="heatPaintAway" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.25" />
              </radialGradient>
              <radialGradient id="heatPaintHome" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.25" />
              </radialGradient>
              <radialGradient id="heatThreeAway" cx="50%" cy="20%" r="60%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
              </radialGradient>
              <radialGradient id="heatThreeHome" cx="50%" cy="80%" r="60%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.05" />
              </radialGradient>
            </defs>

            {/* Outer Perimeter */}
            <rect x="3" y="3" width="94" height="144" rx="2" ry="2" fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="0.8" />

            {/* Half-Court Center Line */}
            <line x1="3" y1="75" x2="97" y2="75" stroke="rgba(255, 255, 255, 0.95)" strokeWidth="1.2" />

            {/* Center Circle & Restraining Ring */}
            <circle cx="50" cy="75" r="14" fill="rgba(0, 0, 0, 0.2)" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="0.9" />
            <circle cx="50" cy="75" r="5" fill="rgba(217, 119, 6, 0.35)" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="0.7" />

            {/* ----------------- TOP BASKET (AWAY TEAM) ----------------- */}
            {/* Away 3-Point Area / Hot Zone Overlay */}
            {displayMode === 'HEATMAP' && (
              <path
                d="M 10,3 L 10,14 A 40 40 0 0 0 90,14 L 90,3 Z"
                fill="url(#heatThreeAway)"
                className="animate-pulse"
              />
            )}

            {/* Active Live Action Shot Pulse on Away Half */}
            {activeLiveAction?.team === 'AWAY' && activeLiveAction.shotType === '3PT' && (
              <path
                d="M 10,3 L 10,14 A 40 40 0 0 0 90,14 L 90,3"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeDasharray="4, 2"
                className="animate-pulse"
              />
            )}

            {/* Backboard & Rim */}
            <line x1="43" y1="8" x2="57" y2="8" stroke="#ffffff" strokeWidth="1.4" />
            <line x1="50" y1="8" x2="50" y2="10" stroke="#ea580c" strokeWidth="1" />
            <circle cx="50" cy="12" r="3.2" fill="none" stroke="#ea580c" strokeWidth="1.1" />

            {/* Paint / Key Area */}
            <rect
              x="35"
              y="3"
              width="30"
              height="26"
              fill={
                displayMode === 'HEATMAP'
                  ? 'url(#heatPaintAway)'
                  : activeLiveAction?.team === 'AWAY' && activeLiveAction.shotType === 'PAINT'
                  ? 'rgba(56, 189, 248, 0.65)'
                  : 'rgba(3, 105, 161, 0.35)'
              }
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="0.8"
              className={
                activeLiveAction?.team === 'AWAY' && activeLiveAction.shotType === 'PAINT'
                  ? 'animate-pulse'
                  : ''
              }
            />
            {/* Free Throw Circle */}
            <path d="M 35,29 A 15 15 0 0 0 65,29" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.8" />
            <path d="M 35,29 A 15 15 0 0 1 65,29" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.8" strokeDasharray="2, 2" />

            {/* Three-Point Line Arc */}
            <path
              d="M 10,3 L 10,14 A 40 40 0 0 0 90,14 L 90,3"
              fill="none"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="0.9"
            />

            {/* ----------------- BOTTOM BASKET (HOME TEAM) ----------------- */}
            {/* Home 3-Point Area / Hot Zone Overlay */}
            {displayMode === 'HEATMAP' && (
              <path
                d="M 10,147 L 10,136 A 40 40 0 0 1 90,136 L 90,147 Z"
                fill="url(#heatThreeHome)"
                className="animate-pulse"
              />
            )}

            {/* Active Live Action Shot Pulse on Home Half */}
            {activeLiveAction?.team === 'HOME' && activeLiveAction.shotType === '3PT' && (
              <path
                d="M 10,147 L 10,136 A 40 40 0 0 1 90,136 L 90,147"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
                strokeDasharray="4, 2"
                className="animate-pulse"
              />
            )}

            {/* Backboard & Rim */}
            <line x1="43" y1="142" x2="57" y2="142" stroke="#ffffff" strokeWidth="1.4" />
            <line x1="50" y1="142" x2="50" y2="140" stroke="#ea580c" strokeWidth="1" />
            <circle cx="50" cy="138" r="3.2" fill="none" stroke="#ea580c" strokeWidth="1.1" />

            {/* Paint / Key Area */}
            <rect
              x="35"
              y="121"
              width="30"
              height="26"
              fill={
                displayMode === 'HEATMAP'
                  ? 'url(#heatPaintHome)'
                  : activeLiveAction?.team === 'HOME' && activeLiveAction.shotType === 'PAINT'
                  ? 'rgba(245, 158, 11, 0.65)'
                  : 'rgba(180, 83, 9, 0.4)'
              }
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="0.8"
              className={
                activeLiveAction?.team === 'HOME' && activeLiveAction.shotType === 'PAINT'
                  ? 'animate-pulse'
                  : ''
              }
            />
            {/* Free Throw Circle */}
            <path d="M 35,121 A 15 15 0 0 1 65,121" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.8" />
            <path d="M 35,121 A 15 15 0 0 0 65,121" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.8" strokeDasharray="2, 2" />

            {/* Three-Point Line Arc */}
            <path
              d="M 10,147 L 10,136 A 40 40 0 0 1 90,136 L 90,147"
              fill="none"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="0.9"
            />
          </svg>

          {/* Court Orientation Labels */}
          <div className="absolute top-2 left-3 text-[9px] font-mono font-bold text-sky-300/80 select-none uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>{effectiveAwayName} (Norte)</span>
          </div>
          <div className="absolute bottom-2 right-3 text-[9px] font-mono font-bold text-amber-300/80 select-none uppercase tracking-wider flex items-center gap-1">
            <span>{effectiveHomeName} (Sur)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          </div>

          {/* Heatmap Floating Efficiency Badges */}
          {displayMode === 'HEATMAP' && (
            <>
              {/* Away Top Badges */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-sky-950/90 border border-sky-400/50 text-sky-200 text-[8px] font-mono font-bold shadow pointer-events-none">
                Pintura: 58.2% eFG
              </div>
              <div className="absolute top-14 left-4 px-1.5 py-0.5 rounded bg-slate-950/80 border border-sky-500/40 text-sky-300 text-[7px] font-mono pointer-events-none">
                3P: 37.8%
              </div>

              {/* Home Bottom Badges */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400/50 text-amber-200 text-[8px] font-mono font-bold shadow pointer-events-none">
                Pintura: 61.5% eFG
              </div>
              <div className="absolute bottom-14 right-4 px-1.5 py-0.5 rounded bg-slate-950/80 border border-amber-500/40 text-amber-300 text-[7px] font-mono pointer-events-none">
                3P: 39.4%
              </div>
            </>
          )}

          {/* ================= AWAY TEAM PLAYERS (TOP HALF) ================= */}
          {effectiveAwayStarters.slice(0, 5).map((player, idx) => {
            const coords = getAwayCoordinates(player.position, idx);
            const isScorer =
              activeLiveAction?.team === 'AWAY' &&
              activeLiveAction.playerNumber === player.number;

            return (
              <div
                key={`away-${player.id}-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPlayer(player, effectiveAwayName);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 ${
                  isScorer ? 'z-30' : ''
                }`}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`
                }}
              >
                {/* Counter-rotate billboard to stand vertically facing the viewer */}
                <div
                  className="flex flex-col items-center select-none transition-transform duration-200 group-hover:scale-115 group-active:scale-95"
                  style={{
                    transform: 'rotateX(-22deg)'
                  }}
                >
                  {/* Position Badge with Sky-Blue Glow */}
                  <div className="relative">
                    <div
                      className={`rounded-full bg-slate-950 border-2 text-sky-300 font-mono font-black flex items-center justify-center shadow-lg shadow-black/80 group-hover:bg-sky-500 group-hover:text-black group-hover:border-white transition-all ${
                        isScorer
                          ? 'border-emerald-400 bg-sky-900 text-white ring-4 ring-emerald-400/60 ring-offset-2 ring-offset-black scale-110 animate-bounce'
                          : 'border-sky-400'
                      } ${
                        displayMode === 'DETAILED'
                          ? 'w-7 h-7 sm:w-8 sm:h-8 text-[10px]'
                          : 'w-7 h-7 sm:w-8 sm:h-8 text-[11px]'
                      }`}
                    >
                      {displayMode === 'DETAILED' ? player.position : `#${player.number}`}
                    </div>

                    {/* Scorer Indicator Ball */}
                    {isScorer && (
                      <span className="absolute -top-3 -right-2 text-xs animate-pulse">
                        🏀
                      </span>
                    )}

                    {/* Injury Badge */}
                    {player.isInjured ? (
                      <span className="absolute -top-1 -right-1 text-[9px]">🚑</span>
                    ) : (
                      !isScorer && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                        </span>
                      )
                    )}
                  </div>

                  {/* Player Capsule in Detailed Mode */}
                  {displayMode === 'DETAILED' && (
                    <div className="mt-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-sky-600/60 backdrop-blur-md shadow-xl text-center whitespace-nowrap group-hover:border-sky-300 transition-all max-w-[90px] sm:max-w-[110px]">
                      <div className="text-[9px] sm:text-[10px] font-bold text-white tracking-tight flex items-center justify-center gap-1">
                        <span className="text-sky-300 font-mono">#{player.number}</span>
                        <span className="truncate">{player.name.split(' ').pop()}</span>
                      </div>
                      <div className="text-[8px] font-mono text-emerald-300 font-semibold flex items-center justify-center gap-1">
                        <span>{player.ppg}p</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-sky-300">{player.threePm} 3P</span>
                      </div>
                    </div>
                  )}

                  {/* Short Name Tag in Tactical / Heatmap Mode for Clean Visibility */}
                  {displayMode !== 'DETAILED' && (
                    <span className="text-[8px] font-mono font-bold text-sky-200 mt-0.5 px-1 rounded bg-black/60 truncate max-w-[55px]">
                      {player.name.split(' ').pop()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* ================= HOME TEAM PLAYERS (BOTTOM HALF) ================= */}
          {effectiveHomeStarters.slice(0, 5).map((player, idx) => {
            const coords = getHomeCoordinates(player.position, idx);
            const isScorer =
              activeLiveAction?.team === 'HOME' &&
              activeLiveAction.playerNumber === player.number;

            return (
              <div
                key={`home-${player.id}-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPlayer(player, effectiveHomeName);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 ${
                  isScorer ? 'z-30' : ''
                }`}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`
                }}
              >
                {/* Counter-rotate billboard to stand vertically */}
                <div
                  className="flex flex-col items-center select-none transition-transform duration-200 group-hover:scale-115 group-active:scale-95"
                  style={{
                    transform: 'rotateX(-22deg)'
                  }}
                >
                  {/* Position Badge with Amber Glow */}
                  <div className="relative">
                    <div
                      className={`rounded-full bg-slate-950 border-2 text-amber-300 font-mono font-black flex items-center justify-center shadow-lg shadow-black/80 group-hover:bg-amber-500 group-hover:text-black group-hover:border-white transition-all ${
                        isScorer
                          ? 'border-emerald-400 bg-amber-900 text-white ring-4 ring-emerald-400/60 ring-offset-2 ring-offset-black scale-110 animate-bounce'
                          : 'border-amber-400'
                      } ${
                        displayMode === 'DETAILED'
                          ? 'w-7 h-7 sm:w-8 sm:h-8 text-[10px]'
                          : 'w-7 h-7 sm:w-8 sm:h-8 text-[11px]'
                      }`}
                    >
                      {displayMode === 'DETAILED' ? player.position : `#${player.number}`}
                    </div>

                    {/* Scorer Indicator Ball */}
                    {isScorer && (
                      <span className="absolute -top-3 -right-2 text-xs animate-pulse">
                        🏀
                      </span>
                    )}

                    {/* Injury Badge */}
                    {player.isInjured ? (
                      <span className="absolute -top-1 -right-1 text-[9px]">🚑</span>
                    ) : (
                      !isScorer && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      )
                    )}
                  </div>

                  {/* Player Capsule in Detailed Mode */}
                  {displayMode === 'DETAILED' && (
                    <div className="mt-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-amber-600/60 backdrop-blur-md shadow-xl text-center whitespace-nowrap group-hover:border-amber-300 transition-all max-w-[90px] sm:max-w-[110px]">
                      <div className="text-[9px] sm:text-[10px] font-bold text-white tracking-tight flex items-center justify-center gap-1">
                        <span className="text-amber-400 font-mono">#{player.number}</span>
                        <span className="truncate">{player.name.split(' ').pop()}</span>
                      </div>
                      <div className="text-[8px] font-mono text-emerald-300 font-semibold flex items-center justify-center gap-1">
                        <span>{player.ppg}p</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-amber-300">{player.threePm} 3P</span>
                      </div>
                    </div>
                  )}

                  {/* Short Name Tag in Tactical / Heatmap Mode for Clean Visibility */}
                  {displayMode !== 'DETAILED' && (
                    <span className="text-[8px] font-mono font-bold text-amber-200 mt-0.5 px-1 rounded bg-black/60 truncate max-w-[55px]">
                      {player.name.split(' ').pop()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap Legend Bar (When in Heatmap Mode) */}
      {displayMode === 'HEATMAP' && (
        <div className="mt-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-rose-300 font-bold">
            <Flame className="w-3.5 h-3.5" />
            <span>Zonas de Calor Ofensivas</span>
          </span>
          <div className="flex items-center gap-2 text-[9px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Pintura (&gt;58%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Triple (&gt;37%)
            </span>
          </div>
        </div>
      )}

      {/* Action Bar: Trigger Live Shot Simulator */}
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={handleTriggerSimulatedPlay}
          className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>⚡ Simular Tiro en Cancha</span>
        </button>

        <span className="text-[10px] font-mono text-slate-500">
          Azul: Visitante · Ámbar: Local
        </span>
      </div>

      {/* Interactive Collapsible Benches Underneath */}
      <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
        {/* Toggle Buttons for Benches */}
        <div className="grid grid-cols-2 gap-2">
          {/* Away Bench Toggle */}
          <button
            type="button"
            onClick={() => setActiveBench(activeBench === 'AWAY' ? null : 'AWAY')}
            className={`py-2 px-2.5 rounded-xl border flex items-center justify-between text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeBench === 'AWAY'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-sm'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">Banca {effectiveAwayName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-sky-300 text-[10px]">
                {awayBench.length}
              </span>
              {activeBench === 'AWAY' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* Home Bench Toggle */}
          <button
            type="button"
            onClick={() => setActiveBench(activeBench === 'HOME' ? null : 'HOME')}
            className={`py-2 px-2.5 rounded-xl border flex items-center justify-between text-xs font-mono font-semibold transition-all cursor-pointer ${
              activeBench === 'HOME'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Banca {effectiveHomeName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-amber-300 text-[10px]">
                {homeBench.length}
              </span>
              {activeBench === 'HOME' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>
        </div>

        {/* Expanded Bench Roster Drawer */}
        {activeBench !== null && (
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 border-b border-slate-800/60 pb-1.5">
              <span>
                Suplentes de{' '}
                <strong className={activeBench === 'HOME' ? 'text-amber-400' : 'text-sky-400'}>
                  {activeBench === 'HOME' ? effectiveHomeName : effectiveAwayName}
                </strong>
              </span>
              <span className="text-[10px] text-slate-500">Toca para ver estadísticas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {(activeBench === 'HOME' ? homeBench : awayBench).map((player) => (
                <div
                  key={`bench-${player.id}`}
                  onClick={() =>
                    onSelectPlayer(
                      player,
                      activeBench === 'HOME' ? effectiveHomeName : effectiveAwayName
                    )
                  }
                  className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        activeBench === 'HOME'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {player.position}
                    </span>
                    <span className="text-xs truncate font-medium text-slate-200 group-hover:text-white">
                      #{player.number} {player.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                    {player.isInjured ? (
                      <span className="text-rose-400 font-bold">🚑 {player.injuryStatus || 'Baja'}</span>
                    ) : (
                      <span className="text-emerald-400 group-hover:underline flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" />
                        <span>{player.ppg || 7.5} pts</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend / Footer Indicator */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono pt-1">
          <span className="flex items-center gap-1 text-slate-300">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>10 Jugadores en Duela</span>
          </span>
          <span className="text-slate-500">Perspectiva 2.5D Oficial</span>
        </div>
      </div>
    </div>
  );
};
