import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  History,
  Building2,
  Settings,
  CreditCard,
} from 'lucide-react';
import { UserButton, useAuth } from '@clerk/clerk-react';
import { Logo } from './common/Logo';
import { ICON_SIZE, ICON_STROKE } from './common/iconDefaults';

// Nav label/path note: "Past Events" intentionally keeps the legacy /alerts
// route path so existing links/history don't break.
const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'Suppliers',    path: '/suppliers',    icon: Building2 },
  { label: 'Past Events',  path: '/alerts',       icon: History },
  { label: 'Subscription', path: '/subscription', icon: CreditCard },
  { label: 'Settings',     path: '/settings',     icon: Settings },
];

type DbStatus = 'checking' | 'ok' | 'error';

export const CommonHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((data) => setDbStatus(data?.database?.status === 'ok' ? 'ok' : 'error'))
        .catch(() => setDbStatus('error'));
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      const token = await getToken();
      if (!token) return;
      fetch('/api/v2/alerts', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          const alerts = Array.isArray(data) ? data : (data?.items ?? []);
          setAlertCount(alerts.length);
        })
        .catch(() => {});
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(id);
  }, []);

  const statusColor =
    dbStatus === 'ok' ? 'var(--safe)' : dbStatus === 'error' ? 'var(--critical)' : 'var(--warning)';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 'var(--sidebar-w)',
        height: '100vh',
        background: 'var(--teal-navy)',
        borderRight: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Faint nautical-chart wave etching, anchored to the bottom of the
          sidebar — pure texture, never competes with nav content above it. */}
      <svg
        width="248"
        height="180"
        viewBox="0 0 248 180"
        style={{ position: 'absolute', bottom: -20, left: 0, pointerEvents: 'none', opacity: 0.06, zIndex: -1 }}
        aria-hidden="true"
      >
        <g stroke="#fff" strokeLinecap="round" fill="none">
          <path d="M-10 40 q31 -22 62 0 t62 0 t62 0 t62 0" strokeWidth="1.4" />
          <path d="M-10 75 q27 -19 54 0 t54 0 t54 0 t54 0 t54 0" strokeWidth="1.2" />
          <path d="M-10 110 q23 -16 46 0 t46 0 t46 0 t46 0 t46 0 t46 0" strokeWidth="1" />
          <path d="M-10 145 q19 -13 38 0 t38 0 t38 0 t38 0 t38 0 t38 0 t38 0" strokeWidth="0.8" />
        </g>
      </svg>

      {/* Brand */}
      <div
        style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-soft)' }}
        onClick={() => navigate('/dashboard')}
      >
        <Logo size={36} onClick={() => navigate('/dashboard')} />
      </div>

      {/* System status */}
      <div
        style={{
          margin: '14px 16px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}`,
            flexShrink: 0,
            animation: dbStatus === 'ok' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }}
        />
        {dbStatus === 'checking' && 'Connecting…'}
        {dbStatus === 'ok' && 'All systems operational'}
        {dbStatus === 'error' && 'Service offline'}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            padding: '12px 12px 8px',
          }}
        >
          Platform
        </div>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive =
            location.pathname === path || (path === '/dashboard' && location.pathname === '/');
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--foreground)' : 'var(--text-muted)',
                background: isActive ? 'rgba(132,215,216,0.12)' : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.18s ease-out, color 0.18s ease-out',
                boxShadow: isActive ? 'inset 2px 0 0 var(--seafoam)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(232,226,216,0.05)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} style={{ flexShrink: 0 }} />
              {label}
              {label === 'Past Events' && alertCount !== null && alertCount > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '1px 7px',
                    minWidth: 18,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <UserButton afterSignOutUrl="/sign-in" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Suppliance</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            Trade Risk Intelligence
          </div>
        </div>
      </div>
    </aside>
  );
};
