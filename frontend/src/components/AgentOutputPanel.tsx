import React from 'react';

/**
 * AgentOutputPanel — Structured, per-agent rendering of a monitor run's
 * agent_output JSON.
 *
 * Each of the 5 pipeline agents (tariff_monitor, impact_calculator,
 * alternatives_finder, import_compliance, adversarial) gets its own
 * accordion section with a renderer tailored to that agent's JSON shape
 * (see core/crew_monitor_pipeline.py for the canonical shapes). If an
 * agent's output couldn't be parsed as structured JSON, it falls back to
 * a raw text/JSON dump.
 */

export interface AgentOutputPanelProps {
  agentOutput: Record<string, unknown>;
}

const AGENT_CONFIG: Record<string, { label: string; color: string }> = {
  tariff_monitor:      { label: 'TariffMonitor',      color: '#3B82F6' },
  impact_calculator:   { label: 'ImpactCalculator',   color: '#F97316' },
  alternatives_finder: { label: 'AlternativesFinder', color: '#10B981' },
  import_compliance:   { label: 'ImportCompliance',   color: '#8B5CF6' },
  adversarial:         { label: 'Adversarial',        color: '#EF4444' },
};

const AGENT_ORDER = [
  'tariff_monitor',
  'impact_calculator',
  'alternatives_finder',
  'import_compliance',
  'adversarial',
];

/* ---------------------------------------------------------- */
/* Formatting helpers                                          */
/* ---------------------------------------------------------- */

function compact<T>(arr: (T | false | null | undefined)[]): T[] {
  return arr.filter((x): x is T => Boolean(x));
}

