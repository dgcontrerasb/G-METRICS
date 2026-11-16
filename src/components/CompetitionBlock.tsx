import React from 'react';
import { CompetitionGroup } from '../services/leagueCategorizer';
import { MatchFixture, MatchAnalysis } from '../types';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';
import { CompactMatchRow } from './CompactMatchRow';
import { CountryFlag } from './CountryFlag';
import { ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { identifyCompetitionCategory } from '../services/leagueCategorizer';

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
  onSelectSpotlight?: (fixture: MatchFixture, analysis: MatchAnalysis) => void;
  activeSpotlightFixtureId?: string | null;
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
  onOpenDetailModal,
  onSelectSpotlight,
  activeSpotlightFixtureId
}) => {
  const [expandedInternationalGroups, setExpandedInternationalGroups] = React.useState<Set<string>>(new Set());
  const groupFixtureIds = group.fixtures.map((f) => f.id);
  const selectedInGroupCount = groupFixtureIds.filter((id) => selectedFixtureIds.has(id)).length;
  const allSelectedInGroup = groupFixtureIds.length > 0 && selectedInGroupCount === groupFixtureIds.length;
  const someSelectedInGroup = selectedInGroupCount > 0 && !allSelectedInGroup;
  const hasLiveMatches = group.fixtures.some((f) => f.status === 'IN_PLAY');

  const handleToggleSelectAllInGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelectGroupFixtures(groupFixtureIds, !allSelectedInGroup);
  };

  const displayTitle =
    group.category === 'INTERNATIONAL'
      ? group.name
      : group.leagues.length === 1
      ? group.leagues[0].name
      : group.name;

  const internationalSubgroups = React.useMemo(() => {
    if (group.category !== 'INTERNATIONAL') return [];
    const subgroups = new Map<string, { key: string; name: string; flag: string; fixtures: MatchFixture[] }>();

    group.fixtures.forEach((fixture) => {
      const category = identifyCompetitionCategory(
        fixture.league?.name || '',
        fixture.league?.country,
        fixture.homeTeam?.name,
        fixture.awayTeam?.name
      );
      const subgroup = subgroups.get(category.key) || {
        key: category.key,
        name: category.name,
        flag: category.flag,
        fixtures: []
      };
      subgroup.fixtures.push(fixture);
      subgroups.set(category.key, subgroup);
    });

    return Array.from(subgroups.values());
  }, [group.category, group.fixtures]);

  const renderFixture = (fixture: MatchFixture, idx: number, totalInList: number) => {
    const analysis = analysesMap[fixture.id];
    if (!analysis) return null;
    const isFullWidthDesktop = totalInList % 2 === 1 && idx === totalInList - 1;
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
        onSelectSpotlight={onSelectSpotlight}
        isSpotlightActive={activeSpotlightFixtureId === fixture.id}
        viewMode={viewMode}
        isRecentlyUpdated={recentlyUpdatedIds?.has(fixture.id)}
        isFullWidthDesktop={isFullWidthDesktop}
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
  };

  return (
    <div className="border border-[#30363d] rounded-2xl overflow-hidden shadow-md bg-[#161b22]/90 backdrop-blur-md transition-all content-visibility-auto">
      {/* Header Bar (1 sola línea compacta en móvil y PC) */}
      <div
        onClick={() => onToggleGroupCollapse(group.key)}
        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-[#161b22] hover:bg-[#1c2129] flex flex-nowrap items-center justify-between gap-2 cursor-pointer select-none border-b border-[#21262d] transition-colors"
      >
        {/* Left: Flag/Icon + Title + Metadata */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-center shrink-0 shadow-2xs p-1">
            <CountryFlag country={group.key} fallbackEmoji={group.flag} size="md" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
              <h3 className="text-xs sm:text-sm font-sans font-bold text-white tracking-tight truncate">
                {displayTitle}
              </h3>
              <span className="text-[#30363d] shrink-0" aria-hidden="true">·</span>
              <span className="text-[11px] sm:text-xs font-mono tabular-nums font-semibold text-[#8b949e] shrink-0">
                <span className="sm:hidden">{group.fixtures.length}P</span>
                <span className="hidden sm:inline">
                  {group.fixtures.length} {group.fixtures.length === 1 ? 'partido' : 'partidos'}
                </span>
              </span>
              {hasLiveMatches && (
                <>
                  <span className="text-[#30363d] shrink-0" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-rose-500 font-mono tabular-nums font-bold text-[10.5px] sm:text-[11px] shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="hidden xs:inline sm:inline">En Vivo</span>
                    <span className="xs:hidden sm:hidden">Vivo</span>
                  </span>
                </>
              )}
            </div>

            {/* Sub-leagues list ONLY if multiple leagues in the group */}
            {group.category !== 'INTERNATIONAL' && group.leagues.length > 1 && (
              <div className="hidden sm:flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-[#8b949e] font-sans">
                {group.leagues.slice(0, 3).map((l, idx) => (
                  <span key={String(l.id || idx)} className="inline-flex items-center gap-1">
                    <span className="text-slate-300 font-medium">{l.name}</span>
                    <span className="text-[#8b949e] font-mono tabular-nums text-[10px]">({l.matchCount})</span>
                    {idx < Math.min(group.leagues.length, 3) - 1 && <span className="text-[#30363d]">·</span>}
                  </span>
                ))}
                {group.leagues.length > 3 && (
                  <span className="text-[#8b949e] text-[10px]">+{group.leagues.length - 3} más</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions (Select all in league & Collapse chevron) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleSelectAllInGroup}
            className={`min-h-[28px] sm:min-h-[32px] px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs font-mono tabular-nums tracking-tight font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              allSelectedInGroup
                ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] shadow-2xs font-bold'
                : someSelectedInGroup
                ? 'bg-[#d9b114]/15 text-[#d9b114] border-[#d9b114]/40'
                : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white hover:bg-[#1c2129]'
            }`}
            title={allSelectedInGroup ? 'Deseleccionar todos en esta liga' : 'Seleccionar todos en esta liga'}
          >
            {allSelectedInGroup ? (
              <CheckSquare className="w-3.5 h-3.5 text-slate-950" strokeWidth={2} />
            ) : someSelectedInGroup ? (
              <Square className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
            ) : (
              <Square className="w-3.5 h-3.5 text-[#8b949e]" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">
              {allSelectedInGroup ? 'Liga lista' : someSelectedInGroup ? `${selectedInGroupCount}/${groupFixtureIds.length}` : 'Seleccionar'}
            </span>
          </button>

          <button
            type="button"
            className="min-h-[28px] min-w-[28px] sm:min-h-[32px] sm:min-w-[32px] p-1 sm:p-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] hover:text-white transition-all border border-[#30363d] flex items-center justify-center cursor-pointer"
            aria-label={isGroupCollapsed ? 'Expandir grupo' : 'Colapsar grupo'}
          >
            {isGroupCollapsed ? (
              <ChevronDown className="w-4 h-4" strokeWidth={2} />
            ) : (
              <ChevronUp className="w-4 h-4 text-[#d9b114]" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Fixtures Container (Collapsible) */}
      {!isGroupCollapsed && (
        <div className={`p-2 sm:p-3 bg-[#0b0e14]/60 ${densityView === 'COMPACT' ? 'space-y-2' : 'space-y-2.5'}`}>
          {group.category === 'INTERNATIONAL'
            ? internationalSubgroups.map((subgroup) => {
                const isExpanded = expandedInternationalGroups.has(subgroup.key);
                return (
                  <section key={subgroup.key} className="border-b border-[#21262d] last:border-b-0 pb-1.5 mb-1.5 last:mb-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedInternationalGroups((previous) => {
                          const next = new Set(previous);
                          if (next.has(subgroup.key)) next.delete(subgroup.key);
                          else next.add(subgroup.key);
                          return next;
                        });
                      }}
                      aria-expanded={isExpanded}
                      className="w-full min-h-8 px-2 py-1 flex items-center justify-between gap-3 text-left text-xs font-semibold text-slate-200 hover:bg-[#161b22] cursor-pointer rounded-xl transition-colors"
                    >
                      <span className="truncate">{subgroup.flag} {subgroup.name}</span>
                      <span className="shrink-0 flex items-center gap-2 text-[#8b949e] font-mono tabular-nums">
                        {subgroup.fixtures.length}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                        {subgroup.fixtures.map((f, idx) => renderFixture(f, idx, subgroup.fixtures.length))}
                      </div>
                    )}
                  </section>
                );
              })
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {group.fixtures.map((f, idx) => renderFixture(f, idx, group.fixtures.length))}
              </div>
            )}
        </div>
      )}
    </div>
  );
};
