import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  X,
  Trash2,
  Share2,
  Copy,
  Check,
  Search,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { SavedSlip, SavedSlipsService, SlipStatus } from '../services/savedSlipsService';
import { useParlay } from '../context/ParlayContext';

interface SavedSlipsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SavedSlipsHistoryModal: React.FC<SavedSlipsHistoryModalProps> = ({ isOpen, onClose }) => {
  const { addPick, clearParlay, setIsOpen: setIsParlayOpen } = useParlay();

  const [slips, setSlips] = useState<SavedSlip[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | SlipStatus>('ALL');
  const [sportFilter, setSportFilter] = useState<'ALL' | 'SOCCER' | 'NBA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSlipId, setCopiedSlipId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadSlips = useCallback(() => {
    const list = SavedSlipsService.getSavedSlips();
    setSlips(list);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSlips();
    }
  }, [isOpen, loadSlips]);

  // Handle status update
  const handleUpdateStatus = (slipId: string, newStatus: SlipStatus) => {
    const ok = SavedSlipsService.updateSlipStatus(slipId, newStatus);
    if (ok) {
      loadSlips();
      setActionFeedback(`Estado del boleto actualizado a ${newStatus === 'WON' ? 'Ganado 🟢' : newStatus === 'LOST' ? 'Perdido 🔴' : 'Pendiente ⏳'}.`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Handle delete slip
  const handleDeleteSlip = (slipId: string) => {
    const ok = SavedSlipsService.deleteSlip(slipId);
    if (ok) {
      loadSlips();
      setActionFeedback('Boleto eliminado del historial.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Load saved slip into current active parlay builder
  const handleLoadIntoParlay = (slip: SavedSlip) => {
    clearParlay();
    slip.picks.forEach((pick) => {
      addPick(pick);
    });
    onClose();
    setIsParlayOpen(true);
  };

  // Share saved slip to WhatsApp
  const handleShareWhatsApp = (slip: SavedSlip) => {
    const text = SavedSlipsService.generateWhatsAppTextForSlip(slip);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Copy saved slip summary
  const handleCopySummary = async (slip: SavedSlip) => {
    try {
      const text = SavedSlipsService.generateWhatsAppTextForSlip(slip);
      await navigator.clipboard.writeText(text);
      setCopiedSlipId(slip.id);
      setTimeout(() => setCopiedSlipId(null), 2500);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  // Filter slips
  const filteredSlips = slips.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (sportFilter === 'SOCCER' && s.sportCategory === 'NBA') return false;
    if (sportFilter === 'NBA' && s.sportCategory === 'SOCCER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInTitle = s.title.toLowerCase().includes(q);
      const matchInPicks = s.picks.some(
        (p) => p.matchTitle.toLowerCase().includes(q) || p.selectionLabel.toLowerCase().includes(q)
      );
      if (!matchInTitle && !matchInPicks) return false;
    }

    return true;
  });

  // Calculate stats
  const totalCount = slips.length;
  const pendingCount = slips.filter((s) => s.status === 'PENDING').length;
  const wonCount = slips.filter((s) => s.status === 'WON').length;
  const lostCount = slips.filter((s) => s.status === 'LOST').length;

  const evaluatedCount = wonCount + lostCount;
  const winRate = evaluatedCount > 0 ? Math.round((wonCount / evaluatedCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c1017] border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative font-sans text-slate-100">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">Historial de Boletos Guardados</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                  {totalCount} {totalCount === 1 ? 'boleto' : 'boletos'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Gestiona tus apuestas combinadas, reenvía a WhatsApp y realiza seguimiento.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Toast Banner */}
        {actionFeedback && (
          <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Overview Stat Bar */}
        <div className="p-3 bg-slate-900/50 border-b border-slate-800/80 grid grid-cols-4 gap-2 text-center text-xs font-mono shrink-0">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-sans">Guardados</span>
            <span className="font-bold text-slate-200 text-sm">{totalCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-300 block uppercase font-sans">Pendientes</span>
            <span className="font-bold text-amber-400 text-sm">{pendingCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-300 block uppercase font-sans">Ganados</span>
            <span className="font-bold text-emerald-400 text-sm">{wonCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <span className="text-[10px] text-cyan-300 block uppercase font-sans">Efectividad</span>
            <span className="font-bold text-cyan-400 text-sm">{winRate}%</span>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-semibold w-full sm:w-auto">
              {[
                { id: 'ALL', label: `Todos (${totalCount})` },
                { id: 'PENDING', label: `⏳ Pendientes (${pendingCount})` },
                { id: 'WON', label: `🟢 Ganados (${wonCount})` },
                { id: 'LOST', label: `🔴 Perdidos (${lostCount})` }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sport Filter Pills */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSportFilter('ALL')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🌐 Todos
              </button>
              <button
                type="button"
                onClick={() => setSportFilter('SOCCER')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'SOCCER' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚽ Fútbol
              </button>
              <button
                type="button"
                onClick={() => setSportFilter('NBA')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'NBA' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                🏀 NBA
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por equipo o partido en boletos guardados..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Slips List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar bg-[#090d13]">
          {filteredSlips.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <Ticket className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-300 text-sm">
                No hay boletos guardados {statusFilter !== 'ALL' ? 'en esta categoría' : ''}
              </h4>
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                Arma un boleto combinado desde la cartelera y presiona <strong className="text-emerald-400 font-mono">💾 Guardar Boleto</strong> para guardarlo en tu historial.
              </p>
            </div>
          ) : (
            filteredSlips.map((slip) => {
              const formattedStake = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0
              }).format(slip.stake);
              const formattedPayout = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0
              }).format(slip.potentialPayout);

              const dateStr = new Date(slip.createdAt).toLocaleString('es-CO', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={slip.id}
                  className={`p-3 sm:p-4 rounded-2xl border space-y-3 transition shadow-sm ${
                    slip.status === 'WON'
                      ? 'bg-emerald-950/15 border-emerald-500/30'
                      : slip.status === 'LOST'
                      ? 'bg-rose-950/15 border-rose-500/30'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  {/* Header Row: Date, Title, Status Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-sm text-emerald-400">
                        {slip.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status Selector */}
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(slip.id, 'PENDING')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer border ${
                          slip.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Marcar como pendiente"
                      >
                        ⏳ Pendiente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(slip.id, 'WON')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer border ${
                          slip.status === 'WON'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Marcar como ganado"
                      >
                        🟢 Ganado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(slip.id, 'LOST')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer border ${
                          slip.status === 'LOST'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Marcar como perdido"
                      >
                        🔴 Perdido
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlip(slip.id)}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0 ml-1"
                        title="Eliminar boleto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Picks List */}
                  <div className="space-y-1.5 pl-1">
                    {slip.picks.map((pick, pIdx) => (
                      <div
                        key={pick.id || pIdx}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-[9px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                            {pIdx + 1}
                          </span>
                          <span className="text-xs shrink-0">
                            {pick.sport === 'NBA' ? '🏀' : '⚽'}
                          </span>
                          <span className="font-semibold text-slate-200 truncate">
                            {pick.matchTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <span className="font-bold text-emerald-400 text-[11px]">
                            {pick.selectionLabel}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-800">
                            @{pick.userOdd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer Bar: Metrics & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs bg-slate-950/40 p-2 rounded-xl">
                    <div className="flex items-center gap-3 overflow-x-auto font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Stake</span>
                        <span className="font-bold text-slate-200">{formattedStake}</span>
                      </div>
                      <div className="w-px h-5 bg-slate-800 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Cuota Total</span>
                        <span className="font-bold text-emerald-400">{slip.totalOdds.toFixed(2)}x</span>
                      </div>
                      <div className="w-px h-5 bg-slate-800 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Retorno</span>
                        <span className="font-bold text-emerald-400">{formattedPayout}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadIntoParlay(slip)}
                        className="py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        title="Cargar esta combinación de nuevo al boleto activo"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Cargar al Boleto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(slip)}
                        className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopySummary(slip)}
                        className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer border border-slate-700"
                        title="Copiar resumen"
                      >
                        {copiedSlipId === slip.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
