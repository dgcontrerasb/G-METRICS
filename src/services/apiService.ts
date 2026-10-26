import { MatchFixture, CacheMetadata, H2HSummary, RealMatchStats, TimelineEventItem, RealMatchRosters } from '../types';
import { resolveTeamStarPlayerName, isContaminatedForeignStar } from './lineupService';
import { isExcludedYouthOrAmateurLeague } from './leagueCategorizer';

export const API_KEY_STORAGE_KEY = 'futbolstats_apikey';
export const CACHE_PREFIX = 'futbolstats_fixtures_v9_';
export const CACHE_META_PREFIX = 'futbolstats_cache_meta_v9_';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // ignore local storage errors in private mode
  }
}

// Generate rich, realistic elite fixtures for any given date
function generateHighCaliberFixtures(dateStr: string): MatchFixture[] {
  // Use dateStr as seed so fixtures for the same date are consistent
  const dateHash = dateStr.split('-').reduce((acc, part) => acc + parseInt(part || '0', 10), 0);

  const fixtureBlueprints: Omit<MatchFixture, 'id' | 'date'>[] = [
    // 0. Copa Colombia BetPlay: Independiente Santa Fe vs Llaneros FC
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.35,
        avgCardsPerMatch: 5.1
      },
      homeTeam: {
        id: 1133,
        name: 'Independiente Santa Fe',
        shortName: 'Santa Fe',
        logo: 'https://media.api-sports.io/football/teams/1133.png',
        rank: 3,
        points: 52,
        form: ['W', 'D', 'W', 'W', 'D'],
        attackStrength: 1.35,
        defenseStrength: 0.85,
        avgShotsPerMatch: 13.8,
        avgShotsOnTarget: 5.4,
        restHours: 96,
        starPlayer: {
          name: 'Hugo Rodallega',
          position: 'Delantero',
          goalsSeason: 14,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 1139,
        name: 'Llaneros FC',
        shortName: 'Llaneros',
        logo: 'https://media.api-sports.io/football/teams/1139.png',
        rank: 12,
        points: 36,
        form: ['D', 'W', 'L', 'D', 'W'],
        attackStrength: 1.05,
        defenseStrength: 1.15,
        avgShotsPerMatch: 10.2,
        avgShotsOnTarget: 3.8,
        restHours: 72,
        starPlayer: {
          name: 'Néider Ospina',
          position: 'Extremo',
          goalsSeason: 7,
          expectedShots: 2.4,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.22
        }
      },
      referee: {
        name: 'Wilmar Roldán',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.6,
        avgRedCards: 0.22,
        foulsPerCard: 5.4
      },
      venue: {
        name: 'Estadio Nemesio Camacho El Campín',
        city: 'Bogotá',
        capacity: 36343
      },
      travel: {
        awayDistanceKm: 120,
        awayFlightHours: 0.5
      },
      derbyOrRivalry: false
    },

    // 0.1 Copa Colombia BetPlay: Atlético Nacional vs Cúcuta Deportivo
    {
      time: '20:30',
      status: 'SCHEDULED',
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.42,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 1131,
        name: 'Atlético Nacional',
        shortName: 'Atl. Nacional',
        logo: 'https://media.api-sports.io/football/teams/1131.png',
        rank: 2,
        points: 58,
        form: ['W', 'W', 'D', 'W', 'L'],
        attackStrength: 1.45,
        defenseStrength: 0.79,
        avgShotsPerMatch: 15.2,
        avgShotsOnTarget: 6.2,
        restHours: 96,
        starPlayer: {
          name: 'Alfredo Morelos',
          position: 'Delantero',
          goalsSeason: 12,
          expectedShots: 3.8,
          expectedShotsOnTarget: 2.0,
          goalConversionRate: 0.30
        }
      },
      awayTeam: {
        id: 1137,
        name: 'Cúcuta Deportivo',
        shortName: 'Cúcuta',
        logo: 'https://media.api-sports.io/football/teams/1137.png',
        rank: 14,
        points: 32,
        form: ['L', 'D', 'W', 'L', 'D'],
        attackStrength: 0.95,
        defenseStrength: 1.25,
        avgShotsPerMatch: 9.8,
        avgShotsOnTarget: 3.5,
        restHours: 72,
        starPlayer: {
          name: 'Jaime Peralta',
          position: 'Delantero',
          goalsSeason: 6,
          expectedShots: 2.2,
          expectedShotsOnTarget: 1.0,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'Carlos Betancur',
        nationality: 'Colombia',
        rigor: 'Severo',
        avgYellowCards: 5.2,
        avgRedCards: 0.28,
        foulsPerCard: 4.8
      },
      venue: {
        name: 'Estadio Atanasio Girardot',
        city: 'Medellín',
        capacity: 44863
      },
      travel: {
        awayDistanceKm: 580,
        awayFlightHours: 1.1
      },
      derbyOrRivalry: true
    },

    // 0.2 Copa Colombia BetPlay: Alianza FC vs Deportivo Pasto (En Vivo / 2H)
    {
      time: '16:10',
      status: 'IN_PLAY',
      currentScore: {
        home: 1,
        away: 1,
        minute: 82
      },
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.30,
        avgCardsPerMatch: 4.9
      },
      homeTeam: {
        id: 1138,
        name: 'Alianza FC',
        shortName: 'Alianza',
        logo: 'https://media.api-sports.io/football/teams/1138.png',
        rank: 8,
        points: 40,
        form: ['D', 'L', 'W', 'D', 'W'],
        attackStrength: 1.15,
        defenseStrength: 1.05,
        avgShotsPerMatch: 11.5,
        avgShotsOnTarget: 4.2,
        restHours: 72,
        starPlayer: {
          name: 'Mayer Gil',
          position: 'Extremo',
          goalsSeason: 6,
          expectedShots: 2.6,
          expectedShotsOnTarget: 1.2,
          goalConversionRate: 0.24
        }
      },
      awayTeam: {
        id: 1135,
        name: 'Deportivo Pasto',
        shortName: 'Pasto',
        logo: 'https://media.api-sports.io/football/teams/1135.png',
        rank: 7,
        points: 42,
        form: ['W', 'D', 'L', 'W', 'D'],
        attackStrength: 1.18,
        defenseStrength: 1.02,
        avgShotsPerMatch: 12.0,
        avgShotsOnTarget: 4.5,
        restHours: 72,
        starPlayer: {
          name: 'Daniel Moreno',
          position: 'Delantero',
          goalsSeason: 9,
          expectedShots: 3.1,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Jhon Hinestroza',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.5,
        avgRedCards: 0.18,
        foulsPerCard: 5.0
      },
      venue: {
        name: 'Estadio Armando Maestre Pavajeau',
        city: 'Valledupar',
        capacity: 11000
      },
      travel: {
        awayDistanceKm: 980,
        awayFlightHours: 2.1
      },
      derbyOrRivalry: false
    },

    // 0.3 Colombia Primera B: Leones FC vs Barranquilla FC (En Vivo / 2H)
    {
      time: '16:00',
      status: 'IN_PLAY',
      currentScore: {
        home: 1,
        away: 0,
        minute: 88
      },
      league: {
        id: 241,
        name: 'Torneo BetPlay (Primera B)',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Jornada 14',
        avgGoalsPerMatch: 2.20,
        avgCardsPerMatch: 5.2
      },
      homeTeam: {
        id: 1140,
        name: 'Leones FC',
        shortName: 'Leones',
        logo: 'https://media.api-sports.io/football/teams/1140.png',
        rank: 9,
        points: 28,
        form: ['W', 'L', 'D', 'W', 'L'],
        attackStrength: 1.10,
        defenseStrength: 1.10,
        avgShotsPerMatch: 10.8,
        avgShotsOnTarget: 4.0,
        restHours: 72,
        starPlayer: {
          name: 'Nicolás Restrepo',
          position: 'Delantero',
          goalsSeason: 5,
          expectedShots: 2.4,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.22
        }
      },
      awayTeam: {
        id: 1141,
        name: 'Barranquilla FC',
        shortName: 'Barranquilla',
        logo: 'https://media.api-sports.io/football/teams/1141.png',
        rank: 10,
        points: 26,
        form: ['L', 'D', 'L', 'W', 'D'],
        attackStrength: 1.02,
        defenseStrength: 1.18,
        avgShotsPerMatch: 9.9,
        avgShotsOnTarget: 3.4,
        restHours: 72,
        starPlayer: {
          name: 'Miller Bacca',
          position: 'Delantero',
          goalsSeason: 4,
          expectedShots: 2.1,
          expectedShotsOnTarget: 0.9,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'Diego Ulloa',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.8,
        avgRedCards: 0.25,
        foulsPerCard: 5.1
      },
      venue: {
        name: 'Estadio Metropolitano Ciudad de Itagüí',
        city: 'Itagüí',
        capacity: 12000
      },
      travel: {
        awayDistanceKm: 700,
        awayFlightHours: 1.3
      },
      derbyOrRivalry: false
    },

    // 1. LaLiga: Real Madrid vs FC Barcelona (El Clásico)
    {
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 541,
        name: 'Real Madrid CF',
        shortName: 'Real Madrid',
        logo: 'https://media.api-sports.io/football/teams/541.png',
        rank: 1,
        points: 68,
        form: ['W', 'W', 'D', 'W', 'W'],
        attackStrength: 1.48,
        defenseStrength: 0.78,
        avgShotsPerMatch: 16.4,
        avgShotsOnTarget: 6.8,
        restHours: 96,
        starPlayer: {
          name: 'Kylian Mbappé',
          position: 'Delantero',
          goalsSeason: 22,
          expectedShots: 4.2,
          expectedShotsOnTarget: 2.1,
          goalConversionRate: 0.29
        }
      },
      awayTeam: {
        id: 529,
        name: 'FC Barcelona',
        shortName: 'Barcelona',
        logo: 'https://media.api-sports.io/football/teams/529.png',
        rank: 2,
        points: 65,
        form: ['W', 'W', 'W', 'L', 'W'],
        attackStrength: 1.44,
        defenseStrength: 0.82,
        avgShotsPerMatch: 15.8,
        avgShotsOnTarget: 6.2,
        restHours: 72,
        starPlayer: {
          name: 'Robert Lewandowski',
          position: 'Delantero',
          goalsSeason: 20,
          expectedShots: 3.8,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.28
        }
      },
      referee: {
        name: 'Jesús Gil Manzano',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.6,
        avgRedCards: 0.32,
        foulsPerCard: 4.1
      },
      venue: {
        name: 'Estadio Santiago Bernabéu',
        city: 'Madrid',
        capacity: 84000
      },
      travel: {
        awayDistanceKm: 620,
        awayFlightHours: 1.2
      },
      derbyOrRivalry: true
    },
    // 2. Premier League: Manchester City vs Arsenal
    {
      time: '17:30',
      status: 'SCHEDULED',
      league: {
        id: 39,
        name: 'Premier League',
        country: 'Inglaterra',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        round: 'Matchweek 30',
        avgGoalsPerMatch: 2.95,
        avgCardsPerMatch: 4.2
      },
      homeTeam: {
        id: 50,
        name: 'Manchester City',
        shortName: 'Man City',
        logo: 'https://media.api-sports.io/football/teams/50.png',
        rank: 2,
        points: 67,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.55,
        defenseStrength: 0.80,
        avgShotsPerMatch: 17.5,
        avgShotsOnTarget: 7.2,
        restHours: 120,
        starPlayer: {
          name: 'Erling Haaland',
          position: 'Delantero',
          goalsSeason: 26,
          expectedShots: 4.5,
          expectedShotsOnTarget: 2.4,
          goalConversionRate: 0.32
        }
      },
      awayTeam: {
        id: 42,
        name: 'Arsenal FC',
        shortName: 'Arsenal',
        logo: 'https://media.api-sports.io/football/teams/42.png',
        rank: 1,
        points: 69,
        form: ['W', 'W', 'W', 'W', 'D'],
        attackStrength: 1.42,
        defenseStrength: 0.72,
        avgShotsPerMatch: 15.2,
        avgShotsOnTarget: 5.8,
        restHours: 96,
        starPlayer: {
          name: 'Bukayo Saka',
          position: 'Extremo',
          goalsSeason: 15,
          expectedShots: 3.2,
          expectedShotsOnTarget: 1.4,
          goalConversionRate: 0.24
        }
      },
      referee: {
        name: 'Michael Oliver',
        nationality: 'Inglaterra',
        rigor: 'Moderado',
        avgYellowCards: 4.1,
        avgRedCards: 0.18,
        foulsPerCard: 5.4
      },
      venue: {
        name: 'Etihad Stadium',
        city: 'Manchester',
        capacity: 53400
      },
      travel: {
        awayDistanceKm: 330,
        awayFlightHours: 0.8
      },
      derbyOrRivalry: false
    },
    // 3. Champions League: Bayern München vs Paris Saint-Germain
    {
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 2,
        name: 'UEFA Champions League',
        country: 'Europa',
        flag: '🇪🇺',
        round: 'Cuartos de Final',
        avgGoalsPerMatch: 3.05,
        avgCardsPerMatch: 4.5
      },
      homeTeam: {
        id: 157,
        name: 'Bayern München',
        shortName: 'Bayern',
        logo: 'https://media.api-sports.io/football/teams/157.png',
        rank: 1,
        points: 62,
        form: ['W', 'W', 'W', 'W', 'L'],
        attackStrength: 1.58,
        defenseStrength: 0.84,
        avgShotsPerMatch: 18.2,
        avgShotsOnTarget: 7.4,
        restHours: 72,
        starPlayer: {
          name: 'Harry Kane',
          position: 'Delantero',
          goalsSeason: 28,
          expectedShots: 4.6,
          expectedShotsOnTarget: 2.3,
          goalConversionRate: 0.31
        }
      },
      awayTeam: {
        id: 85,
        name: 'Paris Saint-Germain',
        shortName: 'PSG',
        logo: 'https://media.api-sports.io/football/teams/85.png',
        rank: 1,
        points: 64,
        form: ['W', 'D', 'W', 'W', 'W'],
        attackStrength: 1.45,
        defenseStrength: 0.86,
        avgShotsPerMatch: 16.0,
        avgShotsOnTarget: 6.5,
        restHours: 68, // fatigued (<72h)
        starPlayer: {
          name: 'Ousmane Dembélé',
          position: 'Extremo',
          goalsSeason: 12,
          expectedShots: 3.4,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.22
        }
      },
      referee: {
        name: 'Szymon Marciniak',
        nationality: 'Polonia',
        rigor: 'Severo',
        avgYellowCards: 5.1,
        avgRedCards: 0.28,
        foulsPerCard: 4.6
      },
      venue: {
        name: 'Allianz Arena',
        city: 'Múnich',
        capacity: 75000
      },
      travel: {
        awayDistanceKm: 840,
        awayFlightHours: 4.2 // Long travel
      },
      derbyOrRivalry: false
    },
    // 4. Serie A: Inter Milan vs Juventus (Derby d'Italia)
    {
      time: '20:45',
      status: 'SCHEDULED',
      league: {
        id: 135,
        name: 'Serie A',
        country: 'Italia',
        flag: '🇮🇹',
        round: 'Giornata 29',
        avgGoalsPerMatch: 2.58,
        avgCardsPerMatch: 5.1
      },
      homeTeam: {
        id: 505,
        name: 'Inter Milano',
        shortName: 'Inter',
        logo: 'https://media.api-sports.io/football/teams/505.png',
        rank: 1,
        points: 71,
        form: ['W', 'W', 'W', 'W', 'W'],
        attackStrength: 1.42,
        defenseStrength: 0.68,
        avgShotsPerMatch: 15.6,
        avgShotsOnTarget: 5.9,
        restHours: 144,
        starPlayer: {
          name: 'Lautaro Martínez',
          position: 'Delantero',
          goalsSeason: 23,
          expectedShots: 4.0,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.29
        }
      },
      awayTeam: {
        id: 496,
        name: 'Juventus FC',
        shortName: 'Juventus',
        logo: 'https://media.api-sports.io/football/teams/496.png',
        rank: 3,
        points: 59,
        form: ['D', 'W', 'D', 'W', 'L'],
        attackStrength: 1.18,
        defenseStrength: 0.74,
        avgShotsPerMatch: 12.8,
        avgShotsOnTarget: 4.6,
        restHours: 96,
        starPlayer: {
          name: 'Dušan Vlahović',
          position: 'Delantero',
          goalsSeason: 16,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.6,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Daniele Orsato',
        nationality: 'Italia',
        rigor: 'Severo',
        avgYellowCards: 5.4,
        avgRedCards: 0.30,
        foulsPerCard: 4.2
      },
      venue: {
        name: 'Stadio Giuseppe Meazza (San Siro)',
        city: 'Milán',
        capacity: 75817
      },
      travel: {
        awayDistanceKm: 140,
        awayFlightHours: 0.5
      },
      derbyOrRivalry: true
    },
    // 5. Premier League: Liverpool vs Chelsea
    {
      time: '15:00',
      status: 'SCHEDULED',
      league: {
        id: 39,
        name: 'Premier League',
        country: 'Inglaterra',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        round: 'Matchweek 30',
        avgGoalsPerMatch: 2.95,
        avgCardsPerMatch: 4.2
      },
      homeTeam: {
        id: 40,
        name: 'Liverpool FC',
        shortName: 'Liverpool',
        logo: 'https://media.api-sports.io/football/teams/40.png',
        rank: 3,
        points: 64,
        form: ['W', 'D', 'W', 'W', 'W'],
        attackStrength: 1.46,
        defenseStrength: 0.82,
        avgShotsPerMatch: 16.8,
        avgShotsOnTarget: 6.4,
        restHours: 96,
        starPlayer: {
          name: 'Mohamed Salah',
          position: 'Extremo',
          goalsSeason: 19,
          expectedShots: 3.9,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.27
        }
      },
      awayTeam: {
        id: 49,
        name: 'Chelsea FC',
        shortName: 'Chelsea',
        logo: 'https://media.api-sports.io/football/teams/49.png',
        rank: 6,
        points: 49,
        form: ['W', 'W', 'L', 'D', 'W'],
        attackStrength: 1.25,
        defenseStrength: 0.98,
        avgShotsPerMatch: 13.9,
        avgShotsOnTarget: 5.1,
        restHours: 70, // fatigued (<72h)
        starPlayer: {
          name: 'Cole Palmer',
          position: 'Mediapunta',
          goalsSeason: 17,
          expectedShots: 3.6,
          expectedShotsOnTarget: 1.6,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Anthony Taylor',
        nationality: 'Inglaterra',
        rigor: 'Moderado',
        avgYellowCards: 4.3,
        avgRedCards: 0.20,
        foulsPerCard: 5.0
      },
      venue: {
        name: 'Anfield',
        city: 'Liverpool',
        capacity: 61276
      },
      travel: {
        awayDistanceKm: 350,
        awayFlightHours: 0.9
      },
      derbyOrRivalry: false
    },
    // 6. LaLiga: Atlético de Madrid vs Sevilla FC
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 530,
        name: 'Atlético de Madrid',
        shortName: 'Atlético',
        logo: 'https://media.api-sports.io/football/teams/530.png',
        rank: 3,
        points: 58,
        form: ['W', 'L', 'W', 'W', 'D'],
        attackStrength: 1.28,
        defenseStrength: 0.76,
        avgShotsPerMatch: 14.1,
        avgShotsOnTarget: 5.3,
        restHours: 120,
        starPlayer: {
          name: 'Antoine Griezmann',
          position: 'Mediapunta',
          goalsSeason: 14,
          expectedShots: 3.3,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.25
        }
      },
      awayTeam: {
        id: 536,
        name: 'Sevilla FC',
        shortName: 'Sevilla',
        logo: 'https://media.api-sports.io/football/teams/536.png',
        rank: 12,
        points: 34,
        form: ['L', 'D', 'W', 'L', 'D'],
        attackStrength: 1.05,
        defenseStrength: 1.12,
        avgShotsPerMatch: 11.8,
        avgShotsOnTarget: 4.0,
        restHours: 96,
        starPlayer: {
          name: 'Isaac Romero',
          position: 'Delantero',
          goalsSeason: 9,
          expectedShots: 2.8,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.21
        }
      },
      referee: {
        name: 'Alejandro Hernández Hernández',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.8,
        avgRedCards: 0.35,
        foulsPerCard: 3.9
      },
      venue: {
        name: 'Cívitas Metropolitano',
        city: 'Madrid',
        capacity: 70460
      },
      travel: {
        awayDistanceKm: 530,
        awayFlightHours: 1.1
      },
      derbyOrRivalry: false
    },
    // 7. Bundesliga: Borussia Dortmund vs Bayer Leverkusen
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 78,
        name: 'Bundesliga',
        country: 'Alemania',
        flag: '🇩🇪',
        round: 'Spieltag 27',
        avgGoalsPerMatch: 3.18,
        avgCardsPerMatch: 3.9
      },
      homeTeam: {
        id: 165,
        name: 'Borussia Dortmund',
        shortName: 'Dortmund',
        logo: 'https://media.api-sports.io/football/teams/165.png',
        rank: 4,
        points: 52,
        form: ['W', 'W', 'D', 'L', 'W'],
        attackStrength: 1.38,
        defenseStrength: 0.94,
        avgShotsPerMatch: 15.4,
        avgShotsOnTarget: 6.0,
        restHours: 96,
        starPlayer: {
          name: 'Serhou Guirassy',
          position: 'Delantero',
          goalsSeason: 18,
          expectedShots: 3.7,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 168,
        name: 'Bayer 04 Leverkusen',
        shortName: 'Leverkusen',
        logo: 'https://media.api-sports.io/football/teams/168.png',
        rank: 2,
        points: 60,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.45,
        defenseStrength: 0.81,
        avgShotsPerMatch: 16.2,
        avgShotsOnTarget: 6.6,
        restHours: 72,
        starPlayer: {
          name: 'Florian Wirtz',
          position: 'Mediapunta',
          goalsSeason: 14,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.7,
          goalConversionRate: 0.25
        }
      },
      referee: {
        name: 'Felix Zwayer',
        nationality: 'Alemania',
        rigor: 'Moderado',
        avgYellowCards: 4.4,
        avgRedCards: 0.16,
        foulsPerCard: 5.2
      },
      venue: {
        name: 'Signal Iduna Park',
        city: 'Dortmund',
        capacity: 81365
      },
      travel: {
        awayDistanceKm: 85,
        awayFlightHours: 0.4
      },
      derbyOrRivalry: false
    },
    // 8. Copa Libertadores: River Plate vs Flamengo
    {
      time: '21:30',
      status: 'SCHEDULED',
      league: {
        id: 13,
        name: 'Copa Libertadores',
        country: 'Sudamérica',
        flag: '🏆',
        round: 'Fase de Grupos',
        avgGoalsPerMatch: 2.62,
        avgCardsPerMatch: 5.7
      },
      homeTeam: {
        id: 435,
        name: 'CA River Plate',
        shortName: 'River Plate',
        logo: 'https://media.api-sports.io/football/teams/435.png',
        rank: 1,
        points: 12,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.35,
        defenseStrength: 0.74,
        avgShotsPerMatch: 15.0,
        avgShotsOnTarget: 5.8,
        restHours: 120,
        starPlayer: {
          name: 'Miguel Borja',
          position: 'Delantero',
          goalsSeason: 16,
          expectedShots: 3.8,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 127,
        name: 'CR Flamengo',
        shortName: 'Flamengo',
        logo: 'https://media.api-sports.io/football/teams/127.png',
        rank: 2,
        points: 10,
        form: ['W', 'L', 'W', 'W', 'D'],
        attackStrength: 1.32,
        defenseStrength: 0.85,
        avgShotsPerMatch: 14.2,
        avgShotsOnTarget: 5.4,
        restHours: 65, // fatigued
        starPlayer: {
          name: 'Pedro',
          position: 'Delantero',
          goalsSeason: 19,
          expectedShots: 3.9,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.29
        }
      },
      referee: {
        name: 'Wilton Sampaio',
        nationality: 'Brasil',
        rigor: 'Severo',
        avgYellowCards: 6.2,
        avgRedCards: 0.42,
        foulsPerCard: 3.7
      },
      venue: {
        name: 'Estadio Monumental',
        city: 'Buenos Aires',
        capacity: 84567
      },
      travel: {
        awayDistanceKm: 2650,
        awayFlightHours: 4.5 // international flight
      },
      derbyOrRivalry: true
    },
    // 9. LaLiga: Valencia CF vs RCD Espanyol (Pelea por Permanencia)
    {
      time: '14:00',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 532,
        name: 'Valencia CF',
        shortName: 'Valencia',
        logo: 'https://media.api-sports.io/football/teams/532.png',
        rank: 17,
        points: 27,
        form: ['L', 'D', 'W', 'L', 'L'],
        attackStrength: 0.92,
        defenseStrength: 1.15,
        avgShotsPerMatch: 11.2,
        avgShotsOnTarget: 3.8,
        restHours: 144,
        starPlayer: {
          name: 'Hugo Duro',
          position: 'Delantero',
          goalsSeason: 10,
          expectedShots: 2.7,
          expectedShotsOnTarget: 1.0,
          goalConversionRate: 0.22
        }
      },
      awayTeam: {
        id: 540,
        name: 'RCD Espanyol',
        shortName: 'Espanyol',
        logo: 'https://media.api-sports.io/football/teams/540.png',
        rank: 18,
        points: 25,
        form: ['D', 'L', 'L', 'W', 'L'],
        attackStrength: 0.88,
        defenseStrength: 1.25,
        avgShotsPerMatch: 10.4,
        avgShotsOnTarget: 3.4,
        restHours: 120,
        starPlayer: {
          name: 'Javi Puado',
          position: 'Extremo',
          goalsSeason: 8,
          expectedShots: 2.4,
          expectedShotsOnTarget: 0.9,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'César Soto Grado',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.9,
        avgRedCards: 0.38,
        foulsPerCard: 3.8
      },
      venue: {
        name: 'Estadio de Mestalla',
        city: 'Valencia',
        capacity: 49430
      },
      travel: {
        awayDistanceKm: 350,
        awayFlightHours: 0.9
      },
      derbyOrRivalry: false
    }
  ];

  return fixtureBlueprints.map((item, index) => {
    return {
      ...item,
      id: `fix-${dateStr}-${index + 1}-${dateHash % 997}`,
      date: dateStr,
      h2h: item.h2h || computeH2H(
        item.homeTeam.id,
        item.awayTeam.id,
        item.homeTeam.attackStrength,
        item.homeTeam.defenseStrength,
        item.awayTeam.attackStrength,
        item.awayTeam.defenseStrength
      )
    };
  });
}

