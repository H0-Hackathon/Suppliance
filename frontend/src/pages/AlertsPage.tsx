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
  event: {
    summary: string;
    confidence: number;
  };
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

// Mock alert data
const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    title: 'Vietnam Tariff Escalation',
    country: 'Vietnam',
    product: 'Electronics',
    severity: 'critical',
    confidence: 98,
    timeDetected: '2 hours ago',
  },
  {
    id: '2',
    title: 'Port Congestion Alert',
    country: 'Singapore',
    product: 'Textiles',
    severity: 'high',
    confidence: 85,
    timeDetected: '4 hours ago',
  },
  {
    id: '3',
    title: 'Factory Strike Notice',
    country: 'Mexico',
    product: 'Auto Parts',
    severity: 'high',
    confidence: 92,
    timeDetected: '6 hours ago',
  },
  {
    id: '4',
    title: 'Shipment Delay',
    country: 'Germany',
    product: 'Machinery',
    severity: 'medium',
    confidence: 76,
    timeDetected: '8 hours ago',
  },
  {
    id: '5',
    title: 'Currency Volatility',
    country: 'Turkey',
    product: 'Chemicals',
    severity: 'low',
    confidence: 62,
    timeDetected: '12 hours ago',
  },
];

// Mock selected alert details
const getAlertDetails = (id: string): SelectedAlert | null => {
  const baseAlert = MOCK_ALERTS.find((a) => a.id === id);
  if (!baseAlert) return null;

  return {
    ...baseAlert,
    event: {
      summary: `${baseAlert.title}: Supply chain disruption detected. ${baseAlert.product} sourcing from ${baseAlert.country} may be affected by tariff changes.`,
      confidence: baseAlert.confidence,
    },
    impact: {
      affectedOrders: Math.floor(Math.random() * 50) + 10,
      exposureAmount: Math.floor(Math.random() * 500000) + 100000,
      estimatedAdditionalCost: Math.floor(Math.random() * 100000) + 20000,
      riskScore: Math.floor(Math.random() * 40) + 60,
    },
    recommendedAction: {
      alternativeSupplier: ['Thailand', 'Indonesia', 'Philippines', 'India'][Math.floor(Math.random() * 4)],
      expectedSavings: Math.floor(Math.random() * 80000) + 10000,
      leadTime: ['14 days', '21 days', '28 days'][Math.floor(Math.random() * 3)],
    },
    complianceStatus: Math.random() > 0.3 ? 'pass' : 'review_required',
    agentWorkflow: {
      monitor: true,
      impact: true,
      alternatives: Math.random() > 0.2,
      compliance: Math.random() > 0.3,
      validation: Math.random() > 0.5,
    },
  };
};

