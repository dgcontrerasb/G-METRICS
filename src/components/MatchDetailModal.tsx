import React, { useState, useEffect } from 'react';
import { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';
import { getNBADidacticAdvice } from '../services/didacticService';
import {
  X,
  Sparkles,
  Clock,
  Check,
  Flame,
  Ticket,
  Share2,
  BarChart2,
  Target,
  Zap
} from 'lucide-react';
import { useParlay } from '../context/ParlayContext';
import { useToast } from '../context/ToastContext';
import { LiveMatchTimeline } from './LiveMatchTimeline';
import { LiveMarketCapsules } from './LiveMarketCapsules';
import { LineupRosterTab } from './LineupRosterTab';
import { formatCompactTeamName } from '../services/leagueCategorizer';
import { evaluateNBAMarketsLiveStatus, calculateNBAH2HAnalysis } from '../services/nbaEngine';
import { PlayerStatsModal, PlayerModalPayload } from './PlayerStatsModal';
import { ProGate } from './ProGate';

export type DetailMatchPayload =
  | { type: 'SOCCER'; fixture: MatchFixture; analysis: MatchAnalysis }
  | { type: 'NBA'; fixture: NBAMatchFixture; analysis: NBAAnalysis };

interface MatchDetailModalProps {
  payload: DetailMatchPayload | null;
  isOpen: boolean;
  onClose: () => void;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
  onOpenSimulator?: (fixture: MatchFixture) => void;
}

type TabSoccer = 'TIMELINE' | 'LIVE_MARKETS' | 'PICKS' | 'GOALS_CORNERS' | 'REFEREE' | 'LINEUPS';
type TabNBA = 'PICKS' | 'QUARTERS_3PM' | 'PACE_STREAK' | 'LINEUPS';

export const MatchDetailModal: React.FC<MatchDetailModalProps> = React.memo(({
  payload,
  isOpen,
  onClose,
  isSelected = false,
  onToggleSelect,
  onOpenSimulator
}) => {
  const [activeTabSoccer, setActiveTabSoccer] = useState<TabSoccer>('PICKS');
  const [activeTabNBA, setActiveTabNBA] = useState<TabNBA>('PICKS');

  // Lock body scroll without detaching fixed background layers
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset tab when fixture ID changes (auto-switch to Minuto a Minuto if match is IN_PLAY)
  useEffect(() => {
    if (payload?.type === 'SOCCER') {
      if (payload.fixture.status === 'IN_PLAY') {
        setActiveTabSoccer('TIMELINE');
      } else {
        setActiveTabSoccer('PICKS');
      }
    }
    setActiveTabNBA('PICKS');
  }, [payload?.fixture.id, payload?.type]);

  // Real-time 60-second local clock progression between 15s network syncs
  const [liveMinuteOffset, setLiveMinuteOffset] = useState<number>(0);
  const isSoccerHalfTime =
    payload?.type === 'SOCCER'
      ? Boolean(
          payload.fixture.status === 'HALFTIME' ||
            payload.fixture.status === 'PAUSED' ||
            payload.fixture.currentScore?.isHalfTime ||
            payload.fixture.currentScore?.statusShort === 'HT'
        )
      : false;

  const serverBaseMinute = React.useMemo(() => {
    if (payload?.type !== 'SOCCER') return 0;
    const base = payload.fixture.currentScore?.minute ?? 0;
    if (isSoccerHalfTime) return 45;
    const events = payload.fixture.liveEvents;
    if (!Array.isArray(events) || events.length === 0) return base;
    const maxEvMin = events.reduce((acc, ev) => {
      if (ev.type === 'PERIOD_HALF' || ev.type === 'PERIOD_END' || ev.type === 'PERIOD_START') return acc;
      return Math.max(acc, Number(ev.minute || 0));
    }, 0);
    return Math.max(base, maxEvMin);
  }, [payload, isSoccerHalfTime]);

  useEffect(() => {
    setLiveMinuteOffset(0);
  }, [payload?.fixture.id, serverBaseMinute, isSoccerHalfTime]);

  useEffect(() => {
    if (
      !isOpen ||
      !payload ||
      payload.type !== 'SOCCER' ||
      payload.fixture.status !== 'IN_PLAY' ||
      isSoccerHalfTime
    ) {
      return;
    }

    const ticker = setInterval(() => {
      setLiveMinuteOffset((prev) => prev + 1);
    }, 60000);

    return () => clearInterval(ticker);
  }, [isOpen, payload, isSoccerHalfTime]);

  if (!isOpen || !payload) return null;

  const isSoccer = payload.type === 'SOCCER';
  const effectiveSoccerFixture =
    isSoccer &&
    (payload.fixture.status === 'IN_PLAY' || payload.fixture.status === 'EXTRA_TIME') &&
    payload.fixture.currentScore &&
    !isSoccerHalfTime
      ? {
          ...payload.fixture,
          currentScore: {
            ...payload.fixture.currentScore,
            minute:
              serverBaseMinute > 45 && payload.fixture.currentScore.statusShort === '1H'
                ? serverBaseMinute
                : serverBaseMinute > 90 && payload.fixture.currentScore.statusShort === '2H'
                ? serverBaseMinute
                : serverBaseMinute < 45
                ? Math.min(45, serverBaseMinute + liveMinuteOffset)
                : serverBaseMinute <= 90
                ? Math.min(90, serverBaseMinute + liveMinuteOffset)
                : Math.min(120, serverBaseMinute + liveMinuteOffset)
          }
        }
      : isSoccer
      ? payload.fixture
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-[5px] animate-fade-in transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Floating Card Window (Fintech Light Deck) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[86vh] max-h-[660px] my-auto bg-white/98 border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 overscroll-contain text-slate-900"
      >
        {/* 1. HEADER FIJO COMPACTO: Duelo de Equipos y Marcador Minimalista */}
        {isSoccer ? (
          <SoccerHeader
            fixture={effectiveSoccerFixture || payload.fixture}
            analysis={payload.analysis}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onOpenSimulator={onOpenSimulator}
            onClose={onClose}
          />
        ) : (
          <NBAHeader
            fixture={payload.fixture}
            analysis={payload.analysis}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onClose={onClose}
          />
        )}

        {/* 2. TABS FIJOS SIMÉTRICOS */}
        <div
          className={`p-1 bg-slate-100/90 border-b border-slate-200/90 shrink-0 text-center gap-1 ${
            isSoccer && payload.fixture.status === 'IN_PLAY'
              ? 'grid grid-cols-3'
              : 'grid grid-cols-4'
          }`}
        >
          {isSoccer ? (
            payload.fixture.status === 'IN_PLAY' ? (
              <>
                <TabButton
                  active={activeTabSoccer === 'TIMELINE'}
                  onClick={() => setActiveTabSoccer('TIMELINE')}
                  label="⏱️ Minuto"
                  badge="VIVO"
                  badgeClass="bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                />
                <TabButton
                  active={activeTabSoccer === 'LIVE_MARKETS'}
                  onClick={() => setActiveTabSoccer('LIVE_MARKETS')}
                  label="📊 Cuotas"
                  badge="+EV"
                />
                <TabButton
                  active={activeTabSoccer === 'LINEUPS'}
                  onClick={() => setActiveTabSoccer('LINEUPS')}
                  label="👕 Plantillas"
                />
              </>
            ) : (
              <>
                <TabButton
                  active={activeTabSoccer === 'PICKS'}
                  onClick={() => setActiveTabSoccer('PICKS')}
                  label="🎯 Picks"
                  badge="+EV"
                />
                <TabButton
                  active={activeTabSoccer === 'GOALS_CORNERS'}
                  onClick={() => setActiveTabSoccer('GOALS_CORNERS')}
                  label="⚽ Goles"
                />
                <TabButton
                  active={activeTabSoccer === 'REFEREE'}
                  onClick={() => setActiveTabSoccer('REFEREE')}
                  label="🟨 Árbitro"
                />
                <TabButton
                  active={activeTabSoccer === 'LINEUPS'}
                  onClick={() => setActiveTabSoccer('LINEUPS')}
                  label="👕 Plantillas"
                />
              </>
            )
          ) : (
            <>
              <TabButton
                active={activeTabNBA === 'PICKS'}
                onClick={() => setActiveTabNBA('PICKS')}
                label="🏀 Picks"
                badge="+EV"
              />
              <TabButton
                active={activeTabNBA === 'QUARTERS_3PM'}
                onClick={() => setActiveTabNBA('QUARTERS_3PM')}
                label="🎯 Cuartos"
              />
              <TabButton
                active={activeTabNBA === 'PACE_STREAK'}
                onClick={() => setActiveTabNBA('PACE_STREAK')}
                label="⚡ Ritmo & H2H"
              />
              <TabButton
                active={activeTabNBA === 'LINEUPS'}
                onClick={() => setActiveTabNBA('LINEUPS')}
                label="👕 Quintetos"
              />
            </>
          )}
        </div>

        {/* 3. CONTENIDO CON SCROLL INTERNO Y PADDING INFERIOR SEGURO */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-6 space-y-3 text-slate-800 bg-slate-50/50 overscroll-contain">
          {isSoccer ? (
            <SoccerTabContent
              tab={activeTabSoccer}
              fixture={effectiveSoccerFixture || payload.fixture}
              analysis={payload.analysis}
              onOpenSimulator={onOpenSimulator}
            />
          ) : (
            <NBATabContent
              tab={activeTabNBA}
              fixture={payload.fixture}
              analysis={payload.analysis}
            />
          )}
        </div>
      </div>
    </div>
  );
});

// ==========================================
// SUBCOMPONENTES: CABECERAS (SOCCER & NBA)
// ==========================================

const SoccerHeader: React.FC<{
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpenSimulator?: (f: MatchFixture) => void;
  onClose: () => void;
}> = ({ fixture, analysis, isSelected, onToggleSelect, onClose }) => {
  const isLive = fixture.status === 'IN_PLAY';
  const isFinished = fixture.status === 'FINISHED';
  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);
  const bestPick = analysis.verdict?.topSafePick;

  const { isPickInParlay, togglePick } = useParlay();
  const { showToast } = useToast();
  const inParlay = isPickInParlay(fixture.id);

  return (
    <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200/90 bg-white shrink-0 space-y-2">
      {/* Top Bar: Liga + Badges + Botón Cerrar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {fixture.league.flag && fixture.league.flag.startsWith('http') ? (
            <img
              src={fixture.league.flag}
              alt=""
              className="w-4 h-3 object-cover rounded shadow-2xs inline-block shrink-0 border border-slate-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs shrink-0">{fixture.league.flag || '🏆'}</span>
          )}
          <span className="font-semibold text-slate-700 tracking-wide uppercase text-[10px] sm:text-[11px] truncate">
            {fixture.league.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {fixture.status === 'PENALTY_SHOOTOUT' || fixture.currentScore?.statusShort === 'PEN' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-mono tracking-tight font-bold animate-pulse text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>PENALES · 120'</span>
            </span>
          ) : isLive || fixture.status === 'EXTRA_TIME' || fixture.status === 'HALFTIME' || fixture.status === 'PAUSED' ? (
            fixture.currentScore?.isHalfTime || fixture.status === 'HALFTIME' || fixture.status === 'PAUSED' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono tracking-tight font-bold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>DESCANSO · 45'</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono tracking-tight font-bold animate-pulse text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>
                  {(() => {
                    const m = fixture.currentScore?.minute;
                    const sShort = fixture.currentScore?.statusShort;
                    if (!m) return 'VIVO';
                    if (sShort === '1H' && m > 45) return `45+${m - 45}'`;
                    if (sShort === '2H' && m > 90) return `90+${m - 90}'`;
                    return `${m}'`;
                  })()}
                </span>
              </span>
            )
          ) : isFinished ? (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[10px] font-semibold">
              FIN
            </span>
          ) : (
            <span className="text-slate-600 font-mono text-[10px] font-medium flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>{fixture.time}</span>
            </span>
          )}

          {isValueBet && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[9px] font-bold">
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
              +EV
            </span>
          )}

          {/* Quick Add/Remove to Parlay Ticket */}
          <button
            type="button"
            onClick={() => {
              togglePick({
                id: `${fixture.id}_${bestPick?.label || 'OVER_15'}`,
                fixtureId: fixture.id,
                sport: 'SOCCER',
                matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                homeTeamName: fixture.homeTeam.name,
                awayTeamName: fixture.awayTeam.name,
                matchDate: fixture.date,
                matchTime: fixture.time,
                marketKey: bestPick?.label || 'OVER_15',
                selectionLabel: bestPick?.label || 'Más de 1.5 Goles',
                referenceOdd: Number((bestPick?.fairOdd || 1.35).toFixed(2)),
                userOdd: Number((bestPick?.fairOdd || 1.35).toFixed(2)),
                probability: bestPick?.probability || 75,
                isEV: isValueBet
              });
            }}
            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center border ${
              inParlay
                ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90'
            }`}
            title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir al boleto de combinadas'}
            aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
          >
            <Ticket className="w-3.5 h-3.5" />
          </button>

          {/* Share Button (WhatsApp / Native Share) */}
          <button
            type="button"
            onClick={() => {
              const bestPick = analysis.verdict?.topSafePick;
              const title = `⚽ ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
              const text = `⚽ *G METRICS · ANÁLISIS DE PARTIDO*\n🔥 *${fixture.homeTeam.name} vs ${fixture.awayTeam.name}*\n🏆 ${fixture.league.name} · ${fixture.time} COT\n\n⭐ *PRONÓSTICO PRINCIPAL (+EV)*\n🎯 Opción: ${bestPick?.label || 'Más de 1.5 Goles'}\n📊 Certeza Calculada: ${bestPick?.probability || 75}%\n💰 Cuota Ref: @${bestPick?.fairOdd?.toFixed(2) || '1.35'}\n\n📱 Analizado en G METRICS`;
              if (navigator.share) {
                navigator.share({ title, text, url: window.location.href }).catch(() => {
                  navigator.clipboard.writeText(text);
                  showToast('Análisis copiado al portapapeles para WhatsApp', 'success');
                });
              } else {
                navigator.clipboard.writeText(text);
                showToast('Análisis copiado al portapapeles para compartir', 'success');
              }
            }}
            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            title="Compartir pronóstico en WhatsApp / Redes"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
          </button>

          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(fixture.id)}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center border ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/90'
              }`}
              title={isSelected ? 'Quitar de mi selección' : 'Añadir a selección'}
            >
              <Check className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[3] text-white' : 'text-slate-500'}`} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80 transition-colors cursor-pointer ml-0.5"
            aria-label="Cerrar modal"
            title="Cerrar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Face-off: Marcador Minimalista y Simétrico */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-0.5">
        {/* Local */}
        <div className="flex items-center justify-end gap-2 min-w-0">
          <div className="min-w-0 text-right flex-1">
            <div className="text-[9px] font-mono text-emerald-700 font-semibold uppercase truncate">
              Local · #{fixture.homeTeam.rank}
            </div>
            <div className="font-sans font-medium text-xs sm:text-sm text-slate-900 leading-tight truncate" title={fixture.homeTeam.name}>
              {formatCompactTeamName(fixture.homeTeam.name)}
            </div>
          </div>
          {fixture.homeTeam.logo?.trim() ? (
            <img
              src={fixture.homeTeam.logo}
              alt=""
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
        </div>

        {/* Marcador Central Minimalista */}
        <div className="text-center flex items-center justify-center shrink-0 px-1">
          <div className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/90 font-mono font-semibold text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center min-w-[48px]">
            {isLive || isFinished ? (
              <span className={isLive ? 'text-emerald-700 font-bold' : 'text-slate-900'}>
                {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
              </span>
            ) : (
              <span className="text-slate-500 text-[10px] font-medium">VS</span>
            )}
          </div>
        </div>

        {/* Visitante */}
        <div className="flex items-center justify-start gap-2 min-w-0">
          {fixture.awayTeam.logo?.trim() ? (
            <img
              src={fixture.awayTeam.logo}
              alt=""
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0 text-left flex-1">
            <div className="text-[9px] font-mono text-sky-700 font-semibold uppercase truncate">
              Visita · #{fixture.awayTeam.rank}
            </div>
            <div className="font-sans font-medium text-xs sm:text-sm text-slate-900 leading-tight truncate" title={fixture.awayTeam.name}>
              {formatCompactTeamName(fixture.awayTeam.name)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NBAHeader: React.FC<{
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onClose: () => void;
}> = ({ fixture, analysis, isSelected, onToggleSelect, onClose }) => {
  const isLive = fixture.status === 'IN_PLAY';
  const isFinished = fixture.status === 'FINISHED';
  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);
  const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? fixture.homeTeam : fixture.awayTeam;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);

  const { isPickInParlay, togglePick } = useParlay();
  const { showToast } = useToast();
  const inParlay = isPickInParlay(fixture.id);

  return (
    <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200/90 bg-white shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs shrink-0">🏀</span>
          <span className="font-mono font-bold text-amber-700 text-[11px] uppercase tracking-tight">NBA</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 text-[10px] truncate">
            {fixture.arena.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono tracking-tight font-bold animate-pulse text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>EN VIVO • {fixture.livePeriod === 'HT' ? 'MT' : fixture.livePeriod || 'Q1'}</span>
            </span>
          ) : isFinished ? (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[10px] font-semibold">
              FIN
            </span>
          ) : (
            <span className="text-slate-600 font-mono text-[10px] font-medium flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>{fixture.time}</span>
            </span>
          )}

          {isValueBet && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[9px] font-bold">
              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
              +EV
            </span>
          )}

          {/* Quick Add/Remove to Parlay Ticket */}
          <button
            type="button"
            onClick={() => {
              const bestOdd = favProb > 50 ? Number((100 / favProb).toFixed(2)) : 1.90;
              togglePick({
                id: `${fixture.id}_NBA_ML`,
                fixtureId: fixture.id,
                sport: 'NBA',
                matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                homeTeamName: fixture.homeTeam.name,
                awayTeamName: fixture.awayTeam.name,
                matchDate: fixture.date,
                matchTime: fixture.time,
                marketKey: 'NBA_ML',
                selectionLabel: `Gana ${favTeam.name}`,
                referenceOdd: bestOdd,
                userOdd: bestOdd,
                probability: favProb,
                isEV: isValueBet
              });
            }}
            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center border ${
              inParlay
                ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90'
            }`}
            title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir al boleto de combinadas'}
            aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
          >
            <Ticket className="w-3.5 h-3.5" />
          </button>

          {/* Share Button (WhatsApp / Native Share) */}
          <button
            type="button"
            onClick={() => {
              const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? fixture.homeTeam : fixture.awayTeam;
              const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);
              const title = `🏀 ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`;
              const text = `🏀 *G METRICS · ANÁLISIS NBA*\n🔥 *${fixture.homeTeam.name} vs ${fixture.awayTeam.name}*\n🏟️ ${fixture.arena?.name || 'NBA Regular'} · ${fixture.time} COT\n\n⭐ *PROYECCIÓN DE DUELA (+EV)*\n🎯 Ganador Probable: ${favTeam.name} (${favProb}%)\n🔥 Puntuación Total Proyectada: ${analysis.projectedTotalPoints} pts\n🎯 Triples Proyectados: ${analysis.threePointersMarket?.projectedTotal3PM || 26.5} 3PM\n\n📱 Analizado en G METRICS`;
              if (navigator.share) {
                navigator.share({ title, text, url: window.location.href }).catch(() => {
                  navigator.clipboard.writeText(text);
                  showToast('Análisis NBA copiado al portapapeles para WhatsApp', 'success');
                });
              } else {
                navigator.clipboard.writeText(text);
                showToast('Análisis NBA copiado al portapapeles para compartir', 'success');
              }
            }}
            className="p-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
            title="Compartir pronóstico NBA en WhatsApp / Redes"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-600" />
          </button>

          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(fixture.id)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center border ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/90'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[3] text-slate-950' : 'text-slate-500'}`} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/80 transition-colors cursor-pointer ml-0.5"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-0.5">
        <div className="flex items-center justify-end gap-2 min-w-0">
          <div className="min-w-0 text-right flex-1">
            <div className="text-[9px] font-mono text-amber-700 font-semibold uppercase truncate">
              Local · {fixture.homeTeam.wins}V-{fixture.homeTeam.losses}D
            </div>
            <div className="font-sans font-medium text-xs sm:text-sm text-slate-900 leading-tight truncate" title={fixture.homeTeam.name}>
              {formatCompactTeamName(fixture.homeTeam.name)}
            </div>
          </div>
          {fixture.homeTeam.logo?.trim() ? (
            <img
              src={fixture.homeTeam.logo}
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
        </div>

        <div className="text-center flex items-center justify-center shrink-0 px-1">
          <div className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/90 font-mono font-semibold text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center gap-1 min-w-[48px]">
            {isLive || isFinished ? (
              <span className={isLive ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
              </span>
            ) : (
              <span className="text-slate-500 text-[10px] font-medium">VS</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-start gap-2 min-w-0">
          {fixture.awayTeam.logo?.trim() ? (
            <img
              src={fixture.awayTeam.logo}
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0 text-left flex-1">
            <div className="text-[9px] font-mono text-sky-700 font-semibold uppercase truncate">
              Visita · {fixture.awayTeam.wins}V-{fixture.awayTeam.losses}D
            </div>
            <div className="font-sans font-medium text-xs sm:text-sm text-slate-900 leading-tight truncate" title={fixture.awayTeam.name}>
              {formatCompactTeamName(fixture.awayTeam.name)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PESTAÑAS (TAB BUTTON - ESTÉTICA FINTECH LIGHT)
// ==========================================

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
  badgeClass?: string;
}> = ({ active, onClick, label, badge, badgeClass }) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-1.5 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-sans font-medium tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
      active
        ? 'bg-white text-slate-900 border border-slate-200/90 shadow-2xs font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
    }`}
  >
    <span className="truncate">{label}</span>
    {badge && (
      <span className={`px-1 py-0.2 rounded text-[8px] font-mono font-bold shrink-0 border ${badgeClass || 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
        {badge}
      </span>
    )}
  </button>
);

// ==========================================
// CONTENIDO MODULAR: FÚTBOL (4 PESTAÑAS)
// ==========================================

const SoccerTabContent: React.FC<{
  tab: TabSoccer;
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  onOpenSimulator?: (fixture: MatchFixture) => void;
}> = ({ tab, fixture, analysis }) => {
  const { dixonColes, goalsMarket, cornersMarket, refereeCards } = analysis;

  if (tab === 'LINEUPS') {
    return <LineupRosterTab payload={{ type: 'SOCCER', fixture, analysis }} />;
  }

  if (tab === 'TIMELINE') {
    return (
      <LiveMatchTimeline
        fixture={fixture}
        analysis={analysis}
      />
    );
  }

  if (tab === 'LIVE_MARKETS' || tab === 'PICKS') {
    const soccerPicksView = (
      <div className="space-y-3">
        {/* Listado Completo de 6 Cápsulas de Mercado Accionables (+ Boleto) */}
        <LiveMarketCapsules
          fixture={fixture}
          analysis={analysis}
        />

        {/* Matriz 1X2 Dixon-Coles */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 text-center shadow-2xs">
          <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Probabilidad de Victoria 1X2 (Dixon-Coles)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[9px] font-mono text-slate-500 uppercase">1 (Local)</div>
              <div className="text-sm font-mono font-bold text-emerald-700">{dixonColes.pHomeWin}%</div>
              <div className="text-[9px] font-mono text-slate-500">@{dixonColes.fairOddsHome.toFixed(2)}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[9px] font-mono text-slate-500 uppercase">X (Empate)</div>
              <div className="text-sm font-mono font-bold text-amber-700">{dixonColes.pDraw}%</div>
              <div className="text-[9px] font-mono text-slate-500">@{dixonColes.fairOddsDraw.toFixed(2)}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[9px] font-mono text-slate-500 uppercase">2 (Visita)</div>
              <div className="text-sm font-mono font-bold text-sky-700">{dixonColes.pAwayWin}%</div>
              <div className="text-[9px] font-mono text-slate-500">@{dixonColes.fairOddsAway.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Top 3 Marcadores Exactos */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 text-center shadow-2xs">
          <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Top 3 Marcadores Exactos Más Probables
          </div>
          <div className="grid grid-cols-3 gap-2">
            {dixonColes.mostLikelyScores.slice(0, 3).map((scoreItem) => (
              <div
                key={scoreItem.score}
                className="p-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center"
              >
                <div className="text-xs font-mono font-bold text-slate-900">{scoreItem.score}</div>
                <div className="text-[9px] font-mono text-emerald-700 font-semibold">
                  {scoreItem.probability.toFixed(1)}% prob.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    return tab === 'PICKS' ? <ProGate featureName="Picks Algorítmicos">{soccerPicksView}</ProGate> : soccerPicksView;
  }

  if (tab === 'GOALS_CORNERS') {
    return (
      <div className="space-y-3">
        {/* Mercado de Goles */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 text-center shadow-2xs">
          <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Mercado de Goles (Líneas Over / Under)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricBox label="Más de 1.5 Goles" value={`${goalsMarket.over15}%`} sub={`@${(100 / Math.max(goalsMarket.over15, 1)).toFixed(2)}`} highlight={goalsMarket.over15 >= 75} />
            <MetricBox label="Más de 2.5 Goles" value={`${goalsMarket.over25}%`} sub={`@${(100 / Math.max(goalsMarket.over25, 1)).toFixed(2)}`} highlight={goalsMarket.over25 >= 60} />
            <MetricBox label="Menos de 3.5 Goles" value={`${goalsMarket.under35}%`} sub={`@${(100 / Math.max(goalsMarket.under35, 1)).toFixed(2)}`} highlight={goalsMarket.under35 >= 75} />
            <MetricBox label="Ambos Marcan (Sí)" value={`${goalsMarket.bttsYes}%`} sub={`@${(100 / Math.max(goalsMarket.bttsYes, 1)).toFixed(2)}`} highlight={goalsMarket.bttsYes >= 60} />
          </div>
        </div>

        {/* Mercado de Córners */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/90 text-center shadow-2xs">
          <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center justify-between px-1">
            <span>Mercado de Córners</span>
            <span className="text-emerald-700 font-mono text-[10px] font-bold">
              Proyección: ~{cornersMarket.expectedTotalCorners} córners
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <MetricBox label="Local Proyectado" value={`~${cornersMarket.lambdaHomeCorners}`} sub="córners" />
            <MetricBox label="Visita Proyectado" value={`~${cornersMarket.lambdaAwayCorners}`} sub="córners" />
            <MetricBox
              label={cornersMarket.recommendedLine.replace('Tiros de Esquina en el partido', 'Córners').replace('en el partido', '')}
              value={`${cornersMarket.recommendedProb}%`}
              sub="Recomendación"
              highlight
            />
          </div>
        </div>
      </div>
    );
  }

  // tab === 'REFEREE'
  return (
    <div className="space-y-3">
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
          <div className="text-left">
            <div className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Árbitro Principal
            </div>
            <div className="text-sm font-sans font-semibold text-slate-900">{fixture.referee.name}</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Rigor: {fixture.referee.rigor}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetricBox label="Amarillas" value={`${refereeCards.expectedYellowCards.toFixed(1)}`} sub="esperadas" />
          <MetricBox label="Rojas" value={`${refereeCards.expectedRedCards.toFixed(2)}`} sub="esperadas" />
          <MetricBox label="Faltas / Tarj." value={`${fixture.referee.foulsPerCard}`} sub="fricción" />
        </div>

        <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-mono px-3">
          <span className="text-slate-700 truncate">{refereeCards.recommendedCardPick}</span>
          <span className="text-emerald-700 font-bold shrink-0 ml-2">{refereeCards.recommendedCardProb}% Probabilidad</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CONTENIDO MODULAR: NBA (3 PESTAÑAS)
// ==========================================

const NBATabContent: React.FC<{
  tab: TabNBA;
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
}> = ({ tab, fixture, analysis }) => {
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<PlayerModalPayload | null>(null);
  const didacticAdvice = getNBADidacticAdvice(fixture, analysis);
  const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? fixture.homeTeam : fixture.awayTeam;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);

  const isLive = fixture.status === 'IN_PLAY';
  const isFinished = fixture.status === 'FINISHED';
  const hasStarted = (isLive || isFinished) && Boolean(fixture.currentScore);

  const { isPickInParlay, togglePick } = useParlay();
  const inParlay = isPickInParlay(fixture.id, 'NBA_ML');

  const evaluatedMarkets = evaluateNBAMarketsLiveStatus(fixture, analysis);

  if (tab === 'LINEUPS') {
    return <LineupRosterTab payload={{ type: 'NBA', fixture, analysis }} />;
  }

  if (tab === 'PICKS') {
    const teamHits = evaluatedMarkets.filter((m) => m.isHit).length;
    const teamMisses = evaluatedMarkets.length - teamHits;

    return (
      <ProGate featureName="Picks NBA +EV">
        <div className="space-y-3.5 text-left">
        {/* 1. Tarjeta Principal de Recomendación Pre-Partido */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-amber-50/70 border border-amber-200/90 shadow-2xs text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-600" />
              {didacticAdvice.badgeLabel}
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Puntos Proyectados: {analysis.projectedTotalPoints} pts
            </span>
          </div>

          <div className="text-base sm:text-lg font-sans font-semibold text-slate-900 mb-1">
            {didacticAdvice.headline}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-600">
            <div>
              Hándicap Justo:{' '}
              <strong className="text-amber-700">
                {analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread}
              </strong>
            </div>
            <div>
              Meta Totales: <strong className="text-slate-900">+{analysis.fairTotalLine} pts</strong>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                const bestOdd = favProb > 50 ? Number((100 / favProb).toFixed(2)) : 1.90;
                togglePick({
                  id: `${fixture.id}_NBA_ML`,
                  fixtureId: fixture.id,
                  sport: 'NBA',
                  matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                  homeTeamName: fixture.homeTeam.name,
                  awayTeamName: fixture.awayTeam.name,
                  matchDate: fixture.date,
                  matchTime: fixture.time,
                  marketKey: 'NBA_ML',
                  selectionLabel: `Gana ${favTeam.name}`,
                  referenceOdd: bestOdd,
                  userOdd: bestOdd,
                  probability: favProb,
                  isEV: Boolean(analysis.marketOdds?.valueBetDetected)
                });
              }}
              className={`px-3.5 py-1.5 rounded-xl font-sans text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                inParlay
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-2xs'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{inParlay ? 'En el Boleto ✓' : '+ Añadir al Boleto Combinada'}</span>
            </button>
          </div>
        </div>

        {/* 2. Auditoría de los 6 Mercados Generales del Partido */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-tight">
                🏀 6 Mercados Generales del Partido
              </span>
              {isLive && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[9.5px] font-bold animate-pulse">
                  EN VIVO
                </span>
              )}
              {isFinished && (
                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[9.5px] font-bold">
                  RESULTADO FINAL
                </span>
              )}
            </div>

            {hasStarted && (
              <div className="flex items-center gap-2 text-[10.5px] font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                <span className="text-emerald-400">✅ {teamHits} {isFinished ? 'Acertadas' : 'En Ritmo'}</span>
                {teamMisses > 0 && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className="text-rose-400">❌ {teamMisses} {isFinished ? 'No se dieron' : 'Bajo Ritmo'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {evaluatedMarkets.map((mkt) => {
              const mktInParlay = isPickInParlay(fixture.id, mkt.id);
              return (
                <div
                  key={mkt.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                    hasStarted
                      ? mkt.isHit
                        ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-200/80'
                        : 'bg-rose-50/75 border-rose-300'
                      : mktInParlay
                      ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-200'
                      : 'bg-white border-slate-200/90 hover:border-amber-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-600 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {mkt.category}
                      </span>
                      {hasStarted ? (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            mkt.isHit
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-rose-600 text-white border-rose-700'
                          }`}
                        >
                          {mkt.statusText}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {mkt.prob}% Prob.
                        </span>
                      )}
                    </div>

                    <div className="text-xs sm:text-sm font-sans font-bold text-slate-900 leading-snug pt-0.5">
                      {mkt.label}
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-600 pt-0.5">
                      <span>{mkt.subLabel}</span>
                      {mkt.currentValueLabel && (
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded ${
                            mkt.isHit ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {mkt.currentValueLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                    <span className="text-[10.5px] font-mono text-slate-600">
                      Prob: <strong className="text-slate-900">{mkt.prob}%</strong> · Cuota{' '}
                      <strong className="text-amber-800">@{mkt.odd.toFixed(2)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        togglePick({
                          id: `${fixture.id}_${mkt.id}`,
                          fixtureId: fixture.id,
                          sport: 'NBA',
                          matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                          homeTeamName: fixture.homeTeam.name,
                          awayTeamName: fixture.awayTeam.name,
                          matchDate: fixture.date,
                          matchTime: fixture.time,
                          marketKey: mkt.id,
                          selectionLabel: mkt.label,
                          referenceOdd: mkt.odd,
                          userOdd: mkt.odd,
                          probability: mkt.prob,
                          isEV: mkt.prob >= 55
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                        mktInParlay
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-amber-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      <Ticket className="w-3 h-3 text-amber-600" />
                      <span>{mktInParlay ? '✓ En Boleto' : '+ Boleto'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Mercados Individuales por Jugador (Sin auditoría individual roja/verde, limpio para el Boleto) */}
        <div className="space-y-2 pt-2 border-t border-slate-200/90">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-tight">
                Proyecciones Individuales por Jugador (Player Props)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Haz clic en una línea para añadirla a tu Boleto
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {analysis.playerProps.map((player) => {
              const safeName = player.name.replace(/\s+/g, '_');
              const astLine = player.astLine ?? 4.5;
              const rebLine = player.rebLine ?? 5.5;
              const praLine = player.praLine ?? Math.floor(player.pointsLine + astLine + rebLine) - 0.5;

              const indivProps = [
                {
                  key: `PROP_PTS_${safeName}`,
                  shortLabel: `+${player.pointsLine} Pts`,
                  fullLabel: `${player.name}: +${player.pointsLine} Puntos`,
                  prob: player.overPointsProb,
                  odd: Number((100 / Math.max(10, player.overPointsProb)).toFixed(2))
                },
                {
                  key: `PROP_3PM_${safeName}`,
                  shortLabel: `+${player.threePointersLine} 3PM`,
                  fullLabel: `${player.name}: +${player.threePointersLine} Triples`,
                  prob: player.over3pmProb,
                  odd: Number((100 / Math.max(10, player.over3pmProb)).toFixed(2))
                },
                {
                  key: `PROP_AST_${safeName}`,
                  shortLabel: `+${astLine} Ast`,
                  fullLabel: `${player.name}: +${astLine} Asistencias`,
                  prob: player.overAstProb ?? 60,
                  odd: 1.85
                },
                {
                  key: `PROP_REB_${safeName}`,
                  shortLabel: `+${rebLine} Reb`,
                  fullLabel: `${player.name}: +${rebLine} Rebotes`,
                  prob: player.overRebProb ?? 58,
                  odd: 1.90
                },
                {
                  key: `PROP_PRA_${safeName}`,
                  shortLabel: `+${praLine} PRA`,
                  fullLabel: `${player.name}: +${praLine} Combo PRA`,
                  prob: player.overPraProb ?? 63,
                  odd: 1.80
                }
              ];

              return (
                <div
                  key={player.id}
                  className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-sans font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{player.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[9.5px]">
                          {player.position}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        {player.team} · Promedio: {player.seasonPpg} PPG / {player.season3pm} 3PM
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlayerModal({
                          sport: 'NBA',
                          fixtureId: fixture.id,
                          matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                          homeTeamName: fixture.homeTeam.name,
                          awayTeamName: fixture.awayTeam.name,
                          matchDate: fixture.date,
                          matchTime: fixture.time,
                          matchStatus: fixture.status,
                          player: {
                            id: player.id,
                            name: player.name,
                            number: 23,
                            position: player.position,
                            teamName: player.team,
                            ppg: player.seasonPpg,
                            threePm: player.season3pm,
                            usageRate: player.usageRate,
                            projectedPoints: player.projectedPoints,
                            pointsLine: player.pointsLine,
                            overPointsProb: player.overPointsProb,
                            projected3pm: player.projected3pm,
                            threePointersLine: player.threePointersLine,
                            over3pmProb: player.over3pmProb,
                            astLine: player.astLine,
                            overAstProb: player.overAstProb,
                            rebLine: player.rebLine,
                            overRebProb: player.overRebProb,
                            praLine: player.praLine,
                            overPraProb: player.overPraProb
                          }
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <BarChart2 className="w-3 h-3 text-amber-600" />
                      <span>Detalle</span>
                    </button>
                  </div>

                  {/* Botones de Apuestas Individuales del Jugador (Limpios para el Boleto) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono">
                    {indivProps.map((ip) => {
                      const propInParlay = isPickInParlay(fixture.id, ip.key);
                      return (
                        <button
                          key={ip.key}
                          type="button"
                          onClick={() => {
                            togglePick({
                              id: `${fixture.id}_${ip.key}`,
                              fixtureId: fixture.id,
                              sport: 'NBA',
                              matchTitle: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
                              homeTeamName: fixture.homeTeam.name,
                              awayTeamName: fixture.awayTeam.name,
                              matchDate: fixture.date,
                              matchTime: fixture.time,
                              marketKey: ip.key,
                              selectionLabel: ip.fullLabel,
                              referenceOdd: ip.odd,
                              userOdd: ip.odd,
                              probability: ip.prob,
                              isEV: ip.prob >= 58
                            });
                          }}
                          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            propInParlay
                              ? 'bg-slate-900 text-white border-slate-900 ring-1 ring-amber-400'
                              : 'bg-slate-50 hover:bg-amber-50/70 border-slate-200/90 text-slate-900'
                          }`}
                          title={`${ip.fullLabel} (@${ip.odd.toFixed(2)}) — Clic para añadir al boleto`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[10.5px] font-bold truncate">{ip.shortLabel}</span>
                            <Ticket className={`w-2.5 h-2.5 shrink-0 ${propInParlay ? 'text-amber-400' : 'text-amber-600'}`} />
                          </div>
                          <div className="text-[9px] flex items-center justify-between opacity-90 mt-0.5">
                            <span className={propInParlay ? 'text-amber-300 font-semibold' : 'text-emerald-700 font-semibold'}>
                              {ip.prob}% prob.
                            </span>
                            <span>@{ip.odd.toFixed(2)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <PlayerStatsModal
          payload={selectedPlayerModal}
          isOpen={Boolean(selectedPlayerModal)}
          onClose={() => setSelectedPlayerModal(null)}
        />
        </div>
      </ProGate>
    );
  }

  if (tab === 'QUARTERS_3PM') {
    const threeMkt = evaluatedMarkets.find((m) => m.id === 'NBA_3PM_TOTAL');

    return (
      <div className="space-y-3 text-center">
        {analysis.threePointersMarket && (
          <div
            className={`p-3 rounded-2xl border shadow-2xs ${
              hasStarted && threeMkt
                ? threeMkt.isHit
                  ? 'bg-emerald-50/80 border-emerald-400'
                  : 'bg-rose-50/70 border-rose-300'
                : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <span className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-wider">
                Mercado de Triples (Meta: +{ Math.max(16.5, analysis.threePointersMarket.threePointLine - 2) } Triples)
              </span>
              {hasStarted && threeMkt && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    threeMkt.isHit ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {threeMkt.statusText} ({threeMkt.currentValueLabel})
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Local Triples" value={`${analysis.threePointersMarket.projectedHome3PM}`} sub="3PM esperados" />
              <MetricBox label="Visita Triples" value={`${analysis.threePointersMarket.projectedAway3PM}`} sub="3PM esperados" />
              <MetricBox label="Total Partido" value={`${analysis.threePointersMarket.projectedTotal3PM}`} sub={`Meta +${Math.max(16.5, analysis.threePointersMarket.threePointLine - 2)}`} highlight />
            </div>
          </div>
        )}

        {analysis.quarterProjections && (
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-[10.5px] font-mono font-bold text-slate-700 uppercase tracking-wider">
                Desglose y Auditoría por Cuartos (1Q - 4Q y 1ra Mitad)
              </span>
              <span className="text-[10px] font-sans text-slate-500">
                Arriba: Pronóstico · Centro: Marcador Real · Abajo: Meta de puntos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {analysis.quarterProjections.map((qp) => {
                const hasQActual = qp.actualHome !== undefined && qp.actualAway !== undefined;
                const actualTotal = hasQActual ? qp.actualHome! + qp.actualAway! : 0;
                const isQFinal = qp.status === 'FINAL';
                const isQInPlay = qp.status === 'IN_PLAY';
                const qOverHit = hasQActual && actualTotal > qp.overLine;
                const minPointsNeeded = Math.ceil(qp.overLine);

                return (
                  <div
                    key={qp.quarter}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all shadow-2xs ${
                      isQFinal
                        ? qOverHit
                          ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-200/70'
                          : 'bg-rose-50/75 border-rose-300'
                        : isQInPlay
                        ? qOverHit
                          ? 'bg-emerald-50/90 border-emerald-400'
                          : 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200/60'
                        : 'bg-slate-50/80 border-slate-200/90'
                    }`}
                  >
                    {/* 1. ARRIBA: Pronóstico de la Página + Estado del Cuarto */}
                    <div className="space-y-1 border-b border-slate-200/70 pb-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono font-extrabold text-slate-900">
                          {qp.quarter === '1H' ? '1ra Mitad' : `Cuarto ${qp.quarter}`}
                        </span>
                        {isQFinal ? (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                              qOverHit ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                          >
                            {qOverHit ? '✅ Acertado' : '❌ No se dio'}
                          </span>
                        ) : isQInPlay ? (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                              qOverHit ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950 animate-pulse'
                            }`}
                          >
                            {qOverHit ? '✅ Ya Acertado' : '⏳ En juego'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                            🕒 Por jugar
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-amber-900 bg-amber-100/70 border border-amber-200/80 rounded-md px-1.5 py-0.5 font-semibold">
                        Pronóstico: +{qp.overLine} pts
                      </div>
                    </div>

                    {/* 2. CENTRO: Resultado Real (o En Vivo / Esperado) */}
                    <div className="text-center py-0.5">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">
                        {isQFinal
                          ? 'Resultado Real'
                          : isQInPlay
                          ? 'Marcador en Vivo'
                          : 'Puntos Esperados'}
                      </span>
                      <div className="text-base font-mono font-black text-slate-900 leading-tight mt-0.5">
                        {hasQActual ? `${actualTotal} pts` : `~${qp.projectedTotal} pts`}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-slate-700">
                        {hasQActual
                          ? `${fixture.homeTeam.shortName} ${qp.actualHome} - ${qp.actualAway} ${fixture.awayTeam.shortName}`
                          : `Proy: ${qp.projectedHome} - ${qp.projectedAway}`}
                      </div>
                    </div>

                    {/* 3. ABAJO: Explicación clara de la meta (sin jerga confusa de "Línea") */}
                    <div className="pt-1.5 border-t border-slate-200/70 text-[9.5px] font-sans leading-snug text-slate-600 text-center">
                      {isQFinal ? (
                        qOverHit ? (
                          <span className="text-emerald-800 font-semibold">
                            Meta era {minPointsNeeded}+ pts (Superada por +{actualTotal - minPointsNeeded + 1} pts)
                          </span>
                        ) : (
                          <span className="text-rose-800 font-medium">
                            Meta era {minPointsNeeded}+ pts (Faltaron {Math.max(1, minPointsNeeded - actualTotal)} pts)
                          </span>
                        )
                      ) : isQInPlay ? (
                        <span className="text-amber-900 font-medium">
                          Meta: Se necesitan {minPointsNeeded}+ pts en total
                        </span>
                      ) : (
                        <span>
                          Meta: Hacer <strong>{minPointsNeeded}+ pts</strong> · Fav: <strong>{qp.favorite}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // tab === 'PACE_STREAK'
  const h2hData = calculateNBAH2HAnalysis(fixture);
  const homePace = fixture.homeTeam.pace;
  const awayPace = fixture.awayTeam.pace;
  const combinedPace = analysis.expectedPace || Math.round(((homePace + awayPace) / 2) * 10) / 10;
  const isFastPace = combinedPace >= 100.5;
  const isSlowPace = combinedPace <= 98.0;

  return (
    <div className="space-y-2.5 text-center">
      {/* 1. RESUMEN EJECUTIVO DE LA SERIE H2H (HEAD TO HEAD) */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 text-left">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚔️</span>
            <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">
              Historial Directo (H2H · Últimos {h2hData.totalMatches} Duelos)
            </span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
            Línea Ref: ~{h2hData.referenceLine} pts
          </span>
        </div>

        {/* Marcador de Serie / Balance de Victorias */}
        <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80">
          <div className="flex items-center justify-between gap-2">
            {/* Equipo Local */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img
                src={fixture.homeTeam.logo}
                alt=""
                className="w-6 h-6 object-contain shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="min-w-0 text-left">
                <div className="font-bold text-[11px] sm:text-xs text-slate-900 truncate">
                  {fixture.homeTeam.shortName}
                </div>
                <div className="text-[9px] font-mono font-semibold text-emerald-700">
                  {h2hData.homeWins}V ({h2hData.homeWinPct}%)
                </div>
              </div>
            </div>

            {/* Marcador Central */}
            <div className="shrink-0 text-center px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs sm:text-sm font-mono font-black text-slate-900 tracking-tight">
                {h2hData.homeWins} - {h2hData.awayWins}
              </span>
              <span className="block text-[7.5px] font-mono uppercase text-slate-500 font-bold tracking-tight">
                SERIE
              </span>
            </div>

            {/* Equipo Visita */}
            <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
              <div className="min-w-0">
                <div className="font-bold text-[11px] sm:text-xs text-slate-900 truncate">
                  {fixture.awayTeam.shortName}
                </div>
                <div className="text-[9px] font-mono font-semibold text-sky-700">
                  {h2hData.awayWins}V ({h2hData.awayWinPct}%)
                </div>
              </div>
              <img
                src={fixture.awayTeam.logo}
                alt=""
                className="w-6 h-6 object-contain shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>

          {/* Barra de proporción visual */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2.5 flex">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${h2hData.homeWinPct}%` }}
              title={`${fixture.homeTeam.shortName}: ${h2hData.homeWinPct}%`}
            />
            <div
              className="bg-sky-500 h-full transition-all"
              style={{ width: `${h2hData.awayWinPct}%` }}
              title={`${fixture.awayTeam.shortName}: ${h2hData.awayWinPct}%`}
            />
          </div>
        </div>

        {/* 3 Métricas Clave de los Enfrentamientos */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <MetricBox
            label="Promedio Puntos"
            value={`${h2hData.avgTotalPoints} pts`}
            sub="Por duelo directo"
            highlight
          />
          <MetricBox
            label="Tendencia Altas"
            value={`${h2hData.overCount}A / ${h2hData.underCount}B`}
            sub={`Línea ${h2hData.referenceLine}`}
          />
          <MetricBox
            label="Mayor Margen"
            value={`+${h2hData.maxMarginMatch.margin} pts`}
            sub={h2hData.maxMarginMatch.winnerShortName}
          />
        </div>
      </div>

      {/* 2. LISTADO DETALLADO DE LOS ÚLTIMOS 5 ENFRENTAMIENTOS DIRECTOS */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 text-left">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">
            Detalle de los Últimos Partidos Cara a Cara
          </span>
          <span className="text-[9px] font-sans text-slate-500">
            Resaltado en negrita el ganador
          </span>
        </div>

        <div className="space-y-1.5">
          {h2hData.recentMatches.map((m) => {
            const homeWon = m.homeScore > m.awayScore;

            return (
              <div
                key={m.id}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-50/90 hover:bg-slate-100/80 border border-slate-200/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2"
              >
                {/* Meta de fecha y sede */}
                <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0 sm:w-28">
                  <div className="text-left leading-tight">
                    <span className="text-[9.5px] font-mono font-bold text-slate-800 block">
                      {m.date}
                    </span>
                    <span className="text-[8px] font-sans text-slate-500 block truncate max-w-[105px]" title={m.venueName}>
                      {m.venueName}
                    </span>
                  </div>
                </div>

                {/* Duelo de Marcador Central con Logos (Sin cortes, proporciones fluidas) */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-1 min-w-0 py-0.5">
                  {/* Local en ese partido */}
                  <div className={`flex items-center gap-1 text-right justify-end flex-1 min-w-0 ${homeWon ? 'font-bold text-slate-950' : 'text-slate-600 font-normal'}`}>
                    <span className="text-[10.5px] sm:text-[11px] truncate leading-tight">{m.homeShortName}</span>
                    <img
                      src={m.homeLogo}
                      alt=""
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="font-mono text-xs font-bold shrink-0">{m.homeScore}</span>
                  </div>

                  <span className="text-slate-300 font-mono text-[9px] font-bold shrink-0">-</span>

                  {/* Visitante en ese partido */}
                  <div className={`flex items-center gap-1 text-left justify-start flex-1 min-w-0 ${!homeWon ? 'font-bold text-slate-950' : 'text-slate-600 font-normal'}`}>
                    <span className="font-mono text-xs font-bold shrink-0">{m.awayScore}</span>
                    <img
                      src={m.awayLogo}
                      alt=""
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="text-[10.5px] sm:text-[11px] truncate leading-tight">{m.awayShortName}</span>
                  </div>
                </div>

                {/* Badge de resultado y tendencia O/U */}
                <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-1 sm:pt-0 border-slate-200/80">
                  <span className="text-[8.5px] font-mono text-slate-600 shrink-0">
                    {m.totalPoints} pts
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border shrink-0 ${
                      m.overUnderResult === 'OVER'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}
                  >
                    {m.overUnderResult === 'OVER' ? '🔥 Alta' : '❄️ Baja'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-slate-200/80 text-slate-800 shrink-0">
                    +{m.margin} {m.winnerShortName.slice(0, 3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RITMO DE POSESIONES (PACE) Y EFICIENCIA OFENSIVA/DEFENSIVA */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 text-left">
        <div className="flex items-center justify-between gap-2 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">
              Ritmo de Posesiones (Pace) y Eficiencia
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Ritmo Conjunto: {combinedPace} pos.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Local */}
          <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/90 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-900 truncate">
                {fixture.homeTeam.name}
              </span>
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700">
                Racha: {fixture.homeTeam.streak}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Pace</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.homeTeam.pace}</span>
              </div>
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Off Rtg</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.homeTeam.offensiveRating}</span>
              </div>
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Def Rtg</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.homeTeam.defensiveRating}</span>
              </div>
            </div>
          </div>

          {/* Visita */}
          <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/90 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-900 truncate">
                {fixture.awayTeam.name}
              </span>
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700">
                Racha: {fixture.awayTeam.streak}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Pace</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.awayTeam.pace}</span>
              </div>
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Off Rtg</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.awayTeam.offensiveRating}</span>
              </div>
              <div className="p-1 rounded-lg bg-white border border-slate-200">
                <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Def Rtg</span>
                <span className="text-[11px] font-mono font-bold text-slate-900">{fixture.awayTeam.defensiveRating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnóstico de Ritmo */}
        <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[10px] font-sans text-amber-950 flex items-start gap-1.5 text-left">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Lectura Analítica:</strong>{' '}
            {isFastPace ? (
              <span>Ritmo Alto ({combinedPace} pos/48m). Mayor volumen de tiros y transición rápida. Favorable a líneas Over de puntos y triples.</span>
            ) : isSlowPace ? (
              <span>Ritmo Pausado ({combinedPace} pos/48m). Posesiones largas de media cancha y defensa física. Mayor control defensivo.</span>
            ) : (
              <span>Ritmo Equilibrado ({combinedPace} pos/48m). Flujo estándar de la NBA con posesiones balanceadas entre transición y juego posicional.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CAJA DE MÉTRICAS PURAS Y CENTRADAS
// ==========================================

const MetricBox: React.FC<{
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}> = ({ label, value, sub, highlight = false }) => (
  <div
    className={`p-2 rounded-xl border transition-all text-center flex flex-col items-center justify-center ${
      highlight
        ? 'bg-emerald-50/90 border-emerald-200 ring-1 ring-emerald-500/15'
        : 'bg-slate-50/90 border-slate-200/80'
    }`}
  >
    <div className="text-[9px] font-mono text-slate-500 uppercase leading-tight line-clamp-1 max-w-full" title={label}>
      {label}
    </div>
    <div className={`text-xs sm:text-sm font-mono font-bold mt-0.5 ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>
      {value}
    </div>
    {sub && <div className="text-[8px] font-mono text-slate-500 truncate max-w-full mt-0.5">{sub}</div>}
  </div>
);

