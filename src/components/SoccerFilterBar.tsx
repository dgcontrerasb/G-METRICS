import React from 'react';
import { Search } from 'lucide-react';
import { CountryFlag } from './CountryFlag';
import { getColombiaDateString } from '../services/apiService';
import { CompetitionGroup } from '../services/leagueCategorizer';

export type SoccerFilterType =
  | 'ALL'
  | 'LIVE_ONLY'
  | 'UPCOMING_ONLY'
  | 'RECOMMENDED'
  | 'CORNERS_SAFE'
  | 'CARDS_SAFE'
  | 'DOUBLE_CHANCE'
  | 'FAVORITES'
  | 'HIGH_GOALS'
  | 'BALANCED';

export interface SoccerFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentDate: string;
  onDateChange: (dateStr: string) => void;
  selectedFilter: SoccerFilterType;
  onFilterChange: (filter: SoccerFilterType) => void;
  selectedLeague: string;
  onLeagueChange: (league: string) => void;
  primeFixturesCount: number;
  totalFixturesCount: number;
  availableCompetitionGroups: CompetitionGroup[];
  quickLeagueChips: CompetitionGroup[];
}

export const SoccerFilterBar: React.FC<SoccerFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  currentDate,
  onDateChange,
  selectedFilter,
  onFilterChange,
  selectedLeague,
  onLeagueChange,
  primeFixturesCount,
  totalFixturesCount,
  availableCompetitionGroups,
  quickLeagueChips
}) => {
  return (
    <section className="bg-slate-950/40 backdrop-blur-md border-b border-slate-800/40 py-2.5 px-3 sm:px-6 relative z-10">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Main Search Bar & Quick Dropdown Filters Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar equipo o liga (ej. River, Real Madrid, Arsenal...)"
              className="w-full bg-slate-900/50 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none transition-all font-sans"
            />
            {searchQuery && (
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

            {/* Mercado / Estado */}
            <select
              value={selectedFilter}
              onChange={(e) => onFilterChange(e.target.value as SoccerFilterType)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl px-2 py-2 text-[11px] font-mono text-white focus:outline-none cursor-pointer truncate"
            >
              <option value="ALL" className="bg-[#161b22] text-white">
                🎯 En Vivo y Próximos
              </option>
              <option value="LIVE_ONLY" className="bg-[#161b22] text-rose-400 font-bold">
                🔴 Solo En Vivo
              </option>
              <option value="UPCOMING_ONLY" className="bg-[#161b22] text-sky-300">
                ⏳ Solo Próximos
              </option>
              <option value="RECOMMENDED" className="bg-[#161b22] text-emerald-400 font-bold">
                🟢 Seguras (&ge;68%)
              </option>
              <option value="CORNERS_SAFE" className="bg-[#161b22] text-amber-300">
                🚩 Córners
              </option>
              <option value="CARDS_SAFE" className="bg-[#161b22] text-yellow-300">
                🟨 Tarjetas
              </option>
              <option value="DOUBLE_CHANCE" className="bg-[#161b22] text-blue-300">
                🛡️ Doble Op.
              </option>
              <option value="FAVORITES" className="bg-[#161b22] text-white">
                ⭐ Favorito
              </option>
              <option value="HIGH_GOALS" className="bg-[#161b22] text-white">
                ⚽ +2.5 Goles
              </option>
            </select>

            {/* Competición */}
            <select
              value={selectedLeague}
              onChange={(e) => onLeagueChange(e.target.value)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl px-2 py-2 text-[11px] font-mono text-white focus:outline-none cursor-pointer truncate"
            >
              <option value="PRIME_CO" className="bg-[#161b22] text-emerald-300 font-bold">
                🇨🇴 Principales Casas CO ({primeFixturesCount})
              </option>
              <option value="ALL" className="bg-[#161b22] text-white">
                🌐 Todas las Ligas ({totalFixturesCount})
              </option>

              {availableCompetitionGroups
                .filter((g) => g.category === 'INTERNATIONAL')
                .map((intlGroup) => (
                  <optgroup
                    key={intlGroup.key}
                    label={`${intlGroup.flag || '🏆'} ${intlGroup.name}`}
                    className="bg-[#0b1220] text-amber-300 font-bold"
                  >
                    <option value="GROUP_INTL" className="bg-[#0b1220] text-white">
                      {intlGroup.flag || '🏆'} Todos Int. ({intlGroup.totalMatches})
                    </option>
                    {intlGroup.leagues.map((l) => (
                      <option key={String(l.id)} value={`LEAGUE_${l.id}`} className="bg-[#0b1220] text-slate-200">
                        {l.flag || intlGroup.flag || '⭐'} {l.name} ({l.matchCount})
                      </option>
                    ))}
                  </optgroup>
                ))}

              {availableCompetitionGroups
                .filter((g) => g.category === 'COUNTRY')
                .map((countryGroup) => (
                  <optgroup
                    key={countryGroup.key}
                    label={`${countryGroup.flag || '⚽'} ${countryGroup.name}`}
                    className="bg-[#0b1220] text-emerald-300 font-bold"
                  >
                    <option value={`COUNTRY_${countryGroup.key}`} className="bg-[#0b1220] text-white">
                      {countryGroup.flag || '⚽'} Toda {countryGroup.name} ({countryGroup.totalMatches})
                    </option>
                    {countryGroup.leagues.map((l) => (
                      <option key={String(l.id)} value={`LEAGUE_${l.id}`} className="bg-[#0b1220] text-slate-200">
                        {l.flag || countryGroup.flag || '⚽'} {l.name} ({l.matchCount})
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </div>
        </div>

        {/* Quick Horizontal League Chips Carousel */}
        {quickLeagueChips.length > 0 && (
          <div className="pt-0.5">
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                type="button"
                onClick={() => onLeagueChange('PRIME_CO')}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedLeague === 'PRIME_CO'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-xs'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:text-white'
                }`}
                title="Mostrar solo ligas principales disponibles en casas de apuestas colombianas (BetPlay, Wplay, RushBet) con alta precisión estadística"
              >
                <CountryFlag country="COLOMBIA" size="xs" />
                <span>Principales CO ({primeFixturesCount})</span>
              </button>
              <button
                type="button"
                onClick={() => onLeagueChange('ALL')}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedLeague === 'ALL'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-xs'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-[12px]">🌐</span>
                <span>Todas ({totalFixturesCount})</span>
              </button>
              {quickLeagueChips.map((chip) => {
                const isSelected = selectedLeague === `COUNTRY_${chip.key}`;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => onLeagueChange(isSelected ? 'PRIME_CO' : `COUNTRY_${chip.key}`)}
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-xs'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <CountryFlag country={chip.key} fallbackEmoji={chip.flag} size="xs" />
                    <span>{chip.name}</span>
                    <span className="text-[9px] opacity-75">({chip.totalMatches})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
