import React, { useState, useMemo } from 'react';
import {
  ExternalLink,
  Sparkles,
  Calculator,
  Clock,
  Target,
  Zap,
  Layers,
  Award,
  ChevronDown,
  ChevronUp,
  Ticket,
  BarChart2
} from 'lucide-react';
import { NBAMatchFixture, NBAAnalysis } from '../types';
import { getNBADidacticAdvice } from '../services/didacticService';
import { useParlay } from '../context/ParlayContext';
import { PlayerStatsModal, PlayerModalPayload } from './PlayerStatsModal';

interface NBAPredictionCardProps {
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  viewMode?: 'SIMPLE' | 'EXPERT';
  isRecentlyUpdated?: boolean;
}

export const NBAPredictionCard: React.FC<NBAPredictionCardProps> = React.memo(({
  fixture,
  analysis,
  isSelected = false,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  viewMode = 'SIMPLE',
  isRecentlyUpdated = false
}) => {
  const { homeTeam, awayTeam, status } = fixture;
  const isLive = status === 'IN_PLAY';
  const isFinished = status === 'FINISHED';

  const [localExpanded, setLocalExpanded] = useState<boolean>(false);
  const expanded = isExpanded !== undefined ? isExpanded : localExpanded;
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<PlayerModalPayload | null>(null);

  // Consejo y semáforo didáctico para principiantes
  const didacticAdvice = useMemo(() => {
    return getNBADidacticAdvice(fixture, analysis);
  }, [fixture, analysis]);

  const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? homeTeam : awayTeam;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);

  const { isPickInParlay, togglePick } = useParlay();
  const inParlay = isPickInParlay(fixture.id);

  const handleToggleExpand = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded((prev) => !prev);
    }
  };

  // Calculadora interactiva +EV y Kelly para NBA
  // Opciones: 'HOME' (Moneyline local), 'AWAY' (Moneyline visita), 'OVER' (Total más de), 'UNDER' (Total menos de)
  const [selectedBetType, setSelectedBetType] = useState<'HOME' | 'AWAY' | 'OVER' | 'UNDER'>(
    analysis.pHomeWin >= analysis.pAwayWin ? 'HOME' : 'AWAY'
  );
  const [inputOdds, setInputOdds] = useState<string>('');

  const evMetrics = useMemo(() => {
    const oddsNum = parseFloat(inputOdds);
    if (isNaN(oddsNum) || oddsNum <= 1) {
      return { evPercent: null, kellyStake: null, isPositive: false };
    }

    let prob = analysis.pHomeWin / 100;
    if (selectedBetType === 'AWAY') prob = analysis.pAwayWin / 100;
    else if (selectedBetType === 'OVER') prob = analysis.overTotalProb / 100;
    else if (selectedBetType === 'UNDER') prob = analysis.underTotalProb / 100;

    // EV = (P * (Cuota - 1)) - (1 - P)
    const ev = (prob * (oddsNum - 1)) - (1 - prob);
    const evPercent = (ev * 100).toFixed(1);
    const isPositive = ev > 0;

    // Quarter Kelly (25% fractional)
    let kellyStake = 0;
    if (isPositive) {
      const fullKelly = ((prob * oddsNum) - 1) / (oddsNum - 1);
      kellyStake = Math.max(0, fullKelly * 0.25 * 100);
    }

    return {
      evPercent,
      kellyStake: kellyStake.toFixed(1),
      isPositive
    };
  }, [inputOdds, selectedBetType, analysis]);

  // Live match direct tracker link
  const liveTrackerUrl = `https://www.google.com/search?q=${encodeURIComponent(`${homeTeam.name} vs ${awayTeam.name} NBA marcador en vivo`)}`;

  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);

  return (
    <div
      className={`neon-running-card transition-all ${
        isRecentlyUpdated
          ? 'ring-2 ring-amber-400 bg-amber-950/30 shadow-[0_0_25px_rgba(251,191,36,0.5)] animate-pulse'
          : isSelected
          ? 'ring-2 ring-amber-400 shadow-amber-500/30'
          : isValueBet
          ? 'value-bet-glow ring-1.5 ring-amber-400/60'
          : ''
      }`}
    >
      <div className="neon-card-inner bg-slate-950/40 backdrop-blur-md border border-slate-700/30 rounded-2xl overflow-hidden shadow-2xl">
        {/* 1. Header: Estado (En Vivo vs Pre-Partido), Hora Colombia y Competición */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950/50 backdrop-blur-md border-b border-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🏀</span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono tracking-tight font-bold text-[10px] uppercase">
              {fixture.league?.name || 'NBA'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-[11px] truncate font-sans">
              {fixture.league?.name === 'NBA' ? `${homeTeam.conference} vs ${awayTeam.conference}` : (fixture.league?.country || 'Baloncesto')}
            </span>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline truncate font-sans">
              {fixture.arena.name} ({fixture.arena.city})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {isRecentlyUpdated && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-mono font-black text-[10px] uppercase tracking-tight animate-bounce shadow-md flex items-center gap-1">
                  <span>🏀</span>
                  <span>¡Puntos!</span>
                </span>
              )}
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono tracking-tight font-bold animate-pulse text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>EN VIVO {fixture.livePeriod} {fixture.liveClock ? `· ${fixture.liveClock}` : ''}</span>
                </span>
              ) : isFinished ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/50 font-mono tracking-tight text-[11px] font-bold">
                  FINALIZADO
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono tracking-tight font-semibold text-amber-400">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {fixture.time} COL
                </span>
              )}

              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono tracking-tight text-[11px]">{fixture.date}</span>

              {isValueBet && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300 font-mono tracking-tight font-bold text-[10px] uppercase bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-400/40 shadow-xs animate-pulse">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    Valor +{analysis.marketOdds?.valueEdgePercent}%
                  </span>
                </>
              )}
            </div>

            {/* Quick Parlay Ticket button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const bestOdd = favProb > 50 ? Number((100 / favProb).toFixed(2)) : 1.90;
                togglePick({
                  id: `${fixture.id}_NBA_ML`,
                  fixtureId: fixture.id,
                  sport: 'NBA',
                  matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                  homeTeamName: homeTeam.name,
                  awayTeamName: awayTeam.name,
                  matchDate: fixture.date,
                  matchTime: fixture.time,
                  marketKey: 'NBA_ML',
                  selectionLabel: `Gana ${favTeam.name}`,
                  referenceOdd: bestOdd,
                  userOdd: bestOdd,
                  probability: favProb,
                  isEV: Boolean(analysis.marketOdds?.valueBetDetected)
                });
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                inParlay
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-700/50'
              }`}
              title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir al boleto de combinadas'}
              aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
            >
              <Ticket className="w-3 h-3" />
              <span>{inParlay ? 'En Boleto' : '+ Boleto'}</span>
            </button>

            {onToggleSelect && (
              <button
                onClick={() => onToggleSelect(fixture.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30 font-bold'
                    : 'bg-slate-900/40 hover:bg-white/10 text-slate-300 hover:text-white border border-slate-700/40 backdrop-blur-sm'
                }`}
                title={isSelected ? 'Quitar de mi selección' : 'Seleccionar este partido'}
              >
                <span>{isSelected ? '✓ Seleccionado' : 'Seleccionar'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido de la Tarjeta */}
        <div className="p-4 sm:p-5 pb-3">
          {/* 2. Duelo de Equipos (Face-Off & Marcador en Vivo) */}
          <div
            onClick={handleToggleExpand}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center cursor-pointer hover:bg-white/[0.02] p-1.5 rounded-2xl transition-colors"
            title={expanded ? 'Clic para contraer' : 'Clic para ver análisis completo'}
          >
            {/* Equipo Local */}
            <div className="sm:col-span-5 flex items-center justify-between sm:justify-start gap-3 bg-slate-900/30 backdrop-blur-sm p-3 rounded-2xl border border-slate-800/40">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={homeTeam.logo}
                  alt={homeTeam.name}
                  className="w-11 h-11 object-contain shrink-0 drop-shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-semibold text-slate-100 text-sm sm:text-base tracking-tight truncate">
                      {homeTeam.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono tracking-tight font-semibold uppercase shrink-0 border border-amber-500/30">
                      Local
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono tracking-tight">
                    <span>{homeTeam.wins}V - {homeTeam.losses}D</span>
                    <span className="text-slate-600">·</span>
                    <span className={homeTeam.streak.startsWith('W') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {homeTeam.streak}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>Pace {homeTeam.pace}</span>
                  </div>
                </div>
              </div>

              {/* Marcador actual si está en vivo */}
              {fixture.currentScore && (
                <span className="text-2xl sm:text-3xl font-mono tracking-tight font-bold text-white shrink-0 ml-auto pl-2">
                  {fixture.currentScore.home}
                </span>
              )}
            </div>

            {/* Centro: VS y Probabilidades del Modelo */}
            <div className="sm:col-span-2 text-center flex sm:flex-col items-center justify-around sm:justify-center gap-1 py-1">
              <div className="text-[10px] font-mono tracking-tight font-semibold uppercase text-amber-400/90">
                {isLive ? 'Marcador en Vivo' : 'Probabilidad'}
              </div>

              <div className="flex sm:flex-col items-center gap-2 sm:gap-0.5">
                <div className="text-xs font-mono tracking-tight font-bold text-white">
                  <span className="text-emerald-400">{analysis.pHomeWin}%</span>
                  <span className="text-slate-500 mx-1">-</span>
                  <span className="text-blue-400">{analysis.pAwayWin}%</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono tracking-tight">
                  Línea: {analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread}
                </div>
              </div>
            </div>

            {/* Equipo Visitante */}
            <div className="sm:col-span-5 flex items-center justify-between sm:justify-end gap-3 bg-slate-900/30 backdrop-blur-sm p-3 rounded-2xl border border-slate-800/40">
              {/* Marcador actual si está en vivo */}
              {fixture.currentScore && (
                <span className="text-2xl sm:text-3xl font-mono tracking-tight font-bold text-white shrink-0 mr-auto sm:mr-0 sm:order-1 pr-2">
                  {fixture.currentScore.away}
                </span>
              )}

              <div className="flex items-center gap-3 min-w-0 sm:order-2 text-right">
                <div className="min-w-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-mono tracking-tight font-semibold uppercase shrink-0 border border-blue-500/30">
                      Visita
                    </span>
                    <span className="font-sans font-semibold text-slate-100 text-sm sm:text-base tracking-tight truncate">
                      {awayTeam.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-end gap-2 mt-0.5 font-mono tracking-tight">
                    <span>Pace {awayTeam.pace}</span>
                    <span className="text-slate-600">·</span>
                    <span className={awayTeam.streak.startsWith('W') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {awayTeam.streak}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>{awayTeam.wins}V - {awayTeam.losses}D</span>
                  </div>
                </div>
                <img
                  src={awayTeam.logo}
                  alt={awayTeam.name}
                  className="w-11 h-11 object-contain shrink-0 drop-shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Compacto de Métricas NBA y Botón Desplegable (Siempre Visible) */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-800/40 bg-slate-950/20 space-y-3">
          {/* Semáforo Didáctico "Qué te conviene" con Gradiente Direccional */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-2 border-amber-500 backdrop-blur-sm shadow-sm transition-all">
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono tracking-tight font-bold uppercase text-amber-400 flex items-center gap-1.5">
                  <span>{didacticAdvice.badgeLabel}</span>
                </span>
                {viewMode === 'SIMPLE' && (
                  <span className="text-[9px] font-mono tracking-tight font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Modo Fácil 🌱
                  </span>
                )}
              </div>
              <span className="text-[11px] text-amber-300 font-mono tracking-tight font-semibold bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/40 shadow-inner">
                {didacticAdvice.payoutExample}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
              {didacticAdvice.headline}
            </p>
            <p className="text-xs text-slate-300/90 leading-relaxed mt-1 font-sans">
              {didacticAdvice.plainExplanation}{' '}
              <span className="text-amber-300 font-medium block sm:inline mt-0.5 sm:mt-0">
                👉 {didacticAdvice.actionAdvice}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-center">
            {/* 1. Ganador Proyectado */}
            <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono tracking-tight font-semibold uppercase">
                {viewMode === 'SIMPLE' ? '¿Quién ganará?' : 'Favorito Moneyline'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-400 truncate mt-0.5 font-sans">
                {analysis.pHomeWin >= analysis.pAwayWin ? homeTeam.shortName : awayTeam.shortName}
              </span>
              <span className="text-xs font-mono tracking-tight font-semibold text-white">
                {Math.max(analysis.pHomeWin, analysis.pAwayWin)}% prob.
              </span>
              <span className="text-[10px] text-slate-400 font-sans mt-0.5">
                {viewMode === 'SIMPLE' ? '(Mayor opción)' : '(Más factible)'}
              </span>
            </div>

            {/* 2. Total Puntos Proyectado */}
            <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono tracking-tight font-semibold uppercase">
                {viewMode === 'SIMPLE' ? '¿Puntos en total?' : 'Total Puntos'}
              </span>
              <span className="text-xs sm:text-sm font-mono tracking-tight font-semibold text-white mt-0.5">
                {analysis.projectedTotalPoints} pts
              </span>
              <span className="text-[10px] font-mono tracking-tight text-amber-300">
                Línea {analysis.fairTotalLine} ({analysis.overTotalProb}% Over)
              </span>
              <span className="text-[10px] text-slate-400 font-sans mt-0.5">
                (Suma puntos de ambos)
              </span>
            </div>

            {/* 3. Triples (3PM) Proyectados - Micro-card destacada */}
            <div className="p-3 rounded-xl bg-amber-500/5 backdrop-blur-sm border border-amber-500/30 ring-1 ring-amber-500/20 flex flex-col justify-center">
              <span className="text-[10px] text-amber-300 font-mono tracking-tight font-semibold uppercase flex items-center justify-center gap-1">
                <Target className="w-3 h-3 text-amber-400" />
                {viewMode === 'SIMPLE' ? 'Triples Totales' : 'Triples (3PM)'}
              </span>
              <span className="text-xs sm:text-sm font-mono tracking-tight font-bold text-amber-400 mt-0.5">
                {analysis.threePointersMarket?.projectedTotal3PM ?? 26.5} 3PM
              </span>
              <span className="text-[10px] font-mono tracking-tight text-emerald-400 truncate font-semibold">
                Línea {analysis.threePointersMarket?.threePointLine ?? 26.5} ({analysis.threePointersMarket?.over3PMProb ?? 51}% Over)
              </span>
              <span className="text-[10px] text-slate-400 font-sans mt-0.5">
                (Tiros de 3 encestados)
              </span>
            </div>

            {/* 4. Hándicap / Spread */}
            <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono tracking-tight font-semibold uppercase">
                {viewMode === 'SIMPLE' ? 'Ventaja de puntos' : 'Spread / Hándicap'}
              </span>
              <span className="text-xs sm:text-sm font-mono tracking-tight font-semibold text-white mt-0.5">
                {analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread} pts
              </span>
              <span className="text-[10px] font-mono tracking-tight text-slate-300">
                {homeTeam.shortName}
              </span>
              <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                (Margen esperado)
              </span>
            </div>

            {/* 5. Ritmo / Pace */}
            <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 flex flex-col justify-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 font-mono tracking-tight font-semibold uppercase">
                {viewMode === 'SIMPLE' ? 'Velocidad juego' : 'Ritmo de Juego'}
              </span>
              <span className="text-xs sm:text-sm font-mono tracking-tight font-semibold text-emerald-400 mt-0.5">
                {analysis.expectedPace} poss
              </span>
              <span className="text-[10px] font-mono tracking-tight text-slate-300">
                {analysis.expectedPace > 100 ? 'Juego rápido' : 'Juego pausado'}
              </span>
              <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                (Posesiones por partido)
              </span>
            </div>
          </div>

          {/* Fila Destacada de Pronóstico de Triples */}
          {analysis.threePointersMarket && (
            <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900/40 to-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] uppercase font-mono tracking-tight font-bold">Pronóstico de Triples:</span>
                <span className="text-white font-mono tracking-tight font-semibold">{analysis.threePointersMarket.projectedTotal3PM} 3PM Totales</span>
                <span className="text-slate-400 text-[10px] font-mono tracking-tight">({homeTeam.shortName}: {analysis.threePointersMarket.projectedHome3PM} · {awayTeam.shortName}: {analysis.threePointersMarket.projectedAway3PM})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-tight">
                <span className="text-slate-400">Máximo triplista:</span>
                <span className="text-amber-300 font-semibold">{analysis.threePointersMarket.topShooterName}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 text-[10px]">
                  {analysis.threePointersMarket.topShooter3PM} 3PM
                </span>
              </div>
            </div>
          )}

          {/* Botón Principal Desplegable NBA */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToggleExpand}
              className={`flex-1 py-2 px-3.5 rounded-full border text-xs font-mono tracking-tight font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                expanded
                  ? 'bg-slate-900/60 border-amber-500/50 text-amber-300 hover:bg-slate-800/60'
                  : 'bg-slate-900/40 hover:bg-white/5 border-slate-700/40 text-amber-300'
              }`}
            >
              <span>{expanded ? 'Ocultar desglose matemático' : '🔬 Ver análisis matemático avanzado (Cuartos, Jugadores, Poisson 3PM, +EV)'}</span>
              {expanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
            </button>

            <a
              href={liveTrackerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="py-2 px-3 rounded-full bg-slate-900/40 hover:bg-white/5 border border-slate-700/40 hover:border-amber-500/30 text-xs font-mono tracking-tight font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Marcador en vivo"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">En directo</span>
            </a>
          </div>
        </div>

        {/* Sección de Análisis Detallado NBA (Visible al Desplegar) */}
        {expanded && (
          <div className="p-4 sm:p-5 pt-3 space-y-4 border-t border-slate-800/40">
            {/* MÓDULO EXCLUSIVO: MERCADO DE TRIPLES (3-POINTERS / 3PM) CON DISTRIBUCIÓN POISSON */}
            {analysis.threePointersMarket && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                      <Target className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs sm:text-sm font-sans font-semibold text-white uppercase tracking-tight block">
                        Mercado de Triples (3-Pointers / 3PM)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                        Distribución de Poisson exacta según volumen perimetral y efectividad
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono tracking-tight font-semibold border border-amber-500/30">
                    Poisson λ={analysis.threePointersMarket.projectedTotal3PM}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Tarjeta 1: Línea Principal Over/Under de Triples */}
                  <div className="p-3 rounded-xl bg-slate-950/40 backdrop-blur-sm border border-slate-800/40 text-center space-y-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block">
                      Línea Total de Triples
                    </span>
                    <span className="text-xl font-mono tracking-tight font-bold text-amber-300 block">
                      {analysis.threePointersMarket.projectedTotal3PM} 3PM
                    </span>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-mono tracking-tight">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                        Over {analysis.threePointersMarket.threePointLine} ({analysis.threePointersMarket.over3PMProb}%)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300 font-semibold border border-slate-700/40">
                        Under ({analysis.threePointersMarket.under3PMProb}%)
                      </span>
                    </div>
                    {/* Barra de probabilidad Poisson */}
                    <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden flex mt-2">
                      <div
                        className="bg-emerald-400 h-full"
                        style={{ width: `${analysis.threePointersMarket.over3PMProb}%` }}
                        title={`Over: ${analysis.threePointersMarket.over3PMProb}%`}
                      />
                      <div
                        className="bg-amber-500/60 h-full"
                        style={{ width: `${analysis.threePointersMarket.under3PMProb}%` }}
                        title={`Under: ${analysis.threePointersMarket.under3PMProb}%`}
                      />
                    </div>
                  </div>

                  {/* Tarjeta 2: Triples Esperados por Equipo */}
                  <div className="p-3 rounded-xl bg-slate-950/40 backdrop-blur-sm border border-slate-800/40 space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block text-center">
                      Triples por Franquicia
                    </span>
                    <div className="space-y-1.5 text-xs font-mono tracking-tight">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img src={homeTeam.logo} alt="" className="w-4 h-4 object-contain" />
                          <span className="text-white font-sans font-semibold truncate">{homeTeam.shortName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-300 font-bold">{analysis.threePointersMarket.projectedHome3PM} 3PM</span>
                          <span className="text-[9px] text-slate-400 block">{((homeTeam.threePointAttemptRate || 0.40) * 100).toFixed(0)}% 3PA · {homeTeam.threePointPct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img src={awayTeam.logo} alt="" className="w-4 h-4 object-contain" />
                          <span className="text-white font-sans font-semibold truncate">{awayTeam.shortName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-blue-300 font-bold">{analysis.threePointersMarket.projectedAway3PM} 3PM</span>
                          <span className="text-[9px] text-slate-400 block">{((awayTeam.threePointAttemptRate || 0.40) * 100).toFixed(0)}% 3PA · {awayTeam.threePointPct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta 3: Tirador Estrella Proyectado */}
                  <div className="p-3 rounded-xl bg-slate-950/40 backdrop-blur-sm border border-slate-800/40 text-center space-y-1.5 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-amber-400/90 block flex items-center justify-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      Máximo Triplista Previsto
                    </span>
                    <span className="text-sm font-sans font-semibold text-white truncate block">
                      {analysis.threePointersMarket.topShooterName}
                    </span>
                    <span className="text-base font-mono tracking-tight font-bold text-amber-400 block">
                      {analysis.threePointersMarket.topShooter3PM} Triples
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono tracking-tight block">
                      Mayor volumen perimetral del duelo
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Métricas Principales Proyectadas (Total Puntos, Ritmo y Hándicap) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Puntos Proyectados Totales */}
              <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 text-center">
                <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block">
                  {isLive ? 'Total Puntos Adaptado' : 'Total Puntos Esperado'}
                </span>
                <span className="text-sm font-mono tracking-tight font-semibold text-amber-300 mt-0.5 block">
                  {analysis.projectedTotalPoints} pts
                </span>
                <span className="text-[10px] font-mono tracking-tight text-slate-400 block">
                  O/U Línea: {analysis.fairTotalLine}
                </span>
              </div>

              {/* Posesiones Proyectadas (Pace) */}
              <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 text-center">
                <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block">
                  Ritmo (Pace)
                </span>
                <span className="text-sm font-mono tracking-tight font-semibold text-white mt-0.5 block">
                  {analysis.expectedPace} poss
                </span>
                <span className="text-[10px] text-slate-400 block truncate font-sans">
                  {analysis.expectedPace > 100.5 ? 'Ritmo Rápido' : 'Media Cancha'}
                </span>
              </div>

              {/* Proyección Marcador */}
              <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 text-center">
                <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block">
                  {isLive ? 'Marcador Final Proyectado' : 'Marcador Esperado'}
                </span>
                <span className="text-sm font-mono tracking-tight font-semibold text-white mt-0.5 block">
                  {analysis.projectedHomeScore} - {analysis.projectedAwayScore}
                </span>
                <span className="text-[10px] font-mono tracking-tight text-emerald-400 block">
                  Dif: {analysis.projectedHomeScore > analysis.projectedAwayScore ? '+' : ''}
                  {(analysis.projectedHomeScore - analysis.projectedAwayScore).toFixed(1)}
                </span>
              </div>

              {/* Hándicap / Spread Justo */}
              <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 text-center">
                <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-400 block">
                  Hándicap (Spread)
                </span>
                <span className="text-sm font-mono tracking-tight font-semibold text-white mt-0.5 block">
                  {analysis.pHomeWin >= 50 ? `${homeTeam.shortName} ${analysis.fairSpread}` : `${awayTeam.shortName} +${Math.abs(analysis.fairSpread)}`}
                </span>
                <span className="text-[10px] text-amber-400/90 block font-mono tracking-tight">
                  {analysis.pHomeWin >= 50 ? `Fav: ${homeTeam.shortName}` : `Fav: ${awayTeam.shortName}`}
                </span>
              </div>
            </div>

            {/* 4. MÓDULO EXCLUSIVO: Desglose por Cuartos (1Q, 2Q, 3Q, 4Q y 1H) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-mono tracking-tight font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Desglose por Cuartos y Mitades (Proyección Matemática)</span>
                </span>
                <span className="text-[10px] font-mono tracking-tight text-slate-400">12 min / cuarto</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {analysis.quarterProjections.map((qp) => (
                  <div
                    key={qp.quarter}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      qp.status === 'FINAL'
                        ? 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                        : qp.status === 'IN_PLAY'
                        ? 'bg-rose-950/30 border-rose-500/40 text-white ring-1 ring-rose-500/20'
                        : 'bg-slate-950/40 border-slate-800/40 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-tight font-semibold border-b border-slate-800/40 pb-1 mb-1">
                      <span className="text-amber-400">{qp.quarter}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                        qp.status === 'FINAL' ? 'bg-slate-800 text-slate-400' : qp.status === 'IN_PLAY' ? 'bg-rose-500/80 text-white animate-pulse' : 'bg-slate-800 text-amber-300'
                      }`}>
                        {qp.status === 'FINAL' ? 'FINAL' : qp.status === 'IN_PLAY' ? 'EN VIVO' : 'PROY'}
                      </span>
                    </div>

                    {/* Puntaje real si ya finalizó, o proyectado */}
                    {qp.status === 'FINAL' && qp.actualHome !== undefined && qp.actualAway !== undefined ? (
                      <div>
                        <span className="text-xs font-mono tracking-tight font-bold text-white block">
                          {qp.actualHome} - {qp.actualAway}
                        </span>
                        <span className="text-[9px] font-mono tracking-tight text-slate-400 block mt-0.5">
                          Real: {qp.actualHome + qp.actualAway} pts
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-mono tracking-tight font-bold text-amber-200 block">
                          {qp.projectedHome} - {qp.projectedAway}
                        </span>
                        <span className="text-[9px] font-mono tracking-tight text-slate-400 block mt-0.5">
                          Línea: {qp.overLine} pts
                        </span>
                        <span className="text-[9px] text-emerald-400 font-mono tracking-tight font-semibold block">
                          Fav: {qp.favorite}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 5. MÓDULO EXCLUSIVO: Props de Jugadores Estrella */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-mono tracking-tight font-semibold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Props de Figuras Clave: Puntos & Triples con Distribución Poisson</span>
                </span>
                <span className="text-[10px] font-mono tracking-tight text-emerald-400">Probabilidad Matemática Exacta</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {analysis.playerProps.slice(0, 6).map((player) => (
                  <div
                    key={player.id}
                    className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/40 space-y-2 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-sans font-semibold text-white block truncate">
                          {player.name}
                        </span>
                        <span className="text-[10px] font-mono tracking-tight text-slate-400 block">
                          {player.team} · {player.position}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayerModal({
                              sport: 'NBA',
                              fixtureId: fixture.id,
                              matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                              homeTeamName: homeTeam.name,
                              awayTeamName: awayTeam.name,
                              matchDate: fixture.date,
                              matchTime: fixture.time,
                              player: {
                                id: player.id,
                                name: player.name,
                                number: 23,
                                position: player.position,
                                teamName: player.team,
                                usageRate: player.usageRate,
                                projectedPoints: player.projectedPoints,
                                pointsLine: player.pointsLine,
                                overPointsProb: player.overPointsProb,
                                projected3pm: player.projected3pm,
                                threePointersLine: player.threePointersLine,
                                over3pmProb: player.over3pmProb
                              }
                            });
                          }}
                          className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer"
                          title="Ver todas las estadísticas y mercados del jugador"
                        >
                          <BarChart2 className="w-3 h-3 text-amber-400" />
                          <span>Stats</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono tracking-tight pt-1 border-t border-slate-800/40">
                      {/* Puntos Proyectados (Añadir a Parlay) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const ptsKey = `PROP_PTS_${player.name.replace(/\s+/g, '_')}`;
                          const odd = Number((100 / Math.max(10, player.overPointsProb)).toFixed(2));
                          togglePick({
                            id: `${fixture.id}_${ptsKey}`,
                            fixtureId: fixture.id,
                            sport: 'NBA',
                            matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                            homeTeamName: homeTeam.name,
                            awayTeamName: awayTeam.name,
                            matchDate: fixture.date,
                            matchTime: fixture.time,
                            marketKey: ptsKey,
                            selectionLabel: `${player.name}: +${player.pointsLine} Puntos`,
                            referenceOdd: odd,
                            userOdd: odd,
                            probability: player.overPointsProb,
                            isEV: player.overPointsProb >= 60
                          });
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isPickInParlay(fixture.id, `PROP_PTS_${player.name.replace(/\s+/g, '_')}`)
                            ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-sm'
                            : 'bg-slate-900/50 hover:bg-slate-800/80 border-slate-800/40 hover:border-amber-500/40'
                        }`}
                        title="Haz clic para añadir/quitar esta prop de Puntos al Boleto de Combinadas"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-mono tracking-tight">Puntos</span>
                          <Ticket className="w-3 h-3 text-amber-400" />
                        </div>
                        <span className="text-xs font-bold block mt-0.5">
                          +{player.pointsLine} Pts
                        </span>
                        <span className="text-[9px] font-semibold block">
                          {player.overPointsProb}% prob · @{(100 / Math.max(10, player.overPointsProb)).toFixed(2)}
                        </span>
                      </button>

                      {/* Triples con Poisson (Añadir a Parlay) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const pmKey = `PROP_3PM_${player.name.replace(/\s+/g, '_')}`;
                          const odd = Number((100 / Math.max(10, player.over3pmProb)).toFixed(2));
                          togglePick({
                            id: `${fixture.id}_${pmKey}`,
                            fixtureId: fixture.id,
                            sport: 'NBA',
                            matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
                            homeTeamName: homeTeam.name,
                            awayTeamName: awayTeam.name,
                            matchDate: fixture.date,
                            matchTime: fixture.time,
                            marketKey: pmKey,
                            selectionLabel: `${player.name}: +${player.threePointersLine} Triples`,
                            referenceOdd: odd,
                            userOdd: odd,
                            probability: player.over3pmProb,
                            isEV: player.over3pmProb >= 60
                          });
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isPickInParlay(fixture.id, `PROP_3PM_${player.name.replace(/\s+/g, '_')}`)
                            ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-sm'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 ring-1 ring-amber-500/20'
                        }`}
                        title="Haz clic para añadir/quitar esta prop de Triples al Boleto de Combinadas"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-mono tracking-tight">Triples</span>
                          <Target className="w-3 h-3 text-amber-400" />
                        </div>
                        <span className="text-xs font-bold block mt-0.5">
                          +{player.threePointersLine} 3PM
                        </span>
                        <span className="text-[9px] font-semibold block">
                          {player.over3pmProb}% prob · @{(100 / Math.max(10, player.over3pmProb)).toFixed(2)}
                        </span>
                      </button>
                    </div>

                    {/* Progresión en vivo si el partido está en juego */}
                    {isLive && player.liveCurrentPoints !== undefined && (
                      <div className="text-[10px] font-mono tracking-tight text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg flex items-center justify-between border border-slate-800/40">
                        <span>Lleva en vivo:</span>
                        <span className="text-rose-400 font-bold">
                          {player.liveCurrentPoints} pts · {player.liveCurrent3pm} triples
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Claves Tácticas del Encuentro */}
            <div className="p-3.5 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 text-xs space-y-1">
              <span className="text-[10px] font-mono tracking-tight font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Análisis Táctico de Ritmo</span>
              </span>
              <p className="text-slate-300/90 text-[11px] leading-relaxed font-sans">
                {analysis.paceDifferentialExplanation} {analysis.keyMatchup}
              </p>
            </div>

            {/* 7. Cuotas de Mercado y Simulación */}
            <div className="p-3 rounded-xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono tracking-tight font-semibold uppercase text-slate-400">Cuotas NBA:</span>
                <div className="flex items-center gap-1.5 font-mono tracking-tight font-semibold text-xs">
                  {analysis.marketOdds && (
                    <>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/40 text-emerald-400">
                        1 (Local): @{analysis.marketOdds.bookmakerHomeOdds.toFixed(2)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/40 text-blue-400">
                        2 (Visita): @{analysis.marketOdds.bookmakerAwayOdds.toFixed(2)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/40 text-amber-300">
                        Total ({analysis.fairTotalLine}): @{analysis.marketOdds.bookmakerOverOdds.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>

                {analysis.marketOdds?.valueBetDetected && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-tight font-bold bg-amber-500/15 text-amber-300 border border-amber-400/40 shadow-xs animate-pulse">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Apuesta de Valor detectada (+{analysis.marketOdds.valueEdgePercent}%)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto pt-1 sm:pt-0 border-t border-slate-800/40 sm:border-t-0">
                <a
                  href={liveTrackerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono tracking-tight font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/30 transition-all cursor-pointer group shadow-xs"
                  title="Ver marcador y estadísticas oficiales en vivo"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block"></span>
                  <span>Marcador en Vivo</span>
                  <ExternalLink className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>

            {/* 8. MÓDULO INTERACTIVO: Calculadora +EV y Criterio de Kelly (NBA) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-tight font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  <span>Calculadora +EV / Gestión de Banca Kelly (NBA)</span>
                </span>
                <span className="text-[10px] font-mono tracking-tight text-slate-400">Quarter Kelly (25%)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                {/* Selector de Mercado (Local, Visita, Over, Under) */}
                <div className="sm:col-span-5 flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setSelectedBetType('HOME')}
                    className={`flex-1 py-1 text-[11px] font-mono tracking-tight font-semibold rounded-lg transition-colors cursor-pointer truncate ${
                      selectedBetType === 'HOME'
                        ? 'bg-amber-500 text-black shadow-xs font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Local: ${homeTeam.shortName} (${analysis.pHomeWin}%)`}
                  >
                    {homeTeam.shortName} ({analysis.pHomeWin}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBetType('AWAY')}
                    className={`flex-1 py-1 text-[11px] font-mono tracking-tight font-semibold rounded-lg transition-colors cursor-pointer truncate ${
                      selectedBetType === 'AWAY'
                        ? 'bg-blue-500 text-white shadow-xs font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Visita: ${awayTeam.shortName} (${analysis.pAwayWin}%)`}
                  >
                    {awayTeam.shortName} ({analysis.pAwayWin}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBetType('OVER')}
                    className={`flex-1 py-1 text-[11px] font-mono tracking-tight font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedBetType === 'OVER'
                        ? 'bg-emerald-500 text-black shadow-xs font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Más de ${analysis.fairTotalLine} pts`}
                  >
                    Over ({analysis.overTotalProb}%)
                  </button>
                </div>

                {/* Input de Cuota */}
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="Cuota (ej. 1.95)"
                    value={inputOdds}
                    onChange={(e) => setInputOdds(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800/60 focus:border-amber-400 focus:outline-none rounded-xl px-2.5 py-1.5 text-xs font-mono tracking-tight text-white placeholder-slate-500 text-center font-bold"
                  />
                </div>

                {/* Resultados Directos: EV y Stake */}
                <div className="sm:col-span-4 grid grid-cols-2 gap-1.5 text-center">
                  {/* Valor Esperado (+EV) */}
                  <div
                    className={`px-2 py-1.5 rounded-xl border text-xs font-mono tracking-tight font-bold flex flex-col justify-center ${
                      evMetrics.evPercent === null
                        ? 'bg-slate-950/40 border-slate-800/40 text-slate-500'
                        : evMetrics.isPositive
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                      {evMetrics.evPercent === null ? 'Valor Esperado' : evMetrics.isPositive ? '+EV (Valor)' : '-EV (Sin Valor)'}
                    </span>
                    <span>
                      {evMetrics.evPercent !== null ? `${evMetrics.isPositive ? '+' : ''}${evMetrics.evPercent}%` : '—'}
                    </span>
                  </div>

                  {/* Stake Sugerido (Kelly) */}
                  <div
                    className={`px-2 py-1.5 rounded-xl border text-xs font-mono tracking-tight font-bold flex flex-col justify-center ${
                      evMetrics.kellyStake === null
                        ? 'bg-slate-950/40 border-slate-800/40 text-slate-500'
                        : evMetrics.isPositive
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                        : 'bg-slate-950/40 border-slate-800/40 text-slate-400'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Stake Kelly</span>
                    <span>
                      {evMetrics.kellyStake !== null ? `${evMetrics.kellyStake}% Banca` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botón Inferior para Contraer NBA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleExpand}
                className="w-full py-2 px-4 rounded-full bg-slate-900/40 hover:bg-white/5 border border-slate-800/40 hover:border-amber-500/30 text-xs font-mono tracking-tight font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Colapsar análisis de este partido</span>
                <ChevronUp className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Player Stats & Props Modal */}
      <PlayerStatsModal
        payload={selectedPlayerModal}
        isOpen={Boolean(selectedPlayerModal)}
        onClose={() => setSelectedPlayerModal(null)}
      />
    </div>
  );
});
