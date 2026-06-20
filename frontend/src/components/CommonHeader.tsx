import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Building2,
  ShieldCheck,
  Settings,
  Anchor,
  Globe,
  LogOut,
  CreditCard,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'Alerts',       path: '/alerts',       icon: Bell },
  { label: 'Suppliers',    path: '/suppliers',    icon: Building2 },
  { label: 'Compliance',   path: '/compliance',   icon: ShieldCheck },
  { label: 'Subscription', path: '/subscription', icon: CreditCard },
  { label: 'Settings',     path: '/settings',     icon: Settings },
];

const ACTIVE_CUSTOMER_ID = 69;

type DbStatus = 'checking' | 'ok' | 'error';

export const CommonHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, subscription } = useAuth() as any;
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbBackend, setDbBackend] = useState<string>('');
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [proposedSuppliers, setProposedSuppliers] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');

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

  useEffect(() => {
    const fetchAlerts = () => {
      fetch(`/api/v2/alerts?customer_id=${ACTIVE_CUSTOMER_ID}`)
        .then((r) => r.json())
        .then((data) => {
          const alerts = Array.isArray(data) ? data : (data?.items ?? []);
          setAlertCount(alerts.length);
          // Count proposed alternatives from most recent alert (before compliance narrows to 1)
          const latest = alerts[0];
          if (latest?.agent_output) {
            try {
              const ao = typeof latest.agent_output === 'string'
                ? JSON.parse(latest.agent_output)
                : latest.agent_output;
              const opts = ao?.alternatives_finder?.options ?? ao?.alternatives_finder?.alternatives ?? [];
              if (opts.length > 0) setProposedSuppliers(opts.length);
            } catch { /* ignore */ }
          }
        })
        .catch(() => {});
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(id);
  }, []);

  // Live HH:MM:SS countdown for trial
  useEffect(() => {
    if (!subscription?.expires_at) return;

    const tick = () => {
      const now = Date.now();
      const end = new Date(subscription.expires_at).getTime();
      const diff = Math.max(0, end - now);

      if (diff === 0) {
        setCountdown('00:00:00');
        return;
      }

      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [subscription?.expires_at]);

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
              {label === 'Alerts' && alertCount !== null && alertCount > 0 && (
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
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Subscription / Trial countdown widget */}
      {subscription && (
        <div
          style={{
            margin: '6px 10px 0',
            borderRadius: 8,
            overflow: 'hidden',
            border: `1px solid ${
              subscription.status === 'active'
                ? 'rgba(16,185,129,0.2)'
                : subscription.status === 'trial'
                ? 'rgba(245,158,11,0.2)'
                : 'rgba(239,68,68,0.3)'
            }`,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/subscription')}
        >
          {/* Top label row */}
          <div style={{
            padding: '5px 10px',
            background: subscription.status === 'active'
              ? 'rgba(16,185,129,0.1)'
              : subscription.status === 'trial'
              ? 'rgba(245,158,11,0.1)'
              : 'rgba(239,68,68,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: subscription.status === 'active'
                ? '#10b981'
                : subscription.status === 'trial'
                ? '#f59e0b'
                : '#ef4444',
            }}>
              {subscription.status === 'active'
                ? `✓ ${(subscription.plan || '').toUpperCase()} PLAN`
                : subscription.status === 'trial'
                ? '⏱ FREE TRIAL'
                : '⚠ TRIAL EXPIRED'}
            </span>
            <span style={{
              fontSize: 8,
              color: 'rgba(255,255,255,0.3)',
              textDecoration: 'underline',
              letterSpacing: '0.05em',
            }}>
              {subscription.status === 'expired' ? 'UPGRADE →' : 'PLANS →'}
            </span>
          </div>

          {/* Countdown row — only shown during trial */}
          {subscription.status === 'trial' && countdown && (
            <div style={{
              padding: '6px 10px 7px',
              background: 'rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 18,
                fontWeight: 700,
                color: '#F59E0B',
                letterSpacing: '0.06em',
                lineHeight: 1,
              }}>
                {countdown}
              </div>
              <div style={{
                fontSize: 8,
                color: 'rgba(255,255,255,0.25)',
                marginTop: 3,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                remaining
              </div>
            </div>
          )}

          {/* Active plan — show expiry if set */}
          {subscription.status === 'active' && subscription.expires_at && (
            <div style={{
              padding: '4px 10px 5px',
              background: 'rgba(0,0,0,0.15)',
              textAlign: 'center',
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
            }}>
              Renews {new Date(subscription.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Contact Us */}
      <div style={{
        margin: '6px 10px 0',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>✉️</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Contact Us
          </span>
        </div>

        {/* Contact links */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <a
            href="mailto:billing@coastguard.ai"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 11, color: '#F59E0B', textDecoration: 'none',
              fontWeight: 600, lineHeight: 1.3,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span style={{ fontSize: 12 }}>📧</span>
            billing@coastguard.ai
          </a>
          <a
            href="mailto:support@coastguard.ai?subject=CoastGuard Support"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
              lineHeight: 1.3, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          >
            <span style={{ fontSize: 12 }}>💬</span>
            Get Support
          </a>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div style={{
          padding: '10px 16px 12px',
          borderTop: '1px solid rgba(245,158,11,0.07)',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#0e0e10',
            fontFamily: 'Inter, sans-serif',
          }}>
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#e8e3d8', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name || user.email || 'User'}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(160,150,120,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(160,150,120,0.55)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(160,150,120,0.55)')}
          >
            <LogOut size={15} />
          </button>
        </div>
      )}

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
