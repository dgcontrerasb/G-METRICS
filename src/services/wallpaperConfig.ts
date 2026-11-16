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
