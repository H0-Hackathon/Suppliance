import React from 'react';
import type { RouteLeg } from '../../data/maritimePorts';

interface ShipmentRouteTimelineProps {
  legs: RouteLeg[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const ShipmentRouteTimeline: React.FC<ShipmentRouteTimelineProps> = ({
  legs,
  title = 'Active shipment lane',
  subtitle,
  compact,
}) => {
  if (legs.length === 0) return null;

  return (
    <div className={`ws-route-timeline${compact ? ' ws-route-timeline--compact' : ''}`}>
      <div className="ws-route-timeline-header">
        <span className="ws-route-timeline-title">{title}</span>
        {subtitle && <span className="ws-route-timeline-sub">{subtitle}</span>}
      </div>
      <div className="ws-route-timeline-track">
        {legs.map((leg, i) => (
          <React.Fragment key={leg.port.code}>
            <div
              className={`ws-route-stop ws-route-stop--${leg.status ?? 'upcoming'}`}
              title={leg.port.note}
            >
              <div className="ws-route-stop-dot" />
              <div className="ws-route-stop-port">{leg.port.name.replace(/^Port of /, '')}</div>
              <div className="ws-route-stop-role">
                {leg.role === 'origin'
                  ? 'Origin'
                  : leg.role === 'transshipment'
                    ? 'Transshipment'
                    : 'Destination'}
              </div>
              {leg.etaLabel && (
                <div className="ws-route-stop-eta">{leg.etaLabel}</div>
              )}
            </div>
            {i < legs.length - 1 && (
              <div className={`ws-route-segment ws-route-segment--${leg.status === 'delayed' ? 'delayed' : 'normal'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
