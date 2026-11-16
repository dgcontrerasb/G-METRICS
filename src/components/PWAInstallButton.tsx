import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export interface PWAInstallButtonProps {
  variant?: 'floating' | 'menu-item' | 'footer';
  onAfterAction?: () => void;
}

const SESSION_FLOATING_SHOWN_KEY = 'sportstats_pwa_floating_shown_session';

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'floating',
  onAfterAction,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    install,
    markAsInstalledManually,
  } = usePWAInstall();

  const [showGuideModal, setShowGuideModal] = useState<'IOS' | 'ANDROID' | null>(null);
  const [floatingStage, setFloatingStage] = useState<'hidden' | 'visible' | 'fading' | 'gone'>('hidden');
  const [isTourActive, setIsTourActive] = useState<boolean>(() => {
    try {
      return typeof document !== 'undefined' && document.querySelector('[data-tour-active="true"]') !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleTourStatus = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOpen: boolean }>;
      setIsTourActive(Boolean(customEvent.detail?.isOpen));
    };
    window.addEventListener('gmetrics-tour-status', handleTourStatus);
    return () => window.removeEventListener('gmetrics-tour-status', handleTourStatus);
  }, []);

  // Control del banner flotante temporal (aparece al ingresar y se desvanece tras 10 segundos)
  useEffect(() => {
    if (variant !== 'floating') return;
    // En móviles desactivamos el banner flotante para evitar solapamientos visuales
    if (isMobile || isAndroid || isIOS) {
      setFloatingStage('gone');
      return;
    }
    if (isInstalled) {
      setFloatingStage('gone');
      return;
    }

    // Mostrar recomendación flotante si el navegador soporta instalación directa o es dispositivo móvil (Android/iOS)
    const shouldRecommend = isInstallable || isAndroid || isIOS || isMobile;
    if (!shouldRecommend) return;

    // Evitar que reaparezca en cada cambio de pestaña interna durante la misma visita si ya se desvaneció
    try {
      if (sessionStorage.getItem(SESSION_FLOATING_SHOWN_KEY) === 'true') {
        setFloatingStage('gone');
        return;
      }
    } catch {
      // Ignore sessionStorage errors
    }

    // Si el tour de inicio está activo, posponer la notificación para no interferir
    if (isTourActive) return;

    const showTimer = window.setTimeout(() => {
      setFloatingStage('visible');
      try {
        sessionStorage.setItem(SESSION_FLOATING_SHOWN_KEY, 'true');
      } catch {
        // Ignore
      }
    }, 1500);

    return () => window.clearTimeout(showTimer);
  }, [variant, isInstalled, isInstallable, isAndroid, isIOS, isMobile, isTourActive]);

  // Temporizador de auto-desvanecimiento (10 segundos visible -> 500ms fade out -> desmontaje)
  useEffect(() => {
    if (variant !== 'floating' || floatingStage !== 'visible' || showGuideModal !== null) return;

    const fadeTimer = window.setTimeout(() => {
      setFloatingStage('fading');
    }, 10000);

    return () => window.clearTimeout(fadeTimer);
  }, [variant, floatingStage, showGuideModal]);

  useEffect(() => {
    if (variant !== 'floating' || floatingStage !== 'fading') return;

    const removeTimer = window.setTimeout(() => {
      setFloatingStage('gone');
    }, 550);

    return () => window.clearTimeout(removeTimer);
  }, [variant, floatingStage]);

  // Si ya está instalada como PWA, jamás mostrar nada en ninguna variante
  if (isInstalled) {
    return null;
  }

  // La notificación flotante está expresamente desactivada en dispositivos móviles
  // En móviles el usuario ya cuenta con la opción limpia en el menú y en el pie de página
  if (variant === 'floating' && (isMobile || isAndroid || isIOS)) {
    return null;
  }

  const canOfferInstall = isInstallable || isAndroid || isIOS || isMobile;
  if (!canOfferInstall) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setFloatingStage('gone');
        onAfterAction?.();
        return;
      }
      if (outcome === 'dismissed') {
        setFloatingStage('fading');
        onAfterAction?.();
        return;
      }
    }

    if (isIOS) {
      setShowGuideModal('IOS');
      return;
    }

    // Fallback en Android / Chrome móvil si el navegador requiere abrir el menú de 3 puntos o si aún está cargando el prompt nativo
    setShowGuideModal('ANDROID');
  };

  const renderGuideModal = () => {
    if (!showGuideModal) return null;

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        {/* Backdrop blur (fondo muy visible y difuminado) */}
        <div
          onClick={() => {
            setShowGuideModal(null);
            if (variant === 'floating') setFloatingStage('fading');
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        />
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[#161b22] border border-[#30363d] p-5 shadow-2xl text-[#e6edf3] animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#21262d]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#d9b114]" strokeWidth={2} />
              {showGuideModal === 'IOS' ? 'Instalar Web App en iPhone / iPad' : 'Instalar Web App en Android'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowGuideModal(null);
                if (variant === 'floating') setFloatingStage('fading');
              }}
              className="p-1 rounded-lg text-[#8b949e] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {showGuideModal === 'IOS' ? (
            <div className="mt-3 text-xs text-slate-300 space-y-2.5 leading-relaxed">
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] font-mono tabular-nums font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] font-mono tabular-nums font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Desliza hacia abajo y selecciona <strong>&quot;Agregar a Inicio&quot;</strong>.
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-300 space-y-2.5 leading-relaxed">
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] font-mono tabular-nums font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  Toca el menú de Chrome <MoreVertical className="w-3.5 h-3.5 inline text-[#d9b114]" strokeWidth={2} /> arriba a la derecha.
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#d9b114]/15 border border-[#d9b114]/40 text-[#d9b114] font-mono tabular-nums font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                </span>
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setShowGuideModal(null);
                if (variant === 'floating') setFloatingStage('fading');
                onAfterAction?.();
              }}
              className="w-full cyber-chrome-chip cyber-chrome-chip-active py-2 text-xs font-bold cursor-pointer justify-center"
            >
              Entendido
            </button>
            <button
              type="button"
              onClick={() => {
                markAsInstalledManually();
                setShowGuideModal(null);
                setFloatingStage('gone');
                onAfterAction?.();
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#1c2129] border border-[#30363d] py-1.5 text-[11px] font-medium text-[#8b949e] hover:text-white cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
              <span>Ya la tengo instalada (no volver a mostrar)</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Variante 1: Opción limpia dentro del menú "Opciones" móvil
  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full cyber-chrome-chip cyber-chrome-chip-gold justify-start px-3 py-2.5 h-auto text-xs font-semibold cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#d9b114] shrink-0" strokeWidth={2} />
          <span>Instalar Web App</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // Variante 2: Botón discreto en el pie de página (PC y Móvil) unificado al chrome oscuro
  if (variant === 'footer') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="cyber-chrome-chip cyber-chrome-chip-gold h-7 px-2.5 text-[10.5px] font-semibold cursor-pointer"
          title="Instalar G METRICS como aplicación en tu dispositivo"
        >
          <Download className="w-3.5 h-3.5 text-[#d9b114] shrink-0" strokeWidth={2} />
          <span>Instalar App</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // Variante 3 (Por defecto): Recomendación Flotante Inteligente (Android, iOS y PC) que se desvanece tras 10 segundos
  if (floatingStage === 'hidden' || floatingStage === 'gone') {
    return renderGuideModal();
  }

  return (
    <>
      <div
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[360px] z-40 transition-all duration-500 ease-out ${
          floatingStage === 'visible' && !isTourActive
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#161b22]/95 backdrop-blur-xl border border-[#d9b114]/45 shadow-2xl shadow-black/70 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0b0e14] border border-[#d9b114]/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-[#d9b114]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Instalar G METRICS
              </p>
              <p className="text-[11px] text-[#8b949e] truncate">
                Acceso directo y pantalla completa en 1 clic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="cyber-chrome-chip cyber-chrome-chip-gold h-7 px-3 text-[11px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
              <span>Instalar</span>
            </button>
            <button
              type="button"
              onClick={() => setFloatingStage('fading')}
              className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#1c2129] cursor-pointer transition-colors"
              title="Cerrar recomendación"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {renderGuideModal()}
    </>
  );
};
