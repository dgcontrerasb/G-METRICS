import React from 'react';
import { Lock, Sparkles } from 'lucide-react';

interface ProGateProps {
  isPro?: boolean;
  onOpenVipModal?: () => void;
  featureName?: string;
  children: React.ReactNode;
  className?: string;
}

export const ProGate: React.FC<ProGateProps> = ({
  isPro,
  onOpenVipModal,
  featureName = 'Contenido VIP',
  children,
  className = ''
}) => {
  const userIsPro = isPro !== undefined ? isPro : (() => {
    try {
      const raw = localStorage.getItem('sportstats_auth_user');
      if (!raw) return false;
      const u = JSON.parse(raw);
      if (u.role === 'admin') return true;
      if (u.expiresAt === null) return true;
      return Boolean(u.expiresAt && Number(u.expiresAt) > Date.now());
    } catch {
      return false;
    }
  })();

  if (userIsPro) {
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
    <div className={`relative overflow-hidden rounded-2xl group ${className}`}>
      {/* Contenido censurado con desenfoque suave y sin interacción */}
      <div className="filter blur-md select-none pointer-events-none opacity-30 transition-all duration-300">
        {children}
      </div>

      {/* Capa de bloqueo y botón de activación */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[3px] text-center">
        <div className="bg-white/95 border border-slate-200/90 shadow-xl rounded-2xl p-5 max-w-xs w-full flex flex-col items-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs mb-2">
            <Lock className="w-5 h-5 stroke-[2.5]" />
          </div>
          
          <h4 className="text-slate-900 font-extrabold text-sm tracking-tight mb-1">
            {featureName} Bloqueado
          </h4>
          
          <p className="text-slate-500 text-xs max-w-xs mb-3 leading-relaxed">
            Disponible en tu prueba gratuita de 3 días o activando tu Plan VIP ($9.900 COP / mes).
          </p>

          <button
            type="button"
            onClick={handleOpen}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Desbloquear Acceso VIP
          </button>
        </div>
      </div>
    </div>
  );
};
