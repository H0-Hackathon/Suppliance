import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { Toaster } from 'sonner';
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
import { Logo } from './components/common/Logo';
import { applyAppearance, loadCachedAppearance, cacheAppearance, DEFAULT_APPEARANCE } from './lib/appearance';

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

// Apply the last-known appearance immediately at module load (before first
// paint) so there's no flash of the default theme while auth/settings load.
applyAppearance(loadCachedAppearance());

// ── Branded loading screen ────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #16323A 0%, #285260 55%, #16323A 100%)',
      gap: 28,
    }}>
      <Logo size={64} variant="splash" />
      <div style={{ width: 160, height: 3, borderRadius: 999, background: 'rgba(132,215,216,0.15)', overflow: 'hidden' }}>
        <div style={{
          width: '40%', height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, var(--dusty-teal), var(--seafoam))',
          animation: 'loading-slide 1.1s ease-in-out infinite',
        }}/>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
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
        // Pull this account's saved appearance from the backend (covers a
        // fresh browser/device where localStorage has nothing cached yet)
        // and re-apply/cache it so it's correct everywhere, not just Settings.
        fetch(`${API_URL}/api/v2/settings`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((settingsData) => {
            if (settingsData?.appearance_preferences) {
              const prefs = { ...DEFAULT_APPEARANCE, ...settingsData.appearance_preferences };
              applyAppearance(prefs);
              cacheAppearance(prefs);
            }
          })
          .catch(() => {});
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
                minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32,
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(160deg,#16323A 0%,#285260 55%,#16323A 100%)',
              }}>
                <Logo size={56} variant="splash" />
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
        <Toaster richColors position="top-right" />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </ClerkProvider>
  );
}

export default App;
