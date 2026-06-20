import React from 'react';

export default function PlaceholderPage({ title }) {
  return (
    <div className="page-with-sidebar" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, fontSize: 32
      }}>
        🚧
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#e8e3d8' }}>
        {title}
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400, textAlign: 'center' }}>
        This module is currently under development. Please check back later for updates to the {title.toLowerCase()} features.
      </p>
    </div>
  );
}
