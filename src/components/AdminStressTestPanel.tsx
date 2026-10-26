import React, { useState } from 'react';
import { Activity, Cpu, Database, Zap, ShieldAlert, CheckCircle2, RefreshCw, Server, Layers, Gauge } from 'lucide-react';

export interface StressTestLayerMetric {
  layerName: string;
  endpoint: string;
  virtualUsers: number;
  requestsSent: number;
  coalescedBySingleFlight: number;
  cacheHits: number;
  externalApiCallsSpent: number;
  dbReadsSimulated: number;
  dbWritesSimulated: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  notes: string;
}

export interface StressTestResult {
  success: boolean;
  timestamp: string;
  mode: 'SANDBOX_CONTROLLED';
  virtualUsers: number;
  totalConcurrentRequests: number;
  durationMs: number;
  throughputReqPerSec: number;
  latency: {
    minMs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
  };
  apiImpact: {
    externalQuotaConsumed: number;
    espnPublicCallsSimulated: number;
    apiFootballQuotaSavedPct: number;
    singleFlightCoalescedCount: number;
    ramCacheHitRatioPct: number;
    quotaShieldActive: boolean;
  };
  databaseImpact: {
    supabaseConfigured: boolean;
    firestoreConfigured: boolean;
    liveMatchBrowsingDbReads: number;
    authAndLicenseDbReads: number;
    productionRowsModified: number;
    estimatedMonthlyDbBandwidthMbFor100Users: number;
    connectionPoolSaturationPct: number;
  };
  serverResources: {
    heapUsedBeforeMb: number;
    heapUsedAfterMb: number;
    heapDeltaMb: number;
    rssMb: number;
    activeCacheKeys: number;
  };
  rateLimiterAudit: {
    limitPerIpPerMin: number;
    distinctIpsAllowedPct: number;
    sharedNatIpWarning: string;
  };
  layers: StressTestLayerMetric[];
}

interface AdminStressTestPanelProps {
  adminPin: string;
}

