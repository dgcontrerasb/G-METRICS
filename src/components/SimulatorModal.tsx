import React, { useState, useMemo, useEffect } from 'react';
import { X, Sliders, RotateCcw, BookOpen } from 'lucide-react';
import { MatchFixture, TeamInfo } from '../types';
import { calculateMatchAnalysis } from '../services/mathEngine';
import { DixonColesMatrix } from './DixonColesMatrix';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFixture?: MatchFixture | null;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  initialFixture
}) => {
  // Custom adjustable parameters synced with active fixture
  const [homeName, setHomeName] = useState(initialFixture?.homeTeam.name || 'Real Madrid CF');
  const [awayName, setAwayName] = useState(initialFixture?.awayTeam.name || 'FC Barcelona');
  const [homeAttack, setHomeAttack] = useState(initialFixture?.homeTeam.attackStrength || 1.45);
  const [homeDefense, setHomeDefense] = useState(initialFixture?.homeTeam.defenseStrength || 0.80);
  const [awayAttack, setAwayAttack] = useState(initialFixture?.awayTeam.attackStrength || 1.40);
  const [awayDefense, setAwayDefense] = useState(initialFixture?.awayTeam.defenseStrength || 0.85);

  const [homeAdvantage, setHomeAdvantage] = useState(15); // %
  const [homeRest, setHomeRest] = useState(initialFixture?.homeTeam.restHours || 96);
  const [awayRest, setAwayRest] = useState(initialFixture?.awayTeam.restHours || 72);
  const [awayTravelKm, setAwayTravelKm] = useState(initialFixture?.travel.awayDistanceKm || 620);
  const [refereeRigor, setRefereeRigor] = useState<'Severo' | 'Moderado' | 'Flexible'>(
    initialFixture?.referee.rigor || 'Severo'
  );
  const [isDerby, setIsDerby] = useState(initialFixture?.derbyOrRivalry ?? true);

  // Sync state dynamically whenever initialFixture changes or modal opens
  useEffect(() => {
    if (initialFixture) {
      setHomeName(initialFixture.homeTeam.name);
      setAwayName(initialFixture.awayTeam.name);
      setHomeAttack(initialFixture.homeTeam.attackStrength || 1.35);
      setHomeDefense(initialFixture.homeTeam.defenseStrength || 0.90);
      setAwayAttack(initialFixture.awayTeam.attackStrength || 1.25);
      setAwayDefense(initialFixture.awayTeam.defenseStrength || 0.95);
      setHomeRest(initialFixture.homeTeam.restHours || 96);
      setAwayRest(initialFixture.awayTeam.restHours || 72);
      setAwayTravelKm(initialFixture.travel.awayDistanceKm || 500);
      setRefereeRigor(initialFixture.referee.rigor || 'Moderado');
      setIsDerby(Boolean(initialFixture.derbyOrRivalry));
    }
  }, [initialFixture, isOpen]);

  // Synthesize custom simulated fixture
  const simulatedFixture: MatchFixture = useMemo(() => {
    const homeTeam: TeamInfo = {
      id: 991,
      name: homeName,
      shortName: homeName.split(' ')[0],
      logo: 'https://media.api-sports.io/football/teams/541.png',
      rank: 1,
      points: 68,
      form: ['W', 'W', 'D', 'W', 'W'],
      attackStrength: homeAttack,
      defenseStrength: homeDefense,
      avgShotsPerMatch: 16.0,
      avgShotsOnTarget: 6.5,
      restHours: homeRest,
      starPlayer: {
        name: 'Goleador Estrella Local',
        position: 'Delantero',
        goalsSeason: 22,
        expectedShots: 4.0,
        expectedShotsOnTarget: 2.0,
        goalConversionRate: 0.30
      }
    };

    const awayTeam: TeamInfo = {
      id: 992,
      name: awayName,
      shortName: awayName.split(' ')[0],
      logo: 'https://media.api-sports.io/football/teams/529.png',
      rank: 2,
      points: 65,
      form: ['W', 'W', 'W', 'L', 'W'],
      attackStrength: awayAttack,
      defenseStrength: awayDefense,
      avgShotsPerMatch: 15.0,
      avgShotsOnTarget: 6.0,
      restHours: awayRest,
      starPlayer: {
        name: 'Goleador Estrella Visitante',
        position: 'Delantero',
        goalsSeason: 19,
        expectedShots: 3.8,
        expectedShotsOnTarget: 1.8,
        goalConversionRate: 0.28
      }
    };

    return {
      id: 'sim-1',
      date: '2026-10-04',
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 1,
        name: 'Laboratorio de Simulación Táctica',
        country: 'Pro',
        flag: '🔬',
        round: 'Simulación Táctica G METRICS',
        avgGoalsPerMatch: 2.75,
        avgCardsPerMatch: 4.8
      },
      homeTeam,
      awayTeam,
      referee: {
        name: refereeRigor === 'Severo' ? 'Árbitro Severo' : refereeRigor === 'Flexible' ? 'Árbitro Flexible' : 'Árbitro Moderado',
        nationality: 'Internacional',
        rigor: refereeRigor,
        avgYellowCards: refereeRigor === 'Severo' ? 5.8 : refereeRigor === 'Flexible' ? 3.5 : 4.4,
        avgRedCards: 0.28,
        foulsPerCard: 4.2
      },
      venue: {
        name: 'Estadio Virtual Lab',
        city: 'Simulación',
        capacity: 70000
      },
      travel: {
        awayDistanceKm: awayTravelKm,
        awayFlightHours: awayTravelKm / 500
      },
      derbyOrRivalry: isDerby
    };
  }, [
    homeName,
    awayName,
    homeAttack,
    homeDefense,
    awayAttack,
    awayDefense,
    homeRest,
    awayRest,
    awayTravelKm,
    refereeRigor,
    isDerby
  ]);

  const analysis = useMemo(() => {
    return calculateMatchAnalysis(simulatedFixture);
  }, [simulatedFixture]);

  const resetDefaults = () => {
    if (initialFixture) {
      setHomeName(initialFixture.homeTeam.name);
      setAwayName(initialFixture.awayTeam.name);
      setHomeAttack(initialFixture.homeTeam.attackStrength || 1.35);
      setHomeDefense(initialFixture.homeTeam.defenseStrength || 0.90);
      setAwayAttack(initialFixture.awayTeam.attackStrength || 1.25);
      setAwayDefense(initialFixture.awayTeam.defenseStrength || 0.95);
      setHomeRest(initialFixture.homeTeam.restHours || 96);
      setAwayRest(initialFixture.awayTeam.restHours || 72);
      setAwayTravelKm(initialFixture.travel.awayDistanceKm || 500);
      setRefereeRigor(initialFixture.referee.rigor || 'Moderado');
      setIsDerby(Boolean(initialFixture.derbyOrRivalry));
    } else {
      setHomeAttack(1.45);
      setHomeDefense(0.80);
      setAwayAttack(1.40);
      setAwayDefense(0.85);
      setHomeAdvantage(15);
      setHomeRest(96);
      setAwayRest(72);
      setAwayTravelKm(600);
      setRefereeRigor('Severo');
      setIsDerby(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.18)] overflow-hidden my-auto max-h-[90vh] flex flex-col text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Laboratorio Táctico &amp; Simulador G METRICS
              </h3>
              <p className="text-xs text-slate-500">
                Ajusta parámetros tácticos y observa el recálculo en tiempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {/* 1. Barra Compacta de Escenarios Rápidos */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1 mr-1">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                Escenarios Rápidos:
              </span>
              <button
                type="button"
                onClick={() => {
                  setAwayRest(48);
                  setAwayTravelKm(1200);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-mono font-semibold cursor-pointer transition-colors"
              >
                ⚡ Visita Cansada (48h + 1200km)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHomeAttack((prev) => Math.min(2.0, prev * 1.15));
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-semibold cursor-pointer transition-colors"
              >
                🔥 Impulso Local (+15% Ataque)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDerby(true);
                  setRefereeRigor('Severo');
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-mono font-semibold cursor-pointer transition-colors"
              >
                🟨 Clásico Picado (Derbi + Árbitro Severo)
              </button>
            </div>

            <button
              type="button"
              onClick={resetDefaults}
              className="text-[11px] font-mono text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200"
              title="Restablecer datos originales del partido"
            >
              <RotateCcw className="w-3 h-3 text-emerald-600" />
              <span>Restablecer Reales</span>
            </button>
          </div>

          {/* Team Names Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono font-bold text-emerald-700 block mb-1">Equipo Local</label>
              <input
                type="text"
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm text-slate-900 px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-bold text-indigo-700 block mb-1">Equipo Visitante</label>
              <input
                type="text"
                value={awayName}
                onChange={(e) => setAwayName(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm text-slate-900 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono bg-white p-4 rounded-xl border border-slate-200">
            {/* Home Attack */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Poder Ofensivo Local</span>
                <span className="text-emerald-700 font-bold">{homeAttack.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="2.0"
                step="0.05"
                value={homeAttack}
                onChange={(e) => setHomeAttack(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Home Defense */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Vulnerabilidad Def. Local</span>
                <span className="text-slate-900 font-bold">{homeDefense.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={homeDefense}
                onChange={(e) => setHomeDefense(parseFloat(e.target.value))}
                className="w-full accent-slate-600 cursor-pointer"
              />
            </div>

            {/* Home Advantage */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Ventaja de Localía</span>
                <span className="text-emerald-700 font-bold">+{homeAdvantage}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={homeAdvantage}
                onChange={(e) => setHomeAdvantage(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Away Attack */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Poder Ofensivo Visita</span>
                <span className="text-indigo-700 font-bold">{awayAttack.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="2.0"
                step="0.05"
                value={awayAttack}
                onChange={(e) => setAwayAttack(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Away Defense */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Vulnerabilidad Def. Visita</span>
                <span className="text-slate-900 font-bold">{awayDefense.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={awayDefense}
                onChange={(e) => setAwayDefense(parseFloat(e.target.value))}
                className="w-full accent-slate-600 cursor-pointer"
              />
            </div>

            {/* Away Rest Hours */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Descanso Visitante</span>
                <span className={awayRest < 72 ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                  {awayRest}h {awayRest < 72 && '(Fatiga)'}
                </span>
              </div>
              <input
                type="range"
                min="48"
                max="168"
                step="4"
                value={awayRest}
                onChange={(e) => setAwayRest(parseInt(e.target.value, 10))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Away Travel */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Traslado Visitante (km)</span>
                <span className="text-slate-900 font-bold">{awayTravelKm} km</span>
              </div>
              <input
                type="range"
                min="50"
                max="3000"
                step="50"
                value={awayTravelKm}
                onChange={(e) => setAwayTravelKm(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Referee Rigor */}
            <div>
              <span className="text-slate-600 block mb-1">Rigor del Árbitro</span>
              <div className="flex gap-1">
                {(['Flexible', 'Moderado', 'Severo'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRefereeRigor(r)}
                    className={`flex-1 py-1 text-center rounded border transition-colors cursor-pointer ${
                      refereeRigor === r
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Derby toggle */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-600">¿Tensión de Derbi?</span>
              <button
                type="button"
                onClick={() => setIsDerby(!isDerby)}
                className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
                  isDerby ? 'bg-amber-50 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isDerby ? 'SÍ (+25% fricción)' : 'NO (Estándar)'}
              </button>
            </div>
          </div>

          {/* Quick Result Preview Bar */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-700 font-bold">
                1 ({homeName}): {analysis.dixonColes.pHomeWin}% (@{analysis.dixonColes.fairOddsHome.toFixed(2)})
              </span>
              <span className="text-slate-600 font-bold">
                X: {analysis.dixonColes.pDraw}% (@{analysis.dixonColes.fairOddsDraw.toFixed(2)})
              </span>
              <span className="text-indigo-700 font-bold">
                2 ({awayName}): {analysis.dixonColes.pAwayWin}% (@{analysis.dixonColes.fairOddsAway.toFixed(2)})
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div style={{ width: `${analysis.dixonColes.pHomeWin}%` }} className="bg-emerald-500" />
              <div style={{ width: `${analysis.dixonColes.pDraw}%` }} className="bg-slate-400" />
              <div style={{ width: `${analysis.dixonColes.pAwayWin}%` }} className="bg-indigo-500" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-600 pt-1">
              <div>xG Local: <strong className="text-emerald-700">{analysis.dixonColes.lambdaHome.toFixed(2)}</strong></div>
              <div>xG Visita: <strong className="text-indigo-700">{analysis.dixonColes.lambdaAway.toFixed(2)}</strong></div>
              <div>BTTS Sí: <strong className="text-slate-900">{analysis.goalsMarket.bttsYes}%</strong></div>
              <div>Amarillas: <strong className="text-amber-700">{analysis.refereeCards.expectedYellowCards}</strong></div>
            </div>
          </div>

          {/* Score Matrix Component */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-500 font-bold mb-2">Matriz de Marcadores Recalculada:</h4>
            <DixonColesMatrix dixonColes={analysis.dixonColes} fixture={simulatedFixture} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer valores por defecto</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
          >
            Aplicar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
