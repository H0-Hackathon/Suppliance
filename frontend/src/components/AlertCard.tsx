import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { AgentOutputPanel } from './AgentOutputPanel';

/**
 * AlertCard — Displays a single tariff alert with severity styling.
 *
 * Phase 1: Static display with hardcoded mock data.
 * Phase 2: Props will be wired to real TariffAlert objects from the API.
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertType = 'tariff_change' | 'port_disruption' | 'geopolitical' | 'shipping_delay';

export interface AlertCardProps {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  summary: string;
  agent_output?: string;  // JSON string — parsed to show reasoning accordion
  created_at: string;
  onDismiss?: (id: number) => void;
  onResolve?: (id: number) => void;
}

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  critical: '4px solid #EF4444',
  high:     '4px solid #F97316',
  medium:   '4px solid #F59E0B',
  low:      '4px solid #6B7280',
};

const SEVERITY_BADGE_CLASS: Record<AlertSeverity, string> = {
  critical: 'badge badge-critical',
  high:     'badge badge-high',
  medium:   'badge badge-medium',
  low:      'badge badge-low',
};

const ALERT_TYPE_ICON: Record<AlertType, string> = {
  tariff_change:   '$',
  port_disruption: '⚓',
  geopolitical:    '🌍',
  shipping_delay:  '⏰',
};

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  tariff_change:   'Tariff Change',
  port_disruption: 'Port Disruption',
  geopolitical:    'Geopolitical Event',
  shipping_delay:  'Shipping Delay',
};

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  id,
  alert_type,
  severity,
  summary,
  agent_output,
  created_at,
  onDismiss,
  onResolve,
}) => {
  const [showReasoning, setShowReasoning] = React.useState(false);

  let parsedOutput: Record<string, unknown> | null = null;
  if (agent_output) {
    try {
      parsedOutput = JSON.parse(agent_output);
    } catch {
      parsedOutput = null;
    }
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-md)',
        borderLeft: SEVERITY_BORDER[severity],
        border: '1px solid var(--border)',
        borderLeftWidth: 4,
        padding: '16px 20px',
        marginBottom: 12,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }} title={ALERT_TYPE_LABEL[alert_type]}>
          {ALERT_TYPE_ICON[alert_type]}
        </span>
        <span className={SEVERITY_BADGE_CLASS[severity]}>{severity}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          {ALERT_TYPE_LABEL[alert_type]}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {formatRelativeTime(created_at)}
        </span>
      </div>

      {/* Summary */}
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
        {summary}
      </p>

      {/* Agent reasoning toggle */}
      {parsedOutput && (
        <div>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginBottom: showReasoning ? 12 : 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {showReasoning ? '▲ Hide' : '▼ View'} Agent Reasoning
          </button>

          {showReasoning && (
            <AgentOutputPanel agentOutput={parsedOutput} />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {onDismiss && (
          <button className="btn-ghost" onClick={() => onDismiss(id)}>
            Dismiss
          </button>
        )}
        {onResolve && (
          <button className="btn-primary" onClick={() => onResolve(id)} style={{ fontSize: 12 }}>
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  );
};
