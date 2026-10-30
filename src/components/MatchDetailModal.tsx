import React, { useState, useEffect } from 'react';
import { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';
import { getNBADidacticAdvice } from '../services/didacticService';
import {
  X,
  Sparkles,
  Clock,
  Sliders,
  Check,
  Flame,
  Ticket,
  Share2
} from 'lucide-react';
import { useParlay } from '../context/ParlayContext';
import { useToast } from '../context/ToastContext';
import { LiveMatchTimeline } from './LiveMatchTimeline';
import { LiveMarketCapsules } from './LiveMarketCapsules';
import { LineupRosterTab } from './LineupRosterTab';
import { formatCompactTeamName } from '../services/leagueCategorizer';

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
                label="⚡ Ritmo"
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
    return (
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
  const didacticAdvice = getNBADidacticAdvice(fixture, analysis);
  const favTeam = analysis.pHomeWin >= analysis.pAwayWin ? fixture.homeTeam : fixture.awayTeam;
  const favProb = Math.max(analysis.pHomeWin, analysis.pAwayWin);

  const { isPickInParlay, togglePick } = useParlay();
  const inParlay = isPickInParlay(fixture.id);

  if (tab === 'LINEUPS') {
    return <LineupRosterTab payload={{ type: 'NBA', fixture, analysis }} />;
  }

  if (tab === 'PICKS') {
    return (
      <div className="space-y-3 text-center">
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-amber-50/70 border border-amber-200/90 shadow-2xs">
          <div className="flex items-center justify-center gap-2 mb-1">
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
              Línea Totales: <strong className="text-slate-900">{analysis.fairTotalLine} pts</strong>
            </div>
          </div>

          {/* Quick Add/Remove Parlay Button */}
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

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="text-[9px] font-mono text-slate-500 uppercase truncate">{formatCompactTeamName(fixture.homeTeam.name)}</div>
            <div className="text-sm font-mono font-bold text-emerald-700">{analysis.pHomeWin}%</div>
            <div className="text-[9px] font-mono text-slate-500">ML Justo @{(100 / Math.max(analysis.pHomeWin, 1)).toFixed(2)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="text-[9px] font-mono text-slate-500 uppercase truncate">{formatCompactTeamName(fixture.awayTeam.name)}</div>
            <div className="text-sm font-mono font-bold text-sky-700">{analysis.pAwayWin}%</div>
            <div className="text-[9px] font-mono text-slate-500">ML Justo @{(100 / Math.max(analysis.pAwayWin, 1)).toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'QUARTERS_3PM') {
    return (
      <div className="space-y-3 text-center">
        {analysis.threePointersMarket && (
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              Mercado de Triples (3PM Proyectados)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="Local Triples" value={`${analysis.threePointersMarket.projectedHome3PM}`} sub="3PM" />
              <MetricBox label="Visita Triples" value={`${analysis.threePointersMarket.projectedAway3PM}`} sub="3PM" />
              <MetricBox label="Total Partido" value={`${analysis.threePointersMarket.projectedTotal3PM}`} sub="3PM total" highlight />
            </div>
          </div>
        )}

        {analysis.quarterProjections && (
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              Desglose Proyectado por Cuartos
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {analysis.quarterProjections.slice(0, 4).map((qp) => (
                <MetricBox
                  key={qp.quarter}
                  label={qp.label || qp.quarter}
                  value={`${qp.projectedTotal} pts`}
                  sub={`${qp.projectedHome}-${qp.projectedAway}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // tab === 'PACE_STREAK'
  return (
    <div className="space-y-3 text-center">
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="text-[10px] font-mono font-semibold text-slate-500 mb-2 uppercase tracking-wider">
          Ritmo de Posesiones (Pace) y Racha
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricBox label={fixture.homeTeam.shortName} value={`Pace ${fixture.homeTeam.pace}`} sub={`Racha: ${fixture.homeTeam.streak}`} />
          <MetricBox label={fixture.awayTeam.shortName} value={`Pace ${fixture.awayTeam.pace}`} sub={`Racha: ${fixture.awayTeam.streak}`} />
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

