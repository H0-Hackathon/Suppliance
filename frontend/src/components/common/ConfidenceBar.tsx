import React from 'react';

interface ConfidenceBarProps {
  /** 0–1 confidence value. */
  value: number;
  /** Show the percentage label to the right. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Horizontal confidence bar with a seafoam fill — visual encoding for the
 * 0–1 confidence scores the agents emit.
 */
export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ value, showLabel = true, className }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: 'rgba(132,215,216,0.14)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: 'var(--seafoam)',
            boxShadow: '0 0 8px rgba(132,215,216,0.45)',
            transition: 'width 220ms ease-out',
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--seafoam)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 34,
            textAlign: 'right',
          }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
};

export default ConfidenceBar;
