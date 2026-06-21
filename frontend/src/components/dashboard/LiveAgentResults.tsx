import React from 'react';
import { TrendingUp, Zap, Search, ShieldCheck, Gavel, ExternalLink } from 'lucide-react';

/** Agent 1 (TariffMonitor) — core/monitor_agent.get_latest_event */
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

/** Agent 2 (ImpactCalculator) — services/impact_service.calculate_impact */
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

// Agents 3-5 are LLM-backed (CrewAI + Gemini); shapes are loose since the model
// fills them in. We render the fields we know about and ignore the rest.
export type AgentResults = Record<string, any>;

interface LiveAgentResultsProps {
  agents?: AgentResults | null;
  supplier?: string | null;
  updatedAt?: string | null;
  live?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#10b981',
  caution: '#f59e0b', clear: '#10b981', block: '#dc2626',
};

const sev = (s?: string | null) => (s || 'unknown').toString().toLowerCase();
const sevColor = (s?: string | null) => SEVERITY_COLOR[sev(s)] || '#6b7280';
const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

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

const CardHeader: React.FC<{ icon: React.ReactNode; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
    {icon}
    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e8e3d8' }}>{title}</span>
    {right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>{right}</span>}
  </div>
);

const Reasons: React.FC<{ items?: string[] }> = ({ items }) =>
  items && items.length > 0 ? (
    <ul style={{ margin: '7px 0 0', paddingLeft: 14, listStyle: 'disc' }}>
      {items.slice(0, 3).map((r, i) => (
        <li key={i} style={{ fontSize: 9, color: 'rgba(180,170,140,0.85)', lineHeight: 1.4, marginBottom: 2 }}>{r}</li>
      ))}
    </ul>
  ) : null;

