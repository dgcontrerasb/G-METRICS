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

  const isFreeMode = typeof window !== 'undefined'
    ? localStorage.getItem('gmetrics_free_access_mode') !== 'false'
    : true;

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
        <div className="fixed bottom-16 sm:bottom-5 left-3 sm:left-5 z-40 max-w-[340px] sm:max-w-sm bg-[#161b22]/95 backdrop-blur-md border border-[#30363d] rounded-2xl shadow-2xl px-3 py-2 text-white animate-fadeIn flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleOpenModalFromPrompt}
            className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
          >
            <span className="w-8 h-8 rounded-xl bg-[#d9b114]/10 border border-[#d9b114]/30 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <Star className="w-4 h-4 text-[#d9b114] fill-[#d9b114]" />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="text-xs font-black text-white group-hover:text-[#d9b114] transition block">
                ¿Te gusta G-METRICS?
              </span>
              <span className="text-[11px] text-[#00ff66] font-semibold block mt-0.5">
                {isFreeMode ? 'Tu opinión nos ayuda a mejorar ⭐' : 'Califica y gana +1 día VIP gratis ⭐'}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenModalFromPrompt}
              className="px-3 py-1.5 rounded-xl bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-black text-xs transition shadow-md cursor-pointer active:scale-95"
            >
              Opinar
            </button>
            <button
              type="button"
              onClick={handleDismissPrompt}
              className="p-1 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#0b0e14] transition cursor-pointer"
              title="Cerrar aviso"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal Ligero de Calificación (1-5 Estrellas) y Buzón de Sugerencias */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 shadow-2xl relative text-white space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#d9b114]/10 border border-[#d9b114]/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#d9b114]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                    Califica tu Experiencia · G METRICS
                  </h3>
                  <p className="text-[11px] text-[#8b949e]">
                    Buzón privado de mejora continua para el Administrador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-[#0b0e14] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition cursor-pointer border border-[#30363d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittedSuccess ? (
              <div className="py-6 text-center space-y-2 animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-[#00ff66]" />
                </div>
                <h4 className="text-sm font-black text-white">
                  ¡Gracias por tu calificación! 🎉
                </h4>
                {!isFreeMode && (
                  <p className="text-xs text-[#00ff66] font-semibold max-w-xs mx-auto">
                    ¡Se ha sumado +1 día adicional a tu prueba gratuita!
                  </p>
                )}
                <p className="text-[11px] text-[#8b949e] max-w-xs mx-auto mt-0.5">
                  Tu opinión nos ayuda a perfeccionar las métricas de la plataforma.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selector de Estrellas (1 a 5) */}
                <div className="bg-[#0b0e14] border border-[#30363d] rounded-2xl p-3.5 text-center space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b949e] block">
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
                          className="p-1.5 rounded-xl hover:bg-[#161b22] transition transform active:scale-90 cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 transition ${
                              active
                                ? 'text-[#d9b114] fill-[#d9b114] drop-shadow-sm'
                                : 'text-[#30363d]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#d9b114]/10 border border-[#d9b114]/30 text-[#d9b114] text-[11px] font-bold">
                    {RATING_LABELS[hoverRating || rating]} ({hoverRating || rating}/5 ⭐)
                  </span>
                </div>

                {/* Etiquetas Rápidas */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b949e]">
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
                            ? 'bg-[#d9b114] text-black font-black border-[#d9b114] shadow-md'
                            : 'bg-[#0b0e14] hover:bg-[#161b22] text-[#8b949e] hover:text-white border-[#30363d]'
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
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b949e]">
                      3. Tu comentario o sugerencia (Opcional):
                    </label>
                    <span className="text-[10px] font-mono text-[#8b949e]">
                      {comment.length}/250
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={250}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escribe qué te gusta más o qué función te gustaría ver en G METRICS..."
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl p-2.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114] transition resize-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl bg-[#0b0e14] hover:bg-[#30363d] text-[#8b949e] hover:text-white font-semibold text-xs transition cursor-pointer border border-[#30363d]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-black" />
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
