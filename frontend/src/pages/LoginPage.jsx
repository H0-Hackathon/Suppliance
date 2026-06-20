import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { LogIn } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN LOGIN PAGE (Auth0)                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2e 40%, #0f2240 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', fontFamily: 'Inter, sans-serif',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
        top: '-200px', left: '-100px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        bottom: '-150px', right: '-50px', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            marginBottom: 12,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: '0 4px 15px rgba(245,158,11,0.4)',
            }}>⚓</div>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
              Coast<span style={{ color: '#F59E0B' }}>Guard</span>
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, margin: 0 }}>
            Supply Chain Intelligence Platform
          </p>
        </div>

        {/* Login Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '40px 30px',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>Welcome Back</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '30px' }}>Sign in to access your dashboard</p>
          
          <button
            onClick={() => loginWithRedirect()}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'white',
              color: '#0a0f1e',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 15px rgba(255,255,255,0.2)';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <LogIn size={18} />
            {isLoading ? 'Loading...' : 'Continue with Auth0'}
          </button>
        </div>
      </div>
    </div>
  );
}
