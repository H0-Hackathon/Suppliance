import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard,
  Bell,
  Building2,
  Settings,
  Anchor,
  Home,
} from 'lucide-react';
import { MOTION } from '../motion/tokens';

const NAV_ITEMS = [
  { label: 'Home',        path: '/',            icon: Home },
  { label: 'Workspace',   path: '/dashboard',   icon: LayoutDashboard },
  { label: 'Alerts',      path: '/alerts',      icon: Bell },
  { label: 'Suppliers',   path: '/suppliers',   icon: Building2 },
  { label: 'Settings',    path: '/settings',    icon: Settings },
];

const ACTIVE_CUSTOMER_ID = 69;

type DbStatus = 'checking' | 'ok' | 'error';

export const CommonHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReduced = useReducedMotion();
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((data) => {
          setDbStatus(data?.database?.status === 'ok' ? 'ok' : 'error');
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
        })
        .catch(() => {});
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.aside
      className="cg-sidebar"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: MOTION.reveal.ease }}
    >
      <motion.div
        className="cg-sidebar-brand"
        onClick={() => navigate('/')}
        whileHover={prefersReduced ? {} : { opacity: 0.88 }}
        transition={MOTION.hover}
      >
        <div className="cg-brand-row">
          <div className="cg-brand-icon">
            <Anchor size={20} color="var(--ocean)" strokeWidth={2} />
          </div>
          <div>
            <div className="cg-brand-name">CoastGuard</div>
            <div className="cg-brand-tagline">Supply chain intelligence</div>
          </div>
        </div>
      </motion.div>

      {dbStatus === 'error' && (
        <div className="cg-status-bar cg-status-bar--error" role="status">
          <span className="cg-status-dot" />
          <span>Cannot reach the server — some data may be stale</span>
        </div>
      )}

      <nav className="cg-nav">
        <div className="cg-nav-label">Navigate</div>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive =
            location.pathname === path ||
            (path === '/dashboard' && location.pathname === '/dashboard') ||
            (path === '/' && location.pathname === '/');
          return (
            <motion.button
              key={label}
              className={`cg-nav-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(path)}
              whileHover={prefersReduced ? {} : { x: 3 }}
              whileTap={prefersReduced ? {} : { scale: 0.99 }}
              transition={MOTION.hover}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.75} />
              {label}
              {label === 'Alerts' && alertCount !== null && alertCount > 0 && (
                <span className="cg-nav-badge">{alertCount}</span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="cg-sidebar-footer">
        <div>CoastGuard v0.1</div>
        <div style={{ marginTop: 4, opacity: 0.7 }}>
          For importers, exporters & logistics teams
        </div>
      </div>
    </motion.aside>
  );
};
