import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Shield,
  Flame,
  Users,
  Radio,
  ChevronLeft,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { MatchFixture } from '../types';
import { SoccerPlayerInfo } from '../services/lineupService';

export interface SoccerPitch2DProps {
  fixture: MatchFixture;
  homeStarters: SoccerPlayerInfo[];
  awayStarters: SoccerPlayerInfo[];
  homeSubstitutes: SoccerPlayerInfo[];
  awaySubstitutes: SoccerPlayerInfo[];
  homeFormation: string;
  awayFormation: string;
  homeCoach: string;
  awayCoach: string;
  stadiumName: string;
  stadiumCity?: string;
  refereeName?: string;
  onSelectPlayer: (player: SoccerPlayerInfo, teamName: string) => void;
}

type PitchSlideMode = 'TRACKER' | 'LINEUPS' | 'HEATMAP';
// 3 subtle, non-intrusive phases:
// 1. RADAR_BALL: Only ball & subtle vector arrow on pitch (no notification box)
// 2. SLIM_POSSESSION: Ultra-thin micro-pill showing possession/attack at current minute
// 3. SLIM_STAT_PILL: Ultra-thin 2-line micro-HUD with current minute & live stat/incident
type PitchAnimPhase = 'RADAR_BALL' | 'SLIM_POSSESSION' | 'SLIM_STAT_PILL';

const SLIDE_ORDER: PitchSlideMode[] = ['TRACKER', 'LINEUPS', 'HEATMAP'];

function buildTeamCode(name: string, shortName?: string): string {
  const candidate = (shortName || name || '').trim();
  const words = candidate.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0].replace(/[^a-zA-Z]/g, '');
    const second = words[1].replace(/[^a-zA-Z]/g, '');
    if (second.length === 2) {
      return `${first[0] || ''}${second}`.toUpperCase();
    }
    return `${first.slice(0, 2)}${second[0] || ''}`.toUpperCase();
  }
  const clean = candidate.replace(/[^a-zA-Z]/g, '');
  return (clean.slice(0, 3) || 'EQP').toUpperCase();
}

