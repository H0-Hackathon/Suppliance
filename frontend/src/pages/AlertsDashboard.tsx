import React from 'react';
import {
  RefreshCw,
  Globe,
  AlertTriangle,
  Layers,
  DollarSign,
  Users,
  MapPin,
  Activity,
} from 'lucide-react';
import { TradeGlobe, DisruptionPoint, TradeGlobeSupplier } from '../components/TradeGlobe';
import { AgentDebugPanel, AgentState, AgentDebugTarget } from '../components/AgentDebugPanel';
import { NewsTicker } from '../components/dashboard/NewsTicker';
import { LiveAgentResults, AgentResults } from '../components/dashboard/LiveAgentResults';
import { SoftButton } from '../components/motion';
import { ShipmentRouteTimeline } from '../components/maritime/ShipmentRouteTimeline';
import { buildRouteLegs, portByCountry } from '../data/maritimePorts';
import api from '../services/api';
/**
 * AlertsDashboard — Main CoastGuard command center.
 *
 * Visual design / layout: frontend redesign (map-centric command center).
 * Backend integration preserved from the Samved branch:
 *   - GET  /api/v2/alerts?customer_id=N            alert feed
 *   - GET  /api/v2/disruptions?customer_id=N       globe markers
 *   - GET  /api/v2/suppliers + /api/v2/geo/...     suppliers with coordinates
 *   - POST /api/v2/monitor/run                     trigger pipeline run
 *   - GET  /api/v2/monitor/pipeline-log?since=N    poll live log during run
 *   - PUT  /api/v2/alerts/{id}/dismiss|resolve     alert actions
 *
 * Auth is removed; ACTIVE_CUSTOMER_ID is set to the seeded demo customer.
 * Replace with the auth token's customer id once Clerk is wired.
 */

const ACTIVE_CUSTOMER_ID = 69;

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
}

export interface MonitorTarget {
  supplier_country: string;
  country_name: string;
  hs_code: string;
  supplier_name: string | null;
  product_category: string | null;
}

interface DebugState {
  target?: AgentDebugTarget | null;
  targetIndex?: number;
  totalTargets?: number;
  agentStates: Record<string, AgentState>;
  logs: string[];
}

