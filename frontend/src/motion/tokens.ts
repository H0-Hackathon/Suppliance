/** Slow, intentional motion — global trade network feel */
export const MOTION = {
  reveal: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const },
  hero: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const },
  routeDraw: { duration: 2.8, ease: [0.45, 0, 0.15, 1] as const },
  drift: { duration: 7, ease: 'easeInOut' as const },
  laneFlow: { duration: 28, ease: 'linear' as const },
  markerFloat: { duration: 5.5, ease: 'easeInOut' as const },
  ambient: { duration: 22, ease: 'easeInOut' as const },
  hover: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  stagger: 0.12,
} as const;
