import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Copy, Trash2, Ticket, Flame, ShieldCheck, Target, Sparkles, TrendingUp, Plus, Info } from 'lucide-react';
import { MatchFixture, ParlayPick, GMetricsSingleBetSuggestion } from '../../types';
import {
  AccuracyEvaluatorService,
  CompactParlayAuditRecord,
  MonthlyParlayEffectivenessSummary
} from '../../services/accuracyEvaluatorService';
import {
  generateGMetricsAdminParlays,
  GMetricsParlaySuggestion,
  generateGMetricsSingleValueBets
} from '../../services/mathEngine';
import { getLocalUpcomingCache, getColombiaDateString } from '../../services/apiService';
import { useParlay } from '../../context/ParlayContext';

const LOCAL_MONTHLY_PARLAYS_CACHE_KEY = 'sportstats_monthly_parlays_ledger_v2';

export interface AdminParlaysBetaTabProps {
  fixtures: MatchFixture[];
  onCloseAdmin: () => void;
}

export const AdminParlaysBetaTab: React.FC<AdminParlaysBetaTabProps> = ({
  fixtures,
  onCloseAdmin
}) => {
  const { loadSuggestedParlay, addPick, setIsOpen } = useParlay();
  const [copiedComboId, setCopiedComboId] = useState<string | null>(null);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'PARLAYS' | 'SINGLES'>('PARLAYS');
  const [legsFilter, setLegsFilter] = useState<'ALL' | 2 | 3>('ALL');
  const [singleTypeFilter, setSingleTypeFilter] = useState<'ALL' | 'HIGH_VALUE' | 'BANKER'>('ALL');
  const [singleTopLimit, setSingleTopLimit] = useState<5 | 10>(5);
  const [monthlyRecords, setMonthlyRecords] = useState<CompactParlayAuditRecord[]>([]);

  const [monthKey, setMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(true);
  const [showHistoryTable, setShowHistoryTable] = useState<boolean>(false);
  const [confirmResetMonth, setConfirmResetMonth] = useState<boolean>(false);

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

  const syncMonthlyParlayEffectiveness = useCallback(async () => {
    setIsLoadingLedger(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    setMonthKey(currentMonth);

    const mergedMap = new Map<string, CompactParlayAuditRecord>();

    // 1. Limpiar cualquier rastro de versión previa y cargar respaldo local limpio del mes
    try {
      localStorage.removeItem('sportstats_monthly_parlays_ledger_v1');
      const rawLocal = localStorage.getItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed && parsed.monthKey === currentMonth && Array.isArray(parsed.records)) {
          parsed.records.forEach((r: CompactParlayAuditRecord) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
        } else {
          localStorage.removeItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
        }
      }
    } catch {
      // ignore
    }

    // 2. Consultar ledger mensual en Base de Datos (Supabase / backend)
    try {
      const res = await fetch('/api/admin/parlays-beta', {
        headers: getAdminAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.ledger && Array.isArray(data.ledger.records)) {
          if (data.ledger.monthKey) setMonthKey(data.ledger.monthKey);
          data.ledger.records.forEach((r: CompactParlayAuditRecord) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
        }
      }
    } catch {
      // ignore offline
    }

    // 3. Evaluar nuevos parlays sobre partidos finalizados del mes ($0 cuota API)
    try {
      const newlyEvaluated = await AccuracyEvaluatorService.evaluateCompletedParlaysForMonth(fixtures);
      let hasNewRecords = false;
      for (const rec of newlyEvaluated) {
        if (!mergedMap.has(rec.id)) {
          hasNewRecords = true;
        }
        mergedMap.set(rec.id, rec);
      }

      const finalRecords = Array.from(mergedMap.values()).sort((a, b) => b.d.localeCompare(a.d));
      setMonthlyRecords(finalRecords);

      try {
        localStorage.setItem(
          LOCAL_MONTHLY_PARLAYS_CACHE_KEY,
          JSON.stringify({ monthKey: currentMonth, records: finalRecords })
        );
      } catch {
        // ignore
      }

      // 4. Sincronizar registros nuevos hacia la Base de Datos de forma ultra-compacta
      if (hasNewRecords && newlyEvaluated.length > 0) {
        const pin =
          sessionStorage.getItem('futbolstats_admin_pin') ||
          localStorage.getItem('sportstats_admin_saved_pin') ||
          '';
        await fetch('/api/admin/parlays-beta', {
          method: 'POST',
          headers: getAdminAuthHeaders(true),
          body: JSON.stringify({ pin, records: newlyEvaluated })
        }).catch(() => {});
      }
    } catch {
      setMonthlyRecords(Array.from(mergedMap.values()).sort((a, b) => b.d.localeCompare(a.d)));
    } finally {
      setIsLoadingLedger(false);
    }
  }, [fixtures, getAdminAuthHeaders]);

  useEffect(() => {
    syncMonthlyParlayEffectiveness();
  }, [syncMonthlyParlayEffectiveness]);

  const handleResetMonthlyParlays = async () => {
    setConfirmResetMonth(false);
    try {
      localStorage.removeItem(LOCAL_MONTHLY_PARLAYS_CACHE_KEY);
    } catch {
      // ignore
    }
    setMonthlyRecords([]);

    try {
      const pin =
        sessionStorage.getItem('futbolstats_admin_pin') ||
        localStorage.getItem('sportstats_admin_saved_pin') ||
        '';
      await fetch('/api/admin/parlays-beta', {
        method: 'POST',
        headers: getAdminAuthHeaders(true),
        body: JSON.stringify({ pin, resetMonth: true })
      });
    } catch {
      // ignore
    }
  };

  const monthlyStats = useMemo<MonthlyParlayEffectivenessSummary>(() => {
    return AccuracyEvaluatorService.computeMonthlyParlaySummary(monthlyRecords, monthKey);
  }, [monthlyRecords, monthKey]);

  const effectiveFixtures = useMemo(() => {
    if (fixtures && fixtures.length > 0) return fixtures;
    const cached = getLocalUpcomingCache(getColombiaDateString(0));
    return cached?.fixtures || [];
  }, [fixtures]);

  const suggestedParlays = useMemo<GMetricsParlaySuggestion[]>(() => {
    return generateGMetricsAdminParlays(effectiveFixtures);
  }, [effectiveFixtures]);

  const filteredSuggestions = useMemo(() => {
    if (legsFilter === 'ALL') return suggestedParlays;
    return suggestedParlays.filter((c) => c.legsCount === legsFilter);
  }, [suggestedParlays, legsFilter]);

  const singleValueBets = useMemo<GMetricsSingleBetSuggestion[]>(() => {
    return generateGMetricsSingleValueBets(effectiveFixtures, false, singleTopLimit);
  }, [effectiveFixtures, singleTopLimit]);

  const filteredSingles = useMemo(() => {
    if (singleTypeFilter === 'ALL') return singleValueBets;
    return singleValueBets.filter((s) => s.betType === singleTypeFilter);
  }, [singleValueBets, singleTypeFilter]);

  const countHighValue = useMemo(
    () => singleValueBets.filter((s) => s.betType === 'HIGH_VALUE').length,
    [singleValueBets]
  );
  const countBanker = useMemo(
    () => singleValueBets.filter((s) => s.betType === 'BANKER').length,
    [singleValueBets]
  );

  const handleAddSingleToSlip = (single: GMetricsSingleBetSuggestion) => {
    const mappedPick: ParlayPick = {
      id: `${single.fixtureId}_${single.marketKey}`,
      fixtureId: single.fixtureId,
      sport: single.sport,
      matchTitle: single.matchTitle,
      homeTeamName: single.homeTeamName,
      awayTeamName: single.awayTeamName,
      matchDate: single.matchDate,
      matchTime: single.matchTime,
      marketKey: single.marketKey,
      selectionLabel: single.selectionLabel,
      referenceOdd: single.estimatedBookieOdd,
      userOdd: single.estimatedBookieOdd,
      probability: single.probability,
      isEV: true
    };
    addPick(mappedPick);
    onCloseAdmin();
    setTimeout(() => setIsOpen(true), 150);
  };

  const handleCopySingle = async (single: GMetricsSingleBetSuggestion) => {
    const typeTag = single.betType === 'HIGH_VALUE' ? '🔥 ALTA CUOTA (+EV)' : '🛡️ BANKER SEGURO';
    let text = `🎯 *APUESTA SENCILLA G METRICS · ${typeTag}*\n`;
    text += `⚽ *${single.matchTitle}* (${single.leagueName})\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 *Selección:* ${single.selectionLabel}\n`;
    text += `📊 *Mercado:* ${single.categoryLabel}\n`;
    text += `📈 *Cuota Estimada:* @${single.estimatedBookieOdd.toFixed(2)}x | *Fair Mín.:* @${single.fairMinOdd.toFixed(2)}x+\n`;
    text += `🎯 *Probabilidad Calculada:* ${single.probability}%\n`;
    text += `⚡ *Ventaja Estadística (+EV):* +${single.valueEdgePct}%\n`;
    text += `💰 *Stake Sugerido (Kelly):* ${single.recommendedKellyStakePct}% de banca\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 *Análisis Cuantitativo:*\n${single.reasoning}\n`;
    text += `🔍 *Clave Táctica:* ${single.tacticalFactor}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSingleId(single.id);
      setTimeout(() => setCopiedSingleId(null), 2500);
    } catch {
      // ignore
    }
  };

  const handleLoadToSlip = (combo: GMetricsParlaySuggestion) => {
    const mappedPicks: ParlayPick[] = combo.legs.map((leg) => ({
      id: `${leg.fixtureId}_${leg.marketKey}`,
      fixtureId: leg.fixtureId,
      sport: 'SOCCER',
      matchTitle: leg.matchTitle,
      homeTeamName: leg.homeTeamName,
      awayTeamName: leg.awayTeamName,
      matchDate: leg.matchDate,
      matchTime: leg.matchTime,
      marketKey: leg.marketKey,
      selectionLabel: leg.selectionLabel,
      referenceOdd: leg.estimatedBookieOdd,
      userOdd: leg.estimatedBookieOdd,
      probability: leg.probability,
      isEV: true
    }));

    loadSuggestedParlay(
      mappedPicks,
      `🎫 Parlay "${combo.title}" (${combo.legs.length} selecciones) cargado al boleto (${combo.combinedEstimatedOdd.toFixed(2)}x).`
    );
    onCloseAdmin();
    setTimeout(() => setIsOpen(true), 150);
  };

  const handleCopyCombo = async (combo: GMetricsParlaySuggestion) => {
    let text = `🎫 *PARLAY G METRICS · BETA ADMIN*\n`;
    text += `📌 *${combo.title}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    combo.legs.forEach((leg, i) => {
      text += `${i + 1}. ⚽ *${leg.matchTitle}* (${leg.leagueName})\n`;
      text += `   ▪️ Pick: *${leg.selectionLabel}* (${leg.probability}%) | Fair Mín: *@${leg.fairMinOdd.toFixed(2)}x*\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *Cuota Est.:* @${combo.combinedEstimatedOdd.toFixed(2)}x | *Fair Mín.:* @${combo.combinedFairMinOdd.toFixed(2)}x+\n`;
    text += `🎯 *Prob. Conjunta:* ${combo.jointProbability}% (${combo.stressTest.simulatedWinsPer100}/100 sim.)\n`;
    text += `💰 *Inversión Sugerida (Stake):* ${combo.recommendedKellyStakePct}% de banca`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedComboId(combo.id);
      setTimeout(() => setCopiedComboId(null), 2500);
    } catch {
      // ignore
    }
  };

  const count3Legs = suggestedParlays.filter((c) => c.legsCount === 3).length;
  const count2Legs = suggestedParlays.filter((c) => c.legsCount === 2).length;


  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Resumen Mensual de Efectividad de Parlays (Persistente en BD con Auto-Reset Mensual) */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                📊 Control Mensual BD ({monthlyStats.monthKey})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
                ⚡ Auto-limpieza mensual (&lt;15 KB en BD)
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                Efectividad Mensual Parlays:{' '}
                <span className="text-emerald-700">{monthlyStats.accuracyPercentage}%</span>
              </h3>
              <span className="text-xs font-medium text-slate-500">
                ({monthlyStats.hits} aciertos de {monthlyStats.totalEvaluated} boletos cerrados)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {monthlyStats.totalEvaluated > 0 && (
              <button
                type="button"
                onClick={() => setShowHistoryTable(!showHistoryTable)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                {showHistoryTable ? 'Ocultar Historial' : `Historial (${monthlyStats.totalEvaluated})`}
              </button>
            )}

            {confirmResetMonth ? (
              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
                <span className="text-[11px] text-rose-800 font-bold">¿Reiniciar mes?</span>
                <button
                  type="button"
                  onClick={handleResetMonthlyParlays}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetMonth(false)}
                  className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetMonth(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                title="Reiniciar efectividad mensual de parlays"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Nuevo Mes</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Indicadores Rápidos Compactos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 rounded-xl bg-white border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Boletos Mes</span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {isLoadingLedger ? '...' : `${monthlyStats.hits}/${monthlyStats.totalEvaluated}`}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
            <span className="text-emerald-800 block text-[10px] uppercase font-semibold">Efect. Dúos (2P)</span>
            <span className="text-sm font-bold font-mono text-emerald-700">
              {monthlyStats.duoAccuracyPct}% ({monthlyStats.duoHits}/{monthlyStats.duoEvaluated})
            </span>
          </div>

          <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs">
            <span className="text-indigo-800 block text-[10px] uppercase font-semibold">Efect. Tríos (3P)</span>
            <span className="text-sm font-bold font-mono text-indigo-700">
              {monthlyStats.trioAccuracyPct}% ({monthlyStats.trioHits}/{monthlyStats.trioEvaluated})
            </span>
          </div>

          <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
            <span className="text-amber-800 block text-[10px] uppercase font-semibold">Cuota Prom.</span>
            <span className="text-sm font-bold font-mono text-amber-800">
              {monthlyStats.avgHitOdd > 0 ? `@${monthlyStats.avgHitOdd.toFixed(2)}x` : '@1.85x'}
            </span>
          </div>
        </div>

        {/* Tabla Plegable de Parlays Evaluados en el Mes */}
        {showHistoryTable && monthlyStats.records.length > 0 && (
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 max-h-52 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] uppercase">
                  <th className="py-1.5 px-2.5">Fecha</th>
                  <th className="py-1.5 px-2">Boleto</th>
                  <th className="py-1.5 px-2">Selecciones</th>
                  <th className="py-1.5 px-2">Cuota</th>
                  <th className="py-1.5 px-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {monthlyStats.records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2.5 text-[11px] text-slate-500">{rec.d}</td>
                    <td className="py-1.5 px-2 font-sans font-semibold text-slate-900 text-[11px]">
                      {rec.t} ({rec.l}P)
                    </td>
                    <td className="py-1.5 px-2 font-sans text-[10px] text-slate-600">
                      {rec.legs.map((l, idx) => (
                        <span key={idx} className="block truncate max-w-xs">
                          {l.h ? '✓' : '✕'} {l.m}: <strong>{l.p}</strong>
                        </span>
                      ))}
                    </td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">@{Number(rec.o).toFixed(2)}x</td>
                    <td className="py-1.5 px-2.5 text-right">
                      {rec.s === 'HIT' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ ACIERTO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          ✕ FALLO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Switcher de Sub-Pestañas: Parlays Combinados vs Apuestas Sencillas (+EV & Bankers) */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('PARLAYS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'PARLAYS'
              ? 'bg-white text-slate-900 border border-slate-300 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Ticket className="w-3.5 h-3.5 text-indigo-600" />
          <span>Parlays Combinados ({suggestedParlays.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SINGLES')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'SINGLES'
              ? 'bg-white text-amber-950 border border-amber-300 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-amber-600" />
          <span>Apuestas Sencillas (+EV & Bankers) ({singleValueBets.length})</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-black uppercase">
            NUEVO
          </span>
        </button>
      </div>

      {/* VISTA A: PARLAYS COMBINADOS (2 Y 3 PATAS) */}
      {subTab === 'PARLAYS' && (
        <div className="space-y-2.5">
          {/* Filtro de patas */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setLegsFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  legsFilter === 'ALL'
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({suggestedParlays.length})
              </button>
              <button
                type="button"
                onClick={() => setLegsFilter(3)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  legsFilter === 3
                    ? 'bg-white text-indigo-800 border border-indigo-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🎯 3 Selecciones ({count3Legs})
              </button>
              <button
                type="button"
                onClick={() => setLegsFilter(2)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  legsFilter === 2
                    ? 'bg-white text-emerald-800 border border-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔥 2 Selecciones ({count2Legs})
              </button>
            </div>

            <span className="text-[10px] font-mono text-slate-500 px-2">
              Consenso 3 Sub-Modelos · Cuotas &gt; 1.50x
            </span>
          </div>

          {/* Tarjetas de Parlays */}
          {filteredSuggestions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
              <Ticket className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Sin partidos activos suficientes para armar parlays en esta fecha.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredSuggestions.map((combo) => (
                <div
                  key={combo.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
                >
                  {/* Cabecera Ultra-Compacta */}
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border shrink-0 ${
                          combo.legsCount === 3
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {combo.legsCount} Selecciones
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {combo.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        Est: @{combo.combinedEstimatedOdd.toFixed(2)}x
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                        Fair Mín: @{combo.combinedFairMinOdd.toFixed(2)}x+
                      </span>
                    </div>
                  </div>

                  {/* Lista Compacta de Selecciones */}
                  <div className="px-3.5 py-2 divide-y divide-slate-100">
                    {combo.legs.map((leg, idx) => (
                      <div
                        key={leg.fixtureId}
                        className="py-1.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{leg.matchTitle}</span>
                          <span className="text-[10px] text-slate-400">({leg.matchTime})</span>
                          <span className="font-extrabold text-emerald-700">{leg.selectionLabel}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                            {leg.probability}%
                          </span>
                          <span className="text-[10px] font-mono text-amber-800">
                            Mín @{leg.fairMinOdd.toFixed(2)}x
                          </span>
                        </div>

                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-[11px] shrink-0">
                          ~@{leg.estimatedBookieOdd.toFixed(2)}x
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Barra Inferior Compacta */}
                  <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-semibold text-slate-700">
                        {combo.stressTest.trafficLight === 'GREEN'
                          ? '🟢'
                          : combo.stressTest.trafficLight === 'YELLOW'
                          ? '🟡'
                          : '🔴'}{' '}
                        Estrés: <strong>{combo.stressTest.simulatedWinsPer100}/100</strong> aciertos
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono text-indigo-700 font-semibold">
                        Stake Sugerido: {combo.recommendedKellyStakePct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyCombo(combo)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedComboId === combo.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadToSlip(combo)}
                        className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Cargar al Boleto</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA B: APUESTAS SENCILLAS (+EV & BANKERS) */}
      {subTab === 'SINGLES' && (
        <div className="space-y-3">
          {/* Banner Didáctico Estratégico */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200/80 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <h4 className="font-bold text-amber-950">
                Estrategia de Apuestas Sencillas de Alto Rendimiento
              </h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Apostar en sencillo elimina el riesgo multiplicativo de las combinadas. Aquí seleccionamos
                <strong className="text-amber-900 font-semibold"> Alta Cuota (1.80 a 2.65 con +EV estadístico positivo)</strong> y
                <strong className="text-emerald-900 font-semibold"> Bankers Seguros (74% a 88% de acierto histórico)</strong>.
              </p>
            </div>
          </div>

          {/* Filtro de Tipo de Sencilla y Selector Top 5 vs Top 10 */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setSingleTypeFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  singleTypeFilter === 'ALL'
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({filteredSingles.length})
              </button>
              <button
                type="button"
                onClick={() => setSingleTypeFilter('HIGH_VALUE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  singleTypeFilter === 'HIGH_VALUE'
                    ? 'bg-white text-amber-900 border border-amber-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>Alta Cuota +EV ({countHighValue})</span>
              </button>
              <button
                type="button"
                onClick={() => setSingleTypeFilter('BANKER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  singleTypeFilter === 'BANKER'
                    ? 'bg-white text-emerald-900 border border-emerald-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bankers Seguros ({countBanker})</span>
              </button>
            </div>

            {/* Selector interactivo Top 5 vs Top 10 */}
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Ver:</span>
              <button
                type="button"
                onClick={() => setSingleTopLimit(5)}
                className={`px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  singleTopLimit === 5
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                }`}
              >
                ⭐ Top 5
              </button>
              <button
                type="button"
                onClick={() => setSingleTopLimit(10)}
                className={`px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  singleTopLimit === 10
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                }`}
              >
                🔟 Top 10
              </button>
            </div>
          </div>

          {/* Tarjetas de Apuestas Sencillas Curadas */}
          {filteredSingles.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
              <Target className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                No se detectaron apuestas sencillas que cumplan el umbral estricto en esta cartelera.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredSingles.map((single) => {
                const isHighValue = single.betType === 'HIGH_VALUE';
                return (
                  <div
                    key={single.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden hover:border-slate-300 transition"
                  >
                    {/* Cabecera */}
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {single.rank && (
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black border flex items-center gap-1 shrink-0 ${
                              single.rank === 1
                                ? 'bg-amber-100 text-amber-950 border-amber-300'
                                : single.rank === 2
                                ? 'bg-slate-200 text-slate-900 border-slate-300'
                                : single.rank === 3
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {single.rank === 1 ? '🥇 #1' : single.rank === 2 ? '🥈 #2' : single.rank === 3 ? '🥉 #3' : `#${single.rank}`}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                            isHighValue
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          }`}
                        >
                          {isHighValue ? (
                            <>
                              <Flame className="w-3 h-3 text-amber-600" />
                              <span>Alta Cuota (+EV)</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Banker Seguro</span>
                            </>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 font-medium truncate">
                          {single.leagueName} · {single.matchTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold">
                          Cuota Est: @{single.estimatedBookieOdd.toFixed(2)}x
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                          +{single.valueEdgePct}% EV
                        </span>
                      </div>
                    </div>

                    {/* Cuerpo de la Selección */}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {single.categoryLabel}
                          </div>
                          <div className="text-sm sm:text-base font-extrabold text-slate-900 font-sans">
                            {single.matchTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {single.qualityScore !== undefined && (
                            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-center">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Score G-Metrics</span>
                              <span className="text-xs font-mono font-black text-amber-900">{single.qualityScore}</span>
                            </div>
                          )}
                          <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-center">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Probabilidad</span>
                            <span className="text-xs font-mono font-black text-slate-900">{single.probability}%</span>
                          </div>
                          <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-center">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Cuota Mín Fair</span>
                            <span className="text-xs font-mono font-black text-amber-800">@{single.fairMinOdd.toFixed(2)}x</span>
                          </div>
                          <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-center">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Stake Kelly</span>
                            <span className="text-xs font-mono font-black text-indigo-700">{single.recommendedKellyStakePct}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Selección Destacada */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-slate-700 font-sans">Pronóstico Recomendado:</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-800 font-sans">
                            {single.selectionLabel}
                          </span>
                        </div>
                      </div>

                      {/* Justificación Cuantitativa y Táctica */}
                      <div className="text-xs text-slate-600 bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/60 space-y-1">
                        <div className="flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            <strong className="text-slate-800">Análisis Matemático:</strong> {single.reasoning}
                          </p>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-5">
                          <strong>Factor Clave:</strong> {single.tacticalFactor}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Recomendado para jugar como apuesta individual directa
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopySingle(single)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedSingleId === single.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddSingleToSlip(single)}
                          className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Añadir al Boleto</span>
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

    </div>
  );
};
