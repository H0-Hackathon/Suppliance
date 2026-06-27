import React from 'react';
import { PALETTE } from '../../styles/palette';

interface LogoMarkProps {
  size?: number;
  /** Render the rounded teal badge background. False = transparent (mark only). */
  badge?: boolean;
  className?: string;
}

/**
 * Suppliance brand mark — a cargo ship cresting a rising-sun halo over three
 * waves, drawn as a flat three-tone SVG (teal badge / cream halo+waves / dark
 * navy ship) matching the provided logo. Inline so it stays crisp at any size
 * and needs no external asset or CDN.
 */
export const LogoMark: React.FC<LogoMarkProps> = ({ size = 36, badge = true, className }) => {
  const cream = PALETTE.sand;
  const ship = PALETTE.tealNavyDeep;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Suppliance"
    >
      {badge && <rect width="64" height="64" rx="15" fill={PALETTE.tealNavy} />}

      {/* Rising-sun halo behind the ship */}
      <circle cx="32" cy="27" r="15" fill={cream} opacity="0.95" />

      {/* Ship silhouette (faces left) */}
      <g fill={ship}>
        {/* hull — prow tapers to the left */}
        <path d="M16 34 H47 L43.5 40.5 Q43 41.5 41.5 41.5 H22.5 Q20.8 41.5 19.8 40 L16 34 Z" />
        {/* container house / bridge block */}
        <rect x="24" y="27.5" width="16" height="6.5" rx="1" />
        {/* upper bridge */}
        <rect x="30" y="22.5" width="8" height="5.5" rx="1" />
        {/* mast */}
        <rect x="33.2" y="16.5" width="1.6" height="6.5" rx="0.8" />
        <rect x="31" y="18.4" width="6" height="1.5" rx="0.75" />
      </g>
      {/* porthole near the bow */}
      <circle cx="24" cy="37.4" r="1.5" fill={cream} />

      {/* Three waves */}
      <g stroke={cream} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M13 45.5 q4.75 -3.2 9.5 0 t9.5 0 t9.5 0 t9.5 0" />
        <path d="M15 50 q4.25 -3 8.5 0 t8.5 0 t8.5 0" opacity="0.92" />
        <path d="M18 54 q3.5 -2.6 7 0 t7 0 t7 0" opacity="0.85" />
      </g>
    </svg>
  );
};

export default LogoMark;
