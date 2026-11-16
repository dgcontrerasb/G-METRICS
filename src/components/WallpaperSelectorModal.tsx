import React, { useRef, useState, useMemo } from 'react';
import { X, Check, Image as ImageIcon, Upload, Sparkles, Search, Link2, ShieldOff } from 'lucide-react';

export interface WallpaperOption {
  id: string;
  sport: 'SOCCER' | 'NBA' | 'MINIMAL';
  league: string;
  name: string;
  subtitle: string;
  url: string;
  crestUrl?: string;
  accentColor?: string;
}

// Fotografías HD de Estadios de Fútbol y Arenas NBA desde CDN Global (0 KB en repositorio local)
const SOCCER_STADIUM_NIGHT =
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80';
const SOCCER_PITCH_SPOTLIGHT =
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80';
const SOCCER_CHAMPIONS_ARENA =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80';
const SOCCER_CROWD_ATMOSPHERE =
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1600&q=80';
const SOCCER_GOAL_NET_LIGHTS =
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1600&q=80';

const NBA_ARENA_SPOTLIGHT =
  'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1600&q=80';
const NBA_HARDWOOD_COURT =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80';
const NBA_HOOP_DRAMATIC =
  'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&q=80';
const NBA_ARENA_PACKED =
  'https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?auto=format&fit=crop&w=1600&q=80';

