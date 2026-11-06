import React, { useState } from 'react';
import { RefreshCw, Trophy, Database, Sparkles, Copy, Check } from 'lucide-react';

export interface AdminMonitorTabProps {
  serverTelemetry: any | null;
  isLoadingTelemetry: boolean;
  onRefreshTelemetry: () => void;
}

const formatCleanUser = (raw: string | undefined): string => {
  if (!raw) return 'usuario';
  let str = String(raw).trim();
  if (str.startsWith('{') || str.includes('"username"') || str.includes('admin-owner')) {
    try {
      const parsed = JSON.parse(str);
      return parsed.username || parsed.displayName || parsed.id || 'admin';
    } catch {
      const m = str.match(/"username"\s*:\s*"([^"]+)"/) || str.match(/"id"\s*:\s*"([^"]+)"/);
      if (m && m[1]) return m[1];
    }
  }
  return str;
};

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
  const footballDataConfigured = Boolean(serverTelemetry?.footballData);
  const footballDataRequests = serverTelemetry?.footballDataRequestsSinceBoot ?? 0;
  const footballDataCacheHits = serverTelemetry?.footballDataCacheHits ?? 0;
  const footballDataLastSuccessAt = serverTelemetry?.footballDataLastSuccessAt
    ? new Date(serverTelemetry.footballDataLastSuccessAt).getTime()
    : 0;
  const footballDataRecentlyReached =
    footballDataConfigured && footballDataLastSuccessAt > 0 && Date.now() - footballDataLastSuccessAt < 6 * 60 * 60 * 1000;
  const footballDataLastSuccess = serverTelemetry?.footballDataLastSuccessAt
    ? new Date(serverTelemetry.footballDataLastSuccessAt).toLocaleTimeString('es-CO')
    : 'Sin consulta en esta sesión';
  const footballDataStatus = !footballDataConfigured
    ? 'Sin clave'
    : footballDataRecentlyReached
    ? 'Activo'
    : 'En espera';
  const cacheHits = serverTelemetry?.serverCacheHits ?? 0;
  const cacheMisses = serverTelemetry?.serverCacheMisses ?? 0;
  const cacheHitRate = serverTelemetry?.cacheHitRatePct ?? 100;
  const espnPulses = serverTelemetry?.espnPulseCallsCount ?? 0;
  const onlineList: any[] = Array.isArray(serverTelemetry?.onlineUsers)
    ? serverTelemetry.onlineUsers
    : [];

  const buildDiagnosticReportText = () => {
    const nowStr = new Date().toLocaleString('es-CO');
    const onlineUsersFormatted =
      onlineList.length > 0
        ? onlineList
            .map(
              (u) =>
                `@${formatCleanUser(u.username)} (${u.deviceName || u.deviceId || 'equipo'} - hace ${u.secondsAgo ?? 0}s)`
            )
            .join(', ')
        : 'Ninguno en ventana de 3 min';
    return [
      `📊 DIAGNÓSTICO G METRICS (${nowStr})`,
      `⚽ Fútbol: ESPN (Activo) | Football-Data: ${footballDataStatus} | Supabase: ${serverTelemetry?.supabasePersistence ? 'Activa' : 'Local'}`,
      `🏀 NBA: The Odds API (${serverTelemetry?.oddsApi ? 'Activa' : 'Sin clave'}) | ESPN (${espnPulses} pulsos)`,
      `🟢 Online: ${onlineNow} (${onlineUsersFormatted}) | Récord: ${peakUsers} (${peakTimeStr})`,
      `⚡ Caché: ${cacheHitRate}% (${cacheHits} hits / ${cacheMisses} misses)`
    ].join('\n');
  };

  const handleCopyReport = () => {
    const text = buildDiagnosticReportText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDiagnosticReport(true);
      setTimeout(() => setCopiedDiagnosticReport(false), 3000);
    });
  };

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Barra de Control Compacta */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-900">Monitor del Servidor & Tráfico en Tiempo Real</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200">
            {onlineNow} online
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyReport}
            className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer border ${
              copiedDiagnosticReport
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {copiedDiagnosticReport ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar Diagnóstico</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefreshTelemetry}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* 2. Estado de Proveedores (Fútbol, NBA, Base de Datos) */}
      <div className="p-2.5 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
            <span>⚽ ESPN + Football-Data:</span>
            <span className="text-emerald-400 font-bold">{footballDataStatus}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
            <span>🏀 NBA Telemetría:</span>
            <span className="text-cyan-400 font-bold">{serverTelemetry?.oddsApi ? 'Activa' : 'ESPN Oficial'}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
            <span>🗄️ Supabase:</span>
            <span className="text-emerald-400 font-bold">{serverTelemetry?.supabasePersistence ? 'Conectado' : 'Local'}</span>
          </span>
        </div>
      </div>

      {/* 3. 4 Tarjetas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            🟢 Online Ahora
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{onlineNow}</span>
            <span className="text-[10px] text-slate-500">activos</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Ventana de 3 min</span>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 flex flex-col justify-between">
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

        <div className="bg-cyan-50/50 border border-cyan-200 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
            <Database className="w-3 h-3 text-cyan-600" />
            <span>Football-Data</span>
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{footballDataStatus}</span>
            <span className="text-[10px] text-slate-500">TTL 6h</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">{footballDataRequests} req · {footballDataCacheHits} hits</span>
        </div>

        <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>Ahorro Caché</span>
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{cacheHitRate}%</span>
            <span className="text-[10px] text-slate-500">({cacheHits} hits)</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Pulsos ESPN: {espnPulses}</span>
        </div>
      </div>

      {/* 4. Dos Columnas: Usuarios Conectados y Estado de Caché */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Columna 1: Usuarios Conectados */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold text-slate-800">
              🟢 Usuarios Conectados ({onlineList.length})
            </h4>
            <span className="text-[10px] font-mono text-slate-400">Pulso 45s</span>
          </div>
          {onlineList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Sin sesiones en los últimos 3 minutos.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {onlineList.map((ou, idx) => {
                const cleanDisplayUser = formatCleanUser(ou.username);
                return (
                  <div
                    key={`${ou.deviceId || idx}`}
                    className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-indigo-800 truncate block">
                        @{cleanDisplayUser}
                      </span>
                      <p className="text-[10px] text-slate-500 truncate">
                        📱 {ou.deviceName || ou.deviceId || 'Dispositivo Web'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                      {ou.secondsAgo ?? 0}s
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna 2: Estado de Caché y Persistencia */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4 className="text-xs font-bold text-slate-800">📡 Persistencia y Caché</h4>
            <span className="text-[10px] font-mono text-slate-400">En Memoria</span>
          </div>
          <div className="p-2 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Football-Data:</span>
              <span className="font-semibold text-slate-800">{footballDataStatus}</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px] text-slate-500">
              <span>Consultas / Caché Hits:</span>
              <span className="font-mono">{footballDataRequests} / {footballDataCacheHits}</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px] text-slate-500">
              <span>Última sincronización:</span>
              <span className="font-mono">{footballDataLastSuccess}</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px] text-slate-500">
              <span>Almacenamiento:</span>
              <span className="font-semibold text-slate-700">{serverTelemetry?.supabasePersistence ? 'Supabase Free Tier' : 'Caché Local'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
