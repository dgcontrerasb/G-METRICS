import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  BellRing,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGuideModal?: () => void;
}

interface TourStep {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  metricLabel: string;
  metricValue: string;
  metricTone: string;
  highlightTag: string;
  previewType: 'FILTERS' | 'EV_METRIC' | 'H2H_STREAK' | 'PARLAY_SLIP' | 'LIVE_TELEMETRY';
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: 'PASO 1 DE 5',
    badgeColor: 'text-[#d9b114] border-[#d9b114]/30 bg-[#d9b114]/10',
    title: 'Terminal Multideporte & Filtros Smart',
    subtitle: 'Navegación unificada para Fútbol y NBA',
    description:
      'Alterna al instante entre fútbol mundial y baloncesto NBA. Filtra por Top Picks de alto valor, Todas las Ligas o Partidos en Vivo, y selecciona fechas con un solo clic.',
    icon: SlidersHorizontal,
    metricLabel: 'Cobertura Diaria',
    metricValue: '40+ Ligas Globales',
    metricTone: 'text-white',
    highlightTag: 'Fútbol & NBA en tiempo real',
    previewType: 'FILTERS'
  },
  {
    badge: 'PASO 2 DE 5',
    badgeColor: 'text-[#00ff66] border-[#00ff66]/30 bg-[#00ff66]/10',
    title: 'Probabilidad Cuantitativa & Señales +EV',
    subtitle: 'Encuentra ventajas matemáticas reales contra el mercado',
    description:
      'Nuestro motor matemático calcula la probabilidad pura del evento y la Cuota Justa. Si la casa paga por encima del valor real, el sistema emite una alerta +EV con ventaja matemática.',
    icon: TrendingUp,
    metricLabel: 'Fórmula de Ventaja',
    metricValue: '+EV = (Prob × Cuota) - 1',
    metricTone: 'text-[#00ff66]',
    highlightTag: 'Valor Esperado Positivo',
    previewType: 'EV_METRIC'
  },
  {
    badge: 'PASO 3 DE 5',
    badgeColor: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    title: 'Ritmo de Juego & Historial Directo (H2H)',
    subtitle: 'Análisis profundo sin salir de la pantalla principal',
    description:
      'Abre cualquier partido para examinar los últimos duelos cara a cara, rachas de victorias consecutivas (ej. 🔥 +3V), medias de puntos y la tendencia histórica de Altas / Bajas.',
    icon: Flame,
    metricLabel: 'Racha Determinística',
    metricValue: 'H2H & Ritmo Head-to-Head',
    metricTone: 'text-amber-400',
    highlightTag: 'Historial cara a cara & rachas',
    previewType: 'H2H_STREAK'
  },
  {
    badge: 'PASO 4 DE 5',
    badgeColor: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
    title: 'Creador de Parlays & Simulador de Retorno',
    subtitle: 'Construye combinadas con cálculo de probabilidad conjunta',
    description:
      'Selecciona cuotas con el icono de ticket para enviarlas al Parlay Slip. El motor calcula la correlación, la probabilidad acumulada y el retorno proyectado antes de arriesgar.',
    icon: Layers,
    metricLabel: 'Control de Riesgo',
    metricValue: 'Prob. Acumulada & Retorno',
    metricTone: 'text-sky-400',
    highlightTag: 'Drawer flotante & Guardado offline',
    previewType: 'PARLAY_SLIP'
  },
  {
    badge: 'PASO 5 DE 5',
    badgeColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    title: 'Alertas en Directo & Gestión de Banca',
    subtitle: 'Monitoreo minuto a minuto y Stake % sugerido',
    description:
      'Recibe notificaciones en vivo de goles, cambios de cuotas y evolución de probabilidades. Sigue el Stake % sugerido para proteger tu capital recreativo a largo plazo.',
    icon: BellRing,
    metricLabel: 'Gestión Inteligente',
    metricValue: 'Stake % según Kelly Criterion',
    metricTone: 'text-emerald-400',
    highlightTag: 'Notificaciones & Disciplina',
    previewType: 'LIVE_TELEMETRY'
  }
];

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onOpenGuideModal
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gmetrics_hide_onboarding_tour') === 'true';
    } catch {
      return false;
    }
  });

  // Reset al paso 1 cada vez que se abre
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      try {
        setDontShowAgain(localStorage.getItem('gmetrics_hide_onboarding_tour') === 'true');
      } catch {
        // no-op
      }
    }
  }, [isOpen]);

  const handleToggleDontShow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    try {
      if (checked) {
        localStorage.setItem('gmetrics_hide_onboarding_tour', 'true');
      } else {
        localStorage.removeItem('gmetrics_hide_onboarding_tour');
      }
    } catch {
      // no-op
    }
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Finalizar tour
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Soporte para teclado (Escape, Flechas)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    },
    [isOpen, currentStepIndex, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 motion-safe:transition-all motion-safe:duration-200">
        {/* Barra superior con gradiente de acento dorado Cyber-Fintech */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#d9b114] to-transparent shrink-0" />

        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14]/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#d9b114]/15 border border-[#d9b114]/30 flex items-center justify-center text-[#d9b114] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
                G-METRICS <span className="text-[#d9b114]">TOUR</span>
              </span>
              <p className="text-[10px] text-[#8b949e]">Guía interactiva de inicio rápido</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex text-[11px] font-mono text-[#8b949e] tabular-nums font-semibold">
              {currentStepIndex + 1} de {TOUR_STEPS.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
              title="Cerrar tour (Escape)"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Indicador de Pasos (Pills interactivos) */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#0e1218] border-b border-[#30363d] flex items-center justify-between gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {TOUR_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex-1 min-w-[50px] py-1.5 px-2 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-[#d9b114]/20 border border-[#d9b114]/50 text-[#d9b114] font-bold shadow-sm'
                    : isCompleted
                    ? 'bg-[#21262d] text-[#00ff66] hover:bg-[#28303a]'
                    : 'bg-[#161b22] text-[#8b949e] hover:bg-[#21262d]'
                }`}
                title={`Ir al paso ${idx + 1}: ${step.title}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3 text-[#00ff66] shrink-0" />
                ) : (
                  <span className="tabular-nums">{idx + 1}</span>
                )}
                <span className="hidden md:inline truncate">{step.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido Central del Paso Activo (animación suave fade-in) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStep.badgeColor}`}
                >
                  <StepIcon className="w-3 h-3" />
                  {currentStep.badge}
                </span>
                <span className="text-[10px] text-[#8b949e] font-mono">{currentStep.highlightTag}</span>
              </div>
              <h3 id="tour-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                {currentStep.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#d9b114] font-medium">{currentStep.subtitle}</p>
            </div>

            <div className="hidden sm:flex flex-col items-end text-right shrink-0 bg-[#0b0e14] border border-[#30363d] px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-[#8b949e] uppercase font-mono">{currentStep.metricLabel}</span>
              <span className={`text-xs font-mono font-bold ${currentStep.metricTone}`}>
                {currentStep.metricValue}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed">
            {currentStep.description}
          </p>

          {/* Tarjeta de Demostración Visual Interactiva por Paso */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#0b0e14] border border-[#30363d] space-y-2.5">
            {currentStep.previewType === 'FILTERS' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-[#d9b114] text-[#0b0e14] font-bold text-xs flex items-center gap-1.5">
                    ⚽ Fútbol
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] text-xs flex items-center gap-1.5">
                    🏀 NBA
                  </div>
                  <div className="ml-auto text-[11px] font-mono text-[#d9b114] bg-[#d9b114]/10 border border-[#d9b114]/20 px-2 py-0.5 rounded-md">
                    Hoy • 18 Partidos
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]/70 text-white">
                    🔥 Top Picks (8)
                  </div>
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]/70 text-[#8b949e]">
                    🌐 Todas las Ligas
                  </div>
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]/70 text-rose-400">
                    🔴 En Vivo (2)
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'EV_METRIC' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">BOS Celtics vs ORL Magic</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/30 font-bold">
                    +EV 8.4% • SEÑAL FUERTE
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
                    <div className="text-[10px] text-[#8b949e]">Prob. Real</div>
                    <div className="font-bold text-white text-xs">68.4%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
                    <div className="text-[10px] text-[#8b949e]">Cuota Justa</div>
                    <div className="font-bold text-white text-xs">@1.46</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#00ff66]/40 text-[#00ff66]">
                    <div className="text-[10px] text-[#8b949e]">Cuota Mercado</div>
                    <div className="font-bold text-xs">@1.90 (+30%)</div>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'H2H_STREAK' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8b949e]">Historial Directo (Últimos 5 duelos)</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                    🔥 +3V seguidas Celtics
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">BOS Celtics</span>
                    <span className="text-[#8b949e] font-mono">124 - 109</span>
                    <span className="text-[#8b949e]">ORL Magic</span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    233 pts • Alta
                  </span>
                </div>
              </div>
            )}

            {currentStep.previewType === 'PARLAY_SLIP' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Parlay Combinado (2 selecciones)</span>
                  <span className="font-mono text-[11px] text-[#d9b114] font-bold">Cuota Total: 3.42</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
                    <div className="text-[10px] text-[#8b949e]">Prob. Correlacionada</div>
                    <div className="font-bold text-sky-400">54.2%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
                    <div className="text-[10px] text-[#8b949e]">Retorno Proyectado ($50)</div>
                    <div className="font-bold text-[#00ff66]">+$171.00</div>
                  </div>
                </div>
              </div>
            )}

            {currentStep.previewType === 'LIVE_TELEMETRY' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-bold text-white">Telemetría en Vivo</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Stake Sugerido: 2.5%
                  </span>
                </div>
                <p className="text-[11px] text-[#8b949e]">
                  Actualización constante de posesión, goles y cuotas en directo sin necesidad de recargar la página.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer con Casilla "No volver a mostrar" y Botones de Navegación */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#30363d] bg-[#0b0e14]/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Casilla de verificación para recordar preferencia */}
          <label className="flex items-center gap-2.5 text-xs text-[#8b949e] hover:text-white cursor-pointer select-none transition-colors self-start sm:self-center">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleToggleDontShow}
              className="w-4 h-4 rounded border-[#30363d] bg-[#0b0e14] text-[#d9b114] accent-[#d9b114] cursor-pointer"
            />
            <span>No volver a mostrar al iniciar sesión</span>
          </label>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
            >
              Omitir
            </button>

            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#21262d] hover:bg-[#30363d] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold text-[#0b0e14] bg-[#d9b114] hover:bg-[#c49f10] transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>{isLastStep ? 'Comenzar a Explorar' : 'Siguiente'}</span>
              {isLastStep ? <ArrowRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