export const WALLPAPER_LIST: WallpaperOption[] = [
  // ==================== ⚽ FÚTBOL: CLUBES TOP EUROPA, AMÉRICA & SELECCIONES ====================
  {
    id: 'soccer-real-madrid',
    sport: 'SOCCER',
    league: 'LaLiga · España',
    name: 'Real Madrid CF',
    subtitle: 'Santiago Bernabéu · Mística Merengue',
    url: `${SOCCER_STADIUM_NIGHT}#team=real-madrid`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    accentColor: '#d9b114'
  },
  {
    id: 'soccer-barcelona',
    sport: 'SOCCER',
    league: 'LaLiga · España',
    name: 'FC Barcelona',
    subtitle: 'Spotify Camp Nou · Orgullo Blaugrana',
    url: `${SOCCER_PITCH_SPOTLIGHT}#team=barcelona`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    accentColor: '#a50044'
  },
  {
    id: 'soccer-atletico',
    sport: 'SOCCER',
    league: 'LaLiga · España',
    name: 'Atlético de Madrid',
    subtitle: 'Riyadh Air Metropolitano · Coraje y Corazón',
    url: `${SOCCER_CROWD_ATMOSPHERE}#team=atletico`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
    accentColor: '#cb3524'
  },
  {
    id: 'soccer-man-city',
    sport: 'SOCCER',
    league: 'Premier League · Inglaterra',
    name: 'Manchester City',
    subtitle: 'Etihad Stadium · Sky Blue Precision',
    url: `${SOCCER_CHAMPIONS_ARENA}#team=man-city`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
    accentColor: '#6cabdd'
  },
  {
    id: 'soccer-liverpool',
    sport: 'SOCCER',
    league: 'Premier League · Inglaterra',
    name: 'Liverpool FC',
    subtitle: "Anfield Night · You'll Never Walk Alone",
    url: `${SOCCER_CROWD_ATMOSPHERE}#team=liverpool`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    accentColor: '#c8102e'
  },
  {
    id: 'soccer-arsenal',
    sport: 'SOCCER',
    league: 'Premier League · Inglaterra',
    name: 'Arsenal FC',
    subtitle: 'Emirates Stadium · North London Gunners',
    url: `${SOCCER_STADIUM_NIGHT}#team=arsenal`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
    accentColor: '#ef0107'
  },
  {
    id: 'soccer-chelsea',
    sport: 'SOCCER',
    league: 'Premier League · Inglaterra',
    name: 'Chelsea FC',
    subtitle: 'Stamford Bridge · Pride of London',
    url: `${SOCCER_GOAL_NET_LIGHTS}#team=chelsea`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png',
    accentColor: '#034694'
  },
  {
    id: 'soccer-man-utd',
    sport: 'SOCCER',
    league: 'Premier League · Inglaterra',
    name: 'Manchester United',
    subtitle: 'Old Trafford · Teatro de los Sueños',
    url: `${SOCCER_PITCH_SPOTLIGHT}#team=man-utd`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png',
    accentColor: '#da291c'
  },
  {
    id: 'soccer-bayern',
    sport: 'SOCCER',
    league: 'Bundesliga · Alemania',
    name: 'FC Bayern München',
    subtitle: 'Allianz Arena · Mia San Mia',
    url: `${SOCCER_CHAMPIONS_ARENA}#team=bayern`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png',
    accentColor: '#dc052d'
  },
  {
    id: 'soccer-dortmund',
    sport: 'SOCCER',
    league: 'Bundesliga · Alemania',
    name: 'Borussia Dortmund',
    subtitle: 'Signal Iduna Park · El Muro Amarillo',
    url: `${SOCCER_CROWD_ATMOSPHERE}#team=dortmund`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/124.png',
    accentColor: '#fde100'
  },
  {
    id: 'soccer-leverkusen',
    sport: 'SOCCER',
    league: 'Bundesliga · Alemania',
    name: 'Bayer 04 Leverkusen',
    subtitle: 'BayArena · Die Werkself Invencible',
    url: `${SOCCER_GOAL_NET_LIGHTS}#team=leverkusen`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/131.png',
    accentColor: '#e32221'
  },
  {
    id: 'soccer-inter',
    sport: 'SOCCER',
    league: 'Serie A · Italia',
    name: 'Inter de Milán',
    subtitle: 'Giuseppe Meazza · Noche Nerazzurra',
    url: `${SOCCER_STADIUM_NIGHT}#team=inter`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png',
    accentColor: '#010e80'
  },
  {
    id: 'soccer-ac-milan',
    sport: 'SOCCER',
    league: 'Serie A · Italia',
    name: 'AC Milan',
    subtitle: 'San Siro · Estirpe Rossonera Europea',
    url: `${SOCCER_PITCH_SPOTLIGHT}#team=ac-milan`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/103.png',
    accentColor: '#fb090b'
  },
  {
    id: 'soccer-juventus',
    sport: 'SOCCER',
    league: 'Serie A · Italia',
    name: 'Juventus FC',
    subtitle: 'Allianz Stadium · Fino Alla Fine',
    url: `${SOCCER_CHAMPIONS_ARENA}#team=juventus`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/111.png',
    accentColor: '#ffffff'
  },
  {
    id: 'soccer-psg',
    sport: 'SOCCER',
    league: 'Ligue 1 · Francia',
    name: 'Paris Saint-Germain',
    subtitle: 'Parc des Princes · Ici C’est Paris',
    url: `${SOCCER_GOAL_NET_LIGHTS}#team=psg`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png',
    accentColor: '#004170'
  },
  {
    id: 'soccer-colombia',
    sport: 'SOCCER',
    league: 'Selecciones CONMEBOL',
    name: 'Selección Colombia',
    subtitle: 'Metropolitano · La Tricolor Cafetera',
    url: `${SOCCER_CROWD_ATMOSPHERE}#team=colombia`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/countries/500/col.png',
    accentColor: '#fcd116'
  },
  {
    id: 'soccer-argentina',
    sport: 'SOCCER',
    league: 'Selecciones CONMEBOL',
    name: 'Selección Argentina',
    subtitle: 'Monumental · Campeones del Mundo ⭐⭐⭐',
    url: `${SOCCER_STADIUM_NIGHT}#team=argentina`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/countries/500/arg.png',
    accentColor: '#43a1d5'
  },
  {
    id: 'soccer-brasil',
    sport: 'SOCCER',
    league: 'Selecciones CONMEBOL',
    name: 'Selección Brasil',
    subtitle: 'Maracanã · Joga Bonito Pentacampeón',
    url: `${SOCCER_PITCH_SPOTLIGHT}#team=brasil`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/countries/500/bra.png',
    accentColor: '#ffdf00'
  },
  {
    id: 'soccer-nacional',
    sport: 'SOCCER',
    league: 'Liga BetPlay · Colombia',
    name: 'Atlético Nacional',
    subtitle: 'Atanasio Girardot · Rey de Copas Verdolaga',
    url: `${SOCCER_CHAMPIONS_ARENA}#team=nacional`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/5264.png',
    accentColor: '#009b3a'
  },
  {
    id: 'soccer-millonarios',
    sport: 'SOCCER',
    league: 'Liga BetPlay · Colombia',
    name: 'Millonarios FC',
    subtitle: 'El Campín · Ballet Azul Embajador',
    url: `${SOCCER_STADIUM_NIGHT}#team=millonarios`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/5265.png',
    accentColor: '#00529f'
  },
  {
    id: 'soccer-america-cali',
    sport: 'SOCCER',
    league: 'Liga BetPlay · Colombia',
    name: 'América de Cali',
    subtitle: 'Pascual Guerrero · Pasión Escarlata',
    url: `${SOCCER_CROWD_ATMOSPHERE}#team=america-cali`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/5272.png',
    accentColor: '#e30613'
  },
  {
    id: 'soccer-champions-arena',
    sport: 'SOCCER',
    league: 'Élite Europea',
    name: 'Noche de Champions',
    subtitle: 'Estadio Europeo Iluminado 4K (Sin Escudo)',
    url: SOCCER_STADIUM_NIGHT,
    accentColor: '#00ff66'
  },

  // ==================== 🏀 NBA: FRANQUICIAS TOP & ARENAS OFICIALES ====================
  {
    id: 'nba-lakers',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Los Angeles Lakers',
    subtitle: 'Crypto.com Arena · Showtime Purple & Gold',
    url: `${NBA_ARENA_SPOTLIGHT}#team=lakers`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    accentColor: '#fdb927'
  },
  {
    id: 'nba-warriors',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Golden State Warriors',
    subtitle: 'Chase Center · Gold Blooded & Splash Trio',
    url: `${NBA_ARENA_PACKED}#team=warriors`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    accentColor: '#1d428a'
  },
  {
    id: 'nba-celtics',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'Boston Celtics',
    subtitle: 'TD Garden · 18x World Champions Legacy',
    url: `${NBA_HARDWOOD_COURT}#team=celtics`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    accentColor: '#007a33'
  },
  {
    id: 'nba-bulls',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'Chicago Bulls',
    subtitle: 'United Center · Dinastía Legendaria #23',
    url: `${NBA_HOOP_DRAMATIC}#team=bulls`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    accentColor: '#ce1141'
  },
  {
    id: 'nba-heat',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'Miami Heat',
    subtitle: 'Kaseya Center · Heat Culture & Vice Nights',
    url: `${NBA_ARENA_SPOTLIGHT}#team=heat`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    accentColor: '#98002e'
  },
  {
    id: 'nba-knicks',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'New York Knicks',
    subtitle: 'Madison Square Garden · La Meca del Básquet',
    url: `${NBA_ARENA_PACKED}#team=knicks`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    accentColor: '#f58426'
  },
  {
    id: 'nba-mavericks',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Dallas Mavericks',
    subtitle: 'American Airlines Center · MFFL Texas Pride',
    url: `${NBA_HARDWOOD_COURT}#team=mavericks`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    accentColor: '#00538c'
  },
  {
    id: 'nba-nuggets',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Denver Nuggets',
    subtitle: 'Ball Arena · Mile High Basketball',
    url: `${NBA_ARENA_SPOTLIGHT}#team=nuggets`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    accentColor: '#fec524'
  },
  {
    id: 'nba-bucks',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'Milwaukee Bucks',
    subtitle: 'Fiserv Forum · Fear The Deer',
    url: `${NBA_HOOP_DRAMATIC}#team=bucks`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    accentColor: '#00471b'
  },
  {
    id: 'nba-suns',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Phoenix Suns',
    subtitle: 'Footprint Center · The Valley Sunset',
    url: `${NBA_ARENA_PACKED}#team=suns`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    accentColor: '#e56020'
  },
  {
    id: 'nba-spurs',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'San Antonio Spurs',
    subtitle: 'Frost Bank Center · Silver & Black Era',
    url: `${NBA_ARENA_SPOTLIGHT}#team=spurs`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    accentColor: '#c4ced4'
  },
  {
    id: 'nba-sixers',
    sport: 'NBA',
    league: 'NBA · Conferencia Este',
    name: 'Philadelphia 76ers',
    subtitle: 'Wells Fargo Center · City of Brotherly Love',
    url: `${NBA_HARDWOOD_COURT}#team=sixers`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    accentColor: '#006bb6'
  },
  {
    id: 'nba-thunder',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Oklahoma City Thunder',
    subtitle: 'Paycom Center · Loud City Thunder',
    url: `${NBA_HOOP_DRAMATIC}#team=thunder`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    accentColor: '#007ac1'
  },
  {
    id: 'nba-wolves',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'Minnesota Timberwolves',
    subtitle: 'Target Center · The North Pack',
    url: `${NBA_ARENA_PACKED}#team=wolves`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    accentColor: '#236192'
  },
  {
    id: 'nba-clippers',
    sport: 'NBA',
    league: 'NBA · Conferencia Oeste',
    name: 'LA Clippers',
    subtitle: 'Intuit Dome · The Wall of LA',
    url: `${NBA_ARENA_SPOTLIGHT}#team=clippers`,
    crestUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    accentColor: '#c8102e'
  },
  {
    id: 'nba-court-neutral',
    sport: 'NBA',
    league: 'Arena Oficial NBA',
    name: 'NBA Hardwood Spotlight',
    subtitle: 'Parqué Profesional en Penumbra (Sin Escudo)',
    url: NBA_ARENA_SPOTLIGHT,
    accentColor: '#f59e0b'
  },

  // ==================== 🌌 MODO PURO OBSIDIAN (0 KB) ====================
  {
    id: 'minimal-obsidian',
    sport: 'MINIMAL',
    league: 'Rendimiento Extremo · 0 KB',
    name: 'Puro Obsidian (#0b0e14)',
    subtitle: 'Sin imagen de fondo · Máximo contraste y ahorro de batería',
    url: 'none',
    accentColor: '#00ff66'
  }
];