const MAP_LAYERS = [
  { id: 'suppliers', label: 'Suppliers', color: '#548C92' },
  { id: 'routes', label: 'Exposure routes', color: '#548C92' },
  { id: 'risk', label: 'Risk zones', color: 'var(--driftwood)' },
  { id: 'alt', label: 'Alternatives', color: '#AB9072' },
];
export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [debugState, setDebugState] = React.useState<DebugState | null>(null);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'risk'])
  );
  const [lastSync] = React.useState(() => new Date().toISOString());

  // Real agent outputs (TariffMonitor, ImpactCalculator, AlternativesFinder,
  // ImportCompliance, Adversarial), surfaced live from the SSE stream during a
  // run and from the latest persisted alert (TariffAlert.agent_output) on load.
  const [agentResults, setAgentResults] = React.useState<AgentResults>({});
  const [agentStatus, setAgentStatus] = React.useState<Record<string, 'running' | 'done'>>({});
  const [agentsUpdatedAt, setAgentsUpdatedAt] = React.useState<string | null>(null);
  const [agentSupplier, setAgentSupplier] = React.useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = React.useState<string | null>(null);

  // ── Data fetching (backend integration) ──────────────────────────────────
  async function fetchAlerts() {
    const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: ACTIVE_CUSTOMER_ID } });
    setAlerts(res.data);
  }

  async function fetchDisruptions() {
    const res = await api.get<DisruptionPoint[]>('/v2/disruptions', { params: { customer_id: ACTIVE_CUSTOMER_ID } });
    setDisruptions(res.data);
  }

  async function fetchSuppliers() {
    const res = await api.get<ApiSupplier[]>('/v2/suppliers', { params: { customer_id: ACTIVE_CUSTOMER_ID } });
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

  // ── Monitor run: POST /monitor/run + poll /monitor/pipeline-log ──────────
  // Fires the synchronous pipeline endpoint and polls the live log every
  // 1.5 s so the user sees text progress during the 1–3 min run.
  // Structured `agent_result` events (emitted by the pipeline after parsing)
  // are picked up by the poller and surface in LiveAgentResults + AgentDebugPanel.
  async function handleRunMonitor() {
    setIsRunning(true);
    setDebugState({ agentStates: {}, logs: [] });
    setAgentResults({});
    setAgentStatus({});
    setAgentsUpdatedAt(null);
    setAgentSupplier(null);

    let pollSince = 0;

    const poll = async () => {
      try {
        const res = await api.get<{
          events: Array<{ event: string; msg: string; ts: string }>;
          total: number;
        }>('/v2/monitor/pipeline-log', { params: { since: pollSince } });
        const { events, total } = res.data;
        pollSince = total;
        for (const ev of events) {
          if (ev.event === 'agent_result') {
            try {
              const payload = JSON.parse(ev.msg) as { agent: string; output: Record<string, unknown> };
              const { agent, output } = payload;
              setAgentResults((prev) => ({ ...prev, [agent]: output }));
              setAgentStatus((prev) => ({ ...prev, [agent]: 'done' }));
              setDebugState((prev) =>
                prev
                  ? { ...prev, agentStates: { ...prev.agentStates, [agent]: { status: 'done', output } } }
                  : prev,
              );
              setAgentsUpdatedAt(new Date().toISOString());
              if (agent === 'tariff_monitor') {
                setAgentSupplier((output as { country?: string }).country ?? null);
              }
            } catch {
              // malformed agent_result payload — skip
            }
          } else {
            // Text log event — surface in the debug log panel
            const text = `[${ev.event}] ${ev.msg}`;
            setDebugState((prev) =>
              prev ? { ...prev, logs: [...prev.logs.slice(-300), text] } : prev,
            );
          }
        }
      } catch {
        // Poll failure — ignore, will retry on next interval
      }
    };

    const pollInterval = setInterval(poll, 1500);

    try {
      await api.post('/v2/monitor/run', { customer_id: ACTIVE_CUSTOMER_ID });
      // Final poll to catch any events emitted in the last interval window
      await poll();
      await Promise.all([fetchAlerts(), fetchDisruptions()]);
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      console.error('Run Analysis failed', err);
    } finally {
      clearInterval(pollInterval);
      setIsRunning(false);
    }
  }

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
  const latestAo = activeParsed[0] ?? {};
  const proposedOptions: any[] = latestAo?.alternatives_finder?.options ?? latestAo?.alternatives_finder?.alternatives ?? [];
  const proposedSuppliersCount = proposedOptions.length;

  const fmtMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `$${Math.round(n)}`;

  // Each card is only shown when its underlying real data exists; otherwise it
  // is hidden (no placeholder values).
  const kpiCards = [
    {
      key: 'exposure',
      available: totalExposure > 0,
      label: 'Trade exposure',
      value: fmtMoney(totalExposure),
      sub: `${active.length} active alert${active.length !== 1 ? 's' : ''}`,
      context: 'Duty and landed cost on open POs',
      icon: DollarSign,
      emphasize: true,
    },
    {
      key: 'proposed',
      available: proposedSuppliersCount > 0,
      label: 'Proposed suppliers',
      value: String(proposedSuppliersCount),
      sub: 'Before compliance review',
      context: 'Alternate origins under review',
      icon: Users,
      emphasize: false,
    },
    {
      key: 'events',
      available: active.length > 0,
      label: 'Critical trade events',
      value: String(criticalEvents),
      sub: `${active.length} active alert${active.length !== 1 ? 's' : ''}`,
      context: 'Tariff or policy changes affecting lanes',
      icon: AlertTriangle,
      emphasize: false,
    },
    {
      key: 'countries',
      available: suppliers.length > 0,
      label: 'Countries monitored',
      value: String(countryCount),
      sub: `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`,
      context: 'Origins linked to Port of Los Angeles imports',
      icon: MapPin,
      emphasize: false,
    },
  ].filter((c) => c.available);
  // Suppliers with resolved coordinates feed the globe (backend-driven risk).
  const tradeGlobeSuppliers: TradeGlobeSupplier[] = suppliers
    .filter((s): s is SupplierWithGeo & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({ name: s.name, country: s.country, countryCode: s.countryCode, latitude: s.latitude, longitude: s.longitude }));

  const syncTime = new Date(lastSync).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const timelineCountry =
    agentSupplier ??
    suppliers.find((s) => s.country)?.country ??
    'China';
  const routeLegs = buildRouteLegs(timelineCountry);
  const originPort = portByCountry(timelineCountry);

  return (
    <main
      className="page-with-sidebar cg-workspace"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header className="cg-workspace-header">
        <div
          style={{
            padding: '20px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>
              Operations workspace
            </h1>
            <div className="ws-meta" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--ws-harbor)',
                    display: 'inline-block',
                  }}
                />
                Monitoring {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} across {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
              </span>
              <span style={{ color: 'var(--ws-border-strong)' }}>·</span>
              <span className="ws-meta-muted">Updated {syncTime}</span>
              {critical > 0 && (
                <>
                  <span style={{ color: 'var(--ws-border-strong)' }}>·</span>
                  <span
                    className="ws-critical-pulse"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: 'var(--ws-critical)',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <AlertTriangle size={14} />
                    {critical} critical alert{critical !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          <SoftButton
            variant="accent"
            onClick={handleRunMonitor}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
          >
            <RefreshCw size={14} style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }} />
            {isRunning ? 'Analyzing…' : 'Run analysis'}
          </SoftButton>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            padding: '16px 16px 0 16px',
          }}
        >
          <div
            className="ws-map-frame"
            style={{
              flex: 1,
              position: 'relative',
              minHeight: 0,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <TradeGlobe
              suppliers={tradeGlobeSuppliers}
              disruptions={disruptions}
              activeLayers={activeLayers}
            />

            <div
              className="ws-layers-panel"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: '12px 16px',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div className="ws-layers-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Layers size={12} color="var(--ws-harbor)" />
                <span>Map layers</span>
              </div>
              {MAP_LAYERS.map((layer) => {
                const on = activeLayers.has(layer.id);
                return (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '3px 0',
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        flexShrink: 0,
                        background: on ? layer.color : 'var(--ws-surface)',
                        border: `1.5px solid ${on ? layer.color : 'var(--ws-border)'}`,
                        transition: 'background 0.2s',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: on ? 'var(--ws-text)' : 'var(--ws-text-muted)',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: 52, flexShrink: 0, marginTop: 12 }}>
            <NewsTicker customerId={ACTIVE_CUSTOMER_ID} lastRunAt={lastRunAt} />
          </div>
        </div>

        <div className="ws-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {kpiCards.length > 0 && (
            <div className="ws-panel-section" style={{ padding: '20px 20px 16px', flexShrink: 0 }}>
              <div className="ws-section-label" style={{ marginBottom: 12 }}>
                <Globe size={12} color="var(--ws-harbor)" />
                Lane snapshot
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {kpiCards.map(({ key, label, value, sub, context, icon: Icon, emphasize }) => (
                  <div key={key} className="ws-kpi">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Icon size={13} color="var(--ws-harbor)" />
                      <span className="ws-kpi-label">{label}</span>
                    </div>
                    <div className={`ws-kpi-value${emphasize ? ' ws-kpi-value--emphasis' : ''}`}>{value}</div>
                    <div className="ws-kpi-sub">{sub}</div>
                    {context && <div className="ws-kpi-context">{context}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', padding: '20px', scrollbarWidth: 'thin' }}>
            <div className="ws-section-label" style={{ marginBottom: 12 }}>
              <Activity size={12} color="var(--ws-harbor)" />
              Trade assessment
            </div>

            <ShipmentRouteTimeline
              legs={routeLegs}
              title="Active shipment lane"
              subtitle={
                originPort
                  ? `${originPort.name} → Singapore → Port of Los Angeles`
                  : `${timelineCountry} → Singapore → Port of Los Angeles`
              }
              compact
            />

            <LiveAgentResults
              agents={agentResults}
              agentStatus={agentStatus}
              supplier={agentSupplier}
              updatedAt={agentsUpdatedAt}
              live={isRunning}
            />

            {debugState && (
              <div style={{ marginTop: 16 }}>
                <AgentDebugPanel agentStates={debugState.agentStates} logs={debugState.logs} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
