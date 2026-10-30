import { MatchFixture } from '../types';

export interface LeagueInfo {
  id: number | string;
  name: string;
  country: string;
  flag?: string;
  matchCount: number;
  categoryKey: string;
}

export interface CompetitionGroup {
  key: string;
  name: string;
  displayName: string;
  category: 'INTERNATIONAL' | 'COUNTRY' | 'OTHER';
  flag: string;
  priority: number; // lower = higher in list
  totalMatches: number;
  leagues: LeagueInfo[];
  fixtures: MatchFixture[];
}

// Known international tournament indicators
const INTL_KEYWORDS = [
  'champions league',
  'europa league',
  'conference league',
  'uefa',
  'copa libertadores',
  'copa sudamericana',
  'recopa',
  'conmebol',
  'concacaf',
  'leagues cup',
  'gold cup',
  'afc champions',
  'caf champions',
  'fifa club',
  'club world cup',
  'mundial de clubes',
  'world cup',
  'copa america',
  'copa américa',
  'euro 20',
  'eurocopa',
  'nations league',
  'friendlies international',
  'international friendlies',
  'amistosos internacionales'
];

const INTL_COUNTRIES = [
  'world',
  'europe',
  'south america',
  'north & central america',
  'central america',
  'asia',
  'africa',
  'international'
];

// Country normalization & friendly names with flags
interface CountryMeta {
  spanishName: string;
  flag: string;
  priority: number;
  aliases: string[];
}

const COUNTRY_METAS: Record<string, CountryMeta> = {
  COLOMBIA: {
    spanishName: 'Colombia',
    flag: '🇨🇴',
    priority: 1,
    aliases: ['colombia', 'copa betplay', 'torneo betplay', 'liga betplay', 'primera a colombia', 'primera b colombia']
  },
  ENGLAND: {
    spanishName: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    priority: 2,
    aliases: ['england', 'inglaterra', 'premier league', 'championship', 'fa cup', 'efl cup', 'league one', 'league two']
  },
  SPAIN: {
    spanishName: 'España',
    flag: '🇪🇸',
    priority: 3,
    aliases: ['spain', 'espana', 'españa', 'laliga', 'la liga', 'copa del rey', 'segunda division']
  },
  ARGENTINA: {
    spanishName: 'Argentina',
    flag: '🇦🇷',
    priority: 4,
    aliases: ['argentina', 'liga profesional', 'copa de la liga', 'primera nacional', 'copa argentina']
  },
  BRAZIL: {
    spanishName: 'Brasil',
    flag: '🇧🇷',
    priority: 5,
    aliases: ['brazil', 'brasil', 'serie a brazil', 'serie a brasil', 'copa do brasil', 'paulista', 'carioca', 'brasileirao', 'brasileirão']
  },
  ITALY: {
    spanishName: 'Italia',
    flag: '🇮🇹',
    priority: 6,
    aliases: ['italy', 'italia', 'serie a', 'coppa italia', 'serie b']
  },
  GERMANY: {
    spanishName: 'Alemania',
    flag: '🇩🇪',
    priority: 7,
    aliases: ['germany', 'alemania', 'bundesliga', 'dfb pokal', '2. bundesliga']
  },
  FRANCE: {
    spanishName: 'Francia',
    flag: '🇫🇷',
    priority: 8,
    aliases: ['france', 'francia', 'ligue 1', 'coupe de france', 'ligue 2']
  },
  MEXICO: {
    spanishName: 'México',
    flag: '🇲🇽',
    priority: 9,
    aliases: ['mexico', 'méxico', 'liga mx', 'copa mx', 'expansion mx', 'expansión mx']
  },
  USA: {
    spanishName: 'Estados Unidos',
    flag: '🇺🇸',
    priority: 10,
    aliases: ['usa', 'united states', 'estados unidos', 'mls', 'major league soccer', 'us open cup', 'usl']
  },
  PORTUGAL: {
    spanishName: 'Portugal',
    flag: '🇵🇹',
    priority: 11,
    aliases: ['portugal', 'primeira liga', 'taca de portugal', 'taça de portugal', 'liga portugal']
  },
  NETHERLANDS: {
    spanishName: 'Países Bajos',
    flag: '🇳🇱',
    priority: 12,
    aliases: ['netherlands', 'paises bajos', 'países bajos', 'holanda', 'eredivisie', 'knvb beker']
  },
  SAUDI_ARABIA: {
    spanishName: 'Arabia Saudita',
    flag: '🇸🇦',
    priority: 13,
    aliases: ['saudi arabia', 'arabia saudita', 'saudi pro league', 'king cup']
  },
  TURKEY: {
    spanishName: 'Turquía',
    flag: '🇹🇷',
    priority: 14,
    aliases: ['turkey', 'turquía', 'turquia', 'super lig', 'süper lig', 'turkish cup']
  },
  CHILE: {
    spanishName: 'Chile',
    flag: '🇨🇱',
    priority: 15,
    aliases: ['chile', 'primera division chile', 'primera división chile', 'copa chile']
  },
  URUGUAY: {
    spanishName: 'Uruguay',
    flag: '🇺🇾',
    priority: 16,
    aliases: ['uruguay', 'primera division uruguay', 'campeonato uruguayo']
  },
  ECUADOR: {
    spanishName: 'Ecuador',
    flag: '🇪🇨',
    priority: 17,
    aliases: ['ecuador', 'liga pro ecuador', 'copa ecuador']
  },
  PERU: {
    spanishName: 'Perú',
    flag: '🇵🇪',
    priority: 18,
    aliases: ['peru', 'perú', 'liga 1 peru', 'copa bicentenario']
  },
  PARAGUAY: {
    spanishName: 'Paraguay',
    flag: '🇵🇾',
    priority: 19,
    aliases: ['paraguay', 'primera division paraguay']
  },
  BOLIVIA: {
    spanishName: 'Bolivia',
    flag: '🇧🇴',
    priority: 20,
    aliases: ['bolivia', 'division profesional bolivia']
  },
  VENEZUELA: {
    spanishName: 'Venezuela',
    flag: '🇻🇪',
    priority: 21,
    aliases: ['venezuela', 'liga futve']
  },
  BELGIUM: {
    spanishName: 'Bélgica',
    flag: '🇧🇪',
    priority: 22,
    aliases: ['belgium', 'belgica', 'bélgica', 'pro league', 'jupiler pro league']
  },
  SCOTLAND: {
    spanishName: 'Escocia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    priority: 23,
    aliases: ['scotland', 'escocia', 'scottish premiership', 'premiership scotland']
  },
  JAPAN: {
    spanishName: 'Japón',
    flag: '🇯🇵',
    priority: 24,
    aliases: ['japan', 'japon', 'japón', 'j1 league', 'j-league', 'emperor cup']
  }
};

