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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop blur independiente (fondo visible y difuminado cristalino) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      <div className="relative z-10 bg-[#161b22] border border-[#30363d] rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-white animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-[#d9b114]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">Historial de Boletos Guardados</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#0b0e14] border border-[#30363d] text-[#8b949e] font-mono text-[10px] font-bold shrink-0">
                  {totalCount} {totalCount === 1 ? 'boleto' : 'boletos'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#8b949e] truncate">
                Gestiona tus boletos combinados, reenvía a WhatsApp y lleva control.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Toast Banner */}
        {actionFeedback && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Overview Stat Bar */}
        <div className="p-2.5 bg-[#0b0e14] border-b border-[#30363d] grid grid-cols-4 gap-2 text-center text-xs font-mono shrink-0">
          <div className="p-2 rounded-xl bg-[#161b22] border border-[#30363d]">
            <span className="text-[10px] text-[#8b949e] block uppercase font-sans font-semibold">Guardados</span>
            <span className="font-bold text-white tabular-nums text-sm">{totalCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-[#161b22] border border-[#30363d]">
            <span className="text-[10px] text-[#d9b114] block uppercase font-sans font-semibold">Pendientes</span>
            <span className="font-bold text-[#d9b114] tabular-nums text-sm">{pendingCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-[#161b22] border border-[#30363d]">
            <span className="text-[10px] text-[#00ff66] block uppercase font-sans font-semibold">Ganados</span>
            <span className="font-bold text-[#00ff66] tabular-nums text-sm">{wonCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-[#161b22] border border-[#30363d]">
            <span className="text-[10px] text-[#8b949e] block uppercase font-sans font-semibold">Efectividad</span>
            <span className="font-bold text-white tabular-nums text-sm">{winRate}%</span>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-2.5 bg-[#0b0e14] border-b border-[#30363d] space-y-2 shrink-0">
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
                  className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition cursor-pointer border ${
                    statusFilter === f.id
                      ? 'bg-[#161b22] text-white border-[#d9b114]/60 shadow-xs font-bold'
                      : 'text-[#8b949e] hover:text-white hover:bg-[#1c2129] border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sport Filter Pills */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#161b22] border border-[#30363d] shrink-0">
              <button
                type="button"
                onClick={() => setSportFilter('ALL')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'ALL' ? 'bg-[#0b0e14] text-white shadow-2xs' : 'text-[#8b949e] hover:text-white'
                }`}
              >
                🌐 Todos
              </button>
              <button
                type="button"
                onClick={() => setSportFilter('SOCCER')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'SOCCER' ? 'bg-[#0b0e14] text-[#00ff66] shadow-2xs' : 'text-[#8b949e] hover:text-white'
                }`}
              >
                ⚽ Fútbol
              </button>
              <button
                type="button"
                onClick={() => setSportFilter('NBA')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  sportFilter === 'NBA' ? 'bg-[#0b0e14] text-[#d9b114] shadow-2xs' : 'text-[#8b949e] hover:text-white'
                }`}
              >
                🏀 NBA
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por equipo o partido en boletos guardados..."
              className="w-full bg-[#161b22] border border-[#30363d] focus:border-[#d9b114] rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-[#8b949e] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Slips List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar bg-[#0b0e14]/70">
          {filteredSlips.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                <Ticket className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                No hay boletos guardados {statusFilter !== 'ALL' ? 'en esta categoría' : ''}
              </h4>
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                Arma un boleto combinado desde la cartelera y presiona <strong className="text-emerald-700 font-mono">Guardar</strong> para almacenarlo en tu historial.
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
                  className={`p-3 rounded-2xl border space-y-2.5 transition shadow-2xs ${
                    slip.status === 'WON'
                      ? 'bg-[#161b22] border-[#00ff66]/50'
                      : slip.status === 'LOST'
                      ? 'bg-[#161b22] border-rose-500/40'
                      : 'bg-[#161b22] border-[#30363d]'
                  }`}
                >
                  {/* Header Row: Date, Title, Status Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363d] pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-sm text-white">
                        {slip.title}
                      </span>
                      <span className="text-[10px] text-[#8b949e] font-mono">
                        {dateStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Status Selector */}
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(slip.id, 'PENDING')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition cursor-pointer border ${
                          slip.status === 'PENDING'
                            ? 'bg-[#0b0e14] text-[#d9b114] border-[#d9b114]/40'
                            : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
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
                            ? 'bg-[#0b0e14] text-[#00ff66] border-[#00ff66]/40'
                            : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
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
                            ? 'bg-[#0b0e14] text-rose-400 border-rose-500/40'
                            : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                        }`}
                        title="Marcar como perdido"
                      >
                        🔴 Perdido
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlip(slip.id)}
                        className="p-1 rounded-md text-[#8b949e] hover:text-rose-400 hover:bg-[#1c2129] transition cursor-pointer shrink-0 ml-1"
                        title="Eliminar boleto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Picks List */}
                  <div className="space-y-1">
                    {slip.picks.map((pick, pIdx) => (
                      <div
                        key={pick.id || pIdx}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-4 h-4 rounded-full bg-[#161b22] border border-[#30363d] text-[9px] font-mono font-bold text-white flex items-center justify-center shrink-0">
                            {pIdx + 1}
                          </span>
                          <span className="text-xs shrink-0">
                            {pick.sport === 'NBA' ? '🏀' : '⚽'}
                          </span>
                          <span className="font-semibold text-white truncate">
                            {pick.matchTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <span className="font-bold text-[#00ff66] text-[11px]">
                            {pick.selectionLabel}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-[#161b22] text-[#d9b114] text-[10px] font-bold border border-[#30363d]">
                            @{pick.userOdd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer Bar: Metrics & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#30363d] text-xs bg-[#0b0e14] p-2 rounded-xl">
                    <div className="flex items-center gap-3 overflow-x-auto font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] text-[#8b949e] uppercase block">Stake</span>
                        <span className="font-bold text-white tabular-nums">{formattedStake}</span>
                      </div>
                      <div className="w-px h-5 bg-[#30363d] shrink-0" />
                      <div>
                        <span className="text-[9px] text-[#8b949e] uppercase block">Cuota Total</span>
                        <span className="font-bold text-[#00ff66] tabular-nums">{slip.totalOdds.toFixed(2)}x</span>
                      </div>
                      <div className="w-px h-5 bg-[#30363d] shrink-0" />
                      <div>
                        <span className="text-[9px] text-[#8b949e] uppercase block">Retorno</span>
                        <span className="font-bold text-[#00ff66] tabular-nums">{formattedPayout}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadIntoParlay(slip)}
                        className="py-1 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#1c2129] text-white border border-[#30363d] text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        title="Cargar esta combinación de nuevo al boleto activo"
                      >
                        <RefreshCw className="w-3 h-3 text-[#d9b114]" />
                        <span>Cargar al Boleto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(slip)}
                        className="py-1 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#1c2129] text-[#00ff66] border border-[#00ff66]/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopySummary(slip)}
                        className="py-1 px-2 rounded-lg bg-[#161b22] hover:bg-[#1c2129] text-white text-[11px] font-bold transition cursor-pointer border border-[#30363d]"
                        title="Copiar resumen"
                      >
                        {copiedSlipId === slip.id ? (
                          <Check className="w-3 h-3 text-[#00ff66]" />
                        ) : (
                          <Copy className="w-3 h-3 text-[#8b949e]" />
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