export function computeH2H(
  homeId: number,
  awayId: number,
  homeAttack: number,
  homeDefense: number,
  awayAttack: number,
  awayDefense: number
): H2HSummary {
  const seed = (Math.abs(homeId) * 37 + Math.abs(awayId) * 19) % 100;
  const strengthDiff = (homeAttack / Math.max(0.1, homeDefense)) - (awayAttack / Math.max(0.1, awayDefense));

  let homeWins = 2;
  let draws = 1;
  let awayWins = 2;

  if (strengthDiff > 0.3) {
    homeWins = 3 + (seed % 2);
    draws = (seed + 1) % 2;
    awayWins = Math.max(0, 5 - homeWins - draws);
  } else if (strengthDiff < -0.3) {
    awayWins = 3 + (seed % 2);
    draws = (seed + 1) % 2;
    homeWins = Math.max(0, 5 - awayWins - draws);
  } else {
    draws = 1 + (seed % 2);
    const bias = seed % 3;
    homeWins = bias === 0 ? 2 : bias === 1 ? 1 : 2;
    awayWins = Math.max(0, 5 - homeWins - draws);
  }

  homeWins = Math.max(0, homeWins);
  awayWins = Math.max(0, awayWins);
  draws = Math.max(0, 5 - homeWins - awayWins);

  return {
    totalMatches: 5,
    homeWins,
    draws,
    awayWins
  };
}

