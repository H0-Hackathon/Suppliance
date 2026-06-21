import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import './App.css';

import { CommonHeader } from './components/CommonHeader';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';

/**
 * CoastGuard — App Router
 *
 * Routes:
 *   /            → redirect to /dashboard
 *   /dashboard   → main alert dashboard (sidebar + alert list + map)
 *   /demo        → demo coming soon placeholder
 *   /admin       → admin panel (internal use)
 *
 * Auth removed entirely. business_id=1 is hardcoded for Phase 1.
 * Phase 2 will add onboarding flow and per-business data.
 */

function App() {
  return (
    <ConfigProvider locale={enUS}>
      <BrowserRouter>
        <CommonHeader />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AlertsDashboard />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Catch-all: redirect unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
