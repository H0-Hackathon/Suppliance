import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

export default function CallbackPage() {
  const { error, isLoading, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    // Once Auth0 finishes processing the callback URL and isLoading becomes false,
    // we can safely redirect the user to the dashboard if they are authenticated.
    if (!isLoading) {
      if (isAuthenticated) {
        navigate('/dashboard', { replace: true });
      } else if (error) {
        console.error("Auth0 Callback Error:", error);
      } else {
        // Fallback: If not loading, not authenticated, and no error, redirect to login
        navigate('/login', { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, error, navigate]);

  return (
    <div style={{
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0a0f1e', 
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid rgba(245,158,11,0.3)',
        borderTopColor: '#F59E0B', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', marginBottom: '16px',
      }} />
      <p style={{ color: 'rgba(255,255,255,0.6)' }}>Completing login...</p>
      {error && (
        <p style={{ color: '#EF4444', marginTop: '16px' }}>
          Authentication Error: {error.message}
        </p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
