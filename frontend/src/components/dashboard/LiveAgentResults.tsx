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

const CHAIN: ChainStep[] = [
  { key: 'tariff_monitor', label: 'Tariff check', icon: TrendingUp, color: 'var(--harbor)' },
  { key: 'impact_calculator', label: 'Cost exposure', icon: Zap, color: 'var(--driftwood)' },
  { key: 'alternatives_finder', label: 'Alternate suppliers', icon: Search, color: 'var(--ocean)' },
  { key: 'import_compliance', label: 'Import compliance', icon: ShieldCheck, color: 'var(--harbor)' },
  { key: 'adversarial', label: 'Second review', icon: Gavel, color: 'var(--driftwood)' },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--critical)', high: 'var(--driftwood)', medium: 'var(--driftwood-muted)', low: 'var(--harbor)',
  caution: 'var(--driftwood)', clear: 'var(--harbor)', block: 'var(--critical)',
};
const sev = (s?: string | null) => (s || 'unknown').toString().toLowerCase();
const sevColor = (s?: string | null) => SEVERITY_COLOR[sev(s)] || 'var(--driftwood)';
const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

const Tag: React.FC<{ text: string; tone?: 'harbor' | 'warning' | 'critical' }> = ({
  text,
  tone = 'harbor',
}) => {
  const styles: Record<string, React.CSSProperties> = {
    harbor: { color: 'var(--harbor)', background: 'var(--low-soft)', border: '1px solid rgba(84, 140, 146, 0.22)' },
    warning: { color: 'var(--driftwood)', background: 'var(--warning-soft)', border: '1px solid rgba(171, 144, 114, 0.22)' },
    critical: { color: 'var(--critical)', background: 'var(--critical-soft)', border: '1px solid rgba(181, 74, 58, 0.22)' },
  };
  return (
    <span style={{
      fontSize: 10, fontWeight: 500,
      borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
      ...styles[tone],
    }}>{text}</span>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
    <span style={{ fontSize: 10, color: 'var(--ws-text-muted)' }}>{label}</span>
    <span style={{ fontSize: 10, color: 'var(--ws-text)', fontWeight: 600, textAlign: 'right' }}>{children}</span>
  </div>
);

const Reasons: React.FC<{ items?: string[] }> = ({ items }) =>
  items && items.length > 0 ? (
    <ul style={{ margin: '6px 0 0', paddingLeft: 14, listStyle: 'disc' }}>
      {items.slice(0, 3).map((r, i) => (
        <li key={i} style={{ fontSize: 10, color: 'var(--ws-text-secondary)', lineHeight: 1.4, marginBottom: 2 }}>{r}</li>
      ))}
    </ul>
  ) : null;

function headerSummary(key: string, agents: AgentResults, status: StepStatus): React.ReactNode {
  if (status !== 'done') return null;
  const d = agents[key];
  if (!d) return null;
  switch (key) {
    case 'tariff_monitor': {
      const country = (d.affected_countries?.[0] ?? d.country) as string | null;
      return <>
        {d.tariff_rate != null && <Tag text={`+${d.tariff_rate}% duty`} tone="warning" />}
        {country && <Tag text={country} />}
      </>;
    }
    case 'impact_calculator':
      return <Tag text={money(d.direct_cost ?? d.extra_cost_usd)} tone="warning" />;
    case 'alternatives_finder': {
      const n = Array.isArray(d.options) ? d.options.length : Array.isArray(d.alternatives) ? d.alternatives.length : 0;
      return n ? <Tag text={`${n} option${n !== 1 ? 's' : ''}`} /> : null;
    }
    case 'import_compliance': {
      if (d.no_viable_option) return <Tag text="Blocked" tone="critical" />;
      return d.recommended_country ? <Tag text={d.recommended_country} /> : null;
    }
    case 'adversarial':
      return d.verdict ? <Tag text={d.verdict} color={sevColor(d.verdict)} /> : null;
    default:
      return null;
  }
}

function agentDetail(key: string, agents: AgentResults, supplier?: string | null): React.ReactNode {
  const d = agents[key];
  if (!d) return null;

  if (key === 'tariff_monitor') {
    const country = (d.affected_countries?.[0] ?? d.country) as string | null;
    const product = (d.affected_product_name ?? d.product) as string | null;
    return (
      <>
        {d.event && (
          <div style={{ fontSize: 11, color: 'var(--ws-text)', fontWeight: 600, lineHeight: 1.35, marginBottom: 7 }}>{d.event}</div>
        )}
        {country && <Row label="Country">{country}</Row>}
        {supplier && <Row label="Supplier">{supplier}</Row>}
        {product && <Row label="Product">{product}</Row>}
        {Array.isArray(d.affected_hs_codes) && d.affected_hs_codes.length > 0 && (
          <Row label="HS codes">{d.affected_hs_codes.join(', ')}</Row>
        )}
        <Row label="Tariff change">{d.tariff_rate != null ? <span style={{ color: 'var(--driftwood)' }}>+{d.tariff_rate}%</span> : '—'}</Row>
        {d.confidence != null && <Row label="Confidence">{Math.round(d.confidence * 100)}%</Row>}
        <Row label="Source">{d.source || d.risk_source || '—'}</Row>
        {d.source_url && (
          <a href={d.source_url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: 'var(--harbor)', textDecoration: 'none' }}>
            <ExternalLink size={10} /> View source
          </a>
        )}
      </>
    );
  }

  if (key === 'impact_calculator') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--driftwood)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {money(d.direct_cost ?? d.extra_cost_usd)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--ws-text-muted)' }}>direct cost</span>
        </div>
        <Row label="Affected orders">{d.affected_orders ?? 0}</Row>
        {d.risk_score != null && <Row label="Risk score">{d.risk_score}</Row>}
        {d.eta_risk && <Row label="ETA risk">{d.eta_risk}</Row>}
        {d.supplier_dependency != null && <Row label="Supplier dependency">{Math.round(d.supplier_dependency * 100)}%</Row>}
        {d.historical_basis && (
          <div style={{ fontSize: 10, color: 'var(--ws-text-muted)', marginTop: 5, lineHeight: 1.4 }}>{d.historical_basis}</div>
        )}
        <Reasons items={d.reasons} />
      </>
    );
  }

  if (key === 'alternatives_finder') {
    const altList: any[] = Array.isArray(d.options) ? d.options : Array.isArray(d.alternatives) ? d.alternatives : [];
    return (
      <>
        {altList.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--ws-text-muted)' }}>No alternatives returned.</div>
        )}
        {altList.slice(0, 3).map((alt, i) => (
          <div key={i} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: i < Math.min(altList.length, 3) - 1 ? '1px solid var(--ws-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ws-text)' }}>
                #{i + 1} {alt.supplier ?? alt.supplier_name ?? 'Alternative'}
              </span>
              {(alt.country ?? alt.country_full) && (
                <Tag text={alt.country ?? alt.country_full} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ws-text-secondary)' }}>
              {alt.lead_time_weeks != null && <span>{alt.lead_time_weeks}w lead</span>}
              {alt.cost_delta_pct != null && (
                <span style={{ color: alt.cost_delta_pct <= 0 ? 'var(--harbor)' : 'var(--driftwood)' }}>
                  {alt.cost_delta_pct > 0 ? '+' : ''}{alt.cost_delta_pct}% cost
                </span>
              )}
            </div>
            {(alt.stability_note ?? alt.selection_reasoning) && (
              <div style={{ fontSize: 10, color: 'var(--ws-text-muted)', marginTop: 3, lineHeight: 1.35 }}>
                {alt.stability_note ?? alt.selection_reasoning}
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  if (key === 'import_compliance') {
    if (d.no_viable_option) {
      return (
        <div style={{ fontSize: 11, color: 'var(--driftwood)', fontWeight: 600, lineHeight: 1.4 }}>
          Blocked — {d.reason ?? 'No viable alternative found.'}
        </div>
      );
    }
    const docs: string[] = Array.isArray(d.required_documents) ? d.required_documents : [];
    const risks: string[] = Array.isArray(d.risk_factors) ? d.risk_factors : [];
    return (
      <>
        {d.recommended_supplier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ws-text)' }}>{d.recommended_supplier}</span>
            {d.recommended_country && <Tag text={d.recommended_country} />}
          </div>
        )}
        {d.lead_time_weeks != null && <Row label="Lead time">{d.lead_time_weeks}w</Row>}
        {d.cost_delta_pct != null && (
          <Row label="Cost delta">
            <span style={{ color: d.cost_delta_pct <= 0 ? 'var(--harbor)' : 'var(--driftwood)' }}>
              {d.cost_delta_pct > 0 ? '+' : ''}{d.cost_delta_pct}%
            </span>
          </Row>
        )}
        {d.rationale && (
          <div style={{ fontSize: 10, color: 'var(--ws-text-secondary)', marginTop: 5, lineHeight: 1.4 }}>{d.rationale}</div>
        )}
        {docs.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--ws-text-muted)', marginBottom: 3 }}>Required documents</div>
            {docs.slice(0, 4).map((doc, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--ws-text-secondary)', lineHeight: 1.4 }}>· {doc}</div>
            ))}
          </div>
        )}
        {risks.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--driftwood-muted)', marginBottom: 3 }}>Risk factors</div>
            {risks.slice(0, 2).map((r, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--ws-text-secondary)', lineHeight: 1.4 }}>· {r}</div>
            ))}
          </div>
        )}
      </>
    );
  }

  if (key === 'adversarial') {
    const flags: any[] = Array.isArray(d.flags) ? d.flags : [];
    const challenged: any[] = Array.isArray(d.challenged_assumptions) ? d.challenged_assumptions : [];
    const recommendation = d.recommendation ?? d.recommended_action;
    const confidence = d.confidence ?? d.confidence_in_recommendation;
    const verdictColor = sevColor(d.verdict);
    return (
      <>
        {d.verdict && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: verdictColor }}>{d.verdict}</span>
            {confidence != null && (
              <span style={{ fontSize: 10, color: 'var(--ws-text-muted)' }}>{Math.round(confidence * 100)}% confidence</span>
            )}
          </div>
        )}
        {recommendation && (
          <div style={{ fontSize: 11, color: 'var(--ws-text)', fontWeight: 500, lineHeight: 1.45, marginBottom: 7 }}>{recommendation}</div>
        )}
        {flags.length > 0 && (
          <div style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 10, color: 'var(--driftwood-muted)', marginBottom: 3 }}>Flags</div>
            <Reasons items={flags.map((f: any) => (typeof f === 'string' ? f : f.flag || JSON.stringify(f)))} />
          </div>
        )}
        {challenged.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--ws-text-muted)', marginBottom: 3 }}>Challenged assumptions</div>
            <Reasons items={challenged.map((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)))} />
          </div>
        )}
      </>
    );
  }

  return null;
}

