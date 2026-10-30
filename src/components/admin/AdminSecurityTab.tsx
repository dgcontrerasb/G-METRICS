import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Check,
  Copy,
  MessageCircle,
  Database,
  Eye,
  EyeOff
} from 'lucide-react';

interface AdminSecurityTabProps {
  activeServerPin: string;
  setActiveServerPin: React.Dispatch<React.SetStateAction<string>>;
  pinInput: string;
  setPinInput: React.Dispatch<React.SetStateAction<string>>;
  adminWhatsApp: string;
  setAdminWhatsApp: React.Dispatch<React.SetStateAction<string>>;
  supabaseConfigured: boolean;
  supabaseProject: string | null;
  supabaseSqlSchema: string | null;
  buildAdminHeaders: (pin?: string, includeJson?: boolean, idempotent?: boolean) => Record<string, string>;
}

export const AdminSecurityTab: React.FC<AdminSecurityTabProps> = ({
  activeServerPin,
  setActiveServerPin,
  pinInput,
  setPinInput,
  adminWhatsApp,
  setAdminWhatsApp,
  supabaseConfigured,
  supabaseProject,
  supabaseSqlSchema,
  buildAdminHeaders
}) => {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedCurrentPin, setCopiedCurrentPin] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  const handleSendCredentialsToWhatsApp = (pinToSend: string) => {
    const cleanPhone = (adminWhatsApp || '573213902708').replace(/[^0-9]/g, '');
    const msg = `🔐 *Respaldo Privado de Administrador · G METRICS*\n\n📌 *Tu PIN Actual Activo:* ${pinToSend}\n\n_Guarda este mensaje en tu chat personal para tener siempre tu llave de acceso a la mano._`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    setConfigError(null);

    const currentPin =
      pinInput.trim() ||
      sessionStorage.getItem('futbolstats_admin_pin') ||
      localStorage.getItem('sportstats_admin_saved_pin') ||
      activeServerPin;

    if (newPin && newPin.trim().length < 4) {
      setConfigError('El nuevo PIN debe tener al menos 4 caracteres.');
      return;
    }

    if (newPin && newPin !== confirmPin) {
      setConfigError('El nuevo PIN y su confirmación no coinciden.');
      return;
    }

    try {
      const res = await fetch('/api/license/config', {
        method: 'POST',
        headers: buildAdminHeaders(currentPin, true, true),
        body: JSON.stringify({
          newPin: newPin.trim() || undefined,
          adminWhatsApp: adminWhatsApp.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        if (newPin.trim()) {
          const updatedPin = newPin.trim();
          setPinInput(updatedPin);
          setActiveServerPin(updatedPin);
          sessionStorage.setItem('futbolstats_admin_pin', updatedPin);
          localStorage.setItem('sportstats_admin_saved_pin', updatedPin);
          setNewPin('');
          setConfirmPin('');
          setConfigSuccess(`¡PIN de administrador actualizado con éxito! Tu nuevo PIN activo es: ${updatedPin}`);
        } else {
          setConfigSuccess('¡Configuración guardada con éxito!');
        }
        setTimeout(() => setConfigSuccess(null), 5000);
      } else {
        setConfigError(data.error || 'Error al guardar configuración');
      }
    } catch {
      setConfigError('Error de conexión con el servidor.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Credenciales Actuales */}
      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-600" />
            <span>Credenciales Actuales de Administrador</span>
          </h4>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
            PIN Activo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                PIN Actual
              </span>
              <span className="font-mono text-base font-bold text-slate-900 tracking-widest">
                {activeServerPin || pinInput || '••••'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeServerPin);
                setCopiedCurrentPin(true);
                setTimeout(() => setCopiedCurrentPin(false), 2000);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              {copiedCurrentPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCurrentPin ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Respaldo Personal
              </span>
              <span className="text-xs text-slate-600">
                Enviar copia privada a tu WhatsApp
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSendCredentialsToWhatsApp(activeServerPin)}
              className="shrink-0 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enviar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cambiar PIN y WhatsApp */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Actualizar PIN y WhatsApp de Contacto</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Nuevo PIN:
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  {showNewPin ? <EyeOff className="w-3 h-3 text-amber-600" /> : <Eye className="w-3 h-3" />}
                  <span>{showNewPin ? 'Ocultar' : 'Ver'}</span>
                </button>
              </div>
              <input
                type={showNewPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value);
                  setConfigError(null);
                }}
                placeholder="Mínimo 4 dígitos"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Confirmar PIN:
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  {showConfirmPin ? <EyeOff className="w-3 h-3 text-amber-600" /> : <Eye className="w-3 h-3" />}
                  <span>{showConfirmPin ? 'Ocultar' : 'Ver'}</span>
                </button>
              </div>
              <input
                type={showConfirmPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  setConfigError(null);
                }}
                placeholder="Repite el nuevo PIN"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                WhatsApp Admin:
              </label>
              <input
                type="text"
                value={adminWhatsApp}
                onChange={(e) => setAdminWhatsApp(e.target.value)}
                placeholder="Ej: 573213902708"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>
          </div>

          {configError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {configError}
            </div>
          )}

          {configSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{configSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs active:scale-95 cursor-pointer"
          >
            Guardar Configuración
          </button>
        </div>
      </form>

      {/* Base de Datos Supabase (Plegable para evitar ruido visual) */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-900">
              Conexión Base de Datos (Supabase)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                supabaseConfigured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {supabaseConfigured ? `Conectado · ${supabaseProject || 'Cloud'}` : 'Modo Local'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSqlGuide((prev) => !prev)}
            className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            {showSqlGuide ? 'Ocultar guía técnica ▲' : 'Ver guía SQL de instalación ▼'}
          </button>
        </div>

        {showSqlGuide && (
          <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px] text-slate-600">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
              <span>Script SQL de creación de tablas:</span>
              <button
                type="button"
                onClick={() => {
                  if (supabaseSqlSchema) {
                    navigator.clipboard.writeText(supabaseSqlSchema);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
              SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en variables de entorno.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