export const AlertsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null);

  // Filter alerts based on search and severity
  const filteredAlerts = useMemo(() => {
    return MOCK_ALERTS.filter((alert) => {
      const matchesSearch =
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.product.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;

      return matchesSearch && matchesSeverity;
    });
  }, [searchTerm, selectedSeverity]);

  // Load selected alert details
  const handleSelectAlert = (alert: Alert) => {
    const details = getAlertDetails(alert.id);
    if (details) {
      setSelectedAlert(details);
    }
  };

  return (
    <div className="alerts-page">
      {/* Left Sidebar - Alert List */}
      <div className="alerts-sidebar">
        <div className="alerts-header">
          <h2>Trade Alerts</h2>
          <div className="alert-count">{filteredAlerts.length}</div>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          className="search-bar"
          placeholder="Search alerts by country, product, or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Severity Filters */}
        <div className="severity-filters">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <button
              key={severity}
              className={`filter-btn ${severity} ${selectedSeverity === severity ? 'active' : ''}`}
              onClick={() => setSelectedSeverity(severity)}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>

        {/* Alert Cards List */}
        <div className="alert-cards">
          {filteredAlerts.length === 0 ? (
            <div className="no-alerts">No alerts match your filters.</div>
          ) : (
            filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                className={`alert-card ${alert.severity} ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => handleSelectAlert(alert)}
              >
                <div className="alert-top">
                  <h3>{alert.title}</h3>
                  <div className={`severity-badge ${alert.severity}`}>{alert.severity}</div>
                </div>
                <div className="alert-meta">
                  <span className="meta-item">{alert.country}</span>
                  <span className="meta-item">{alert.product}</span>
                </div>
                <div className="alert-bottom">
                  <span className="confidence">Conf: {alert.confidence}%</span>
                  <span className="time">{alert.timeDetected}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Alert Investigation */}
      <div className="alerts-investigation">
        {selectedAlert ? (
          <div className="investigation-content">
            <div className="investigation-header">
              <h1>{selectedAlert.title}</h1>
              <div className={`severity-large ${selectedAlert.severity}`}>{selectedAlert.severity.toUpperCase()}</div>
            </div>

            {/* Section 1: Event */}
            <section className="investigation-section">
              <h3 className="section-title">Event</h3>
              <div className="section-content">
                <p className="event-summary">{selectedAlert.event.summary}</p>
                <div className="meta-grid">
                  <div className="meta-row">
                    <span className="label">Country</span>
                    <span className="value">{selectedAlert.country}</span>
                  </div>
                  <div className="meta-row">
                    <span className="label">Product</span>
                    <span className="value">{selectedAlert.product}</span>
                  </div>
                  <div className="meta-row">
                    <span className="label">Confidence</span>
                    <span className="value confidence-value">{selectedAlert.confidence}%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Impact */}
            <section className="investigation-section">
              <h3 className="section-title">Impact</h3>
              <div className="impact-grid">
                <div className="impact-card">
                  <span className="impact-label">Affected Orders</span>
                  <span className="impact-value">{selectedAlert.impact.affectedOrders}</span>
                </div>
                <div className="impact-card">
                  <span className="impact-label">Exposure Amount</span>
                  <span className="impact-value">${(selectedAlert.impact.exposureAmount / 1000).toFixed(0)}K</span>
                </div>
                <div className="impact-card">
                  <span className="impact-label">Est. Additional Cost</span>
                  <span className="impact-value">${(selectedAlert.impact.estimatedAdditionalCost / 1000).toFixed(0)}K</span>
                </div>
                <div className="impact-card">
                  <span className="impact-label">Risk Score</span>
                  <span className="impact-value">{selectedAlert.impact.riskScore}/100</span>
                </div>
              </div>
            </section>

            {/* Section 3: Recommended Action */}
            <section className="investigation-section">
              <h3 className="section-title">Recommended Action</h3>
              <div className="recommendation">
                <div className="rec-row">
                  <span className="rec-label">Alternative Supplier</span>
                  <span className="rec-value gold">{selectedAlert.recommendedAction.alternativeSupplier}</span>
                </div>
                <div className="rec-row">
                  <span className="rec-label">Expected Savings</span>
                  <span className="rec-value emerald">${(selectedAlert.recommendedAction.expectedSavings / 1000).toFixed(0)}K</span>
                </div>
                <div className="rec-row">
                  <span className="rec-label">Lead Time</span>
                  <span className="rec-value">{selectedAlert.recommendedAction.leadTime}</span>
                </div>
              </div>
            </section>

            {/* Section 4: Compliance Status */}
            <section className="investigation-section">
              <h3 className="section-title">Compliance Status</h3>
              <div className={`compliance-badge ${selectedAlert.complianceStatus}`}>
                {selectedAlert.complianceStatus === 'pass' ? '✓ Pass' : '⚠ Review Required'}
              </div>
            </section>

            {/* Section 5: Agent Workflow */}
            <section className="investigation-section">
              <h3 className="section-title">Agent Workflow</h3>
              <div className="workflow">
                {[
                  { key: 'monitor', label: 'Monitor' },
                  { key: 'impact', label: 'Impact' },
                  { key: 'alternatives', label: 'Alternatives' },
                  { key: 'compliance', label: 'Compliance' },
                  { key: 'validation', label: 'Validation' },
                ].map((step, idx) => (
                  <div key={step.key} className="workflow-step">
                    <div className={`workflow-circle ${selectedAlert.agentWorkflow[step.key as keyof typeof selectedAlert.agentWorkflow] ? 'complete' : 'pending'}`}>
                      {selectedAlert.agentWorkflow[step.key as keyof typeof selectedAlert.agentWorkflow] ? '✓' : '○'}
                    </div>
                    <span className="step-label">{step.label}</span>
                    {idx < 4 && <div className="workflow-connector" />}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="no-selection">
            <p>Select an alert to view details and investigation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
