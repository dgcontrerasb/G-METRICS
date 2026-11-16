import React, { useState } from 'react';

interface SportStatsLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withGlow?: boolean;
  withText?: boolean;
  subtitle?: string;
  activeSport?: 'SOCCER' | 'NBA';
}

export const SportStatsLogo: React.FC<SportStatsLogoProps> = ({
  className = '',
  size = 'md',
  withGlow = true,
  withText = false,
  subtitle
}) => {
  const [logoSrc, setLogoSrc] = useState('/icon.png');

  const sizeDimensions = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-xs',
    md: 'w-11 h-11 sm:w-12 sm:h-12 text-sm',
    lg: 'w-14 h-14 sm:w-16 sm:h-16 text-base',
    xl: 'w-18 h-18 sm:w-22 sm:h-22 text-lg'
  };

  const glowStyles = withGlow
    ? 'drop-shadow-[0_0_12px_rgba(217,177,20,0.45)]'
    : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeDimensions[size]} flex items-center justify-center shrink-0 relative transition-all duration-300`}
      >
        <img
          src={logoSrc}
          alt="G METRICS Icon"
          onError={() => {
            if (logoSrc !== '/logo.png') {
              setLogoSrc('/logo.png');
            }
          }}
          className={`w-full h-full object-contain select-none ${glowStyles}`}
        />
      </div>

      {withText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase truncate">
              G <span className="text-[#d9b114]">METRICS</span>
            </span>
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-[#8b949e] truncate">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
