/** Slow, intentional motion — global trade network feel */
export const MOTION = {
  /** Page & section reveals */
  reveal: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const },
  /** Hero entrance */
  hero: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const },
  /** SVG route draw */
  routeDraw: { duration: 2.8, ease: [0.45, 0, 0.15, 1] as const },
  /** Continuous drift / float */
  drift: { duration: 7, ease: 'easeInOut' as const },
  /** Trade lane dash scroll */
  laneFlow: { duration: 28, ease: 'linear' as const },
  /** Marker float */
  markerFloat: { duration: 5.5, ease: 'easeInOut' as const },
  /** Ambient background shift */
  ambient: { duration: 22, ease: 'easeInOut' as const },
  /** Hover lift */
  hover: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  /** Stagger between children */
  stagger: 0.12,
} as const;
