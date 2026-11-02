import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MatchFixture, MatchAnalysis, ActiveSport, NBAMatchFixture, NBAAnalysis } from './types';
import { fetchUpcomingFixtures, getColombiaDateString, syncLivePulseFixtures, fetchMatchLiveTelemetry, sanitizeFixturePlayers, getLocalUpcomingCache } from './services/apiService';
import { calculateMatchAnalysis, clearAnalysisCacheForFixture } from './services/mathEngine';
import { fetchNBAFixtures } from './services/nbaApiService';
import { calculateNBAAnalysis } from './services/nbaEngine';
import type {
  ExportItem,
  NBAExportItem
} from './services/exportService';
import { DetailMatchPayload } from './components/MatchDetailModal';
import { GuideModalTab } from './components/DidacticGuideModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccessLockScreen } from './components/AccessLockScreen';
import { SubscriptionAlertBanner } from './components/SubscriptionAlertBanner';
import { MobileBottomNav, MobileTab } from './components/MobileBottomNav';
import { MainAppHeader } from './components/MainAppHeader';
import { SoccerFilterType } from './components/SoccerFilterBar';
import { NBAFilterType } from './components/NBAFilterBar';
import { FintechSidebar } from './components/FintechSidebar';
import { AppFooter } from './components/AppFooter';
import { AppModalsContainer } from './components/AppModalsContainer';
import { UserFeedbackWidget } from './components/UserFeedbackWidget';
import { SoccerWorkspaceView } from './components/workspace/SoccerWorkspaceView';
import { NBAWorkspaceView } from './components/workspace/NBAWorkspaceView';

const VipPaymentModal = React.lazy(() =>
  import('./components/VipPaymentModal').then((m) => ({ default: m.VipPaymentModal }))
);
import { LiveAlertsOverlay } from './components/workspace/LiveAlertsOverlay';
import { useTheme } from './context/ThemeContext';
import { getSoccerDidacticAdvice, getNBADidacticAdvice } from './services/didacticService';
import { groupFixturesByCompetition, matchesLeagueSelection, isColombianBookmakerPrimeLeague } from './services/leagueCategorizer';
import {
  getActiveStoredLicense,
  getOrCreateDeviceId,
  verifyLicenseToken,
  clearActiveLicense,
  createLicenseToken,
  saveActiveLicense,
  LicenseValidationResult
} from './services/licenseService';
import {
  getStoredFavoriteIds,
  saveStoredFavoriteIds,
  requestBrowserNotificationPermission,
  triggerNativeSystemNotification,
  LiveGoalAlertItem
} from './services/favoritesService';
import { getBrowserSupabase } from './services/supabaseBrowser';
import { Power, Sparkles } from 'lucide-react';

