import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
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
  isFixedTarget?: boolean;
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
    fallbackSelector: 'aside, nav',
    isFixedTarget: true,
    targetName: 'DEPORTES Y LIGAS',
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
    isFixedTarget: true,
    targetName: 'BUSCADOR Y FECHAS',
    badge: 'PASO 2 DE 5',
    title: 'Buscador Inteligente & Fechas',
    subtitle: 'Programación y consulta por fechas',
    descriptionDesktop:
      'Encuentra equipos, jugadores o torneos al instante. Utiliza el selector de fechas para consultar partidos de hoy, mañana o hasta con 5 días de anticipación.',
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
    isFixedTarget: false,
    targetName: 'CUOTAS Y SEÑAL +EV',
    badge: 'PASO 3 DE 5',
    title: 'Probabilidades Reales & Señal +EV',
    subtitle: 'Ventaja matemática cuantitativa',
    descriptionDesktop:
      'El modelo matemático calcula la probabilidad pura del encuentro y la Cuota Justa. Si la casa paga por encima del valor real, se activa la señal verde +EV.',
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
    isFixedTarget: false,
    targetName: 'HISTORIAL H2H',
    badge: 'PASO 4 DE 5',
    title: 'Radiografía H2H & Ritmo de Juego',
    subtitle: 'Cara a cara y rachas determinísticas',
    descriptionDesktop:
      'Abre la radiografía del partido para examinar los últimos 5 duelos directos, rachas de victorias consecutivas (ej. 🔥 +3V) y tendencias históricas de Altas / Bajas.',
    descriptionMobile:
      'Pulsa en Cuotas para ver el cara a cara de los últimos 5 duelos directos, rachas de victorias (ej. 🔥 +3V) y tendencias de Altas / Bajas.',
    icon: Flame,
    desktopPlacement: 'bottom',
    mobilePlacement: 'bottom'
  },
  {
    desktopSelector: '[data-tour="tour-header-actions"]',
    mobileSelector: '[data-tour="tour-header-actions"]',
    fallbackSelector: 'header button',
    isFixedTarget: true,
    targetName: 'ACCIONES Y GUÍA',
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

type ArrowDirection = 'top' | 'bottom' | 'left' | 'none';

/**
 * Encuentra el primer nodo del DOM realmente visible (ignora elementos ocultos con display:none o 0x0)
 */
function findVisibleElement(selectorList: string): HTMLElement | null {
  if (typeof document === 'undefined' || !selectorList) return null;
  const nodes = document.querySelectorAll<HTMLElement>(selectorList);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }
    return node;
  }
  return null;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 120, left: 24 });
  const [arrowDirection, setArrowDirection] = useState<ArrowDirection>('none');
  const [arrowOffset, setArrowOffset] = useState<number>(40);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gmetrics_hide_onboarding_tour') === 'true';
    } catch {
      return false;
    }
  });

  const cardRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, [onClose]);

  // 1. Bloqueo estricto del scroll en body y html mientras el tour esté activo
  useEffect(() => {
    if (!isOpen) return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyTouch = bodyEl.style.touchAction;

    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    bodyEl.style.touchAction = 'none';

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.touchAction = prevBodyTouch;
    };
  }, [isOpen]);

  // 2. Notificar a la aplicación para ocultar pop-ups (PWA install & feedback) durante el tour
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

  // 3. Medición síncrona y posicionamiento sin saltos ni desbordes
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const isMobileView = vpW < 1024;
    const primarySelector = isMobileView ? currentStep.mobileSelector : currentStep.desktopSelector;

    let el = findVisibleElement(primarySelector);
    if (!el && currentStep.fallbackSelector) {
      el = findVisibleElement(currentStep.fallbackSelector);
    }

    const cardW = Math.min(440, vpW - 32);
    const cardH = cardRef.current?.offsetHeight || 295;

    if (!el) {
      setTargetRect(null);
      setCardPos({
        left: Math.max(16, (vpW - cardW) / 2),
        top: Math.max(24, (vpH - cardH) / 2)
      });
      setArrowDirection('none');
      return;
    }

    // Sincronizar scroll de forma instantánea ANTES de medir getBoundingClientRect()
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const lockedHtml = htmlEl.style.overflow;
    const lockedBody = bodyEl.style.overflow;
    htmlEl.style.overflow = '';
    bodyEl.style.overflow = '';

    if (currentStep.isFixedTarget) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    } else {
      const rawRect = el.getBoundingClientRect();
      if (rawRect.top < 108 || rawRect.top > 200) {
        window.scrollBy({ top: rawRect.top - 125, behavior: 'instant' as ScrollBehavior });
      }
    }

    const rect = el.getBoundingClientRect();

    htmlEl.style.overflow = lockedHtml;
    bodyEl.style.overflow = lockedBody;

    // Clamping de los 4 bordes del recorte spotlight dentro del viewport
    const pad = 6;
    const safeLeft = Math.max(8, Math.round(rect.left - pad));
    const safeTop = Math.max(8, Math.round(rect.top - pad));
    const safeRight = Math.min(vpW - 8, Math.round(rect.right + pad));
    const safeBottom = Math.min(vpH - 8, Math.round(rect.bottom + pad));
    const safeWidth = Math.max(36, safeRight - safeLeft);
    const safeHeight = Math.max(32, safeBottom - safeTop);

    const computedRect: ElementRect = {
      top: safeTop,
      left: safeLeft,
      width: safeWidth,
      height: safeHeight,
      bottom: safeTop + safeHeight,
      right: safeLeft + safeWidth
    };
    setTargetRect(computedRect);

    const targetCenterX = computedRect.left + computedRect.width / 2;
    const targetCenterY = computedRect.top + computedRect.height / 2;

    const preferred = isMobileView
      ? currentStep.mobilePlacement || 'bottom'
      : currentStep.desktopPlacement || 'bottom';

    let finalTop = 80;
    let finalLeft = 16;
    let chosenArrow: ArrowDirection = 'none';
    let chosenArrowOffset = cardW / 2;

    if (preferred === 'right' && computedRect.right + cardW + 28 < vpW) {
      chosenArrow = 'left';
      finalLeft = computedRect.right + 18;
      finalTop = Math.max(20, Math.min(targetCenterY - cardH / 2, vpH - cardH - 20));
      chosenArrowOffset = Math.max(28, Math.min(targetCenterY - finalTop - 9, cardH - 36));
    } else if (preferred === 'top' && computedRect.top - cardH - 20 >= 16) {
      chosenArrow = 'bottom';
      finalTop = computedRect.top - cardH - 16;
      finalLeft = Math.max(16, Math.min(targetCenterX - cardW / 2, vpW - cardW - 16));
      chosenArrowOffset = Math.max(24, Math.min(targetCenterX - finalLeft - 9, cardW - 40));
    } else if (computedRect.bottom + cardH + 20 <= vpH - 16) {
      chosenArrow = 'top';
      finalTop = computedRect.bottom + 16;
      finalLeft = Math.max(16, Math.min(targetCenterX - cardW / 2, vpW - cardW - 16));
      chosenArrowOffset = Math.max(24, Math.min(targetCenterX - finalLeft - 9, cardW - 40));
    } else if (computedRect.top - cardH - 20 >= 16) {
      chosenArrow = 'bottom';
      finalTop = computedRect.top - cardH - 16;
      finalLeft = Math.max(16, Math.min(targetCenterX - cardW / 2, vpW - cardW - 16));
      chosenArrowOffset = Math.max(24, Math.min(targetCenterX - finalLeft - 9, cardW - 40));
    } else {
      chosenArrow = 'none';
      finalTop = Math.max(20, (vpH - cardH) / 2);
      finalLeft = Math.max(16, (vpW - cardW) / 2);
    }

    finalTop = Math.max(20, Math.min(finalTop, vpH - cardH - 20));
    finalLeft = Math.max(16, Math.min(finalLeft, vpW - cardW - 16));

    setCardPos({ top: finalTop, left: finalLeft });
    setArrowDirection(chosenArrow);
    setArrowOffset(chosenArrowOffset);
  }, [isOpen, currentStepIndex]);

  // Medición síncrona tras actualizar el contenido del paso para que cardH sea exacto
  useLayoutEffect(() => {
    if (!isOpen) return;
    updateTargetPosition();
  }, [isOpen, currentStepIndex, updateTargetPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, updateTargetPosition]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStepIndex, handleClose]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // Atajos de teclado
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    },
    [isOpen, handleClose, handleNext, handlePrev]
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

  return (
    <div
      data-tour-active="true"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[80] overflow-hidden select-none overscroll-none touch-none pointer-events-none"
    >
      {/* 1. MÁSCARA SVG SPOTLIGHT (Opacidad 0.52 para mantener visibilidad y contraste del vidrio esmerilado) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer"
        onClick={handleClose}
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
                  transition: 'all 0.55s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(4, 7, 13, 0.52)"
          mask="url(#gmetrics-tour-spotlight-mask)"
        />
      </svg>

      {/* 2. ANILLO SPOTLIGHT LIMPIO (Sin píldoras de texto externas que tapen la UI o se corten) */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[81] rounded-2xl border-2 border-[#d9b114] shadow-[0_0_28px_rgba(217,177,20,0.65),inset_0_0_12px_rgba(217,177,20,0.22)]"
          style={{
            top: 0,
            left: 0,
            width: targetRect.width,
            height: targetRect.height,
            transform: `translate3d(${targetRect.left}px, ${targetRect.top}px, 0)`,
            transition:
              'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), width 0.55s cubic-bezier(0.22, 1, 0.36, 1), height 0.55s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        />
      )}

      {/* 3. TARJETA FROSTED LIQUID GLASS CON PUNTERO DIRECCIONAL */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-tour-title"
        className="fixed top-0 left-0 z-[85] pointer-events-auto max-w-[92vw] sm:max-w-[440px] w-full"
        style={{
          transform: `translate3d(${cardPos.left}px, ${cardPos.top}px, 0)`,
          transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out',
          willChange: 'transform'
        }}
      >
        <div
          className="relative rounded-3xl border border-white/25 ring-1 ring-[#d9b114]/35 p-5 sm:p-6 text-white flex flex-col gap-3.5 shadow-[0_28px_64px_-12px_rgba(0,0,0,0.75),0_0_32px_rgba(217,177,20,0.16),inset_0_1px_1px_rgba(255,255,255,0.25)]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(30, 41, 59, 0.52) 45%, rgba(15, 23, 42, 0.62) 100%)',
            backdropFilter: 'blur(24px) saturate(190%)',
            WebkitBackdropFilter: 'blur(24px) saturate(190%)'
          }}
        >
          {/* Puntero direccional de cristal apuntando al centro geométrico del elemento */}
          {arrowDirection === 'top' && (
            <div
              className="absolute -top-[9px] pointer-events-none"
              style={{ left: arrowOffset }}
              aria-hidden="true"
            >
              <svg width="18" height="10" viewBox="0 0 18 10">
                <path d="M1 10 L9 1 L17 10 Z" fill="rgba(30, 41, 59, 0.72)" />
                <path
                  d="M1 9.5 L9 1 L17 9.5"
                  fill="none"
                  stroke="rgba(217, 177, 20, 0.75)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}

          {arrowDirection === 'bottom' && (
            <div
              className="absolute -bottom-[9px] pointer-events-none"
              style={{ left: arrowOffset }}
              aria-hidden="true"
            >
              <svg width="18" height="10" viewBox="0 0 18 10">
                <path d="M1 0 L9 9 L17 0 Z" fill="rgba(15, 23, 42, 0.75)" />
                <path
                  d="M1 0.5 L9 9 L17 0.5"
                  fill="none"
                  stroke="rgba(217, 177, 20, 0.75)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}

          {arrowDirection === 'left' && (
            <div
              className="absolute -left-[9px] pointer-events-none"
              style={{ top: arrowOffset }}
              aria-hidden="true"
            >
              <svg width="10" height="18" viewBox="0 0 10 18">
                <path d="M10 1 L1 9 L10 17 Z" fill="rgba(30, 41, 59, 0.72)" />
                <path
                  d="M9.5 1 L1 9 L9.5 17"
                  fill="none"
                  stroke="rgba(217, 177, 20, 0.75)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}

          {/* Reflejo especular blanco superior y resplandor interno del vidrio */}
          <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 bg-[#d9b114]/15 rounded-full blur-2xl" />
          <div className="pointer-events-none absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/55 to-transparent" />

          {/* Cabecera del Glass Modal con targetName integrado (sin encimarse con el foco) */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d9b114]/20 border border-[#d9b114]/50 font-mono text-[10px] font-bold text-[#d9b114] tracking-wider uppercase shrink-0">
                <StepIcon className="w-3.5 h-3.5" />
                {currentStep.badge}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 font-mono text-[10px] font-semibold text-white/90 tracking-wide uppercase truncate max-w-[175px] sm:max-w-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114] animate-pulse shrink-0" />
                <span className="truncate">{currentStep.targetName}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              title="Cerrar tour (Escape)"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título y Explicación con espaciado limpio */}
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
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-0.5">
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
                    ? 'w-7 bg-[#d9b114] shadow-[0_0_10px_rgba(217,177,20,0.6)]'
                    : idx < currentStepIndex
                    ? 'w-2 bg-[#00ff66]'
                    : 'w-2 bg-white/25 hover:bg-white/45'
                }`}
                title={`Ir al paso ${idx + 1}: ${step.title}`}
              />
            ))}
          </div>

          {/* Footer del Glass Modal: Casilla y Botones */}
          <div className="pt-3 border-t border-white/15 flex flex-col gap-3 relative z-10">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={handleToggleDontShow}
                className="w-4 h-4 rounded border-white/30 bg-black/40 text-[#d9b114] accent-[#d9b114] cursor-pointer"
              />
              <span>No volver a mostrar al iniciar sesión</span>
            </label>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Omitir
              </button>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer backdrop-blur-md"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#0b0e14] bg-gradient-to-r from-[#d9b114] to-[#f59e0b] hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(217,177,20,0.45)] cursor-pointer"
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
