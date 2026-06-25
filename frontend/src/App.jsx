import React, { useEffect, useState, useCallback } from 'react';
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
import SettingsPage from './pages/SettingsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import OnboardingPage from './pages/OnboardingPage';

import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  useAuth,
  useUser,
} from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ── Spinner ───────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#0e0e10', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(245,158,11,0.2)',
        borderTopColor: '#f59e0b', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}/>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Loading CoastGuard…
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main dashboard routes (shown after successful onboarding check) ────────────
function DashboardRoutes() {
  return (
    <>
      <CommonHeader />
      <Routes>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<AlertsDashboard />} />
        <Route path="/alerts"       element={<AlertsPage />} />
        <Route path="/demo"         element={<DemoPage />} />
        <Route path="/admin"        element={<AdminPage />} />
        <Route path="/suppliers"    element={<SuppliersPage />} />
        <Route path="/settings"     element={<SettingsPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

// ── Authenticated wrapper: checks if user needs onboarding ────────────────────
function AuthenticatedApp() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [status, setStatus] = useState('checking'); // 'checking' | 'onboarding' | 'ready'

  const checkUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) { setStatus('ready'); return; }

      const res = await fetch(`${API_URL}/api/v2/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // User exists in DB → go straight to dashboard
        setStatus('ready');
      } else if (res.status === 404) {
        // User authenticated with Clerk but no Customer record yet → onboard
        setStatus('onboarding');
      } else {
        // Backend error (500, auth issue, etc.) — use Clerk account age as fallback
        // If account < 10 minutes old, treat as new user
        const ageMs = user?.createdAt
          ? Date.now() - new Date(user.createdAt).getTime()
          : Infinity;
        setStatus(ageMs < 10 * 60 * 1000 ? 'onboarding' : 'ready');
      }
    } catch {
      // Network error — same fallback: account age
      const ageMs = user?.createdAt
        ? Date.now() - new Date(user.createdAt).getTime()
        : Infinity;
      setStatus(ageMs < 10 * 60 * 1000 ? 'onboarding' : 'ready');
    }
  }, [getToken, user?.id]);   // user?.id avoids re-running on every render

  useEffect(() => { checkUser(); }, [checkUser]);

  if (status === 'checking') return <LoadingScreen />;

  if (status === 'onboarding') {
    return (
      <OnboardingPage
        onComplete={() => setStatus('ready')}   // called after successful submit
      />
    );
  }

  return <DashboardRoutes />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>

      <SignedOut>
        <Routes>
          <Route
            path="/sign-in/*"
            element={
              <div style={{
                minHeight: '100vh', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,#02040a 0%,#0e0e10 50%,#111108 100%)',
              }}>
                <SignIn routing="path" path="/sign-in" afterSignInUrl="/" afterSignUpUrl="/" />
              </div>
            }
          />
          <Route path="*" element={<RedirectToSignIn />} />
        </Routes>
      </SignedOut>
    </>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConfigProvider locale={enUS}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </ClerkProvider>
  );
}

export default App;
