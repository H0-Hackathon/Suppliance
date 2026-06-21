import React from 'react';
import type { PortInfo } from '../../data/maritimePorts';
import { PortCongestionHint } from './PortCongestionHint';

interface PortDetailPopoverProps {
  port: PortInfo;
  supplierName?: string;
  exposure?: string;
  statusLabel?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
}

export const PortDetailPopover: React.FC<PortDetailPopoverProps> = ({
  port,
  supplierName,
  exposure,
  statusLabel,
  style,
  onClose,
}) => (
  <div className="ws-port-popover" style={style} role="dialog" aria-label={port.name}>
    {onClose && (
      <button type="button" className="ws-port-popover-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    )}
    <div className="ws-port-popover-code">{port.code}</div>
    <div className="ws-port-popover-name">{port.name}</div>
    {supplierName && (
      <div className="ws-port-popover-supplier">{supplierName}</div>
    )}
    <PortCongestionHint port={port} />
    {exposure && exposure !== '—' && exposure !== '$0' && (
      <div className="ws-port-popover-meta">
        <span>Exposure on lane</span>
        <strong>{exposure}</strong>
      </div>
    )}
    {statusLabel && (
      <div className="ws-port-popover-status">{statusLabel}</div>
    )}
  </div>
);
