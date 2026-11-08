import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  Filter,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { MatchFixture, NBAMatchFixture, ParlayPick, GMetricsSingleBetSuggestion, SmartParlaySlip, BettingMarketSuggestion } from '../../types';
import {
  generateGMetricsSingleValueBets,
  generateSmartParlays
} from '../../services/mathEngine';
import { getLocalUpcomingCache, getColombiaDateString } from '../../services/apiService';
import { useParlay } from '../../context/ParlayContext';
import { SocialCardExportService, ExportMediaFormat } from '../../services/socialCardExportService';

export interface AdminParlaysBetaTabProps {
  fixtures: MatchFixture[];
  nbaFixtures?: NBAMatchFixture[];
  onCloseAdmin: () => void;
}

interface ParlayMetricsData {
  totalGenerated: number;
  totalWon: number;
  totalLost: number;
  totalPending: number;
  totalVoid: number;
  winRate: number;
  avgOdds: number;
  netYieldUnits: number;
  yieldPercent: number;
}

interface MonthlyStatItem {
  monthKey: string;
  monthLabel: string;
  totalSlips: number;
  won: number;
  lost: number;
  pending: number;
  voidCount: number;
  resolved: number;
  winRate: number;
  avgOdds: number;
  netYieldUnits: number;
  yieldPercent: number;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getSpanishMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  const monthName = MONTH_NAMES_ES[monthIdx] || monthKey;
  return `${monthName} ${yearStr}`;
}

const LOCAL_SMART_SLIPS_KEY = 'gmetrics_smart_parlays_slips_v3';

