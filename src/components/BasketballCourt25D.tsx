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
import { NBAMatchFixture, NBALivePlaySituation } from '../types';

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
  quarters?: NBAMatchFixture['quarters'];
  liveSituation?: NBALivePlaySituation;
  arenaName?: string;
  arenaCity?: string;
  leagueName?: string;
  matchDateLabel?: string;
  matchTimeLabel?: string;
  onSelectPlayer: (player: BasketballStarterPlayer | BasketballBenchPlayer, teamName: string) => void;
  // Legacy props fallback
  starters?: BasketballStarterPlayer[];
  teamName?: string;
  teamLogo?: string;
}

type CourtSlideMode = 'TRACKER' | 'LINEUPS' | 'HEATMAP';
// 3 subtle, non-intrusive phases:
// 1. SLIM_POSSESSION: Ultra-thin micro-pill showing active possession & clock
// 2. RADAR_BALL: Calm court view with glowing ball node & subtle vector (zero popup banner)
// 3. SLIM_STAT_PILL: Ultra-thin 2-line micro-HUD with player action & live score
type LiveTrackerAnimPhase = 'SLIM_POSSESSION' | 'RADAR_BALL' | 'SLIM_STAT_PILL';

const SLIDE_ORDER: CourtSlideMode[] = ['TRACKER', 'LINEUPS', 'HEATMAP'];

function buildTeamCode(name: string): string {
  const cleanName = (name || '').trim();
  const words = cleanName.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0].replace(/[^a-zA-Z]/g, '');
    const last = words[words.length - 1].replace(/[^a-zA-Z]/g, '');
    return `${first.slice(0, 2)}${last[0] || ''}`.toUpperCase();
  }
  const letters = cleanName.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 3) || 'NBA').toUpperCase();
}

