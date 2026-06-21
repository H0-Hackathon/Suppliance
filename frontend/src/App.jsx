import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import './App.css';
import SuppliersPage from './pages/SuppliersPage';
import { CommonHeader } from './components/CommonHeader';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { AlertsPage } from './pages/AlertsPage';
import { DemoPage } from './pages/DemoPage';
import { AdminPage } from './pages/AdminPage';
<<<<<<< HEAD
import SubscriptionPage from './pages/SubscriptionPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import DummyPaymentPage from './pages/DummyPaymentPage';
=======
import SettingsPage from './pages/SettingsPage';
>>>>>>> 0a8b967f792f8ea25c1aca56f1b1d7abdae410f5

import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import OnboardingPage from './pages/OnboardingPage';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

function AppRoutes() {
  return (
    <>
      <SignedIn>
        <CommonHeader />
      </SignedIn>
      
      <Routes>
        {/* Public auth routes handled by Clerk */}
        <Route path="/sign-in/*" element={
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10vh' }}>
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/onboarding" />
          </div>
        } />
        <Route path="/sign-up/*" element={
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10vh' }}>
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/onboarding" />
          </div>
        } />
        
        {/* Onboarding step for CoastGuard Enterprise logic */}
        <Route path="/onboarding" element={
          <SignedIn>
            <OnboardingPage />
          </SignedIn>
        } />

        {/* Dashboard Routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={<ProtectedRoute component={AlertsDashboard} requireSubscription={false} />} />
        <Route path="/alerts" element={<ProtectedRoute component={AlertsPage} requireSubscription={false} />} />
        <Route path="/demo" element={<ProtectedRoute component={DemoPage} requireSubscription={true} />} />
        <Route path="/suppliers" element={<ProtectedRoute component={SuppliersPage} requirePro={true} />} />
        <Route path="/admin" element={<ProtectedRoute component={AdminPage} requireSubscription={false} />} />
        <Route path="/compliance" element={<ProtectedRoute component={() => <PlaceholderPage title="Compliance" />} requireSubscription={false} />} />
        <Route path="/settings" element={<ProtectedRoute component={() => <PlaceholderPage title="Settings" />} requireSubscription={false} />} />
        <Route path="/subscription" element={<ProtectedRoute component={SubscriptionPage} requireSubscription={false} />} />
        <Route path="/payment" element={<ProtectedRoute component={DummyPaymentPage} requireSubscription={false} />} />
        
        {/* Catch-all redirect */}
        <Route path="*" element={
          <SignedOut>
            <Navigate to="/sign-in" replace />
          </SignedOut>
        } />
      </Routes>
      
      {/* If signed out and trying to access a root path that isn't signin/up, redirect to sign-in */}
      <SignedOut>
        <Routes>
          <Route path="/" element={<Navigate to="/sign-in" replace />} />
          <Route path="/dashboard" element={<Navigate to="/sign-in" replace />} />
        </Routes>
      </SignedOut>
    </>
  );
}

function App() {
  return (
<<<<<<< HEAD
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConfigProvider locale={enUS}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </ClerkProvider>
=======
    <ConfigProvider locale={enUS}>
      <BrowserRouter>
        <CommonHeader />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AlertsDashboard />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Catch-all: redirect unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
>>>>>>> 0a8b967f792f8ea25c1aca56f1b1d7abdae410f5
  );
}

export default App;
