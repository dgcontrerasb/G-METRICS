import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import {
  getOrCreateDeviceId,
  saveActiveLicense,
  createLicenseToken,
  LicenseValidationResult
} from '../services/licenseService';
import { SportStatsLogo } from './SportStatsLogo';
import { getBrowserSupabase, signInWithGoogleOAuth } from '../services/supabaseBrowser';
import { MatchFixture, NBAMatchFixture } from '../types';
import { calculateMatchAnalysis } from '../services/mathEngine';
import { calculateNBAAnalysis } from '../services/nbaEngine';
import { getSoccerDidacticAdvice, getNBADidacticAdvice } from '../services/didacticService';
import { getLocalUpcomingCache, getColombiaDateString, fetchUpcomingFixtures } from '../services/apiService';
import { fetchNBAFixtures } from '../services/nbaApiService';
import { useHistoricalAudit } from '../services/historicalAuditService';

interface AccessLockScreenProps {
  fixtures?: MatchFixture[];
  nbaFixtures?: NBAMatchFixture[];
  onUnlock: (result: LicenseValidationResult, key: string) => void;
  onOpenAdmin: () => void;
  onOpenGuide?: (tab: 'GUIDE' | 'GLOSSARY' | 'LEGAL' | 'AUDIT') => void;
}

// Cálculo dinámico de la semana ISO actual para la auditoría de certeza
const getISOWeekInfo = () => {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekNo, year: date.getUTCFullYear() };
};

// Duelo real para el dock inferior de la portada (nunca datos inventados)
interface FeaturedMarqueeDuel {
  id: string;
  sport: 'SOCCER' | 'NBA';
  league: string;
  statusText: string;
  isLive: boolean;
  pillLabel: string;
  homeTeam: { name: string; shortName: string; logo: string; xg?: number; score?: number };
  awayTeam: { name: string; shortName: string; logo: string; xg?: number; score?: number };
  topPick: { label: string; odd: number; certainty: number; market: string };
}