export const LiveAgentResults: React.FC<LiveAgentResultsProps> = ({ agents, supplier, updatedAt, live }) => {
  const a = agents || {};
  const tariffMonitor: TariffMonitorOutput | undefined = a.tariff_monitor;
  const impact: ImpactCalculatorOutput | undefined = a.impact_calculator;
  const alternatives = a.alternatives_finder;
  const compliance = a.import_compliance;
  const adversarial = a.adversarial;

  const hasData = !!(tariffMonitor || impact || alternatives || compliance || adversarial);

  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (!hasData) {
    return (
      <div style={{ ...cardStyle, color: 'rgba(130,120,90,0.8)', fontSize: 10.5 }}>
        No agent results yet. Click <strong style={{ color: '#e8e3d8' }}>Run Analysis</strong> to run the agent pipeline.
      </div>
    );
  }

  const altList: any[] = Array.isArray(alternatives?.alternatives) ? alternatives.alternatives : [];
  const complianceByCountry: Record<string, any> = compliance?.compliance_by_country || {};
  const advFlags: any[] = Array.isArray(adversarial?.flags) ? adversarial.flags : [];

  return (
    <div>
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>
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
          <CardHeader
            icon={<TrendingUp size={13} color="#f59e0b" />}
            title="① TariffMonitor"
            right={<>
              {tariffMonitor.event_type && <Badge text={tariffMonitor.event_type} color="#f59e0b" />}
              <Badge text={sev(tariffMonitor.severity)} color={sevColor(tariffMonitor.severity)} />
            </>}
          />
          {tariffMonitor.event && (
            <div style={{ fontSize: 10.5, color: '#f1f5f9', fontWeight: 600, lineHeight: 1.35, marginBottom: 7 }}>
              {tariffMonitor.event}
            </div>
          )}
          <Row label="Country">{tariffMonitor.country || '—'}</Row>
          {supplier && <Row label="Supplier">{supplier}</Row>}
          {tariffMonitor.product && <Row label="Product">{tariffMonitor.product}</Row>}
          <Row label="Tariff change">
            {tariffMonitor.tariff_rate != null ? <span style={{ color: '#ef4444' }}>+{tariffMonitor.tariff_rate}%</span> : '—'}
          </Row>
          {tariffMonitor.confidence != null && <Row label="Confidence">{Math.round(tariffMonitor.confidence * 100)}%</Row>}
          <Row label="Source">{tariffMonitor.source || '—'}</Row>
          {tariffMonitor.source_url && (
            <a href={tariffMonitor.source_url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 9.5, color: '#60a5fa', textDecoration: 'none' }}>
              <ExternalLink size={10} /> View source headline
            </a>
          )}
        </div>
      )}

      {/* Agent 2 — ImpactCalculator */}
      {impact && (
        <div style={cardStyle}>
          <CardHeader
            icon={<Zap size={13} color="#dc2626" />}
            title="② ImpactCalculator"
            right={<Badge text={sev(impact.severity)} color={sevColor(impact.severity)} />}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {money(impact.direct_cost ?? impact.extra_cost_usd)}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>direct cost</span>
          </div>
          <Row label="Affected orders">{impact.affected_orders ?? 0}</Row>
          {impact.risk_score != null && <Row label="Risk score">{impact.risk_score}</Row>}
          {impact.eta_risk && <Row label="ETA risk">{impact.eta_risk}</Row>}
          {impact.supplier_dependency != null && <Row label="Supplier dependency">{Math.round(impact.supplier_dependency * 100)}%</Row>}
          <Reasons items={impact.reasons} />
        </div>
      )}

      {/* Agent 3 — AlternativesFinder (Gemini) */}
      {alternatives && (
        <div style={cardStyle}>
          <CardHeader icon={<Search size={13} color="#14b8a6" />} title="③ AlternativesFinder" />
          {altList.slice(0, 3).map((alt, i) => (
            <div key={i} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: i < Math.min(altList.length, 3) - 1 ? '1px solid rgba(245,158,11,0.08)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e8e3d8' }}>
                  #{alt.rank ?? i + 1} {alt.supplier_name || 'Alternative'}
                </span>
                {alt.country_full || alt.country ? <Badge text={alt.country_full || alt.country} color="#14b8a6" /> : null}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: 'rgba(180,170,140,0.85)' }}>
                {alt.lead_time_weeks != null && <span>{alt.lead_time_weeks}w lead</span>}
                {alt.cost_delta_pct != null && (
                  <span style={{ color: alt.cost_delta_pct < 0 ? '#10b981' : '#ef4444' }}>
                    {alt.cost_delta_pct > 0 ? '+' : ''}{alt.cost_delta_pct}% cost
                  </span>
                )}
                {alt.can_meet_deadline != null && <span>{alt.can_meet_deadline ? '✓ on time' : '✗ late'}</span>}
              </div>
              {alt.selection_reasoning && (
                <div style={{ fontSize: 9, color: 'rgba(150,140,100,0.75)', marginTop: 3, lineHeight: 1.35 }}>{alt.selection_reasoning}</div>
              )}
            </div>
          ))}
          {alternatives.recommendation_summary && (
            <div style={{ fontSize: 9.5, color: '#6ee7b7', marginTop: 4, lineHeight: 1.4 }}>
              {alternatives.recommendation_summary}
            </div>
          )}
        </div>
      )}

      {/* Agent 4 — ImportCompliance (Gemini) */}
      {compliance && (
        <div style={cardStyle}>
          <CardHeader icon={<ShieldCheck size={13} color="#10b981" />} title="④ ImportCompliance" />
          {Object.entries(complianceByCountry).slice(0, 4).map(([code, info]: [string, any]) => (
            <div key={code} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#e8e3d8' }}>{code}</span>
                <Badge text={`${sev(info?.overall_compliance_risk)} risk`} color={sevColor(info?.overall_compliance_risk)} />
                {info?.compliance_timeline_days != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>{info.compliance_timeline_days}d</span>
                )}
              </div>
              {Array.isArray(info?.mandatory_documents) && info.mandatory_documents.length > 0 && (
                <div style={{ fontSize: 9, color: 'rgba(180,170,140,0.8)', marginTop: 2 }}>
                  Docs: {info.mandatory_documents.map((d: any) => d.document || d).slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          ))}
          {compliance.summary && (
            <div style={{ fontSize: 9.5, color: 'rgba(150,140,100,0.8)', marginTop: 4, lineHeight: 1.4 }}>{compliance.summary}</div>
          )}
        </div>
      )}

      {/* Agent 5 — Adversarial (red-team verdict) */}
      {adversarial && (
        <div style={cardStyle}>
          <CardHeader
            icon={<Gavel size={13} color="#a78bfa" />}
            title="⑤ Adversarial"
            right={adversarial.verdict ? <Badge text={adversarial.verdict} color={sevColor(adversarial.verdict)} /> : undefined}
          />
          {adversarial.recommended_action && (
            <div style={{ fontSize: 10, color: '#f1f5f9', fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>
              {adversarial.recommended_action}
            </div>
          )}
          {adversarial.confidence_in_recommendation != null && (
            <Row label="Confidence">{Math.round(adversarial.confidence_in_recommendation * 100)}%</Row>
          )}
          {advFlags.length > 0 && (
            <Reasons items={advFlags.map((f: any) => (typeof f === 'string' ? f : f.flag || JSON.stringify(f)))} />
          )}
        </div>
      )}
    </div>
  );
};
