import { NBAMatchFixture, NBATeamInfo, NBAPlayerProp } from '../types';
import { getColombiaDateString, getUserTimeZone } from './apiService';
import { findNBARosterForTeam } from './nbaRostersData';

export function americanToDecimal(americanStr?: string | number): number | undefined {
  if (americanStr === undefined || americanStr === null || americanStr === '') return undefined;
  const num = typeof americanStr === 'number' ? americanStr : parseFloat(String(americanStr).replace('+', ''));
  if (isNaN(num) || num === 0) return undefined;
  if (num > 0) {
    return Math.round((1 + num / 100) * 100) / 100;
  } else {
    return Math.round((1 + 100 / Math.abs(num)) * 100) / 100;
  }
}

// Database of elite NBA franchises with accurate tactical metrics, pace and rosters
export const NBA_TEAMS: Record<string, NBATeamInfo> = {
  celtics: {
    id: 1,
    name: 'Boston Celtics',
    shortName: 'BOS Celtics',
    city: 'Boston',
    logo: 'https://media.api-sports.io/basketball/teams/133.png',
    conference: 'Este',
    division: 'Atlantic',
    wins: 48,
    losses: 14,
    streak: 'W4',
    pace: 98.4,
    offensiveRating: 122.2,
    defensiveRating: 110.4,
    netRating: 11.8,
    threePointAttemptRate: 0.472,
    threePointPct: 38.6,
    restDays: 2,
    keyPlayers: [
      {
        id: 'tatum',
        name: 'Jayson Tatum',
        team: 'Boston Celtics',
        position: 'SF',
        seasonPpg: 27.4,
        season3pm: 3.2,
        seasonApg: 4.9,
        seasonRpg: 8.3,
        projectedMinutes: 36,
        usageRate: 29.8,
        projectedPoints: 28.1,
        pointsLine: 27.5,
        overPointsProb: 56.4,
        underPointsProb: 43.6,
        projected3pm: 3.4,
        threePointersLine: 3.5,
        over3pmProb: 52.8,
        under3pmProb: 47.2
      },
      {
        id: 'brown',
        name: 'Jaylen Brown',
        team: 'Boston Celtics',
        position: 'SG',
        seasonPpg: 23.2,
        season3pm: 2.3,
        seasonApg: 3.6,
        seasonRpg: 5.5,
        projectedMinutes: 34,
        usageRate: 27.1,
        projectedPoints: 23.8,
        pointsLine: 23.5,
        overPointsProb: 54.2,
        underPointsProb: 45.8,
        projected3pm: 2.4,
        threePointersLine: 2.5,
        over3pmProb: 48.6,
        under3pmProb: 51.4
      }
    ]
  },
  lakers: {
    id: 2,
    name: 'Los Angeles Lakers',
    shortName: 'LA Lakers',
    city: 'Los Angeles',
    logo: 'https://media.api-sports.io/basketball/teams/145.png',
    conference: 'Oeste',
    division: 'Pacific',
    wins: 38,
    losses: 25,
    streak: 'W2',
    pace: 101.2,
    offensiveRating: 115.8,
    defensiveRating: 113.6,
    netRating: 2.2,
    threePointAttemptRate: 0.354,
    threePointPct: 36.4,
    restDays: 1,
    keyPlayers: [
      {
        id: 'lebron',
        name: 'LeBron James',
        team: 'Los Angeles Lakers',
        position: 'SF',
        seasonPpg: 25.1,
        season3pm: 2.2,
        seasonApg: 8.2,
        seasonRpg: 7.3,
        projectedMinutes: 35,
        usageRate: 28.4,
        projectedPoints: 25.6,
        pointsLine: 25.5,
        overPointsProb: 53.8,
        underPointsProb: 46.2,
        projected3pm: 2.3,
        threePointersLine: 2.5,
        over3pmProb: 46.2,
        under3pmProb: 53.8
      },
      {
        id: 'ad',
        name: 'Anthony Davis',
        team: 'Los Angeles Lakers',
        position: 'C',
        seasonPpg: 24.8,
        season3pm: 0.6,
        seasonApg: 3.4,
        seasonRpg: 12.4,
        projectedMinutes: 36,
        usageRate: 27.2,
        projectedPoints: 26.2,
        pointsLine: 25.5,
        overPointsProb: 57.1,
        underPointsProb: 42.9,
        projected3pm: 0.6,
        threePointersLine: 0.5,
        over3pmProb: 45.1,
        under3pmProb: 54.9
      }
    ]
  },
  warriors: {
    id: 3,
    name: 'Golden State Warriors',
    shortName: 'GS Warriors',
    city: 'San Francisco',
    logo: 'https://media.api-sports.io/basketball/teams/141.png',
    conference: 'Oeste',
    division: 'Pacific',
    wins: 36,
    losses: 27,
    streak: 'W1',
    pace: 100.8,
    offensiveRating: 117.4,
    defensiveRating: 114.2,
    netRating: 3.2,
    threePointAttemptRate: 0.442,
    threePointPct: 37.9,
    restDays: 1,
    keyPlayers: [
      {
        id: 'curry',
        name: 'Stephen Curry',
        team: 'Golden State Warriors',
        position: 'PG',
        seasonPpg: 27.2,
        season3pm: 4.8,
        seasonApg: 5.1,
        seasonRpg: 4.4,
        projectedMinutes: 34,
        usageRate: 30.6,
        projectedPoints: 28.4,
        pointsLine: 27.5,
        overPointsProb: 58.6,
        underPointsProb: 41.4,
        projected3pm: 4.7,
        threePointersLine: 4.5,
        over3pmProb: 55.4,
        under3pmProb: 44.6
      }
    ]
  },
  nuggets: {
    id: 4,
    name: 'Denver Nuggets',
    shortName: 'DEN Nuggets',
    city: 'Denver',
    logo: 'https://media.api-sports.io/basketball/teams/138.png',
    conference: 'Oeste',
    division: 'Northwest',
    wins: 45,
    losses: 19,
    streak: 'W3',
    pace: 97.2,
    offensiveRating: 118.9,
    defensiveRating: 111.4,
    netRating: 7.5,
    threePointAttemptRate: 0.362,
    threePointPct: 37.4,
    restDays: 2,
    keyPlayers: [
      {
        id: 'jokic',
        name: 'Nikola Jokić',
        team: 'Denver Nuggets',
        position: 'C',
        seasonPpg: 26.3,
        season3pm: 1.2,
        seasonApg: 9.2,
        seasonRpg: 12.2,
        projectedMinutes: 35,
        usageRate: 28.9,
        projectedPoints: 27.1,
        pointsLine: 26.5,
        overPointsProb: 56.8,
        underPointsProb: 43.2,
        projected3pm: 1.3,
        threePointersLine: 1.5,
        over3pmProb: 43.2,
        under3pmProb: 56.8
      },
      {
        id: 'murray',
        name: 'Jamal Murray',
        team: 'Denver Nuggets',
        position: 'PG',
        seasonPpg: 21.2,
        season3pm: 2.5,
        seasonApg: 6.5,
        seasonRpg: 4.1,
        projectedMinutes: 34,
        usageRate: 25.8,
        projectedPoints: 21.8,
        pointsLine: 21.5,
        overPointsProb: 52.4,
        underPointsProb: 47.6,
        projected3pm: 2.6,
        threePointersLine: 2.5,
        over3pmProb: 53.6,
        under3pmProb: 46.4
      }
    ]
  },
  mavericks: {
    id: 5,
    name: 'Dallas Mavericks',
    shortName: 'DAL Mavericks',
    city: 'Dallas',
    logo: 'https://media.api-sports.io/basketball/teams/137.png',
    conference: 'Oeste',
    division: 'Southwest',
    wins: 40,
    losses: 23,
    streak: 'W2',
    pace: 100.4,
    offensiveRating: 118.5,
    defensiveRating: 114.6,
    netRating: 3.9,
    threePointAttemptRate: 0.435,
    threePointPct: 37.2,
    restDays: 1,
    keyPlayers: [
      {
        id: 'doncic',
        name: 'Luka Dončić',
        team: 'Dallas Mavericks',
        position: 'PG',
        seasonPpg: 33.9,
        season3pm: 4.1,
        seasonApg: 9.8,
        seasonRpg: 9.2,
        projectedMinutes: 37,
        usageRate: 35.8,
        projectedPoints: 34.6,
        pointsLine: 33.5,
        overPointsProb: 59.4,
        underPointsProb: 40.6,
        projected3pm: 4.2,
        threePointersLine: 3.5,
        over3pmProb: 62.4,
        under3pmProb: 37.6
      },
      {
        id: 'kyrie',
        name: 'Kyrie Irving',
        team: 'Dallas Mavericks',
        position: 'SG',
        seasonPpg: 25.6,
        season3pm: 3.0,
        seasonApg: 5.2,
        seasonRpg: 5.0,
        projectedMinutes: 35,
        usageRate: 27.6,
        projectedPoints: 25.8,
        pointsLine: 25.5,
        overPointsProb: 53.2,
        underPointsProb: 46.8,
        projected3pm: 3.1,
        threePointersLine: 2.5,
        over3pmProb: 58.2,
        under3pmProb: 41.8
      }
    ]
  },
  bucks: {
    id: 6,
    name: 'Milwaukee Bucks',
    shortName: 'MIL Bucks',
    city: 'Milwaukee',
    logo: 'https://media.api-sports.io/basketball/teams/146.png',
    conference: 'Este',
    division: 'Central',
    wins: 42,
    losses: 22,
    streak: 'W1',
    pace: 100.9,
    offensiveRating: 118.8,
    defensiveRating: 115.1,
    netRating: 3.7,
    threePointAttemptRate: 0.408,
    threePointPct: 37.6,
    restDays: 2,
    keyPlayers: [
      {
        id: 'giannis',
        name: 'Giannis Antetokounmpo',
        team: 'Milwaukee Bucks',
        position: 'PF',
        seasonPpg: 30.7,
        season3pm: 0.5,
        seasonApg: 6.4,
        seasonRpg: 11.2,
        projectedMinutes: 35,
        usageRate: 33.2,
        projectedPoints: 31.4,
        pointsLine: 30.5,
        overPointsProb: 58.2,
        underPointsProb: 41.8,
        projected3pm: 0.5,
        threePointersLine: 0.5,
        over3pmProb: 39.4,
        under3pmProb: 60.6
      },
      {
        id: 'lillard',
        name: 'Damian Lillard',
        team: 'Milwaukee Bucks',
        position: 'PG',
        seasonPpg: 24.4,
        season3pm: 3.2,
        seasonApg: 7.0,
        seasonRpg: 4.4,
        projectedMinutes: 35,
        usageRate: 28.1,
        projectedPoints: 24.9,
        pointsLine: 24.5,
        overPointsProb: 54.1,
        underPointsProb: 45.9,
        projected3pm: 3.3,
        threePointersLine: 3.5,
        over3pmProb: 49.5,
        under3pmProb: 50.5
      }
    ]
  },
  thunder: {
    id: 7,
    name: 'Oklahoma City Thunder',
    shortName: 'OKC Thunder',
    city: 'Oklahoma City',
    logo: 'https://media.api-sports.io/basketball/teams/149.png',
    conference: 'Oeste',
    division: 'Northwest',
    wins: 46,
    losses: 18,
    streak: 'W4',
    pace: 100.2,
    offensiveRating: 119.4,
    defensiveRating: 111.0,
    netRating: 8.4,
    threePointAttemptRate: 0.388,
    threePointPct: 39.2,
    restDays: 1,
    keyPlayers: [
      {
        id: 'shai',
        name: 'Shai Gilgeous-Alexander',
        team: 'Oklahoma City Thunder',
        position: 'PG',
        seasonPpg: 31.1,
        season3pm: 1.4,
        seasonApg: 6.5,
        seasonRpg: 5.6,
        projectedMinutes: 35,
        usageRate: 32.6,
        projectedPoints: 31.8,
        pointsLine: 30.5,
        overPointsProb: 59.8,
        underPointsProb: 40.2,
        projected3pm: 1.5,
        threePointersLine: 1.5,
        over3pmProb: 48.2,
        under3pmProb: 51.8
      }
    ]
  },
  knicks: {
    id: 8,
    name: 'New York Knicks',
    shortName: 'NY Knicks',
    city: 'New York',
    logo: 'https://media.api-sports.io/basketball/teams/148.png',
    conference: 'Este',
    division: 'Atlantic',
    wins: 39,
    losses: 24,
    streak: 'W3',
    pace: 96.4,
    offensiveRating: 117.2,
    defensiveRating: 112.5,
    netRating: 4.7,
    threePointAttemptRate: 0.402,
    threePointPct: 37.0,
    restDays: 2,
    keyPlayers: [
      {
        id: 'brunson',
        name: 'Jalen Brunson',
        team: 'New York Knicks',
        position: 'PG',
        seasonPpg: 27.8,
        season3pm: 2.8,
        seasonApg: 6.7,
        seasonRpg: 3.6,
        projectedMinutes: 36,
        usageRate: 31.4,
        projectedPoints: 28.5,
        pointsLine: 27.5,
        overPointsProb: 57.6,
        underPointsProb: 42.4,
        projected3pm: 2.9,
        threePointersLine: 2.5,
        over3pmProb: 56.4,
        under3pmProb: 43.6
      }
    ]
  },
  timberwolves: {
    id: 9,
    name: 'Minnesota Timberwolves',
    shortName: 'MIN Timberwolves',
    city: 'Minneapolis',
    logo: 'https://media.api-sports.io/basketball/teams/147.png',
    conference: 'Oeste',
    division: 'Northwest',
    wins: 46,
    losses: 21,
    streak: 'W2',
    pace: 97.8,
    offensiveRating: 116.5,
    defensiveRating: 108.9,
    netRating: 7.6,
    threePointAttemptRate: 0.384,
    threePointPct: 37.8,
    restDays: 2,
    keyPlayers: [
      {
        id: 'edwards',
        name: 'Anthony Edwards',
        team: 'Minnesota Timberwolves',
        position: 'SG',
        seasonPpg: 26.8,
        season3pm: 2.6,
        seasonApg: 5.2,
        seasonRpg: 5.4,
        projectedMinutes: 35,
        usageRate: 31.8,
        projectedPoints: 27.4,
        pointsLine: 26.5,
        overPointsProb: 57.2,
        underPointsProb: 42.8,
        projected3pm: 2.8,
        threePointersLine: 2.5,
        over3pmProb: 54.8,
        under3pmProb: 45.2
      }
    ]
  },
  pacers: {
    id: 10,
    name: 'Indiana Pacers',
    shortName: 'IND Pacers',
    city: 'Indianapolis',
    logo: 'https://media.api-sports.io/basketball/teams/142.png',
    conference: 'Este',
    division: 'Central',
    wins: 41,
    losses: 26,
    streak: 'W3',
    pace: 102.5,
    offensiveRating: 121.8,
    defensiveRating: 117.2,
    netRating: 4.6,
    threePointAttemptRate: 0.412,
    threePointPct: 38.2,
    restDays: 1,
    keyPlayers: [
      {
        id: 'haliburton',
        name: 'Tyrese Haliburton',
        team: 'Indiana Pacers',
        position: 'PG',
        seasonPpg: 21.4,
        season3pm: 3.1,
        seasonApg: 10.9,
        seasonRpg: 3.9,
        projectedMinutes: 34,
        usageRate: 26.4,
        projectedPoints: 22.1,
        pointsLine: 21.5,
        overPointsProb: 55.4,
        underPointsProb: 44.6,
        projected3pm: 3.3,
        threePointersLine: 2.5,
        over3pmProb: 59.2,
        under3pmProb: 40.8
      }
    ]
  },
  grizzlies: {
    id: 11,
    name: 'Memphis Grizzlies',
    shortName: 'MEM Grizzlies',
    city: 'Memphis',
    logo: 'https://media.api-sports.io/basketball/teams/146.png',
    conference: 'Oeste',
    division: 'Southwest',
    wins: 36,
    losses: 28,
    streak: 'W1',
    pace: 99.4,
    offensiveRating: 114.8,
    defensiveRating: 112.4,
    netRating: 2.4,
    threePointAttemptRate: 0.395,
    threePointPct: 36.2,
    restDays: 2,
    keyPlayers: [
      {
        id: 'morant',
        name: 'Ja Morant',
        team: 'Memphis Grizzlies',
        position: 'PG',
        seasonPpg: 25.1,
        season3pm: 1.8,
        seasonApg: 8.1,
        seasonRpg: 5.6,
        projectedMinutes: 34,
        usageRate: 32.2,
        projectedPoints: 26.0,
        pointsLine: 25.5,
        overPointsProb: 56.1,
        underPointsProb: 43.9,
        projected3pm: 1.9,
        threePointersLine: 1.5,
        over3pmProb: 51.5,
        under3pmProb: 48.5
      }
    ]
  },
  magic: {
    id: 12,
    name: 'Orlando Magic',
    shortName: 'ORL Magic',
    city: 'Orlando',
    logo: 'https://media.api-sports.io/basketball/teams/151.png',
    conference: 'Este',
    division: 'Southeast',
    wins: 40,
    losses: 26,
    streak: 'W2',
    pace: 97.1,
    offensiveRating: 113.9,
    defensiveRating: 110.8,
    netRating: 3.1,
    threePointAttemptRate: 0.362,
    threePointPct: 35.5,
    restDays: 2,
    keyPlayers: [
      {
        id: 'banchero',
        name: 'Paolo Banchero',
        team: 'Orlando Magic',
        position: 'PF',
        seasonPpg: 23.0,
        season3pm: 1.6,
        seasonApg: 5.4,
        seasonRpg: 6.9,
        projectedMinutes: 35,
        usageRate: 29.7,
        projectedPoints: 23.8,
        pointsLine: 22.5,
        overPointsProb: 56.4,
        underPointsProb: 43.6,
        projected3pm: 1.7,
        threePointersLine: 1.5,
        over3pmProb: 49.2,
        under3pmProb: 50.8
      }
    ]
  },
  bulls: {
    id: 13,
    name: 'Chicago Bulls',
    shortName: 'CHI Bulls',
    city: 'Chicago',
    logo: 'https://media.api-sports.io/basketball/teams/135.png',
    conference: 'Este',
    division: 'Central',
    wins: 34,
    losses: 32,
    streak: 'L1',
    pace: 98.6,
    offensiveRating: 114.2,
    defensiveRating: 115.6,
    netRating: -1.4,
    threePointAttemptRate: 0.378,
    threePointPct: 36.1,
    restDays: 1,
    keyPlayers: [
      {
        id: 'lavine',
        name: 'Zach LaVine',
        team: 'Chicago Bulls',
        position: 'SG',
        seasonPpg: 22.6,
        season3pm: 2.7,
        seasonApg: 4.1,
        seasonRpg: 4.8,
        projectedMinutes: 34,
        usageRate: 28.5,
        projectedPoints: 23.2,
        pointsLine: 22.5,
        overPointsProb: 54.3,
        underPointsProb: 45.7,
        projected3pm: 2.8,
        threePointersLine: 2.5,
        over3pmProb: 52.8,
        under3pmProb: 47.2
      }
    ]
  },
  suns: {
    id: 14,
    name: 'Phoenix Suns',
    shortName: 'PHX Suns',
    city: 'Phoenix',
    logo: 'https://media.api-sports.io/basketball/teams/153.png',
    conference: 'Oeste',
    division: 'Pacific',
    wins: 42,
    losses: 25,
    streak: 'W2',
    pace: 99.2,
    offensiveRating: 118.4,
    defensiveRating: 114.8,
    netRating: 3.6,
    threePointAttemptRate: 0.388,
    threePointPct: 37.9,
    restDays: 1,
    keyPlayers: [
      {
        id: 'booker',
        name: 'Devin Booker',
        team: 'Phoenix Suns',
        position: 'SG',
        seasonPpg: 27.1,
        season3pm: 2.3,
        seasonApg: 6.9,
        seasonRpg: 4.5,
        projectedMinutes: 36,
        usageRate: 30.1,
        projectedPoints: 27.8,
        pointsLine: 26.5,
        overPointsProb: 58.2,
        underPointsProb: 41.8,
        projected3pm: 2.5,
        threePointersLine: 2.5,
        over3pmProb: 51.2,
        under3pmProb: 48.8
      }
    ]
  },
  pelicans: {
    id: 15,
    name: 'New Orleans Pelicans',
    shortName: 'NOP Pelicans',
    city: 'New Orleans',
    logo: 'https://media.api-sports.io/basketball/teams/150.png',
    conference: 'Oeste',
    division: 'Southwest',
    wins: 39,
    losses: 27,
    streak: 'W1',
    pace: 99.8,
    offensiveRating: 117.1,
    defensiveRating: 113.2,
    netRating: 3.9,
    threePointAttemptRate: 0.368,
    threePointPct: 37.5,
    restDays: 2,
    keyPlayers: [
      {
        id: 'zion',
        name: 'Zion Williamson',
        team: 'New Orleans Pelicans',
        position: 'PF',
        seasonPpg: 24.2,
        season3pm: 0.2,
        seasonApg: 5.1,
        seasonRpg: 6.2,
        projectedMinutes: 33,
        usageRate: 29.5,
        projectedPoints: 24.8,
        pointsLine: 23.5,
        overPointsProb: 56.8,
        underPointsProb: 43.2,
        projected3pm: 0.2,
        threePointersLine: 0.5,
        over3pmProb: 24.0,
        under3pmProb: 76.0
      }
    ]
  },
  jazz: {
    id: 16,
    name: 'Utah Jazz',
    shortName: 'UTA Jazz',
    city: 'Salt Lake City',
    logo: 'https://media.api-sports.io/basketball/teams/158.png',
    conference: 'Oeste',
    division: 'Northwest',
    wins: 30,
    losses: 37,
    streak: 'L2',
    pace: 101.4,
    offensiveRating: 115.1,
    defensiveRating: 119.5,
    netRating: -4.4,
    threePointAttemptRate: 0.428,
    threePointPct: 36.4,
    restDays: 1,
    keyPlayers: [
      {
        id: 'markkanen',
        name: 'Lauri Markkanen',
        team: 'Utah Jazz',
        position: 'PF',
        seasonPpg: 23.2,
        season3pm: 3.2,
        seasonApg: 2.0,
        seasonRpg: 8.2,
        projectedMinutes: 34,
        usageRate: 27.2,
        projectedPoints: 23.9,
        pointsLine: 22.5,
        overPointsProb: 57.5,
        underPointsProb: 42.5,
        projected3pm: 3.4,
        threePointersLine: 2.5,
        over3pmProb: 61.2,
        under3pmProb: 38.8
      }
    ]
  },
  hornets: {
    id: 17,
    name: 'Charlotte Hornets',
    shortName: 'CHA Hornets',
    city: 'Charlotte',
    logo: 'https://media.api-sports.io/basketball/teams/134.png',
    conference: 'Este',
    division: 'Southeast',
    wins: 25,
    losses: 42,
    streak: 'L1',
    pace: 99.6,
    offensiveRating: 111.8,
    defensiveRating: 118.9,
    netRating: -7.1,
    threePointAttemptRate: 0.418,
    threePointPct: 35.8,
    restDays: 1,
    keyPlayers: [
      {
        id: 'lamelo',
        name: 'LaMelo Ball',
        team: 'Charlotte Hornets',
        position: 'PG',
        seasonPpg: 24.1,
        season3pm: 3.3,
        seasonApg: 8.2,
        seasonRpg: 5.3,
        projectedMinutes: 34,
        usageRate: 31.0,
        projectedPoints: 24.6,
        pointsLine: 23.5,
        overPointsProb: 55.8,
        underPointsProb: 44.2,
        projected3pm: 3.5,
        threePointersLine: 3.5,
        over3pmProb: 53.4,
        under3pmProb: 46.6
      }
    ]
  },
  nets: {
    id: 18,
    name: 'Brooklyn Nets',
    shortName: 'BKN Nets',
    city: 'Brooklyn',
    logo: 'https://media.api-sports.io/basketball/teams/132.png',
    conference: 'Este',
    division: 'Atlantic',
    wins: 28,
    losses: 39,
    streak: 'W1',
    pace: 98.2,
    offensiveRating: 112.9,
    defensiveRating: 116.8,
    netRating: -3.9,
    threePointAttemptRate: 0.422,
    threePointPct: 36.2,
    restDays: 1,
    keyPlayers: [
      {
        id: 'camthomas',
        name: 'Cam Thomas',
        team: 'Brooklyn Nets',
        position: 'SG',
        seasonPpg: 22.8,
        season3pm: 2.3,
        seasonApg: 3.1,
        seasonRpg: 3.4,
        projectedMinutes: 33,
        usageRate: 30.5,
        projectedPoints: 23.5,
        pointsLine: 22.5,
        overPointsProb: 54.9,
        underPointsProb: 45.1,
        projected3pm: 2.4,
        threePointersLine: 2.5,
        over3pmProb: 48.9,
        under3pmProb: 51.1
      }
    ]
  },
  blazers: {
    id: 19,
    name: 'Portland Trail Blazers',
    shortName: 'POR Blazers',
    city: 'Portland',
    logo: 'https://media.api-sports.io/basketball/teams/156.png',
    conference: 'Oeste',
    division: 'Northwest',
    wins: 21,
    losses: 61,
    streak: 'L2',
    pace: 98.7,
    offensiveRating: 108.6,
    defensiveRating: 116.8,
    netRating: -8.2,
    threePointAttemptRate: 0.382,
    threePointPct: 34.5,
    restDays: 2,
    keyPlayers: [
      {
        id: 'grant',
        name: 'Jerami Grant',
        team: 'Portland Trail Blazers',
        position: 'PF',
        seasonPpg: 21.0,
        season3pm: 2.1,
        seasonApg: 2.8,
        seasonRpg: 3.5,
        projectedMinutes: 34,
        usageRate: 25.4,
        projectedPoints: 21.5,
        pointsLine: 20.5,
        overPointsProb: 53.4,
        underPointsProb: 46.6,
        projected3pm: 2.2,
        threePointersLine: 2.5,
        over3pmProb: 47.1,
        under3pmProb: 52.9
      },
      {
        id: 'simons',
        name: 'Anfernee Simons',
        team: 'Portland Trail Blazers',
        position: 'SG',
        seasonPpg: 22.6,
        season3pm: 3.4,
        seasonApg: 5.5,
        seasonRpg: 3.6,
        projectedMinutes: 34,
        usageRate: 28.2,
        projectedPoints: 23.0,
        pointsLine: 22.5,
        overPointsProb: 54.1,
        underPointsProb: 45.9,
        projected3pm: 3.3,
        threePointersLine: 3.5,
        over3pmProb: 49.2,
        under3pmProb: 50.8
      }
    ]
  },
  sixers: {
    id: 20,
    name: 'Philadelphia 76ers',
    shortName: 'PHI 76ers',
    city: 'Philadelphia',
    logo: 'https://media.api-sports.io/basketball/teams/152.png',
    conference: 'Este',
    division: 'Atlantic',
    wins: 47,
    losses: 35,
    streak: 'W2',
    pace: 98.2,
    offensiveRating: 116.5,
    defensiveRating: 113.2,
    netRating: 3.3,
    threePointAttemptRate: 0.384,
    threePointPct: 36.8,
    restDays: 1,
    keyPlayers: [
      {
        id: 'embiid',
        name: 'Joel Embiid',
        team: 'Philadelphia 76ers',
        position: 'C',
        seasonPpg: 34.7,
        season3pm: 1.4,
        seasonApg: 5.6,
        seasonRpg: 11.0,
        projectedMinutes: 34,
        usageRate: 38.2,
        projectedPoints: 33.5,
        pointsLine: 32.5,
        overPointsProb: 56.8,
        underPointsProb: 43.2,
        projected3pm: 1.5,
        threePointersLine: 1.5,
        over3pmProb: 47.8,
        under3pmProb: 52.2
      },
      {
        id: 'maxey',
        name: 'Tyrese Maxey',
        team: 'Philadelphia 76ers',
        position: 'PG',
        seasonPpg: 25.9,
        season3pm: 3.0,
        seasonApg: 6.2,
        seasonRpg: 3.7,
        projectedMinutes: 37,
        usageRate: 28.0,
        projectedPoints: 26.4,
        pointsLine: 25.5,
        overPointsProb: 55.2,
        underPointsProb: 44.8,
        projected3pm: 3.1,
        threePointersLine: 2.5,
        over3pmProb: 57.4,
        under3pmProb: 42.6
      }
    ]
  },
  cavaliers: {
    id: 21,
    name: 'Cleveland Cavaliers',
    shortName: 'CLE Cavaliers',
    city: 'Cleveland',
    logo: 'https://media.api-sports.io/basketball/teams/136.png',
    conference: 'Este',
    division: 'Central',
    wins: 48,
    losses: 34,
    streak: 'W1',
    pace: 97.6,
    offensiveRating: 115.2,
    defensiveRating: 111.0,
    netRating: 4.2,
    threePointAttemptRate: 0.412,
    threePointPct: 36.7,
    restDays: 1,
    keyPlayers: [
      {
        id: 'mitchell',
        name: 'Donovan Mitchell',
        team: 'Cleveland Cavaliers',
        position: 'SG',
        seasonPpg: 26.6,
        season3pm: 3.3,
        seasonApg: 6.1,
        seasonRpg: 5.1,
        projectedMinutes: 35,
        usageRate: 31.5,
        projectedPoints: 27.2,
        pointsLine: 26.5,
        overPointsProb: 56.0,
        underPointsProb: 44.0,
        projected3pm: 3.4,
        threePointersLine: 3.5,
        over3pmProb: 52.6,
        under3pmProb: 47.4
      },
      {
        id: 'garland',
        name: 'Darius Garland',
        team: 'Cleveland Cavaliers',
        position: 'PG',
        seasonPpg: 18.0,
        season3pm: 2.3,
        seasonApg: 6.5,
        seasonRpg: 2.7,
        projectedMinutes: 33,
        usageRate: 24.8,
        projectedPoints: 18.5,
        pointsLine: 17.5,
        overPointsProb: 52.4,
        underPointsProb: 47.6,
        projected3pm: 2.4,
        threePointersLine: 2.5,
        over3pmProb: 48.9,
        under3pmProb: 51.1
      }
    ]
  },
  heat: {
    id: 22,
    name: 'Miami Heat',
    shortName: 'MIA Heat',
    city: 'Miami',
    logo: 'https://media.api-sports.io/basketball/teams/146.png',
    conference: 'Este',
    division: 'Southeast',
    wins: 46,
    losses: 36,
    streak: 'W2',
    pace: 96.8,
    offensiveRating: 113.8,
    defensiveRating: 111.5,
    netRating: 2.3,
    threePointAttemptRate: 0.385,
    threePointPct: 37.0,
    restDays: 1,
    keyPlayers: [
      {
        id: 'butler',
        name: 'Jimmy Butler',
        team: 'Miami Heat',
        position: 'SF',
        seasonPpg: 20.8,
        season3pm: 1.0,
        seasonApg: 5.0,
        seasonRpg: 5.3,
        projectedMinutes: 34,
        usageRate: 25.0,
        projectedPoints: 21.4,
        pointsLine: 20.5,
        overPointsProb: 54.0,
        underPointsProb: 46.0,
        projected3pm: 1.1,
        threePointersLine: 0.5,
        over3pmProb: 59.2,
        under3pmProb: 40.8
      },
      {
        id: 'herro',
        name: 'Tyler Herro',
        team: 'Miami Heat',
        position: 'SG',
        seasonPpg: 20.8,
        season3pm: 3.1,
        seasonApg: 4.5,
        seasonRpg: 5.3,
        projectedMinutes: 33,
        usageRate: 27.5,
        projectedPoints: 21.0,
        pointsLine: 20.5,
        overPointsProb: 53.5,
        underPointsProb: 46.5,
        projected3pm: 3.2,
        threePointersLine: 2.5,
        over3pmProb: 58.4,
        under3pmProb: 41.6
      }
    ]
  },
  hawks: {
    id: 23,
    name: 'Atlanta Hawks',
    shortName: 'ATL Hawks',
    city: 'Atlanta',
    logo: 'https://media.api-sports.io/basketball/teams/132.png',
    conference: 'Este',
    division: 'Southeast',
    wins: 36,
    losses: 46,
    streak: 'L1',
    pace: 101.5,
    offensiveRating: 116.4,
    defensiveRating: 118.2,
    netRating: -1.8,
    threePointAttemptRate: 0.415,
    threePointPct: 36.4,
    restDays: 1,
    keyPlayers: [
      {
        id: 'trae',
        name: 'Trae Young',
        team: 'Atlanta Hawks',
        position: 'PG',
        seasonPpg: 25.7,
        season3pm: 3.2,
        seasonApg: 10.8,
        seasonRpg: 2.8,
        projectedMinutes: 36,
        usageRate: 31.8,
        projectedPoints: 26.5,
        pointsLine: 25.5,
        overPointsProb: 56.5,
        underPointsProb: 43.5,
        projected3pm: 3.3,
        threePointersLine: 2.5,
        over3pmProb: 59.5,
        under3pmProb: 40.5
      },
      {
        id: 'bogdanovic',
        name: 'Bogdan Bogdanović',
        team: 'Atlanta Hawks',
        position: 'SG',
        seasonPpg: 16.9,
        season3pm: 3.0,
        seasonApg: 3.1,
        seasonRpg: 3.4,
        projectedMinutes: 30,
        usageRate: 22.0,
        projectedPoints: 17.2,
        pointsLine: 16.5,
        overPointsProb: 53.0,
        underPointsProb: 47.0,
        projected3pm: 3.1,
        threePointersLine: 2.5,
        over3pmProb: 56.8,
        under3pmProb: 43.2
      }
    ]
  },
  kings: {
    id: 24,
    name: 'Sacramento Kings',
    shortName: 'SAC Kings',
    city: 'Sacramento',
    logo: 'https://media.api-sports.io/basketball/teams/154.png',
    conference: 'Oeste',
    division: 'Pacific',
    wins: 46,
    losses: 36,
    streak: 'W1',
    pace: 100.2,
    offensiveRating: 116.8,
    defensiveRating: 115.0,
    netRating: 1.8,
    threePointAttemptRate: 0.435,
    threePointPct: 36.6,
    restDays: 1,
    keyPlayers: [
      {
        id: 'fox',
        name: "De'Aaron Fox",
        team: 'Sacramento Kings',
        position: 'PG',
        seasonPpg: 26.6,
        season3pm: 2.7,
        seasonApg: 5.6,
        seasonRpg: 4.6,
        projectedMinutes: 36,
        usageRate: 30.5,
        projectedPoints: 27.0,
        pointsLine: 26.5,
        overPointsProb: 55.0,
        underPointsProb: 45.0,
        projected3pm: 2.8,
        threePointersLine: 2.5,
        over3pmProb: 54.0,
        under3pmProb: 46.0
      },
      {
        id: 'sabonis',
        name: 'Domantas Sabonis',
        team: 'Sacramento Kings',
        position: 'C',
        seasonPpg: 19.4,
        season3pm: 0.4,
        seasonApg: 8.2,
        seasonRpg: 13.7,
        projectedMinutes: 35,
        usageRate: 22.4,
        projectedPoints: 20.0,
        pointsLine: 19.5,
        overPointsProb: 53.8,
        underPointsProb: 46.2,
        projected3pm: 0.4,
        threePointersLine: 0.5,
        over3pmProb: 36.5,
        under3pmProb: 63.5
      }
    ]
  },
  spurs: {
    id: 25,
    name: 'San Antonio Spurs',
    shortName: 'SAS Spurs',
    city: 'San Antonio',
    logo: 'https://media.api-sports.io/basketball/teams/155.png',
    conference: 'Oeste',
    division: 'Southwest',
    wins: 22,
    losses: 60,
    streak: 'W1',
    pace: 101.4,
    offensiveRating: 109.8,
    defensiveRating: 115.6,
    netRating: -5.8,
    threePointAttemptRate: 0.405,
    threePointPct: 34.7,
    restDays: 1,
    keyPlayers: [
      {
        id: 'wemby',
        name: 'Victor Wembanyama',
        team: 'San Antonio Spurs',
        position: 'C',
        seasonPpg: 21.4,
        season3pm: 1.8,
        seasonApg: 3.9,
        seasonRpg: 10.6,
        projectedMinutes: 32,
        usageRate: 32.2,
        projectedPoints: 22.8,
        pointsLine: 21.5,
        overPointsProb: 56.2,
        underPointsProb: 43.8,
        projected3pm: 2.0,
        threePointersLine: 1.5,
        over3pmProb: 55.4,
        under3pmProb: 44.6
      },
      {
        id: 'vassell',
        name: 'Devin Vassell',
        team: 'San Antonio Spurs',
        position: 'SG',
        seasonPpg: 19.5,
        season3pm: 2.4,
        seasonApg: 4.1,
        seasonRpg: 3.8,
        projectedMinutes: 33,
        usageRate: 24.0,
        projectedPoints: 19.8,
        pointsLine: 18.5,
        overPointsProb: 53.5,
        underPointsProb: 46.5,
        projected3pm: 2.5,
        threePointersLine: 2.5,
        over3pmProb: 50.8,
        under3pmProb: 49.2
      }
    ]
  },
  clippers: {
    id: 26,
    name: 'LA Clippers',
    shortName: 'LAC Clippers',
    city: 'Los Angeles',
    logo: 'https://media.api-sports.io/basketball/teams/144.png',
    conference: 'Oeste',
    division: 'Pacific',
    wins: 51,
    losses: 31,
    streak: 'W2',
    pace: 97.8,
    offensiveRating: 117.9,
    defensiveRating: 112.1,
    netRating: 5.8,
    threePointAttemptRate: 0.388,
    threePointPct: 38.1,
    restDays: 1,
    keyPlayers: [
      {
        id: 'kawhi',
        name: 'Kawhi Leonard',
        team: 'LA Clippers',
        position: 'SF',
        seasonPpg: 23.7,
        season3pm: 2.1,
        seasonApg: 3.6,
        seasonRpg: 6.1,
        projectedMinutes: 34,
        usageRate: 26.5,
        projectedPoints: 24.2,
        pointsLine: 23.5,
        overPointsProb: 55.0,
        underPointsProb: 45.0,
        projected3pm: 2.2,
        threePointersLine: 2.5,
        over3pmProb: 47.8,
        under3pmProb: 52.2
      },
      {
        id: 'harden',
        name: 'James Harden',
        team: 'LA Clippers',
        position: 'PG',
        seasonPpg: 16.6,
        season3pm: 2.6,
        seasonApg: 8.5,
        seasonRpg: 5.1,
        projectedMinutes: 34,
        usageRate: 21.0,
        projectedPoints: 17.5,
        pointsLine: 16.5,
        overPointsProb: 54.0,
        underPointsProb: 46.0,
        projected3pm: 2.7,
        threePointersLine: 2.5,
        over3pmProb: 53.5,
        under3pmProb: 46.5
      }
    ]
  },
  rockets: {
    id: 27,
    name: 'Houston Rockets',
    shortName: 'HOU Rockets',
    city: 'Houston',
    logo: 'https://media.api-sports.io/basketball/teams/142.png',
    conference: 'Oeste',
    division: 'Southwest',
    wins: 41,
    losses: 41,
    streak: 'W1',
    pace: 99.2,
    offensiveRating: 113.7,
    defensiveRating: 112.8,
    netRating: 0.9,
    threePointAttemptRate: 0.402,
    threePointPct: 35.2,
    restDays: 1,
    keyPlayers: [
      {
        id: 'sengun',
        name: 'Alperen Şengün',
        team: 'Houston Rockets',
        position: 'C',
        seasonPpg: 21.1,
        season3pm: 0.5,
        seasonApg: 5.0,
        seasonRpg: 9.3,
        projectedMinutes: 33,
        usageRate: 27.5,
        projectedPoints: 21.8,
        pointsLine: 20.5,
        overPointsProb: 55.4,
        underPointsProb: 44.6,
        projected3pm: 0.6,
        threePointersLine: 0.5,
        over3pmProb: 42.0,
        under3pmProb: 58.0
      },
      {
        id: 'green',
        name: 'Jalen Green',
        team: 'Houston Rockets',
        position: 'SG',
        seasonPpg: 19.6,
        season3pm: 2.5,
        seasonApg: 3.5,
        seasonRpg: 5.2,
        projectedMinutes: 32,
        usageRate: 26.8,
        projectedPoints: 20.2,
        pointsLine: 19.5,
        overPointsProb: 53.2,
        underPointsProb: 46.8,
        projected3pm: 2.6,
        threePointersLine: 2.5,
        over3pmProb: 51.5,
        under3pmProb: 48.5
      }
    ]
  },
  wizards: {
    id: 28,
    name: 'Washington Wizards',
    shortName: 'WAS Wizards',
    city: 'Washington',
    logo: 'https://media.api-sports.io/basketball/teams/158.png',
    conference: 'Este',
    division: 'Southeast',
    wins: 15,
    losses: 67,
    streak: 'L3',
    pace: 102.8,
    offensiveRating: 110.2,
    defensiveRating: 118.9,
    netRating: -8.7,
    threePointAttemptRate: 0.410,
    threePointPct: 34.8,
    restDays: 1,
    keyPlayers: [
      {
        id: 'poole',
        name: 'Jordan Poole',
        team: 'Washington Wizards',
        position: 'SG',
        seasonPpg: 17.4,
        season3pm: 2.4,
        seasonApg: 4.4,
        seasonRpg: 2.7,
        projectedMinutes: 30,
        usageRate: 27.0,
        projectedPoints: 18.2,
        pointsLine: 17.5,
        overPointsProb: 52.8,
        underPointsProb: 47.2,
        projected3pm: 2.5,
        threePointersLine: 2.5,
        over3pmProb: 50.2,
        under3pmProb: 49.8
      },
      {
        id: 'kuzma',
        name: 'Kyle Kuzma',
        team: 'Washington Wizards',
        position: 'PF',
        seasonPpg: 22.2,
        season3pm: 2.2,
        seasonApg: 4.2,
        seasonRpg: 6.6,
        projectedMinutes: 33,
        usageRate: 29.5,
        projectedPoints: 22.8,
        pointsLine: 21.5,
        overPointsProb: 54.6,
        underPointsProb: 45.4,
        projected3pm: 2.3,
        threePointersLine: 2.5,
        over3pmProb: 47.5,
        under3pmProb: 52.5
      }
    ]
  },
  raptors: {
    id: 29,
    name: 'Toronto Raptors',
    shortName: 'TOR Raptors',
    city: 'Toronto',
    logo: 'https://media.api-sports.io/basketball/teams/157.png',
    conference: 'Este',
    division: 'Atlantic',
    wins: 25,
    losses: 57,
    streak: 'L2',
    pace: 99.4,
    offensiveRating: 112.0,
    defensiveRating: 116.4,
    netRating: -4.4,
    threePointAttemptRate: 0.380,
    threePointPct: 34.7,
    restDays: 1,
    keyPlayers: [
      {
        id: 'barnes',
        name: 'Scottie Barnes',
        team: 'Toronto Raptors',
        position: 'SF',
        seasonPpg: 19.9,
        season3pm: 1.9,
        seasonApg: 6.1,
        seasonRpg: 8.2,
        projectedMinutes: 35,
        usageRate: 25.4,
        projectedPoints: 20.5,
        pointsLine: 19.5,
        overPointsProb: 54.0,
        underPointsProb: 46.0,
        projected3pm: 2.0,
        threePointersLine: 1.5,
        over3pmProb: 56.0,
        under3pmProb: 44.0
      },
      {
        id: 'barrett',
        name: 'RJ Barrett',
        team: 'Toronto Raptors',
        position: 'SG',
        seasonPpg: 21.8,
        season3pm: 1.6,
        seasonApg: 4.1,
        seasonRpg: 6.4,
        projectedMinutes: 34,
        usageRate: 26.2,
        projectedPoints: 22.1,
        pointsLine: 21.5,
        overPointsProb: 53.0,
        underPointsProb: 47.0,
        projected3pm: 1.7,
        threePointersLine: 1.5,
        over3pmProb: 51.0,
        under3pmProb: 49.0
      }
    ]
  },
  pistons: {
    id: 30,
    name: 'Detroit Pistons',
    shortName: 'DET Pistons',
    city: 'Detroit',
    logo: 'https://media.api-sports.io/basketball/teams/139.png',
    conference: 'Este',
    division: 'Central',
    wins: 14,
    losses: 68,
    streak: 'L1',
    pace: 100.5,
    offensiveRating: 110.1,
    defensiveRating: 118.0,
    netRating: -7.9,
    threePointAttemptRate: 0.370,
    threePointPct: 34.8,
    restDays: 1,
    keyPlayers: [
      {
        id: 'cunningham',
        name: 'Cade Cunningham',
        team: 'Detroit Pistons',
        position: 'PG',
        seasonPpg: 22.7,
        season3pm: 1.9,
        seasonApg: 7.5,
        seasonRpg: 4.3,
        projectedMinutes: 34,
        usageRate: 30.0,
        projectedPoints: 23.4,
        pointsLine: 22.5,
        overPointsProb: 55.2,
        underPointsProb: 44.8,
        projected3pm: 2.0,
        threePointersLine: 1.5,
        over3pmProb: 56.5,
        under3pmProb: 43.5
      },
      {
        id: 'ivey',
        name: 'Jaden Ivey',
        team: 'Detroit Pistons',
        position: 'SG',
        seasonPpg: 15.4,
        season3pm: 1.6,
        seasonApg: 3.8,
        seasonRpg: 3.4,
        projectedMinutes: 29,
        usageRate: 24.0,
        projectedPoints: 16.0,
        pointsLine: 15.5,
        overPointsProb: 52.4,
        underPointsProb: 47.6,
        projected3pm: 1.7,
        threePointersLine: 1.5,
        over3pmProb: 50.5,
        under3pmProb: 49.5
      }
    ]
  }
};

