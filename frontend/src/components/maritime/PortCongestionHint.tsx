import React from 'react';
import type { PortInfo } from '../../data/maritimePorts';
import { congestionLabel } from '../../data/maritimePorts';

interface PortCongestionHintProps {
  port: PortInfo;
  compact?: boolean;
}

export const PortCongestionHint: React.FC<PortCongestionHintProps> = ({ port, compact }) => {
  const levelColor =
    port.congestion === 'clear'
      ? 'var(--ws-healthy)'
      : port.congestion === 'moderate'
        ? 'var(--ws-driftwood)'
        : 'var(--ws-warning)';

  if (compact) {
    return (
      <span style={{ fontSize: 11, color: levelColor }}>
        {congestionLabel(port.congestion)}
        {port.waitDays > 0 ? ` · +${port.waitDays}d` : ''}
      </span>
    );
  }

  return (
    <div className="ws-port-hint">
      <div className="ws-port-hint-row">
        <span className="ws-port-hint-level" style={{ color: levelColor }}>
          {congestionLabel(port.congestion)}
        </span>
        {port.waitDays > 0 && (
          <span className="ws-port-hint-wait">+{port.waitDays} day{port.waitDays !== 1 ? 's' : ''} typical</span>
        )}
      </div>
      <p className="ws-port-hint-note">{port.note}</p>
    </div>
  );
};