function fmtUSD(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtPercent(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${Math.round(num * 100)}%`;
}

function severityBadgeClass(severity?: string): string {
  switch ((severity || '').toLowerCase()) {
    case 'critical': return 'badge badge-critical';
    case 'high':     return 'badge badge-high';
    case 'medium':   return 'badge badge-medium';
    case 'low':      return 'badge badge-low';
    default:         return 'badge badge-low';
  }
}

function verdictBadgeClass(verdict?: string): string {
  switch ((verdict || '').toUpperCase()) {
    case 'CLEAR':   return 'badge badge-success';
    case 'CAUTION': return 'badge badge-medium';
    case 'BLOCK':   return 'badge badge-critical';
    default:        return 'badge badge-low';
  }
}

function sourceBadgeClass(source?: string): string {
  return source === 'internal' ? 'badge badge-success' : 'badge badge-low';
}

/* ---------------------------------------------------------- */
/* Shared bits                                                 */
/* ---------------------------------------------------------- */

const DetailGrid: React.FC<{ items: [string, React.ReactNode][] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 4 }}>
      {items.map(([label, value]) => (
        <React.Fragment key={label}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

const SubCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 12px',
      marginBottom: 8,
      background: 'white',
    }}
  >
    {children}
  </div>
);

/* ---------------------------------------------------------- */
/* Per-agent renderers                                         */
/* ---------------------------------------------------------- */

function renderTariffMonitor(data: Record<string, unknown>): React.ReactNode {
  const eventType = data.event_type as string | undefined;
  const event = data.event as string | undefined;
  const country = data.country as string | undefined;
  const product = data.product as string | undefined;
  const tariffRate = data.tariff_rate as number | null | undefined;
  const confidence = data.confidence as number | undefined;
  const source = data.source as string | undefined;
  const sourceUrl = data.source_url as string | null | undefined;
  const summary = data.summary as string | undefined;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {eventType && <span className="badge badge-low">{eventType}</span>}
        {typeof confidence === 'number' && (
          <span className="badge badge-low">{fmtPercent(confidence)} confidence</span>
        )}
      </div>
      {event && (
        <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>{event}</p>
      )}
      <DetailGrid
        items={compact([
          country && (['Country', country] as [string, React.ReactNode]),
          product && (['Product', product] as [string, React.ReactNode]),
          typeof tariffRate === 'number' && (['Tariff rate', `${tariffRate}%`] as [string, React.ReactNode]),
          source && (['Source', source] as [string, React.ReactNode]),
        ])}
      />
      {summary && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{summary}</p>
      )}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: 'var(--primary)', display: 'inline-block', marginTop: 6 }}
        >
          View source →
        </a>
      )}
    </div>
  );
}

function renderImpactCalculator(data: Record<string, unknown>): React.ReactNode {
  const directCost = (data.direct_cost ?? data.extra_cost_usd) as number | undefined;
  const affectedOrders = data.affected_orders as number | undefined;
  const exposureScore = data.exposure_score as number | undefined;
  const riskScore = data.risk_score as number | undefined;
  const etaRisk = data.eta_risk as string | undefined;
  const supplierDependency = data.supplier_dependency as number | undefined;
  const reasons = (data.reasons ?? []) as string[];

  return (
    <div>
      {etaRisk && (
        <div style={{ marginBottom: 8 }}>
          <span className={severityBadgeClass(etaRisk)}>ETA risk: {etaRisk}</span>
        </div>
      )}
      <DetailGrid
        items={compact([
          typeof directCost === 'number' && (['Direct cost', fmtUSD(directCost)] as [string, React.ReactNode]),
          typeof affectedOrders === 'number' && (['Affected orders', String(affectedOrders)] as [string, React.ReactNode]),
          typeof exposureScore === 'number' && (['Exposure score', exposureScore.toFixed(1)] as [string, React.ReactNode]),
          typeof riskScore === 'number' && (['Risk score', riskScore.toFixed(1)] as [string, React.ReactNode]),
          typeof supplierDependency === 'number' && (['Supplier dependency', fmtPercent(supplierDependency)] as [string, React.ReactNode]),
        ])}
      />
      {reasons.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {reasons.map((r, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '2px 0', display: 'flex', gap: 6 }}>
              <span style={{ color: AGENT_CONFIG.impact_calculator.color, fontWeight: 700 }}>•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderAlternativesFinder(data: Record<string, unknown>): React.ReactNode {
  const alternatives = (data.alternatives ?? []) as Record<string, unknown>[];
  const recommendationSummary = data.recommendation_summary as string | undefined;

  return (
    <div>
      {recommendationSummary && (
        <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 10, fontWeight: 500 }}>
          {recommendationSummary}
        </p>
      )}
      {alternatives.map((alt, i) => {
        const rank = alt.rank as number | undefined;
        const supplierName = alt.supplier_name as string | undefined;
        const country = alt.country as string | undefined;
        const countryFull = alt.country_full as string | undefined;
        const source = alt.source as string | undefined;
        const leadTime = alt.lead_time_weeks as number | undefined;
        const canMeetDeadline = alt.can_meet_deadline as boolean | undefined;
        const deadlineReasoning = alt.deadline_reasoning as string | undefined;
        const costDeltaPct = alt.cost_delta_pct as number | undefined;
        const costDeltaUsd = alt.cost_delta_usd as number | undefined;
        const selectionReasoning = alt.selection_reasoning as string | undefined;
        const risks = (alt.risks ?? []) as string[];

        return (
          <SubCard key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>
                {typeof rank === 'number' ? `#${rank} ` : ''}{supplierName || 'Unnamed supplier'}
              </span>
              {(countryFull || country) && <span className="badge badge-low">{countryFull || country}</span>}
              {source && <span className={sourceBadgeClass(source)}>{source}</span>}
              {typeof canMeetDeadline === 'boolean' && (
                <span className={canMeetDeadline ? 'badge badge-success' : 'badge badge-critical'}>
                  {canMeetDeadline ? 'meets deadline' : 'misses deadline'}
                </span>
              )}
            </div>
            <DetailGrid
              items={compact([
                typeof leadTime === 'number' && (['Lead time', `${leadTime} weeks`] as [string, React.ReactNode]),
                typeof costDeltaPct === 'number' && ([
                  'Cost delta',
                  `${costDeltaPct > 0 ? '+' : ''}${costDeltaPct}%${typeof costDeltaUsd === 'number' ? ` (${fmtUSD(costDeltaUsd)})` : ''}`,
                ] as [string, React.ReactNode]),
              ])}
            />
            {deadlineReasoning && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{deadlineReasoning}</p>
            )}
            {selectionReasoning && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{selectionReasoning}</p>
            )}
            {risks.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--high)', marginTop: 4 }}>⚠ {risks.join('; ')}</p>
            )}
          </SubCard>
        );
      })}
    </div>
  );
}

