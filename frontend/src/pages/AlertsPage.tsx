import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './AlertsPage.css';
import api from '../services/api';

const CUSTOMER_ID = 1;

type Severity = 'critical' | 'high' | 'medium' | 'low';

/** GET /api/v2/alerts (schemas.TariffAlertResponse). */
interface ApiAlert {
  id: number;
  alert_type: string;
  severity: Severity;
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

/** GET /api/v2/suppliers (schemas.SupplierResponse). */
interface ApiSupplier {
  id: number;
  name: string;
  country: string;
  product_category: string | null;
  reliability_score: number;
  is_active: boolean;
}

/** GET /api/v2/news (services.news_feed). */
interface NewsItem {
  title: string;
  url: string;
  source: string;
  category: string;
  published: string | null;
  published_ts: number;
}

function parseAgentOutput(s: string | null): Record<string, any> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(diffMin)) return '';
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const money = (n: number | null | undefined): string =>
  n == null ? '—' : (n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `$${Math.round(n)}`);

interface AlertView {
  id: number;
  title: string;
  country: string;
  sector: string;
  severity: Severity;
  confidence: number | null;
  timeDetected: string;
  raw: ApiAlert;
  ao: Record<string, any>;
}

function toView(a: ApiAlert): AlertView {
  const ao = parseAgentOutput(a.agent_output);
  const tm = ao.tariff_monitor || {};
  return {
    id: a.id,
    title: tm.event || a.summary || 'Trade risk alert',
    country: tm.country || '—',
    sector: tm.product || '—',
    severity: a.severity,
    confidence: tm.confidence != null ? Math.round(tm.confidence * 100) : null,
    timeDetected: relativeTime(a.created_at),
    raw: a,
    ao,
  };
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSeverity, setActiveSeverity] = useState<'all' | Severity>('all');
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

  // Supporting context for supplier-level + source intelligence panels — both
  // reuse existing endpoints (no new APIs).
  useEffect(() => {
    fetchAlerts();
    api.get<ApiSupplier[]>('/v2/suppliers', { params: { customer_id: CUSTOMER_ID } })
      .then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
    api.get<{ items: NewsItem[] }>('/v2/news')
      .then((r) => setNews(r.data.items || [])).catch(() => setNews([]));
  }, [fetchAlerts]);

  const views = useMemo(() => alerts.map(toView), [alerts]);

  const filtered = useMemo(() => views.filter((a) => {
    const matchSev = activeSeverity === 'all' || a.severity === activeSeverity;
    const q = searchTerm.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.sector.toLowerCase().includes(q);
    return matchSev && matchQ;
  }), [views, searchTerm, activeSeverity]);

  const selected = useMemo(() => views.find((v) => v.id === selectedId) ?? null, [views, selectedId]);

  // ── Derive the full investigation model from real agent_output + context ──
  const detail = useMemo(() => {
    if (!selected) return null;
    const ao = selected.ao;
    const tm = ao.tariff_monitor || {};
    const impact = ao.impact_calculator || {};
    const alts = ao.alternatives_finder || {};
    const comp = ao.import_compliance || {};
    const adv = ao.adversarial || {};
    const altList: any[] = Array.isArray(alts.alternatives) ? alts.alternatives : [];
    const topAlt = altList[0];

    const countryLc = (tm.country || '').toLowerCase();
    const affectedSuppliers = countryLc
      ? suppliers.filter((s) => s.country.toLowerCase().includes(countryLc) || countryLc.includes(s.country.toLowerCase()))
      : [];

    const directCost = impact.direct_cost ?? impact.extra_cost_usd ?? null;
    const riskScore = impact.risk_score != null ? Math.round(impact.risk_score) : null;
    const riskLevel = (impact.severity || selected.severity || 'unknown') as string;
    const affectedOrders = impact.affected_orders ?? null;
    // Each affected supplier→destination shipment is a trade route at risk.
    const affectedRoutes = affectedOrders ?? affectedSuppliers.length;

    // Source intelligence: the alert's own cited article(s) first…
    const tmNews: any[] = Array.isArray(tm.news) ? tm.news : [];
    const alertSources = [
      ...(tm.source_url ? [{ title: tm.event || 'Source article', url: tm.source_url, source: tm.source || 'Source', published: null as string | null }] : []),
      ...tmNews.map((n) => ({ title: n.title, url: n.url, source: n.domain || 'Source', published: n.scraped_at || null })),
    ];

    // Recommended actions, generated from agent outputs (real) or derived.
    const recs: string[] = [];
    if (topAlt) {
      const cd = topAlt.cost_delta_pct;
      recs.push(`Switch sourcing to ${topAlt.supplier_name}${topAlt.country_full || topAlt.country ? ` (${topAlt.country_full || topAlt.country})` : ''}${cd != null ? ` — ${cd > 0 ? '+' : ''}${cd}% cost` : ''}${topAlt.lead_time_weeks != null ? `, ${topAlt.lead_time_weeks}-week lead time` : ''}.`);
    }
    const compCountries = Object.keys(comp.compliance_by_country || {});
    if (compCountries.length) {
      const first = comp.compliance_by_country[compCountries[0]];
      const docs = Array.isArray(first?.mandatory_documents) ? first.mandatory_documents.map((d: any) => d.document || d).slice(0, 2).join(', ') : '';
      recs.push(`Prepare customs documentation for ${compCountries.join(', ')}${docs ? ` (${docs}…)` : ''}.`);
    }
    if (affectedSuppliers.length) {
      recs.push(`Review ${affectedSuppliers.length} tracked supplier${affectedSuppliers.length !== 1 ? 's' : ''} in ${tm.country} (${affectedSuppliers.map((s) => s.name).slice(0, 3).join(', ')}${affectedSuppliers.length > 3 ? '…' : ''}).`);
    }
    if (affectedOrders) {
      recs.push(`Re-cost ${affectedOrders} affected order(s) for ${selected.sector} against the ${tm.tariff_rate != null ? `${tm.tariff_rate}% ` : ''}tariff.`);
    }
    if (!topAlt) {
      recs.push(`Run the full agent pipeline (real-LLM mode) to source compliant alternatives for ${tm.country}.`);
    }
    if (adv.recommended_action) recs.unshift(adv.recommended_action);
    else if (alts.recommendation_summary) recs.unshift(alts.recommendation_summary);

    const steps = [
      {
        key: 'tariff_monitor', name: 'TariffMonitor', done: !!ao.tariff_monitor,
        finding: ao.tariff_monitor
          ? `${tm.event_type || 'Event'} detected in ${tm.country || 'region'}${tm.tariff_rate != null ? `, +${tm.tariff_rate}% tariff` : ''}${tm.confidence != null ? ` (confidence ${Math.round(tm.confidence * 100)}%)` : ''}.`
          : null,
      },
      {
        key: 'impact_calculator', name: 'ImpactCalculator', done: !!ao.impact_calculator,
        finding: ao.impact_calculator
          ? `Direct cost ${money(directCost)} across ${affectedOrders ?? 0} order(s); severity ${impact.severity}${impact.eta_risk ? `, ETA risk ${impact.eta_risk}` : ''}.`
          : null,
      },
      {
        key: 'alternatives_finder', name: 'AlternativesFinder', done: altList.length > 0,
        finding: altList.length
          ? `${altList.length} alternative${altList.length !== 1 ? 's' : ''} — top: ${topAlt.supplier_name} (${topAlt.country_full || topAlt.country}).`
          : null,
      },
      {
        key: 'import_compliance', name: 'ComplianceChecker', done: !!ao.import_compliance,
        finding: ao.import_compliance
          ? (comp.summary || `Assessed ${compCountries.join(', ') || 'alternatives'}.`)
          : null,
      },
      {
        key: 'final', name: 'Final Recommendation', done: !!ao.adversarial, final: true,
        finding: adv.recommended_action || null,
      },
    ];

    return {
      tm, impact, comp, adv, topAlt,
      directCost, riskScore, riskLevel,
      affectedSuppliersCount: affectedSuppliers.length,
      affectedRoutes,
      alertSources,
      relatedNews: news.slice(0, 4),
      recs,
      steps,
      summaryText: tm.summary || selected.raw.summary || '',
    };
  }, [selected, suppliers, news]);

  const mutate = useCallback(async (id: number, action: 'dismiss' | 'resolve') => {
    setPendingId(id);
    try {
      await api.put(`/v2/alerts/${id}/${action}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    } catch {
      /* leave in place on failure */
    } finally {
      setPendingId(null);
    }
  }, []);

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
                <span className="ap-tag">{alert.sector}</span>
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

      {/* ── INVESTIGATION PANEL (RIGHT) ──────────────────── */}
      <main className="ap-panel">
        {selected && detail ? (
          <div className="ap-investigation">
            {/* Header */}
            <div className="ap-inv-header">
              <div className="ap-inv-header-left">
                <span className="ap-inv-label">Incident Report</span>
                <h1 className="ap-inv-title">{selected.title}</h1>
                <p className="ap-inv-sub">
                  {selected.country} · {selected.sector} · Detected {absoluteTime(selected.raw.created_at)}
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

            {/* ── Incident Summary ── */}
            <section className="ap-section">
              <h2 className="ap-section-title">Incident Summary</h2>
              <div className="ap-prose-card">
                {detail.summaryText && <p className="ap-prose">{detail.summaryText}</p>}
                <div className="ap-context-row" style={detail.summaryText ? undefined : { borderTop: 'none', paddingTop: 0 }}>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Country</span>
                    <span className="ap-context-value">{selected.country}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Sector</span>
                    <span className="ap-context-value">{selected.sector}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Confidence</span>
                    <span className="ap-context-value">{selected.confidence != null ? `${selected.confidence}%` : '—'}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Event Type</span>
                    <span className="ap-context-value">{detail.tm.event_type || selected.raw.alert_type || '—'}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Detected</span>
                    <span className="ap-context-value">{absoluteTime(selected.raw.created_at)}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Source</span>
                    <span className="ap-context-value">{detail.tm.source || selected.raw.alert_type || '—'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Impact Assessment ── */}
            <section className="ap-section">
              <h2 className="ap-section-title">Impact Assessment</h2>
              <div className="ap-prose-card">
                <div className="ap-risk-row">
                  <span className="ap-risk-label">Risk Level</span>
                  <div className="ap-risk-track">
                    <div
                      className="ap-risk-fill"
                      style={{ width: `${detail.riskScore ?? (detail.riskLevel === 'high' || detail.riskLevel === 'critical' ? 80 : detail.riskLevel === 'medium' ? 50 : 25)}%` }}
                      data-level={detail.riskLevel === 'critical' || detail.riskLevel === 'high' ? 'high' : detail.riskLevel === 'medium' ? 'med' : 'low'}
                    />
                  </div>
                  <span className="ap-risk-num">{detail.riskLevel.toUpperCase()}</span>
                </div>

                <div className="ap-metric-grid">
                  <div className="ap-metric ap-metric--danger">
                    <span className="ap-metric-label">Est. Cost Impact</span>
                    <span className="ap-metric-value">{money(detail.directCost)}</span>
                    <span className="ap-metric-sub">{detail.directCost != null ? 'direct duty cost' : 'no matched orders'}</span>
                  </div>
                  <div className="ap-metric">
                    <span className="ap-metric-label">Risk Score</span>
                    <span className="ap-metric-value">{detail.riskScore != null ? `${detail.riskScore}` : '—'}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{detail.riskScore != null ? '/100' : ''}</span></span>
                    <span className="ap-metric-sub">{detail.riskLevel} severity</span>
                  </div>
                  <div className="ap-metric">
                    <span className="ap-metric-label">Affected Suppliers</span>
                    <span className="ap-metric-value">{detail.affectedSuppliersCount}</span>
                    <span className="ap-metric-sub">tracked in {selected.country}</span>
                  </div>
                  <div className="ap-metric">
                    <span className="ap-metric-label">Affected Routes</span>
                    <span className="ap-metric-value">{detail.affectedRoutes}</span>
                    <span className="ap-metric-sub">orders/shipments at risk</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Agent Reasoning Timeline ── */}
            <section className="ap-section">
              <h2 className="ap-section-title">Agent Reasoning Timeline</h2>
              <div className="ap-tl">
                {detail.steps.map((step, i) => (
                  <div
                    key={step.key}
                    className={`ap-tl-step${step.done ? ' ap-tl-step--done' : ''}${(step as any).final ? ' ap-tl-step--final' : ''}`}
                  >
                    <div className="ap-tl-rail">
                      <div className="ap-tl-node">{step.done ? '✓' : i + 1}</div>
                      {i < detail.steps.length - 1 && <div className="ap-tl-line" />}
                    </div>
                    <div className="ap-tl-body">
                      <div className="ap-tl-head">
                        <span className="ap-tl-name">{step.name}</span>
                        {!step.done && <span className="ap-tl-tag ap-tl-tag--pending">Not run</span>}
                      </div>
                      <p className={`ap-tl-finding${step.done ? '' : ' ap-tl-finding--muted'}`}>
                        {step.finding || 'Not run for this alert — run the full pipeline (real-LLM mode) to populate.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Source Intelligence ── */}
            <section className="ap-section">
              <h2 className="ap-section-title">Source Intelligence</h2>
              <div className="ap-sources">
                {detail.alertSources.length === 0 && detail.relatedNews.length === 0 && (
                  <div className="ap-prose-card"><p className="ap-prose" style={{ margin: 0 }}>No linked sources for this alert.</p></div>
                )}
                {detail.alertSources.map((s, i) => (
                  <a key={`src-${i}`} className="ap-source" href={s.url} target="_blank" rel="noreferrer">
                    <div className="ap-source-meta">
                      <span className="ap-source-name">{s.source}</span>
                      <span className="ap-source-time">{s.published ? relativeTime(s.published) : 'cited'}</span>
                    </div>
                    <span className="ap-source-title">{s.title}</span>
                  </a>
                ))}
                {detail.relatedNews.length > 0 && (
                  <span className="ap-source-group-label">Related trade wire</span>
                )}
                {detail.relatedNews.map((n, i) => (
                  <a key={`rel-${i}`} className="ap-source" href={n.url} target="_blank" rel="noreferrer">
                    <div className="ap-source-meta">
                      <span className="ap-source-name">{n.source}</span>
                      <span className="ap-source-cat">{n.category}</span>
                      <span className="ap-source-time">{relativeTime(n.published)}</span>
                    </div>
                    <span className="ap-source-title">{n.title}</span>
                  </a>
                ))}
              </div>
            </section>

            {/* ── Recommended Actions ── */}
            <section className="ap-section">
              <h2 className="ap-section-title">Recommended Actions</h2>
              <div className="ap-action-card">
                {detail.topAlt ? (
                  <>
                    <div className="ap-action-top">
                      <span className="ap-action-label">Switch To</span>
                      <span className="ap-action-supplier">{detail.topAlt.supplier_name}</span>
                    </div>
                    <div className="ap-benefits">
                      <div className="ap-benefit">
                        <span className="ap-benefit-label">Cost Delta</span>
                        <span className={`ap-benefit-value ap-benefit-value--${(detail.topAlt.cost_delta_pct ?? 0) <= 0 ? 'green' : 'amber'}`}>
                          {detail.topAlt.cost_delta_pct != null ? `${detail.topAlt.cost_delta_pct > 0 ? '+' : ''}${detail.topAlt.cost_delta_pct}%` : '—'}
                        </span>
                      </div>
                      <div className="ap-benefit">
                        <span className="ap-benefit-label">Lead Time</span>
                        <span className="ap-benefit-value">{detail.topAlt.lead_time_weeks != null ? `${detail.topAlt.lead_time_weeks} wks` : '—'}</span>
                      </div>
                      <div className="ap-benefit">
                        <span className="ap-benefit-label">Verdict</span>
                        <span className={`ap-benefit-value ap-benefit-value--${(detail.adv.verdict || '').toUpperCase() === 'CLEAR' ? 'green' : 'amber'}`}>
                          {detail.adv.verdict || 'Review'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ap-action-top">
                    <span className="ap-action-label">Recommended</span>
                    <span className="ap-action-supplier" style={{ fontSize: 16, lineHeight: 1.4 }}>
                      {detail.recs[0] || 'Review exposure and run full sourcing analysis.'}
                    </span>
                  </div>
                )}

                {detail.recs.length > 0 && (
                  <ul className="ap-rec-list">
                    {detail.recs.slice(detail.topAlt ? 0 : 1).map((r, i) => (
                      <li key={i} className="ap-rec-item"><span className="ap-rec-bullet">▸</span><span>{r}</span></li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions — preserve dismiss/resolve functionality */}
              <div className="ap-actions">
                <button
                  className="ap-btn ap-btn--dismiss"
                  disabled={pendingId === selected.id}
                  onClick={() => mutate(selected.id, 'dismiss')}
                >
                  Dismiss
                </button>
                <button
                  className="ap-btn ap-btn--resolve"
                  disabled={pendingId === selected.id}
                  onClick={() => mutate(selected.id, 'resolve')}
                >
                  Mark Resolved
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="ap-empty">
            <div className="ap-empty-icon">◫</div>
            <p className="ap-empty-title">Select an incident</p>
            <p className="ap-empty-sub">Choose an alert from the left panel to open the investigation workspace</p>
          </div>
        )}
      </main>
    </div>
  );
}