interface ClubProfile {
  atk: number;
  def: number;
  rank: number;
  star: string;
  starPos: string;
  shots: number;
}

// Strictly disambiguated club matcher: prevents substring collisions across leagues/continents
// (e.g., "Internacional de Bogota" or "SC Internacional" or "Inter Miami" NEVER match Inter Milan).
function matchKnownClub(name: string, country?: string): ClubProfile | null {
  const raw = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const cNorm = (country || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!raw) return null;

  // 1. COLOMBIA (Liga BetPlay Dimayor & Torneo BetPlay)
  if (raw.includes('alianza valledupar') || raw === 'alianza fc' || raw.includes('alianza petrolera') || (raw.includes('alianza') && cNorm.includes('colombia'))) {
    return { atk: 1.15, def: 1.04, rank: 8, star: 'Andrés Rentería', starPos: 'Delantero', shots: 11.6 };
  }
  if (raw.includes('internacional de bogota') || raw.includes('internacional bogota') || raw.includes('internacional fc') || raw.includes('inter palmira') || raw.includes('internacional de palmira')) {
    return { atk: 1.08, def: 1.08, rank: 10, star: 'Brayan Fernández', starPos: 'Delantero', shots: 10.9 };
  }
  if (raw.includes('millonarios')) {
    return { atk: 1.38, def: 0.82, rank: 3, star: 'Leonardo Castro', starPos: 'Delantero', shots: 14.5 };
  }
  if (raw.includes('atletico nacional') || raw === 'nacional medellin') {
    return { atk: 1.42, def: 0.80, rank: 2, star: 'Alfredo Morelos', starPos: 'Delantero', shots: 15.0 };
  }
  if (raw.includes('america de cali') || raw === 'america cali') {
    return { atk: 1.36, def: 0.84, rank: 1, star: 'Duván Vergara', starPos: 'Extremo', shots: 14.2 };
  }
  if (raw.includes('junior barranquilla') || raw.includes('atletico junior') || raw === 'junior' || raw === 'junior fc') {
    return { atk: 1.32, def: 0.88, rank: 5, star: 'Carlos Bacca', starPos: 'Delantero', shots: 13.6 };
  }
  if (raw.includes('santa fe') && !raw.includes('union')) {
    return { atk: 1.34, def: 0.83, rank: 4, star: 'Hugo Rodallega', starPos: 'Delantero', shots: 13.8 };
  }
  if (raw.includes('independiente medellin') || raw === 'medellin' || raw === 'dim') {
    return { atk: 1.26, def: 0.92, rank: 6, star: 'Brayan León', starPos: 'Delantero', shots: 13.1 };
  }
  if (raw.includes('deportes tolima') || raw === 'tolima') {
    return { atk: 1.33, def: 0.82, rank: 3, star: 'Yeison Guzmán', starPos: 'Mediapunta', shots: 13.9 };
  }
  if (raw.includes('once caldas')) {
    return { atk: 1.25, def: 0.88, rank: 5, star: 'Dayro Moreno', starPos: 'Delantero', shots: 13.2 };
  }
  if (raw.includes('bucaramanga')) {
    return { atk: 1.22, def: 0.86, rank: 7, star: 'Fabián Sambueza', starPos: 'Mediapunta', shots: 12.4 };
  }
  if (raw.includes('deportivo cali')) {
    return { atk: 1.12, def: 1.08, rank: 13, star: 'Fredy Montero', starPos: 'Delantero', shots: 11.5 };
  }
  if (raw.includes('deportivo pereira') || raw === 'pereira') {
    return { atk: 1.20, def: 0.94, rank: 8, star: 'Carlos Darwin Quintero', starPos: 'Mediapunta', shots: 12.6 };
  }
  if (raw.includes('deportivo pasto') || raw === 'pasto') {
    return { atk: 1.18, def: 0.96, rank: 9, star: 'Daniel Moreno', starPos: 'Delantero', shots: 12.0 };
  }
  if (raw.includes('fortaleza ceif') || (raw.includes('fortaleza') && cNorm.includes('colombia'))) {
    return { atk: 1.16, def: 1.00, rank: 10, star: 'Adrián Parra', starPos: 'Delantero', shots: 11.4 };
  }
  if (raw.includes('equidad')) {
    return { atk: 1.10, def: 0.98, rank: 11, star: 'Beckham Castro', starPos: 'Extremo', shots: 11.0 };
  }
  if (raw.includes('aguilas doradas') || raw.includes('rionegro aguilas')) {
    return { atk: 1.15, def: 1.02, rank: 11, star: 'Jesús Rivas', starPos: 'Mediapunta', shots: 11.8 };
  }
  if (raw.includes('envigado')) {
    return { atk: 0.98, def: 1.18, rank: 18, star: 'Dorlan Pabón', starPos: 'Delantero', shots: 10.2 };
  }
  if (raw.includes('boyaca chico') || raw.includes('chico fc')) {
    return { atk: 1.00, def: 1.16, rank: 17, star: 'Henry Plazas', starPos: 'Defensa', shots: 10.4 };
  }
  if (raw.includes('llaneros')) {
    return { atk: 1.08, def: 1.10, rank: 12, star: 'Bryan Urueña', starPos: 'Mediapunta', shots: 10.8 };
  }
  if (raw.includes('cucuta')) {
    return { atk: 1.05, def: 1.12, rank: 14, star: 'Jaime Peralta', starPos: 'Delantero', shots: 10.6 };
  }
  if (raw.includes('real cartagena')) {
    return { atk: 1.18, def: 0.98, rank: 4, star: 'Teófilo Gutiérrez', starPos: 'Delantero', shots: 12.2 };
  }

  // 2. SUDAMÉRICA & CONCACAF (Clubes con posibles homónimos europeos)
  if (raw.includes('inter miami')) {
    return { atk: 1.48, def: 0.92, rank: 1, star: 'Lionel Messi', starPos: 'Delantero', shots: 16.0 };
  }
  if (raw === 'internacional' || raw.includes('sc internacional') || raw.includes('sport club internacional') || (raw.includes('internacional') && cNorm.includes('brasil'))) {
    return { atk: 1.30, def: 0.82, rank: 4, star: 'Rafael Santos Borré', starPos: 'Delantero', shots: 14.2 };
  }
  if (raw.includes('barcelona sc') || raw.includes('barcelona guayaquil') || (raw.includes('barcelona') && cNorm.includes('ecuador'))) {
    return { atk: 1.26, def: 0.88, rank: 3, star: 'Janner Corozo', starPos: 'Extremo', shots: 13.4 };
  }
  if (raw.includes('liverpool montevideo') || (raw.includes('liverpool') && cNorm.includes('uruguay'))) {
    return { atk: 1.14, def: 1.02, rank: 7, star: 'Renzo Machado', starPos: 'Delantero', shots: 11.8 };
  }
  if (raw.includes('arsenal de sarandi') || (raw.includes('arsenal') && cNorm.includes('argentina'))) {
    return { atk: 0.96, def: 1.15, rank: 18, star: 'Tomás Ortiz', starPos: 'Mediapunta', shots: 10.2 };
  }
  if ((raw.includes('river plate') || raw === 'ca river plate') && !raw.includes('boston') && !raw.includes('montevideo') && !raw.includes('asuncion') && !cNorm.includes('uruguay') && !cNorm.includes('paraguay')) {
    return { atk: 1.35, def: 0.74, rank: 1, star: 'Miguel Borja', starPos: 'Delantero', shots: 15.0 };
  }
  if ((raw.includes('boca juniors') || raw === 'ca boca juniors') && !raw.includes('cali') && !cNorm.includes('colombia')) {
    return { atk: 1.20, def: 0.82, rank: 4, star: 'Edinson Cavani', starPos: 'Delantero', shots: 13.5 };
  }
  if (raw.includes('flamengo')) {
    return { atk: 1.32, def: 0.85, rank: 2, star: 'Pedro', starPos: 'Delantero', shots: 14.2 };
  }
  if (raw.includes('palmeiras')) {
    return { atk: 1.34, def: 0.76, rank: 2, star: 'Estêvão', starPos: 'Extremo', shots: 14.8 };
  }

  // 3. EUROPA ELITE (Con validación estricta para no contaminar ligas de otros países)
  const isNonEuropeanLeague = /colombia|brasil|brazil|argentina|ecuador|uruguay|paraguay|peru|chile|bolivia|venezuela|mexico|costa rica|nicaragua|honduras|guatemala|salvador|panama|estados unidos|usa/i.test(cNorm);
  if (isNonEuropeanLeague) {
    return null;
  }

  if (raw.includes('real madrid')) {
    return { atk: 1.48, def: 0.78, rank: 1, star: 'Kylian Mbappé', starPos: 'Delantero', shots: 16.5 };
  }
  if ((raw === 'barcelona' || raw === 'fc barcelona' || raw.includes('fc barcelona')) && !raw.includes('sc') && !raw.includes('guayaquil')) {
    return { atk: 1.44, def: 0.82, rank: 2, star: 'Robert Lewandowski', starPos: 'Delantero', shots: 15.8 };
  }
  if (raw.includes('manchester city') || raw === 'man city') {
    return { atk: 1.55, def: 0.80, rank: 2, star: 'Erling Haaland', starPos: 'Delantero', shots: 17.5 };
  }
  if ((raw === 'arsenal' || raw === 'arsenal fc') && !raw.includes('sarandi') && !raw.includes('tula')) {
    return { atk: 1.42, def: 0.72, rank: 1, star: 'Bukayo Saka', starPos: 'Extremo', shots: 15.2 };
  }
  if ((raw === 'liverpool' || raw === 'liverpool fc') && !raw.includes('montevideo')) {
    return { atk: 1.46, def: 0.82, rank: 3, star: 'Mohamed Salah', starPos: 'Extremo', shots: 16.8 };
  }
  if (raw === 'chelsea' || raw === 'chelsea fc') {
    return { atk: 1.25, def: 0.98, rank: 6, star: 'Cole Palmer', starPos: 'Mediapunta', shots: 13.9 };
  }
  if (raw.includes('bayern')) {
    return { atk: 1.58, def: 0.84, rank: 1, star: 'Harry Kane', starPos: 'Delantero', shots: 18.2 };
  }
  if (raw === 'psg' || raw.includes('paris saint-germain') || raw.includes('paris sg')) {
    return { atk: 1.45, def: 0.86, rank: 1, star: 'Ousmane Dembélé', starPos: 'Extremo', shots: 16.0 };
  }
  if (
    raw === 'inter' ||
    raw === 'inter milan' ||
    raw === 'inter milano' ||
    raw.includes('internazionale')
  ) {
    return { atk: 1.42, def: 0.68, rank: 1, star: 'Lautaro Martínez', starPos: 'Delantero', shots: 15.6 };
  }
  if (raw === 'juventus' || raw === 'juventus fc' || raw.includes('juventus turin')) {
    return { atk: 1.18, def: 0.74, rank: 3, star: 'Dušan Vlahović', starPos: 'Delantero', shots: 12.8 };
  }
  if (raw === 'milan' || raw === 'ac milan') {
    return { atk: 1.26, def: 0.88, rank: 4, star: 'Rafael Leão', starPos: 'Extremo', shots: 14.0 };
  }
  if (raw.includes('atletico de madrid') || raw.includes('atletico madrid') || raw === 'club atletico de madrid') {
    return { atk: 1.28, def: 0.76, rank: 3, star: 'Antoine Griezmann', starPos: 'Mediapunta', shots: 14.1 };
  }
  if (raw.includes('borussia dortmund') || raw === 'dortmund') {
    return { atk: 1.38, def: 0.94, rank: 4, star: 'Serhou Guirassy', starPos: 'Delantero', shots: 15.4 };
  }
  if (raw.includes('leverkusen')) {
    return { atk: 1.45, def: 0.81, rank: 2, star: 'Florian Wirtz', starPos: 'Mediapunta', shots: 16.2 };
  }
  if (raw === 'sevilla' || raw === 'sevilla fc') {
    return { atk: 1.05, def: 1.12, rank: 12, star: 'Isaac Romero', starPos: 'Delantero', shots: 11.8 };
  }
  if (raw === 'valencia' || raw === 'valencia cf') {
    return { atk: 0.95, def: 1.15, rank: 17, star: 'Hugo Duro', starPos: 'Delantero', shots: 11.2 };
  }
  if (raw.includes('espanyol')) {
    return { atk: 0.90, def: 1.22, rank: 18, star: 'Javi Puado', starPos: 'Extremo', shots: 10.4 };
  }
  if (raw.includes('aston villa')) {
    return { atk: 1.30, def: 0.92, rank: 5, star: 'Ollie Watkins', starPos: 'Delantero', shots: 14.4 };
  }
  if (raw.includes('tottenham')) {
    return { atk: 1.32, def: 1.02, rank: 7, star: 'Son Heung-min', starPos: 'Delantero', shots: 14.8 };
  }

  return null;
}

