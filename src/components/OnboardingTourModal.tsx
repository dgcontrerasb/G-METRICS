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
  desktopSelector: string;
  mobileSelector: string;
  fallbackSelector?: string;
  targetName: string;
  badge: string;
  title: string;
  subtitle: string;
  descriptionDesktop: string;
  descriptionMobile: string;
  icon: React.ComponentType<{ className?: string }>;
  desktopPlacement?: 'bottom' | 'top' | 'right' | 'left';
  mobilePlacement?: 'bottom' | 'top' | 'right' | 'left';
}

const TOUR_STEPS: TourStep[] = [
  {
    desktopSelector: '[data-tour="tour-sports"]',
    mobileSelector: '[data-tour="tour-mobile-menu"]',
    fallbackSelector: 'header, aside',
    targetName: 'DEPORTES & LIGAS',
    badge: 'PASO 1 DE 5',
    title: 'Selector de Deportes & Ligas',
    subtitle: 'Navegación unificada Fútbol y NBA',
    descriptionDesktop:
      'Alterna al instante entre fútbol y baloncesto NBA en un clic. En esta barra lateral también accedes a ligas principales, torneos destacados y Top Picks.',
    descriptionMobile:
      'Toca "Ligas y menú" para alternar entre Fútbol y NBA, explorar todas las competiciones y filtrar tus Top Picks con ventaja matemática.',
    icon: SlidersHorizontal,
    desktopPlacement: 'right',
    mobilePlacement: 'top'
  },
  {
    desktopSelector: '[data-tour="tour-search-date"]',
    mobileSelector: '[data-tour="tour-search-date"]',
    fallbackSelector: 'header input[type="text"], header',
    targetName: 'BUSCADOR & CALENDARIO',
    badge: 'PASO 2 DE 5',
    title: 'Buscador Inteligente & Fechas',
    subtitle: 'Programación y consulta por fechas',
    descriptionDesktop:
      'Encuentra equipos, jugadores o torneos al instante. Utiliza el selector de fechas para consultar partidos de hoy, mañana o programaciones hasta con 5 días de anticipación.',
    descriptionMobile:
      'Busca cualquier equipo o torneo en tiempo real. Usa el selector de fechas para ver partidos de hoy, mañana o hasta con 5 días de programación.',
    icon: Search,
    desktopPlacement: 'bottom',
    mobilePlacement: 'bottom'
  },
  {
    desktopSelector: '[data-tour="tour-match-card"]',
    mobileSelector: '[data-tour="tour-match-card"]',
    fallbackSelector: '.grid > div:first-child',
    targetName: 'TARJETA DE PARTIDO & +EV',
    badge: 'PASO 3 DE 5',
    title: 'Probabilidades Reales & Señal +EV',
    subtitle: 'Ventaja matemática cuantitativa',
    descriptionDesktop:
      'El modelo matemático calcula la probabilidad pura del encuentro y la Cuota Justa. Si la casa paga por encima del valor real, se activa la señal verde +EV (Ventaja a tu favor).',
    descriptionMobile:
      'El modelo calcula la probabilidad real y la Cuota Justa. Si la casa paga por encima de su valor, verás la alerta verde +EV con ventaja matemática.',
    icon: TrendingUp,
    desktopPlacement: 'bottom',
    mobilePlacement: 'bottom'
  },
  {
    desktopSelector: '[data-tour="tour-h2h-btn"]',
    mobileSelector: '[data-tour="tour-h2h-btn"]',
    fallbackSelector: '[data-tour="tour-match-card"] button',
    targetName: 'HISTORIAL DIRECTO (H2H)',
    badge: 'PASO 4 DE 5',
    title: 'Radiografía H2H & Ritmo de Juego',
    subtitle: 'Cara a cara y rachas determinísticas',
    descriptionDesktop:
      'Abre la radiografía del partido para examinar los últimos 5 duelos directos, rachas de victorias consecutivas (ej. 🔥 +3V) y tendencias históricas de Altas / Bajas.',
    descriptionMobile:
      'Pulsa en Cuotas para ver el cara a cara de los últimos 5 duelos directos, rachas de victorias (ej. 🔥 +3V) y tendencias de Altas / Bajas.',
    icon: Flame,
    desktopPlacement: 'top',
    mobilePlacement: 'top'
  },
  {
    desktopSelector: '[data-tour="tour-header-actions"]',
    mobileSelector: '[data-tour="tour-header-actions"]',
    fallbackSelector: 'header [data-tour="tour-header-actions"], header button',
    targetName: 'ACCIONES & EXPORTACIÓN',
    badge: 'PASO 5 DE 5',
    title: 'Sincronización, Exportación & Guía',
    subtitle: 'Herramientas profesionales del terminal',
    descriptionDesktop:
      'Sincroniza marcadores y cuotas en tiempo real, exporta informes cuantitativos en Excel (.csv) o PDF, y consulta la Guía didáctica con el Glosario A-Z.',
    descriptionMobile:
      'Sincroniza marcadores en directo, descarga informes en Excel o PDF y consulta la Guía didáctica con el Glosario A-Z en cualquier momento.',
    icon: FileSpreadsheet,
    desktopPlacement: 'bottom',
    mobilePlacement: 'bottom'
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

  // 1. BLOQUEAR EL SCROLL DEL BODY MIENTRAS EL TOUR ESTÉ ACTIVO (PC & Móvil)
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // 2. Notificar a la aplicación para ocultar pop-ups (ej. instalación PWA)
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

  // Reset al paso 1 al abrirse
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

  // 3. Localizar elemento objetivo según dispositivo (Mobile vs Desktop) y posicionar
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;
    const primarySelector = isMobileView ? currentStep.mobileSelector : currentStep.desktopSelector;

    let el = document.querySelector(primarySelector);

    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const cardW = Math.min(440, vpW - 32);
    // Medir altura real del DOM para que el cálculo nunca recorte texto
    const cardH = cardRef.current?.offsetHeight || 310;

    if (!el) {
      // Resguardo centrado elegante
      setTargetRect(null);
      setCardPos({
        left: Math.max(16, (vpW - cardW) / 2),
        top: Math.max(24, (vpH - cardH) / 2)
      });
      return;
    }

    // Scroll suave sólo si fuera estrictamente necesario, centrado en pantalla
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = el.getBoundingClientRect();
    const padding = 8;

    // Margen seguro mínimo de 14px respecto al borde superior de la pantalla
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

    // Determinar la ubicación de la tarjeta Glass según pantalla
    let finalTop = 80;
    let finalLeft = 20;

    const preferred = isMobileView
      ? currentStep.mobilePlacement || 'bottom'
      : currentStep.desktopPlacement || 'bottom';

    if (preferred === 'right' && computedRect.right + cardW + 24 < vpW) {
      // Lateral derecho (menú lateral en PC)
      finalLeft = computedRect.right + 20;
      finalTop = Math.max(24, Math.min(computedRect.top, vpH - cardH - 24));
    } else if (preferred === 'top' && computedRect.top - cardH - 20 > 0) {
      // Arriba del elemento
      finalTop = computedRect.top - cardH - 16;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else if (computedRect.bottom + cardH + 20 < vpH) {
      // Abajo del elemento
      finalTop = Math.max(computedRect.bottom + 16, 65);
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else if (computedRect.top - cardH - 20 > 0) {
      // Fallback arriba
      finalTop = computedRect.top - cardH - 16;
      finalLeft = Math.max(16, Math.min(computedRect.left + (computedRect.width - cardW) / 2, vpW - cardW - 16));
    } else {
      // Centrado seguro en viewport
      finalTop = Math.max(24, (vpH - cardH) / 2);
      finalLeft = Math.max(16, (vpW - cardW) / 2);
    }

    // Clamp riguroso para asegurar que la tarjeta NUNCA se corte contra el borde superior ni inferior
    finalTop = Math.max(20, Math.min(finalTop, vpH - cardH - 20));
    finalLeft = Math.max(16, Math.min(finalLeft, vpW - cardW - 16));

    setCardPos({ top: finalTop, left: finalLeft });
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(updateTargetPosition, 60);

    const handleResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const stepDescription = isMobile ? currentStep.descriptionMobile : currentStep.descriptionDesktop;

  // Detección de colisión de la baliza focal para que NUNCA se corte a la derecha o arriba
  const isTargetNearTop = targetRect ? targetRect.top < 45 : false;
  const isTargetNearRight = targetRect ? targetRect.left + 190 > (typeof window !== 'undefined' ? window.innerWidth : 400) : false;

  return (
    <div
      data-tour-active="true"
      className="fixed inset-0 z-[80] overflow-hidden select-none pointer-events-none"
    >
      {/* 1. MÁSCARA SVG SPOTLIGHT LÍQUIDA (Recorte fluido con desenfoque de cristal) */}
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

      {/* 2. ANILLO SPOTLIGHT LUMINOSO CON BALIZA FOCAL SEGURA (No obstruye ni se corta) */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[81] rounded-2xl border-2 border-[#d9b114] shadow-[0_0_35px_rgba(217,177,20,0.65),inset_0_0_15px_rgba(217,177,20,0.3)]"
          style={{
            top: 0,
            left: 0,
            width: targetRect.width,
            height: targetRect.height,
            transform: `translate3d(${targetRect.left}px, ${targetRect.top}px, 0)`,
            transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), width 0.65s cubic-bezier(0.22, 1, 0.36, 1), height 0.65s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {/* Micro-baliza focal: se alinea dinámicamente para no cortarse contra ningún borde */}
          <div
            className={`absolute whitespace-nowrap max-w-[calc(100vw-36px)] truncate px-2.5 py-0.5 rounded-full bg-[#d9b114] text-[#0b0e14] font-mono text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all duration-300 select-none z-20 ${
              isTargetNearRight ? 'right-2' : 'left-2'
            } ${isTargetNearTop ? 'top-full mt-2' : '-top-3.5'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0b0e14] animate-ping shrink-0" />
            <span>{currentStep.targetName}</span>
          </div>
        </div>
      )}

      {/* 3. MODAL ANUNCIO TIPO GLASS (Auténtico Toque Glass: Translúcido con luz especular) */}
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
        <div
          className="relative rounded-3xl border border-[#d9b114]/40 p-5 sm:p-6 text-white flex flex-col gap-4 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(217,177,20,0.18),inset_0_1px_1px_rgba(255,255,255,0.15)]"
          style={{
            background: 'rgba(11, 14, 20, 0.72)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)'
          }}
        >
          {/* Luz ambiental sutil y brillo superior especular de cristal */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#d9b114]/12 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d9b114]/80 to-transparent" />

          {/* Cabecera del Glass Modal */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/45 font-mono text-[10.5px] font-bold text-[#d9b114] tracking-wider uppercase shrink-0">
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
              className="p-1.5 rounded-xl text-[#8b949e] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Cerrar tour (Escape)"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título y Explicación sin textos montados ni cortados */}
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
              {stepDescription}
            </p>
          </div>

          {/* Puntos de progreso interactivos de cristal */}
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
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Ir al paso ${idx + 1}: ${step.title}`}
              />
            ))}
          </div>

          {/* Footer del Glass Modal: Casilla y Botones de Control */}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-3 relative z-10">
            {/* Casilla de verificación: No volver a mostrar al iniciar sesión */}
            <label className="flex items-center gap-2.5 text-xs text-[#94a3b8] hover:text-white cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={handleToggleDontShow}
                className="w-4 h-4 rounded border-[#30363d] bg-[#0b0e14]/80 text-[#d9b114] accent-[#d9b114] cursor-pointer"
              />
              <span>No volver a mostrar al iniciar sesión</span>
            </label>

            {/* Botones de Navegación con Toque Glass */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Omitir
              </button>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 active:scale-95 transition-all flex items-center gap-1 cursor-pointer backdrop-blur-md"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#0b0e14] bg-gradient-to-r from-[#d9b114] to-[#f59e0b] hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(217,177,20,0.4)] cursor-pointer"
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
