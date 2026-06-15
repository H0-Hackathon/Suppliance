import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Building2,
  ShieldCheck,
  Settings,
  Anchor,
  Activity,
  TrendingUp,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard',   path: '/dashboard', icon: LayoutDashboard },
  { label: 'Alerts',      path: '/alerts',    icon: Bell },
  { label: 'Suppliers',   path: '/suppliers', icon: Building2 },
  { label: 'Compliance',  path: '/compliance',icon: ShieldCheck },
  { label: 'Settings',    path: '/settings',  icon: Settings },
];

type DbStatus = 'checking' | 'ok' | 'error';

export const CommonHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbBackend, setDbBackend] = useState<string>('');

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((data) => {
          if (data?.database?.status === 'ok') {
            setDbStatus('ok');
            setDbBackend(data.database.backend ?? '');
          } else {
            setDbStatus('error');
          }
        })
        .catch(() => setDbStatus('error'));
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const statusColor =
    dbStatus === 'ok'       ? '#10b981' :
    dbStatus === 'error'    ? '#dc2626' : '#ca8a04';

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0,
      width: 'var(--sidebar-w, 224px)',
      height: '100vh',
      background: 'linear-gradient(180deg, #0e0c0a 0%, #100d08 100%)',
      borderRight: '1px solid rgba(245,158,11,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      {/* Brand */}
      <div
        style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid rgba(245,158,11,0.08)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {/* Anchor logo mark with amber glow */}
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(217,119,6,0.12)',
            border: '1px solid rgba(217,119,6,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(217,119,6,0.15)',
          }}>
            <Anchor size={17} color="#d97706" />
          </div>
          <div>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              fontWeight: 800,
              color: '#f5f0e8',
              letterSpacing: '-0.4px',
              lineHeight: 1,
            }}>
              Coast<span style={{ color: '#d97706' }}>Guard</span>
            </div>
            <div style={{
              fontSize: 9,
              color: 'rgba(120,113,108,0.8)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 500,
              marginTop: 3,
            }}>
              Trade Risk Intelligence
            </div>
          </div>
        </div>

        {/* Exposure ticker */}
        <div style={{
          marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 5, padding: '4px 9px',
        }}>
          <TrendingUp size={9} color="#dc2626" />
          <span style={{
            fontSize: 9, color: '#fca5a5',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
            2 critical exposures active
          </span>
        </div>
      </div>

      {/* System status */}
      <div style={{
        margin: '10px 12px 4px',
        background: dbStatus === 'ok' ? 'rgba(16,185,129,0.06)' : 'rgba(202,138,4,0.06)',
        border: `1px solid ${dbStatus === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(202,138,4,0.15)'}`,
        borderRadius: 5,
        padding: '5px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
          flexShrink: 0,
          animation: dbStatus === 'ok' ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: 10, color: 'rgba(245,240,232,0.55)',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 500,
          flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {dbStatus === 'checking' && 'Connecting…'}
          {dbStatus === 'ok'       && `FEED: ${dbBackend || 'LIVE'}`}
          {dbStatus === 'error'    && 'FEED: OFFLINE'}
        </span>
        <Activity size={10} color={statusColor} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: 'rgba(120,113,108,0.6)', textTransform: 'uppercase',
          padding: '10px 10px 5px',
        }}>
          Platform
        </div>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path ||
            (path === '/dashboard' && location.pathname === '/');
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f5f0e8' : 'rgba(120,113,108,0.7)',
                background: isActive
                  ? 'rgba(217,119,6,0.12)'
                  : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #d97706' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.06)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(245,240,232,0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(120,113,108,0.7)';
                }
              }}
            >
              <Icon size={14} style={{ flexShrink: 0 }} />
              {label}
              {label === 'Alerts' && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: '1px 5px',
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  3
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(245,158,11,0.08)',
      }}>
        <div style={{ fontSize: 9, color: 'rgba(120,113,108,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>
          CoastGuard v0.1.0
        </div>
        <div style={{ fontSize: 9, color: 'rgba(120,113,108,0.3)', marginTop: 2 }}>
          Trade Risk Intelligence Platform
        </div>
      </div>
    </aside>
  );
};
