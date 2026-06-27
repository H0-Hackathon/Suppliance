import React, { useState } from 'react';

interface ClampTextProps {
  text: string;
  maxChars?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Truncates long agent/event copy to a short, scannable snippet with an
 * inline "Show more" toggle — keeps reasoning text simple by default while
 * still letting anyone drill into the full explanation on demand.
 */
export const ClampText: React.FC<ClampTextProps> = ({ text, maxChars = 180, className, style }) => {
  const [expanded, setExpanded] = useState(false);
  const needsClamp = text.length > maxChars;
  const shown = expanded || !needsClamp ? text : `${text.slice(0, maxChars).trim()}…`;

  return (
    <span className={className} style={style}>
      {shown}
      {needsClamp && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'inline-block',
            marginLeft: 6,
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--seafoam)',
            fontSize: '0.92em',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </span>
  );
};

export default ClampText;