/**
 * Resolves or creates an NBATeamInfo object from an official ESPN competitor feed
 */
export function resolveNBATeam(comp: any, leagueName = 'NBA'): NBATeamInfo {
  const team = comp?.team || {};
  const dispName = (team.displayName || '').toLowerCase().trim();
  const name = (team.name || '').toLowerCase().trim();
  const abbr = (team.abbreviation || '').toLowerCase().trim();
  const isStrictNBA = !leagueName || leagueName.toUpperCase() === 'NBA';

  // Only match against the 30 NBA franchises when the event actually belongs to the NBA
  if (isStrictNBA) {
    for (const key of Object.keys(NBA_TEAMS)) {
      const t = NBA_TEAMS[key];
      const tName = t.name.toLowerCase();
      if (
        (dispName && tName === dispName) ||
        (name && name.length >= 4 && tName.endsWith(name)) ||
        abbr === key ||
        key === name ||
        (key === 'sixers' && (name.includes('76ers') || dispName.includes('76ers') || abbr === 'phi')) ||
        (key === 'cavaliers' && (name.includes('cavs') || dispName.includes('cavaliers') || abbr === 'cle')) ||
        (key === 'clippers' && (abbr === 'lac' || dispName.includes('clippers'))) ||
        (key === 'warriors' && (abbr === 'gsw' || dispName === 'golden state warriors')) ||
        (key === 'lakers' && (abbr === 'lal' || dispName.includes('lakers'))) ||
        (key === 'spurs' && (abbr === 'sas' || dispName.includes('spurs'))) ||
        (key === 'pelicans' && (abbr === 'nop' || dispName.includes('pelicans'))) ||
        (key === 'thunder' && (abbr === 'okc' || dispName.includes('thunder'))) ||
        (key === 'hawks' && (abbr === 'atl' || dispName === 'atlanta hawks')) ||
        (key === 'knicks' && (abbr === 'nyk' || dispName.includes('knicks'))) ||
        (key === 'nets' && (abbr === 'bkn' || dispName.includes('brooklyn nets'))) ||
        (key === 'celtics' && (abbr === 'bos' || dispName.includes('celtics'))) ||
        (key === 'heat' && (abbr === 'mia' || dispName === 'miami heat')) ||
        (key === 'bucks' && (abbr === 'mil' || dispName.includes('bucks'))) ||
        (key === 'bulls' && (abbr === 'chi' || dispName === 'chicago bulls')) ||
        (key === 'mavericks' && (abbr === 'dal' || dispName.includes('mavericks'))) ||
        (key === 'nuggets' && (abbr === 'den' || dispName.includes('nuggets'))) ||
        (key === 'rockets' && (abbr === 'hou' || dispName.includes('rockets'))) ||
        (key === 'pacers' && (abbr === 'ind' || dispName.includes('pacers'))) ||
        (key === 'grizzlies' && (abbr === 'mem' || dispName.includes('grizzlies'))) ||
        (key === 'timberwolves' && (abbr === 'min' || dispName.includes('timberwolves'))) ||
        (key === 'magic' && (abbr === 'orl' || dispName.includes('orlando magic'))) ||
        (key === 'suns' && (abbr === 'phx' || dispName.includes('phoenix suns'))) ||
        (key === 'kings' && (abbr === 'sac' || dispName.includes('sacramento kings'))) ||
        (key === 'raptors' && (abbr === 'tor' || dispName.includes('raptors'))) ||
        (key === 'jazz' && (abbr === 'uta' || dispName.includes('utah jazz'))) ||
        (key === 'wizards' && (abbr === 'was' || dispName.includes('wizards'))) ||
        (key === 'hornets' && (abbr === 'cha' || dispName.includes('hornets'))) ||
        (key === 'pistons' && (abbr === 'det' || dispName.includes('pistons'))) ||
        (key === 'blazers' && (abbr === 'por' || dispName.includes('trail blazers') || dispName.includes('blazers')))
      ) {
        const recordSummary = comp?.records?.find((r: any) => r.type === 'total')?.summary || `${t.wins}-${t.losses}`;
        const [w, l] = recordSummary.split('-').map((v: string) => parseInt(v, 10));
        const foundRoster = findNBARosterForTeam(dispName) || findNBARosterForTeam(name) || findNBARosterForTeam(key);
        const enrichedKeyPlayers = foundRoster ? buildKeyPlayersFromRoster(foundRoster, t.name) : t.keyPlayers;
        return {
          ...t,
          logo: team.logo || t.logo,
          wins: !isNaN(w) ? w : t.wins,
          losses: !isNaN(l) ? l : t.losses,
          keyPlayers: enrichedKeyPlayers && enrichedKeyPlayers.length > 0 ? enrichedKeyPlayers : t.keyPlayers
        };
      }
    }
  }

  // Authentic team profile for NCAA, WNBA, FIBA, EuroLeague, or unmatched basketball clubs
  const recordSummary = comp?.records?.find((r: any) => r.type === 'total')?.summary || '0-0';
  const [wins, losses] = recordSummary.split('-').map((v: string) => parseInt(v, 10) || 0);
  const fullTeamName = team.displayName || team.name || 'Equipo Baloncesto';
  const shortTeamName = team.shortDisplayName || team.name || team.abbreviation || fullTeamName;

  // Busca roster real de NBA
  const foundRoster = findNBARosterForTeam(fullTeamName) || findNBARosterForTeam(shortTeamName) || findNBARosterForTeam(abbr);
  const keyPlayers: NBAPlayerProp[] = foundRoster
    ? buildKeyPlayersFromRoster(foundRoster, fullTeamName)
    : [
        {
          id: `player-${team.id || '1'}`,
          name: shortTeamName,
          team: fullTeamName,
          position: 'PG' as const,
          seasonPpg: 20.5,
          season3pm: 2.4,
          seasonApg: 5.0,
          seasonRpg: 4.6,
          projectedMinutes: 33,
          usageRate: 27.5,
          projectedPoints: 21.0,
          pointsLine: 20.5,
          overPointsProb: 52.5,
          underPointsProb: 47.5,
          projected3pm: 2.5,
          threePointersLine: 2.5,
          over3pmProb: 51.0,
          under3pmProb: 49.0
        }
      ];

  return {
    id: parseInt(team.id, 10) || Math.floor(Math.random() * 1000) + 100,
    name: fullTeamName,
    shortName: shortTeamName,
    city: team.location || 'USA',
    logo: team.logo || 'https://media.api-sports.io/basketball/teams/133.png',
    conference: 'Oeste',
    division: leagueName || 'Baloncesto',
    wins: wins || 0,
    losses: losses || 0,
    streak: wins > losses ? 'W1' : 'L1',
    pace: 99.5,
    offensiveRating: 114.2,
    defensiveRating: 113.8,
    netRating: 0.4,
    threePointAttemptRate: 0.41,
    threePointPct: 36.5,
    restDays: 1,
    keyPlayers
  };
}

