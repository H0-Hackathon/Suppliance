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
import { LiveAgentResults, AgentResults, AgentStatusMap } from '../components/dashboard/LiveAgentResults';
import { useAlternativeCoords } from '../hooks/useAlternativeCoords';
import { AGENT_CHAIN } from '../types/agents';
import type { VisualizationMode } from '../types/globe';
import api from '../services/api';

const CUSTOMER_ID = 1;
const DEMO_HS_CODE = '6109.10';
const DEMO_SUPPLIER_COUNTRY = 'VN';

interface ApiSupplier {
  id: number;
  name: string;
  country: string;
  product_category: string | null;
  reliability_score: number;
  is_active: boolean;
}

interface SupplierWithGeo extends ApiSupplier {
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
}

const MAP_LAYERS = [
  { id: 'suppliers', label: 'Suppliers', color: '#10b981' },
  { id: 'routes', label: 'Exposure Routes', color: '#f59e0b' },
  { id: 'risk', label: 'Risk Zones', color: '#dc2626' },
  { id: 'alt', label: 'Alternatives', color: '#14b8a6' },
];

const VISUALIZATION_MODES: { id: VisualizationMode; label: string; description: string }[] = [
  { id: 'executive', label: 'Executive View', description: 'Final recommendation & key suppliers' },
  { id: 'supply_chain', label: 'Supply Chain View', description: 'All suppliers, routes & relationships' },
  { id: 'ai_reasoning', label: 'AI Reasoning View', description: 'Step-by-step agent decision flow' },
  { id: 'risk_heatmap', label: 'Risk Heatmap View', description: 'Global risk concentrations' },
];

async function revealAgentsStaged(
  outputs: AgentResults,
  onStep: (key: string, output: Record<string, unknown>, status: 'running' | 'done') => void,
  delayMs = 700,
) {
  for (const key of AGENT_CHAIN) {
    const output = outputs[key];
    if (!output) continue;
    onStep(key, output, 'running');
    await new Promise((r) => setTimeout(r, delayMs));
    onStep(key, output, 'done');
  }
}

