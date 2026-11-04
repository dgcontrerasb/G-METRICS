import React from 'react';
import { Calendar, Menu, TrendingUp, History } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type MobileTab = 'MATCHES' | 'FILTERS' | 'PROBABILITY' | 'ADMIN';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  liveMatchesCount: number;
  onOpenHistory?: () => void;
  onOpenDrawer?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  liveMatchesCount,
  onOpenHistory,
  onOpenDrawer
}) => {
  const { paletteConfig } = useTheme();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors duration-200 bg-white/95 border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom,6px)]"
      aria-label="Navegación móvil inferior"
    >
      <div className="grid grid-cols-4 items-center h-14 max-w-lg mx-auto px-2">
        {/* Botón 1: Ligas y menú (Abre el panel lateral izquierdo) */}
        <button
          onClick={() => {
            if (onOpenDrawer) {
              onOpenDrawer();
            } else {
              onTabChange('FILTERS');
            }
          }}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'FILTERS'
              ? 'text-slate-900 font-bold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Ligas y menú</span>
          {activeTab === 'FILTERS' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Botón 2: Partidos (Cartelera central de partidos) */}
        <button
          onClick={() => onTabChange('MATCHES')}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'MATCHES'
              ? 'text-slate-900 font-bold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {liveMatchesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-mono font-bold animate-pulse leading-none">
                {liveMatchesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Partidos</span>
          {activeTab === 'MATCHES' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Botón 3: Top Picks (Pronósticos y probabilidades) */}
        <button
          onClick={() => onTabChange('PROBABILITY')}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'PROBABILITY'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] tracking-tight mt-1">Top Picks</span>
          {activeTab === 'PROBABILITY' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Botón 4: Mis boletos (Slips / Boletos guardados) */}
        <button
          onClick={onOpenHistory}
          type="button"
          className="flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer text-slate-600 hover:text-slate-900 font-medium"
        >
          <History className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] tracking-tight mt-1">Mis boletos</span>
        </button>
      </div>
    </nav>
  );
};
