import React from 'react';
import { RefreshCw } from 'lucide-react';
import { AlertCard, AlertSeverity, AlertType } from '../components/AlertCard';
import { TradeGlobe, DisruptionPoint } from '../components/TradeGlobe';
import api from '../services/api';

/**
 * AlertsDashboard — Main CoastGuard dashboard page.
 *
 * Wired to the real backend:
 *   - GET  /api/v2/alerts?customer_id=1       initial alert feed
 *   - POST /api/v2/monitor/run                "Run Monitor" button
 *   - PUT  /api/v2/alerts/{id}/dismiss|resolve  alert actions
 *   - GET  /api/v2/disruptions?customer_id=1  globe markers
 *
 * There's no auth/customer-switcher yet, so CUSTOMER_ID is hardcoded to the
 * single seeded demo customer (backend/scripts/seed_data.py creates id=1).
 */

const CUSTOMER_ID = 1;

// Default HS code / supplier country used when the "Run Monitor" button is
// clicked. Matches the seeded demo product (Cotton T-Shirts from Vietnam).
const DEMO_HS_CODE = '6109.10';
const DEMO_SUPPLIER_COUNTRY = 'VN';

interface ApiAlert {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

type FilterSeverity = 'all' | AlertSeverity;

const FILTER_OPTIONS: FilterSeverity[] = ['all', 'critical', 'high', 'medium', 'low'];

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [filter, setFilter] = React.useState<FilterSeverity>('all');
  const [isRunning, setIsRunning] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  async function fetchAlerts() {
    const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: CUSTOMER_ID } });
    setAlerts(res.data);
  }

  async function fetchDisruptions() {
    const res = await api.get<DisruptionPoint[]>('/v2/disruptions', { params: { customer_id: CUSTOMER_ID } });
    setDisruptions(res.data);
  }

  React.useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchAlerts(), fetchDisruptions()]);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Dismissed/resolved alerts stay in the DB but drop off the active feed.
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const filtered = filter === 'all'
    ? activeAlerts
    : activeAlerts.filter((a) => a.severity === filter);

  async function handleDismiss(id: number) {
    await api.put(`/v2/alerts/${id}/dismiss`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'dismissed' } : a)));
  }

  async function handleResolve(id: number) {
    await api.put(`/v2/alerts/${id}/resolve`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a)));
  }

  async function handleRunMonitor() {
    setIsRunning(true);
    try {
      await api.post('/v2/monitor/run', {
        customer_id: CUSTOMER_ID,
        hs_code: DEMO_HS_CODE,
        supplier_country: DEMO_SUPPLIER_COUNTRY,
      });
      await Promise.all([fetchAlerts(), fetchDisruptions()]);
    } catch (err) {
      console.error('Run Monitor failed', err);
    } finally {
      setIsRunning(false);
    }
  }

  const stats = {
    active: activeAlerts.length,
    critical: activeAlerts.filter((a) => a.severity === 'critical').length,
    high: activeAlerts.filter((a) => a.severity === 'high').length,
  };

  return (
    <main className="page-with-sidebar">
      {/* Page heading */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--primary)',
              fontFamily: 'Inter, sans-serif',
              marginBottom: 4,
            }}
          >
            Supply Chain Alerts
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            business_id = {CUSTOMER_ID}
          </p>
        </div>

        <button
          className="btn-accent"
          onClick={handleRunMonitor}
          disabled={isRunning}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }} />
          {isRunning ? 'Scanning...' : 'Run Monitor'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Active Alerts</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High Priority</div>
          <div className="stat-value" style={{ color: '#F97316' }}>{stats.high}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monitored Suppliers</div>
          <div className="stat-value">2</div>
        </div>
      </div>

      {/* Two-column layout: alerts + map */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>

        {/* Left: Alert list */}
        <div>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: filter === f ? 'var(--primary)' : 'var(--card)',
                  color: filter === f ? 'white' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Alert cards */}
          {isLoading ? (
            <div className="empty-state">
              <h3>Loading...</h3>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No alerts</h3>
              <p>Your supply chain looks healthy. Click "Run Monitor" to scan for new risks.</p>
            </div>
          ) : (
            filtered.map((alert) => (
              <AlertCard
                key={alert.id}
                id={alert.id}
                alert_type={alert.alert_type}
                severity={alert.severity}
                summary={alert.summary ?? 'Tariff risk detected.'}
                agent_output={alert.agent_output ?? undefined}
                created_at={alert.created_at}
                onDismiss={handleDismiss}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>

        {/* Right: Globe + mini stats */}
        <div>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--primary)',
              marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Supplier Map
          </h2>

          <div style={{ height: 320, marginBottom: 16 }}>
            <TradeGlobe disruptions={disruptions} />
          </div>

          {/* Supplier list preview */}
          <div className="card">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
              Tracked Suppliers
            </p>
            {[
              { name: 'Mekong Textiles Co', country: 'Vietnam', flag: '🇻🇳', status: 'at-risk' },
              { name: 'Dhaka Garments Ltd', country: 'Bangladesh', flag: '🇧🇩', status: 'ok' },
            ].map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 18 }}>{s.flag}</span>
                <div>
                  <p style={{ fontWeight: 600 }}>{s.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.country}</p>
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    fontWeight: 700,
                    color: s.status === 'at-risk' ? '#EF4444' : '#10B981',
                  }}
                >
                  {s.status === 'at-risk' ? '⚠ AT RISK' : '✓ OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