function renderImportCompliance(data: Record<string, unknown>): React.ReactNode {
  const byCountry = (data.compliance_by_country ?? {}) as Record<string, Record<string, unknown>>;
  const summary = data.summary as string | undefined;

  return (
    <div>
      {summary && (
        <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 10, fontWeight: 500 }}>{summary}</p>
      )}
      {Object.entries(byCountry).map(([code, c]) => {
        const sanctionsClear = c.sanctions_clear as boolean | undefined;
        const sanctionsNote = c.sanctions_note as string | null | undefined;
        const mandatory = (c.mandatory_documents ?? []) as Record<string, unknown>[];
        const conditional = (c.conditional_documents ?? []) as Record<string, unknown>[];
        const recommended = (c.recommended_documents ?? []) as Record<string, unknown>[];
        const timeline = c.compliance_timeline_days as number | undefined;
        const risk = c.overall_compliance_risk as string | undefined;
        const explanation = c.compliance_explanation as string | undefined;

        return (
          <SubCard key={code}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{code}</span>
              {risk && <span className={severityBadgeClass(risk)}>{risk} risk</span>}
              {typeof sanctionsClear === 'boolean' && (
                <span className={sanctionsClear ? 'badge badge-success' : 'badge badge-critical'}>
                  {sanctionsClear ? 'sanctions clear' : 'sanctions flag'}
                </span>
              )}
              {typeof timeline === 'number' && <span className="badge badge-low">{timeline}-day timeline</span>}
            </div>
            {sanctionsNote && (
              <p style={{ fontSize: 11, color: 'var(--high)', marginBottom: 4 }}>{sanctionsNote}</p>
            )}
            {mandatory.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Mandatory:</span>
                <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0' }}>
                  {mandatory.map((doc, i) => (
                    <li key={i} style={{ fontSize: 11, color: 'var(--text)', padding: '1px 0' }}>
                      • {String(doc.document)}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        ({String(doc.regulatory_basis)}, {String(doc.timeline_days)}d)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {conditional.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Conditional:</span>
                <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0' }}>
                  {conditional.map((doc, i) => (
                    <li key={i} style={{ fontSize: 11, color: 'var(--text)', padding: '1px 0' }}>
                      • {String(doc.document)}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        — if {String(doc.condition)} ({String(doc.regulatory_basis)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recommended.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Recommended: {recommended.map((doc) => String(doc.document)).join(', ')}
              </p>
            )}
            {explanation && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{explanation}</p>
            )}
          </SubCard>
        );
      })}
    </div>
  );
}

function renderAdversarial(data: Record<string, unknown>): React.ReactNode {
  const verdict = data.verdict as string | undefined;
  const flags = (data.flags ?? []) as Record<string, unknown>[];
  const recommendedAction = data.recommended_action as string | undefined;
  const confidence = data.confidence_in_recommendation as number | undefined;
  const reasoningChain = (data.reasoning_chain ?? []) as string[];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        {verdict && <span className={verdictBadgeClass(verdict)}>{verdict}</span>}
        {typeof confidence === 'number' && (
          <span className="badge badge-low">{fmtPercent(confidence)} confidence</span>
        )}
      </div>
      {recommendedAction && (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>
          {recommendedAction}
        </p>
      )}
      {flags.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {flags.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
              <span className={severityBadgeClass(f.severity as string | undefined)} style={{ flexShrink: 0 }}>
                {String(f.severity ?? 'flag')}
              </span>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text)' }}>{String(f.flag)}</p>
                {f.resolution && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {String(f.resolution)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {reasoningChain.length > 0 && (
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {reasoningChain.map((step, i) => (
            <li key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 0' }}>
              {step.replace(/^Step \d+:\s*/, '')}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function renderRaw(data: Record<string, unknown>): React.ReactNode {
  const content = typeof data.raw === 'string' ? data.raw : JSON.stringify(data, null, 2);
  return (
    <pre
      style={{
        fontSize: 11,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--text-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        margin: 0,
      }}
    >
      {content}
    </pre>
  );
}

function renderAgentBody(key: string, data: Record<string, unknown>): React.ReactNode {
  if ('raw' in data) {
    return renderRaw(data);
  }
  switch (key) {
    case 'tariff_monitor':      return renderTariffMonitor(data);
    case 'impact_calculator':   return renderImpactCalculator(data);
    case 'alternatives_finder': return renderAlternativesFinder(data);
    case 'import_compliance':   return renderImportCompliance(data);
    case 'adversarial':         return renderAdversarial(data);
    default:                    return renderRaw(data);
  }
}

function headerBadge(key: string, data: Record<string, unknown>): React.ReactNode {
  if ('raw' in data) return null;
  switch (key) {
    case 'tariff_monitor':
      return data.severity ? <span className={severityBadgeClass(data.severity as string)}>{String(data.severity)}</span> : null;
    case 'impact_calculator':
      return data.eta_risk ? <span className={severityBadgeClass(data.eta_risk as string)}>ETA {String(data.eta_risk)}</span> : null;
    case 'alternatives_finder':
      return Array.isArray(data.alternatives) ? <span className="badge badge-low">{data.alternatives.length} options</span> : null;
    case 'import_compliance':
      return data.compliance_by_country
        ? <span className="badge badge-low">{Object.keys(data.compliance_by_country as object).length} countries</span>
        : null;
    case 'adversarial':
      return data.verdict ? <span className={verdictBadgeClass(data.verdict as string)}>{String(data.verdict)}</span> : null;
    default:
      return null;
  }
}

/* ---------------------------------------------------------- */
/* Main component                                              */
/* ---------------------------------------------------------- */

export const AgentOutputPanel: React.FC<AgentOutputPanelProps> = ({ agentOutput }) => {
  const [openAgent, setOpenAgent] = React.useState<string | null>(null);

  const agentKeys = AGENT_ORDER.filter((k) => agentOutput[k]);

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {agentKeys.map((key, idx) => {
        const config = AGENT_CONFIG[key];
        const isOpen = openAgent === key;
        const data = agentOutput[key] as Record<string, unknown>;

        return (
          <div key={key} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
            <button
              onClick={() => setOpenAgent(isOpen ? null : key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: isOpen ? '#F8FAFC' : 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: config.color,
                  flexShrink: 0,
                }}
              />
              {config.label}
              {headerBadge(key, data)}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {isOpen && (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#FAFAFA',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {renderAgentBody(key, data)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AgentOutputPanel;
