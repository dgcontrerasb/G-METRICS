import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
  BarChart3,
  Award,
  Lock,
  ArrowUpRight,
  Search,
  Sparkles,
  Info
} from 'lucide-react';
import {
  getHistoricalAuditSummary,
  syncLatestFinishedAudit,
  AuditPickItem,
  WeeklyAuditSummary,
  HistoricalAuditOverview
} from '../services/historicalAuditService';

export const HistoricalAuditView: React.FC = () => {
  const [auditData, setAuditData] = useState<HistoricalAuditOverview>(getHistoricalAuditSummary());
  const [selectedWeekNo, setSelectedWeekNo] = useState<number>(() => {
    const summary = getHistoricalAuditSummary();
    return summary.weeks[0]?.weekNo || 45;
  });
  const [sportFilter, setSportFilter] = useState<'ALL' | 'SOCCER' | 'NBA'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sincronización en caliente con los partidos finalizados de las últimas jornadas oficiales
  useEffect(() => {
    let isMounted = true;
    syncLatestFinishedAudit().then((latest) => {
      if (isMounted) {
        setAuditData(latest);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const currentWeek: WeeklyAuditSummary = useMemo(() => {
    return (
      auditData.weeks.find((w) => w.weekNo === selectedWeekNo) ||
      auditData.weeks[0]
    );
  }, [auditData, selectedWeekNo]);

  const filteredPicks: AuditPickItem[] = useMemo(() => {
    if (!currentWeek?.picks) return [];
    let list = currentWeek.picks;
    if (sportFilter !== 'ALL') {
      list = list.filter((p) => p.sport === sportFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.match.toLowerCase().includes(q) ||
          p.league.toLowerCase().includes(q) ||
          p.pick.toLowerCase().includes(q) ||
          p.market.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentWeek, sportFilter, searchQuery]);

  return (
    <div className="space-y-4 text-white">
      {/* ================= 1. CABECERA INSTITUCIONAL & KPIs GLOBALES ================= */}
      <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-4 sm:p-5 shadow-lg relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-[#30363d]/70">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Transparencia Matemática Auditada</span>
            </div>
            <h3 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Registro Histórico de Eficiencia</span>
              <span className="text-xs font-mono font-semibold text-[#8b949e]">
                · Certificación ISO
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-[#8b949e] max-w-xl mt-0.5 leading-snug">
              Cada predicción se sella con firma temporal antes del inicio del evento. Cero
              modificaciones retroactivas: ventaja estadística honesta y verificable.
            </p>

            {/* Aclaración metodológica del Pick #1 */}
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-emerald-500/30 text-[10.5px] sm:text-[11px] text-[#8b949e]">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white font-bold">Rigor 1 Partido = 1 Veredicto:</strong> La auditoría se basa exclusivamente en el{' '}
                <span className="text-[#00ff66] font-bold font-mono">Pick #1 Estelar</span> (Top Safe Pick). No promediamos selecciones secundarias para evitar inflar artificialmente la efectividad.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-emerald-500/40 text-right">
              <span className="text-[9px] uppercase font-bold text-[#8b949e] block leading-none">
                Eficacia Global
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-[#00ff66] leading-tight">
                {auditData.globalAccuracy}%
              </span>
            </div>
          </div>
        </div>

        {/* Rejilla de 4 KPIs Maestros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5">
          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex flex-col">
            <span className="text-[10px] text-[#8b949e] font-semibold flex items-center gap-1">
              <Award className="w-3 h-3 text-[#d9b114]" />
              <span>Total Auditados</span>
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
              {auditData.totalPicksWon} / {auditData.totalPicksAudited}
            </span>
            <span className="text-[9px] text-[#00ff66] font-mono font-bold mt-auto">
              {auditData.globalAccuracy}% de acierto
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex flex-col">
            <span className="text-[10px] text-[#8b949e] font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Retorno (ROI)</span>
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-[#00ff66] mt-0.5">
              +{auditData.accumulatedROI}%
            </span>
            <span className="text-[9px] text-[#8b949e] font-mono mt-auto">Stake plano 1 ud.</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex flex-col">
            <span className="text-[10px] text-[#8b949e] font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Racha Récord</span>
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-cyan-300 mt-0.5">
              {auditData.maxConsecutiveStreak} Picks
            </span>
            <span className="text-[9px] text-[#8b949e] font-mono mt-auto">Aciertos sin fallo</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex flex-col">
            <span className="text-[10px] text-[#8b949e] font-semibold flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-amber-400" />
              <span>Cuota Promedio</span>
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-[#d9b114] mt-0.5">
              @{auditData.avgWinningOdd.toFixed(2)}
            </span>
            <span className="text-[9px] text-emerald-400 font-mono mt-auto">+EV matemático</span>
          </div>
        </div>
      </div>

      {/* ================= 2. DESGLOSE DE EFICIENCIA POR MERCADO ================= */}
      <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#d9b114]" />
            <span>Rendimiento por Tipología de Mercado</span>
          </span>
          <span className="text-[10px] font-mono text-[#8b949e]">
            {auditData.totalPicksAudited} muestras analizadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {auditData.marketAccuracy.map((m, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d]/80 flex flex-col justify-between space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-white flex items-center gap-1 truncate">
                  <span>{m.icon}</span>
                  <span className="truncate">{m.market}</span>
                </span>
                <span className="font-mono font-black text-[#00ff66] shrink-0">{m.accuracy}%</span>
              </div>
              <div className="w-full bg-[#161b22] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-[#00ff66] h-full rounded-full transition-all duration-500"
                  style={{ width: `${m.accuracy}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-[#8b949e]">{m.samples} eventos evaluados</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 3. SELECTOR DE SEMANA Y FILTROS INTERACTIVOS ================= */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Selector de Semanas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {auditData.weeks.map((w) => {
              const isSelected = w.weekNo === selectedWeekNo;
              return (
                <button
                  key={w.weekNo}
                  type="button"
                  onClick={() => setSelectedWeekNo(w.weekNo)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#8b949e]'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>{w.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      isSelected
                        ? 'bg-emerald-400 text-black'
                        : 'bg-[#0b0e14] text-[#00ff66] border border-[#30363d]'
                    }`}
                  >
                    {w.accuracyRate}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtro por Deporte */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#161b22] border border-[#30363d] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSportFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer ${
                sportFilter === 'ALL' ? 'bg-[#0b0e14] text-white shadow-xs' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              Todos ({currentWeek.picks.length})
            </button>
            <button
              type="button"
              onClick={() => setSportFilter('SOCCER')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                sportFilter === 'SOCCER' ? 'bg-[#0b0e14] text-white shadow-xs' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <span>⚽ Fútbol</span>
            </button>
            <button
              type="button"
              onClick={() => setSportFilter('NBA')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                sportFilter === 'NBA' ? 'bg-[#0b0e14] text-white shadow-xs' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <span>🏀 NBA</span>
            </button>
          </div>
        </div>

        {/* Buscador de Eventos */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input
            type="text"
            placeholder="Buscar por equipo, torneo, mercado o selección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-emerald-400 font-medium"
          />
        </div>
      </div>

      {/* ================= 4. BITÁCORA DE PICKS AUDITADOS ================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#8b949e] px-1">
          <span>
            Mostrando <b>{filteredPicks.length}</b> de <b>{currentWeek.picks.length}</b> picks de la {currentWeek.label}
          </span>
          <span className="font-mono text-[#00ff66] font-bold">
            {currentWeek.wonPicks} Acertados · {currentWeek.totalPicks - currentWeek.wonPicks} Fallados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredPicks.map((pick) => {
            const isWon = pick.status === 'WON';
            return (
              <div
                key={pick.id}
                className={`p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-2 bg-[#161b22]/90 backdrop-blur-md ${
                  isWon
                    ? 'border-emerald-500/40 hover:border-emerald-400 shadow-[0_4px_20px_-8px_rgba(16,185,129,0.15)]'
                    : 'border-rose-500/40 hover:border-rose-400 shadow-[0_4px_20px_-8px_rgba(244,63,94,0.15)]'
                }`}
              >
                {/* Cabecera del Pick */}
                <div className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 truncate text-[#8b949e]">
                    <span>{pick.sport === 'NBA' ? '🏀' : '⚽'}</span>
                    <span className="font-bold text-white truncate">{pick.league}</span>
                    <span>·</span>
                    <span className="font-mono">{pick.date}</span>
                  </div>

                  {/* Badge de Estado Oficial */}
                  <div
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-black flex items-center gap-1 shrink-0 ${
                      isWon
                        ? 'bg-emerald-500/15 border border-emerald-500/50 text-[#00ff66]'
                        : 'bg-rose-500/15 border border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {isWon ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ACERTADO</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>NO CUMPLIDO</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Duelo de Equipos */}
                <div className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={pick.homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <span className="font-black text-xs sm:text-sm text-white truncate">
                      {pick.match}
                    </span>
                    <img src={pick.awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                  </div>
                  <div className="px-2 py-0.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-[10px] font-mono text-[#d9b114] font-black shrink-0">
                    @{pick.odd.toFixed(2)}
                  </div>
                </div>

                {/* Selección y Modelo Cuantitativo */}
                <div className="p-2 rounded-xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-[#00ff66] font-mono font-bold text-[8.5px] border border-emerald-500/30">
                        ⭐ Pick #1 Estelar
                      </span>
                      <span className="text-[9px] uppercase font-bold text-[#8b949e]">
                        {pick.market}
                      </span>
                    </div>
                    <span className="text-xs font-black text-white truncate block">
                      {pick.pick}
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-black text-[#00ff66] shrink-0 text-center">
                    {pick.certainty}% Certeza
                  </div>
                </div>

                {/* Resultado Oficial y Hash Criptográfico */}
                <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-[#30363d]/60">
                  <div className="flex items-center gap-1 text-[#8b949e] font-mono truncate">
                    <span className="font-bold text-white">Resultado:</span>
                    <span className={isWon ? 'text-[#00ff66] font-bold' : 'text-rose-300'}>
                      {pick.officialResult}
                    </span>
                  </div>
                  <span
                    className="font-mono text-[9px] text-slate-500 shrink-0 hover:text-slate-300 transition-colors"
                    title="Identificador sellado criptográficamente previo al evento"
                  >
                    #{pick.hash}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 5. GARANTÍA METODOLÓGICA & COMPROMISO ================= */}
      <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-[#30363d] flex items-start gap-3 text-[11px] text-[#8b949e] leading-relaxed">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold text-white block mb-0.5">
            Protocolo de Inmutabilidad Cuantitativa:
          </span>
          Todos los pronósticos y métricas de gol esperado (+EV) quedan registrados y congelados 15
          minutos antes del inicio reglamentario de cada partido. Las cuotas mostradas corresponden al
          consenso oficial de mercado al momento del sellado. No se publican pronósticos post-hoc ni
          se ocultan selecciones no cumplidas.
        </div>
      </div>
    </div>
  );
};
