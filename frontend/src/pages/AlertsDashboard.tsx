import React from 'react';
import { RefreshCw } from 'lucide-react';
import { AlertCard, AlertSeverity, AlertType } from '../components/AlertCard';
import { TradeGlobe, DisruptionPoint, TradeGlobeSupplier } from '../components/TradeGlobe';
import { AgentDebugPanel, AgentState, AgentDebugTarget } from '../components/AgentDebugPanel';
import api from '../services/api';

/**
 * AlertsDashboard — Main CoastGuard dashboard page.
 *
 * Wired to the real backend:
 *   - GET  /api/v2/alerts?customer_id=1       initial alert feed
 *   - GET  /api/v2/monitor/targets            countries/HS codes to scan
 *   - POST /api/v2/monitor/run                "Run Monitor" button (once per target)
 *   - PUT  /api/v2/alerts/{id}/dismiss|resolve  alert actions
 *   - GET  /api/v2/disruptions?customer_id=1  globe markers
 *
 * There's no auth/customer-switcher yet, so CUSTOMER_ID is hardcoded to the
 * single seeded demo customer (backend/scripts/seed_data.py creates id=1).
 */

const CUSTOMER_ID = 1;

interface ApiAlert {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
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

type FilterSeverity = 'all' | AlertSeverity;

const FILTER_OPTIONS: FilterSeverity[] = ['all', 'critical', 'high', 'medium', 'low'];

// Unicode regional indicator flag emoji from an ISO 3166-1 alpha-2 code.
function flagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [filter, setFilter] = React.useState<FilterSeverity>('all');
  const [isRunning, setIsRunning] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [debugState, setDebugState] = React.useState<DebugState | null>(null);

  async function fetchAlerts() {
    const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: CUSTOMER_ID } });
    setAlerts(res.data);
  }

  async function fetchDisruptions() {
    const res = await api.get<DisruptionPoint[]>('/v2/disruptions', { params: { customer_id: CUSTOMER_ID } });
    setDisruptions(res.data);
  }

  async function fetchSuppliers() {
    const res = await api.get<ApiSupplier[]>('/v2/suppliers', { params: { customer_id: CUSTOMER_ID } });
    const withGeo = await Promise.all(
      res.data.map(async (s): Promise<SupplierWithGeo> => {
        try {
          const geo = await api.get<GeoCoords>('/v2/geo/supplier-coords', { params: { country: s.country } });
          return { ...s, latitude: geo.data.latitude, longitude: geo.data.longitude, countryCode: geo.data.code };
        } catch {
          return { ...s, latitude: null, longitude: null, countryCode: null };
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

  // Runs the 5-agent pipeline via the SSE /monitor/stream endpoint.
  // Real-time progress is shown in the AgentDebugPanel as each agent
  // emits start/done events. Logs from CrewAI's verbose output stream
  // into the debug panel's output log in real time.
  async function handleRunMonitor() {
    setIsRunning(true);
    setDebugState(null);

    try {
      const targetsRes = await api.get<MonitorTarget[]>('/v2/monitor/targets', {
        params: { customer_id: CUSTOMER_ID },
      });
      const targets = targetsRes.data;

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];

        // Reset debug state for this target
        setDebugState({
          target: { ...target },
          targetIndex: i,
          totalTargets: targets.length,
          agentStates: {},
          logs: [],
        });

        await new Promise<void>((resolve, reject) => {
          const params = new URLSearchParams({
            customer_id: String(CUSTOMER_ID),
            hs_code: target.hs_code,
            supplier_country: target.supplier_country,
          });
          const es = new EventSource(`/api/v2/monitor/stream?${params}`);

          es.onmessage = (e: MessageEvent) => {
            try {
              const event = JSON.parse(e.data as string) as Record<string, unknown>;
              const type = event.type as string;

              if (type === 'agent_start') {
                const agent = event.agent as string;
                setDebugState((prev) =>
                  prev ? {
                    ...prev,
                    agentStates: { ...prev.agentStates, [agent]: { status: 'running' } },
                  } : prev
                );
              } else if (type === 'agent_done') {
                const agent = event.agent as string;
                const output = event.output as Record<string, unknown> | undefined;
                setDebugState((prev) =>
                  prev ? {
                    ...prev,
                    agentStates: { ...prev.agentStates, [agent]: { status: 'done', output } },
                  } : prev
                );
              } else if (type === 'log') {
                const text = event.text as string;
                setDebugState((prev) =>
                  prev ? { ...prev, logs: [...prev.logs.slice(-300), text] } : prev
                );
              } else if (type === 'done') {
                es.close();
                resolve();
              } else if (type === 'error') {
                es.close();
                reject(new Error(event.message as string));
              }
              // heartbeat: ignore
            } catch {
              // malformed event — ignore
            }
          };

          es.onerror = () => {
            es.close();
            reject(new Error('SSE connection lost'));
          };
        });
      }

      await Promise.all([fetchAlerts(), fetchDisruptions()]);
    } catch (err) {
      console.error('Run Monitor failed', err);
    } finally {
      setIsRunning(false);
      // Leave debugState visible so the user can inspect the final output;
      // it clears on the next run.
    }
  }

  const stats = {
    active: activeAlerts.length,
    critical: activeAlerts.filter((a) => a.severity === 'critical').length,
    high: activeAlerts.filter((a) => a.severity === 'high').length,
  };

  // A supplier's country shows up in an active disruption's countries_affected.
  const affectedCodes = new Set(disruptions.flatMap((d) => d.countries_affected ?? []));
  const isSupplierAtRisk = (s: SupplierWithGeo) => !!s.countryCode && affectedCodes.has(s.countryCode);

  const tradeGlobeSuppliers: TradeGlobeSupplier[] = suppliers
    .filter((s): s is SupplierWithGeo & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({ name: s.name, country: s.country, countryCode: s.countryCode, latitude: s.latitude, longitude: s.longitude }));

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

      {/* Agent Debug panel — visible while running and stays up after completion */}
      {debugState && (
        <AgentDebugPanel
          target={debugState.target}
          agentStates={debugState.agentStates}
          logs={debugState.logs}
          targetIndex={debugState.targetIndex}
          totalTargets={debugState.totalTargets}
        />
      )}

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
          <div className="stat-value">{suppliers.length}</div>
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
            <TradeGlobe suppliers={tradeGlobeSuppliers} disruptions={disruptions} />
          </div>

          {/* Supplier list preview */}
          <div className="card">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
              Tracked Suppliers
            </p>
            {suppliers.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No suppliers on file yet.</p>
            ) : (
              suppliers.map((s) => {
                const atRisk = isSupplierAtRisk(s);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{flagEmoji(s.countryCode)}</span>
                    <div>
                      <p style={{ fontWeight: 600 }}>{s.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.country}</p>
                    </div>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        fontWeight: 700,
                        color: atRisk ? '#EF4444' : '#10B981',
                      }}
                    >
                      {atRisk ? '⚠ AT RISK' : '✓ OK'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
