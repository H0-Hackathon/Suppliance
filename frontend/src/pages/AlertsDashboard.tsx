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
  const [disruptions, setDisruptions] = React.useState<DisruptionPoint[]>([]);
  const [alerts, setAlerts] = React.useState<ApiAlert[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeLayers, setActiveLayers] = React.useState<Set<string>>(
    new Set(['suppliers', 'routes', 'risk'])
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
              Monitoring 24 suppliers across 18 countries
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
            <TradeGlobe disruptions={disruptions} />

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
                Total Exposure at Risk
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                $420,000
              </div>
              <div style={{ fontSize: 9, color: 'rgba(220,38,38,0.7)', marginTop: 3 }}>
                +$40K from today&apos;s tariff ruling
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

          {/* Intelligence Pipeline */}
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
              Analysis Pipeline
            </div>
            <AgentStatusPanel />
          </div>
        </div>
      </div>
    </main>
  );
};
