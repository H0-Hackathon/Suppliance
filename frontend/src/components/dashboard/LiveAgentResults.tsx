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

// The fixed reasoning chain, in execution order. Colors pull from the brand
// palette + semantic severity tones — no decorative one-off hues.
const CHAIN: ChainStep[] = [
  { key: 'tariff_monitor', label: 'TariffMonitor', icon: TrendingUp, color: '#84D7D8' },
  { key: 'impact_calculator', label: 'ImpactCalculator', icon: Zap, color: '#E24B4A' },
  { key: 'alternatives_finder', label: 'AlternativesFinder', icon: Search, color: '#5BA86F' },
  { key: 'import_compliance', label: 'ImportCompliance', icon: ShieldCheck, color: '#548C92' },
  { key: 'adversarial', label: 'Adversarial', icon: Gavel, color: '#E0A23B' },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#E24B4A', high: '#E24B4A', medium: '#E0A23B', low: '#5BA86F',
  caution: '#E0A23B', clear: '#5BA86F', block: '#E24B4A',
};
const sev = (s?: string | null) => (s || 'unknown').toString().toLowerCase();
const sevColor = (s?: string | null) => SEVERITY_COLOR[sev(s)] || '#9DAAAD';
const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

const MUTED = 'var(--text-muted)';
const FG = 'var(--foreground)';

const Badge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
    color, background: `${color}1F`, borderRadius: 5, padding: '2px 7px',
    whiteSpace: 'nowrap',
  }}>{text}</span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
    <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
    <span style={{ fontSize: 13, color: FG, fontWeight: 600, textAlign: 'right' }}>{children}</span>
  </div>
);

const Reasons: React.FC<{ items?: string[] }> = ({ items }) =>
  items && items.length > 0 ? (
    <ul style={{ margin: '8px 0 0', paddingLeft: 16, listStyle: 'disc' }}>
      {items.slice(0, 3).map((r, i) => (
        <li key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>{r}</li>
      ))}
    </ul>
  ) : null;

