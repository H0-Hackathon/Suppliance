import React from 'react';

/** Compact shipment-specific route — distinct from the hero map */
export const ScenarioRouteStrip: React.FC = () => (
  <figure className="mkt-scenario-route" aria-label="MSCU8472912 route: Shanghai to Los Angeles via Singapore">
    <svg viewBox="0 0 260 56" fill="none" aria-hidden>
      <path
        d="M 16 28 H 244"
        stroke="#548C92"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="16" cy="28" r="3" fill="#2B5260" />
      <circle cx="130" cy="28" r="4" fill="#AB9072" />
      <circle cx="244" cy="28" r="3" fill="#2B5260" />
      <text x="16" y="48" textAnchor="middle" className="mkt-scenario-route-label">Shanghai</text>
      <text x="130" y="48" textAnchor="middle" className="mkt-scenario-route-label mkt-scenario-route-label--hold">
        Singapore
      </text>
      <text x="244" y="48" textAnchor="middle" className="mkt-scenario-route-label">Los Angeles</text>
    </svg>
    <figcaption className="mkt-scenario-route-caption">MSCU8472912 · held at transship</figcaption>
  </figure>
);
