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
  favoriteFixtureIds?: Set<string>;
  expandedCardIds: Set<string>;
  isGroupCollapsed: boolean;
  viewMode: 'SIMPLE' | 'EXPERT';
  isLightweightMode?: boolean;
  densityView?: 'CARDS' | 'COMPACT';
  recentlyUpdatedIds?: Set<string>;
  onToggleGroupCollapse: (groupKey: string) => void;
  onToggleSelectFixture: (fixtureId: string) => void;
  onToggleFavoriteFixture?: (fixtureId: string) => void;
  onToggleSelectGroupFixtures: (fixtureIds: string[], selectAll: boolean) => void;
  onOpenSimulator: (fixture: MatchFixture) => void;
  onToggleCardExpand: (fixtureId: string) => void;
  onOpenDetailModal?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
}

export const CompetitionBlock: React.FC<CompetitionBlockProps> = ({
  group,
  analysesMap,
  selectedFixtureIds,
  favoriteFixtureIds,
  expandedCardIds,
  isGroupCollapsed,
  viewMode,
  isLightweightMode = false,
  densityView = 'CARDS',
  recentlyUpdatedIds,
  onToggleGroupCollapse,
  onToggleSelectFixture,
  onToggleFavoriteFixture,
  onToggleSelectGroupFixtures,
  onOpenSimulator,
  onToggleCardExpand,
  onOpenDetailModal
}) => {
  const groupFixtureIds = group.fixtures.map((f) => f.id);
  const selectedInGroupCount = groupFixtureIds.filter((id) => selectedFixtureIds.has(id)).length;
  const allSelectedInGroup = groupFixtureIds.length > 0 && selectedInGroupCount === groupFixtureIds.length;
  const someSelectedInGroup = selectedInGroupCount > 0 && !allSelectedInGroup;
  const hasLiveMatches = group.fixtures.some((f) => f.status === 'IN_PLAY');

  const handleToggleSelectAllInGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelectGroupFixtures(groupFixtureIds, !allSelectedInGroup);
  };

  const displayTitle = group.leagues.length === 1 ? group.leagues[0].name : group.name;

  return (
    <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs bg-white/95 backdrop-blur-md transition-all">
      {/* Header Bar */}
      <div
        onClick={() => onToggleGroupCollapse(group.key)}
        className="w-full px-4 py-3 bg-slate-50/95 hover:bg-slate-100/90 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none border-b border-slate-200/80 transition-colors"
      >
        {/* Left: Flag/Icon + Title + Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs p-1">
            <CountryFlag country={group.key} fallbackEmoji={group.flag} size="md" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-sans font-bold text-slate-900 tracking-tight truncate">
                {displayTitle}
              </h3>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700">
                {group.fixtures.length} {group.fixtures.length === 1 ? 'partido' : 'partidos'}
              </span>
              {hasLiveMatches && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-rose-600 font-mono tabular-nums font-bold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                    <span>En Vivo</span>
                  </span>
                </>
              )}
            </div>

            {/* Sub-leagues list ONLY if multiple leagues in the group */}
            {group.leagues.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-sans">
                {group.leagues.slice(0, 3).map((l, idx) => (
                  <span key={String(l.id || idx)} className="inline-flex items-center gap-1">
                    <span className="text-slate-600 font-medium">{l.name}</span>
                    <span className="text-slate-400 font-mono tabular-nums text-[10px]">({l.matchCount})</span>
                    {idx < Math.min(group.leagues.length, 3) - 1 && <span className="text-slate-300">·</span>}
                  </span>
                ))}
                {group.leagues.length > 3 && (
                  <span className="text-slate-400 text-[10px]">+{group.leagues.length - 3} más</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions (Select all in league & Collapse chevron) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSelectAllInGroup}
            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-mono tabular-nums tracking-tight font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              allSelectedInGroup
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : someSelectedInGroup
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-600 border-slate-200/90 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={allSelectedInGroup ? 'Deseleccionar todos en esta liga' : 'Seleccionar todos en esta liga'}
          >
            {allSelectedInGroup ? (
              <CheckSquare className="w-3.5 h-3.5 text-white" />
            ) : someSelectedInGroup ? (
              <Square className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500/20" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {allSelectedInGroup ? 'Liga lista' : someSelectedInGroup ? `${selectedInGroupCount}/${groupFixtureIds.length}` : 'Seleccionar'}
            </span>
          </button>

          <button
            type="button"
            className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all border border-slate-200/90 flex items-center justify-center cursor-pointer"
            aria-label={isGroupCollapsed ? 'Expandir grupo' : 'Colapsar grupo'}
          >
            {isGroupCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4 text-emerald-600" />
            )}
          </button>
        </div>
      </div>

      {/* Fixtures Container (Collapsible) */}
      {!isGroupCollapsed && (
        <div className={`p-2.5 sm:p-3.5 bg-slate-50/50 ${densityView === 'COMPACT' ? 'space-y-2' : 'space-y-3'}`}>
          {group.fixtures.map((fixture) => {
            const analysis = analysesMap[fixture.id];
            if (!analysis) return null;
            return densityView === 'COMPACT' ? (
              <CompactMatchRow
                key={fixture.id}
                fixture={fixture}
                analysis={analysis}
                isSelected={selectedFixtureIds.has(fixture.id)}
                onToggleSelect={onToggleSelectFixture}
                isFavorite={favoriteFixtureIds?.has(fixture.id)}
                onToggleFavorite={onToggleFavoriteFixture}
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