// ── Per-agent collapsed summary (shown in the header) ─────────────────────────
function headerSummary(key: string, agents: AgentResults, status: StepStatus): React.ReactNode {
  if (status !== 'done') return null;
  const d = agents[key];
  if (!d) return null;
  switch (key) {
    case 'tariff_monitor': {
      const country = (d.affected_countries?.[0] ?? d.country) as string | null;
      return <>
        {d.tariff_rate != null && <Badge text={`+${d.tariff_rate}%`} color="#E24B4A" />}
        {d.event_type && <Badge text={d.event_type} color="#84D7D8" />}
        {country && <Badge text={country} color="#9DAAAD" />}
      </>;
    }
    case 'impact_calculator':
      return <>
        <Badge text={money(d.direct_cost ?? d.extra_cost_usd)} color="#E24B4A" />
        <Badge text={sev(d.severity)} color={sevColor(d.severity)} />
      </>;
    case 'alternatives_finder': {
      const n = Array.isArray(d.options) ? d.options.length : Array.isArray(d.alternatives) ? d.alternatives.length : 0;
      return n ? <Badge text={`${n} option${n !== 1 ? 's' : ''}`} color="#5BA86F" /> : null;
    }
    case 'import_compliance': {
      if (d.no_viable_option) return <Badge text="BLOCKED" color="#E24B4A" />;
      return d.recommended_country
        ? <Badge text={d.recommended_country} color="#548C92" />
        : null;
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
    const country = (d.affected_countries?.[0] ?? d.country) as string | null;
    const product = (d.affected_product_name ?? d.product) as string | null;
    return (
      <>
        {d.event && (
          <div style={{ fontSize: 13.5, color: FG, fontWeight: 600, lineHeight: 1.45, marginBottom: 10 }}>{d.event}</div>
        )}
        {country && <Row label="Country">{country}</Row>}
        {supplier && <Row label="Supplier">{supplier}</Row>}
        {product && <Row label="Product">{product}</Row>}
        {Array.isArray(d.affected_hs_codes) && d.affected_hs_codes.length > 0 && (
          <Row label="HS codes">{d.affected_hs_codes.join(', ')}</Row>
        )}
        <Row label="Tariff change">{d.tariff_rate != null ? <span style={{ color: '#E24B4A' }}>+{d.tariff_rate}%</span> : '—'}</Row>
        {d.confidence != null && <Row label="Confidence">{Math.round(d.confidence * 100)}%</Row>}
        <Row label="Source">{d.source || d.risk_source || '—'}</Row>
        {d.source_url && (
          <a href={d.source_url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12.5, color: 'var(--seafoam)', textDecoration: 'none' }}>
            <ExternalLink size={12} /> View source headline
          </a>
        )}
      </>
    );
  }

  if (key === 'impact_calculator') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#E24B4A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {money(d.direct_cost ?? d.extra_cost_usd)}
          </span>
          <span style={{ fontSize: 12, color: MUTED }}>direct cost</span>
        </div>
        <Row label="Affected orders">{d.affected_orders ?? 0}</Row>
        {d.risk_score != null && <Row label="Risk score">{d.risk_score}</Row>}
        {d.eta_risk && <Row label="ETA risk">{d.eta_risk}</Row>}
        {d.supplier_dependency != null && <Row label="Supplier dependency">{Math.round(d.supplier_dependency * 100)}%</Row>}
        {d.historical_basis && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{d.historical_basis}</div>
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
          <div style={{ fontSize: 13, color: MUTED }}>No alternatives returned.</div>
        )}
        {altList.slice(0, 3).map((alt, i) => (
          <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < Math.min(altList.length, 3) - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: FG }}>
                #{i + 1} {alt.supplier ?? alt.supplier_name ?? 'Alternative'}
              </span>
              {(alt.country ?? alt.country_full) && (
                <Badge text={alt.country ?? alt.country_full} color="#548C92" />
              )}
              {alt.source === 'global_suppliers_db' && (
                <Badge text="verified" color="#5BA86F" />
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {alt.lead_time_weeks != null && <span>{alt.lead_time_weeks}w lead</span>}
              {alt.cost_delta_pct != null && (
                <span style={{ color: alt.cost_delta_pct <= 0 ? '#5BA86F' : '#E24B4A' }}>
                  {alt.cost_delta_pct > 0 ? '+' : ''}{alt.cost_delta_pct}% cost
                </span>
              )}
            </div>
            {(alt.stability_note ?? alt.selection_reasoning) && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>
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
        <div style={{ fontSize: 13.5, color: '#E24B4A', fontWeight: 600, lineHeight: 1.5 }}>
          BLOCKED — {d.reason ?? 'No viable alternative found.'}
        </div>
      );
    }
    const docs: string[] = Array.isArray(d.required_documents) ? d.required_documents : [];
    const risks: string[] = Array.isArray(d.risk_factors) ? d.risk_factors : [];
    return (
      <>
        {d.recommended_supplier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: FG }}>{d.recommended_supplier}</span>
            {d.recommended_country && <Badge text={d.recommended_country} color="#548C92" />}
            {d.compliance_feasibility && <Badge text={`${d.compliance_feasibility} feasibility`} color="#5BA86F" />}
          </div>
        )}
        {d.lead_time_weeks != null && <Row label="Lead time">{d.lead_time_weeks}w</Row>}
        {d.cost_delta_pct != null && (
          <Row label="Cost delta">
            <span style={{ color: d.cost_delta_pct <= 0 ? '#5BA86F' : '#E24B4A' }}>
              {d.cost_delta_pct > 0 ? '+' : ''}{d.cost_delta_pct}%
            </span>
          </Row>
        )}
        {d.rationale && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{d.rationale}</div>
        )}
        {docs.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Required docs</div>
            {docs.slice(0, 4).map((doc, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>· {doc}</div>
            ))}
            {docs.length > 4 && <div style={{ fontSize: 12, color: MUTED }}>+{docs.length - 4} more</div>}
          </div>
        )}
        {risks.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: '#E88F8E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Risk factors</div>
            {risks.slice(0, 2).map((r, i) => (
              <div key={i} style={{ fontSize: 12.5, color: '#E88F8E', lineHeight: 1.5 }}>· {r}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: verdictColor, letterSpacing: '0.03em',
              background: `${verdictColor}1F`, padding: '4px 10px', borderRadius: 6,
            }}>{d.verdict}</span>
            {confidence != null && (
              <span style={{ fontSize: 12.5, color: MUTED }}>{Math.round(confidence * 100)}% confidence</span>
            )}
          </div>
        )}
        {recommendation && (
          <div style={{
            fontSize: 13, color: FG, fontWeight: 500, lineHeight: 1.55, marginBottom: 10,
            background: 'rgba(132,215,216,0.08)', borderLeft: '2px solid var(--seafoam)',
            padding: '8px 12px', borderRadius: 6,
          }}>{recommendation}</div>
        )}
        {flags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: '#E88F8E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Flags</div>
            <Reasons items={flags.map((f: any) => (typeof f === 'string' ? f : f.flag || JSON.stringify(f)))} />
          </div>
        )}
        {challenged.length > 0 && (
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--clay)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Challenged assumptions</div>
            <Reasons items={challenged.map((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)))} />
          </div>
        )}
      </>
    );
  }

  return null;
}

