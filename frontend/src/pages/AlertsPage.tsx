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
      estimatedAdditionalCost: Math.floor(Math.random() * 150000) + 30000,
      riskScore: Math.floor(Math.random() * 40) + 50,
    },
    recommendedAction: {
      alternativeSupplier: ['Thailand', 'Philippines', 'Indonesia', 'Vietnam'][Math.floor(Math.random() * 4)],
      expectedSavings: Math.floor(Math.random() * 100000) + 20000,
      leadTime: ['14 days', '21 days', '28 days', '10 days'][Math.floor(Math.random() * 4)],
    },
    complianceStatus: Math.random() > 0.3 ? 'pass' : 'review_required',
    agentWorkflow: {
      monitor: true,
      impact: true,
      alternatives: true,
      compliance: true,
      validation: Math.random() > 0.5,
    },
  };
};

export function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const filteredAlerts = useMemo(() => {
    return MOCK_ALERTS.filter((alert) => {
      const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;
      const matchesSearch = searchTerm === '' || 
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.product.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [searchTerm, selectedSeverity]);

  const handleSelectAlert = (alert: Alert) => {
    const details = getAlertDetails(alert.id);
    if (details) {
      setSelectedAlert(details);
    }
  };

  return (
    <div className="alerts-page">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-title">Incidents</div>
          <div className="alert-count">{filteredAlerts.length}</div>
        </div>

        <input
          type="text"
          placeholder="Search incidents..."
          className="search-box"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filters">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              className={`filter-btn ${selectedSeverity === sev ? 'active' : ''}`}
              onClick={() => setSelectedSeverity(sev)}
            >
              {sev === 'all' ? 'All' : sev[0].toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        <div className="alerts-inbox">
          {filteredAlerts.length === 0 ? (
            <div className="no-alerts">No incidents</div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-card ${alert.severity} ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => handleSelectAlert(alert)}
              >
                <div className="alert-row-1">
                  <div className="severity-indicator" />
                  <div className="alert-content">
                    <div className="alert-name">{alert.title}</div>
                  </div>
                  <div className="flag">🚩</div>
                </div>
                <div className="alert-row-2">
                  <span className="badge country">{alert.country}</span>
                  <span className="badge product">{alert.product}</span>
                </div>
                <div className="alert-row-3">
                  <span className="meta-item">{alert.confidence}% confident</span>
                  <span className="meta-item">{alert.timeDetected}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="main-content">
        {selectedAlert ? (
          <div className="investigation">
            <div className="inv-header">
              <div className="inv-breadcrumb">INCIDENT</div>
              <h1 className="inv-title">{selectedAlert.title}</h1>
              <p className="inv-subtitle">{selectedAlert.country} • {selectedAlert.product}</p>
            </div>

            <section className="inv-section">
              <h2 className="section-title">What Happened</h2>
              <p className="narrative">{selectedAlert.event.summary}</p>
              <div className="context-grid">
                <div className="context-cell">
                  <div className="context-label">Region</div>
                  <div className="context-value">{selectedAlert.country}</div>
                </div>
                <div className="context-cell">
                  <div className="context-label">Product</div>
                  <div className="context-value">{selectedAlert.product}</div>
                </div>
                <div className="context-cell">
                  <div className="context-label">Confidence</div>
                  <div className="context-value">{selectedAlert.event.confidence}%</div>
                </div>
              </div>
            </section>

            <section className="inv-section">
              <h2 className="section-title">Business Impact</h2>
              <p className="narrative">
                This disruption puts <strong>{selectedAlert.impact.affectedOrders} active orders</strong> at risk, 
                representing <strong>${(selectedAlert.impact.exposureAmount / 1000).toFixed(0)}K in total exposure</strong>. 
                If unmitigated, costs could increase by <strong>${(selectedAlert.impact.estimatedAdditionalCost / 1000).toFixed(0)}K</strong>.
              </p>
              <div className="risk-display">
                <div className="risk-label">Risk Score</div>
                <div className="risk-bar-container">
                  <div 
                    className="risk-bar" 
                    style={{ width: `${selectedAlert.impact.riskScore}%` }}
                  />
                </div>
                <div className="risk-value">{selectedAlert.impact.riskScore}/100</div>
              </div>
            </section>

            <section className="inv-section">
              <h2 className="section-title">Recommended Action</h2>
              <div className="action-box">
                <div className="action-label">SWITCH TO</div>
                <div className="supplier-name">{selectedAlert.recommendedAction.alternativeSupplier}</div>
                <div className="benefits">
                  <div className="benefit">
                    <span className="benefit-icon">💰</span>
                    <div>
                      <div className="benefit-label">Expected Savings</div>
                      <div className="benefit-value">${(selectedAlert.recommendedAction.expectedSavings / 1000).toFixed(0)}K</div>
                    </div>
                  </div>
                  <div className="benefit">
                    <span className="benefit-icon">📦</span>
                    <div>
                      <div className="benefit-label">Lead Time</div>
                      <div className="benefit-value">{selectedAlert.recommendedAction.leadTime}</div>
                    </div>
                  </div>
                  <div className="benefit">
                    <span className="benefit-icon">✓</span>
                    <div>
                      <div className="benefit-label">Compliance</div>
                      <div className={`benefit-value ${selectedAlert.complianceStatus}`}>
                        {selectedAlert.complianceStatus === 'pass' ? 'Approved' : 'Review'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="inv-section">
              <h2 className="section-title">Analysis Process</h2>
              <div className="process-timeline">
                {[
                  { label: 'Monitor', icon: '👁' },
                  { label: 'Impact', icon: '📊' },
                  { label: 'Alternatives', icon: '🔍' },
                  { label: 'Compliance', icon: '✓' },
                  { label: 'Validation', icon: '✅' },
                ].map((step, idx) => {
                  const isComplete = selectedAlert.agentWorkflow[
                    ['monitor', 'impact', 'alternatives', 'compliance', 'validation'][idx] as keyof typeof selectedAlert.agentWorkflow
                  ];
                  return (
                    <div key={idx} className={`process-step ${isComplete ? 'done' : 'pending'}`}>
                      <div className="step-icon">{step.icon}</div>
                      <div className="step-name">{step.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>Select an incident to begin investigation</p>
          </div>
        )}
      </main>
    </div>
  );
}
