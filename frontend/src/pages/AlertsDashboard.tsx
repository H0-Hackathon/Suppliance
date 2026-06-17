import React from 'react';
import { RefreshCw } from 'lucide-react';
import { AlertCard, AlertSeverity, AlertType } from '../components/AlertCard';

/**
 * AlertsDashboard — Main CoastGuard dashboard page.
 *
 * Phase 1: Displays hardcoded mock alerts with empty-state fallback.
 *          No API calls yet (backend models added in Phase 2).
 *
 * Phase 2: Replace MOCK_ALERTS with real API calls to
 *          GET /api/v2/alerts?customer_id=1
 */

<<<<<<< Updated upstream
// ── Hardcoded mock alerts for Phase 1 demo ──────────────────
const MOCK_ALERTS = [
  {
    id: 1,
    alert_type: 'tariff_change' as AlertType,
    severity: 'high' as AlertSeverity,
    summary:
      'Your pending $40,000 order from Mekong Textiles Co (Vietnam, HS 6109.10) will cost $10,000 more due to a new 25% US tariff effective July 1, 2026.',
    agent_output: JSON.stringify({
      tariff_monitor: {
        risk_detected: true,
        event: '25% tariff added on HS 6109.10 from VN',
        confidence: 0.92,
        source: 'mock_usitc',
      },
      impact_calculator: {
        extra_cost_usd: 10000,
        severity: 'high',
        affected_orders: 1,
      },
      alternatives_finder: {
        options: [
          { supplier: 'Dhaka Garments Ltd', country: 'BD', lead_time_weeks: 8 },
          { supplier: 'Mumbai Exports', country: 'IN', lead_time_weeks: 5 },
        ],
      },
      import_compliance: {
        BD: ['Certificate of Origin', 'Commercial Invoice update'],
        IN: ['BIS certification check', 'Certificate of Origin'],
      },
      adversarial: {
        verdict: 'CAUTION',
        flags: ['Bangladesh misses Aug 1 deadline by ~1 week'],
        recommendation:
          'Use Mumbai Exports (IN). Negotiate 1-week extension with buyer.',
      },
    }),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  },
  {
    id: 2,
    alert_type: 'geopolitical' as AlertType,
    severity: 'medium' as AlertSeverity,
    summary:
      'Political unrest reported in the Mekong Delta region near your supplier\'s manufacturing hub. No current shipping impact, but monitor closely.',
    agent_output: null,
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // 1d ago
  },
=======
const CUSTOMER_ID = 1;

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface ApiAlert {
  id: number;
  alert_type: string;
  severity: Severity;
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

interface ApiSupplier {
  id: number;
  name: string;
  country: string;
  product_category: string | null;
  reliability_score: number;
  is_active: boolean;
}

interface GeoCoords {
  country: string;
  code: string | null;
  latitude: number;
  longitude: number;
  location_name: string;
}

interface SupplierWithGeo extends ApiSupplier {
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  count?: number;
}

export interface MonitorTarget {
  supplier_country: string;
  country_name: string;
  hs_code: string;
  supplier_name: string | null;
  product_category: string | null;
}

interface DebugState {
  target: AgentDebugTarget;
  targetIndex: number;
  totalTargets: number;
  agentStates: Record<string, AgentState>;
  logs: string[];
}

const MAP_LAYERS = [
  { id: 'suppliers',   label: 'Suppliers',       color: '#10b981' },
  { id: 'routes',      label: 'Exposure Routes', color: '#f59e0b' },
  { id: 'risk',        label: 'Risk Zones',      color: '#dc2626' },
  { id: 'alt',         label: 'Alternatives',    color: '#14b8a6' },
>>>>>>> Stashed changes
];

type FilterSeverity = 'all' | AlertSeverity;

const FILTER_OPTIONS: FilterSeverity[] = ['all', 'critical', 'high', 'medium', 'low'];

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState(MOCK_ALERTS);
  const [filter, setFilter] = React.useState<FilterSeverity>('all');
  const [isRunning, setIsRunning] = React.useState(false);

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.severity === filter);

  function handleDismiss(id: number) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function handleResolve(id: number) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

<<<<<<< Updated upstream
=======
  async function fetchSuppliers() {
    const res = await api.get<{country: string, count: number}[]>('/v2/global-suppliers/globe-data');
    const withGeo = await Promise.all(
      res.data.map(async (s, i): Promise<SupplierWithGeo> => {
        try {
          const geo = await api.get<GeoCoords>('/v2/geo/supplier-coords', { params: { country: s.country } });
          return { 
            id: i,
            name: `${s.country} (${s.count.toLocaleString()} suppliers)`,
            country: s.country,
            product_category: 'Various',
            reliability_score: 80,
            is_active: true,
            latitude: geo.data.latitude, 
            longitude: geo.data.longitude, 
            countryCode: geo.data.code,
            count: s.count
          };
        } catch {
          return { 
            id: i, name: s.country, country: s.country, product_category: '', reliability_score: 0, is_active: true, 
            latitude: null, longitude: null, countryCode: null, count: s.count 
          };
        }
      })
    );
    setSuppliers(withGeo);
  }

  React.useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchAlerts(), fetchDisruptions(), fetchSuppliers()]);
      } catch (err) {
        // backend offline — globe falls back to its built-in demo data
        console.error('Failed to load dashboard data', err);
      }
    })();
  }, []);

  // Surface the most recent persisted agent run (TariffAlert.agent_output) so
  // real Agent 1/2 data is visible on page load without re-running. Skipped
  // while a live run is streaming (SSE updates take precedence).
  React.useEffect(() => {
    if (isRunning) return;
    for (const a of alerts) {
      if (!a.agent_output) continue;
      try {
        const parsed = JSON.parse(a.agent_output);
        if (parsed && (parsed.tariff_monitor || parsed.impact_calculator)) {
          setAgentResults(parsed);
          setAgentsUpdatedAt(a.created_at);
          setAgentSupplier(parsed.tariff_monitor?.country ?? null);
          break;
        }
      } catch {
        // non-JSON agent_output — skip
      }
    }
  }, [alerts, isRunning]);

  // ── Alert actions (backend integration) ──────────────────────────────────
  async function handleDismiss(id: number) {
    await api.put(`/v2/alerts/${id}/dismiss`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'dismissed' } : a)));
  }

  async function handleResolve(id: number) {
    await api.put(`/v2/alerts/${id}/resolve`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a)));
  }

  // ── Monitor run via SSE 5-agent pipeline (backend integration) ───────────
  // Real-time progress streams into the AgentDebugPanel as each agent emits
  // start/done/log events.
