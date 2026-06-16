import React from 'react';
import {
  TrendingUp, Zap, Search, ShieldCheck, Gavel,
  CheckCircle2, Loader2, ChevronDown, ExternalLink,
} from 'lucide-react';

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

// Agents 3-5 are LLM-backed (CrewAI + Gemini); shapes are loose.
export type AgentResults = Record<string, any>;
export type AgentStatusMap = Record<string, 'running' | 'done'>;

type StepStatus = 'done' | 'running' | 'pending';

interface LiveAgentResultsProps {
  agents?: AgentResults | null;
  agentStatus?: AgentStatusMap;
  supplier?: string | null;
  updatedAt?: string | null;
  live?: boolean;
}

interface ChainStep {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
}

// The fixed reasoning chain, in execution order.
const CHAIN: ChainStep[] = [
  { key: 'tariff_monitor', label: 'TariffMonitor', icon: TrendingUp, color: '#f59e0b' },
  { key: 'impact_calculator', label: 'ImpactCalculator', icon: Zap, color: '#dc2626' },
  { key: 'alternatives_finder', label: 'AlternativesFinder', icon: Search, color: '#14b8a6' },
  { key: 'import_compliance', label: 'ImportCompliance', icon: ShieldCheck, color: '#10b981' },
  { key: 'adversarial', label: 'Adversarial', icon: Gavel, color: '#a78bfa' },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#10b981',
  caution: '#f59e0b', clear: '#10b981', block: '#dc2626',
};
const sev = (s?: string | null) => (s || 'unknown').toString().toLowerCase();
const sevColor = (s?: string | null) => SEVERITY_COLOR[sev(s)] || '#6b7280';
const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{
    fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
    color, background: `${color}18`, border: `1px solid ${color}30`,
    borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>{text}</span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
    <span style={{ fontSize: 9.5, color: 'rgba(150,140,100,0.7)' }}>{label}</span>
    <span style={{ fontSize: 10, color: '#e8e3d8', fontWeight: 600, textAlign: 'right' }}>{children}</span>
  </div>
);

const Reasons: React.FC<{ items?: string[] }> = ({ items }) =>
  items && items.length > 0 ? (
    <ul style={{ margin: '6px 0 0', paddingLeft: 14, listStyle: 'disc' }}>
      {items.slice(0, 3).map((r, i) => (
        <li key={i} style={{ fontSize: 9, color: 'rgba(180,170,140,0.85)', lineHeight: 1.4, marginBottom: 2 }}>{r}</li>
      ))}
    </ul>
  ) : null;

// ── Per-agent collapsed summary (shown in the header) ─────────────────────────
function headerSummary(key: string, agents: AgentResults, status: StepStatus): React.ReactNode {
  if (status !== 'done') return null;
  const d = agents[key];
  if (!d) return null;
  switch (key) {
    case 'tariff_monitor':
      return <>
        {d.tariff_rate != null && <Badge text={`+${d.tariff_rate}%`} color="#ef4444" />}
        <Badge text={sev(d.severity)} color={sevColor(d.severity)} />
      </>;
    case 'impact_calculator':
      return <>
        <Badge text={money(d.direct_cost ?? d.extra_cost_usd)} color="#dc2626" />
        <Badge text={sev(d.severity)} color={sevColor(d.severity)} />
      </>;
    case 'alternatives_finder': {
      const n = Array.isArray(d.alternatives) ? d.alternatives.length : 0;
      return n ? <Badge text={`${n} option${n !== 1 ? 's' : ''}`} color="#14b8a6" /> : null;
    }
    case 'import_compliance': {
      const n = d.compliance_by_country ? Object.keys(d.compliance_by_country).length : 0;
      return n ? <Badge text={`${n} countr${n !== 1 ? 'ies' : 'y'}`} color="#10b981" /> : null;
    }
    case 'adversarial':
      return d.verdict ? <Badge text={d.verdict} color={sevColor(d.verdict)} /> : null;
    default:
      return null;
  }
}

