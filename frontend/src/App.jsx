import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import './App.css';
import SuppliersPage from './pages/SuppliersPage';
import { CommonHeader } from './components/CommonHeader';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { AlertsPage } from './pages/AlertsPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import HomePage from './pages/HomePage';
import { MOTION } from './motion/tokens';

function RouteShell({ children }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: prefersReduced ? 1 : 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.4, ease: MOTION.reveal.ease }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <RouteShell key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<AlertsDashboard />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </RouteShell>
    </AnimatePresence>
  );
}

function AppShell() {
  const location = useLocation();
  const isMarketingHome = location.pathname === '/';

  return (
    <>
      {!isMarketingHome && <CommonHeader />}
      <AnimatedRoutes />
    </>
  );
}

function App() {
  return (
    <ConfigProvider locale={enUS}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