export const AlertsDashboard: React.FC = () => {
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierWithGeo[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'risk', 'alt']),
  );
  const [visualizationMode, setVisualizationMode] = React.useState<VisualizationMode>('ai_reasoning');
  const [agentResults, setAgentResults] = React.useState<AgentResults>({});
  const [agentStatus, setAgentStatus] = React.useState<AgentStatusMap>({});
  const [agentsUpdatedAt, setAgentsUpdatedAt] = React.useState<string | null>(null);

  async function fetchDisruptions() {
    const res = await api.get<DisruptionPoint[]>('/v2/disruptions', { params: { customer_id: CUSTOMER_ID } });
    setDisruptions(res.data);
  }

  async function fetchSuppliers() {
    const res = await api.get<ApiSupplier[]>('/v2/suppliers', { params: { customer_id: CUSTOMER_ID } });
    const withGeo = await Promise.all(
      res.data.map(async (s): Promise<SupplierWithGeo> => {
        try {
          const geo = await api.get<{ country: string; code: string | null; latitude: number; longitude: number }>(
            '/v2/geo/supplier-coords',
            { params: { country: s.country } },
          );
          return { ...s, latitude: geo.data.latitude, longitude: geo.data.longitude, countryCode: geo.data.code };
        } catch {
          return { ...s, latitude: null, longitude: null, countryCode: null };
        }
      }),
    );
    setSuppliers(withGeo);
  }

  React.useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchDisruptions(), fetchSuppliers()]);
        const alertsRes = await api.get<Array<{ agent_output: string | null; created_at: string }>>(
          '/v2/alerts',
          { params: { customer_id: CUSTOMER_ID } },
        );
        for (const alert of alertsRes.data) {
          if (!alert.agent_output) continue;
          try {
            const parsed = JSON.parse(alert.agent_output) as AgentResults;
            if (parsed.tariff_monitor || parsed.impact_calculator) {
              setAgentResults(parsed);
              setAgentsUpdatedAt(alert.created_at);
              const status: AgentStatusMap = {};
              AGENT_CHAIN.forEach((k) => {
                if (parsed[k]) status[k] = 'done';
              });
              setAgentStatus(status);
              break;
            }
          } catch {
            // skip invalid JSON
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      }
    })();
  }, []);

  async function handleRunMonitor() {
    setIsRunning(true);
    setAgentResults({});
    setAgentStatus({});

    try {
      const res = await api.post<{ agent_outputs: AgentResults }>('/v2/monitor/run', {
        customer_id: CUSTOMER_ID,
        hs_code: DEMO_HS_CODE,
        supplier_country: DEMO_SUPPLIER_COUNTRY,
      });

      const outputs = res.data.agent_outputs ?? {};
      await revealAgentsStaged(outputs, (key, output, status) => {
        if (status === 'running') {
          setAgentStatus((prev) => ({ ...prev, [key]: 'running' }));
        } else {
          setAgentResults((prev) => ({ ...prev, [key]: output }));
          setAgentStatus((prev) => ({ ...prev, [key]: 'done' }));
          setAgentsUpdatedAt(new Date().toISOString());
        }
      });

      await Promise.all([fetchDisruptions(), fetchSuppliers()]);
    } catch (err) {
      console.error('Run Monitor failed', err);
    } finally {
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

  const tradeGlobeSuppliers: TradeGlobeSupplier[] = suppliers
    .filter((s): s is SupplierWithGeo & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({
      name: s.name,
      country: s.country,
      countryCode: s.countryCode,
      latitude: s.latitude,
      longitude: s.longitude,
    }));

  const supplierCountries = suppliers.map((s) => s.country).filter(Boolean);
  const alternativeCoords = useAlternativeCoords(agentResults, supplierCountries);

  const agentImpact = agentResults.impact_calculator;
  const agentMonitor = agentResults.tariff_monitor;
  const exposureValue = (agentImpact?.direct_cost ?? agentImpact?.extra_cost_usd) as number | null | undefined;
  const countryCount = new Set(suppliers.map((s) => s.country)).size;
  const impactedCount = tradeGlobeSuppliers.filter((s) =>
    disruptions.some((d) => (d.countries_affected ?? []).some((c) => c === s.countryCode || c === s.country)),
  ).length;

  return (
    <main className="page-with-sidebar" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(245,158,11,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(14,14,10,0.95)',
      }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#e8e3d8', marginBottom: 4 }}>
            Trade Risk Intelligence
          </h1>
          <div style={{ fontSize: 11, color: 'rgba(130,120,90,0.8)' }}>
            Monitoring {suppliers.length} suppliers across {countryCount} countries
            {impactedCount > 0 && (
              <span style={{ color: '#dc2626', marginLeft: 8 }}>· {impactedCount} at risk</span>
            )}
          </div>
        </div>
        <button
          className="btn-accent"
          onClick={handleRunMonitor}
          disabled={isRunning}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          <RefreshCw size={12} style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }} />
          {isRunning ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 276px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <TradeGlobe
              suppliers={tradeGlobeSuppliers}
              disruptions={disruptions}
              agentResults={agentResults}
              agentStatus={agentStatus}
              alternativeCoords={alternativeCoords}
              visualizationMode={visualizationMode}
              activeLayers={activeLayers}
              supplierCountry={DEMO_SUPPLIER_COUNTRY}
            />

            <div style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(14,14,10,0.88)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(245,158,11,0.12)', borderRadius: 8,
              padding: '10px 12px', zIndex: 20, maxWidth: 200,
            }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(150,140,100,0.7)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Globe size={9} color="#38bdf8" /> Visualization Mode
                </div>
                {VISUALIZATION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setVisualizationMode(mode.id)}
                    title={mode.description}
                    style={{
                      width: '100%', textAlign: 'left', borderRadius: 5, cursor: 'pointer', padding: '5px 7px', marginBottom: 3,
                      background: visualizationMode === mode.id ? 'rgba(56,189,248,0.1)' : 'none',
                      border: visualizationMode === mode.id ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: visualizationMode === mode.id ? 700 : 500, color: visualizationMode === mode.id ? '#7dd3fc' : 'rgba(130,120,90,0.75)' }}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', paddingTop: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(150,140,100,0.7)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Layers size={9} color="#f59e0b" /> Map Layers
                </div>
                {MAP_LAYERS.map((layer) => {
                  const on = activeLayers.has(layer.id);
                  return (
                    <button key={layer.id} onClick={() => toggleLayer(layer.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', width: '100%' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: on ? layer.color : 'rgba(255,255,255,0.06)', border: `1px solid ${on ? layer.color : 'rgba(255,255,255,0.08)'}` }} />
                      <span style={{ fontSize: 10.5, color: on ? '#e8e3d8' : 'rgba(130,120,90,0.6)' }}>{layer.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{
              position: 'absolute', bottom: 14, left: 14,
              background: 'rgba(14,14,10,0.88)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '8px 14px', zIndex: 20,
            }}>
              <div style={{ fontSize: 9, color: 'rgba(150,140,100,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                Direct Cost Impact {agentImpact ? '(ImpactCalculator)' : ''}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>
                {exposureValue != null ? `$${Math.round(exposureValue).toLocaleString('en-US')}` : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(220,38,38,0.7)', marginTop: 3 }}>
                {agentMonitor?.tariff_rate != null
                  ? `${agentMonitor.tariff_rate}% tariff · ${agentMonitor.country ?? ''}`
                  : 'Run Analysis to calculate exposure'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderLeft: '1px solid rgba(245,158,11,0.08)', overflow: 'auto', background: 'rgba(14,14,10,0.5)', padding: '12px 14px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(150,140,100,0.55)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Activity size={9} color="#f59e0b" /> Live Agent Results
          </div>
          <LiveAgentResults
            agents={agentResults}
            agentStatus={agentStatus}
            updatedAt={agentsUpdatedAt}
            live={isRunning}
          />

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { label: 'Suppliers', value: String(suppliers.length), icon: Users, color: '#10b981' },
              { label: 'At Risk', value: String(impactedCount), icon: AlertTriangle, color: '#dc2626' },
              { label: 'Countries', value: String(countryCount), icon: MapPin, color: '#38bdf8' },
              { label: 'Exposure', value: exposureValue != null ? `$${Math.round(exposureValue / 1000)}K` : '—', icon: DollarSign, color: '#f59e0b' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: '10px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <Icon size={10} color={color} />
                  <span style={{ fontSize: 8.5, color: 'rgba(150,140,100,0.7)' }}>{label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
