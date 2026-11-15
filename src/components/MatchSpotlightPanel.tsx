import React, { useMemo } from 'react';
import {
  Sparkles,
  Shield,
  Zap,
  AlertTriangle,
  Activity,
  Crosshair,
  Award,
  Plus,
  Check,
  Maximize2,
  X,
  HelpCircle,
  Compass,
  Flame,
  Clock,
  MapPin,
  Scale,
  Users
} from 'lucide-react';
import {
  MatchFixture,
  MatchAnalysis,
  NBAMatchFixture,
  NBAAnalysis
} from '../types';
import { getSoccerLineupData } from '../services/lineupService';
import { formatCompactTeamName } from '../services/leagueCategorizer';
import { useParlay } from '../context/ParlayContext';

export type SpotlightPayload =
  | { type: 'SOCCER'; fixture: MatchFixture; analysis: MatchAnalysis }
  | { type: 'NBA'; fixture: NBAMatchFixture; analysis: NBAAnalysis };

interface MatchSpotlightPanelProps {
  payload: SpotlightPayload | null;
  onClose: () => void;
  onOpenFullModal: (payload: SpotlightPayload) => void;
  showOnboardingTip: boolean;
  onDismissOnboardingTip: () => void;
  onReopenOnboardingTip: () => void;
}

