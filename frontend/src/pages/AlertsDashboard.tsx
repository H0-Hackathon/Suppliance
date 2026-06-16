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
import { EventFeed } from '../components/dashboard/EventFeed';
import {
  LiveAgentResults,
  TariffMonitorOutput,
  ImpactCalculatorOutput,
} from '../components/dashboard/LiveAgentResults';
import api from '../services/api';

/**
 * AlertsDashboard — Main CoastGuard command center.
 *
 * Visual design / layout: frontend redesign (map-centric command center).
 * Backend integration preserved from the Samved branch:
 *   - GET  /api/v2/alerts?customer_id=1            alert feed
 *   - GET  /api/v2/disruptions?customer_id=1       globe markers
 *   - GET  /api/v2/suppliers + /api/v2/geo/...     suppliers with coordinates
 *   - GET  /api/v2/monitor/targets                 countries/HS codes to scan
 *   - SSE  /api/v2/monitor/stream                  live 5-agent pipeline run
 *   - PUT  /api/v2/alerts/{id}/dismiss|resolve     alert actions
 *
 * Auth is removed; CUSTOMER_ID is hardcoded to the seeded demo customer (id=1).
 */

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

// Intelligence KPI cards
const INTEL_CARDS = [
  {
    label: 'Trade Exposure',
    value: '$420K',
    sub: '+$40K new risk',
    icon: DollarSign,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.18)',
  },
  {
    label: 'High Risk Suppliers',
    value: '4',
    sub: '1 critical',
    icon: Users,
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.07)',
    border: 'rgba(234,88,12,0.18)',
  },
  {
    label: 'Critical Trade Events',
    value: '2',
    sub: 'Last 24 hours',
    icon: AlertTriangle,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.18)',
  },
  {
    label: 'Countries Monitored',
    value: '18',
    sub: '43 trade routes',
    icon: MapPin,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.18)',
  },
];

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
  const [isRunning, setIsRunning] = React.useState(false);
  const [debugState, setDebugState] = React.useState<DebugState | null>(null);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'risk'])
  );
  const [lastSync] = React.useState(() => new Date().toISOString());

  // Real Agent 1 (TariffMonitor) + Agent 2 (ImpactCalculator) outputs, surfaced
  // live from the SSE stream during a run and from the latest persisted alert
  // (TariffAlert.agent_output) on load.
  const [agentMonitor, setAgentMonitor] = React.useState<TariffMonitorOutput | null>(null);
  const [agentImpact, setAgentImpact] = React.useState<ImpactCalculatorOutput | null>(null);
  const [agentsUpdatedAt, setAgentsUpdatedAt] = React.useState<string | null>(null);
  const [agentSupplier, setAgentSupplier] = React.useState<string | null>(null);

  // ── Data fetching (backend integration) ──────────────────────────────────
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
          setAgentMonitor(parsed.tariff_monitor ?? null);
          setAgentImpact(parsed.impact_calculator ?? null);
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
                // Surface real Agent 1/2 output in the Live Agent Results panel.
                if (agent === 'tariff_monitor' && output) {
                  setAgentMonitor(output as TariffMonitorOutput);
                  setAgentsUpdatedAt(new Date().toISOString());
                  setAgentSupplier((output as TariffMonitorOutput).country ?? target.supplier_name ?? null);
                } else if (agent === 'impact_calculator' && output) {
                  setAgentImpact(output as ImpactCalculatorOutput);
                  setAgentsUpdatedAt(new Date().toISOString());
                }
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
      // Leave debugState visible so the final agent output stays on screen;
      // it clears on the next run.
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
  const exposureValue = agentImpact?.direct_cost ?? agentImpact?.extra_cost_usd ?? null;

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
            <TradeGlobe suppliers={tradeGlobeSuppliers} disruptions={disruptions} />

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

            {/* Exposure callout overlay — bottom left of map */}
            <div style={{
              position: 'absolute',
              bottom: 14, left: 14,
              background: 'rgba(14,14,10,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 8,
              padding: '8px 14px',
              zIndex: 20,
            }}>
              <div style={{ fontSize: 9, color: 'rgba(150,140,100,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                Direct Cost Impact {agentImpact ? '(ImpactCalculator)' : ''}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {exposureValue != null
                  ? `$${Math.round(exposureValue).toLocaleString('en-US')}`
                  : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(220,38,38,0.7)', marginTop: 3 }}>
                {agentMonitor?.tariff_rate != null
                  ? `${agentMonitor.tariff_rate}% tariff · ${agentMonitor.country ?? ''}`
                  : 'Run Analysis to calculate exposure'}
              </div>
            </div>
          </div>

          {/* Bottom: Trade Intelligence Feed */}
          <div style={{ height: 56, flexShrink: 0 }}>
            <EventFeed />
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
          {/* Intelligence KPI cards */}
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
              {INTEL_CARDS.map(({ label, value, sub, icon: Icon, color, bg, border }) => (
                <div key={label} style={{
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

            {/* Real Agent 1 (TariffMonitor) + Agent 2 (ImpactCalculator) output */}
            <LiveAgentResults
              tariffMonitor={agentMonitor}
              impact={agentImpact}
              supplier={agentSupplier}
              updatedAt={agentsUpdatedAt}
              live={isRunning}
            />

            {/* Raw agent stream (start/done/log events) while a run is in flight */}
            {debugState && (
              <div style={{ marginTop: 10 }}>
                <AgentDebugPanel
                  target={debugState.target}
                  agentStates={debugState.agentStates}
                  logs={debugState.logs}
                  targetIndex={debugState.targetIndex}
                  totalTargets={debugState.totalTargets}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
