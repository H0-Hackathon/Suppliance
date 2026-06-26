import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Building2,
  Settings,
  Globe,
} from 'lucide-react';
import { Logo } from './common/Logo';

const NAV_ITEMS = [
  { label: 'Dashboard',   path: '/dashboard', icon: LayoutDashboard },
  { label: 'Past Events', path: '/alerts',    icon: Bell },
  { label: 'Suppliers',   path: '/suppliers', icon: Building2 },
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
    dbStatus === 'ok' ? '#5BA86F' :
    dbStatus === 'error' ? '#E24B4A' : '#E0A23B';

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0,
      width: 'var(--sidebar-w, 224px)',
      height: '100vh',
      background: 'var(--card)',
      borderRight: '1px solid var(--border-soft)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      {/* Brand */}
      <div
        style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid var(--border-soft)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <Logo size={32} withWordmark />
      </div>

      {/* System status bar */}
      <div style={{
        margin: '10px 12px 2px',
        background: dbStatus === 'ok' ? 'rgba(91,168,111,0.08)' : 'rgba(226,75,74,0.08)',
        border: `1px solid ${dbStatus === 'ok' ? 'rgba(91,168,111,0.15)' : 'rgba(226,75,74,0.15)'}`,
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
          fontSize: 10, color: 'var(--text-secondary)',
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
          color: 'var(--text-secondary)', textTransform: 'uppercase',
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
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--foreground)' : 'var(--text-secondary)',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(84,140,146,0.14) 0%, rgba(84,140,146,0.04) 100%)'
                  : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease-out',
                borderLeft: isActive ? '2px solid var(--dusty-teal)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(84,140,146,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-soft)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
          Suppliance v0.1.0
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2 }}>
          Trade Risk Intelligence Platform
        </div>
      </div>
    </aside>
  );
};