export const SoccerPitch2D: React.FC<SoccerPitch2DProps> = ({
  fixture,
  homeStarters,
  awayStarters,
  homeSubstitutes,
  awaySubstitutes,
  homeFormation,
  awayFormation,
  stadiumName,
  refereeName,
  onSelectPlayer
}) => {
  const isLive = fixture.status === 'IN_PLAY';
  const isHalfTime = Boolean(fixture.currentScore?.isHalfTime);
  const currentMinute = fixture.currentScore?.minute ?? 45;
  const homeTeam = fixture.homeTeam;
  const awayTeam = fixture.awayTeam;

  const homeAbbr = useMemo(
    () => buildTeamCode(homeTeam.name, homeTeam.shortName),
    [homeTeam.name, homeTeam.shortName]
  );

  const awayAbbr = useMemo(
    () => buildTeamCode(awayTeam.name, awayTeam.shortName),
    [awayTeam.name, awayTeam.shortName]
  );

  const [slideMode, setSlideMode] = useState<PitchSlideMode>(isLive ? 'TRACKER' : 'LINEUPS');
  const [activeBench, setActiveBench] = useState<'HOME' | 'AWAY' | null>(null);
  const [trackerPhase, setTrackerPhase] = useState<PitchAnimPhase>('SLIM_POSSESSION');
  const [stepCursor, setStepCursor] = useState<number>(0);

  // Relaxed, natural cadence (5.5s per phase, including a calm RADAR_BALL phase with zero popup)
  useEffect(() => {
    if (slideMode !== 'TRACKER') return;

    const phases: PitchAnimPhase[] = ['SLIM_POSSESSION', 'RADAR_BALL', 'SLIM_STAT_PILL'];
    let idx = 0;
    setTrackerPhase(phases[0]);

    const timer = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setTrackerPhase(phases[idx]);
      if (idx === 0) {
        setStepCursor((prev) => prev + 1);
      }
    }, 5200);

    return () => clearInterval(timer);
  }, [slideMode, fixture.currentScore?.home, fixture.currentScore?.away]);

  // Synchronized live telemetry metrics for the compact header table
  const statsRow = useMemo(() => {
    const ls = fixture.liveStats;
    const homeGoals = fixture.currentScore?.home ?? 0;
    const awayGoals = fixture.currentScore?.away ?? 0;

    return {
      homePoss: ls?.home.possessionPct ?? 54,
      awayPoss: ls?.away.possessionPct ?? 46,
      homeShots: ls?.home.shotsOnTarget ?? Math.max(homeGoals + 2, 4),
      awayShots: ls?.away.shotsOnTarget ?? Math.max(awayGoals + 1, 3),
      homeCorners: ls?.home.corners ?? 5,
      awayCorners: ls?.away.corners ?? 4,
      homeYellows: ls?.home.yellowCards ?? 1,
      awayYellows: ls?.away.yellowCards ?? 2,
      homeGoals,
      awayGoals
    };
  }, [fixture.liveStats, fixture.currentScore]);

  // STRICT REAL-TIME TRACKER STATE:
  // Never shows old minutes (e.g., 46' when match is at 73') as live notifications.
  // Only shows an official event if it occurred within +/- 1 minute of `currentMinute`;
  // otherwise shows live tactical progression synchronized to the exact `currentMinute`.
  const activeLivePlay = useMemo(() => {
    const events = fixture.liveEvents || [];
    const minuteLabel = isLive
      ? isHalfTime
        ? 'MT · 45\''
        : `${currentMinute}'`
      : fixture.time;

    // Check if an official event just happened right now (within 1 minute of current live clock)
    const justHappenedEvent = isLive
      ? [...events]
          .reverse()
          .find((ev) => typeof ev.minute === 'number' && Math.abs(currentMinute - ev.minute) <= 1)
      : undefined;

    if (justHappenedEvent) {
      const isHome = justHappenedEvent.teamSide === 'HOME';
      const typeLabel =
        justHappenedEvent.type === 'GOAL'
          ? '⚽ ¡Gol Oficial!'
          : justHappenedEvent.type === 'RED_CARD'
          ? '📕 Tarjeta Roja'
          : justHappenedEvent.type === 'YELLOW_CARD'
          ? '🟨 Tarjeta Amarilla'
          : justHappenedEvent.type === 'CORNER'
          ? '🚩 Tiro de Esquina'
          : '🔄 Cambio Oficial';

      return {
        isHome,
        teamName: isHome ? homeTeam.name : awayTeam.name,
        teamCode: isHome ? homeAbbr : awayAbbr,
        playerName:
          justHappenedEvent.playerPrimary ||
          (isHome ? homeStarters[9]?.name : awayStarters[9]?.name) ||
          (isHome ? homeTeam.name : awayTeam.name),
        minuteLabel: `${currentMinute}'`,
        typeLabel,
        subLabel:
          justHappenedEvent.detail ||
          `Marcador en vivo: ${statsRow.homeGoals} - ${statsRow.awayGoals}`,
        ballX: isHome ? 82 : 18,
        ballY: justHappenedEvent.type === 'CORNER' ? 16 : 50,
        originX: isHome ? 52 : 48,
        originY: 50
      };
    }

    // Live tactical radar state always stamped with the exact current minute
    const isHome = stepCursor % 2 === 0;
    const starters = isHome ? homeStarters : awayStarters;
    const keyPlayer =
      starters[(stepCursor * 3 + 7) % Math.max(1, starters.length)] || starters[0];

    const liveStates = [
      {
        typeLabel: isLive ? '⚡ Ataque en Campo Rival' : '⚡ Proyección Ofensiva',
        subLabel: `${keyPlayer?.name || (isHome ? homeAbbr : awayAbbr)} · Remates al arco: ${
          isHome ? statsRow.homeShots : statsRow.awayShots
        }`,
        ballX: isHome ? 76 : 24,
        ballY: 36,
        originX: isHome ? 46 : 54,
        originY: 52
      },
      {
        typeLabel: isLive ? '🎯 Control y Posesión' : '🎯 Circulación Táctica',
        subLabel: `Posesión ${isHome ? statsRow.homePoss : statsRow.awayPoss}% · Córners: ${
          isHome ? statsRow.homeCorners : statsRow.awayCorners
        }`,
        ballX: isHome ? 62 : 38,
        ballY: 62,
        originX: isHome ? 36 : 64,
        originY: 48
      },
      {
        typeLabel: isLive ? '🚩 Presión en Área' : '🚩 Peligro en Área (xG)',
        subLabel: `${keyPlayer?.name || (isHome ? homeAbbr : awayAbbr)} · Marcador: ${
          statsRow.homeGoals
        }-${statsRow.awayGoals}`,
        ballX: isHome ? 84 : 16,
        ballY: 48,
        originX: isHome ? 58 : 42,
        originY: 35
      }
    ];

    const chosen = liveStates[stepCursor % liveStates.length];

    return {
      isHome,
      teamName: isHome ? homeTeam.name : awayTeam.name,
      teamCode: isHome ? homeAbbr : awayAbbr,
      playerName: keyPlayer?.name || (isHome ? homeTeam.name : awayTeam.name),
      minuteLabel,
      typeLabel: chosen.typeLabel,
      subLabel: chosen.subLabel,
      ballX: chosen.ballX,
      ballY: chosen.ballY,
      originX: chosen.originX,
      originY: chosen.originY
    };
  }, [
    fixture.liveEvents,
    fixture.time,
    isLive,
    isHalfTime,
    currentMinute,
    stepCursor,
    homeTeam.name,
    awayTeam.name,
    homeAbbr,
    awayAbbr,
    homeStarters,
    awayStarters,
    statsRow
  ]);

  // 2D Horizontal Pitch Coordinates for 11 Starters
  const getHomePitchCoords = (index: number) => {
    const coords = [
      { x: 7, y: 50 },  // GK
      { x: 18, y: 18 }, // LB
      { x: 17, y: 39 }, // CB
      { x: 17, y: 61 }, // CB
      { x: 18, y: 82 }, // RB
      { x: 30, y: 25 }, // CM
      { x: 29, y: 50 }, // CDM
      { x: 30, y: 75 }, // CM
      { x: 42, y: 20 }, // LW
      { x: 44, y: 50 }, // ST
      { x: 42, y: 80 }  // RW
    ];
    return coords[index % coords.length];
  };

  const getAwayPitchCoords = (index: number) => {
    const coords = [
      { x: 93, y: 50 }, // GK
      { x: 82, y: 18 }, // RB
      { x: 83, y: 39 }, // CB
      { x: 83, y: 61 }, // CB
      { x: 82, y: 82 }, // LB
      { x: 70, y: 25 }, // CM
      { x: 71, y: 50 }, // CDM
      { x: 70, y: 75 }, // CM
      { x: 58, y: 20 }, // RW
      { x: 56, y: 50 }, // ST
      { x: 58, y: 80 }  // LW
    ];
    return coords[index % coords.length];
  };

  const handleCycleSlide = (dir: -1 | 1) => {
    const idx = SLIDE_ORDER.indexOf(slideMode);
    const nextIdx = (idx + dir + SLIDE_ORDER.length) % SLIDE_ORDER.length;
    setSlideMode(SLIDE_ORDER[nextIdx]);
  };

  const isActionHome = activeLivePlay.isHome;
  const activeBorderColor = isActionHome ? 'border-emerald-400/75' : 'border-sky-400/75';
  const activeDotColor = isActionHome ? 'bg-emerald-400' : 'bg-sky-400';
  const activeTextColor = isActionHome ? 'text-emerald-300' : 'text-sky-300';

  // Convert percentage coords to SVG viewBox (280 x 145)
  const svgBallX = (activeLivePlay.ballX / 100) * 280;
  const svgBallY = (activeLivePlay.ballY / 100) * 145;
  const svgOriginX = (activeLivePlay.originX / 100) * 280;
  const svgOriginY = (activeLivePlay.originY / 100) * 145;

  return (
    <div className="w-full rounded-2xl bg-[#0B0F19] border border-slate-800/90 overflow-hidden shadow-xl">
      {/* 1. ULTRA-COMPACT SCOREBOARD & TELEMETRY HEADER */}
      <div className="px-3 py-1.5 bg-[#080C14] border-b border-slate-800/90">
        {/* Top Row: Live Status + Full Stadium Name + Stat Columns */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[9.5px] font-mono text-slate-400 pb-1 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {isLive ? (
              isHalfTime ? (
                <span className="inline-flex items-center gap-1 text-amber-400 font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>DESCANSO • 45'</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>EN VIVO • {currentMinute}'</span>
                </span>
              )
            ) : (
              <span className="text-slate-300 font-semibold shrink-0">
                {fixture.date} • {fixture.time}
              </span>
            )}

            <span className="text-slate-400 inline-flex items-center gap-1 border-l border-slate-800 pl-1.5 text-[8.5px]">
              <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span>{stadiumName}</span>
              {refereeName && <span className="hidden sm:inline text-slate-500">· ⚖️ {refereeName}</span>}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[8.5px] font-bold tracking-wider text-slate-400 shrink-0 ml-auto">
            <span className="w-6 text-center">POS</span>
            <span className="w-4 text-center" title="Tiros a Puerta">TIR</span>
            <span className="w-4 text-center" title="Córners">CÓR</span>
            <span className="w-4 text-center" title="Tarjetas Amarillas">🟨</span>
            <span className="w-6 text-center text-emerald-400">GOL</span>
          </div>
        </div>

        {/* Team Rows */}
        <div className="pt-1 space-y-1">
          {/* Home Team Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <img
                src={homeTeam.logo}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-[11px] font-bold text-white">{homeTeam.name}</span>
              <span className="text-[8.5px] font-mono text-emerald-400/80 hidden sm:inline">
                ({homeFormation})
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10.5px] shrink-0">
              <span className="w-6 text-center text-slate-300">{statsRow.homePoss}%</span>
              <span className="w-4 text-center text-slate-300">{statsRow.homeShots}</span>
              <span className="w-4 text-center text-slate-300">{statsRow.homeCorners}</span>
              <span className="w-4 text-center text-amber-300">{statsRow.homeYellows}</span>
              <span className="w-6 py-0.2 rounded bg-slate-800/90 border border-emerald-500/40 text-center font-black text-emerald-300 text-[11px]">
                {statsRow.homeGoals}
              </span>
            </div>
          </div>

          {/* Away Team Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <img
                src={awayTeam.logo}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-[11px] font-bold text-white">{awayTeam.name}</span>
              <span className="text-[8.5px] font-mono text-sky-400/80 hidden sm:inline">
                ({awayFormation})
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10.5px] shrink-0">
              <span className="w-6 text-center text-slate-300">{statsRow.awayPoss}%</span>
              <span className="w-4 text-center text-slate-300">{statsRow.awayShots}</span>
              <span className="w-4 text-center text-slate-300">{statsRow.awayCorners}</span>
              <span className="w-4 text-center text-amber-300">{statsRow.awayYellows}</span>
              <span className="w-6 py-0.2 rounded bg-slate-800/90 border border-sky-500/40 text-center font-black text-sky-300 text-[11px]">
                {statsRow.awayGoals}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-TOOLBAR: Mode Tabs (Tracker En Vivo | 11 vs 11 Props | Zonas xG) */}
      <div className="px-2.5 py-1 bg-[#0D1322] border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSlideMode('TRACKER')}
            className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
              slideMode === 'TRACKER'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
            <span>Tracker En Vivo</span>
          </button>

          <button
            type="button"
            onClick={() => setSlideMode('LINEUPS')}
            className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
              slideMode === 'LINEUPS'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-2.5 h-2.5" />
            <span>11 vs 11 (Props)</span>
          </button>

          <button
            type="button"
            onClick={() => setSlideMode('HEATMAP')}
            className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
              slideMode === 'HEATMAP'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-2.5 h-2.5 text-rose-400" />
            <span>Zonas xG</span>
          </button>
        </div>

        <span className="text-[8.5px] font-mono text-slate-400 hidden sm:inline">
          {slideMode === 'LINEUPS' ? 'Toca un jugador para Props' : 'Reloj sincronizado en vivo'}
        </span>
      </div>

      {/* 3. HORIZONTAL 2D SOCCER PITCH (Fits 100% in View, Zero Blur, Subtle Tactical Vector) */}
      <div className="p-2 bg-[#0c1614]">
        <div className="relative w-full aspect-[16/8.2] max-h-[190px] mx-auto rounded-xl overflow-hidden border border-emerald-500/30 shadow-inner bg-[#0f241c] select-none">
          {/* Pure 2D Horizontal Soccer Pitch SVG */}
          <svg
            viewBox="0 0 280 145"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <linearGradient id="pitchTurfGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0d2119" />
                <stop offset="50%" stopColor="#122c22" />
                <stop offset="100%" stopColor="#0d2119" />
              </linearGradient>
              <radialGradient id="leftBoxHeat" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.04" />
              </radialGradient>
              <radialGradient id="rightBoxHeat" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.04" />
              </radialGradient>
              <radialGradient id="ballRadarGlowHome" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ballRadarGlowAway" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Outer Pitch Apron */}
            <rect x="0" y="0" width="280" height="145" fill="#091712" />

            {/* Turf Playing Surface */}
            <rect x="10" y="7" width="260" height="131" fill="url(#pitchTurfGrad)" />

            {/* Vertical Mowed Grass Stripes */}
            <g fill="rgba(255,255,255,0.02)">
              <rect x="10" y="7" width="26" height="131" />
              <rect x="62" y="7" width="26" height="131" />
              <rect x="114" y="7" width="26" height="131" />
              <rect x="166" y="7" width="26" height="131" />
              <rect x="218" y="7" width="26" height="131" />
            </g>

            {/* Outer Touchlines & Goal Lines */}
            <rect
              x="10"
              y="7"
              width="260"
              height="131"
              fill="none"
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1.1"
            />

            {/* Halfway Line & Center Circle */}
            <line
              x1="140"
              y1="7"
              x2="140"
              y2="138"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1.1"
            />
            <circle
              cx="140"
              cy="72.5"
              r="18"
              fill="rgba(9, 23, 18, 0.35)"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1.1"
            />
            <circle cx="140" cy="72.5" r="2" fill="rgba(226, 232, 240, 0.65)" />

            {/* ================= LEFT GOAL & PENALTY AREA (HOME SIDE) ================= */}
            <rect
              x="10"
              y="32"
              width="42"
              height="81"
              fill={slideMode === 'HEATMAP' ? 'url(#leftBoxHeat)' : 'rgba(16, 185, 129, 0.06)'}
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1"
            />
            <rect
              x="10"
              y="52"
              width="16"
              height="41"
              fill="none"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1"
            />
            <rect
              x="5"
              y="62"
              width="5"
              height="21"
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10b981"
              strokeWidth="1.1"
            />
            <circle cx="39" cy="72.5" r="1.5" fill="rgba(226, 232, 240, 0.7)" />
            <path
              d="M 52,58 A 16 16 0 0 1 52,87"
              fill="none"
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1"
            />

            {/* ================= RIGHT GOAL & PENALTY AREA (AWAY SIDE) ================= */}
            <rect
              x="228"
              y="32"
              width="42"
              height="81"
              fill={slideMode === 'HEATMAP' ? 'url(#rightBoxHeat)' : 'rgba(56, 189, 248, 0.06)'}
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1"
            />
            <rect
              x="254"
              y="52"
              width="16"
              height="41"
              fill="none"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1"
            />
            <rect
              x="270"
              y="62"
              width="5"
              height="21"
              fill="rgba(56, 189, 248, 0.2)"
              stroke="#38bdf8"
              strokeWidth="1.1"
            />
            <circle cx="241" cy="72.5" r="1.5" fill="rgba(226, 232, 240, 0.7)" />
            <path
              d="M 228,58 A 16 16 0 0 0 228,87"
              fill="none"
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1"
            />

            {/* SUBTLE LOCALIZED TACTICAL RADAR & VECTOR IN TRACKER MODE */}
            {slideMode === 'TRACKER' && (
              <g>
                {/* Localized soft radar halo around the ball (takes <8% of pitch) */}
                <circle
                  cx={svgBallX}
                  cy={svgBallY}
                  r="22"
                  fill={isActionHome ? 'url(#ballRadarGlowHome)' : 'url(#ballRadarGlowAway)'}
                />
                {/* Subtle tactical progression line from origin to active ball zone */}
                <line
                  x1={svgOriginX}
                  y1={svgOriginY}
                  x2={svgBallX}
                  y2={svgBallY}
                  stroke={isActionHome ? '#34d399' : '#38bdf8'}
                  strokeWidth="1.1"
                  strokeDasharray="3,2"
                  strokeOpacity="0.75"
                />
                <circle
                  cx={svgOriginX}
                  cy={svgOriginY}
                  r="1.8"
                  fill={isActionHome ? '#34d399' : '#38bdf8'}
                  fillOpacity="0.6"
                />
              </g>
            )}
          </svg>

          {/* Crisp Corner Team Labels (Never blurred) */}
          <div className="absolute top-1 left-2.5 z-10 text-[8px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{homeAbbr} · Local ({homeFormation})</span>
          </div>
          <div className="absolute top-1 right-2.5 z-10 text-[8px] font-mono font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1 pointer-events-none">
            <span>{awayAbbr} · Visita ({awayFormation})</span>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: SUBTLE, ULTRA-SLIM LIVE TRACKER (Zero Blur, No Full-Court Curtain) */}
          {/* ========================================================================= */}
          {slideMode === 'TRACKER' && (
            <>
              {/* Live Ball Marker Node on Pitch */}
              <div
                style={{ left: `${activeLivePlay.ballX}%`, top: `${activeLivePlay.ballY}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-700"
              >
                <span
                  className={`w-4 h-4 rounded-full ${activeDotColor} opacity-35 animate-ping absolute -inset-0.5`}
                />
                <div
                  className={`w-3 h-3 rounded-full bg-white border-2 ${
                    isActionHome ? 'border-emerald-400' : 'border-sky-400'
                  } shadow-md flex items-center justify-center`}
                />
              </div>

              {/* PHASE 1: ULTRA-SLIM POSSESSION MICRO-PILL */}
              {trackerPhase === 'SLIM_POSSESSION' && (
                <div
                  className={`absolute top-6 z-20 pointer-events-none transition-all duration-300 ${
                    isActionHome ? 'right-3' : 'left-3'
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#070B12]/95 border ${activeBorderColor} shadow-lg`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${activeDotColor} shrink-0`} />
                    <span className="text-[9px] font-bold text-white leading-none">
                      {activeLivePlay.teamName}
                    </span>
                    <span className={`text-[8.5px] font-mono ${activeTextColor} leading-none`}>
                      · {isLive ? `Posesión (${isActionHome ? statsRow.homePoss : statsRow.awayPoss}%)` : 'Ritmo Ofensivo'} · {activeLivePlay.minuteLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* PHASE 2: CALM RADAR BALL VIEW (Tiny minute tag next to ball, zero notification banner) */}
              {trackerPhase === 'RADAR_BALL' && (
                <div
                  style={{
                    left: `${Math.min(82, Math.max(18, activeLivePlay.ballX))}%`,
                    top: `${Math.max(18, activeLivePlay.ballY - 12)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-500"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded bg-[#070B12]/90 border ${activeBorderColor} text-[8px] font-mono font-bold text-white shadow`}
                  >
                    {activeLivePlay.teamCode} · {activeLivePlay.minuteLabel}
                  </span>
                </div>
              )}

              {/* PHASE 3: ULTRA-SLIM 2-LINE TACTICAL MICRO-HUD (Fine, compact, zero cut-off text) */}
              {trackerPhase === 'SLIM_STAT_PILL' && (
                <div
                  className={`absolute top-6 z-20 pointer-events-none transition-all duration-300 ${
                    isActionHome ? 'right-3' : 'left-3'
                  }`}
                >
                  <div
                    className={`max-w-[235px] sm:max-w-[280px] px-2.5 py-1 rounded-lg bg-[#070B12]/95 border ${activeBorderColor} shadow-lg space-y-0.5`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[9px] leading-tight">
                      <span className="font-bold text-white">
                        {activeLivePlay.teamName} · <span className={activeTextColor}>{activeLivePlay.minuteLabel}</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[8.5px] font-mono font-bold text-slate-200 shrink-0">
                        {statsRow.homeGoals} - {statsRow.awayGoals}
                      </span>
                    </div>
                    <div className="text-[8px] font-mono text-slate-300 leading-tight">
                      <span className={activeTextColor}>{activeLivePlay.typeLabel}:</span> {activeLivePlay.subLabel}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: 11 vs 11 TACTICAL LINEUPS ON HORIZONTAL PITCH (1-Tap Props)       */}
          {/* ========================================================================= */}
          {slideMode === 'LINEUPS' && (
            <>
              {/* Home Team (Left Half) */}
              {homeStarters.slice(0, 11).map((player, idx) => {
                const coords = getHomePitchCoords(idx);
                const lastName = player.name.split(' ').pop() || player.name;

                return (
                  <button
                    key={`soc-hm-${player.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectPlayer(player, homeTeam.name)}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer focus:outline-none"
                    title={`${player.name} (#${player.number}) - Toca para ver Props`}
                  >
                    <div className="relative w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-slate-950/95 border border-emerald-400 text-emerald-300 font-mono text-[8.5px] font-black flex items-center justify-center shadow group-hover:scale-115 group-hover:bg-emerald-400 group-hover:text-slate-950 transition-transform">
                      {player.number}
                      {player.matchYellowCards >= 1 && (
                        <span className="absolute -top-1 -right-1 text-[7px]">🟨</span>
                      )}
                    </div>
                    <span className="mt-0.2 px-1 rounded bg-slate-950/90 text-[7.5px] font-mono font-semibold text-slate-100 whitespace-nowrap">
                      {lastName}
                    </span>
                  </button>
                );
              })}

              {/* Away Team (Right Half) */}
              {awayStarters.slice(0, 11).map((player, idx) => {
                const coords = getAwayPitchCoords(idx);
                const lastName = player.name.split(' ').pop() || player.name;

                return (
                  <button
                    key={`soc-aw-${player.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectPlayer(player, awayTeam.name)}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer focus:outline-none"
                    title={`${player.name} (#${player.number}) - Toca para ver Props`}
                  >
                    <div className="relative w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-slate-950/95 border border-sky-400 text-sky-300 font-mono text-[8.5px] font-black flex items-center justify-center shadow group-hover:scale-115 group-hover:bg-sky-400 group-hover:text-slate-950 transition-transform">
                      {player.number}
                      {player.matchYellowCards >= 1 && (
                        <span className="absolute -top-1 -right-1 text-[7px]">🟨</span>
                      )}
                    </div>
                    <span className="mt-0.2 px-1 rounded bg-slate-950/90 text-[7.5px] font-mono font-semibold text-slate-100 whitespace-nowrap">
                      {lastName}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: HORIZONTAL xG & ATTACK PRESSURE ZONES                             */}
          {/* ========================================================================= */}
          {slideMode === 'HEATMAP' && (
            <>
              <div className="absolute left-[15%] top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-950/95 border border-emerald-400/50 text-center font-mono">
                <span className="block text-[8px] text-emerald-300 uppercase">Área {homeAbbr}</span>
                <span className="text-[9.5px] font-black text-white">{statsRow.homePoss}% Presión</span>
              </div>

              <div className="absolute right-[15%] top-1/2 translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-950/95 border border-sky-400/50 text-center font-mono">
                <span className="block text-[8px] text-sky-300 uppercase">Área {awayAbbr}</span>
                <span className="text-[9.5px] font-black text-white">{statsRow.awayPoss}% Presión</span>
              </div>
            </>
          )}

          {/* Bottom Carousel Pager Controls (`< — • • >`) */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/85 border border-slate-800/90">
            <button
              type="button"
              onClick={() => handleCycleSlide(-1)}
              className="w-3.5 h-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              title="Vista anterior"
            >
              <ChevronLeft className="w-2.5 h-2.5" />
            </button>

            <div className="flex items-center gap-1">
              {SLIDE_ORDER.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSlideMode(mode)}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    slideMode === mode ? 'w-4 bg-emerald-400' : 'w-1.5 bg-slate-600 hover:bg-slate-400'
                  }`}
                  title={mode}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleCycleSlide(1)}
              className="w-3.5 h-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              title="Siguiente vista"
            >
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. COMPACT COLLAPSIBLE BENCHES FOOTER */}
      <div className="px-2.5 pb-2 pt-0.5 bg-[#0B0F19] space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveBench(activeBench === 'HOME' ? null : 'HOME')}
            className={`py-1 px-2 rounded-lg border flex items-center justify-between text-[9.5px] font-mono font-semibold transition cursor-pointer ${
              activeBench === 'HOME'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Suplentes {homeAbbr}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1 rounded-full bg-slate-800 text-emerald-300 text-[8.5px]">
                {homeSubstitutes.length}
              </span>
              {activeBench === 'HOME' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveBench(activeBench === 'AWAY' ? null : 'AWAY')}
            className={`py-1 px-2 rounded-lg border flex items-center justify-between text-[9.5px] font-mono font-semibold transition cursor-pointer ${
              activeBench === 'AWAY'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Shield className="w-3 h-3 text-sky-400 shrink-0" />
              <span>Suplentes {awayAbbr}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1 rounded-full bg-slate-800 text-sky-300 text-[8.5px]">
                {awaySubstitutes.length}
              </span>
              {activeBench === 'AWAY' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </button>
        </div>

        {activeBench !== null && (
          <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
              {(activeBench === 'HOME' ? homeSubstitutes : awaySubstitutes).map((sub) => (
                <div
                  key={`soc-sub-${sub.id}`}
                  onClick={() =>
                    onSelectPlayer(sub, activeBench === 'HOME' ? homeTeam.name : awayTeam.name)
                  }
                  className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded bg-slate-800 text-slate-300 font-mono text-[8.5px] font-bold flex items-center justify-center shrink-0">
                      {sub.number}
                    </span>
                    <span className="text-[10.5px] font-medium text-slate-200 group-hover:text-white">
                      {sub.name}
                    </span>
                  </div>
                  {sub.isInjured ? (
                    <span className="text-[8.5px] font-mono text-rose-400 font-bold shrink-0">
                      🚑 Baja
                    </span>
                  ) : (
                    <span className="text-[8.5px] font-mono text-emerald-400 shrink-0 flex items-center gap-0.5">
                      <BarChart2 className="w-2.5 h-2.5" />
                      <span>Props</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[8.5px] text-slate-400 px-1 font-mono">
          <span className="flex items-center gap-1 text-slate-300">
            <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
            <span>Cancha Horizontal 2D (60 FPS)</span>
          </span>
          <span className="text-slate-500">Izq: Local · Der: Visita</span>
        </div>
      </div>
    </div>
  );
};
