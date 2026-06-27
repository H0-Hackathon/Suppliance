import React from 'react';

interface GlowOrbProps {
  /** CSS color (hex/rgb) for the orb's core. */
  color: string;
  /** Diameter in px before blur. */
  size?: number;
  /** Blur radius in px. */
  blur?: number;
  opacity?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A soft, heavily-blurred color orb — ambient ("light leak") ramps the eye
 * toward a focal point (a primary action, the globe) without adding any
 * actual shape or clutter. Purely decorative; never intercepts pointer events.
 */
export const GlowOrb: React.FC<GlowOrbProps> = ({
  color,
  size = 260,
  blur = 70,
  opacity = 0.35,
  style,
  className,
}) => (
  <div
    className={className}
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: `blur(${blur}px)`,
      opacity,
      pointerEvents: 'none',
      zIndex: -1,
      ...style,
    }}
  />
);

export default GlowOrb;
