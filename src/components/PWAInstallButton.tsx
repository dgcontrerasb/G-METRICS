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

  // Control del banner flotante temporal (aparece al ingresar y se desvanece tras 10 segundos)
  useEffect(() => {
    if (variant !== 'floating') return;
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

    const showTimer = window.setTimeout(() => {
      setFloatingStage('visible');
      try {
        sessionStorage.setItem(SESSION_FLOATING_SHOWN_KEY, 'true');
      } catch {
        // Ignore
      }
    }, 1200);

    return () => window.clearTimeout(showTimer);
  }, [variant, isInstalled, isInstallable, isAndroid, isIOS, isMobile]);

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
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-5 shadow-2xl text-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              {showGuideModal === 'IOS' ? 'Instalar Web App en iPhone / iPad' : 'Instalar Web App en Android'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowGuideModal(null);
                if (variant === 'floating') setFloatingStage('fading');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {showGuideModal === 'IOS' ? (
            <div className="mt-3 text-xs text-slate-300 space-y-2.5 leading-relaxed">
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
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
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  Toca el menú de Chrome <MoreVertical className="w-3.5 h-3.5 inline text-emerald-400" /> arriba a la derecha.
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
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
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white cursor-pointer transition-colors"
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
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 hover:text-white text-xs font-bold transition text-left cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Instalar Web App</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // Variante 2: Botón discreto en el pie de página (PC y Móvil)
  if (variant === 'footer') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5"
          title="Instalar SportStats Pro como aplicación nativa en tu dispositivo"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
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
        className={`fixed bottom-20 sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:w-[360px] z-50 transition-all duration-500 ease-out ${
          floatingStage === 'visible'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-emerald-500/35 shadow-2xl shadow-black/70 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 border border-emerald-400/35 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Instalar SportStats Pro
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                Acceso directo y pantalla completa en 1 clic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold shadow-md shadow-emerald-950/50 cursor-pointer transition-all active:scale-95"
            >
              <Download className="w-3 h-3" />
              <span>Instalar</span>
            </button>
            <button
              type="button"
              onClick={() => setFloatingStage('fading')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              title="Cerrar recomendación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {renderGuideModal()}
    </>
  );
};