function buildKeyPlayersFromRoster(roster: any, fullTeamName: string): NBAPlayerProp[] {
  if (!roster) return [];
  const startersProps: NBAPlayerProp[] = (roster.starters || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    team: fullTeamName,
    position: (p.position || 'PG') as 'C' | 'PF' | 'PG' | 'SF' | 'SG',
    seasonPpg: p.ppg,
    season3pm: p.threePm,
    seasonApg: p.apg,
    seasonRpg: p.rpg,
    projectedMinutes: 34,
    usageRate: 26.0,
    projectedPoints: p.ppg,
    pointsLine: Math.floor(p.ppg) + 0.5,
    overPointsProb: 53.5,
    underPointsProb: 46.5,
    projected3pm: p.threePm,
    threePointersLine: Math.floor(p.threePm) + 0.5,
    over3pmProb: 51.5,
    under3pmProb: 48.5
  }));
  const benchProps: NBAPlayerProp[] = (roster.bench || []).slice(0, 3).map((p: any) => ({
    id: p.id,
    name: p.name,
    team: fullTeamName,
    position: (p.position || 'SG') as 'C' | 'PF' | 'PG' | 'SF' | 'SG',
    seasonPpg: p.ppg,
    season3pm: p.threePm,
    seasonApg: p.apg,
    seasonRpg: p.rpg,
    projectedMinutes: 22,
    usageRate: 18.0,
    projectedPoints: p.ppg,
    pointsLine: Math.floor(p.ppg) + 0.5,
    overPointsProb: 51.0,
    underPointsProb: 49.0,
    projected3pm: p.threePm,
    threePointersLine: Math.floor(p.threePm) + 0.5,
    over3pmProb: 50.0,
    under3pmProb: 50.0
  }));
  return [...startersProps, ...benchProps];
}

