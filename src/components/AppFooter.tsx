import React, { useState } from 'react';
import { ActiveSport } from '../types';
import { GuideModalTab } from './DidacticGuideModal';
import { PWAInstallButton } from './PWAInstallButton';

export interface AppFooterProps {
  activeSport: ActiveSport;
  onOpenGuideModal: (tab?: GuideModalTab) => void;
  onOpenFeedbackModal?: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  activeSport,
  onOpenGuideModal,
  onOpenFeedbackModal
}) => {
  const [isLegalExpanded, setIsLegalExpanded] = useState(false);

  const capsuleClass =
    'px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/90 text-[10px] font-semibold transition cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap';

  return (
    <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md py-2.5 px-3 sm:px-5 mt-5 text-xs text-slate-600 relative z-10 shadow-2xs">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Fila 1: Identidad Centrada + Cápsulas Simétricas en 1 Sola Fila */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-center gap-2 text-center sm:text-left">
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-extrabold text-[9.5px] leading-none">
              +18
            </span>
            <div className="flex flex-col items-center sm:items-start justify-center">
              <span className="gmetrics-brand-title text-[12px] leading-none whitespace-nowrap">
                G METRICS
              </span>
              <span className="text-[6.5px] sm:text-[7px] font-extrabold uppercase tracking-tight text-slate-500 whitespace-nowrap leading-none mt-1">
                LA CIENCIA DETRÁS DE LA VICTORIA ({activeSport === 'NBA' ? 'Baloncesto' : 'Fútbol'})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 w-full sm:w-auto">
            <PWAInstallButton variant="footer" />
            {onOpenFeedbackModal && (
              <button
                type="button"
                onClick={onOpenFeedbackModal}
                className={capsuleClass}
              >
                <span>⭐ Calificar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenGuideModal('GLOSSARY')}
              className={capsuleClass}
            >
              <span>📖 Glosario</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('GUIDE')}
              className={capsuleClass}
            >
              <span>🧭 Guía</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('LEGAL')}
              className={capsuleClass}
            >
              <span>⚖️ Aviso Legal</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Descargo Legal Ultra-Compacto con Acordeón Desplegable */}
        <div className="text-[9.5px] text-slate-500 leading-snug text-center sm:text-left flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
          <div className="flex-1">
            <p>
              G METRICS es una herramienta analítica y de software estadístico basada en modelos matemáticos y telemetría de eventos deportivos. No somos una casa de apuestas ni recibimos fondos.{' '}
              {isLegalExpanded ? (
                <span>
                  No operamos juegos de azar ni intermediamos transacciones. La información y métricas presentadas son de carácter exclusivamente informativo y educativo. El usuario es el único responsable de sus decisiones personales. Servicio exclusivo para mayores de edad (+18). Todos los nombres comerciales, escudos y marcas deportivas mostradas pertenecen a sus respectivos titulares y se utilizan con fines meramente identificativos y descriptivos (Uso Legítimo / Nominative Fair Use).{' '}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setIsLegalExpanded(!isLegalExpanded)}
                className="text-amber-800 hover:text-amber-900 font-semibold underline decoration-dotted ml-1 cursor-pointer transition"
              >
                {isLegalExpanded ? 'Ver menos ▲' : 'Leer más ▼'}
              </button>
              <span className="mx-1.5 text-slate-300">|</span>
              <button
                type="button"
                onClick={() => onOpenGuideModal('LEGAL')}
                className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold cursor-pointer transition"
              >
                Términos y Habeas Data (Ley 1581) →
              </button>
            </p>
          </div>
          <span className="shrink-0 font-mono text-[9px] text-slate-400">
            COT (UTC-5) · Ley 1581
          </span>
        </div>
      </div>
    </footer>
  );
};
