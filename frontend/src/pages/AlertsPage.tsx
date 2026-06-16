import React, { useState, useMemo } from 'react';
import './AlertsPage.css';

interface Alert {
  id: string;
  title: string;
  country: string;
  product: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  timeDetected: string;
}

interface SelectedAlert extends Alert {
  event: { summary: string };
  impact: {
    affectedOrders: number;
    exposureAmount: number;
    estimatedAdditionalCost: number;
    riskScore: number;
  };
  recommendedAction: {
    alternativeSupplier: string;
    expectedSavings: number;
    leadTime: string;
  };
  complianceStatus: 'pass' | 'review_required';
  agentWorkflow: {
    monitor: boolean;
    impact: boolean;
    alternatives: boolean;
    compliance: boolean;
    validation: boolean;
  };
}

const MOCK_ALERTS: Alert[] = [
  { id: '1', title: 'Vietnam Tariff Escalation', country: 'Vietnam', product: 'Electronics', severity: 'critical', confidence: 98, timeDetected: '2 hours ago' },
  { id: '2', title: 'Port Congestion Alert', country: 'Singapore', product: 'Textiles', severity: 'high', confidence: 85, timeDetected: '4 hours ago' },
  { id: '3', title: 'Factory Strike Notice', country: 'Mexico', product: 'Auto Parts', severity: 'high', confidence: 92, timeDetected: '6 hours ago' },
  { id: '4', title: 'Shipment Delay', country: 'Germany', product: 'Machinery', severity: 'medium', confidence: 76, timeDetected: '8 hours ago' },
  { id: '5', title: 'Currency Volatility', country: 'Turkey', product: 'Chemicals', severity: 'low', confidence: 62, timeDetected: '12 hours ago' },
];

const DETAIL_MAP: Record<string, Partial<SelectedAlert>> = {
  '1': { event: { summary: 'Vietnam has announced a sweeping tariff escalation on electronics components exported to the US and EU. Several major OEMs sourcing PCBs and semiconductors from Hanoi are now exposed to an additional 18–22% duty. This is effective immediately and applies retroactively to shipments in transit.' }, impact: { affectedOrders: 34, exposureAmount: 427000, estimatedAdditionalCost: 88000, riskScore: 94 }, recommendedAction: { alternativeSupplier: 'Thailand', expectedSavings: 62000, leadTime: '21 days' }, complianceStatus: 'pass', agentWorkflow: { monitor: true, impact: true, alternatives: true, compliance: true, validation: true } },
  '2': { event: { summary: 'Singapore\'s Port of Tanjong Pagar is experiencing critical congestion due to a labour dispute. Container dwell times have tripled and vessel turnaround is delayed by 6–9 days. Textile shipments are among the most affected due to vessel prioritisation for tech cargo.' }, impact: { affectedOrders: 19, exposureAmount: 214000, estimatedAdditionalCost: 42000, riskScore: 78 }, recommendedAction: { alternativeSupplier: 'Port Klang (Malaysia)', expectedSavings: 28000, leadTime: '14 days' }, complianceStatus: 'pass', agentWorkflow: { monitor: true, impact: true, alternatives: true, compliance: true, validation: false } },
  '3': { event: { summary: 'A coordinated factory strike across three major auto parts manufacturers in Monterrey, Mexico has halted production. The strike is driven by wage disputes affecting approximately 12,000 workers. No resolution timeline is known and escalation to national unions is likely within 48 hours.' }, impact: { affectedOrders: 27, exposureAmount: 389000, estimatedAdditionalCost: 71000, riskScore: 86 }, recommendedAction: { alternativeSupplier: 'Philippines', expectedSavings: 45000, leadTime: '28 days' }, complianceStatus: 'review_required', agentWorkflow: { monitor: true, impact: true, alternatives: true, compliance: false, validation: false } },
  '4': { event: { summary: 'Deutsche Bahn logistics disruption is causing multi-week delays on machinery shipments routed through Frankfurt. A combination of infrastructure maintenance and driver shortages has reduced freight capacity by 35%. Custom clearance queues at Hamburg port are backed up 11 days.' }, impact: { affectedOrders: 15, exposureAmount: 443000, estimatedAdditionalCost: 85000, riskScore: 89 }, recommendedAction: { alternativeSupplier: 'Philippines', expectedSavings: 30000, leadTime: '14 days' }, complianceStatus: 'pass', agentWorkflow: { monitor: true, impact: true, alternatives: true, compliance: true, validation: true } },
  '5': { event: { summary: 'The Turkish lira has depreciated 14% against the USD in the past 72 hours following a surprise central bank rate decision. Chemical feedstock contracts denominated in USD are now significantly more expensive for local suppliers, and several are requesting contract renegotiation.' }, impact: { affectedOrders: 9, exposureAmount: 118000, estimatedAdditionalCost: 23000, riskScore: 52 }, recommendedAction: { alternativeSupplier: 'Poland', expectedSavings: 14000, leadTime: '21 days' }, complianceStatus: 'pass', agentWorkflow: { monitor: true, impact: true, alternatives: false, compliance: false, validation: false } },
};