function getTeamRating(name: string, id: number, isHome: boolean, country?: string) {
  const matched = matchKnownClub(name, country);
  if (matched) {
    return {
      rank: matched.rank,
      points: Math.max(15, 75 - matched.rank * 3),
      attackStrength: matched.atk,
      defenseStrength: matched.def,
      shots: matched.shots,
      starName: matched.star,
      starPos: matched.starPos
    };
  }

  // Deterministic calculation from team ID and name to give realistic variation
  const hash = (id * 17 + name.length * 31 + (isHome ? 13 : 7)) % 100;
  const rank = Math.max(1, Math.min(20, Math.floor(hash / 5) + 1));
  const attackStrength = Math.round((1.45 - (rank * 0.035) + ((hash % 10) * 0.015)) * 100) / 100;
  const defenseStrength = Math.round((0.72 + (rank * 0.032) - ((hash % 8) * 0.01)) * 100) / 100;
  const shots = Math.round((16.5 - rank * 0.28) * 10) / 10;
  const points = Math.max(18, 72 - rank * 3);

  return {
    rank,
    points,
    attackStrength: Math.max(0.75, Math.min(1.65, attackStrength)),
    defenseStrength: Math.max(0.65, Math.min(1.40, defenseStrength)),
    shots: Math.max(9.0, shots),
    starName: resolveTeamStarPlayerName(name),
    starPos: 'Delantero'
  };
}

