import React, { useState } from 'react';
import {
  Shield,
  Check,
  Copy,
  MessageCircle,
  Database,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface AdminSecurityTabProps {
  activeServerPin: string;
  setActiveServerPin: React.Dispatch<React.SetStateAction<string>>;
  pinInput: string;
  setPinInput: React.Dispatch<React.SetStateAction<string>>;
  adminWhatsApp: string;
  setAdminWhatsApp: React.Dispatch<React.SetStateAction<string>>;
  freeAccessMode?: boolean;
  setFreeAccessMode?: React.Dispatch<React.SetStateAction<boolean>>;
  supabaseConfigured: boolean;
  supabaseProject: string | null;
  supabaseSqlSchema: string | null;
  buildAdminHeaders: (pin?: string, includeJson?: boolean, idempotent?: boolean) => Record<string, string>;
}

export const AdminSecurityTab: React.FC<AdminSecurityTabProps> = ({
  adminWhatsApp,
  setAdminWhatsApp,
  freeAccessMode = true,
  setFreeAccessMode,
  supabaseConfigured,
  supabaseProject,
  supabaseSqlSchema,
  buildAdminHeaders
}) => {
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [isTogglingFreeMode, setIsTogglingFreeMode] = useState(false);

  const handleToggleFreeAccessMode = async () => {
    const nextMode = !freeAccessMode;
    setIsTogglingFreeMode(true);
    setConfigSuccess(null);
    setConfigError(null);
    try {
      const res = await fetch('/api/license/config', {
        method: 'POST',
        headers: buildAdminHeaders('', true, true),
        body: JSON.stringify({
          freeAccessMode: nextMode
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('gmetrics_free_access_mode', String(nextMode));
        if (setFreeAccessMode) setFreeAccessMode(nextMode);
        setConfigSuccess(
          nextMode
            ? '¡Modo Acceso Libre ACTIVADO! Cualquier usuario con cuenta Google tiene acceso Pro ilimitado sin pagos ni conteo de días.'
            : '¡Modo Acceso Libre DESACTIVADO! Todos los usuarios promocionales vuelven inmediatamente al bloqueo VIP normal.'
        );
        setTimeout(() => setConfigSuccess(null), 6000);
      } else {
        setConfigError(data.error || 'No se pudo actualizar el modo de acceso.');
      }
    } catch {
      setConfigError('Error de red al actualizar el modo de acceso.');
    } finally {
      setIsTogglingFreeMode(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    setConfigError(null);

    try {
      const res = await fetch('/api/license/config', {
        method: 'POST',
        headers: buildAdminHeaders('', true, true),
        body: JSON.stringify({
          adminWhatsApp: adminWhatsApp.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setConfigSuccess('¡WhatsApp de contacto actualizado con éxito!');
        setTimeout(() => setConfigSuccess(null), 5000);
      } else {
        setConfigError(data.error || 'Error al guardar configuración');
      }
    } catch {
      setConfigError('Error de conexión con el servidor.');
    }
  };

  return (
    <div className="space-y-4 font-sans text-white">
      {/* Estado de Seguridad Google OAuth */}
      <div className="p-4 rounded-2xl bg-[#0b0e14] border border-emerald-500/30 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#d9b114]" />
            <span>Autenticación de Administrador</span>
          </h4>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-[#00ff66]">
            Google OAuth Exclusivo
          </span>
        </div>
        <p className="text-xs text-[#8b949e]">
          El acceso al Panel de Administrador está blindado exclusivamente mediante sesión criptográfica verificada con tu cuenta de Google autorizada. El acceso por PIN y llaves maestras ha sido eliminado permanentemente.
        </p>
      </div>

      {/* MODO ACCESO LIBRE (COMUNIDAD / APERTURA TOTAL) */}
      <div className={`p-4 rounded-2xl border transition-all ${
        freeAccessMode
          ? 'bg-[#0b0e14] border-emerald-500/40 shadow-xs'
          : 'bg-[#0b0e14] border-[#30363d]'
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${freeAccessMode ? 'bg-emerald-500/20 text-[#00ff66]' : 'bg-[#161b22] text-[#8b949e]'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Modo Acceso Libre (Comunidad)
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  freeAccessMode
                    ? 'bg-emerald-500/20 text-[#00ff66] border-emerald-500/40'
                    : 'bg-[#161b22] text-[#8b949e] border-[#30363d]'
                }`}>
                  {freeAccessMode ? 'ACTIVO (100% LIBRE)' : 'DESACTIVADO (PAGO VIP)'}
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] mt-0.5 max-w-xl">
                {freeAccessMode
                  ? '✨ Cualquier usuario que inicie sesión con su cuenta Google (Gmail) tiene acceso Pro completo e ilimitado. Se suspenden pagos y conteos de 3 días.'
                  : '🔒 Acceso Pro restringido. Solo pueden entrar usuarios con pase VIP activo o a quienes les asignes días manualmente desde la pestaña Usuarios.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleFreeAccessMode}
            disabled={isTogglingFreeMode}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50 active:scale-95 ${
              freeAccessMode
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-[#00ff66] border border-emerald-500/40'
            }`}
          >
            {isTogglingFreeMode ? (
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : freeAccessMode ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            <span>{freeAccessMode ? 'Desactivar Modo Libre' : 'Activar Modo Libre'}</span>
          </button>
        </div>
      </div>

      {/* WhatsApp de Contacto */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="p-4 rounded-2xl bg-[#0b0e14] border border-[#30363d] space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-[#d9b114]" />
            <span>WhatsApp de Soporte y Contacto</span>
          </h4>

          <div>
            <label className="block text-[11px] font-semibold text-[#8b949e] mb-1">
              Número de WhatsApp Admin (con código de país, sin +):
            </label>
            <input
              type="text"
              value={adminWhatsApp}
              onChange={(e) => setAdminWhatsApp(e.target.value)}
              placeholder="Ej: 573213902708"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114] transition"
              required
            />
          </div>

          {configError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              {configError}
            </div>
          )}

          {configSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff66] text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-[#00ff66]" />
              <span>{configSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#d9b114] hover:bg-[#c29e10] text-[#0b0e14] transition shadow-xs active:scale-95 cursor-pointer"
          >
            Guardar Configuración
          </button>
        </div>
      </form>

      {/* Base de Datos Supabase (Plegable para evitar ruido visual) */}
      <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-[#30363d] space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#d9b114]" />
            <span className="text-xs font-bold text-white">
              Conexión Base de Datos (Supabase)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                supabaseConfigured
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff66]'
                  : 'bg-amber-500/15 border-amber-500/30 text-[#d9b114]'
              }`}
            >
              {supabaseConfigured ? `Conectado · ${supabaseProject || 'Cloud'}` : 'Modo Local'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSqlGuide((prev) => !prev)}
            className="text-[11px] font-semibold text-[#d9b114] hover:underline cursor-pointer"
          >
            {showSqlGuide ? 'Ocultar guía técnica ▲' : 'Ver guía SQL de instalación ▼'}
          </button>
        </div>

        {showSqlGuide && (
          <div className="pt-2 border-t border-[#30363d] space-y-2 text-[11px] text-[#8b949e]">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-2.5 flex items-center justify-between gap-2">
              <span className="text-white">Script SQL de creación de tablas:</span>
              <button
                type="button"
                onClick={() => {
                  if (supabaseSqlSchema) {
                    navigator.clipboard.writeText(supabaseSqlSchema);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-white font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-[#00ff66]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>
            <div className="font-mono text-[10px] text-[#8b949e] bg-[#161b22] p-2.5 rounded-xl border border-[#30363d]">
              SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en variables de entorno.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
