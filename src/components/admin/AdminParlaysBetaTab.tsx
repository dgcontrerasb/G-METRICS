import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  Copy,
  Ticket,
  Target,
  TrendingUp,
  BarChart3,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCircle2,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { MatchFixture, NBAMatchFixture, ParlayPick, GMetricsSingleBetSuggestion, SmartParlaySlip, BettingMarketSuggestion } from '../../types';
import {
  generateGMetricsSingleValueBets,
  generateSmartParlays
} from '../../services/mathEngine';
import { getLocalUpcomingCache, getColombiaDateString } from '../../services/apiService';
import { useParlay } from '../../context/ParlayContext';
import { SocialCardExportService, ExportMediaFormat } from '../../services/socialCardExportService';
import {
  getIsoWeekKey,
  getSpanishWeekLabel,
  computeParlayEfficiencyStats,
  computeSinglesEfficiencyStats,
  buildParlaysCsvContent,
  buildSinglesCsvContent
} from '../../services/parlaySinglesLedger';

export interface AdminParlaysBetaTabProps {
  fixtures: MatchFixture[];
  nbaFixtures?: NBAMatchFixture[];
  onCloseAdmin: () => void;
}

const LOCAL_SMART_SLIPS_KEY = 'gmetrics_smart_parlays_slips_v5';

