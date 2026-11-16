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
  Layers,
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
      'Alterna al instante entre fútbol mundial y baloncesto NBA. En este panel lateral también filtras tus Top Picks con ventaja matemática y despliegas las ligas destacadas.',
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
      'Presiona este botón para inspeccionar los últimos 5 duelos directos, rachas de victorias consecutivas (ej. 🔥 +3V) y tendencias de Altas / Bajas con línea de referencia.',
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
      'Sincroniza marcadores en tiempo real, exporta informes en Excel (.csv) o PDF, y construye tus combinadas en el Parlay Slip con cálculo de probabilidad correlacionada.',
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

  // Avisar a la app del estado del tour (para suprimir banners como el de instalación PWA)
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

  // Localizar elemento en el DOM y calcular dimensiones del Spotlight sin pegar al borde superior
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    let el = document.querySelector(currentStep.selector);

    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const cardW = Math.min(420, vpW - 32);
    const cardH = 260;

    if (!el) {
      // Centrar suavemente en resguardo
      setTargetRect(null);
      setCardPos({
        left: Math.max(16, (vpW - cardW) / 2),
        top: Math.max(30, (vpH - cardH) / 2)
      });
      setArrowSide('none');
      return;
    }

    // Scroll suave al centro visual
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = el.getBoundingClientRect();
    const padding = 8;

    // Protección de borde superior: Garantizar siempre margen seguro del techo del navegador (mínimo 14px)
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

    // Posicionamiento inteligente del Anuncio Tipo Glass
    let finalTop = 80;
    let finalLeft = 20;
    let chosenArrow: 'top' | 'bottom' | 'left' | 'right' | 'none' = 'top';

    const preferred = currentStep.preferredPlacement || 'bottom';

    if (preferred === 'right' && computedRect.right + cardW + 24 < vpW) {
      // Lado derecho (ideal para sidebar desktop)
      finalLeft = computedRect.right + 20;
      finalTop = Math.max(24, Math.min(computedRect.top, vpH - cardH - 24));
      chosenArrow = 'left';
    } else if (preferred === 'top' && computedRect.top - cardH - 28 > 0) {
      // Arriba del elemento
      finalTop = computedRect.top - cardH - 20;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'bottom';
    } else if (computedRect.bottom + cardH + 24 < vpH) {
      // Abajo del elemento
      finalTop = Math.max(computedRect.bottom + 18, 60);
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'top';
    } else if (computedRect.top - cardH - 24 > 0) {
      // Fallback arriba
      finalTop = computedRect.top - cardH - 20;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
      chosenArrow = 'bottom';
    } else {
      // Resguardo centrado dentro de límites
      finalTop = Math.max(24, (vpH - cardH) / 2);
      finalLeft = Math.max(16, (vpW - cardW) / 2);
      chosenArrow = 'none';
    }

    // Clamp seguro para no cortar nunca la tarjeta contra ningún borde
    finalTop = Math.max(20, Math.min(finalTop, vpH - cardH - 24));
    finalLeft = Math.max(16, Math.min(finalLeft, vpW - cardW - 16));

    setCardPos({ top: finalTop, left: finalLeft });
    setArrowSide(chosenArrow);
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

  // Si el objetivo está muy cerca del techo del navegador, colocar la etiqueta de la baliza abajo del elemento para no cortarla
  const isTargetNearTop = targetRect ? targetRect.top < 38 : false;

  return (
    <div
      data-tour-active="true"
      className="fixed inset-0 z-[80] overflow-hidden select-none pointer-events-none"
    >
      {/* 1. MÁSCARA SVG SPOTLIGHT (Transición líquida de recorte con GPU easing) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      >
        <defs>
          <mask id="gmetrics-tour-spotlight-mask">
            {/* Base blanca = atenuado */}
            <rect width="100%" height="100%" fill="white" />
            {/* Ventana de recorte transparente que se desplaza suavemente */}
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

        {/* Fondo oscuro Cyber-Fintech con recorte fluido */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 8, 13, 0.76)"
          mask="url(#gmetrics-tour-spotlight-mask)"
        />
      </svg>

      {/* 2. ANILLO Y BALIZA LUMINOSA (Aceleración 3D por GPU sin reflows forzados) */}
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
          {/* Baliza indicadora: Se reposiciona abajo si está pegada al techo para no quedar cortada */}
          <div
            className={`absolute left-3 px-2.5 py-0.5 rounded-full bg-[#d9b114] text-[#0b0e14] font-mono text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg transition-all duration-300 ${
              isTargetNearTop ? 'top-full mt-2' : '-top-3.5'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0b0e14] animate-ping" />
            <span>{currentStep.targetName}</span>
          </div>
        </div>
      )}

      {/* 3. ANUNCIO TIPO GLASS (Estilo 21st.dev Glass Spotlight con traslación 3D fluida) */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-tour-title"
        className="fixed top-0 left-0 z-[85] pointer-events-auto max-w-[92vw] sm:max-w-[420px] w-full"
        style={{
          transform: `translate3d(${cardPos.left}px, ${cardPos.top}px, 0)`,
          transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease-out',
          willChange: 'transform'
        }}
      >
        <div className="relative rounded-3xl bg-[#161b22]/88 backdrop-blur-2xl border border-[#d9b114]/40 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(217,177,20,0.12),inset_0_1px_1px_rgba(255,255,255,0.12)] p-4 sm:p-5 text-white flex flex-col gap-3.5 overflow-hidden">
          {/* Flare radial ambiental sutil estilo 21st.dev Glass Spotlight */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#d9b114]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Flecha indicadora glass sin costuras */}
          {arrowSide === 'top' && (
            <div className="absolute -top-2 left-8 w-4 h-4 bg-[#161b22] border-t border-l border-[#d9b114]/50 rotate-45 transform" />
          )}
          {arrowSide === 'bottom' && (
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-[#161b22] border-b border-r border-[#d9b114]/50 rotate-45 transform" />
          )}
          {arrowSide === 'left' && (
            <div className="absolute top-8 -left-2 w-4 h-4 bg-[#161b22] border-b border-l border-[#d9b114]/50 rotate-45 transform" />
          )}

          {/* Reflejo superior dorado */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d9b114]/80 to-transparent" />

          {/* Cabecera del anuncio Glass */}
          <div className="flex items-center justify-between gap-2 pt-1 relative z-10">
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

          {/* Título y Contenido explicativo con suave transición al cambiar de paso */}
          <div
            key={currentStepIndex}
            className="space-y-1 relative z-10 animate-in fade-in-50 slide-in-from-bottom-1 duration-300"
          >
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
          <div className="flex items-center gap-1.5 py-0.5 relative z-10">
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

          {/* Footer del Anuncio: Casilla de exclusión y Botones de Control */}
          <div className="pt-2 border-t border-[#30363d]/80 flex flex-col gap-2.5 relative z-10">
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

            {/* Botones de Navegación Desplazante con curvas elásticas */}
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
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#21262d] hover:bg-[#30363d] active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
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