// Strictly verified countries offered with full live telemetry & markets in main bookmakers
const ALLOWED_PRIME_COUNTRIES: Record<string, {
  countryMatches: string[];
  allowedLeaguesPattern: RegExp;
  excludedLeaguesPattern?: RegExp;
}> = {
  COLOMBIA: {
    countryMatches: ['colombia'],
    allowedLeaguesPattern: /\b(primera a|primera b|liga betplay|torneo betplay|copa betplay|copa colombia|superliga|dimayor)\b/i
  },
  ENGLAND: {
    countryMatches: ['england', 'inglaterra'],
    allowedLeaguesPattern: /\b(premier league|championship|fa cup|efl cup|carabao cup|community shield)\b/i,
    excludedLeaguesPattern: /\b(premier league 2|u18|u21|u23|national league|league one|league two|efl trophy|isthmian|southern|northern|women|femenina)\b/i
  },
  SPAIN: {
    countryMatches: ['spain', 'espana', 'españa'],
    allowedLeaguesPattern: /\b(la liga|laliga|primera divisi[oó]n|segunda divisi[oó]n|hypermotion|copa del rey|supercopa)\b/i,
    excludedLeaguesPattern: /\b(rfef|tercera|federaci[oó]n|juvenil|women|femenina)\b/i
  },
  ITALY: {
    countryMatches: ['italy', 'italia'],
    allowedLeaguesPattern: /\b(serie a|serie b|coppa italia|supercoppa)\b/i,
    excludedLeaguesPattern: /\b(serie c|serie d|primavera|coppa italia serie|women|femminile)\b/i
  },
  GERMANY: {
    countryMatches: ['germany', 'alemania'],
    allowedLeaguesPattern: /\b(bundesliga|2\. bundesliga|dfb pokal|dfb-pokal|supercup)\b/i,
    excludedLeaguesPattern: /\b(3\. liga|regionalliga|oberliga|junioren|u19|u17|women|frauen)\b/i
  },
  FRANCE: {
    countryMatches: ['france', 'francia'],
    allowedLeaguesPattern: /\b(ligue 1|ligue 2|coupe de france|troph[eé]e des champions)\b/i,
    excludedLeaguesPattern: /\b(national|championnat national|u19|feminine|f[eé]minine)\b/i
  },
  ARGENTINA: {
    countryMatches: ['argentina'],
    allowedLeaguesPattern: /\b(liga profesional|primera divisi[oó]n|copa de la liga|copa argentina|trofeo de campeones|primera nacional)\b/i,
    excludedLeaguesPattern: /\b(primera b|primera c|primera d|torneo federal|reserva|proyecci[oó]n|femenino)\b/i
  },
  BRAZIL: {
    countryMatches: ['brazil', 'brasil'],
    allowedLeaguesPattern: /\b(serie a|s[eé]rie a|serie b|s[eé]rie b|brasileir[aã]o|copa do brasil|supercopa|paulista a1|paulist[aã]o|carioca)\b/i,
    excludedLeaguesPattern: /\b(serie c|s[eé]rie c|serie d|s[eé]rie d|paulista a2|paulista a3|copa verde|sub-20|u20|feminino)\b/i
  },
  MEXICO: {
    countryMatches: ['mexico', 'méxico'],
    allowedLeaguesPattern: /\b(liga mx|expansi[oó]n mx|copa mx|campe[oó]n de campeones)\b/i,
    excludedLeaguesPattern: /\b(liga premier|tdp|sub-23|u23|femenil)\b/i
  },
  USA: {
    countryMatches: ['usa', 'united states', 'estados unidos'],
    allowedLeaguesPattern: /\b(major league soccer|mls|us open cup)\b/i,
    excludedLeaguesPattern: /\b(mls next|usl|nisa|npsl|ncaa)\b/i
  },
  PORTUGAL: {
    countryMatches: ['portugal'],
    allowedLeaguesPattern: /\b(primeira liga|liga portugal|ta[cç]a de portugal|ta[cç]a da liga|superta[cç]a)\b/i,
    excludedLeaguesPattern: /\b(liga 3|campeonato de portugal|revela[cç][aã]o|u23)\b/i
  },
  NETHERLANDS: {
    countryMatches: ['netherlands', 'paises bajos', 'países bajos', 'holanda'],
    allowedLeaguesPattern: /\b(eredivisie|eerste divisie|knvb beker|johan cruijff)\b/i,
    excludedLeaguesPattern: /\b(tweede divisie|derde divisie|u21)\b/i
  },
  SAUDI_ARABIA: {
    countryMatches: ['saudi arabia', 'saudi-arabia', 'arabia saudita'],
    allowedLeaguesPattern: /\b(pro league|professional league|saudi league|king'?s cup|super cup)\b/i,
    excludedLeaguesPattern: /\b(division 1|division 2|youth)\b/i
  },
  TURKEY: {
    countryMatches: ['turkey', 'turquia', 'turquía'],
    allowedLeaguesPattern: /\b(s[uü]per lig|1\. lig|turkish cup|kupasi)\b/i,
    excludedLeaguesPattern: /\b(2\. lig|3\. lig|u19)\b/i
  },
  CHILE: {
    countryMatches: ['chile'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|primera b|copa chile|supercopa)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|tercera)\b/i
  },
  URUGUAY: {
    countryMatches: ['uruguay'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|campeonato uruguayo|torneo apertura|torneo clausura|intermedio)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n|reserva)\b/i
  },
  ECUADOR: {
    countryMatches: ['ecuador'],
    allowedLeaguesPattern: /\b(liga ?pro|serie a|copa ecuador)\b/i,
    excludedLeaguesPattern: /\b(serie b|segunda)\b/i
  },
  PERU: {
    countryMatches: ['peru', 'perú'],
    allowedLeaguesPattern: /\b(liga 1|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(liga 2|copa per[uú]|reserva)\b/i
  },
  PARAGUAY: {
    countryMatches: ['paraguay'],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n|copa de primera|copa paraguay)\b/i,
    excludedLeaguesPattern: /\b(intermedia|reserva)\b/i
  },
  BOLIVIA: {
    countryMatches: ['bolivia'],
    allowedLeaguesPattern: /\b(divisi[oó]n profesional|primera divisi[oó]n)\b/i,
    excludedLeaguesPattern: /\b(sim[oó]n bol[ií]var)\b/i
  },
  VENEZUELA: {
    countryMatches: ['venezuela'],
    allowedLeaguesPattern: /\b(primera divisi[oó]n|liga futve|copa venezuela)\b/i,
    excludedLeaguesPattern: /\b(segunda divisi[oó]n)\b/i
  },
  BELGIUM: {
    countryMatches: ['belgium', 'belgica', 'bélgica'],
    allowedLeaguesPattern: /\b(pro league|jupiler|first division a|beker van belgie|croky cup)\b/i,
    excludedLeaguesPattern: /\b(challenger|amateur|u21)\b/i
  },
  SCOTLAND: {
    countryMatches: ['scotland', 'escocia'],
    allowedLeaguesPattern: /\b(premiership|scottish cup|league cup)\b/i,
    excludedLeaguesPattern: /\b(championship|league one|league two|highland|lowland)\b/i
  },
  JAPAN: {
    countryMatches: ['japan', 'japon', 'japón'],
    allowedLeaguesPattern: /\b(j1 league|j\.league|emperor cup|j-league cup)\b/i,
    excludedLeaguesPattern: /\b(j2 league|j3 league|we league|university)\b/i
  }
};