export function getUserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch {
    // fallback if Intl is unavailable
  }
  return 'America/Bogota';
}

// Helper: Convert date/timestamp to the user's local country timezone
export function formatToColombiaTime(isoOrTimestamp: string | number | undefined): { date: string; time: string; fullLabel: string } {
  const userTz = getUserTimeZone();
  if (!isoOrTimestamp) {
    return { date: getColombiaDateString(0), time: '19:00', fullLabel: '19:00' };
  }
  const d = typeof isoOrTimestamp === 'number'
    ? new Date(isoOrTimestamp < 1e12 ? isoOrTimestamp * 1000 : isoOrTimestamp)
    : new Date(isoOrTimestamp);

  if (isNaN(d.getTime())) {
    return { date: getColombiaDateString(0), time: '19:00', fullLabel: '19:00' };
  }

  let date = '';
  let time = '19:00';
  try {
    date = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);

    time = new Intl.DateTimeFormat('es-CO', {
      timeZone: userTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  } catch {
    date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
    time = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }

  return { date, time, fullLabel: time };
}

export function getColombiaDateString(offsetDays = 0): string {
  const userTz = getUserTimeZone();
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: userTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }
}

// Convert raw API-Football / ESPN hybrid response item into normalized MatchFixture in local timezone
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiSportsFixture(raw: any, fallbackTargetDate: string): MatchFixture {
  const fixtureId = String(raw.fixture?.id || Math.random());
  
  // Format kickoff explicitly to the user's local timezone
  const rawDateOrTimestamp = raw.fixture?.timestamp ? raw.fixture.timestamp * 1000 : raw.fixture?.date;
  const localTimeInfo = formatToColombiaTime(rawDateOrTimestamp);
  const kickoff = localTimeInfo.time;
  const matchDate = localTimeInfo.date || fallbackTargetDate;

  const statusShort = String(raw.fixture?.status?.short || '').toUpperCase();
  const elapsed = raw.fixture?.status?.elapsed;

  const hasGoalsReported =
    (raw.goals?.home !== null && raw.goals?.home !== undefined) ||
    (raw.score?.fulltime?.home !== null && raw.score?.fulltime?.home !== undefined);
  const homeGoals = raw.goals?.home ?? raw.score?.fulltime?.home ?? 0;
  const awayGoals = raw.goals?.away ?? raw.score?.fulltime?.away ?? 0;

  // Determine kickoff timestamp in ms
  const matchTimestampMs = raw.fixture?.timestamp
    ? raw.fixture.timestamp * 1000
    : raw.fixture?.date
    ? new Date(raw.fixture.date).getTime()
    : 0;

  const nowMs = Date.now();
  const minutesSinceKickoff = matchTimestampMs > 0 ? (nowMs - matchTimestampMs) / 60000 : -1;

  let status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED' = 'SCHEDULED';

  // 1. Explicit finished status from provider OR kickoff was >= 120 mins ago
  if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'PST', 'CANC', 'ABD'].includes(statusShort)) {
    status = 'FINISHED';
  } else if (matchTimestampMs > 0 && minutesSinceKickoff >= 120) {
    status = 'FINISHED';
  }
  // 2. Explicit live in-play status (within active match window)
  else if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(statusShort)) {
    status = 'IN_PLAY';
  }
  // 3. Match has final goals reported and match was played or 90 mins elapsed
  else if (hasGoalsReported && (elapsed >= 90 || minutesSinceKickoff >= 105)) {
    status = 'FINISHED';
  }
  // 4. Match has real reported goals and is currently underway
  else if (hasGoalsReported && minutesSinceKickoff > 0 && minutesSinceKickoff < 115) {
    status = 'IN_PLAY';
  }
  // 5. Kickoff is in the future or match has no live confirmation from provider
  else {
    status = 'SCHEDULED';
  }

  const isExplicitHT = statusShort === 'HT' || statusShort === 'BT' || statusShort === 'INT';
  const isSimulatedHT =
    status === 'IN_PLAY' &&
    !isExplicitHT &&
    (statusShort === 'NS' || !elapsed) &&
    minutesSinceKickoff >= 48 &&
    minutesSinceKickoff <= 64;
  const isHalfTime = isExplicitHT || isSimulatedHT;

  let resolvedMinute = 90;
  if (status === 'IN_PLAY') {
    if (isHalfTime) {
      resolvedMinute = 45;
    } else if (typeof elapsed === 'number' && elapsed > 0 && statusShort !== 'NS') {
      resolvedMinute = Math.min(90, Math.max(1, elapsed));
    } else if (minutesSinceKickoff > 0) {
      resolvedMinute =
        minutesSinceKickoff <= 47
          ? Math.min(45, Math.max(1, Math.floor(minutesSinceKickoff)))
          : Math.min(90, Math.max(46, 45 + Math.floor(minutesSinceKickoff - 64)));
    } else {
      resolvedMinute = 45;
    }
  }

  const currentScore =
    status !== 'SCHEDULED' || hasGoalsReported
      ? {
          home: Number(homeGoals),
          away: Number(awayGoals),
          minute: resolvedMinute,
          isHalfTime,
          statusShort: isHalfTime ? 'HT' : statusShort || (status === 'IN_PLAY' ? '2H' : 'FT')
        }
      : undefined;

  const refName = raw.fixture?.referee || 'Árbitro Principal Oficial';
  const rigor: 'Severo' | 'Moderado' | 'Flexible' =
    refName.toLowerCase().includes('manzano') ||
    refName.toLowerCase().includes('lahoz') ||
    refName.toLowerCase().includes('marciniak') ||
    refName.toLowerCase().includes('sampaio')
      ? 'Severo'
      : refName.toLowerCase().includes('turpin') ||
        refName.toLowerCase().includes('taylor') ||
        refName.toLowerCase().includes('zwayer')
      ? 'Flexible'
      : 'Moderado';

  const homeTeamName = raw.teams?.home?.name || 'Equipo Local';
  const homeTeamId = raw.teams?.home?.id || 1;
  const awayTeamName = raw.teams?.away?.name || 'Equipo Visitante';
  const awayTeamId = raw.teams?.away?.id || 2;

  const leagueCountry = raw.league?.country || 'Internacional';
  const homeRating = getTeamRating(homeTeamName, homeTeamId, true, leagueCountry);
  const awayRating = getTeamRating(awayTeamName, awayTeamId, false, leagueCountry);

  return {
    id: fixtureId,
    espnEventId: raw.espnEventId ? String(raw.espnEventId) : undefined,
    date: matchDate,
    time: kickoff,
    status,
    currentScore,
    liveStats: raw.liveStats as RealMatchStats | undefined,
    liveEvents: Array.isArray(raw.liveEvents) ? (raw.liveEvents as TimelineEventItem[]) : undefined,
    liveRosters: raw.liveRosters as RealMatchRosters | undefined,
    league: {
      id: raw.league?.id || 1,
      name: raw.league?.name || 'Liga de Primera División',
      country: raw.league?.country || 'Internacional',
      flag: raw.league?.flag || '⚽',
      round: raw.league?.round || 'Jornada Regular',
      avgGoalsPerMatch: 2.75,
      avgCardsPerMatch: 4.5
    },
    homeTeam: {
      id: homeTeamId,
      name: homeTeamName,
      shortName: homeTeamName.split(' ')[0],
      logo: raw.teams?.home?.logo || 'https://media.api-sports.io/football/teams/541.png',
      rank: homeRating.rank,
      points: homeRating.points,
      form: ['W', 'D', 'W', 'W', 'L'],
      attackStrength: homeRating.attackStrength,
      defenseStrength: homeRating.defenseStrength,
      avgShotsPerMatch: homeRating.shots,
      avgShotsOnTarget: Math.round(homeRating.shots * 0.42 * 10) / 10,
      restHours: 96,
      starPlayer: {
        name: resolveTeamStarPlayerName(
          homeTeamName,
          homeRating.starName,
          (raw.liveRosters as RealMatchRosters | undefined)?.homeStarters
        ),
        position: homeRating.starPos,
        goalsSeason: Math.max(6, Math.floor(homeRating.attackStrength * 12)),
        expectedShots: Math.round(homeRating.shots * 0.26 * 10) / 10,
        expectedShotsOnTarget: Math.round(homeRating.shots * 0.12 * 10) / 10,
        goalConversionRate: 0.28
      }
    },
    awayTeam: {
      id: awayTeamId,
      name: awayTeamName,
      shortName: awayTeamName.split(' ')[0],
      logo: raw.teams?.away?.logo || 'https://media.api-sports.io/football/teams/529.png',
      rank: awayRating.rank,
      points: awayRating.points,
      form: ['W', 'L', 'D', 'W', 'W'],
      attackStrength: awayRating.attackStrength,
      defenseStrength: awayRating.defenseStrength,
      avgShotsPerMatch: awayRating.shots,
      avgShotsOnTarget: Math.round(awayRating.shots * 0.39 * 10) / 10,
      restHours: 72,
      starPlayer: {
        name: resolveTeamStarPlayerName(
          awayTeamName,
          awayRating.starName,
          (raw.liveRosters as RealMatchRosters | undefined)?.awayStarters
        ),
        position: awayRating.starPos,
        goalsSeason: Math.max(5, Math.floor(awayRating.attackStrength * 10)),
        expectedShots: Math.round(awayRating.shots * 0.24 * 10) / 10,
        expectedShotsOnTarget: Math.round(awayRating.shots * 0.11 * 10) / 10,
        goalConversionRate: 0.25
      }
    },
    referee: {
      name: refName,
      nationality: raw.league?.country || 'Internacional',
      rigor,
      avgYellowCards: rigor === 'Severo' ? 4.8 : rigor === 'Flexible' ? 3.4 : 4.0,
      avgRedCards: rigor === 'Severo' ? 0.22 : 0.12,
      foulsPerCard: 5.2
    },
    venue: {
      name: raw.fixture?.venue?.name || 'Estadio Principal',
      city: raw.fixture?.venue?.city || 'Sede',
      capacity: 50000
    },
    travel: {
      awayDistanceKm: 420,
      awayFlightHours: 1.2
    },
    derbyOrRivalry: Boolean(homeRating.rank <= 4 && awayRating.rank <= 4),
    h2h: computeH2H(
      homeTeamId,
      awayTeamId,
      homeRating.attackStrength,
      homeRating.defenseStrength,
      awayRating.attackStrength,
      awayRating.defenseStrength
    )
  };
}

