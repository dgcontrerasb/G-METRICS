import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Search,
  TrendingUp,
  Flame,
  CheckCircle2,
  ArrowRight,
  Layers,
  Compass
} from 'lucide-react';

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGuideModal?: () => void;
}

interface TourStep {
  selector: string;
  fallbackSelector?: string;
  targetName: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left';
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-sports"]',
    fallbackSelector: '[data-tour="tour-sports-mobile"], header',
    targetName: 'SELECTOR MULTIDEPORTE',
    badge: 'PASO 1 DE 5',
    title: 'Selector de Deportes & Ligas',
    subtitle: 'Navegación unificada Fútbol y NBA',
    description:
      'Alterna al instante entre fútbol mundial y baloncesto NBA. En este panel lateral también filtras tus Top Picks con ventaja y despliegas las ligas destacadas.',
    icon: SlidersHorizontal,
    preferredPlacement: 'right'
  },
  {
    selector: '[data-tour="tour-search-date"]',
    fallbackSelector: 'header input[type="text"]',
    targetName: 'BUSCADOR & CALENDARIO',
    badge: 'PASO 2 DE 5',
    title: 'Buscador Inteligente & Fechas',
    subtitle: 'Programación en vivo hasta 5 días',
    description:
      'Busca cualquier equipo, jugador o torneo en tiempo real. Utiliza el selector de calendario para consultar partidos de hoy, mañana o programaciones futuras.',
    icon: Search,
    preferredPlacement: 'bottom'
  },
  {
    selector: '[data-tour="tour-match-card"]',
    fallbackSelector: '.grid > div:first-child, [data-tour="tour-first-match"]',
    targetName: 'TARJETA DE PARTIDO & +EV',
    badge: 'PASO 3 DE 5',
    title: 'Probabilidades Reales & Señal +EV',
    subtitle: 'Detección cuantitativa de valor',
    description:
      'El modelo calcula la probabilidad matemática pura y la Cuota Justa. Si la casa de apuestas paga por encima de su valor real, se activa la señal verde +EV (Ventaja a tu favor).',
    icon: TrendingUp,
    preferredPlacement: 'bottom'
  },
  {
    selector: '[data-tour="tour-h2h-btn"]',
    fallbackSelector: '[data-tour="tour-match-card"] button, button:has(svg)',
    targetName: 'HISTORIAL DIRECTO (H2H)',
    badge: 'PASO 4 DE 5',
    title: 'Radiografía H2H & Ritmo de Juego',
    subtitle: 'Estadísticas cara a cara y rachas',
    description:
      'Presiona este botón para inspeccionar los últimos 5 duelos directos, rachas de victorias seguidas (ej. 🔥 +3V) y tendencias de Altas / Bajas con línea de referencia.',
    icon: Flame,
    preferredPlacement: 'top'
  },
  {
    selector: '[data-tour="tour-header-actions"]',
    fallbackSelector: 'header [data-tour="tour-header-actions"], header button',
    targetName: 'ACCIONES, EXPORTAR & PARLAYS',
    badge: 'PASO 5 DE 5',
    title: 'Sincronización, Exportación & Slips',
    subtitle: 'Herramientas avanzadas del terminal',
    description:
      'Sincroniza marcadores en tiempo real, exporta informes en Excel (.csv) o PDF, y construye tus combinadas en el Parlay Slip con probabilidad calculada.',
    icon: Layers,
    preferredPlacement: 'bottom'
  }
];

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 120, left: 40 });
  const [arrowSide, setArrowSide] = useState<'top' | 'bottom' | 'left' | 'right' | 'none'>('top');
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gmetrics_hide_onboarding_tour') === 'true';
    } catch {
      return false;
    }
  });

  const cardRef = useRef<HTMLDivElement>(null);

  // Reset al paso inicial cada vez que se abre
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

  // Localizar elemento en el DOM y calcular dimensiones del Spotlight
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    let el = document.querySelector(currentStep.selector);

    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }

    if (!el) {
      // Si no hay elemento visible (ej. pantalla muy pequeña), centrar suavemente
      setTargetRect(null);
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const cardW = Math.min(420, vpW - 32);
      setCardPos({
        left: Math.max(16, (vpW - cardW) / 2),
        top: Math.max(20, (vpH - 300) / 2)
      });
      setArrowSide('none');
      return;
    }

    // Desplazar el elemento objetivo al campo visual suavemente
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = el.getBoundingClientRect();
    const padding = 6;
    const computedRect: ElementRect = {
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      bottom: rect.bottom + padding,
      right: rect.right + padding
    };
    setTargetRect(computedRect);

    // Calcular posición óptima del anuncio tipo Glass
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const cardW = Math.min(420, vpW - 32);
    const cardH = 260; // Altura aproximada de la tarjeta

    let finalTop = 80;
    let finalLeft = 20;
    let chosenArrow: 'top' | 'bottom' | 'left' | 'right' | 'none' = 'top';

    const preferred = currentStep.preferredPlacement || 'bottom';

    if (preferred === 'right' && computedRect.right + cardW + 24 < vpW) {
      // Ubicación al lado derecho (ideal para barra lateral en desktop)
      finalLeft = computedRect.right + 18;
      finalTop = Math.max(16, Math.min(computedRect.top, vpH - cardH - 16));
      chosenArrow = 'left';
    } else if (preferred === 'top' && computedRect.top - cardH - 24 > 0) {
      // Arriba del elemento
      finalTop = computedRect.top - cardH - 18;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'bottom';
    } else if (computedRect.bottom + cardH + 24 < vpH) {
      // Abajo del elemento (predeterminado)
      finalTop = computedRect.bottom + 18;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'top';
    } else if (computedRect.top - cardH - 24 > 0) {
      // Si abajo no cabe, probar arriba
      finalTop = computedRect.top - cardH - 18;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'bottom';
    } else {
      // Posición de resguardo centrada
      finalTop = Math.max(16, (vpH - cardH) / 2);
      finalLeft = Math.max(16, (vpW - cardW) / 2);
      chosenArrow = 'none';
    }

    setCardPos({ top: finalTop, left: finalLeft });
    setArrowSide(chosenArrow);
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    if (!isOpen) return;

    // Ejecutar con un pequeño delay para dar tiempo a renderizar la vista
    const timer = setTimeout(updateTargetPosition, 80);

    const handleResizeOrScroll = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
    };
  }, [isOpen, currentStepIndex, updateTargetPosition]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Atajos de teclado
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
    <div className="fixed inset-0 z-[80] overflow-hidden select-none pointer-events-none">
      {/* 1. MÁSCARA SVG SPOTLIGHT (Fondo atenuado con ventana translúcida viva) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      >
        <defs>
          <mask id="gmetrics-tour-spotlight-mask">
            {/* Base blanca = opaco */}
            <rect width="100%" height="100%" fill="white" />
            {/* Ventana negra = transparente (revela el elemento real con transición suave) */}
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="16"
                ry="16"
                fill="black"
                className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              />
            )}
          </mask>
        </defs>

        {/* Fondo oscuro Cyber-Fintech con recorte exacto */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 8, 13, 0.78)"
          mask="url(#gmetrics-tour-spotlight-mask)"
        />
      </svg>

      {/* 2. ANILLO Y BALIZA LUMINOSA QUE SEÑALA EL ELEMENTO ACTIVO */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[81] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-2xl border-2 border-[#d9b114] shadow-[0_0_25px_rgba(217,177,20,0.55),inset_0_0_15px_rgba(217,177,20,0.2)]"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height
          }}
        >
          {/* Baliza flotante con etiqueta indicadora */}
          <div className="absolute -top-3 left-3 px-2 py-0.5 rounded-full bg-[#d9b114] text-[#0b0e14] font-mono text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0b0e14] animate-ping" />
            <span>{currentStep.targetName}</span>
          </div>
        </div>
      )}

      {/* 3. ANUNCIO TIPO GLASS (Card Flotante Glassmorphism que se desplaza fluidamente) */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-tour-title"
        className="fixed z-[85] pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-[92vw] sm:max-w-[420px] w-full"
        style={{
          top: cardPos.top,
          left: cardPos.left
        }}
      >
        <div className="relative rounded-3xl bg-[#161b22]/90 backdrop-blur-2xl border border-[#d9b114]/50 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.85),0_0_30px_rgba(217,177,20,0.18)] p-4 sm:p-5 text-white flex flex-col gap-3.5 overflow-hidden">
          {/* Puntero visual que señala hacia el objetivo */}
          {arrowSide === 'top' && (
            <div className="absolute -top-2 left-8 w-4 h-4 bg-[#161b22] border-t border-l border-[#d9b114]/60 rotate-45 transform" />
          )}
          {arrowSide === 'bottom' && (
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-[#161b22] border-b border-r border-[#d9b114]/60 rotate-45 transform" />
          )}
          {arrowSide === 'left' && (
            <div className="absolute top-8 -left-2 w-4 h-4 bg-[#161b22] border-b border-l border-[#d9b114]/60 rotate-45 transform" />
          )}

          {/* Línea superior dorada estilo Cyber-Fintech */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d9b114] to-transparent opacity-80" />

          {/* Cabecera del anuncio Glass */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 font-mono text-[10px] font-bold text-[#d9b114] tracking-wider uppercase">
                <StepIcon className="w-3 h-3" />
                {currentStep.badge}
              </span>
              <span className="text-[11px] font-mono text-[#8b949e]">
                {currentStepIndex + 1} / {TOUR_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
              title="Cerrar tour (Escape)"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título y Explicación */}
          <div className="space-y-1">
            <h3 id="glass-tour-title" className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>{currentStep.title}</span>
            </h3>
            <p className="text-[11px] sm:text-xs font-semibold text-[#d9b114]">
              {currentStep.subtitle}
            </p>
            <p className="text-xs text-[#8b949e] leading-relaxed pt-1">
              {currentStep.description}
            </p>
          </div>

          {/* Puntos de progreso interactivos */}
          <div className="flex items-center gap-1.5 py-0.5">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-6 bg-[#d9b114]'
                    : idx < currentStepIndex
                    ? 'w-2 bg-[#00ff66]'
                    : 'w-2 bg-[#30363d] hover:bg-[#8b949e]'
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Footer del Anuncio: Casilla y Botones de Control */}
          <div className="pt-2 border-t border-[#30363d]/80 flex flex-col gap-2.5">
            {/* Casilla de verificación: No volver a mostrar al iniciar sesión */}
            <label className="flex items-center gap-2 text-[11px] text-[#8b949e] hover:text-white cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={handleToggleDontShow}
                className="w-3.5 h-3.5 rounded border-[#30363d] bg-[#0b0e14] text-[#d9b114] accent-[#d9b114] cursor-pointer"
              />
              <span>No volver a mostrar al iniciar sesión</span>
            </label>

            {/* Botones de Navegación Desplazante */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
              >
                Omitir
              </button>

              <div className="flex items-center gap-1.5">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#21262d] hover:bg-[#30363d] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0b0e14] bg-[#d9b114] hover:bg-[#c49f10] active:scale-95 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>{isLastStep ? 'Finalizar Tour' : 'Siguiente'}</span>
                  {isLastStep ? <ArrowRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
