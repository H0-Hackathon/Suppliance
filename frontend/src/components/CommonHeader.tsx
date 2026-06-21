import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, Building2, Play, Anchor } from 'lucide-react';

/**
 * CoastGuard — Fixed vertical sidebar navigation.
 *
 * 240px wide, always visible on the left.
 * No auth required — all nav items are always visible.
 * Phase 2 will add a "Suppliers" management page.
 */

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Alerts',    path: '/dashboard', icon: Bell },        // same page, filter TBD
  { label: 'Suppliers', path: '/dashboard', icon: Building2 },   // Phase 2
  { label: 'Demo',      path: '/demo',      icon: Play },
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

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 'var(--sidebar-w, 240px)',
        height: '100vh',
        background: 'var(--primary, #1E3A5F)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '28px 24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Anchor size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 18,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.5px',
            }}
          >
            Coast<span style={{ color: '#F59E0B' }}>Guard</span>
          </span>
        </div>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            marginTop: 4,
            fontWeight: 400,
          }}
        >
          Supply Chain Monitor
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path && label !== 'Suppliers';
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
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)';
                }
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer — DB status indicator */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* pulse dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor:
                dbStatus === 'ok' ? '#22c55e' :
                dbStatus === 'error' ? '#ef4444' : '#f59e0b',
              boxShadow:
                dbStatus === 'ok' ? '0 0 0 2px rgba(34,197,94,0.3)' :
                dbStatus === 'error' ? '0 0 0 2px rgba(239,68,68,0.3)' :
                '0 0 0 2px rgba(245,158,11,0.3)',
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
            {dbStatus === 'checking' && 'Connecting to DB…'}
            {dbStatus === 'ok' && `DB: ${dbBackend}`}
            {dbStatus === 'error' && 'DB: unreachable'}
          </span>
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter, sans-serif', margin: 0 }}>
          CoastGuard v0.1.0
        </p>
      </div>
    </aside>
  );
};