>>>>>>> Stashed changes
  async function handleRunMonitor() {
    setIsRunning(true);
    // Phase 1: simulate a 2s delay then show a new mock alert
    await new Promise((r) => setTimeout(r, 2000));
    setAlerts((prev) => [
      {
        id: Date.now(),
        alert_type: 'port_disruption' as AlertType,
        severity: 'medium' as AlertSeverity,
        summary:
          'Storm warning issued for the South China Sea shipping lanes. Your shipment from Ho Chi Minh City may experience a 3–5 day delay.',
        agent_output: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setIsRunning(false);
  }

<<<<<<< Updated upstream
  const stats = {
    active: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
  };
=======
  function toggleLayer(id: string) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const active = alerts.filter((a) => a.status === 'active');
  const critical = active.filter((a) => a.severity === 'critical').length;
  const countryCount = new Set(suppliers.map((s) => s.country)).size;

  // Real direct-cost figure from Agent 2 (ImpactCalculator); null until a run.
  const agentMonitor = agentResults.tariff_monitor;
  const agentImpact = agentResults.impact_calculator;
  const exposureValue = agentImpact?.direct_cost ?? agentImpact?.extra_cost_usd ?? null;

  // ── KPI cards derived from real monitor results (no hardcoded values) ──────
  // Cumulative direct-cost exposure across active alerts' ImpactCalculator output.
  const activeParsed = active.map((a) => {
    try { return a.agent_output ? JSON.parse(a.agent_output) : {}; } catch { return {}; }
  });
  const totalExposure = activeParsed.reduce(
    (sum, p) => sum + (p?.impact_calculator?.direct_cost ?? p?.impact_calculator?.extra_cost_usd ?? 0),
    0
  );
  const criticalEvents = active.filter((a) => a.severity === 'critical' || a.severity === 'high').length;
  const affectedCodes = new Set(disruptions.flatMap((d) => d.countries_affected ?? []));
  const highRiskSuppliers = suppliers
    .filter((s) => s.countryCode && affectedCodes.has(s.countryCode))
    .reduce((sum, s) => sum + (s.count || 0), 0);
  const totalSuppliersCount = suppliers.reduce((sum, s) => sum + (s.count || 0), 0);

  const fmtMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `$${Math.round(n)}`;

  // Each card is only shown when its underlying real data exists; otherwise it
  // is hidden (no placeholder values).
  const kpiCards = [
    {
      key: 'exposure',
      available: totalExposure > 0,
      label: 'Trade Exposure',
      value: fmtMoney(totalExposure),
      sub: `${active.length} active alert${active.length !== 1 ? 's' : ''}`,
      icon: DollarSign, color: '#dc2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.18)',
    },
    {
      key: 'highrisk',
      available: suppliers.length > 0,
      label: 'High Risk Suppliers',
      value: String(highRiskSuppliers.toLocaleString()),
      sub: `of ${totalSuppliersCount.toLocaleString()} tracked`,
      icon: Users, color: '#ea580c', bg: 'rgba(234,88,12,0.07)', border: 'rgba(234,88,12,0.18)',
    },
    {
      key: 'events',
      available: active.length > 0,
      label: 'Critical Trade Events',
      value: String(criticalEvents),
      sub: `${active.length} active alert${active.length !== 1 ? 's' : ''}`,
      icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.18)',
    },
    {
      key: 'countries',
      available: suppliers.length > 0,
      label: 'Countries Monitored',
      value: String(countryCount),
      sub: `${totalSuppliersCount.toLocaleString()} supplier${totalSuppliersCount !== 1 ? 's' : ''}`,
      icon: MapPin, color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.18)',
    },
  ].filter((c) => c.available);

  // Suppliers with resolved coordinates feed the globe (backend-driven risk).
  const tradeGlobeSuppliers: TradeGlobeSupplier[] = suppliers
    .filter((s): s is SupplierWithGeo & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({ name: s.name, country: s.country, countryCode: s.countryCode, latitude: s.latitude, longitude: s.longitude }));

  const syncTime = new Date(lastSync).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            business_id = 1 · mock mode · Phase 1
          </p>
=======
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'rgba(130,120,90,0.8)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 5px #10b981',
                display: 'inline-block',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Monitoring {totalSuppliersCount.toLocaleString()} supplier{totalSuppliersCount !== 1 ? 's' : ''} across {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
            </span>
            <span style={{ color: 'rgba(100,90,60,0.4)' }}>|</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
              Updated {syncTime}
            </span>
            {critical > 0 && (
              <>
                <span style={{ color: 'rgba(100,90,60,0.4)' }}>|</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#dc2626', fontWeight: 600,
                }}>
                  <AlertTriangle size={11} />
                  {critical} critical alert{critical !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
>>>>>>> Stashed changes
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
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No alerts</h3>
              <p>Your supply chain looks healthy. Click "Run Monitor" to scan for new risks.</p>
            </div>
          ) : (
            filtered.map((alert) => (
              <AlertCard
                key={alert.id}
                {...alert}
                agent_output={alert.agent_output ?? undefined}
                onDismiss={handleDismiss}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>

        {/* Right: Map placeholder + mini stats */}
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

          {/* Globe placeholder — Phase 2 wires in SupplierMap (deck.gl) */}
          <div
            style={{
              height: 320,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: '#EFF6FF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 32, marginBottom: 8 }}>🌏</span>
            <p style={{ fontWeight: 600 }}>Supplier Map</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Globe visualization — Phase 2</p>
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