const NATIONAL_TEAM_COUNTRIES = new Set([
  'colombia', 'argentina', 'brazil', 'brasil', 'uruguay', 'chile', 'ecuador', 'peru', 'paraguay', 'bolivia', 'venezuela',
  'spain', 'espana', 'england', 'inglaterra', 'france', 'francia', 'germany', 'alemania', 'italy', 'italia', 'portugal',
  'netherlands', 'paises bajos', 'holanda', 'belgium', 'belgica', 'croatia', 'croacia', 'switzerland', 'suiza', 'austria',
  'denmark', 'dinamarca', 'sweden', 'suecia', 'norway', 'noruega', 'poland', 'polonia', 'serbia', 'ukraine', 'ucrania',
  'turkey', 'turquia', 'turkiye', 'scotland', 'escocia', 'wales', 'gales', 'ireland', 'republic of ireland', 'irlanda',
  'northern ireland', 'irlanda del norte', 'czech republic', 'czechia', 'republica checa', 'hungary', 'hungria',
  'romania', 'rumania', 'greece', 'grecia', 'slovakia', 'eslovaquia', 'slovenia', 'eslovenia', 'finland', 'finlandia',
  'iceland', 'islandia', 'georgia', 'albania', 'north macedonia', 'macedonia del norte', 'montenegro',
  'bosnia and herzegovina', 'bosnia', 'israel', 'bulgaria', 'kosovo', 'luxembourg', 'belarus', 'armenia',
  'azerbaijan', 'kazakhstan', 'cyprus', 'estonia', 'latvia', 'lithuania', 'malta', 'moldova',
  'usa', 'u.s.', 'us', 'united states', 'estados unidos', 'ee. uu.', 'ee.uu.', 'mexico', 'canada', 'costa rica',
  'panama', 'honduras', 'jamaica', 'el salvador', 'guatemala', 'nicaragua', 'dominican republic', 'republica dominicana',
  'haiti', 'cuba', 'trinidad and tobago', 'puerto rico', 'curacao', 'suriname',
  'japan', 'japon', 'south korea', 'korea republic', 'corea del sur', 'rep. of korea', 'north korea', 'korea dpr',
  'corea del norte', 'australia', 'new zealand', 'nueva zelanda', 'saudi arabia', 'arabia saudita', 'qatar', 'catar',
  'iran', 'iraq', 'irak', 'uzbekistan', 'jordan', 'jordania', 'united arab emirates', 'uae', 'emiratos arabes unidos',
  'bahrain', 'oman', 'syria', 'siria', 'palestine', 'palestina', 'china', 'china pr', 'thailand', 'tailandia',
  'vietnam', 'indonesia', 'malaysia', 'philippines', 'filipinas', 'india', 'tajikistan',
  'morocco', 'marruecos', 'senegal', 'nigeria', 'ghana', 'cameroon', 'camerun', 'egypt', 'egipto', 'algeria', 'argelia',
  'tunisia', 'tunez', 'ivory coast', 'cote d ivoire', 'costa de marfil', 'south africa', 'sudafrica', 'mali', 'zambia',
  'kenya', 'kenia', 'guinea', 'burkina faso', 'cape verde', 'dr congo', 'congo dr', 'angola', 'tanzania', 'uganda', 'zimbabwe'
]);