// ── Per-agent expanded detail ────────────────────────────────────────────────
function agentDetail(key: string, agents: AgentResults, supplier?: string | null): React.ReactNode {
  const d = agents[key];
  if (!d) return null;

  if (key === 'tariff_monitor') {
    return (
      <>
        {d.event && (
          <div style={{ fontSize: 10.5, color: '#f1f5f9', fontWeight: 600, lineHeight: 1.35, marginBottom: 7 }}>{d.event}</div>
        )}
        <Row label="Country">{d.country || '—'}</Row>
        {supplier && <Row label="Supplier">{supplier}</Row>}
        {d.product && <Row label="Product">{d.product}</Row>}
        <Row label="Tariff change">{d.tariff_rate != null ? <span style={{ color: '#ef4444' }}>+{d.tariff_rate}%</span> : '—'}</Row>
        {d.confidence != null && <Row label="Confidence">{Math.round(d.confidence * 100)}%</Row>}
        <Row label="Source">{d.source || '—'}</Row>
        {d.source_url && (
          <a href={d.source_url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 9.5, color: '#60a5fa', textDecoration: 'none' }}>
            <ExternalLink size={10} /> View source headline
          </a>
        )}
      </>
    );
  }

  if (key === 'impact_calculator') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {money(d.direct_cost ?? d.extra_cost_usd)}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>direct cost</span>
        </div>
        <Row label="Affected orders">{d.affected_orders ?? 0}</Row>
        {d.risk_score != null && <Row label="Risk score">{d.risk_score}</Row>}
        {d.eta_risk && <Row label="ETA risk">{d.eta_risk}</Row>}
        {d.supplier_dependency != null && <Row label="Supplier dependency">{Math.round(d.supplier_dependency * 100)}%</Row>}
        <Reasons items={d.reasons} />
      </>
    );
  }

  if (key === 'alternatives_finder') {
    const altList: any[] = Array.isArray(d.alternatives) ? d.alternatives : [];
    return (
      <>
        {altList.slice(0, 3).map((alt, i) => (
          <div key={i} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: i < Math.min(altList.length, 3) - 1 ? '1px solid rgba(245,158,11,0.08)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e8e3d8' }}>#{alt.rank ?? i + 1} {alt.supplier_name || 'Alternative'}</span>
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
        {d.recommendation_summary && (
          <div style={{ fontSize: 9.5, color: '#6ee7b7', marginTop: 4, lineHeight: 1.4 }}>{d.recommendation_summary}</div>
        )}
      </>
    );
  }

  if (key === 'import_compliance') {
    const byCountry: Record<string, any> = d.compliance_by_country || {};
    return (
      <>
        {Object.entries(byCountry).slice(0, 4).map(([code, info]: [string, any]) => (
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
                Docs: {info.mandatory_documents.map((x: any) => x.document || x).slice(0, 3).join(', ')}
              </div>
            )}
          </div>
        ))}
        {d.summary && <div style={{ fontSize: 9.5, color: 'rgba(150,140,100,0.8)', marginTop: 4, lineHeight: 1.4 }}>{d.summary}</div>}
      </>
    );
  }

  if (key === 'adversarial') {
    const flags: any[] = Array.isArray(d.flags) ? d.flags : [];
    return (
      <>
        {d.recommended_action && (
          <div style={{ fontSize: 10, color: '#f1f5f9', fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>{d.recommended_action}</div>
        )}
        {d.confidence_in_recommendation != null && <Row label="Confidence">{Math.round(d.confidence_in_recommendation * 100)}%</Row>}
        <Reasons items={flags.map((f: any) => (typeof f === 'string' ? f : f.flag || JSON.stringify(f)))} />
      </>
    );
  }

  return null;
}

// ── Status indicator (rail icon) ──────────────────────────────────────────────
const StatusCircle: React.FC<{ status: StepStatus; index: number; color: string }> = ({ status, index, color }) => {
  if (status === 'done') {
    return <CheckCircle2 size={20} color="#10b981" />;
  }
  if (status === 'running') {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 0 3px ${color}22`, animation: 'pulse-dot 1.2s ease-in-out infinite',
      }}>
        <Loader2 size={16} color={color} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  // pending
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: '1.5px solid rgba(150,140,100,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: 'rgba(150,140,100,0.5)',
    }}>{index + 1}</div>
  );
};

export const LiveAgentResults: React.FC<LiveAgentResultsProps> = ({
  agents, agentStatus, supplier, updatedAt, live,
}) => {
  const a = agents || {};
  const statusMap = agentStatus || {};

  const stepStatus = (key: string): StepStatus => {
    if (statusMap[key] === 'done' || a[key]) return 'done';
    if (statusMap[key] === 'running') return 'running';
    return 'pending';
  };

  const hasAny = CHAIN.some((s) => stepStatus(s.key) !== 'pending');

  // Auto-expand the active agent (running), else the last completed agent so the
  // conclusion is visible. User clicks override until the auto-target changes.
  const runningKey = CHAIN.find((s) => stepStatus(s.key) === 'running')?.key ?? null;
  const lastDoneKey = [...CHAIN].reverse().find((s) => stepStatus(s.key) === 'done')?.key ?? null;
  const autoTarget = runningKey || lastDoneKey;

  const [expandedKey, setExpandedKey] = React.useState<string | null>(autoTarget);
  const lastAutoRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (autoTarget && autoTarget !== lastAutoRef.current) {
      lastAutoRef.current = autoTarget;
      setExpandedKey(autoTarget);
    }
  }, [autoTarget]);

  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div style={{
      background: 'rgba(20,20,18,0.9)',
      border: '1px solid rgba(245,158,11,0.1)',
      borderRadius: 10,
      padding: '11px 12px',
    }}>
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11, fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: live ? '#dc2626' : hasAny ? '#10b981' : 'rgba(150,140,100,0.5)',
          boxShadow: live || hasAny ? `0 0 6px ${live ? '#dc2626' : '#10b981'}` : 'none',
          animation: live ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.08em', color: live ? '#fca5a5' : hasAny ? '#6ee7b7' : 'rgba(150,140,100,0.7)' }}>
          {live ? 'LIVE — REASONING CHAIN' : hasAny ? 'REASONING CHAIN' : 'AGENT PIPELINE'}
        </span>
        {ts && <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>{ts}</span>}
      </div>

      {!hasAny && (
        <div style={{ fontSize: 10.5, color: 'rgba(130,120,90,0.85)', marginBottom: 6, lineHeight: 1.45 }}>
          Click <strong style={{ color: '#e8e3d8' }}>Run Analysis</strong> to run the chain.
        </div>
      )}

      {/* Reasoning chain (vertical stepper) */}
      {CHAIN.map((step, idx) => {
        const status = stepStatus(step.key);
        const isLast = idx === CHAIN.length - 1;
        const isExpanded = expandedKey === step.key && status === 'done';
        const Icon = step.icon;
        const dim = status === 'pending';
        // Connector is green once this step is complete, else faint.
        const lineColor = status === 'done' ? 'rgba(16,185,129,0.5)' : 'rgba(150,140,100,0.18)';

        return (
          <div key={step.key} style={{ display: 'flex', gap: 9 }}>
            {/* Rail: status circle + connector line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              <StatusCircle status={status} index={idx} color={step.color} />
              {!isLast && (
                <div style={{
                  flex: 1, width: 2, minHeight: 16, marginTop: 3,
                  background: lineColor,
                  transition: 'background 0.4s ease',
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 12 }}>
              {/* Clickable header */}
              <button
                onClick={() => status === 'done' && setExpandedKey(isExpanded ? null : step.key)}
                disabled={status !== 'done'}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  background: 'none', border: 'none', padding: '1px 0', textAlign: 'left',
                  cursor: status === 'done' ? 'pointer' : 'default',
                }}
              >
                <Icon size={12} color={dim ? 'rgba(150,140,100,0.5)' : step.color} />
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: dim ? 'rgba(150,140,100,0.55)' : '#e8e3d8',
                }}>
                  {step.label}
                </span>
                {status === 'running' && (
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: step.color, letterSpacing: '0.05em' }}>RUNNING…</span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {headerSummary(step.key, a, status)}
                  {status === 'done' && (
                    <ChevronDown
                      size={13}
                      color="rgba(150,140,100,0.7)"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  )}
                </span>
              </button>

              {/* Expanded detail (only completed agents) */}
              {isExpanded && (
                <div style={{
                  marginTop: 7, padding: '9px 11px',
                  background: 'rgba(0,0,0,0.18)',
                  border: `1px solid ${step.color}20`,
                  borderRadius: 8,
                }}>
                  {agentDetail(step.key, a, supplier)}
                </div>
              )}

              {/* Running placeholder */}
              {status === 'running' && (
                <div style={{ marginTop: 6, fontSize: 9.5, color: 'rgba(180,170,140,0.7)', fontStyle: 'italic' }}>
                  Reasoning…
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
