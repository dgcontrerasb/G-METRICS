import React from 'react';
import { Calendar, Menu, TrendingUp, History } from 'lucide-react';

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
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-2xl rounded-t-2xl transition-colors duration-200 bg-[#0b0e14]/95 border-[#30363d] shadow-[0_-8px_28px_-6px_rgba(0,0,0,0.72)] pb-[env(safe-area-inset-bottom,6px)]"
      aria-label="Navegación móvil inferior"
    >
      <div className="grid grid-cols-4 items-center h-14 max-w-lg mx-auto px-2 gap-1.5">
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
          className={`flex flex-col items-center justify-center h-11 rounded-xl min-h-[44px] transition-all active:scale-95 cursor-pointer relative border ${
            activeTab === 'FILTERS'
              ? 'bg-[#1c2129] text-white border-[#d9b114]/60 font-bold'
              : 'bg-transparent border-transparent text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <Menu className="w-4.5 h-4.5" strokeWidth={2} />
          <span className="text-[10px] tracking-tight mt-0.5">Ligas y menú</span>
          {activeTab === 'FILTERS' && (
            <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#d9b114]" />
          )}
        </button>

        {/* Botón 2: Partidos (Cartelera central de partidos) */}
        <button
          onClick={() => onTabChange('MATCHES')}
          type="button"
          className={`flex flex-col items-center justify-center h-11 rounded-xl min-h-[44px] transition-all active:scale-95 cursor-pointer relative border ${
            activeTab === 'MATCHES'
              ? 'bg-[#1c2129] text-white border-[#d9b114]/60 font-bold'
              : 'bg-transparent border-transparent text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <div className="relative">
            <Calendar className="w-4.5 h-4.5" strokeWidth={2} />
            {liveMatchesCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-mono tabular-nums font-bold leading-none">
                {liveMatchesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Partidos</span>
          {activeTab === 'MATCHES' && (
            <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#d9b114]" />
          )}
        </button>

        {/* Botón 3: Top Picks (Pronósticos y probabilidades) */}
        <button
          onClick={() => onTabChange('PROBABILITY')}
          type="button"
          className={`flex flex-col items-center justify-center h-11 rounded-xl min-h-[44px] transition-all active:scale-95 cursor-pointer relative border ${
            activeTab === 'PROBABILITY'
              ? 'bg-[#1c2129] text-white border-[#d9b114]/60 font-bold'
              : 'bg-transparent border-transparent text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <TrendingUp
            className={`w-4.5 h-4.5 ${activeTab === 'PROBABILITY' ? 'text-[#d9b114]' : ''}`}
            strokeWidth={2}
          />
          <span className="text-[10px] tracking-tight mt-0.5">Top Picks</span>
          {activeTab === 'PROBABILITY' && (
            <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#d9b114]" />
          )}
        </button>

        {/* Botón 4: Mis boletos (Slips / Boletos guardados) */}
        <button
          onClick={onOpenHistory}
          type="button"
          className="flex flex-col items-center justify-center h-11 rounded-xl min-h-[44px] transition-all active:scale-95 cursor-pointer border border-transparent text-[#8b949e] hover:text-white hover:bg-[#161b22] font-medium"
        >
          <History className="w-4.5 h-4.5" strokeWidth={2} />
          <span className="text-[10px] tracking-tight mt-0.5">Mis boletos</span>
        </button>
      </div>
    </nav>
  );
};
