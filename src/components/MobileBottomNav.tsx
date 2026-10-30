import React from 'react';
import { Calendar, Menu, TrendingUp, ShieldCheck, History } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type MobileTab = 'MATCHES' | 'FILTERS' | 'PROBABILITY' | 'ADMIN';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  liveMatchesCount: number;
  isAdmin?: boolean;
  onOpenAdmin: () => void;
  onOpenHistory?: () => void;
  onOpenDrawer?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  liveMatchesCount,
  isAdmin = false,
  onOpenAdmin,
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
        {/* Tab 1: Matches */}
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

        {/* Tab 2: Open Gmail-Style League & Sport Drawer */}
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
          <span className="text-[10px] tracking-tight mt-1">Ligas y Menú</span>
          {activeTab === 'FILTERS' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Tab 3: Value Predictions (+EV) */}
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
          <span className="text-[10px] tracking-tight mt-1">Top Picks +EV</span>
          {activeTab === 'PROBABILITY' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Tab 4: Historial for regular users / Admin Panel for authenticated owner */}
        {isAdmin ? (
          <button
            onClick={onOpenAdmin}
            type="button"
            className="flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer text-amber-700 hover:text-amber-900 font-semibold"
          >
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <span className="text-[10px] tracking-tight mt-1">Panel Admin</span>
          </button>
        ) : (
          <button
            onClick={onOpenHistory}
            type="button"
            className="flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer text-slate-600 hover:text-slate-900 font-medium"
          >
            <History className="w-5 h-5 text-emerald-600" />
            <span className="text-[10px] tracking-tight mt-1">Mis Boletos</span>
          </button>
        )}
      </div>
    </nav>
  );
};
