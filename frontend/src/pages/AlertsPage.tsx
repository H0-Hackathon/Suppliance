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

  const handleSelectAlert = (alert: Alert) => {
    const details = getAlertDetails(alert.id);
    if (details) {
      setSelectedAlert(details);
    }
  };

  return (
    <div className="alerts-container">
      {/* Left Sidebar - Alert Inbox */}
      <aside className="alerts-sidebar">
        <div className="sidebar-header">
          <div className="header-content">
            <h2>Incidents</h2>
            <p className="header-subtitle">Active trade disruptions</p>
          </div>
          <span className="alert-count">{filteredAlerts.length}</span>
        </div>

        <input
          type="text"
          className="search-input"
          placeholder="Search incidents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filter-buttons">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <button
              key={severity}
              className={`filter-btn ${selectedSeverity === severity ? 'active' : ''}`}
              onClick={() => setSelectedSeverity(severity)}
            >
              {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>

        <div className="alerts-list">
          {filteredAlerts.length === 0 ? (
            <div className="empty-state">No incidents matching filters</div>
          ) : (
            filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                className={`alert-item ${alert.severity} ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => handleSelectAlert(alert)}
              >
                <div className="alert-card-header">
                  <div className="severity-dot" data-severity={alert.severity} title={alert.severity} />
                  <div className="alert-title-block">
                    <h4 className="alert-title">{alert.title}</h4>
                    <div className="alert-meta-top">
                      <span className="location-tag">{alert.country}</span>
                      <span className="product-tag">{alert.product}</span>
                    </div>
                  </div>
                  <div className="alert-flag">🚩</div>
                </div>
                <div className="alert-card-footer">
                  <span className="confidence-badge">{alert.confidence}% confident</span>
                  <span className="time-badge">{alert.timeDetected}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right Panel - Investigation Workspace */}
      <main className="investigation-panel">
        {selectedAlert ? (
          <div className="case-file">
            {/* Header - Case Context */}
            <div className="case-header">
              <div>
                <div className="case-breadcrumb">INCIDENT ANALYSIS</div>
                <h1 className="case-title">{selectedAlert.title}</h1>
                <p className="case-subtitle">
                  {selectedAlert.country} • {selectedAlert.product} • Detected {selectedAlert.timeDetected}
                </p>
              </div>
              <div className="case-meta">
                <div className="meta-stat">
                  <span className="meta-stat-label">Confidence</span>
                  <span className="meta-stat-value">{selectedAlert.confidence}%</span>
                </div>
                <div className={`severity-badge severity-${selectedAlert.severity}`}>
                  {selectedAlert.severity.toUpperCase()}
                </div>
              </div>
            </div>

            {/* What Happened - Narrative Context */}
            <section className="narrative-section">
              <h2 className="narrative-title">What Happened</h2>
              <div className="narrative-content">
                <p className="narrative-text">{selectedAlert.event.summary}</p>
                <div className="narrative-context">
                  <div className="context-item">
                    <span className="context-label">Affected Region</span>
                    <span className="context-value">{selectedAlert.country}</span>
                  </div>
                  <div className="context-item">
                    <span className="context-label">Product Category</span>
                    <span className="context-value">{selectedAlert.product}</span>
                  </div>
                  <div className="context-item">
                    <span className="context-label">Detection Method</span>
                    <span className="context-value">AI Trade Monitor</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Impact Narrative - Business Risk */}
            <section className="impact-narrative">
              <h2 className="narrative-title">Business Impact</h2>
              <div className="impact-story">
                <p className="impact-text">
                  This disruption puts <strong>{selectedAlert.impact.affectedOrders} active orders</strong> at risk, 
                  representing <strong>${(selectedAlert.impact.exposureAmount / 1000).toFixed(0)}K in total exposure</strong>. 
                  If unmitigated, your costs could increase by <strong>${(selectedAlert.impact.estimatedAdditionalCost / 1000).toFixed(0)}K</strong>.
                </p>
                <div className="risk-meter">
                  <div className="risk-label">Risk Assessment</div>
                  <div className="risk-bar">
                    <div 
                      className="risk-fill"
                      style={{ width: `${selectedAlert.impact.riskScore}%` }}
                      data-risk={selectedAlert.impact.riskScore > 75 ? 'high' : selectedAlert.impact.riskScore > 50 ? 'medium' : 'low'}
                    />
                  </div>
                  <div className="risk-value">{selectedAlert.impact.riskScore}/100</div>
                </div>
              </div>
            </section>

            {/* Recommended Action - Decision Point */}
            <section className="action-section">
              <h2 className="narrative-title">Recommended Action</h2>
              <div className="action-card">
                <div className="action-decision">
                  <div className="action-label">SWITCH TO</div>
                  <div className="action-supplier">{selectedAlert.recommendedAction.alternativeSupplier}</div>
                </div>
                <div className="action-benefits">
                  <div className="benefit">
                    <span className="benefit-icon">💰</span>
                    <div className="benefit-content">
                      <span className="benefit-label">Expected Savings</span>
                      <span className="benefit-value">${(selectedAlert.recommendedAction.expectedSavings / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                  <div className="benefit">
                    <span className="benefit-icon">📦</span>
                    <div className="benefit-content">
                      <span className="benefit-label">Lead Time</span>
                      <span className="benefit-value">{selectedAlert.recommendedAction.leadTime}</span>
                    </div>
                  </div>
                  <div className="benefit">
                    <span className="benefit-icon">✓</span>
                    <div className="benefit-content">
                      <span className="benefit-label">Compliance Status</span>
                      <span className={`benefit-value status-${selectedAlert.complianceStatus}`}>
                        {selectedAlert.complianceStatus === 'pass' ? 'Approved' : 'Review Required'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Agent Reasoning - Process Transparency */}
            <section className="reasoning-section">
              <h2 className="narrative-title">Analysis Process</h2>
              <div className="reasoning-timeline">
                {[
                  { key: 'monitor', label: 'Monitor', icon: '👁' },
                  { key: 'impact', label: 'Impact', icon: '📊' },
                  { key: 'alternatives', label: 'Alternatives', icon: '🔍' },
                  { key: 'compliance', label: 'Compliance', icon: '✓' },
                  { key: 'validation', label: 'Validation', icon: '✅' },
                ].map((step, idx) => {
                  const isComplete = selectedAlert.agentWorkflow[step.key as keyof typeof selectedAlert.agentWorkflow];
                  return (
                    <div key={step.key} className={`reasoning-step ${isComplete ? 'complete' : 'pending'}`}>
                      <div className="step-circle">{step.icon}</div>
                      <div className="step-info">
                        <div className="step-name">{step.label}</div>
                        <div className="step-state">{isComplete ? '✓ Done' : '○ Pending'}</div>
                      </div>
                      {idx < 4 && <div className="step-line" />}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="empty-workspace">
            <div className="empty-icon">📋</div>
            <p className="empty-title">Select an Incident</p>
            <p className="empty-message">Choose an alert from the left to review details and investigation findings</p>
          </div>
        )}
      </main>
    </div>
  );
};