export function isNationalTeamName(teamName?: string): boolean {
  const norm = (teamName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .trim();
  if (!norm) return false;

  if (
    /\b(fc|cf|sc|ac|cd|ud|sd|rcd|ca|club|sporting|atletico|real|deportivo|dynamo|dinamo|borussia|bayern|inter|milan|juventus|arsenal|chelsea|liverpool|barcelona|madrid|psg|benfica|porto|ajax|boca|river|flamengo|palmeiras|corinthians|santos|gremio|nacional|millonarios|junior|medellin|cali|tolima|once caldas|santa fe|pachuca|chivas|tigres|monterrey|cruz azul|pumas|al ahly|al hilal|al nassr)\b/i.test(
      norm
    )
  ) {
    return false;
  }

  const base = norm
    .replace(
      /\b(u-?17|u-?18|u-?19|u-?20|u-?21|u-?22|u-?23|sub-?17|sub-?18|sub-?19|sub-?20|sub-?21|sub-?22|sub-?23|women s?|femenin[ao]s?|femenil|frauen|femminile|feminino|olimpic[oa]|olympic|national team|seleccion|selecao|w)\b/gi,
      ' '
    )
    .replace(/[()[\]\-_/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return NATIONAL_TEAM_COUNTRIES.has(base);
}

export function isNationalTeamSub17PlusMatch(
  leagueName?: string,
  countryName?: string,
  teamHome?: string,
  teamAway?: string
): boolean {
  const combined = `${leagueName || ''} ${countryName || ''} ${teamHome || ''} ${teamAway || ''}`.toLowerCase();
  if (/\b(u-?1[1-6]|sub-?1[1-6])\b/i.test(combined)) {
    return false;
  }
  return isNationalTeamName(teamHome) && isNationalTeamName(teamAway);
}

/**
 * Excludes club youth (U17, U19, U20, U21, U23), reserve, amateur, and non-prime countries/leagues
 * that lack reliable real-time telemetry (e.g., DR Congo Ligue 1, Ethiopia Premier League, Kyrgyzstan Premier League)
 * while allowing National Team matches from Sub-17 and above (Men & Women).
 */
export function isExcludedYouthOrAmateurLeague(
  leagueName?: string,
  countryName?: string,
  teamHome?: string,
  teamAway?: string
): boolean {
  const lName = (leagueName || '').toLowerCase().trim();
  const cName = (countryName || '').toLowerCase().trim();
  const combined = `${lName} ${cName} ${teamHome || ''} ${teamAway || ''}`.toLowerCase();

  // 0. Always exclude categories below Sub-17 (Sub-15, Sub-16, etc.)
  if (/\b(u-?1[1-6]|sub-?1[1-6])\b/i.test(combined)) {
    return true;
  }

  // 1. Allow National Team matches from Sub-17 and above (Sub-17, Sub-19, Sub-20, Sub-21, Sub-23, Senior — Men & Women)
  if (isNationalTeamSub17PlusMatch(lName, cName, teamHome, teamAway)) {
    return false;
  }

  // 2. Block all club youth, reserve, amateur, regional, lower divisions, and club women's leagues
  if (
    /\b(u15|u16|u17|u18|u19|u20|u21|u22|u23|sub-15|sub-17|sub-19|sub-20|sub-21|sub-23|youth|juvenil|reservas|reserve|amateur|regional|tercera|fourth division|national league north|national league south|non-league|oberliga|regionalliga|primavera|premier league 2|femenin[ao]|women|frauen|femminile|femenil)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  // 2. Check if it is a top-tier International Tournament (UEFA, CONMEBOL, FIFA, CONCACAF, AFC Champions Elite)
  const isEliteIntlCountry = ['world', 'europe', 'south america', 'north & central america', 'asia', 'international', 'europa', 'sudamérica', 'sudamerica', 'internacional'].some(
    (ic) => cName === ic || cName.includes(ic)
  );
  const isEliteIntlTournament =
    /\b(uefa champions|champions league|europa league|conference league|super cup|copa libertadores|libertadores|copa sudamericana|sudamericana|recopa|copa america|copa am[eé]rica|eurocopa|world cup|mundial|nations league|eliminatorias|wc qualification|world cup qualification|concacaf champions|afc champions|leagues cup|gold cup|copa oro|club world cup)\b/i.test(
      lName
    ) &&
    !/\b(caf|ofc|afc cup|asean|cosafa|cecafa|wafcon|u17|u20|u23|women|youth)\b/i.test(`${lName} ${cName}`);

  if (isEliteIntlTournament && (isEliteIntlCountry || !cName)) {
    return false; // Allowed Elite International Tournament
  }

  // 3. Check if the country is one of our 24 verified Prime Bookmaker Countries AND matches its top leagues
  for (const rule of Object.values(ALLOWED_PRIME_COUNTRIES)) {
    const countryMatches = rule.countryMatches.some((cm) => {
      if (cName === cm) return true;
      // Prevent "congo" or "dr congo" or "northern ireland" or "new zealand" from matching anything
      if (cm === 'england' && (cName.includes('new') || cName.includes('northern'))) return false;
      return cName === cm;
    });

    if (countryMatches) {
      if (rule.excludedLeaguesPattern && rule.excludedLeaguesPattern.test(lName)) {
        return true; // Excluded lower division within a prime country
      }
      if (rule.allowedLeaguesPattern.test(lName)) {
        return false; // Allowed top league in a verified prime country!
      }
      return true; // Any other minor cup/regional league in that country is excluded
    }
  }

  // 4. Special case when ESPN or fallback fixture provides country inside league name (e.g., "Liga BetPlay", "LaLiga", "Premier League" with empty country)
  if (!cName) {
    if (
      /\b(betplay|laliga|bundesliga|eredivisie|primeira liga|brasileir[aã]o|liga mx|mls|s[uü]per lig|campeonato uruguayo|liga futve|j1 league)\b/i.test(
        lName
      )
    ) {
      return false;
    }
  }

  // 5. Reject all other countries and minor leagues (DR Congo, Ethiopia, Kyrgyzstan, etc.)
  return true;
}

/**
 * Determines whether a fixture belongs to the Prime Catalog of leagues actively offered
 * with full markets (1X2, Doble Oportunidad, Goles, Córners, Tarjetas) in Colombian bookmakers
 * (BetPlay, Wplay, RushBet, Codere, Rivalo, Bwin) and possessing 100% live statistical reliability.
 */
export function isColombianBookmakerPrimeLeague(fixture: MatchFixture): boolean {
  const lName = (fixture.league?.name || '').toLowerCase().trim();
  const cName = (fixture.league?.country || '').toLowerCase().trim();
  const hName = fixture.homeTeam?.name || '';
  const aName = fixture.awayTeam?.name || '';

  return !isExcludedYouthOrAmateurLeague(lName, cName, hName, aName);
}

/**
 * Determines whether a league is an international tournament
 */
export function isInternationalCompetition(
  leagueName: string,
  countryName?: string,
  teamHome?: string,
  teamAway?: string
): boolean {
  const l = (leagueName || '').toLowerCase().trim();
  const c = (countryName || '').toLowerCase().trim();

  if (isNationalTeamSub17PlusMatch(l, c, teamHome, teamAway)) {
    return true;
  }

  // Country matches international regions
  if (INTL_COUNTRIES.some(ic => c === ic || c.includes(ic) || c === 'internacional')) {
    return true;
  }

  // Name matches known international cups ONLY if country is not a specific national federation
  const isKnownNationalCountry = Object.values(ALLOWED_PRIME_COUNTRIES).some(rule =>
    rule.countryMatches.some(cm => c === cm)
  );
  if (!isKnownNationalCountry && INTL_KEYWORDS.some(kw => l.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Maps a fixture's league to a country key or INTL.
 * Strictly prioritizes exact country match FIRST so homonym league names (like "Ligue 1" or "Premier League")
 * never misclassify foreign countries.
 */
export function identifyCompetitionCategory(
  leagueName: string,
  countryName?: string,
  teamHome?: string,
  teamAway?: string
): {
  key: string;
  name: string;
  displayName: string;
  flag: string;
  isInternational: boolean;
  priority: number;
} {
  const l = (leagueName || '').trim();
  const c = (countryName || '').trim();
  const lLower = l.toLowerCase();
  const cLower = c.toLowerCase();

  // 1. Check International Tournament or National Team Sub-17+ Match
  if (isInternationalCompetition(l, c, teamHome, teamAway)) {
    let flag = '🏆';
    if (lLower.includes('libertadores') || lLower.includes('sudamericana') || lLower.includes('conmebol')) {
      flag = '🌎';
    } else if (lLower.includes('champions') || lLower.includes('europa') || lLower.includes('conference') || lLower.includes('uefa')) {
      flag = '⭐';
    } else if (lLower.includes('concacaf') || lLower.includes('gold cup')) {
      flag = '🏆';
    } else if (lLower.includes('mundial') || lLower.includes('world cup') || lLower.includes('selecciones')) {
      flag = '🌍';
    }

    return {
      key: 'INTL',
      name: 'Torneos Internacionales',
      displayName: `${flag} Torneos Internacionales`,
      flag,
      isInternational: true,
      priority: 0
    };
  }

  // 2. First pass: Strictly check country name (`cLower`) against ALLOWED_PRIME_COUNTRIES & COUNTRY_METAS
  if (cLower) {
    for (const [key, rule] of Object.entries(ALLOWED_PRIME_COUNTRIES)) {
      if (rule.countryMatches.some(cm => cLower === cm)) {
        const meta = COUNTRY_METAS[key];
        if (meta) {
          return {
            key,
            name: meta.spanishName,
            displayName: `${meta.flag} ${meta.spanishName}`,
            flag: meta.flag,
            isInternational: false,
            priority: meta.priority
          };
        }
      }
    }
  }

  // 3. Second pass: Only if country is missing/empty, infer from unambiguous league aliases
  if (!cLower || cLower === 'unknown') {
    for (const [key, meta] of Object.entries(COUNTRY_METAS)) {
      if (meta.aliases.some(alias => lLower.includes(alias))) {
        return {
          key,
          name: meta.spanishName,
          displayName: `${meta.flag} ${meta.spanishName}`,
          flag: meta.flag,
          isInternational: false,
          priority: meta.priority
        };
      }
    }
  }

  // 4. Fallback for any other country
  if (c && c.length > 0 && cLower !== 'unknown') {
    const safeKey = `COUNTRY_${c.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    return {
      key: safeKey,
      name: c,
      displayName: `🌐 ${c}`,
      flag: '🌐',
      isInternational: false,
      priority: 50
    };
  }

  // 5. Fallback unknown
  return {
    key: 'OTHER',
    name: 'Otras Competiciones',
    displayName: '⚽ Otras Competiciones',
    flag: '⚽',
    isInternational: false,
    priority: 99
  };
}

/**
 * Groups all fixtures into categorized CompetitionGroups:
 * - INTL: Torneos Internacionales
 * - Country groups with their leagues
 */
export function groupFixturesByCompetition(fixtures: MatchFixture[]): CompetitionGroup[] {
  const groupsMap = new Map<string, CompetitionGroup>();

  for (const fixture of fixtures) {
    const lName = fixture.league?.name || 'Competición';
    const cName = fixture.league?.country || '';
    const lId = fixture.league?.id || `${lName}-${cName}`;
    const hName = fixture.homeTeam?.name || '';
    const aName = fixture.awayTeam?.name || '';

    const cat = identifyCompetitionCategory(lName, cName, hName, aName);

    if (!groupsMap.has(cat.key)) {
      groupsMap.set(cat.key, {
        key: cat.key,
        name: cat.name,
        displayName: cat.displayName,
        category: cat.isInternational ? 'INTERNATIONAL' : (cat.key === 'OTHER' ? 'OTHER' : 'COUNTRY'),
        flag: cat.flag,
        priority: cat.priority,
        totalMatches: 0,
        leagues: [],
        fixtures: []
      });
    }

    const group = groupsMap.get(cat.key)!;
    group.totalMatches += 1;
    group.fixtures.push(fixture);

    // Track unique league in group
    let leagueEntry = group.leagues.find(lg => lg.id === lId || lg.name === lName);
    if (!leagueEntry) {
      leagueEntry = {
        id: lId,
        name: lName,
        country: cName,
        flag: fixture.league?.flag,
        matchCount: 0,
        categoryKey: cat.key
      };
      group.leagues.push(leagueEntry);
    }
    leagueEntry.matchCount += 1;
  }

  // Sort groups:
  // 1. International first (priority 0)
  // 2. High priority countries (Colombia, England, Spain, etc.)
  // 3. By total match count descending
  // 4. Other competitions at the end
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.totalMatches - a.totalMatches;
  });

  // Sort leagues inside each group by match count
  for (const grp of sortedGroups) {
    grp.leagues.sort((a, b) => b.matchCount - a.matchCount);
    // Sort fixtures in group by time
    grp.fixtures.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  return sortedGroups;
}

/**
 * Filter predicate to match fixtures according to selectedLeague filter value.
 * Strictly guarantees that only matches from the requested league, tournament,
 * or country are returned.
 */
export function matchesLeagueSelection(fixture: MatchFixture, selectedLeague: string): boolean {
  if (!selectedLeague || selectedLeague === 'ALL') {
    return true;
  }
  if (selectedLeague === 'PRIME_CO') {
    return isColombianBookmakerPrimeLeague(fixture);
  }

  const lName = (fixture.league?.name || '').trim();
  const cName = (fixture.league?.country || '').trim();
  const lNameLower = lName.toLowerCase();
  const cNameLower = cName.toLowerCase();
  const lId = fixture.league?.id !== undefined && fixture.league?.id !== null ? String(fixture.league.id).trim() : '';

  // 1. International tournament selection ("GROUP_INTL" or "INTL")
  if (selectedLeague === 'GROUP_INTL' || selectedLeague === 'INTL') {
    return isInternationalCompetition(fixture.league?.name, fixture.league?.country);
  }

  // 2. Specific single league by ID (e.g. "LEAGUE_39", "LEAGUE_2", or "LEAGUE_Premier League-England")
  if (selectedLeague.startsWith('LEAGUE_')) {
    const target = selectedLeague.replace('LEAGUE_', '').trim();
    
    // A. Match numeric or string ID from fixture.league.id
    if (lId && (lId === target || lId.toLowerCase() === target.toLowerCase())) {
      return true;
    }
    
    // B. Match synthetic ID: "${lName}-${cName}"
    const synthId = `${lName}-${cName}`.trim();
    if (synthId && target.toLowerCase() === synthId.toLowerCase()) {
      return true;
    }

    // C. Match exact league name
    if (lNameLower && target.toLowerCase() === lNameLower) {
      return true;
    }

    // Explicitly reject if this fixture is not from the target league!
    return false;
  }

  // 3. Specific country group (e.g. "COUNTRY_COLOMBIA", "COUNTRY_ENGLAND", "COUNTRY_OTHER")
  if (selectedLeague.startsWith('COUNTRY_')) {
    const countryKey = selectedLeague.replace('COUNTRY_', '').trim().toUpperCase();
    const cat = identifyCompetitionCategory(fixture.league?.name, fixture.league?.country);
    
    // Match identified category key
    if (cat.key.toUpperCase() === countryKey || cat.key.toUpperCase() === `COUNTRY_${countryKey}`) {
      return true;
    }

    // Match known metadata aliases
    const meta = COUNTRY_METAS[countryKey];
    if (meta) {
      if (meta.aliases.some(alias => cNameLower === alias || cNameLower.includes(alias) || lNameLower.includes(alias))) {
        return true;
      }
    }

    // Match safe key generated from country name
    const safeKey = cNameLower.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (safeKey === countryKey || safeKey.includes(countryKey) || countryKey.includes(safeKey)) {
      return true;
    }

    // Explicitly reject if not from this country group!
    return false;
  }

  // 4. Legacy mappings for backwards compatibility
  if (selectedLeague === 'COLOMBIA') {
    return lNameLower.includes('colombia') || lNameLower.includes('betplay') || cNameLower.includes('colombia');
  }
  if (selectedLeague === 'ARG') {
    return lNameLower.includes('argentina') || lNameLower.includes('nacional') || lNameLower.includes('profesional') || cNameLower.includes('argentina');
  }
  if (selectedLeague === 'CONCACAF') {
    return lNameLower.includes('concacaf');
  }
  if (selectedLeague === 'LALIGA') {
    return lNameLower.includes('laliga') || lNameLower.includes('españa') || cNameLower.includes('spain') || cNameLower.includes('españa');
  }
  if (selectedLeague === 'PREMIER') {
    return lNameLower.includes('premier') || lNameLower.includes('england') || cNameLower.includes('england') || cNameLower.includes('inglaterra');
  }
  if (selectedLeague === 'SUDAMERICA') {
    return (
      cNameLower.includes('colombia') ||
      cNameLower.includes('brazil') ||
      cNameLower.includes('argentina') ||
      cNameLower.includes('uruguay') ||
      cNameLower.includes('bolivia') ||
      cNameLower.includes('chile') ||
      cNameLower.includes('ecuador') ||
      cNameLower.includes('paraguay') ||
      cNameLower.includes('peru') ||
      lNameLower.includes('libertadores') ||
      lNameLower.includes('sudamericana')
    );
  }

  // If a specific filter was provided but didn't match, return false!
  return false;
}

/**
 * Pure visual helper to abbreviate common verbose club prefixes/suffixes
 * (e.g., "Club Deportivo" -> "CD", "Fútbol Club" -> "FC", "Club Atlético" -> "CA")
 * without mutating the underlying team.name used by analytics or API matching.
 */
export function formatCompactTeamName(name: string): string {
  if (!name) return '';
  let formatted = name.trim();

  const replacements: [RegExp, string][] = [
    [/\bClub Social y Deportivo\b/gi, 'CSD'],
    [/\bReal Club Deportivo\b/gi, 'RCD'],
    [/\bCorporaci[oó]n Deportiva\b/gi, 'CD'],
    [/\bClub Deportivo\b/gi, 'CD'],
    [/\bClub Atl[eé]tico\b/gi, 'CA'],
    [/\bAsociaci[oó]n Deportiva\b/gi, 'AD'],
    [/\bSociedad Deportiva\b/gi, 'SD'],
    [/\bUni[oó]n Deportiva\b/gi, 'UD'],
    [/\bF[uú]tbol Club\b/gi, 'FC'],
    [/\bFootball Club\b/gi, 'FC'],
    [/\bDeportivo Independiente Medell[ií]n\b/gi, 'Ind. Medellín'],
    [/\bAtl[eé]tico Nacional\b/gi, 'Atl. Nacional'],
    [/\bAtl[eé]tico Bucaramanga\b/gi, 'Atl. Bucaramanga'],
    [/\bAtl[eé]tico Madrid\b/gi, 'Atl. Madrid'],
    [/\bAtl[eé]tico Mineiro\b/gi, 'Atl. Mineiro'],
    [/\bAthletico Paranaense\b/gi, 'Ath. Paranaense']
  ];

  for (const [pattern, abbr] of replacements) {
    formatted = formatted.replace(pattern, abbr);
  }

  return formatted.replace(/\s{2,}/g, ' ').trim();
}

export interface StaticCatalogLeagueItem {
  key: string;
  displayName: string;
  flag: string;
  tier: 'PRIMARY' | 'SECONDARY';
}

export const STATIC_SOCCER_CATALOG: StaticCatalogLeagueItem[] = [
  // Ligas Principales
  { key: 'GROUP_INTL', displayName: 'Torneos Internacionales (UEFA / CONMEBOL)', flag: '🏆', tier: 'PRIMARY' },
  { key: 'COUNTRY_COLOMBIA', displayName: 'Colombia (Liga y Copa BetPlay)', flag: '🇨🇴', tier: 'PRIMARY' },
  { key: 'COUNTRY_ENGLAND', displayName: 'Inglaterra (Premier League / FA Cup)', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tier: 'PRIMARY' },
  { key: 'COUNTRY_SPAIN', displayName: 'España (LaLiga / Copa del Rey)', flag: '🇪🇸', tier: 'PRIMARY' },
  { key: 'COUNTRY_ITALY', displayName: 'Italia (Serie A / Coppa Italia)', flag: '🇮🇹', tier: 'PRIMARY' },
  { key: 'COUNTRY_GERMANY', displayName: 'Alemania (Bundesliga / DFB Pokal)', flag: '🇩🇪', tier: 'PRIMARY' },
  { key: 'COUNTRY_FRANCE', displayName: 'Francia (Ligue 1 / Coupe de France)', flag: '🇫🇷', tier: 'PRIMARY' },
  { key: 'COUNTRY_ARGENTINA', displayName: 'Argentina (Liga Profesional)', flag: '🇦🇷', tier: 'PRIMARY' },
  { key: 'COUNTRY_BRAZIL', displayName: 'Brasil (Brasileirão Série A)', flag: '🇧🇷', tier: 'PRIMARY' },

  // Ligas Secundarias
  { key: 'COUNTRY_PORTUGAL', displayName: 'Portugal (Primeira Liga)', flag: '🇵🇹', tier: 'SECONDARY' },
  { key: 'COUNTRY_NETHERLANDS', displayName: 'Países Bajos (Eredivisie)', flag: '🇳🇱', tier: 'SECONDARY' },
  { key: 'COUNTRY_MEXICO', displayName: 'México (Liga MX)', flag: '🇲🇽', tier: 'SECONDARY' },
  { key: 'COUNTRY_USA', displayName: 'Estados Unidos (MLS)', flag: '🇺🇸', tier: 'SECONDARY' },
  { key: 'COUNTRY_TURKEY', displayName: 'Turquía (Süper Lig)', flag: '🇹🇷', tier: 'SECONDARY' },
  { key: 'COUNTRY_BELGIUM', displayName: 'Bélgica (Pro League)', flag: '🇧🇪', tier: 'SECONDARY' },
  { key: 'COUNTRY_SAUDI_ARABIA', displayName: 'Arabia Saudita (Saudi Pro League)', flag: '🇸🇦', tier: 'SECONDARY' },
  { key: 'COUNTRY_CHILE', displayName: 'Chile (Primera División)', flag: '🇨🇱', tier: 'SECONDARY' },
  { key: 'COUNTRY_ECUADOR', displayName: 'Ecuador (LigaPro)', flag: '🇪🇨', tier: 'SECONDARY' },
  { key: 'COUNTRY_URUGUAY', displayName: 'Uruguay (Primera División)', flag: '🇺🇾', tier: 'SECONDARY' },
  { key: 'COUNTRY_PERU', displayName: 'Perú (Liga 1)', flag: '🇵🇪', tier: 'SECONDARY' },
  { key: 'COUNTRY_PARAGUAY', displayName: 'Paraguay (Primera División)', flag: '🇵🇾', tier: 'SECONDARY' }
];

export const STATIC_BASKETBALL_CATALOG: StaticCatalogLeagueItem[] = [
  // Principales
  { key: 'NBA', displayName: 'NBA (Temporada Regular & Playoffs)', flag: '🏀', tier: 'PRIMARY' },
  { key: 'Este', displayName: 'NBA · Conferencia Este', flag: '🗽', tier: 'PRIMARY' },
  { key: 'Oeste', displayName: 'NBA · Conferencia Oeste', flag: '🌉', tier: 'PRIMARY' },
  // Secundarias
  { key: 'NCAA', displayName: 'NCAA Basketball (Universitario)', flag: '🎓', tier: 'SECONDARY' },
  { key: 'WNBA', displayName: 'WNBA (Baloncesto Femenino)', flag: '⚡', tier: 'SECONDARY' },
  { key: 'FIBA', displayName: 'Euroliga / FIBA Internacional', flag: '🌍', tier: 'SECONDARY' }
];

