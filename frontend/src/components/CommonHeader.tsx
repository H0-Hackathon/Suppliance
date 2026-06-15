import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Building2,
  ShieldCheck,
  Settings,
  Anchor,
  TrendingUp,
  Globe,
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
    dbStatus === 'ok' ? '#10b981' :
    dbStatus === 'error' ? '#dc2626' : '#f59e0b';

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0,
      width: 'var(--sidebar-w, 224px)',
      height: '100vh',
      background: 'linear-gradient(180deg, #0e0e10 0%, #111108 100%)',
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
          {/* Anchor icon in warm amber ring */}
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(245,158,11,0.15)',
          }}>
            <Anchor size={17} color="#f59e0b" />
          </div>
          <div>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              fontWeight: 800,
              color: '#e8e3d8',
              letterSpacing: '-0.4px',
              lineHeight: 1,
            }}>
              Coast<span style={{ color: '#f59e0b' }}>Guard</span>
            </div>
            <div style={{
              fontSize: 9,
              color: 'rgba(180,170,140,0.55)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginTop: 3,
            }}>
              Trade Risk Intel
            </div>
          </div>
        </div>

        {/* Risk snapshot bar */}
        <div style={{
          marginTop: 10,
          background: 'rgba(220,38,38,0.07)',
          border: '1px solid rgba(220,38,38,0.15)',
          borderRadius: 6,
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}>
          <TrendingUp size={10} color="#dc2626" />
          <span style={{ fontSize: 10, color: 'rgba(220,100,100,0.9)', fontWeight: 600 }}>
            4 high-risk suppliers
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: 'rgba(220,38,38,0.6)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            LIVE
          </span>
        </div>
      </div>

      {/* System status bar */}
      <div style={{
        margin: '10px 12px 2px',
        background: dbStatus === 'ok' ? 'rgba(16,185,129,0.06)' : 'rgba(220,38,38,0.06)',
        border: `1px solid ${dbStatus === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(220,38,38,0.15)'}`,
        borderRadius: 6,
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
          animation: dbStatus === 'ok' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: 10, color: 'rgba(180,170,140,0.7)',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 500,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dbStatus === 'checking' && 'Connecting…'}
          {dbStatus === 'ok' && `SYS: ${dbBackend || 'ONLINE'}`}
          {dbStatus === 'error' && 'SYS: OFFLINE'}
        </span>
        <Globe size={10} color={statusColor} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          color: 'rgba(150,140,110,0.55)', textTransform: 'uppercase',
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
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#e8e3d8' : 'rgba(160,150,120,0.55)',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.04) 100%)'
                  : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(245,158,11,0.08)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(232,227,216,0.85)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(160,150,120,0.55)';
                }
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
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
        borderTop: '1px solid rgba(245,158,11,0.07)',
      }}>
        <div style={{ fontSize: 9, color: 'rgba(120,110,80,0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
          CoastGuard v0.1.0
        </div>
        <div style={{ fontSize: 9, color: 'rgba(120,110,80,0.35)', marginTop: 2 }}>
          Trade Risk Intelligence Platform
        </div>
      </div>
    </aside>
  );
};
