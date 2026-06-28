import React from 'react';

interface TopProgressBarProps {
  /** 0–100 progress. null = hidden. Ignored when indeterminate is true. */
  percent: number | null;
  label?: string;
  /** True when a run is known to be in-flight but we have no real % for it
   *  (e.g. it's someone else's run holding the shared slot) — shows a
   *  sliding bar instead of a stalled/fake percentage. */
  indeterminate?: boolean;
}

/**
 * Slim fixed-to-top progress bar shown while a long-running action (the
 * 5-agent pipeline) is in flight. Presentational only — the parent owns the
 * percent derivation and sets percent to null to hide it.
 */
export const TopProgressBar: React.FC<TopProgressBarProps> = ({ percent, label, indeterminate }) => {
  const visible = percent !== null || indeterminate;
  const pct = Math.max(0, Math.min(100, percent ?? 0));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 250ms ease-out, transform 250ms ease-out',
      }}
    >
      {/* The bar */}
      <div style={{ height: 3, width: '100%', background: 'rgba(132,215,216,0.12)', overflow: 'hidden' }}>
        {indeterminate ? (
          <div
            style={{
              height: '100%',
              width: '40%',
              background: 'linear-gradient(90deg, var(--dusty-teal), var(--seafoam))',
              boxShadow: '0 0 10px rgba(132,215,216,0.6)',
              animation: 'indeterminate-slide 1.3s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--dusty-teal), var(--seafoam))',
              boxShadow: '0 0 10px rgba(132,215,216,0.6)',
              transition: 'width 220ms ease-out',
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes indeterminate-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>

      {/* Floating label pill */}
      {label && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--border-soft)',
            borderRadius: 999,
            padding: '5px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--foreground)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--seafoam)',
              boxShadow: '0 0 6px var(--seafoam)',
              animation: 'pulse-dot var(--pulse-duration, 1.4s) ease-in-out infinite',
            }}
          />
          {label}
          {!indeterminate && (
            <span style={{ color: 'var(--seafoam)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TopProgressBar;