function getAlertDetails(alert: Alert): SelectedAlert {
  const extra = DETAIL_MAP[alert.id] ?? {};
  return {
    ...alert,
    event: extra.event ?? { summary: `${alert.title}: Supply chain disruption detected. ${alert.product} sourcing from ${alert.country} may be affected.` },
    impact: extra.impact ?? { affectedOrders: 12, exposureAmount: 180000, estimatedAdditionalCost: 35000, riskScore: 65 },
    recommendedAction: extra.recommendedAction ?? { alternativeSupplier: 'Indonesia', expectedSavings: 25000, leadTime: '21 days' },
    complianceStatus: extra.complianceStatus ?? 'pass',
    agentWorkflow: extra.agentWorkflow ?? { monitor: true, impact: true, alternatives: false, compliance: false, validation: false },
  };
}

const SEVERITY_STEPS: Array<keyof SelectedAlert['agentWorkflow']> = ['monitor', 'impact', 'alternatives', 'compliance', 'validation'];
const STEP_LABELS = ['Monitor', 'Impact', 'Alternatives', 'Compliance', 'Validation'];

export function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSeverity, setActiveSeverity] = useState<'all' | Alert['severity']>('all');

  const filtered = useMemo(() => MOCK_ALERTS.filter((a) => {
    const matchSev = activeSeverity === 'all' || a.severity === activeSeverity;
    const q = searchTerm.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.product.toLowerCase().includes(q);
    return matchSev && matchQ;
  }), [searchTerm, activeSeverity]);

  return (
    <div className="ap-root">
      {/* ── INBOX ────────────────────────────────── */}
      <aside className="ap-inbox">
        <div className="ap-inbox-header">
          <span className="ap-inbox-title">Incidents</span>
          <span className="ap-inbox-count">{filtered.length}</span>
        </div>

        <input
          className="ap-search"
          type="text"
          placeholder="Search incidents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="ap-filters">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              className={`ap-filter-btn${activeSeverity === sev ? ' is-active' : ''}`}
              onClick={() => setActiveSeverity(sev)}
            >
              {sev === 'all' ? 'All' : sev[0].toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        <div className="ap-inbox-list">
          {filtered.length === 0 && (
            <p className="ap-no-results">No incidents match your filters</p>
          )}
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`ap-card ap-card--${alert.severity}${selectedAlert?.id === alert.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedAlert(getAlertDetails(alert))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedAlert(getAlertDetails(alert))}
            >
              <div className="ap-card-header">
                <span className={`ap-dot ap-dot--${alert.severity}`} />
                <span className="ap-card-title">{alert.title}</span>
                <span className="ap-card-flag">⚑</span>
              </div>
              <div className="ap-card-tags">
                <span className="ap-tag">{alert.country}</span>
                <span className="ap-tag">{alert.product}</span>
              </div>
              <div className="ap-card-meta">
                <span className="ap-card-confidence">{alert.confidence}% confidence</span>
                <span className="ap-card-time">{alert.timeDetected}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── INVESTIGATION PANEL ──────────────────── */}
      <main className="ap-panel">
        {selectedAlert ? (
          <div className="ap-investigation">
            {/* Header */}
            <div className="ap-inv-header">
              <div className="ap-inv-header-left">
                <span className="ap-inv-label">INCIDENT REPORT</span>
                <h1 className="ap-inv-title">{selectedAlert.title}</h1>
                <p className="ap-inv-sub">{selectedAlert.country} · {selectedAlert.product} · Detected {selectedAlert.timeDetected}</p>
              </div>
              <div className="ap-inv-header-right">
                <div className="ap-inv-confidence">
                  <span className="ap-inv-confidence-num">{selectedAlert.confidence}%</span>
                  <span className="ap-inv-confidence-label">Confidence</span>
                </div>
                <span className={`ap-severity-pill ap-severity-pill--${selectedAlert.severity}`}>
                  {selectedAlert.severity.toUpperCase()}
                </span>
              </div>
            </div>

            {/* What Happened */}
            <section className="ap-section">
              <h2 className="ap-section-title">What Happened</h2>
              <div className="ap-prose-card">
                <p className="ap-prose">{selectedAlert.event.summary}</p>
                <div className="ap-context-row">
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Affected Region</span>
                    <span className="ap-context-value">{selectedAlert.country}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Product Category</span>
                    <span className="ap-context-value">{selectedAlert.product}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Detection Method</span>
                    <span className="ap-context-value">AI Trade Monitor</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Business Impact */}
            <section className="ap-section">
              <h2 className="ap-section-title">Business Impact</h2>
              <div className="ap-prose-card">
                <p className="ap-prose">
                  This disruption puts{' '}
                  <strong className="ap-strong">{selectedAlert.impact.affectedOrders} active orders</strong>{' '}
                  at risk, representing{' '}
                  <strong className="ap-strong">${(selectedAlert.impact.exposureAmount / 1000).toFixed(0)}K in total exposure</strong>.{' '}
                  If unmitigated, costs could increase by{' '}
                  <strong className="ap-strong">${(selectedAlert.impact.estimatedAdditionalCost / 1000).toFixed(0)}K</strong>.
                </p>
                <div className="ap-risk-row">
                  <span className="ap-risk-label">Risk Assessment</span>
                  <div className="ap-risk-track">
                    <div
                      className="ap-risk-fill"
                      style={{ width: `${selectedAlert.impact.riskScore}%` }}
                      data-level={selectedAlert.impact.riskScore >= 75 ? 'high' : selectedAlert.impact.riskScore >= 50 ? 'med' : 'low'}
                    />
                  </div>
                  <span className="ap-risk-num">{selectedAlert.impact.riskScore}/100</span>
                </div>
              </div>
            </section>

            {/* Recommended Action */}
            <section className="ap-section">
              <h2 className="ap-section-title">Recommended Action</h2>
              <div className="ap-action-card">
                <div className="ap-action-top">
                  <span className="ap-action-label">SWITCH TO</span>
                  <span className="ap-action-supplier">{selectedAlert.recommendedAction.alternativeSupplier}</span>
                </div>
                <div className="ap-benefits">
                  <div className="ap-benefit">
                    <span className="ap-benefit-label">Expected Savings</span>
                    <span className="ap-benefit-value ap-benefit-value--green">${(selectedAlert.recommendedAction.expectedSavings / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="ap-benefit">
                    <span className="ap-benefit-label">Lead Time</span>
                    <span className="ap-benefit-value">{selectedAlert.recommendedAction.leadTime}</span>
                  </div>
                  <div className="ap-benefit">
                    <span className="ap-benefit-label">Compliance</span>
                    <span className={`ap-benefit-value ap-benefit-value--${selectedAlert.complianceStatus === 'pass' ? 'green' : 'amber'}`}>
                      {selectedAlert.complianceStatus === 'pass' ? 'Approved' : 'Review Required'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Analysis Process */}
            <section className="ap-section">
              <h2 className="ap-section-title">Analysis Process</h2>
              <div className="ap-steps">
                {SEVERITY_STEPS.map((key, i) => (
                  <div key={key} className={`ap-step${selectedAlert.agentWorkflow[key] ? ' ap-step--done' : ''}`}>
                    <div className="ap-step-node" />
                    <span className="ap-step-name">{STEP_LABELS[i]}</span>
                    <span className="ap-step-state">{selectedAlert.agentWorkflow[key] ? 'Done' : 'Pending'}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="ap-empty">
            <div className="ap-empty-icon">◫</div>
            <p className="ap-empty-title">Select an incident</p>
            <p className="ap-empty-sub">Choose an alert from the left panel to open the investigation view</p>
          </div>
        )}
      </main>
    </div>
  );
}