function getStoredSmartSlips(): SmartParlaySlip[] {
  try {
    // Limpia la caché local de versiones antiguas de almacenamiento
    localStorage.removeItem('gmetrics_smart_parlays_slips_v3');
    localStorage.removeItem('gmetrics_smart_parlays_slips_v4');
    const raw = localStorage.getItem(LOCAL_SMART_SLIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s: SmartParlaySlip) => s && s.id && !s.id.includes('seed')
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveStoredSmartSlips(slips: SmartParlaySlip[]): void {
  try {
    const clean = slips.filter((s) => s && !s.id.includes('seed'));
    localStorage.setItem(LOCAL_SMART_SLIPS_KEY, JSON.stringify(clean));
  } catch {
    // ignore
  }
}

export const AdminParlaysBetaTab: React.FC<AdminParlaysBetaTabProps> = ({
  fixtures,
  nbaFixtures = [],
  onCloseAdmin
}) => {
  const { addPick, setIsOpen } = useParlay();
  const [copiedSlipId, setCopiedSlipId] = useState<string | null>(null);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'SMART_PARLAYS' | 'WEEKLY_AUDIT' | 'SINGLES'>('SMART_PARLAYS');
  const [profileFilter, setProfileFilter] = useState<'ALL' | 'BALANCED' | 'HIGH_ODDS' | 'CONSERVATIVE'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL_30D');
  const [auditGranularity, setAuditGranularity] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [singlesViewMode, setSinglesViewMode] = useState<'TODAY' | 'HISTORY'>('TODAY');
  const [singleTypeFilter, setSingleTypeFilter] = useState<'ALL' | 'HIGH_VALUE' | 'BANKER'>('ALL');
  const [singleSportFilter, setSingleSportFilter] = useState<'ALL' | 'SOCCER' | 'NBA'>('ALL');
  const [singleTopLimit, setSingleTopLimit] = useState<5 | 10>(5);

  const [smartSlips, setSmartSlips] = useState<SmartParlaySlip[]>(() => getStoredSmartSlips());
  const [singlesHistory, setSinglesHistory] = useState<GMetricsSingleBetSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingToday, setIsGeneratingToday] = useState<boolean>(false);
  const [isSealingSingles, setIsSealingSingles] = useState<boolean>(false);
  const [confirmPurge, setConfirmPurge] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingMedia, setIsExportingMedia] = useState<boolean>(false);

  const handleExportParlay = async (slip: SmartParlaySlip, format: ExportMediaFormat) => {
    setIsExportingMedia(true);
    try {
      await SocialCardExportService.exportParlay(slip, format);
    } catch (err) {
      console.error('Error al exportar parlay para redes:', err);
    } finally {
      setIsExportingMedia(false);
    }
  };

  const handleExportSingles = async (format: ExportMediaFormat) => {
    setIsExportingMedia(true);
    try {
      const todayStr = getColombiaDateString(0);
      await SocialCardExportService.exportSinglesSheet(filteredSingles, format, todayStr);
    } catch (err) {
      console.error('Error al exportar apuestas individuales para redes:', err);
    } finally {
      setIsExportingMedia(false);
    }
  };

  const getAdminAuthHeaders = useCallback((withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    const pin =
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      '';
    if (pin.trim()) headers['x-admin-pin'] = pin.trim();
    const jwt = sessionStorage.getItem('sportstats_session_jwt');
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    return headers;
  }, []);

  const effectiveFixtures = useMemo(() => {
    if (fixtures && fixtures.length > 0) return fixtures;
    const cached = getLocalUpcomingCache(getColombiaDateString(0));
    return cached?.fixtures || [];
  }, [fixtures]);

  const effectiveNBAFixtures = useMemo(() => {
    if (nbaFixtures && nbaFixtures.length > 0) return nbaFixtures;
    try {
      const cached = localStorage.getItem(`basketstats_nba_v7_${getColombiaDateString(0)}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.fixtures) && parsed.fixtures.length > 0) {
          return parsed.fixtures;
        }
      }
    } catch {
      // non-fatal
    }
    return [];
  }, [nbaFixtures]);

  const isAthleteScratched = useCallback(
    (leg: BettingMarketSuggestion): boolean => {
      const isBball = leg.sport === 'NBA' || (leg.leagueName || '').toLowerCase().includes('nba');
      if (!isBball) return false;
      const fix = effectiveNBAFixtures.find((f: NBAMatchFixture) => String(f.id) === String(leg.fixtureId));
      if (!fix || !Array.isArray(fix.officialInjuries)) return false;
      const legLabelLower = leg.label.toLowerCase();
      return fix.officialInjuries.some((inj: { status?: string; athleteName?: string }) => {
        if (inj.status !== 'Out') return false;
        const athleteNameLower = (inj.athleteName || '').toLowerCase();
        if (!athleteNameLower) return false;
        const parts = athleteNameLower.split(' ').filter((p: string) => p.length >= 3);
        return legLabelLower.includes(athleteNameLower) || parts.some((p: string) => legLabelLower.includes(p));
      });
    },
    [effectiveNBAFixtures]
  );

  const handleGenerateTodayParlays = async () => {
    setIsGeneratingToday(true);
    setErrorMsg(null);
    setSuccessNotice(null);
    try {
      const effective = fixtures && fixtures.length > 0 ? fixtures : getLocalUpcomingCache(getColombiaDateString(0))?.fixtures || [];
      const effectiveNBA = effectiveNBAFixtures;
      if (effective.length + effectiveNBA.length < 2) {
        setErrorMsg('Se requieren al menos 2 partidos activos con datos analíticos para generar parlays.');
        return;
      }

      // Compactar la carga útil manteniendo intacta la telemetría analítica (árbitro, tiros, estrellas)
      const compactFixtures = effective.map((f) => ({
        id: f.id,
        espnEventId: f.espnEventId,
        date: f.date,
        time: f.time,
        status: f.status,
        homeTeam: {
          id: f.homeTeam?.id,
          name: f.homeTeam?.name,
          shortName: f.homeTeam?.shortName,
          form: f.homeTeam?.form,
          avgShotsPerMatch: f.homeTeam?.avgShotsPerMatch,
          avgShotsOnTarget: f.homeTeam?.avgShotsOnTarget,
          restHours: f.homeTeam?.restHours,
          attackStrength: f.homeTeam?.attackStrength,
          defenseStrength: f.homeTeam?.defenseStrength,
          starPlayer: f.homeTeam?.starPlayer
        },
        awayTeam: {
          id: f.awayTeam?.id,
          name: f.awayTeam?.name,
          shortName: f.awayTeam?.shortName,
          form: f.awayTeam?.form,
          avgShotsPerMatch: f.awayTeam?.avgShotsPerMatch,
          avgShotsOnTarget: f.awayTeam?.avgShotsOnTarget,
          restHours: f.awayTeam?.restHours,
          attackStrength: f.awayTeam?.attackStrength,
          defenseStrength: f.awayTeam?.defenseStrength,
          starPlayer: f.awayTeam?.starPlayer
        },
        league: {
          id: f.league?.id,
          name: f.league?.name,
          country: f.league?.country,
          avgGoalsPerMatch: f.league?.avgGoalsPerMatch,
          avgCardsPerMatch: f.league?.avgCardsPerMatch
        },
        referee: f.referee,
        travel: f.travel,
        venue: f.venue,
        liveStats: f.liveStats
      }));

      const compactNBA = effectiveNBA.map((f: NBAMatchFixture) => ({
        id: f.id,
        espnEventId: f.espnEventId,
        date: f.date,
        time: f.time,
        status: f.status,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        league: f.league,
        officialInjuries: f.officialInjuries || [],
        externalOdds: f.externalOdds
      }));

      const res = await fetch('/api/parlays/generate-day', {
        method: 'POST',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ fixtures: compactFixtures, nbaFixtures: compactNBA, force: true })
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        data = { success: false, error: `Respuesta del servidor (${res.status}): ${resText.slice(0, 100)}` };
      }

      if (res.ok && data.success) {
        if (Array.isArray(data.slips) && data.slips.length > 0) {
          const clean = data.slips.filter(
            (s: SmartParlaySlip) => s && s.id && !s.id.includes('seed')
          );
          setSmartSlips(clean);
          saveStoredSmartSlips(clean);
        }
        setSuccessNotice(data.message || 'Parlays reales generados y certificados para hoy.');
        setTimeout(() => setSuccessNotice(null), 4500);
      } else {
        // Fallback local garantizado si el backend no pudo persistir
        try {
          const todayStr = getColombiaDateString(0);
          const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBA, 1);
          if (localGenerated.length > 0) {
            const updated = [...localGenerated, ...smartSlips.filter((s) => s.date !== todayStr)];
            setSmartSlips(updated);
            saveStoredSmartSlips(updated);
            setSuccessNotice(`⚡ Generados ${localGenerated.length} parlays reales en motor local.`);
            setTimeout(() => setSuccessNotice(null), 4500);
          } else {
            setErrorMsg(data.error || 'No se pudieron generar los parlays para los partidos de hoy.');
          }
        } catch {
          setErrorMsg(data.error || 'No se pudieron generar los parlays para los partidos de hoy.');
        }
      }
    } catch (err: unknown) {
      // Fallback local en caso de error de red
      try {
        const todayStr = getColombiaDateString(0);
        const effective = fixtures && fixtures.length > 0 ? fixtures : getLocalUpcomingCache(todayStr)?.fixtures || [];
        const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBAFixtures, 1);
        if (localGenerated.length > 0) {
          const updated = [...localGenerated, ...smartSlips.filter((s) => s.date !== todayStr)];
          setSmartSlips(updated);
          saveStoredSmartSlips(updated);
          setSuccessNotice(`⚡ Generados ${localGenerated.length} parlays reales en motor local.`);
          setTimeout(() => setSuccessNotice(null), 4500);
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Error al generar parlays del día.');
        }
      } catch {
        setErrorMsg(err instanceof Error ? err.message : 'Error al generar parlays del día.');
      }
    } finally {
      setIsGeneratingToday(false);
    }
  };

  const fetchSmartParlaysAndMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    const qs = forceRefresh ? '?refresh=true' : '';
    try {
      const [res, singlesRes] = await Promise.all([
        fetch(`/api/parlays/metrics${qs}`, { headers: getAdminAuthHeaders(false) }),
        fetch(`/api/admin/singles/metrics${qs}`, { headers: getAdminAuthHeaders(false) }).catch(() => null)
      ]);

      if (singlesRes && singlesRes.ok) {
        try {
          const sTxt = await singlesRes.text();
          const sData = sTxt ? JSON.parse(sTxt) : {};
          if (sData.success && Array.isArray(sData.singles)) {
            setSinglesHistory(sData.singles);
          }
        } catch {
          // non-fatal
        }
      }

      if (res.ok) {
        const txt = await res.text();
        const data = txt ? JSON.parse(txt) : {};
        if (data.success) {
          if (Array.isArray(data.slips)) {
            const cleanSlips = data.slips.filter(
              (s: SmartParlaySlip) => s && s.id && !s.id.includes('seed')
            );
            const localStored = getStoredSmartSlips();
            const mergedSlips = cleanSlips.length > 0 ? cleanSlips : localStored;
            setSmartSlips(mergedSlips);
            if (mergedSlips.length > 0) {
              saveStoredSmartSlips(mergedSlips);
            }

            // Auto-generación con datos reales si no existen boletos para hoy y hay partidos disponibles
            const todayStr = getColombiaDateString(0);
            const hasToday = mergedSlips.some((s: SmartParlaySlip) => s.date === todayStr);
            const effective = fixtures && fixtures.length > 0 ? fixtures : getLocalUpcomingCache(todayStr)?.fixtures || [];
            const effectiveNBA = effectiveNBAFixtures;
            if (!hasToday && (effective.length + effectiveNBA.length >= 2)) {
              const compact = effective.map((f) => ({
                id: f.id,
                espnEventId: f.espnEventId,
                date: f.date,
                time: f.time,
                status: f.status,
                homeTeam: {
                  id: f.homeTeam?.id,
                  name: f.homeTeam?.name,
                  shortName: f.homeTeam?.shortName,
                  form: f.homeTeam?.form,
                  avgShotsPerMatch: f.homeTeam?.avgShotsPerMatch,
                  avgShotsOnTarget: f.homeTeam?.avgShotsOnTarget,
                  restHours: f.homeTeam?.restHours,
                  attackStrength: f.homeTeam?.attackStrength,
                  defenseStrength: f.homeTeam?.defenseStrength,
                  starPlayer: f.homeTeam?.starPlayer
                },
                awayTeam: {
                  id: f.awayTeam?.id,
                  name: f.awayTeam?.name,
                  shortName: f.awayTeam?.shortName,
                  form: f.awayTeam?.form,
                  avgShotsPerMatch: f.awayTeam?.avgShotsPerMatch,
                  avgShotsOnTarget: f.awayTeam?.avgShotsOnTarget,
                  restHours: f.awayTeam?.restHours,
                  attackStrength: f.awayTeam?.attackStrength,
                  defenseStrength: f.awayTeam?.defenseStrength,
                  starPlayer: f.awayTeam?.starPlayer
                },
                league: {
                  id: f.league?.id,
                  name: f.league?.name,
                  country: f.league?.country,
                  avgGoalsPerMatch: f.league?.avgGoalsPerMatch,
                  avgCardsPerMatch: f.league?.avgCardsPerMatch
                },
                referee: f.referee,
                travel: f.travel,
                venue: f.venue,
                liveStats: f.liveStats
              }));
              const compactNBA = effectiveNBA.map((f: NBAMatchFixture) => ({
                id: f.id,
                espnEventId: f.espnEventId,
                date: f.date,
                time: f.time,
                status: f.status,
                homeTeam: f.homeTeam,
                awayTeam: f.awayTeam,
                league: f.league,
                officialInjuries: f.officialInjuries || [],
                externalOdds: f.externalOdds
              }));
              fetch('/api/parlays/generate-day', {
                method: 'POST',
                headers: getAdminAuthHeaders(true),
                body: JSON.stringify({ fixtures: compact, nbaFixtures: compactNBA, force: false })
              })
                .then((r) => r.text())
                .then((txtData) => {
                  const genData = txtData ? JSON.parse(txtData) : {};
                  if (genData.success && Array.isArray(genData.slips) && genData.slips.length > 0) {
                    const fresh = genData.slips.filter((s: SmartParlaySlip) => s && !s.id.includes('seed'));
                    setSmartSlips(fresh);
                    saveStoredSmartSlips(fresh);
                  }
                })
                .catch(() => {
                  try {
                    const localGen = generateSmartParlays(effective, todayStr, effectiveNBA);
                    if (localGen.length > 0) {
                      const updated = [...localGen, ...mergedSlips.filter((s: SmartParlaySlip) => s.date !== todayStr)];
                      setSmartSlips(updated);
                      saveStoredSmartSlips(updated);
                    }
                  } catch {
                    // non-fatal
                  }
                });
            }
          }
        }
      } else if (res.status === 403) {
        setErrorMsg('Acceso restringido: Módulo exclusivo para Administrador.');
      } else {
        const todayStr = getColombiaDateString(0);
        const effective = fixtures && fixtures.length > 0 ? fixtures : getLocalUpcomingCache(todayStr)?.fixtures || [];
        const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBAFixtures);
        if (localGenerated.length > 0) {
          setSmartSlips(localGenerated);
          saveStoredSmartSlips(localGenerated);
        }
      }
    } catch {
      const todayStr = getColombiaDateString(0);
      const effective = fixtures && fixtures.length > 0 ? fixtures : getLocalUpcomingCache(todayStr)?.fixtures || [];
      const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBAFixtures);
      if (localGenerated.length > 0) {
        setSmartSlips(localGenerated);
        saveStoredSmartSlips(localGenerated);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fixtures, effectiveNBAFixtures, getAdminAuthHeaders]);

  useEffect(() => {
    fetchSmartParlaysAndMetrics(false);
  }, [fetchSmartParlaysAndMetrics]);

  const currentWeekKey = useMemo(() => getIsoWeekKey(getColombiaDateString(0)), []);
  const lastWeekKey = useMemo(() => getIsoWeekKey(getColombiaDateString(-7)), []);

  const matchesPeriod = useCallback(
    (dateStr: string, weekKey?: string) => {
      if (periodFilter === 'ALL_30D') return true;
      const wk = weekKey || getIsoWeekKey(dateStr);
      if (periodFilter === 'THIS_WEEK') return wk === currentWeekKey;
      if (periodFilter === 'LAST_WEEK') return wk === lastWeekKey;
      return wk === periodFilter;
    },
    [periodFilter, currentWeekKey, lastWeekKey]
  );

  // Estadísticas completas de Parlays (Semanal, Mensual, Perfil y Mercado de Pata)
  const parlaySummaryAll = useMemo(() => computeParlayEfficiencyStats(smartSlips), [smartSlips]);
  const periodSlips = useMemo(
    () => smartSlips.filter((s) => matchesPeriod(s.date, s.weekKey)),
    [smartSlips, matchesPeriod]
  );
  const parlaySummaryPeriod = useMemo(() => computeParlayEfficiencyStats(periodSlips), [periodSlips]);

  // Estadísticas completas de Apuestas Sencillas (+EV y Bankers)
  const singlesSummaryAll = useMemo(() => computeSinglesEfficiencyStats(singlesHistory), [singlesHistory]);
  const periodSinglesHistory = useMemo(
    () => singlesHistory.filter((s) => matchesPeriod(s.matchDate, s.weekKey)),
    [singlesHistory, matchesPeriod]
  );
  const singlesSummaryPeriod = useMemo(
    () => computeSinglesEfficiencyStats(periodSinglesHistory),
    [periodSinglesHistory]
  );

  const availableWeeks = useMemo(() => {
    const map = new Map<string, string>();
    parlaySummaryAll.byWeek.forEach((w) => map.set(w.key, w.label));
    singlesSummaryAll.byWeek.forEach((w) => map.set(w.key, w.label));
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [parlaySummaryAll.byWeek, singlesSummaryAll.byWeek]);

  // Filtrado de boletos por perfil y por período
  const filteredSlips = useMemo(() => {
    return periodSlips.filter((s) => profileFilter === 'ALL' || s.profile === profileFilter);
  }, [periodSlips, profileFilter]);

  const singleValueBets = useMemo<GMetricsSingleBetSuggestion[]>(() => {
    return generateGMetricsSingleValueBets(effectiveFixtures, false, singleTopLimit, effectiveNBAFixtures);
  }, [effectiveFixtures, singleTopLimit, effectiveNBAFixtures]);

  // Sellado automático pre-partido (insert-only, 1 llamada dedup en sessionStorage) + sellado manual
  const sealSinglesBatch = useCallback(
    async (items: GMetricsSingleBetSuggestion[], manual = false) => {
      if (!items || items.length === 0) return;
      const scheduledSoccer = new Set(
        effectiveFixtures.filter((f) => f.status === 'SCHEDULED').map((f) => String(f.id))
      );
      const scheduledNBA = new Set(
        effectiveNBAFixtures.filter((f: NBAMatchFixture) => f.status === 'SCHEDULED').map((f: NBAMatchFixture) => String(f.id))
      );
      const eligible = items.filter((s) =>
        s.sport === 'NBA' ? scheduledNBA.has(String(s.fixtureId)) : scheduledSoccer.has(String(s.fixtureId))
      );
      const target = eligible.length > 0 ? eligible : (manual ? items : []);
      if (target.length === 0) return;

      const todayStr = getColombiaDateString(0);
      const cacheKey = `gmetrics_sealed_singles_sig_${todayStr}`;
      const sig = target.map((t) => `${t.fixtureId}:${t.marketKey}`).sort().join('|');
      if (!manual && sessionStorage.getItem(cacheKey) === sig) return;

      if (manual) setIsSealingSingles(true);
      try {
        const res = await fetch('/api/admin/singles/seal', {
          method: 'POST',
          headers: getAdminAuthHeaders(true),
          body: JSON.stringify({ singles: target })
        });
        if (res.ok) {
          sessionStorage.setItem(cacheKey, sig);
          const sRes = await fetch('/api/admin/singles/metrics', { headers: getAdminAuthHeaders(false) });
          if (sRes.ok) {
            const sJson = await sRes.json();
            if (sJson.success && Array.isArray(sJson.singles)) {
              setSinglesHistory(sJson.singles);
            }
          }
          if (manual) {
            setSuccessNotice(`🔒 Selladas ${target.length} apuestas sencillas en el historial real.`);
            setTimeout(() => setSuccessNotice(null), 4000);
          }
        }
      } catch {
        // non-fatal
      } finally {
        if (manual) setIsSealingSingles(false);
      }
    },
    [effectiveFixtures, effectiveNBAFixtures, getAdminAuthHeaders]
  );

  useEffect(() => {
    if (singleValueBets.length > 0) {
      sealSinglesBatch(singleValueBets, false);
    }
  }, [singleValueBets, sealSinglesBatch]);

  const filteredSingles = useMemo(() => {
    const source = singlesViewMode === 'HISTORY' ? periodSinglesHistory : singleValueBets;
    return source.filter((s) => {
      const matchType = singleTypeFilter === 'ALL' || s.betType === singleTypeFilter;
      const matchSport = singleSportFilter === 'ALL' || s.sport === singleSportFilter;
      return matchType && matchSport;
    });
  }, [singlesViewMode, periodSinglesHistory, singleValueBets, singleTypeFilter, singleSportFilter]);

  // Exportación estricta a CSV (.csv con UTF-8 BOM, cero JSON, cero librerías pesadas)
  const handleExportCsv = (mode?: 'PARLAYS' | 'SINGLES') => {
    setIsExporting(true);
    try {
      const exportTarget = mode || (subTab === 'SINGLES' ? 'SINGLES' : 'PARLAYS');
      const todayStr = new Date().toISOString().split('T')[0];
      const csvContent =
        exportTarget === 'SINGLES'
          ? buildSinglesCsvContent(periodSinglesHistory, singlesSummaryPeriod.byWeek)
          : buildParlaysCsvContent(periodSlips, parlaySummaryPeriod.byWeek);
      const filename =
        exportTarget === 'SINGLES'
          ? `G_METRICS_Sencillas_EV_${todayStr}.csv`
          : `G_METRICS_Parlays_Semanales_${todayStr}.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeOldRecords = async () => {
    setIsPurging(true);
    setConfirmPurge(false);
    try {
      const res = await fetch('/api/admin/parlays-singles/purge', {
        method: 'POST',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ maxDays: 30 })
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessNotice(
          `🧹 Purga completada: ${data.purgedParlays || 0} parlays y ${data.purgedSingles || 0} sencillas (>30d) eliminados.`
        );
        setTimeout(() => setSuccessNotice(null), 4500);
        await fetchSmartParlaysAndMetrics(false);
      }
    } catch {
      setErrorMsg('No se pudo purgar el historial antiguo.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleCopySmartParlay = async (slip: SmartParlaySlip) => {
    const profileLabel =
      slip.profile === 'BALANCED'
        ? 'EQUILIBRADO (~3.00)'
        : slip.profile === 'HIGH_ODDS'
        ? 'CUOTA ALTA (~6.00)'
        : 'CONSERVADOR (~2.00)';

    let text = `🔥 *PARLAY G METRICS · ${profileLabel}*\n`;
    text += `🇨🇴 *Compatible con BetPlay / Wplay / Rushbet*\n`;
    text += `📅 Fecha: ${slip.date} | Cuota Total: @${slip.totalOdds.toFixed(2)}x\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    slip.legs.forEach((leg, i) => {
      const isBball = leg.sport === 'NBA' || (leg.leagueName || '').toLowerCase().includes('nba');
      text += `${i + 1}. ${isBball ? '🏀' : '⚽'} *${leg.matchName}* (${isBball ? 'Baloncesto' : 'Fútbol'} · ${leg.leagueName})\n`;
      text += `   ▪️ Mercado: *${leg.label}*\n`;
      text += `   ▪️ Cuota: @${leg.odds.toFixed(2)}x | Prob. Modelo: ${Math.round(leg.impliedProb * 100)}% (+EV)\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 Gestión de Banca: 1 Unidad (Flat Stake)\n`;
    text += `⚡ Análisis cuantitativo motor matemático G METRICS`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlipId(slip.id);
      setTimeout(() => setCopiedSlipId(null), 2500);
    } catch {}
  };

  const handleLoadSmartParlayIntoSlip = (slip: SmartParlaySlip) => {
    slip.legs.forEach((leg) => {
      const pick: ParlayPick = {
        id: `${leg.fixtureId}_${leg.category}_${leg.label.replace(/\s+/g, '')}`,
        fixtureId: leg.fixtureId,
        matchTitle: leg.matchName,
        homeTeamName: leg.matchName.split(' vs ')[0] || leg.matchName,
        awayTeamName: leg.matchName.split(' vs ')[1] || leg.matchName,
        matchDate: slip.date,
        matchTime: '15:00',
        marketKey: leg.category,
        selectionLabel: leg.label,
        referenceOdd: leg.odds,
        userOdd: leg.odds,
        probability: Math.round(leg.impliedProb * 100),
        isEV: true,
        sport: 'SOCCER'
      };
      addPick(pick);
    });
    onCloseAdmin();
    setTimeout(() => setIsOpen(true), 150);
  };

  const handleCopySingle = async (single: GMetricsSingleBetSuggestion) => {
    const isBball = single.sport === 'NBA' || (single.leagueName || '').toLowerCase().includes('nba');
    const typeTag = single.betType === 'HIGH_VALUE' ? '🔥 ALTA CUOTA (+EV)' : '🛡️ BANKER SEGURO';
    let text = `🎯 *APUESTA SENCILLA G METRICS · ${typeTag}*\n`;
    text += `${isBball ? '🏀' : '⚽'} *${single.matchTitle}* (${isBball ? 'Baloncesto' : 'Fútbol'} · ${single.leagueName})\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 *Selección:* ${single.selectionLabel}\n`;
    text += `📊 *Mercado:* ${single.categoryLabel}\n`;
    text += `📈 *Cuota Estimada:* @${single.estimatedBookieOdd.toFixed(2)}x | *Fair Mín.:* @${single.fairMinOdd.toFixed(2)}x+\n`;
    text += `🎯 *Probabilidad Calculada:* ${single.probability}%\n`;
    text += `⚡ *Ventaja Estadística (+EV):* +${single.valueEdgePct}%\n`;
    text += `💰 *Stake Sugerido (Kelly):* ${single.recommendedKellyStakePct}% de banca\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 *Análisis:* ${single.reasoning}\n`;
    text += `🔍 *Clave Táctica:* ${single.tacticalFactor}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSingleId(single.id);
      setTimeout(() => setCopiedSingleId(null), 2500);
    } catch {}
  };

  const isSinglesContext = subTab === 'SINGLES';
  const activeKpi = isSinglesContext ? singlesSummaryPeriod.overall : parlaySummaryPeriod.overall;
  const resolvedCount = activeKpi.won + activeKpi.lost;
  const auditParlayRows = auditGranularity === 'WEEKLY' ? parlaySummaryAll.byWeek : parlaySummaryAll.byMonth;
  const auditSinglesRows = auditGranularity === 'WEEKLY' ? singlesSummaryAll.byWeek : singlesSummaryAll.byMonth;

  return (
    <div className="space-y-3 font-sans text-white">
      {/* 1. Barra Superior Compacta con Acciones Rápidas */}
      <div className="p-3 rounded-2xl bg-[#0b0e14] border border-[#30363d] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[#d9b114] shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm">Parlays & Sencillas (+EV)</span>
              <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#d9b114] text-[#0b0e14] uppercase">
                Auditoría Real
              </span>
              <span className="text-[10px] font-mono text-[#00ff66]">
                🇨🇴 BetPlay · Wplay · Rushbet
              </span>
            </div>
            <span className="text-[10.5px] text-[#8b949e] font-mono block">
              Sellado Pre-Partido · Liquidación Multi-Liga & Retención 35 Días
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleGenerateTodayParlays}
            disabled={isGeneratingToday || (effectiveFixtures.length + effectiveNBAFixtures.length < 2)}
            className="px-3 py-1.5 rounded-xl bg-[#d9b114] hover:bg-[#c29e10] disabled:opacity-50 text-[#0b0e14] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Generar y certificar los 3 parlays cuantitativos del día con los partidos reales de hoy"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingToday ? 'animate-spin' : ''}`} />
            <span>{isGeneratingToday ? 'Generando...' : '⚡ Generar Parlays de Hoy'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={isExporting || (isSinglesContext ? periodSinglesHistory.length === 0 : periodSlips.length === 0)}
            className="px-3 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Descargar informe oficial en formato CSV plano (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExporting ? 'Exportando...' : 'Descargar CSV (.csv)'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchSmartParlaysAndMetrics(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5"
            title="Sincronizar y liquidar boletos y sencillas contra marcadores oficiales"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#d9b114] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          {confirmPurge ? (
            <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-1">
              <span className="text-[10.5px] text-rose-400 font-bold">¿Purgar &gt;30d?</span>
              <button
                type="button"
                onClick={handlePurgeOldRecords}
                disabled={isPurging}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="px-1.5 py-0.5 rounded bg-[#161b22] text-[#8b949e] hover:text-white border border-[#30363d] text-[11px] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmPurge(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-rose-500/20 text-[#8b949e] hover:text-rose-400 border border-[#30363d] text-xs font-mono transition cursor-pointer flex items-center gap-1"
              title="Purgar registros con más de 30 días para conservar espacio gratuito"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Purgar &gt;30d</span>
            </button>
          )}
        </div>
      </div>

      {successNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff66] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#00ff66] shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* 2. Filtro Semanal y de Período */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-xs text-white flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-[#d9b114]" />
          <span className="font-semibold text-white">Ventana de Análisis:</span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#d9b114] shadow-2xs"
          >
            <option value="ALL_30D">🗓️ Últimos 35 días ({smartSlips.length} parlays · {singlesHistory.length} sencillas)</option>
            <option value="THIS_WEEK">📅 Esta Semana ({getSpanishWeekLabel(currentWeekKey)})</option>
            <option value="LAST_WEEK">📅 Semana Pasada ({getSpanishWeekLabel(lastWeekKey)})</option>
            {availableWeeks
              .filter((w) => w.key !== currentWeekKey && w.key !== lastWeekKey)
              .map((w) => (
                <option key={w.key} value={w.key}>
                  📅 {w.label}
                </option>
              ))}
          </select>
        </div>

        <span className="text-[11px] font-mono text-[#8b949e]">
          {isSinglesContext
            ? `${periodSinglesHistory.length} sencillas selladas · ${activeKpi.pending} pendientes`
            : `${filteredSlips.length} boletos · ${activeKpi.pending} pendientes`}
        </span>
      </div>

      {/* 3. Tarjetas KPI Contextuales Reales (Parlays o Sencillas según pestaña) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-[#8b949e] uppercase tracking-wider">
              {isSinglesContext ? 'Acierto Sencillas (+EV)' : 'Tasa de Acierto Parlays'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-[#00ff66]">
                {isLoading ? '...' : `${activeKpi.winRate}%`}
              </span>
              <span className="text-[10px] font-mono text-[#8b949e]">
                ({activeKpi.won}W / {activeKpi.lost}L{activeKpi.voidCount > 0 ? ` / ${activeKpi.voidCount}V` : ''})
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-[#8b949e] block">
              {resolvedCount > 0
                ? `${resolvedCount} resueltos oficialmente`
                : `${activeKpi.pending} en juego o pendientes`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff66] shrink-0">
            <Target className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-[#8b949e] uppercase tracking-wider">
              Cuota Promedio Real
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-[#d9b114]">
                {isLoading ? '...' : `@${activeKpi.avgOdds.toFixed(2)}x`}
              </span>
              <span className="text-[10px] font-mono text-[#8b949e]">
                Ponderada
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-[#8b949e] block">
              {isSinglesContext
                ? `Sobre ${activeKpi.total} sencillas selladas`
                : `Acierto por pata: ${parlaySummaryPeriod.overall.legWinRate}% (${parlaySummaryPeriod.overall.legWon}/${parlaySummaryPeriod.overall.legWon + parlaySummaryPeriod.overall.legLost})`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#d9b114] shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-[#8b949e] uppercase tracking-wider">
              Rendimiento Neto Real
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${activeKpi.netYieldUnits >= 0 ? 'text-[#00ff66]' : 'text-rose-400'}`}>
                {isLoading ? '...' : `${activeKpi.netYieldUnits >= 0 ? '+' : ''}${activeKpi.netYieldUnits.toFixed(2)} u`}
              </span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${activeKpi.yieldPercent >= 0 ? 'text-[#00ff66] bg-emerald-500/15 border-emerald-500/30' : 'text-rose-400 bg-rose-500/15 border-rose-500/30'}`}>
                {activeKpi.yieldPercent >= 0 ? '+' : ''}{activeKpi.yieldPercent}% ROI
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-[#8b949e] block">
              Apuesta fija 1.0 unidad (Flat Stake)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff66] shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Desglose compacto contextual (Perfiles de Parlay o Tipos/Deporte de Sencillas) */}
      <div className="flex items-center gap-2 flex-wrap px-2.5 py-1.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-[10.5px] font-mono">
        {isSinglesContext ? (
          <>
            {singlesSummaryPeriod.byType.map((t) => (
              <span key={t.key} className="px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                <strong className="text-white">{t.label}:</strong>{' '}
                <span className={t.resolved > 0 && t.winRate >= 55 ? 'text-[#00ff66] font-bold' : 'text-[#d9b114] font-bold'}>
                  {t.resolved > 0 ? `${t.winRate}%` : `${t.pending} pend.`}
                </span>{' '}
                ({t.won}W/{t.lost}L)
              </span>
            ))}
            {singlesSummaryPeriod.bySport.map((sp) => (
              <span key={sp.key} className="px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                <strong className="text-white">{sp.label}:</strong>{' '}
                <span className="text-[#d9b114] font-bold">{sp.resolved > 0 ? `${sp.winRate}%` : `${sp.pending} pend.`}</span>{' '}
                ({sp.won}W/{sp.lost}L)
              </span>
            ))}
          </>
        ) : (
          <>
            {parlaySummaryPeriod.byProfile.map((pf) => (
              <span key={pf.key} className="px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                <strong className="text-white">{pf.label}:</strong>{' '}
                <span className={pf.resolved > 0 && pf.winRate >= 35 ? 'text-[#00ff66] font-bold' : 'text-[#d9b114] font-bold'}>
                  {pf.resolved > 0 ? `${pf.winRate}%` : `${pf.pending} pend.`}
                </span>{' '}
                ({pf.won}W/{pf.lost}L · {pf.netYieldUnits >= 0 ? '+' : ''}{pf.netYieldUnits}u)
              </span>
            ))}
          </>
        )}
      </div>

      {/* 4. Selector de Pestañas Principales */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-[#30363d] font-mono text-xs">
        <button
          type="button"
          onClick={() => setSubTab('SMART_PARLAYS')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'SMART_PARLAYS'
              ? 'bg-[#161b22] text-[#00ff66] border border-[#00ff66]/40 shadow-2xs font-bold'
              : 'text-[#8b949e] hover:text-white'
          }`}
        >
          <Ticket className="w-3.5 h-3.5 text-[#00ff66]" />
          <span>Boletos Parlay ({filteredSlips.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('WEEKLY_AUDIT')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'WEEKLY_AUDIT'
              ? 'bg-[#161b22] text-[#d9b114] border border-[#d9b114]/40 shadow-2xs font-bold'
              : 'text-[#8b949e] hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#d9b114]" />
          <span>Auditoría Semanal ({Math.max(auditParlayRows.length, auditSinglesRows.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SINGLES')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'SINGLES'
              ? 'bg-[#161b22] text-sky-400 border border-sky-400/40 shadow-2xs font-bold'
              : 'text-[#8b949e] hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-sky-400" />
          <span>Sencillas (+EV) ({singlesViewMode === 'HISTORY' ? periodSinglesHistory.length : singleValueBets.length})</span>
        </button>
      </div>

      {/* CONTENIDO 1: AUDITORÍA SEMANAL Y MENSUAL (PARLAYS + SENCILLAS + MERCADOS) */}
      {subTab === 'WEEKLY_AUDIT' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-xl bg-[#0b0e14] border border-[#30363d]">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setAuditGranularity('WEEKLY')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer border ${auditGranularity === 'WEEKLY' ? 'bg-[#161b22] border-[#d9b114]/60 text-[#d9b114]' : 'border-transparent text-[#8b949e] hover:text-white'}`}
              >
                📅 Semana a Semana
              </button>
              <button
                type="button"
                onClick={() => setAuditGranularity('MONTHLY')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer border ${auditGranularity === 'MONTHLY' ? 'bg-[#161b22] border-[#d9b114]/60 text-[#d9b114]' : 'border-transparent text-[#8b949e] hover:text-white'}`}
              >
                🗓️ Mes a Mes
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleExportCsv('PARLAYS')}
                disabled={smartSlips.length === 0}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00ff66]" />
                <span>CSV Parlays</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportCsv('SINGLES')}
                disabled={singlesHistory.length === 0}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                <span>CSV Sencillas</span>
              </button>
            </div>
          </div>

          {/* Tabla 1: Parlays */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-[#30363d] bg-[#0b0e14]">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-[#00ff66]" />
                <span>Historial {auditGranularity === 'WEEKLY' ? 'Semanal' : 'Mensual'} de Parlays Inteligentes</span>
              </h4>
              <p className="text-[10px] text-[#8b949e] font-mono">
                Liquidado pata por pata contra marcadores oficiales (incluye NCAA/WNBA/FIBA; faltantes de telemetría &gt;12h pasan a VOID).
              </p>
            </div>

            {auditParlayRows.length === 0 ? (
              <div className="p-6 text-center text-[#8b949e] text-xs">
                No hay parlays registrados aún en esta ventana.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#30363d] bg-[#0b0e14] text-[10px] font-mono text-[#8b949e] uppercase">
                      <th className="p-2.5 font-bold">Período</th>
                      <th className="p-2.5 font-bold text-center">Boletos</th>
                      <th className="p-2.5 font-bold text-center">W</th>
                      <th className="p-2.5 font-bold text-center">L</th>
                      <th className="p-2.5 font-bold text-center">V</th>
                      <th className="p-2.5 font-bold text-center">P</th>
                      <th className="p-2.5 font-bold text-center">Win Rate</th>
                      <th className="p-2.5 font-bold text-center">Cuota</th>
                      <th className="p-2.5 font-bold text-right">Yield / ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d] font-mono text-white">
                    {auditParlayRows.map((item) => (
                      <tr key={item.key} className="hover:bg-[#21262d] transition">
                        <td className="p-2.5 font-bold text-white">{item.label}</td>
                        <td className="p-2.5 text-center font-bold">{item.total}</td>
                        <td className="p-2.5 text-center font-bold text-[#00ff66]">{item.won}</td>
                        <td className="p-2.5 text-center font-bold text-rose-400">{item.lost}</td>
                        <td className="p-2.5 text-center text-[#8b949e]">{item.voidCount}</td>
                        <td className="p-2.5 text-center text-[#d9b114]">{item.pending}</td>
                        <td className="p-2.5 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md ${item.resolved > 0 && item.winRate >= 40 ? 'bg-emerald-500/15 text-[#00ff66] border border-emerald-500/30' : 'bg-[#0b0e14] text-[#8b949e] border border-[#30363d]'}`}>
                            {item.winRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-[#d9b114] font-bold">@{item.avgOdds.toFixed(2)}x</td>
                        <td className="p-2.5 text-right font-bold">
                          <span className={item.netYieldUnits >= 0 ? 'text-[#00ff66]' : 'text-rose-400'}>
                            {item.netYieldUnits >= 0 ? '+' : ''}{item.netYieldUnits} u
                          </span>
                          <span className="text-[10px] text-[#8b949e] block">
                            ({item.yieldPercent >= 0 ? '+' : ''}{item.yieldPercent}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {parlaySummaryAll.byLegMarket.length > 0 && (
              <div className="p-3 border-t border-[#30363d] bg-[#0b0e14]/70">
                <span className="text-[10px] font-mono font-bold text-[#d9b114] uppercase block mb-2">
                  Efectividad Pata por Pata según Mercado (Diagnóstico Real)
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                  {parlaySummaryAll.byLegMarket.map((m) => (
                    <span key={m.key} className="px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                      <strong className="text-white">{m.label}:</strong>{' '}
                      <span className={m.resolved > 0 && m.winRate >= 65 ? 'text-[#00ff66] font-bold' : m.resolved > 0 && m.winRate < 50 ? 'text-rose-400 font-bold' : 'text-[#d9b114] font-bold'}>
                        {m.resolved > 0 ? `${m.winRate}%` : `${m.pending}P`}
                      </span>{' '}
                      ({m.won}W/{m.lost}L{m.voidCount > 0 ? `/${m.voidCount}V` : ''})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabla 2: Apuestas Sencillas (+EV y Bankers) */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-[#30363d] bg-[#0b0e14]">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Target className="w-4 h-4 text-sky-400" />
                <span>Historial {auditGranularity === 'WEEKLY' ? 'Semanal' : 'Mensual'} de Apuestas Sencillas (+EV &amp; Bankers)</span>
              </h4>
              <p className="text-[10px] text-[#8b949e] font-mono">
                Selladas de forma inmutable antes del partido para medir la eficiencia real de cada selección individual.
              </p>
            </div>

            {auditSinglesRows.length === 0 ? (
              <div className="p-6 text-center text-[#8b949e] text-xs">
                Aún no hay apuestas sencillas selladas. Abre la pestaña "Sencillas (+EV)" o pulsa "Sellar Sencillas de Hoy" para empezar a registrarlas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#30363d] bg-[#0b0e14] text-[10px] font-mono text-[#8b949e] uppercase">
                      <th className="p-2.5 font-bold">Período</th>
                      <th className="p-2.5 font-bold text-center">Sencillas</th>
                      <th className="p-2.5 font-bold text-center">W</th>
                      <th className="p-2.5 font-bold text-center">L</th>
                      <th className="p-2.5 font-bold text-center">V</th>
                      <th className="p-2.5 font-bold text-center">P</th>
                      <th className="p-2.5 font-bold text-center">Win Rate</th>
                      <th className="p-2.5 font-bold text-center">Cuota</th>
                      <th className="p-2.5 font-bold text-right">Yield / ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d] font-mono text-white">
                    {auditSinglesRows.map((item) => (
                      <tr key={item.key} className="hover:bg-[#21262d] transition">
                        <td className="p-2.5 font-bold text-white">{item.label}</td>
                        <td className="p-2.5 text-center font-bold">{item.total}</td>
                        <td className="p-2.5 text-center font-bold text-[#00ff66]">{item.won}</td>
                        <td className="p-2.5 text-center font-bold text-rose-400">{item.lost}</td>
                        <td className="p-2.5 text-center text-[#8b949e]">{item.voidCount}</td>
                        <td className="p-2.5 text-center text-[#d9b114]">{item.pending}</td>
                        <td className="p-2.5 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md ${item.resolved > 0 && item.winRate >= 60 ? 'bg-emerald-500/15 text-[#00ff66] border border-emerald-500/30' : 'bg-[#0b0e14] text-[#8b949e] border border-[#30363d]'}`}>
                            {item.winRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-[#d9b114] font-bold">@{item.avgOdds.toFixed(2)}x</td>
                        <td className="p-2.5 text-right font-bold">
                          <span className={item.netYieldUnits >= 0 ? 'text-[#00ff66]' : 'text-rose-400'}>
                            {item.netYieldUnits >= 0 ? '+' : ''}{item.netYieldUnits} u
                          </span>
                          <span className="text-[10px] text-[#8b949e] block">
                            ({item.yieldPercent >= 0 ? '+' : ''}{item.yieldPercent}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {singlesSummaryAll.byMarket.length > 0 && (
              <div className="p-3 border-t border-[#30363d] bg-[#0b0e14]/70">
                <span className="text-[10px] font-mono font-bold text-sky-400 uppercase block mb-2">
                  Desglose Sencillas por Mercado
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                  {singlesSummaryAll.byMarket.map((m) => (
                    <span key={m.key} className="px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                      <strong className="text-white">{m.label}:</strong>{' '}
                      <span className={m.resolved > 0 && m.winRate >= 60 ? 'text-[#00ff66] font-bold' : m.resolved > 0 && m.winRate < 48 ? 'text-rose-400 font-bold' : 'text-[#d9b114] font-bold'}>
                        {m.resolved > 0 ? `${m.winRate}%` : `${m.pending}P`}
                      </span>{' '}
                      ({m.won}W/{m.lost}L)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO 2: PARLAYS INTELIGENTES */}
      {subTab === 'SMART_PARLAYS' && (
        <div className="space-y-3">
          {/* Selector de Perfil */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
            {[
              { key: 'BALANCED', label: 'Equilibrado (~3.00)' },
              { key: 'HIGH_ODDS', label: 'Cuota Alta (~6.00)' },
              { key: 'CONSERVATIVE', label: 'Conservador (~2.00)' },
              { key: 'ALL', label: 'Todos los Perfiles' }
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setProfileFilter(p.key as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer shrink-0 border ${
                  profileFilter === p.key
                    ? 'bg-[#161b22] border-[#d9b114]/60 text-[#d9b114] shadow-2xs'
                    : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Lista de Boletos */}
          {filteredSlips.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0b0e14] border border-[#30363d] text-center space-y-2">
              <Ticket className="w-8 h-8 text-[#8b949e] mx-auto" />
              <p className="text-xs font-bold text-white">
                No hay parlays disponibles para el filtro seleccionado.
              </p>
              <p className="text-[11px] text-[#8b949e] font-mono">
                El motor requiere al menos 2 partidos oficiales programados para calcular combinadas con +EV.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSlips.map((slip) => {
                const profileName =
                  slip.profile === 'BALANCED'
                    ? 'Equilibrado'
                    : slip.profile === 'HIGH_ODDS'
                    ? 'Cuota Alta'
                    : 'Conservador';

                const statusColor =
                  slip.status === 'WON'
                    ? 'bg-emerald-500/15 text-[#00ff66] border-emerald-500/30'
                    : slip.status === 'LOST'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : slip.status === 'VOID'
                    ? 'bg-slate-500/15 text-[#8b949e] border-[#30363d]'
                    : 'bg-amber-500/15 text-[#d9b114] border-amber-500/30';

                const statusText =
                  slip.status === 'WON'
                    ? 'ACERTADO'
                    : slip.status === 'LOST'
                    ? 'FALLIDO'
                    : slip.status === 'VOID'
                    ? 'ANULADO / VOID'
                    : 'EN JUEGO / PENDIENTE';

                const hasEffectiveDiff =
                  typeof slip.effectiveOdds === 'number' &&
                  slip.effectiveOdds > 0 &&
                  Math.abs(slip.effectiveOdds - slip.totalOdds) > 0.01;

                return (
                  <div
                    key={slip.id}
                    className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs flex flex-col justify-between space-y-3 hover:border-[#d9b114]/40 transition"
                  >
                    <div>
                      {/* Cabecera del Boleto */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#30363d] pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-white">
                            {profileName} ({slip.legs.length} Eventos)
                          </span>
                          <span className="text-[10px] font-mono text-[#8b949e]">
                            {slip.date}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Lista de Patas con Estado y Resultado Real */}
                      <div className="mt-2.5 space-y-2">
                        {slip.legs.map((leg, idx) => {
                          const isBball = leg.sport === 'NBA' || (leg.leagueName || '').toLowerCase().includes('nba');
                          const lStatus = leg.legStatus || 'PENDING';
                          const legBadge =
                            lStatus === 'WON'
                              ? { icon: '✅', cls: 'text-[#00ff66] bg-emerald-500/15 border-emerald-500/30', text: 'Acertada' }
                              : lStatus === 'LOST'
                              ? { icon: '❌', cls: 'text-rose-400 bg-rose-500/15 border-rose-500/30', text: 'Fallida' }
                              : lStatus === 'VOID'
                              ? { icon: '⚪', cls: 'text-[#8b949e] bg-[#161b22] border-[#30363d]', text: 'Nula' }
                              : { icon: '⏳', cls: 'text-[#d9b114] bg-amber-500/10 border-amber-500/30', text: 'Pendiente' };

                          return (
                            <div
                              key={`${leg.fixtureId}_${idx}`}
                              className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white truncate">
                                    {idx + 1}. {leg.matchName}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#161b22] text-[#8b949e] border border-[#30363d] shrink-0">
                                    {isBball ? '🏀 Baloncesto' : '⚽ Fútbol'}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border shrink-0 ${legBadge.cls}`}>
                                    {legBadge.icon} {legBadge.text}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#8b949e] block truncate">
                                  {leg.label} ({leg.leagueName})
                                </span>
                                {leg.actualResult && (
                                  <span className="text-[9.5px] font-mono text-sky-300 block mt-0.5">
                                    Acta oficial: {leg.actualResult}
                                  </span>
                                )}
                                {isAthleteScratched(leg) && (
                                  <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[#d9b114] font-mono text-[9px] font-bold border border-amber-500/30">
                                    ⚠️ Atleta reportado baja · Apuesta Nula (Void)
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-[#d9b114]">
                                  @{leg.odds.toFixed(2)}x
                                </span>
                                <span className="text-[9px] font-mono text-[#00ff66] block">
                                  {Math.round(leg.impliedProb * 100)}% +EV
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer del Boleto */}
                    <div className="pt-2 border-t border-[#30363d] flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[9.5px] font-mono text-[#8b949e] block uppercase">
                          {hasEffectiveDiff ? 'Cuota Efectiva (tras VOID)' : 'Cuota Total'}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black font-mono text-white">
                            @{(hasEffectiveDiff ? slip.effectiveOdds! : slip.totalOdds).toFixed(2)}x
                          </span>
                          {hasEffectiveDiff && (
                            <span className="text-[10px] font-mono text-[#8b949e] line-through">
                              @{slip.totalOdds.toFixed(2)}x
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Botones de Descarga en Redes (Imagen PNG y PDF) */}
                        <div className="inline-flex rounded-xl bg-[#0b0e14] p-0.5 border border-[#30363d] text-xs">
                          <button
                            type="button"
                            onClick={() => handleExportParlay(slip, 'PNG')}
                            disabled={isExportingMedia}
                            className="px-2 py-1 rounded-lg text-[#d9b114] hover:text-white hover:bg-[#161b22] transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                            title="Descargar Imagen para Redes (PNG)"
                          >
                            <ImageIcon className="w-3 h-3 text-[#d9b114]" />
                            <span>PNG</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportParlay(slip, 'PDF')}
                            disabled={isExportingMedia}
                            className="px-2 py-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#161b22] transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                            title="Descargar Documento para Redes (PDF)"
                          >
                            <FileText className="w-3 h-3 text-sky-400" />
                            <span>PDF</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopySmartParlay(slip)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#0b0e14] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                        >
                          {copiedSlipId === slip.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#00ff66]" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#8b949e]" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadSmartParlayIntoSlip(slip)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-[#00ff66] border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Cargar Slip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO 3: SENCILLAS (+EV) */}
      {subTab === 'SINGLES' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Selector Hoy vs Historial Auditado */}
              <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#30363d] mr-1">
                <button
                  type="button"
                  onClick={() => setSinglesViewMode('TODAY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    singlesViewMode === 'TODAY'
                      ? 'bg-[#161b22] text-[#00ff66] border border-[#00ff66]/40'
                      : 'text-[#8b949e] hover:text-white'
                  }`}
                >
                  Jornada de Hoy ({singleValueBets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSinglesViewMode('HISTORY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    singlesViewMode === 'HISTORY'
                      ? 'bg-[#161b22] text-[#d9b114] border border-[#d9b114]/40'
                      : 'text-[#8b949e] hover:text-white'
                  }`}
                >
                  Historial Auditado ({periodSinglesHistory.length})
                </button>
              </div>

              {[
                { key: 'ALL', label: 'Todas' },
                { key: 'HIGH_VALUE', label: 'Alta Cuota (+EV)' },
                { key: 'BANKER', label: 'Bankers Seguros' }
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSingleTypeFilter(f.key as any)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer border ${
                    singleTypeFilter === f.key
                      ? 'bg-[#161b22] border-[#d9b114]/50 text-[#d9b114]'
                      : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Filtro por Deporte (Fútbol / Baloncesto) */}
              <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#30363d] ml-1">
                {[
                  { key: 'ALL', label: 'Todos' },
                  { key: 'SOCCER', label: '⚽ Fútbol' },
                  { key: 'NBA', label: '🏀 Baloncesto' }
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSingleSportFilter(s.key as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      singleSportFilter === s.key
                        ? 'bg-[#161b22] text-[#d9b114] shadow-2xs font-bold border border-[#d9b114]/40'
                        : 'text-[#8b949e] hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {singlesViewMode === 'TODAY' && (
                <button
                  type="button"
                  onClick={() => sealSinglesBatch(singleValueBets, true)}
                  disabled={isSealingSingles || singleValueBets.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-[#00ff66] border border-emerald-500/40 disabled:opacity-50 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  title="Sellar manualmente las apuestas sencillas de hoy en la base de datos"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isSealingSingles ? 'Sellando...' : '🔒 Sellar Sencillas de Hoy'}</span>
                </button>
              )}

              {/* Botón Descargar Lámina Consolidada */}
              <div className="inline-flex rounded-xl bg-[#0b0e14] p-0.5 border border-[#30363d] text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleExportSingles('PNG')}
                  disabled={isExportingMedia || filteredSingles.length === 0}
                  className="px-2.5 py-1 rounded-lg text-[#d9b114] hover:text-white hover:bg-[#161b22] transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] font-bold"
                  title="Descargar todas las apuestas individuales del día acomodadas en UNA SOLA Imagen (PNG)"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#d9b114]" />
                  <span>Descargar Lámina (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingles('PDF')}
                  disabled={isExportingMedia || filteredSingles.length === 0}
                  className="px-2.5 py-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#161b22] transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                  title="Descargar todas las apuestas individuales en Documento PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>PDF</span>
                </button>
              </div>

              {singlesViewMode === 'TODAY' && (
                <div className="flex items-center gap-1 text-[11px] text-[#8b949e] pl-2 border-l border-[#30363d]">
                  <span>Top:</span>
                  <button
                    type="button"
                    onClick={() => setSingleTopLimit(5)}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${singleTopLimit === 5 ? 'bg-[#d9b114] text-[#0b0e14]' : 'bg-[#161b22] text-[#8b949e]'}`}
                  >
                    5
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleTopLimit(10)}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${singleTopLimit === 10 ? 'bg-[#d9b114] text-[#0b0e14]' : 'bg-[#161b22] text-[#8b949e]'}`}
                  >
                    10
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Badge Informativo */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-[#d9b114]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#d9b114] shrink-0" />
              {singlesViewMode === 'HISTORY'
                ? 'Historial Sellado Pre-Partido · Eficiencia Real Liquidada contra Marcadores Oficiales'
                : 'Filtro Anti-Monotonía Activo · Auto-Sellado Pre-Partido en Supabase'}
            </span>
            <span className="text-[10px] text-[#8b949e] hidden sm:inline">
              100% Datos Cuantitativos Reales
            </span>
          </div>

          {filteredSingles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0b0e14] border border-[#30363d] text-center text-xs text-[#8b949e]">
              {singlesViewMode === 'HISTORY'
                ? 'No hay apuestas sencillas selladas aún en este período.'
                : 'No hay apuestas sencillas disponibles para los filtros actuales.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSingles.map((single) => {
                const sStatus = single.status;
                const statusBadge =
                  sStatus === 'WON'
                    ? { cls: 'bg-emerald-500/15 text-[#00ff66] border-emerald-500/30', text: 'GANADA', net: `+${(single.estimatedBookieOdd - 1).toFixed(2)} u` }
                    : sStatus === 'LOST'
                    ? { cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30', text: 'PERDIDA', net: '-1.00 u' }
                    : sStatus === 'VOID'
                    ? { cls: 'bg-slate-500/15 text-[#8b949e] border-[#30363d]', text: 'NULA', net: '0.00 u' }
                    : sStatus === 'PENDING'
                    ? { cls: 'bg-amber-500/15 text-[#d9b114] border-amber-500/30', text: 'PENDIENTE', net: null }
                    : null;

                return (
                  <div
                    key={single.id}
                    className="p-3.5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#30363d] pb-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs text-white truncate">
                          {single.matchTitle}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#0b0e14] text-[#8b949e] border border-[#30363d] shrink-0">
                          {single.sport === 'NBA' || (single.leagueName || '').toLowerCase().includes('nba') ? '🏀 Baloncesto' : '⚽ Fútbol'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {statusBadge && (
                          <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono font-bold border ${statusBadge.cls}`}>
                            {statusBadge.text}
                          </span>
                        )}
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 text-[#d9b114] border border-amber-500/30">
                          {single.betType === 'HIGH_VALUE' ? '+EV ALTO' : 'BANKER'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-white block">{single.selectionLabel}</span>
                        <span className="text-[10px] text-[#8b949e] font-mono">
                          {single.categoryLabel} · {single.matchDate}
                        </span>
                        {single.actualResult && (
                          <span className="text-[10px] font-mono text-sky-300 block mt-0.5">
                            Acta oficial: {single.actualResult}
                          </span>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-[#d9b114] block">@{single.estimatedBookieOdd.toFixed(2)}x</span>
                        <span className="text-[10px] text-[#00ff66] font-semibold">{single.probability}% prob.</span>
                        {statusBadge?.net && (
                          <span className={`text-[10px] font-bold block ${sStatus === 'WON' ? 'text-[#00ff66]' : sStatus === 'LOST' ? 'text-rose-400' : 'text-[#8b949e]'}`}>
                            {statusBadge.net}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#30363d] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[10px] font-mono text-[#00ff66] font-semibold">
                        Ventaja: +{single.valueEdgePct}% (+EV)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingle(single)}
                        className="px-2.5 py-1 rounded-xl bg-[#0b0e14] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                      >
                        {copiedSingleId === single.id ? <Check className="w-3 h-3 text-[#00ff66]" /> : <Copy className="w-3 h-3 text-[#8b949e]" />}
                        <span>{copiedSingleId === single.id ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
