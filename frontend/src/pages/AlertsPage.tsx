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
      {/* Left Sidebar - Alert Inbox */}
      <div className="alerts-sidebar">
        <div className="sidebar-header">
          <h2>Trade Alerts</h2>
          <span className="alert-count">{filteredAlerts.length}</span>
        </div>

        <input
          type="text"
          className="search-input"
          placeholder="Search country, product, or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filter-buttons">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <button
              key={severity}
              className={`filter-btn ${severity} ${selectedSeverity === severity ? 'active' : ''}`}
              onClick={() => setSelectedSeverity(severity)}
            >
              {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>

        <div className="alerts-list">
          {filteredAlerts.length === 0 ? (
            <div className="empty-state">No alerts match your filters</div>
          ) : (
            filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                className={`alert-item ${alert.severity} ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => handleSelectAlert(alert)}
              >
                <div className="alert-indicator" />
                <div className="alert-content">
                  <h4 className="alert-title">{alert.title}</h4>
                  <div className="alert-tags">
                    <span className="tag location">{alert.country}</span>
                    <span className="tag product">{alert.product}</span>
                    <span className="tag confidence">{alert.confidence}%</span>
                  </div>
                  <div className="alert-time">{alert.timeDetected}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Investigation Workspace */}
      <div className="investigation-panel">
        {selectedAlert ? (
          <div className="case-file">
            {/* Header */}
            <div className="case-header">
              <div className="header-meta">
                <div className="severity-indicator" data-severity={selectedAlert.severity} />
                <div className="header-text">
                  <span className="breadcrumb">Trade Alert</span>
                  <h1 className="case-title">{selectedAlert.title}</h1>
                </div>
              </div>
              <div className="header-stats">
                <div className="stat">
                  <span className="stat-label">Confidence</span>
                  <span className="stat-value">{selectedAlert.confidence}%</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Detected</span>
                  <span className="stat-value">{selectedAlert.timeDetected}</span>
                </div>
              </div>
            </div>

            {/* Hero Section - Recommended Action */}
            <div className="hero-decision">
              <div className="hero-label">RECOMMENDED ACTION</div>
              <div className="hero-card">
                <div className="hero-grid">
                  <div className="hero-item">
                    <span className="hero-label-small">Switch To</span>
                    <div className="hero-value gold">{selectedAlert.recommendedAction.alternativeSupplier}</div>
                  </div>
                  <div className="hero-item">
                    <span className="hero-label-small">Expected Savings</span>
                    <div className="hero-value emerald">${(selectedAlert.recommendedAction.expectedSavings / 1000).toFixed(0)}K</div>
                  </div>
                  <div className="hero-item">
                    <span className="hero-label-small">Lead Time</span>
                    <div className="hero-value">{selectedAlert.recommendedAction.leadTime}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Section - What Happened */}
            <section className="context-section">
              <h3 className="section-header">What Happened</h3>
              <div className="context-box">
                <p className="context-text">{selectedAlert.event.summary}</p>
                <div className="context-meta">
                  <div className="meta-item">
                    <span className="meta-label">Location</span>
                    <span className="meta-value">{selectedAlert.country}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Product Category</span>
                    <span className="meta-value">{selectedAlert.product}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Impact Section - What's At Risk */}
            <section className="impact-section">
              <h3 className="section-header">What's At Risk</h3>
              <div className="impact-grid">
                <div className="impact-item">
                  <span className="impact-number">{selectedAlert.impact.affectedOrders}</span>
                  <span className="impact-label">Affected Orders</span>
                </div>
                <div className="impact-item">
                  <span className="impact-number">${(selectedAlert.impact.exposureAmount / 1000).toFixed(0)}K</span>
                  <span className="impact-label">Total Exposure</span>
                </div>
                <div className="impact-item">
                  <span className="impact-number">${(selectedAlert.impact.estimatedAdditionalCost / 1000).toFixed(0)}K</span>
                  <span className="impact-label">Estimated Cost</span>
                </div>
                <div className="impact-item">
                  <span className="impact-number">{selectedAlert.impact.riskScore}</span>
                  <span className="impact-label">Risk Score</span>
                </div>
              </div>
            </section>

            {/* Investigation Timeline - Agent Workflow */}
            <section className="timeline-section">
              <h3 className="section-header">Investigation Timeline</h3>
              <div className="timeline">
                {[
                  { key: 'monitor', label: 'Monitoring', icon: '◉' },
                  { key: 'impact', label: 'Impact Analysis', icon: '◉' },
                  { key: 'alternatives', label: 'Finding Alternatives', icon: '◉' },
                  { key: 'compliance', label: 'Compliance Check', icon: '◉' },
                  { key: 'validation', label: 'Validation', icon: '◉' },
                ].map((step, idx) => {
                  const isComplete = selectedAlert.agentWorkflow[step.key as keyof typeof selectedAlert.agentWorkflow];
                  return (
                    <div key={step.key} className="timeline-item">
                      <div className={`timeline-dot ${isComplete ? 'complete' : 'pending'}`}>{step.icon}</div>
                      <div className="timeline-text">
                        <div className="timeline-label">{step.label}</div>
                        <div className={`timeline-status ${isComplete ? 'done' : 'waiting'}`}>
                          {isComplete ? 'Complete' : 'In Progress'}
                        </div>
                      </div>
                      {idx < 4 && <div className="timeline-connector" />}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Compliance Section */}
            <section className="compliance-section">
              <h3 className="section-header">Regulatory Status</h3>
              <div className={`compliance-badge ${selectedAlert.complianceStatus}`}>
                {selectedAlert.complianceStatus === 'pass' ? (
                  <>
                    <span className="badge-icon">✓</span>
                    <span className="badge-text">Compliant</span>
                  </>
                ) : (
                  <>
                    <span className="badge-icon">⚠</span>
                    <span className="badge-text">Review Required</span>
                  </>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="empty-workspace">
            <div className="empty-icon">→</div>
            <p className="empty-title">No Alert Selected</p>
            <p className="empty-message">Select an alert from the left to begin investigation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
