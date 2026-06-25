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
import { TradeGlobe, DisruptionPoint, TradeGlobeSupplier, TradeGlobeHQ, TradeGlobeAlternateSupplier } from '../components/TradeGlobe';
import { AgentDebugPanel, AgentState, AgentDebugTarget } from '../components/AgentDebugPanel';
import { NewsTicker } from '../components/dashboard/NewsTicker';
import { LiveAgentResults, AgentResults } from '../components/dashboard/LiveAgentResults';
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
 * Customer is resolved server-side from the Clerk session token (attached
 * automatically by the axios interceptor in services/api.js).
 */

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
  { id: 'suppliers',   label: 'Suppliers',       color: '#10b981' },
  { id: 'routes',      label: 'Exposure Routes', color: '#f59e0b' },
  { id: 'risk',        label: 'Risk Zones',      color: '#dc2626' },
  { id: 'alt',         label: 'Alternatives',    color: '#14b8a6' },
];

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [hqLocation, setHqLocation] = React.useState<TradeGlobeHQ | null>(null);
  const [alternateSuppliers, setAlternateSuppliers] = React.useState<TradeGlobeAlternateSupplier[]>([]);
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
    const res = await api.get<ApiAlert[]>('/v2/alerts');
    setAlerts(res.data);
  }

  async function fetchDisruptions() {
    const res = await api.get<DisruptionPoint[]>('/v2/disruptions');
    setDisruptions(res.data);
  }

  async function fetchSuppliers() {
    const res = await api.get<ApiSupplier[]>('/v2/suppliers');
    const withGeo = await Promise.all(
      res.data.map(async (s): Promise<SupplierWithGeo> => {
        try {
          const geo = await api.get<GeoCoords>('/v2/geo/supplier-coords', { params: { country: s.country, name: s.name } });
          return { ...s, latitude: geo.data.latitude, longitude: geo.data.longitude, countryCode: geo.data.code };
        } catch {
          return { ...s, latitude: null, longitude: null, countryCode: null };
        }
      })
    );
    setSuppliers(withGeo);
  }

  // HQ/destination pin — resolved server-side from this customer's BusinessProfile
  // (destination_country/destination_port), then geocoded the same way suppliers are.
  async function fetchHQLocation() {
    try {
      const res = await api.get<{ destination_country: string | null; destination_port: string | null }>('/v2/settings');
      const { destination_country, destination_port } = res.data;
      if (!destination_country) {
        setHqLocation(null);
        return;
      }
      const geo = await api.get<GeoCoords>('/v2/geo/supplier-coords', { params: { country: destination_country } });
      setHqLocation({
        name: destination_port || destination_country,
        country: destination_country,
        latitude: geo.data.latitude,
        longitude: geo.data.longitude,
      });
    } catch {
      setHqLocation(null);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchAlerts(), fetchDisruptions(), fetchSuppliers(), fetchHQLocation()]);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      }

      // Dashboard (globe + suppliers) is now visible — silently auto-run the
      // pipeline exactly once for accounts that have never had a run, without
      // blocking the page on it.
      try {
        const me = await api.get<{ has_run_pipeline: boolean }>('/v2/auth/me');
        if (!me.data.has_run_pipeline) {
          handleRunMonitor();
        }
      } catch {
        // best-effort — skip auto-run if /auth/me fails
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alternate suppliers surfaced by the latest AlternativesFinder run — geocoded
  // the same way the customer's own suppliers are, so the globe can swap to
  // routes from these instead of the (now-disrupted) main suppliers.
  React.useEffect(() => {
    const options: any[] = agentResults.alternatives_finder?.options
      ?? agentResults.alternatives_finder?.alternatives
      ?? [];
    if (options.length === 0) {
      setAlternateSuppliers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const resolved = await Promise.all(
        options.map(async (opt): Promise<TradeGlobeAlternateSupplier | null> => {
          const country = opt.country ?? opt.country_full ?? '';
          if (!country) return null;
          const name = opt.supplier ?? opt.supplier_name ?? 'Alternative Supplier';
          try {
            const geo = await api.get<GeoCoords>('/v2/geo/supplier-coords', { params: { country, name } });
            return {
              name,
              country,
              latitude: geo.data.latitude,
              longitude: geo.data.longitude,
              leadTimeWeeks: opt.lead_time_weeks ?? null,
              costDeltaPct: opt.cost_delta_pct ?? null,
            };
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setAlternateSuppliers(resolved.filter((r): r is TradeGlobeAlternateSupplier => r != null));
      }
    })();
    return () => { cancelled = true; };
  }, [agentResults]);

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
      await api.post('/v2/monitor/run');
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
      label: 'Trade Exposure',
      value: fmtMoney(totalExposure),
      sub: `${active.length} active alert${active.length !== 1 ? 's' : ''}`,
      icon: DollarSign, color: '#dc2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.18)',
    },
    {
      key: 'proposed',
      available: proposedSuppliersCount > 0,
      label: 'Proposed Suppliers',
      value: String(proposedSuppliersCount),
      sub: 'before compliance review',
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
      sub: `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`,
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

  return (
    <main className="page-with-sidebar" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* ── Top Hero Bar ── */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(245,158,11,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(14,14,10,0.95)',
        backdropFilter: 'blur(12px)',
      }}>
        <div>
          <h1 style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#e8e3d8',
            letterSpacing: '-0.3px',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            Trade Risk Intelligence
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'rgba(130,120,90,0.8)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 5px #10b981',
                display: 'inline-block',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Monitoring {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} across {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.18)',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 10,
            color: '#6ee7b7',
            fontWeight: 600,
          }}>
            <Activity size={10} color="#10b981" />
            SYSTEMS NOMINAL
          </div>

          <button
            className="btn-accent"
            onClick={handleRunMonitor}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
          >
            <RefreshCw
              size={12}
              style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }}
            />
            {isRunning ? 'Scanning…' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 276px',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* ── Centre: Map ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Map container */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <TradeGlobe
              suppliers={tradeGlobeSuppliers}
              disruptions={disruptions}
              hqLocation={hqLocation}
              alternateSuppliers={alternateSuppliers}
            />

            {/* Layer toggles overlay */}
            <div style={{
              position: 'absolute',
              top: 14, right: 14,
              background: 'rgba(14,14,10,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(245,158,11,0.12)',
              borderRadius: 8,
              padding: '10px 12px',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(150,140,100,0.7)',
                display: 'flex', alignItems: 'center', gap: 5,
                marginBottom: 2,
              }}>
                <Layers size={9} color="#f59e0b" />
                <span>Map Layers</span>
              </div>
              {MAP_LAYERS.map((layer) => {
                const on = activeLayers.has(layer.id);
                return (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 0',
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                      background: on ? layer.color : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${on ? layer.color : 'rgba(255,255,255,0.08)'}`,
                      transition: 'background 0.15s',
                    }} />
                    <span style={{
                      fontSize: 10.5,
                      color: on ? '#e8e3d8' : 'rgba(130,120,90,0.6)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Bottom: live trade/supply-chain news ticker */}
          <div style={{ height: 56, flexShrink: 0 }}>
            <NewsTicker lastRunAt={lastRunAt} />
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{
          borderLeft: '1px solid rgba(245,158,11,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(14,14,10,0.5)',
        }}>
          {/* Intelligence KPI cards — derived from real monitor results;
              individual cards hide when their underlying data is unavailable. */}
          {kpiCards.length > 0 && (
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(245,158,11,0.07)',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'rgba(150,140,100,0.55)',
                marginBottom: 9,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Globe size={9} color="#f59e0b" />
                Trade Intelligence
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {kpiCards.map(({ key, label, value, sub, icon: Icon, color, bg, border }) => (
                  <div key={key} style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                    padding: '10px 11px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                      <Icon size={10} color={color} />
                      <span style={{ fontSize: 8.5, color: 'rgba(150,140,100,0.7)', lineHeight: 1.2 }}>{label}</span>
                    </div>
                    <div style={{
                      fontSize: 20, fontWeight: 800,
                      color, fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1, marginBottom: 3,
                    }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(130,120,90,0.7)' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Pipeline — live agent debug stream while running, else status */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 14px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(245,158,11,0.1) transparent',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(150,140,100,0.55)',
              marginBottom: 9,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Activity size={9} color="#f59e0b" />
              Live Agent Results
            </div>

            {/* Real agent output: TariffMonitor, ImpactCalculator, and (real
                LLM mode) AlternativesFinder, ImportCompliance, Adversarial */}
            <LiveAgentResults
              agents={agentResults}
              agentStatus={agentStatus}
              supplier={agentSupplier}
              updatedAt={agentsUpdatedAt}
              live={isRunning}
            />

            {/* Raw agent stream (start/done/log events) while a run is in flight */}
            {debugState && (
              <div style={{ marginTop: 10 }}>
                <AgentDebugPanel
                  agentStates={debugState.agentStates}
                  logs={debugState.logs}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
