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
    <footer className="border-t border-slate-800/80 bg-[#070B12]/90 backdrop-blur-md py-8 px-4 sm:px-6 mt-12 text-xs text-slate-400 relative z-10">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Level 1: Brand Identity, Sport Context & Quick Help/Legal Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-black text-[11px] tracking-wider">
              +18
            </span>
            <SportStatsLogo size="xs" withGlow={false} activeSport={activeSport} />
            {activeSport === 'NBA' ? (
              <>
                <span className="font-bold text-slate-200">SportStats Pro · Baloncesto</span>
                <span className="text-slate-600">·</span>
                <span>Análisis por Cuartos, Props Poisson y Marcadores en Vivo</span>
              </>
            ) : (
              <>
                <span className="font-bold text-slate-200">SportStats Pro</span>
                <span className="text-slate-600">·</span>
                <span>Modelos Probabilísticos y Analítica Deportiva</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <PWAInstallButton variant="footer" />
            <button
              type="button"
              onClick={() => onOpenGuideModal('GLOSSARY')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition cursor-pointer"
            >
              📖 Glosario de Términos (A-Z)
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('GUIDE')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
            >
              🧭 Guía Rápida
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideModal('LEGAL')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer"
            >
              ⚖️ Aviso Legal (+18)
            </button>
          </div>
        </div>

        {/* Level 2: Explicit Legal Disclaimer & Autonomous Responsibility Shield */}
        <div className="space-y-2 text-[11px] text-slate-400/90 leading-relaxed text-center sm:text-left">
          <p>
            <strong className="text-slate-200">AVISO LEGAL Y EXENCIÓN DE RESPONSABILIDAD (+18):</strong>{' '}
            <strong>SportStats Pro</strong> es una herramienta tecnológica de análisis estadístico, matemático e informativo (basada en modelos de Poisson, Dixon-Coles y regresiones de ritmo/eficiencia).{' '}
            <strong className="text-slate-200">No somos una casa de apuestas</strong>, no captamos dinero del público ni intermediamos apuestas deportivas. Las probabilidades, proyecciones e indicadores de valor (<strong>+EV</strong>) representan estimaciones matemáticas orientativas y en ningún caso constituyen asesoría financiera ni garantizan aciertos o ganancias futuras.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-[10px] text-slate-500">
            <span>
              Toda jugada, inversión o decisión tomada a partir de esta guía corre única y exclusivamente bajo el criterio, autonomía y responsabilidad patrimonial del usuario. Prohibido el uso para menores de 18 años.
            </span>
            <span className="shrink-0 font-mono text-slate-400">
              Horarios COT (UTC-5) · Exportación Excel y PDF
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
