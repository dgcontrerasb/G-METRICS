import React from 'react';
import { CompetitionGroup } from '../services/leagueCategorizer';
import { MatchFixture, MatchAnalysis } from '../types';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';
import { CompactMatchRow } from './CompactMatchRow';
import { CountryFlag } from './CountryFlag';
import { ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

interface CompetitionBlockProps {
  group: CompetitionGroup;
  analysesMap: Record<string, MatchAnalysis>;
  selectedFixtureIds: Set<string>;
  expandedCardIds: Set<string>;
  isGroupCollapsed: boolean;
  viewMode: 'SIMPLE' | 'EXPERT';
  isLightweightMode?: boolean;
  densityView?: 'CARDS' | 'COMPACT';
  recentlyUpdatedIds?: Set<string>;
  onToggleGroupCollapse: (groupKey: string) => void;
  onToggleSelectFixture: (fixtureId: string) => void;
  onToggleSelectGroupFixtures: (fixtureIds: string[], selectAll: boolean) => void;
  onOpenSimulator: (fixture: MatchFixture) => void;
  onToggleCardExpand: (fixtureId: string) => void;
  onOpenDetailModal?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
}

export const CompetitionBlock: React.FC<CompetitionBlockProps> = ({
  group,
  analysesMap,
  selectedFixtureIds,
  expandedCardIds,
  isGroupCollapsed,
  viewMode,
  isLightweightMode = false,
  densityView = 'CARDS',
  recentlyUpdatedIds,
  onToggleGroupCollapse,
  onToggleSelectFixture,
  onToggleSelectGroupFixtures,
  onOpenSimulator,
  onToggleCardExpand,
  onOpenDetailModal
}) => {
  const groupFixtureIds = group.fixtures.map(f => f.id);
  const selectedInGroupCount = groupFixtureIds.filter(id => selectedFixtureIds.has(id)).length;
  const allSelectedInGroup = groupFixtureIds.length > 0 && selectedInGroupCount === groupFixtureIds.length;
  const someSelectedInGroup = selectedInGroupCount > 0 && !allSelectedInGroup;
  const hasLiveMatches = group.fixtures.some(f => f.status === 'IN_PLAY');

  const handleToggleSelectAllInGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelectGroupFixtures(groupFixtureIds, !allSelectedInGroup);
  };

  // If the group only contains a single league, show that league's name directly as the title!
  const displayTitle = group.leagues.length === 1 ? group.leagues[0].name : group.name;

  return (
    <div className="border border-slate-800/40 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/40 backdrop-blur-md transition-all">
      {/* Header Bar */}
      <div
        onClick={() => onToggleGroupCollapse(group.key)}
        className="w-full px-4 py-3 bg-slate-950/50 hover:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none border-b border-slate-800/40 backdrop-blur-md transition-colors"
      >
        {/* Left: Flag/Icon + Title + Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-center shrink-0 shadow-inner p-1">
            <CountryFlag country={group.key} fallbackEmoji={group.flag} size="md" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-sans font-semibold text-slate-100 tracking-tight truncate">
                {displayTitle}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-tight font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {group.fixtures.length} {group.fixtures.length === 1 ? 'partido' : 'partidos'}
              </span>
              {hasLiveMatches && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse">
                  🔴 En Vivo
                </span>
              )}
            </div>

            {/* Sub-leagues chips ONLY if multiple leagues in the group */}
            {group.leagues.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 font-sans">
                {group.leagues.slice(0, 3).map((l, idx) => (
                  <span key={String(l.id || idx)} className="inline-flex items-center gap-1">
                    <span className="text-slate-300/90 font-medium">{l.name}</span>
                    <span className="text-slate-500 font-mono text-[10px]">({l.matchCount})</span>
                    {idx < Math.min(group.leagues.length, 3) - 1 && <span className="text-slate-600">·</span>}
                  </span>
                ))}
                {group.leagues.length > 3 && (
                  <span className="text-slate-500 text-[10px]">+{group.leagues.length - 3} más</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions (Select all in league & Collapse chevron) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Select all in league */}
          <button
            type="button"
            onClick={handleToggleSelectAllInGroup}
            className={`px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              allSelectedInGroup
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                : someSelectedInGroup
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900/40 text-slate-400 border-slate-700/40 hover:text-white hover:bg-white/5'
            }`}
            title={allSelectedInGroup ? 'Deseleccionar todos en esta liga' : 'Seleccionar todos en esta liga'}
          >
            {allSelectedInGroup ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            ) : someSelectedInGroup ? (
              <Square className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {allSelectedInGroup ? 'Liga lista' : someSelectedInGroup ? `${selectedInGroupCount}/${groupFixtureIds.length}` : 'Seleccionar'}
            </span>
          </button>

          {/* Expand/Collapse Chevron Button */}
          <button
            type="button"
            className="p-1.5 rounded-full bg-slate-900/40 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-slate-700/40 cursor-pointer"
            aria-label={isGroupCollapsed ? 'Expandir grupo' : 'Colapsar grupo'}
          >
            {isGroupCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Fixtures Container (Collapsible) */}
      {!isGroupCollapsed && (
        <div className={`p-3 sm:p-4 bg-slate-950/20 ${densityView === 'COMPACT' ? 'space-y-2' : 'space-y-3'}`}>
          {group.fixtures.map(fixture => {
            const analysis = analysesMap[fixture.id];
            if (!analysis) return null;
            return densityView === 'COMPACT' ? (
              <CompactMatchRow
                key={fixture.id}
                fixture={fixture}
                analysis={analysis}
                isSelected={selectedFixtureIds.has(fixture.id)}
                onToggleSelect={onToggleSelectFixture}
                onOpenSimulator={onOpenSimulator}
                isExpanded={expandedCardIds.has(fixture.id)}
                onToggleExpand={() => onToggleCardExpand(fixture.id)}
                onOpenDetail={onOpenDetailModal}
                viewMode={viewMode}
                isRecentlyUpdated={recentlyUpdatedIds?.has(fixture.id)}
              />
            ) : (
              <FriendlyPredictionCard
                key={fixture.id}
                fixture={fixture}
                analysis={analysis}
                isSelected={selectedFixtureIds.has(fixture.id)}
                onToggleSelect={onToggleSelectFixture}
                onOpenSimulator={onOpenSimulator}
                isExpanded={expandedCardIds.has(fixture.id)}
                onToggleExpand={() => onToggleCardExpand(fixture.id)}
                onOpenDetail={onOpenDetailModal}
                viewMode={viewMode}
                mobileLightweight={isLightweightMode}
                isRecentlyUpdated={recentlyUpdatedIds?.has(fixture.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
