import React from 'react';

interface CountryFlagProps {
  country?: string;
  fallbackEmoji?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  country = '',
  fallbackEmoji,
  className = '',
  size = 'sm'
}) => {
  const norm = country.trim().toUpperCase();

  // Size preset
  const sizeClasses =
    className ||
    (size === 'xs'
      ? 'w-3.5 h-2.5 rounded-xs'
      : size === 'sm'
      ? 'w-4.5 h-3 rounded-xs'
      : size === 'md'
      ? 'w-5.5 h-4 rounded-xs'
      : 'w-7 h-5 rounded-xs');

  // Common wrapper styling
  const wrapperClass = `inline-flex items-center justify-center shrink-0 overflow-hidden shadow-xs border border-white/20 select-none align-middle ${sizeClasses}`;

  // 1. Colombia (Yellow 50%, Blue 25%, Red 25%)
  if (norm.includes('COLOMBIA') || norm === 'CO' || norm === 'PRIME_CO') {
    return (
      <span className={wrapperClass} title="Colombia">
        <svg viewBox="0 0 900 600" className="w-full h-full object-cover">
          <rect width="900" height="300" fill="#FCD116" />
          <rect y="300" width="900" height="150" fill="#003893" />
          <rect y="450" width="900" height="150" fill="#CE1126" />
        </svg>
      </span>
    );
  }

  // 2. England / Inglaterra (St George's Cross - White with Red Cross)
  if (norm.includes('INGLATERRA') || norm.includes('ENGLAND') || norm === 'ENG' || norm === 'GB-ENG') {
    return (
      <span className={wrapperClass} title="Inglaterra">
        <svg viewBox="0 0 500 300" className="w-full h-full object-cover">
          <rect width="500" height="300" fill="#FFFFFF" />
          <rect x="220" width="60" height="300" fill="#CF081F" />
          <rect y="120" width="500" height="60" fill="#CF081F" />
        </svg>
      </span>
    );
  }

  // 3. Spain / España (Red, Yellow with shield band, Red)
  if (norm.includes('ESPAÑA') || norm.includes('SPAIN') || norm.includes('ESPANA') || norm === 'ES' || norm === 'ESP') {
    return (
      <span className={wrapperClass} title="España">
        <svg viewBox="0 0 750 500" className="w-full h-full object-cover">
          <rect width="750" height="125" fill="#AA151B" />
          <rect y="125" width="750" height="250" fill="#F1BF00" />
          <rect y="375" width="750" height="125" fill="#AA151B" />
          {/* Subtle Spanish Crown / Shield Motif */}
          <rect x="180" y="210" width="60" height="80" rx="10" fill="#AA151B" opacity="0.85" />
          <circle cx="210" cy="190" r="15" fill="#AA151B" opacity="0.85" />
        </svg>
      </span>
    );
  }

  // 4. Argentina (Sky Blue, White with Sun, Sky Blue)
  if (norm.includes('ARGENTINA') || norm === 'AR' || norm === 'ARG') {
    return (
      <span className={wrapperClass} title="Argentina">
        <svg viewBox="0 0 800 500" className="w-full h-full object-cover">
          <rect width="800" height="166.7" fill="#74ACDF" />
          <rect y="166.7" width="800" height="166.7" fill="#FFFFFF" />
          <rect y="333.4" width="800" height="166.7" fill="#74ACDF" />
          {/* Sol de Mayo */}
          <circle cx="400" cy="250" r="32" fill="#F6B40E" />
          <circle cx="400" cy="250" r="18" fill="#85340A" opacity="0.3" />
        </svg>
      </span>
    );
  }

  // 5. Brazil / Brasil (Green with Yellow Rhombus and Blue Globe)
  if (norm.includes('BRASIL') || norm.includes('BRAZIL') || norm === 'BR' || norm === 'BRA') {
    return (
      <span className={wrapperClass} title="Brasil">
        <svg viewBox="0 0 720 504" className="w-full h-full object-cover">
          <rect width="720" height="504" fill="#009B3A" />
          <polygon points="360,40 660,252 360,464 60,252" fill="#FEDF00" />
          <circle cx="360" cy="252" r="105" fill="#002776" />
          <path d="M 270,265 A 110,110 0 0,0 450,225" fill="none" stroke="#FFFFFF" strokeWidth="12" />
        </svg>
      </span>
    );
  }

  // 6. Italy / Italia (Green, White, Red)
  if (norm.includes('ITALIA') || norm.includes('ITALY') || norm === 'IT' || norm === 'ITA') {
    return (
      <span className={wrapperClass} title="Italia">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="200" height="400" fill="#009246" />
          <rect x="200" width="200" height="400" fill="#FFFFFF" />
          <rect x="400" width="200" height="400" fill="#CE2B37" />
        </svg>
      </span>
    );
  }

  // 7. Germany / Alemania (Black, Red, Gold)
  if (norm.includes('ALEMANIA') || norm.includes('GERMANY') || norm === 'DE' || norm === 'GER') {
    return (
      <span className={wrapperClass} title="Alemania">
        <svg viewBox="0 0 500 300" className="w-full h-full object-cover">
          <rect width="500" height="100" fill="#000000" />
          <rect y="100" width="500" height="100" fill="#DD0000" />
          <rect y="200" width="500" height="100" fill="#FFCC00" />
        </svg>
      </span>
    );
  }

  // 8. France / Francia (Blue, White, Red)
  if (norm.includes('FRANCIA') || norm.includes('FRANCE') || norm === 'FR' || norm === 'FRA') {
    return (
      <span className={wrapperClass} title="Francia">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="200" height="400" fill="#002395" />
          <rect x="200" width="200" height="400" fill="#FFFFFF" />
          <rect x="400" width="200" height="400" fill="#ED2939" />
        </svg>
      </span>
    );
  }

  // 9. Mexico / México (Green, White, Red)
  if (norm.includes('MEXICO') || norm.includes('MÉXICO') || norm === 'MX' || norm === 'MEX') {
    return (
      <span className={wrapperClass} title="México">
        <svg viewBox="0 0 700 400" className="w-full h-full object-cover">
          <rect width="233.3" height="400" fill="#006847" />
          <rect x="233.3" width="233.3" height="400" fill="#FFFFFF" />
          <rect x="466.6" width="233.3" height="400" fill="#CE1126" />
          <circle cx="350" cy="200" r="30" fill="#996633" opacity="0.6" />
        </svg>
      </span>
    );
  }

  // 10. USA / Estados Unidos
  if (norm.includes('ESTADOS UNIDOS') || norm.includes('USA') || norm === 'US') {
    return (
      <span className={wrapperClass} title="Estados Unidos">
        <svg viewBox="0 0 760 400" className="w-full h-full object-cover">
          <rect width="760" height="400" fill="#B22234" />
          <rect y="31" width="760" height="31" fill="#FFFFFF" />
          <rect y="93" width="760" height="31" fill="#FFFFFF" />
          <rect y="155" width="760" height="31" fill="#FFFFFF" />
          <rect y="217" width="760" height="31" fill="#FFFFFF" />
          <rect y="279" width="760" height="31" fill="#FFFFFF" />
          <rect y="341" width="760" height="31" fill="#FFFFFF" />
          <rect width="300" height="217" fill="#3C3B6E" />
          <circle cx="150" cy="110" r="30" fill="#FFFFFF" opacity="0.9" />
        </svg>
      </span>
    );
  }

  // 11. Portugal (Green 40%, Red 60%)
  if (norm.includes('PORTUGAL') || norm === 'PT' || norm === 'POR') {
    return (
      <span className={wrapperClass} title="Portugal">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="240" height="400" fill="#046A38" />
          <rect x="240" width="360" height="400" fill="#DA291C" />
          <circle cx="240" cy="200" r="45" fill="#FFCD00" />
        </svg>
      </span>
    );
  }

  // 12. Netherlands / Países Bajos (Red, White, Blue)
  if (norm.includes('PAÍSES BAJOS') || norm.includes('NETHERLANDS') || norm.includes('HOLANDA') || norm === 'NL') {
    return (
      <span className={wrapperClass} title="Países Bajos">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="133.3" fill="#AE1C28" />
          <rect y="133.3" width="600" height="133.3" fill="#FFFFFF" />
          <rect y="266.6" width="600" height="133.3" fill="#21468B" />
        </svg>
      </span>
    );
  }

  // 13. Saudi Arabia / Arabia Saudita
  if (norm.includes('ARABIA') || norm.includes('SAUDI') || norm === 'SA') {
    return (
      <span className={wrapperClass} title="Arabia Saudita">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="400" fill="#006C35" />
          <rect x="180" y="195" width="240" height="10" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  // 14. Turkey / Turquía
  if (norm.includes('TURQUÍA') || norm.includes('TURKEY') || norm.includes('TURQUIA') || norm === 'TR') {
    return (
      <span className={wrapperClass} title="Turquía">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="400" fill="#E30A17" />
          <circle cx="280" cy="200" r="70" fill="#FFFFFF" />
          <circle cx="300" cy="200" r="56" fill="#E30A17" />
          <polygon points="360,200 375,190 370,208" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  // 15. Chile (Blue canton with white star, White top, Red bottom)
  if (norm.includes('CHILE') || norm === 'CL' || norm === 'CHI') {
    return (
      <span className={wrapperClass} title="Chile">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="200" fill="#FFFFFF" />
          <rect y="200" width="600" height="200" fill="#D52B1E" />
          <rect width="200" height="200" fill="#0039A6" />
          <polygon points="100,50 115,95 160,95 125,120 140,165 100,135 60,165 75,120 40,95 85,95" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  // 16. Uruguay (Blue and white stripes with Sun in canton)
  if (norm.includes('URUGUAY') || norm === 'UY' || norm === 'URU') {
    return (
      <span className={wrapperClass} title="Uruguay">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="400" fill="#FFFFFF" />
          <rect y="44" width="600" height="44" fill="#0038A8" />
          <rect y="132" width="600" height="44" fill="#0038A8" />
          <rect y="220" width="600" height="44" fill="#0038A8" />
          <rect y="308" width="600" height="44" fill="#0038A8" />
          <rect width="176" height="176" fill="#FFFFFF" />
          <circle cx="88" cy="88" r="32" fill="#FCD116" />
        </svg>
      </span>
    );
  }

  // 17. Ecuador (Yellow, Blue, Red)
  if (norm.includes('ECUADOR') || norm === 'EC' || norm === 'ECU') {
    return (
      <span className={wrapperClass} title="Ecuador">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="600" height="200" fill="#FFDD00" />
          <rect y="200" width="600" height="100" fill="#034EA2" />
          <rect y="300" width="600" height="100" fill="#ED1C24" />
          <circle cx="300" cy="200" r="35" fill="#996633" opacity="0.6" />
        </svg>
      </span>
    );
  }

  // 18. Peru / Perú (Red, White, Red)
  if (norm.includes('PERÚ') || norm.includes('PERU') || norm === 'PE' || norm === 'PER') {
    return (
      <span className={wrapperClass} title="Perú">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="200" height="400" fill="#D91023" />
          <rect x="200" width="200" height="400" fill="#FFFFFF" />
          <rect x="400" width="200" height="400" fill="#D91023" />
        </svg>
      </span>
    );
  }

  // 19. Belgium / Bélgica (Black, Yellow, Red)
  if (norm.includes('BÉLGICA') || norm.includes('BELGIUM') || norm.includes('BELGICA') || norm === 'BE') {
    return (
      <span className={wrapperClass} title="Bélgica">
        <svg viewBox="0 0 600 400" className="w-full h-full object-cover">
          <rect width="200" height="400" fill="#000000" />
          <rect x="200" width="200" height="400" fill="#FDDA24" />
          <rect x="400" width="200" height="400" fill="#EF3340" />
        </svg>
      </span>
    );
  }

  // 20. Scotland / Escocia (Blue with White Saltire)
  if (norm.includes('ESCOCIA') || norm.includes('SCOTLAND') || norm === 'GB-SCT') {
    return (
      <span className={wrapperClass} title="Escocia">
        <svg viewBox="0 0 500 300" className="w-full h-full object-cover">
          <rect width="500" height="300" fill="#0065BF" />
          <line x1="0" y1="0" x2="500" y2="300" stroke="#FFFFFF" strokeWidth="50" />
          <line x1="0" y1="300" x2="500" y2="0" stroke="#FFFFFF" strokeWidth="50" />
        </svg>
      </span>
    );
  }

  // 21. International / World Tournaments (Trophy icon badge)
  if (
    norm.includes('INTL') ||
    norm.includes('INTERNATIONAL') ||
    norm.includes('INTERNACIONAL') ||
    norm.includes('WORLD') ||
    norm.includes('CHAMPIONS') ||
    norm.includes('LIBERTADORES')
  ) {
    return (
      <span
        className={`${wrapperClass} bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 font-bold`}
        title="Torneo Internacional"
      >
        <span className="text-[10px]">🏆</span>
      </span>
    );
  }

  // 22. Basketball / NBA
  if (norm.includes('NBA') || norm.includes('BASKET') || norm.includes('BALONCESTO')) {
    return (
      <span
        className={`${wrapperClass} bg-gradient-to-tr from-amber-600 to-orange-500 text-white font-bold`}
        title="Baloncesto"
      >
        <span className="text-[10px]">🏀</span>
      </span>
    );
  }

  // Default fallback: If provided fallbackEmoji or text code in pill badge
  return (
    <span
      className={`${wrapperClass} bg-slate-800 text-slate-200 font-mono text-[9px] font-bold`}
      title={country}
    >
      {fallbackEmoji || norm.slice(0, 2) || '🌐'}
    </span>
  );
};
