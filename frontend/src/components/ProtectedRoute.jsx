import React from 'react';
import { withAuthenticationRequired } from '@auth0/auth0-react';

export function ProtectedRoute({ component, ...args }) {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: () => (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0f1e',
        fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid rgba(245,158,11,0.3)',
            borderTopColor: '#F59E0B', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p>Authenticating CoastGuard…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  });

  return <Component {...args} />;
}
