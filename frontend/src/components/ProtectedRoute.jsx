import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const [subStatus, setSubStatus] = useState(null);
  const [isLoadingSub, setIsLoadingSub] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded) setIsLoadingSub(false);
      return;
    }

    let isMounted = true;
    const fetchSub = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/v2/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.status === 404) {
          // User not found in DB -> they need to finish onboarding!
          setSubStatus({ notFound: true });
        } else if (res.ok) {
          const data = await res.json();
          if (isMounted) setSubStatus(data.subscription);
        }
      } catch (e) {
        console.error("Failed to fetch subscription", e);
      } finally {
        if (isMounted) setIsLoadingSub(false);
      }
    };
    
    fetchSub();
    return () => { isMounted = false; };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || isLoadingSub) {
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

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (subStatus?.notFound) {
    // If Clerk says they are signed in but our DB doesn't have them, go to onboarding
    return <Navigate to="/onboarding" replace />;
  }

  // Expired trial/subscription → go to subscription page
  if (requireSubscription && subStatus?.status === 'expired') {
    return <Navigate to="/subscription" replace />;
  }

  // Pro-gated route: only actual pro subscribers get through
  if (requirePro) {
    const isPro = subStatus?.plan === 'pro' && subStatus?.status === 'active';
    if (!isPro) {
      return <Navigate to="/subscription?upgrade=pro" replace />;
    }
  }

  return <Component {...args} />;
}
