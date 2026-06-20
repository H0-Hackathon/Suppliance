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
import SubscriptionPage from './pages/SubscriptionPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthInterceptor } from './components/AuthInterceptor';
import { ProtectedRoute } from './components/ProtectedRoute';

import DummyPaymentPage from './pages/DummyPaymentPage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* Only show sidebar when logged in */}
      {isAuthenticated && <CommonHeader />}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Unrestricted read-only access to dashboard/alerts even if trial expires */}
        <Route path="/dashboard" element={<ProtectedRoute component={AlertsDashboard} requireSubscription={false} />} />
        <Route path="/alerts" element={<ProtectedRoute component={AlertsPage} requireSubscription={false} />} />
        
        {/* Strictly gated pipeline execution and supplier panel */}
        <Route path="/demo" element={<ProtectedRoute component={DemoPage} requireSubscription={true} />} />
        <Route path="/suppliers" element={<ProtectedRoute component={SuppliersPage} requirePro={true} />} />
        
        <Route path="/admin" element={<ProtectedRoute component={AdminPage} requireSubscription={false} />} />
        <Route path="/compliance" element={<ProtectedRoute component={() => <PlaceholderPage title="Compliance" />} requireSubscription={false} />} />
        <Route path="/settings" element={<ProtectedRoute component={() => <PlaceholderPage title="Settings" />} requireSubscription={false} />} />
        
        {/* Subscription page — auth required but no subscription check */}
        <Route path="/subscription" element={<ProtectedRoute component={SubscriptionPage} requireSubscription={false} />} />
        <Route path="/payment" element={<ProtectedRoute component={DummyPaymentPage} requireSubscription={false} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ConfigProvider locale={enUS}>
      <BrowserRouter>
        <AuthProvider>
          <AuthInterceptor>
            <AppRoutes />
          </AuthInterceptor>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
