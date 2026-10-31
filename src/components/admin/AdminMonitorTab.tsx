import React, { useState } from 'react';
import { RefreshCw, Trophy, Database, Sparkles, Copy, Check } from 'lucide-react';

export interface AdminMonitorTabProps {
  serverTelemetry: any | null;
  isLoadingTelemetry: boolean;
  onRefreshTelemetry: () => void;
}

export const AdminMonitorTab: React.FC<AdminMonitorTabProps> = ({
  serverTelemetry,
  isLoadingTelemetry,
  onRefreshTelemetry
}) => {
  const [copiedDiagnosticReport, setCopiedDiagnosticReport] = useState(false);

  const onlineNow = serverTelemetry?.onlineNowCount ?? 1;
  const peakUsers = serverTelemetry?.peakOnlineUsers ?? onlineNow;
  const peakTimeStr = serverTelemetry?.peakOnlineAt
    ? new Date(serverTelemetry.peakOnlineAt).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : 'Hoy';
  const remainingQuota =
    serverTelemetry?.remainingCalls !== null && serverTelemetry?.remainingCalls !== undefined
      ? Number(serverTelemetry.remainingCalls)
      : null;
  const consumedEst =
    serverTelemetry?.consumedTodayEst !== null && serverTelemetry?.consumedTodayEst !== undefined
      ? Number(serverTelemetry.consumedTodayEst)
      : serverTelemetry?.apiFootballCallsSinceBoot ?? 0;
  const callsSinceBoot = serverTelemetry?.apiFootballCallsSinceBoot ?? 0;
  const cacheHits = serverTelemetry?.serverCacheHits ?? 0;
  const cacheMisses = serverTelemetry?.serverCacheMisses ?? 0;
  const cacheHitRate = serverTelemetry?.cacheHitRatePct ?? 100;
  const espnPulses = serverTelemetry?.espnPulseCallsCount ?? 0;
  const onlineList: any[] = Array.isArray(serverTelemetry?.onlineUsers)
    ? serverTelemetry.onlineUsers
    : [];
  const apiLogList: any[] = Array.isArray(serverTelemetry?.apiFootballAuditLog)
    ? serverTelemetry.apiFootballAuditLog
    : [];

  const buildDiagnosticReportText = () => {
    const nowStr = new Date().toLocaleString('es-CO');
    const onlineUsersFormatted =
      onlineList.length > 0
        ? onlineList
            .map(
              (u) =>
                `@${u.username || 'invitado'} (${u.deviceName || u.deviceId || 'equipo'} - hace ${u.secondsAgo ?? 0}s)`
            )
            .join(', ')
        : 'Ninguno en ventana de 3 min';
    const recentApiCallsFormatted =
      apiLogList.length > 0
        ? apiLogList
            .slice(0, 8)
            .map(
              (c) =>
                `  - [${new Date(c.at).toLocaleTimeString('es-CO')}] ${c.endpoint} | Fecha: ${c.targetDate} | Partidos: ${c.fixturesCount} | Libres: ${c.remainingAfter ?? '?'}`
            )
            .join('\n')
        : '  - 0 llamadas a API-Football en sesión (100% Caché/ESPN)';

    return [
      `📊 DIAGNÓSTICO G METRICS (${nowStr})`,
      `🛡️ Blindaje Backend: ${serverTelemetry?.bundleVersion || 'v2.6-shield-6h'} (TTL: ${serverTelemetry?.scheduleTTLHours || 6}h)`,
      `🏀 NBA Pipeline: The Odds API (${serverTelemetry?.oddsApi ? 'Activa' : 'Sin clave'}) | ESPN (${espnPulses} pulsos) | BallDontLie (${serverTelemetry?.ballDontLie ? 'Activa' : 'Respaldo 30 Franquicias'})`,
      `🟢 Online Ahora: ${onlineNow} (${onlineUsersFormatted}) | Pico: ${peakUsers} (${peakTimeStr})`,
      `📡 Cuota API-Football: ${remainingQuota !== null ? `${remainingQuota}/100 libres` : `${callsSinceBoot} llamadas en sesión`}`,
      `⚡ Eficiencia Caché: ${cacheHitRate}% (${cacheHits} hits / ${cacheMisses} misses) | Pulsos ESPN: ${espnPulses}`,
      `📋 Últimas llamadas API:\n${recentApiCallsFormatted}`
    ].join('\n');
  };

  const handleCopyReport = () => {
    const text = buildDiagnosticReportText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDiagnosticReport(true);
      setTimeout(() => setCopiedDiagnosticReport(false), 4000);
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Header Banner + Refresh */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Monitor de Tráfico, Cuota y Cuotas NBA en Tiempo Real</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Sesiones activas, cuotas The Odds API, telemetría ESPN y BallDontLie.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshTelemetry}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
          <span>Refrescar</span>
        </button>
      </div>

      {/* Proveedores de Datos Activos */}
      <div className="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏀</span>
          <span className="font-bold text-[11px]">Canales de Datos NBA:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>The Odds API: {serverTelemetry?.oddsApi ? 'Activa (DraftKings / Pinnacle)' : 'Pendiente'}</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>ESPN Oficial ($0 costo): Activo</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>BallDontLie: {serverTelemetry?.ballDontLie ? 'API Conectada' : '30 Franquicias Reales'}</span>
          </span>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            🟢 Online Ahora
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{onlineNow}</span>
            <span className="text-[10px] text-slate-500">activos</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Ventana 3 min</span>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-600" />
            <span>Récord Online</span>
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{peakUsers}</span>
            <span className="text-[10px] text-slate-500">pico</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 truncate">{peakTimeStr}</span>
        </div>

        <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
            <Database className="w-3 h-3 text-cyan-600" />
            <span>Cuota API Hoy</span>
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">
              {remainingQuota !== null ? `${consumedEst}/100` : callsSinceBoot}
            </span>
            <span className="text-[10px] text-slate-500">
              {remainingQuota !== null ? `(${remainingQuota} libres)` : 'sesión'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 mt-0.5 font-semibold">Blindaje 6h activo</span>
        </div>

        <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>Ahorro Caché</span>
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{cacheHitRate}%</span>
            <span className="text-[10px] text-slate-500">({cacheHits} hits)</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">ESPN Gratis: {espnPulses}</span>
        </div>
      </div>

      {/* Informe Corto para Copiar */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>Resumen de Diagnóstico Rápido</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Copia este estado resumido con un clic si necesitas soporte técnico.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyReport}
            className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              copiedDiagnosticReport
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {copiedDiagnosticReport ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Diagnóstico</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-white border border-slate-200 rounded-xl p-2.5 text-[10.5px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
          {buildDiagnosticReportText()}
        </pre>
      </div>

      {/* Two Columns: Connected Users Now & Recent API-Football Audit Log */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold text-slate-800">
              🟢 Conectados Ahora ({onlineList.length})
            </h4>
            <span className="text-[10px] text-slate-400">Pulso 45s</span>
          </div>
          {onlineList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Sincronizando sesiones...
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {onlineList.map((ou, idx) => (
                <div
                  key={`${ou.deviceId || idx}`}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-indigo-800 truncate block">
                      @{ou.username || 'usuario'}
                    </span>
                    <p className="text-[10px] text-slate-500 truncate">
                      📱 {ou.deviceName || ou.deviceId}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                    {ou.secondsAgo ?? 0}s
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold text-slate-800">
              📡 Llamadas API-Football ({apiLogList.length})
            </h4>
            <span className="text-[10px] text-slate-400">Tiempo real</span>
          </div>
          {apiLogList.length === 0 ? (
            <div className="py-4 text-center space-y-1">
              <p className="text-xs font-bold text-emerald-700">
                ✅ 0 llamadas nuevas en esta sesión
              </p>
              <p className="text-[10px] text-slate-500">
                Sirviendo 100% desde caché de 6h y pulso gratuito ESPN.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {apiLogList.map((entry, idx) => (
                <div
                  key={`${entry.at}-${idx}`}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-cyan-800">
                      {entry.targetDate} ({entry.fixturesCount} juegos)
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {new Date(entry.at).toLocaleTimeString('es-CO')} · {entry.endpoint}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                    Libres: {entry.remainingAfter ?? '?'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