function getStoredSmartSlips(): SmartParlaySlip[] {
  try {
    const raw = localStorage.getItem(LOCAL_SMART_SLIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: SmartParlaySlip) => s && !s.id.includes('seed'));
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
  const [subTab, setSubTab] = useState<'SMART_PARLAYS' | 'MONTHLY_BREAKDOWN' | 'SINGLES'>('SMART_PARLAYS');
  const [profileFilter, setProfileFilter] = useState<'ALL' | 'BALANCED' | 'HIGH_ODDS' | 'CONSERVATIVE'>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [singleTypeFilter, setSingleTypeFilter] = useState<'ALL' | 'HIGH_VALUE' | 'BANKER'>('ALL');
  const [singleSportFilter, setSingleSportFilter] = useState<'ALL' | 'SOCCER' | 'NBA'>('ALL');
  const [singleTopLimit, setSingleTopLimit] = useState<5 | 10>(5);

  const [smartSlips, setSmartSlips] = useState<SmartParlaySlip[]>(() => getStoredSmartSlips());
  const [metrics, setMetrics] = useState<ParlayMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingToday, setIsGeneratingToday] = useState<boolean>(false);
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
          const clean = data.slips.filter((s: SmartParlaySlip) => s && !s.id.includes('seed'));
          setSmartSlips(clean);
          saveStoredSmartSlips(clean);
        }
        setSuccessNotice(data.message || 'Parlays reales generados y certificados para hoy.');
        setTimeout(() => setSuccessNotice(null), 4500);
      } else {
        // Fallback local garantizado si el backend no pudo persistir
        try {
          const todayStr = getColombiaDateString(0);
          const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBA);
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
        const localGenerated = generateSmartParlays(effective, todayStr, effectiveNBAFixtures);
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

  const fetchSmartParlaysAndMetrics = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/parlays/metrics', {
        headers: getAdminAuthHeaders(false)
      });
      if (res.ok) {
        const txt = await res.text();
        const data = txt ? JSON.parse(txt) : {};
        if (data.success) {
          if (Array.isArray(data.slips)) {
            const cleanSlips = data.slips.filter((s: SmartParlaySlip) => s && !s.id.includes('seed'));
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
          if (data.metrics) {
            setMetrics(data.metrics);
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
    fetchSmartParlaysAndMetrics();
  }, [fetchSmartParlaysAndMetrics]);

  // Desglose Mes a Mes estricto sobre datos reales
  const monthlyStats = useMemo<MonthlyStatItem[]>(() => {
    const map = new Map<string, SmartParlaySlip[]>();
    for (const slip of smartSlips) {
      const mKey = slip.date ? slip.date.slice(0, 7) : '2026-11';
      const list = map.get(mKey) || [];
      list.push(slip);
      map.set(mKey, list);
    }

    const result: MonthlyStatItem[] = [];
    map.forEach((slipsInMonth, monthKey) => {
      const totalSlips = slipsInMonth.length;
      const won = slipsInMonth.filter((s) => s.status === 'WON').length;
      const lost = slipsInMonth.filter((s) => s.status === 'LOST').length;
      const pending = slipsInMonth.filter((s) => s.status === 'PENDING').length;
      const voidCount = slipsInMonth.filter((s) => s.status === 'VOID').length;
      const resolved = won + lost;
      const winRate = resolved > 0 ? Number(((won / resolved) * 100).toFixed(1)) : 0;
      const avgOdds = totalSlips > 0
        ? Number((slipsInMonth.reduce((acc, s) => acc + s.totalOdds, 0) / totalSlips).toFixed(2))
        : 0;

      let netUnits = 0;
      for (const slip of slipsInMonth) {
        if (slip.status === 'WON') {
          netUnits += (slip.totalOdds - 1);
        } else if (slip.status === 'LOST') {
          netUnits -= 1;
        }
      }
      const netYieldUnits = Number(netUnits.toFixed(2));
      const yieldPercent = resolved > 0 ? Number(((netUnits / resolved) * 100).toFixed(1)) : 0;

      result.push({
        monthKey,
        monthLabel: getSpanishMonthLabel(monthKey),
        totalSlips,
        won,
        lost,
        pending,
        voidCount,
        resolved,
        winRate,
        avgOdds,
        netYieldUnits,
        yieldPercent
      });
    });

    return result.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [smartSlips]);

  // Lista de meses disponibles para el selector
  const availableMonths = useMemo(() => {
    return monthlyStats.map((m) => ({ key: m.monthKey, label: m.monthLabel }));
  }, [monthlyStats]);

  // Filtrado de boletos por perfil y por mes
  const filteredSlips = useMemo(() => {
    return smartSlips.filter((s) => {
      const matchesProfile = profileFilter === 'ALL' || s.profile === profileFilter;
      const matchesMonth = monthFilter === 'ALL' || (s.date && s.date.startsWith(monthFilter));
      return matchesProfile && matchesMonth;
    });
  }, [smartSlips, profileFilter, monthFilter]);

  // Métricas activas computadas en tiempo real 100% sobre los boletos reales existentes
  const activeMetrics = useMemo(() => {
    const slipsToCalculate = monthFilter === 'ALL'
      ? smartSlips
      : smartSlips.filter((s) => s.date && s.date.startsWith(monthFilter));

    const totalGenerated = slipsToCalculate.length;
    const totalWon = slipsToCalculate.filter((s) => s.status === 'WON').length;
    const totalLost = slipsToCalculate.filter((s) => s.status === 'LOST').length;
    const totalPending = slipsToCalculate.filter((s) => s.status === 'PENDING').length;
    const totalVoid = slipsToCalculate.filter((s) => s.status === 'VOID').length;
    const resolved = totalWon + totalLost;
    const winRate = resolved > 0 ? Number(((totalWon / resolved) * 100).toFixed(1)) : 0;
    const avgOdds = totalGenerated > 0
      ? Number((slipsToCalculate.reduce((acc, s) => acc + s.totalOdds, 0) / totalGenerated).toFixed(2))
      : 0;

    let netProfitUnits = 0;
    for (const slip of slipsToCalculate) {
      if (slip.status === 'WON') {
        netProfitUnits += (slip.totalOdds - 1);
      } else if (slip.status === 'LOST') {
        netProfitUnits -= 1;
      }
    }
    const netYieldUnits = Number(netProfitUnits.toFixed(2));
    const yieldPercent = resolved > 0 ? Number(((netProfitUnits / resolved) * 100).toFixed(1)) : 0;

    return {
      totalGenerated,
      totalWon,
      totalLost,
      totalPending,
      totalVoid,
      winRate,
      avgOdds,
      netYieldUnits,
      yieldPercent
    };
  }, [smartSlips, monthFilter]);

  const singleValueBets = useMemo<GMetricsSingleBetSuggestion[]>(() => {
    return generateGMetricsSingleValueBets(effectiveFixtures, false, singleTopLimit, effectiveNBAFixtures);
  }, [effectiveFixtures, singleTopLimit, effectiveNBAFixtures]);

  const filteredSingles = useMemo(() => {
    return singleValueBets.filter((s) => {
      const matchType = singleTypeFilter === 'ALL' || s.betType === singleTypeFilter;
      const matchSport = singleSportFilter === 'ALL' || s.sport === singleSportFilter;
      return matchType && matchSport;
    });
  }, [singleValueBets, singleTypeFilter, singleSportFilter]);

  // Exportación a Excel (.xlsx) con datos 100% reales
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen Mes a Mes
      const summaryRows = monthlyStats.map((m) => ({
        'Mes (Clave)': m.monthKey,
        'Nombre del Mes': m.monthLabel,
        'Boletos Generados': m.totalSlips,
        'Ganados (WON)': m.won,
        'Perdidos (LOST)': m.lost,
        'Pendientes': m.pending,
        'Resueltos': m.resolved,
        'Tasa de Acierto (%)': `${m.winRate}%`,
        'Cuota Promedio': `@${m.avgOdds.toFixed(2)}x`,
        'Yield Neto (Unidades)': `${m.netYieldUnits >= 0 ? '+' : ''}${m.netYieldUnits} u`,
        'ROI Neto (%)': `${m.yieldPercent >= 0 ? '+' : ''}${m.yieldPercent}%`
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows.length > 0 ? summaryRows : [
        { Mensaje: 'Sin datos registrados aún en la base de datos' }
      ]);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Mes_a_Mes');

      // Hoja 2: Detalle de Parlays Reales
      const parlayRows = smartSlips.map((s) => {
        let netProfit = 0;
        if (s.status === 'WON') netProfit = Number((s.totalOdds - 1).toFixed(2));
        else if (s.status === 'LOST') netProfit = -1;

        const legsSummary = s.legs
          .map((l, i) => `${i + 1}) ${l.matchName}: ${l.label} (@${l.odds.toFixed(2)})`)
          .join(' | ');

        return {
          'ID Boleto': s.id,
          'Fecha (YYYY-MM-DD)': s.date,
          'Perfil': s.profile === 'BALANCED' ? 'Equilibrado' : s.profile === 'HIGH_ODDS' ? 'Cuota Alta' : 'Conservador',
          'Cuota Total': Number(s.totalOdds.toFixed(2)),
          'Estado': s.status,
          'Total Patas': s.legs.length,
          'Casa Sugerida (Colombia)': s.profile === 'HIGH_ODDS' ? 'BetPlay / Rushbet' : 'BetPlay / Wplay',
          'Detalle de Selecciones': legsSummary,
          'Ganancia Neta (Unidades)': netProfit,
          'Fecha Evaluación': s.evaluationDate || 'Pendiente'
        };
      });

      const wsParlays = XLSX.utils.json_to_sheet(parlayRows.length > 0 ? parlayRows : [
        { Mensaje: 'Sin boletos registrados' }
      ]);
      XLSX.utils.book_append_sheet(wb, wsParlays, 'Detalle_Parlays');

      // Hoja 3: Detalle de Patas y Mercados
      const legsRows: any[] = [];
      smartSlips.forEach((s) => {
        s.legs.forEach((leg, idx) => {
          legsRows.push({
            'ID Boleto': s.id,
            'Fecha Boleto': s.date,
            'N° Pata': idx + 1,
            'Partido': leg.matchName,
            'Liga': leg.leagueName,
            'Categoría Mercado': leg.category,
            'Pronóstico': leg.label,
            'Cuota Decimal': Number(leg.odds.toFixed(2)),
            'Probabilidad Modelo (%)': `${Math.round(leg.impliedProb * 100)}%`,
            'Valor Esperado (+EV)': leg.expectedValue > 0 ? `+${(leg.expectedValue * 100).toFixed(1)}%` : '0%',
            'Compatible Casas Colombianas': leg.availableInColombianBooks ? 'Sí' : 'No',
            'Operador Sugerido': leg.category === 'TOTAL_GOALS' || leg.category === 'TOTAL_CORNERS_MATCH' ? 'BetPlay (Líneas Goles/Córners)' : leg.category === 'BTTS' ? 'Wplay / BetPlay' : 'BetPlay / Rushbet'
          });
        });
      });

      const wsLegs = XLSX.utils.json_to_sheet(legsRows.length > 0 ? legsRows : [
        { Mensaje: 'Sin selecciones registradas' }
      ]);
      XLSX.utils.book_append_sheet(wb, wsLegs, 'Detalle_Mercados');

      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `G_METRICS_Reporte_Parlays_Reales_${todayStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error al exportar Excel de parlays:', err);
    } finally {
      setIsExporting(false);
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

  const resolvedCount = (activeMetrics?.totalWon ?? 0) + (activeMetrics?.totalLost ?? 0);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Barra Superior Compacta con Acciones Rápidas */}
      <div className="p-3 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm">Parlays Cuantitativos (+EV)</span>
              <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-950 uppercase">
                Admin Beta
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                🇨🇴 BetPlay · Wplay · Rushbet
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 font-mono block">
              Motor Dixon-Coles & Poisson · Cuotas Reales sin Duplicados
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleGenerateTodayParlays}
            disabled={isGeneratingToday || (effectiveFixtures.length + effectiveNBAFixtures.length < 2)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Generar y certificar los 3 parlays cuantitativos del día con los partidos reales de hoy"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingToday ? 'animate-spin' : ''}`} />
            <span>{isGeneratingToday ? 'Generando...' : '⚡ Generar Parlays de Hoy'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || smartSlips.length === 0}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Descargar archivo Excel oficial (.xlsx) con auditoría mes a mes"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
            <span>{isExporting ? 'Exportando...' : 'Descargar Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={fetchSmartParlaysAndMetrics}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5"
            title="Sincronizar y auditar boletos con partidos finalizados"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* 2. Filtro de Mes y Período */}
      {availableMonths.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-slate-700">Período de Análisis:</span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
            >
              <option value="ALL">🗓️ Histórico Completo ({smartSlips.length} parlays)</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  📅 {m.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {filteredSlips.length} boletos filtrados
          </span>
        </div>
      )}

      {/* 3. Tarjetas KPI Reales (Sin Datos Falsos ni Estimaciones) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* KPI 1: Tasa de Acierto */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Tasa de Acierto Real
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                {isLoading ? '...' : `${activeMetrics?.winRate ?? 0}%`}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                ({activeMetrics ? `${activeMetrics.totalWon}W / ${activeMetrics.totalLost}L` : '0W / 0L'})
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-slate-400 block">
              {resolvedCount > 0
                ? `${resolvedCount} boletos evaluados oficialmente`
                : `${activeMetrics?.totalPending ?? filteredSlips.length} en juego o pendientes`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Target className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Cuota Promedio Ponderada */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Cuota Promedio Real
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-indigo-700">
                {isLoading ? '...' : `@${(activeMetrics?.avgOdds ?? 0).toFixed(2)}x`}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Ponderada
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-slate-400 block">
              Sobre {activeMetrics?.totalGenerated ?? filteredSlips.length} parlays generados
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Rendimiento / Yield Neto */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Rendimiento Neto Real
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black font-mono ${(activeMetrics?.netYieldUnits ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isLoading ? '...' : `${(activeMetrics?.netYieldUnits ?? 0) >= 0 ? '+' : ''}${(activeMetrics?.netYieldUnits ?? 0).toFixed(2)} u`}
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                {activeMetrics ? `${activeMetrics.yieldPercent >= 0 ? '+' : ''}${activeMetrics.yieldPercent}% ROI` : '0.0% ROI'}
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-slate-400 block">
              Apuesta fija de 1.0 unidad (Flat Stake)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Selector de Pestañas Principales */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/90 font-mono text-xs">
        <button
          type="button"
          onClick={() => setSubTab('SMART_PARLAYS')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'SMART_PARLAYS'
              ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Ticket className="w-3.5 h-3.5 text-emerald-600" />
          <span>Boletos del Día ({filteredSlips.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('MONTHLY_BREAKDOWN')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'MONTHLY_BREAKDOWN'
              ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>Auditoría Mes a Mes ({monthlyStats.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SINGLES')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'SINGLES'
              ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-amber-600" />
          <span>Sencillas (+EV) ({singleValueBets.length})</span>
        </button>
      </div>

      {/* CONTENIDO 1: AUDITORÍA MES A MES */}
      {subTab === 'MONTHLY_BREAKDOWN' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Historial Mensual de Eficiencia Cuantitativa</span>
                </h4>
                <p className="text-[10.5px] text-slate-500 font-mono">
                  Datos auditados contra resultados oficiales de marcadores de ESPN y Football-Data.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Hoja Excel</span>
              </button>
            </div>

            {monthlyStats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No hay parlays registrados aún en la base de datos histórica.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-mono text-slate-500 uppercase">
                      <th className="p-2.5 font-bold">Mes</th>
                      <th className="p-2.5 font-bold text-center">Boletos</th>
                      <th className="p-2.5 font-bold text-center">Ganados</th>
                      <th className="p-2.5 font-bold text-center">Perdidos</th>
                      <th className="p-2.5 font-bold text-center">Pendientes</th>
                      <th className="p-2.5 font-bold text-center">Win Rate</th>
                      <th className="p-2.5 font-bold text-center">Cuota Prom.</th>
                      <th className="p-2.5 font-bold text-right">Yield Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {monthlyStats.map((item) => (
                      <tr key={item.monthKey} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-bold text-slate-900">
                          {item.monthLabel}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-700">
                          {item.totalSlips}
                        </td>
                        <td className="p-2.5 text-center font-bold text-emerald-700">
                          {item.won}
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-700">
                          {item.lost}
                        </td>
                        <td className="p-2.5 text-center text-amber-700">
                          {item.pending}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md ${item.resolved > 0 && item.winRate >= 50 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                            {item.winRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-indigo-700 font-bold">
                          @{item.avgOdds.toFixed(2)}x
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          <span className={item.netYieldUnits >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {item.netYieldUnits >= 0 ? '+' : ''}{item.netYieldUnits} u
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            ({item.yieldPercent >= 0 ? '+' : ''}{item.yieldPercent}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Lista de Boletos */}
          {filteredSlips.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
              <Ticket className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                No hay parlays disponibles para el filtro seleccionado.
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
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
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : slip.status === 'LOST'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300';

                const statusText =
                  slip.status === 'WON'
                    ? 'ACERTADO'
                    : slip.status === 'LOST'
                    ? 'FALLIDO'
                    : 'EN JUEGO / PENDIENTE';

                return (
                  <div
                    key={slip.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition"
                  >
                    <div>
                      {/* Cabecera del Boleto */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">
                            {profileName} ({slip.legs.length} Eventos)
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {slip.date}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Lista de Patas */}
                      <div className="mt-2.5 space-y-2">
                        {slip.legs.map((leg, idx) => {
                          const isBball = leg.sport === 'NBA' || (leg.leagueName || '').toLowerCase().includes('nba');
                          return (
                            <div
                              key={`${leg.fixtureId}_${idx}`}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 truncate">
                                    {idx + 1}. {leg.matchName}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200/90 text-slate-700 shrink-0">
                                    {isBball ? '🏀 Baloncesto' : '⚽ Fútbol'}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 block truncate">
                                  {leg.label} ({leg.leagueName})
                                </span>
                                {isAthleteScratched(leg) && (
                                  <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 font-mono text-[9px] font-bold border border-amber-500/30">
                                    ⚠️ Atleta reportado baja · Apuesta Nula (Void)
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-indigo-700">
                                  @{leg.odds.toFixed(2)}x
                                </span>
                                <span className="text-[9px] font-mono text-emerald-700 block">
                                  {Math.round(leg.impliedProb * 100)}% +EV
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer del Boleto */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[9.5px] font-mono text-slate-400 block uppercase">
                          Cuota Total
                        </span>
                        <span className="text-lg font-black font-mono text-slate-900">
                          @{slip.totalOdds.toFixed(2)}x
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Botones de Descarga en Redes (Imagen PNG y PDF) */}
                        <div className="inline-flex rounded-xl bg-slate-900 p-0.5 border border-amber-500/30 text-xs">
                          <button
                            type="button"
                            onClick={() => handleExportParlay(slip, 'PNG')}
                            disabled={isExportingMedia}
                            className="px-2 py-1 rounded-lg text-amber-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                            title="Descargar Imagen para Redes (PNG)"
                          >
                            <ImageIcon className="w-3 h-3 text-amber-400" />
                            <span>PNG</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportParlay(slip, 'PDF')}
                            disabled={isExportingMedia}
                            className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                            title="Descargar Documento para Redes (PDF)"
                          >
                            <FileText className="w-3 h-3 text-indigo-400" />
                            <span>PDF</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopySmartParlay(slip)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                        >
                          {copiedSlipId === slip.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadSmartParlayIntoSlip(slip)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
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
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Filtro por Deporte (Fútbol / Baloncesto) */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-1">
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
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón Descargar Lámina Consolidada */}
              <div className="inline-flex rounded-xl bg-slate-900 p-0.5 border border-amber-500/30 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleExportSingles('PNG')}
                  disabled={isExportingMedia || filteredSingles.length === 0}
                  className="px-2.5 py-1 rounded-lg text-amber-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] font-bold"
                  title="Descargar todas las apuestas individuales del día acomodadas en UNA SOLA Imagen (PNG)"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Lámina (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingles('PDF')}
                  disabled={isExportingMedia || filteredSingles.length === 0}
                  className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 font-mono text-[11px] font-bold"
                  title="Descargar todas las apuestas individuales en Documento PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 pl-2 border-l border-slate-200">
                <span>Top:</span>
                <button
                  type="button"
                  onClick={() => setSingleTopLimit(5)}
                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${singleTopLimit === 5 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => setSingleTopLimit(10)}
                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${singleTopLimit === 10 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  10
                </button>
              </div>
            </div>
          </div>

          {/* Badge Informativo de Diversidad y Cero Repetición */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-900">
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Filtro Anti-Monotonía Activo · Máx 1 pick por partido · Máx 1 pick de córners en Top 5
            </span>
            <span className="text-[10px] text-amber-700/80 hidden sm:inline">
              100% Datos Cuantitativos Reales
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSingles.map((single) => (
              <div
                key={single.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {single.matchTitle}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600 shrink-0">
                      {single.sport === 'NBA' || (single.leagueName || '').toLowerCase().includes('nba') ? '🏀 Baloncesto' : '⚽ Fútbol'}
                    </span>
                  </div>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                    {single.betType === 'HIGH_VALUE' ? '+EV ALTO' : 'BANKER'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{single.selectionLabel}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{single.categoryLabel}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-indigo-700 block">@{single.estimatedBookieOdd.toFixed(2)}x</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">{single.probability}% prob.</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                    Ventaja: +{single.valueEdgePct}% (+EV)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopySingle(single)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedSingleId === single.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    <span>{copiedSingleId === single.id ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
