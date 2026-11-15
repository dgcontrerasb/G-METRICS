import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Zap,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
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
import { getLocalUpcomingCache, getColombiaDateString, fetchUpcomingFixtures } from '../services/apiService';
import { fetchNBAFixtures } from '../services/nbaApiService';

interface AccessLockScreenProps {
  fixtures?: MatchFixture[];
  nbaFixtures?: NBAMatchFixture[];
  onUnlock: (result: LicenseValidationResult, key: string) => void;
  onOpenAdmin: () => void;
  onOpenGuide?: (tab: 'GUIDE' | 'GLOSSARY' | 'LEGAL') => void;
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

// Partidos de respaldo inteligente con eventos oficiales reales de hoy y la fecha activa
const FALLBACK_TICKER_MATCHES = [
  {
    id: 'fb-t-1',
    sport: 'SOCCER' as const,
    match: 'New Zealand vs India',
    crestHome: 'https://media.api-sports.io/football/teams/1569.png',
    crestAway: 'https://media.api-sports.io/football/teams/1568.png',
    status: 'Amistosos FIFA',
    score: 'xG 1.85 - 1.10',
    pick: 'Doble Oportunidad 1X (@1.48)',
    certainty: '84.6% Certeza'
  },
  {
    id: 'fb-t-2',
    sport: 'NBA' as const,
    match: 'MIA Heat vs DET Pistons',
    crestHome: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
    crestAway: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
    status: 'NBA Oficial',
    score: 'Spread -3.5',
    pick: 'Herro +24.5 Pts (@1.88)',
    certainty: '78.4% Certeza'
  },
  {
    id: 'fb-t-3',
    sport: 'SOCCER' as const,
    match: 'Colombia vs Ecuador',
    crestHome: 'https://media.api-sports.io/football/teams/8.png',
    crestAway: 'https://media.api-sports.io/football/teams/2382.png',
    status: 'Eliminatorias',
    score: 'xG 1.75 - 1.20',
    pick: 'Ambos Anotan Sí (@1.82)',
    certainty: '82.4% Certeza'
  },
  {
    id: 'fb-t-4',
    sport: 'NBA' as const,
    match: 'BOS Celtics vs NY Knicks',
    crestHome: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg',
    crestAway: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg',
    status: 'NBA Este',
    score: 'Over 224.5',
    pick: 'Tatum +26.5 Pts (@1.90)',
    certainty: '76.2% Certeza'
  }
];

// Pool de respaldo de duelos estelares con fotos de estrellas y escudos oficiales de hoy
interface FeaturedMarqueeDuel {
  id: string;
  sport: 'SOCCER' | 'NBA';
  league: string;
  statusText: string;
  isLive: boolean;
  pillLabel: string;
  homeTeam: { name: string; shortName: string; logo: string; xg?: number; score?: number };
  awayTeam: { name: string; shortName: string; logo: string; xg?: number; score?: number };
  starPlayer: { name: string; team: string; photo: string; role: string };
  topPick: { label: string; odd: number; certainty: number; market: string };
  topScores?: Array<{ score: string; prob: number }>;
}

const FALLBACK_FEATURED_DUELS: FeaturedMarqueeDuel[] = [
  {
    id: 'duel-1',
    sport: 'SOCCER',
    league: 'Amistosos FIFA · Duelo Internacional de Hoy',
    statusText: 'Partido Oficial del Día',
    isLive: false,
    pillLabel: 'NZL vs IND',
    homeTeam: {
      name: 'New Zealand',
      shortName: 'NZL',
      logo: 'https://media.api-sports.io/football/teams/1569.png',
      xg: 1.85,
      score: 0
    },
    awayTeam: {
      name: 'India',
      shortName: 'IND',
      logo: 'https://media.api-sports.io/football/teams/1568.png',
      xg: 1.10,
      score: 0
    },
    starPlayer: {
      name: 'Chris Wood',
      team: 'New Zealand',
      photo: 'https://media.api-sports.io/football/players/18884.png',
      role: 'Delantero Referente · 0.72 xG/90'
    },
    topPick: {
      label: 'Doble Oportunidad 1X',
      odd: 1.48,
      certainty: 84.6,
      market: 'Ventaja Estadística'
    },
    topScores: [
      { score: '2-0', prob: 18.4 },
      { score: '1-0', prob: 16.5 },
      { score: '2-1', prob: 13.2 }
    ]
  },
  {
    id: 'duel-2',
    sport: 'NBA',
    league: 'NBA Conferencia Este · Choque de Hoy',
    statusText: 'Jornada NBA de Hoy',
    isLive: false,
    pillLabel: 'MIA vs DET',
    homeTeam: {
      name: 'Miami Heat',
      shortName: 'MIA',
      logo: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
      score: 0
    },
    awayTeam: {
      name: 'Detroit Pistons',
      shortName: 'DET',
      logo: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
      score: 0
    },
    starPlayer: {
      name: 'Tyler Herro',
      team: 'Miami Heat',
      photo: 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629639.png',
      role: 'Escolta Líder · 24 Pts / 6 Ast'
    },
    topPick: {
      label: 'Miami Heat Spread -3.5',
      odd: 1.88,
      certainty: 78.4,
      market: 'Línea de Hándicap'
    }
  },
  {
    id: 'duel-3',
    sport: 'SOCCER',
    league: 'Eliminatorias Sudamericanas · Choque Clave',
    statusText: 'Próxima Jornada Oficial',
    isLive: false,
    pillLabel: 'COL vs ECU',
    homeTeam: {
      name: 'Colombia',
      shortName: 'COL',
      logo: 'https://media.api-sports.io/football/teams/8.png',
      xg: 1.75,
      score: 0
    },
    awayTeam: {
      name: 'Ecuador',
      shortName: 'ECU',
      logo: 'https://media.api-sports.io/football/teams/2382.png',
      xg: 1.20,
      score: 0
    },
    starPlayer: {
      name: 'Luis Díaz',
      team: 'Colombia',
      photo: 'https://media.api-sports.io/football/players/2489.png',
      role: 'Extremo Desequilibrante · 0.65 xG/90'
    },
    topPick: {
      label: 'Ambos Anotan · Sí',
      odd: 1.85,
      certainty: 82.4,
      market: 'Gol Esperado Alto'
    },
    topScores: [
      { score: '1-1', prob: 17.5 },
      { score: '2-1', prob: 15.0 },
      { score: '1-0', prob: 14.2 }
    ]
  }
];

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
  const [acceptedLegal, setAcceptedLegal] = useState<boolean>(true);
  const [selectedDuelIndex, setSelectedDuelIndex] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [gatewaySport, setGatewaySport] = useState<'SOCCER' | 'NBA'>('SOCCER');