export const MatchSpotlightPanel: React.FC<MatchSpotlightPanelProps> = ({
  payload,
  onClose,
  onOpenFullModal,
  showOnboardingTip,
  onDismissOnboardingTip,
  onReopenOnboardingTip
}) => {
  const { addPick, isPickInParlay, setIsOpen: setIsParlayOpen } = useParlay();

  const soccerLineup = useMemo(() => {
    if (!payload || payload.type !== 'SOCCER') return null;
    try {
      return getSoccerLineupData(payload.fixture);
    } catch {
      return null;
    }
  }, [payload]);

  if (!payload) return null;

  // =========================================================================
  // RENDERIZADO: MODO FÚTBOL (SHOWCASE SPOTLIGHT + TACTICAL WIRE)
  // =========================================================================
  if (payload.type === 'SOCCER') {
    const { fixture, analysis } = payload;
    const { homeTeam, awayTeam, status } = fixture;
    const isLive = ['IN_PLAY', 'HALFTIME', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(status);
    const isFinished = status === 'FINISHED';

    const homeGoals = fixture.currentScore?.home ?? 0;
    const awayGoals = fixture.currentScore?.away ?? 0;
    const liveMin = fixture.currentScore?.minute;

    // 1. Poder Ofensivo (xG) & Resistencia Defensiva
    const lambdaHome = analysis.dixonColes?.lambdaHome ?? 1.42;
    const lambdaAway = analysis.dixonColes?.lambdaAway ?? 1.12;
    const totalXG = Math.max(0.5, lambdaHome + lambdaAway);
    const homeAttackPct = Math.min(88, Math.max(18, Math.round((lambdaHome / totalXG) * 100)));
    const awayAttackPct = 100 - homeAttackPct;

    const homeCleanPct = analysis.cleanSheet?.homeCleanSheetPercent ?? 34;
    const awayCleanPct = analysis.cleanSheet?.awayCleanSheetPercent ?? 26;
    const homeDefScore = Math.min(96, Math.max(45, Math.round(52 + homeCleanPct * 0.55)));
    const awayDefScore = Math.min(96, Math.max(45, Math.round(52 + awayCleanPct * 0.55)));

    // 2. Top 3 Marcadores Exactos (Dixon-Coles)
    const topScores = (analysis.dixonColes?.mostLikelyScores || []).slice(0, 3);

    // 3. Tactical Wire: Formaciones y Contexto
    const homeFormation = soccerLineup?.homeFormation || '4-2-3-1';
    const awayFormation = soccerLineup?.awayFormation || '4-4-2';
    const homeStyleLabel =
      lambdaHome >= 1.55
        ? 'Presión Alta · Vol. Ofensivo'
        : lambdaHome >= 1.2
        ? 'Transición Equilibrada'
        : 'Repliegue Táctico';
    const awayStyleLabel =
      lambdaAway >= 1.45
        ? 'Ataque Directo Vertical'
        : lambdaAway >= 1.05
        ? 'Bloque Medio · Contraataque'
        : 'Bloque Bajo Compacto';

    const stadiumName =
      soccerLineup?.stadiumName ||
      (fixture as any).venue?.name ||
      `Estadio de ${formatCompactTeamName(homeTeam.name)}`;
    const refereeName =
      analysis.refereeCards?.refereeName ||
      fixture.referee?.name ||
      soccerLineup?.refereeName ||
      'Árbitro Oficial FIFA';

    const expectedCorners = analysis.cornersMarket?.expectedTotalCorners ?? 9.8;
    const expectedCards = analysis.refereeCards?.expectedYellowCards ?? 4.3;

    // Jugadores lesionados o en capilla
    const injuredPlayers = soccerLineup
      ? [...soccerLineup.homeStarters, ...soccerLineup.awayStarters, ...soccerLineup.homeSubstitutes, ...soccerLineup.awaySubstitutes].filter(
          (p) => p.isInjured
        )
      : [];
    const playersWithYellowRisk = soccerLineup
      ? [...soccerLineup.homeStarters, ...soccerLineup.awayStarters].filter(
          (p) => p.hasPreviousYellow || p.matchYellowCards > 0
        )
      : [];

    // 4. Cápsula de Veredicto Rápido (+EV)
    const topPick = analysis.verdict?.topSafePick;
    const pickMarketKey = topPick ? `SPOTLIGHT_${topPick.id}` : 'SPOTLIGHT_MAIN';
    const alreadyInSlip = isPickInParlay(fixture.id);

    const handleAddStarPickToParlay = () => {
      if (!topPick) return;
      addPick({
        id: `${fixture.id}_${pickMarketKey}`,
        fixtureId: fixture.id,
        sport: 'SOCCER',
        matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam.name,
        matchDate: fixture.date,
        matchTime: fixture.time,
        marketKey: pickMarketKey,
        selectionLabel: topPick.plainTitle || topPick.label,
        referenceOdd: topPick.fairOdd || 1.62,
        userOdd: topPick.fairOdd || 1.62,
        probability: topPick.probability || 75,
        isEV: true
      });
      setIsParlayOpen(true);
    };

    return (
      <aside className="hidden xl:flex flex-col w-[410px] 2xl:w-[435px] shrink-0 select-none relative">
        {/* MENSAJE FLOTANTE DE BIENVENIDA / ONBOARDING PARA NUEVOS USUARIOS */}
        {showOnboardingTip && (
          <div className="mb-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white border border-emerald-400/50 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-emerald-400/15 blur-xl pointer-events-none" />
            <div className="flex items-start justify-between gap-2.5 relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                  <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '9s' }} />
                </span>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 font-bold block">
                    Nuevo · Radar Lateral Interactivo
                  </span>
                  <h4 className="text-xs font-extrabold text-white tracking-tight">
                    ¿Cómo funciona el Panel Match Spotlight?
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissOnboardingTip}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Cerrar guía rápida"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-200 leading-snug relative z-10">
              <div className="flex items-start gap-2 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/10">
                <span className="text-emerald-400 font-mono font-bold">1.</span>
                <p>
                  <strong className="text-white">Toca cualquier partido</strong> de la lista izquierda: la cartelera se desliza automáticamente y despliega aquí la radiografía táctica sin recargar.
                </p>
              </div>
              <div className="flex items-start gap-2 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/10">
                <span className="text-emerald-400 font-mono font-bold">2.</span>
                <p>
                  Usa <strong className="text-emerald-300">"Ver Cuotas y Datos"</strong> o el botón inferior para abrir la <strong>Cancha 2D en Vivo y Plantillas 11 vs 11</strong>.
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={onDismissOnboardingTip}
                className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] transition-all cursor-pointer shadow-sm"
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        )}

        {/* TARJETA PRINCIPAL SPOTLIGHT + TACTICAL WIRE (CYBER-FINTECH DARK) */}
        <div className="rounded-3xl bg-[#161b22] border border-[#30363d] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
          {/* ===============================================================
              1. SHOWCASE MATCH SPOTLIGHT HEADER (CYBER-FINTECH DEGRADÉ)
             =============================================================== */}
          <div className="relative bg-gradient-to-br from-slate-950 via-emerald-950/80 to-slate-900 text-white p-4 border-b border-[#30363d] overflow-hidden">
            {/* Resplandores ambientales cinéticos en degradé */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-[#d9b114]/15 blur-2xl pointer-events-none" />

            {/* Top Bar: Liga + Botones Ayuda / Cerrar */}
            <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0b0e14] border border-[#30363d] text-[10px] font-mono uppercase tracking-wider text-[#d9b114] font-semibold truncate max-w-[270px]">
                <Sparkles className="w-3 h-3 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="truncate">{fixture.league?.name || 'Competición Oficial'}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onReopenOnboardingTip}
                  className="w-6 h-6 rounded-full bg-[#0b0e14] hover:bg-[#1c2129] border border-[#30363d] flex items-center justify-center text-[#8b949e] hover:text-white transition-colors cursor-pointer"
                  title="¿Cómo funciona este panel?"
                >
                  <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-6 h-6 rounded-full bg-[#0b0e14] hover:bg-rose-500/20 border border-[#30363d] flex items-center justify-center text-[#8b949e] hover:text-rose-400 transition-colors cursor-pointer"
                  title="Ocultar panel derecho y centrar cartelera"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Escudos enfrentados en gran formato + Marcador / Hora */}
            <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1">
              {/* Local */}
              <div className="flex flex-col items-center text-center min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-[#0b0e14] border border-[#30363d] shadow-md flex items-center justify-center p-2.5 mb-1.5 group hover:scale-105 transition-transform">
                  {homeTeam.logo?.trim() ? (
                    <img
                      src={homeTeam.logo}
                      alt={homeTeam.name}
                      className="w-11 h-11 object-contain drop-shadow-md"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Shield className="w-8 h-8 text-[#d9b114]" strokeWidth={2} />
                  )}
                </div>
                <span className="text-xs font-extrabold text-white tracking-tight leading-tight line-clamp-1 w-full">
                  {formatCompactTeamName(homeTeam.name)}
                </span>
                <span className="text-[9.5px] font-mono text-[#8b949e] uppercase tracking-wider">
                  Local · #{analysis.urgency?.homeRank || 4}
                </span>
              </div>

              {/* Centro: Marcador o Hora */}
              <div className="flex flex-col items-center justify-center px-2">
                {isLive || isFinished ? (
                  <div className="px-3.5 py-1.5 rounded-2xl bg-[#0b0e14] border border-[#30363d] font-mono tabular-nums text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>{homeGoals}</span>
                    <span className="text-[#8b949e] text-lg">-</span>
                    <span>{awayGoals}</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-2xl bg-[#0b0e14] border border-[#30363d] font-mono tabular-nums text-base font-black tracking-wider text-[#d9b114]">
                    VS
                  </div>
                )}

                {isLive ? (
                  <span className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono text-[10px] font-bold tracking-wide shadow-sm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>{liveMin ? `${liveMin}' EN VIVO` : 'EN VIVO'}</span>
                  </span>
                ) : isFinished ? (
                  <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-[#0b0e14] text-[#8b949e] font-mono text-[10px] font-bold border border-[#30363d]">
                    FINALIZADO
                  </span>
                ) : (
                  <span className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0b0e14] text-slate-300 border border-[#30363d] font-mono text-[10px] font-bold">
                    <Clock className="w-2.5 h-2.5 text-[#d9b114]" strokeWidth={2} />
                    <span>{fixture.time}</span>
                  </span>
                )}
              </div>

              {/* Visitante */}
              <div className="flex flex-col items-center text-center min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-[#0b0e14] border border-[#30363d] shadow-md flex items-center justify-center p-2.5 mb-1.5 group hover:scale-105 transition-transform">
                  {awayTeam.logo?.trim() ? (
                    <img
                      src={awayTeam.logo}
                      alt={awayTeam.name}
                      className="w-11 h-11 object-contain drop-shadow-md"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Shield className="w-8 h-8 text-[#d9b114]" strokeWidth={2} />
                  )}
                </div>
                <span className="text-xs font-extrabold text-white tracking-tight leading-tight line-clamp-1 w-full">
                  {formatCompactTeamName(awayTeam.name)}
                </span>
                <span className="text-[9.5px] font-mono text-[#8b949e] uppercase tracking-wider">
                  Visita · #{analysis.urgency?.awayRank || 7}
                </span>
              </div>
            </div>

            {/* Píldoras de Estadio, Árbitro y Contexto */}
            <div className="relative z-10 mt-3 pt-2.5 border-t border-[#21262d] flex flex-wrap items-center justify-center gap-1.5 text-[10.5px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0b0e14] text-slate-300 border border-[#30363d] truncate max-w-[185px]">
                <MapPin className="w-3 h-3 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="truncate">{stadiumName}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0b0e14] text-slate-300 border border-[#30363d] truncate max-w-[175px]">
                <Scale className="w-3 h-3 text-[#d9b114] shrink-0" strokeWidth={2} />
                <span className="truncate">{refereeName}</span>
              </span>
            </div>

            {/* Etiquetas Informativas: Texto gris claro sobre fondo oscuro SIN chips de color */}
            <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-[#8b949e]">
              <span>
                {fixture.derbyOrRivalry
                  ? 'Clásico / Alta Rivalidad'
                  : analysis.urgency?.urgencyIndex >= 7
                  ? 'Duelo Directo Puntos'
                  : 'Choque Táctico Oficial'}
              </span>
              <span className="text-[#30363d]" aria-hidden="true">·</span>
              <span>
                {totalXG >= 2.65 ? 'Campo Rápido · Alto xG' : 'Ritmo Táctico Controlado'}
              </span>
            </div>
          </div>

          {/* CUERPO DEL PANEL CON TARJETAS OSCURAS CYBER-FINTECH */}
          <div className="p-3.5 space-y-3 bg-[#0b0e14]">
            {/* ===============================================================
                2. BARRA DE CHOQUE DE FUERZAS (TUG-OF-WAR TELEMETRY CARD)
               =============================================================== */}
            <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[#d9b114]">
                    <Activity className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <h4 className="text-xs font-extrabold text-white tracking-tight">
                    Fuerza Ofensiva vs Defensiva (xG)
                  </h4>
                </div>
                <span className="text-[10px] font-mono tabular-nums font-bold text-[#8b949e] bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d]">
                  xG Total: <strong className="text-white">{totalXG.toFixed(2)}</strong>
                </span>
              </div>

              {/* Barra 1: Poder Ofensivo (xG) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono tabular-nums font-extrabold text-white bg-[#0b0e14] px-1.5 py-0.5 rounded border border-[#30363d]">
                    {lambdaHome.toFixed(2)} xG
                  </span>
                  <span className="font-semibold text-[#8b949e] text-[10.5px] uppercase tracking-wider">
                    Poder Ofensivo (xG)
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-white bg-[#0b0e14] px-1.5 py-0.5 rounded border border-[#30363d]">
                    {lambdaAway.toFixed(2)} xG
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#0b0e14] overflow-hidden flex p-0.5 gap-0.5 border border-[#30363d]">
                  <div
                    className="h-full rounded-l-full bg-gradient-to-r from-[#d9b114] to-[#f5d033] transition-all duration-500"
                    style={{ width: `${homeAttackPct}%` }}
                  />
                  <div
                    className="h-full rounded-r-full bg-gradient-to-l from-slate-500 to-slate-400 transition-all duration-500"
                    style={{ width: `${awayAttackPct}%` }}
                  />
                </div>
              </div>

              {/* Barra 2: Resistencia Defensiva */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono tabular-nums font-extrabold text-white bg-[#0b0e14] px-1.5 py-0.5 rounded border border-[#30363d]">
                    {homeDefScore}%
                  </span>
                  <span className="font-semibold text-[#8b949e] text-[10.5px] uppercase tracking-wider">
                    Solidez & Resistencia Defensiva
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-white bg-[#0b0e14] px-1.5 py-0.5 rounded border border-[#30363d]">
                    {awayDefScore}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#0b0e14] overflow-hidden flex p-0.5 gap-0.5 border border-[#30363d]">
                  <div
                    className="h-full rounded-l-full bg-gradient-to-r from-[#d9b114] to-[#f5d033] transition-all duration-500"
                    style={{
                      width: `${Math.round((homeDefScore / (homeDefScore + awayDefScore)) * 100)}%`
                    }}
                  />
                  <div
                    className="h-full rounded-r-full bg-gradient-to-l from-slate-500 to-slate-400 transition-all duration-500"
                    style={{
                      width: `${100 - Math.round((homeDefScore / (homeDefScore + awayDefScore)) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ===============================================================
                3. TOP 3 MARCADORES EXACTOS - MATRIZ DIXON-COLES
               =============================================================== */}
            <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[#d9b114]">
                    <Crosshair className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <h4 className="text-xs font-extrabold text-white tracking-tight">
                    Top 3 Marcadores Más Probables
                  </h4>
                </div>
                <span className="text-[9.5px] font-mono text-[#8b949e] bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d] font-semibold">
                  Modelo Predictivo
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {topScores.map((item, idx) => (
                  <div
                    key={item.score}
                    className={`relative rounded-xl p-2 border transition-all flex flex-col items-center justify-center ${
                      idx === 0
                        ? 'bg-[#0b0e14] border-[#d9b114]/60 shadow-xs'
                        : 'bg-[#0b0e14] border-[#30363d]'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-full mb-0.5 ${
                        idx === 0
                          ? 'bg-[#d9b114] text-slate-950 font-bold'
                          : 'bg-[#161b22] text-[#8b949e]'
                      }`}
                    >
                      #{idx + 1} Prob.
                    </span>
                    <span className="font-mono tabular-nums text-sm font-black text-white tracking-tight">
                      {item.score}
                    </span>
                    <span
                      className={`font-mono tabular-nums text-[11px] font-bold ${
                        idx === 0 ? 'text-[#d9b114]' : 'text-[#8b949e]'
                      }`}
                    >
                      [{item.probability.toFixed(1)}%]
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ===============================================================
                4. TACTICAL WIRE & NOVEDADES (PIZARRA TÁCTICA + MICRO-CARDS)
               =============================================================== */}
            <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[#d9b114]">
                    <Users className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <h4 className="text-xs font-extrabold text-white tracking-tight">
                    Tactical Wire & Novedades
                  </h4>
                </div>
                <span className="text-[9.5px] font-mono uppercase tracking-wider font-bold text-slate-300 bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d]">
                  {soccerLineup?.status === 'CONFIRMED' ? '11 Confirmado' : 'Esquema Táctico'}
                </span>
              </div>

              {/* Mini-Pizarra Táctica Oscura */}
              <div className="rounded-xl bg-[#0b0e14] text-white p-2.5 border border-[#30363d] shadow-inner relative overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 relative z-10">
                  <div className="bg-[#161b22] rounded-lg p-2 border border-[#30363d] text-center">
                    <span className="font-mono text-xs font-black text-[#d9b114] block">
                      {homeFormation}
                    </span>
                    <span className="text-[10px] text-[#8b949e] font-semibold leading-tight block mt-0.5">
                      {homeStyleLabel}
                    </span>
                  </div>

                  <div className="w-7 h-7 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center font-mono text-[10px] font-black text-[#d9b114]">
                    VS
                  </div>

                  <div className="bg-[#161b22] rounded-lg p-2 border border-[#30363d] text-center">
                    <span className="font-mono text-xs font-black text-slate-300 block">
                      {awayFormation}
                    </span>
                    <span className="text-[10px] text-[#8b949e] font-semibold leading-tight block mt-0.5">
                      {awayStyleLabel}
                    </span>
                  </div>
                </div>

                {/* Síntesis Inteligente en Cápsula */}
                <div className="mt-2 pt-2 border-t border-[#21262d] flex items-center justify-between gap-2 text-[10.5px] text-[#8b949e]">
                  <span className="leading-snug">
                    El choque de bandas proyecta{' '}
                    <strong className="text-white font-mono tabular-nums">
                      {expectedCorners.toFixed(1)} córners
                    </strong>{' '}
                    y fricción de{' '}
                    <strong className="text-white font-mono tabular-nums">
                      {expectedCards.toFixed(1)} tarjetas
                    </strong>
                    .
                  </span>
                </div>
              </div>

              {/* Tarjetas de Alertas Médicas, Fatiga y Disciplina */}
              <div className="space-y-1.5">
                {/* Tarjeta 1: Estado Físico / Fatiga */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] border-l-4 border-l-rose-500">
                  <span className="w-6 h-6 rounded-lg bg-[#161b22] text-rose-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    🩹
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-extrabold text-white">
                        {injuredPlayers.length > 0
                          ? `Bajas Reportadas (${injuredPlayers.length})`
                          : `Fondo Físico: ${Math.round((analysis.fatigue?.homeRestHours || 96) / 24)}d vs ${Math.round((analysis.fatigue?.awayRestHours || 96) / 24)}d`}
                      </span>
                      <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                        Biometría
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#8b949e] leading-snug mt-0.5 line-clamp-2">
                      {injuredPlayers.length > 0
                        ? `Ausencias clave: ${injuredPlayers.slice(0, 2).map((p) => p.name).join(', ')} Ajustado en modelo xG.`
                        : analysis.fatigue?.fatigueDiagnosis || 'Planteles con recuperación óptima (>72h).'
                      }
                    </p>
                  </div>
                </div>

                {/* Tarjeta 2: Alerta Disciplinaria y Rigor Arbitral */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] border-l-4 border-l-[#d9b114]">
                  <span className="w-6 h-6 rounded-lg bg-[#161b22] text-[#d9b114] flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-extrabold text-white">
                        Alerta Disciplinaria · Rigor {analysis.refereeCards?.rigor || 'Moderado'}
                      </span>
                      <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                        {playersWithYellowRisk.length > 0
                          ? `${playersWithYellowRisk.length} apercibidos`
                          : `${expectedCards.toFixed(1)} Tarj.`}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#8b949e] leading-snug mt-0.5 line-clamp-2">
                      {analysis.refereeCards?.recommendedCardPick || 'Más de 3.5 Tarjetas'} ({analysis.refereeCards?.recommendedCardProb || 72}% prob.) · Riesgo de roja: {analysis.refereeCards?.redCardRiskPercent || 18}%.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===============================================================
                5. CÁPSULA DE VEREDICTO RÁPIDO (+EV) CON ACCIÓN A 1 TOQUE
               =============================================================== */}
            {topPick && (
              <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#d9b114]/60 shadow-md space-y-2.5 relative overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#00ff66] bg-[#00ff66]/15 px-2 py-0.5 rounded-md border border-[#00ff66]/30">
                    <Award className="w-3 h-3 text-[#00ff66]" strokeWidth={2} />
                    <span>Cápsula Veredicto Rápido +EV</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#d9b114]">
                    {analysis.verdict?.confidenceTier || 'Alta Convicción'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-[#0b0e14] p-2.5 rounded-xl border border-[#30363d] shadow-2xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⭐</span>
                      <span className="text-xs font-black text-white truncate">
                        {topPick.plainTitle || topPick.label}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#8b949e] mt-0.5 line-clamp-1">
                      {topPick.categoryLabel} · {topPick.riskLevel}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono tabular-nums text-xs font-black text-[#00ff66] bg-[#00ff66]/10 px-2 py-0.5 rounded-lg border border-[#00ff66]/30 block">
                      {topPick.probability.toFixed(1)}% Certeza
                    </span>
                    <span className="font-mono tabular-nums text-[10px] font-bold text-[#d9b114] mt-0.5 block">
                      @{topPick.fairOdd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Botón 1-Toque Añadir al Boleto */}
                <button
                  type="button"
                  onClick={handleAddStarPickToParlay}
                  className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    alreadyInSlip
                      ? 'bg-[#d9b114] text-slate-950 hover:bg-[#e6be20]'
                      : 'bg-[#0b0e14] hover:bg-[#1c2129] border border-[#d9b114]/60 text-white'
                  }`}
                >
                  {alreadyInSlip ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>En tu Boleto Parlay · Actualizar Selección</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Añadir al Boleto ({topPick.plainTitle || topPick.label})</span>
                    </>
                  )}
                </button>

                {/* Botón secundario para abrir modal completo 2D + plantillas */}
                <button
                  type="button"
                  onClick={() => onOpenFullModal(payload)}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-emerald-800 font-bold text-xs border border-emerald-300/90 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Abrir Cancha 2D, Cuotas y Plantillas 11 vs 11</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // =========================================================================
  // RENDERIZADO: MODO BALONCESTO / NBA (SHOWCASE SPOTLIGHT + TACTICAL WIRE)
  // =========================================================================
  const { fixture, analysis } = payload;
  const { homeTeam, awayTeam, status } = fixture;
  const isLive = status === 'IN_PLAY';
  const isFinished = status === 'FINISHED';

  const homeScore = fixture.currentScore?.home ?? 0;
  const awayScore = fixture.currentScore?.away ?? 0;

  const homeOff = homeTeam.offensiveRating || 115.2;
  const awayOff = awayTeam.offensiveRating || 113.8;
  const homeOffPct = Math.round((homeOff / (homeOff + awayOff)) * 100);

  const starProps = (analysis.playerProps || []).slice(0, 2);
  const alreadyInSlip = isPickInParlay(fixture.id);

  const favName = analysis.pHomeWin >= analysis.pAwayWin ? homeTeam.shortName : awayTeam.shortName;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);
  const favOdd = Math.max(1.12, Math.round((100 / Math.max(15, favProb)) * 0.95 * 100) / 100);

  const handleAddNBAPick = () => {
    addPick({
      id: `${fixture.id}_NBA_SPOTLIGHT`,
      fixtureId: fixture.id,
      sport: 'NBA',
      matchTitle: `${homeTeam.name} vs ${awayTeam.name}`,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      matchDate: fixture.date,
      matchTime: fixture.time,
      marketKey: 'NBA_SPOTLIGHT_ML',
      selectionLabel: `Ganador: ${favName} (Proy. ${analysis.projectedTotalPoints.toFixed(0)} pts)`,
      referenceOdd: favOdd,
      userOdd: favOdd,
      probability: favProb,
      isEV: true
    });
    setIsParlayOpen(true);
  };

  return (
    <aside className="hidden xl:flex flex-col w-[410px] 2xl:w-[435px] shrink-0 select-none relative">
      {showOnboardingTip && (
        <div className="mb-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 text-white border border-amber-400/50 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <h4 className="text-xs font-extrabold">Panel Match Spotlight NBA Activo</h4>
            </div>
            <button
              type="button"
              onClick={onDismissOnboardingTip}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-200 mt-1.5 leading-snug">
            Haz clic en cualquier partido de Baloncesto para inspeccionar el ritmo de posesiones, proyección por cuartos y props de jugadores sin salir de la cartelera.
          </p>
        </div>
      )}

      <div className="rounded-3xl bg-[#161b22] border border-[#30363d] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        {/* Header NBA */}
        <div className="relative bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900 text-white p-4 overflow-hidden">
          <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono uppercase tracking-wider text-amber-300 font-semibold">
              🏀 {fixture.league?.name || 'NBA Official Telemetry'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/30 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1">
            <div className="flex flex-col items-center text-center min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center p-2.5 mb-1.5">
                {homeTeam.logo?.trim() ? (
                  <img src={homeTeam.logo} alt={homeTeam.name} className="w-11 h-11 object-contain" />
                ) : (
                  <Shield className="w-8 h-8 text-amber-300" />
                )}
              </div>
              <span className="text-xs font-extrabold text-white truncate w-full">{homeTeam.shortName}</span>
              <span className="text-[9.5px] font-mono text-amber-300">{homeTeam.wins}-{homeTeam.losses}</span>
            </div>

            <div className="flex flex-col items-center justify-center px-2">
              {isLive || isFinished ? (
                <div className="px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-white/20 font-mono tabular-nums text-xl font-black text-white">
                  {homeScore} - {awayScore}
                </div>
              ) : (
                <div className="px-3.5 py-1.5 rounded-2xl bg-white/10 border border-white/20 font-mono text-base font-black text-amber-300">
                  VS
                </div>
              )}
              <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 font-mono text-[10px] font-bold">
                {isLive ? `EN VIVO · ${fixture.livePeriod || 'Q1'}` : isFinished ? 'FINAL' : fixture.time}
              </span>
            </div>

            <div className="flex flex-col items-center text-center min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center p-2.5 mb-1.5">
                {awayTeam.logo?.trim() ? (
                  <img src={awayTeam.logo} alt={awayTeam.name} className="w-11 h-11 object-contain" />
                ) : (
                  <Shield className="w-8 h-8 text-amber-300" />
                )}
              </div>
              <span className="text-xs font-extrabold text-white truncate w-full">{awayTeam.shortName}</span>
              <span className="text-[9.5px] font-mono text-amber-300">{awayTeam.wins}-{awayTeam.losses}</span>
            </div>
          </div>

          <div className="relative z-10 mt-3 pt-2 border-t border-white/10 flex items-center justify-center gap-2 text-[10.5px] text-slate-200">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{fixture.arena?.name || 'Arena Oficial'} · Pace: {analysis.expectedPace.toFixed(1)}</span>
          </div>
        </div>

        {/* Body NBA */}
        <div className="p-3.5 space-y-3 bg-[#0b0e14]">
          <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
                Choque de Eficiencia Ofensiva (ORTG)
              </span>
              <span className="text-[10px] font-mono font-bold text-[#8b949e] bg-[#0b0e14] px-2 py-0.5 rounded border border-[#30363d]">
                Total Proy: <strong className="text-white font-mono tabular-nums">{analysis.projectedTotalPoints.toFixed(1)}</strong> pts
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono font-bold">
              <span className="text-[#d9b114]">{homeOff.toFixed(1)} ORTG</span>
              <span className="text-slate-300">{awayOff.toFixed(1)} ORTG</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#0b0e14] overflow-hidden flex p-0.5 gap-0.5 border border-[#30363d]">
              <div className="h-full rounded-l-full bg-[#d9b114]" style={{ width: `${homeOffPct}%` }} />
              <div className="h-full rounded-r-full bg-slate-600" style={{ width: `${100 - homeOffPct}%` }} />
            </div>
          </div>

          {/* Proyección por Cuartos */}
          <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2">
            <span className="text-xs font-extrabold text-white block">
              Proyección de Marcador & Línea Justa
            </span>
            <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[9.5px] font-mono text-[#d9b114] uppercase block">{homeTeam.shortName}</span>
                <span className="font-mono text-sm font-black text-white">{analysis.projectedHomeScore.toFixed(0)}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[9.5px] font-mono text-[#8b949e] uppercase block">Spread Justo</span>
                <span className="font-mono text-sm font-black text-white">
                  {analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[9.5px] font-mono text-slate-300 uppercase block">{awayTeam.shortName}</span>
                <span className="font-mono text-sm font-black text-white">{analysis.projectedAwayScore.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Jugadores Estrella Props */}
          {starProps.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2">
              <span className="text-xs font-extrabold text-white block">
                Tactical Wire · Jugadores Clave (Proyección)
              </span>
              <div className="space-y-1.5">
                {starProps.map((p) => (
                  <div key={p.id} className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-white block">{p.name}</span>
                      <span className="text-[10px] text-[#8b949e]">{p.team} · {p.position}</span>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-[#d9b114] bg-[#161b22] px-2 py-0.5 rounded border border-[#30363d]">
                      +{p.pointsLine} Pts ({p.overPointsProb.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cápsula de Veredicto Rápido NBA */}
          <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#d9b114]/60 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-extrabold text-[#d9b114] bg-[#d9b114]/15 px-2 py-0.5 rounded border border-[#d9b114]/40">
                ⭐ Pick Estrella NBA
              </span>
              <span className="font-mono tabular-nums text-xs font-black text-white">
                {favProb.toFixed(1)}% · @{favOdd.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddNBAPick}
              className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                alreadyInSlip
                  ? 'bg-[#d9b114] text-slate-950 hover:bg-[#e6be20]'
                  : 'bg-[#0b0e14] hover:bg-[#1c2129] border border-[#d9b114]/60 text-white'
              }`}
            >
              {alreadyInSlip ? <Check className="w-4 h-4" strokeWidth={2} /> : <Plus className="w-4 h-4 text-[#d9b114]" strokeWidth={2} />}
              <span>{alreadyInSlip ? 'En tu Boleto Parlay' : `Añadir Victoria ${favName} al Boleto`}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenFullModal(payload)}
              className="w-full py-2 px-3 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] text-white font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              <span>Abrir Telemetría Completa y Props</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
