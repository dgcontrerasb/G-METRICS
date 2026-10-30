import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Trash2, Trophy, CheckCircle2 } from 'lucide-react';
import { AccuracyEvaluatorService, OverallAccuracySummary } from '../../services/accuracyEvaluatorService';

export const AdminAuditTab: React.FC = () => {
  const [summary, setSummary] = useState<OverallAccuracySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sportFilter, setSportFilter] = useState<'PRIME_SOCCER' | 'SECONDARY_SOCCER' | 'NBA' | 'ALL'>('PRIME_SOCCER');
  const [confirmResetCycle, setConfirmResetCycle] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    AccuracyEvaluatorService.getRealTimeAuditSummary()
      .then((res) => {
        if (isMounted) {
          setSummary(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDownloadExcel = () => {
    if (!summary) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const sportName =
      sportFilter === 'PRIME_SOCCER'
        ? 'Futbol_Ligas_Principales'
        : sportFilter === 'SECONDARY_SOCCER'
        ? 'Futbol_Ligas_Secundarias'
        : sportFilter === 'NBA'
        ? 'NBA_Baloncesto'
        : 'Consolidado_Global';
    AccuracyEvaluatorService.exportToExcelFile(summary, `Auditoria_Mensual_${sportName}_${dateStr}.xlsx`);
  };

  const handleResetMonthlyCycle = () => {
    AccuracyEvaluatorService.resetMonthlyCycle();
    setConfirmResetCycle(false);
    setIsLoading(true);
    AccuracyEvaluatorService.getRealTimeAuditSummary()
      .then((res) => {
        setSummary(res);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  if (isLoading || !summary) {
    return (
      <div className="py-12 text-center space-y-2">
        <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-700">
          Calculando efectividad real por competición...
        </p>
      </div>
    );
  }

  const activeStats =
    sportFilter === 'PRIME_SOCCER'
      ? summary.primeSoccer
      : sportFilter === 'SECONDARY_SOCCER'
      ? summary.secondarySoccer
      : sportFilter === 'NBA'
      ? summary.nbaBasketball
      : summary.consolidated;

  const allSampleMatches = summary.metricsByCategory.flatMap((c) => c.sampleMatches);
  const filteredMatches = allSampleMatches.filter((rec) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'PRIME_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return rec.sport === 'SOCCER' && rec.leagueTier === 'SECONDARY';
    if (sportFilter === 'NBA') return rec.sport === 'NBA';
    return true;
  });

  const filteredTopLeagues = summary.topLeagues.filter((l) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return l.sport === 'NBA';
    if (sportFilter === 'PRIME_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'PRIME';
    if (sportFilter === 'SECONDARY_SOCCER') return l.sport === 'SOCCER' && l.leagueTier === 'SECONDARY';
    return true;
  });

  const filteredCategories = summary.metricsByCategory.filter((cat) => {
    if (sportFilter === 'ALL') return true;
    if (sportFilter === 'NBA') return cat.sport === 'NBA';
    return cat.sport === 'SOCCER';
  });

  const getSegmentHeaderLabel = () => {
    if (sportFilter === 'PRIME_SOCCER') return '⚽ Fútbol · Ligas Principales';
    if (sportFilter === 'SECONDARY_SOCCER') return '🌍 Fútbol · Ligas Secundarias';
    if (sportFilter === 'NBA') return '🏀 Baloncesto · NBA';
    return '🌐 Consolidado Global';
  };

  return (
    <div className="space-y-3.5 font-sans text-slate-800">
      {/* 0. Selector de Segmento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 text-center text-xs">
        <button
          type="button"
          onClick={() => setSportFilter('PRIME_SOCCER')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'PRIME_SOCCER'
              ? 'bg-white text-emerald-800 border border-emerald-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>⚽ Principales</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('SECONDARY_SOCCER')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'SECONDARY_SOCCER'
              ? 'bg-white text-indigo-800 border border-indigo-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🌍 Secundarias</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('NBA')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'NBA'
              ? 'bg-white text-amber-800 border border-amber-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🏀 Baloncesto</span>
        </button>

        <button
          type="button"
          onClick={() => setSportFilter('ALL')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-semibold ${
            sportFilter === 'ALL'
              ? 'bg-white text-cyan-800 border border-cyan-300 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🌐 Global</span>
        </button>
      </div>

      {/* 1. Resumen Principal y Exportación */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {getSegmentHeaderLabel()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">
              📅 Acta Oficial Cerrada
            </span>
          </div>

          <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              Efectividad:{' '}
              <span className="text-emerald-700">
                {activeStats.accuracyPercentage}%
              </span>
            </h3>
            <span className="text-xs font-medium text-slate-500">
              ({activeStats.hits} aciertos de {activeStats.evaluatedMatches} verificados)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          {confirmResetCycle ? (
            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 animate-fadeIn">
              <span className="text-[11px] text-rose-800 font-bold">¿Reiniciar mes?</span>
              <button
                type="button"
                onClick={handleResetMonthlyCycle}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetCycle(false)}
                className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetCycle(true)}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="Reiniciar ciclo mensual"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo Mes</span>
            </button>
          )}
        </div>
      </div>

      {/* 1.5 Indicadores Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Muestras</span>
          <span className="text-base font-bold font-mono text-slate-900">{activeStats.totalMatches}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs">
          <span className="text-emerald-800 block text-[10px] uppercase font-semibold">Aciertos</span>
          <span className="text-base font-bold font-mono text-emerald-700">{activeStats.hits}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs">
          <span className="text-rose-800 block text-[10px] uppercase font-semibold">Fallos</span>
          <span className="text-base font-bold font-mono text-rose-700">{activeStats.misses}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
          <span className="text-amber-800 block text-[10px] uppercase font-semibold">
            {sportFilter === 'SECONDARY_SOCCER' ? 'Sin Acta' : 'Cobertura'}
          </span>
          <span className="text-base font-bold font-mono text-amber-800">
            {sportFilter === 'SECONDARY_SOCCER' ? `${activeStats.unverifiedCount}` : `${activeStats.coveragePercentage}%`}
          </span>
        </div>
      </div>

      {/* 2. Top 5 Ligas */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Top 5 Ligas con Mayor Efectividad</span>
          </span>
        </div>

        <div className="space-y-1.5">
          {filteredTopLeagues.length === 0 ? (
            <p className="text-xs text-slate-500 p-2 text-center">Sin registros verificados en este segmento.</p>
          ) : (
            filteredTopLeagues.map((league, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={league.leagueName}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {medal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900 truncate block">{league.leagueName}</span>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            league.sport === 'NBA' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(10, league.accuracyPercentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="font-bold text-slate-900 text-xs">{league.accuracyPercentage}%</span>
                    <span className="text-[10px] text-slate-500 block">{league.hits}/{league.evaluatedMatches}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Efectividad por Mercado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredCategories.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{m.categoryLabel}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {m.accuracyPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${m.accuracyPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Evaluados: {m.evaluatedMatches}</span>
              <span className="text-emerald-700 font-semibold">✓ {m.hits}</span>
              <span className="text-rose-600">✕ {m.misses}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Tabla Detallada de Partidos Evaluados */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Historial Verificado ({filteredMatches.length})</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{summary.lastUpdated}</span>
        </div>

        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] uppercase">
                <th className="py-2 px-2.5">Partido</th>
                <th className="py-2 px-2">Mercado</th>
                <th className="py-2 px-2">Pronóstico</th>
                <th className="py-2 px-2">Real</th>
                <th className="py-2 px-2.5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredMatches.map((rec, i) => (
                <tr key={`${rec.fixtureId}-${i}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-2.5 font-sans font-semibold text-slate-900">
                    <div>{rec.matchTitle}</div>
                    <span className="text-[10px] text-slate-400 font-normal block">{rec.leagueName}</span>
                  </td>
                  <td className="py-2 px-2 text-slate-600 text-[11px]">{rec.marketType}</td>
                  <td className="py-2 px-2 text-slate-900 font-semibold text-[11px]">{rec.predictionLabel}</td>
                  <td className="py-2 px-2 text-slate-600 text-[11px]">{rec.actualResult}</td>
                  <td className="py-2 px-2.5 text-right">
                    {rec.status === 'UNVERIFIED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ANULADO
                      </span>
                    ) : rec.isHit ? (
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
      </div>
    </div>
  );
};