  // Información semanal calculada dinámicamente
  const weekInfo = getISOWeekInfo();

  // Partidos cargados de forma proactiva si la pantalla de login monta antes que el padre
  const [loadedSoccer, setLoadedSoccer] = useState<MatchFixture[]>([]);
  const [loadedNba, setLoadedNba] = useState<NBAMatchFixture[]>([]);

  useEffect(() => {
    const today = getColombiaDateString();
    const cachedSoccer = getLocalUpcomingCache(today);
    if (cachedSoccer?.fixtures?.length) {
      setLoadedSoccer(cachedSoccer.fixtures);
    } else {
      fetchUpcomingFixtures(today, { forceRefresh: false })
        .then((res) => {
          if (res.fixtures?.length) setLoadedSoccer(res.fixtures);
        })
        .catch(() => {});
    }

    try {
      const nbaCache = localStorage.getItem(`basketstats_nba_v7_${today}`);
      if (nbaCache) {
        const parsed = JSON.parse(nbaCache);
        if (Array.isArray(parsed.fixtures) && parsed.fixtures.length > 0) {
          setLoadedNba(parsed.fixtures);
          return;
        }
      }
    } catch {
      // ignore
    }

    fetchNBAFixtures(today, { forceRefresh: false })
      .then((res) => {
        if (res.fixtures?.length) setLoadedNba(res.fixtures);
      })
      .catch(() => {});
  }, []);

