import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import './App.css';
import SuppliersPage from './pages/SuppliersPage';
import { CommonHeader } from './components/CommonHeader';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { AlertsPage } from './pages/AlertsPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import CallbackPage from './pages/CallbackPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { AuthInterceptor } from './components/AuthInterceptor';
import { ProtectedRoute } from './components/ProtectedRoute';

/**
 * CoastGuard — App Router
 *
 * Auth0 is wired but optional: the dashboard loads immediately for demos.
 * If the user logs in via Auth0, the AuthInterceptor attaches the Bearer
 * token to API requests, and the backend maps them to a Customer record.
 * Without login, the backend falls back to the seeded demo customer.
 */

// Import Auth0 config
const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

function AppRoutes() {
  return (
    <BrowserRouter>
      <CommonHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute component={AlertsDashboard} />} />
        <Route path="/alerts" element={<ProtectedRoute component={AlertsPage} />} />
        <Route path="/demo" element={<ProtectedRoute component={DemoPage} />} />
        <Route path="/admin" element={<ProtectedRoute component={AdminPage} />} />
        <Route path="/suppliers" element={<ProtectedRoute component={SuppliersPage} />} />
        <Route path="/compliance" element={<ProtectedRoute component={() => <PlaceholderPage title="Compliance" />} />} />
        <Route path="/settings" element={<ProtectedRoute component={() => <PlaceholderPage title="Settings" />} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        {/* Catch-all: redirect unknown routes to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  // If Auth0 is not configured, render without the Auth0 wrapper
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    return (
      <ConfigProvider locale={enUS}>
        <AppRoutes />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={enUS}>
      <Auth0Provider
        domain={AUTH0_DOMAIN}
        clientId={AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: `${window.location.origin}/auth/callback`,
          audience: AUTH0_AUDIENCE,
          scope: "openid profile email"
        }}
      >
        <AuthInterceptor>
          <AppRoutes />
        </AuthInterceptor>
      </Auth0Provider>
    </ConfigProvider>
  );
}

export default App;