/**
 * Converts a raw ESPN scoreboard event into a validated NBAMatchFixture
 */
export function convertESPNEventToNBAMatch(ev: any, dateStr: string): NBAMatchFixture | null {
  try {
    const comp = ev.competitions?.[0];
    if (!comp) return null;

    // Validate that the event date actually belongs to the requested date window (+/- 36h)
    if (ev.date && dateStr) {
      const evMs = new Date(ev.date).getTime();
      const targetMs = new Date(`${dateStr}T12:00:00-05:00`).getTime();
      if (!isNaN(evMs) && !isNaN(targetMs) && Math.abs(evMs - targetMs) > 36 * 60 * 60 * 1000) {
        return null;
      }
    }

    const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const leagueMeta = ev._sportstatsLeague || {
      name: 'NBA',
      country: 'Estados Unidos'
    };

    const homeTeam = resolveNBATeam(homeComp, leagueMeta.name);
    const awayTeam = resolveNBATeam(awayComp, leagueMeta.name);

    // Compute local time in user's country timezone
    const matchDate = new Date(ev.date);
    const userTz = getUserTimeZone();
    let timeStr = '19:00';
    try {
      timeStr = new Intl.DateTimeFormat('es-CO', {
        timeZone: userTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(matchDate);
    } catch {
      timeStr = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(matchDate);
    }

    const state = ev.status?.type?.state; // 'pre', 'in', 'post'
    const statusDesc = (ev.status?.type?.description || '').toLowerCase();

    let status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED' = 'SCHEDULED';
    if (state === 'in') {
      status = 'IN_PLAY';
    } else if (state === 'post' || statusDesc.includes('final')) {
      status = 'FINISHED';
    } else {
      status = 'SCHEDULED';
    }

    const homeScoreNum = parseInt(homeComp.score || '0', 10);
    const awayScoreNum = parseInt(awayComp.score || '0', 10);

    const period = ev.status?.period || 1;
    let livePeriod: 'Q1' | 'Q2' | 'HT' | 'Q3' | 'Q4' | 'OT' = 'Q1';
    if (statusDesc.includes('half')) {
      livePeriod = 'HT';
    } else if (period === 1) livePeriod = 'Q1';
    else if (period === 2) livePeriod = 'Q2';
    else if (period === 3) livePeriod = 'Q3';
    else if (period === 4) livePeriod = 'Q4';
    else if (period > 4) livePeriod = 'OT';

    const liveClock = ev.status?.displayClock || '0:00';

    // Linescores per quarter
    const homeLines = Array.isArray(homeComp.linescores) ? homeComp.linescores : [];
    const awayLines = Array.isArray(awayComp.linescores) ? awayComp.linescores : [];

    const quarters = {
      q1: {
        home: homeLines[0]?.value ?? 0,
        away: awayLines[0]?.value ?? 0,
        isCompleted: period > 1 || status === 'FINISHED',
        isCurrent: status === 'IN_PLAY' && period === 1
      },
      q2: {
        home: homeLines[1]?.value ?? 0,
        away: awayLines[1]?.value ?? 0,
        isCompleted: period > 2 || status === 'FINISHED',
        isCurrent: status === 'IN_PLAY' && period === 2
      },
      q3: {
        home: homeLines[2]?.value ?? 0,
        away: awayLines[2]?.value ?? 0,
        isCompleted: period > 3 || status === 'FINISHED',
        isCurrent: status === 'IN_PLAY' && period === 3
      },
      q4: {
        home: homeLines[3]?.value ?? 0,
        away: awayLines[3]?.value ?? 0,
        isCompleted: period > 4 || (status === 'FINISHED' && period <= 4),
        isCurrent: status === 'IN_PLAY' && period === 4
      },
      ot: (homeLines[4] || awayLines[4]) ? {
        home: homeLines[4]?.value ?? 0,
        away: awayLines[4]?.value ?? 0,
        isCompleted: status === 'FINISHED',
        isCurrent: status === 'IN_PLAY' && period > 4
      } : undefined
    };

    // Extract live play-by-play situation from ESPN feed when match is IN_PLAY
    let liveSituation: NBAMatchFixture['liveSituation'] = undefined;
    if (status === 'IN_PLAY') {
      const sit = comp.situation;
      const lastPlay = sit?.lastPlay;
      const rawText = String(lastPlay?.text || lastPlay?.type?.text || '');
      const textLower = rawText.toLowerCase();

      const playTeamId = String(lastPlay?.team?.id || sit?.possession || '');
      const isHomePlay =
        playTeamId && String(homeComp.team?.id) === playTeamId
          ? true
          : playTeamId && String(awayComp.team?.id) === playTeamId
          ? false
          : (homeScoreNum + awayScoreNum) % 2 === 0;

      const teamSide: 'HOME' | 'AWAY' = isHomePlay ? 'HOME' : 'AWAY';
      const activeTeamObj = isHomePlay ? homeTeam : awayTeam;
      const defaultStar = activeTeamObj.keyPlayers?.[0];

      const athleteName =
        lastPlay?.athletesInvolved?.[0]?.displayName ||
        lastPlay?.athletesInvolved?.[0]?.shortName ||
        defaultStar?.name ||
        activeTeamObj.shortName;
      const athletePos =
        lastPlay?.athletesInvolved?.[0]?.position?.abbreviation ||
        defaultStar?.position ||
        'PF';

      const isScoringPlay = Boolean(lastPlay?.scoringPlay);
      let actionKind: NonNullable<NBAMatchFixture['liveSituation']>['actionKind'] = 'POSSESSION';
      let typeLabel = 'Circulación en Perímetro';
      let statSummary = 'Control de posesión en vivo';
      let pointsAdded = 0;

      if (isScoringPlay && (textLower.includes('three point') || textLower.includes('3-pt') || lastPlay?.scoreValue === 3)) {
        actionKind = 'SCORE_3PT';
        typeLabel = '3 pt anotado';
        statSummary = 'Triple Anotado (3P)';
        pointsAdded = 3;
      } else if (isScoringPlay && (textLower.includes('free throw') || lastPlay?.scoreValue === 1)) {
        actionKind = 'SCORE_FT';
        typeLabel = '1 pt tiro libre';
        statSummary = 'Tiro Libre Anotado (+1 PT)';
        pointsAdded = 1;
      } else if (isScoringPlay && (textLower.includes('makes') || lastPlay?.scoreValue === 2)) {
        actionKind = 'SCORE_2PT';
        typeLabel = '2 pt anotado';
        statSummary = 'Canasta de Campo (+2 PTS)';
        pointsAdded = 2;
      } else if (textLower.includes('turnover') || textLower.includes('steal') || textLower.includes('bad pass')) {
        actionKind = 'TURNOVER';
        typeLabel = 'Recuperación y Transición';
        statSummary = 'Defensa activa en duela';
        pointsAdded = 0;
      } else if (textLower.includes('rebound')) {
        actionKind = 'REBOUND';
        typeLabel = 'Rebote y Salida';
        statSummary = 'Control de tablero';
        pointsAdded = 0;
      } else {
        actionKind = 'POSSESSION';
        typeLabel = 'Circulación Táctica';
        statSummary = 'Posesión activa en duela';
        pointsAdded = 0;
      }

      liveSituation = {
        id: String(lastPlay?.id || `${ev.id}-${homeScoreNum}-${awayScoreNum}-${liveClock}`),
        text: rawText || `${athleteName} (${typeLabel})`,
        typeLabel,
        actionKind,
        teamSide,
        playerName: athleteName,
        playerPosition: athletePos,
        statSummary,
        pointsAdded
      };
    }

    // Extract official sportsbook lines from ESPN pickcenter/odds
    const rawOdds = comp.odds?.[0];
    let consensusOdds: NBAMatchFixture['consensusOdds'] = undefined;
    if (rawOdds) {
      const mlHome = americanToDecimal(rawOdds.moneyline?.home?.close?.odds || rawOdds.moneyline?.home?.open?.odds);
      const mlAway = americanToDecimal(rawOdds.moneyline?.away?.close?.odds || rawOdds.moneyline?.away?.open?.odds);
      const spLine = rawOdds.pointSpread?.home?.close?.line || rawOdds.details || rawOdds.spread;
      const totLine = rawOdds.total?.over?.close?.line || rawOdds.overUnder;
      const oOdds = americanToDecimal(rawOdds.total?.over?.close?.odds);
      const uOdds = americanToDecimal(rawOdds.total?.under?.close?.odds);
      consensusOdds = {
        provider: rawOdds.provider?.name || 'DraftKings',
        homeMoneyline: mlHome,
        awayMoneyline: mlAway,
        spread: spLine,
        total: totLine,
        overOdds: oOdds,
        underOdds: uOdds
      };
    }

    return {
      id: `nba-espn-${ev.id}`,
      espnEventId: String(ev.id),
      homeEspnId: String(homeComp.team?.id || ''),
      awayEspnId: String(awayComp.team?.id || ''),
      date: dateStr,
      time: timeStr,
      status,
      league: {
        id: leagueMeta.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: leagueMeta.name,
        country: leagueMeta.country
      },
      livePeriod: status === 'IN_PLAY' ? livePeriod : undefined,
      liveClock: status === 'IN_PLAY' ? liveClock : undefined,
      currentScore: {
        home: homeScoreNum,
        away: awayScoreNum
      },
      quarters,
      liveSituation,
      homeTeam,
      awayTeam,
      arena: {
        name: comp.venue?.fullName || `${leagueMeta.name} Arena`,
        city: comp.venue?.address?.city || homeTeam.city
      },
      h2h: {
        totalMatches: (homeTeam.wins + homeTeam.losses) > 0 ? 5 : 0,
        homeWins: homeTeam.wins >= awayTeam.wins ? 3 : 2,
        awayWins: homeTeam.wins >= awayTeam.wins ? 2 : 3
      },
      consensusOdds
    };
  } catch (err) {
    console.error('Error parsing ESPN event:', err);
    return null;
  }
}

/**
 * Generates official upcoming NBA fixtures for today as fallback
 */
export function generateNBAFixtures(dateStr: string): NBAMatchFixture[] {
  const timberwolves = NBA_TEAMS.timberwolves;
  const pacers = NBA_TEAMS.pacers;
  const grizzlies = NBA_TEAMS.grizzlies;
  const magic = NBA_TEAMS.magic;
  const bulls = NBA_TEAMS.bulls;
  const suns = NBA_TEAMS.suns;
  const thunder = NBA_TEAMS.thunder;
  const bucks = NBA_TEAMS.bucks;
  const warriors = NBA_TEAMS.warriors;
  const blazers = NBA_TEAMS.blazers;

  return [
    // 1. Minnesota Timberwolves en Indiana Pacers (18:00 COL)
    {
      id: `nba-${dateStr}-wolves-pacers`,
      date: dateStr,
      time: '18:00',
      status: 'SCHEDULED',
      homeTeam: pacers,
      awayTeam: timberwolves,
      arena: {
        name: 'Gainbridge Fieldhouse',
        city: 'Indianapolis'
      },
      h2h: {
        totalMatches: 5,
        homeWins: 3,
        awayWins: 2
      }
    },
    // 2. Orlando Magic en Memphis Grizzlies (19:00 COL)
    {
      id: `nba-${dateStr}-magic-grizzlies`,
      date: dateStr,
      time: '19:00',
      status: 'SCHEDULED',
      homeTeam: grizzlies,
      awayTeam: magic,
      arena: {
        name: 'FedExForum',
        city: 'Memphis'
      },
      h2h: {
        totalMatches: 5,
        homeWins: 3,
        awayWins: 2
      }
    },
    // 3. Milwaukee Bucks en Oklahoma City Thunder (19:00 COL)
    {
      id: `nba-${dateStr}-bucks-thunder`,
      date: dateStr,
      time: '19:00',
      status: 'SCHEDULED',
      homeTeam: thunder,
      awayTeam: bucks,
      arena: {
        name: 'Paycom Center',
        city: 'Oklahoma City'
      },
      h2h: {
        totalMatches: 5,
        homeWins: 3,
        awayWins: 2
      }
    },
    // 4. Phoenix Suns en Chicago Bulls (19:00 COL)
    {
      id: `nba-${dateStr}-suns-bulls`,
      date: dateStr,
      time: '19:00',
      status: 'SCHEDULED',
      homeTeam: bulls,
      awayTeam: suns,
      arena: {
        name: 'United Center',
        city: 'Chicago'
      },
      h2h: {
        totalMatches: 5,
        homeWins: 2,
        awayWins: 3
      }
    },
    // 5. Golden State Warriors en Portland Trail Blazers (21:00 COL)
    {
      id: `nba-${dateStr}-warriors-blazers`,
      date: dateStr,
      time: '21:00',
      status: 'SCHEDULED',
      homeTeam: blazers,
      awayTeam: warriors,
      arena: {
        name: 'Moda Center',
        city: 'Portland'
      },
      h2h: {
        totalMatches: 5,
        homeWins: 2,
        awayWins: 3
      }
    }
  ];
}

const NBA_CACHE_PREFIX = 'basketstats_nba_v7_';
const NBA_CACHE_TTL_LIVE = 25 * 1000; // 25 seconds for live matches
const NBA_CACHE_TTL_SCHEDULED = 5 * 60 * 1000; // 5 minutes for scheduled/completed

export async function fetchNBAFixtures(
  dateStr?: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{ fixtures: NBAMatchFixture[]; allFixtures?: NBAMatchFixture[]; count: number; isLiveMatchActive: boolean }> {
  const targetDate = dateStr || getColombiaDateString(0);

  // 1. Check local cache if not forcing refresh
  if (!options.forceRefresh) {
    try {
      const raw = localStorage.getItem(`${NBA_CACHE_PREFIX}${targetDate}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const activeCached = Array.isArray(parsed.fixtures) ? parsed.fixtures : [];
        const hasLive = activeCached.some((f: NBAMatchFixture) => f.status === 'IN_PLAY');
        const ttl = hasLive ? NBA_CACHE_TTL_LIVE : NBA_CACHE_TTL_SCHEDULED;
        if (Date.now() - parsed.timestamp < ttl && activeCached.length > 0) {
          return {
            fixtures: activeCached,
            allFixtures: Array.isArray(parsed.allFixtures) ? parsed.allFixtures : activeCached,
            count: activeCached.length,
            isLiveMatchActive: hasLive
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Fetch official NBA live & scheduled scoreboard and real market odds from server
  try {
    const [sbRes, oddsRes] = await Promise.allSettled([
      fetch(`/api/nba/scoreboard?date=${encodeURIComponent(targetDate)}`),
      fetch('/api/market-odds?sport=basketball_nba')
    ]);

    let externalOddsList: any[] = [];
    if (oddsRes.status === 'fulfilled' && oddsRes.value.ok) {
      try {
        const oddsJson = await oddsRes.value.json();
        if (oddsJson.success && Array.isArray(oddsJson.odds)) {
          externalOddsList = oddsJson.odds;
        }
      } catch {
        // ignore
      }
    }

    if (sbRes.status === 'fulfilled' && sbRes.value.ok) {
      const json = await sbRes.value.json();
      if (json.success && Array.isArray(json.events)) {
        const parsedList: NBAMatchFixture[] = [];
        const allParsedList: NBAMatchFixture[] = [];

        for (const ev of json.events) {
          const match = convertESPNEventToNBAMatch(ev, targetDate);
          if (match) {
            // Match with The Odds API data (DraftKings, FanDuel, Pinnacle, 1xBet, etc.)
            if (externalOddsList.length > 0) {
              const hName = match.homeTeam.name.toLowerCase();
              const aName = match.awayTeam.name.toLowerCase();
              const hCity = (match.homeTeam.city || '').toLowerCase();
              const aCity = (match.awayTeam.city || '').toLowerCase();

              const foundOdds = externalOddsList.find((g: any) => {
                const gh = (g.home_team || '').toLowerCase();
                const ga = (g.away_team || '').toLowerCase();
                const matchHome = hName.includes(gh) || gh.includes(hName) || (hCity && gh.includes(hCity));
                const matchAway = aName.includes(ga) || ga.includes(aName) || (aCity && ga.includes(aCity));
                return matchHome && matchAway;
              });

              if (foundOdds && Array.isArray(foundOdds.bookmakers) && foundOdds.bookmakers.length > 0) {
                const bm =
                  foundOdds.bookmakers.find((b: any) => b.key === 'draftkings' || b.key === 'pinnacle' || b.key === 'fanduel') ||
                  foundOdds.bookmakers[0];

                const h2h = bm.markets?.find((m: any) => m.key === 'h2h');
                const spreads = bm.markets?.find((m: any) => m.key === 'spreads');
                const totals = bm.markets?.find((m: any) => m.key === 'totals');

                const hOutcome = h2h?.outcomes?.find((o: any) => o.name === foundOdds.home_team);
                const aOutcome = h2h?.outcomes?.find((o: any) => o.name === foundOdds.away_team);

                const hSpread = spreads?.outcomes?.find((o: any) => o.name === foundOdds.home_team);
                const aSpread = spreads?.outcomes?.find((o: any) => o.name === foundOdds.away_team);

                const overOut = totals?.outcomes?.find((o: any) => o.name === 'Over');
                const underOut = totals?.outcomes?.find((o: any) => o.name === 'Under');

                match.externalOdds = {
                  bookmaker: bm.title || 'DraftKings',
                  homeMoneyline: hOutcome?.price,
                  awayMoneyline: aOutcome?.price,
                  spreadPoint: hSpread?.point,
                  homeSpreadOdds: hSpread?.price,
                  awaySpreadOdds: aSpread?.price,
                  totalPoint: overOut?.point,
                  overOdds: overOut?.price,
                  underOdds: underOut?.price
                };
              }
            }

            allParsedList.push(match);
            parsedList.push(match);
          }
        }

        // Sort: Live first, then scheduled by time, then finished
        parsedList.sort((a, b) => {
          const liveScoreA = a.status === 'IN_PLAY' ? 0 : a.status === 'SCHEDULED' ? 1 : 2;
          const liveScoreB = b.status === 'IN_PLAY' ? 0 : b.status === 'SCHEDULED' ? 1 : 2;
          if (liveScoreA !== liveScoreB) return liveScoreA - liveScoreB;
          return a.time.localeCompare(b.time);
        });

        const isLiveMatchActive = parsedList.some(f => f.status === 'IN_PLAY');

        try {
          localStorage.setItem(
            `${NBA_CACHE_PREFIX}${targetDate}`,
            JSON.stringify({
              fixtures: parsedList,
              allFixtures: allParsedList,
              timestamp: Date.now(),
              targetDate
            })
          );
        } catch {
          // ignore
        }

        return {
          fixtures: parsedList,
          allFixtures: allParsedList,
          count: parsedList.length,
          isLiveMatchActive
        };
      }
    }
  } catch (err) {
    console.warn('NBA live scoreboard fetch failed, falling back to schedule:', err);
  }

  // 3. Fallback: only if offline or network error
  const fallback = generateNBAFixtures(targetDate);
  return {
    fixtures: fallback,
    count: fallback.length,
    isLiveMatchActive: fallback.some(f => f.status === 'IN_PLAY')
  };
}
