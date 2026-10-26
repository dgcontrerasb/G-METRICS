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
  Lock
} from 'lucide-react';

export type GuideModalTab = 'GUIDE' | 'GLOSSARY' | 'LEGAL';

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
    term: 'Criterio de Kelly (Fraccional)',
    shortCode: 'Kelly %',
    category: 'MATH',
    categoryLabel: '🧮 Matemática & Valor',
    definition:
      'Fórmula matemática de gestión de riesgo que sugiere qué porcentaje prudente de tu banca (Bankroll) asignar a una selección según el tamaño de la ventaja (+EV).',
    example:
      'Si Kelly sugiere 2.5% y tu presupuesto total recreativo es de $100.000, el monto sugerido de exposición es $2.500.'
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
    term: 'Modelo Bivariado Dixon-Coles & Poisson',
    shortCode: 'Dixon-Coles',
    category: 'SOCCER',
    categoryLabel: '⚽ Fútbol',
    definition:
      'Algoritmo probabilístico especializado en fútbol que construye una matriz exacta de marcadores (0-0 hasta 5-5) corrigiendo la dependencia en resultados bajos (0-0, 1-0, 0-1, 1-1) mediante el factor Rho (ρ).',
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
      'Estimaciones estadísticas individuales (mediante distribución de Poisson) sobre el rendimiento de una estrella en Puntos (PTS), Rebotes (REB), Asistencias (AST) o Triples (3PM).',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0c1322] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-950/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              {activeTab === 'LEGAL' ? (
                <Scale className="w-5 h-5 text-amber-400" />
              ) : activeTab === 'GLOSSARY' ? (
                <BookMarked className="w-5 h-5 text-cyan-400" />
              ) : (
                <BookOpen className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 flex-wrap">
                <span>Centro de Ayuda, Glosario y Marco Legal</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SportStats Pro
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Guía práctica de uso, diccionario técnico A-Z y condiciones legales de uso (+18).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2.5 bg-slate-950/50 border-b border-white/10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('GUIDE')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeTab === 'GUIDE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Guía Rápida</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GLOSSARY')}
            className={`flex-1 min-w-[150px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeTab === 'GLOSSARY'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Glosario Técnico (A-Z)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-200 font-mono">
              {GLOSSARY_ITEMS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LEGAL')}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeTab === 'LEGAL'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Aviso Legal (+18)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
          {/* =========================================================
              TAB 1: GUÍA RÁPIDA PARA PRINCIPIANTES
             ========================================================= */}
          {activeTab === 'GUIDE' && (
            <>
              {/* 1. CALCULADORA INTERACTIVA DE CUOTAS */}
              <section className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-950/80 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-black text-white">
                    1. ¿Qué es una "Cuota" y cómo se calcula un retorno?
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Una cuota (ejemplo{' '}
                  <code className="text-amber-300 font-mono bg-black/40 px-1.5 py-0.5 rounded">@1.85</code>) es un{' '}
                  <strong>multiplicador matemático</strong> inversamente proporcional a la probabilidad estimada. Haz una
                  simulación rápida aquí:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                      Monto simulado (Stake):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="1"
                        value={calcStake}
                        onChange={(e) => setCalcStake(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-slate-950/70 border border-white/20 rounded-xl py-2 pl-7 pr-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Cuota decimal:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold">@</span>
                      <input
                        type="number"
                        step="0.05"
                        min="1.01"
                        value={calcOdd}
                        onChange={(e) => setCalcOdd(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
                        className="w-full bg-slate-950/70 border border-white/20 rounded-xl py-2 pl-7 pr-3 text-amber-300 font-mono text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Resultado Financiero */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Retorno Bruto Simulado:
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-400">${totalReturn}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Utilidad Neta Simulada:
                    </span>
                    <span className="text-base font-black font-mono text-white">
                      +${netProfit} <span className="text-emerald-400 text-xs">({returnPercentage}%)</span>
                    </span>
                  </div>
                </div>
              </section>

              {/* 2. EL SISTEMA DE SEMÁFOROS DIDÁCTICOS */}
              <section className="space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  2. El Semáforo Estadístico: ¿Cómo interpretar cada color?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Verde */}
                  <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>🟢 ESCENARIO FAVORABLE</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      El modelo detecta una <strong>probabilidad sólida</strong> o una ventaja estadística positiva (
                      <strong>+EV</strong>). Representa los escenarios con mejor respaldo matemático, sin implicar
                      certeza absoluta.
                    </p>
                  </div>

                  {/* Amarillo */}
                  <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>🟡 PRECAUCIÓN / PAREJO</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Duelo equilibrado o con margen estrecho. La guía sugiere evaluar{' '}
                      <strong>mercados alternativos</strong> (goles, puntos o doble oportunidad) o moderar la exposición.
                    </p>
                  </div>

                  {/* Rojo */}
                  <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-400 font-black text-xs">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>🔴 ALTA INCERTIDUMBRE</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Alta varianza o cuota desfavorable para el riesgo asumido. La sugerencia analítica es{' '}
                      <strong>abstenerse o descartar el partido</strong>.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. ACCESO RÁPIDO AL GLOSARIO COMPLETO */}
              <section className="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    <span>¿No entiendes alguna sigla como xG, BTTS, Pace, ORTG o +EV?</span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Consulta nuestro diccionario interactivo con buscador en tiempo real y ejemplos prácticos de Fútbol y
                    NBA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('GLOSSARY')}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition shrink-0 cursor-pointer"
                >
                  Abrir Glosario A-Z →
                </button>
              </section>

              {/* 4. REGLA DE ORO Y RESPONSABILIDAD */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black text-amber-300 block">
                    Principio de Juego Responsable (+18):
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                    Esta plataforma es una herramienta de consulta estadística y probabilística;{' '}
                    <strong>no es una casa de apuestas</strong> ni garantiza resultados futuros. Toda decisión final es
                    responsabilidad exclusiva del usuario. Nunca utilices dinero destinado a tus necesidades básicas.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* =========================================================
              TAB 2: GLOSARIO TÉCNICO Y SIGLAS (A-Z)
             ========================================================= */}
          {activeTab === 'GLOSSARY' && (
            <div className="space-y-4">
              {/* Search & Category Filter Bar */}
              <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    placeholder="Buscar sigla o término (ej: xG, +EV, BTTS, Pace, Spread, Kelly, 1X...)"
                    className="w-full bg-slate-900 border border-white/15 rounded-xl pl-10 pr-8 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                  {glossarySearch && (
                    <button
                      type="button"
                      onClick={() => setGlossarySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      glossaryCategory === 'ALL'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                    }`}
                  >
                    Todos ({GLOSSARY_ITEMS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('MATH')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      glossaryCategory === 'MATH'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                    }`}
                  >
                    🧮 Matemática & Valor
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('SOCCER')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      glossaryCategory === 'SOCCER'
                        ? 'bg-teal-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                    }`}
                  >
                    ⚽ Fútbol
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlossaryCategory('NBA')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      glossaryCategory === 'NBA'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                    }`}
                  >
                    🏀 NBA
                  </button>
                </div>
              </div>

              {/* Glossary Cards List */}
              {filteredGlossary.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/10 space-y-2">
                  <p className="text-sm font-bold text-slate-300">
                    No se encontraron términos que coincidan con "{glossarySearch}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGlossarySearch('');
                      setGlossaryCategory('ALL');
                    }}
                    className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer"
                  >
                    Mostrar todos los términos del glosario
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredGlossary.map((item) => (
                    <div
                      key={item.shortCode}
                      className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-500/30 transition space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-black text-xs">
                            {item.shortCode}
                          </span>
                          <h4 className="font-black text-white text-xs sm:text-sm">{item.term}</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-white/5">
                          {item.categoryLabel}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{item.definition}</p>

                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 text-[11px] text-slate-400">
                        <span className="font-bold text-emerald-400">Ejemplo práctico: </span>
                        {item.example}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 3: AVISO LEGAL, EXENCIÓN DE RESPONSABILIDAD Y +18
             ========================================================= */}
          {activeTab === 'LEGAL' && (
            <div className="space-y-4">
              {/* Banner Principal +18 */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-slate-950 border border-amber-500/40 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-sm shrink-0">
                  +18
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white">
                    Declaración de Exención de Responsabilidad y Uso Autónomo
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    El acceso y uso de <strong>SportStats Pro</strong> implica la comprensión y aceptación expresa de
                    que esta plataforma constituye única y exclusivamente una{' '}
                    <strong>herramienta de análisis estadístico, matemático e informativo</strong>. Cada usuario actúa
                    bajo su propio criterio, riesgo patrimonial y responsabilidad exclusiva.
                  </p>
                </div>
              </div>

              {/* 5 Cláusulas de Blindaje Legal */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>1. Naturaleza Estrictamente Informativa (No somos Casa de Apuestas)</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>SportStats Pro</strong> no es un operador de juegos de suerte y azar, no es una casa de
                    apuestas (bookmaker), no capta ni recibe dinero del público para realizar apuestas, no intermedia
                    pagos de premios ni procesa transacciones de juego. Cualquier simulación de cuotas, montos o boletos
                    dentro de la aplicación tiene fines estrictamente analíticos y de cálculo personal.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>2. Ausencia de Garantía de Acierto y Asunción de Riesgo del Usuario</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Los modelos probabilísticos empleados (distribuciones de Poisson, corrección bivariada de
                    Dixon-Coles, regresiones de ritmo/eficiencia y cálculo de Valor Esperado +EV) se fundamentan en
                    datos históricos y tendencias matemáticas. El deporte profesional está sujeto a variables humanas,
                    arbitrales y fortuitas impredecibles.{' '}
                    <strong>
                      Ningún porcentaje, proyección, semáforo o indicador garantiza resultados futuros ni ganancias
                      económicas seguras.
                    </strong>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-cyan-400 flex items-center gap-2">
                    <Scale className="w-4 h-4 shrink-0" />
                    <span>3. No Constituye Asesoría Financiera ni Invitación Obligatoria a Apostar</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    La información presentada sirve como guía técnica orientativa para los aficionados a la analítica
                    deportiva. La decisión final de realizar o no una apuesta en operadores externos, así como el monto
                    arriesgado, recae en un <strong>100% bajo la voluntad, autonomía y responsabilidad del usuario</strong>.
                    Los creadores, administradores y desarrolladores de SportStats Pro quedan exonerados de cualquier
                    responsabilidad por pérdidas económicas directas o indirectas derivadas del uso de esta información.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-rose-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>4. Restricción de Mayoría de Edad (+18) y Juego Responsable</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    El contenido de esta plataforma está dirigido exclusivamente a personas{' '}
                    <strong>mayores de 18 años</strong> (o la mayoría de edad legal aplicable en su país de residencia).
                    Promovemos el entretenimiento responsable: nunca utilices recursos destinados a vivienda,
                    alimentación, salud, educación o compromisos familiares, ni recurras a préstamos para participar en
                    pronósticos deportivos.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-slate-200 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>5. Cumplimiento Normativo Local y Uso Personal de Cuenta</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Es responsabilidad exclusiva de cada usuario verificar y cumplir con las leyes y regulaciones sobre
                    pronósticos deportivos vigentes en su jurisdicción (por ejemplo, operar únicamente en plataformas
                    autorizadas por Coljuegos en Colombia o la entidad reguladora de su país). El acceso a SportStats
                    Pro es personal e intransferible (vinculado a 1 dispositivo autorizado por cuenta).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            Herramienta estadística orientativa (+18) · La decisión final es siempre del usuario.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors cursor-pointer"
          >
            Entendido, volver al panel
          </button>
        </div>
      </div>
    </div>
  );
};