// ── Status indicator (rail icon) ──────────────────────────────────────────────
const StatusCircle: React.FC<{ status: StepStatus; index: number; color: string }> = ({ status, index, color }) => {
  if (status === 'done') {
    return <CheckCircle2 size={22} color="#5BA86F" />;
  }
  if (status === 'running') {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 0 3px ${color}22`, animation: 'pulse-dot 1.4s ease-in-out infinite',
      }}>
        <Loader2 size={17} color={color} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      border: '1.5px solid rgba(157,170,173,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
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
    <div>
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: MUTED }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: live ? 'var(--seafoam)' : hasAny ? 'var(--safe)' : 'var(--text-muted)',
          boxShadow: live || hasAny ? `0 0 6px ${live ? 'var(--seafoam)' : 'var(--safe)'}` : 'none',
          animation: live ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', color: live ? 'var(--seafoam)' : hasAny ? '#93CDA3' : MUTED }}>
          {live ? 'LIVE · REASONING CHAIN' : hasAny ? 'REASONING CHAIN' : 'AGENT PIPELINE'}
        </span>
        {ts && <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>{ts}</span>}
      </div>

      {!hasAny && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
          Click <strong style={{ color: FG }}>Run Analysis</strong> to run the 5-agent chain.
        </div>
      )}

      {/* Reasoning chain (vertical stepper) */}
      {CHAIN.map((step, idx) => {
        const status = stepStatus(step.key);
        const isLast = idx === CHAIN.length - 1;
        const isExpanded = expandedKey === step.key && status === 'done';
        const Icon = step.icon;
        const dim = status === 'pending';
        const lineColor = status === 'done' ? 'rgba(91,168,111,0.45)' : 'var(--border-soft)';

        return (
          <div key={step.key} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              <StatusCircle status={status} index={idx} color={step.color} />
              {!isLast && (
                <div style={{ flex: 1, width: 2, minHeight: 18, marginTop: 4, background: lineColor, transition: 'background 0.4s ease' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 16 }}>
              <button
                onClick={() => status === 'done' && setExpandedKey(isExpanded ? null : step.key)}
                disabled={status !== 'done'}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', padding: '2px 0', textAlign: 'left',
                  cursor: status === 'done' ? 'pointer' : 'default',
                }}
              >
                <Icon size={15} color={dim ? 'var(--text-muted)' : step.color} />
                <span style={{ fontSize: 14, fontWeight: 600, color: dim ? 'var(--text-muted)' : FG }}>
                  {step.label}
                </span>
                {status === 'running' && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: step.color, letterSpacing: '0.04em' }}>RUNNING…</span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {headerSummary(step.key, a, status)}
                  {status === 'done' && (
                    <ChevronDown size={15} color="var(--text-muted)"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div style={{
                  marginTop: 10, padding: '12px 14px',
                  background: 'rgba(22,50,58,0.5)',
                  border: `1px solid ${step.color}26`,
                  borderRadius: 8,
                }}>
                  {agentDetail(step.key, a, supplier)}
                </div>
              )}

              {status === 'running' && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
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
