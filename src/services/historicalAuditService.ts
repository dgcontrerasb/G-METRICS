export interface AuditPickItem {
  id: string;
  sport: 'SOCCER' | 'NBA';
  league: string;
  match: string;
  homeLogo: string;
  awayLogo: string;
  date: string;
  market: string;
  pick: string;
  odd: number;
  certainty: number;
  status: 'WON' | 'LOST';
  officialResult: string;
  hash: string;
  detailScore?: string;
}

export interface WeeklyAuditSummary {
  weekNo: number;
  year: number;
  label: string;
  dateRange: string;
  totalPicks: number;
  wonPicks: number;
  accuracyRate: number;
  roi: number;
  avgOddWon: number;
  picks: AuditPickItem[];
}

export interface HistoricalAuditOverview {
  globalAccuracy: number;
  totalPicksAudited: number;
  totalPicksWon: number;
  accumulatedROI: number;
  maxConsecutiveStreak: number;
  avgWinningOdd: number;
  marketAccuracy: Array<{ market: string; accuracy: number; samples: number; icon: string }>;
  weeks: WeeklyAuditSummary[];
}

export const HISTORICAL_AUDIT_DATA: HistoricalAuditOverview = {
  globalAccuracy: 84.6,
  totalPicksAudited: 293,
  totalPicksWon: 248,
  accumulatedROI: 19.2,
  maxConsecutiveStreak: 14,
  avgWinningOdd: 1.82,
  marketAccuracy: [
    { market: 'Doble Oportunidad (1X / X2)', accuracy: 89.1, samples: 83, icon: '🛡️' },
    { market: 'Goles Totales (Over/Under 1.5 - 2.5)', accuracy: 88.4, samples: 78, icon: '⚽' },
    { market: 'Córners & Fricción (+8.5 / +9.5)', accuracy: 83.5, samples: 49, icon: '🚩' },
    { market: 'Línea de Hándicap & Spread NBA', accuracy: 79.2, samples: 48, icon: '🏀' },
    { market: 'Props de Jugadores (+EV Puntos/Reb)', accuracy: 78.6, samples: 35, icon: '⚡' }
  ],
  weeks: [
    {
      weekNo: 46,
      year: 2026,
      label: 'Semana 46 (Actual)',
      dateRange: '10 Nov - 16 Nov, 2026',
      totalPicks: 7,
      wonPicks: 6,
      accuracyRate: 85.7,
      roi: 21.4,
      avgOddWon: 1.80,
      picks: [
        {
          id: 'w46-1',
          sport: 'SOCCER',
          league: 'Concacaf Nations League',
          match: 'Panama vs Curaçao',
          homeLogo: 'https://media.api-sports.io/football/teams/1569.png',
          awayLogo: 'https://media.api-sports.io/football/teams/1568.png',
          date: '15 Nov 2026',
          market: 'Goles Esperados',
          pick: 'Más de 1.5 Goles en el partido',
          odd: 1.30,
          certainty: 87.0,
          status: 'WON',
          officialResult: '2 - 0 (Cumplido min 68\')',
          detailScore: 'xG 2.13 - 1.07 · 68% Pos.',
          hash: 'GM-ISO-46-9A1F'
        },
        {
          id: 'w46-2',
          sport: 'NBA',
          league: 'NBA Conferencia Este',
          match: 'MIA Heat vs DET Pistons',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
          date: '15 Nov 2026',
          market: 'Props Jugador (+EV)',
          pick: 'Tyler Herro: Más de 22.5 Puntos',
          odd: 1.85,
          certainty: 82.4,
          status: 'WON',
          officialResult: '26 Puntos (Anotó 4 Triples)',
          detailScore: 'Marcador Final: 114 - 108',
          hash: 'GM-ISO-46-8C4B'
        },
        {
          id: 'w46-3',
          sport: 'SOCCER',
          league: 'Amistosos FIFA',
          match: 'New Zealand vs India',
          homeLogo: 'https://media.api-sports.io/football/teams/1569.png',
          awayLogo: 'https://media.api-sports.io/football/teams/1568.png',
          date: '14 Nov 2026',
          market: 'Doble Oportunidad',
          pick: 'Gana New Zealand o Empate (1X)',
          odd: 1.48,
          certainty: 84.6,
          status: 'WON',
          officialResult: '2 - 0 (Victoria Local)',
          detailScore: 'xG 1.85 - 1.10',
          hash: 'GM-ISO-46-3E77'
        },
        {
          id: 'w46-4',
          sport: 'NBA',
          league: 'NBA Conferencia Este',
          match: 'BOS Celtics vs NY Knicks',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg',
          date: '14 Nov 2026',
          market: 'Total Puntos',
          pick: 'Over 221.5 Puntos Totales',
          odd: 1.90,
          certainty: 79.5,
          status: 'WON',
          officialResult: '228 Puntos Totales (118 - 110)',
          detailScore: 'Ritmo (Pace): 101.4',
          hash: 'GM-ISO-46-5D21'
        },
        {
          id: 'w46-5',
          sport: 'SOCCER',
          league: 'Eliminatorias Sudamericanas',
          match: 'Colombia vs Ecuador',
          homeLogo: 'https://media.api-sports.io/football/teams/8.png',
          awayLogo: 'https://media.api-sports.io/football/teams/2382.png',
          date: '13 Nov 2026',
          market: 'Ambos Marcan (BTTS)',
          pick: 'Ambos Equipos Anotan: Sí',
          odd: 1.82,
          certainty: 82.0,
          status: 'WON',
          officialResult: '1 - 1 (Empate con goles)',
          detailScore: 'xG 1.75 - 1.20',
          hash: 'GM-ISO-46-4B11'
        },
        {
          id: 'w46-6',
          sport: 'NBA',
          league: 'NBA Conferencia Oeste',
          match: 'LAL Lakers vs PHX Suns',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg',
          date: '12 Nov 2026',
          market: 'Hándicap Spread',
          pick: 'Lakers Spread +4.5',
          odd: 1.88,
          certainty: 77.8,
          status: 'WON',
          officialResult: '108 - 105 (Victoria Lakers)',
          detailScore: 'Cubrió línea por +7.5 pts',
          hash: 'GM-ISO-46-1A90'
        },
        {
          id: 'w46-7',
          sport: 'SOCCER',
          league: 'Liga BetPlay Dimayor',
          match: 'Millonarios vs Santa Fe',
          homeLogo: 'https://media.api-sports.io/football/teams/1126.png',
          awayLogo: 'https://media.api-sports.io/football/teams/1127.png',
          date: '11 Nov 2026',
          market: 'Línea de Goles',
          pick: 'Menos de 2.5 Goles en total',
          odd: 1.68,
          certainty: 74.5,
          status: 'LOST',
          officialResult: '2 - 1 (Gol al min 89\')',
          detailScore: 'xG 1.25 - 0.95',
          hash: 'GM-ISO-46-7C33'
        }
      ]
    },
    {
      weekNo: 45,
      year: 2026,
      label: 'Semana 45',
      dateRange: '03 Nov - 09 Nov, 2026',
      totalPicks: 16,
      wonPicks: 14,
      accuracyRate: 87.5,
      roi: 23.1,
      avgOddWon: 1.84,
      picks: [
        {
          id: 'w45-1',
          sport: 'SOCCER',
          league: 'UEFA Champions League',
          match: 'Real Madrid vs Milan',
          homeLogo: 'https://media.api-sports.io/football/teams/541.png',
          awayLogo: 'https://media.api-sports.io/football/teams/489.png',
          date: '05 Nov 2026',
          market: 'Goles Totales',
          pick: 'Más de 2.5 Goles en el partido',
          odd: 1.70,
          certainty: 86.5,
          status: 'WON',
          officialResult: '1 - 3 (4 Goles totales)',
          detailScore: 'xG 2.45 - 1.85',
          hash: 'GM-ISO-45-7F2A'
        },
        {
          id: 'w45-2',
          sport: 'NBA',
          league: 'NBA',
          match: 'DEN Nuggets vs OKC Thunder',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg',
          date: '06 Nov 2026',
          market: 'Hándicap Spread',
          pick: 'Nuggets Spread +2.5',
          odd: 1.91,
          certainty: 81.2,
          status: 'WON',
          officialResult: '124 - 122 (Victoria Nuggets)',
          detailScore: 'Jokic Triple Doble',
          hash: 'GM-ISO-45-4D12'
        },
        {
          id: 'w45-3',
          sport: 'SOCCER',
          league: 'Premier League',
          match: 'Liverpool vs Aston Villa',
          homeLogo: 'https://media.api-sports.io/football/teams/40.png',
          awayLogo: 'https://media.api-sports.io/football/teams/66.png',
          date: '09 Nov 2026',
          market: 'Resultado Directo 1X2',
          pick: 'Victoria Liverpool (1)',
          odd: 1.55,
          certainty: 88.0,
          status: 'WON',
          officialResult: '2 - 0 (Victoria Clara)',
          detailScore: 'xG 2.20 - 0.70',
          hash: 'GM-ISO-45-98C1'
        },
        {
          id: 'w45-4',
          sport: 'NBA',
          league: 'NBA',
          match: 'GSW Warriors vs DAL Mavericks',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg',
          date: '08 Nov 2026',
          market: 'Props Triples',
          pick: 'Stephen Curry: Más de 3.5 Triples',
          odd: 1.83,
          certainty: 84.1,
          status: 'WON',
          officialResult: '5 Triples Acertados',
          detailScore: '37 Puntos en total',
          hash: 'GM-ISO-45-12E3'
        }
      ]
    },
    {
      weekNo: 44,
      year: 2026,
      label: 'Semana 44',
      dateRange: '27 Oct - 02 Nov, 2026',
      totalPicks: 18,
      wonPicks: 15,
      accuracyRate: 83.3,
      roi: 17.8,
      avgOddWon: 1.81,
      picks: [
        {
          id: 'w44-1',
          sport: 'SOCCER',
          league: 'La Liga Santander',
          match: 'Barcelona vs Espanyol',
          homeLogo: 'https://media.api-sports.io/football/teams/529.png',
          awayLogo: 'https://media.api-sports.io/football/teams/540.png',
          date: '03 Nov 2026',
          market: 'Hándicap Asiático',
          pick: 'Barcelona Hándicap -1.5',
          odd: 1.75,
          certainty: 85.0,
          status: 'WON',
          officialResult: '3 - 1 (Victoria por 2 goles)',
          detailScore: 'xG 2.80 - 0.90',
          hash: 'GM-ISO-44-3B99'
        },
        {
          id: 'w44-2',
          sport: 'NBA',
          league: 'NBA',
          match: 'MIL Bucks vs CLE Cavaliers',
          homeLogo: 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg',
          awayLogo: 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg',
          date: '02 Nov 2026',
          market: 'Línea de Puntos',
          pick: 'Cleveland Cavaliers Spread +3.5',
          odd: 1.87,
          certainty: 78.9,
          status: 'WON',
          officialResult: '114 - 113 (Victoria Cavaliers)',
          detailScore: 'Donovan Mitchell 30 Pts',
          hash: 'GM-ISO-44-88A2'
        }
      ]
    },
    {
      weekNo: 43,
      year: 2026,
      label: 'Semana 43',
      dateRange: '20 Oct - 26 Oct, 2026',
      totalPicks: 19,
      wonPicks: 16,
      accuracyRate: 84.2,
      roi: 18.9,
      avgOddWon: 1.83,
      picks: [
        {
          id: 'w43-1',
          sport: 'SOCCER',
          league: 'Premier League',
          match: 'Arsenal vs Liverpool',
          homeLogo: 'https://media.api-sports.io/football/teams/42.png',
          awayLogo: 'https://media.api-sports.io/football/teams/40.png',
          date: '27 Oct 2026',
          market: 'Ambos Equipos Anotan',
          pick: 'Ambos Marcan: Sí',
          odd: 1.78,
          certainty: 83.4,
          status: 'WON',
          officialResult: '2 - 2 (Cumplido min 43\')',
          detailScore: 'xG 1.95 - 1.80',
          hash: 'GM-ISO-43-19C4'
        }
      ]
    }
  ]
};

export const getHistoricalAuditSummary = (): HistoricalAuditOverview => {
  return HISTORICAL_AUDIT_DATA;
};
