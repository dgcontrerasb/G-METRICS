import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  SlidersHorizontal,
  Search,
  TrendingUp,
  Flame,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowRight
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
      'Alterna al instante entre fútbol y baloncesto NBA en un solo clic. En esta barra lateral también accedes a ligas principales, torneos destacados y filtros rápidos.',
    icon: SlidersHorizontal,
    preferredPlacement: 'right'
  },
  {
    selector: '[data-tour="tour-search-date"]',
    fallbackSelector: 'header input[type="text"]',
    targetName: 'BUSCADOR & CALENDARIO',
    badge: 'PASO 2 DE 5',
    title: 'Buscador Inteligente & Fechas',
    subtitle: 'Programación y consulta por fechas',
    description:
      'Encuentra equipos, jugadores o torneos al instante. Utiliza el selector de fechas para consultar partidos de hoy, mañana o programaciones hasta con 5 días de anticipación.',
    icon: Search,
    preferredPlacement: 'bottom'
  },
  {
    selector: '[data-tour="tour-match-card"]',
    fallbackSelector: '.grid > div:first-child, [data-tour="tour-first-match"]',
    targetName: 'TARJETA DE PARTIDO & +EV',
    badge: 'PASO 3 DE 5',
    title: 'Probabilidades Reales & Señal +EV',
    subtitle: 'Ventaja matemática cuantitativa',
    description:
      'El modelo matemático calcula la probabilidad pura del encuentro y la Cuota Justa. Si la casa paga por encima del valor real, se activa la señal verde +EV (Ventaja a tu favor).',
    icon: TrendingUp,
    preferredPlacement: 'bottom'
  },
  {
    selector: '[data-tour="tour-h2h-btn"]',
    fallbackSelector: '[data-tour="tour-match-card"] button, button:has(svg)',
    targetName: 'HISTORIAL DIRECTO (H2H)',
    badge: 'PASO 4 DE 5',
    title: 'Radiografía H2H & Ritmo de Juego',
    subtitle: 'Cara a cara y rachas determinísticas',
    description:
      'Abre la radiografía del partido para examinar los últimos 5 duelos directos, rachas de victorias consecutivas (ej. 🔥 +3V) y tendencias históricas de Altas / Bajas.',
    icon: Flame,
    preferredPlacement: 'top'
  },
  {
    selector: '[data-tour="tour-header-actions"]',
    fallbackSelector: 'header [data-tour="tour-header-actions"], header button',
    targetName: 'ACCIONES & EXPORTACIÓN',
    badge: 'PASO 5 DE 5',
    title: 'Sincronización, Exportación & Guía',
    subtitle: 'Herramientas profesionales del terminal',
    description:
      'Sincroniza marcadores y cuotas en tiempo real, exporta informes cuantitativos en Excel (.csv) o PDF, y consulta la Guía didáctica con el glosario A-Z.',
    icon: FileSpreadsheet,
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
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gmetrics_hide_onboarding_tour') === 'true';
    } catch {
      return false;
    }
  });

  const cardRef = useRef<HTMLDivElement>(null);

  // Notificar a la app el estado del tour para aislar pop-ups (ej. instalación PWA)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gmetrics-tour-status', { detail: { isOpen } })
      );
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gmetrics-tour-status', { detail: { isOpen: false } })
        );
      }
    };
  }, [isOpen]);

  // Reset al paso inicial al abrirse
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

  // Cálculo de posición con medición real de altura para evitar cortes o encimados
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    let el = document.querySelector(currentStep.selector);

    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const cardW = Math.min(440, vpW - 32);
    // Medir la altura real del DOM para que el cálculo nunca recorte el texto inferior
    const cardH = cardRef.current?.offsetHeight || 290;

    if (!el) {
      // Resguardo centrado elegante
      setTargetRect(null);
      setCardPos({
        left: Math.max(16, (vpW - cardW) / 2),
        top: Math.max(28, (vpH - cardH) / 2)
      });
      return;
    }

    // Scroll suave para asegurar que el elemento esté centrado en el viewport
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = el.getBoundingClientRect();
    const padding = 8;

    // Asegurar margen seguro de al menos 14px respecto al borde superior de la pantalla
    const safeTop = Math.max(14, rect.top - padding);
    const safeLeft = Math.max(10, rect.left - padding);
    const safeWidth = Math.max(rect.width + padding * 2, 44);
    const safeHeight = Math.max(rect.height + padding * 2, 44);

    const computedRect: ElementRect = {
      top: safeTop,
      left: safeLeft,
      width: safeWidth,
      height: safeHeight,
      bottom: safeTop + safeHeight,
      right: safeLeft + safeWidth
    };
    setTargetRect(computedRect);

    // Calcular la posición del anuncio Glass sin solapar el elemento
    let finalTop = 80;
    let finalLeft = 20;

    const preferred = currentStep.preferredPlacement || 'bottom';

    if (preferred === 'right' && computedRect.right + cardW + 24 < vpW) {
      // Posición lateral derecha (ideal para el menú lateral en PC)
      finalLeft = computedRect.right + 20;
      finalTop = Math.max(24, Math.min(computedRect.top, vpH - cardH - 24));
    } else if (preferred === 'top' && computedRect.top - cardH - 28 > 0) {
      // Arriba del elemento
      finalTop = computedRect.top - cardH - 20;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else if (computedRect.bottom + cardH + 24 < vpH) {
      // Abajo del elemento
      finalTop = Math.max(computedRect.bottom + 18, 65);
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else if (computedRect.top - cardH - 24 > 0) {
      // Fallback arriba si abajo se corta
      finalTop = computedRect.top - cardH - 20;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else {
      // Centrado seguro en pantalla
      finalTop = Math.max(24, (vpH - cardH) / 2);
      finalLeft = Math.max(16, (vpW - cardW) / 2);
    }

    // Clamp riguroso para evitar que ningún borde quede cortado contra el viewport
    finalTop = Math.max(24, Math.min(finalTop, vpH - cardH - 24));
    finalLeft = Math.max(16, Math.min(finalLeft, vpW - cardW - 16));

    setCardPos({ top: finalTop, left: finalLeft });
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(updateTargetPosition, 60);

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

  // Si el objetivo está cerca del techo del navegador, colocar la baliza abajo del elemento para no cortarla
  const isTargetNearTop = targetRect ? targetRect.top < 42 : false;

  return (
    <div
      data-tour-active="true"
      className="fixed inset-0 z-[80] overflow-hidden select-none pointer-events-none"
    >
      {/* 1. MÁSCARA SVG SPOTLIGHT LÍQUIDA (Recorte fluido acelerado por hardware) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      >
        <defs>
          <mask id="gmetrics-tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="16"
                ry="16"
                fill="black"
                style={{
                  transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 8, 13, 0.76)"
          mask="url(#gmetrics-tour-spotlight-mask)"
        />
      </svg>

      {/* 2. ANILLO Y BALIZA LUMINOSA QUE SEÑALA EL OBJETIVO */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[81] rounded-2xl border-2 border-[#d9b114] shadow-[0_0_35px_rgba(217,177,20,0.5),inset_0_0_15px_rgba(217,177,20,0.2)]"
          style={{
            top: 0,
            left: 0,
            width: targetRect.width,
            height: targetRect.height,
            transform: `translate3d(${targetRect.left}px, ${targetRect.top}px, 0)`,
            transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), width 0.65s cubic-bezier(0.22, 1, 0.36, 1), height 0.65s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {/* Baliza identificadora: si está cerca del techo, se posiciona abajo para no quedar cortada */}
          <div
            className={`absolute left-3 whitespace-nowrap px-2.5 py-1 rounded-full bg-[#d9b114] text-[#0b0e14] font-mono text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all duration-300 select-none z-20 ${
              isTargetNearTop ? 'top-full mt-2' : '-top-3.5'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0b0e14] animate-ping shrink-0" />
            <span>{currentStep.targetName}</span>
          </div>
        </div>
      )}

      {/* 3. ANUNCIO TIPO GLASS (Estilo 21st.dev Glass Spotlight sin textos encimados ni cortes) */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-tour-title"
        className="fixed top-0 left-0 z-[85] pointer-events-auto max-w-[92vw] sm:max-w-[440px] w-full"
        style={{
          transform: `translate3d(${cardPos.left}px, ${cardPos.top}px, 0)`,
          transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease-out',
          willChange: 'transform'
        }}
      >
        <div className="relative rounded-3xl bg-[#161b22]/90 backdrop-blur-2xl border border-[#d9b114]/40 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(217,177,20,0.14),inset_0_1px_1px_rgba(255,255,255,0.12)] p-5 sm:p-6 text-white flex flex-col gap-4 overflow-hidden">
          {/* Flare radial ambiental dorado suave estilo 21st.dev */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#d9b114]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Línea superior dorada de acento */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d9b114]/80 to-transparent" />

          {/* Cabecera del anuncio Glass */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 font-mono text-[10.5px] font-bold text-[#d9b114] tracking-wider uppercase shrink-0">
                <StepIcon className="w-3.5 h-3.5" />
                {currentStep.badge}
              </span>
              <span className="text-xs font-mono text-[#8b949e] font-semibold tabular-nums shrink-0">
                {currentStepIndex + 1} de {TOUR_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer shrink-0"
              title="Cerrar tour (Escape)"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título y Contenido explicativo con espaciado limpio y legible */}
          <div
            key={currentStepIndex}
            className="space-y-1.5 relative z-10 animate-in fade-in-50 slide-in-from-bottom-1 duration-300"
          >
            <h3 id="glass-tour-title" className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs sm:text-[13px] font-semibold text-[#d9b114] leading-snug">
              {currentStep.subtitle}
            </p>
            <p className="text-xs sm:text-sm text-[#cbd5e1] leading-relaxed pt-0.5">
              {currentStep.description}
            </p>
          </div>

          {/* Puntos de progreso interactivos */}
          <div className="flex items-center gap-1.5 py-0.5 relative z-10">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-7 bg-[#d9b114]'
                    : idx < currentStepIndex
                    ? 'w-2 bg-[#00ff66]'
                    : 'w-2 bg-[#30363d] hover:bg-[#8b949e]'
                }`}
                title={`Ir al paso ${idx + 1}: ${step.title}`}
              />
            ))}
          </div>

          {/* Footer del Anuncio: Casilla de exclusión y Botones de Control */}
          <div className="pt-3 border-t border-[#30363d]/80 flex flex-col gap-3 relative z-10">
            {/* Casilla de verificación: No volver a mostrar al iniciar sesión */}
            <label className="flex items-center gap-2.5 text-xs text-[#8b949e] hover:text-white cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={handleToggleDontShow}
                className="w-4 h-4 rounded border-[#30363d] bg-[#0b0e14] text-[#d9b114] accent-[#d9b114] cursor-pointer"
              />
              <span>No volver a mostrar al iniciar sesión</span>
            </label>

            {/* Botones de Navegación Desplazante con curvas elásticas */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
              >
                Omitir
              </button>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#21262d] hover:bg-[#30363d] active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#0b0e14] bg-[#d9b114] hover:bg-[#c49f10] active:scale-95 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
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
