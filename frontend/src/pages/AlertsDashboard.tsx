import React from 'react';
import {
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Users,
  MapPin,
  Activity,
} from 'lucide-react';
import { TradeGlobe, DisruptionPoint, TradeGlobeSupplier, TradeGlobeHQ, TradeGlobeAlternateSupplier } from '../components/TradeGlobe';
import { NewsTicker } from '../components/dashboard/NewsTicker';
import { LiveAgentResults, AgentResults } from '../components/dashboard/LiveAgentResults';
import { MetricCard } from '../components/common/MetricCard';
import { TopProgressBar } from '../components/common/TopProgressBar';
import { WaveAccent } from '../components/common/WaveAccent';
import { GlowOrb } from '../components/common/GlowOrb';
import { ICON_SIZE, ICON_STROKE } from '../components/common/iconDefaults';
import api from '../services/api';

/**
 * Dashboard — Suppliance command center.
 *
 * Backend integration (customer resolved server-side from the Clerk token):
 *   GET  /v2/alerts · /v2/disruptions · /v2/suppliers · /v2/geo/supplier-coords
 *   GET  /v2/settings (HQ) · /v2/auth/me (auto-run gate)
 *   POST /v2/monitor/run · GET /v2/monitor/pipeline-log?since=N
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

// Pipeline-log event → cumulative progress percentage (monotonic).
const AGENT_COUNT = 5;

export const AlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [hqLocation, setHqLocation] = React.useState<TradeGlobeHQ | null>(null);
  const [alternateSuppliers, setAlternateSuppliers] = React.useState<TradeGlobeAlternateSupplier[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [progressPct, setProgressPct] = React.useState<number | null>(null);
  const [lastSync] = React.useState(() => new Date().toISOString());

  const [agentResults, setAgentResults] = React.useState<AgentResults>({});
  const [agentStatus, setAgentStatus] = React.useState<Record<string, 'running' | 'done'>>({});
  const [agentsUpdatedAt, setAgentsUpdatedAt] = React.useState<string | null>(null);
  const [agentSupplier, setAgentSupplier] = React.useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = React.useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
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
      // Auto-run the pipeline exactly once for accounts that have never run it.
      try {
        const me = await api.get<{ has_run_pipeline: boolean }>('/v2/auth/me');
        if (!me.data.has_run_pipeline) {
          handleRunMonitor();
        }
      } catch {
        /* best-effort */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode alternate suppliers from the latest AlternativesFinder output.
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

  // Surface the most recent persisted agent run on load (skipped while live).
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
        /* non-JSON — skip */
      }
    }
  }, [alerts, isRunning]);

  // ── Monitor run + live progress ───────────────────────────────────────────
  async function handleRunMonitor() {
    if (isRunning) return;
    setIsRunning(true);
    setProgressPct(0);
    setAgentResults({});
    setAgentStatus({});
    setAgentsUpdatedAt(null);
    setAgentSupplier(null);

    let pollSince = 0;
    let maxPct = 0;
    let agentsDone = 0;
    let agentsStarted = 0;
    const bump = (p: number) => {
      if (p > maxPct) {
        maxPct = p;
        setProgressPct(p);
      }
    };

    const poll = async () => {
      try {
        const res = await api.get<{
          events: Array<{ event: string; msg: string; ts: string }>;
          total: number;
        }>('/v2/monitor/pipeline-log', { params: { since: pollSince } });
        const { events, total } = res.data;
        pollSince = total;
        for (const ev of events) {
          // progress milestones
          switch (ev.event) {
            case 'pipeline_start': bump(5); break;
            case 'profile_loaded': bump(10); break;
            case 'crew_start': bump(15); break;
            case 'agent_start':
              agentsStarted = Math.min(agentsStarted + 1, AGENT_COUNT);
              bump(Math.min(15 + agentsStarted * 12 - 6, 88));
              break;
            case 'pipeline_done': bump(100); break;
            default: break;
          }

          if (ev.event === 'agent_result') {
            agentsDone = Math.min(agentsDone + 1, AGENT_COUNT);
            bump(Math.min(15 + agentsDone * 15, 92));
            try {
              const payload = JSON.parse(ev.msg) as { agent: string; output: Record<string, unknown> };
              const { agent, output } = payload;
              setAgentResults((prev) => ({ ...prev, [agent]: output }));
              setAgentStatus((prev) => ({ ...prev, [agent]: 'done' }));
              setAgentsUpdatedAt(new Date().toISOString());
              if (agent === 'tariff_monitor') {
                setAgentSupplier((output as { country?: string }).country ?? null);
              }
            } catch {
              /* malformed — skip */
            }
          }
        }
      } catch {
        /* poll failure — retry next interval */
      }
    };

    const pollInterval = setInterval(poll, 1500);

    try {
      await api.post('/v2/monitor/run');
      await poll();
      bump(100);
      await Promise.all([fetchAlerts(), fetchDisruptions()]);
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      console.error('Run Analysis failed', err);
    } finally {
      clearInterval(pollInterval);
      setIsRunning(false);
      // Let the bar finish at 100% then fade out.
      setProgressPct(100);
      setTimeout(() => setProgressPct(null), 1000);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const active = alerts.filter((a) => a.status === 'active');
  const critical = active.filter((a) => a.severity === 'critical').length;
  const countryCount = new Set(suppliers.map((s) => s.country)).size;

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

  const tradeGlobeSuppliers: TradeGlobeSupplier[] = suppliers
    .filter((s): s is SupplierWithGeo & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({ name: s.name, country: s.country, countryCode: s.countryCode, latitude: s.latitude, longitude: s.longitude }));

  const syncTime = new Date(lastSync).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <main
      className="page-with-sidebar"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}
    >
      <TopProgressBar percent={progressPct} label="Generating analysis" />

      {/* ── Header ── */}
      <header
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <WaveAccent style={{ top: -10, right: 0, opacity: 0.9, zIndex: -1 }} />
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Trade Risk Intelligence
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', boxShadow: '0 0 6px var(--safe)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Monitoring {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} across {countryCount} countr{countryCount !== 1 ? 'ies' : 'y'}
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Updated {syncTime}</span>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex' }}>
          <GlowOrb color="var(--seafoam)" size={140} blur={50} opacity={0.3} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          <button
            className="btn-accent"
            onClick={handleRunMonitor}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}
          >
            <RefreshCw size={ICON_SIZE} strokeWidth={ICON_STROKE} style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }} />
            {isRunning ? 'Analyzing…' : 'Run Analysis'}
          </button>
        </div>
      </header>

      {/* ── Stat row — faint starfield echo in the surrounding gutters so the
            globe's space/ocean texture feels continuous with the rest of the
            canvas, instead of being isolated inside one box ── */}
      <div
        style={{
          padding: '20px 32px 0',
          flexShrink: 0,
          backgroundImage:
            'radial-gradient(1px 1px at 6% 15%, rgba(232,226,216,0.4), transparent),' +
            'radial-gradient(1px 1px at 96% 80%, rgba(132,215,216,0.35), transparent),' +
            'radial-gradient(1px 1px at 50% 90%, rgba(232,226,216,0.3), transparent)',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <MetricCard
            hero
            label="Trade Exposure"
            value={fmtMoney(totalExposure)}
            sub={`${active.length} active event${active.length !== 1 ? 's' : ''}`}
            icon={DollarSign}
            accent={totalExposure > 0 ? 'var(--critical)' : undefined}
          />
          <MetricCard
            label="Proposed Suppliers"
            value={proposedSuppliersCount}
            sub="before compliance review"
            icon={Users}
            accent={proposedSuppliersCount > 0 ? 'var(--seafoam)' : undefined}
          />
          <MetricCard
            label="Critical Events"
            value={criticalEvents}
            sub={`${active.length} active event${active.length !== 1 ? 's' : ''}`}
            icon={AlertTriangle}
            accent={criticalEvents > 0 ? 'var(--warning)' : undefined}
          />
          <MetricCard
            label="Countries Monitored"
            value={countryCount}
            sub={`${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}
            icon={MapPin}
            accent={countryCount > 0 ? 'var(--safe)' : undefined}
          />
        </div>
      </div>

      {/* ── Main body: globe + right rail ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 16,
          padding: '20px 32px',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <GlowOrb color="var(--seafoam)" size={320} blur={90} opacity={0.22} style={{ top: -60, left: '28%' }} />
        {/* Globe */}
        <div
          style={{
            position: 'relative',
            minHeight: 0,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border-soft)',
            background: 'var(--card)',
          }}
        >
          <TradeGlobe
            suppliers={tradeGlobeSuppliers}
            disruptions={disruptions}
            hqLocation={hqLocation}
            alternateSuppliers={alternateSuppliers}
          />
        </div>

        {/* Right rail — live agent reasoning (frosted glass over the mesh background) */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border-soft)',
            background: 'rgba(40, 82, 96, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <Activity size={ICON_SIZE} strokeWidth={ICON_STROKE} color="var(--seafoam)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Live Agent Results</span>
            {critical > 0 && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--critical)', fontWeight: 600 }}>
                <AlertTriangle size={13} />
                {critical} critical
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minHeight: 0 }}>
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

      {/* ── Ticker ── */}
      <div style={{ height: 52, flexShrink: 0 }}>
        <NewsTicker lastRunAt={lastRunAt} />
      </div>
    </main>
  );
};
