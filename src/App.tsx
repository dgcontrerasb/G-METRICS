import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MatchFixture, MatchAnalysis, ActiveSport, NBAMatchFixture, NBAAnalysis } from './types';
import { fetchUpcomingFixtures, getColombiaDateString, syncLivePulseFixtures, fetchMatchLiveTelemetry, sanitizeFixturePlayers } from './services/apiService';
import { calculateMatchAnalysis, clearAnalysisCacheForFixture } from './services/mathEngine';
import { fetchNBAFixtures } from './services/nbaApiService';
import { calculateNBAAnalysis } from './services/nbaEngine';
import {
  exportToExcel,
  exportToPDF,
  ExportItem,
  exportNBAToExcel,
  exportNBAToPDF,
  NBAExportItem
} from './services/exportService';
import { FriendlyPredictionCard } from './components/FriendlyPredictionCard';
import { CompactMatchRow } from './components/CompactMatchRow';
import { CompetitionBlock } from './components/CompetitionBlock';
import { NBAPredictionCard } from './components/NBAPredictionCard';
import { CompactNBAMatchRow } from './components/CompactNBAMatchRow';
import { DetailMatchPayload } from './components/MatchDetailModal';
import { GuideModalTab } from './components/DidacticGuideModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccessLockScreen } from './components/AccessLockScreen';
import { SubscriptionAlertBanner } from './components/SubscriptionAlertBanner';
import { MobileBottomNav, MobileTab } from './components/MobileBottomNav';
import { MainAppHeader } from './components/MainAppHeader';
import { SoccerFilterBar, SoccerFilterType } from './components/SoccerFilterBar';
import { NBAFilterBar, NBAFilterType } from './components/NBAFilterBar';
import { AppFooter } from './components/AppFooter';
import { AppModalsContainer } from './components/AppModalsContainer';
import { useTheme } from './context/ThemeContext';
import { getSoccerDidacticAdvice, getNBADidacticAdvice } from './services/didacticService';
import { groupFixturesByCompetition, matchesLeagueSelection, isColombianBookmakerPrimeLeague } from './services/leagueCategorizer';
import {
  getActiveStoredLicense,
  getOrCreateDeviceId,
  verifyLicenseToken,
  clearActiveLicense,
  LicenseValidationResult
} from './services/licenseService';
import {
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckSquare,
  Square,
  Clock,
  Filter,
  Layers,
  X,
  Zap,
  Sparkles,
  Flame,
  LayoutGrid,
  List
} from 'lucide-react';

