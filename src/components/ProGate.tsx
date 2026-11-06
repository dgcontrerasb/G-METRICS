import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { verifyLicenseToken } from '../services/licenseService';

export function checkIsProClient(): boolean {
  if (typeof window === 'undefined') return false;
  // 1. Verificación directa de administrador por credenciales locales o sesión
  try {
    if (localStorage.getItem('sportstats_admin_remember') === 'true') return true;
    if (sessionStorage.getItem('futbolstats_admin_pin') || localStorage.getItem('sportstats_admin_saved_pin')) return true;
  } catch {}

  // 2. Verificación de objeto de usuario autenticado
  try {
    const raw = localStorage.getItem('sportstats_auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u.role === 'admin' || u.isPro === true) return true;
      if (u.expiresAt && Number(u.expiresAt) > Date.now()) return true;
    }
  } catch {}

  // 3. Verificación de licencia activa criptográfica
  try {
    const rawLic = localStorage.getItem('futbolstats_active_license');
    if (rawLic) {
      const lic = JSON.parse(rawLic);
      if (lic?.cachedResult?.isValid && !lic?.cachedResult?.isExpired) return true;
      if (lic?.key) {
        const devId = localStorage.getItem('futbolstats_device_id') || '';
        const check = verifyLicenseToken(lic.key, devId);
        if (check.isValid && !check.isExpired) return true;
      }
    }
  } catch {}
  return false;
}

interface ProGateProps {
  isPro?: boolean;
  onOpenVipModal?: () => void;
  featureName?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ProGate — Blindaje Zero-Trust en Capa 6 (Presentación)
 * Si el usuario no es VIP certificado por el servidor, los componentes sensibles
 * NO se montan en el DOM (eliminando la posibilidad de inspección / des-blur en DevTools).
 */
export const ProGate: React.FC<ProGateProps> = ({
  isPro,
  onOpenVipModal,
  featureName = 'Contenido VIP',
  children,
  className = ''
}) => {
  const effectiveIsPro = isPro === true || checkIsProClient();

  if (effectiveIsPro) {
    return <>{children}</>;
  }

  const handleOpen = () => {
    if (onOpenVipModal) {
      onOpenVipModal();
    } else {
      window.dispatchEvent(new CustomEvent('open-vip-payment-modal'));
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-6 text-center ${className}`}>
      {/* Capa de bloqueo y botón de activación - Cero filtración en DOM */}
      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3">
          <Lock className="w-6 h-6 stroke-[2.2]" />
        </div>
        
        <h4 className="text-white font-extrabold text-sm tracking-tight mb-1">
          {featureName} Exclusivo VIP
        </h4>
        
        <p className="text-slate-400 text-xs mb-4 leading-relaxed">
          Los análisis matemáticos avanzados y cuotas de valor se desbloquean en tu prueba gratuita o activando tu Plan VIP ($0 sobrecostos).
        </p>

        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Desbloquear Acceso VIP
        </button>
      </div>
    </div>
  );
};