export const AccessLockScreen: React.FC<AccessLockScreenProps> = ({
  fixtures,
  nbaFixtures,
  onUnlock,
  onOpenAdmin,
  onOpenGuide
}) => {
  const [deviceId, setDeviceId] = useState('');
  const [friendlyDeviceName, setFriendlyDeviceName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState<boolean>(false);

  // Información semanal y eficiencia auditada calculada en tiempo real
  const weekInfo = getISOWeekInfo();
  const auditSummary = useHistoricalAudit();

  // Partidos reales cargados de forma proactiva (hoy, o mañana si hoy ya no quedan partidos)
  const [loadedSoccer, setLoadedSoccer] = useState<MatchFixture[]>([]);
  const [loadedNba, setLoadedNba] = useState<NBAMatchFixture[]>([]);
  const [isSoccerTomorrow, setIsSoccerTomorrow] = useState(false);
  const [isNbaTomorrow, setIsNbaTomorrow] = useState(false);
  const [isLoadingDock, setIsLoadingDock] = useState(true);

  useEffect(() => {
    let active = true;
    const today = getColombiaDateString(0);
    const tomorrow = getColombiaDateString(1);

    const loadSoccer = async () => {
      const cachedToday = getLocalUpcomingCache(today);
      if (cachedToday?.fixtures?.length) {
        if (active) setLoadedSoccer(cachedToday.fixtures);
        return;
      }
      try {
        const resToday = await fetchUpcomingFixtures(today, { forceRefresh: false });
        if (active && resToday.fixtures?.length) {
          setLoadedSoccer(resToday.fixtures);
          return;
        }
        const resTomorrow = await fetchUpcomingFixtures(tomorrow, { forceRefresh: false });
        if (active && resTomorrow.fixtures?.length) {
          setLoadedSoccer(resTomorrow.fixtures);
          setIsSoccerTomorrow(true);
        }
      } catch {
        // ignore network error
      }
    };

    const loadNba = async () => {
      try {
        const nbaCache = localStorage.getItem(`basketstats_nba_v8_${today}`);
        if (nbaCache) {
          const parsed = JSON.parse(nbaCache);
          if (Array.isArray(parsed.fixtures) && parsed.fixtures.length > 0) {
            if (active) setLoadedNba(parsed.fixtures);
            return;
          }
        }
      } catch {
        // ignore
      }
      try {
        const resToday = await fetchNBAFixtures(today, { forceRefresh: false });
        if (active && resToday.fixtures?.length) {
          setLoadedNba(resToday.fixtures);
          return;
        }
        const resTomorrow = await fetchNBAFixtures(tomorrow, { forceRefresh: false });
        if (active && resTomorrow.fixtures?.length) {
          setLoadedNba(resTomorrow.fixtures);
          setIsNbaTomorrow(true);
        }
      } catch {
        // ignore network error
      }
    };

    Promise.all([loadSoccer(), loadNba()]).finally(() => {
      if (active) setIsLoadingDock(false);
    });

    return () => {
      active = false;
    };
  }, []);

  // 1. Obtener partidos reales del día (de props, de estado o de caché local v8)
  const allSoccerFixtures = useMemo<MatchFixture[]>(() => {
    if (fixtures && fixtures.length > 0) return fixtures;
    if (loadedSoccer.length > 0) return loadedSoccer;
    try {
      const targetDate = getColombiaDateString(0);
      const cached = getLocalUpcomingCache(targetDate);
      if (cached && Array.isArray(cached.fixtures) && cached.fixtures.length > 0) {
        return cached.fixtures;
      }
    } catch {
      // ignore
    }
    return [];
  }, [fixtures, loadedSoccer]);

  const allNbaFixtures = useMemo<NBAMatchFixture[]>(() => {
    if (nbaFixtures && nbaFixtures.length > 0) return nbaFixtures;
    if (loadedNba.length > 0) return loadedNba;
    try {
      const targetDate = getColombiaDateString(0);
      const raw = localStorage.getItem(`basketstats_nba_v8_${targetDate}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.fixtures) && parsed.fixtures.length > 0) {
          return parsed.fixtures;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }, [nbaFixtures, loadedNba]);

  // 2. Joya #1 REAL de Fútbol y NBA usando EXACTAMENTE el mismo motor/ranking que Top Picks dentro de la app
  const topSoccerDuel = useMemo<FeaturedMarqueeDuel | null>(() => {
    if (allSoccerFixtures.length === 0) return null;
    const activeSoccer = allSoccerFixtures.filter((f) => f.status !== 'FINISHED');
    const pool = activeSoccer.length > 0 ? activeSoccer : allSoccerFixtures;
    const dayPrefix = !fixtures?.length && isSoccerTomorrow ? 'Mañana' : 'Hoy';

    const ranked = pool
      .map((f) => {
        try {
          const analysis = calculateMatchAnalysis(f);
          const advice = getSoccerDidacticAdvice(f, analysis);
          const pick = analysis.verdict?.topSafePick;
          const prob = advice?.topPick?.probability ?? pick?.probability ?? 0;
          const isGreen = advice?.signal === 'GREEN' || prob >= 68;
          return { f, analysis, advice, pick, prob, isGreen };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x && x.prob > 0))
      .sort((a, b) => {
        if (a.isGreen !== b.isGreen) return a.isGreen ? -1 : 1;
        return b.prob - a.prob;
      });

    const best = ranked[0];
    if (!best) return null;

    const { f, analysis, advice, pick, prob } = best;
    const isLive = f.status === 'IN_PLAY';
    const isFT = f.status === 'FINISHED';
    const statusText = isLive
      ? `${f.currentScore?.minute || f.score?.minute || 45}' EN VIVO`
      : isFT
      ? 'FINAL'
      : `${dayPrefix} ${f.time || ''}`.trim();

    const hShort = f.homeTeam.shortName || f.homeTeam.name.slice(0, 3).toUpperCase();
    const aShort = f.awayTeam.shortName || f.awayTeam.name.slice(0, 3).toUpperCase();

    return {
      id: `real-duel-${f.id}`,
      sport: 'SOCCER',
      league: f.league?.name || 'Competición Oficial',
      statusText,
      isLive,
      pillLabel: `${hShort} vs ${aShort}`,
      homeTeam: {
        name: f.homeTeam.name,
        shortName: hShort,
        logo: f.homeTeam.logo || '',
        xg: analysis.dixonColes?.lambdaHome,
        score: isLive || isFT ? (f.currentScore?.home ?? f.score?.home ?? 0) : undefined
      },
      awayTeam: {
        name: f.awayTeam.name,
        shortName: aShort,
        logo: f.awayTeam.logo || '',
        xg: analysis.dixonColes?.lambdaAway,
        score: isLive || isFT ? (f.currentScore?.away ?? f.score?.away ?? 0) : undefined
      },
      topPick: {
        label: pick?.plainTitle || advice?.topPick?.label || pick?.label || 'Más de 1.5 Goles',
        odd: advice?.topPick?.fairOdd || pick?.fairOdd || 1.55,
        certainty: prob,
        market: 'Modelo Cuantitativo'
      }
    };
  }, [allSoccerFixtures, fixtures?.length, isSoccerTomorrow]);

  const topNbaDuel = useMemo<FeaturedMarqueeDuel | null>(() => {
    if (allNbaFixtures.length === 0) return null;
    const activeNba = allNbaFixtures.filter((n) => n.status !== 'FINISHED');
    const pool = activeNba.length > 0 ? activeNba : allNbaFixtures;
    const dayPrefix = !nbaFixtures?.length && isNbaTomorrow ? 'Mañana' : 'Hoy';

    const ranked = pool
      .map((topNba) => {
        try {
          const nbaAnalysis = calculateNBAAnalysis(topNba);
          const advice = getNBADidacticAdvice(topNba, nbaAnalysis);
          const fallbackProb = Math.max(nbaAnalysis.pHomeWin, nbaAnalysis.pAwayWin);
          const prob = advice?.topPick?.probability ?? fallbackProb;
          const isGreen = advice?.signal === 'GREEN' || prob >= 68;
          return { topNba, nbaAnalysis, advice, prob, isGreen };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x && x.prob > 0))
      .sort((a, b) => {
        if (a.isGreen !== b.isGreen) return a.isGreen ? -1 : 1;
        return b.prob - a.prob;
      });

    const best = ranked[0];
    if (!best) return null;

    const { topNba, nbaAnalysis, advice, prob } = best;
    const isLive = topNba.status === 'IN_PLAY';
    const isFT = topNba.status === 'FINISHED';
    const homeFav = nbaAnalysis.pHomeWin >= nbaAnalysis.pAwayWin;
    const favTeam = homeFav ? topNba.homeTeam.shortName : topNba.awayTeam.shortName;
    const realOdd = homeFav
      ? topNba.externalOdds?.homeMoneyline || topNba.consensusOdds?.homeMoneyline
      : topNba.externalOdds?.awayMoneyline || topNba.consensusOdds?.awayMoneyline;

    const pickOdd =
      advice?.topPick?.fairOdd ||
      (typeof realOdd === 'number' && realOdd > 1.05
        ? realOdd
        : Math.max(1.18, Math.round((100 / Math.max(50, prob)) * 100) / 100));

    return {
      id: `real-nba-${topNba.id}`,
      sport: 'NBA',
      league: topNba.league?.name || 'NBA · Baloncesto Profesional',
      statusText: isLive ? 'EN VIVO' : isFT ? 'FINAL' : `${dayPrefix} ${topNba.time || ''}`.trim(),
      isLive,
      pillLabel: `${topNba.homeTeam.shortName} vs ${topNba.awayTeam.shortName}`,
      homeTeam: {
        name: topNba.homeTeam.name,
        shortName: topNba.homeTeam.shortName,
        logo: topNba.homeTeam.logo || '',
        score: isLive || isFT ? (topNba.currentScore?.home ?? 0) : undefined
      },
      awayTeam: {
        name: topNba.awayTeam.name,
        shortName: topNba.awayTeam.shortName,
        logo: topNba.awayTeam.logo || '',
        score: isLive || isFT ? (topNba.currentScore?.away ?? 0) : undefined
      },
      topPick: {
        label: advice?.topPick?.label || `Gana ${favTeam} (ML)`,
        odd: pickOdd,
        certainty: Math.round(prob * 10) / 10,
        market: 'Modelo NBA'
      }
    };
  }, [allNbaFixtures, nbaFixtures?.length, isNbaTomorrow]);

  // Detector secreto de 3 clics en el logo original para abrir el panel de Administrador
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

  // Inicialización de huella de dispositivo
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);

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
  }, []);

  // Procesa el acceso único con Google (Doble propósito: Registro automático si es nuevo + Login instantáneo si ya existe)
  const processGoogleLogin = useCallback(
    async (
      cleanEmail: string,
      cleanName?: string,
      accessToken?: string,
      providerToken?: string
    ) => {
      setGoogleLoading(true);
      setAuthError(null);

      const devId = deviceId || getOrCreateDeviceId();
      const devName = friendlyDeviceName || 'Dispositivo Web';

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail.trim().toLowerCase(),
            displayName: (cleanName || cleanEmail.split('@')[0]).trim(),
            deviceId: devId,
            deviceName: devName,
            fingerprint: devId,
            accessToken: accessToken || '',
            providerToken: providerToken || ''
          })
        });

        const data = await res.json();

        if (data.success && data.user) {
          const safeUser = { ...data.user, pin: '[PROTECTED]' };
          localStorage.setItem('sportstats_auth_user', JSON.stringify(safeUser));
          localStorage.setItem(
            'sportstats_client_name',
            data.user.displayName || data.user.username
          );

          if (data.sessionToken) {
            localStorage.setItem('sportstats_session_jwt', data.sessionToken);
            sessionStorage.setItem('sportstats_session_jwt', data.sessionToken);
          }

          if (data.user.role === 'admin') {
            localStorage.setItem('sportstats_admin_remember', 'true');
          } else {
            localStorage.removeItem('sportstats_admin_saved_pin');
            localStorage.removeItem('sportstats_admin_remember');
            sessionStorage.removeItem('futbolstats_admin_pin');
          }

          const sessionToken = createLicenseToken(
            devId,
            data.user.role === 'admin' ? 'PERMANENT' : (data.user.planType as any) || '30D',
            data.user.expiresAt || undefined
          );
          const expFormatted = data.user.expiresAt
            ? new Date(data.user.expiresAt).toLocaleDateString('es-ES')
            : 'Permanente (Vitalicio)';

          const daysRemaining = data.user.expiresAt
            ? Math.max(0, Math.ceil((data.user.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
            : null;

          const isUserExpired = !data.isPro;
          const unlockResult: LicenseValidationResult = {
            isValid: true,
            status: isUserExpired ? 'EXPIRED' : 'ACTIVE',
            message: data.message || 'Autenticación exitosa',
            isPermanent: data.user.expiresAt === null,
            isExpired: isUserExpired,
            expiryTimestamp: data.user.expiresAt,
            expiryDateFormatted: expFormatted,
            daysRemaining,
            targetDeviceId: devId,
            planLabel: data.user.planLabel || 'Acceso Libre Promocional',
            clientName: data.user.displayName || data.user.username
          };

          saveActiveLicense(sessionToken.key, unlockResult);
          onUnlock(unlockResult, sessionToken.key);
          return true;
        } else {
          setAuthError(data.message || 'No se pudo completar el acceso con Google.');
          return false;
        }
      } catch {
        setAuthError('Error de conexión con el servidor. Por favor intenta de nuevo.');
        return false;
      } finally {
        setGoogleLoading(false);
      }
    },
    [deviceId, friendlyDeviceName, onUnlock]
  );

  // Listener automático para el retorno de Google OAuth vía Supabase
  useEffect(() => {
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(window.location.search);

    const hashAccessToken =
      hashParams.get('access_token') || searchParams.get('access_token');
    const providerToken =
      hashParams.get('provider_token') || searchParams.get('provider_token');

    if (hashAccessToken || providerToken) {
      sessionStorage.removeItem('gmetrics_oauth_in_progress');
      sessionStorage.removeItem('gmetrics_registration_pending');
      window.history.replaceState(null, '', window.location.pathname);

      let extractedEmail = '';
      let extractedName = '';

      const tokenForPayload = hashAccessToken || providerToken || '';
      try {
        const parts = tokenForPayload.split('.');
        if (parts.length === 3) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          extractedEmail = payload.email || payload.user_metadata?.email || '';
          extractedName =
            payload.user_metadata?.full_name ||
            payload.user_metadata?.name ||
            payload.name ||
            '';
        }
      } catch (err) {
        console.warn('Extracción de payload JWT diferida a backend:', err);
      }

      if (extractedEmail) {
        processGoogleLogin(
          extractedEmail,
          extractedName,
          hashAccessToken || undefined,
          providerToken || undefined
        );
        return;
      }
    }

    const hasOAuthParams =
      window.location.hash.includes('access_token') ||
      window.location.search.includes('code') ||
      sessionStorage.getItem('gmetrics_oauth_in_progress') === 'true';

    if (!hasOAuthParams) return;

    let isCancelled = false;
    getBrowserSupabase().then((supabase) => {
      if (!supabase || isCancelled) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isCancelled && session?.user?.email) {
          sessionStorage.removeItem('gmetrics_oauth_in_progress');
          sessionStorage.removeItem('gmetrics_registration_pending');
          if (window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          processGoogleLogin(
            session.user.email,
            session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            session.access_token,
            session.provider_token || undefined
          );
        }
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          !isCancelled &&
          (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
          session?.user?.email
        ) {
          sessionStorage.removeItem('gmetrics_oauth_in_progress');
          sessionStorage.removeItem('gmetrics_registration_pending');
          if (window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          processGoogleLogin(
            session.user.email,
            session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            session.access_token,
            session.provider_token || undefined
          );
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    });

    return () => {
      isCancelled = true;
    };
  }, [processGoogleLogin]);

  // Acción única: Continuar con Google (Registro + Inicio de Sesión en 1 clic)
  const handleContinueWithGoogle = async () => {
    setAuthError(null);
    if (!acceptedLegal) {
      setAuthError(
        'Por favor acepta los Términos de Servicio y Habeas Data (+18) para ingresar.'
      );
      return;
    }
    setGoogleLoading(true);
    sessionStorage.removeItem('gmetrics_registration_pending');
    sessionStorage.setItem('gmetrics_oauth_in_progress', 'true');
    const { error } = await signInWithGoogleOAuth();
    if (error) {
      setGoogleLoading(false);
      setAuthError(error.message || 'Error al conectar con Google OAuth.');
    }
  };

  // Columna estandarizada (3 filas fijas de idéntica altura) para las Joyas del Día en el dock inferior
  const renderDockDuelColumn = (eyebrow: string, duel: FeaturedMarqueeDuel | null) => {
    if (!duel) {
      return (
        <div className="px-6 lg:px-10 py-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="h-4 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
            <span className="text-[#8b949e] truncate">{eyebrow}</span>
            <span className="shrink-0 text-[#8b949e]">
              {isLoadingDock ? 'SINCRONIZANDO' : 'EN ESPERA'}
            </span>
          </div>
          <div className="h-7 flex items-center min-w-0">
            <span className="text-[13px] font-medium text-[#8b949e] truncate">
              {isLoadingDock
                ? 'Cargando cartelera oficial en vivo...'
                : 'Sin partidos oficiales activos en esta jornada'}
            </span>
          </div>
          <div className="h-5 flex items-center justify-between gap-3 text-xs min-w-0">
            <span className="text-[#8b949e]/80 truncate">
              {isLoadingDock
                ? 'Consultando cuotas y proyecciones reales'
                : 'Ingresa para explorar los próximos 5 días'}
            </span>
            <span className="font-mono text-[11px] text-[#d9b114] shrink-0">Datos reales</span>
          </div>
        </div>
      );
    }

    const showScore =
      duel.isLive ||
      duel.statusText === 'FINAL' ||
      (duel.homeTeam.score !== undefined && duel.awayTeam.score !== undefined);

    return (
      <div className="px-6 lg:px-10 py-5 flex flex-col justify-between gap-2.5 min-w-0">
        {/* Fila 1: Eyebrow + estado horario (altura fija h-4) */}
        <div className="h-4 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
          <span className="text-[#8b949e] truncate">{eyebrow}</span>
          <span className={`shrink-0 font-semibold ${duel.isLive ? 'text-rose-400' : 'text-[#8b949e]'}`}>
            {duel.statusText}
          </span>
        </div>

        {/* Fila 2: Escudos + Equipos perfectamente alineados en 1 sola línea (altura fija h-7) */}
        <div className="h-7 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {duel.homeTeam.logo ? (
              <img
                src={duel.homeTeam.logo}
                alt={duel.homeTeam.shortName}
                className="w-5 h-5 object-contain shrink-0"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#161b22] border border-[#30363d] text-[9px] font-mono text-[#8b949e] flex items-center justify-center shrink-0">
                {duel.homeTeam.shortName.slice(0, 2)}
              </span>
            )}
            <span className="text-[13px] font-semibold text-white truncate">
              {duel.homeTeam.name || duel.homeTeam.shortName}
            </span>
          </div>

          <span className="font-mono text-[11px] font-semibold text-[#8b949e] shrink-0 px-1 tabular-nums">
            {showScore ? `${duel.homeTeam.score ?? 0} - ${duel.awayTeam.score ?? 0}` : 'vs'}
          </span>

          <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-white truncate text-right">
              {duel.awayTeam.name || duel.awayTeam.shortName}
            </span>
            {duel.awayTeam.logo ? (
              <img
                src={duel.awayTeam.logo}
                alt={duel.awayTeam.shortName}
                className="w-5 h-5 object-contain shrink-0"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#161b22] border border-[#30363d] text-[9px] font-mono text-[#8b949e] flex items-center justify-center shrink-0">
                {duel.awayTeam.shortName.slice(0, 2)}
              </span>
            )}
          </div>
        </div>

        {/* Fila 3: Pick + Cuota + Certeza en una sola línea (altura fija h-5) */}
        <div className="h-5 flex items-center justify-between gap-3 text-xs min-w-0">
          <span className="text-[#d9b114] font-medium truncate">
            {duel.topPick.label}
          </span>
          <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
            <span className="text-[11px] text-[#8b949e]">@{duel.topPick.odd.toFixed(2)}</span>
            <span className="text-[#00ff66] font-bold">{Math.round(duel.topPick.certainty)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-[100dvh] lg:h-[100dvh] lg:max-h-[100dvh] w-full bg-[#0b0e14] flex flex-col justify-between relative overflow-y-auto lg:overflow-hidden text-white font-sans select-none"
      style={{
        backgroundImage:
          'radial-gradient(640px 320px at 50% 42%, rgba(217, 177, 20, 0.085) 0%, rgba(11, 14, 20, 0) 72%)'
      }}
    >
      {/* ================= BARRA SUPERIOR LIMPIA (SIN CAJAS NI CÁPSULAS) ================= */}
      <header className="relative z-20 w-full px-6 sm:px-10 lg:px-14 pt-5 pb-3 flex items-center justify-between gap-4 shrink-0">
        {/* Logo y Tipografía Original de G METRICS (con 3 clics secretos para Admin) */}
        <div
          onClick={handleSecretLogoClick}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none transition-transform active:scale-98"
          title="G METRICS · La Ciencia Detrás de la Victoria"
        >
          <SportStatsLogo size="md" withGlow={false} />
          <div className="min-w-0 flex flex-col justify-center text-left">
            <span className="gmetrics-brand-title text-base sm:text-xl leading-none block whitespace-nowrap text-white">
              G METRICS
            </span>
            <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#d9b114] block whitespace-nowrap leading-none mt-1">
              LA CIENCIA DETRÁS DE LA VICTORIA
            </span>
          </div>
        </div>

        {/* Navegación limpia de texto plano */}
        <nav className="flex items-center gap-5 sm:gap-8 text-xs font-medium text-[#8b949e]">
          <button
            type="button"
            onClick={() => onOpenGuide?.('AUDIT')}
            className="hover:text-white transition-colors cursor-pointer text-[#d9b114] font-semibold"
          >
            Auditoría
          </button>
          <button
            type="button"
            onClick={() => onOpenGuide?.('GUIDE')}
            className="hidden sm:inline hover:text-white transition-colors cursor-pointer"
          >
            Análisis
          </button>
          <button
            type="button"
            onClick={() => onOpenGuide?.('GLOSSARY')}
            className="hidden sm:inline hover:text-white transition-colors cursor-pointer"
          >
            Glosario
          </button>
          <button
            type="button"
            onClick={() => onOpenGuide?.('LEGAL')}
            className="hidden md:inline hover:text-white transition-colors cursor-pointer"
          >
            Suscripción
          </button>
          <span className="hidden sm:inline text-[#21262d]" aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => onOpenGuide?.('LEGAL')}
            className="font-mono text-[11px] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
          >
            +18 Legal
          </button>
        </nav>
      </header>

      {/* ================= MONOLITO CENTRAL (ENFOQUE ÚNICO, CERO RECUADROS) ================= */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-8 sm:py-10 min-h-0">
        <p className="font-mono text-[10.5px] sm:text-[11px] uppercase tracking-[0.3em] text-[#d9b114]/90 mb-4 sm:mb-5">
          Software Cuantitativo · Fútbol &amp; NBA
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-semibold tracking-tighter leading-[1.04] text-white max-w-4xl">
          La ventaja matemática
          <span className="block text-[#d9b114] mt-1.5">antes del pitazo inicial.</span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-[#8b949e] max-w-lg leading-relaxed font-normal">
          Proyecciones probabilísticas auditadas en tiempo real. Sin ruido, sin corazonadas y sin sesgo humano.
        </p>

        {/* Acción principal refinada: Botón oficial de Google de alta precisión */}
        <div className="mt-9 flex flex-col items-center gap-4 w-full max-w-md">
          <button
            type="button"
            onClick={handleContinueWithGoogle}
            disabled={googleLoading}
            className="group relative inline-flex items-center justify-center gap-3.5 px-8 py-3.5 rounded-lg bg-white hover:bg-[#f4f5f7] active:scale-[0.99] text-[#0b0e14] font-semibold text-sm sm:text-[15px] tracking-tight transition-all duration-200 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.12)] hover:shadow-[0_14px_36px_-8px_rgba(217,177,20,0.28),0_0_0_1px_rgba(217,177,20,0.6)] cursor-pointer disabled:opacity-65 w-full sm:w-auto sm:min-w-[290px]"
          >
            <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            <ArrowRight
              className="w-4 h-4 text-[#6b7280] group-hover:text-[#0b0e14] group-hover:translate-x-0.5 transition-all shrink-0"
              strokeWidth={2}
            />
          </button>

          {/* Aceptación legal: SIEMPRE desmarcada por defecto, la marca el usuario */}
          <label className="flex items-center justify-center gap-2.5 text-xs text-[#8b949e] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => {
                const val = e.target.checked;
                setAcceptedLegal(val);
                if (val && authError) setAuthError(null);
              }}
              className="w-3.5 h-3.5 rounded border border-[#30363d] bg-[#0b0e14] accent-[#d9b114] cursor-pointer"
            />
            <span>
              Acepto{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenGuide?.('LEGAL');
                }}
                className="text-white underline underline-offset-4 decoration-[#30363d] hover:decoration-[#d9b114] hover:text-[#d9b114] transition-colors cursor-pointer"
              >
                Términos, Cookies y +18
              </button>
            </span>
          </label>

          {authError && (
            <div className="text-rose-400 text-xs flex items-center justify-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>{authError}</span>
            </div>
          )}
        </div>
      </main>

      {/* ================= DOCK INFERIOR ARQUITECTÓNICO (3 COLUMNAS ABIERTAS Y ALINEADAS) ================= */}
      <section
        aria-label="Resumen en vivo de proyecciones y auditoría"
        className="relative z-10 w-full border-t border-[#1e242e] shrink-0"
      >
        <div className="w-full grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1e242e]">
          {/* Columna 1: Joya Fútbol Hoy */}
          {renderDockDuelColumn('Joya Fútbol Hoy', topSoccerDuel)}

          {/* Columna 2: Joya NBA Hoy */}
          {renderDockDuelColumn('Joya NBA Hoy', topNbaDuel)}

          {/* Columna 3: Auditoría Verificada (idéntica estructura de 3 filas fijas h-4 / h-7 / h-5) */}
          <div className="px-6 lg:px-10 py-5 flex flex-col justify-between gap-2.5 min-w-0">
            <div className="h-4 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
              <span className="text-[#8b949e] truncate">Auditoría Verificada</span>
              <span className="shrink-0 text-[#8b949e]">SEM {weekInfo.weekNo}</span>
            </div>

            <div className="h-7 flex items-baseline gap-2 min-w-0">
              <span className="font-mono text-2xl font-bold text-[#00ff66] leading-none tabular-nums">
                {auditSummary.totalPicksAudited > 0 ? `${auditSummary.globalAccuracy}%` : '—'}
              </span>
              <span className="text-[13px] font-semibold text-white truncate">
                {auditSummary.totalPicksAudited > 0 ? 'Acierto real auditado' : 'Sincronizando auditoría...'}
              </span>
            </div>

            <div className="h-5 flex items-center justify-between gap-3 text-xs min-w-0">
              <span className="text-[#8b949e] truncate">
                {auditSummary.totalPicksAudited > 0
                  ? `${auditSummary.totalPicksWon}/${auditSummary.totalPicksAudited} partidos oficiales verificados`
                  : 'Evaluando resultados oficiales ESPN'}
              </span>
              <button
                type="button"
                onClick={() => onOpenGuide?.('AUDIT')}
                className="font-mono text-[11px] text-[#d9b114] hover:underline shrink-0 cursor-pointer"
              >
                Ver historial →
              </button>
            </div>
          </div>
        </div>

        {/* Pie legal ultra-discreto en 1 línea */}
        <footer className="w-full border-t border-[#1e242e]/60 px-6 py-2 text-center">
          <p className="text-[10px] text-[#8b949e] leading-none">
            <span className="font-bold text-white">+18</span> ·{' '}
            <span className="gmetrics-brand-title text-[10px] text-white">G METRICS</span> es software de
            análisis estadístico cuantitativo. No somos casa de apuestas ni captamos fondos.
          </p>
        </footer>
      </section>

      {/* Overlay Unificado G METRICS durante conexión con Google OAuth */}
      {googleLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b0e14] transition-opacity duration-300 select-none">
          <img
            src="/icon.png?v=4"
            alt="G METRICS"
            className="w-[72px] h-[72px] object-contain mb-3.5 drop-shadow-[0_0_18px_rgba(217,177,20,0.45)]"
          />
          <div className="gmetrics-dark-pulse">G METRICS</div>
          <p className="mt-2.5 text-xs text-[#8b949e] font-medium tracking-wide text-center px-6">
            Verificando credenciales de acceso seguro...
          </p>
        </div>
      )}
    </div>
  );
};