export const AdminStressTestPanel: React.FC<AdminStressTestPanelProps> = ({ adminPin }) => {
  const [virtualUsers, setVirtualUsers] = useState<number>(100);
  const [cacheScenario, setCacheScenario] = useState<'WARM' | 'COLD_BURST'>('COLD_BURST');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runSimulation = async (usersToSimulate: number, scenario: 'WARM' | 'COLD_BURST') => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (adminPin && adminPin.trim()) {
        headers['x-admin-pin'] = adminPin.trim();
      }
      const jwt = sessionStorage.getItem('sportstats_session_jwt');
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
      }

      const res = await fetch('/api/admin/stress-test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          virtualUsers: usersToSimulate,
          scenario
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'No se pudo completar la simulación controlada.');
      } else {
        setResult(data);
      }
    } catch {
      setErrorMsg('Error de red al conectar con el motor de simulación del servidor.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Header & Controls */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 border border-cyan-500/30 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                Laboratorio de Estrés & Concurrencia (Modo Sandbox Controlado)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Simulador de {virtualUsers} Usuarios Simultáneos
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ejecuta una ráfaga concurrente real en el bucle de eventos de Node.js para medir latencia (p95/p99), deduplicación <strong>Single-Flight</strong>, memoria RAM y consumo en base de datos <strong>sin gastar tu cuota diaria de API-Football (0 llamadas pagas) ni ensuciar tablas en producción</strong>.
            </p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
            0% Gasto Cuota Real
          </span>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
              Usuarios Concurrentes:
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[50, 100, 250].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVirtualUsers(n)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    virtualUsers === n
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {n} usu.
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
              Escenario de Caché:
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setCacheScenario('COLD_BURST')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                  cacheScenario === 'COLD_BURST'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
                title="Los 100 usuarios entran en el mismo milisegundo cuando la caché acaba de expirar"
              >
                Ráfaga Fría (Peor Caso)
              </button>
              <button
                type="button"
                onClick={() => setCacheScenario('WARM')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                  cacheScenario === 'WARM'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
                title="Los 100 usuarios navegan con la caché RAM activa"
              >
                Caché Tibia (RAM)
              </button>
            </div>
          </div>

          <div className="flex items-stretch">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => runSimulation(virtualUsers, cacheScenario)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Simulando {virtualUsers} Usuarios...</span>
                </>
              ) : (
                <>
                  <Gauge className="w-4 h-4" />
                  <span>Ejecutar Prueba ({virtualUsers} Usu.)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fadeIn">
          {/* 1. Top KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Latencia p95 / Prom</span>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-black font-mono text-emerald-400">
                {result.latency.p95Ms} ms <span className="text-xs text-slate-400 font-normal">/ {result.latency.avgMs} ms</span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Capacidad: <strong className="text-white">{result.throughputReqPerSec} req/seg</strong>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Ahorro API Externa</span>
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-lg font-black font-mono text-cyan-400">
                {result.apiImpact.apiFootballQuotaSavedPct}%
              </div>
              <span className="text-[10px] text-slate-400 block">
                Coalescencia: <strong className="text-white">{result.apiImpact.singleFlightCoalescedCount} unificadas</strong>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Lecturas BD (Partidos)</span>
                <Database className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-lg font-black font-mono text-indigo-300">
                {result.databaseImpact.liveMatchBrowsingDbReads} lecturas
              </div>
              <span className="text-[10px] text-slate-400 block">
                Login/Licencias: <strong className="text-white">{result.databaseImpact.authAndLicenseDbReads} lecturas</strong>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                <span>Impacto Memoria RAM</span>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-black font-mono text-amber-300">
                {result.serverResources.heapDeltaMb >= 0 ? `+${result.serverResources.heapDeltaMb}` : result.serverResources.heapDeltaMb} MB
              </div>
              <span className="text-[10px] text-slate-400 block">
                Heap Activo: <strong className="text-white">{result.serverResources.heapUsedAfterMb} MB</strong>
              </span>
            </div>
          </div>

          {/* 2. Breakdown by Subsystem Layer */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Desglose por Capa de API & Base de Datos ({result.totalConcurrentRequests} Peticiones Concurrentes)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                 Ejecutado en {result.durationMs} ms
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2 px-2">Capa / Endpoint</th>
                    <th className="py-2 px-2 text-center">Usuarios</th>
                    <th className="py-2 px-2 text-center">Single-Flight / RAM</th>
                    <th className="py-2 px-2 text-center">Llamadas API Externa</th>
                    <th className="py-2 px-2 text-center">Lecturas BD</th>
                    <th className="py-2 px-2 text-right">Latencia p95</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {result.layers.map((layer, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-white">{layer.layerName}</div>
                        <div className="text-[10px] text-slate-400">{layer.notes}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-cyan-300">
                        {layer.virtualUsers}
                      </td>
                      <td className="py-2.5 px-2 text-center text-emerald-300">
                        {layer.coalescedBySingleFlight > 0
                          ? `${layer.coalescedBySingleFlight} unificadas`
                          : `${layer.cacheHits} RAM hits`}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                          {layer.externalApiCallsSpent} llamadas
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-indigo-300">
                        {layer.dbReadsSimulated} R / {layer.dbWritesSimulated} W
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-white">
                        {layer.p95LatencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Database & Rate Limiter Diagnostic Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Consumo en Base de Datos (Supabase / Firestore)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • <strong>Ver partidos, cuotas, córners y radar en vivo consume 0 lecturas de Base de Datos</strong> porque se sirve desde la memoria RAM del servidor (<code className="text-cyan-300">memoryCache</code>).
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • La base de datos solo se consulta cuando un usuario <strong>inicia sesión o verifica su licencia</strong>. Con {result.virtualUsers} usuarios activos diarios, el consumo estimado en Supabase Free es de apenas <strong>~{result.databaseImpact.estimatedMonthlyDbBandwidthMbFor100Users} MB/mes</strong> (menos del 2.5% del plan gratuito de 500 MB).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Diagnóstico de Escudo Anti-Abuso (Rate Limit por IP)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • Límite actual: <strong>{result.rateLimiterAudit.limitPerIpPerMin} peticiones/min por dirección IP</strong>.
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • {result.rateLimiterAudit.sharedNatIpWarning}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
