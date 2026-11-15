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

  const isFreeMode = typeof window !== 'undefined'
    ? localStorage.getItem('gmetrics_free_access_mode') !== 'false'
    : true;

  if (!isOpen || isFreeMode) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto font-sans">
      {/* Backdrop blur independiente (fondo visible y difuminado) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      <div className="relative z-10 w-full max-w-xl my-auto rounded-3xl bg-[#161b22] border border-[#30363d] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-white animate-in zoom-in-95 duration-200">
        {/* Cabecera Bento Blanca */}
        <div className="bg-[#0b0e14] border-b border-[#30363d] px-4 sm:px-6 pt-5 pb-4 text-center flex flex-col items-center gap-1.5 relative shrink-0">
          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-[#161b22] text-[#8b949e] hover:text-white hover:bg-[#1c2129] border border-[#30363d] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="bento-pill-emerald inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase">
            <Sparkles className="w-3 h-3 text-emerald-600" /> PLAN VIP G-METRICS
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
            Desbloquea Todas las Métricas VIP
          </h2>
          <p className="text-[#8b949e] text-[11px] sm:text-xs max-w-sm leading-snug">
            Pronósticos cuantitativos, métricas avanzadas y telemetría de jugadores en tiempo real.
          </p>

          <div className="mt-1 bento-card-gold inline-flex items-baseline gap-1.5 rounded-2xl px-4 py-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-[#d9b114] tracking-tight">
              $9.900 COP
            </span>
            <span className="text-[#8b949e] text-xs font-semibold">/ mes (~$3.50 USD)</span>
          </div>
        </div>

        {/* Cuerpo Scrollable Bento */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 bg-[#0b0e14]/70">
          {/* Paso 1: Canjear Código si ya lo tiene */}
          <div className="bento-card-gold rounded-2xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Gift className="w-4 h-4 text-amber-600 shrink-0" />
                <span>¿Ya tienes un código de activación?</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-800 uppercase hidden sm:inline">
                Canje Inmediato
              </span>
            </div>
            <form onSubmit={handleRedeemSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Ej: VIP-8K2F-30D"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 rounded-xl bg-[#0b0e14] border border-[#30363d] text-white placeholder-[#8b949e] text-xs focus:outline-none focus:border-[#d9b114] transition-colors uppercase font-mono shadow-2xs"
              />
              <button
                type="submit"
                disabled={isRedeeming || !activationCode.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 shrink-0"
              >
                {isRedeeming ? 'Validando...' : 'Canjear Código'}
              </button>
            </form>

            {redeemFeedback && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 font-medium ${
                  redeemFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{redeemFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Paso 2: Medios de Pago en Grilla Bento 2x2 (PC) / 1 Columna (Móvil) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Medios de Pago Disponibles:
              </span>
              <span className="bento-pill-emerald px-2 py-0.5 rounded-full text-[10px] font-bold">
                0% comisión
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Nequi */}
              <div className="bg-[#0b0e14] border border-[#30363d] rounded-2xl p-3 flex flex-col justify-between gap-2.5 hover:border-[#d9b114]/50 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-7 px-2 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
                    <img
                      src="/payments/nequi.png"
                      onError={(e) => { e.currentTarget.src = '/payments/nequi.svg'; }}
                      alt="Nequi"
                      className="max-h-4.5 max-w-16 object-contain"
                      title="Nequi Colombia"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">
                    Nequi
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#30363d]">
                  <span className="text-xs sm:text-sm font-bold text-white font-mono tabular-nums tracking-wider select-all truncate">
                    3213902708
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('3213902708', 'nequi')}
                    className="h-7 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] hover:border-[#d9b114]/50 text-white border border-[#30363d] transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                    title="Copiar número Nequi"
                  >
                    {copiedKey === 'nequi' ? <Check className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
                    <span className={copiedKey === 'nequi' ? 'text-[#00ff66]' : 'text-white'}>{copiedKey === 'nequi' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Daviplata */}
              <div className="bg-[#0b0e14] border border-[#30363d] rounded-2xl p-3 flex flex-col justify-between gap-2.5 hover:border-[#d9b114]/50 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-7 px-2 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
                    <img
                      src="/payments/daviplata.png"
                      onError={(e) => { e.currentTarget.src = '/payments/daviplata.svg'; }}
                      alt="Daviplata"
                      className="max-h-5.5 max-w-18 object-contain scale-105"
                      title="Daviplata"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">
                    Daviplata
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#30363d]">
                  <span className="text-xs sm:text-sm font-bold text-white font-mono tabular-nums tracking-wider select-all truncate">
                    3213902708
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('3213902708', 'daviplata')}
                    className="h-7 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] hover:border-[#d9b114]/50 text-white border border-[#30363d] transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                    title="Copiar número Daviplata"
                  >
                    {copiedKey === 'daviplata' ? <Check className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
                    <span className={copiedKey === 'daviplata' ? 'text-[#00ff66]' : 'text-white'}>{copiedKey === 'daviplata' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Llave Bre-B (Banco de la República) */}
              <div className="bg-[#0b0e14] border border-[#30363d] rounded-2xl p-3 flex flex-col justify-between gap-2.5 hover:border-[#d9b114]/50 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-7 px-1.5 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src="/payments/breb.png"
                      onError={(e) => { e.currentTarget.src = '/payments/breb.svg'; }}
                      alt="Llave Bre-B"
                      className="max-h-5.5 max-w-18 object-contain rounded-md"
                      title="Bre-B (Banco de la República)"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">
                    Llave Bre-B
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#30363d]">
                  <span className="text-xs sm:text-sm font-bold text-white font-mono tabular-nums tracking-wider select-all truncate">
                    @3213902708
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('@3213902708', 'llave')}
                    className="h-7 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] hover:border-[#d9b114]/50 text-white border border-[#30363d] transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer shadow-2xs shrink-0"
                    title="Copiar llave Bre-B"
                  >
                    {copiedKey === 'llave' ? <Check className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
                    <span className={copiedKey === 'llave' ? 'text-[#00ff66]' : 'text-white'}>{copiedKey === 'llave' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 4. PayPal (Internacional) */}
              <div className="bg-[#0b0e14] border border-[#30363d] rounded-2xl p-3 flex flex-col justify-between gap-2.5 hover:border-[#d9b114]/50 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-7 px-2 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
                    <img
                      src="/payments/paypal.png"
                      onError={(e) => { e.currentTarget.src = '/payments/paypal.svg'; }}
                      alt="PayPal"
                      className="max-h-4.5 max-w-18 object-contain"
                      title="PayPal Internacional"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">
                    PayPal
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#30363d]">
                  <span className="text-[11px] sm:text-xs font-bold text-white font-mono tabular-nums truncate select-all">
                    dgcontrerasb@gmail.com
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('dgcontrerasb@gmail.com', 'paypal')}
                    className="h-7 px-2.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] hover:border-[#d9b114]/50 text-white border border-[#30363d] transition-all text-[11px] flex items-center gap-1 font-semibold shrink-0 cursor-pointer shadow-2xs"
                    title="Copiar correo PayPal"
                  >
                    {copiedKey === 'paypal' ? <Check className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
                    <span className={copiedKey === 'paypal' ? 'text-[#00ff66]' : 'text-white'}>{copiedKey === 'paypal' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Paso 3: CTA WhatsApp + Garantía Bento */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-2">
              <div className="w-4.5 h-4.5 rounded-full bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                ✓
              </div>
              <p className="text-[11px] text-[#8b949e] leading-snug">
                Transfiere <strong className="text-white font-mono tabular-nums">$9.900 COP</strong> o <strong className="text-white font-mono tabular-nums">$3.50 USD</strong>, envía la captura del comprobante por WhatsApp y recibe tu código de activación inmediato.
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

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 border-t border-[#30363d] text-[10px] text-[#8b949e] font-medium">
              <span>⚡ Activación inmediata</span>
              <span>•</span>
              <span>🔒 1 Dispositivo Activo (1/1)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
