import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import { LandingPage } from './pages/LandingPage';
import { Logo } from './components/common/Logo';
import { applyAppearance, loadCachedAppearance, cacheAppearance, DEFAULT_APPEARANCE } from './lib/appearance';

import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
  useSignIn,
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

// ── Demo / judge instant-login ─────────────────────────────────────────────
// Type "judge_demo" (no password) → instantly authenticated as the pre-seeded
// demo account. Intended for hackathon judges evaluating the live app.
function DemoAccess() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const [value, setValue] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | loading | error

  const attempt = async () => {
    if (!isLoaded || value.trim() !== 'judge_demo') return;
    setStatus('loading');
    try {
      const result = await signIn.create({
        identifier: 'judge@suppliance.io',
        password: 'SupplanceH0!',
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const isMatch = value.trim() === 'judge_demo';

  return (
    <div style={{
      width: 360,
      background: 'rgba(20,50,58,0.7)',
      border: '1px solid rgba(132,215,216,0.18)',
      borderRadius: 12,
      padding: '18px 20px',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--seafoam)', textTransform: 'uppercase' }}>
        Judge / Demo Access
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={value}
          onChange={e => { setValue(e.target.value); setStatus('idle'); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Type judge_demo and press Enter"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${isMatch ? 'rgba(132,215,216,0.5)' : 'rgba(232,226,216,0.15)'}`,
            borderRadius: 7,
            padding: '9px 12px',
            color: isMatch ? '#84D7D8' : 'var(--foreground)',
            fontSize: 14,
            fontFamily: 'var(--font)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
        />
        <button
          onClick={attempt}
          disabled={!isMatch || status === 'loading'}
          style={{
            padding: '9px 14px',
            borderRadius: 7,
            border: 'none',
            background: isMatch ? 'rgba(132,215,216,0.15)' : 'rgba(232,226,216,0.05)',
            color: isMatch ? '#84D7D8' : 'rgba(232,226,216,0.3)',
            fontSize: 13,
            fontWeight: 600,
            cursor: isMatch ? 'pointer' : 'default',
            fontFamily: 'var(--font)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? '…' : '→'}
        </button>
      </div>
      {status === 'error' && (
        <div style={{ fontSize: 12, color: '#E24B4A' }}>
          Login failed — check that the demo account is seeded.
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function AppRoutes() {
  const navigate = useNavigate();
  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>

      <SignedOut>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/sign-in/*"
            element={
              <div style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 24,
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(160deg,#16323A 0%,#285260 55%,#16323A 100%)',
              }}>
                <Logo size={56} variant="splash" onClick={() => navigate('/')} />
                <DemoAccess />
                <SignIn routing="path" path="/sign-in" afterSignInUrl="/" afterSignUpUrl="/" />
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
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
