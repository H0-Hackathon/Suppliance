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
    dbStatus === 'ok' ? '#22c55e' :
    dbStatus === 'error' ? '#ef4444' : '#f59e0b';

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0,
      width: 'var(--sidebar-w, 220px)',
      height: '100vh',
      background: 'linear-gradient(180deg, #080e1c 0%, #0b1220 100%)',
      borderRight: '1px solid rgba(56,189,248,0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      {/* Brand */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(56,189,248,0.08)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Anchor size={16} color="#38bdf8" />
          </div>
          <div>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 800,
              color: '#f1f5f9',
              letterSpacing: '-0.3px',
              lineHeight: 1,
            }}>
              Coast<span style={{ color: '#38bdf8' }}>Guard</span>
            </div>
            <div style={{
              fontSize: 9,
              color: 'rgba(148,163,184,0.6)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 500,
              marginTop: 2,
            }}>
              Supply Chain Intel
            </div>
          </div>
        </div>
      </div>

      {/* System status bar */}
      <div style={{
        margin: '12px 12px 4px',
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 6,
        padding: '6px 10px',
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
          fontSize: 10, color: 'rgba(148,163,184,0.8)',
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
        <Activity size={10} color={statusColor} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: 'rgba(100,116,139,0.7)', textTransform: 'uppercase',
          padding: '8px 10px 4px',
        }}>
          Navigation
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
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#e2e8f0' : 'rgba(148,163,184,0.6)',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 100%)'
                  : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(56,189,248,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(226,232,240,0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.6)';
                }
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {label}
              {label === 'Alerts' && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#ef4444',
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
        borderTop: '1px solid rgba(56,189,248,0.08)',
      }}>
        <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', fontFamily: 'JetBrains Mono, monospace' }}>
          CoastGuard v0.1.0
        </div>
        <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.35)', marginTop: 2 }}>
          © 2025 CoastGuard Intel
        </div>
      </div>
    </aside>
  );
};
