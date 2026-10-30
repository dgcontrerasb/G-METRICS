import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, MessageCircle, ChevronRight, AlertCircle, Smartphone, ShieldAlert, Check, Eye, EyeOff } from 'lucide-react';
import { getOrCreateDeviceId, verifyLicenseToken, saveActiveLicense, createLicenseToken, LicenseValidationResult } from '../services/licenseService';
import { SportStatsLogo } from './SportStatsLogo';
import { useTheme } from '../context/ThemeContext';

interface AccessLockScreenProps {
  onUnlock: (result: LicenseValidationResult, key: string) => void;
  onOpenAdmin: () => void;
  onOpenGuide?: (tab: 'GUIDE' | 'GLOSSARY' | 'LEGAL') => void;
}

export const AccessLockScreen: React.FC<AccessLockScreenProps> = ({ onUnlock, onOpenAdmin, onOpenGuide }) => {
  const { paletteConfig } = useTheme();
  const [deviceId, setDeviceId] = useState('');
  const [friendlyDeviceName, setFriendlyDeviceName] = useState('');
  
  // Tabs: 'LOGIN' (Usuario + PIN) | 'REGISTER' (Solicitar Nueva Cuenta)
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Form State - Login
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: string; message: string; boundDevice?: string } | null>(null);

  // Form State - Register
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regDisplayName, setRegDisplayName] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regWhatsAppUrl, setRegWhatsAppUrl] = useState<string | null>(null);

  // Legacy key toggle
  const [showLegacyKey, setShowLegacyKey] = useState(false);
  const [legacyKeyInput, setLegacyKeyInput] = useState('');
  const [legacyError, setLegacyError] = useState<string | null>(null);

  // WhatsApp Config
  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');

  // Secret 3-click logo detector for Admin Modal
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretLogoClick = () => {
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      onOpenAdmin();
      return;
    }

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);
  };

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    // Detect friendly device name (e.g., "iPhone · Safari" or "Windows PC · Chrome")
    let devName = 'Dispositivo Web';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      const isMac = /Mac/i.test(platform);
      const isWin = /Win/i.test(platform);

      let browser = 'Navegador';
      if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
      else if (/Firefox/i.test(ua)) browser = 'Firefox';
      else if (/Edg/i.test(ua)) browser = 'Edge';

      if (isIOS) devName = `iPhone · ${browser}`;
      else if (isAndroid) devName = `Android · ${browser}`;
      else if (isMac) devName = `Mac · ${browser}`;
      else if (isWin) devName = `Windows · ${browser}`;
      else devName = `${platform.slice(0, 10)} · ${browser}`;
    }
    setFriendlyDeviceName(devName);

    // Fetch Admin WhatsApp
    fetch('/api/license/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.adminWhatsApp) {
          setAdminWhatsApp(data.adminWhatsApp);
        }
      })
      .catch(() => {
        setAdminWhatsApp('573213902708');
      });
  }, []);

  // Normaliza usuario eliminando espacios y caracteres no permitidos (permite correo para el administrador)
  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    setUsernameInput(clean);
    setLoginError(null);
  };

  const handleRegUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    setRegUsername(clean);
    setRegError(null);
    setRegSuccess(null);
    setRegWhatsAppUrl(null);
  };

  // Try local user fallback if server is unreachable
  const tryLocalUserLogin = (cleanUser: string, cleanPin: string): boolean => {
    try {
      const raw = localStorage.getItem('sportstats_local_users_cache');
      if (!raw) return false;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return false;
      const found = list.find((u: any) => u.username === cleanUser.toLowerCase());
      if (!found) return false;
      if (found.pin !== cleanPin) {
        setLoginError({ message: 'El PIN ingresado no es correcto para este usuario.' });
        return true;
      }
      if (found.status === 'pending') {
        setLoginError({ message: 'Tu cuenta está pendiente de activación por el administrador.' });
        return true;
      }
      if (found.status === 'suspended') {
        setLoginError({ message: 'Tu cuenta ha sido suspendida. Contacta al administrador.' });
        return true;
      }
      const devId = deviceId || getOrCreateDeviceId();
      if (found.boundDeviceId && found.boundDeviceId !== devId) {
        setLoginError({
          code: 'DEVICE_LOCKED',
          message: `Esta cuenta ya está vinculada a otro dispositivo (${found.boundDeviceName || 'dispositivo principal'}).`,
          boundDevice: found.boundDeviceName
        });
        return true;
      }
      found.boundDeviceId = devId;
      found.boundDeviceName = friendlyDeviceName;
      found.lastActiveAt = Date.now();
      localStorage.setItem('sportstats_local_users_cache', JSON.stringify(list));
      localStorage.setItem('sportstats_auth_user', JSON.stringify(found));
      localStorage.setItem('sportstats_client_name', found.displayName || found.username);

      const sessionToken = createLicenseToken(
        devId,
        (found.planType as any) || '30D',
        found.expiresAt || undefined
      );
      const unlockResult: LicenseValidationResult = {
        isValid: true,
        status: 'ACTIVE',
        message: 'Autenticación exitosa',
        isPermanent: found.expiresAt === null,
        isExpired: false,
        expiryTimestamp: found.expiresAt || null,
        expiryDateFormatted: found.expiresAt
          ? new Date(found.expiresAt).toLocaleDateString('es-ES')
          : 'Permanente (Vitalicio)',
        daysRemaining: found.daysRemaining ?? 30,
        targetDeviceId: devId,
        planLabel: found.planLabel || 'Pase 30 Días',
        clientName: found.displayName || found.username
      };
      saveActiveLicense(sessionToken.key, unlockResult);
      onUnlock(unlockResult, sessionToken.key);
      return true;
    } catch {
      return false;
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanUser = usernameInput.trim();
    const cleanPin = pinInput.trim();

    if (!cleanUser || cleanUser.length < 3) {
      setLoginError({ message: 'Ingresa un usuario válido (3 a 20 caracteres, letras y números).' });
      return;
    }

    if (!cleanPin) {
      setLoginError({ message: 'Ingresa tu PIN de acceso.' });
      return;
    }

    setIsValidating(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          pin: cleanPin,
          deviceId,
          deviceName: friendlyDeviceName
        })
      });

      if (!res.ok) {
        if (tryLocalUserLogin(cleanUser, cleanPin)) {
          return;
        }
        const text = await res.text();
        let errMsg = 'Error en el servidor al autenticar';
        try {
          const parsed = JSON.parse(text);
          if (parsed.message) errMsg = parsed.message;
        } catch {
          // not json
        }
        setLoginError({ message: errMsg });
        return;
      }

      const data = await res.json();

      if (data.user?.role === 'admin') {
        localStorage.setItem('sportstats_admin_remember', 'true');
      }

      if (data.success && data.user) {
        const safeUser = { ...data.user, pin: '[PROTECTED]' };
        localStorage.setItem('sportstats_auth_user', JSON.stringify(safeUser));
        localStorage.setItem('sportstats_client_name', data.user.displayName || data.user.username);

        if (data.sessionToken) {
          sessionStorage.setItem('sportstats_session_jwt', data.sessionToken);
        }

        if (data.user.role === 'admin') {
          sessionStorage.setItem('futbolstats_admin_pin', cleanPin);
          localStorage.setItem('sportstats_admin_saved_pin', cleanPin);
        }

        const sessionToken = createLicenseToken(
          deviceId,
          data.user.role === 'admin' ? 'PERMANENT' : (data.user.planType as any) || '30D',
          data.user.expiresAt || undefined
        );
        const expFormatted = data.user.expiresAt
          ? new Date(data.user.expiresAt).toLocaleDateString('es-ES')
          : 'Permanente (Vitalicio)';

        const unlockResult: LicenseValidationResult = {
          isValid: true,
          status: 'ACTIVE',
          message: 'Autenticación exitosa',
          isPermanent: data.user.expiresAt === null,
          isExpired: false,
          expiryTimestamp: data.user.expiresAt,
          expiryDateFormatted: expFormatted,
          daysRemaining: data.user.daysRemaining,
          targetDeviceId: deviceId,
          planLabel: data.user.planLabel,
          clientName: data.user.displayName || data.user.username
        };

        saveActiveLicense(sessionToken.key, unlockResult);
        onUnlock(unlockResult, sessionToken.key);
        return;
      } else {
        if (data.code === 'USER_NOT_FOUND' && tryLocalUserLogin(cleanUser, cleanPin)) {
          return;
        }
        setLoginError({
          code: data.code,
          message: data.message || 'Credenciales inválidas',
          boundDevice: data.boundDeviceName
        });
      }
    } catch {
      if (tryLocalUserLogin(cleanUser, cleanPin)) {
        return;
      }
      setLoginError({ message: 'Error de conexión con el servidor. Intenta de nuevo.' });
    } finally {
      setIsValidating(false);
    }
  };

  // Submit Register Request
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegWhatsAppUrl(null);

    const cleanUser = regUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPin = regPin.trim();
    const cleanName = regDisplayName.trim();

    if (!cleanUser || cleanUser.length < 3) {
      setRegError('El usuario debe tener entre 3 y 20 caracteres (solo letras y números).');
      return;
    }

    if (!cleanPin || cleanPin.length < 4) {
      setRegError('El PIN debe tener al menos 4 dígitos.');
      return;
    }

    if (!acceptedLegalTerms) {
      setRegError('Debes confirmar que eres mayor de 18 años y aceptar el aviso legal de uso autónomo.');
      return;
    }

    const currentDevId = deviceId || getOrCreateDeviceId();

    // Comprobar si ya existe una solicitud pendiente creada desde este mismo dispositivo
    try {
      const rawCache = localStorage.getItem('sportstats_local_users_cache');
      const list = rawCache ? JSON.parse(rawCache) : [];
      if (Array.isArray(list)) {
        const pendingOnDevice = list.find(
          (u: any) => u.boundDeviceId === currentDevId && u.status === 'pending' && u.username !== cleanUser
        );
        if (pendingOnDevice) {
          setRegError(`Ya tienes una solicitud pendiente (@${pendingOnDevice.username}) creada desde este dispositivo. Espera a que el administrador la apruebe.`);
          return;
        }
      }
    } catch {
      // ignore
    }

    // 1. Preparar URL de WhatsApp inmediatamente (sin exponer el PIN en texto plano en caché pública)
    const cleanPhone = (adminWhatsApp || '573213902708').replace(/[^0-9]/g, '');
    const greetingName = cleanName ? ` Mi nombre es ${cleanName}.` : '';
    const msg = `🔥 *Solicitud de Activación de Cuenta · SportStats Pro*${greetingName}\n\n👤 *Usuario solicitado:* @${cleanUser}\n📱 *Equipo:* ${friendlyDeviceName || currentDevId}\n\nHola! Acabo de registrar mi solicitud en SportStats Pro con mi PIN privado. ¿Cuáles son los planes y métodos de pago disponibles? Muchas gracias!`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

    // 2. Guardar respaldo local inmediato de la solicitud (sin PIN en texto plano)
    try {
      const rawCache = localStorage.getItem('sportstats_local_users_cache');
      const list = rawCache ? JSON.parse(rawCache) : [];
      const safeList = Array.isArray(list) ? list : [];
      const existingIdx = safeList.findIndex((u: any) => u.username === cleanUser);
      const nowMs = Date.now();
      const isAlreadyActive = existingIdx >= 0 && safeList[existingIdx].status === 'active';
      const pendingRecord = {
        id: existingIdx >= 0 ? safeList[existingIdx].id : `USR-${nowMs.toString(36).toUpperCase()}`,
        username: cleanUser,
        displayName: cleanName || undefined,
        role: 'client',
        status: isAlreadyActive ? 'active' : 'pending',
        planType: isAlreadyActive ? safeList[existingIdx].planType : 'PENDING',
        planLabel: isAlreadyActive ? safeList[existingIdx].planLabel : 'Pendiente de Activación',
        createdAt: nowMs,
        expiresAt: isAlreadyActive ? safeList[existingIdx].expiresAt : null,
        boundDeviceId: currentDevId,
        boundDeviceName: friendlyDeviceName,
        daysRemaining: isAlreadyActive ? safeList[existingIdx].daysRemaining : 0,
        isExpired: false
      };
      if (existingIdx >= 0) {
        safeList[existingIdx] = pendingRecord;
      } else {
        safeList.unshift(pendingRecord);
      }
      localStorage.setItem('sportstats_local_users_cache', JSON.stringify(safeList));
    } catch {
      // ignore local storage quota
    }

    setRegLoading(true);

    try {
      // 3. Intentar registrar en el servidor con llave de idempotencia y control de dispositivo
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('/api/auth/register-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `reg-${cleanUser}-${Date.now()}`
        },
        body: JSON.stringify({
          username: cleanUser,
          pin: cleanPin,
          displayName: cleanName || undefined,
          deviceId: currentDevId,
          deviceName: friendlyDeviceName
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (data && data.success === false) {
        setRegError(data.message || 'No fue posible registrar la solicitud.');
        setRegLoading(false);
        return;
      }
    } catch {
      // Si el servidor o la red tardan o fallan, continuamos con el respaldo local y WhatsApp sin mostrar error de conexión
    } finally {
      setRegLoading(false);
    }

    setRegWhatsAppUrl(waUrl);
    setRegSuccess('¡Solicitud creada con éxito! Presiona el botón verde a continuación para enviar tu mensaje de activación al Administrador por WhatsApp.');

    // 4. Intentar abrir WhatsApp en nueva pestaña SIN romper ni redirigir la ventana actual de la aplicación
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // El usuario cuenta con el botón táctil visible de WhatsApp en pantalla
    }
  };

  // Contact Admin for Device Change
  const handleRequestDeviceChange = () => {
    const cleanPhone = adminWhatsApp.replace(/[^0-9]/g, '');
    const userTag = usernameInput ? `@${usernameInput}` : 'mi usuario';
    const msg = `📱 *Solicitud de Desvinculación de Dispositivo · SportStats Pro*\n\nHola Administrador, cambié de dispositivo o borré caché en mi navegador.\n\n👤 *Usuario:* ${userTag}\n📱 *Nuevo equipo:* ${friendlyDeviceName}\n\n¿Podrías por favor desvincular mi equipo anterior para poder ingresar en este nuevo? ¡Muchas gracias!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Legacy key validation (backward compatibility)
  const handleLegacyKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLegacyError(null);
    const clean = legacyKeyInput.trim().toUpperCase();

    if (!clean) return;

    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: clean, deviceId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isValid) {
          const check = verifyLicenseToken(clean, deviceId);
          saveActiveLicense(clean, check);
          onUnlock(check, clean);
          return;
        }
      }
      setLegacyError('La clave ingresada no es válida o ha vencido.');
    } catch {
      const localCheck = verifyLicenseToken(clean, deviceId);
      if (localCheck.isValid) {
        saveActiveLicense(clean, localCheck);
        onUnlock(localCheck, clean);
      } else {
        setLegacyError('Clave no válida');
      }
    }
  };

  return (
    <div className="min-h-screen cr7-cinematic-bg bg-slate-100 text-slate-700 flex flex-col justify-between relative overflow-hidden font-sans transition-colors duration-200">
      {/* Subtle Light Ambient Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[400px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[400px] bg-sky-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header with Secret 3-Click Admin Entry */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-2">
        <div
          onClick={handleSecretLogoClick}
          className="flex items-center gap-2.5 cursor-pointer select-none transition-transform active:scale-98"
          title="G METRICS"
        >
          <SportStatsLogo size="md" withGlow={false} />
          <div>
            <span className="gmetrics-brand-title text-base sm:text-lg leading-none block whitespace-nowrap">
              G METRICS
            </span>
            <span className="block text-[7.5px] uppercase font-extrabold tracking-tight text-slate-600 whitespace-nowrap leading-none mt-1">
              LA CIENCIA DETRÁS DE LA VICTORIA
            </span>
          </div>
        </div>

        {onOpenGuide && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenGuide('GLOSSARY')}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-medium text-slate-700 hover:text-slate-900 shadow-2xs transition cursor-pointer"
            >
              📖 Glosario A-Z
            </button>
            <button
              type="button"
              onClick={() => onOpenGuide('LEGAL')}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-semibold text-amber-800 transition cursor-pointer"
            >
              +18 Legal
            </button>
          </div>
        )}
      </header>

      {/* Main Form Container */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-2 flex-1 flex flex-col justify-center">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xl relative space-y-4">
          
          {/* Header Title */}
          <div className="text-center space-y-1">
            <h1 className="flex flex-col items-center justify-center tracking-tight leading-tight">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-600">
                BIENVENIDOS A
              </span>
              <span className="gmetrics-brand-title text-xl sm:text-2xl mt-0.5">
                G METRICS
              </span>
            </h1>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed max-w-sm mx-auto">
              Inicia sesión con tu usuario y PIN, o solicita tu cuenta directamente por WhatsApp.
            </p>
          </div>

          {/* Tab Selector: Iniciar Sesión vs Solicitar Cuenta */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('LOGIN');
                setLoginError(null);
              }}
              className={`py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'LOGIN'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Iniciar Sesión</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('REGISTER');
                setRegError(null);
                setRegSuccess(null);
              }}
              className={`py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'REGISTER'
                  ? 'bg-emerald-600 text-white shadow-2xs border border-emerald-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Solicitar Cuenta</span>
            </button>
          </div>

          {/* TAB 1: INICIAR SESIÓN */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-0.5">
              {/* Username Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Usuario:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Letras y números (sin espacios)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="ej: carlos99"
                    autoFocus
                    required
                    className="w-full bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* PIN Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  PIN de Acceso:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="••••••"
                    maxLength={10}
                    required
                    className="w-full bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-sm font-mono text-slate-900 tracking-widest placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showLoginPin ? 'Ocultar PIN' : 'Ver PIN'}
                  >
                    {showLoginPin ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Box with Device Lock Shield Handling */}
              {loginError && (
                <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                  loginError.code === 'DEVICE_LOCKED'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {loginError.code === 'DEVICE_LOCKED' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed font-medium">{loginError.message}</span>
                  </div>

                  {/* Single-Device Lock: Direct button to request reset to admin */}
                  {loginError.code === 'DEVICE_LOCKED' && (
                    <button
                      type="button"
                      onClick={handleRequestDeviceChange}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Solicitar Cambio de Equipo por WhatsApp</span>
                    </button>
                  )}
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isValidating}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar a G METRICS</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Legal Consent Footnote on Login */}
              <p className="text-[10px] text-slate-500 text-center leading-relaxed pt-0.5">
                Al ingresar declaras ser <strong className="text-slate-800">mayor de 18 años (+18)</strong> y aceptas que la plataforma es una guía estadística orientativa bajo tu exclusiva responsabilidad.{' '}
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={() => onOpenGuide('LEGAL')}
                    className="text-amber-700 hover:underline font-semibold cursor-pointer"
                  >
                    Ver Aviso Legal
                  </button>
                )}
              </p>
            </form>
          )}

          {/* TAB 2: SOLICITAR CUENTA NUEVA */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3 pt-0.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Usuario que deseas:</span>
                  <span className="text-[10px] text-slate-400">Solo letras y números</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => handleRegUsernameChange(e.target.value)}
                    placeholder="ej: betmaster"
                    required
                    className="w-full bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tu Nombre o Alias (Opcional):
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="ej: Juan Pérez"
                  className="w-full bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Elige tu PIN personal:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="Mínimo 4 dígitos"
                    maxLength={10}
                    required
                    className="w-full bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl pl-9 pr-10 py-2 text-sm font-mono text-slate-900 tracking-widest placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPin(!showRegPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showRegPin ? 'Ocultar PIN' : 'Ver PIN'}
                  >
                    {showRegPin ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Active +18 & Legal Consent Checkbox */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedLegalTerms}
                  onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                  className="mt-0.5 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="text-[10px] text-slate-600 leading-relaxed">
                  Confirmo que soy <strong className="text-slate-900">mayor de 18 años (+18)</strong> y comprendo que SportStats Pro es una guía estadística orientativa (no casa de apuestas) y cada decisión es mi exclusiva responsabilidad.{' '}
                  {onOpenGuide && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenGuide('LEGAL');
                      }}
                      className="text-amber-700 hover:underline font-semibold cursor-pointer"
                    >
                      Leer términos
                    </button>
                  )}
                </span>
              </label>

              {regError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2.5 font-semibold">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{regSuccess}</span>
                  </div>
                  {regWhatsAppUrl && (
                    <a
                      href={regWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Abrir WhatsApp y Enviar al Administrador</span>
                    </a>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{regLoading ? 'Procesando solicitud...' : 'Solicitar Activación por WhatsApp'}</span>
              </button>
            </form>
          )}

          {/* Device & Security Footnote */}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>{friendlyDeviceName}</span>
            </div>
            <span className="text-[10px] uppercase font-semibold text-emerald-700">
              Dispositivo Seguro 1/1
            </span>
          </div>

          {/* Legacy Key Fallback Accordion */}
          <div className="pt-0.5 text-center">
            <button
              type="button"
              onClick={() => setShowLegacyKey(!showLegacyKey)}
              className="text-[10px] text-slate-500 hover:text-slate-800 transition underline underline-offset-2 cursor-pointer"
            >
              {showLegacyKey ? 'Ocultar canje de clave antigua' : '¿Tienes una clave de activación antigua? Ingrésala aquí'}
            </button>

            {showLegacyKey && (
              <form onSubmit={handleLegacyKeySubmit} className="mt-2 space-y-2">
                <input
                  type="text"
                  value={legacyKeyInput}
                  onChange={(e) => setLegacyKeyInput(e.target.value)}
                  placeholder="FS-30D-..."
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                />
                {legacyError && <div className="text-[11px] text-rose-600 font-medium">{legacyError}</div>}
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Validar Clave Antigua
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Institutional & Legal Shield Footer */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto px-4 py-3 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1.5 bg-white/60 backdrop-blur-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px]">
              +18
            </span>
            <span className="gmetrics-brand-title text-[11px] leading-none">G METRICS</span>
            <span className="text-[7.5px] font-extrabold uppercase tracking-tight text-slate-500 whitespace-nowrap">
              · LA CIENCIA DETRÁS DE LA VICTORIA
            </span>
          </div>
          {onOpenGuide && (
            <div className="flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => onOpenGuide('GLOSSARY')}
                className="text-emerald-700 hover:underline font-semibold cursor-pointer"
              >
                Glosario Técnico A-Z
              </button>
              <button
                type="button"
                onClick={() => onOpenGuide('LEGAL')}
                className="text-amber-700 hover:underline font-semibold cursor-pointer"
              >
                Aviso Legal y Exención
              </button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <strong className="text-slate-700">AVISO LEGAL:</strong> G METRICS es una herramienta de análisis estadístico e informativo; no somos casa de apuestas, no captamos dinero del público ni garantizamos ganancias seguras. Toda decisión o jugada realizada por el usuario corre bajo su exclusiva autonomía y responsabilidad patrimonial.
        </p>
      </footer>
    </div>
  );
};
