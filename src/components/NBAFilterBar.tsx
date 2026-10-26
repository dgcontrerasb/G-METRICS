import React from 'react';
import { Search } from 'lucide-react';
import { CountryFlag } from './CountryFlag';
import { getColombiaDateString } from '../services/apiService';

export type NBAFilterType =
  | 'ALL'
  | 'LIVE'
  | 'UPCOMING_ONLY'
  | 'RECOMMENDED'
  | 'FAVORITES'
  | 'HIGH_POINTS'
  | 'HIGH_3PM';

export interface BasketballLeagueOption {
  key: string;
  name: string;
  flag: string;
  count: number;
}

export interface NBAFilterBarProps {
  nbaSearchQuery: string;
  onSearchChange: (q: string) => void;
  currentDate: string;
  onDateChange: (dateStr: string) => void;
  selectedNBAFilter: NBAFilterType;
  onFilterChange: (filter: NBAFilterType) => void;
  selectedNBAConference: string;
  onConferenceChange: (conf: string) => void;
  totalNBAFixturesCount: number;
  availableBasketballLeagues: BasketballLeagueOption[];
  nbaEsteCount: number;
  nbaOesteCount: number;
}

export const NBAFilterBar: React.FC<NBAFilterBarProps> = ({
  nbaSearchQuery,
  onSearchChange,
  currentDate,
  onDateChange,
  selectedNBAFilter,
  onFilterChange,
  selectedNBAConference,
  onConferenceChange,
  totalNBAFixturesCount,
  availableBasketballLeagues,
  nbaEsteCount,
  nbaOesteCount
}) => {
  return (
    <section className="bg-slate-950/40 backdrop-blur-md border-b border-slate-800/40 py-2.5 px-3 sm:px-6 relative z-10">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Main Search Bar & Quick Dropdown Filters Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
            <input
              type="text"
              value={nbaSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar franquicia o jugador (ej. Celtics, Lakers, Curry, Dončić...)"
              className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none transition-all font-sans"
            />
            {nbaSearchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Inline Quick Selectors Row */}
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto shrink-0 text-xs">
            {/* Fecha */}
            <select
              value={
                currentDate === getColombiaDateString(0)
                  ? 'TODAY'
                  : currentDate === getColombiaDateString(1)
                  ? 'TOMORROW'
                  : currentDate === getColombiaDateString(2)
                  ? 'DAY_AFTER'
                  : 'TODAY'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'TODAY') onDateChange(getColombiaDateString(0));
                else if (val === 'TOMORROW') onDateChange(getColombiaDateString(1));
                else if (val === 'DAY_AFTER') onDateChange(getColombiaDateString(2));
              }}
              className="bg-slate-900/50 border border-slate-800 rounded-xl px-2 py-2 text-[11px] font-mono text-white focus:outline-none cursor-pointer truncate"
            >
              <option value="TODAY" className="bg-[#161b22] text-white">
                📅 Hoy
              </option>
              <option value="TOMORROW" className="bg-[#161b22] text-white">
                📅 Mañana
              </option>
              <option value="DAY_AFTER" className="bg-[#161b22] text-white">
                📅 Pasado Mañana
              </option>
            </select>

            {/* Filtro Baloncesto */}
            <select
              value={selectedNBAFilter}
              onChange={(e) => onFilterChange(e.target.value as NBAFilterType)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl px-2 py-2 text-[11px] font-mono text-white focus:outline-none cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[#161b22] text-white">
                🎯 En Vivo y Próximos
              </option>
              <option value="LIVE" className="bg-[#161b22] text-rose-400 font-bold">
                🔴 Solo En Vivo
              </option>
              <option value="UPCOMING_ONLY" className="bg-[#161b22] text-sky-300">
                ⏳ Solo Próximos
              </option>
              <option value="RECOMMENDED" className="bg-[#161b22] text-amber-300 font-bold">
                🟢 Te Conviene
              </option>
              <option value="FAVORITES" className="bg-[#161b22] text-white">
                ⭐ Favorito
              </option>
              <option value="HIGH_POINTS" className="bg-[#161b22] text-white">
                🔥 +225 pts
              </option>
              <option value="HIGH_3PM" className="bg-[#161b22] text-white">
                🎯 +26 Triples
              </option>
            </select>

            {/* Conferencia / Liga */}
            <select
              value={selectedNBAConference}
              onChange={(e) => onConferenceChange(e.target.value)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl px-2 py-2 text-[11px] font-mono text-white focus:outline-none cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[#161b22] text-white">
                🏀 Todo Baloncesto ({totalNBAFixturesCount})
              </option>
              {availableBasketballLeagues.map((l) => (
                <option key={l.key} value={l.key} className="bg-[#161b22] text-amber-300 font-bold">
                  {l.flag} {l.name} ({l.count})
                </option>
              ))}
              {nbaEsteCount > 0 && (
                <option value="Este" className="bg-[#161b22] text-white">
                  🌟 NBA Conf. Este ({nbaEsteCount})
                </option>
              )}
              {nbaOesteCount > 0 && (
                <option value="Oeste" className="bg-[#161b22] text-white">
                  ⚡ NBA Conf. Oeste ({nbaOesteCount})
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Quick Horizontal League & Conference Chips Carousel */}
        <div className="pt-0.5">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              type="button"
              onClick={() => onConferenceChange('ALL')}
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer border ${
                selectedNBAConference === 'ALL'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold shadow-xs'
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              🏀 Todos ({totalNBAFixturesCount})
            </button>
            {availableBasketballLeagues.map((l) => {
              const isSelected = selectedNBAConference === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => onConferenceChange(isSelected ? 'ALL' : l.key)}
                  className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold shadow-xs'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <CountryFlag country={l.key === 'NBA' ? 'USA' : l.key} fallbackEmoji={l.flag} size="xs" />
                  <span>{l.name}</span>
                  <span className="text-[9px] opacity-75">({l.count})</span>
                </button>
              );
            })}
            {nbaEsteCount > 0 && (
              <button
                type="button"
                onClick={() => onConferenceChange(selectedNBAConference === 'Este' ? 'ALL' : 'Este')}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 border ${
                  selectedNBAConference === 'Este'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold shadow-xs'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <span>🌟</span>
                <span>Conf. Este</span>
                <span className="text-[9px] opacity-75">({nbaEsteCount})</span>
              </button>
            )}
            {nbaOesteCount > 0 && (
              <button
                type="button"
                onClick={() => onConferenceChange(selectedNBAConference === 'Oeste' ? 'ALL' : 'Oeste')}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 border ${
                  selectedNBAConference === 'Oeste'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold shadow-xs'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <span>⚡</span>
                <span>Conf. Oeste</span>
                <span className="text-[9px] opacity-75">({nbaOesteCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
