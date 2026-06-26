// Suppliance Design System — raw hex palette
// Keep in sync with src/styles/theme.css
// Used by canvas-based components (react-globe.gl) that cannot read CSS vars.

export const TEAL_NAVY = '#285260';
export const DUSTY_TEAL = '#548C92';
export const SEAFOAM = '#84D7D8';
export const SAND = '#E0D7CF';
export const CLAY = '#A89072';
export const CRITICAL = '#E24B4A';
export const WARNING = '#E0A23B';
export const SAFE = '#5BA86F';

// Derived tones
export const BG_DARK = '#1E3A42'; // slightly darker than TEAL_NAVY for page background
export const ELEVATED = TEAL_NAVY; // cards, sidebar
export const TEXT_PRIMARY = '#E8E2D8'; // warm off-white
export const TEXT_MUTED = '#A89072'; // clay
export const TEXT_DIM = '#6B7D82'; // darker muted
export const BORDER_SOFT = 'rgba(232,226,216,0.10)';

// Semantic aliases for globe / canvas
export const STATUS_COLORS = {
  impacted: CRITICAL,
  healthy: SAFE,
  alternative: DUSTY_TEAL,
  customer: '#7EB8C8',
} as const;

export const ARC_COLORS = {
  impacted: [226, 75, 74, 255] as [number, number, number, number],
  healthy: [91, 168, 111, 230] as [number, number, number, number],
  alternative: [84, 140, 146, 255] as [number, number, number, number],
} as const;
