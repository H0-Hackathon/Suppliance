/**
 * Suppliance brand palette as plain JS constants.
 *
 * Use this anywhere a color must be passed as a JS value rather than CSS —
 * primarily `react-globe.gl` (canvas, not stylable via CSS) and inline SVG
 * fills. Keep these in sync by hand with the CSS variables in styles/theme.css.
 */
export const PALETTE = {
  tealNavy: '#285260',
  tealNavyDeep: '#16323A',
  dustyTeal: '#548C92',
  seafoam: '#84D7D8',
  sand: '#E0D7CF',
  clay: '#A89072',
  foreground: '#E8E2D8',
  // Semantic severity (never reused decoratively)
  critical: '#E24B4A',
  warning: '#E0A23B',
  safe: '#5BA86F',
} as const;

/** Globe supplier-marker + arc status colors, keyed by status string. */
export const GLOBE_STATUS = {
  impacted: PALETTE.critical,
  healthy: PALETTE.safe,
  alternative: PALETTE.warning,
  customer: PALETTE.seafoam,
} as const;

export type PaletteColor = keyof typeof PALETTE;
