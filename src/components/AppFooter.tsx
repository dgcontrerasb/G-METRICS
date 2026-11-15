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
    'px-2.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] text-[10.5px] font-semibold transition cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap';

  return (
    <footer className="border-t border-[#21262d] bg-[#0b0e14]/95 backdrop-blur-md py-3 px-3 sm:px-5 mt-5 text-xs text-[#8b949e] relative z-10">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Fila 1: Identidad Centrada + Cápsulas Simétricas en 1 Sola Fila */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 border-b border-[#21262d]">
          <div className="flex items-center justify-center gap-2 text-center sm:text-left">
            <span className="px-1.5 py-0.5 rounded-lg bg-[#d9b114]/12 border border-[#d9b114]/45 text-[#d9b114] font-extrabold text-[9.5px] leading-none font-mono tabular-nums">
              +18
            </span>
            <div className="flex flex-col items-center sm:items-start justify-center">
              <span className="gmetrics-brand-title text-[12px] leading-none whitespace-nowrap">
                G METRICS
              </span>
              <span className="text-[6.5px] sm:text-[7px] font-bold uppercase tracking-tight text-[#8b949e] whitespace-nowrap leading-none mt-1">
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
        <div className="text-[9.5px] text-[#6e7681] leading-snug text-center sm:text-left flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
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
                className="text-[#d9b114] hover:text-white font-semibold underline decoration-dotted ml-1 cursor-pointer transition"
              >
                {isLegalExpanded ? 'Ver menos ▲' : 'Leer más ▼'}
              </button>
              <span className="mx-1.5 text-[#30363d]">|</span>
              <button
                type="button"
                onClick={() => onOpenGuideModal('LEGAL')}
                className="text-[#8b949e] hover:text-white hover:underline font-semibold cursor-pointer transition"
              >
                Términos y Habeas Data (Ley 1581) →
              </button>
            </p>
          </div>
          <span className="shrink-0 font-mono text-[9px] text-[#6e7681]">
            COT (UTC-5) · Ley 1581
          </span>
        </div>
      </div>
    </footer>
  );
};
