import React, { useState } from 'react';
import { MatchFixture, MatchAnalysis, ParlayPick } from '../types';
import { useParlay } from '../context/ParlayContext';
import { resolveTeamStarPlayerName } from '../services/lineupService';
import {
  Ticket,
  Sparkles,
  ChevronDown,
  Info
} from 'lucide-react';

interface LiveMarketCapsulesProps {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
}

interface MarketCapsuleItem {
  id: string;
  marketKey: string;
  category: string;
  icon: string;
  badge: {
    label: string;
    className: string;
  };
  selectionTitle: string;
  probability: number;
  fairOdd: number;
  rationale: string;
  metrics: { label: string; value: string }[];
}

export const LiveMarketCapsules: React.FC<LiveMarketCapsulesProps> = ({
  fixture,
  analysis
}) => {
  const { isPickInParlay, togglePick } = useParlay();
  const { dixonColes, goalsMarket, cornersMarket, refereeCards, shotsAndPlayers, halfGoals } = analysis;

  // Estado del acordeón: solo una cápsula secundaria abierta a la vez
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const realCornersTotal = fixture.liveStats
    ? fixture.liveStats.home.corners + fixture.liveStats.away.corners
    : null;
  const realYellowsTotal = fixture.liveStats
    ? fixture.liveStats.home.yellowCards + fixture.liveStats.away.yellowCards
    : null;

  // 1. OPORTUNIDAD: CÓRNERS (Línea recomendada de mayor viabilidad)
  const cornersCapsule: MarketCapsuleItem = {
    id: `${fixture.id}_CORNERS`,
    marketKey: 'CORNERS_REC',
    category: 'Tiros de Esquina · Córners',
    icon: '🚩',
    badge: {
      label: realCornersTotal !== null ? `En Vivo: ${realCornersTotal} Córners` : 'Volumen Bandas',
      className: 'bg-sky-50 text-sky-800 border-sky-200'
    },
    selectionTitle: cornersMarket.recommendedLine,
    probability: cornersMarket.recommendedProb,
    fairOdd: Number(cornersMarket.recommendedOdd.toFixed(2)),
    rationale:
      realCornersTotal !== null && fixture.liveStats
        ? `Estadística oficial en curso: ${realCornersTotal} tiros de esquina (${fixture.liveStats.home.corners} ${fixture.homeTeam.shortName} - ${fixture.liveStats.away.corners} ${fixture.awayTeam.shortName}). Proyección total ajustada a ~${cornersMarket.expectedTotalCorners} córners.`
        : `Proyección algorítmica de ~${cornersMarket.expectedTotalCorners} córners en el partido (~${cornersMarket.lambdaHomeCorners} local · ~${cornersMarket.lambdaAwayCorners} visita) generados por transiciones y centros al área.`,
    metrics:
      realCornersTotal !== null && fixture.liveStats
        ? [
            { label: 'Actuales', value: `${realCornersTotal} (${fixture.liveStats.home.corners}-${fixture.liveStats.away.corners})` },
            { label: 'Local Proy.', value: `~${cornersMarket.lambdaHomeCorners}` },
            { label: 'Total Proy.', value: `~${cornersMarket.expectedTotalCorners}` }
          ]
        : [
            { label: 'Local Prom.', value: `~${cornersMarket.lambdaHomeCorners}` },
            { label: 'Visita Prom.', value: `~${cornersMarket.lambdaAwayCorners}` },
            { label: 'Total Proy.', value: `~${cornersMarket.expectedTotalCorners}` }
          ]
  };

  // 2. OPORTUNIDAD: DISCIPLINA Y TARJETAS (Criterio arbitral + fricción)
  const cardsCapsule: MarketCapsuleItem = {
    id: `${fixture.id}_CARDS`,
    marketKey: 'CARDS_REC',
    category: 'Disciplina & Tarjetas',
    icon: '🟨',
    badge: {
      label: realYellowsTotal !== null ? `En Vivo: ${realYellowsTotal} 🟨` : 'Criterio Arbitral',
      className: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    selectionTitle: refereeCards.recommendedCardPick,
    probability: refereeCards.recommendedCardProb,
    fairOdd: Number(refereeCards.recommendedCardOdd.toFixed(2)),
    rationale:
      realYellowsTotal !== null && fixture.liveStats
        ? `Tarjetas oficiales registradas: ${realYellowsTotal} amarillas (${fixture.liveStats.home.yellowCards} ${fixture.homeTeam.shortName} - ${fixture.liveStats.away.yellowCards} ${fixture.awayTeam.shortName}). Se proyectan ~${refereeCards.expectedYellowCards.toFixed(1)} amonestaciones al cierre.`
        : `Dirige ${fixture.referee.name} (Rigor: ${fixture.referee.rigor}, promedia ${fixture.referee.avgYellowCards} 🟨 y 1 tarjeta cada ${fixture.referee.foulsPerCard} faltas). Se proyectan ~${refereeCards.expectedYellowCards.toFixed(1)} amonestaciones.`,
    metrics:
      realYellowsTotal !== null && fixture.liveStats
        ? [
            { label: 'Actuales 🟨', value: `${realYellowsTotal} (${fixture.liveStats.home.yellowCards}-${fixture.liveStats.away.yellowCards})` },
            { label: 'Rigor', value: fixture.referee.rigor },
            { label: 'Total Proy.', value: `~${refereeCards.expectedYellowCards.toFixed(1)}` }
          ]
        : [
            { label: 'Árbitro', value: fixture.referee.name.split(' ').slice(0, 2).join(' ') },
            { label: 'Rigor', value: fixture.referee.rigor },
            { label: 'Amarillas Exp.', value: `~${refereeCards.expectedYellowCards.toFixed(1)}` }
          ]
  };

  // 3. OPORTUNIDAD: CANTIDAD DE GOLES (Línea con mayor probabilidad)
  const bestGoalPick = (() => {
    if (goalsMarket.over15 >= 70) {
      return {
        title: 'Más de 1.5 Goles Totales',
        prob: goalsMarket.over15,
        odd: Number((100 / Math.max(goalsMarket.over15, 1)).toFixed(2)),
        key: 'OVER_15',
        rationale: `Expectativa de ${dixonColes.totalXG.toFixed(2)} goles esperados (xG: ${dixonColes.lambdaHome.toFixed(2)} local vs ${dixonColes.lambdaAway.toFixed(2)} visita). El motor estadístico G METRICS otorga un ${goalsMarket.over15}% de probabilidad a un mínimo de 2 anotaciones.`
      };
    } else if (goalsMarket.under35 >= 75) {
      return {
        title: 'Menos de 3.5 Goles Totales',
        prob: goalsMarket.under35,
        odd: Number((100 / Math.max(goalsMarket.under35, 1)).toFixed(2)),
        key: 'UNDER_35',
        rationale: `Encuentro con alto control táctico y bloque defensivo cerrado. El xG combinado está contenido en ${dixonColes.totalXG.toFixed(2)} goles.`
      };
    } else {
      const bttsIsBest = goalsMarket.bttsYes >= 55;
      return {
        title: bttsIsBest ? 'Ambos Equipos Anotan (Sí)' : 'Más de 1.5 Goles Totales',
        prob: bttsIsBest ? goalsMarket.bttsYes : goalsMarket.over15,
        odd: Number((100 / Math.max(bttsIsBest ? goalsMarket.bttsYes : goalsMarket.over15, 1)).toFixed(2)),
        key: bttsIsBest ? 'BTTS_YES' : 'OVER_15',
        rationale: bttsIsBest
          ? `Ambas ofensivas superan el umbral de 1.10 xG por partido con transiciones rápidas y desajustes defensivos en zaga rival.`
          : `Tendencia de ritmo ofensivo dinámico con ${goalsMarket.over15}% de probabilidad para la línea básica de gol.`
      };
    }
  })();

  const goalsCapsule: MarketCapsuleItem = {
    id: `${fixture.id}_${bestGoalPick.key}`,
    marketKey: bestGoalPick.key,
    category: 'Cantidad de Goles',
    icon: '⚽',
    badge: {
      label: 'Eficiencia xG',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    },
    selectionTitle: bestGoalPick.title,
    probability: bestGoalPick.prob,
    fairOdd: bestGoalPick.odd,
    rationale: bestGoalPick.rationale,
    metrics: [
      { label: 'xG Local', value: `${dixonColes.lambdaHome.toFixed(2)}` },
      { label: 'xG Visita', value: `${dixonColes.lambdaAway.toFixed(2)}` },
      { label: 'xG Total', value: `${dixonColes.totalXG.toFixed(2)}` }
    ]
  };

  // 4. OPORTUNIDAD: GOLES POR MITADES (1er Tiempo vs 2do Tiempo)
  const halfGoalPick = (() => {
    if (goalsMarket.firstHalfGoalProb >= 66) {
      return {
        title: 'Gol en 1er Tiempo (Más de 0.5 1T)',
        prob: goalsMarket.firstHalfGoalProb,
        odd: Number((100 / Math.max(goalsMarket.firstHalfGoalProb, 1)).toFixed(2)),
        key: 'FH_OVER_05',
        rationale: `Intensidad temprana proyectada: ${goalsMarket.firstHalfGoalProb}% de probabilidad de que se abra el marcador antes del descanso (~${halfGoals.expected1stHalfGoals.toFixed(2)} goles xG en la primera mitad).`
      };
    } else {
      return {
        title: 'Mitad con Más Goles: 2do Tiempo',
        prob: halfGoals.secondHalfPercent,
        odd: Number((100 / Math.max(halfGoals.secondHalfPercent, 1)).toFixed(2)),
        key: 'SECOND_HALF_MOST',
        rationale: `El ${halfGoals.secondHalfPercent}% del volumen de goles se concentra en la segunda mitad (~${halfGoals.expected2ndHalfGoals.toFixed(2)} xG) por desgaste físico y ajustes de los entrenadores.`
      };
    }
  })();

  const halfCapsule: MarketCapsuleItem = {
    id: `${fixture.id}_${halfGoalPick.key}`,
    marketKey: halfGoalPick.key,
    category: 'Goles por Mitades',
    icon: '⏱️',
    badge: {
      label: 'Distribución 1T/2T',
      className: 'bg-purple-50 text-purple-800 border-purple-200'
    },
    selectionTitle: halfGoalPick.title,
    probability: halfGoalPick.prob,
    fairOdd: halfGoalPick.odd,
    rationale: halfGoalPick.rationale,
    metrics: [
      { label: 'xG 1T', value: `~${halfGoals.expected1stHalfGoals.toFixed(2)}` },
      { label: 'xG 2T', value: `~${halfGoals.expected2ndHalfGoals.toFixed(2)}` },
      { label: 'Peso 2T', value: `${halfGoals.secondHalfPercent}%` }
    ]
  };

  // 5. OPORTUNIDAD: DISPAROS AL ARCO & REMATADORES
  const shotsCapsule: MarketCapsuleItem = (() => {
    const isHomeStar =
      shotsAndPlayers.homeStar.expectedShotsOnTarget >= shotsAndPlayers.awayStar.expectedShotsOnTarget;
    const starCandidate = isHomeStar
      ? {
          star: shotsAndPlayers.homeStar,
          team: fixture.homeTeam.name,
          rosterStarters: fixture.liveRosters?.homeStarters
        }
      : {
          star: shotsAndPlayers.awayStar,
          team: fixture.awayTeam.name,
          rosterStarters: fixture.liveRosters?.awayStarters
        };

    const totalTargetShots = shotsAndPlayers.homeShotsOnTarget + shotsAndPlayers.awayShotsOnTarget;

    if (starCandidate.star.expectedShotsOnTarget >= 0.9) {
      const safeStarName = resolveTeamStarPlayerName(
        starCandidate.team,
        starCandidate.star.name,
        starCandidate.rosterStarters
      );
      const estimatedProb = Math.min(92, Math.max(68, Math.round(starCandidate.star.expectedShotsOnTarget * 45 + 32)));
      const estimatedOdd = Number((100 / estimatedProb).toFixed(2));
      return {
        id: `${fixture.id}_SHOTS_STAR`,
        marketKey: 'SHOTS_STAR',
        category: 'Disparos al Arco',
        icon: '🎯',
        badge: {
          label: 'Rematador Estrella',
          className: 'bg-sky-50 text-sky-800 border-sky-200'
        },
        selectionTitle: `${safeStarName} (+0.5 Remates a Puerta)`,
        probability: estimatedProb,
        fairOdd: estimatedOdd,
        rationale: `${safeStarName} (${starCandidate.star.position}, ${starCandidate.team}) promedia ~${starCandidate.star.expectedShots.toFixed(1)} disparos por partido con ~${starCandidate.star.expectedShotsOnTarget.toFixed(1)} remates dirigidos entre los tres palos.`,
        metrics: [
          { label: 'Jugador', value: safeStarName.split(' ').pop() || safeStarName },
          { label: 'Tiros Puerta', value: `~${starCandidate.star.expectedShotsOnTarget.toFixed(1)}` },
          { label: 'Prob. Gol', value: `${starCandidate.star.anytimeGoalProb}%` }
        ]
      };
    } else {
      const targetLine = totalTargetShots >= 9 ? 'Más de 8.5 Disparos al Arco' : 'Más de 7.5 Disparos al Arco';
      const lineProb = totalTargetShots >= 9 ? 76 : 82;
      return {
        id: `${fixture.id}_SHOTS_TOTAL`,
        marketKey: 'SHOTS_TOTAL',
        category: 'Disparos al Arco',
        icon: '🎯',
        badge: {
          label: 'Volumen Total',
          className: 'bg-sky-50 text-sky-800 border-sky-200'
        },
        selectionTitle: `${targetLine} (Totales)`,
        probability: lineProb,
        fairOdd: Number((100 / lineProb).toFixed(2)),
        rationale: `Proyección acumulada de ${totalTargetShots} remates directos a portería entre ambos clubes (${shotsAndPlayers.homeShotsOnTarget} ${fixture.homeTeam.shortName} y ${shotsAndPlayers.awayShotsOnTarget} ${fixture.awayTeam.shortName}).`,
        metrics: [
          { label: 'Local Remates', value: `${shotsAndPlayers.homeShotsOnTarget}` },
          { label: 'Visita Remates', value: `${shotsAndPlayers.awayShotsOnTarget}` },
          { label: 'Total Puerta', value: `${totalTargetShots}` }
        ]
      };
    }
  })();

  // 6. OPORTUNIDAD: DOBLE OPORTUNIDAD (Seguridad de Resultado 1X o X2)
  const doubleChanceCapsule: MarketCapsuleItem = (() => {
    const is1X = goalsMarket.doubleChance1X >= goalsMarket.doubleChanceX2;
    const bestProb = Math.max(goalsMarket.doubleChance1X, goalsMarket.doubleChanceX2);
    const bestOdd = Number((100 / Math.max(bestProb, 1)).toFixed(2));
    const title = is1X
      ? `Doble Oportunidad: Gana ${fixture.homeTeam.name} o Empate (1X)`
      : `Doble Oportunidad: Empate o Gana ${fixture.awayTeam.name} (X2)`;

    return {
      id: `${fixture.id}_DC`,
      marketKey: 'DOUBLE_CHANCE',
      category: 'Resultado · Doble Oportunidad',
      icon: '🛡️',
      badge: {
        label: 'Margen Cobertura',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      },
      selectionTitle: title,
      probability: bestProb,
      fairOdd: bestOdd,
      rationale: `Cobertura del ${bestProb}% de los resultados posibles respaldada por la solidez táctica de ${is1X ? fixture.homeTeam.name : fixture.awayTeam.name} y su menor índice de derrotas.`,
      metrics: [
        { label: '1X Prob.', value: `${goalsMarket.doubleChance1X}%` },
        { label: 'X2 Prob.', value: `${goalsMarket.doubleChanceX2}%` },
        { label: '12 Prob.', value: `${goalsMarket.doubleChance12}%` }
      ]
    };
  })();

  // 0. CÁPSULA #1 FIJA: PREDICCIÓN ESTRELLA UNIFICADA (Idéntica a la que se exhibe en la cartelera)
  const topPick = analysis.verdict?.topSafePick;

  const leadMarketKey =
    topPick?.id === 'btts_pick'
      ? 'BTTS_YES'
      : topPick?.category === 'CORNERS'
      ? 'CORNERS_REC'
      : topPick?.category === 'CARDS'
      ? 'CARDS_REC'
      : topPick?.category === 'DOUBLE_CHANCE'
      ? 'DOUBLE_CHANCE'
      : topPick?.category === 'HALF_GOALS'
      ? 'FH_OVER_05'
      : topPick?.category === 'SHOTS'
      ? 'SHOTS_STAR'
      : topPick?.label.includes('1.5')
      ? 'OVER_15'
      : 'UNDER_35';

  const leadCapsule: MarketCapsuleItem = topPick
    ? {
        id: `${fixture.id}_LEAD_${topPick.id}`,
        marketKey: leadMarketKey,
        category: topPick.categoryLabel,
        icon:
          topPick.category === 'BTTS'
            ? '🥅'
            : topPick.category === 'CORNERS'
            ? '🚩'
            : topPick.category === 'CARDS'
            ? '🟨'
            : topPick.category === 'DOUBLE_CHANCE'
            ? '🛡️'
            : topPick.category === 'HALF_GOALS'
            ? '⏱️'
            : topPick.category === 'SHOTS'
            ? '🎯'
            : '⚽',
        badge: {
          label: '⭐ Más Probable',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        },
        selectionTitle: topPick.label,
        probability: topPick.probability,
        fairOdd: Number(topPick.fairOdd.toFixed(2)),
        rationale: topPick.whySaferThanWinner,
        metrics:
          topPick.category === 'BTTS' || topPick.category === 'SAFE_GOALS'
            ? [
                { label: 'xG Local', value: `${dixonColes.lambdaHome.toFixed(2)}` },
                { label: 'xG Visita', value: `${dixonColes.lambdaAway.toFixed(2)}` },
                { label: 'xG Total', value: `${dixonColes.totalXG.toFixed(2)}` }
              ]
            : topPick.category === 'CORNERS'
            ? [
                { label: 'Local Prom.', value: `~${cornersMarket.lambdaHomeCorners}` },
                { label: 'Visita Prom.', value: `~${cornersMarket.lambdaAwayCorners}` },
                { label: 'Total Proy.', value: `~${cornersMarket.expectedTotalCorners}` }
              ]
            : topPick.category === 'CARDS'
            ? [
                { label: 'Árbitro', value: fixture.referee.name.split(' ').slice(0, 2).join(' ') },
                { label: 'Rigor', value: fixture.referee.rigor },
                { label: 'Amarillas Exp.', value: `~${refereeCards.expectedYellowCards.toFixed(1)}` }
              ]
            : [
                { label: '1X Prob.', value: `${goalsMarket.doubleChance1X}%` },
                { label: 'X2 Prob.', value: `${goalsMarket.doubleChanceX2}%` },
                { label: 'xG Total', value: `${dixonColes.totalXG.toFixed(2)}` }
              ]
      }
    : goalsCapsule;

  // Filtramos las demás opciones para no repetir el mercado ya exhibido en la cápsula #1 fija
  const secondaryCapsules = [
    goalsCapsule,
    cornersCapsule,
    cardsCapsule,
    halfCapsule,
    shotsCapsule,
    doubleChanceCapsule
  ]
    .filter((c) => {
      if (topPick?.category === 'BTTS' && c.marketKey.includes('BTTS')) return false;
      if (topPick?.category === 'SAFE_GOALS' && (c.marketKey === 'OVER_15' || c.marketKey === 'UNDER_35')) return false;
      if (topPick?.category === 'CORNERS' && c.marketKey === 'CORNERS_REC') return false;
      if (topPick?.category === 'CARDS' && c.marketKey === 'CARDS_REC') return false;
      if (topPick?.category === 'DOUBLE_CHANCE' && c.marketKey === 'DOUBLE_CHANCE') return false;
      if (topPick?.category === 'HALF_GOALS' && (c.marketKey === 'FH_OVER_05' || c.marketKey === 'SECOND_HALF_MOST')) return false;
      if (topPick?.category === 'SHOTS' && c.marketKey.includes('SHOTS')) return false;
      return true;
    })
    .sort((a, b) => b.probability - a.probability);

  // La lista final: la posición 0 siempre es idéntica a la cartelera; las demás van en acordeón
  const sortedCapsules: MarketCapsuleItem[] = [leadCapsule, ...secondaryCapsules];

  const handleToggle = (item: MarketCapsuleItem) => {
    const pickPayload: ParlayPick = {
      id: `${fixture.id}_${item.marketKey}`,
      fixtureId: fixture.id,
      sport: 'SOCCER',
      matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
      homeTeamName: fixture.homeTeam.name,
      awayTeamName: fixture.awayTeam.name,
      matchDate: fixture.date,
      matchTime: fixture.time,
      marketKey: item.marketKey,
      selectionLabel: item.selectionTitle,
      referenceOdd: item.fairOdd,
      userOdd: item.fairOdd,
      probability: item.probability,
      isEV: item.probability >= 70 || Boolean(analysis.marketOdds?.valueBetDetected)
    };
    togglePick(pickPayload);
  };

  const handleAccordionToggle = (idx: number) => {
    // Si ya está abierta, se cierra; si no, se abre y cierra automáticamente cualquier otra
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Banner Informativo sobre Cuotas de Referencia (Claro y legible) */}
      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex items-start gap-2.5 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-sans font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
            <span>Oportunidades de Alta Probabilidad (+EV)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
              6 Mercados
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
            <span className="text-amber-800 font-semibold">Nota de cuotas:</span> Promedio referencial internacional. Puedes ajustar la cuota exacta de tu casa en el boleto de combinadas.
          </p>
        </div>
      </div>

      {/* Lista de Cápsulas */}
      <div className="space-y-2.5">
        {sortedCapsules.map((item, idx) => {
          const inParlay = isPickInParlay(fixture.id, item.marketKey);
          const isFirst = idx === 0;
          const isExpanded = isFirst || expandedIndex === idx;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all p-3 sm:p-3.5 space-y-2.5 ${
                isFirst
                  ? 'bg-gradient-to-b from-emerald-50/60 to-white border-emerald-300 shadow-xs'
                  : inParlay
                  ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/60 shadow-xs'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {/* Header de la Cápsula: Categoría + Badge único */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base shrink-0 leading-none">{item.icon}</span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 truncate">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isFirst && item.badge.label !== '⭐ Más Probable' && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ⭐ Más Probable
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${item.badge.className}`}>
                    {item.badge.label}
                  </span>
                </div>
              </div>

              {/* Título de la Selección */}
              <div className="text-xs sm:text-sm font-sans font-bold text-slate-900 leading-snug">
                {item.selectionTitle}
              </div>

              {/* Fila Protegida: Probabilidad y Cuota a la izquierda, Botón Boleto a la derecha */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 block uppercase leading-none mb-0.5">
                      Probabilidad
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {item.probability}%
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-200 shrink-0" />

                  <div>
                    <span className="text-[9px] font-mono text-slate-500 block uppercase leading-none mb-0.5">
                      Cuota Prom.
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-amber-700 whitespace-nowrap">
                      @{item.fairOdd.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className={`py-2 px-3 rounded-xl font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 min-h-[36px] ${
                    inParlay
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95'
                  }`}
                  title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir esta selección al boleto'}
                  aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
                >
                  <Ticket className="w-3.5 h-3.5 text-white" />
                  <span className="whitespace-nowrap font-mono text-[11px]">
                    {inParlay ? 'En Boleto ✓' : '+ Boleto'}
                  </span>
                </button>
              </div>

              {/* Botón Desplegable para las estadísticas secundarias (idx > 0) */}
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => handleAccordionToggle(idx)}
                  className="w-full flex items-center justify-between py-1 px-1.5 rounded-lg text-[11px] font-mono text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isExpanded ? 'Ocultar Análisis Pro' : 'Ver Análisis Pro y Estadísticas'}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                </button>
              )}

              {/* Contenido Desplegable */}
              {isExpanded && (
                <div className="space-y-2 pt-1.5 border-t border-slate-100 animate-fade-in">
                  <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed">
                    <span className="text-emerald-700 font-bold font-mono mr-1">Análisis Pro:</span>
                    {item.rationale}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {item.metrics.map((metric, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center"
                      >
                        <div className="text-[9px] font-mono text-slate-500 uppercase truncate">
                          {metric.label}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-900 mt-0.5 truncate">
                          {metric.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
