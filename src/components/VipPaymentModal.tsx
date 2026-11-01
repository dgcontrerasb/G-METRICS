import React, { useState } from 'react';
import {
  X,
  Check,
  Copy,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Zap,
  Gift,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface VipPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  userName?: string | null;
  daysRemaining?: number | null;
  isExpired?: boolean;
  onCodeRedeemed?: (newExpiresAt: number) => void;
}

export const VipPaymentModal: React.FC<VipPaymentModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  daysRemaining,
  isExpired,
  onCodeRedeemed
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const currentEmail = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('sportstats_auth_user') || '{}');
      if (u.email) return u.email;
      if (u.username) return u.username;
    } catch {
      // ignore
    }
    return userEmail || '';
  })();

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = activationCode.trim().toUpperCase();
    if (!cleanCode) {
      setRedeemFeedback({ type: 'error', message: 'Por favor ingresa un código de activación.' });
      return;
    }

    setIsRedeeming(true);
    setRedeemFeedback(null);

    try {
      const res = await fetch('/api/user/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          userIdentifier: currentEmail
        })
      });

      const data = await res.json();
      if (data.success) {
        setRedeemFeedback({ type: 'success', message: data.message || '¡Código canjeado con éxito!' });
        setActivationCode('');

        // Actualizar almacenamiento local
        try {
          const raw = localStorage.getItem('sportstats_auth_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.expiresAt = data.newExpiresAt;
            parsed.isPro = true;
            parsed.status = 'active';
            parsed.planLabel = 'Plan VIP (30 Días)';
            localStorage.setItem('sportstats_auth_user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }

        if (onCodeRedeemed && data.newExpiresAt) {
          onCodeRedeemed(data.newExpiresAt);
        }

        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1800);
      } else {
        setRedeemFeedback({ type: 'error', message: data.message || 'Código inválido o ya utilizado.' });
      }
    } catch {
      setRedeemFeedback({ type: 'error', message: 'Error de conexión al canjear el código.' });
    } finally {
      setIsRedeeming(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `¡Hola! Ya realicé la transferencia para mi Plan Mensual de G-METRICS ($9.900 COP / $3.50 USD).\n\n📧 Correo registrado: ${currentEmail || 'Mi correo registrado'}\n📎 Adjunto el comprobante en este chat para recibir mi código de activación.`
  );
  const whatsappUrl = `https://wa.me/573213902708?text=${whatsappMessage}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in overflow-y-auto font-sans">
      <div className="relative w-full max-w-lg my-auto rounded-3xl bg-white/98 border border-slate-200/90 shadow-2xl p-4 sm:p-6 text-slate-800 flex flex-col gap-3.5">
        
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Encabezado */}
        <div className="text-center flex flex-col items-center gap-1 pt-0.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold tracking-wide">
            <Sparkles className="w-3 h-3 text-emerald-600" /> PLAN VIP G-METRICS
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Desbloquea Todas las Métricas VIP
          </h2>
          <p className="text-slate-500 text-xs max-w-sm leading-snug">
            Pronósticos cuantitativos, métricas avanzadas y telemetría de jugadores en tiempo real.
          </p>

          <div className="mt-1 inline-flex items-baseline gap-1.5 bg-emerald-50/70 border border-emerald-200/90 rounded-xl px-3.5 py-1">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">$9.900 COP</span>
            <span className="text-slate-500 text-xs font-semibold">/ mes (~$3.50 USD)</span>
          </div>
        </div>

        {/* Canjear Código si ya lo tiene */}
        <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
            <Gift className="w-3.5 h-3.5 text-emerald-600" />
            <span>¿Ya tienes un código de activación?</span>
          </div>
          <form onSubmit={handleRedeemSubmit} className="flex flex-col sm:flex-row gap-1.5">
            <input
              type="text"
              placeholder="Ej: VIP-8K2F-30D"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors uppercase font-mono shadow-2xs"
            />
            <button
              type="submit"
              disabled={isRedeeming || !activationCode.trim()}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-98 shrink-0"
            >
              {isRedeeming ? 'Validando...' : 'Canjear'}
            </button>
          </form>

          {redeemFeedback && (
            <div
              className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 font-medium ${
                redeemFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>{redeemFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Medios de Pago en Fila Completa (Sin recortes) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Medios de Pago Disponibles:
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Transferencia 0% comisión
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* 1. Nequi */}
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 transition-all shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 mr-2">
                <div className="h-7 w-20 px-1 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                  <img
                    src="/payments/nequi.png"
                    onError={(e) => { e.currentTarget.src = '/payments/nequi.svg'; }}
                    alt="Nequi"
                    className="max-h-4.5 max-w-full object-contain"
                    title="Nequi Colombia"
                  />
                </div>
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Nequi:</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono tracking-wider select-all">3213902708</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('3213902708', 'nequi')}
                className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                title="Copiar número Nequi"
              >
                {copiedKey === 'nequi' ? <Check className="w-3.5 h-3.5 text-emerald-600 hover:text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'nequi' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* 2. Daviplata */}
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 transition-all shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 mr-2">
                <div className="h-7 w-20 px-1 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                  <img
                    src="/payments/daviplata.png"
                    onError={(e) => { e.currentTarget.src = '/payments/daviplata.svg'; }}
                    alt="Daviplata"
                    className="max-h-6 max-w-full object-contain scale-105"
                    title="Daviplata"
                  />
                </div>
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Daviplata:</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono tracking-wider select-all">3213902708</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('3213902708', 'daviplata')}
                className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                title="Copiar número Daviplata"
              >
                {copiedKey === 'daviplata' ? <Check className="w-3.5 h-3.5 text-emerald-600 hover:text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'daviplata' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* 3. Llave Bre-B (Banco de la República) */}
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 transition-all shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 mr-2">
                <div className="h-7 w-20 px-0.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src="/payments/breb.png"
                    onError={(e) => { e.currentTarget.src = '/payments/breb.svg'; }}
                    alt="Llave Bre-B"
                    className="max-h-6 max-w-full object-contain rounded-md"
                    title="Bre-B (Banco de la República)"
                  />
                </div>
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Llave Bre-B:</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono tracking-wider select-all">@3213902708</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('@3213902708', 'llave')}
                className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                title="Copiar llave Bre-B"
              >
                {copiedKey === 'llave' ? <Check className="w-3.5 h-3.5 text-emerald-600 hover:text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'llave' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* 4. PayPal (Internacional) */}
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 transition-all shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 mr-2">
                <div className="h-7 w-20 px-1 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                  <img
                    src="/payments/paypal.png"
                    onError={(e) => { e.currentTarget.src = '/payments/paypal.svg'; }}
                    alt="PayPal"
                    className="max-h-4.5 max-w-full object-contain"
                    title="PayPal Internacional"
                  />
                </div>
                <div className="min-w-0 flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">PayPal:</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono truncate select-all">dgcontrerasb@gmail.com</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('dgcontrerasb@gmail.com', 'paypal')}
                className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 transition-all text-[11px] flex items-center gap-1 font-semibold shrink-0 cursor-pointer shadow-2xs"
                title="Copiar correo PayPal"
              >
                {copiedKey === 'paypal' ? <Check className="w-3.5 h-3.5 text-emerald-600 hover:text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'paypal' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Paso a paso y CTA WhatsApp */}
        <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              ✓
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Transfiere <strong className="text-slate-900">$9.900 COP</strong> o <strong className="text-slate-900">$3.50 USD</strong>, envía la captura del comprobante por WhatsApp y recibe tu código de activación inmediato.
            </p>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm tracking-wide text-center flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            Enviar Comprobante por WhatsApp
          </a>
        </div>

        <p className="text-[10px] text-slate-400 text-center font-medium">
          Activación en pocos minutos tras confirmar comprobante.
        </p>

      </div>
    </div>
  );
};
