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

  // Los parlays están en fase Beta cerrada: solo disponibles para administradores
  if (!isAdminBeta) {
    return null;
  }

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
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-sans text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
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
          className="fixed bottom-18 right-3.5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-white hover:bg-slate-50 border border-emerald-400 shadow-[0_8px_30px_rgba(16,185,129,0.28)] text-slate-900 transition-all duration-200 active:scale-95 cursor-pointer"
        >
          {/* Badge count */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white font-mono font-black text-xs shadow-xs">
            <Ticket className="w-4 h-4 text-white" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-950 ring-2 ring-white">
              {picks.length}
            </span>
          </div>

          {/* Quick Odds & Profit preview */}
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider font-sans">Boleto</span>
              <span className="text-xs font-black font-mono text-emerald-700">{totalOdds.toFixed(2)}x</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5">
              +{formattedProfit}
            </span>
          </div>

          <ChevronUp className="w-4 h-4 text-emerald-600 group-hover:-translate-y-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Slide-Up Drawer / Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop Blur */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Modal / Sheet Container */}
          <div
            className="relative w-full sm:max-w-lg bg-white border-t sm:border border-slate-200 sm:rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.22)] flex flex-col h-[88vh] sm:h-auto sm:max-h-[85vh] z-10 animate-in slide-in-from-bottom duration-250 overflow-hidden text-slate-800"
          >
            {/* Mobile Pull Handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 bg-white shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans font-bold text-xs sm:text-sm text-slate-900 truncate">Boleto Combinado</h3>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[10px] font-bold shrink-0">
                      {picks.length} {picks.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans truncate hidden sm:block">
                    Multiplica cuotas y calcula probabilidad matemática
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenHistory && (
                  <button
                    onClick={onOpenHistory}
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] font-sans font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200"
                    title="Ver historial de boletos guardados"
                  >
                    <History className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Historial</span>
                  </button>
                )}
                {picks.length > 0 && (
                  <button
                    onClick={clearParlay}
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] font-sans text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Vaciar boleto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  type="button"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Cerrar boleto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Dismissible Odds Transparency Warning */}
            {showDisclaimer && (
              <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] sm:text-[11px] text-amber-900 leading-tight truncate">
                    <strong>Cuotas estimadas:</strong> Pulsa <strong className="font-mono">✎</strong> en cada línea para calibrar con tu casa.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  type="button"
                  className="p-1 rounded text-amber-700 hover:text-amber-950 hover:bg-amber-100 transition-colors shrink-0"
                  aria-label="Cerrar aviso"
                  title="Ocultar aviso"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Slip Body (High-Priority Scrollable Picks List) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3.5 space-y-2 custom-scrollbar bg-slate-50/70">
              {picks.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                    <Ticket className="w-7 h-7" />
                  </div>
                  <h4 className="font-sans font-semibold text-slate-800 text-sm mb-1">
                    Tu boleto está vacío
                  </h4>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
                    Toca el botón <span className="text-emerald-700 font-semibold font-mono">🎫 +</span> en cualquier partido de Fútbol o NBA para armar tu apuesta combinada.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                  >
                    Explorar Partidos
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 pb-0.5 text-[10px] font-sans text-slate-500">
                    <span className="font-semibold">Líneas seleccionadas ({picks.length})</span>
                    <span>Toca ✎ para editar cuota</span>
                  </div>

                  {picks.map((pick, idx) => {
                    const isEditing = editingPickId === pick.id;
                    const isOddModified = pick.userOdd !== pick.referenceOdd;

                    return (
                      <div
                        key={pick.id}
                        className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-2xs"
                      >
                        {/* Row 1: Index + Sport + Match Title + Remove */}
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-mono font-bold text-slate-700 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs shrink-0">
                              {pick.sport === 'NBA' ? '🏀' : '⚽'}
                            </span>
                            <span className="font-sans font-semibold text-xs text-slate-900 truncate">
                              {pick.matchTitle}
                            </span>
                          </div>

                          <button
                            onClick={() => removePick(pick.id)}
                            type="button"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                            title="Eliminar selección"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Row 2: Selection Label + Probability + Odd button */}
                        <div className="flex items-center justify-between gap-2 pl-5.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-sans font-bold text-xs text-emerald-700 truncate">
                              {pick.selectionLabel}
                            </span>
                            {pick.isEV && (
                              <span className="px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-mono text-[9px] font-bold border border-amber-200 shrink-0">
                                +EV
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
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
                                  className="w-14 px-1 py-0.5 rounded bg-white border border-emerald-500 text-right font-mono font-bold text-xs text-emerald-700 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveEditOdd(pick.id)}
                                  type="button"
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
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
                                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
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
                                    className="text-[9px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
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
                      className={`mt-2 p-2.5 rounded-xl border space-y-1.5 ${
                        adminStressEval.stressTest.trafficLight === 'GREEN'
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : adminStressEval.stressTest.trafficLight === 'YELLOW'
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-rose-50/70 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-800">
                            Beta Admin · Fair Odds &amp; Estrés
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-amber-900 font-bold">
                            Fair Mín: @{adminStressEval.combinedFairMinOdd.toFixed(2)}x+
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-bold">
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
                      <div className="p-2 rounded-lg bg-white border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-[10.5px] font-semibold text-slate-800 leading-snug">
                          {picks.length >= 3
                            ? '💡 "Consejo G METRICS: Tu ticket tiene un riesgo elevado. Si quitas las 2 selecciones más difíciles, tu probabilidad de ganar aumenta un 40%."'
                            : adminStressEval.stressTest.gMetricsAdvice}
                        </p>
                        {picks.length >= 3 && (
                          <button
                            type="button"
                            onClick={handleTrimHardestTwoPicks}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-extrabold text-[10px] transition-colors cursor-pointer"
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

            {/* Streamlined Docked Footer / Results */}
            {picks.length > 0 && (
              <div className="bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] shrink-0 z-20">
                {/* 1. Sleek Key Metrics Bar */}
                <div className="px-3 py-1.5 sm:py-2 border-b border-slate-200 flex items-center justify-between gap-1.5 bg-slate-50">
                  <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
                    {/* Total Odds */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">Cuota:</span>
                      <span className="font-mono font-black text-sm sm:text-base text-emerald-700">
                        {totalOdds.toFixed(2)}x
                      </span>
                    </div>

                    <div className="w-px h-3 bg-slate-300 shrink-0" />

                    {/* Joint Probability */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">Prob:</span>
                      <span className="font-mono font-bold text-xs text-indigo-700">
                        {jointProbability}%
                      </span>
                    </div>

                    <div className="w-px h-3 bg-slate-300 shrink-0" />

                    {/* Risk Traffic Light Badge */}
                    <div className="px-1.5 py-0.2 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0 bg-white border border-slate-200 text-slate-800">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: riskLevel.dotColor }} />
                      <span>{riskLevel.label}</span>
                    </div>
                  </div>

                  {/* Toggle Calculator / Stake Details */}
                  <button
                    onClick={() => setIsCalculatorExpanded(!isCalculatorExpanded)}
                    type="button"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-sans font-semibold border border-slate-200 transition-colors shrink-0 cursor-pointer"
                    title={isCalculatorExpanded ? "Plegar opciones de stake" : "Desplegar opciones de stake"}
                  >
                    <span>Stake: {formattedStake}</span>
                    <ChevronUp className={`w-3.5 h-3.5 text-emerald-600 transition-transform duration-200 ${isCalculatorExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* 2. Expandable Stake Adjuster & Return Breakdown */}
                {isCalculatorExpanded && (
                  <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 space-y-2 animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-sans text-slate-700 font-medium">
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
                          className="w-28 pl-6 pr-2 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-xs text-slate-900 text-right focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Quick Stake Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        onClick={() => handleQuickStakeSet(10000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $10K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(20000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $20K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(50000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $50K
                      </button>
                      <button
                        onClick={() => handleQuickStakeSet(100000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        $100K
                      </button>
                      <button
                        onClick={() => handleQuickStakeAdd(10000)}
                        type="button"
                        className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        +$10K
                      </button>
                    </div>

                    {/* Profit breakdown */}
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Retorno Bruto:</span>
                        <span className="font-mono font-bold text-slate-800">{formattedPayout}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Ganancia Neta:</span>
                        <span className="font-mono font-black text-sm text-emerald-700">+{formattedProfit}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Action Bar (Ultra-compact, side-by-side) */}
                <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2 bg-white">
                  {/* Net profit preview */}
                  <div className="min-w-0 pr-1 leading-tight">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Ganas:</span>
                    <span className="font-mono font-black text-sm sm:text-base text-emerald-700 truncate block">
                      +{formattedProfit}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleSaveSlip}
                      type="button"
                      className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
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
                      className="py-1.5 sm:py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-sans font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={handleCopySummary}
                      type="button"
                      className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
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
