import React from 'react';
import {
  RefreshCw,
  Globe,
  Truck,
  Anchor,
  AlertTriangle,
  Navigation,
  Layers,
} from 'lucide-react';
import { TradeGlobe, DisruptionPoint } from '../components/TradeGlobe';
import { AgentStatusPanel } from '../components/dashboard/AgentStatusPanel';
import { EventFeed } from '../components/dashboard/EventFeed';
import api from '../services/api';

const CUSTOMER_ID = 1;
const DEMO_HS_CODE = '6109.10';
const DEMO_SUPPLIER_COUNTRY = 'VN';

interface ApiAlert {
  id: number;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

const OVERVIEW_STATS = [
  { label: 'Monitored Suppliers', value: '24', icon: Truck, color: '#38bdf8' },
  { label: 'Active Orders',       value: '127', icon: Anchor, color: '#a78bfa' },
  { label: 'Countries Covered',   value: '18', icon: Globe, color: '#34d399' },
  { label: 'Trade Routes',        value: '43', icon: Navigation, color: '#f59e0b' },
];

const MAP_LAYERS = [
  { id: 'suppliers',   label: 'Suppliers',          color: '#34d399' },
  { id: 'routes',      label: 'Trade Routes',       color: '#38bdf8' },
  { id: 'ports',       label: 'Ports',              color: '#a78bfa' },
  { id: 'risk',        label: 'Risk Zones',         color: '#ef4444' },
  { id: 'alt',         label: 'Alt. Suppliers',     color: '#f59e0b' },
];

export const AlertsDashboard: React.FC = () => {
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'ports', 'risk'])
  );
  const [lastSync] = React.useState(() => new Date().toISOString());

  async function fetchAll() {
    try {
      const [alertsRes, disruptionsRes] = await Promise.all([
        api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: CUSTOMER_ID } }),
        api.get<DisruptionPoint[]>('/v2/disruptions', { params: { customer_id: CUSTOMER_ID } }),
      ]);
      setAlerts(alertsRes.data);
      setDisruptions(disruptionsRes.data);
    } catch {
      // backend offline — use demo data
    }
  }

  React.useEffect(() => { fetchAll(); }, []);

  async function handleRunMonitor() {
    setIsRunning(true);
    try {
      await api.post('/v2/monitor/run', {
        customer_id: CUSTOMER_ID,
        hs_code: DEMO_HS_CODE,
        supplier_country: DEMO_SUPPLIER_COUNTRY,
      });
      await fetchAll();
    } catch {
      // ignore
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

  const active = alerts.filter((a) => a.status === 'active');
  const critical = active.filter((a) => a.severity === 'critical').length;
  const high = active.filter((a) => a.severity === 'high').length;

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
        padding: '14px 24px',
        borderBottom: '1px solid rgba(56,189,248,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(8,14,28,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <div>
          <h1 style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#f1f5f9',
            letterSpacing: '-0.3px',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            Global Supply Chain Intelligence
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'rgba(100,116,139,0.9)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 5px #22c55e',
                display: 'inline-block',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Monitoring 24 suppliers across 18 countries
            </span>
            <span>|</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
              Last sync: {syncTime}
            </span>
            {critical > 0 && (
              <>
                <span>|</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#ef4444', fontWeight: 600,
                }}>
                  <AlertTriangle size={11} />
                  {critical} critical alert{critical !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* System health */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 10,
            color: '#86efac',
            fontWeight: 600,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
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
            {isRunning ? 'Scanning…' : 'Run Monitor'}
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 272px',
        gridTemplateRows: '1fr',
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
            <TradeGlobe disruptions={disruptions} />

            {/* Map layer toggles overlay */}
            <div style={{
              position: 'absolute',
              top: 14, right: 14,
              background: 'rgba(8,14,28,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(56,189,248,0.12)',
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
                color: 'rgba(100,116,139,0.8)',
                display: 'flex', alignItems: 'center', gap: 5,
                marginBottom: 2,
              }}>
                <Layers size={9} />
                Layers
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
                      background: on ? layer.color : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${on ? layer.color : 'rgba(255,255,255,0.1)'}`,
                      transition: 'background 0.15s',
                    }} />
                    <span style={{
                      fontSize: 10, color: on ? '#e2e8f0' : 'rgba(100,116,139,0.7)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Bottom: Event Feed ── */}
          <div style={{ height: 52, flexShrink: 0, borderTop: '1px solid rgba(56,189,248,0.08)' }}>
            <EventFeed />
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{
          borderLeft: '1px solid rgba(56,189,248,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'hidden',
        }}>
          {/* Supply Chain Overview */}
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(56,189,248,0.08)',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(100,116,139,0.7)',
              marginBottom: 10,
            }}>
              Supply Chain Overview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {OVERVIEW_STATS.map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{
                  background: 'rgba(13,21,40,0.8)',
                  border: '1px solid rgba(56,189,248,0.08)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Icon size={11} color={color} />
                    <span style={{ fontSize: 9, color: 'rgba(100,116,139,0.8)' }}>{label}</span>
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    color, fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Alert counts */}
            {(critical > 0 || high > 0) && (
              <div style={{
                marginTop: 8,
                display: 'flex', gap: 6,
              }}>
                {critical > 0 && (
                  <div style={{
                    flex: 1, textAlign: 'center',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 6, padding: '6px',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>{critical}</div>
                    <div style={{ fontSize: 9, color: 'rgba(239,68,68,0.7)', marginTop: 2 }}>CRITICAL</div>
                  </div>
                )}
                {high > 0 && (
                  <div style={{
                    flex: 1, textAlign: 'center',
                    background: 'rgba(249,115,22,0.08)',
                    border: '1px solid rgba(249,115,22,0.2)',
                    borderRadius: 6, padding: '6px',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f97316', lineHeight: 1 }}>{high}</div>
                    <div style={{ fontSize: 9, color: 'rgba(249,115,22,0.7)', marginTop: 2 }}>HIGH</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Agent Status Panel */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 14px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(56,189,248,0.1) transparent',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(100,116,139,0.7)',
              marginBottom: 10,
            }}>
              Intelligence Agents
            </div>
            <AgentStatusPanel />
          </div>
        </div>
      </div>
    </main>
  );
};