export function findWallpaperOptionByUrl(url: string): WallpaperOption | undefined {
  return WALLPAPER_LIST.find((w) => w.url === url);
}

interface WallpaperSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaperUrl: string;
  onSelectWallpaper: (url: string) => void;
  opacity?: number;
  onChangeOpacity?: (opacity: number) => void;
  blur?: number;
  onChangeBlur?: (blur: number) => void;
}

export const WallpaperSelectorModal: React.FC<WallpaperSelectorModalProps> = ({
  isOpen,
  onClose,
  currentWallpaperUrl,
  onSelectWallpaper,
  opacity = 0.65,
  onChangeOpacity,
  blur = 0,
  onChangeBlur
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SOCCER' | 'NBA' | 'CUSTOM'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [customLinkInput, setCustomLinkInput] = useState('');

  const filteredWallpapers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return WALLPAPER_LIST.filter((w) => {
      if (activeCategory === 'SOCCER' && w.sport !== 'SOCCER') return false;
      if (activeCategory === 'NBA' && w.sport !== 'NBA') return false;
      if (activeCategory === 'CUSTOM' && w.sport !== 'MINIMAL') return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.league.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchTerm]);

  if (!isOpen) return null;

  // Compresión ligera en Canvas (WebP 1600px) para evitar llenar localStorage al subir fotos locales
  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/webp', 0.78);
            onSelectWallpaper(compressed);
            return;
          }
        } catch {
          // fallback
        }
        onSelectWallpaper(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customLinkInput.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return;
    onSelectWallpaper(clean);
    setCustomLinkInput('');
  };

  const isPredefined = WALLPAPER_LIST.some((w) => w.url === currentWallpaperUrl);
  const soccerCount = WALLPAPER_LIST.filter((w) => w.sport === 'SOCCER').length;
  const nbaCount = WALLPAPER_LIST.filter((w) => w.sport === 'NBA').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-[#161b22] border border-[#30363d] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#30363d] flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-[#d9b114]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                <span>Galería Cloud de Clubes, Selecciones y Arenas</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00ff66] font-bold border border-emerald-500/30">
                  {WALLPAPER_LIST.length} Fondos HD · 0 KB Locales
                </span>
              </h2>
              <p className="text-xs text-[#8b949e]">
                Elige tu equipo favorito de Fútbol o franquicia NBA; solo el fondo activo se guarda en caché
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8b949e] hover:text-white hover:bg-[#161b22] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles de Opacidad y Desenfoque */}
        {onChangeOpacity && (
          <div className="px-5 py-2.5 bg-[#0b0e14] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <span className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#d9b114]" />
                Opacidad: <span className="font-mono tabular-nums text-white">{Math.round(opacity * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-[#d9b114]"
              />
            </div>

            {onChangeBlur && (
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <span className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider shrink-0">
                  Difuminado: <span className="font-mono tabular-nums text-white">{blur}px</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={blur}
                  onChange={(e) => onChangeBlur(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-[#d9b114]"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.35);
                  if (onChangeBlur) onChangeBlur(0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
              >
                Alto Contraste
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.65);
                  if (onChangeBlur) onChangeBlur(0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#d9b114] border border-[#d9b114]/50 cursor-pointer"
              >
                Clásico
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeOpacity(0.85);
                  if (onChangeBlur) onChangeBlur(4);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[10px] font-semibold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer"
              >
                Suave
              </button>
            </div>
          </div>
        )}

        {/* Pestañas de Categoría + Buscador Rápido de Equipos */}
        <div className="px-5 py-2.5 bg-[#161b22] border-b border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'ALL'
                  ? 'bg-[#d9b114] text-slate-950 border-[#d9b114]'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              Todos ({WALLPAPER_LIST.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('SOCCER')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'SOCCER'
                  ? 'bg-emerald-500/20 text-[#00ff66] border-emerald-400'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>⚽ Clubes & Selecciones ({soccerCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('NBA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'NBA'
                  ? 'bg-amber-500/20 text-[#d9b114] border-amber-400'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>🏀 Franquicias NBA ({nbaCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                activeCategory === 'CUSTOM'
                  ? 'bg-[#0b0e14] text-white border-white/50'
                  : 'bg-[#0b0e14] text-[#8b949e] border-[#30363d] hover:text-white'
              }`}
            >
              <span>🔗 Link / Propio</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8b949e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar club o franquicia (ej: Liverpool, Lakers, Colombia)..."
              className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-[#d9b114]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Barra para pegar Link Directo de Internet */}
        <form
          onSubmit={handleApplyCustomLink}
          className="px-5 py-2 bg-[#0b0e14]/90 border-b border-[#30363d] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Link2 className="w-4 h-4 text-[#d9b114] shrink-0" />
            <input
              type="url"
              value={customLinkInput}
              onChange={(e) => setCustomLinkInput(e.target.value)}
              placeholder="O pega aquí el link directo (https://...) de cualquier wallpaper de Fútbol o NBA..."
              className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#8b949e] focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={!customLinkInput.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-[#00ff66] text-xs font-bold transition disabled:opacity-40 cursor-pointer"
            >
              Aplicar Link HD
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#d9b114]" />
              <span>Subir Archivo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </form>

        {/* Grid de Equipos y Arenas */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#0b0e14]/70 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredWallpapers.map((wallpaper) => {
              const isSelected = currentWallpaperUrl === wallpaper.url;
              const isMinimal = wallpaper.url === 'none';

              return (
                <div
                  key={wallpaper.id}
                  onClick={() => onSelectWallpaper(wallpaper.url)}
                  className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between h-48 sm:h-52 p-3 ${
                    isSelected
                      ? 'border-[#d9b114] ring-2 ring-[#d9b114]/35 shadow-lg scale-[1.01]'
                      : 'border-[#30363d] hover:border-[#d9b114]/60 bg-[#0b0e14]'
                  }`}
                >
                  {/* Imagen de estadio / arena en segundo plano */}
                  {!isMinimal && wallpaper.url ? (
                    <img
                      src={wallpaper.url}
                      alt={wallpaper.name}
                      className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 opacity-65"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#0b0e14] flex items-center justify-center">
                      <ShieldOff className="w-12 h-12 text-[#30363d]" />
                    </div>
                  )}

                  {/* Resplandor cromático del equipo */}
                  {wallpaper.accentColor && (
                    <div
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 50% 35%, ${wallpaper.accentColor}, transparent 72%)`
                      }}
                    />
                  )}

                  {/* Gradiente oscuro de lectura */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/55 to-black/30 pointer-events-none" />

                  {/* Fila superior: Liga + Badge Activo */}
                  <div className="relative z-10 flex items-center justify-between gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#0b0e14]/85 border border-[#30363d] text-[9.5px] font-mono font-bold text-slate-300 truncate">
                      {wallpaper.sport === 'NBA' ? '🏀' : wallpaper.sport === 'SOCCER' ? '⚽' : '🌌'} {wallpaper.league}
                    </span>
                    {isSelected && (
                      <div className="px-2 py-0.5 rounded-full bg-[#d9b114] text-slate-950 text-[9.5px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-md shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Activo</span>
                      </div>
                    )}
                  </div>

                  {/* Escudo Oficial HD en el centro de la tarjeta */}
                  {wallpaper.crestUrl && (
                    <div className="relative z-10 flex items-center justify-center my-auto">
                      <img
                        src={wallpaper.crestUrl}
                        alt={wallpaper.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Info inferior del equipo */}
                  <div className="relative z-10">
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                      {wallpaper.name}
                    </h3>
                    <p className="text-[10.5px] text-[#8b949e] font-medium truncate mt-0.5">
                      {wallpaper.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#30363d] bg-[#0b0e14] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#8b949e] text-[11px]">
            {!isPredefined && currentWallpaperUrl && currentWallpaperUrl !== 'none'
              ? '✓ Fondo personalizado por Link / Archivo activo en este dispositivo.'
              : 'El estadio y escudo del equipo elegido se reflejarán en el fondo de tu PWA.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-white border border-[#30363d] hover:border-[#d9b114]/50 font-bold transition-all shadow-2xs cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
