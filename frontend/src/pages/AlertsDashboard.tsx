import React from 'react';
import {
  RefreshCw,
  Globe,
  AlertTriangle,
  Layers,
  DollarSign,
  ShieldAlert,
  Zap,
  Map,
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
    value: '$420,000',
    subtext: '+34% vs last quarter',
    icon: DollarSign,
    color: '#d97706',
    dimColor: 'rgba(217,119,6,0.1)',
    borderColor: 'rgba(217,119,6,0.2)',
    trend: 'up',
  },
  {
    label: 'High Risk Suppliers',
    value: '4',
    subtext: '2 critical, 2 elevated',
    icon: ShieldAlert,
    color: '#dc2626',
    dimColor: 'rgba(220,38,38,0.1)',
    borderColor: 'rgba(220,38,38,0.2)',
    trend: 'up',
  },
  {
    label: 'Critical Trade Events',
    value: '2',
    subtext: 'Tariff + factory suspension',
    icon: Zap,
    color: '#ea580c',
    dimColor: 'rgba(234,88,12,0.1)',
    borderColor: 'rgba(234,88,12,0.2)',
    trend: 'up',
  },
  {
    label: 'Countries Monitored',
    value: '18',
    subtext: '6 with active risk flags',
    icon: Globe,
    color: '#10b981',
    dimColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.18)',
    trend: 'stable',
  },
];

const MAP_LAYERS = [
  { id: 'suppliers',   label: 'Suppliers',        color: '#10b981' },
  { id: 'routes',      label: 'Exposure Routes',  color: '#d97706' },
  { id: 'risk',        label: 'Risk Zones',        color: '#dc2626' },
  { id: 'alt',         label: 'Alt. Suppliers',    color: '#0d9488' },
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
      // backend offline — demo data shown
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

  const active   = alerts.filter((a) => a.status === 'active');
  const critical = active.filter((a) => a.severity === 'critical').length;
  const high     = active.filter((a) => a.severity === 'high').length;

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
      {/* ── Top Header ── */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(245,158,11,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(14,12,10,0.95)',
        backdropFilter: 'blur(12px)',
      }}>
        <div>
          <h1 style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#f5f0e8',
            letterSpacing: '-0.3px',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            Trade Exposure Intelligence
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            fontSize: 11, color: 'rgba(120,113,108,0.8)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 5px #10b981',
                display: 'inline-block',
                animation: 'pulse-dot 2.5s ease-in-out infinite',
              }} />
              Monitoring 24 suppliers across 18 countries
            </span>
            <span style={{ color: 'rgba(120,113,108,0.3)' }}>|</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: 'rgba(120,113,108,0.6)',
            }}>
              Updated {syncTime}
            </span>
            {critical > 0 && (
              <>
                <span style={{ color: 'rgba(120,113,108,0.3)' }}>|</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#dc2626', fontWeight: 600,
                }}>
                  <AlertTriangle size={11} />
                  {critical} critical
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.18)',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 10, color: '#6ee7b7', fontWeight: 600,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#10b981',
              animation: 'pulse-dot 2.5s ease-in-out infinite',
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
              size={11}
              style={{ animation: isRunning ? 'spin 1s linear infinite' : 'none' }}
            />
            {isRunning ? 'Scanning…' : 'Run Monitor'}
          </button>
        </div>
      </div>

      {/* ── Intelligence KPI Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        background: 'rgba(245,158,11,0.06)',
        borderBottom: '1px solid rgba(245,158,11,0.08)',
        flexShrink: 0,
      }}>
        {INTEL_CARDS.map(({ label, value, subtext, icon: Icon, color, dimColor, borderColor }) => (
          <div key={label} style={{
            background: 'var(--bg-warm)',
            padding: '12px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: dimColor,
              border: `1px solid ${borderColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(120,113,108,0.7)',
                marginBottom: 2,
              }}>
                {label}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 800,
                color,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1, marginBottom: 2,
              }}>
                {value}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(120,113,108,0.6)' }}>
                {subtext}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 268px',
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
          {/* Map */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <TradeGlobe disruptions={disruptions} />

            {/* Layer toggles */}
            <div style={{
              position: 'absolute',
              top: 12, right: 12,
              background: 'rgba(14,12,10,0.88)',
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
                color: 'rgba(120,113,108,0.7)',
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
                      background: on ? layer.color : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${on ? layer.color : 'rgba(255,255,255,0.08)'}`,
                      transition: 'background 0.15s',
                    }} />
                    <span style={{
                      fontSize: 10,
                      color: on ? '#f5f0e8' : 'rgba(120,113,108,0.6)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Bottom: Trade Intelligence Feed ── */}
          <div style={{ height: 52, flexShrink: 0, borderTop: '1px solid rgba(245,158,11,0.07)' }}>
            <EventFeed />
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{
          borderLeft: '1px solid rgba(245,158,11,0.08)',
          background: 'var(--bg-warm)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Risk summary */}
          {(critical > 0 || high > 0) && (
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(245,158,11,0.07)',
              flexShrink: 0,
              display: 'flex', gap: 6,
            }}>
              {critical > 0 && (
                <div style={{
                  flex: 1, textAlign: 'center',
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.2)',
                  borderRadius: 6, padding: '7px 6px',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{critical}</div>
                  <div style={{ fontSize: 9, color: 'rgba(220,38,38,0.6)', marginTop: 2, letterSpacing: '0.06em' }}>CRITICAL</div>
                </div>
              )}
              {high > 0 && (
                <div style={{
                  flex: 1, textAlign: 'center',
                  background: 'rgba(234,88,12,0.08)',
                  border: '1px solid rgba(234,88,12,0.2)',
                  borderRadius: 6, padding: '7px 6px',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ea580c', lineHeight: 1 }}>{high}</div>
                  <div style={{ fontSize: 9, color: 'rgba(234,88,12,0.6)', marginTop: 2, letterSpacing: '0.06em' }}>HIGH</div>
                </div>
              )}
            </div>
          )}

          {/* Intelligence Pipeline (AgentStatusPanel) */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 14px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(245,158,11,0.1) transparent',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(120,113,108,0.6)',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Map size={9} />
              Intelligence Pipeline
            </div>
            <AgentStatusPanel />
          </div>
        </div>
      </div>
    </main>
  );
};
