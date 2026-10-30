import React from 'react';
import { ActiveSport } from '../types';
import { SportStatsLogo } from './SportStatsLogo';
import { GuideModalTab } from './DidacticGuideModal';
import { PWAInstallButton } from './PWAInstallButton';

export interface AppFooterProps {
  activeSport: ActiveSport;
  onOpenGuideModal: (tab?: GuideModalTab) => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ activeSport, onOpenGuideModal }) => {
  return (
    <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md py-3.5 px-3 sm:px-5 mt-6 text-xs text-slate-600 relative z-10 shadow-2xs">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Fila 1: Identidad + Chips de Acceso Rápido */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-extrabold text-[10px]">
              +18
            </span>
            <SportStatsLogo size="xs" withGlow={false} activeSport={activeSport} />
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
            <button
              type="button"
              onClick={() => onOpenGuideModal('GLOSSARY')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/90 text-[10.5px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>📖 Glosario A-Z</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('GUIDE')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10.5px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>🧭 Guía Rápida</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('LEGAL')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10.5px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>⚖️ Aviso Legal (+18)</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Aviso Legal Sintetizado (2 líneas en móvil) */}
        <div className="text-[10px] text-slate-500 leading-snug text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <p className="max-w-2xl">
            <strong className="text-slate-700">AVISO LEGAL (+18):</strong> Herramienta de análisis estadístico e informativo;{' '}
            <strong className="text-slate-700">no somos casa de apuestas</strong> ni garantizamos ganancias. Uso autónomo bajo responsabilidad del usuario.{' '}
            <button
              type="button"
              onClick={() => onOpenGuideModal('LEGAL')}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              Ver cláusulas →
            </button>
          </p>
          <span className="shrink-0 font-mono text-[9.5px] text-slate-400">
            COT (UTC-5) · Excel / PDF
          </span>
        </div>
      </div>
    </footer>
  );
};