export default function App() {
  // Animación de entrada y salida de sesión
  const [authTransition, setAuthTransition] = useState<'LOGIN' | 'LOGOUT' | null>(null);
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
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenVip = () => setIsVipModalOpen(true);
    window.addEventListener('open-vip-payment-modal', handleOpenVip);
    return () => window.removeEventListener('open-vip-payment-modal', handleOpenVip);
  }, []);
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('MATCHES');
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const handleLogoutSession = useCallback(() => {
    setAuthTransition('LOGOUT');

    setTimeout(async () => {
      try {
        const supabase = await getBrowserSupabase();
        if (supabase) {
          await supabase.auth.signOut().catch(() => {});
        }
        clearActiveLicense();
        localStorage.removeItem('sportstats_admin_remember');
        localStorage.removeItem('sportstats_admin_saved_pin');
        localStorage.removeItem('sportstats_auth_user');
        localStorage.removeItem('sportstats_client_name');
        sessionStorage.clear();

        // Limpiar tokens internos de Supabase para evitar auto-reconexión indeseada
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('sb-') || k.includes('supabase'))) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore storage errors
      }

      setIsAdminModalOpen(false);
      setActiveLicenseInfo(null);
      setIsAppUnlocked(false);

      setTimeout(() => {
        setAuthTransition(null);
      }, 300);
    }, 600);
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

  // Favorites & Live Score Notifications (100% localStorage, 0 API / 0 DB overhead)
  const [favoriteFixtureIds, setFavoriteFixtureIds] = useState<Set<string>>(() => getStoredFavoriteIds());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [liveGoalAlerts, setLiveGoalAlerts] = useState<LiveGoalAlertItem[]>([]);

  const handleToggleFavorite = useCallback((fixtureId: string) => {
    setFavoriteFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
        // Request browser notification permission when user adds a favorite match
        requestBrowserNotificationPermission().catch(() => {});
      }
      saveStoredFavoriteIds(next);
      return next;
    });
  }, []);

  const pushLiveGoalAlert = useCallback((item: LiveGoalAlertItem) => {
    setLiveGoalAlerts((prev) => [item, ...prev.filter((a) => a.fixtureId !== item.fixtureId)].slice(0, 3));
    if (item.isFavorite) {
      triggerNativeSystemNotification(item);
    }
    setTimeout(() => {
      setLiveGoalAlerts((prev) => prev.filter((a) => a.id !== item.id));
    }, 18000);
  }, []);

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

  // Density View: Permanent clean compact list (clicking opens full MatchDetailModal)
  const [densityView, setDensityView] = useState<'CARDS' | 'COMPACT'>('COMPACT');

  const handleSelectDensityView = useCallback((density: 'CARDS' | 'COMPACT') => {
    setDensityView(density);
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

  // Progressive batch rendering count (default 5 matches so initial screen has zero scroll fatigue)
  const [visibleMatchLimit, setVisibleMatchLimit] = useState<number>(5);

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
        const username = localStorage.getItem('sportstats_auth_user') || undefined;
        const clientName = localStorage.getItem('sportstats_client_name') || username || undefined;
        const deviceInfo = typeof navigator !== 'undefined' ? `${navigator.platform || ''} (${navigator.userAgent.slice(0, 45)})` : undefined;

        const res = await fetch('/api/license/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: active?.key,
            deviceId: devId,
            username,
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
    const interval = setInterval(sendHeartbeat, 45000);
    return () => clearInterval(interval);
  }, [isAppUnlocked]);

  // Reset pagination limit to 5 when any filter, tab, sport, or date changes
  useEffect(() => {
    setVisibleMatchLimit(5);
  }, [currentDate, selectedLeague, selectedFilter, searchQuery, mainTab, activeSport]);

  // NBA Specific States & Filters
  const [nbaFixtures, setNbaFixtures] = useState<NBAMatchFixture[]>([]);
  const [isNBALoading, setIsNBALoading] = useState<boolean>(false);
  const [nbaSearchQuery, setNbaSearchQuery] = useState<string>('');
  const [selectedNBAConference, setSelectedNBAConference] = useState<string>('ALL');
  const [selectedNBAFilter, setSelectedNBAFilter] = useState<NBAFilterType>('ALL');

  // Smart Search & Date Handlers (Universal Search like Flashscore/Sofascore)
  const handleSoccerSearchChange = useCallback(
    (val: string) => {
      setSearchQuery(val);
      if (val.trim().length > 0 && mainTab !== 'ALL_LEAGUES') {
        handleSelectMainTab('ALL_LEAGUES');
      }
    },
    [mainTab, handleSelectMainTab]
  );

  const handleNbaSearchChange = useCallback(
    (val: string) => {
      setNbaSearchQuery(val);
      if (val.trim().length > 0 && mainTab !== 'ALL_LEAGUES') {
        handleSelectMainTab('ALL_LEAGUES');
      }
    },
    [mainTab, handleSelectMainTab]
  );

  const handleSmartDateChange = useCallback(
    (newDate: string) => {
      setCurrentDate(newDate);
      const todayStr = getColombiaDateString(0);
      // Prevent staying trapped in LIVE tab when switching to future/past dates
      if (mainTab === 'LIVE' && newDate !== todayStr) {
        handleSelectMainTab('ALL_LEAGUES');
      }
    },
    [mainTab, handleSelectMainTab]
  );

  // Cross-Day 5-Day Fixtures Cache for Global Team Search (0 extra external API cost)
  const [multiDayFixturesMap, setMultiDayFixturesMap] = useState<Record<string, MatchFixture[]>>({});
  const [isSearchingOtherDays, setIsSearchingOtherDays] = useState<boolean>(false);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2 || activeSport !== 'SOCCER') {
      setIsSearchingOtherDays(false);
      return;
    }

    const fiveDates = [0, 1, 2, 3, 4].map((offset) => getColombiaDateString(offset));
    // 1. Synchronous read from localStorage cache for immediate 0ms results
    const immediateMap: Record<string, MatchFixture[]> = {};
    const missingDates: string[] = [];

    fiveDates.forEach((d) => {
      if (d === currentDate) return;
      const cached = getLocalUpcomingCache(d);
      if (cached && cached.fixtures.length > 0) {
        immediateMap[d] = cached.fixtures;
      } else {
        missingDates.push(d);
      }
    });

    setMultiDayFixturesMap((prev) => ({ ...prev, ...immediateMap }));

    // 2. If query >= 3 chars and some days in the 5-day window aren't cached locally yet,
    // query shared server cache (forceRefresh: false -> 0 external API quota impact)
    if (q.length >= 3 && missingDates.length > 0) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        setIsSearchingOtherDays(true);
        try {
          const results = await Promise.all(
            missingDates.map(async (d) => {
              try {
                const res = await fetchUpcomingFixtures(d, { forceRefresh: false });
                return { dateStr: d, list: res.fixtures || [] };
              } catch {
                return { dateStr: d, list: [] as MatchFixture[] };
              }
            })
          );
          if (!cancelled) {
            setMultiDayFixturesMap((prev) => {
              const next = { ...prev };
              results.forEach(({ dateStr, list }) => {
                if (list.length > 0) next[dateStr] = list;
              });
              return next;
            });
          }
        } finally {
          if (!cancelled) setIsSearchingOtherDays(false);
        }
      }, 300);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [searchQuery, currentDate, activeSport]);

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

  // Strict Background Scroll Lock whenever any Modal or Mobile Menu Drawer is open
  useEffect(() => {
    const isAnyModalOrMenuOpen =
      isMobileDrawerOpen ||
      isAdminModalOpen ||
      isSimulatorOpen ||
      Boolean(detailModalPayload) ||
      isWallpaperModalOpen ||
      isGuideOpen ||
      isSavedSlipsOpen;

    if (isAnyModalOrMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [
    isMobileDrawerOpen,
    isAdminModalOpen,
    isSimulatorOpen,
    detailModalPayload,
    isWallpaperModalOpen,
    isGuideOpen,
    isSavedSlipsOpen
  ]);

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
      const activeStatuses = new Set([
        'SCHEDULED',
        'TIMED',
        'IN_PLAY',
        'PAUSED',
        'HALFTIME',
        'EXTRA_TIME',
        'PENALTY_SHOOTOUT'
      ]);
      const activeFixtures = result.fixtures.filter((f) => {
        const idStr = String(f.id);
        if (idStr === '991001' || idStr === '991002' || idStr === '991003') return false;
        return activeStatuses.has(f.status);
      });
      if (forceRefresh) {
        activeFixtures.forEach((f) => clearAnalysisCacheForFixture(f.id));
      }
      setFixtures(activeFixtures);
      setSelectedFixtureIds(new Set());

      setDetailModalPayload((prev) => {
        if (!prev || prev.type !== 'SOCCER') return prev;
        const updatedFix = activeFixtures.find((f) => f.id === prev.fixture.id);
        if (!updatedFix) return prev;
        clearAnalysisCacheForFixture(updatedFix.id);
        return {
          type: 'SOCCER',
          fixture: updatedFix,
          analysis: calculateMatchAnalysis(updatedFix)
        };
      });

      // Reconcile against shared live pulse cache so live scores are always up to date
      if (activeFixtures.length > 0) {
        syncLivePulseFixtures(dateStr, activeFixtures, false)
          .then((pulseRes) => {
            if (pulseRes.changedIds.length > 0 || pulseRes.updatedFixtures.length !== activeFixtures.length) {
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
            k.startsWith('futbolstats_upcoming_v11_') ||
            k.startsWith('futbolstats_upcoming_v12_') ||
            k.startsWith('futbolstats_upcoming_v13_') ||
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

  // 20-Second Hybrid Live Update Engine
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
    }, 18000);
  }, []);

  const runLivePulseCheck = useCallback(async () => {
    if (activeSport === 'SOCCER' && fixtures.length > 0) {
      const pulseRes = await syncLivePulseFixtures(currentDate, fixtures, false);
      if (pulseRes.changedIds.length > 0 || pulseRes.updatedFixtures.length !== fixtures.length) {
        pulseRes.changedIds.forEach((id) => clearAnalysisCacheForFixture(id));
        setFixtures(pulseRes.updatedFixtures);

        if (pulseRes.scoreChangedIds && pulseRes.scoreChangedIds.length > 0) {
          triggerLiveFlashEffect(pulseRes.scoreChangedIds);
        }

        // STRICT FAVORITES-ONLY LIVE NOTIFICATIONS (Goals, Disallowed VAR, Red Cards, Half Start/End)
        const fullPool = pulseRes.allUpdatedFixtures || pulseRes.updatedFixtures;
        pulseRes.changedIds.forEach((changedId) => {
          if (!favoriteFixtureIds.has(changedId)) return; // ONLY notify for Favorite matches!

          const oldFix = fixtures.find((f: MatchFixture) => f.id === changedId);
          const newFix = fullPool.find((f: MatchFixture) => f.id === changedId);
          if (!oldFix || !newFix) return;

          const oldH = oldFix.currentScore?.home ?? 0;
          const oldA = oldFix.currentScore?.away ?? 0;
          const newH = newFix.currentScore?.home ?? 0;
          const newA = newFix.currentScore?.away ?? 0;
          const minNum = newFix.currentScore?.minute;
          const minLabel = newFix.currentScore?.isHalfTime ? "MT 45'" : minNum ? `${minNum}'` : 'EN VIVO';

          // 1. Goal Scored
          if (newH > oldH || newA > oldA) {
            const scoringTeam: 'HOME' | 'AWAY' = newA > oldA && newH === oldH ? 'AWAY' : 'HOME';
            const scorerName = scoringTeam === 'HOME' ? newFix.homeTeam.name : newFix.awayTeam.name;
            pushLiveGoalAlert({
              id: `goal-${newFix.id}-${newH}-${newA}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam,
              minuteOrQuarter: minLabel,
              alertKind: 'GOAL',
              badgeText: '¡GOL EN VIVO!',
              subtitleText: `Anotó: ${scorerName} · Toca para cancha 2D`,
              iconEmoji: '⚽',
              timestamp: Date.now(),
              isFavorite: true
            });
            return;
          }

          // 2. Disallowed Goal / VAR Correction
          if (newH < oldH || newA < oldA) {
            const affectedSide: 'HOME' | 'AWAY' = newA < oldA ? 'AWAY' : 'HOME';
            const affectedTeam = affectedSide === 'HOME' ? newFix.homeTeam.name : newFix.awayTeam.name;
            pushLiveGoalAlert({
              id: `var-${newFix.id}-${newH}-${newA}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: affectedSide,
              minuteOrQuarter: minLabel,
              alertKind: 'VAR_DISALLOWED',
              badgeText: 'GOL ANULADO · VAR',
              subtitleText: `Anulado a ${affectedTeam} · Marcador corregido`,
              iconEmoji: '⚠️',
              timestamp: Date.now(),
              isFavorite: true
            });
            return;
          }

          // 3. Red Card / Expulsion
          const oldHomeRed = oldFix.liveStats?.home.redCards ?? 0;
          const oldAwayRed = oldFix.liveStats?.away.redCards ?? 0;
          const newHomeRed = newFix.liveStats?.home.redCards ?? 0;
          const newAwayRed = newFix.liveStats?.away.redCards ?? 0;
          const oldRedEvents = (oldFix.liveEvents || []).filter((e: { type: string }) => e.type === 'RED_CARD').length;
          const newRedEvents = (newFix.liveEvents || []).filter((e: { type: string }) => e.type === 'RED_CARD').length;

          if (newHomeRed > oldHomeRed || newAwayRed > oldAwayRed || newRedEvents > oldRedEvents) {
            const redSide: 'HOME' | 'AWAY' = newAwayRed > oldAwayRed ? 'AWAY' : 'HOME';
            const redTeam = redSide === 'HOME' ? newFix.homeTeam.name : newFix.awayTeam.name;
            pushLiveGoalAlert({
              id: `red-${newFix.id}-${newHomeRed}-${newAwayRed}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: redSide,
              minuteOrQuarter: minLabel,
              alertKind: 'RED_CARD',
              badgeText: 'EXPULSIÓN · ROJA',
              subtitleText: `Tarjeta roja en ${redTeam}`,
              iconEmoji: '🟥',
              timestamp: Date.now(),
              isFavorite: true
            });
            return;
          }

          // 4. Start & End of Each Half (1T Start, Halftime, 2T Start, Full Time)
          const oldHT = Boolean(oldFix.currentScore?.isHalfTime || oldFix.status === 'HALFTIME');
          const newHT = Boolean(newFix.currentScore?.isHalfTime || newFix.status === 'HALFTIME');

          if ((oldFix.status === 'SCHEDULED' || oldFix.status === 'TIMED') && newFix.status === 'IN_PLAY') {
            pushLiveGoalAlert({
              id: `p-1t-${newFix.id}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: 'NEUTRAL',
              minuteOrQuarter: "1'",
              alertKind: 'PERIOD_CHANGE',
              badgeText: 'INICIO 1ER TIEMPO',
              subtitleText: 'Comienza el partido en vivo',
              iconEmoji: '⏱️',
              timestamp: Date.now(),
              isFavorite: true
            });
          } else if (!oldHT && newHT) {
            pushLiveGoalAlert({
              id: `p-ht-${newFix.id}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: 'NEUTRAL',
              minuteOrQuarter: 'MT',
              alertKind: 'PERIOD_CHANGE',
              badgeText: 'FIN 1T · DESCANSO',
              subtitleText: 'Final del primer tiempo (Entretiempo)',
              iconEmoji: '⏸️',
              timestamp: Date.now(),
              isFavorite: true
            });
          } else if (oldHT && !newHT && newFix.status === 'IN_PLAY') {
            pushLiveGoalAlert({
              id: `p-2t-${newFix.id}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: 'NEUTRAL',
              minuteOrQuarter: "46'",
              alertKind: 'PERIOD_CHANGE',
              badgeText: 'INICIO 2DO TIEMPO',
              subtitleText: 'Arranca la segunda mitad en vivo',
              iconEmoji: '▶️',
              timestamp: Date.now(),
              isFavorite: true
            });
          } else if (oldFix.status !== 'FINISHED' && newFix.status === 'FINISHED') {
            pushLiveGoalAlert({
              id: `p-ft-${newFix.id}-${Date.now()}`,
              sport: 'SOCCER',
              fixtureId: newFix.id,
              leagueName: newFix.league.name,
              homeTeam: newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: 'NEUTRAL',
              minuteOrQuarter: 'FINAL',
              alertKind: 'PERIOD_CHANGE',
              badgeText: 'FINAL DEL PARTIDO',
              subtitleText: `Marcador definitivo: ${newH} - ${newA}`,
              iconEmoji: '🏁',
              timestamp: Date.now(),
              isFavorite: true
            });
          }
        });

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

      // Direct telemetry refresh for the currently open live Soccer match modal
      const isModalMatchLive =
        detailModalPayload?.type === 'SOCCER' &&
        ['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(detailModalPayload.fixture.status);

      if (isModalMatchLive && detailModalPayload?.type === 'SOCCER') {
        const activeFix = detailModalPayload.fixture;
        const telemetry = await fetchMatchLiveTelemetry(activeFix);
        if (telemetry) {
          const nextHome =
            typeof telemetry.homeGoals === 'number' ? telemetry.homeGoals : (activeFix.currentScore?.home ?? 0);
          const nextAway =
            typeof telemetry.awayGoals === 'number' ? telemetry.awayGoals : (activeFix.currentScore?.away ?? 0);
          const nextHT =
            telemetry.isHalfTime !== undefined ? telemetry.isHalfTime : Boolean(activeFix.currentScore?.isHalfTime);
          const nextStatusShort = telemetry.statusShort || activeFix.currentScore?.statusShort;
          const nextStatus =
            nextHT || nextStatusShort === 'HT'
              ? 'HALFTIME'
              : nextStatusShort === 'PEN'
                ? 'PENALTY_SHOOTOUT'
                : nextStatusShort === 'ET' || nextStatusShort === '1ET' || nextStatusShort === '2ET'
                  ? 'EXTRA_TIME'
                  : activeFix.status;

          const mergedEvents =
            telemetry.liveEvents && telemetry.liveEvents.length > 0 ? telemetry.liveEvents : activeFix.liveEvents;
          const maxEventMin =
            mergedEvents && mergedEvents.length > 0
              ? mergedEvents.reduce((max, ev) => Math.max(max, Number(ev.minute) || 0), 0)
              : 0;
          const nextMin = nextHT
            ? 45
            : typeof telemetry.minute === 'number' && telemetry.minute > 0
              ? Math.max(telemetry.minute, maxEventMin)
              : Math.max(activeFix.currentScore?.minute ?? 1, maxEventMin);

          const enrichedFix = sanitizeFixturePlayers({
            ...activeFix,
            status: nextStatus,
            espnEventId: telemetry.espnEventId || activeFix.espnEventId,
            currentScore: {
              home: nextHome,
              away: nextAway,
              minute: nextMin,
              isHalfTime: nextHT,
              statusShort: nextStatusShort
            },
            liveStats: telemetry.liveStats || activeFix.liveStats,
            liveEvents: mergedEvents,
            liveRosters: telemetry.liveRosters || activeFix.liveRosters
          });

          clearAnalysisCacheForFixture(enrichedFix.id);
          const enrichedAnalysis = calculateMatchAnalysis(enrichedFix);
          setFixtures((prev) => prev.map((f) => (f.id === enrichedFix.id ? enrichedFix : f)));
          setDetailModalPayload((prev) =>
            prev && prev.type === 'SOCCER' && prev.fixture.id === enrichedFix.id
              ? { type: 'SOCCER', fixture: enrichedFix, analysis: enrichedAnalysis }
              : prev
          );
        }
      }
    } else if (activeSport === 'NBA' && nbaFixtures.length > 0) {
      const res = await fetchNBAFixtures(currentDate, { forceRefresh: false });
      const changedNbaIds: string[] = [];
      const fullNbaPool: NBAMatchFixture[] = (res.allFixtures || res.fixtures) || [];

      fullNbaPool.forEach((newFix: NBAMatchFixture) => {
        const oldFix = nbaFixtures.find((f) => f.id === newFix.id);
        if (!oldFix) return;

        const oldH = oldFix.currentScore?.home ?? 0;
        const oldA = oldFix.currentScore?.away ?? 0;
        const newH = newFix.currentScore?.home ?? 0;
        const newA = newFix.currentScore?.away ?? 0;
        const oldScore = `${oldH}-${oldA}`;
        const newScore = `${newH}-${newA}`;
        const quarterOnly =
          newFix.livePeriod === 'HT'
            ? 'MT'
            : newFix.livePeriod || 'Q1';

        if (oldScore !== newScore) {
          changedNbaIds.push(newFix.id);
        }

        // STRICT FAVORITES-ONLY FLOATING NOTIFICATIONS FOR NBA
        if (!favoriteFixtureIds.has(newFix.id)) return;

        // 1. Score Changed (+1 Free Throw, +2 Field Goal, +3 Triple, or Score Rectification)
        if (oldScore !== newScore) {
          const diffH = newH - oldH;
          const diffA = newA - oldA;

          if (diffH > 0 || diffA > 0) {
            const scoringTeam: 'HOME' | 'AWAY' = diffA > diffH ? 'AWAY' : 'HOME';
            const ptsAdded = Math.min(4, Math.max(1, scoringTeam === 'HOME' ? diffH : diffA));
            const scorerTeam =
              scoringTeam === 'HOME'
                ? newFix.homeTeam.shortName || newFix.homeTeam.name
                : newFix.awayTeam.shortName || newFix.awayTeam.name;

            const badgeText =
              ptsAdded >= 3
                ? `¡TRIPLE! (+${ptsAdded} PTS)`
                : ptsAdded === 1
                ? 'TIRO LIBRE (+1 PT)'
                : 'CANASTA (+2 PTS)';
            const iconEmoji = ptsAdded >= 3 ? '🎯' : '🏀';

            pushLiveGoalAlert({
              id: `nba-${newFix.id}-${newH}-${newA}-${Date.now()}`,
              sport: 'NBA',
              fixtureId: newFix.id,
              leagueName: newFix.league?.name || 'NBA',
              homeTeam: newFix.homeTeam.shortName || newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.shortName || newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam,
              minuteOrQuarter: quarterOnly,
              detailText: `+${ptsAdded} ${ptsAdded === 1 ? 'PT' : 'PTS'}`,
              alertKind: ptsAdded >= 3 ? 'BASKET_3PT' : ptsAdded === 1 ? 'BASKET_1PT' : 'BASKET_2PT',
              badgeText,
              subtitleText: `Anotó: ${scorerTeam} · Toca para cancha 2D`,
              iconEmoji,
              timestamp: Date.now(),
              isFavorite: true
            });
            return;
          } else if (diffH < 0 || diffA < 0) {
            pushLiveGoalAlert({
              id: `nba-corr-${newFix.id}-${newH}-${newA}-${Date.now()}`,
              sport: 'NBA',
              fixtureId: newFix.id,
              leagueName: newFix.league?.name || 'NBA',
              homeTeam: newFix.homeTeam.shortName || newFix.homeTeam.name,
              awayTeam: newFix.awayTeam.shortName || newFix.awayTeam.name,
              homeLogo: newFix.homeTeam.logo,
              awayLogo: newFix.awayTeam.logo,
              homeScore: newH,
              awayScore: newA,
              scoringTeam: 'NEUTRAL',
              minuteOrQuarter: quarterOnly,
              alertKind: 'VAR_DISALLOWED',
              badgeText: 'AJUSTE DE MARCADOR',
              subtitleText: 'Rectificación oficial de mesa NBA',
              iconEmoji: '⚠️',
              timestamp: Date.now(),
              isFavorite: true
            });
            return;
          }
        }

        // 2. Start & End of Quarters (Q1 Start, Q2, Halftime MT, Q3, Q4, OT, Final)
        if (oldFix.status === 'SCHEDULED' && newFix.status === 'IN_PLAY') {
          pushLiveGoalAlert({
            id: `nba-q1-${newFix.id}-${Date.now()}`,
            sport: 'NBA',
            fixtureId: newFix.id,
            leagueName: newFix.league?.name || 'NBA',
            homeTeam: newFix.homeTeam.shortName || newFix.homeTeam.name,
            awayTeam: newFix.awayTeam.shortName || newFix.awayTeam.name,
            homeLogo: newFix.homeTeam.logo,
            awayLogo: newFix.awayTeam.logo,
            homeScore: newH,
            awayScore: newA,
            scoringTeam: 'NEUTRAL',
            minuteOrQuarter: 'Q1',
            alertKind: 'PERIOD_CHANGE',
            badgeText: 'INICIO 1ER CUARTO (Q1)',
            subtitleText: 'Salto inicial en vivo',
            iconEmoji: '⏱️',
            timestamp: Date.now(),
            isFavorite: true
          });
        } else if (oldFix.status === 'IN_PLAY' && newFix.status === 'FINISHED') {
          pushLiveGoalAlert({
            id: `nba-fin-${newFix.id}-${Date.now()}`,
            sport: 'NBA',
            fixtureId: newFix.id,
            leagueName: newFix.league?.name || 'NBA',
            homeTeam: newFix.homeTeam.shortName || newFix.homeTeam.name,
            awayTeam: newFix.awayTeam.shortName || newFix.awayTeam.name,
            homeLogo: newFix.homeTeam.logo,
            awayLogo: newFix.awayTeam.logo,
            homeScore: newH,
            awayScore: newA,
            scoringTeam: 'NEUTRAL',
            minuteOrQuarter: 'FINAL',
            alertKind: 'PERIOD_CHANGE',
            badgeText: 'FINAL DEL PARTIDO',
            subtitleText: `Marcador final: ${newH} - ${newA}`,
            iconEmoji: '🏁',
            timestamp: Date.now(),
            isFavorite: true
          });
        } else if (
          newFix.status === 'IN_PLAY' &&
          oldFix.livePeriod &&
          newFix.livePeriod &&
          oldFix.livePeriod !== newFix.livePeriod
        ) {
          const isHalftime = newFix.livePeriod === 'HT';
          pushLiveGoalAlert({
            id: `nba-per-${newFix.id}-${newFix.livePeriod}-${Date.now()}`,
            sport: 'NBA',
            fixtureId: newFix.id,
            leagueName: newFix.league?.name || 'NBA',
            homeTeam: newFix.homeTeam.shortName || newFix.homeTeam.name,
            awayTeam: newFix.awayTeam.shortName || newFix.awayTeam.name,
            homeLogo: newFix.homeTeam.logo,
            awayLogo: newFix.awayTeam.logo,
            homeScore: newH,
            awayScore: newA,
            scoringTeam: 'NEUTRAL',
            minuteOrQuarter: quarterOnly,
            alertKind: 'PERIOD_CHANGE',
            badgeText: isHalftime ? 'FIN Q2 · MEDIO TIEMPO' : `FIN ${oldFix.livePeriod} · INICIO ${newFix.livePeriod}`,
            subtitleText: isHalftime ? 'Descanso de medio tiempo' : `En juego ${newFix.livePeriod}`,
            iconEmoji: isHalftime ? '⏸️' : '▶️',
            timestamp: Date.now(),
            isFavorite: true
          });
        }
      });

      setNbaFixtures(res.fixtures);
      if (changedNbaIds.length > 0) {
        triggerLiveFlashEffect(changedNbaIds);
      }

      // Keep open NBA modal synchronized in real time (score, quarters, liveSituation)
      setDetailModalPayload((prev) => {
        if (!prev || prev.type !== 'NBA') return prev;
        const updatedNbaFix = res.fixtures.find((f) => f.id === prev.fixture.id);
        if (!updatedNbaFix) return prev;
        return {
          type: 'NBA',
          fixture: updatedNbaFix,
          analysis: calculateNBAAnalysis(updatedNbaFix)
        };
      });
    }
  }, [activeSport, currentDate, fixtures, nbaFixtures, triggerLiveFlashEffect, detailModalPayload, favoriteFixtureIds, pushLiveGoalAlert]);

  useEffect(() => {
    const isModalViewingLiveMatch =
      Boolean(detailModalPayload) &&
      ['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(
        detailModalPayload?.fixture.status || ''
      );
    const intervalMs = isModalViewingLiveMatch ? 15000 : 20000;

    const interval = setInterval(() => {
      runLivePulseCheck();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [runLivePulseCheck, detailModalPayload]);

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
      // When user actively searches by text, search across ALL leagues & filters of the day
      if (q) {
        const homeName = f.homeTeam.name.toLowerCase();
        const awayName = f.awayTeam.name.toLowerCase();
        const leagueName = f.league.name.toLowerCase();
        const countryName = (f.league.country || '').toLowerCase();
        const starHome = (f.homeTeam.starPlayer?.name || '').toLowerCase();
        const starAway = (f.awayTeam.starPlayer?.name || '').toLowerCase();

        return (
          homeName.includes(q) ||
          awayName.includes(q) ||
          leagueName.includes(q) ||
          countryName.includes(q) ||
          starHome.includes(q) ||
          starAway.includes(q)
        );
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
      const isLiveState = ['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(f.status);
      if (selectedFilter === 'LIVE_ONLY' && !isLiveState) {
        return false;
      }
      if (selectedFilter === 'UPCOMING_ONLY' && !['SCHEDULED', 'TIMED'].includes(f.status)) {
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

      if (showFavoritesOnly && !favoriteFixtureIds.has(f.id)) {
        return false;
      }

      return true;
    });
  }, [fixtures, analysesMap, selectedLeague, selectedFilter, searchQuery, showFavoritesOnly, favoriteFixtureIds]);

  // Cross-Day Search Matches (finds when a searched team plays across the other 4 days of the 5-day calendar)
  const crossDaySearchMatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q.length < 2) return [];

    const todayStr = getColombiaDateString(0);
    const tomorrowStr = getColombiaDateString(1);
    const day2Str = getColombiaDateString(2);
    const fiveDates = [0, 1, 2, 3, 4].map((offset) => getColombiaDateString(offset));

    const formatDayBadge = (dStr: string) => {
      if (dStr === todayStr) return 'Hoy';
      if (dStr === tomorrowStr) return 'Mañana';
      if (dStr === day2Str) return 'Pasado Mañana';
      try {
        const [y, m, d] = dStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
      } catch {
        return dStr;
      }
    };

    const matches: Array<{
      dateStr: string;
      dateLabel: string;
      fixture: MatchFixture;
      analysis: MatchAnalysis;
    }> = [];

    fiveDates.forEach((dStr) => {
      if (dStr === currentDate) return;
      const dayList = multiDayFixturesMap[dStr] || [];
      dayList.forEach((f) => {
        const homeName = f.homeTeam.name.toLowerCase();
        const awayName = f.awayTeam.name.toLowerCase();
        const leagueName = f.league.name.toLowerCase();
        const starHome = (f.homeTeam.starPlayer?.name || '').toLowerCase();
        const starAway = (f.awayTeam.starPlayer?.name || '').toLowerCase();

        if (
          homeName.includes(q) ||
          awayName.includes(q) ||
          leagueName.includes(q) ||
          starHome.includes(q) ||
          starAway.includes(q)
        ) {
          matches.push({
            dateStr: dStr,
            dateLabel: formatDayBadge(dStr),
            fixture: f,
            analysis: calculateMatchAnalysis(f)
          });
        }
      });
    });

    return matches.slice(0, 15);
  }, [searchQuery, currentDate, multiDayFixturesMap]);

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

  // Progressive slicing: when viewing a specific league or active search, always show all its matches.
  // When viewing ALL leagues (potentially 200+ matches), slice to visibleMatchLimit for snappy mobile performance.
  const displayFixtures = useMemo(() => {
    if (searchQuery.trim().length > 0 || selectedLeague !== 'ALL' || filteredFixtures.length <= visibleMatchLimit) {
      return filteredFixtures;
    }
    return filteredFixtures.slice(0, visibleMatchLimit);
  }, [filteredFixtures, selectedLeague, visibleMatchLimit, searchQuery]);

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

  // Unified manual refresh handler: respects 30s cooldown and reads exclusively from shared server cache + live pulse
  const handleManualRefresh = useCallback(() => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(30);
    if (activeSport === 'NBA') {
      loadNBAMatches(currentDate, false);
    } else if (fixtures.length > 0) {
      runLivePulseCheck();
    } else {
      loadMatches(currentDate, false);
    }
  }, [refreshCooldown, activeSport, currentDate, fixtures.length, loadNBAMatches, runLivePulseCheck, loadMatches]);

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
    const map = new Map<string, { key: string; name: string; icon: string; flag: string; count: number }>();
    nbaFixtures.forEach((f) => {
      const lName = f.league?.name || 'NBA';
      const flag = lName.includes('NBA') && !lName.includes('W') ? '🇺🇸' : lName.includes('NCAA') ? '🎓' : lName.includes('WNBA') ? '🏀' : lName.includes('FIBA') ? '🌍' : '🏀';
      const key = lName.includes('NBA') && !lName.includes('W') ? 'NBA' : lName.includes('NCAA') ? 'NCAA' : lName.includes('WNBA') ? 'WNBA' : lName.includes('FIBA') ? 'FIBA' : lName;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { key, name: lName, icon: flag, flag, count: 1 });
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
      if (showFavoritesOnly && !favoriteFixtureIds.has(f.id)) {
        return false;
      }
      return true;
    });
  }, [nbaFixtures, nbaSearchQuery, selectedNBAConference, selectedNBAFilter, nbaAnalysesMap, showFavoritesOnly, favoriteFixtureIds]);

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
    return filteredFixtures.filter((f) =>
      ['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(f.status)
    );
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
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // ignore
      }
    }
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
  const handleDownloadExcel = async (onlySelected = false) => {
    const { exportToExcel, exportNBAToExcel } = await import('./services/exportService');
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

  const handleDownloadPDF = async (onlySelected = false) => {
    const { exportToPDF, exportNBAToPDF } = await import('./services/exportService');
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
            setAuthTransition('LOGIN');
            setTimeout(() => {
              setIsAppUnlocked(true);
              setActiveLicenseInfo(result);
              setTimeout(() => {
                setAuthTransition(null);
              }, 400);
            }, 600);
          }}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onOpenGuide={handleOpenGuideModal}
        />
      ) : (
        <div
          className="min-h-screen cr7-cinematic-bg text-slate-900 flex flex-col lg:flex-row font-sans selection:bg-emerald-500 selection:text-white pb-20 lg:pb-0 transition-colors duration-200"
          style={{
            ['--wallpaper-bg' as string]: `url("${encodeURI(selectedWallpaper)}")`,
            ['--wallpaper-opacity' as string]: `${Math.max(0.18, Math.min(wallpaperOpacity * 0.65, 0.58))}`,
            ['--wallpaper-blur' as string]: `${wallpaperBlur}px`
          } as React.CSSProperties}
        >
          {/* Left Column: Gmail-Style Collapsible Sidebar (Desktop) & Slide-Over Drawer (Mobile) */}
          <FintechSidebar
            isDesktopCollapsed={isDesktopSidebarCollapsed}
            onToggleDesktopCollapse={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
            isMobileDrawerOpen={isMobileDrawerOpen}
            onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
            activeSport={activeSport}
            onSelectSport={handleSelectSport}
            mainTab={mainTab}
            onSelectMainTab={handleSelectMainTab}
            liveMatchesCount={activeSport === 'SOCCER' ? soccerLiveFixtures.length : nbaLiveFixtures.length}
            topPicksCount={activeSport === 'SOCCER' ? soccerTopPicks.length : nbaTopPicks.length}
            allLeaguesCount={activeSport === 'SOCCER' ? filteredFixtures.length : filteredNBAFixtures.length}
            currentDate={currentDate}
            onDateChange={handleSmartDateChange}
            selectedLeague={selectedLeague}
            onLeagueChange={setSelectedLeague}
            primeFixturesCount={primeFixturesCount}
            totalFixturesCount={fixtures.length}
            availableCompetitionGroups={availableCompetitionGroups}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            selectedNBAConference={selectedNBAConference}
            onNBAConferenceChange={setSelectedNBAConference}
            totalNBAFixturesCount={nbaFixtures.length}
            nbaEsteCount={nbaEsteCount}
            nbaOesteCount={nbaOesteCount}
            availableBasketballLeagues={availableBasketballLeagues}
            selectedNBAFilter={selectedNBAFilter}
            onNBAFilterChange={setSelectedNBAFilter}
            nbaFixtures={nbaFixtures}
            onOpenSoccerMatchFromMenu={(fixture) => {
              const analysis = analysesMap[fixture.id] || calculateMatchAnalysis(fixture);
              handleOpenSoccerDetail(fixture, analysis);
            }}
            onOpenNBAMatchFromMenu={(fixture) => {
              const analysis = nbaAnalysesMap[fixture.id] || calculateNBAAnalysis(fixture);
              handleOpenNBADetail(fixture, analysis);
            }}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
            isAdminVisible={
              localStorage.getItem('sportstats_admin_remember') === 'true' ||
              Boolean(activeLicenseInfo?.clientName && activeLicenseInfo.clientName.toLowerCase().includes('propietario'))
            }
            onSecretAdminLogoClick={handleSecretAdminLogoClick}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onOpenSavedSlips={() => setIsSavedSlipsOpen(true)}
            onOpenDefaultSimulator={() => {
              setSelectedMatchForSimulator(filteredFixtures[0] || null);
              setIsSimulatorOpen(true);
            }}
            onOpenWallpaperModal={() => setIsWallpaperModalOpen(true)}
            onOpenGuideModal={handleOpenGuideModal}
            onLogoutSession={handleLogoutSession}
          />

          {/* Right Column: Minimalist Top Bar + Clean Quantitative Feed */}
          <div className="flex-1 flex flex-col min-w-0 relative z-10">
            {/* 0. Subscription Expiration Alert Banner */}
            <SubscriptionAlertBanner />

            {/* 1. Minimalist Top Bar */}
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
              onRefreshMatches={handleManualRefresh}
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
              searchQuery={activeSport === 'NBA' ? nbaSearchQuery : searchQuery}
              onSearchChange={activeSport === 'NBA' ? handleNbaSearchChange : handleSoccerSearchChange}
              currentDate={currentDate}
              onDateChange={handleSmartDateChange}
              onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
            />

            {activeSport === 'SOCCER' ? (
              <SoccerWorkspaceView
                isLoading={isLoading}
                fixtures={fixtures}
                filteredFixtures={filteredFixtures}
                displayFixtures={displayFixtures}
                availableCompetitionGroups={availableCompetitionGroups}
                groupedFilteredFixtures={groupedFilteredFixtures}
                selectedLeague={selectedLeague}
                onSelectLeague={setSelectedLeague}
                activeLeagueLabel={activeLeagueLabel}
                searchQuery={searchQuery}
                onClearFilters={() => {
                  setSearchQuery('');
                  setSelectedFilter('ALL');
                  setSelectedLeague('ALL');
                }}
                currentDate={currentDate}
                onSmartDateChange={handleSmartDateChange}
                isSearchingOtherDays={isSearchingOtherDays}
                crossDaySearchMatches={crossDaySearchMatches}
                mainTab={mainTab}
                onSelectMainTab={handleSelectMainTab}
                soccerTopPicks={soccerTopPicks}
                soccerLiveFixtures={soccerLiveFixtures}
                analysesMap={analysesMap}
                selectedFixtureIds={selectedFixtureIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectGroupFixtures={handleToggleSelectGroupFixtures}
                onSelectAll={handleSelectAll}
                expandedCardIds={expandedCardIds}
                onToggleCardExpand={handleToggleCardExpand}
                collapsedGroupKeys={collapsedGroupKeys}
                onToggleGroupCollapse={handleToggleGroupCollapse}
                onToggleAllGroupsCollapse={handleToggleAllGroupsCollapse}
                favoriteFixtureIds={favoriteFixtureIds}
                onToggleFavorite={handleToggleFavorite}
                showFavoritesOnly={showFavoritesOnly}
                onToggleShowFavoritesOnly={() => setShowFavoritesOnly((prev) => !prev)}
                visibleMatchLimit={visibleMatchLimit}
                setVisibleMatchLimit={setVisibleMatchLimit}
                viewMode={viewMode}
                densityView={densityView}
                isLightweightMode={isLightweightMode}
                recentlyUpdatedFixtureIds={recentlyUpdatedFixtureIds}
                onOpenSoccerDetail={handleOpenSoccerDetail}
                onOpenSimulator={handleOpenSimulator}
              />
            ) : (
              <NBAWorkspaceView
                isNBALoading={isNBALoading}
                nbaFixtures={nbaFixtures}
                filteredNBAFixtures={filteredNBAFixtures}
                nbaAnalysesMap={nbaAnalysesMap}
                nbaTopPicks={nbaTopPicks}
                nbaLiveFixtures={nbaLiveFixtures}
                mainTab={mainTab}
                onSelectMainTab={handleSelectMainTab}
                selectedFixtureIds={selectedFixtureIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                expandedCardIds={expandedCardIds}
                onToggleCardExpand={handleToggleCardExpand}
                favoriteFixtureIds={favoriteFixtureIds}
                onToggleFavorite={handleToggleFavorite}
                showFavoritesOnly={showFavoritesOnly}
                onToggleShowFavoritesOnly={() => setShowFavoritesOnly((prev) => !prev)}
                visibleMatchLimit={visibleMatchLimit}
                setVisibleMatchLimit={setVisibleMatchLimit}
                viewMode={viewMode}
                densityView={densityView}
                recentlyUpdatedFixtureIds={recentlyUpdatedFixtureIds}
                onOpenNBADetail={handleOpenNBADetail}
                onClearNBAFilters={() => {
                  setNbaSearchQuery('');
                  setSelectedNBAConference('ALL');
                  setSelectedNBAFilter('ALL');
                }}
              />
            )}

            {/* Two-Tier Institutional & Legal Shield Footer */}
            <AppFooter
              activeSport={activeSport}
              onOpenGuideModal={handleOpenGuideModal}
              onOpenFeedbackModal={() => setIsFeedbackModalOpen(true)}
            />
          </div>

          {/* Non-intrusive User Feedback & Rating Widget (Admin-Only Inbox) */}
          <UserFeedbackWidget
            isOpen={isFeedbackModalOpen}
            onOpen={() => setIsFeedbackModalOpen(true)}
            onClose={() => setIsFeedbackModalOpen(false)}
          />

          {/* Modal de Pagos y Activación VIP ($9.900 COP / $3.50 USD) */}
          {isVipModalOpen && (
            <React.Suspense fallback={null}>
              <VipPaymentModal
                isOpen={isVipModalOpen}
                onClose={() => setIsVipModalOpen(false)}
                userEmail={(() => {
                  try {
                    const raw = localStorage.getItem('sportstats_auth_user');
                    if (raw) {
                      const u = JSON.parse(raw);
                      return u.email || u.username;
                    }
                  } catch {}
                  return activeLicenseInfo?.clientName;
                })()}
                isExpired={Boolean(activeLicenseInfo?.isExpired)}
                daysRemaining={activeLicenseInfo?.daysRemaining}
                onCodeRedeemed={(newExpires) => {
                  const devId = getOrCreateDeviceId();
                  const diff = newExpires - Date.now();
                  const calcDays = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
                  const newToken = createLicenseToken(devId, `${calcDays}D` as any, newExpires);
                  const updatedResult: LicenseValidationResult = {
                    isValid: true,
                    status: 'ACTIVE',
                    message: 'Licencia actualizada con éxito',
                    isPermanent: false,
                    isExpired: false,
                    expiryTimestamp: newExpires,
                    expiryDateFormatted: new Date(newExpires).toLocaleDateString('es-ES'),
                    daysRemaining: calcDays,
                    targetDeviceId: devId,
                    planLabel: `Pase VIP (${calcDays} Días)`,
                    clientName: activeLicenseInfo?.clientName
                  };
                  saveActiveLicense(newToken.key, updatedResult);
                  setActiveLicenseInfo(updatedResult);
                }}
              />
            </React.Suspense>
          )}

          {/* Fixed Mobile Bottom Navigation Bar (Thumb Zone) */}
          <MobileBottomNav
            activeTab={mobileActiveTab}
            onTabChange={(tab) => {
              setMobileActiveTab(tab);
              if (tab === 'ADMIN') {
                setIsAdminModalOpen(true);
              } else if (tab === 'FILTERS') {
                setIsMobileDrawerOpen(true);
              } else if (tab === 'PROBABILITY') {
                handleSelectMainTab('TOP_PICKS');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                handleSelectMainTab('ALL_LEAGUES');
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
            onOpenDrawer={() => setIsMobileDrawerOpen(true)}
          />

          {/* Offline Connectivity Toast Indicator */}
          <OfflineIndicator />

          {/* Compact Floating In-App Live Alerts (Strictly Favorites-Only) */}
          <LiveAlertsOverlay
            liveGoalAlerts={liveGoalAlerts}
            onAlertClick={(alert) => {
              if (alert.sport === 'SOCCER') {
                const fix = fixtures.find((f) => f.id === alert.fixtureId);
                if (fix) {
                  handleOpenSoccerDetail(fix, analysesMap[fix.id] || calculateMatchAnalysis(fix));
                }
              } else {
                const fix = nbaFixtures.find((f) => f.id === alert.fixtureId);
                if (fix) {
                  handleOpenNBADetail(fix, nbaAnalysesMap[fix.id] || calculateNBAAnalysis(fix));
                }
              }
            }}
            onDismissAlert={(alertId) => setLiveGoalAlerts((prev) => prev.filter((a) => a.id !== alertId))}
          />
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
        fixtures={fixtures}
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

      {/* Animación fluida de Inicio y Cierre de Sesión */}
      {authTransition && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md transition-all duration-300">
          <div className="bg-white/95 border border-slate-200/90 rounded-3xl p-6 sm:p-7 max-w-sm w-full mx-4 text-center shadow-2xl space-y-3.5 transform transition-all duration-300">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border shadow-xs ${
              authTransition === 'LOGIN'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              {authTransition === 'LOGIN' ? (
                <Sparkles className="w-7 h-7 text-emerald-600 animate-pulse" />
              ) : (
                <Power className="w-7 h-7 text-slate-600 animate-pulse" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {authTransition === 'LOGIN' ? '¡Bienvenido a G METRICS!' : 'Cerrando sesión segura...'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {authTransition === 'LOGIN'
                  ? 'Verificando licencia y cargando telemetría deportiva en vivo...'
                  : 'Desconectando sesión y guardando preferencias locales.'}
              </p>
            </div>

            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full w-2/3 rounded-full animate-pulse ${
                authTransition === 'LOGIN' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