function sortFixturesByPriority(list: MatchFixture[]): MatchFixture[] {
  return [...list].sort((a, b) => {
    // Priority order: Live (0), Upcoming/Scheduled (1), Finished (2)
    const priority = (s: MatchFixture['status']) => (s === 'IN_PLAY' ? 0 : s === 'SCHEDULED' ? 1 : 2);
    const diff = priority(a.status) - priority(b.status);
    if (diff !== 0) return diff;
    return a.time.localeCompare(b.time);
  });
}

export async function checkSecretServerStatus(): Promise<{ hasKey: boolean; source: string }> {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // server not running full-stack
  }
  return { hasKey: false, source: 'none' };
}

export async function saveSecretServerApiKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/set-secret-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: `Error HTTP ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

const UPCOMING_CACHE_PREFIX = 'futbolstats_upcoming_v11_';
const UPCOMING_CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes in localStorage for maximum quota protection

export function sanitizeFixturePlayers(fix: MatchFixture): MatchFixture {
  const homeContaminated = isContaminatedForeignStar(fix.homeTeam.starPlayer?.name, fix.homeTeam.name);
  const awayContaminated = isContaminatedForeignStar(fix.awayTeam.starPlayer?.name, fix.awayTeam.name);

  const homeRecalc = homeContaminated
    ? getTeamRating(fix.homeTeam.name, fix.homeTeam.id, true, fix.league?.country)
    : null;
  const awayRecalc = awayContaminated
    ? getTeamRating(fix.awayTeam.name, fix.awayTeam.id, false, fix.league?.country)
    : null;

  return {
    ...fix,
    homeTeam: {
      ...fix.homeTeam,
      ...(homeRecalc
        ? {
            rank: homeRecalc.rank,
            points: homeRecalc.points,
            attackStrength: homeRecalc.attackStrength,
            defenseStrength: homeRecalc.defenseStrength,
            avgShotsPerMatch: homeRecalc.shots,
            avgShotsOnTarget: Math.round(homeRecalc.shots * 0.42 * 10) / 10
          }
        : {}),
      starPlayer: {
        ...fix.homeTeam.starPlayer,
        ...(homeRecalc
          ? {
              position: homeRecalc.starPos,
              goalsSeason: Math.max(6, Math.floor(homeRecalc.attackStrength * 12)),
              expectedShots: Math.round(homeRecalc.shots * 0.26 * 10) / 10,
              expectedShotsOnTarget: Math.round(homeRecalc.shots * 0.12 * 10) / 10
            }
          : {}),
        name: resolveTeamStarPlayerName(
          fix.homeTeam.name,
          homeRecalc ? homeRecalc.starName : fix.homeTeam.starPlayer?.name,
          fix.liveRosters?.homeStarters
        )
      }
    },
    awayTeam: {
      ...fix.awayTeam,
      ...(awayRecalc
        ? {
            rank: awayRecalc.rank,
            points: awayRecalc.points,
            attackStrength: awayRecalc.attackStrength,
            defenseStrength: awayRecalc.defenseStrength,
            avgShotsPerMatch: awayRecalc.shots,
            avgShotsOnTarget: Math.round(awayRecalc.shots * 0.39 * 10) / 10
          }
        : {}),
      starPlayer: {
        ...fix.awayTeam.starPlayer,
        ...(awayRecalc
          ? {
              position: awayRecalc.starPos,
              goalsSeason: Math.max(5, Math.floor(awayRecalc.attackStrength * 10)),
              expectedShots: Math.round(awayRecalc.shots * 0.24 * 10) / 10,
              expectedShotsOnTarget: Math.round(awayRecalc.shots * 0.11 * 10) / 10
            }
          : {}),
        name: resolveTeamStarPlayerName(
          fix.awayTeam.name,
          awayRecalc ? awayRecalc.starName : fix.awayTeam.starPlayer?.name,
          fix.liveRosters?.awayStarters
        )
      }
    }
  };
}

export interface UpcomingCachePayload {
  fixtures: MatchFixture[];
  timestamp: number;
  dateStr: string;
}

export function getLocalUpcomingCache(dateStr: string): { fixtures: MatchFixture[]; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`);
    if (!raw) return null;
    const parsed: UpcomingCachePayload = JSON.parse(raw);
    if (!Array.isArray(parsed.fixtures) || parsed.fixtures.length === 0) {
      localStorage.removeItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`);
      return null;
    }
    const age = Date.now() - parsed.timestamp;
    // Invalidate if contains mock IDs or synthetic test matches
    const hasMock = parsed.fixtures.some((f) => {
      const idStr = String(f.id);
      return idStr.startsWith('fix-') || idStr === '991001' || idStr === '991002' || idStr === '991003';
    });
    if (hasMock) {
      localStorage.removeItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`);
      return null;
    }
    if (age < UPCOMING_CACHE_TTL_MS) {
      const activeOnly = parsed.fixtures
        .filter(
          (f) =>
            f.date === dateStr &&
            (f.status === 'SCHEDULED' || f.status === 'IN_PLAY') &&
            !isExcludedYouthOrAmateurLeague(f.league?.name, f.league?.country, f.homeTeam?.name, f.awayTeam?.name)
        )
        .map(sanitizeFixturePlayers);
      if (activeOnly.length > 0) {
        return { fixtures: activeOnly, cachedAt: parsed.timestamp };
      }
    }
  } catch (e) {
    console.warn('Error reading upcoming cache from localStorage', e);
  }
  return null;
}

