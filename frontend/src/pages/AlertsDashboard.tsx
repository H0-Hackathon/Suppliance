import React from 'react';
import { RefreshCw, Globe, TriangleAlert as AlertTriangle, Layers, DollarSign, Users, MapPin, Activity } from 'lucide-react';
import { TradeGlobe, DisruptionPoint, TradeGlobeSupplier } from '../components/TradeGlobe';
import { NewsTicker } from '../components/dashboard/NewsTicker';
import { LiveAgentResults, AgentResults } from '../components/dashboard/LiveAgentResults';
import { MetricCard } from '../components/common/MetricCard';
import { TopProgressBar } from '../components/common/TopProgressBar';
import { StatusPill } from '../components/common/StatusPill';
import api from '../services/api';

/**
 * AlertsDashboard — Main Suppliance command center.
 *
 * Backend integration preserved:
 *   - GET  /api/v2/alerts?customer_id=1            alert feed
 *   - GET  /api/v2/disruptions?customer_id=1       globe markers
 *   - GET  /api/v2/suppliers + /api/v2/geo/...     suppliers with coordinates
 *   - GET  /api/v2/monitor/targets                 countries/HS codes to scan
 *   - SSE  /api/v2/monitor/stream                  live 5-agent pipeline run
 *   - PUT  /api/v2/alerts/{id}/dismiss|resolve     alert actions
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

const MAP_LAYERS = [
  { id: 'suppliers',   label: 'Suppliers',       color: '#5BA86F' },
  { id: 'routes',      label: 'Exposure Routes', color: '#548C92' },
  { id: 'risk',        label: 'Risk Zones',      color: '#E24B4A' },
  { id: 'alt',         label: 'Alternatives',    color: '#84D7D8' },
];

// Map SSE event types to progress milestones (monotonically increasing)
function computeProgress(events: { type: string; agent?: string }[]): number {
  const milestones: Record<string, number> = {
    pipeline_start: 5,
    profile_loaded: 10,
    crew_start: 15,
  };

  const agentOrder = ['tariff_monitor', 'impact_calculator', 'alternatives_finder', 'import_compliance', 'adversarial'];
  let maxPct = 0;
  const seenAgents = new Set<string>();

  for (const ev of events) {
    if (milestones[ev.type]) {
      maxPct = Math.max(maxPct, milestones[ev.type]);
    }
    if ((ev.type === 'agent_start' || ev.type === 'agent_done' || ev.type === 'agent_result') && ev.agent) {
      seenAgents.add(ev.agent);
      const idx = agentOrder.indexOf(ev.agent);
      if (idx >= 0) {
        maxPct = Math.max(maxPct, 15 + (idx + 1) * 15);
      }
    }
    if (ev.type === 'pipeline_done') {
      maxPct = 100;
    }
  }

  return Math.min(100, maxPct);
}

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'risk'])
  );
  const [lastSync] = React.useState(() => new Date().toISOString());

  const [agentResults, setAgentResults] = React.useState<AgentResults>({});
  const [agentStatus, setAgentStatus] = React.useState<Record<string, 'running' | 'done'>>({});
  const [agentsUpdatedAt, setAgentsUpdatedAt] = React.useState<string | null>(null);
  const [agentSupplier, setAgentSupplier] = React.useState<string | null>(null);

  // Progress bar state
  const [pipelineEvents, setPipelineEvents] = React.useState<{ type: string; agent?: string }[]>([]);
  const [progressLabel, setProgressLabel] = React.useState('Generating analysis');
  const [showProgress, setShowProgress] = React.useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
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
      }
    })();
  }, []);

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

  // ── Monitor run via SSE 5-agent pipeline ───────────────────────────────────
  async function handleRunMonitor() {
    setIsRunning(true);
    setAgentResults({});
    setAgentStatus({});
    setPipelineEvents([]);
    setShowProgress(true);
    setProgressLabel('Generating analysis');

    try {
      const targetsRes = await api.get<MonitorTarget[]>('/v2/monitor/targets', {
        params: { customer_id: CUSTOMER_ID },
      });
      const targets = targetsRes.data;

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        setProgressLabel(`Analyzing ${target.country_name} — ${target.hs_code}`);

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

              setPipelineEvents((prev) => [...prev, { type, agent: event.agent as string | undefined }]);

              if (type === 'agent_start') {
                const agent = event.agent as string;
                if (agent) setAgentStatus((prev) => ({ ...prev, [agent]: 'running' }));
              } else if (type === 'agent_done') {
                const agent = event.agent as string;
                const output = event.output as Record<string, unknown> | undefined;
                if (agent) setAgentStatus((prev) => ({ ...prev, [agent]: 'done' }));
                if (agent && output) {
                  setAgentResults((prev) => ({ ...prev, [agent]: output }));
                  setAgentsUpdatedAt(new Date().toISOString());
                  if (agent === 'tariff_monitor') {
                    setAgentSupplier(
                      (output as { country?: string }).country ?? target.supplier_name ?? null
                    );
                  }
                }
              } else if (type === 'done') {
                es.close();
                resolve();
              } else if (type === 'error') {
                es.close();
                reject(new Error(event.message as string));
              }
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
      setProgressLabel('Analysis complete');
      setTimeout(() => setShowProgress(false), 1200);
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const active = alerts.filter((a) => a.status === 'active');
  const critical = active.filter((a) => a.severity === 'critical').length;
  const countryCount = new Set(suppliers.map((s) => s.country)).size;

  const agentMonitor = agentResults.tariff_monitor;
  const agentImpact = agentResults.impact_calculator;
  const exposureValue = agentImpact?.direct_cost ?? agentImpact?.extra_cost_usd ?? null;

  const activeParsed = active.map((a) => {
    try { return a.agent_output ? JSON.parse(a.agent_output) : {}; } catch { return {}; }
  });
  const totalExposure = activeParsed.reduce(
    (sum, p) => sum + (p?.impact_calculator?.direct_cost ?? p?.impact_calculator?.extra_cost_usd ?? 0),
    0
  );
  const criticalEvents = active.filter((a) => a.severity === 'critical' || a.severity === 'high').length;
  const affectedCodes = new Set(disruptions.flatMap((d) => d.countries_affected ?? []));
  const highRiskSuppliers = suppliers.filter((s) => s.countryCode && affectedCodes.has(s.countryCode)).length;

  const fmtMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `$${Math.round(n)}`;

  const progressPercent = computeProgress(pipelineEvents);

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
      background: 'var(--background)',
      overflow: 'hidden',
    }}>
      {/* Top progress bar */}
      <TopProgressBar
        label={progressLabel}
        percent={progressPercent}
        visible={showProgress}
      />

      {/* ── Top Hero Bar ── */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--card)',
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--foreground)',
            letterSpacing: '-0.3px',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.2,
            marginBottom: 4,
          }}>
            Trade Risk Intelligence
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#5BA86F',
                boxShadow: '0 0 5px #5BA86F',
                display: 'inline-block',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Monitoring {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} across {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
            </span>
            <span style={{ color: 'var(--border-soft)' }}>|</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              Updated {syncTime}
            </span>
            {critical > 0 && (
              <>
                <span style={{ color: 'var(--border-soft)' }}>|</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#E24B4A', fontWeight: 600,
                }}>
                  <AlertTriangle size={12} />
                  {critical} critical alert{critical !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(91,168,111,0.08)',
            border: '1px solid rgba(91,168,111,0.15)',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 11,
            color: '#a8d9b4',
            fontWeight: 600,
          }}>
            <Activity size={11} color="#5BA86F" />
            SYSTEMS NOMINAL
          </div>

          <button
            className="btn-accent"
            onClick={handleRunMonitor}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw
              size={13}
              style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }}
            />
            {isRunning ? 'Scanning…' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* ── Metric Cards Row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        padding: '16px 24px',
        flexShrink: 0,
      }}>
        <MetricCard
          label="Trade Exposure"
          value={totalExposure > 0 ? fmtMoney(totalExposure) : '—'}
          sub={`${active.length} active event${active.length !== 1 ? 's' : ''}`}
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          label="High Risk Suppliers"
          value={String(highRiskSuppliers)}
          sub={`of ${suppliers.length} tracked`}
          icon={<Users size={16} />}
        />
        <MetricCard
          label="Critical Trade Events"
          value={String(criticalEvents)}
          sub={`${active.length} active event${active.length !== 1 ? 's' : ''}`}
          icon={<AlertTriangle size={16} />}
        />
        <MetricCard
          label="Countries Monitored"
          value={String(countryCount)}
          sub={`${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}
          icon={<MapPin size={16} />}
        />
      </div>

      {/* ── Main Body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        minHeight: 0,
        overflow: 'hidden',
        gap: 0,
      }}>
        {/* ── Centre: Map ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <TradeGlobe suppliers={tradeGlobeSuppliers} disruptions={disruptions} />

            {/* Layer toggles overlay */}
            <div style={{
              position: 'absolute',
              top: 14, right: 14,
              background: 'rgba(30,58,66,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '10px 12px',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 5,
                marginBottom: 2,
              }}>
                <Layers size={10} color="#84D7D8" />
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
                      transition: 'background 0.15s ease-out',
                    }} />
                    <span style={{
                      fontSize: 11,
                      color: on ? 'var(--foreground)' : 'var(--text-secondary)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Exposure callout overlay */}
            <div style={{
              position: 'absolute',
              bottom: 14, left: 14,
              background: 'rgba(30,58,66,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(226,75,74,0.20)',
              borderRadius: 8,
              padding: '10px 16px',
              zIndex: 20,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Direct Cost Impact {agentImpact ? '(ImpactCalculator)' : ''}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#E24B4A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {exposureValue != null
                  ? `$${Math.round(exposureValue).toLocaleString('en-US')}`
                  : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(226,75,74,0.70)', marginTop: 4 }}>
                {agentMonitor?.tariff_rate != null
                  ? `${agentMonitor.tariff_rate}% tariff · ${agentMonitor.country ?? ''}`
                  : 'Run Analysis to calculate exposure'}
              </div>
            </div>
          </div>

          {/* Bottom: news ticker */}
          <div style={{ height: 56, flexShrink: 0 }}>
            <NewsTicker />
          </div>
        </div>

        {/* ── Right Rail: Live Agent Results ── */}
        <div style={{
          borderLeft: '1px solid var(--border-soft)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--card)',
        }}>
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text-secondary)',
              marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Activity size={10} color="#84D7D8" />
              Live Agent Results
            </div>

            <LiveAgentResults
              agents={agentResults}
              agentStatus={agentStatus}
              supplier={agentSupplier}
              updatedAt={agentsUpdatedAt}
              live={isRunning}
            />
          </div>
        </div>
      </div>
    </main>
  );
};
