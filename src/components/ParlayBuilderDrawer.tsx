import React, { useState, useEffect } from 'react';
import { useParlay } from '../context/ParlayContext';
import { SavedSlipsService } from '../services/savedSlipsService';
import {
  Ticket,
  X,
  Trash2,
  Share2,
  Copy,
  Check,
  Edit2,
  AlertCircle,
  Sparkles,
  ChevronUp,
  BookmarkPlus,
  History
} from 'lucide-react';

interface ParlayBuilderDrawerProps {
  onOpenHistory?: () => void;
}

export const ParlayBuilderDrawer: React.FC<ParlayBuilderDrawerProps> = ({ onOpenHistory }) => {
  const {
    picks,
    stake,
    isOpen,
    toastMessage,
    setIsOpen,
    toggleOpen,
    setStake,
    removePick,
    updatePickOdd,
    clearParlay,
    totalOdds,
    jointProbability,
    potentialPayout,
    potentialProfit,
    riskLevel
  } = useParlay();

  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [editingOddValue, setEditingOddValue] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);
  const [isCalculatorExpanded, setIsCalculatorExpanded] = useState<boolean>(false);

  // Background body scroll lock when open on mobile/desktop
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalTop = document.body.style.top;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.top = originalTop;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handleStartEditOdd = (pickId: string, currentOdd: number) => {
    setEditingPickId(pickId);
    setEditingOddValue(currentOdd.toString());
  };

  const handleSaveEditOdd = (pickId: string) => {
    const parsed = parseFloat(editingOddValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 1.01) {
      updatePickOdd(pickId, parsed);
    }
    setEditingPickId(null);
  };

  const handleQuickStakeAdd = (amount: number) => {
    setStake(stake + amount);
  };

  const handleQuickStakeSet = (amount: number) => {
    setStake(amount);
  };

  // Build clean text summary for WhatsApp & Clipboard sharing
  const generateShareSummary = () => {
    const formattedStake = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(stake);
    const formattedPayout = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(potentialPayout);
    const formattedProfit = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(potentialProfit);

    let text = `🎫 *BOLETO COMBINADO SPORTSTATS PRO*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    picks.forEach((p, idx) => {
      const sportEmoji = p.sport === 'NBA' ? '🏀' : '⚽';
      text += `${idx + 1}. ${sportEmoji} *${p.matchTitle}*\n`;
      text += `   ▪️ Selección: *${p.selectionLabel}*\n`;
      text += `   ▪️ Cuota: *${p.userOdd.toFixed(2)}x* (Prob: ${p.probability}%)\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *Cuota Combinada:* ${totalOdds.toFixed(2)}x\n`;
    text += `🎯 *Probabilidad Conjunta:* ${jointProbability}%\n`;
    text += `⚠️ *Nivel de Riesgo:* ${riskLevel.label}\n`;
    text += `💰 *Stake:* ${formattedStake}\n`;
    text += `🏆 *Retorno Potencial:* ${formattedPayout}\n`;
    text += `📈 *Ganancia Neta:* +${formattedProfit}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 _Simulación estadística generada en SportStats Pro (Dixon-Coles & Poisson)._\n`;
    text += `⚖️ _Aviso (+18): Guía analítica orientativa. No somos casa de apuestas ni garantizamos aciertos; la decisión final es responsabilidad exclusiva del usuario._`;

    return text;
  };

  const handleShareWhatsApp = () => {
    const summary = generateShareSummary();
    const encoded = encodeURIComponent(summary);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopySummary = async () => {
    try {
      const summary = generateShareSummary();
      await navigator.clipboard.writeText(summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSaveSlip = () => {
    if (picks.length === 0) return;
    SavedSlipsService.saveSlip(
      picks,
      stake,
      totalOdds,
      jointProbability,
      potentialPayout,
      potentialProfit
    );
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const formattedStake = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(stake);
  const formattedPayout = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(potentialPayout);
  const formattedProfit = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(potentialProfit);

  return (
    <>
      {/* Toast Notification (non-intrusive) */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-emerald-300 font-sans text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Action Pill Button (Docked above bottom nav on mobile, bottom-right on desktop) */}
      {picks.length > 0 && !isOpen && (
        <button
          onClick={toggleOpen}
          type="button"
          aria-label="Abrir boleto de apuestas combinadas"
          className="fixed bottom-18 right-3.5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/50 hover:border-emerald-400 shadow-[0_8px_30px_rgba(16,185,129,0.35)] backdrop-blur-xl text-white transition-all duration-200 active:scale-95 cursor-pointer"
        >
          {/* Badge count */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-mono font-black text-xs shadow-md">
            <Ticket className="w-4 h-4 text-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-950 ring-2 ring-slate-950">
              {picks.length}
            </span>
          </div>

          {/* Quick Odds & Profit preview */}
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider font-sans">Boleto</span>
              <span className="text-xs font-black font-mono text-emerald-400">{totalOdds.toFixed(2)}x</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">
              +{formattedProfit}
            </span>
          </div>

          <ChevronUp className="w-4 h-4 text-emerald-400 group-hover:-translate-y-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Slide-Up Drawer / Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop Blur */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          />

          {/* Modal / Sheet Container */}
          <div
            className="relative w-full sm:max-w-lg bg-[#0c1017] border-t sm:border border-slate-700/60 sm:rounded-2xl shadow-[0_-12px_48px_rgba(0,0,0,0.85)] flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] z-10 animate-in slide-in-from-bottom duration-250 overflow-hidden"
          >
            {/* Mobile Pull Handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 bg-slate-950 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans font-bold text-xs sm:text-sm text-slate-100 truncate">Boleto Combinado</h3>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                      {picks.length} {picks.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans truncate hidden sm:block">
                    Multiplica cuotas y calcula probabilidad matemática
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenHistory && (
                  <button
                    onClick={onOpenHistory}
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] font-sans font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 cursor-pointer border border-emerald-500/30"
                    title="Ver historial de boletos guardados"
                  >
                    <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Historial</span>
                  </button>
                )}
                {picks.length > 0 && (
                  <button
                    onClick={clearParlay}
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] font-sans text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Vaciar boleto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Cerrar boleto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Dismissible Odds Transparency Warning */}
            {showDisclaimer && (
              <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] sm:text-[11px] text-amber-200/90 leading-tight truncate">
                    <strong className="text-amber-300">Cuotas estimadas:</strong> Pulsa <strong className="text-white font-mono">✎</strong> en cada línea para calibrar con tu casa de apuestas.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  type="button"
                  className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 transition-colors shrink-0"
                  aria-label="Cerrar aviso"
                  title="Ocultar aviso"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Slip Body (High-Priority Scrollable Picks List) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-4 space-y-2 custom-scrollbar bg-[#090d13]/50">
              {picks.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
                    <Ticket className="w-7 h-7" />
                  </div>
                  <h4 className="font-sans font-semibold text-slate-300 text-sm mb-1">
                    Tu boleto está vacío
                  </h4>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
                    Toca el botón <span className="text-emerald-400 font-semibold font-mono">🎫 +</span> en cualquier partido de Fútbol o NBA para armar tu apuesta combinada.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Explorar Partidos
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 pb-0.5 text-[10px] font-sans text-slate-400">
                    <span>Líneas seleccionadas ({picks.length})</span>
                    <span className="text-slate-500">Toca ✎ para editar cuota</span>
                  </div>

                  {picks.map((pick, idx) => {
                    const isEditing = editingPickId === pick.id;
                    const isOddModified = pick.userOdd !== pick.referenceOdd;

                    return (
                      <div
                        key={pick.id}
                        className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm"
                      >
                        {/* Row 1: Index + Sport + Match Title + Remove */}
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-[9px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs shrink-0">
                              {pick.sport === 'NBA' ? '🏀' : '⚽'}
                            </span>
                            <span className="font-sans font-semibold text-xs text-slate-200 truncate">
                              {pick.matchTitle}
                            </span>
                          </div>

                          <button
                            onClick={() => removePick(pick.id)}
                            type="button"
                            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Eliminar selección"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Row 2: Selection Label + Probability + Odd button */}
                        <div className="flex items-center justify-between gap-2 pl-5.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-sans font-bold text-xs text-emerald-400 truncate">
                              {pick.selectionLabel}
                            </span>
                            {pick.isEV && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/30 shrink-0">
                                +EV
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ({pick.probability}%)
                            </span>
                          </div>

                          {/* Odd Display & Quick Edit */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editingOddValue}
                                  onChange={(e) => setEditingOddValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditOdd(pick.id);
                                    if (e.key === 'Escape') setEditingPickId(null);
                                  }}
                                  autoFocus
                                  className="w-14 px-1 py-0.5 rounded bg-slate-950 border border-emerald-500 text-right font-mono font-bold text-xs text-emerald-300 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveEditOdd(pick.id)}
                                  type="button"
                                  className="p-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
                                  title="Guardar cuota"
                                >
                                  <Check className="w-3 h-3 font-bold" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditOdd(pick.id, pick.userOdd)}
                                  type="button"
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer border ${
                                    isOddModified
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                  }`}
                                  title="Toca para calibrar cuota con tu casa de apuestas"
                                >
                                  <span>@{pick.userOdd.toFixed(2)}</span>
                                  <Edit2 className="w-2.5 h-2.5 text-slate-400" />
                                </button>

                                {isOddModified && (
                                  <button
                                    onClick={() => updatePickOdd(pick.id, pick.referenceOdd)}
                                    type="button"
                                    className="text-[9px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                                    title={`Restablecer a cuota de referencia @${pick.referenceOdd.toFixed(2)}`}
                                  >
                                    Ref
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Streamlined Docked Footer / Results (Takes minimal vertical space so lines remain clearly visible) */}
            {picks.length > 0 && (
              <div className="bg-slate-950 border-t border-slate-800/90 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] shrink-0 z-20">
                {/* 1. Sleek Key Metrics Bar */}
                <div className="px-3 py-1.5 sm:py-2 border-b border-slate-800/70 flex items-center justify-between gap-1.5 bg-slate-900/50">
                  <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
                    {/* Total Odds */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[9px] font-sans text-slate-400 uppercase font-semibold">Cuota:</span>
                      <span className="font-mono font-black text-sm sm:text-base text-emerald-400">
                        {totalOdds.toFixed(2)}x
                      </span>
                    </div>

                    <div className="w-px h-3 bg-slate-800 shrink-0" />

                    {/* Joint Probability */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[9px] font-sans text-slate-400 uppercase font-semibold">Prob:</span>
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {jointProbability}%
                      </span>
                    </div>

                    <div className="w-px h-3 bg-slate-800 shrink-0" />

                    {/* Risk Traffic Light Badge */}
                    <div className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0 ${riskLevel.badgeClass}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: riskLevel.dotColor }} />
                      <span>{riskLevel.label}</span>
                    </div>
                  </div>

                  {/* Toggle Calculator / Stake Details */}
                  <button
                    onClick={() => setIsCalculatorExpanded(!isCalculatorExpanded)}
                    type="button"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-sans font-semibold border border-slate-700 transition-colors shrink-0 cursor-pointer"
                    title={isCalculatorExpanded ? "Plegar opciones de stake" : "Desplegar opciones de stake"}
                  >
                    <span>Stake: {formattedStake}</span>
                    <ChevronUp className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 ${isCalculatorExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* 2. Expandable Stake Adjuster & Return Breakdown */}
                {isCalculatorExpanded && (
                  <div className="p-2.5 sm:p-3 bg-slate-900/70 border-b border-slate-800/80 space-y-2 animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-sans text-slate-300 font-medium">
                        Monto a Apostar (Stake):
                      </span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">$</span>
                        <input
                          type="number"
                          step="1000"
                          min="1000"
                          value={stake}
                          onChange={(e) => setStake(Number(e.target.value))}
                          className="w-28 pl-6 pr-2 py-1 rounded-lg bg-slate-950 border border-slate-700 font-mono font-bold text-xs text-white text-right focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Quick Stake Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        onClick={() => handleQuickStakeSet(10000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $10K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(20000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $20K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(50000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $50K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(100000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $100K
                      </button>
                      <button
                        onClick={() => handleQuickStakeAdd(10000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        +$10K
                      </button>
                    </div>

                    {/* Profit breakdown */}
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Retorno Bruto:</span>
                        <span className="font-mono font-bold text-slate-200">{formattedPayout}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Ganancia Neta:</span>
                        <span className="font-mono font-black text-sm text-emerald-400">+{formattedProfit}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Action Bar (Ultra-compact, side-by-side) */}
                <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2">
                  {/* Net profit preview */}
                  <div className="min-w-0 pr-1 leading-tight">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Ganas:</span>
                    <span className="font-mono font-black text-sm sm:text-base text-emerald-400 truncate block">
                      +{formattedProfit}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleSaveSlip}
                      type="button"
                      className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      title="Guardar este boleto en tu historial"
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-slate-950 font-black" />
                          <span>¡Guardado!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5 text-slate-950" />
                          <span>Guardar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleShareWhatsApp}
                      type="button"
                      className="py-1.5 sm:py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-sans font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={handleCopySummary}
                      type="button"
                      className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-100 font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                          <span className="hidden xs:inline">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