export function saveLocalUpcomingCache(dateStr: string, fixtures: MatchFixture[]): void {
  try {
    if (!Array.isArray(fixtures) || fixtures.length === 0) return;
    // Only save real fixtures, never mock data or synthetic test fixtures
    const isMock = fixtures.some(f => {
      const idStr = String(f.id);
      return idStr.startsWith('fix-') || idStr === '991001' || idStr === '991002' || idStr === '991003';
    });
    if (isMock) return;

    const payload: UpcomingCachePayload = {
      fixtures: fixtures.map(sanitizeFixturePlayers),
      timestamp: Date.now(),
      dateStr
    };
    localStorage.setItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('Error saving upcoming cache to localStorage', e);
  }
}

export async function fetchUpcomingFixtures(
  dateStr?: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  fixtures: MatchFixture[];
  count: number;
  fromLocalStorage: boolean;
  cachedAt?: number;
  remainingCalls?: number;
  quotaShieldActive?: boolean;
}> {
  const targetDate = dateStr || getColombiaDateString(0);
  const userTz = getUserTimeZone();

  // 1. Check localStorage FIRST if not forcing refresh
  if (!options.forceRefresh) {
    const local = getLocalUpcomingCache(targetDate);
    if (local && Array.isArray(local.fixtures) && local.fixtures.length > 0) {
      return {
        fixtures: sortFixturesByPriority(local.fixtures),
        count: local.fixtures.length,
        fromLocalStorage: true,
        cachedAt: local.cachedAt
      };
    }
  }

  // 2. Fetch from server proxy with official API + ESPN $0 multi-league fallback
  try {
    const forceParam = options.forceRefresh ? '&force=true' : '';
    const url = `/api/upcoming?date=${encodeURIComponent(targetDate)}&tz=${encodeURIComponent(userTz)}${forceParam}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.fixtures) && json.fixtures.length > 0) {
        const mapped: MatchFixture[] = sortFixturesByPriority(
          json.fixtures
            .map((f: unknown) => mapApiSportsFixture(f, targetDate))
            .filter((fix: MatchFixture) => {
              const idStr = String(fix.id);
              if (idStr === '991001' || idStr === '991002' || idStr === '991003') return false;
              if (
                isExcludedYouthOrAmateurLeague(
                  fix.league?.name,
                  fix.league?.country,
                  fix.homeTeam?.name,
                  fix.awayTeam?.name
                )
              ) {
                return false;
              }
              return fix.date === targetDate && (fix.status === 'SCHEDULED' || fix.status === 'IN_PLAY');
            })
        );

        if (mapped.length > 0) {
          saveLocalUpcomingCache(targetDate, mapped);
          return {
            fixtures: mapped,
            count: mapped.length,
            fromLocalStorage: false,
            cachedAt: Date.now(),
            remainingCalls: json.remainingCalls,
            quotaShieldActive: json.quotaShieldActive
          };
        }
      }
    }
  } catch (err) {
    console.warn('FutbolStats Pro: Error al conectar con proxy de partidos próximos', err);
  }

  // 3. Fallback: only if network completely failed and server is unreachable
  const fallback = sortFixturesByPriority(
    generateHighCaliberFixtures(targetDate).filter(f => {
      const idStr = String(f.id);
      return idStr !== '991001' && idStr !== '991002' && idStr !== '991003' && (f.status === 'SCHEDULED' || f.status === 'IN_PLAY');
    })
  );
  return { fixtures: fallback, count: fallback.length, fromLocalStorage: false, cachedAt: Date.now() };
}

/**
 * Fetches strictly FINISHED official matches from Prime Colombian Bookmaker Leagues ($0 API-Football quota)
 * for the Accuracy Evaluator audit dashboard.
 */
export async function fetchCompletedAuditFixtures(): Promise<MatchFixture[]> {
  try {
    const res = await fetch('/api/audit-finished');
    if (!res.ok) return [];
    const json = await res.json();
    if (json.success && Array.isArray(json.fixtures) && json.fixtures.length > 0) {
      const todayStr = getColombiaDateString(0);
      return json.fixtures
        .map((f: unknown) => mapApiSportsFixture(f, todayStr))
        .filter((fix: MatchFixture) => fix.status === 'FINISHED' && fix.currentScore);
    }
  } catch {
    // ignore
  }
  return [];
}

export async function fetchFixturesForDate(dateStr: string): Promise<{ fixtures: MatchFixture[]; meta: CacheMetadata }> {
  const cacheKey = `${CACHE_PREFIX}${dateStr}`;
  const metaKey = `${CACHE_META_PREFIX}${dateStr}`;

  // Step 1: Check localStorage Cache first (0 calls consumed)
  try {
    const cachedData = localStorage.getItem(cacheKey);
    const cachedMeta = localStorage.getItem(metaKey);

    if (cachedData && cachedMeta) {
      const fixtures: MatchFixture[] = JSON.parse(cachedData);
      const meta: CacheMetadata = JSON.parse(cachedMeta);
      if (Array.isArray(fixtures) && fixtures.length > 0) {
        return {
          fixtures: sortFixturesByPriority(fixtures),
          meta: {
            ...meta,
            source: 'cache',
            callsConsumed: 0 // 0 calls consumed on read
          }
        };
      }
    }
  } catch (err) {
    console.warn('FutbolStats Pro: Error al leer cache local', err);
  }

  // Step 2: Secret Server Proxy (Key is 100% hidden on server, never sent to client)
  try {
    const serverProxyRes = await fetch(`/api/fixtures?date=${dateStr}`);
    if (serverProxyRes.ok) {
      const serverJson = await serverProxyRes.json();
      if (serverJson.success && Array.isArray(serverJson.fixtures) && serverJson.fixtures.length > 0) {
        const rawMapped = serverJson.fixtures.slice(0, 30).map((f: unknown) => mapApiSportsFixture(f, dateStr));
        const mappedFixtures = sortFixturesByPriority(rawMapped);
        const meta: CacheMetadata = {
          date: dateStr,
          cachedAt: new Date().toISOString(),
          source: 'api',
          callsConsumed: serverJson.source === 'server_cache' ? 0 : 1,
          remainingCalls: serverJson.remainingCalls ?? 90,
          totalMatches: mappedFixtures.length
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(mappedFixtures));
          localStorage.setItem(metaKey, JSON.stringify(meta));
        } catch {
          // ignore storage error
        }

        return { fixtures: mappedFixtures, meta };
      }
    }
  } catch {
    // server proxy inactive or in offline mode
  }

  // Step 3: Fallback client key if configured
  const apiKey = getStoredApiKey();

  if (apiKey) {
    try {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey
        }
      });

      if (response.ok) {
        const json = await response.json();
        const rawFixtures = json.response;

        if (Array.isArray(rawFixtures) && rawFixtures.length > 0) {
          const rawMapped = rawFixtures.slice(0, 30).map(f => mapApiSportsFixture(f, dateStr));
          const mappedFixtures = sortFixturesByPriority(rawMapped);
          const remaining = parseInt(response.headers.get('x-ratelimit-requests-remaining') || '99', 10);

          const meta: CacheMetadata = {
            date: dateStr,
            cachedAt: new Date().toISOString(),
            source: 'api',
            callsConsumed: 1,
            remainingCalls: isNaN(remaining) ? 99 : remaining,
            totalMatches: mappedFixtures.length
          };

          try {
            localStorage.setItem(cacheKey, JSON.stringify(mappedFixtures));
            localStorage.setItem(metaKey, JSON.stringify(meta));
          } catch {
            // storage quota full fallback
          }

          return { fixtures: mappedFixtures, meta };
        }
      }
    } catch {
      console.info('FutbolStats Pro: API no disponible o cuota superada. Conmutando a nómina de alta fidelidad.');
    }
  }

  // Step 4: High-Caliber Fallback (LaLiga, Premier, Champions, Serie A, Libertadores)
  const rawFallback = generateHighCaliberFixtures(dateStr);
  const fallbackFixtures = sortFixturesByPriority(rawFallback);
  const fallbackMeta: CacheMetadata = {
    date: dateStr,
    cachedAt: new Date().toISOString(),
    source: 'fallback',
    callsConsumed: 0,
    remainingCalls: 100,
    totalMatches: fallbackFixtures.length
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(fallbackFixtures));
    localStorage.setItem(metaKey, JSON.stringify(fallbackMeta));
  } catch {
    // ignore
  }

  return { fixtures: fallbackFixtures, meta: fallbackMeta };
}

export function clearLocalCache(): void {
  try {
    fetch('/api/clear-cache', { method: 'POST' }).catch(() => {});
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_META_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Error al limpiar caché', err);
  }
}

export function getCacheStats(): { datesCached: number; estimatedKb: number } {
  try {
    let datesCached = 0;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        datesCached++;
        const val = localStorage.getItem(key) || '';
        totalBytes += key.length + val.length;
      }
    }
    return { datesCached, estimatedKb: Math.round(totalBytes / 1024) };
  } catch {
    return { datesCached: 0, estimatedKb: 0 };
  }
}

function normalizeClientTeamKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|cd|ud|sd|rcd|fk|pfk|sk|bk|if|ik|sv|vfb|tsg|fsv|club|deportivo|atletico|athletic|real|sporting|unidos|united|city|town|rovers|wanderers|al|el|de|del|la|las|los|sad|baku|jeddah|riyadh)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function clientSingleTeamMatch(k1: string, k2: string): boolean {
  if (!k1 || !k2) return false;
  if (k1 === k2 || k1.includes(k2) || k2.includes(k1)) return true;
  if (k1.length >= 5 && k2.length >= 5 && k1.slice(0, 5) === k2.slice(0, 5)) return true;
  return false;
}

export interface LivePulseSyncResult {
  updatedFixtures: MatchFixture[];
  changedIds: string[];
  scoreChangedIds: string[];
  liveCount: number;
  syncedAt: number;
}

/**
 * Polls /api/live-pulse (45-second hybrid live engine, 0 API-Football quota cost)
 * and merges any live score, minute, stats, or play-by-play event changes into the current fixtures list.
 */
export async function syncLivePulseFixtures(
  dateStr: string,
  currentFixtures: MatchFixture[]
): Promise<LivePulseSyncResult> {
  if (!Array.isArray(currentFixtures) || currentFixtures.length === 0) {
    return { updatedFixtures: currentFixtures, changedIds: [], scoreChangedIds: [], liveCount: 0, syncedAt: Date.now() };
  }

  try {
    const res = await fetch(`/api/live-pulse?date=${encodeURIComponent(dateStr)}`);
    if (!res.ok) {
      return { updatedFixtures: currentFixtures, changedIds: [], scoreChangedIds: [], liveCount: 0, syncedAt: Date.now() };
    }
    const json = await res.json();
    const deltas: Array<{
      id?: string;
      espnEventId?: string;
      homeKey: string;
      awayKey: string;
      homeScore: number;
      awayScore: number;
      minute: number;
      isHalfTime?: boolean;
      statusShort?: string;
      status: 'IN_PLAY' | 'FINISHED' | 'SCHEDULED';
      liveStats?: RealMatchStats;
      liveEvents?: TimelineEventItem[];
      liveRosters?: RealMatchRosters;
    }> = Array.isArray(json.deltas) ? json.deltas : [];

    const changedIds: string[] = [];
    const scoreChangedIds: string[] = [];
    let liveCount = 0;

    const updatedFixtures = currentFixtures.map((fix) => {
      const hKey = normalizeClientTeamKey(fix.homeTeam.name);
      const aKey = normalizeClientTeamKey(fix.awayTeam.name);

      const delta = deltas.find(
        (d) =>
          (d.id && String(d.id) === String(fix.id)) ||
          (d.espnEventId && fix.espnEventId && String(d.espnEventId) === String(fix.espnEventId)) ||
          (d.homeKey &&
            d.awayKey &&
            hKey &&
            aKey &&
            clientSingleTeamMatch(d.homeKey, hKey) &&
            clientSingleTeamMatch(d.awayKey, aKey))
      );

      if (delta) {
        const prevHome = fix.currentScore?.home ?? 0;
        const prevAway = fix.currentScore?.away ?? 0;
        const prevMin = fix.currentScore?.minute ?? 0;
        const prevHT = Boolean(fix.currentScore?.isHalfTime);
        const nextHT = Boolean(delta.isHalfTime || delta.statusShort === 'HT');
        const prevStatus = fix.status;

        const prevCorners =
          (fix.liveStats?.home.corners ?? -1) + (fix.liveStats?.away.corners ?? -1);
        const nextCorners =
          (delta.liveStats?.home.corners ?? prevCorners) + (delta.liveStats?.away.corners ?? 0);

        const prevCards =
          (fix.liveStats?.home.yellowCards ?? -1) +
          (fix.liveStats?.away.yellowCards ?? -1) +
          (fix.liveStats?.home.redCards ?? 0) +
          (fix.liveStats?.away.redCards ?? 0);
        const nextCards =
          (delta.liveStats?.home.yellowCards ?? prevCards) +
          (delta.liveStats?.away.yellowCards ?? 0) +
          (delta.liveStats?.home.redCards ?? 0) +
          (delta.liveStats?.away.redCards ?? 0);

        const nextStatus = delta.status === 'IN_PLAY' ? 'IN_PLAY' : delta.status === 'FINISHED' ? 'FINISHED' : fix.status;
        if (nextStatus === 'IN_PLAY') liveCount++;

        const statsUpdated =
          (delta.liveStats && !fix.liveStats) ||
          (delta.liveStats && (prevCorners !== nextCorners || prevCards !== nextCards)) ||
          (Array.isArray(delta.liveEvents) && delta.liveEvents.length !== (fix.liveEvents?.length ?? 0));

        // Detect if the scoreboard actually moved (goals scored)
        const isActualScoreChange = prevHome !== delta.homeScore || prevAway !== delta.awayScore;
        if (isActualScoreChange) {
          scoreChangedIds.push(fix.id);
        }

        if (
          isActualScoreChange ||
          prevMin !== delta.minute ||
          prevHT !== nextHT ||
          prevStatus !== nextStatus ||
          statsUpdated
        ) {
          changedIds.push(fix.id);
          return sanitizeFixturePlayers({
            ...fix,
            espnEventId: delta.espnEventId || fix.espnEventId,
            status: nextStatus,
            currentScore: {
              home: delta.homeScore,
              away: delta.awayScore,
              minute: nextHT ? 45 : delta.minute,
              isHalfTime: nextHT,
              statusShort: delta.statusShort || (nextHT ? 'HT' : '2H')
            },
            liveStats: delta.liveStats || fix.liveStats,
            liveEvents: Array.isArray(delta.liveEvents) && delta.liveEvents.length > 0 ? delta.liveEvents : fix.liveEvents,
            liveRosters: delta.liveRosters || fix.liveRosters
          });
        }
      } else if (fix.status === 'IN_PLAY' && fix.currentScore) {
        liveCount++;
      }

      return fix;
    });

    if (changedIds.length > 0) {
      saveLocalUpcomingCache(dateStr, updatedFixtures);
    }

    return {
      updatedFixtures,
      changedIds,
      scoreChangedIds,
      liveCount,
      syncedAt: Date.now()
    };
  } catch {
    return { updatedFixtures: currentFixtures, changedIds: [], scoreChangedIds: [], liveCount: 0, syncedAt: Date.now() };
  }
}

/**
 * Fetches deep real-time match telemetry (exact corners, yellow/red cards, play-by-play timeline, and official rosters)
 * for a specific match at $0 quota cost.
 */
export async function fetchMatchLiveTelemetry(fixture: MatchFixture): Promise<{
  liveStats?: RealMatchStats;
  liveEvents?: TimelineEventItem[];
  liveRosters?: RealMatchRosters;
  espnEventId?: string;
  homeGoals?: number;
  awayGoals?: number;
  minute?: number;
  isHalfTime?: boolean;
  statusShort?: string;
} | null> {
  try {
    const params = new URLSearchParams({
      id: String(fixture.id),
      date: fixture.date,
      home: fixture.homeTeam.name,
      away: fixture.awayTeam.name
    });
    if (fixture.espnEventId) {
      params.set('espnId', fixture.espnEventId);
      params.set('eventId', fixture.espnEventId);
    }
    const res = await fetch(`/api/match-telemetry?${params.toString()}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && (json.found || json.liveStats || json.liveEvents || json.liveRosters)) {
      return {
        espnEventId: json.espnEventId,
        liveStats: json.liveStats,
        liveEvents: json.liveEvents,
        liveRosters: json.liveRosters,
        homeGoals: typeof json.homeGoals === 'number' ? json.homeGoals : undefined,
        awayGoals: typeof json.awayGoals === 'number' ? json.awayGoals : undefined,
        minute: typeof json.minute === 'number' ? json.minute : undefined,
        isHalfTime: Boolean(json.isHalfTime || json.statusShort === 'HT'),
        statusShort: json.statusShort
      };
    }
  } catch {
    // ignore network error
  }
  return null;
}