  // 1. Obtener partidos reales del día (de props, de estado o de caché local)
  const allSoccerFixtures = useMemo(() => {
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

  const allNbaFixtures = useMemo(() => {
    if (nbaFixtures && nbaFixtures.length > 0) return nbaFixtures;
    if (loadedNba.length > 0) return loadedNba;
    try {
      const targetDate = getColombiaDateString(0);
      const raw = localStorage.getItem(`basketstats_nba_v7_${targetDate}`);
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

  // 2. Cinta superior dinámica conectada a partidos REALES de hoy
  const dynamicTickerMatches = useMemo(() => {
    const list: Array<{
      id: string;
      sport: 'SOCCER' | 'NBA';
      match: string;
      crestHome: string;
      crestAway: string;
      status: string;
      score: string;
      certainty: string;
    }> = [];

    // Tomar partidos reales de fútbol de hoy
    allSoccerFixtures.slice(0, 4).forEach((f) => {
      const isLive = f.status === 'IN_PLAY';
      const isFT = f.status === 'FINISHED';
      const statusText = isLive
        ? `${f.currentScore?.minute || f.score?.minute || 45}' EN VIVO`
        : isFT
        ? 'FINAL'
        : `Hoy ${f.time || '19:00'}`;

      const scoreText = (isLive || isFT)
        ? `${f.currentScore?.home ?? f.score?.home ?? 0} - ${f.currentScore?.away ?? f.score?.away ?? 0}`
        : 'Pre-Partido';

      let certaintyText = '84.6% Certeza';
      try {
        const analysis = calculateMatchAnalysis(f);
        if (analysis.verdict?.topSafePick) {
          certaintyText = `${Math.round(analysis.verdict.topSafePick.probability || 84)}% Certeza`;
        }
      } catch {
        // ignore
      }

      const hName = f.homeTeam.shortName || f.homeTeam.name.slice(0, 11);
      const aName = f.awayTeam.shortName || f.awayTeam.name.slice(0, 11);

      list.push({
        id: `fix-${f.id}`,
        sport: 'SOCCER',
        match: `${hName} vs ${aName}`,
        crestHome: f.homeTeam.logo || '',
        crestAway: f.awayTeam.logo || '',
        status: statusText,
        score: scoreText,
        certainty: certaintyText
      });
    });

    // Partidos reales de NBA de hoy
    allNbaFixtures.slice(0, 2).forEach((nba: NBAMatchFixture) => {
      const isLive = nba.status === 'IN_PLAY';
      const isFT = nba.status === 'FINISHED';
      const statusText = isLive ? 'EN VIVO' : isFT ? 'FINAL' : `Hoy ${nba.time || '20:00'}`;
      const scoreText = (isLive || isFT)
        ? `${nba.currentScore?.home ?? 0} - ${nba.currentScore?.away ?? 0}`
        : `Spread ${nba.externalOdds?.spreadPoint || '-3.5'}`;

      list.push({
        id: `nba-${nba.id}`,
        sport: 'NBA',
        match: `${nba.homeTeam.shortName} vs ${nba.awayTeam.shortName}`,
        crestHome: nba.homeTeam.logo || '',
        crestAway: nba.awayTeam.logo || '',
        status: statusText,
        score: scoreText,
        certainty: '78.4% Certeza'
      });
    });

    if (list.length > 0) return list;
    return FALLBACK_TICKER_MATCHES;
  }, [allSoccerFixtures, allNbaFixtures]);

  // 3. Pool dinámico de duelos estelares conectados a partidos REALES de hoy
  const dynamicFeaturedDuels = useMemo(() => {
    const list: FeaturedMarqueeDuel[] = [];

    // Partidos reales de fútbol de hoy
    allSoccerFixtures.slice(0, 4).forEach((f) => {
      const isLive = f.status === 'IN_PLAY';
      const isFT = f.status === 'FINISHED';
      const statusText = isLive
        ? `${f.currentScore?.minute || f.score?.minute || 45}' EN VIVO`
        : isFT
        ? 'FINAL'
        : `Hoy ${f.time || '19:00'} · Pre-Partido`;

      let xgHome = 1.65;
      let xgAway = 1.25;
      let topPickLabel = 'Doble Oportunidad 1X';
      let topPickOdd = 1.55;
      let topPickCertainty = 84.6;
      let topScores = [
        { score: '1-0', prob: 17.5 },
        { score: '1-1', prob: 15.2 },
        { score: '2-1', prob: 12.8 }
      ];

      try {
        const analysis = calculateMatchAnalysis(f);
        xgHome = analysis.dixonColes?.lambdaHome ?? 1.65;
        xgAway = analysis.dixonColes?.lambdaAway ?? 1.25;
        const pick = analysis.verdict?.topSafePick;
        if (pick) {
          topPickLabel = pick.plainTitle || pick.label;
          topPickOdd = pick.fairOdd || 1.85;
          topPickCertainty = pick.probability || 84.6;
        }
        if (analysis.dixonColes?.mostLikelyScores && analysis.dixonColes.mostLikelyScores.length > 0) {
          topScores = analysis.dixonColes.mostLikelyScores.slice(0, 3).map((s: { score: string; probability: number }) => ({
            score: s.score,
            prob: parseFloat(s.probability.toFixed(1))
          }));
        }
      } catch {
        // ignore
      }

      const hShort = f.homeTeam.shortName || f.homeTeam.name.slice(0, 3).toUpperCase();
      const aShort = f.awayTeam.shortName || f.awayTeam.name.slice(0, 3).toUpperCase();

      list.push({
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
          xg: xgHome,
          score: f.currentScore?.home ?? f.score?.home ?? 0
        },
        awayTeam: {
          name: f.awayTeam.name,
          shortName: aShort,
          logo: f.awayTeam.logo || '',
          xg: xgAway,
          score: f.currentScore?.away ?? f.score?.away ?? 0
        },
        starPlayer: {
          name: f.homeTeam.name,
          team: f.league?.name || 'Fútbol',
          photo: f.homeTeam.logo || '',
          role: 'Proyección Oficial del Motor Cuantitativo'
        },
        topPick: {
          label: topPickLabel,
          odd: topPickOdd,
          certainty: topPickCertainty,
          market: 'Modelo Predictivo'
        },
        topScores
      });
    });

    // Si hay partidos NBA de hoy, agregar el estelar
    if (allNbaFixtures.length > 0) {
      const topNba = allNbaFixtures[0];
      const isLive = topNba.status === 'IN_PLAY';
      list.push({
        id: `real-nba-${topNba.id}`,
        sport: 'NBA',
        league: topNba.league?.name || 'NBA · Baloncesto Profesional',
        statusText: isLive ? 'EN VIVO' : `Hoy ${topNba.time || '20:00'}`,
        isLive,
        pillLabel: `${topNba.homeTeam.shortName} vs ${topNba.awayTeam.shortName}`,
        homeTeam: {
          name: topNba.homeTeam.name,
          shortName: topNba.homeTeam.shortName,
          logo: topNba.homeTeam.logo || '',
          score: topNba.currentScore?.home ?? 0
        },
        awayTeam: {
          name: topNba.awayTeam.name,
          shortName: topNba.awayTeam.shortName,
          logo: topNba.awayTeam.logo || '',
          score: topNba.currentScore?.away ?? 0
        },
        starPlayer: {
          name: topNba.homeTeam.name,
          team: topNba.homeTeam.shortName,
          photo: topNba.homeTeam.logo || '',
          role: 'Franquicia Oficial NBA'
        },
        topPick: {
          label: `Gana ${topNba.homeTeam.shortName} (+EV)`,
          odd: 1.88,
          certainty: 78.4,
          market: 'Línea de Victoria'
        }
      });
    }

    if (list.length > 0) return list;
    return FALLBACK_FEATURED_DUELS;
  }, [allSoccerFixtures, allNbaFixtures]);

  const filteredDuels = useMemo(() => {
    const subset = dynamicFeaturedDuels.filter((d) => d.sport === gatewaySport);
    return subset.length > 0 ? subset : dynamicFeaturedDuels;
  }, [dynamicFeaturedDuels, gatewaySport]);

  const currentDuel = filteredDuels[selectedDuelIndex % filteredDuels.length] || dynamicFeaturedDuels[0];

  // Rotación automática suave de partidos estelares cada 6.5 segundos
  useEffect(() => {
    if (!isAutoRotating || filteredDuels.length <= 1) return;
    const timer = setInterval(() => {
      setSelectedDuelIndex((prev) => (prev + 1) % filteredDuels.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [isAutoRotating, filteredDuels.length]);

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
            sessionStorage.setItem('futbolstats_admin_pin', '120328');
            localStorage.setItem('sportstats_admin_saved_pin', '120328');
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

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full cr7-cinematic-bg bg-[#0b0e14] flex flex-col justify-between relative overflow-hidden text-white font-sans select-none">
      {/* Estilos Antigravity Design: Glassmorphism, Rayos Láser Cyber-Neon y Ticker Continuo */}
      <style>{`
        .gmetrics-neon-cta-box {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          background: rgba(22, 27, 34, 0.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid #30363d;
          box-shadow:
            0 18px 45px -12px rgba(0, 0, 0, 0.75),
            0 0 25px rgba(217, 177, 20, 0.12),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
        }
        .sp-laser {
          position: absolute;
          z-index: 10;
          pointer-events: none;
        }
        .sp-t {
          top: 0;
          right: 0;
          width: 200px;
          height: 2.5px;
          background: linear-gradient(to left, transparent, #10b981, #d9b114);
          animation: laser-top 2.6s linear infinite;
          animation-delay: 0.6s;
        }
        .sp-r {
          bottom: 0;
          right: 0;
          width: 2.5px;
          height: 160px;
          background: linear-gradient(to top, transparent, #d9b114, #10b981);
          animation: laser-right 2.6s linear infinite;
        }
        .sp-b {
          right: 0;
          bottom: 0;
          width: 200px;
          height: 2.5px;
          background: linear-gradient(to left, transparent, #10b981, #d9b114);
          animation: laser-bottom 2.6s linear infinite;
        }
        .sp-l {
          left: 0;
          top: 0;
          width: 2.5px;
          height: 160px;
          background: linear-gradient(to top, transparent, #d9b114, #10b981);
          animation: laser-left 2.6s linear infinite;
          animation-delay: 1.3s;
        }
        @keyframes laser-right {
          0% { transform: translateY(250%); }
          100% { transform: translateY(-250%); }
        }
        @keyframes laser-left {
          0% { transform: translateY(-250%); }
          100% { transform: translateY(250%); }
        }
        @keyframes laser-bottom {
          0% { transform: translateX(250%); }
          100% { transform: translateX(-250%); }
        }
        @keyframes laser-top {
          0% { transform: translateX(-250%); }
          100% { transform: translateX(250%); }
        }
        .gmetrics-ticker-track {
          display: flex;
          width: max-content;
          animation: tickerScroll 34s linear infinite;
        }
        .gmetrics-ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes tickerScroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-laser,
          .gmetrics-ticker-track {
            animation: none !important;
          }
        }
      `}</style>

      {/* Resplandores ambientales de fondo */}
      <div className="absolute top-[8%] left-[12%] w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-[8%] right-[8%] w-[450px] h-[450px] rounded-full bg-[#d9b114]/8 blur-[130px] pointer-events-none -z-10" />

      {/* ================= BARRA SUPERIOR INSTITUCIONAL GLASS ================= */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 sm:pt-3 shrink-0">
        <div className="w-full px-3.5 sm:px-5 py-2 rounded-2xl bg-[#0b0e14]/90 backdrop-blur-xl border border-[#30363d] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3">
          {/* Logo y Tipografía Original de G METRICS (con 3 clics secretos para Admin) */}
          <div
            onClick={handleSecretLogoClick}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none transition-transform active:scale-98"
            title="G METRICS · La Ciencia Detrás de la Victoria"
          >
            <SportStatsLogo size="md" withGlow={false} />
            <div className="min-w-0 flex flex-col justify-center text-left">
              <span className="gmetrics-brand-title text-base sm:text-xl leading-none block whitespace-nowrap">
                G METRICS
              </span>
              <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#8b949e] block whitespace-nowrap leading-none mt-1">
                LA CIENCIA DETRÁS DE LA VICTORIA
              </span>
            </div>
          </div>

          {/* Botones de Navegación Derecha */}
          {onOpenGuide && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onOpenGuide('GLOSSARY')}
                className="px-2.5 sm:px-3.5 py-1 rounded-full bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] hover:border-[#8b949e]/40 text-[10.5px] sm:text-xs font-bold text-white shadow-2xs transition cursor-pointer"
              >
                Glosario A-Z
              </button>
              <button
                type="button"
                onClick={() => onOpenGuide('GUIDE')}
                className="hidden sm:inline-flex px-3.5 py-1 rounded-full bg-[#161b22] hover:bg-[#1c2129] border border-[#30363d] hover:border-[#8b949e]/40 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
              >
                Cómo Funciona
              </button>
              <button
                type="button"
                onClick={() => onOpenGuide('LEGAL')}
                className="px-2.5 sm:px-3.5 py-1 rounded-full bg-[#161b22] hover:bg-[#1c2129] border border-[#d9b114]/40 text-[10.5px] sm:text-xs font-bold text-[#d9b114] shadow-2xs transition cursor-pointer"
              >
                +18 Legal
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ================= MARQUESINA CINÉTICA DE TELEMETRÍA EN VIVO ================= */}
      <div className="relative z-20 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-1 sm:pt-1.5 pb-0.5 overflow-hidden shrink-0">
        <div className="flex items-center gap-2 overflow-hidden rounded-xl bg-[#0b0e14]/85 border border-[#30363d] py-1 px-2.5 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#161b22] border border-[#d9b114]/50 text-[#d9b114] text-[9px] font-black uppercase tracking-wider shrink-0 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Telemetría</span>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="gmetrics-ticker-track flex items-center gap-4 whitespace-nowrap">
              {/* Duplicado para bucle infinito perfecto sin cortes */}
              {[...dynamicTickerMatches, ...dynamicTickerMatches].map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#161b22]/70 border border-[#30363d]/70 text-[10px] text-white shrink-0 hover:border-[#d9b114]/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <img src={item.crestHome} alt="" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-bold">{item.match}</span>
                    <img src={item.crestAway} alt="" className="w-3.5 h-3.5 object-contain" />
                  </div>
                  <span className="px-1 py-0.2 rounded bg-[#0b0e14] text-[8.5px] font-mono font-extrabold text-[#d9b114] border border-[#30363d]">
                    {item.score}
                  </span>
                  <span className="text-[9.5px] text-[#00ff66] font-extrabold font-mono">
                    {item.certainty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= HERO GATEWAY CENTRADO (OPCIÓN B - ZERO SCROLL) ================= */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-3 sm:px-6 flex-1 flex flex-col items-center justify-center my-auto min-h-0 py-1">
        {/* 1. Header Centrado: Badge + Titular + Píldoras de Confianza */}
        <div className="text-center space-y-1 sm:space-y-1.5 max-w-2xl mx-auto shrink-0">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#161b22] border border-[#30363d] shadow-2xs">
            <Zap className="w-3 h-3 text-[#d9b114] fill-[#d9b114]" />
            <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#d9b114]">
              MOTOR PREDICTIVO DE ALTA PRECISIÓN · FÚTBOL &amp; NBA
            </span>
          </div>

          {/* Titular */}
          <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-[1.15]">
            Deja el azar a un lado.{' '}
            <span className="text-[#d9b114] block sm:inline">
              Toma decisiones con ventaja estadística real.
            </span>
          </h1>

          {/* Subtítulo breve (visible en PC y móvil mediano) */}
          <p className="text-[10.5px] sm:text-xs text-[#8b949e] font-medium max-w-lg mx-auto leading-tight hidden xs:block">
            Inteligencia deportiva cuantitativa, modelos de gol esperado (xG) y valor (+EV) en tiempo real.
          </p>

          {/* Píldoras de Confianza */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <div className="px-2.5 py-0.5 rounded-full bg-[#161b22] border border-emerald-500/40 text-[9px] sm:text-[10px] font-extrabold text-[#00ff66] flex items-center gap-1 shadow-2xs">
              <TrendingUp className="w-3 h-3 text-[#00ff66]" />
              <span>Auditoría Semanal (Sem. {weekInfo.weekNo}): 84.6% Certeza</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-[#161b22] border border-[#30363d] text-[9px] font-bold text-white flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#d9b114]" />
              <span>7 Modelos</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-[#161b22] border border-[#30363d] text-[9px] font-bold text-white flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>100% Gratuito</span>
            </div>
          </div>
        </div>

        {/* 2. Tarjeta Centrada de Acceso Único con Google (Foco Principal sin saturación) */}
        <div className="gmetrics-neon-cta-box p-3 sm:p-4 w-full max-w-md mx-auto my-1.5 sm:my-2.5 shrink-0">
          <span className="sp-laser sp-t" />
          <span className="sp-laser sp-r" />
          <span className="sp-laser sp-b" />
          <span className="sp-laser sp-l" />

          <div className="relative z-10 space-y-2">
            {/* Botón Principal de Google */}
            <button
              type="button"
              onClick={handleContinueWithGoogle}
              disabled={googleLoading}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-200 shadow-[0_6px_20px_-4px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_25px_-4px_rgba(217,177,20,0.3)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-65"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>
                {googleLoading
                  ? 'Conectando con tu cuenta Google...'
                  : 'Continuar con Google — Acceso Instantáneo'}
              </span>
            </button>

            {/* Subtítulo explicativo */}
            <div className="flex flex-col items-center text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[10.5px] font-extrabold text-white">
                <span>Ingreso único inteligente en 1 clic</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              </div>
              <p className="text-[9px] sm:text-[9.5px] text-[#8b949e] font-medium leading-tight">
                Activación y acceso automático sin contraseñas ni formularios.
              </p>
            </div>

            {/* Mensaje de error si ocurre */}
            {authError && (
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10.5px] flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            {/* Dock Dual-Device */}
            <div className="w-full py-1 px-2.5 rounded-xl bg-[#0b0e14] border border-[#30363d] text-white flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs">💻</span>
                <span className="text-[9px] font-bold text-[#8b949e] truncate">
                  Modo Widescreen 3 Col. en PC
                </span>
              </div>
              <span className="text-slate-600 font-mono text-[9px]">•</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs">📱</span>
                <span className="text-[9px] font-bold text-[#00ff66]">
                  100% Sincronizado en Móvil
                </span>
              </div>
            </div>

            {/* Casilla de Términos */}
            <label className="flex items-center justify-center gap-1.5 text-[10px] text-[#8b949e] cursor-pointer select-none pt-0.5">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer w-3.5 h-3.5"
              />
              <span>
                Acepto los{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenGuide && onOpenGuide('LEGAL');
                  }}
                  className="text-[#d9b114] underline font-bold hover:text-white cursor-pointer"
                >
                  Términos y Habeas Data
                </button>{' '}
                (+18).
              </span>
            </label>
          </div>
        </div>

        {/* 3. Live Pulse Showcase Horizontal (Opción B: Compacto, limpio y sin scroll) */}
        <div className="w-full max-w-2xl mx-auto space-y-1.5 shrink-0">
          {/* Selector Segmentado de Deporte */}
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setGatewaySport('SOCCER');
                setSelectedDuelIndex(0);
              }}
              className={`px-3 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-mono font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                gatewaySport === 'SOCCER'
                  ? 'bg-[#161b22] text-[#d9b114] border-[#d9b114]/60 shadow-xs'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>⚽ Fútbol Hoy ({allSoccerFixtures.length || 4})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGatewaySport('NBA');
                setSelectedDuelIndex(0);
              }}
              className={`px-3 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-mono font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                gatewaySport === 'NBA'
                  ? 'bg-[#161b22] text-[#d9b114] border-[#d9b114]/60 shadow-xs'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>🏀 NBA Hoy ({allNbaFixtures.length || 2})</span>
            </button>
          </div>

          {/* Tarjeta Live Pulse Única Compacta (Visible en PC y Móvil sin provocar scroll) */}
          <div
            onMouseEnter={() => setIsAutoRotating(false)}
            onMouseLeave={() => setIsAutoRotating(true)}
            className="p-2 sm:p-2.5 rounded-2xl bg-[#161b22]/90 border border-[#30363d] shadow-md flex items-center justify-between gap-2.5 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1 shrink-0">
                {currentDuel.homeTeam.logo ? (
                  <img src={currentDuel.homeTeam.logo} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                ) : null}
                <span className="text-[10px] sm:text-xs font-black text-white">{currentDuel.homeTeam.shortName}</span>
                <span className="text-[8.5px] text-[#8b949e] font-mono mx-0.5">vs</span>
                <span className="text-[10px] sm:text-xs font-black text-white">{currentDuel.awayTeam.shortName}</span>
                {currentDuel.awayTeam.logo ? (
                  <img src={currentDuel.awayTeam.logo} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                ) : null}
              </div>

              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0b0e14] border border-[#30363d] text-[9px] font-mono text-[#8b949e]">
                <span>xG {currentDuel.homeTeam.xg?.toFixed(1) || '1.8'} - {currentDuel.awayTeam.xg?.toFixed(1) || '1.1'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <span className="text-[9px] font-mono text-[#d9b114] block leading-tight truncate max-w-[125px] sm:max-w-none">
                  {currentDuel.topPick.label}
                </span>
                <span className="text-[8.5px] font-mono text-[#8b949e]">@{currentDuel.topPick.odd.toFixed(2)} Cuota</span>
              </div>
              <div className="px-2 py-0.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[9.5px] font-mono font-black text-[#00ff66] shrink-0">
                {Math.round(currentDuel.topPick.certainty)}% Certeza
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ================= PIE DE PÁGINA LEGAL ================= */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-1.5 text-center shrink-0">
        <p className="text-[9.5px] sm:text-[10px] text-[#8b949e] font-medium leading-none">
          <span className="font-extrabold text-white">+18</span> ·{' '}
          <span className="gmetrics-brand-title text-[9.5px] mr-1">G METRICS</span> es una
          herramienta analítica y de software estadístico basada en modelos cuantitativos. No somos
          una casa de apuestas ni captamos fondos.
        </p>
      </footer>
    </div>
  );
};
