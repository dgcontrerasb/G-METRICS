import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  HelpCircle,
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  Search,
  Scale,
  Calculator,
  BookMarked,
  ShieldCheck,
  Lock,
  TrendingUp
} from 'lucide-react';
import { HistoricalAuditView } from './HistoricalAuditView';
import { getHistoricalAuditSummary } from '../services/historicalAuditService';

export type GuideModalTab = 'GUIDE' | 'GLOSSARY' | 'LEGAL' | 'AUDIT';

interface DidacticGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GuideModalTab;
}

interface GlossaryEntry {
  term: string;
  shortCode: string;
  category: 'MATH' | 'SOCCER' | 'NBA';
  categoryLabel: string;
  definition: string;
  example: string;
}

const GLOSSARY_ITEMS: GlossaryEntry[] = [
  {
    term: 'Valor Esperado Positivo',
    shortCode: '+EV',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Indica que la cuota ofrecida por una casa de apuestas paga más de lo que debería según la probabilidad real calculada por el modelo matemático.',
    example:
      'Si el modelo calcula 60% de probabilidad real (cuota justa @1.67) y el mercado paga @1.90, existe una ventaja matemática (+EV) a favor del usuario.'
  },
  {
    term: 'Cuota Justa (Fair Odd)',
    shortCode: 'Fair Odd',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Es la cuota mínima exacta que debería pagarse por un evento según su probabilidad pura, sin descontar la comisión (margen) de la casa de apuestas.',
    example:
      'Un evento con 50% de probabilidad real tiene una Cuota Justa de @2.00 (100 / 50 = 2.00).'
  },
  {
    term: 'Gestión de Banca Sugerida (Stake %)',
    shortCode: 'Stake %',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Métrica de control de riesgo que sugiere qué porcentaje prudente de tu banca (Bankroll) asignar a una selección según el tamaño de la ventaja (+EV).',
    example:
      'Si el sistema sugiere 2.5% y tu presupuesto total recreativo es de $100.000, el monto sugerido de exposición es $2.500.'
  },
  {
    term: 'Stake (Monto o Nivel de Confianza)',
    shortCode: 'Stake',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Cantidad de dinero o proporción de tu presupuesto que decides asignar a una jugada específica. Nunca debe comprometer dinero necesario para gastos personales.',
    example:
      'Un Stake conservador suele ubicarse entre el 1% y el 3% del presupuesto recreativo disponible.'
  },
  {
    term: 'Probabilidad Conjunta (Parlay / Combinada)',
    shortCode: 'Parlay',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'En un boleto de varias selecciones, las cuotas se multiplican entre sí, pero las probabilidades individuales también se multiplican, reduciendo la probabilidad total de acierto.',
    example:
      'Combinar 2 selecciones de 70% de probabilidad cada una arroja una probabilidad conjunta del 49% (0.70 × 0.70).'
  },
  {
    term: 'Margen de Casa (Vigorish / Overround)',
    shortCode: 'Vig / Margen',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Comisión implícita incluida en las cuotas del mercado. Nuestro motor aplica desvigado proporcional para comparar probabilidades limpias.',
    example:
      'En un duelo parejo 50/50, el mercado suele ofrecer @1.90 / @1.90 en lugar de @2.00 / @2.00.'
  },
  {
    term: 'Goles Esperados (Expected Goals)',
    shortCode: 'xG',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Métrica estadística que estima cuántos goles debería anotar un equipo según su potencia ofensiva, debilidad defensiva del rival, localía y contexto histórico.',
    example:
      'Un xG de 1.85 para el local frente a 0.75 del visitante proyecta un dominio claro de ocasiones de gol para el equipo de casa.'
  },
  {
    term: 'Ambos Equipos Marcan (Both Teams To Score)',
    shortCode: 'BTTS / AEM',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Mercado en el que se evalúa si tanto el equipo local como el visitante lograrán anotar al menos 1 gol cada uno durante los 90 minutos reglamentarios.',
    example:
      'Un resultado 1-1, 2-1 o 2-2 cumple "Ambos Marcan: Sí". Un 2-0 o 0-0 cumple "Ambos Marcan: No".'
  },
  {
    term: 'Más / Menos Goles o Puntos (Over / Under)',
    shortCode: 'O/U +2.5 · -2.5',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Línea total de goles, córners, tarjetas o puntos sumando a ambos equipos. Se usa el decimal .5 para eliminar la posibilidad de empate en la línea.',
    example:
      '"Más de 2.5 goles" se acierta si el partido tiene 3 o más goles en total (ej. 2-1, 3-0). "Menos de 2.5" se acierta con 0, 1 o 2 goles.'
  },
  {
    term: 'Resultado Final 1X2 (Tiempo Reglamentario)',
    shortCode: '1 · X · 2',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Nomenclatura universal para los tres desenlaces posibles de un partido de fútbol en 90 minutos: "1" Gana Local, "X" Empate, "2" Gana Visitante.',
    example:
      'Si seleccionas "1", respaldas la victoria del equipo que juega en su estadio durante el tiempo reglamentario.'
  },
  {
    term: 'Doble Oportunidad (Cobertura de 2 de 3 resultados)',
    shortCode: '1X · X2 · 12',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Mercado conservador que cubre dos resultados al mismo tiempo: "1X" (Gana Local o Empate), "X2" (Gana Visitante o Empate) y "12" (Gana cualquiera de los dos, sin empate).',
    example:
      'Con "1X", aciertas tanto si el equipo local gana 2-0 como si el partido termina empatado 1-1.'
  },
  {
    term: 'Matriz de Marcadores Exactos G METRICS',
    shortCode: 'Matriz Goles',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Algoritmo probabilístico especializado en fútbol que construye una matriz exacta de marcadores (0-0 hasta 5-5) calibrando la correlación estadística en encuentros cerrados.',
    example:
      'Permite identificar qué marcadores exactos y líneas de goles concentran la mayor densidad probabilística.'
  },
  {
    term: 'Ritmo de Posesiones (Pace NBA)',
    shortCode: 'Pace',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      'Número estimado de posesiones ofensivas que tendrá cada equipo durante los 48 minutos de un partido de baloncesto.',
    example:
      'Un Pace alto (ej. 102+ posesiones) proyecta transiciones rápidas, más tiros de campo y marcadores totales elevados.'
  },
  {
    term: 'Eficiencia Ofensiva y Defensiva',
    shortCode: 'ORTG / DRTG',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      'ORTG (Offensive Rating) mide cuántos puntos anota un equipo por cada 100 posesiones; DRTG (Defensive Rating) mide cuántos puntos permite por cada 100 posesiones.',
    example:
      'Un equipo con ORTG de 118.5 y DRTG de 109.0 posee un diferencial neto altamente dominante (+9.5).'
  },
  {
    term: 'Hándicap o Línea de Ventaja (Spread)',
    shortCode: 'Spread',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      'Ventaja (+) o desventaja (-) de puntos aplicada a un equipo para equilibrar un duelo desigual.',
    example:
      'Si un favorito tiene Spread -5.5, debe ganar por 6 o más puntos de diferencia para cubrir la línea. Si un equipo tiene +5.5, cubre si gana o si pierde hasta por 5 puntos.'
  },
  {
    term: 'Triples Anotados (3-Point Field Goals Made)',
    shortCode: '3PM',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      'Cantidad de canastas encestadas desde detrás del arco de tres puntos, tanto a nivel colectivo de equipo como individual por jugador.',
    example:
      '"Más de 3.5 Triples (3PM)" para un tirador significa que debe encestar al menos 4 triples en el juego.'
  },
  {
    term: 'Proyecciones Individuales de Jugador',
    shortCode: 'Player Props',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      'Estimaciones estadísticas individuales sobre el rendimiento de una estrella en Puntos (PTS), Rebotes (REB), Asistencias (AST) o Triples (3PM).',
    example:
      'Proyección de 27.4 PTS y 3.8 triples (3PM) basada en minutos esperados y ritmo del partido.'
  },
  {
    term: 'Proyección por Cuartos y Desgaste Back-to-Back',
    shortCode: '1Q–4Q · B2B',
    category: 'NBA',
    categoryLabel: '🏀 NBA',
    definition:
      '1Q, 2Q, 3Q y 4Q representan cada periodo de 12 minutos en la NBA. "B2B" (Back-to-Back) indica que un equipo jugó la noche anterior sin descanso, lo que suele reducir su eficiencia en la segunda mitad.',
    example:
      'El mercado de "1Q (Primer Cuarto)" permite evaluar el arranque de los quintetos titulares reduciendo el impacto de rotaciones tardías.'
  }
];