function parseClockSeconds(clockStr?: string): number | null {
  if (!clockStr) return null;
  const match = clockStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatClockSeconds(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? `0${secs}` : secs}`;
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
  quarters,
  liveSituation,
  arenaName,
  arenaCity,
  leagueName = 'NBA · Temporada Regular',
  matchDateLabel,
  matchTimeLabel,
  onSelectPlayer,
  starters,
  teamName,
  teamLogo
}) => {
  const effectiveHomeStarters = homeStarters.length > 0 ? homeStarters : starters || [];
  const effectiveAwayStarters = awayStarters.length > 0 ? awayStarters : [];
  const effectiveHomeName = homeTeam?.name || teamName || 'Local';
  const effectiveAwayName = awayTeam?.name || 'Visitante';
  const effectiveHomeLogo = homeTeam?.logo || teamLogo;
  const effectiveAwayLogo = awayTeam?.logo;

  const awayAbbr = useMemo(() => buildTeamCode(effectiveAwayName), [effectiveAwayName]);
  const homeAbbr = useMemo(() => buildTeamCode(effectiveHomeName), [effectiveHomeName]);

  const [slideMode, setSlideMode] = useState<CourtSlideMode>(isLive ? 'TRACKER' : 'LINEUPS');
  const [activeBench, setActiveBench] = useState<'HOME' | 'AWAY' | null>(null);
  const [trackerPhase, setTrackerPhase] = useState<LiveTrackerAnimPhase>('SLIM_POSSESSION');
  const [simulatedPlayIdx, setSimulatedPlayIdx] = useState<number>(0);

  // Detect official Halftime / Descanso state in NBA match
  const isHalfTime = useMemo(() => {
    if (!isLive) return false;
    const p = (livePeriod || '').trim().toUpperCase();
    if (
      p === 'HT' ||
      p === 'MT' ||
      p === 'HALF' ||
      p.includes('HALF') ||
      p.includes('DESCANSO') ||
      p.includes('ENTRETIEMPO')
    ) {
      return true;
    }
    if ((liveScore as any)?.isHalfTime || (liveScore as any)?.statusShort === 'HT') {
      return true;
    }
    if ((p === 'Q2' || p === '2Q') && (liveClock === '00:00' || liveClock === '0:00')) {
      return true;
    }
    return false;
  }, [isLive, livePeriod, liveScore, liveClock]);

  // Smooth real-time game clock countdown while watching live court (paused during halftime)
  const baseClockSec = useMemo(() => parseClockSeconds(liveClock), [liveClock]);
  const [clockTickDown, setClockTickDown] = useState<number>(0);

  useEffect(() => {
    setClockTickDown(0);
  }, [liveClock, livePeriod]);

  useEffect(() => {
    if (!isLive || baseClockSec === null || isHalfTime) return;
    const interval = setInterval(() => {
      setClockTickDown((prev) => (baseClockSec - prev > 1 ? prev + 1 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, baseClockSec, isHalfTime]);

  const displayClockLabel = useMemo(() => {
    if (!isLive) return '';
    if (isHalfTime) return 'DESCANSO';
    if (baseClockSec !== null) {
      return formatClockSeconds(Math.max(0, baseClockSec - clockTickDown));
    }
    return liveClock || 'VIVO';
  }, [isLive, isHalfTime, baseClockSec, clockTickDown, liveClock]);

  // Relaxed 5.2s cadence with a calm RADAR_BALL phase (strictly paused during Halftime)
  useEffect(() => {
    if (slideMode !== 'TRACKER' || isHalfTime) return;

    const phases: LiveTrackerAnimPhase[] = ['SLIM_POSSESSION', 'RADAR_BALL', 'SLIM_STAT_PILL'];
    let step = 0;
    setTrackerPhase(phases[0]);

    const timer = setInterval(() => {
      step = (step + 1) % phases.length;
      setTrackerPhase(phases[step]);
      if (step === 0) {
        setSimulatedPlayIdx((prev) => prev + 1);
      }
    }, 5200);

    return () => clearInterval(timer);
  }, [slideMode, liveSituation?.id, isHalfTime]);

  const resolvedPlay: NBALivePlaySituation & {
    ballX: number;
    ballY: number;
    originX: number;
    originY: number;
  } = useMemo(() => {
    if (isHalfTime) {
      return {
        id: 'halftime-break',
        text: 'Pausa de descanso de medio tiempo',
        quarter: 'MT',
        actionKind: 'POSSESSION',
        teamSide: 'HOME',
        typeLabel: '⏸️ Medio Tiempo Oficial',
        statSummary: `Pausa de descanso · Marcador parcial: ${quarterScores.awayTotal} - ${quarterScores.homeTotal}`,
        ballX: 50,
        ballY: 50,
        originX: 50,
        originY: 50
      };
    }

    const isHomeSide =
      liveSituation && simulatedPlayIdx % 2 === 0
        ? liveSituation.teamSide === 'HOME'
        : simulatedPlayIdx % 2 === 0;

    if (liveSituation && simulatedPlayIdx % 2 === 0) {
      return {
        ...liveSituation,
        ballX: isHomeSide ? 84 : 16,
        ballY: 50,
        originX: isHomeSide ? 54 : 46,
        originY: 46
      };
    }

    const pool = isHomeSide ? effectiveHomeStarters : effectiveAwayStarters;
    const player = pool[simulatedPlayIdx % Math.max(1, pool.length)] || {
      name: isHomeSide ? effectiveHomeName : effectiveAwayName,
      position: 'PF',
      number: 23,
      ppg: 21.4,
      threePm: 2.4
    };

    const sequenceTypes: Array<{
      kind: NBALivePlaySituation['actionKind'];
      label: string;
      stat: string;
      pts: number;
      ballX: number;
      ballY: number;
    }> = [
      {
        kind: 'POSSESSION',
        label: '🏀 Circulación en Perímetro',
        stat: `Creación ofensiva · ${player.ppg || 20.5} PPG`,
        pts: 0,
        ballX: isHomeSide ? 72 : 28,
        ballY: 46
      },
      {
        kind: 'POSSESSION',
        label: '⚡ Rotación en Media Cancha',
        stat: `Lectura de bloqueo · ${player.apg || 4.8} APG`,
        pts: 0,
        ballX: isHomeSide ? 66 : 34,
        ballY: 28
      },
      {
        kind: 'REBOUND',
        label: '🛡️ Control de Tablero y Transición',
        stat: `Posesión activa (${isHomeSide ? homeAbbr : awayAbbr})`,
        pts: 0,
        ballX: isHomeSide ? 62 : 38,
        ballY: 64
      }
    ];
    const chosen = sequenceTypes[simulatedPlayIdx % sequenceTypes.length];

    return {
      id: `seq-${simulatedPlayIdx}`,
      text: `${player.name} · ${chosen.label}`,
      typeLabel: chosen.label,
      actionKind: chosen.kind,
      teamSide: isHomeSide ? 'HOME' : 'AWAY',
      playerName: player.name,
      playerPosition: player.position,
      statSummary: chosen.stat,
      pointsAdded: chosen.pts,
      ballX: chosen.ballX,
      ballY: chosen.ballY,
      originX: isHomeSide ? 46 : 54,
      originY: 50
    };
  }, [
    liveSituation,
    simulatedPlayIdx,
    effectiveHomeStarters,
    effectiveAwayStarters,
    effectiveHomeName,
    effectiveAwayName,
    homeAbbr,
    awayAbbr
  ]);

  const quarterScores = useMemo(() => {
    const awayTotal = liveScore?.away ?? 0;
    const homeTotal = liveScore?.home ?? 0;

    if (
      quarters &&
      (quarters.q1.home > 0 ||
        quarters.q1.away > 0 ||
        quarters.q2.home > 0 ||
        quarters.q2.away > 0)
    ) {
      return {
        away: [quarters.q1.away, quarters.q2.away, quarters.q3.away, quarters.q4.away],
        home: [quarters.q1.home, quarters.q2.home, quarters.q3.home, quarters.q4.home],
        awayTotal,
        homeTotal
      };
    }

    if (!isLive && awayTotal === 0 && homeTotal === 0) {
      return {
        away: [0, 0, 0, 0],
        home: [0, 0, 0, 0],
        awayTotal: 0,
        homeTotal
      };
    }

    const pStr = (livePeriod || 'Q1').toUpperCase();
    const currentQ = pStr.includes('4') ? 4 : pStr.includes('3') ? 3 : pStr.includes('2') ? 2 : 1;

    const splitScore = (total: number, q: number): [number, number, number, number] => {
      if (q === 1) return [total, 0, 0, 0];
      if (q === 2) {
        const q1 = Math.round(total * 0.52);
        return [q1, Math.max(0, total - q1), 0, 0];
      }
      if (q === 3) {
        const q1 = Math.round(total * 0.34);
        const q2 = Math.round(total * 0.35);
        return [q1, q2, Math.max(0, total - q1 - q2), 0];
      }
      const q1 = Math.round(total * 0.26);
      const q2 = Math.round(total * 0.25);
      const q3 = Math.round(total * 0.26);
      return [q1, q2, q3, Math.max(0, total - q1 - q2 - q3)];
    };

    return {
      away: splitScore(awayTotal, currentQ),
      home: splitScore(homeTotal, currentQ),
      awayTotal,
      homeTotal
    };
  }, [isLive, liveScore, livePeriod, quarters]);

  const getAwayHorizontalCoords = (pos: string, index: number) => {
    const cleanPos = (pos || '').toUpperCase();
    if (cleanPos.includes('C') || cleanPos === 'PIVOT' || cleanPos === 'PÍVOT') return { x: 14, y: 50 };
    if (cleanPos.includes('PF') || cleanPos === 'ALA') return { x: 24, y: 24 };
    if (cleanPos.includes('SF') || cleanPos === 'ALERO') return { x: 24, y: 76 };
    if (cleanPos.includes('SG') || cleanPos === 'ESCOLTA') return { x: 37, y: 28 };
    if (cleanPos.includes('PG') || cleanPos === 'BASE') return { x: 40, y: 68 };

    const fallbacks = [
      { x: 14, y: 50 },
      { x: 24, y: 24 },
      { x: 24, y: 76 },
      { x: 37, y: 28 },
      { x: 40, y: 68 }
    ];
    return fallbacks[index % fallbacks.length];
  };

  const getHomeHorizontalCoords = (pos: string, index: number) => {
    const cleanPos = (pos || '').toUpperCase();
    if (cleanPos.includes('PG') || cleanPos === 'BASE') return { x: 60, y: 32 };
    if (cleanPos.includes('SG') || cleanPos === 'ESCOLTA') return { x: 63, y: 72 };
    if (cleanPos.includes('SF') || cleanPos === 'ALERO') return { x: 76, y: 24 };
    if (cleanPos.includes('PF') || cleanPos === 'ALA') return { x: 76, y: 76 };
    if (cleanPos.includes('C') || cleanPos === 'PIVOT' || cleanPos === 'PÍVOT') return { x: 86, y: 50 };

    const fallbacks = [
      { x: 60, y: 32 },
      { x: 63, y: 72 },
      { x: 76, y: 24 },
      { x: 76, y: 76 },
      { x: 86, y: 50 }
    ];
    return fallbacks[index % fallbacks.length];
  };

  const handleCycleSlide = (dir: -1 | 1) => {
    const idx = SLIDE_ORDER.indexOf(slideMode);
    const nextIdx = (idx + dir + SLIDE_ORDER.length) % SLIDE_ORDER.length;
    setSlideMode(SLIDE_ORDER[nextIdx]);
  };

  const isActionHome = resolvedPlay.teamSide === 'HOME';
  const activeTeamLabel = isActionHome ? effectiveHomeName : effectiveAwayName;
  const activeTeamCode = isActionHome ? homeAbbr : awayAbbr;
  const activeBorderColor = isActionHome ? 'border-amber-400/75' : 'border-sky-400/75';
  const activeDotColor = isActionHome ? 'bg-amber-400' : 'bg-sky-400';
  const activeTextColor = isActionHome ? 'text-amber-300' : 'text-sky-300';

  const svgBallX = (resolvedPlay.ballX / 100) * 280;
  const svgBallY = (resolvedPlay.ballY / 100) * 150;
  const svgOriginX = (resolvedPlay.originX / 100) * 280;
  const svgOriginY = (resolvedPlay.originY / 100) * 150;

  const cleanQuarterLabel = useMemo(() => {
    const p = (livePeriod || 'Q1').toUpperCase();
    if (p === 'HT' || p.includes('HALF')) return 'MT (Descanso)';
    return p;
  }, [livePeriod]);

  const liveClockBadge = isLive
    ? cleanQuarterLabel === 'MT (Descanso)'
      ? 'DESCANSO • MT'
      : `EN VIVO • ${cleanQuarterLabel}`
    : matchTimeLabel || 'Programado';

  // Persistent 14-second Compact In-Court Banner when score or quarter changes in live NBA game
  const prevScoreRef = React.useRef<{ home: number; away: number; period: string; key: string }>({
    home: quarterScores.homeTotal,
    away: quarterScores.awayTotal,
    period: livePeriod || 'Q1',
    key: `${effectiveHomeName}_${effectiveAwayName}`
  });
  const [liveBasketBanner, setLiveBasketBanner] = useState<{
    badgeText: string;
    teamCode: string;
    scoreText: string;
    quarterText: string;
    icon: string;
  } | null>(null);

  useEffect(() => {
    const matchKey = `${effectiveHomeName}_${effectiveAwayName}`;
    const curHome = quarterScores.homeTotal;
    const curAway = quarterScores.awayTotal;
    const curPeriod = livePeriod || 'Q1';
    if (prevScoreRef.current.key !== matchKey) {
      prevScoreRef.current = { home: curHome, away: curAway, period: curPeriod, key: matchKey };
      setLiveBasketBanner(null);
      return;
    }

    if (isLive) {
      const diffHome = curHome - prevScoreRef.current.home;
      const diffAway = curAway - prevScoreRef.current.away;
      const periodChanged = curPeriod !== prevScoreRef.current.period;

      if (diffHome > 0 || diffAway > 0) {
        const isHomeScore = diffHome >= diffAway;
        const pts = Math.min(4, Math.max(1, isHomeScore ? diffHome : diffAway));
        const teamCode = isHomeScore ? homeAbbr : awayAbbr;
        const badgeText =
          pts >= 3
            ? `+${pts} TRIPLE`
            : pts === 1
            ? '+1 TIRO LIBRE'
            : '+2 CANASTA';
        const icon = pts >= 3 ? '🎯' : '🏀';

        setLiveBasketBanner({
          badgeText,
          teamCode,
          scoreText: `${curAway} - ${curHome}`,
          quarterText: cleanQuarterLabel,
          icon
        });
        prevScoreRef.current = { home: curHome, away: curAway, period: curPeriod, key: matchKey };

        const timer = setTimeout(() => {
          setLiveBasketBanner(null);
        }, 12000);
        return () => clearTimeout(timer);
      } else if (diffHome < 0 || diffAway < 0) {
        setLiveBasketBanner({
          badgeText: 'AJUSTE OFICIAL',
          teamCode: `${awayAbbr}/${homeAbbr}`,
          scoreText: `${curAway} - ${curHome}`,
          quarterText: cleanQuarterLabel,
          icon: '⚠️'
        });
        prevScoreRef.current = { home: curHome, away: curAway, period: curPeriod, key: matchKey };

        const timer = setTimeout(() => {
          setLiveBasketBanner(null);
        }, 10000);
        return () => clearTimeout(timer);
      } else if (periodChanged) {
        setLiveBasketBanner({
          badgeText: curPeriod === 'HT' ? 'MEDIO TIEMPO' : `INICIO ${curPeriod}`,
          teamCode: `${awayAbbr}-${homeAbbr}`,
          scoreText: `${curAway} - ${curHome}`,
          quarterText: cleanQuarterLabel,
          icon: '⏱️'
        });
        prevScoreRef.current = { home: curHome, away: curAway, period: curPeriod, key: matchKey };

        const timer = setTimeout(() => {
          setLiveBasketBanner(null);
        }, 10000);
        return () => clearTimeout(timer);
      }
    }
    prevScoreRef.current = { home: curHome, away: curAway, period: curPeriod, key: matchKey };
  }, [
    quarterScores.homeTotal,
    quarterScores.awayTotal,
    effectiveHomeName,
    effectiveAwayName,
    homeAbbr,
    awayAbbr,
    isLive,
    livePeriod,
    cleanQuarterLabel
  ]);

  return (
    <div className="w-full rounded-2xl bg-[#0B0F19] border border-slate-800/90 overflow-hidden shadow-xl">
      {/* 1. ULTRA-COMPACT SCOREBOARD HEADER */}
      <div className="px-3 py-1.5 bg-[#080C14] border-b border-slate-800/90">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[9.5px] font-mono text-slate-400 pb-1 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {isLive ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>{liveClockBadge}</span>
              </span>
            ) : (
              <span className="text-slate-300 font-semibold shrink-0">
                {matchDateLabel || 'Hoy'} {matchTimeLabel ? `• ${matchTimeLabel}` : ''}
              </span>
            )}

            {arenaName && (
              <span className="text-slate-400 inline-flex items-center gap-1 border-l border-slate-800 pl-1.5 text-[8.5px]">
                <MapPin className="w-2.5 h-2.5 text-amber-400/80 shrink-0" />
                <span>
                  {arenaName}
                  {arenaCity ? ` (${arenaCity})` : ''}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[8.5px] font-bold tracking-wider text-slate-400 shrink-0 ml-auto">
            <span className="w-4 text-center">Q1</span>
            <span className="w-4 text-center">Q2</span>
            <span className="w-4 text-center">Q3</span>
            <span className="w-4 text-center">Q4</span>
            <span className="w-6 text-center text-amber-400">TOT</span>
          </div>
        </div>

        {/* Team Rows */}
        <div className="pt-1 space-y-1">
          {/* Away Team Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {effectiveAwayLogo ? (
                <img
                  src={effectiveAwayLogo}
                  alt=""
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="w-3 h-3 rounded-sm bg-sky-500/30 border border-sky-400/50 shrink-0" />
              )}
              <span className="text-[11px] font-bold text-white">
                {effectiveAwayName}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10.5px] shrink-0">
              {quarterScores.away.map((qVal, i) => (
                <span
                  key={`aw-q-${i}`}
                  className={`w-4 text-center ${
                    qVal > 0 ? 'text-slate-200 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {qVal}
                </span>
              ))}
              <span className="w-6 py-0.2 rounded bg-slate-800/90 border border-sky-500/40 text-center font-black text-sky-300 text-[11px]">
                {quarterScores.awayTotal}
              </span>
            </div>
          </div>

          {/* Home Team Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {effectiveHomeLogo ? (
                <img
                  src={effectiveHomeLogo}
                  alt=""
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-400/50 shrink-0" />
              )}
              <span className="text-[11px] font-bold text-white">
                {effectiveHomeName}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10.5px] shrink-0">
              {quarterScores.home.map((qVal, i) => (
                <span
                  key={`hm-q-${i}`}
                  className={`w-4 text-center ${
                    qVal > 0 ? 'text-slate-200 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {qVal}
                </span>
              ))}
              <span className="w-6 py-0.2 rounded bg-slate-800/90 border border-amber-500/40 text-center font-black text-amber-300 text-[11px]">
                {quarterScores.homeTotal}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-TOOLBAR: Mode Tabs */}
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
            <span>5 vs 5 (Props)</span>
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
            <span>Zonas</span>
          </button>
        </div>

        <span className="text-[8.5px] font-mono text-slate-400 hidden sm:inline">
          {slideMode === 'LINEUPS'
            ? 'Toca un jugador para Props'
            : isLive
            ? 'Reloj sincronizado en vivo'
            : leagueName}
        </span>
      </div>

      {/* 3. HORIZONTAL 2D COURT (Fits 100% in View, Zero Blur, Subtle Tactical Radar) */}
      <div className="p-2 bg-[#111927]">
        <div className="relative w-full aspect-[16/8.2] max-h-[190px] mx-auto rounded-xl overflow-hidden border border-amber-500/30 shadow-inner bg-[#182234] select-none">
          <svg
            viewBox="0 0 280 150"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <linearGradient id="courtFloorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#162032" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#162032" />
              </linearGradient>

              <linearGradient id="woodWarmTint" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.06" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="0.11" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.06" />
              </linearGradient>

              <radialGradient id="leftPaintHeat" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.06" />
              </radialGradient>
              <radialGradient id="rightPaintHeat" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.06" />
              </radialGradient>
              <radialGradient id="nbaBallGlowHome" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nbaBallGlowAway" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width="280" height="150" fill="#0d1422" />
            <rect x="10" y="8" width="260" height="134" fill="url(#courtFloorGrad)" />
            <rect x="10" y="8" width="260" height="134" fill="url(#woodWarmTint)" />

            <g stroke="rgba(255,255,255,0.03)" strokeWidth="0.5">
              <line x1="10" y1="27" x2="270" y2="27" />
              <line x1="10" y1="46" x2="270" y2="46" />
              <line x1="10" y1="65" x2="270" y2="65" />
              <line x1="10" y1="85" x2="270" y2="85" />
              <line x1="10" y1="104" x2="270" y2="104" />
              <line x1="10" y1="123" x2="270" y2="123" />
            </g>

            <rect
              x="10"
              y="8"
              width="260"
              height="134"
              fill="none"
              stroke="rgba(226, 232, 240, 0.45)"
              strokeWidth="1.2"
            />

            <line
              x1="140"
              y1="8"
              x2="140"
              y2="142"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1.1"
            />
            <circle
              cx="140"
              cy="75"
              r="18"
              fill="rgba(15, 23, 42, 0.45)"
              stroke="rgba(226, 232, 240, 0.4)"
              strokeWidth="1.1"
            />
            <circle
              cx="140"
              cy="75"
              r="6"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth="0.9"
            />

            {/* LEFT SIDE (AWAY TEAM) */}
            <path
              d="M 10,20 L 38,20 A 58 58 0 0 1 38,130 L 10,130"
              fill={slideMode === 'HEATMAP' ? 'rgba(56, 189, 248, 0.1)' : 'none'}
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1.1"
            />
            <rect
              x="10"
              y="51"
              width="48"
              height="48"
              fill={slideMode === 'HEATMAP' ? 'url(#leftPaintHeat)' : 'rgba(14, 165, 233, 0.1)'}
              stroke="rgba(226, 232, 240, 0.45)"
              strokeWidth="1"
            />
            <rect x="10" y="51" width="48" height="5" fill="rgba(56, 189, 248, 0.22)" />
            <rect x="10" y="94" width="48" height="5" fill="rgba(56, 189, 248, 0.22)" />
            <path
              d="M 58,56 A 19 19 0 0 1 58,94"
              fill="none"
              stroke="rgba(226, 232, 240, 0.45)"
              strokeWidth="1"
            />
            <path
              d="M 58,56 A 19 19 0 0 0 58,94"
              fill="none"
              stroke="rgba(226, 232, 240, 0.35)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <path
              d="M 18,65 A 10 10 0 0 1 18,85"
              fill="none"
              stroke="rgba(226, 232, 240, 0.35)"
              strokeWidth="0.9"
            />
            <polygon
              points="2,65 16,72 16,78 2,85"
              fill="none"
              stroke="rgba(226, 232, 240, 0.55)"
              strokeWidth="1"
            />
            <line x1="16" y1="64" x2="16" y2="86" stroke="#e2e8f0" strokeWidth="1.6" />
            <circle
              cx="21"
              cy="75"
              r="3.8"
              fill="rgba(14, 165, 233, 0.2)"
              stroke="#38bdf8"
              strokeWidth="1.3"
            />

            {/* RIGHT SIDE (HOME TEAM) */}
            <path
              d="M 270,20 L 242,20 A 58 58 0 0 0 242,130 L 270,130"
              fill={slideMode === 'HEATMAP' ? 'rgba(245, 158, 11, 0.1)' : 'none'}
              stroke="rgba(226, 232, 240, 0.42)"
              strokeWidth="1.1"
            />
            <rect
              x="222"
              y="51"
              width="48"
              height="48"
              fill={slideMode === 'HEATMAP' ? 'url(#rightPaintHeat)' : 'rgba(245, 158, 11, 0.1)'}
              stroke="rgba(226, 232, 240, 0.45)"
              strokeWidth="1"
            />
            <rect x="222" y="51" width="48" height="5" fill="rgba(245, 158, 11, 0.22)" />
            <rect x="222" y="94" width="48" height="5" fill="rgba(245, 158, 11, 0.22)" />
            <path
              d="M 222,56 A 19 19 0 0 0 222,94"
              fill="none"
              stroke="rgba(226, 232, 240, 0.45)"
              strokeWidth="1"
            />
            <path
              d="M 222,56 A 19 19 0 0 1 222,94"
              fill="none"
              stroke="rgba(226, 232, 240, 0.35)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <path
              d="M 262,65 A 10 10 0 0 0 262,85"
              fill="none"
              stroke="rgba(226, 232, 240, 0.35)"
              strokeWidth="0.9"
            />
            <polygon
              points="278,65 264,72 264,78 278,85"
              fill="none"
              stroke="rgba(226, 232, 240, 0.55)"
              strokeWidth="1"
            />
            <line x1="264" y1="64" x2="264" y2="86" stroke="#e2e8f0" strokeWidth="1.6" />
            <circle
              cx="259"
              cy="75"
              r="3.8"
              fill="rgba(245, 158, 11, 0.2)"
              stroke="#f59e0b"
              strokeWidth="1.3"
            />

            {/* SUBTLE LOCALIZED TACTICAL RADAR & VECTOR IN TRACKER MODE (Hidden during Halftime) */}
            {slideMode === 'TRACKER' && !isHalfTime && (
              <g>
                <circle
                  cx={svgBallX}
                  cy={svgBallY}
                  r="22"
                  fill={isActionHome ? 'url(#nbaBallGlowHome)' : 'url(#nbaBallGlowAway)'}
                />
                <line
                  x1={svgOriginX}
                  y1={svgOriginY}
                  x2={svgBallX}
                  y2={svgBallY}
                  stroke={isActionHome ? '#fbbf24' : '#38bdf8'}
                  strokeWidth="1.1"
                  strokeDasharray="3,2"
                  strokeOpacity="0.75"
                />
                <circle
                  cx={svgOriginX}
                  cy={svgOriginY}
                  r="1.8"
                  fill={isActionHome ? '#fbbf24' : '#38bdf8'}
                  fillOpacity="0.6"
                />
              </g>
            )}
          </svg>

          {/* Crisp Corner Team Labels */}
          <div className="absolute top-1 left-2.5 z-10 text-[8px] font-mono font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>{awayAbbr} · Visita</span>
          </div>
          <div className="absolute top-1 right-2.5 z-10 text-[8px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1 pointer-events-none">
            <span>{homeAbbr} · Local</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: SUBTLE, ULTRA-SLIM LIVE TRACKER (Zero Blur, No Full-Court Curtain) */}
          {/* ========================================================================= */}
          {slideMode === 'TRACKER' && (
            <>
              {/* STATIC HALFTIME / MEDIO TIEMPO ANNOUNCEMENT OVERLAY */}
              {isHalfTime && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] pointer-events-none p-3">
                  <div className="px-5 py-3 rounded-2xl bg-slate-950/95 border border-amber-400/85 shadow-2xl flex flex-col items-center gap-1.5 text-center pointer-events-auto">
                    <div className="inline-flex items-center gap-2 text-xs font-mono font-black text-amber-400 uppercase tracking-widest">
                      <span className="text-sm">⏸️</span>
                      <span>MEDIO TIEMPO · DESCANSO</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-base sm:text-lg font-black text-white">
                      <span>{awayAbbr} {quarterScores.awayTotal}</span>
                      <span className="text-amber-400/80">-</span>
                      <span>{quarterScores.homeTotal} {homeAbbr}</span>
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-300">
                      Pausa oficial · Fin de la primera mitad (Q1 + Q2)
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-mono text-amber-300/80 bg-amber-500/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                      <span>Cancha estática hasta el 3er cuarto (Q3)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SLEEK COMPACT SINGLE-LINE BASKET / QUARTER PILL ON NBA COURT (Never covers court or truncates) */}
              {liveBasketBanner && !isHalfTime && (
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-amber-400/90 shadow-md whitespace-nowrap">
                    <span className="text-[10px] leading-none">{liveBasketBanner.icon}</span>
                    <span className="text-[8.5px] font-black uppercase tracking-tight text-amber-300 leading-none">
                      {liveBasketBanner.badgeText} {liveBasketBanner.teamCode}
                    </span>
                    <span className="text-[8.5px] font-mono font-bold text-white leading-none px-1 py-0.2 rounded bg-amber-500/20">
                      {liveBasketBanner.scoreText}
                    </span>
                    <span className="text-[8px] font-mono text-slate-300 leading-none">
                      {liveBasketBanner.quarterText}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLiveBasketBanner(null)}
                      className="text-slate-400 hover:text-white text-[9px] pl-0.5 cursor-pointer leading-none"
                      aria-label="Cerrar alerta de puntos"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Live Ball Marker Node on Court (Static at center during halftime, dynamic during play) */}
              <div
                style={{
                  left: isHalfTime ? '50%' : `${resolvedPlay.ballX}%`,
                  top: isHalfTime ? '50%' : `${resolvedPlay.ballY}%`
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none ${
                  isHalfTime ? '' : 'transition-all duration-700'
                }`}
              >
                {!isHalfTime && (
                  <span
                    className={`w-4 h-4 rounded-full ${activeDotColor} opacity-35 animate-ping absolute -inset-0.5`}
                  />
                )}
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    isHalfTime
                      ? 'bg-amber-400 border-2 border-white'
                      : isActionHome
                      ? 'bg-white border-2 border-amber-400'
                      : 'bg-white border-2 border-sky-400'
                  } shadow-md flex items-center justify-center`}
                />
              </div>

              {/* PHASE 1: ULTRA-SLIM POSSESSION MICRO-PILL */}
              {trackerPhase === 'SLIM_POSSESSION' && !liveBasketBanner && !isHalfTime && (
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
                      {activeTeamLabel}
                    </span>
                    <span className={`text-[8.5px] font-mono ${activeTextColor} leading-none`}>
                      · {isLive ? 'Posesión en vivo' : 'Ritmo proyectado'} · {liveClockBadge}
                    </span>
                  </div>
                </div>
              )}

              {/* PHASE 2: CALM RADAR BALL VIEW (Tiny tag next to ball, zero notification banner) */}
              {trackerPhase === 'RADAR_BALL' && !isHalfTime && (
                <div
                  style={{
                    left: `${Math.min(82, Math.max(18, resolvedPlay.ballX))}%`,
                    top: `${Math.max(18, resolvedPlay.ballY - 12)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-500"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded bg-[#070B12]/90 border ${activeBorderColor} text-[8px] font-mono font-bold text-white shadow`}
                  >
                    {activeTeamCode} · {liveClockBadge}
                  </span>
                </div>
              )}

              {/* PHASE 3: ULTRA-SLIM 2-LINE TACTICAL MICRO-HUD (Fine, compact, zero cut-off text) */}
              {trackerPhase === 'SLIM_STAT_PILL' && !liveBasketBanner && !isHalfTime && (
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
                        {resolvedPlay.playerName || activeTeamLabel} · <span className={activeTextColor}>{liveClockBadge}</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[8.5px] font-mono font-bold text-slate-200 shrink-0">
                        {quarterScores.awayTotal} - {quarterScores.homeTotal}
                      </span>
                    </div>
                    <div className="text-[8px] font-mono text-slate-300 leading-tight">
                      <span className={activeTextColor}>{resolvedPlay.typeLabel}:</span> {resolvedPlay.statSummary}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: 5 vs 5 TACTICAL LINEUPS                                           */}
          {/* ========================================================================= */}
          {slideMode === 'LINEUPS' && (
            <>
              {effectiveAwayStarters.slice(0, 5).map((player, idx) => {
                const coords = getAwayHorizontalCoords(player.position, idx);
                const lastName = player.name.split(' ').pop() || player.name;

                return (
                  <button
                    key={`aw-h-${player.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectPlayer(player, effectiveAwayName)}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer focus:outline-none"
                    title={`${player.name} (${player.ppg} PPG) - Toca para ver Props`}
                  >
                    <div className="relative w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-slate-950/95 border-2 border-sky-400 text-sky-300 font-mono text-[9px] font-black flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-sky-400 group-hover:text-slate-950 transition-transform">
                      #{player.number}
                      {player.isInjured && (
                        <span className="absolute -top-1 -right-1 text-[7px]">🚑</span>
                      )}
                    </div>
                    <span className="mt-0.5 px-1 py-0.1 rounded bg-slate-950/90 border border-sky-500/40 text-[8px] font-mono font-bold text-slate-100 whitespace-nowrap shadow">
                      {lastName}
                    </span>
                  </button>
                );
              })}

              {effectiveHomeStarters.slice(0, 5).map((player, idx) => {
                const coords = getHomeHorizontalCoords(player.position, idx);
                const lastName = player.name.split(' ').pop() || player.name;

                return (
                  <button
                    key={`hm-h-${player.id}-${idx}`}
                    type="button"
                    onClick={() => onSelectPlayer(player, effectiveHomeName)}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer focus:outline-none"
                    title={`${player.name} (${player.ppg} PPG) - Toca para ver Props`}
                  >
                    <div className="relative w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-slate-950/95 border-2 border-amber-400 text-amber-300 font-mono text-[9px] font-black flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-950 transition-transform">
                      #{player.number}
                      {player.isInjured && (
                        <span className="absolute -top-1 -right-1 text-[7px]">🚑</span>
                      )}
                    </div>
                    <span className="mt-0.5 px-1 py-0.1 rounded bg-slate-950/90 border border-amber-500/40 text-[8px] font-mono font-bold text-slate-100 whitespace-nowrap shadow">
                      {lastName}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* MODE 3: HORIZONTAL HEATMAP BADGES */}
          {slideMode === 'HEATMAP' && (
            <>
              <div className="absolute left-[14%] top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-950/95 border border-sky-400/50 text-center font-mono">
                <span className="block text-[8px] text-sky-300 uppercase">Pintura {awayAbbr}</span>
                <span className="text-[9.5px] font-black text-white">58.4% eFG</span>
              </div>
              <div className="absolute left-[34%] top-[24%] -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-sky-500/30 text-[8px] font-mono text-sky-200">
                3P: 37.8%
              </div>

              <div className="absolute right-[14%] top-1/2 translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-950/95 border border-amber-400/50 text-center font-mono">
                <span className="block text-[8px] text-amber-300 uppercase">Pintura {homeAbbr}</span>
                <span className="text-[9.5px] font-black text-white">61.2% eFG</span>
              </div>
              <div className="absolute right-[34%] bottom-[24%] translate-x-1/2 translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-500/30 text-[8px] font-mono text-amber-200">
                3P: 39.1%
              </div>
            </>
          )}

          {/* Bottom Carousel Pager Controls */}
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
                    slideMode === mode ? 'w-4 bg-amber-400' : 'w-1.5 bg-slate-600 hover:bg-slate-400'
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
            onClick={() => setActiveBench(activeBench === 'AWAY' ? null : 'AWAY')}
            className={`py-1 px-2 rounded-lg border flex items-center justify-between text-[9.5px] font-mono font-semibold transition cursor-pointer ${
              activeBench === 'AWAY'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Shield className="w-3 h-3 text-sky-400 shrink-0" />
              <span>Banca {awayAbbr}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1 rounded-full bg-slate-800 text-sky-300 text-[8.5px]">
                {awayBench.length}
              </span>
              {activeBench === 'AWAY' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveBench(activeBench === 'HOME' ? null : 'HOME')}
            className={`py-1 px-2 rounded-lg border flex items-center justify-between text-[9.5px] font-mono font-semibold transition cursor-pointer ${
              activeBench === 'HOME'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Shield className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Banca {homeAbbr}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1 rounded-full bg-slate-800 text-amber-300 text-[8.5px]">
                {homeBench.length}
              </span>
              {activeBench === 'HOME' ? (
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
              {(activeBench === 'HOME' ? homeBench : awayBench).map((player) => (
                <div
                  key={`bench-${player.id}`}
                  onClick={() =>
                    onSelectPlayer(
                      player,
                      activeBench === 'HOME' ? effectiveHomeName : effectiveAwayName
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-4 h-4 rounded font-mono text-[8.5px] font-bold flex items-center justify-center shrink-0 ${
                        activeBench === 'HOME'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {player.position}
                    </span>
                    <span className="text-[10.5px] font-medium text-slate-200 group-hover:text-white">
                      #{player.number} {player.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-[8.5px] font-mono">
                    {player.isInjured ? (
                      <span className="text-rose-400 font-bold">
                        🚑 {player.injuryStatus || 'Baja'}
                      </span>
                    ) : (
                      <span className="text-emerald-400 group-hover:underline flex items-center gap-0.5">
                        <BarChart2 className="w-2.5 h-2.5" />
                        <span>{player.ppg || 7.5}p</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[8.5px] text-slate-400 px-1 font-mono">
          <span className="flex items-center gap-1 text-slate-300">
            <UserCheck className="w-2.5 h-2.5 text-amber-400" />
            <span>Tracker Horizontal 2D (60 FPS)</span>
          </span>
          <span className="text-slate-500">Izq: Visita · Der: Local</span>
        </div>
      </div>
    </div>
  );
};