export default function App() {
  // License & Access Control State
  const [isAppUnlocked, setIsAppUnlocked] = useState<boolean>(() => {
    try {
      const active = getActiveStoredLicense();
      if (!active) return false;
      const devId = getOrCreateDeviceId();
      const check = verifyLicenseToken(active.key, devId);
      return check.isValid;
    } catch {
      return false;
    }
  });

  const [activeLicenseInfo, setActiveLicenseInfo] = useState<LicenseValidationResult | null>(() => {
    try {
      const active = getActiveStoredLicense();
      if (!active) return null;
      const devId = getOrCreateDeviceId();
      const check = verifyLicenseToken(active.key, devId);
      return check.isValid ? check : null;
    } catch {
      return null;
    }
  });

  const { paletteConfig, theme } = useTheme();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('MATCHES');

  const handleLogoutSession = useCallback(() => {
    try {
      clearActiveLicense();
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_client_name');
      sessionStorage.removeItem('futbolstats_admin_pin');
      sessionStorage.removeItem('sportstats_exp_alert_dismissed');
    } catch {
      // ignore storage errors
    }
    setIsAdminModalOpen(false);
    setActiveLicenseInfo(null);
    setIsAppUnlocked(false);
    window.location.reload();
  }, []);

  // Active sport switcher: Soccer vs NBA
  const [activeSport, setActiveSport] = useState<ActiveSport>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_active_sport');
      return saved === 'NBA' || saved === 'SOCCER' ? (saved as ActiveSport) : 'SOCCER';
    } catch {
      return 'SOCCER';
    }
  });

  const handleSelectSport = (sport: ActiveSport) => {
    setActiveSport(sport);
    setSelectedFixtureIds(new Set());
    try {
      localStorage.setItem('futbolstats_active_sport', sport);
    } catch {
      // ignore
    }
  };

  const [currentDate, setCurrentDate] = useState<string>(getColombiaDateString(0));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selection for downloads
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<string>>(new Set());

  // Secret 3-click logo detector for Admin Panel
  const secretAdminTapCountRef = useRef(0);
  const secretAdminTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretAdminLogoClick = () => {
    // Si ya está autenticado como administrador, abrir con 1 solo clic
    if (localStorage.getItem('sportstats_admin_remember') === 'true') {
      setIsAdminModalOpen(true);
      return;
    }

    secretAdminTapCountRef.current += 1;
    if (secretAdminTapCountRef.current >= 3) {
      if (secretAdminTapTimerRef.current) clearTimeout(secretAdminTapTimerRef.current);
      secretAdminTapCountRef.current = 0;
      setIsAdminModalOpen(true);
      return;
    }
    if (secretAdminTapTimerRef.current) clearTimeout(secretAdminTapTimerRef.current);
    secretAdminTapTimerRef.current = setTimeout(() => {
      secretAdminTapCountRef.current = 0;
    }, 1500);
  };

  // Filters (Defaults to PRIME_CO: Ligas Principales disponibles en Casas de Apuestas Colombianas con alta precisión)
  const [selectedFilter, setSelectedFilter] = useState<SoccerFilterType>('ALL');
  const [selectedLeague, setSelectedLeague] = useState<string>('PRIME_CO');

  // Primary Navigation Tab (🔥 Top Picks | 🌐 Cartelera | 🔴 En Vivo)
  const [mainTab, setMainTab] = useState<'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE'>(() => {
    try {
      const saved = localStorage.getItem('sportstats_main_tab');
      return saved === 'TOP_PICKS' || saved === 'ALL_LEAGUES' || saved === 'LIVE'
        ? (saved as 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE')
        : 'ALL_LEAGUES';
    } catch {
      return 'ALL_LEAGUES';
    }
  });

  const handleSelectMainTab = useCallback((tab: 'TOP_PICKS' | 'ALL_LEAGUES' | 'LIVE') => {
    setMainTab(tab);
    try {
      localStorage.setItem('sportstats_main_tab', tab);
    } catch {
      // ignore
    }
  }, []);

  // Density View: Cards (detailed) vs Compact List (52px fast scanning)
  const [densityView, setDensityView] = useState<'CARDS' | 'COMPACT'>(() => {
    try {
      const saved = localStorage.getItem('sportstats_density_view');
      return saved === 'COMPACT' || saved === 'CARDS' ? (saved as 'CARDS' | 'COMPACT') : 'COMPACT';
    } catch {
      return 'COMPACT';
    }
  });

  const handleSelectDensityView = useCallback((density: 'CARDS' | 'COMPACT') => {
    setDensityView(density);
    try {
      localStorage.setItem('sportstats_density_view', density);
    } catch {
      // ignore
    }
  }, []);

  // Collapsible competition blocks state (Set of group keys that are collapsed)
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  // Mobile Lightweight Mode state (auto-detects mobile screens, can be toggled by user)
  const [isLightweightMode, setIsLightweightMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_lightweight_mode');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth < 768;
    } catch {
      return false;
    }
  });

  const handleToggleLightweightMode = useCallback(() => {
    setIsLightweightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('futbolstats_lightweight_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Progressive batch rendering count (default 30 matches, loads more on demand)
  const [visibleMatchLimit, setVisibleMatchLimit] = useState<number>(30);

  // Periodic License Validation (Check revocation on server & expiration)
  useEffect(() => {
    const checkLicenseStatus = async () => {
      const active = getActiveStoredLicense();
      const devId = getOrCreateDeviceId();
      if (!active) {
        setIsAppUnlocked(false);
        setActiveLicenseInfo(null);
        return;
      }

      // 1. Instant offline cryptographic check
      const localCheck = verifyLicenseToken(active.key, devId);
      if (!localCheck.isValid) {
        clearActiveLicense();
        setIsAppUnlocked(false);
        setActiveLicenseInfo(null);
        return;
      }

      // 2. Server check to ensure key has not been revoked
      try {
        const res = await fetch('/api/license/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: active.key, deviceId: devId })
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.isValid) {
            clearActiveLicense();
            setIsAppUnlocked(false);
            setActiveLicenseInfo(null);
            return;
          }
        }
      } catch {
        // Offline: trust cryptographic verification
      }

      setIsAppUnlocked(true);
      setActiveLicenseInfo(localCheck);
    };

    checkLicenseStatus();
  }, []);

  // Silent Heartbeat Ping (presencia en tiempo real)
  useEffect(() => {
    if (!isAppUnlocked) return;

    const sendHeartbeat = async () => {
      try {
        const active = getActiveStoredLicense();
        const devId = getOrCreateDeviceId();
        const clientName = localStorage.getItem('sportstats_client_name') || undefined;
        const deviceInfo = typeof navigator !== 'undefined' ? `${navigator.platform || ''} (${navigator.userAgent.slice(0, 40)})` : undefined;

        const res = await fetch('/api/license/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: active?.key,
            deviceId: devId,
            clientName,
            deviceInfo
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.revoked || data.isExpired) {
            clearActiveLicense();
            setIsAppUnlocked(false);
          }
        }
      } catch {
        // ignore offline ping
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [isAppUnlocked]);

  // Reset pagination limit when any filter or date changes
  useEffect(() => {
    setVisibleMatchLimit(30);
  }, [currentDate, selectedLeague, selectedFilter, searchQuery]);

  // NBA Specific States & Filters
  const [nbaFixtures, setNbaFixtures] = useState<NBAMatchFixture[]>([]);
  const [isNBALoading, setIsNBALoading] = useState<boolean>(false);
  const [nbaSearchQuery, setNbaSearchQuery] = useState<string>('');
  const [selectedNBAConference, setSelectedNBAConference] = useState<string>('ALL');
  const [selectedNBAFilter, setSelectedNBAFilter] = useState<NBAFilterType>('ALL');

  // Dual View Mode: Simple (Principiante / Didáctico) vs Expert (Analista / Pro)
  const [viewMode, setViewMode] = useState<'SIMPLE' | 'EXPERT'>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_view_mode');
      return saved === 'EXPERT' ? 'EXPERT' : 'SIMPLE';
    } catch {
      return 'SIMPLE';
    }
  });

  const handleToggleViewMode = (mode: 'SIMPLE' | 'EXPERT') => {
    setViewMode(mode);
    try {
      localStorage.setItem('futbolstats_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Beginner Didactic Guide, Glossary & Legal Modal state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [guideInitialTab, setGuideInitialTab] = useState<GuideModalTab>('GUIDE');
  const [isSavedSlipsOpen, setIsSavedSlipsOpen] = useState<boolean>(false);

  const handleOpenGuideModal = useCallback((tab: GuideModalTab = 'GUIDE') => {
    setGuideInitialTab(tab);
    setIsGuideOpen(true);
  }, []);

  // Modals
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [selectedMatchForSimulator, setSelectedMatchForSimulator] = useState<MatchFixture | null>(null);

  // Match Detail Modal (Substitutes infinite accordion with focused zero-scroll sheet)
  const [detailModalPayload, setDetailModalPayload] = useState<DetailMatchPayload | null>(null);

  const handleOpenSoccerDetail = useCallback(async (fixture: MatchFixture, analysis: MatchAnalysis) => {
    const cleanInitial = sanitizeFixturePlayers(fixture);
    const initialAnalysis = calculateMatchAnalysis(cleanInitial);
    setDetailModalPayload({ type: 'SOCCER', fixture: cleanInitial, analysis: initialAnalysis });
    if (cleanInitial.status === 'IN_PLAY' || cleanInitial.status === 'FINISHED' || cleanInitial.espnEventId) {
      const telemetry = await fetchMatchLiveTelemetry(cleanInitial);
      if (
        telemetry &&
        (telemetry.liveStats ||
          typeof telemetry.homeGoals === 'number' ||
          (telemetry.liveEvents && telemetry.liveEvents.length > 0) ||
          (telemetry.liveRosters && telemetry.liveRosters.homeStarters.length > 0))
      ) {
        clearAnalysisCacheForFixture(cleanInitial.id);
        const nextHomeGoals =
          typeof telemetry.homeGoals === 'number' ? telemetry.homeGoals : (cleanInitial.currentScore?.home ?? 0);
        const nextAwayGoals =
          typeof telemetry.awayGoals === 'number' ? telemetry.awayGoals : (cleanInitial.currentScore?.away ?? 0);
        const nextIsHT =
          telemetry.isHalfTime !== undefined ? telemetry.isHalfTime : Boolean(cleanInitial.currentScore?.isHalfTime);
        const nextMinute =
          typeof telemetry.minute === 'number' ? telemetry.minute : (cleanInitial.currentScore?.minute ?? 45);

        const enrichedFixture = sanitizeFixturePlayers({
          ...cleanInitial,
          espnEventId: telemetry.espnEventId || cleanInitial.espnEventId,
          currentScore: cleanInitial.currentScore
            ? {
                home: nextHomeGoals,
                away: nextAwayGoals,
                minute: nextIsHT ? 45 : nextMinute,
                isHalfTime: nextIsHT,
                statusShort: telemetry.statusShort || cleanInitial.currentScore.statusShort
              }
            : undefined,
          liveStats: telemetry.liveStats || cleanInitial.liveStats,
          liveEvents:
            telemetry.liveEvents && telemetry.liveEvents.length > 0 ? telemetry.liveEvents : cleanInitial.liveEvents,
          liveRosters: telemetry.liveRosters || cleanInitial.liveRosters
        });
        const enrichedAnalysis = calculateMatchAnalysis(enrichedFixture);
        setFixtures((prev) => prev.map((f) => (f.id === cleanInitial.id ? enrichedFixture : f)));
        setDetailModalPayload((prev) =>
          prev && prev.type === 'SOCCER' && prev.fixture.id === cleanInitial.id
            ? { type: 'SOCCER', fixture: enrichedFixture, analysis: enrichedAnalysis }
            : prev
        );
      }
    }
  }, []);

  const handleOpenNBADetail = useCallback((fixture: NBAMatchFixture, analysis: NBAAnalysis) => {
    setDetailModalPayload({ type: 'NBA', fixture, analysis });
  }, []);

  // Wallpaper state (defaults to CR7wallpaper.jpg or user's stored selection)
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() => {
    return localStorage.getItem('futbolstats_selected_wallpaper') || '/CR7wallpaper.jpg';
  });
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_wallpaper_opacity');
      return saved ? parseFloat(saved) : 0.65;
    } catch {
      return 0.65;
    }
  });
  const [wallpaperBlur, setWallpaperBlur] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_wallpaper_blur');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState<boolean>(false);
  const [refreshCooldown, setRefreshCooldown] = useState<number>(0);

  // Cooldown timer to prevent user spamming the refresh button
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  const handleSelectWallpaper = (url: string) => {
    setSelectedWallpaper(url);
    try {
      localStorage.setItem('futbolstats_selected_wallpaper', url);
    } catch {
      // ignore quota
    }
  };

  const handleUpdateOpacity = useCallback((val: number) => {
    setWallpaperOpacity(val);
    try {
      localStorage.setItem('futbolstats_wallpaper_opacity', val.toString());
    } catch {
      // ignore quota
    }
  }, []);

  const handleUpdateBlur = useCallback((val: number) => {
    setWallpaperBlur(val);
    try {
      localStorage.setItem('futbolstats_wallpaper_blur', val.toString());
    } catch {
      // ignore quota
    }
  }, []);

  // Load active matches (Scheduled + In-Play)
  const loadMatches = useCallback(async (dateStr: string, forceRefresh = false) => {
    setIsLoading(true);
    try {
      const result = await fetchUpcomingFixtures(dateStr, { forceRefresh });
      const activeFixtures = result.fixtures.filter((f) => {
        const idStr = String(f.id);
        if (idStr === '991001' || idStr === '991002' || idStr === '991003') return false;
        return f.status === 'SCHEDULED' || f.status === 'IN_PLAY';
      });
      setFixtures(activeFixtures);
      setSelectedFixtureIds(new Set());

      // Immediately reconcile live scores, halftime (HT) status, and telemetry for in-play matches
      if (activeFixtures.length > 0) {
        syncLivePulseFixtures(dateStr, activeFixtures)
          .then((pulseRes) => {
            if (pulseRes.changedIds.length > 0) {
              pulseRes.changedIds.forEach((id) => clearAnalysisCacheForFixture(id));
              setFixtures(pulseRes.updatedFixtures);
            }
          })
          .catch(() => {
            // ignore background sync error
          });
      }
    } catch (err) {
      console.error('Error al cargar pronósticos de partidos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clean legacy cache keys and ensure initial date is Today in the user's local country timezone
  useEffect(() => {
    setCurrentDate(getColombiaDateString(0));
    try {
      [
        'sportstats_evaluated_matches_ledger_v1',
        'sportstats_evaluated_matches_ledger_v2',
        'sportstats_evaluated_matches_ledger_v3',
        'sportstats_evaluated_matches_ledger_v4'
      ].forEach((k) => localStorage.removeItem(k));

      Object.keys(localStorage).forEach((k) => {
        if (
          k.startsWith('futbolstats_upcoming_') ||
          k.startsWith('basketstats_nba_') ||
          k.startsWith('futbolstats_fixtures_')
        ) {
          const val = localStorage.getItem(k);
          if (
            !val ||
            val.includes('991001') ||
            val.includes('991002') ||
            val.includes('991003') ||
            val.includes('Llaneros') ||
            val.includes('Alianza FC') ||
            k.startsWith('futbolstats_upcoming_v2_') ||
            k.startsWith('futbolstats_upcoming_v3_') ||
            k.startsWith('futbolstats_upcoming_v4_') ||
            k.startsWith('futbolstats_upcoming_v5_') ||
            k.startsWith('futbolstats_upcoming_v6_') ||
            k.startsWith('futbolstats_upcoming_v7_') ||
            k.startsWith('futbolstats_upcoming_v8_') ||
            k.startsWith('futbolstats_upcoming_v9_') ||
            k.startsWith('futbolstats_upcoming_v10_') ||
            k.startsWith('basketstats_nba_v3_')
          ) {
            localStorage.removeItem(k);
          }
        }
      });
    } catch {
      // ignore
    }
  }, []);

  // Only trigger network load on date change, NOT on every keystroke!
  useEffect(() => {
    loadMatches(currentDate, false);
  }, [currentDate, loadMatches]);

  // 45-Second Hybrid Live Update Engine
  const [recentlyUpdatedFixtureIds, setRecentlyUpdatedFixtureIds] = useState<Set<string>>(new Set());

  const triggerLiveFlashEffect = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRecentlyUpdatedFixtureIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setTimeout(() => {
      setRecentlyUpdatedFixtureIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 4500);
  }, []);

  const runLivePulseCheck = useCallback(async () => {
    if (activeSport === 'SOCCER' && fixtures.length > 0) {
      const pulseRes = await syncLivePulseFixtures(currentDate, fixtures);
      if (pulseRes.changedIds.length > 0) {
        pulseRes.changedIds.forEach((id) => clearAnalysisCacheForFixture(id));
        setFixtures(pulseRes.updatedFixtures);

        // ONLY trigger the visual "¡Marcador Actualizado!" flash when the score actually changed!
        if (pulseRes.scoreChangedIds && pulseRes.scoreChangedIds.length > 0) {
          triggerLiveFlashEffect(pulseRes.scoreChangedIds);
        }

        setDetailModalPayload((prev) => {
          if (!prev || prev.type !== 'SOCCER') return prev;
          const updatedFix = pulseRes.updatedFixtures.find((f) => f.id === prev.fixture.id);
          if (!updatedFix) return prev;
          return {
            type: 'SOCCER',
            fixture: updatedFix,
            analysis: calculateMatchAnalysis(updatedFix)
          };
        });
      }
    } else if (activeSport === 'NBA' && nbaFixtures.some((f) => f.status === 'IN_PLAY')) {
      const res = await fetchNBAFixtures(currentDate, { forceRefresh: true });
      const changedNbaIds: string[] = [];
      res.fixtures.forEach((newFix) => {
        const oldFix = nbaFixtures.find((f) => f.id === newFix.id);
        if (oldFix) {
          const oldScore = `${oldFix.currentScore?.home ?? 0}-${oldFix.currentScore?.away ?? 0}`;
          const newScore = `${newFix.currentScore?.home ?? 0}-${newFix.currentScore?.away ?? 0}`;
          // ONLY trigger "¡Puntos!" flash when points actually changed
          if (oldScore !== newScore) {
            changedNbaIds.push(newFix.id);
          }
        }
      });
      setNbaFixtures(res.fixtures);
      if (changedNbaIds.length > 0) {
        triggerLiveFlashEffect(changedNbaIds);
      }
    }
  }, [activeSport, currentDate, fixtures, nbaFixtures, triggerLiveFlashEffect]);

  useEffect(() => {
    const interval = setInterval(() => {
      runLivePulseCheck();
    }, 45000);
    return () => clearInterval(interval);
  }, [runLivePulseCheck]);

  // Compute analyses for all upcoming matches
  const analysesMap: Record<string, MatchAnalysis> = useMemo(() => {
    const map: Record<string, MatchAnalysis> = {};
    fixtures.forEach((fix) => {
      map[fix.id] = calculateMatchAnalysis(fix);
    });
    return map;
  }, [fixtures]);

  // Filter based on search query, leagues and simple patterns completely in client memory
  const filteredFixtures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return fixtures.filter((f) => {
      // 1. Instant client-side search (0 API queries, 0 network requests!)
      if (q) {
        const homeName = f.homeTeam.name.toLowerCase();
        const awayName = f.awayTeam.name.toLowerCase();
        const leagueName = f.league.name.toLowerCase();
        const starHome = (f.homeTeam.starPlayer?.name || '').toLowerCase();
        const starAway = (f.awayTeam.starPlayer?.name || '').toLowerCase();

        const matches =
          homeName.includes(q) ||
          awayName.includes(q) ||
          leagueName.includes(q) ||
          starHome.includes(q) ||
          starAway.includes(q);

        if (!matches) return false;
      }

      const a = analysesMap[f.id];

      // League filter (supports PRIME_CO with automatic fallback if 0 prime matches on a quiet day)
      if (selectedLeague === 'PRIME_CO') {
        const hasAnyPrimeToday = fixtures.some((item) => isColombianBookmakerPrimeLeague(item));
        if (hasAnyPrimeToday && !isColombianBookmakerPrimeLeague(f)) {
          return false;
        }
      } else if (selectedLeague !== 'ALL') {
        if (!matchesLeagueSelection(f, selectedLeague)) {
          return false;
        }
      }

      // Status filter (Live & Upcoming)
      if (selectedFilter === 'LIVE_ONLY' && f.status !== 'IN_PLAY') {
        return false;
      }
      if (selectedFilter === 'UPCOMING_ONLY' && f.status !== 'SCHEDULED') {
        return false;
      }

      // Pattern filter
      if (a) {
        if (selectedFilter === 'RECOMMENDED') {
          const advice = getSoccerDidacticAdvice(f, a);
          if (advice.signal !== 'GREEN') return false;
        } else if (selectedFilter === 'CORNERS_SAFE') {
          if (a.cornersMarket.recommendedProb < 68) return false;
        } else if (selectedFilter === 'CARDS_SAFE') {
          if (a.refereeCards.recommendedCardProb < 68) return false;
        } else if (selectedFilter === 'DOUBLE_CHANCE') {
          if (
            a.goalsMarket.over15 < 70 &&
            a.goalsMarket.doubleChance1X < 72 &&
            a.goalsMarket.doubleChanceX2 < 72
          ) {
            return false;
          }
        } else if (selectedFilter === 'FAVORITES') {
          if (a.dixonColes.pHomeWin < 52 && a.dixonColes.pAwayWin < 50) return false;
        } else if (selectedFilter === 'HIGH_GOALS') {
          if (a.goalsMarket.over25 < 52) return false;
        } else if (selectedFilter === 'BALANCED') {
          if (Math.abs(a.dixonColes.pHomeWin - a.dixonColes.pAwayWin) > 14) return false;
        }
      }

      return true;
    });
  }, [fixtures, analysesMap, selectedLeague, selectedFilter, searchQuery]);

  // Available competition groups for dropdown selector (derived from all day's fixtures)
  const availableCompetitionGroups = useMemo(() => {
    return groupFixturesByCompetition(fixtures);
  }, [fixtures]);

  const primeFixturesCount = useMemo(() => {
    const count = fixtures.filter((f) => isColombianBookmakerPrimeLeague(f)).length;
    return count > 0 ? count : fixtures.length;
  }, [fixtures]);

  // Human-readable title for currently active league or tournament filter
  const activeLeagueLabel = useMemo(() => {
    if (!selectedLeague || selectedLeague === 'ALL') return '';
    if (selectedLeague === 'PRIME_CO') return 'Ligas Principales · Casas de Apuestas Colombia (Alta Precisión)';
    if (selectedLeague === 'GROUP_INTL' || selectedLeague === 'INTL') return 'Torneos Internacionales';
    if (selectedLeague.startsWith('LEAGUE_')) {
      const target = selectedLeague.replace('LEAGUE_', '').trim();
      for (const group of availableCompetitionGroups) {
        const found = group.leagues.find(
          (l) => String(l.id).trim() === target || l.name.toLowerCase() === target.toLowerCase()
        );
        if (found) return found.name;
      }
      return target;
    }
    if (selectedLeague.startsWith('COUNTRY_')) {
      const countryKey = selectedLeague.replace('COUNTRY_', '').trim();
      const group = availableCompetitionGroups.find(
        (g) => g.key === countryKey || g.name.toUpperCase() === countryKey
      );
      if (group) return group.name;
      return countryKey;
    }
    return selectedLeague;
  }, [selectedLeague, availableCompetitionGroups]);

  // Progressive slicing: when viewing a specific league, always show all its matches (usually <= 20).
  // When viewing ALL leagues (potentially 200+ matches), slice to visibleMatchLimit for snappy mobile performance.
  const displayFixtures = useMemo(() => {
    if (selectedLeague !== 'ALL' || filteredFixtures.length <= visibleMatchLimit) {
      return filteredFixtures;
    }
    return filteredFixtures.slice(0, visibleMatchLimit);
  }, [filteredFixtures, selectedLeague, visibleMatchLimit]);

  // Group displayed fixtures into collapsible competition blocks
  const groupedFilteredFixtures = useMemo(() => {
    return groupFixturesByCompetition(displayFixtures);
  }, [displayFixtures]);

  const handleToggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleToggleAllGroupsCollapse = useCallback(() => {
    const allKeys = groupedFilteredFixtures.map((g) => g.key);
    const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsedGroupKeys.has(k));
    if (allCollapsed) {
      setCollapsedGroupKeys(new Set());
    } else {
      setCollapsedGroupKeys(new Set(allKeys));
    }
  }, [groupedFilteredFixtures, collapsedGroupKeys]);

  const handleToggleSelectGroupFixtures = useCallback((fixtureIds: string[], selectAll: boolean) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (selectAll) {
        fixtureIds.forEach((id) => next.add(id));
      } else {
        fixtureIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, []);

  // NBA Match Loader
  const loadNBAMatches = useCallback(async (dateStr: string, forceRefresh = false) => {
    setIsNBALoading(true);
    try {
      const res = await fetchNBAFixtures(dateStr, { forceRefresh });
      setNbaFixtures(res.fixtures);
    } catch (err) {
      console.error('Error al cargar partidos de NBA:', err);
    } finally {
      setIsNBALoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSport === 'NBA') {
      loadNBAMatches(currentDate, false);
    }
  }, [activeSport, currentDate, loadNBAMatches]);

  // Compute NBA analyses map
  const nbaAnalysesMap: Record<string, NBAAnalysis> = useMemo(() => {
    const map: Record<string, NBAAnalysis> = {};
    nbaFixtures.forEach((f) => {
      map[f.id] = calculateNBAAnalysis(f);
    });
    return map;
  }, [nbaFixtures]);

  // Available basketball leagues with counts
  const availableBasketballLeagues = useMemo(() => {
    const map = new Map<string, { key: string; name: string; flag: string; count: number }>();
    nbaFixtures.forEach((f) => {
      const lName = f.league?.name || 'NBA';
      const flag = lName.includes('NBA') && !lName.includes('W') ? '🇺🇸' : lName.includes('NCAA') ? '🎓' : lName.includes('WNBA') ? '🏀' : lName.includes('FIBA') ? '🌍' : '🏀';
      const key = lName.includes('NBA') && !lName.includes('W') ? 'NBA' : lName.includes('NCAA') ? 'NCAA' : lName.includes('WNBA') ? 'WNBA' : lName.includes('FIBA') ? 'FIBA' : lName;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { key, name: lName, flag, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [nbaFixtures]);

  const nbaEsteCount = useMemo(() => nbaFixtures.filter((f) => f.homeTeam.conference === 'Este' || f.awayTeam.conference === 'Este').length, [nbaFixtures]);
  const nbaOesteCount = useMemo(() => nbaFixtures.filter((f) => f.homeTeam.conference === 'Oeste' || f.awayTeam.conference === 'Oeste').length, [nbaFixtures]);

  // Filtered NBA fixtures
  const filteredNBAFixtures = useMemo(() => {
    const q = nbaSearchQuery.toLowerCase().trim();
    return nbaFixtures.filter((f) => {
      if (q) {
        const h = f.homeTeam.name.toLowerCase();
        const a = f.awayTeam.name.toLowerCase();
        const hShort = f.homeTeam.shortName.toLowerCase();
        const aShort = f.awayTeam.shortName.toLowerCase();
        const cityH = f.homeTeam.city.toLowerCase();
        const cityA = f.awayTeam.city.toLowerCase();
        const starH = (f.homeTeam.keyPlayers?.[0]?.name || '').toLowerCase();
        const starA = (f.awayTeam.keyPlayers?.[0]?.name || '').toLowerCase();
        const lName = (f.league?.name || '').toLowerCase();
        if (
          !h.includes(q) &&
          !a.includes(q) &&
          !hShort.includes(q) &&
          !aShort.includes(q) &&
          !cityH.includes(q) &&
          !cityA.includes(q) &&
          !starH.includes(q) &&
          !starA.includes(q) &&
          !lName.includes(q)
        ) {
          return false;
        }
      }
      if (selectedNBAConference !== 'ALL') {
        if (selectedNBAConference === 'NBA') {
          if (f.league && f.league.name !== 'NBA') return false;
        } else if (selectedNBAConference === 'NCAA') {
          if (!f.league || !f.league.name.includes('NCAA')) return false;
        } else if (selectedNBAConference === 'WNBA') {
          if (!f.league || !f.league.name.includes('WNBA')) return false;
        } else if (selectedNBAConference === 'FIBA') {
          if (!f.league || !f.league.name.includes('FIBA')) return false;
        } else if (selectedNBAConference === 'Este' || selectedNBAConference === 'Oeste') {
          if (f.homeTeam.conference !== selectedNBAConference && f.awayTeam.conference !== selectedNBAConference) {
            return false;
          }
        }
      }
      if (selectedNBAFilter === 'LIVE' && f.status !== 'IN_PLAY') {
        return false;
      }
      if (selectedNBAFilter === 'UPCOMING_ONLY' && f.status !== 'SCHEDULED') {
        return false;
      }
      const analysis = nbaAnalysesMap[f.id];
      if (analysis) {
        if (selectedNBAFilter === 'RECOMMENDED') {
          const advice = getNBADidacticAdvice(f, analysis);
          if (advice.signal !== 'GREEN') return false;
        }
        if (selectedNBAFilter === 'FAVORITES' && analysis.pHomeWin < 60 && analysis.pAwayWin < 60) {
          return false;
        }
        if (selectedNBAFilter === 'HIGH_POINTS' && analysis.projectedTotalPoints < 225) {
          return false;
        }
        if (selectedNBAFilter === 'HIGH_3PM' && (!analysis.threePointersMarket || analysis.threePointersMarket.projectedTotal3PM < 26)) {
          return false;
        }
      }
      return true;
    });
  }, [nbaFixtures, nbaSearchQuery, selectedNBAConference, selectedNBAFilter, nbaAnalysesMap]);

  // Fast Top Picks for Soccer (didactic GREEN signal or highest probability >= 68%)
  const soccerTopPicks = useMemo(() => {
    return filteredFixtures
      .map((f) => {
        const a = analysesMap[f.id];
        const advice = a ? getSoccerDidacticAdvice(f, a) : null;
        return { fixture: f, analysis: a, advice };
      })
      .filter((item) => item.advice && (item.advice.signal === 'GREEN' || (item.advice.topPick && item.advice.topPick.probability >= 68)))
      .sort((a, b) => (b.advice?.topPick?.probability || 0) - (a.advice?.topPick?.probability || 0));
  }, [filteredFixtures, analysesMap]);

  // Live fixtures for Soccer
  const soccerLiveFixtures = useMemo(() => {
    return filteredFixtures.filter((f) => f.status === 'IN_PLAY');
  }, [filteredFixtures]);

  // Quick horizontal league chips carousel (top 12 leagues by match count)
  const quickLeagueChips = useMemo(() => {
    return availableCompetitionGroups
      .filter((g) => g.totalMatches > 0)
      .slice(0, 12);
  }, [availableCompetitionGroups]);

  // Fast Top Picks for NBA
  const nbaTopPicks = useMemo(() => {
    return filteredNBAFixtures
      .map((f) => {
        const a = nbaAnalysesMap[f.id];
        const advice = a ? getNBADidacticAdvice(f, a) : null;
        return { fixture: f, analysis: a, advice };
      })
      .filter((item) => item.advice && (item.advice.signal === 'GREEN' || (item.advice.topPick && item.advice.topPick.probability >= 68)))
      .sort((a, b) => (b.advice?.topPick?.probability || 0) - (a.advice?.topPick?.probability || 0));
  }, [filteredNBAFixtures, nbaAnalysesMap]);

  // Live fixtures for NBA
  const nbaLiveFixtures = useMemo(() => {
    return filteredNBAFixtures.filter((f) => f.status === 'IN_PLAY');
  }, [filteredNBAFixtures]);

  // Toggle selection for a single fixture (memoized with useCallback)
  const handleToggleSelect = useCallback((fixtureId: string) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  }, []);

  // Open simulator modal (memoized with useCallback)
  const handleOpenSimulator = useCallback((fixture: MatchFixture) => {
    setSelectedMatchForSimulator(fixture);
    setIsSimulatorOpen(true);
  }, []);

  // Select all currently visible fixtures (Soccer or NBA)
  const handleSelectAll = () => {
    const currentList = activeSport === 'NBA' ? filteredNBAFixtures : filteredFixtures;
    if (selectedFixtureIds.size === currentList.length && currentList.length > 0) {
      setSelectedFixtureIds(new Set());
    } else {
      setSelectedFixtureIds(new Set(currentList.map((f) => f.id)));
    }
  };

  // Set of fixture IDs currently expanded for full analytics (default: empty for compact scroll)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const handleToggleCardExpand = useCallback((fixtureId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  }, []);

  const handleToggleExpandAll = useCallback(() => {
    const currentList = activeSport === 'NBA' ? filteredNBAFixtures : filteredFixtures;
    const currentIds = currentList.map((f) => f.id);
    const allExpanded = currentIds.length > 0 && currentIds.every((id) => expandedCardIds.has(id));

    if (allExpanded) {
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [activeSport, filteredNBAFixtures, filteredFixtures, expandedCardIds]);

  // Prepare soccer items for export
  const getItemsForExport = (onlySelected = false): ExportItem[] => {
    let targets = filteredFixtures;
    if (onlySelected && selectedFixtureIds.size > 0) {
      targets = filteredFixtures.filter((f) => selectedFixtureIds.has(f.id));
    }
    return targets
      .map((f) => ({ fixture: f, analysis: analysesMap[f.id] }))
      .filter((item): item is ExportItem => Boolean(item.analysis));
  };

  // Prepare NBA items for export
  const getNBAItemsForExport = (onlySelected = false): NBAExportItem[] => {
    let targets = filteredNBAFixtures;
    if (onlySelected && selectedFixtureIds.size > 0) {
      targets = filteredNBAFixtures.filter((f) => selectedFixtureIds.has(f.id));
    }
    return targets
      .map((f) => ({ fixture: f, analysis: nbaAnalysesMap[f.id] }))
      .filter((item): item is NBAExportItem => Boolean(item.analysis));
  };

  // Download handlers
  const handleDownloadExcel = (onlySelected = false) => {
    if (activeSport === 'NBA') {
      const items = getNBAItemsForExport(onlySelected);
      if (items.length === 0) return;
      exportNBAToExcel(items, onlySelected ? 'Pronosticos_NBA_Seleccion' : 'Pronosticos_NBA');
    } else {
      const items = getItemsForExport(onlySelected);
      if (items.length === 0) return;
      exportToExcel(items, onlySelected ? 'Pronosticos_Seleccion' : 'Pronosticos_Futbol');
    }
  };

  const handleDownloadPDF = (onlySelected = false) => {
    if (activeSport === 'NBA') {
      const items = getNBAItemsForExport(onlySelected);
      if (items.length === 0) return;
      const title = onlySelected
        ? `Selección de ${items.length} Partidos NBA`
        : `Partidos NBA (${currentDate})`;
      exportNBAToPDF(items, title);
    } else {
      const items = getItemsForExport(onlySelected);
      if (items.length === 0) return;
      const title = onlySelected
        ? `Selección de ${items.length} Partidos Próximos`
        : `Partidos Próximos (${currentDate})`;
      exportToPDF(items, title);
    }
  };

  const hasSelection = selectedFixtureIds.size > 0;
  const currentTotalVisible = activeSport === 'NBA' ? filteredNBAFixtures.length : filteredFixtures.length;

  return (
    <>
      {!isAppUnlocked ? (
        <AccessLockScreen
          onUnlock={(result) => {
            setIsAppUnlocked(true);
            setActiveLicenseInfo(result);
          }}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onOpenGuide={handleOpenGuideModal}
        />
      ) : (
        <div
      className="min-h-screen cr7-cinematic-bg text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black pb-20 md:pb-6 transition-colors duration-200"
      style={{
        ['--wallpaper-bg' as string]: `url("${encodeURI(selectedWallpaper)}")`,
        ['--wallpaper-opacity' as string]: `${theme === 'light' ? Math.min(wallpaperOpacity, 0.2) : wallpaperOpacity}`,
        ['--wallpaper-blur' as string]: `${wallpaperBlur}px`
      } as React.CSSProperties}
    >
      {/* 0. Subscription Expiration Alert Banner (3 days warning, excludes 24h trials) */}
      <SubscriptionAlertBanner />

      {/* 1 & 2. Header & Primary Navigation Tabs */}
      <MainAppHeader
        activeSport={activeSport}
        onSelectSport={handleSelectSport}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        paletteTextAccentClass={paletteConfig.textAccentClass}
        activeLicenseInfo={activeLicenseInfo}
        onSecretAdminLogoClick={handleSecretAdminLogoClick}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenGuideModal={handleOpenGuideModal}
        onRefreshMatches={() => {
          if (refreshCooldown > 0) return;
          setRefreshCooldown(30);
          if (activeSport === 'NBA') {
            loadNBAMatches(currentDate, true);
          } else {
            loadMatches(currentDate, true);
          }
        }}
        isLoading={activeSport === 'NBA' ? isNBALoading : isLoading}
        refreshCooldown={refreshCooldown}
        currentTotalVisible={currentTotalVisible}
        selectedCount={selectedFixtureIds.size}
        onClearSelection={() => setSelectedFixtureIds(new Set())}
        onDownloadExcel={handleDownloadExcel}
        onDownloadPDF={handleDownloadPDF}
        onOpenSavedSlips={() => setIsSavedSlipsOpen(true)}
        onOpenWallpaperModal={() => setIsWallpaperModalOpen(true)}
        onOpenDefaultSimulator={() => {
          setSelectedMatchForSimulator(filteredFixtures[0] || null);
          setIsSimulatorOpen(true);
        }}
        onLogoutSession={handleLogoutSession}
        mainTab={mainTab}
        onSelectMainTab={handleSelectMainTab}
        topPicksCount={activeSport === 'SOCCER' ? soccerTopPicks.length : nbaTopPicks.length}
        allLeaguesCount={activeSport === 'SOCCER' ? filteredFixtures.length : filteredNBAFixtures.length}
        liveMatchesCount={activeSport === 'SOCCER' ? soccerLiveFixtures.length : nbaLiveFixtures.length}
      />

      {/* 3. Unified Search & Filters Panel (Compact Single-Bar Layout) */}
      {activeSport === 'SOCCER' ? (
        <>
          <SoccerFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            selectedLeague={selectedLeague}
            onLeagueChange={setSelectedLeague}
            primeFixturesCount={primeFixturesCount}
            totalFixturesCount={fixtures.length}
            availableCompetitionGroups={availableCompetitionGroups}
            quickLeagueChips={quickLeagueChips}
          />

      {/* 3. Main Content: Upcoming Matches List */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 relative z-10">
        {/* Results Bar: Estado y Selección (Limpio y profesional) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono tracking-tight font-semibold text-white">
              {isLoading ? 'Buscando partidos...' : `${filteredFixtures.length} partidos`}
            </span>
            {!isLoading && groupedFilteredFixtures.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900/60 text-slate-300 font-mono tracking-tight text-[11px] border border-slate-800/60 backdrop-blur-sm">
                {groupedFilteredFixtures.length} {groupedFilteredFixtures.length === 1 ? 'competición' : 'competiciones'}
              </span>
            )}
            {hasSelection && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-mono tracking-tight font-bold">
                {selectedFixtureIds.size} seleccionados
              </span>
            )}
            {filteredFixtures.some(f => f.status === 'IN_PLAY') && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse">
                🔴 En Vivo
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle all league blocks */}
            {groupedFilteredFixtures.length > 1 && (
              <button
                onClick={handleToggleAllGroupsCollapse}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200 border border-slate-800/50 cursor-pointer text-xs font-mono tracking-tight font-semibold backdrop-blur-sm"
                title={groupedFilteredFixtures.every(g => collapsedGroupKeys.has(g.key)) ? 'Desplegar todas las ligas' : 'Colapsar todas las ligas'}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">
                  {groupedFilteredFixtures.every(g => collapsedGroupKeys.has(g.key)) ? 'Desplegar ligas' : 'Colapsar ligas'}
                </span>
              </button>
            )}

            {/* Select all button */}
            {filteredFixtures.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200 border border-slate-800/50 cursor-pointer text-xs font-mono tracking-tight font-semibold backdrop-blur-sm"
              >
                {selectedFixtureIds.size === filteredFixtures.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Deseleccionar todos</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Seleccionar todos</span>
                  </>
                )}
              </button>
            )}

            {/* Toggle expand/collapse all matches */}
            {filteredFixtures.length > 0 && (
              <button
                onClick={handleToggleExpandAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200 border border-slate-800/50 cursor-pointer text-xs font-mono tracking-tight font-semibold backdrop-blur-sm"
                title={filteredFixtures.every(f => expandedCardIds.has(f.id)) ? 'Colapsar todos los análisis' : 'Desplegar todos los análisis'}
              >
                {filteredFixtures.every(f => expandedCardIds.has(f.id)) ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Colapsar detalles</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Desplegar detalles</span>
                  </>
                )}
              </button>
            )}

            {/* Density View Switcher: Lista Compacta vs Tarjetas */}
            <div className="flex items-center bg-slate-900/60 p-0.5 rounded-full border border-slate-800/80 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleSelectDensityView('COMPACT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  densityView === 'COMPACT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista compacta de 52px para escanear rápido sin scroll infinito"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compacto</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDensityView('CARDS')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  densityView === 'CARDS'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista detallada con tarjetas completas y 4 columnas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
            </div>

            {/* Toggle Modo Liviano para celular */}
            <button
              onClick={handleToggleLightweightMode}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-tight font-semibold transition-all duration-200 border cursor-pointer backdrop-blur-sm ${
                isLightweightMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-900/40 text-slate-400 border-slate-800/50 hover:text-white hover:bg-white/5'
              }`}
              title={
                isLightweightMode
                  ? 'Modo Liviano activado: ultra rápido para celulares y bajo consumo de batería'
                  : 'Activar Modo Liviano para acelerar el celular'
              }
            >
              <Zap className={`w-3.5 h-3.5 ${isLightweightMode ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="hidden xs:inline">
                {isLightweightMode ? 'Modo Rápido' : 'Modo Liviano'}
              </span>
            </button>

            {/* Refresh button */}
            <button
              onClick={() => loadMatches(currentDate, true)}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white text-xs font-mono tracking-tight font-semibold transition-all duration-200 border border-slate-800/50 cursor-pointer backdrop-blur-sm"
              title="Actualizar partidos y pronósticos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Banner de Filtro Activo por Liga */}
        {selectedLeague !== 'ALL' && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                Mostrando exclusivamente: <strong className="text-white font-bold">{activeLeagueLabel}</strong> ({filteredFixtures.length} {filteredFixtures.length === 1 ? 'partido' : 'partidos'})
              </span>
            </div>
            <button
              onClick={() => setSelectedLeague('ALL')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 text-xs transition-colors flex items-center gap-1 cursor-pointer"
              title="Ver todas las ligas del día"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Ver todas las ligas</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-300 font-medium">
              Consultando partidos pendientes y calculando pronósticos...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredFixtures.length === 0 && (
          <div className="py-14 px-6 text-center bg-[#101726]/90 border border-slate-800 rounded-2xl space-y-4 max-w-lg mx-auto backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 text-emerald-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {fixtures.length > 0
                  ? 'Sin partidos para el filtro actual'
                  : 'No hay partidos programados para esta fecha'}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {fixtures.length > 0
                  ? `No encontramos encuentros con el filtro actual, pero hoy hay ${fixtures.length} partidos reales activos en otras ligas del calendario.`
                  : `Para la fecha seleccionada (${currentDate}) no quedan partidos pendientes verificados. Puedes explorar los partidos de mañana o días cercanos.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {fixtures.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFilter('ALL');
                    setSelectedLeague('ALL');
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Ver todos los partidos de hoy ({fixtures.length})
                </button>
              )}
              <button
                onClick={() => setCurrentDate(getColombiaDateString(1))}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
              >
                Ver Partidos de Mañana
              </button>
              <button
                onClick={() => setCurrentDate(getColombiaDateString(2))}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
              >
                Ver Pasado Mañana
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: 🔥 TOP PICKS / JOYAS DEL DÍA */}
        {mainTab === 'TOP_PICKS' && !isLoading && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-l-2 border-emerald-500 border-y border-r border-emerald-500/20 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  Joyas Analíticas del Día ({soccerTopPicks.length} selecciones con certeza &ge;68% o +EV)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Ordenadas por mayor probabilidad</span>
            </div>

            {soccerTopPicks.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-white">No hay apuestas con filtro verde (&ge;68%) en este momento</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Explora la Cartelera Completa para ver todos los mercados, o cambia la fecha para anticipar los partidos de mañana.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleSelectMainTab('ALL_LEAGUES')}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Ver Cartelera Completa
                  </button>
                </div>
              </div>
            ) : densityView === 'COMPACT' ? (
              <div className="space-y-2">
                {soccerTopPicks.map(({ fixture, analysis }) => (
                  <CompactMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenSoccerDetail}
                    onOpenSimulator={handleOpenSimulator}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {soccerTopPicks.map(({ fixture, analysis }) => (
                  <FriendlyPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenSoccerDetail}
                    onOpenSimulator={handleOpenSimulator}
                    viewMode={viewMode}
                    mobileLightweight={isLightweightMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 🔴 EN VIVO */}
        {mainTab === 'LIVE' && !isLoading && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-l-2 border-rose-500 border-y border-r border-rose-500/20 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="text-xs font-semibold text-rose-300">
                  Partidos en Juego en Directo ({soccerLiveFixtures.length})
                </span>
              </div>
            </div>

            {soccerLiveFixtures.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-white">No hay partidos en juego en este instante</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  El pulso en vivo cada 45s actualizará los marcadores tan pronto ruede el balón.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleSelectMainTab('TOP_PICKS')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Ver Top Picks de Hoy
                  </button>
                  <button
                    onClick={() => handleSelectMainTab('ALL_LEAGUES')}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer border border-slate-700"
                  >
                    Ver Cartelera Completa
                  </button>
                </div>
              </div>
            ) : densityView === 'COMPACT' ? (
              <div className="space-y-2">
                {soccerLiveFixtures.map((fixture) => (
                  <CompactMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysesMap[fixture.id]!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenSoccerDetail}
                    onOpenSimulator={handleOpenSimulator}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {soccerLiveFixtures.map((fixture) => (
                  <FriendlyPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysesMap[fixture.id]!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenSoccerDetail}
                    onOpenSimulator={handleOpenSimulator}
                    viewMode={viewMode}
                    mobileLightweight={isLightweightMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 🌐 CARTELERA COMPLETA (ORGANIZADA POR COMPETICIONES) */}
        {mainTab === 'ALL_LEAGUES' && !isLoading && filteredFixtures.length > 0 && (
          <div className="space-y-4">
            {groupedFilteredFixtures.map((group) => (
              <CompetitionBlock
                key={group.key}
                group={group}
                analysesMap={analysesMap}
                selectedFixtureIds={selectedFixtureIds}
                expandedCardIds={expandedCardIds}
                isGroupCollapsed={
                  selectedLeague !== 'ALL' || groupedFilteredFixtures.length === 1
                    ? false
                    : collapsedGroupKeys.has(group.key)
                }
                viewMode={viewMode}
                isLightweightMode={isLightweightMode}
                densityView={densityView}
                recentlyUpdatedIds={recentlyUpdatedFixtureIds}
                onToggleGroupCollapse={handleToggleGroupCollapse}
                onToggleSelectFixture={handleToggleSelect}
                onToggleSelectGroupFixtures={handleToggleSelectGroupFixtures}
                onOpenSimulator={handleOpenSimulator}
                onToggleCardExpand={handleToggleCardExpand}
                onOpenDetailModal={handleOpenSoccerDetail}
              />
            ))}

            {/* Progressive Batch Loading Controls */}
            {filteredFixtures.length > displayFixtures.length && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3 shadow-lg">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>
                    Mostrando <strong>{displayFixtures.length}</strong> de <strong>{filteredFixtures.length}</strong> partidos de hoy
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Carga progresiva activada para garantizar navegación rápida, fluida y sin sobrecalentamiento en celulares.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setVisibleMatchLimit((prev) => prev + 30)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Cargar 30 partidos más (+30)</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setVisibleMatchLimit(filteredFixtures.length)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                  >
                    Cargar todos ({filteredFixtures.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  ) : (
    /* NBA Production Workspace */
    <>
      {/* 2. Unified Search & Filters Panel (NBA) - Compact Layout */}
      <NBAFilterBar
        nbaSearchQuery={nbaSearchQuery}
        onSearchChange={setNbaSearchQuery}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        selectedNBAFilter={selectedNBAFilter}
        onFilterChange={setSelectedNBAFilter}
        selectedNBAConference={selectedNBAConference}
        onConferenceChange={setSelectedNBAConference}
        totalNBAFixturesCount={nbaFixtures.length}
        availableBasketballLeagues={availableBasketballLeagues}
        nbaEsteCount={nbaEsteCount}
        nbaOesteCount={nbaOesteCount}
      />

      {/* 3. Main Content: Basketball Matches List */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 relative z-10">
        {/* Results Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="font-mono tracking-tight font-semibold text-white">
              {isNBALoading ? 'Calculando proyecciones...' : `${filteredNBAFixtures.length} partidos de Baloncesto`}
            </span>
            {hasSelection && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-mono tracking-tight font-bold">
                {selectedFixtureIds.size} seleccionados
              </span>
            )}
            {filteredNBAFixtures.some(f => f.status === 'IN_PLAY') && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono tracking-tight font-bold text-[10px] animate-pulse">
                🔴 En Vivo
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Density View Switcher: Lista Compacta vs Tarjetas */}
            <div className="flex items-center bg-slate-900/60 p-0.5 rounded-full border border-slate-800/80 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleSelectDensityView('COMPACT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  densityView === 'COMPACT'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista compacta de 52px para escanear rápido sin scroll infinito"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compacto</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDensityView('CARDS')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  densityView === 'CARDS'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista detallada con tarjetas completas y 4 columnas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
            </div>

            {/* Select all button */}
            {filteredNBAFixtures.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200 border border-slate-800/50 cursor-pointer text-xs font-mono tracking-tight font-semibold backdrop-blur-sm"
              >
                {selectedFixtureIds.size === filteredNBAFixtures.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Deseleccionar todos</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Seleccionar todos</span>
                  </>
                )}
              </button>
            )}

            {/* Toggle expand/collapse all NBA matches */}
            {filteredNBAFixtures.length > 0 && (
              <button
                onClick={handleToggleExpandAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all duration-200 border border-slate-800/50 cursor-pointer text-xs font-mono tracking-tight font-semibold backdrop-blur-sm"
                title={filteredNBAFixtures.every(f => expandedCardIds.has(f.id)) ? 'Colapsar todos los partidos' : 'Desplegar todos los análisis'}
              >
                {filteredNBAFixtures.every(f => expandedCardIds.has(f.id)) ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Colapsar todos</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    <span>Desplegar todos</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => loadNBAMatches(currentDate, true)}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900/40 hover:bg-white/5 text-slate-300 hover:text-white text-xs font-mono tracking-tight font-semibold transition-all duration-200 border border-slate-800/50 cursor-pointer backdrop-blur-sm"
              title="Refrescar marcadores y proyecciones"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isNBALoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isNBALoading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-300 font-medium">
              Calculando ritmo de posesiones, cuartos y probabilidades Poisson de jugadores...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isNBALoading && filteredNBAFixtures.length === 0 && (
          <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
            <div className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto text-slate-400 text-xl">
              🏀
            </div>
            <h3 className="text-base font-bold text-white">
              {nbaFixtures.length > 0
                ? 'No se encontraron partidos de Baloncesto con este filtro'
                : 'No hay partidos de Baloncesto programados para hoy'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {nbaFixtures.length > 0
                ? `Hay ${nbaFixtures.length} partidos oficiales de Baloncesto en el calendario de hoy. Prueba cambiando la liga o limpiando la búsqueda.`
                : 'El calendario oficial de Baloncesto no reporta partidos programados para esta fecha. Puedes consultar fechas próximas o actualizar.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setNbaSearchQuery('');
                  setSelectedNBAConference('ALL');
                  setSelectedNBAFilter('ALL');
                }}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
              >
                {nbaFixtures.length > 0 ? `Ver todos los partidos de Baloncesto (${nbaFixtures.length})` : 'Limpiar filtros'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: 🔥 BALONCESTO TOP PICKS */}
        {mainTab === 'TOP_PICKS' && !isNBALoading && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-2 border-amber-500 border-y border-r border-amber-500/20 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">
                  Joyas Analíticas de Baloncesto ({nbaTopPicks.length} selecciones con certeza &ge;68% o +EV)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Ordenadas por mayor probabilidad</span>
            </div>

            {nbaTopPicks.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-white">No hay apuestas NBA con filtro verde en este momento</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Explora la Cartelera Completa para ver todos los encuentros y props de jugadores.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleSelectMainTab('ALL_LEAGUES')}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
                  >
                    Ver Cartelera NBA Completa
                  </button>
                </div>
              </div>
            ) : densityView === 'COMPACT' ? (
              <div className="space-y-2">
                {nbaTopPicks.map(({ fixture, analysis }) => (
                  <CompactNBAMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenNBADetail}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {nbaTopPicks.map(({ fixture, analysis }) => (
                  <NBAPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 🔴 NBA EN VIVO */}
        {mainTab === 'LIVE' && !isNBALoading && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-l-2 border-rose-500 border-y border-r border-rose-500/20 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="text-xs font-semibold text-rose-300">
                  Duelos en Directo de Baloncesto ({nbaLiveFixtures.length})
                </span>
              </div>
              <button
                onClick={() => loadNBAMatches(currentDate, true)}
                disabled={isNBALoading}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isNBALoading ? 'animate-spin' : ''}`} />
                <span>Actualizar Cuartos</span>
              </button>
            </div>

            {nbaLiveFixtures.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-white">No hay partidos de Baloncesto en juego en este momento</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  La jornada de Baloncesto se actualizará cuarto a cuarto en vivo aquí.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleSelectMainTab('TOP_PICKS')}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
                  >
                    Ver Top Picks Baloncesto
                  </button>
                  <button
                    onClick={() => handleSelectMainTab('ALL_LEAGUES')}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer border border-slate-700"
                  >
                    Ver Cartelera Completa
                  </button>
                </div>
              </div>
            ) : densityView === 'COMPACT' ? (
              <div className="space-y-2">
                {nbaLiveFixtures.map((fixture) => (
                  <CompactNBAMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={nbaAnalysesMap[fixture.id]!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenNBADetail}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {nbaLiveFixtures.map((fixture) => (
                  <NBAPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={nbaAnalysesMap[fixture.id]!}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 🌐 CARTELERA NBA COMPLETA */}
        {mainTab === 'ALL_LEAGUES' && !isNBALoading && filteredNBAFixtures.length > 0 && (
          densityView === 'COMPACT' ? (
            <div className="space-y-2">
              {filteredNBAFixtures.map((fixture) => {
                const analysis = nbaAnalysesMap[fixture.id];
                if (!analysis) return null;
                return (
                  <CompactNBAMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    onOpenDetail={handleOpenNBADetail}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNBAFixtures.map((fixture) => {
                const analysis = nbaAnalysesMap[fixture.id];
                if (!analysis) return null;
                return (
                  <NBAPredictionCard
                    key={fixture.id}
                    fixture={fixture}
                    analysis={analysis}
                    isSelected={selectedFixtureIds.has(fixture.id)}
                    onToggleSelect={handleToggleSelect}
                    isExpanded={expandedCardIds.has(fixture.id)}
                    onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                    viewMode={viewMode}
                    isRecentlyUpdated={recentlyUpdatedFixtureIds.has(fixture.id)}
                  />
                );
              })}
            </div>
          )
        )}
      </main>
    </>
  )}

      {/* Two-Tier Institutional & Legal Shield Footer */}
      <AppFooter activeSport={activeSport} onOpenGuideModal={handleOpenGuideModal} />

      {/* Fixed Mobile Bottom Navigation Bar (Thumb Zone) */}
      <MobileBottomNav
        activeTab={mobileActiveTab}
        onTabChange={(tab) => {
          setMobileActiveTab(tab);
          if (tab === 'ADMIN') {
            setIsAdminModalOpen(true);
          } else if (tab === 'FILTERS') {
            const el = document.querySelector('input[type="text"]') || document.querySelector('button');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          } else if (tab === 'PROBABILITY') {
            setSelectedFilter('RECOMMENDED');
            window.scrollTo({ top: 120, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        liveMatchesCount={fixtures.filter((f) => f.status === 'IN_PLAY').length}
        isAdmin={
          localStorage.getItem('sportstats_admin_remember') === 'true' ||
          Boolean(activeLicenseInfo?.clientName && activeLicenseInfo.clientName.toLowerCase().includes('propietario'))
        }
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenHistory={() => setIsSavedSlipsOpen(true)}
      />

      {/* Offline Connectivity Toast Indicator */}
      <OfflineIndicator />
    </div>
      )}

      {/* Floating Modals & Parlay Builder Container */}
      <AppModalsContainer
        isAdminModalOpen={isAdminModalOpen}
        onCloseAdminModal={() => setIsAdminModalOpen(false)}
        onLogoutSession={handleLogoutSession}
        onLicenseChanged={() => {
          const active = getActiveStoredLicense();
          const devId = getOrCreateDeviceId();
          if (active) {
            const check = verifyLicenseToken(active.key, devId);
            setIsAppUnlocked(check.isValid);
            setActiveLicenseInfo(check.isValid ? check : null);
          } else {
            setIsAppUnlocked(false);
            setActiveLicenseInfo(null);
          }
        }}
        isSimulatorOpen={isSimulatorOpen}
        onCloseSimulator={() => setIsSimulatorOpen(false)}
        selectedMatchForSimulator={selectedMatchForSimulator}
        detailModalPayload={detailModalPayload}
        onCloseDetailModal={() => setDetailModalPayload(null)}
        selectedFixtureIds={selectedFixtureIds}
        onToggleSelect={handleToggleSelect}
        onOpenSimulator={handleOpenSimulator}
        isWallpaperModalOpen={isWallpaperModalOpen}
        onCloseWallpaperModal={() => setIsWallpaperModalOpen(false)}
        selectedWallpaper={selectedWallpaper}
        onSelectWallpaper={handleSelectWallpaper}
        wallpaperOpacity={wallpaperOpacity}
        onChangeOpacity={handleUpdateOpacity}
        wallpaperBlur={wallpaperBlur}
        onChangeBlur={handleUpdateBlur}
        isGuideOpen={isGuideOpen}
        onCloseGuideModal={() => setIsGuideOpen(false)}
        guideInitialTab={guideInitialTab}
        isSavedSlipsOpen={isSavedSlipsOpen}
        onCloseSavedSlipsModal={() => setIsSavedSlipsOpen(false)}
        onOpenSavedSlipsModal={() => setIsSavedSlipsOpen(true)}
      />
    </>
  );
}

