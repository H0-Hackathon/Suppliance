import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './AlertsPage.css';
import { AlertCard, AlertSeverity, AlertType } from '../components/AlertCard';
import api from '../services/api';

const CUSTOMER_ID = 1;

/** Raw alert as returned by GET /api/v2/alerts (schemas.TariffAlertResponse). */
interface ApiAlert {
  id: number;
  alert_type: string;
  severity: AlertSeverity;
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

/** Inbox display fields derived from an ApiAlert + its agent_output. */
interface AlertView {
  id: number;
  title: string;
  country: string;
  product: string;
  severity: AlertSeverity;
  confidence: number | null;
  timeDetected: string;
  raw: ApiAlert;
}

function parseAgentOutput(s: string | null): Record<string, any> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(diffMin)) return '';
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

function toView(a: ApiAlert): AlertView {
  const ao = parseAgentOutput(a.agent_output);
  const tm = ao.tariff_monitor || {};
  return {
    id: a.id,
    title: tm.event || a.summary || 'Trade risk alert',
    country: tm.country || '—',
    product: tm.product || '—',
    severity: a.severity,
    confidence: tm.confidence != null ? Math.round(tm.confidence * 100) : null,
    timeDetected: relativeTime(a.created_at),
    raw: a,
  };
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSeverity, setActiveSeverity] = useState<'all' | AlertSeverity>('all');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: CUSTOMER_ID } });
      setAlerts(res.data.filter((a) => a.status === 'active'));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const views = useMemo(() => alerts.map(toView), [alerts]);

  const filtered = useMemo(() => views.filter((a) => {
    const matchSev = activeSeverity === 'all' || a.severity === activeSeverity;
    const q = searchTerm.toLowerCase();
    const matchQ = !q
      || a.title.toLowerCase().includes(q)
      || a.country.toLowerCase().includes(q)
      || a.product.toLowerCase().includes(q);
    return matchSev && matchQ;
  }), [views, searchTerm, activeSeverity]);

  const selected = useMemo(
    () => views.find((v) => v.id === selectedId) ?? null,
    [views, selectedId],
  );

  // Dismiss / resolve hit the real PUT endpoints, then drop the alert from the
  // active feed (and clear the selection if it was the open one).
  const mutate = useCallback(async (id: number, action: 'dismiss' | 'resolve') => {
    setPendingId(id);
    try {
      await api.put(`/v2/alerts/${id}/${action}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    } catch {
      // leave the alert in place on failure
    } finally {
      setPendingId(null);
    }
  }, []);

  const handleDismiss = useCallback((id: number) => mutate(id, 'dismiss'), [mutate]);
  const handleResolve = useCallback((id: number) => mutate(id, 'resolve'), [mutate]);

  return (
    <div className="ap-root">
      {/* ── INBOX ────────────────────────────────── */}
      <aside className="ap-inbox">
        <div className="ap-inbox-header">
          <span className="ap-inbox-title">Incidents</span>
          <span className="ap-inbox-count">{filtered.length}</span>
        </div>

        <input
          className="ap-search"
          type="text"
          placeholder="Search incidents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="ap-filters">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              className={`ap-filter-btn${activeSeverity === sev ? ' is-active' : ''}`}
              onClick={() => setActiveSeverity(sev)}
            >
              {sev === 'all' ? 'All' : sev[0].toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        <div className="ap-inbox-list">
          {loading && <p className="ap-no-results">Loading incidents…</p>}
          {!loading && filtered.length === 0 && (
            <p className="ap-no-results">No active incidents match your filters</p>
          )}
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`ap-card ap-card--${alert.severity}${selectedId === alert.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedId(alert.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedId(alert.id)}
            >
              <div className="ap-card-header">
                <span className={`ap-dot ap-dot--${alert.severity}`} />
                <span className="ap-card-title">{alert.title}</span>
                <span className="ap-card-flag">⚑</span>
              </div>
              <div className="ap-card-tags">
                <span className="ap-tag">{alert.country}</span>
                <span className="ap-tag">{alert.product}</span>
              </div>
              <div className="ap-card-meta">
                <span className="ap-card-confidence">
                  {alert.confidence != null ? `${alert.confidence}% confidence` : 'AI Trade Monitor'}
                </span>
                <span className="ap-card-time">{alert.timeDetected}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── INVESTIGATION PANEL ──────────────────── */}
      <main className="ap-panel">
        {selected ? (
          <div className="ap-investigation">
            {/* Header */}
            <div className="ap-inv-header">
              <div className="ap-inv-header-left">
                <span className="ap-inv-label">INCIDENT REPORT</span>
                <h1 className="ap-inv-title">{selected.title}</h1>
                <p className="ap-inv-sub">
                  {selected.country} · {selected.product} · Detected {selected.timeDetected}
                </p>
              </div>
              <div className="ap-inv-header-right">
                {selected.confidence != null && (
                  <div className="ap-inv-confidence">
                    <span className="ap-inv-confidence-num">{selected.confidence}%</span>
                    <span className="ap-inv-confidence-label">Confidence</span>
                  </div>
                )}
                <span className={`ap-severity-pill ap-severity-pill--${selected.severity}`}>
                  {selected.severity.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Real alert detail + dismiss/resolve actions (AlertCard) */}
            <section className="ap-section">
              <h2 className="ap-section-title">Alert Detail & Agent Reasoning</h2>
              <AlertCard
                id={selected.raw.id}
                alert_type={(selected.raw.alert_type as AlertType) || 'tariff_change'}
                severity={selected.severity}
                summary={selected.raw.summary ?? 'Trade risk detected.'}
                agent_output={selected.raw.agent_output ?? undefined}
                created_at={selected.raw.created_at}
                onDismiss={pendingId === selected.id ? undefined : handleDismiss}
                onResolve={pendingId === selected.id ? undefined : handleResolve}
              />
            </section>
          </div>
        ) : (
          <div className="ap-empty">
            <div className="ap-empty-icon">◫</div>
            <p className="ap-empty-title">Select an incident</p>
            <p className="ap-empty-sub">Choose an alert from the left panel to open the investigation view</p>
          </div>
        )}
      </main>
    </div>
  );
}
