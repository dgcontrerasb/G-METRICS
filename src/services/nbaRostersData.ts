import { NBAPlayerRosterInfo } from './lineupService';

export interface NBARosterEntry {
  coach: string;
  starters: NBAPlayerRosterInfo[];
  bench: NBAPlayerRosterInfo[];
}

export const NBA_30_TEAMS_ROSTERS: Record<string, NBARosterEntry> = {
  // 1. Atlanta Hawks
  hawks: {
    coach: 'Quin Snyder',
    starters: [
      { id: 'atl1', name: 'Trae Young', number: 11, position: 'PG', ppg: 26.4, apg: 10.8, rpg: 3.0, threePm: 3.2 },
      { id: 'atl2', name: 'Dyson Daniels', number: 5, position: 'SG', ppg: 14.1, apg: 3.5, rpg: 4.8, threePm: 1.3 },
      { id: 'atl3', name: 'Zaccharie Risacher', number: 10, position: 'SF', ppg: 12.0, apg: 1.4, rpg: 3.8, threePm: 1.6 },
      { id: 'atl4', name: 'Jalen Johnson', number: 1, position: 'PF', ppg: 19.2, apg: 5.4, rpg: 10.2, threePm: 1.4 },
      { id: 'atl5', name: 'Clint Capela', number: 15, position: 'C', ppg: 10.8, apg: 1.2, rpg: 9.8, threePm: 0.0 }
    ],
    bench: [
      { id: 'atl6', name: 'Bogdan Bogdanovic', number: 13, position: 'SG', ppg: 15.6, apg: 3.1, rpg: 3.4, threePm: 2.9 },
      { id: 'atl7', name: "De'Andre Hunter", number: 12, position: 'SF', ppg: 16.4, apg: 1.8, rpg: 4.2, threePm: 2.1 },
      { id: 'atl8', name: 'Onyeka Okongwu', number: 17, position: 'C', ppg: 11.2, apg: 1.6, rpg: 7.2, threePm: 0.5 }
    ]
  },

  // 2. Boston Celtics
  celtics: {
    coach: 'Joe Mazzulla',
    starters: [
      { id: 'bos1', name: 'Jrue Holiday', number: 4, position: 'PG', ppg: 12.8, apg: 4.8, rpg: 5.4, threePm: 2.0 },
      { id: 'bos2', name: 'Derrick White', number: 9, position: 'SG', ppg: 16.4, apg: 5.1, rpg: 4.2, threePm: 3.1 },
      { id: 'bos3', name: 'Jaylen Brown', number: 7, position: 'SF', ppg: 23.8, apg: 3.8, rpg: 5.8, threePm: 2.4 },
      { id: 'bos4', name: 'Jayson Tatum', number: 0, position: 'PF', ppg: 28.2, apg: 5.4, rpg: 8.6, threePm: 3.5 },
      { id: 'bos5', name: 'Kristaps Porzingis', number: 8, position: 'C', ppg: 19.8, apg: 2.0, rpg: 7.0, threePm: 2.1 }
    ],
    bench: [
      { id: 'bos6', name: 'Al Horford', number: 42, position: 'C', ppg: 8.6, apg: 2.6, rpg: 6.4, threePm: 1.5 },
      { id: 'bos7', name: 'Payton Pritchard', number: 11, position: 'PG', ppg: 14.5, apg: 3.4, rpg: 3.2, threePm: 3.3 },
      { id: 'bos8', name: 'Sam Hauser', number: 30, position: 'SF', ppg: 9.0, apg: 1.0, rpg: 3.5, threePm: 2.5 }
    ]
  },

  // 3. Brooklyn Nets
  nets: {
    coach: 'Jordi Fernandez',
    starters: [
      { id: 'bkn1', name: 'Dennis Schroder', number: 17, position: 'PG', ppg: 18.2, apg: 6.6, rpg: 3.0, threePm: 2.4 },
      { id: 'bkn2', name: 'Cam Thomas', number: 24, position: 'SG', ppg: 24.6, apg: 3.2, rpg: 3.5, threePm: 2.8 },
      { id: 'bkn3', name: 'Cameron Johnson', number: 2, position: 'SF', ppg: 17.5, apg: 2.8, rpg: 4.4, threePm: 2.7 },
      { id: 'bkn4', name: 'Dorian Finney-Smith', number: 28, position: 'PF', ppg: 10.4, apg: 1.8, rpg: 4.8, threePm: 1.9 },
      { id: 'bkn5', name: 'Nicolas Claxton', number: 33, position: 'C', ppg: 9.8, apg: 2.3, rpg: 8.2, threePm: 0.0 }
    ],
    bench: [
      { id: 'bkn6', name: 'Ben Simmons', number: 10, position: 'PG', ppg: 6.2, apg: 6.8, rpg: 6.0, threePm: 0.0 },
      { id: 'bkn7', name: 'Jalen Wilson', number: 9, position: 'SF', ppg: 9.6, apg: 1.8, rpg: 3.4, threePm: 1.6 },
      { id: 'bkn8', name: "Day'Ron Sharpe", number: 20, position: 'C', ppg: 7.2, apg: 1.4, rpg: 6.6, threePm: 0.0 }
    ]
  },

  // 4. Charlotte Hornets
  hornets: {
    coach: 'Charles Lee',
    starters: [
      { id: 'cha1', name: 'LaMelo Ball', number: 1, position: 'PG', ppg: 29.8, apg: 7.2, rpg: 5.1, threePm: 4.6 },
      { id: 'cha2', name: 'Brandon Miller', number: 24, position: 'SG', ppg: 19.4, apg: 3.8, rpg: 4.8, threePm: 2.9 },
      { id: 'cha3', name: 'Josh Green', number: 10, position: 'SF', ppg: 9.2, apg: 1.8, rpg: 2.8, threePm: 1.4 },
      { id: 'cha4', name: 'Miles Bridges', number: 0, position: 'PF', ppg: 16.5, apg: 3.2, rpg: 7.2, threePm: 1.8 },
      { id: 'cha5', name: 'Nick Richards', number: 4, position: 'C', ppg: 11.0, apg: 1.5, rpg: 10.0, threePm: 0.0 }
    ],
    bench: [
      { id: 'cha6', name: 'Tre Mann', number: 23, position: 'PG', ppg: 14.8, apg: 3.2, rpg: 3.1, threePm: 2.2 },
      { id: 'cha7', name: 'Grant Williams', number: 2, position: 'PF', ppg: 10.4, apg: 2.3, rpg: 5.1, threePm: 1.6 },
      { id: 'cha8', name: 'Cody Martin', number: 11, position: 'SG', ppg: 7.5, apg: 2.1, rpg: 4.2, threePm: 0.9 }
    ]
  },

  // 5. Chicago Bulls
  bulls: {
    coach: 'Billy Donovan',
    starters: [
      { id: 'chi1', name: 'Josh Giddey', number: 3, position: 'PG', ppg: 13.5, apg: 6.8, rpg: 6.4, threePm: 1.3 },
      { id: 'chi2', name: 'Coby White', number: 0, position: 'SG', ppg: 19.2, apg: 4.8, rpg: 3.6, threePm: 3.0 },
      { id: 'chi3', name: 'Zach LaVine', number: 8, position: 'SF', ppg: 22.4, apg: 4.2, rpg: 4.8, threePm: 2.8 },
      { id: 'chi4', name: 'Patrick Williams', number: 44, position: 'PF', ppg: 10.2, apg: 2.1, rpg: 4.4, threePm: 1.5 },
      { id: 'chi5', name: 'Nikola Vucevic', number: 9, position: 'C', ppg: 20.8, apg: 3.2, rpg: 9.8, threePm: 1.9 }
    ],
    bench: [
      { id: 'chi6', name: 'Ayo Dosunmu', number: 12, position: 'SG', ppg: 12.0, apg: 4.2, rpg: 3.5, threePm: 1.4 },
      { id: 'chi7', name: 'Lonzo Ball', number: 2, position: 'PG', ppg: 6.8, apg: 4.2, rpg: 3.0, threePm: 1.5 },
      { id: 'chi8', name: 'Jalen Smith', number: 25, position: 'PF', ppg: 10.1, apg: 1.1, rpg: 5.6, threePm: 1.2 }
    ]
  },

  // 6. Cleveland Cavaliers
  cavaliers: {
    coach: 'Kenny Atkinson',
    starters: [
      { id: 'cle1', name: 'Darius Garland', number: 10, position: 'PG', ppg: 20.5, apg: 6.8, rpg: 2.8, threePm: 2.6 },
      { id: 'cle2', name: 'Donovan Mitchell', number: 45, position: 'SG', ppg: 24.2, apg: 4.2, rpg: 4.5, threePm: 3.4 },
      { id: 'cle3', name: 'Max Strus', number: 1, position: 'SF', ppg: 12.2, apg: 3.8, rpg: 4.6, threePm: 2.4 },
      { id: 'cle4', name: 'Evan Mobley', number: 4, position: 'PF', ppg: 18.4, apg: 2.8, rpg: 8.8, threePm: 0.9 },
      { id: 'cle5', name: 'Jarrett Allen', number: 31, position: 'C', ppg: 14.5, apg: 1.9, rpg: 11.2, threePm: 0.0 }
    ],
    bench: [
      { id: 'cle6', name: 'Caris LeVert', number: 3, position: 'SG', ppg: 11.8, apg: 4.1, rpg: 3.0, threePm: 1.5 },
      { id: 'cle7', name: 'Georges Niang', number: 20, position: 'PF', ppg: 8.4, apg: 1.2, rpg: 3.2, threePm: 1.7 },
      { id: 'cle8', name: 'Ty Jerome', number: 2, position: 'PG', ppg: 9.8, apg: 3.2, rpg: 2.0, threePm: 1.4 }
    ]
  },

  // 7. Dallas Mavericks
  mavericks: {
    coach: 'Jason Kidd',
    starters: [
      { id: 'dal1', name: 'Luka Doncic', number: 77, position: 'PG', ppg: 28.8, apg: 8.2, rpg: 8.4, threePm: 3.4 },
      { id: 'dal2', name: 'Kyrie Irving', number: 11, position: 'SG', ppg: 24.5, apg: 5.2, rpg: 4.6, threePm: 3.0 },
      { id: 'dal3', name: 'Klay Thompson', number: 31, position: 'SF', ppg: 14.2, apg: 1.9, rpg: 3.5, threePm: 3.1 },
      { id: 'dal4', name: 'P.J. Washington', number: 25, position: 'PF', ppg: 11.8, apg: 1.8, rpg: 7.2, threePm: 1.5 },
      { id: 'dal5', name: 'Dereck Lively II', number: 2, position: 'C', ppg: 9.2, apg: 2.4, rpg: 8.0, threePm: 0.0 }
    ],
    bench: [
      { id: 'dal6', name: 'Daniel Gafford', number: 21, position: 'C', ppg: 11.5, apg: 1.4, rpg: 6.8, threePm: 0.0 },
      { id: 'dal7', name: 'Spencer Dinwiddie', number: 26, position: 'PG', ppg: 7.8, apg: 3.2, rpg: 2.2, threePm: 1.2 },
      { id: 'dal8', name: 'Naji Marshall', number: 13, position: 'SF', ppg: 9.4, apg: 2.6, rpg: 3.8, threePm: 0.8 }
    ]
  },

  // 8. Denver Nuggets
  nuggets: {
    coach: 'Michael Malone',
    starters: [
      { id: 'den1', name: 'Jamal Murray', number: 27, position: 'PG', ppg: 20.8, apg: 6.2, rpg: 4.0, threePm: 2.4 },
      { id: 'den2', name: 'Christian Braun', number: 0, position: 'SG', ppg: 15.4, apg: 2.2, rpg: 5.2, threePm: 1.5 },
      { id: 'den3', name: 'Michael Porter Jr.', number: 1, position: 'SF', ppg: 18.6, apg: 2.6, rpg: 7.4, threePm: 2.9 },
      { id: 'den4', name: 'Aaron Gordon', number: 50, position: 'PF', ppg: 14.8, apg: 3.2, rpg: 6.8, threePm: 1.0 },
      { id: 'den5', name: 'Nikola Jokic', number: 15, position: 'C', ppg: 29.5, apg: 11.2, rpg: 13.4, threePm: 2.1 }
    ],
    bench: [
      { id: 'den6', name: 'Russell Westbrook', number: 4, position: 'PG', ppg: 11.2, apg: 5.8, rpg: 4.2, threePm: 0.9 },
      { id: 'den7', name: 'Peyton Watson', number: 8, position: 'SF', ppg: 8.6, apg: 1.4, rpg: 3.4, threePm: 0.9 },
      { id: 'den8', name: 'Julian Strawther', number: 3, position: 'SG', ppg: 8.9, apg: 1.1, rpg: 2.2, threePm: 1.4 }
    ]
  },

  // 9. Detroit Pistons
  pistons: {
    coach: 'J.B. Bickerstaff',
    starters: [
      { id: 'det1', name: 'Cade Cunningham', number: 2, position: 'PG', ppg: 23.4, apg: 8.8, rpg: 7.2, threePm: 1.9 },
      { id: 'det2', name: 'Jaden Ivey', number: 23, position: 'SG', ppg: 18.5, apg: 4.0, rpg: 4.5, threePm: 2.1 },
      { id: 'det3', name: 'Tim Hardaway Jr.', number: 5, position: 'SF', ppg: 12.0, apg: 1.8, rpg: 2.5, threePm: 2.2 },
      { id: 'det4', name: 'Tobias Harris', number: 12, position: 'PF', ppg: 13.8, apg: 2.4, rpg: 7.1, threePm: 1.4 },
      { id: 'det5', name: 'Jalen Duren', number: 0, position: 'C', ppg: 9.2, apg: 2.6, rpg: 9.8, threePm: 0.0 }
    ],
    bench: [
      { id: 'det6', name: 'Malik Beasley', number: 8, position: 'SG', ppg: 14.5, apg: 1.8, rpg: 3.2, threePm: 3.2 },
      { id: 'det7', name: 'Isaiah Stewart', number: 28, position: 'C', ppg: 6.2, apg: 1.4, rpg: 5.8, threePm: 0.6 },
      { id: 'det8', name: 'Simone Fontecchio', number: 19, position: 'SF', ppg: 8.4, apg: 1.2, rpg: 3.4, threePm: 1.6 }
    ]
  },

  // 10. Golden State Warriors
  warriors: {
    coach: 'Steve Kerr',
    starters: [
      { id: 'gsw1', name: 'Stephen Curry', number: 30, position: 'PG', ppg: 23.0, apg: 6.5, rpg: 5.2, threePm: 4.2 },
      { id: 'gsw2', name: 'Brandin Podziemski', number: 2, position: 'SG', ppg: 10.5, apg: 3.8, rpg: 4.6, threePm: 1.4 },
      { id: 'gsw3', name: 'Andrew Wiggins', number: 22, position: 'SF', ppg: 17.2, apg: 2.4, rpg: 4.5, threePm: 2.2 },
      { id: 'gsw4', name: 'Jonathan Kuminga', number: 0, position: 'PF', ppg: 16.5, apg: 2.1, rpg: 5.0, threePm: 1.1 },
      { id: 'gsw5', name: 'Draymond Green', number: 23, position: 'C', ppg: 8.8, apg: 5.8, rpg: 5.6, threePm: 1.4 }
    ],
    bench: [
      { id: 'gsw6', name: 'Buddy Hield', number: 7, position: 'SG', ppg: 15.8, apg: 1.8, rpg: 3.8, threePm: 3.4 },
      { id: 'gsw7', name: 'Moses Moody', number: 4, position: 'SG', ppg: 9.2, apg: 1.2, rpg: 2.4, threePm: 1.5 },
      { id: 'gsw8', name: 'Kevon Looney', number: 5, position: 'C', ppg: 5.6, apg: 1.8, rpg: 7.8, threePm: 0.0 }
    ]
  },

  // 11. Houston Rockets
  rockets: {
    coach: 'Ime Udoka',
    starters: [
      { id: 'hou1', name: 'Fred VanVleet', number: 5, position: 'PG', ppg: 14.8, apg: 6.2, rpg: 4.0, threePm: 2.4 },
      { id: 'hou2', name: 'Jalen Green', number: 4, position: 'SG', ppg: 19.8, apg: 2.8, rpg: 5.0, threePm: 2.8 },
      { id: 'hou3', name: 'Dillon Brooks', number: 9, position: 'SF', ppg: 12.5, apg: 1.6, rpg: 3.8, threePm: 1.8 },
      { id: 'hou4', name: 'Jabari Smith Jr.', number: 10, position: 'PF', ppg: 12.0, apg: 1.2, rpg: 7.0, threePm: 1.6 },
      { id: 'hou5', name: 'Alperen Sengun', number: 28, position: 'C', ppg: 19.0, apg: 5.0, rpg: 10.8, threePm: 0.3 }
    ],
    bench: [
      { id: 'hou6', name: 'Amen Thompson', number: 1, position: 'SF', ppg: 12.4, apg: 2.2, rpg: 6.8, threePm: 0.2 },
      { id: 'hou7', name: 'Tari Eason', number: 17, position: 'PF', ppg: 11.8, apg: 1.2, rpg: 6.2, threePm: 1.1 },
      { id: 'hou8', name: 'Reed Sheppard', number: 15, position: 'PG', ppg: 4.8, apg: 1.8, rpg: 1.5, threePm: 0.8 }
    ]
  },

  // 12. Indiana Pacers
  pacers: {
    coach: 'Rick Carlisle',
    starters: [
      { id: 'ind1', name: 'Tyrese Haliburton', number: 0, position: 'PG', ppg: 17.5, apg: 8.8, rpg: 3.8, threePm: 2.5 },
      { id: 'ind2', name: 'Andrew Nembhard', number: 2, position: 'SG', ppg: 10.2, apg: 5.0, rpg: 2.2, threePm: 1.0 },
      { id: 'ind3', name: 'Aaron Nesmith', number: 23, position: 'SF', ppg: 11.4, apg: 1.5, rpg: 4.0, threePm: 1.8 },
      { id: 'ind4', name: 'Pascal Siakam', number: 43, position: 'PF', ppg: 20.6, apg: 4.2, rpg: 6.8, threePm: 1.4 },
      { id: 'ind5', name: 'Myles Turner', number: 33, position: 'C', ppg: 17.2, apg: 1.6, rpg: 7.2, threePm: 2.1 }
    ],
    bench: [
      { id: 'ind6', name: 'Bennedict Mathurin', number: 0, position: 'SG', ppg: 18.8, apg: 2.0, rpg: 6.4, threePm: 1.6 },
      { id: 'ind7', name: 'Obi Toppin', number: 1, position: 'PF', ppg: 10.2, apg: 1.8, rpg: 4.0, threePm: 1.4 },
      { id: 'ind8', name: 'T.J. McConnell', number: 9, position: 'PG', ppg: 9.8, apg: 4.6, rpg: 2.6, threePm: 0.3 }
    ]
  },

  // 13. LA Clippers
  clippers: {
    coach: 'Tyronn Lue',
    starters: [
      { id: 'lac1', name: 'James Harden', number: 1, position: 'PG', ppg: 20.8, apg: 8.6, rpg: 7.2, threePm: 2.6 },
      { id: 'lac2', name: 'Norman Powell', number: 24, position: 'SG', ppg: 23.5, apg: 2.4, rpg: 3.4, threePm: 3.4 },
      { id: 'lac3', name: 'Terance Mann', number: 14, position: 'SF', ppg: 6.8, apg: 1.8, rpg: 3.8, threePm: 0.8 },
      { id: 'lac4', name: 'Derrick Jones Jr.', number: 55, position: 'PF', ppg: 10.4, apg: 1.0, rpg: 3.5, threePm: 1.2 },
      { id: 'lac5', name: 'Ivica Zubac', number: 40, position: 'C', ppg: 15.2, apg: 2.6, rpg: 12.4, threePm: 0.0 }
    ],
    bench: [
      { id: 'lac6', name: 'Kawhi Leonard', number: 2, position: 'SF', ppg: 23.7, apg: 3.6, rpg: 6.1, threePm: 2.1, isInjured: true, injuryStatus: 'Out' },
      { id: 'lac7', name: 'Kevin Porter Jr.', number: 7, position: 'SG', ppg: 8.8, apg: 3.1, rpg: 3.2, threePm: 0.9 },
      { id: 'lac8', name: 'Nicolas Batum', number: 33, position: 'PF', ppg: 5.6, apg: 1.8, rpg: 3.0, threePm: 1.2 }
    ]
  },

  // 14. Los Angeles Lakers
  lakers: {
    coach: 'JJ Redick',
    starters: [
      { id: 'lal1', name: "D'Angelo Russell", number: 1, position: 'PG', ppg: 13.8, apg: 5.2, rpg: 2.6, threePm: 2.2 },
      { id: 'lal2', name: 'Austin Reaves', number: 15, position: 'SG', ppg: 17.6, apg: 5.4, rpg: 3.8, threePm: 2.4 },
      { id: 'lal3', name: 'LeBron James', number: 23, position: 'SF', ppg: 23.2, apg: 9.1, rpg: 8.0, threePm: 2.2 },
      { id: 'lal4', name: 'Rui Hachimura', number: 28, position: 'PF', ppg: 12.8, apg: 1.6, rpg: 6.1, threePm: 1.6 },
      { id: 'lal5', name: 'Anthony Davis', number: 3, position: 'C', ppg: 28.5, apg: 3.4, rpg: 11.4, threePm: 0.5 }
    ],
    bench: [
      { id: 'lal6', name: 'Dalton Knecht', number: 4, position: 'SG', ppg: 11.4, apg: 1.2, rpg: 2.8, threePm: 2.3 },
      { id: 'lal7', name: 'Gabe Vincent', number: 7, position: 'PG', ppg: 4.8, apg: 1.4, rpg: 1.2, threePm: 1.0 },
      { id: 'lal8', name: 'Jaxson Hayes', number: 11, position: 'C', ppg: 6.4, apg: 0.8, rpg: 4.6, threePm: 0.0 }
    ]
  },

  // 15. Memphis Grizzlies
  grizzlies: {
    coach: 'Taylor Jenkins',
    starters: [
      { id: 'mem1', name: 'Ja Morant', number: 12, position: 'PG', ppg: 20.6, apg: 9.1, rpg: 5.0, threePm: 1.6 },
      { id: 'mem2', name: 'Desmond Bane', number: 22, position: 'SG', ppg: 18.8, apg: 4.2, rpg: 5.6, threePm: 2.8 },
      { id: 'mem3', name: 'Marcus Smart', number: 36, position: 'SF', ppg: 9.8, apg: 3.8, rpg: 2.5, threePm: 1.5 },
      { id: 'mem4', name: 'Jaren Jackson Jr.', number: 13, position: 'PF', ppg: 23.2, apg: 1.8, rpg: 5.8, threePm: 2.0 },
      { id: 'mem5', name: 'Zach Edey', number: 14, position: 'C', ppg: 11.2, apg: 0.8, rpg: 8.2, threePm: 0.6 }
    ],
    bench: [
      { id: 'mem6', name: 'Santi Aldama', number: 7, position: 'PF', ppg: 12.5, apg: 3.2, rpg: 7.4, threePm: 1.8 },
      { id: 'mem7', name: 'Scotty Pippen Jr.', number: 1, position: 'PG', ppg: 11.8, apg: 5.6, rpg: 3.8, threePm: 1.2 },
      { id: 'mem8', name: 'Luke Kennard', number: 10, position: 'SG', ppg: 8.6, apg: 3.2, rpg: 2.2, threePm: 1.9 }
    ]
  },

  // 16. Miami Heat
  heat: {
    coach: 'Erik Spoelstra',
    starters: [
      { id: 'mia1', name: 'Terry Rozier', number: 2, position: 'PG', ppg: 14.2, apg: 3.8, rpg: 3.6, threePm: 2.1 },
      { id: 'mia2', name: 'Tyler Herro', number: 14, position: 'SG', ppg: 24.2, apg: 5.2, rpg: 5.0, threePm: 3.6 },
      { id: 'mia3', name: 'Jimmy Butler', number: 22, position: 'SF', ppg: 18.0, apg: 5.0, rpg: 5.4, threePm: 0.6 },
      { id: 'mia4', name: 'Nikola Jovic', number: 5, position: 'PF', ppg: 9.8, apg: 2.8, rpg: 4.8, threePm: 1.4 },
      { id: 'mia5', name: 'Bam Adebayo', number: 13, position: 'C', ppg: 16.4, apg: 4.4, rpg: 9.8, threePm: 1.0 }
    ],
    bench: [
      { id: 'mia6', name: 'Jaime Jaquez Jr.', number: 11, position: 'SF', ppg: 10.2, apg: 2.6, rpg: 6.2, threePm: 0.8 },
      { id: 'mia7', name: 'Duncan Robinson', number: 55, position: 'SG', ppg: 10.8, apg: 2.2, rpg: 2.4, threePm: 2.6 },
      { id: 'mia8', name: 'Haywood Highsmith', number: 24, position: 'PF', ppg: 7.2, apg: 1.4, rpg: 3.6, threePm: 1.2 }
    ]
  },

  // 17. Milwaukee Bucks
  bucks: {
    coach: 'Doc Rivers',
    starters: [
      { id: 'mil1', name: 'Damian Lillard', number: 0, position: 'PG', ppg: 25.4, apg: 6.8, rpg: 4.4, threePm: 3.2 },
      { id: 'mil2', name: 'Gary Trent Jr.', number: 5, position: 'SG', ppg: 9.8, apg: 1.2, rpg: 1.8, threePm: 1.8 },
      { id: 'mil3', name: 'Taurean Prince', number: 12, position: 'SF', ppg: 8.5, apg: 1.8, rpg: 4.8, threePm: 1.6 },
      { id: 'mil4', name: 'Giannis Antetokounmpo', number: 34, position: 'PF', ppg: 32.4, apg: 6.2, rpg: 12.0, threePm: 0.2 },
      { id: 'mil5', name: 'Brook Lopez', number: 11, position: 'C', ppg: 12.8, apg: 1.8, rpg: 5.2, threePm: 2.0 }
    ],
    bench: [
      { id: 'mil6', name: 'Bobby Portis', number: 9, position: 'PF', ppg: 13.6, apg: 1.2, rpg: 8.0, threePm: 1.1 },
      { id: 'mil7', name: 'Khris Middleton', number: 22, position: 'SF', ppg: 15.1, apg: 5.3, rpg: 4.7, threePm: 1.7, isInjured: true, injuryStatus: 'GTD' },
      { id: 'mil8', name: 'Pat Connaughton', number: 24, position: 'SG', ppg: 5.8, apg: 1.8, rpg: 3.0, threePm: 1.2 }
    ]
  },

  // 18. Minnesota Timberwolves
  timberwolves: {
    coach: 'Chris Finch',
    starters: [
      { id: 'min1', name: 'Mike Conley', number: 10, position: 'PG', ppg: 8.8, apg: 4.8, rpg: 3.0, threePm: 1.8 },
      { id: 'min2', name: 'Anthony Edwards', number: 5, position: 'SG', ppg: 28.1, apg: 3.8, rpg: 5.4, threePm: 4.6 },
      { id: 'min3', name: 'Jaden McDaniels', number: 3, position: 'SF', ppg: 10.4, apg: 1.6, rpg: 3.6, threePm: 1.2 },
      { id: 'min4', name: 'Julius Randle', number: 30, position: 'PF', ppg: 21.6, apg: 4.4, rpg: 6.8, threePm: 1.8 },
      { id: 'min5', name: 'Rudy Gobert', number: 27, position: 'C', ppg: 11.0, apg: 1.8, rpg: 11.2, threePm: 0.0 }
    ],
    bench: [
      { id: 'min6', name: 'Naz Reid', number: 11, position: 'C', ppg: 14.8, apg: 1.8, rpg: 5.6, threePm: 2.3 },
      { id: 'min7', name: 'Donte DiVincenzo', number: 0, position: 'SG', ppg: 10.2, apg: 3.4, rpg: 3.2, threePm: 2.2 },
      { id: 'min8', name: 'Nickeil Alexander-Walker', number: 9, position: 'SG', ppg: 9.6, apg: 2.6, rpg: 2.8, threePm: 1.9 }
    ]
  },

  // 19. New Orleans Pelicans
  pelicans: {
    coach: 'Willie Green',
    starters: [
      { id: 'nop1', name: 'Dejounte Murray', number: 5, position: 'PG', ppg: 18.4, apg: 6.8, rpg: 5.6, threePm: 1.8 },
      { id: 'nop2', name: 'CJ McCollum', number: 3, position: 'SG', ppg: 19.2, apg: 3.8, rpg: 3.6, threePm: 3.0 },
      { id: 'nop3', name: 'Brandon Ingram', number: 14, position: 'SF', ppg: 22.8, apg: 5.4, rpg: 5.8, threePm: 2.2 },
      { id: 'nop4', name: 'Zion Williamson', number: 1, position: 'PF', ppg: 22.7, apg: 5.3, rpg: 8.0, threePm: 0.1, isInjured: true, injuryStatus: 'GTD' },
      { id: 'nop5', name: 'Daniel Theis', number: 10, position: 'C', ppg: 5.2, apg: 1.8, rpg: 4.8, threePm: 0.4 }
    ],
    bench: [
      { id: 'nop6', name: 'Trey Murphy III', number: 25, position: 'SF', ppg: 15.6, apg: 2.4, rpg: 4.8, threePm: 2.8 },
      { id: 'nop7', name: 'Herb Jones', number: 5, position: 'SF', ppg: 10.2, apg: 2.4, rpg: 3.6, threePm: 1.4 },
      { id: 'nop8', name: 'Jordan Hawkins', number: 24, position: 'SG', ppg: 12.8, apg: 1.4, rpg: 3.2, threePm: 2.2 }
    ]
  },

  // 20. New York Knicks
  knicks: {
    coach: 'Tom Thibodeau',
    starters: [
      { id: 'nyk1', name: 'Jalen Brunson', number: 11, position: 'PG', ppg: 25.2, apg: 7.4, rpg: 3.2, threePm: 2.4 },
      { id: 'nyk2', name: 'Mikal Bridges', number: 25, position: 'SG', ppg: 16.5, apg: 3.8, rpg: 3.8, threePm: 2.2 },
      { id: 'nyk3', name: 'OG Anunoby', number: 8, position: 'SF', ppg: 17.4, apg: 2.4, rpg: 5.0, threePm: 2.4 },
      { id: 'nyk4', name: 'Josh Hart', number: 3, position: 'PF', ppg: 13.8, apg: 5.8, rpg: 8.8, threePm: 1.2 },
      { id: 'nyk5', name: 'Karl-Anthony Towns', number: 32, position: 'C', ppg: 25.8, apg: 3.2, rpg: 12.6, threePm: 2.5 }
    ],
    bench: [
      { id: 'nyk6', name: 'Miles McBride', number: 2, position: 'PG', ppg: 10.8, apg: 2.4, rpg: 2.6, threePm: 2.4 },
      { id: 'nyk7', name: 'Cameron Payne', number: 1, position: 'PG', ppg: 6.8, apg: 3.2, rpg: 1.8, threePm: 1.2 },
      { id: 'nyk8', name: 'Precious Achiuwa', number: 5, position: 'C', ppg: 7.4, apg: 1.1, rpg: 6.2, threePm: 0.2 }
    ]
  },

  // 21. Oklahoma City Thunder
  thunder: {
    coach: 'Mark Daigneault',
    starters: [
      { id: 'okc1', name: 'Shai Gilgeous-Alexander', number: 2, position: 'PG', ppg: 28.5, apg: 6.4, rpg: 5.3, threePm: 1.9 },
      { id: 'okc2', name: 'Cason Wallace', number: 22, position: 'SG', ppg: 7.2, apg: 2.2, rpg: 3.4, threePm: 1.2 },
      { id: 'okc3', name: 'Luguentz Dort', number: 5, position: 'SF', ppg: 10.8, apg: 1.6, rpg: 3.8, threePm: 2.2 },
      { id: 'okc4', name: 'Jalen Williams', number: 8, position: 'PF', ppg: 21.8, apg: 5.2, rpg: 6.4, threePm: 1.8 },
      { id: 'okc5', name: 'Chet Holmgren', number: 7, position: 'C', ppg: 16.4, apg: 2.2, rpg: 8.7, threePm: 1.5, isInjured: true, injuryStatus: 'Out' }
    ],
    bench: [
      { id: 'okc6', name: 'Alex Caruso', number: 9, position: 'SG', ppg: 6.4, apg: 2.4, rpg: 3.0, threePm: 1.1 },
      { id: 'okc7', name: 'Isaiah Hartenstein', number: 55, position: 'C', ppg: 12.0, apg: 3.8, rpg: 11.0, threePm: 0.0 },
      { id: 'okc8', name: 'Aaron Wiggins', number: 21, position: 'SG', ppg: 10.4, apg: 1.8, rpg: 3.6, threePm: 1.5 }
    ]
  },

  // 22. Orlando Magic
  magic: {
    coach: 'Jamahl Mosley',
    starters: [
      { id: 'orl1', name: 'Jalen Suggs', number: 4, position: 'PG', ppg: 15.0, apg: 4.0, rpg: 4.8, threePm: 2.2 },
      { id: 'orl2', name: 'Kentavious Caldwell-Pope', number: 3, position: 'SG', ppg: 8.8, apg: 2.0, rpg: 2.4, threePm: 1.5 },
      { id: 'orl3', name: 'Franz Wagner', number: 22, position: 'SF', ppg: 23.5, apg: 5.6, rpg: 5.8, threePm: 2.0 },
      { id: 'orl4', name: 'Paolo Banchero', number: 5, position: 'PF', ppg: 29.0, apg: 5.6, rpg: 8.8, threePm: 2.2, isInjured: true, injuryStatus: 'Out' },
      { id: 'orl5', name: 'Wendell Carter Jr.', number: 34, position: 'C', ppg: 8.6, apg: 2.0, rpg: 8.4, threePm: 0.8 }
    ],
    bench: [
      { id: 'orl6', name: 'Moritz Wagner', number: 21, position: 'C', ppg: 12.6, apg: 1.6, rpg: 4.8, threePm: 0.8 },
      { id: 'orl7', name: 'Cole Anthony', number: 50, position: 'PG', ppg: 6.8, apg: 2.8, rpg: 2.6, threePm: 0.9 },
      { id: 'orl8', name: 'Jonathan Isaac', number: 1, position: 'PF', ppg: 6.2, apg: 0.8, rpg: 4.6, threePm: 0.8 }
    ]
  },

  // 23. Philadelphia 76ers
  sixers: {
    coach: 'Nick Nurse',
    starters: [
      { id: 'phi1', name: 'Tyrese Maxey', number: 0, position: 'PG', ppg: 27.6, apg: 4.2, rpg: 3.4, threePm: 3.2 },
      { id: 'phi2', name: 'Kelly Oubre Jr.', number: 9, position: 'SG', ppg: 14.2, apg: 1.8, rpg: 4.8, threePm: 1.5 },
      { id: 'phi3', name: 'Paul George', number: 8, position: 'SF', ppg: 16.5, apg: 5.2, rpg: 5.6, threePm: 2.2 },
      { id: 'phi4', name: 'Caleb Martin', number: 16, position: 'PF', ppg: 9.8, apg: 2.4, rpg: 5.0, threePm: 1.1 },
      { id: 'phi5', name: 'Joel Embiid', number: 21, position: 'C', ppg: 28.0, apg: 4.5, rpg: 10.2, threePm: 1.2 }
    ],
    bench: [
      { id: 'phi6', name: 'Kyle Lowry', number: 7, position: 'PG', ppg: 6.5, apg: 3.8, rpg: 2.6, threePm: 1.2 },
      { id: 'phi7', name: 'Andre Drummond', number: 5, position: 'C', ppg: 8.8, apg: 1.2, rpg: 9.2, threePm: 0.0 },
      { id: 'phi8', name: 'Guerschon Yabusele', number: 28, position: 'PF', ppg: 9.4, apg: 2.0, rpg: 4.6, threePm: 1.2 }
    ]
  },

  // 24. Phoenix Suns
  suns: {
    coach: 'Mike Budenholzer',
    starters: [
      { id: 'phx1', name: 'Tyus Jones', number: 21, position: 'PG', ppg: 10.8, apg: 6.8, rpg: 2.8, threePm: 1.6 },
      { id: 'phx2', name: 'Devin Booker', number: 1, position: 'SG', ppg: 24.8, apg: 6.6, rpg: 3.8, threePm: 2.6 },
      { id: 'phx3', name: 'Bradley Beal', number: 3, position: 'SF', ppg: 18.2, apg: 3.6, rpg: 3.8, threePm: 2.4 },
      { id: 'phx4', name: 'Kevin Durant', number: 35, position: 'PF', ppg: 27.6, apg: 3.4, rpg: 6.6, threePm: 2.8 },
      { id: 'phx5', name: 'Jusuf Nurkic', number: 20, position: 'C', ppg: 9.2, apg: 1.8, rpg: 9.8, threePm: 0.5 }
    ],
    bench: [
      { id: 'phx6', name: 'Grayson Allen', number: 8, position: 'SG', ppg: 11.2, apg: 1.8, rpg: 3.2, threePm: 2.5 },
      { id: 'phx7', name: "Royce O'Neale", number: 0, position: 'SF', ppg: 10.6, apg: 2.4, rpg: 6.0, threePm: 2.2 },
      { id: 'phx8', name: 'Mason Plumlee', number: 22, position: 'C', ppg: 5.0, apg: 1.6, rpg: 5.6, threePm: 0.0 }
    ]
  },

  // 25. Portland Trail Blazers
  blazers: {
    coach: 'Chauncey Billups',
    starters: [
      { id: 'por1', name: 'Anfernee Simons', number: 1, position: 'PG', ppg: 16.8, apg: 4.6, rpg: 2.6, threePm: 2.6 },
      { id: 'por2', name: 'Shaedon Sharpe', number: 17, position: 'SG', ppg: 17.4, apg: 2.4, rpg: 4.2, threePm: 1.8 },
      { id: 'por3', name: 'Toumani Camara', number: 33, position: 'SF', ppg: 9.2, apg: 2.2, rpg: 4.8, threePm: 1.2 },
      { id: 'por4', name: 'Jerami Grant', number: 9, position: 'PF', ppg: 16.5, apg: 2.2, rpg: 3.4, threePm: 2.2 },
      { id: 'por5', name: 'Deandre Ayton', number: 2, position: 'C', ppg: 14.2, apg: 1.4, rpg: 10.8, threePm: 0.2 }
    ],
    bench: [
      { id: 'por6', name: 'Deni Avdija', number: 8, position: 'SF', ppg: 10.8, apg: 3.2, rpg: 5.8, threePm: 1.0 },
      { id: 'por7', name: 'Scoot Henderson', number: 0, position: 'PG', ppg: 11.8, apg: 5.2, rpg: 3.0, threePm: 1.2 },
      { id: 'por8', name: 'Donovan Clingan', number: 23, position: 'C', ppg: 6.0, apg: 0.8, rpg: 6.2, threePm: 0.1 }
    ]
  },

  // 26. Sacramento Kings
  kings: {
    coach: 'Mike Brown',
    starters: [
      { id: 'sac1', name: "De'Aaron Fox", number: 5, position: 'PG', ppg: 28.8, apg: 4.8, rpg: 5.0, threePm: 2.4 },
      { id: 'sac2', name: 'Keon Ellis', number: 23, position: 'SG', ppg: 8.2, apg: 1.6, rpg: 2.8, threePm: 1.6 },
      { id: 'sac3', name: 'DeMar DeRozan', number: 10, position: 'SF', ppg: 22.8, apg: 4.2, rpg: 4.2, threePm: 1.0 },
      { id: 'sac4', name: 'Keegan Murray', number: 13, position: 'PF', ppg: 13.6, apg: 1.8, rpg: 7.8, threePm: 2.2 },
      { id: 'sac5', name: 'Domantas Sabonis', number: 11, position: 'C', ppg: 20.2, apg: 6.6, rpg: 12.8, threePm: 0.6 }
    ],
    bench: [
      { id: 'sac6', name: 'Malik Monk', number: 0, position: 'SG', ppg: 13.4, apg: 3.2, rpg: 3.0, threePm: 1.6 },
      { id: 'sac7', name: 'Kevin Huerter', number: 9, position: 'SG', ppg: 10.5, apg: 1.8, rpg: 3.4, threePm: 1.8 },
      { id: 'sac8', name: 'Trey Lyles', number: 41, position: 'PF', ppg: 7.8, apg: 1.2, rpg: 4.6, threePm: 1.4 }
    ]
  },

  // 27. San Antonio Spurs
  spurs: {
    coach: 'Gregg Popovich',
    starters: [
      { id: 'sas1', name: 'Chris Paul', number: 3, position: 'PG', ppg: 10.6, apg: 8.4, rpg: 3.8, threePm: 1.8 },
      { id: 'sas2', name: 'Devin Vassell', number: 24, position: 'SG', ppg: 17.5, apg: 3.4, rpg: 3.8, threePm: 2.4 },
      { id: 'sas3', name: 'Harrison Barnes', number: 40, position: 'SF', ppg: 11.8, apg: 1.6, rpg: 4.2, threePm: 1.8 },
      { id: 'sas4', name: 'Jeremy Sochan', number: 10, position: 'PF', ppg: 15.4, apg: 3.0, rpg: 7.8, threePm: 0.6 },
      { id: 'sas5', name: 'Victor Wembanyama', number: 1, position: 'C', ppg: 24.2, apg: 3.8, rpg: 10.6, threePm: 3.2 }
    ],
    bench: [
      { id: 'sas6', name: 'Keldon Johnson', number: 0, position: 'SF', ppg: 12.6, apg: 1.6, rpg: 5.4, threePm: 1.2 },
      { id: 'sas7', name: 'Stephon Castle', number: 5, position: 'PG', ppg: 11.2, apg: 3.6, rpg: 2.8, threePm: 0.9 },
      { id: 'sas8', name: 'Zach Collins', number: 23, position: 'C', ppg: 6.8, apg: 1.8, rpg: 3.8, threePm: 0.5 }
    ]
  },

  // 28. Toronto Raptors
  raptors: {
    coach: 'Darko Rajakovic',
    starters: [
      { id: 'tor1', name: 'Immanuel Quickley', number: 5, position: 'PG', ppg: 15.6, apg: 5.8, rpg: 3.2, threePm: 2.2 },
      { id: 'tor2', name: 'Gradey Dick', number: 1, position: 'SG', ppg: 18.2, apg: 2.4, rpg: 3.0, threePm: 2.6 },
      { id: 'tor3', name: 'RJ Barrett', number: 9, position: 'SF', ppg: 23.2, apg: 6.2, rpg: 6.4, threePm: 1.8 },
      { id: 'tor4', name: 'Scottie Barnes', number: 4, position: 'PF', ppg: 20.4, apg: 6.8, rpg: 8.6, threePm: 1.2 },
      { id: 'tor5', name: 'Jakob Poeltl', number: 19, position: 'C', ppg: 15.8, apg: 2.8, rpg: 11.6, threePm: 0.0 }
    ],
    bench: [
      { id: 'tor6', name: 'Davion Mitchell', number: 45, position: 'PG', ppg: 8.8, apg: 5.0, rpg: 2.0, threePm: 1.0 },
      { id: 'tor7', name: 'Ochai Agbaji', number: 30, position: 'SG', ppg: 11.4, apg: 1.8, rpg: 4.8, threePm: 1.4 },
      { id: 'tor8', name: 'Chris Boucher', number: 25, position: 'PF', ppg: 9.8, apg: 0.8, rpg: 4.4, threePm: 1.4 }
    ]
  },

  // 29. Utah Jazz
  jazz: {
    coach: 'Will Hardy',
    starters: [
      { id: 'uta1', name: 'Keyonte George', number: 3, position: 'PG', ppg: 15.2, apg: 5.6, rpg: 3.2, threePm: 2.4 },
      { id: 'uta2', name: 'Collin Sexton', number: 2, position: 'SG', ppg: 17.8, apg: 3.4, rpg: 2.8, threePm: 1.6 },
      { id: 'uta3', name: 'Lauri Markkanen', number: 23, position: 'SF', ppg: 19.8, apg: 2.0, rpg: 6.4, threePm: 2.8 },
      { id: 'uta4', name: 'John Collins', number: 20, position: 'PF', ppg: 18.2, apg: 2.6, rpg: 8.8, threePm: 1.4 },
      { id: 'uta5', name: 'Walker Kessler', number: 24, position: 'C', ppg: 9.6, apg: 1.2, rpg: 10.8, threePm: 0.0 }
    ],
    bench: [
      { id: 'uta6', name: 'Jordan Clarkson', number: 0, position: 'SG', ppg: 15.4, apg: 3.8, rpg: 3.8, threePm: 2.0 },
      { id: 'uta7', name: 'Cody Williams', number: 5, position: 'SF', ppg: 7.8, apg: 1.6, rpg: 2.8, threePm: 0.8 },
      { id: 'uta8', name: 'Kyle Filipowski', number: 22, position: 'PF', ppg: 8.4, apg: 2.0, rpg: 4.8, threePm: 0.6 }
    ]
  },

  // 30. Washington Wizards
  wizards: {
    coach: 'Brian Keefe',
    starters: [
      { id: 'was1', name: 'Jordan Poole', number: 13, position: 'PG', ppg: 21.2, apg: 4.8, rpg: 2.4, threePm: 3.6 },
      { id: 'was2', name: 'Carlton Carrington', number: 8, position: 'SG', ppg: 10.2, apg: 4.8, rpg: 4.4, threePm: 1.5 },
      { id: 'was3', name: 'Bilal Coulibaly', number: 0, position: 'SF', ppg: 14.8, apg: 2.8, rpg: 5.6, threePm: 1.4 },
      { id: 'was4', name: 'Alexandre Sarr', number: 20, position: 'PF', ppg: 11.8, apg: 2.2, rpg: 6.4, threePm: 1.6 },
      { id: 'was5', name: 'Jonas Valanciunas', number: 17, position: 'C', ppg: 12.6, apg: 2.2, rpg: 8.2, threePm: 0.2 }
    ],
    bench: [
      { id: 'was6', name: 'Kyle Kuzma', number: 33, position: 'PF', ppg: 17.0, apg: 3.0, rpg: 6.2, threePm: 1.4 },
      { id: 'was7', name: 'Corey Kispert', number: 24, position: 'SF', ppg: 11.2, apg: 1.6, rpg: 2.8, threePm: 2.0 },
      { id: 'was8', name: 'Kyshawn George', number: 18, position: 'SG', ppg: 8.6, apg: 2.4, rpg: 3.8, threePm: 1.6 }
    ]
  }
};

