import React, { useState } from 'react';
import { DashboardCharts } from '../components/Admin/DashboardCharts';

/**
 * AdminPage — Internal admin panel.
 *
 * Phase 1: Auth removed. This page is accessible directly at /admin.
 * Shows backend health and placeholder analytics.
 *
 * Phase 2: Re-add simple access control when needed.
 */
export function AdminPage() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function checkBackend() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/health');
      const data = await res.json();
      setApiStatus(data);
    } catch (err) {
      setApiStatus({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-with-sidebar">
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1E3A5F',
          fontFamily: 'Inter, sans-serif',
          marginBottom: 4,
        }}
      >
        Admin Panel
      </h1>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
        Internal CoastGuard admin — for development use.
      </p>

      {/* Backend health */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 12 }}>
          Backend Health
        </p>
        <button
          className="btn-primary"
          onClick={checkBackend}
          disabled={loading}
          style={{ marginBottom: 12 }}
        >
          {loading ? 'Checking...' : 'Ping Backend'}
        </button>

        {apiStatus && (
          <pre
            style={{
              background: '#F8FAFC',
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(apiStatus, null, 2)}
          </pre>
        )}
      </div>

      {/* Charts — existing component, keep unchanged */}
      <DashboardCharts />
    </main>
  );
}
