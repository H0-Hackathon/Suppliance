import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * requireSubscription: if true, expired trial → /subscription
 * requirePro: if true, non-pro subscription → /subscription (with a "pro required" message)
 */
export function ProtectedRoute({
  component: Component,
  requireSubscription = true,
  requirePro = false,
  ...args
}) {
  const { isAuthenticated, isLoading, subscription } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0f1e',
        fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid rgba(245,158,11,0.2)',
            borderTopColor: '#F59E0B', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 14px',
          }} />
          <p style={{ margin: 0 }}>Loading CoastGuard…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Expired trial/subscription → go to subscription page
  if (requireSubscription && subscription?.status === 'expired') {
    return <Navigate to="/subscription" replace />;
  }

  // Pro-gated route: trial users and "starter" plan users get redirected
  if (requirePro && subscription?.plan !== 'pro' && subscription?.status !== 'trial') {
    return <Navigate to="/subscription?upgrade=pro" replace />;
  }

  return <Component {...args} />;
}