/**
 * Searches the 30-team NBA roster database using team name, city, shortName or abbreviation
 */
export function findNBARosterForTeam(teamNameOrAbbrev: string): NBARosterEntry | null {
  if (!teamNameOrAbbrev) return null;
  const lower = teamNameOrAbbrev.toLowerCase().trim();

  // 1. Direct key match
  if (NBA_30_TEAMS_ROSTERS[lower]) {
    return NBA_30_TEAMS_ROSTERS[lower];
  }

  // 2. Substring matching
  const matchingKey = Object.keys(NBA_30_TEAMS_ROSTERS).find((k) => {
    return lower.includes(k) || k.includes(lower);
  });
  if (matchingKey) {
    return NBA_30_TEAMS_ROSTERS[matchingKey];
  }

  // 3. Known aliases and abbreviations
  const ALIAS_MAP: Record<string, string> = {
    gsw: 'warriors',
    gs: 'warriors',
    golden: 'warriors',
    lal: 'lakers',
    la_lakers: 'lakers',
    lac: 'clippers',
    la_clippers: 'clippers',
    bos: 'celtics',
    boston: 'celtics',
    bkn: 'nets',
    brooklyn: 'nets',
    nyk: 'knicks',
    new_york: 'knicks',
    phi: 'sixers',
    philly: 'sixers',
    philadelphia: 'sixers',
    tor: 'raptors',
    toronto: 'raptors',
    chi: 'bulls',
    chicago: 'bulls',
    cle: 'cavaliers',
    cleveland: 'cavaliers',
    det: 'pistons',
    detroit: 'pistons',
    ind: 'pacers',
    indiana: 'pacers',
    mil: 'bucks',
    milwaukee: 'bucks',
    atl: 'hawks',
    atlanta: 'hawks',
    cha: 'hornets',
    charlotte: 'hornets',
    mia: 'heat',
    miami: 'heat',
    orl: 'magic',
    orlando: 'magic',
    was: 'wizards',
    wsh: 'wizards',
    washington: 'wizards',
    den: 'nuggets',
    denver: 'nuggets',
    min: 'timberwolves',
    minnesota: 'timberwolves',
    wolves: 'timberwolves',
    okc: 'thunder',
    oklahoma: 'thunder',
    por: 'blazers',
    portland: 'blazers',
    trail: 'blazers',
    uta: 'jazz',
    utah: 'jazz',
    dal: 'mavericks',
    dallas: 'mavericks',
    hou: 'rockets',
    houston: 'rockets',
    mem: 'grizzlies',
    memphis: 'grizzlies',
    nop: 'pelicans',
    no: 'pelicans',
    orleans: 'pelicans',
    sas: 'spurs',
    sa: 'spurs',
    san_antonio: 'spurs',
    sac: 'kings',
    sacramento: 'kings',
    phx: 'suns',
    phoenix: 'suns'
  };

  for (const [alias, canonicalKey] of Object.entries(ALIAS_MAP)) {
    if (lower.includes(alias)) {
      return NBA_30_TEAMS_ROSTERS[canonicalKey] || null;
    }
  }

  return null;
}
