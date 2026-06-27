import React from 'react';
import { PALETTE } from '../../styles/palette';

interface WaveAccentProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Decorative wave-line motif echoing the logo's three waves — a faint,
 * non-interactive flourish for otherwise flat header/panel backgrounds.
 * Pure SVG so it stays crisp and never needs an asset file.
 */
export const WaveAccent: React.FC<WaveAccentProps> = ({ className, style }) => (
  <svg
    className={className}
    style={{ position: 'absolute', pointerEvents: 'none', ...style }}
    width="260"
    height="120"
    viewBox="0 0 260 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g stroke={PALETTE.seafoam} strokeLinecap="round" fill="none">
      <path d="M0 30 q21.5 -16 43 0 t43 0 t43 0 t43 0 t43 0" strokeWidth="3" opacity="0.16" />
      <path d="M10 62 q19 -14 38 0 t38 0 t38 0 t38 0 t38 0" strokeWidth="2.5" opacity="0.10" />
      <path d="M0 94 q21.5 -13 43 0 t43 0 t43 0 t43 0 t43 0" strokeWidth="2" opacity="0.07" />
    </g>
  </svg>
);

export default WaveAccent;