export const DidacticGuideModal: React.FC<DidacticGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'GUIDE'
}) => {
  const [activeTab, setActiveTab] = useState<GuideModalTab>(initialTab);
  const auditSummary = useMemo(() => getHistoricalAuditSummary(), []);
  const [calcStake, setCalcStake] = useState<number>(10);
  const [calcOdd, setCalcOdd] = useState<number>(1.85);

  // Glossary Search & Filter States
  const [glossarySearch, setGlossarySearch] = useState<string>('');
  const [glossaryCategory, setGlossaryCategory] = useState<'ALL' | 'MATH' | 'SOCCER' | 'NBA'>('ALL');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const filteredGlossary = useMemo(() => {
    const q = glossarySearch.trim().toLowerCase();
    return GLOSSARY_ITEMS.filter((item) => {
      if (glossaryCategory !== 'ALL' && item.category !== glossaryCategory) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.shortCode.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q)
      );
    });
  }, [glossarySearch, glossaryCategory]);

  if (!isOpen) return null;

  const totalReturn = (calcStake * (calcOdd || 1)).toFixed(2);
  const netProfit = (calcStake * Math.max(0, (calcOdd || 1) - 1)).toFixed(2);
  const returnPercentage = (((calcOdd || 1) - 1) * 100).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4">
      {/* Backdrop Blur independiente (fondo visible y difuminado cristalino) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-[#161b22] border border-[#30363d] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#30363d] bg-[#0b0e14] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xs flex items-center justify-center shrink-0">
              {activeTab === 'AUDIT' ? (
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              ) : activeTab === 'LEGAL' ? (
                <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              ) : activeTab === 'GLOSSARY' ? (
                <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              ) : (
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5 flex-wrap">
                <span>
                  {activeTab === 'AUDIT'
                    ? 'Auditoría Histórica de Certeza'
                    : activeTab === 'GLOSSARY'
                    ? 'Glosario Técnico A-Z'
                    : activeTab === 'LEGAL'
                    ? 'Marco Legal y Habeas Data'
                    : 'Centro Didáctico y Guía Rápida'}
                </span>
                <span className="bento-pill-emerald text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                  +18
                </span>
              </h2>
              <p className="text-[11px] text-[#8b949e] truncate">
                {activeTab === 'AUDIT'
                  ? 'Registro semanal verificado de aciertos, cuotas y modelos predictivos.'
                  : activeTab === 'GLOSSARY'
                  ? 'Diccionario completo de términos matemáticos, fútbol y NBA.'
                  : activeTab === 'LEGAL'
                  ? 'Cumplimiento normativo para mayores de edad y protección de datos.'
                  : 'Guía práctica para comprender cuotas, valor (+EV) y gestión de banca.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] flex items-center justify-center text-[#8b949e] hover:text-white transition-colors cursor-pointer shrink-0"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs: Segmented Bento Pill Dock */}
        <div className="px-3 sm:px-5 py-2 bg-[#0b0e14] border-b border-[#30363d]">
          <div className="p-1 rounded-2xl bg-[#161b22] border border-[#30363d] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('AUDIT')}
              className={`py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                activeTab === 'AUDIT'
                  ? 'bg-[#0b0e14] text-white border border-emerald-500/70 shadow-xs font-bold'
                  : 'bg-transparent text-[#8b949e] border border-transparent hover:text-white hover:bg-[#1c2129]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Auditoría</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-[#00ff66] font-mono font-bold shrink-0">
                {auditSummary.globalAccuracy}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('GUIDE')}
              className={`py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                activeTab === 'GUIDE'
                  ? 'bg-[#0b0e14] text-white border border-[#d9b114]/60 shadow-xs font-bold'
                  : 'bg-transparent text-[#8b949e] border border-transparent hover:text-white hover:bg-[#1c2129]'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Guía Rápida</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('GLOSSARY')}
              className={`py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                activeTab === 'GLOSSARY'
                  ? 'bg-[#0b0e14] text-white border border-[#d9b114]/60 shadow-xs font-bold'
                  : 'bg-transparent text-[#8b949e] border border-transparent hover:text-white hover:bg-[#1c2129]'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Glosario</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 font-mono shrink-0">
                {GLOSSARY_ITEMS.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('LEGAL')}
              className={`py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-w-0 ${
                activeTab === 'LEGAL'
                  ? 'bg-[#0b0e14] text-white border border-[#d9b114]/60 shadow-xs font-bold'
                  : 'bg-transparent text-[#8b949e] border border-transparent hover:text-white hover:bg-[#1c2129]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Aviso Legal</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs sm:text-sm bg-[#0b0e14]/70">
          {/* =========================================================
              TAB 0: AUDITORÍA HISTÓRICA DE EFICIENCIA CUANTITATIVA
             ========================================================= */}
          {activeTab === 'AUDIT' && <HistoricalAuditView />}

          {/* =========================================================
              TAB 1: GUÍA RÁPIDA PARA PRINCIPIANTES
             ========================================================= */}
          {activeTab === 'GUIDE' && (
            <>
              {/* 1. CALCULADORA INTERACTIVA DE CUOTAS */}
              <section className="bg-[#161b22] border border-[#30363d] p-3.5 sm:p-4 rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center gap-1.5 text-[#00ff66] font-bold">
                  <DollarSign className="w-4 h-4 shrink-0 text-[#00ff66]" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    1. Simulador Rápido de Cuota y Retorno
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#8b949e] leading-relaxed">
                  Una cuota (ej.{' '}
                  <code className="bg-[#0b0e14] border border-[#d9b114]/60 text-[#d9b114] font-mono px-1.5 py-0.2 rounded font-semibold">
                    @1.85
                  </code>
                  ) multiplica el monto asignado según la probabilidad estimada:
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#8b949e] block mb-1 font-medium">
                      Monto simulado (Stake):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] font-bold">$</span>
                      <input
                        type="number"
                        min="1"
                        value={calcStake}
                        onChange={(e) => setCalcStake(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl py-1.5 pl-7 pr-2.5 text-white font-mono text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#d9b114]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#8b949e] block mb-1 font-medium">Cuota decimal:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d9b114] font-bold">@</span>
                      <input
                        type="number"
                        step="0.05"
                        min="1.01"
                        value={calcOdd}
                        onChange={(e) => setCalcOdd(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
                        className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl py-1.5 pl-7 pr-2.5 text-[#d9b114] font-mono text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#d9b114]"
                      />
                    </div>
                  </div>
                </div>

                {/* Resultado Financiero */}
                <div className="bg-[#0b0e14] border border-[#30363d] p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-[#8b949e] uppercase font-bold tracking-wider block">
                      Retorno Total:
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#00ff66]">${totalReturn}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#8b949e] uppercase font-bold tracking-wider block">
                      Ganancia Neta:
                    </span>
                    <span className="text-sm sm:text-base font-black font-mono tabular-nums text-white">
                      +${netProfit} <span className="text-[#00ff66] text-xs">({returnPercentage}%)</span>
                    </span>
                  </div>
                </div>
              </section>

              {/* 2. EL SISTEMA DE SEMÁFOROS DIDÁCTICOS */}
              <section className="space-y-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 px-0.5">
                  <Sparkles className="w-4 h-4 text-[#d9b114] shrink-0" />
                  <span>2. Semáforo Estadístico de Confianza</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Verde */}
                  <div className="bg-[#161b22] p-3.5 rounded-2xl border border-emerald-500/40 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-[#00ff66] font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      <span>🟢 Favorable (+EV)</span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] leading-snug">
                      Probabilidad sólida (&ge;68%) o ventaja matemática positiva frente al mercado.
                    </p>
                  </div>

                  {/* Amarillo */}
                  <div className="bg-[#161b22] p-3.5 rounded-2xl border border-[#d9b114]/40 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-[#d9b114] font-bold text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#d9b114] shrink-0" />
                      <span>🟡 Parejo / Moderado</span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] leading-snug">
                      Margen ajustado. Se sugiere revisar mercados de goles, puntos o doble oportunidad.
                    </p>
                  </div>

                  {/* Rojo */}
                  <div className="bg-[#161b22] p-3.5 rounded-2xl border border-rose-500/40 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>🔴 Alta Varianza</span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] leading-snug">
                      Incertidumbre elevada o cuota baja para el riesgo. Conviene descartar el encuentro.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. ACCESO RÁPIDO AL GLOSARIO COMPLETO */}
              <section className="bg-[#161b22] border border-[#30363d] p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#d9b114] shrink-0" />
                    <span>¿Dudas con términos como xG, BTTS, Pace, ORTG o +EV?</span>
                  </h3>
                  <p className="text-[11px] text-[#8b949e]">
                    Explora el diccionario interactivo con buscador y ejemplos prácticos de Fútbol y Baloncesto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('GLOSSARY')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#d9b114] hover:bg-[#c5a013] text-slate-950 font-bold text-xs transition shrink-0 cursor-pointer shadow-sm"
                >
                  Ver Glosario A-Z →
                </button>
              </section>

              {/* 4. REGLA DE ORO Y RESPONSABILIDAD */}
              <div className="bg-[#161b22] border border-[#d9b114]/40 p-3.5 rounded-2xl flex items-start gap-2.5 shadow-xs">
                <ShieldAlert className="w-4 h-4 text-[#d9b114] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#8b949e] leading-relaxed">
                  <strong className="text-[#d9b114]">Juego Responsable (+18):</strong> Herramienta exclusivamente estadística e informativa. No somos casa de apuestas ni garantizamos resultados.
                </p>
              </div>
            </>
          )}

          {/* =========================================================
              TAB 2: GLOSARIO TÉCNICO Y SIGLAS (A-Z)
             ========================================================= */}
          {activeTab === 'GLOSSARY' && (
            <div className="space-y-3.5">
              {/* Search & Category Filter Bar */}
              <div className="bg-[#161b22] border border-[#30363d] space-y-2.5 p-3.5 rounded-2xl">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8b949e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    placeholder="Buscar sigla o término (ej: xG, +EV, BTTS, Pace, Spread, Stake...)"
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-[#8b949e] focus:bg-[#0b0e14] focus:outline-none focus:border-[#d9b114] transition"
                  />
                  {glossarySearch && (
                    <button
                      type="button"
                      onClick={() => setGlossarySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('ALL')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                      glossaryCategory === 'ALL'
                        ? 'bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/60 shadow-2xs'
                        : 'bg-[#0b0e14] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d]'
                    }`}
                  >
                    Todos ({GLOSSARY_ITEMS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('MATH')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                      glossaryCategory === 'MATH'
                        ? 'bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/60 shadow-2xs'
                        : 'bg-[#0b0e14] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d]'
                    }`}
                  >
                    🧮 Matemática & Valor
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('SOCCER')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                      glossaryCategory === 'SOCCER'
                        ? 'bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/60 shadow-2xs'
                        : 'bg-[#0b0e14] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d]'
                    }`}
                  >
                    ⚽ Fútbol
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('NBA')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                      glossaryCategory === 'NBA'
                        ? 'bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/60 shadow-2xs'
                        : 'bg-[#0b0e14] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d]'
                    }`}
                  >
                    🏀 Baloncesto
                  </button>
                </div>
              </div>

              {/* Glossary Cards Grid (2 Cols PC / 1 Col Móvil) */}
              {filteredGlossary.length === 0 ? (
                <div className="bg-[#161b22] border border-[#30363d] p-6 text-center rounded-2xl space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-[#8b949e]">
                    No se encontraron términos para "{glossarySearch}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGlossarySearch('');
                      setGlossaryCategory('ALL');
                    }}
                    className="text-xs text-[#d9b114] hover:underline font-semibold cursor-pointer"
                  >
                    Mostrar todos los términos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredGlossary.map((item) => (
                    <div
                      key={item.shortCode}
                      className="bg-[#161b22] border border-[#30363d] p-3.5 rounded-2xl hover:border-[#d9b114]/50 transition flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 px-2 py-0.5 rounded-lg font-mono font-bold text-xs shrink-0">
                              {item.shortCode}
                            </span>
                            <h4 className="font-bold text-white text-xs sm:text-sm truncate">{item.term}</h4>
                          </div>
                          <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#8b949e] border border-[#30363d] shrink-0">
                            {item.categoryLabel}
                          </span>
                        </div>

                        <p className="text-xs text-[#8b949e] leading-relaxed">{item.definition}</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-[11px] text-[#8b949e]">
                        <span className="font-semibold text-[#00ff66]">Ejemplo: </span>
                        {item.example}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 3: TÉRMINOS DE SERVICIO, HABEAS DATA (LEY 1581) Y AVISO LEGAL (+18)
             ========================================================= */}
          {activeTab === 'LEGAL' && (
            <div className="space-y-3">
              {/* Banner Principal +18 y Naturaleza del Software */}
              <div className="bg-[#161b22] border border-[#30363d] p-3.5 sm:p-4 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0b0e14] border border-[#d9b114]/40 flex items-center justify-center text-[#d9b114] font-black text-xs shrink-0">
                  +18
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Marco Legal, Términos de Servicio y Protección de Datos (Ley 1581)
                  </h3>
                  <p className="text-[11px] text-[#8b949e] leading-relaxed">
                    G METRICS es una herramienta analítica y de software estadístico basada en modelos matemáticos y telemetría de eventos deportivos. No somos una casa de apuestas, no operamos juegos de azar ni recibimos fondos destinados a apuestas. La información y métricas presentadas son de carácter exclusivamente informativo y educativo. El usuario es el único responsable de sus decisiones personales. Servicio exclusivo para mayores de edad (+18). Todos los nombres comerciales, escudos y marcas deportivas mostradas pertenecen a sus respectivos titulares y se utilizan con fines meramente identificativos y descriptivos (Uso Legítimo / Nominative Fair Use).
                  </p>
                </div>
              </div>

              {/* Bloques Jurídicos Principales */}
              <div className="space-y-2.5">
                {/* 1. Términos de Servicio */}
                <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded-2xl space-y-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#d9b114] shrink-0" />
                    <span>1. Términos de Servicio (Licencia de Acceso a Software SaaS)</span>
                  </h4>
                  <p className="text-[11px] text-[#8b949e] leading-relaxed">
                    <strong className="text-white">G METRICS</strong> comercializa exclusivamente <strong className="text-white">licencias temporales de acceso a un software de análisis matemático y estadístico</strong>. Los pagos realizados por el usuario corresponden única y exclusivamente a la suscripción tecnológica de uso de la plataforma. G METRICS no capta dinero para apuestas, no intermedia jugadas, <strong className="text-white">no garantiza utilidades financieras ni aciertos seguros</strong>, y se deslinda de cualquier responsabilidad patrimonial, directa o indirecta, derivada de las decisiones deportivas o recreativas tomadas de manera autónoma por el usuario.
                  </p>
                </div>

                {/* 2. Política de Tratamiento de Datos (Ley 1581 / Habeas Data) */}
                <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded-2xl space-y-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#d9b114] shrink-0" />
                    <span>2. Política de Tratamiento de Datos Personales (Ley 1581 de 2012 / Habeas Data)</span>
                  </h4>
                  <p className="text-[11px] text-[#8b949e] leading-relaxed">
                    En cumplimiento del régimen de protección de datos personales (Ley Estatutaria 1581 de 2012 y normas concordantes), informamos que los datos solicitados en el registro (<strong className="text-white">nombre de usuario o alias, número de contacto de WhatsApp e identificador técnico de dispositivo / Device ID</strong>) se recopilan y tratan con el <strong className="text-white">único propósito de validar la activación de la licencia de software, prevenir el uso simultáneo o multicuentas en un mismo acceso (Política 1/1) y brindar soporte técnico directo</strong>. No compartimos, vendemos ni cedemos datos a terceros.
                  </p>
                  <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-[11px] text-[#8b949e] space-y-1">
                    <span className="font-bold text-white block">
                      Canales Oficiales para Derechos ARCO (Consulta, Actualización, Rectificación y Supresión de Datos):
                    </span>
                    <p className="text-[10.5px] text-[#8b949e]">
                      El titular puede ejercer en cualquier momento sus derechos de conocer, actualizar, rectificar o solicitar la eliminación de sus datos enviando su solicitud a:
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-0.5 font-mono text-[11px]">
                      <a
                        href="mailto:dgcontrerasb@gmail.com"
                        className="text-[#d9b114] hover:underline font-bold"
                      >
                        ✉️ dgcontrerasb@gmail.com
                      </a>
                      <a
                        href="https://wa.me/573213902708"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00ff66] hover:underline font-bold"
                      >
                        📱 WhatsApp Oficial: +57 321 390 2708
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3. Propiedad Intelectual y Nominative Fair Use */}
                <div className="bg-[#161b22] border border-[#30363d] p-3.5 rounded-2xl space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-[#d9b114] shrink-0" />
                    <span>3. Uso Legítimo de Signos Distintivos (Nominative Fair Use) y Mayoría de Edad (+18)</span>
                  </h4>
                  <p className="text-[11px] text-[#8b949e] leading-relaxed">
                    Todos los nombres de ligas, clubes, escudos y marcas deportivas que aparecen en las tablas estadísticas pertenecen a sus respectivos propietarios legítimos y se emplean con carácter estrictamente descriptivo, informativo y referencial (<em>Nominative Fair Use</em>), sin reclamar afiliación ni patrocinio oficial. El acceso al software está estrictamente restringido a personas <strong className="text-white">mayores de 18 años (+18)</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#30363d] bg-[#0b0e14] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10.5px] text-[#8b949e]">
            Software estadístico informativo (+18) · Soporte Habeas Data: dgcontrerasb@gmail.com
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