const StatusCircle: React.FC<{ status: StepStatus; index: number; color: string }> = ({ status, index, color }) => {
  if (status === 'done') {
    return <CheckCircle2 size={18} color="var(--harbor)" />;
  }
  if (status === 'running') {
    return (
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${color}44`,
      }}>
        <Loader2 size={14} color={color} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: 18, height: 18, borderRadius: '50%',
      border: '1.5px solid var(--ws-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 600, color: 'var(--ws-text-muted)',
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
    <div className="ws-assessment-steps" style={{
      background: 'var(--ws-surface)',
      border: '1px solid var(--ws-border)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, color: 'var(--ws-text-muted)' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: live ? 'var(--harbor)' : hasAny ? 'var(--harbor)' : 'var(--ws-border-strong)',
        }} />
        <span style={{ fontWeight: 600, color: 'var(--ws-text-secondary)' }}>
          {live ? 'Trade assessment steps — in progress' : hasAny ? 'Trade assessment steps' : 'Assessment steps'}
        </span>
        {ts && <span style={{ marginLeft: 'auto' }}>{ts}</span>}
      </div>

      {!hasAny && (
        <div style={{ fontSize: 11, color: 'var(--ws-text-muted)', marginBottom: 8, lineHeight: 1.45 }}>
          Run analysis to walk through tariff check, cost exposure, and supplier options.
        </div>
      )}

      {CHAIN.map((step, idx) => {
        const status = stepStatus(step.key);
        const isLast = idx === CHAIN.length - 1;
        const isExpanded = expandedKey === step.key && status === 'done';
        const Icon = step.icon;
        const dim = status === 'pending';
        const lineColor = status === 'done' ? 'var(--ws-harbor)' : 'var(--ws-border)';

        return (
          <div key={step.key} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <StatusCircle status={status} index={idx} color={step.color} />
              {!isLast && (
                <div style={{
                  flex: 1, width: 2, minHeight: 14, marginTop: 3,
                  background: lineColor, opacity: status === 'done' ? 0.5 : 0.35,
                }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 10 }}>
              <button
                onClick={() => status === 'done' && setExpandedKey(isExpanded ? null : step.key)}
                disabled={status !== 'done'}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  background: 'none', border: 'none', padding: '1px 0', textAlign: 'left',
                  cursor: status === 'done' ? 'pointer' : 'default',
                }}
              >
                <Icon size={12} color={dim ? 'var(--ws-text-muted)' : step.color} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: dim ? 'var(--ws-text-muted)' : 'var(--ws-text)',
                }}>
                  {step.label}
                </span>
                {status === 'running' && (
                  <span style={{ fontSize: 10, color: step.color }}>Running…</span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {headerSummary(step.key, a, status)}
                  {status === 'done' && (
                    <ChevronDown
                      size={13}
                      color="var(--ws-text-muted)"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div style={{
                  marginTop: 8, padding: '10px 12px',
                  background: 'var(--ws-bg-elevated)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: 8,
                }}>
                  {agentDetail(step.key, a, supplier)}
                </div>
              )}

              {status === 'running' && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ws-text-muted)' }}>
                  Working through this step…
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
