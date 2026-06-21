import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Globe, LayoutDashboard, ShieldAlert, FileText, Settings, Database, 
  Search, Bell, FileSearch, Trash2, CreditCard, Building2, ShieldCheck
} from 'lucide-react';
import { useAuth, UserButton, useUser } from '@clerk/clerk-react';

const NAV_ITEMS = [
  { label: 'Dashboards',   path: '/dashboard',    icon: LayoutDashboard },
  { label: 'Run Analysis', path: '/demo',         icon: FileSearch },
  { label: 'Alerts',       path: '/alerts',       icon: ShieldAlert },
  { label: 'Suppliers',    path: '/suppliers',    icon: Building2,        requirePro: true },
  { label: 'Compliance',   path: '/compliance',   icon: ShieldCheck },
  { label: 'Subscription', path: '/subscription', icon: CreditCard },
  { label: 'Settings',     path: '/settings',     icon: Settings },
];

<<<<<<< HEAD
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
=======
const ACTIVE_CUSTOMER_ID = 240;
>>>>>>> 0a8b967f792f8ea25c1aca56f1b1d7abdae410f5

type DbStatus = 'checking' | 'ok' | 'error';

export const CommonHeader: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbBackend, setDbBackend] = useState<string>('');
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user } = useUser();
  const { getToken } = useAuth();
  
  // Custom delete logic matching our old endpoint
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your CoastGuard account and all AI pipelines? This action cannot be undone.")) return;
    try {
      const token = await getToken();
      await fetch('/api/v2/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      // Force Clerk to sign out since the user is gone
      window.location.href = '/sign-in';
    } catch (e) {
      alert("Failed to delete account. Please try again.");
    }
  };

  useEffect(() => {
    const check = async () => {
      fetch('/api/v2/monitor/health')
        .then(r => r.json())
        .then(data => {
          if (data?.status === 'ok' || data?.database?.status === 'ok') {
            setDbStatus('ok');
            setDbBackend(data?.database?.backend ?? `v0.1 · ${data?.mock_mode ? 'Mock Mode' : 'Live'}`);
          } else {
            setDbStatus('error');
          }
        })
        .catch(() => setDbStatus('error'));

      const activeCustomerId = user?.id;
      if (activeCustomerId) {
        fetch(`/api/v2/alerts?customer_id=${activeCustomerId}`)
          .then(r => r.json())
          .then(d => {
            const num = (d || []).filter((a: any) => a.status === 'active').length;
            setAlertCount(num);
          })
          .catch(() => {});
      }
    };
    
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, [user?.id]);

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: 60,
        background: 'rgba(6, 10, 20, 0.75)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 100, fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
            <div style={{
              width: 32, height: 32, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
            }}>
              <Globe size={18} color="#fff" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              CoastGuard <span style={{ color: '#10b981', fontWeight: 400 }}>AI</span>
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {NAV_ITEMS.map(({ label, path, icon: Icon, requirePro }) => {
              const active = location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                    borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                    color: active ? '#fff' : '#94a3b8',
                    background: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <Icon size={16} color={active ? '#10b981' : 'currentColor'} />
                  {label}
                  {requirePro && (
                    <div style={{
                      padding: '2px 6px',
                      background: 'rgba(245,158,11,0.15)',
                      color: '#f59e0b',
                      fontSize: 9,
                      fontWeight: 800,
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginLeft: 4,
                      border: '1px solid rgba(245,158,11,0.2)'
                    }}>
                      PRO
                    </div>
                  )}
                  {active && (
                    <div style={{
                      position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
                      width: 24, height: 2, background: '#10b981', borderRadius: '4px 4px 0 0',
                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                    }} />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {dbStatus !== 'checking' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              background: dbStatus === 'ok' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${dbStatus === 'ok' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              borderRadius: 20, fontSize: 12, color: dbStatus === 'ok' ? '#10b981' : '#ef4444',
              fontWeight: 500
            }}>
              <Database size={14} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ 
                  width: 6, height: 6, borderRadius: '50%', 
                  background: dbStatus === 'ok' ? '#10b981' : '#ef4444',
                  boxShadow: `0 0 8px ${dbStatus === 'ok' ? '#10b981' : '#ef4444'}` 
                }} />
                {dbStatus === 'ok' ? (dbBackend || 'Connected') : 'Backend Offline'}
              </span>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Bell size={18} color="#94a3b8" style={{ cursor: 'pointer' }} />
            {alertCount !== null && alertCount > 0 && (
              <div style={{
                position: 'absolute', top: -6, right: -6, background: '#ef4444',
                color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px',
                borderRadius: 10, border: '2px solid #060a14'
              }}>
                {alertCount}
              </div>
            )}
          </div>
          
          <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.1)' }} />
          
          <button 
            onClick={handleDeleteAccount}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444', fontSize: 12, fontWeight: 600,
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Trash2 size={14} />
            Delete
          </button>

          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
      <div style={{ height: 60 }} />
    </>
  );
};
