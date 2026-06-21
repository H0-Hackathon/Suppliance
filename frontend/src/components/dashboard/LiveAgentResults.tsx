import React from 'react';
import { TrendingUp, Zap, ExternalLink } from 'lucide-react';

/** Agent 1 (TariffMonitor) output — core/monitor_agent.get_latest_event */
export interface TariffMonitorOutput {
  risk_detected?: boolean;
  event?: string;
  event_type?: string | null;
  country?: string | null;
  product?: string | null;
  tariff_rate?: number | null;
  severity?: string | null;
  confidence?: number | null;
  source?: string | null;
  source_url?: string | null;
  summary?: string | null;
}

/** Agent 2 (ImpactCalculator) output — services/impact_service.calculate_impact */
export interface ImpactCalculatorOutput {
  affected?: boolean;
  direct_cost?: number | null;
  extra_cost_usd?: number | null;
  exposure_score?: number | null;
  risk_score?: number | null;
  severity?: string | null;
  affected_orders?: number | null;
  eta_risk?: string | null;
  supplier_dependency?: number | null;
  reasons?: string[];
}

interface LiveAgentResultsProps {
  tariffMonitor?: TariffMonitorOutput | null;
  impact?: ImpactCalculatorOutput | null;
  supplier?: string | null;
  updatedAt?: string | null;
  live?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

function sev(s?: string | null): string {
  return (s || 'unknown').toString().toLowerCase();
}

function sevColor(s?: string | null): string {
  return SEVERITY_COLOR[sev(s)] || '#6b7280';
}

function money(n?: number | null): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{
    fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em',
    color, background: `${color}18`, border: `1px solid ${color}30`,
    borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
  }}>{text}</span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
    <span style={{ fontSize: 9.5, color: 'rgba(150,140,100,0.7)' }}>{label}</span>
    <span style={{ fontSize: 10, color: '#e8e3d8', fontWeight: 600, textAlign: 'right' }}>{children}</span>
  </div>
);

const cardStyle: React.CSSProperties = {
  background: 'rgba(20,20,18,0.9)',
  border: '1px solid rgba(245,158,11,0.1)',
  borderRadius: 10,
  padding: '11px 13px',
  marginBottom: 9,
};

export const LiveAgentResults: React.FC<LiveAgentResultsProps> = ({
  tariffMonitor, impact, supplier, updatedAt, live,
}) => {
  const hasData = !!(tariffMonitor || impact);

  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (!hasData) {
    return (
      <div style={{ ...cardStyle, color: 'rgba(130,120,90,0.8)', fontSize: 10.5 }}>
        No agent results yet. Click <strong style={{ color: '#e8e3d8' }}>Run Analysis</strong> to run
        the TariffMonitor + ImpactCalculator agents.
      </div>
    );
  }

  return (
    <div>
      {/* Status line */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9,
        fontSize: 9, color: 'rgba(150,140,100,0.7)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: live ? '#dc2626' : '#10b981',
          boxShadow: `0 0 6px ${live ? '#dc2626' : '#10b981'}`,
          animation: live ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.08em', color: live ? '#fca5a5' : '#6ee7b7' }}>
          {live ? 'LIVE — AGENTS RUNNING' : 'LATEST AGENT RUN'}
        </span>
        {ts && <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>{ts}</span>}
      </div>

      {/* Agent 1 — TariffMonitor */}
      {tariffMonitor && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <TrendingUp size={13} color="#f59e0b" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e8e3d8' }}>① TariffMonitor</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {tariffMonitor.event_type && <Badge text={tariffMonitor.event_type} color="#f59e0b" />}
              <Badge text={sev(tariffMonitor.severity)} color={sevColor(tariffMonitor.severity)} />
            </span>
          </div>

          {tariffMonitor.event && (
            <div style={{ fontSize: 10.5, color: '#f1f5f9', fontWeight: 600, lineHeight: 1.35, marginBottom: 7 }}>
              {tariffMonitor.event}
            </div>
          )}

          <Row label="Country">{tariffMonitor.country || '—'}</Row>
          {supplier && <Row label="Supplier">{supplier}</Row>}
          {tariffMonitor.product && <Row label="Product">{tariffMonitor.product}</Row>}
          <Row label="Tariff change">
            {tariffMonitor.tariff_rate != null
              ? <span style={{ color: '#ef4444' }}>+{tariffMonitor.tariff_rate}%</span>
              : '—'}
          </Row>
          {tariffMonitor.confidence != null && (
            <Row label="Confidence">{Math.round(tariffMonitor.confidence * 100)}%</Row>
          )}
          <Row label="Source">{tariffMonitor.source || '—'}</Row>

          {tariffMonitor.source_url && (
            <a
              href={tariffMonitor.source_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                fontSize: 9.5, color: '#60a5fa', textDecoration: 'none',
              }}
            >
              <ExternalLink size={10} /> View source headline
            </a>
          )}
        </div>
      )}

      {/* Agent 2 — ImpactCalculator */}
      {impact && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Zap size={13} color="#dc2626" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e8e3d8' }}>② ImpactCalculator</span>
            <span style={{ marginLeft: 'auto' }}>
              <Badge text={sev(impact.severity)} color={sevColor(impact.severity)} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {money(impact.direct_cost ?? impact.extra_cost_usd)}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>direct cost</span>
          </div>

          <Row label="Affected orders">{impact.affected_orders ?? 0}</Row>
          {impact.risk_score != null && <Row label="Risk score">{impact.risk_score}</Row>}
          {impact.eta_risk && <Row label="ETA risk">{impact.eta_risk}</Row>}
          {impact.supplier_dependency != null && (
            <Row label="Supplier dependency">{Math.round(impact.supplier_dependency * 100)}%</Row>
          )}

          {impact.reasons && impact.reasons.length > 0 && (
            <ul style={{ margin: '7px 0 0', paddingLeft: 14, listStyle: 'disc' }}>
              {impact.reasons.slice(0, 3).map((r, i) => (
                <li key={i} style={{ fontSize: 9, color: 'rgba(180,170,140,0.85)', lineHeight: 1.4, marginBottom: 2 }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
