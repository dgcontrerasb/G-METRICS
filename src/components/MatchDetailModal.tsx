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
  isPro?: boolean;
}

type TabSoccer = 'TIMELINE' | 'LIVE_MARKETS' | 'PICKS' | 'GOALS_CORNERS' | 'REFEREE' | 'LINEUPS';
type TabNBA = 'PICKS' | 'QUARTERS_3PM' | 'PACE_STREAK' | 'LINEUPS';

export const MatchDetailModal: React.FC<MatchDetailModalProps> = React.memo(({
  payload,
  isOpen,
  onClose,
  isSelected = false,
  onToggleSelect,
  onOpenSimulator,
  isPro
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop blur independiente (fondo visible y difuminado cristalino) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Floating Card Window (Modular Bento Quantitative Grid - Mobile & PC) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl h-[91vh] sm:h-[88vh] max-h-[720px] sm:my-auto bg-[#161b22] border border-[#30363d] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden overscroll-contain text-[#e6edf3] animate-in zoom-in-95 duration-200"
      >
        {/* 1. HEADER FIJO COMPACTO: Duelo de Equipos y Marcador Bento */}
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

        {/* 2. SEGMENTED BENTO TAB DOCK (Adaptable Móvil y PC) */}
        <div className="px-3 sm:px-5 py-2 bg-[#161b22] border-b border-[#21262d] shrink-0">
          <div className="p-1 rounded-2xl bg-[#0b0e14] border border-[#30363d] shadow-inner text-center gap-1 grid grid-cols-4">
            {isSoccer ? (
              <>
                <TabButton
                  active={activeTabSoccer === 'TIMELINE'}
                  onClick={() => setActiveTabSoccer('TIMELINE')}
                  label="Minuto"
                  badge={payload.fixture.status === 'IN_PLAY' ? 'VIVO' : undefined}
                  badgeClass="bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
                />
                <TabButton
                  active={activeTabSoccer === 'PICKS' || activeTabSoccer === 'LIVE_MARKETS'}
                  onClick={() =>
                    setActiveTabSoccer(payload.fixture.status === 'IN_PLAY' ? 'LIVE_MARKETS' : 'PICKS')
                  }
                  label="Picks"
                  badge="+EV"
                />
                <TabButton
                  active={activeTabSoccer === 'GOALS_CORNERS' || activeTabSoccer === 'REFEREE'}
                  onClick={() => setActiveTabSoccer('GOALS_CORNERS')}
                  label="Goles, Córn. & Árbitro"
                />
                <TabButton
                  active={activeTabSoccer === 'LINEUPS'}
                  onClick={() => setActiveTabSoccer('LINEUPS')}
                  label="Plantillas 2D"
                />
              </>
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
        </div>

        {/* 3. CONTENIDO CON SCROLL INTERNO Y PADDING INFERIOR SEGURO */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-6 space-y-3.5 text-[#e6edf3] bg-[#0b0e14]/70 overscroll-contain">
          {isSoccer ? (
            <SoccerTabContent
              tab={activeTabSoccer}
              fixture={effectiveSoccerFixture || payload.fixture}
              analysis={payload.analysis}
              isPro={isPro}
              onOpenSimulator={onOpenSimulator}
            />
          ) : (
            <NBATabContent
              tab={activeTabNBA}
              fixture={payload.fixture}
              analysis={payload.analysis}
              isPro={isPro}
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
    <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-[#21262d] bg-[#161b22] shrink-0 space-y-2">
      {/* Top Bar: Liga + Badges + Botón Cerrar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {fixture.league.flag && fixture.league.flag.startsWith('http') ? (
            <img
              src={fixture.league.flag}
              alt=""
              className="w-4 h-3 object-cover rounded shadow-2xs inline-block shrink-0 border border-[#30363d]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs shrink-0">{fixture.league.flag || '🏆'}</span>
          )}
          <span className="font-semibold text-slate-300 tracking-wide uppercase text-[10px] sm:text-[11px] truncate">
            {fixture.league.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {fixture.status === 'PENALTY_SHOOTOUT' || fixture.currentScore?.statusShort === 'PEN' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono tracking-tight font-bold animate-pulse text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>PENALES · 120'</span>
            </span>
          ) : isLive || fixture.status === 'EXTRA_TIME' || fixture.status === 'HALFTIME' || fixture.status === 'PAUSED' ? (
            fixture.currentScore?.isHalfTime || fixture.status === 'HALFTIME' || fixture.status === 'PAUSED' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d9b114]/15 text-[#d9b114] border border-[#d9b114]/40 font-mono tracking-tight font-bold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d9b114]" />
                <span>DESCANSO · 45'</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono tracking-tight font-bold animate-pulse text-[10px]">
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
            <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#8b949e] border border-[#30363d] font-mono text-[10px] font-semibold">
              FIN
            </span>
          ) : (
            <span className="text-[#8b949e] font-mono text-[10px] font-medium flex items-center gap-1 bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d]">
              <Clock className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
              <span>{fixture.time}</span>
            </span>
          )}

          {isValueBet && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#00ff66]/15 border border-[#00ff66]/30 text-[#00ff66] font-mono text-[9px] font-bold">
              <Sparkles className="w-2.5 h-2.5 text-[#00ff66]" strokeWidth={2} />
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
                ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] font-bold shadow-2xs'
                : 'bg-[#0b0e14] hover:bg-[#1c2129] text-white border-[#30363d]'
            }`}
            title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir al boleto de combinadas'}
            aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
          >
            <Ticket className="w-3.5 h-3.5" strokeWidth={2} />
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
            className="p-1.5 rounded-lg bg-[#0b0e14] text-slate-300 hover:text-white hover:bg-[#1c2129] border border-[#30363d] transition-colors cursor-pointer"
            title="Compartir pronóstico en WhatsApp / Redes"
          >
            <Share2 className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
          </button>

          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(fixture.id)}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center border ${
                isSelected
                  ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] font-bold shadow-2xs'
                  : 'bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] border-[#30363d]'
              }`}
              title={isSelected ? 'Quitar de mi selección' : 'Añadir a selección'}
            >
              <Check className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[3] text-slate-950' : 'text-[#8b949e]'}`} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] transition-colors cursor-pointer ml-0.5"
            aria-label="Cerrar modal"
            title="Cerrar (ESC)"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Face-off: Marcador Bento de Alto Contraste y Simétrico (Móvil y PC) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 pt-1">
        {/* Local */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
          <div className="min-w-0 text-right flex-1">
            <div className="text-[9px] font-mono text-[#d9b114] font-bold uppercase truncate">
              Local · #{fixture.homeTeam.rank}
            </div>
            <div className="font-sans font-extrabold text-xs sm:text-base text-white leading-tight truncate" title={fixture.homeTeam.name}>
              {formatCompactTeamName(fixture.homeTeam.name)}
            </div>
          </div>
          {fixture.homeTeam.logo?.trim() ? (
            <img
              src={fixture.homeTeam.logo}
              alt=""
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain shrink-0 drop-shadow-2xs"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
        </div>

        {/* Marcador Central Bento */}
        <div className="text-center flex flex-col items-center justify-center shrink-0 px-1.5">
          <div className="px-3 py-1 rounded-xl bg-[#0b0e14] text-white border border-[#30363d] font-mono font-black text-sm sm:text-lg tracking-tight whitespace-nowrap inline-flex items-center justify-center min-w-[58px] shadow-xs">
            {isLive || isFinished ? (
              <span className={isLive ? 'text-rose-400 font-bold' : 'text-white'}>
                {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
              </span>
            ) : (
              <span className="text-[#d9b114] text-xs font-extrabold">VS</span>
            )}
          </div>
        </div>

        {/* Visitante */}
        <div className="flex items-center justify-start gap-2 sm:gap-2.5 min-w-0">
          {fixture.awayTeam.logo?.trim() ? (
            <img
              src={fixture.awayTeam.logo}
              alt=""
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain shrink-0 drop-shadow-2xs"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0 text-left flex-1">
            <div className="text-[9px] font-mono text-slate-300 font-bold uppercase truncate">
              Visita · #{fixture.awayTeam.rank}
            </div>
            <div className="font-sans font-extrabold text-xs sm:text-base text-white leading-tight truncate" title={fixture.awayTeam.name}>
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
  isPro?: boolean;
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
    <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-[#21262d] bg-[#161b22] shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs shrink-0">🏀</span>
          <span className="font-mono font-bold text-[#d9b114] text-[11px] uppercase tracking-tight">NBA</span>
          <span className="text-[#30363d]">·</span>
          <span className="text-[#8b949e] text-[10px] truncate">
            {fixture.arena.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40 font-mono tracking-tight font-bold animate-pulse text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>EN VIVO • {fixture.livePeriod === 'HT' ? 'MT' : fixture.livePeriod || 'Q1'}</span>
            </span>
          ) : isFinished ? (
            <span className="px-2 py-0.5 rounded-md bg-[#0b0e14] text-[#8b949e] border border-[#30363d] font-mono text-[10px] font-semibold">
              FIN
            </span>
          ) : (
            <span className="text-[#8b949e] font-mono text-[10px] font-medium flex items-center gap-1 bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d]">
              <Clock className="w-3 h-3 text-[#d9b114]" strokeWidth={2} />
              <span>{fixture.time}</span>
            </span>
          )}

          {isValueBet && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#00ff66]/15 border border-[#00ff66]/30 text-[#00ff66] font-mono text-[9px] font-bold">
              <Sparkles className="w-2.5 h-2.5 text-[#00ff66]" strokeWidth={2} />
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
                ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] font-bold shadow-2xs'
                : 'bg-[#0b0e14] hover:bg-[#1c2129] text-white border-[#30363d]'
            }`}
            title={inParlay ? 'Quitar del boleto de combinadas' : 'Añadir al boleto de combinadas'}
            aria-label={inParlay ? 'Quitar del boleto' : 'Añadir al boleto'}
          >
            <Ticket className="w-3.5 h-3.5" strokeWidth={2} />
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
            className="p-1.5 rounded-lg bg-[#0b0e14] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d] transition-colors cursor-pointer"
            title="Compartir pronóstico NBA en WhatsApp / Redes"
          >
            <Share2 className="w-3.5 h-3.5 text-[#d9b114]" strokeWidth={2} />
          </button>

          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(fixture.id)}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center border ${
                isSelected
                  ? 'bg-[#d9b114] text-slate-950 border-[#d9b114] font-bold shadow-2xs'
                  : 'bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] border-[#30363d]'
              }`}
              title={isSelected ? 'Quitar de mi selección' : 'Añadir a selección'}
            >
              <Check className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[3] text-slate-950' : 'text-[#8b949e]'}`} strokeWidth={2} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-[#8b949e] hover:text-white border border-[#30363d] transition-colors cursor-pointer ml-0.5"
            aria-label="Cerrar modal"
            title="Cerrar (ESC)"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 pt-1">
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
          <div className="min-w-0 text-right flex-1">
            <div className="text-[9px] font-mono text-[#d9b114] font-semibold uppercase truncate">
              Local · {fixture.homeTeam.wins}V-{fixture.homeTeam.losses}D
            </div>
            <div className="font-sans font-bold text-xs sm:text-sm text-white leading-tight truncate" title={fixture.homeTeam.name}>
              {formatCompactTeamName(fixture.homeTeam.name)}
            </div>
          </div>
          {fixture.homeTeam.logo?.trim() ? (
            <img
              src={fixture.homeTeam.logo}
              alt=""
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
        </div>

        <div className="text-center flex items-center justify-center shrink-0 px-1">
          <div className="px-3 py-1 rounded-xl bg-[#0b0e14] text-white border border-[#30363d] font-mono font-bold text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center gap-1.5 min-w-[54px] shadow-xs">
            {isLive || isFinished ? (
              <span className={isLive ? 'text-amber-300 font-bold' : 'text-white'}>
                {fixture.currentScore ? `${fixture.currentScore.home} - ${fixture.currentScore.away}` : '0 - 0'}
              </span>
            ) : (
              <span className="text-[#d9b114] text-[10px] font-bold tracking-wider">VS</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-start gap-2 sm:gap-2.5 min-w-0">
          {fixture.awayTeam.logo?.trim() ? (
            <img
              src={fixture.awayTeam.logo}
              alt=""
              className="w-7 h-7 sm:w-9 sm:h-9 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0 text-left flex-1">
            <div className="text-[9px] font-mono text-sky-400 font-semibold uppercase truncate">
              Visita · {fixture.awayTeam.wins}V-{fixture.awayTeam.losses}D
            </div>
            <div className="font-sans font-bold text-xs sm:text-sm text-white leading-tight truncate" title={fixture.awayTeam.name}>
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
    className={`py-1.5 px-1.5 sm:px-2.5 rounded-xl text-[10.5px] sm:text-xs font-sans tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
      active
        ? 'bg-[#161b22] text-white border border-[#d9b114]/60 shadow-xs font-bold'
        : 'text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-transparent font-medium'
    }`}
  >
    <span className="truncate">{label}</span>
    {badge && (
      <span
        className={`px-1 py-0.2 rounded-md text-[8px] font-mono font-bold shrink-0 border ${
          badgeClass
            ? badgeClass
            : active
            ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/30'
            : 'bg-[#161b22] text-[#8b949e] border-[#30363d]'
        }`}
      >
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
  isPro?: boolean;
}> = ({ tab, fixture, analysis, isPro }) => {
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
    const totalXG = Math.max(0.2, dixonColes.lambdaHome + dixonColes.lambdaAway);
    const homePossShare = Math.min(72, Math.max(28, Math.round((dixonColes.lambdaHome / totalXG) * 100)));
    const awayPossShare = 100 - homePossShare;
    const cornerGaugePct = Math.min(96, Math.max(15, cornersMarket.recommendedProb));
    const cardGaugeRatio = Math.min(1, Math.max(0.15, refereeCards.expectedYellowCards / 7.5));

    const soccerPicksView = (
      <div className="space-y-3.5">
        {/* MATRIZ BENTO 2x2 CUANTITATIVA (2 Columnas en PC / 1 Columna Fluida en Móvil) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* CUADRANTE 1 (Arriba Izquierda): Cancha Táctica 2D & Posesión / xG */}
          <div className="rounded-2xl p-3.5 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white border border-emerald-800/80 shadow-md flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald-800/80 text-emerald-200 font-bold border border-emerald-700">
                4-2-3-1
              </span>
              <div className="flex-1 text-center truncate">
                <span className="text-emerald-200/90 font-sans text-[10px]">Dominio xG: </span>
                <strong className="text-white font-bold">{homePossShare}% vs {awayPossShare}%</strong>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-[#161b22] text-[#8b949e] font-bold border border-[#30363d]">
                4-4-2
              </span>
            </div>

            {/* Barra de Choque de Posesión / xG */}
            <div className="w-full h-1.5 rounded-full bg-[#0b0e14] overflow-hidden flex border border-[#30363d]/60">
              <div
                className="h-full bg-[#00ff66] transition-all"
                style={{ width: `${homePossShare}%` }}
              />
              <div
                className="h-full bg-sky-400 transition-all"
                style={{ width: `${awayPossShare}%` }}
              />
            </div>

            {/* Cancha 2D con Nodos Tácticos */}
            <div className="w-full bg-emerald-900/75 rounded-xl p-2 border border-emerald-700/60 shadow-inner">
              <svg className="w-full h-24 sm:h-28" viewBox="0 0 240 128">
                <rect x="6" y="6" width="228" height="116" rx="6" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" />
                <line x1="120" y1="6" x2="120" y2="122" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
                <circle cx="120" cy="64" r="20" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
                <rect x="6" y="34" width="28" height="60" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
                <rect x="206" y="34" width="28" height="60" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
                {/* Nodos Equipo Local (Esmeralda) */}
                <circle cx="20" cy="64" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="52" cy="26" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="50" cy="52" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="50" cy="76" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="52" cy="102" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="82" cy="46" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="82" cy="82" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="108" cy="64" r="5" fill="#34d399" stroke="#ffffff" strokeWidth="1.4" />
                {/* Nodos Equipo Visitante (Plata/Blanco) */}
                <circle cx="220" cy="64" r="4.5" fill="#cbd5e1" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="188" cy="28" r="4.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="190" cy="54" r="4.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="190" cy="74" r="4.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="188" cy="100" r="4.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="152" cy="44" r="4.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" />
                <circle cx="152" cy="84" r="4.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-200/90 px-0.5">
              <span>xG Local: <strong className="text-white">{dixonColes.lambdaHome.toFixed(2)}</strong></span>
              <span>xG Total: <strong className="text-amber-300">{totalXG.toFixed(2)}</strong></span>
              <span>xG Visita: <strong className="text-white">{dixonColes.lambdaAway.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* CUADRANTE 2 (Arriba Derecha): Matriz 1X2 Dixon-Coles & Top 3 Marcadores */}
          <div className="rounded-2xl p-3.5 bg-[#161b22] border border-[#30363d] flex flex-col justify-between gap-2.5 shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-sans font-extrabold text-white tracking-tight">
                  Probabilidad 1X2 &amp; Marcadores Exactos
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#0b0e14] border border-[#30363d] text-[#8b949e] font-mono text-[9.5px] font-bold">
                  Modelo Predictivo
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                  <div className="text-[9px] font-mono text-[#8b949e] uppercase">1 (Local)</div>
                  <div className="text-sm font-mono tabular-nums font-black text-white">{dixonColes.pHomeWin}%</div>
                  <div className="text-[9px] font-mono tabular-nums text-[#8b949e]">@{dixonColes.fairOddsHome.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                  <div className="text-[9px] font-mono text-[#8b949e] uppercase">X (Empate)</div>
                  <div className="text-sm font-mono tabular-nums font-black text-white">{dixonColes.pDraw}%</div>
                  <div className="text-[9px] font-mono tabular-nums text-[#8b949e]">@{dixonColes.fairOddsDraw.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                  <div className="text-[9px] font-mono text-[#8b949e] uppercase">2 (Visita)</div>
                  <div className="text-sm font-mono tabular-nums font-black text-white">{dixonColes.pAwayWin}%</div>
                  <div className="text-[9px] font-mono tabular-nums text-[#8b949e]">@{dixonColes.fairOddsAway.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#30363d]">
              <div className="text-[9.5px] font-mono font-bold text-[#8b949e] mb-1.5 uppercase tracking-wider">
                Top 3 Marcadores Exactos Más Probables
              </div>
              <div className="grid grid-cols-3 gap-2">
                {dixonColes.mostLikelyScores.slice(0, 3).map((scoreItem, idx) => (
                  <div
                    key={scoreItem.score}
                    className={`p-1.5 rounded-xl border text-center ${
                      idx === 0
                        ? 'bg-[#0b0e14] border-[#d9b114]/60 shadow-2xs'
                        : 'bg-[#0b0e14] border-[#30363d]'
                    }`}
                  >
                    <div className="text-xs font-mono tabular-nums font-black text-white">{scoreItem.score}</div>
                    <div className="text-[9px] font-mono tabular-nums text-[#d9b114] font-bold">
                      {scoreItem.probability.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CUADRANTE 3 (Abajo Izquierda): Mercado de Goles & Córners con Anillo Radial */}
          <div className="rounded-2xl p-3.5 bg-[#161b22] border border-[#30363d] flex flex-col justify-between gap-2.5 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-sans font-extrabold text-white tracking-tight">
                Mercado de Goles &amp; Córners
              </span>
              <span className="text-[10px] font-mono tabular-nums font-bold text-[#00ff66]">
                +1.5 Goles: {goalsMarket.over15}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Anillo Radial de Córners */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14.5" fill="none" stroke="#21262d" strokeWidth="3.5" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14.5"
                    fill="none"
                    stroke="#00ff66"
                    strokeWidth="3.5"
                    strokeDasharray={`${Math.round((cornerGaugePct / 100) * 91)} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[11px] font-mono tabular-nums font-black text-white">
                  {cornersMarket.recommendedProb}%
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-mono tabular-nums font-black text-white leading-none">
                    ~{cornersMarket.expectedTotalCorners}
                  </span>
                  <span className="text-[10.5px] font-sans font-semibold text-[#8b949e]">
                    Córners proyectados
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#21262d] overflow-hidden">
                  <div
                    className="h-full bg-[#00ff66] rounded-full"
                    style={{ width: `${cornerGaugePct}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono font-bold text-[#8b949e] truncate">
                  {cornersMarket.recommendedLine.replace('Tiros de Esquina en el partido', 'Córners').replace('en el partido', '')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#30363d] text-center font-mono text-[9.5px]">
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">+2.5 Goles</span>
                <strong className="text-white tabular-nums">{goalsMarket.over25}%</strong>
              </div>
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">Ambos Anotan</span>
                <strong className="text-white tabular-nums">{goalsMarket.bttsYes}%</strong>
              </div>
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">Local / Vis.</span>
                <strong className="text-white tabular-nums">{cornersMarket.lambdaHomeCorners}/{cornersMarket.lambdaAwayCorners}</strong>
              </div>
            </div>
          </div>

          {/* CUADRANTE 4 (Abajo Derecha): Rigor Arbitral & Termómetro Disciplinario */}
          <div className="rounded-2xl p-3.5 bg-[#161b22] border border-[#30363d] flex flex-col justify-between gap-2.5 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-sans font-extrabold text-white tracking-tight truncate">
                Rigor Arbitral &amp; Tarjetas
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/30 shrink-0">
                Rigor {fixture.referee.rigor}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2.5 items-center">
              {/* Indicador Claro de Amarillas */}
              <div className="col-span-5 flex flex-col items-center justify-center p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-3.5 h-4.5 rounded-[3px] bg-[#d9b114] shadow-xs" title="Tarjeta Amarilla" />
                  <span className="text-xl font-mono tabular-nums font-black text-white leading-none">
                    {refereeCards.expectedYellowCards.toFixed(1)}
                  </span>
                </div>
                <span className="text-[9px] font-sans font-semibold text-[#8b949e] text-center">
                  Amarillas esperadas
                </span>
                <div className="w-full bg-[#21262d] h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-[#d9b114] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (refereeCards.expectedYellowCards / 6.5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Resumen del Juez y Línea Recomendada */}
              <div className="col-span-7 space-y-1.5 text-left">
                <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
                  <div className="text-[9px] font-mono text-[#8b949e] uppercase truncate">
                    Juez: {fixture.referee.name}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-white truncate mt-0.5">
                    {refereeCards.recommendedCardPick}
                  </div>
                  <div className="text-[9.5px] font-mono tabular-nums font-bold text-[#00ff66]">
                    {refereeCards.recommendedCardProb}% certeza · @{refereeCards.recommendedCardOdd.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#30363d] text-center font-mono text-[9.5px]">
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">Amar. Local</span>
                <strong className="text-white tabular-nums">~{refereeCards.expectedHomeYellows.toFixed(1)}</strong>
              </div>
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">Amar. Visita</span>
                <strong className="text-white tabular-nums">~{refereeCards.expectedAwayYellows.toFixed(1)}</strong>
              </div>
              <div className="py-1 px-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d]">
                <span className="text-[#8b949e] block">Riesgo Roja</span>
                <strong className="text-rose-400 tabular-nums">{refereeCards.redCardRiskPercent}%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Listado Completo de 6 Cápsulas de Mercado Accionables (+ Boleto) */}
        <LiveMarketCapsules
          fixture={fixture}
          analysis={analysis}
        />
      </div>
    );

    return (
      <ProGate isPro={isPro} featureName={tab === 'PICKS' ? 'Picks Algorítmicos' : 'Mercados en Vivo'}>
        {soccerPicksView}
      </ProGate>
    );
  }

  if (tab === 'GOALS_CORNERS' || tab === 'REFEREE') {
    return (
      <div className="space-y-3">
        {/* Mercado de Goles */}
        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] text-center shadow-md">
          <div className="text-[10px] font-mono font-bold text-[#8b949e] mb-2.5 uppercase tracking-wider">
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
        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] text-center shadow-md">
          <div className="text-[10px] font-mono font-bold text-[#8b949e] mb-2.5 uppercase tracking-wider flex items-center justify-between px-1">
            <span>Mercado de Córners</span>
            <span className="bg-[#0b0e14] text-[#00ff66] border border-[#00ff66]/30 font-mono text-[10px] px-2 py-0.5 rounded-full">
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

        {/* Rigor Arbitral & Tarjetas Combinado */}
        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] text-center shadow-md">
          <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
            <div className="text-left">
              <div className="text-[9px] font-mono font-semibold text-[#8b949e] uppercase tracking-wider">
                Árbitro Principal
              </div>
              <div className="text-sm font-sans font-semibold text-white">{fixture.referee.name}</div>
            </div>
            <span className="bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/30 font-mono text-[10px] px-2.5 py-0.5 rounded-full">
              Rigor: {fixture.referee.rigor}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MetricBox label="Amarillas" value={`${refereeCards.expectedYellowCards.toFixed(1)}`} sub="esperadas" />
            <MetricBox label="Rojas" value={`${refereeCards.expectedRedCards.toFixed(2)}`} sub="esperadas" />
            <MetricBox label="Faltas / Tarj." value={`${fixture.referee.foulsPerCard}`} sub="fricción" />
          </div>

          <div className="mt-2.5 p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-between text-xs font-mono px-3">
            <span className="text-white truncate">{refereeCards.recommendedCardPick}</span>
            <span className="text-[#00ff66] font-bold shrink-0 ml-2">{refereeCards.recommendedCardProb}% Probabilidad</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ==========================================
// CONTENIDO MODULAR: NBA (3 PESTAÑAS)
// ==========================================

const NBATabContent: React.FC<{
  tab: TabNBA;
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
  isPro?: boolean;
}> = ({ tab, fixture, analysis, isPro }) => {
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
      <ProGate isPro={isPro} featureName="Picks NBA +EV">
        <div className="space-y-3.5 text-left">
        {/* 1. Tarjeta Principal de Recomendación Pre-Partido */}
        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] text-center shadow-md">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
            <span className="bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/30 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 font-mono">
              <Flame className="w-3 h-3 text-[#d9b114]" />
              {didacticAdvice.badgeLabel}
            </span>
            <span className="bg-[#0b0e14] text-[#00ff66] border border-[#00ff66]/30 font-mono text-[10px] px-2.5 py-0.5 rounded-full">
              Puntos Proyectados: {analysis.projectedTotalPoints} pts
            </span>
          </div>

          <div className="text-base sm:text-lg font-sans font-bold text-white mb-1">
            {didacticAdvice.headline}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#8b949e]">
            <div>
              Hándicap Justo:{' '}
              <strong className="text-[#d9b114] tabular-nums">
                {analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread}
              </strong>
            </div>
            <div>
              Meta Totales: <strong className="text-white tabular-nums">+{analysis.fairTotalLine} pts</strong>
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
                  ? 'bg-[#0b0e14] text-white border border-[#30363d] shadow-xs'
                  : 'bg-[#0b0e14] hover:bg-[#1c2129] text-[#d9b114] border border-[#d9b114]/50 shadow-2xs'
              }`}
            >
              <Ticket className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>{inParlay ? 'En el Boleto ✓' : '+ Añadir al Boleto Combinada'}</span>
            </button>
          </div>
        </div>

        {/* 1.5 Matriz Bento 2 Columnas NBA (PC 2 Cols / Móvil 1 Col) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-3 flex flex-col justify-between gap-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                🏀 Probabilidad Moneyline
              </span>
              <span className="bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/30 font-mono text-[9px] px-2 py-0.5 rounded-full">
                Pace: {analysis.expectedPace} pos
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-center">
                <div className="text-[9px] font-mono text-[#8b949e] uppercase truncate">{formatCompactTeamName(fixture.homeTeam.name)}</div>
                <div className="text-sm font-mono tabular-nums font-bold text-white">{analysis.pHomeWin}%</div>
                <div className="text-[9px] font-mono tabular-nums text-[#8b949e]">{analysis.projectedHomeScore} pts proy.</div>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-center">
                <div className="text-[9px] font-mono text-[#8b949e] uppercase truncate">{formatCompactTeamName(fixture.awayTeam.name)}</div>
                <div className="text-sm font-mono tabular-nums font-bold text-white">{analysis.pAwayWin}%</div>
                <div className="text-[9px] font-mono tabular-nums text-[#8b949e]">{analysis.projectedAwayScore} pts proy.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-3 flex flex-col justify-between gap-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                📊 Eficiencia & Totales
              </span>
              <span className="bg-[#0b0e14] text-[#00ff66] border border-[#00ff66]/30 font-mono text-[9px] px-2 py-0.5 rounded-full">
                Total: {analysis.projectedTotalPoints} pts
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-center">
                <div className="text-[9px] font-mono text-[#8b949e] uppercase">Over {analysis.fairTotalLine}</div>
                <div className="text-sm font-mono tabular-nums font-bold text-[#00ff66]">{analysis.overTotalProb}%</div>
                <div className="text-[9px] font-mono text-[#8b949e]">Probabilidad Over</div>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-center">
                <div className="text-[9px] font-mono text-[#8b949e] uppercase">Under {analysis.fairTotalLine}</div>
                <div className="text-sm font-mono tabular-nums font-bold text-white">{analysis.underTotalProb}%</div>
                <div className="text-[9px] font-mono text-[#8b949e]">Probabilidad Under</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Auditoría de los 6 Mercados Generales del Partido */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-tight">
                🏀 6 Mercados Generales del Partido
              </span>
              {isLive && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono text-[9.5px] font-bold animate-pulse">
                  EN VIVO
                </span>
              )}
              {isFinished && (
                <span className="px-2 py-0.5 rounded-full bg-[#0b0e14] border border-[#30363d] text-[#8b949e] font-mono text-[9.5px] font-bold">
                  RESULTADO FINAL
                </span>
              )}
            </div>

            {hasStarted && (
              <div className="flex items-center gap-2 text-[10.5px] font-mono font-bold bg-[#0b0e14] border border-[#30363d] text-white px-2.5 py-1 rounded-lg">
                <span className="text-[#00ff66]">✅ {teamHits} {isFinished ? 'Acertadas' : 'En Ritmo'}</span>
                {teamMisses > 0 && (
                  <>
                    <span className="text-[#30363d]">·</span>
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
                        ? 'bg-[#161b22] border-[#00ff66]/50 ring-1 ring-[#00ff66]/20'
                        : 'bg-[#161b22] border-rose-500/40'
                      : mktInParlay
                      ? 'bg-[#161b22] border-[#d9b114] ring-1 ring-[#d9b114]/30'
                      : 'bg-[#161b22] border-[#30363d] hover:border-[#8b949e]/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#8b949e] bg-[#0b0e14] px-2 py-0.5 rounded-md border border-[#30363d]">
                        {mkt.category}
                      </span>
                      {hasStarted ? (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            mkt.isHit
                              ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {mkt.statusText}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-[#00ff66] bg-[#0b0e14] px-2 py-0.5 rounded-full border border-[#00ff66]/30">
                          {mkt.prob}% Prob.
                        </span>
                      )}
                    </div>

                    <div className="text-xs sm:text-sm font-sans font-bold text-white leading-snug pt-0.5">
                      {mkt.label}
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8b949e] pt-0.5">
                      <span>{mkt.subLabel}</span>
                      {mkt.currentValueLabel && (
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded ${
                            mkt.isHit ? 'bg-[#00ff66]/15 text-[#00ff66]' : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {mkt.currentValueLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
                    <span className="text-[10.5px] font-mono text-[#8b949e]">
                      Prob: <strong className="text-white tabular-nums">{mkt.prob}%</strong> · Cuota{' '}
                      <strong className="text-[#d9b114] tabular-nums">@{mkt.odd.toFixed(2)}</strong>
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
                          ? 'bg-[#0b0e14] text-[#d9b114] border-[#d9b114]/50'
                          : 'bg-[#0b0e14] hover:bg-[#1c2129] text-white border-[#30363d]'
                      }`}
                    >
                      <Ticket className="w-3 h-3 text-[#d9b114]" />
                      <span>{mktInParlay ? '✓ En Boleto' : '+ Boleto'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Mercados Individuales por Jugador (Sin auditoría individual roja/verde, limpio para el Boleto) */}
        <div className="space-y-2 pt-2 border-t border-[#30363d]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#d9b114]" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-tight">
                Proyecciones Individuales por Jugador (Player Props)
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8b949e]">
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
                  className="p-3 rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-sans font-bold text-white truncate flex items-center gap-1.5">
                        <span>{player.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#0b0e14] text-[#d9b114] border border-[#d9b114]/30 font-mono text-[9.5px]">
                          {player.position}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8b949e] truncate">
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
                      className="px-2 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#1c2129] text-[#d9b114] border border-[#d9b114]/40 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <BarChart2 className="w-3 h-3 text-[#d9b114]" />
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
                              ? 'bg-[#0b0e14] text-white border-[#d9b114] ring-1 ring-[#d9b114]/50'
                              : 'bg-[#0b0e14] hover:bg-[#1c2129] border-[#30363d] text-white'
                          }`}
                          title={`${ip.fullLabel} (@${ip.odd.toFixed(2)}) — Clic para añadir al boleto`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[10.5px] font-bold truncate">{ip.shortLabel}</span>
                            <Ticket className={`w-2.5 h-2.5 shrink-0 ${propInParlay ? 'text-[#d9b114]' : 'text-[#8b949e]'}`} />
                          </div>
                          <div className="text-[9px] flex items-center justify-between opacity-90 mt-0.5">
                            <span className={propInParlay ? 'text-[#d9b114] font-semibold' : 'text-[#00ff66] font-semibold'}>
                              {ip.prob}% prob.
                            </span>
                            <span className="text-white tabular-nums">@{ip.odd.toFixed(2)}</span>
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
            className={`p-3 rounded-2xl border shadow-md ${
              hasStarted && threeMkt
                ? threeMkt.isHit
                  ? 'bg-[#161b22] border-[#00ff66]/50 ring-1 ring-[#00ff66]/20'
                  : 'bg-[#161b22] border-rose-500/40'
                : 'bg-[#161b22] border-[#30363d]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <span className="text-[10px] font-mono font-semibold text-[#8b949e] uppercase tracking-wider">
                Mercado de Triples (Meta: +{ Math.max(16.5, analysis.threePointersMarket.threePointLine - 2) } Triples)
              </span>
              {hasStarted && threeMkt && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    threeMkt.isHit
                      ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
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
          <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-md space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-[10.5px] font-mono font-bold text-white uppercase tracking-wider">
                Desglose y Auditoría por Cuartos (1Q - 4Q y 1ra Mitad)
              </span>
              <span className="text-[10px] font-sans text-[#8b949e]">
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
                          ? 'bg-[#0b0e14] border-[#00ff66]/50 ring-1 ring-[#00ff66]/20'
                          : 'bg-[#0b0e14] border-rose-500/40'
                        : isQInPlay
                        ? qOverHit
                          ? 'bg-[#0b0e14] border-[#00ff66]/50'
                          : 'bg-[#0b0e14] border-[#d9b114]/50 ring-1 ring-[#d9b114]/30'
                        : 'bg-[#0b0e14] border-[#30363d]'
                    }`}
                  >
                    {/* 1. ARRIBA: Pronóstico de la Página + Estado del Cuarto */}
                    <div className="space-y-1 border-b border-[#30363d] pb-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono font-extrabold text-white">
                          {qp.quarter === '1H' ? '1ra Mitad' : `Cuarto ${qp.quarter}`}
                        </span>
                        {isQFinal ? (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                              qOverHit
                                ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {qOverHit ? '✅ Acertado' : '❌ No se dio'}
                          </span>
                        ) : isQInPlay ? (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                              qOverHit
                                ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/30'
                                : 'bg-[#0b0e14] text-[#d9b114] border-[#d9b114]/40 animate-pulse'
                            }`}
                          >
                            {qOverHit ? '✅ Ya Acertado' : '⏳ En juego'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                            🕒 Por jugar
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-[#d9b114] bg-[#161b22] border border-[#30363d] rounded-md px-1.5 py-0.5 font-semibold">
                        Pronóstico: +{qp.overLine} pts
                      </div>
                    </div>

                    {/* 2. CENTRO: Resultado Real (o En Vivo / Esperado) */}
                    <div className="text-center py-0.5">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#8b949e] block">
                        {isQFinal
                          ? 'Resultado Real'
                          : isQInPlay
                          ? 'Marcador en Vivo'
                          : 'Puntos Esperados'}
                      </span>
                      <div className="text-base font-mono tabular-nums font-black text-white leading-tight mt-0.5">
                        {hasQActual ? `${actualTotal} pts` : `~${qp.projectedTotal} pts`}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-[#8b949e]">
                        {hasQActual
                          ? `${fixture.homeTeam.shortName} ${qp.actualHome} - ${qp.actualAway} ${fixture.awayTeam.shortName}`
                          : `Proy: ${qp.projectedHome} - ${qp.projectedAway}`}
                      </div>
                    </div>

                    {/* 3. ABAJO: Explicación clara de la meta (sin jerga confusa de "Línea") */}
                    <div className="pt-1.5 border-t border-[#30363d] text-[9.5px] font-sans leading-snug text-[#8b949e] text-center">
                      {isQFinal ? (
                        qOverHit ? (
                          <span className="text-[#00ff66] font-semibold">
                            Meta era {minPointsNeeded}+ pts (Superada por +{actualTotal - minPointsNeeded + 1} pts)
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">
                            Meta era {minPointsNeeded}+ pts (Faltaron {Math.max(1, minPointsNeeded - actualTotal)} pts)
                          </span>
                        )
                      ) : isQInPlay ? (
                        <span className="text-[#d9b114] font-medium">
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
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg space-y-2.5 text-left">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">⚔️</span>
            <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
              Historial Directo (H2H · Últimos {h2hData.totalMatches} Duelos)
            </span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#0b0e14] text-[#8b949e] font-semibold border border-[#30363d]">
            Línea Ref: ~{h2hData.referenceLine} pts
          </span>
        </div>

        {/* Marcador de Serie / Balance de Victorias */}
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d]">
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
                <div className="font-bold text-[11px] sm:text-xs text-white truncate">
                  {fixture.homeTeam.shortName}
                </div>
                <div className="text-[9px] font-mono font-bold text-[#00ff66]">
                  {h2hData.homeWins}V ({h2hData.homeWinPct}%)
                </div>
              </div>
            </div>

            {/* Marcador Central */}
            <div className="shrink-0 text-center px-2.5 py-0.5 rounded-lg bg-[#161b22] border border-[#30363d] shadow-md">
              <span className="text-xs sm:text-sm font-mono font-black text-white tracking-tight">
                {h2hData.homeWins} - {h2hData.awayWins}
              </span>
              <span className="block text-[7.5px] font-mono uppercase text-[#8b949e] font-bold tracking-tight">
                SERIE
              </span>
            </div>

            {/* Equipo Visita */}
            <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
              <div className="min-w-0">
                <div className="font-bold text-[11px] sm:text-xs text-white truncate">
                  {fixture.awayTeam.shortName}
                </div>
                <div className="text-[9px] font-mono font-bold text-sky-400">
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
          <div className="w-full bg-[#21262d] h-1.5 rounded-full overflow-hidden mt-2.5 flex">
            <div
              className="bg-[#00ff66] h-full transition-all"
              style={{ width: `${h2hData.homeWinPct}%` }}
              title={`${fixture.homeTeam.shortName}: ${h2hData.homeWinPct}%`}
            />
            <div
              className="bg-sky-400 h-full transition-all"
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
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg space-y-2 text-left">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
            Detalle de los Últimos Partidos Cara a Cara
          </span>
          <span className="text-[9px] font-sans text-[#8b949e]">
            Resaltado en negrita el ganador
          </span>
        </div>

        <div className="space-y-1.5">
          {h2hData.recentMatches.map((m) => {
            const homeWon = m.homeScore > m.awayScore;

            return (
              <div
                key={m.id}
                className="p-2 sm:p-2.5 rounded-xl bg-[#0b0e14] hover:bg-[#21262d]/50 border border-[#30363d] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2"
              >
                {/* Meta de fecha y sede */}
                <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0 sm:w-28">
                  <div className="text-left leading-tight">
                    <span className="text-[9.5px] font-mono font-bold text-white block">
                      {m.date}
                    </span>
                    <span className="text-[8px] font-sans text-[#8b949e] block truncate max-w-[105px]" title={m.venueName}>
                      {m.venueName}
                    </span>
                  </div>
                </div>

                {/* Duelo de Marcador Central con Logos (Sin cortes, proporciones fluidas) */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-1 min-w-0 py-0.5">
                  {/* Local en ese partido */}
                  <div className={`flex items-center gap-1 text-right justify-end flex-1 min-w-0 ${homeWon ? 'font-bold text-white' : 'text-[#8b949e] font-normal'}`}>
                    <span className="text-[10.5px] sm:text-[11px] truncate leading-tight">{m.homeShortName}</span>
                    <img
                      src={m.homeLogo}
                      alt=""
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="font-mono text-xs font-bold shrink-0">{m.homeScore}</span>
                  </div>

                  <span className="text-[#30363d] font-mono text-[9px] font-bold shrink-0">-</span>

                  {/* Visitante en ese partido */}
                  <div className={`flex items-center gap-1 text-left justify-start flex-1 min-w-0 ${!homeWon ? 'font-bold text-white' : 'text-[#8b949e] font-normal'}`}>
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
                <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-1 sm:pt-0 border-[#30363d]">
                  <span className="text-[8.5px] font-mono text-[#8b949e] shrink-0">
                    {m.totalPoints} pts
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border shrink-0 ${
                      m.overUnderResult === 'OVER'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    }`}
                  >
                    {m.overUnderResult === 'OVER' ? '🔥 Alta' : '❄️ Baja'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#161b22] text-white border border-[#30363d] shrink-0">
                    +{m.margin} {m.winnerShortName.slice(0, 3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RITMO DE POSESIONES (PACE) Y EFICIENCIA OFENSIVA/DEFENSIVA */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg space-y-2.5 text-left">
        <div className="flex items-center justify-between gap-2 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#d9b114]" />
            <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
              Ritmo de Posesiones (Pace) y Eficiencia
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#d9b114]/15 text-[#d9b114] border border-[#d9b114]/30">
            Ritmo Conjunto: {combinedPace} pos.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Local */}
          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white truncate">
                {fixture.homeTeam.name}
              </span>
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#161b22] border border-[#30363d] text-white">
                Racha: {fixture.homeTeam.streak}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Pace</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.homeTeam.pace}</span>
              </div>
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Off Rtg</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.homeTeam.offensiveRating}</span>
              </div>
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Def Rtg</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.homeTeam.defensiveRating}</span>
              </div>
            </div>
          </div>

          {/* Visita */}
          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white truncate">
                {fixture.awayTeam.name}
              </span>
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#161b22] border border-[#30363d] text-white">
                Racha: {fixture.awayTeam.streak}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Pace</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.awayTeam.pace}</span>
              </div>
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Off Rtg</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.awayTeam.offensiveRating}</span>
              </div>
              <div className="p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
                <span className="text-[7.5px] font-mono text-[#8b949e] uppercase block">Def Rtg</span>
                <span className="text-[11px] font-mono font-bold text-white">{fixture.awayTeam.defensiveRating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnóstico de Ritmo */}
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#d9b114]/40 text-[10.5px] font-sans text-white/90 flex items-start gap-1.5 text-left">
          <Sparkles className="w-3.5 h-3.5 text-[#d9b114] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#d9b114]">Lectura Analítica:</strong>{' '}
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
        ? 'bg-[#0b0e14] border-[#00ff66]/40 ring-1 ring-[#00ff66]/20'
        : 'bg-[#0b0e14] border-[#30363d]'
    }`}
  >
    <div className="text-[9px] font-mono text-[#8b949e] uppercase leading-tight line-clamp-1 max-w-full" title={label}>
      {label}
    </div>
    <div className={`text-xs sm:text-sm font-mono tabular-nums font-bold mt-0.5 ${highlight ? 'text-[#00ff66]' : 'text-white'}`}>
      {value}
    </div>
    {sub && <div className="text-[8px] font-mono text-[#8b949e] truncate max-w-full mt-0.5">{sub}</div>}
  </div>
);

