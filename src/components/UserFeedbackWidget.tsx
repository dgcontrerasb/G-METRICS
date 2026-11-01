import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle2, Sparkles, Send } from 'lucide-react';
import { getOrCreateDeviceId } from '../services/licenseService';

export interface UserFeedbackWidgetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const FEEDBACK_SENT_KEY = 'gmetrics_feedback_sent_v1';
const FEEDBACK_DISMISSED_SESSION_KEY = 'gmetrics_feedback_dismissed_session';

const QUICK_CATEGORIES = [
  { id: 'ACIERTO', label: '🔥 Muy acertada' },
  { id: 'VELOCIDAD', label: '⚡ Rápida y fácil' },
  { id: 'SUGERENCIA', label: '💡 Sugerencia' },
  { id: 'SOPORTE', label: '🛠️ Reportar detalle' }
];

const RATING_LABELS: Record<number, string> = {
  1: 'Por mejorar',
  2: 'Regular',
  3: 'Buena herramienta',
  4: 'Muy buena',
  5: '¡Excelente plataforma!'
};

export const UserFeedbackWidget: React.FC<UserFeedbackWidgetProps> = ({
  isOpen,
  onOpen,
  onClose
}) => {
  const [showFloatingPrompt, setShowFloatingPrompt] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<string>('ACIERTO');
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Trigger inteligente no intrusivo: aparece tras 22 segundos de uso activo si no ha calificado antes
  useEffect(() => {
    try {
      const alreadySent = localStorage.getItem(FEEDBACK_SENT_KEY) === 'true';
      const dismissedSession = sessionStorage.getItem(FEEDBACK_DISMISSED_SESSION_KEY) === 'true';
      if (alreadySent || dismissedSession) return;
    } catch {
      return;
    }

    const timer = setTimeout(() => {
      setShowFloatingPrompt(true);
    }, 22000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismissPrompt = () => {
    setShowFloatingPrompt(false);
    try {
      sessionStorage.setItem(FEEDBACK_DISMISSED_SESSION_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleOpenModalFromPrompt = () => {
    setShowFloatingPrompt(false);
    try {
      sessionStorage.setItem(FEEDBACK_DISMISSED_SESSION_KEY, 'true');
    } catch {
      // ignore
    }
    onOpen();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    let username = 'usuario';
    let displayName = 'Usuario';
    try {
      const rawUser = localStorage.getItem('sportstats_auth_user');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed && typeof parsed === 'object') {
            username = parsed.username || parsed.email || 'usuario';
            displayName =
              parsed.displayName ||
              parsed.name ||
              localStorage.getItem('sportstats_client_name') ||
              username;
          } else {
            username = String(rawUser);
            displayName = localStorage.getItem('sportstats_client_name') || username;
          }
        } catch {
          username = rawUser;
          displayName = localStorage.getItem('sportstats_client_name') || username;
        }
      } else {
        const clientName = localStorage.getItem('sportstats_client_name');
        if (clientName) {
          username = clientName;
          displayName = clientName;
        }
      }
    } catch {
      // ignore
    }

    const categoryObj = QUICK_CATEGORIES.find((c) => c.id === category);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          displayName,
          rating,
          category: categoryObj ? categoryObj.label : category,
          comment: comment.trim().slice(0, 250),
          deviceId: getOrCreateDeviceId()
        })
      });

      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        try {
          localStorage.setItem(FEEDBACK_SENT_KEY, 'true');
          // Reclamar automáticamente bono de +1 día si no se ha reclamado
          fetch('/api/user/feedback-bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier: username })
          })
            .then((r) => r.json())
            .then((bonusData) => {
              if (bonusData.success && bonusData.newExpiresAt) {
                const rawUser = localStorage.getItem('sportstats_auth_user');
                if (rawUser) {
                  try {
                    const parsed = JSON.parse(rawUser);
                    parsed.expiresAt = bonusData.newExpiresAt;
                    parsed.feedbackBonusClaimed = true;
                    parsed.isPro = true;
                    localStorage.setItem('sportstats_auth_user', JSON.stringify(parsed));
                  } catch {
                    // ignore
                  }
                }
              }
            })
            .catch(() => {});
        } catch {
          // ignore
        }
        setSubmittedSuccess(true);
        setTimeout(() => {
          setSubmittedSuccess(false);
          setComment('');
          onClose();
        }, 2200);
      } else {
        setErrorMsg(data.error || 'No se pudo enviar tu calificación. Intenta de nuevo.');
      }
    } catch {
      setErrorMsg('Error de red al enviar tu comentario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. Notificación Micro-Cápsula Sutil y Compacta para invitar a calificar */}
      {showFloatingPrompt && !isOpen && (
        <div className="fixed bottom-16 sm:bottom-4 left-3 sm:left-4 z-40 max-w-[295px] sm:max-w-xs bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-full shadow-lg px-3 py-1.5 text-slate-800 animate-fadeIn flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleOpenModalFromPrompt}
            className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="text-[11px] font-bold text-slate-900 group-hover:text-emerald-700 transition block truncate">
                ¿Calificas G METRICS? (+1 Día Gratis)
              </span>
              <span className="text-[9.5px] text-emerald-600 font-semibold block truncate">
                Deja tu opinión y gana +1 día VIP ⭐
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleOpenModalFromPrompt}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[10px] transition cursor-pointer"
            >
              Calificar
            </button>
            <button
              type="button"
              onClick={handleDismissPrompt}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Más tarde"
              aria-label="Más tarde"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal Ligero de Calificación (1-5 Estrellas) y Buzón de Sugerencias */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md p-5 shadow-2xl relative text-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    Califica tu Experiencia · G METRICS
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Buzón privado de mejora continua para el Administrador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittedSuccess ? (
              <div className="py-6 text-center space-y-2 animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  ¡Gracias por tu calificación! 🎉
                </h4>
                <p className="text-xs text-emerald-600 font-semibold max-w-xs mx-auto">
                  ¡Se ha sumado +1 día adicional a tu prueba gratuita!
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">
                  Tu opinión nos ayuda a perfeccionar las métricas de la plataforma.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selector de Estrellas (1 a 5) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    1. ¿Cómo calificas el rendimiento de la página?
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1.5 rounded-xl hover:bg-amber-50 transition transform active:scale-90 cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 transition ${
                              active
                                ? 'text-amber-400 fill-amber-400 drop-shadow-2xs'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                    {RATING_LABELS[hoverRating || rating]} ({hoverRating || rating}/5 ⭐)
                  </span>
                </div>

                {/* Etiquetas Rápidas */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    2. Aspecto principal:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border text-left transition cursor-pointer ${
                          category === cat.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentario o Sugerencia */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      3. Tu comentario o sugerencia (Opcional):
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {comment.length}/250
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={250}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escribe qué te gusta más o qué función te gustaría ver en G METRICS..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition resize-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Enviando...' : 'Enviar Calificación'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
