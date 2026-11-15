import React, { useState, useEffect, useMemo } from 'react';
import { useParlay } from '../context/ParlayContext';
import { SavedSlipsService } from '../services/savedSlipsService';
import { evaluateParlayStressAndFairOdds } from '../services/mathEngine';
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
  History,
  ShieldCheck
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
    loadSuggestedParlay,
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

  const isAdminBeta = useMemo(() => {
    try {
      const rawUser = localStorage.getItem('sportstats_auth_user');
      const u = rawUser ? JSON.parse(rawUser) : null;
      return (
        u?.role === 'admin' ||
        localStorage.getItem('sportstats_admin_remember') === 'true'
      );
    } catch {
      return false;
    }
  }, [isOpen]);

  // Evalúa prueba de estrés para administradores o analistas avanzados
  const adminStressEval = useMemo(() => {
    if (!isAdminBeta || picks.length === 0) return null;
    return evaluateParlayStressAndFairOdds(
      picks.map((p) => ({
        id: p.id,
        probability: p.probability,
        odd: p.userOdd || p.referenceOdd,
        label: p.selectionLabel
      }))
    );
  }, [isAdminBeta, picks]);

  const handleTrimHardestTwoPicks = () => {
    if (!adminStressEval || picks.length < 3) return;
    const hardestSet = new Set(adminStressEval.stressTest.hardestPickIds);
    const optimizedPicks = picks.filter((p) => !hardestSet.has(p.id));
    loadSuggestedParlay(
      optimizedPicks,
      '✨ G METRICS optimizó tu ticket quitando las 2 selecciones más difíciles.'
    );
  };

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

    let text = `🎫 *BOLETO COMBINADO G METRICS*\n`;
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
    text += `💡 _Análisis estadístico generado en G METRICS._\n`;
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
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-2xl bento-floating-dock border-emerald-300 text-emerald-800 font-sans text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Action Pill Button (Docked above bottom nav on mobile, bottom-right on desktop) */}
      {picks.length > 0 && !isOpen && (
        <button
          onClick={toggleOpen}
          type="button"
          aria-label="Abrir boleto de apuestas combinadas"
          className="fixed bottom-18 right-3.5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#161b22] border border-[#d9b114]/60 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] text-white transition-all duration-200 active:scale-95 cursor-pointer"
        >
          {/* Badge count */}
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-[#0b0e14] border border-[#30363d] text-[#d9b114] font-mono font-black text-xs shadow-xs">
            <Ticket className="w-4 h-4 text-[#d9b114]" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-[#d9b114] text-[10px] font-black text-slate-950 ring-2 ring-[#161b22]">
              {picks.length}
            </span>
          </div>

          {/* Quick Odds & Profit preview */}
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[11px] font-extrabold text-white uppercase tracking-wider font-sans">Boleto</span>
              <span className="bg-[#0b0e14] border border-[#30363d] text-white px-1.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums leading-none">
                {totalOdds.toFixed(2)}x
              </span>
            </div>
            <span className="text-[10px] font-mono tabular-nums font-semibold text-[#00ff66] mt-1">
              +{formattedProfit}
            </span>
          </div>

          <ChevronUp className="w-4 h-4 text-[#d9b114] group-hover:-translate-y-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Slide-Up Drawer / Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop Blur (fondo visible y difuminado cristalino) */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          />

          {/* Modal / Sheet Container */}
          <div
            className="relative w-full sm:max-w-lg bg-[#161b22] border-t sm:border border-[#30363d] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[86vh] z-10 animate-in slide-in-from-bottom duration-250 overflow-hidden text-white"
          >
            {/* Mobile Pull Handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 bg-[#0b0e14] shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#30363d]" />
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between gap-3 bg-[#0b0e14] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0 shadow-2xs">
                  <Ticket className="w-4 h-4 text-[#d9b114]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans font-extrabold text-xs sm:text-sm text-white truncate">
                      Boleto Combinado
                    </h3>
                    <span className="bg-[#161b22] border border-[#30363d] text-[#8b949e] px-2 py-0.5 rounded-full font-mono text-[10px] font-bold shrink-0">
                      {picks.length} {picks.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8b949e] font-sans truncate hidden sm:block">
                    Multiplica cuotas y calcula probabilidad matemática
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenHistory && (
                  <button
                    onClick={onOpenHistory}
                    type="button"
                    className="px-2.5 py-1 rounded-xl text-[11px] font-sans font-semibold text-[#8b949e] hover:text-white bg-[#161b22] hover:bg-[#21262d] transition-colors flex items-center gap-1 cursor-pointer border border-[#30363d]"
                    title="Ver historial de boletos guardados"
                  >
                    <History className="w-3.5 h-3.5 text-[#d9b114]" />
                    <span>Historial</span>
                  </button>
                )}
                {picks.length > 0 && (
                  <button
                    onClick={clearParlay}
                    type="button"
                    className="px-2 py-1 rounded-xl text-[11px] font-sans font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Vaciar boleto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  type="button"
                  className="p-1.5 rounded-xl bg-[#161b22] text-[#8b949e] hover:text-white hover:bg-[#21262d] border border-[#30363d] transition-colors cursor-pointer"
                  aria-label="Cerrar boleto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Dismissible Odds Transparency Warning */}
            {showDisclaimer && (
              <div className="px-3.5 py-1.5 bg-[#0b0e14] border-b border-[#30363d] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-[#d9b114] shrink-0" />
                  <p className="text-[10px] sm:text-[11px] text-[#8b949e] leading-tight truncate">
                    <strong className="text-white">Cuotas estimadas:</strong> Pulsa <strong className="font-mono text-white">✎</strong> en cada línea para calibrar con tu casa.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  type="button"
                  className="p-1 rounded-lg text-[#8b949e] hover:text-white transition-colors shrink-0 cursor-pointer"
                  aria-label="Cerrar aviso"
                  title="Ocultar aviso"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Slip Body (High-Priority Scrollable Picks List) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3.5 space-y-2 custom-scrollbar bg-[#0b0e14]/50">
              {picks.length === 0 ? (
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl py-10 px-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[#8b949e] mb-3 shadow-2xs">
                    <Ticket className="w-7 h-7 text-[#d9b114]" />
                  </div>
                  <h4 className="font-sans font-bold text-white text-sm mb-1">
                    Tu boleto está vacío
                  </h4>
                  <p className="text-[#8b949e] text-xs max-w-xs mx-auto mb-4 leading-relaxed">
                    Toca el botón <span className="text-[#00ff66] font-semibold font-mono">🎫 +</span> en cualquier partido de Fútbol o NBA para armar tu apuesta combinada.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-white border border-[#30363d] hover:border-[#d9b114]/50 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    Explorar Partidos
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 pb-0.5 text-[10px] font-sans text-[#8b949e]">
                    <span className="font-semibold">Líneas seleccionadas ({picks.length})</span>
                    <span>Toca ✎ para editar cuota</span>
                  </div>

                  {picks.map((pick, idx) => {
                    const isEditing = editingPickId === pick.id;
                    const isOddModified = pick.userOdd !== pick.referenceOdd;

                    return (
                      <div
                        key={pick.id}
                        className="bg-[#161b22] border border-[#30363d] p-2.5 sm:p-3 rounded-2xl hover:border-[#d9b114]/50 transition-all"
                      >
                        {/* Row 1: Index + Sport + Match Title + Remove */}
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-4.5 h-4.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-[9px] font-mono tabular-nums font-bold text-[#8b949e] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs shrink-0">
                              {pick.sport === 'NBA' ? '🏀' : '⚽'}
                            </span>
                            <span className="font-sans font-bold text-xs text-white truncate">
                              {pick.matchTitle}
                            </span>
                          </div>

                          <button
                            onClick={() => removePick(pick.id)}
                            type="button"
                            className="p-1 rounded-lg text-[#8b949e] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Eliminar selección"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Row 2: Selection Label + Probability + Odd button */}
                        <div className="flex items-center justify-between gap-2 pl-6">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="bg-[#0b0e14] border border-[#30363d] text-white px-2 py-0.5 rounded-lg font-sans font-bold text-[11px] truncate max-w-full">
                              {pick.selectionLabel}
                            </span>
                            {pick.isEV && (
                              <span className="bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold shrink-0">
                                +EV
                              </span>
                            )}
                            <span className="text-[10px] text-[#8b949e] font-mono tabular-nums font-semibold shrink-0">
                              {pick.probability}%
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
                                  className="w-14 px-1.5 py-0.5 rounded-lg bg-[#0b0e14] border border-[#00ff66] text-right font-mono font-bold text-xs text-[#00ff66] focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveEditOdd(pick.id)}
                                  type="button"
                                  className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
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
                                  className={`px-2 py-0.5 rounded-lg font-mono font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                                    isOddModified
                                      ? 'bg-[#d9b114]/15 border border-[#d9b114] text-[#d9b114]'
                                      : 'bg-[#0b0e14] border border-[#30363d] text-white hover:border-[#d9b114]/60'
                                  }`}
                                  title="Toca para calibrar cuota con tu casa de apuestas"
                                >
                                  <span>@{pick.userOdd.toFixed(2)}</span>
                                  <Edit2 className="w-2.5 h-2.5 opacity-60" />
                                </button>

                                {isOddModified && (
                                  <button
                                    onClick={() => updatePickOdd(pick.id, pick.referenceOdd)}
                                    type="button"
                                    className="text-[9px] text-[#8b949e] hover:text-white underline cursor-pointer"
                                    title={`Restablecer a cuota de referencia @${pick.referenceOdd.toFixed(2)}`}
                                  >
                                    Ref
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row 3 (Solo Beta Admin): Cuota Mínima Recomendada (Fair Odds) compacta */}
                        {isAdminBeta && (
                          <div className="mt-1 pt-1 border-t border-slate-100 pl-5.5 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-sans">
                              Fair Odd Mín:{' '}
                              <strong className="font-mono text-amber-800">
                                @{Math.max(1.15, 100 / Math.max(1, pick.probability)).toFixed(2)}x+
                              </strong>
                            </span>
                            {pick.userOdd >= 100 / Math.max(1, pick.probability) ? (
                              <span className="text-emerald-700 font-mono font-bold">
                                ✓ Valor (+EV)
                              </span>
                            ) : (
                              <span className="text-rose-600 font-mono font-semibold">
                                Cuota baja vs riesgo
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Panel Exclusivo Beta Admin Ultra-Compacto: Fair Odds & Prueba de Estrés */}
                  {isAdminBeta && adminStressEval && (
                    <div
                      className={`mt-2 p-3 rounded-2xl border space-y-2 shadow-2xs ${
                        adminStressEval.stressTest.trafficLight === 'GREEN'
                          ? 'bg-[#161b22] border-emerald-500/40'
                          : adminStressEval.stressTest.trafficLight === 'YELLOW'
                          ? 'bg-[#161b22] border-[#d9b114]/40'
                          : 'bg-[#161b22] border-rose-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#d9b114] shrink-0" />
                          <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-white">
                            Beta Admin · Fair Odds &amp; Estrés
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="bg-[#0b0e14] border border-[#d9b114]/60 text-[#d9b114] px-2 py-0.5 rounded-lg font-bold">
                            Fair Mín: @{adminStressEval.combinedFairMinOdd.toFixed(2)}x+
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#0b0e14] border border-[#30363d] text-white font-bold">
                            {adminStressEval.stressTest.trafficLight === 'GREEN'
                              ? '🟢'
                              : adminStressEval.stressTest.trafficLight === 'YELLOW'
                              ? '🟡'
                              : '🔴'}{' '}
                            ~{Math.max(1, Math.round(adminStressEval.stressTest.simulatedWinsPer100 / 10))}/10 aciertos
                          </span>
                        </div>
                      </div>

                      {/* Consejo G METRICS Compacto */}
                      <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-[10.5px] font-medium text-[#8b949e] leading-snug">
                          {picks.length >= 3
                            ? '💡 "Consejo G METRICS: Tu ticket tiene un riesgo elevado. Si quitas las 2 selecciones más difíciles, tu probabilidad de ganar aumenta un 40%."'
                            : adminStressEval.stressTest.gMetricsAdvice}
                        </p>
                        {picks.length >= 3 && (
                          <button
                            type="button"
                            onClick={handleTrimHardestTwoPicks}
                            className="shrink-0 px-2.5 py-1.5 rounded-xl bg-[#d9b114] hover:bg-[#c5a013] text-slate-950 font-sans font-extrabold text-[10px] transition-colors cursor-pointer"
                          >
                            Quitar 2 más difíciles (+40%)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Streamlined Docked Footer / Bento 2x2 Metrics Matrix */}
            {picks.length > 0 && (
              <div className="bg-[#0b0e14] border-t border-[#30363d] shadow-2xl shrink-0 z-20">
                {/* 1. Matriz Bento de Métricas del Ticket (2x2 en Móvil, 4 cols en PC) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-[#0b0e14] border-b border-[#30363d]">
                  {/* Cuota Combinada */}
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-2.5 py-1.5 sm:py-2 flex flex-col justify-center">
                    <span className="text-[9px] font-sans text-[#8b949e] uppercase tracking-wider font-bold">
                      Cuota Total
                    </span>
                    <span className="font-mono tabular-nums font-black text-sm sm:text-base text-white leading-tight mt-0.5">
                      {totalOdds.toFixed(2)}x
                    </span>
                  </div>

                  {/* Probabilidad Conjunta */}
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-2.5 py-1.5 sm:py-2 flex flex-col justify-center">
                    <span className="text-[9px] font-sans text-[#8b949e] uppercase tracking-wider font-bold">
                      Prob. Conjunta
                    </span>
                    <span className="font-mono tabular-nums font-black text-sm sm:text-base text-[#d9b114] leading-tight mt-0.5">
                      {jointProbability}%
                    </span>
                  </div>

                  {/* Semáforo de Riesgo */}
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-2.5 py-1.5 sm:py-2 flex flex-col justify-center">
                    <span className="text-[9px] font-sans text-[#8b949e] uppercase tracking-wider font-bold">
                      Nivel Riesgo
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: riskLevel.dotColor }}
                      />
                      <span className="font-sans font-bold text-[11px] sm:text-xs text-white truncate">
                        {riskLevel.label}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Simulador / Stake */}
                  <button
                    onClick={() => setIsCalculatorExpanded(!isCalculatorExpanded)}
                    type="button"
                    className="bg-[#161b22] border border-[#30363d] hover:border-[#d9b114]/60 rounded-xl px-2.5 py-1.5 sm:py-2 flex items-center justify-between gap-1 text-left cursor-pointer transition-all"
                    title={isCalculatorExpanded ? 'Plegar opciones de stake' : 'Desplegar opciones de stake'}
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-sans text-[#8b949e] uppercase tracking-wider font-bold block">
                        Stake (Editar)
                      </span>
                      <span className="font-mono tabular-nums font-black text-xs sm:text-sm text-white truncate block mt-0.5">
                        {formattedStake}
                      </span>
                    </div>
                    <ChevronUp
                      className={`w-3.5 h-3.5 text-[#d9b114] transition-transform duration-200 shrink-0 ${
                        isCalculatorExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Expandable Stake Adjuster & Return Breakdown */}
                {isCalculatorExpanded && (
                  <div className="px-2.5 sm:px-3 py-2.5 bg-[#0b0e14] border-b border-[#30363d] animate-in slide-in-from-bottom-2 duration-150">
                    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-2.5 sm:p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-sans text-[#8b949e] font-semibold">
                          Monto a Apostar (Stake):
                        </span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] text-xs font-mono">
                            $
                          </span>
                          <input
                            type="number"
                            step="1000"
                            min="1000"
                            value={stake}
                            onChange={(e) => setStake(Number(e.target.value))}
                            className="w-32 pl-6 pr-2.5 py-1 rounded-xl bg-[#0b0e14] border border-[#30363d] font-mono tabular-nums font-bold text-xs text-white text-right focus:outline-none focus:border-[#d9b114]"
                          />
                        </div>
                      </div>

                      {/* Quick Stake Chips */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                        <button
                          onClick={() => handleQuickStakeSet(10000)}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#21262d] border border-[#30363d] text-white font-mono tabular-nums text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          $10K
                        </button>
                        <button
                          onClick={() => handleQuickStakeSet(20000)}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#21262d] border border-[#30363d] text-white font-mono tabular-nums text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          $20K
                        </button>
                        <button
                          onClick={() => handleQuickStakeSet(50000)}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#21262d] border border-[#30363d] text-white font-mono tabular-nums text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          $50K
                        </button>
                        <button
                          onClick={() => handleQuickStakeSet(100000)}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#21262d] border border-[#30363d] text-white font-mono tabular-nums text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          $100K
                        </button>
                        <button
                          onClick={() => handleQuickStakeAdd(10000)}
                          type="button"
                          className="bg-[#0b0e14] hover:bg-[#21262d] border border-[#d9b114]/50 text-[#d9b114] px-2.5 py-1 rounded-lg font-mono tabular-nums text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          +$10K
                        </button>
                      </div>

                      {/* Profit breakdown */}
                      <div className="pt-2 border-t border-[#30363d] flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-[#8b949e] block font-medium">Retorno Bruto:</span>
                          <span className="font-mono tabular-nums font-bold text-white">{formattedPayout}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#8b949e] block font-medium">Ganancia Neta:</span>
                          <span className="font-mono tabular-nums font-black text-sm text-[#00ff66]">+{formattedProfit}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Action Bar (Ultra-compact, side-by-side) */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 bg-[#0b0e14]">
                  {/* Net profit preview */}
                  <div className="min-w-0 pr-1 leading-tight">
                    <span className="text-[9px] text-[#8b949e] font-bold uppercase tracking-wider block">
                      Ganas:
                    </span>
                    <span className="font-mono tabular-nums font-black text-sm sm:text-base text-[#00ff66] truncate block">
                      +{formattedProfit}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleSaveSlip}
                      type="button"
                      className="py-2 px-2.5 sm:px-3.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-[#d9b114]/60 active:scale-98 text-white font-sans font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="Guardar este boleto en tu historial"
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00ff66] font-black" />
                          <span className="text-[#00ff66]">¡Guardado!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5 text-[#d9b114]" />
                          <span>Guardar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleShareWhatsApp}
                      type="button"
                      className="py-2 px-3 sm:px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-sans font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={handleCopySummary}
                      type="button"
                      className="py-2 px-2.5 sm:px-3 rounded-xl bg-[#161b22] hover:bg-[#21262d] active:scale-98 text-[#8b949e] hover:text-white font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-[#30363d]"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00ff66]" />
                          <span className="text-[#00ff66]">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#8b949e]" />
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
