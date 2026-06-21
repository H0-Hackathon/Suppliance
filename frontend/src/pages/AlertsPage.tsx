import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './AlertsPage.css';
import { useUser } from '@clerk/clerk-react';
import api from '../services/api';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface ApiAlert {
  id: number;
  alert_type: string;
  severity: Severity;
  summary: string | null;
  agent_output: string | null;
  status: string;
  created_at: string;
}

interface ApiSupplier {
  id: number;
  name: string;
  country: string;
  product_category: string | null;
  reliability_score: number;
  is_active: boolean;
}

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
  n == null ? '—' : (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);

// Human-readable source name — strips internal technical values
const cleanSource = (src?: string | null): string => {
  if (!src) return '—';
  const lower = src.toLowerCase();
  if (lower === 'rss' || lower === 'gemini_knowledge' || lower === 'gemini') return 'Live Trade Intelligence Feed';
  return src;
};

// Known HS code → description (for display only — authoritative map is in backend)
const HS_DESCRIPTIONS: Record<string, string> = {
  '0901': 'Coffee', '0901.11': 'Green coffee beans', '0901.12': 'Decaf coffee beans',
  '0803': 'Bananas', '0803.90': 'Fresh bananas', '0803.10': 'Plantains',
  '2009': 'Fruit juice', '2009.11': 'Frozen OJ concentrate',
  '7601': 'Unwrought aluminum', '7403': 'Refined copper', '7208': 'Flat-rolled steel',
};
const hsWithDesc = (codes: string[]): string =>
  codes.map((c) => {
    const desc = HS_DESCRIPTIONS[c] ?? HS_DESCRIPTIONS[c.split('.')[0]];
    return desc ? `${c} · ${desc}` : c;
  }).join(', ');

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
  // Backend sends affected_countries[] and affected_product_name — not tm.country / tm.product
  const country = (tm.affected_countries?.[0] ?? tm.country) || '—';
  const sector = (tm.affected_product_name ?? tm.product) || '—';
  return {
    id: a.id,
    title: tm.event || a.summary || 'Trade risk alert',
    country,
    sector,
    severity: a.severity,
    confidence: tm.confidence != null ? Math.round(tm.confidence * 100) : null,
    timeDetected: relativeTime(a.created_at),
    raw: a,
    ao,
  };
}

// ── Pipeline log event type ───────────────────────────────────────────────────
interface PipelineEvent { event: string; msg: string; ts: string; }

const AGENT_LABELS: Record<string, string> = {
  pipeline_start: 'Pipeline', profile_loaded: 'Profile', crew_start: 'Crew',
  agent_start: 'Agent', agent_done: 'Agent', agent_result: 'Result',
  db_write: 'Aurora', db_query: 'Aurora', rss_cleared: 'RSS',
  headlines_saved: 'Headlines', run_log: 'Run', pipeline_done: 'Done',
  hs_correction: 'HS Fix', crew_error: 'Error',
};

const EVENT_COLOR: Record<string, string> = {
  pipeline_start: '#f59e0b', profile_loaded: '#94a3b8', crew_start: '#a78bfa',
  agent_start: '#60a5fa', agent_done: '#10b981', agent_result: '#14b8a6',
  db_write: '#34d399', db_query: '#6ee7b7', rss_cleared: '#94a3b8',
  headlines_saved: '#6ee7b7', run_log: '#94a3b8', pipeline_done: '#10b981',
  hs_correction: '#f59e0b', crew_error: '#ef4444',
};

export const AlertsPage: React.FC = () => {
  const { user } = useUser() as any;
  const activeCustomerId = user?.id;
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSeverity, setActiveSeverity] = useState<'all' | Severity>('all');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // ── Pipeline live run state ───────────────────────────────────────────────
  const [runPhase, setRunPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [pipelineLogs, setPipelineLogs] = useState<PipelineEvent[]>([]);
  const [agentResults, setAgentResults] = useState<Record<string, any>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    if (!activeCustomerId) return;
    try {
      const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: activeCustomerId } });
      setAlerts(res.data.filter((a) => a.status === 'active'));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCustomerId]);

  useEffect(() => {
    fetchAlerts();
    if (!activeCustomerId) return;
    api.get<ApiSupplier[]>('/v2/suppliers', { params: { customer_id: activeCustomerId } })
      .then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
    api.get<{ items: NewsItem[] }>('/v2/news')
      .then((r) => setNews(r.data.items || [])).catch(() => setNews([]));
  }, [fetchAlerts, activeCustomerId]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (runPhase === 'running') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineLogs, runPhase]);

  const handleRunAnalysis = useCallback(async () => {
    if (!activeCustomerId) return;
    setRunPhase('running');
    setPipelineLogs([]);
    setAgentResults({});
    setSelectedId(null);

    let pollSince = 0;
    const poll = async () => {
      try {
        const res = await api.get<{ events: PipelineEvent[]; total: number }>(
          '/v2/monitor/pipeline-log', { params: { since: pollSince } }
        );
        pollSince = res.data.total;
        for (const ev of res.data.events) {
          if (ev.event === 'agent_result') {
            try {
              const { agent, output } = JSON.parse(ev.msg);
              setAgentResults((prev) => ({ ...prev, [agent]: output }));
            } catch { /* skip malformed */ }
          }
          setPipelineLogs((prev) => [...prev.slice(-200), ev]);
        }
      } catch { /* ignore poll errors */ }
    };

    const interval = setInterval(poll, 1500);
    try {
      await api.post('/v2/monitor/run', { customer_id: activeCustomerId });
      await poll();
      await fetchAlerts();
      setRunPhase('done');
      // Auto-select the most recent alert
      const res = await api.get<ApiAlert[]>('/v2/alerts', { params: { customer_id: activeCustomerId } });
      const active = res.data.filter((a) => a.status === 'active');
      setAlerts(active);
      if (active.length > 0) setSelectedId(active[0].id);
    } catch {
      setRunPhase('done');
    } finally {
      clearInterval(interval);
    }
  }, [fetchAlerts]);

  const views = useMemo(() => alerts.map(toView), [alerts]);

  const filtered = useMemo(() => views.filter((a) => {
    const matchSev = activeSeverity === 'all' || a.severity === activeSeverity;
    const q = searchTerm.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.sector.toLowerCase().includes(q);
    return matchSev && matchQ;
  }), [views, searchTerm, activeSeverity]);

  const selected = useMemo(() => views.find((v) => v.id === selectedId) ?? null, [views, selectedId]);

  const detail = useMemo(() => {
    if (!selected) return null;
    const ao = selected.ao;
    const tm = ao.tariff_monitor || {};
    const impact = ao.impact_calculator || {};
    const alts = ao.alternatives_finder || {};
    const comp = ao.import_compliance || {};
    const adv = ao.adversarial || {};

    // Backend sends options[] (new schema); legacy shape used alternatives[]
    const altRaw: any[] = Array.isArray(alts.options) ? alts.options
      : (Array.isArray(alts.alternatives) ? alts.alternatives : []);
    const altList = altRaw.map((a) => ({
      supplier_name: a.supplier ?? a.supplier_name ?? 'Alternative',
      country: a.country ?? a.country_full ?? '',
      cost_delta_pct: a.cost_delta_pct,
      lead_time_weeks: a.lead_time_weeks,
      stability_note: a.stability_note ?? a.selection_reasoning ?? null,
      source: a.source ?? null,
    }));

    // Prefer compliance-selected supplier for the "Switch To" card (most specific)
    // Fall back to adversarial's recommended country match, then altList[0]
    const compSupplier = comp.recommended_supplier && !comp.no_viable_option
      ? {
          supplier_name: comp.recommended_supplier,
          country: comp.recommended_country ?? '',
          cost_delta_pct: comp.cost_delta_pct,
          lead_time_weeks: comp.lead_time_weeks,
          stability_note: comp.rationale ?? null,
          source: comp.source ?? null,
        }
      : null;
    const topAlt = compSupplier ?? altList[0] ?? null;

    const advRecommended = adv.recommendation ?? adv.recommended_action ?? null;

    const country = (tm.affected_countries?.[0] ?? tm.country) || '—';
    const product = (tm.affected_product_name ?? tm.product) || '—';
    const countryLc = country.toLowerCase();
    const affectedSuppliers = countryLc !== '—'
      ? suppliers.filter((s) => s.country.toLowerCase().includes(countryLc) || countryLc.includes(s.country.toLowerCase()))
      : [];

    const directCost = impact.direct_cost ?? impact.extra_cost_usd ?? null;
    const riskScore = impact.risk_score != null ? Math.round(impact.risk_score) : null;
    const riskLevel = (impact.severity || selected.severity || 'unknown') as string;
    const affectedOrders = impact.affected_orders ?? null;
    const affectedRoutes = affectedOrders ?? affectedSuppliers.length;

    const tmNews: any[] = Array.isArray(tm.news) ? tm.news : [];
    const alertSources = [
      ...(tm.source_url ? [{ title: tm.event || 'Source article', url: tm.source_url, source: tm.source || 'Source', published: null as string | null }] : []),
      ...tmNews.map((n) => ({ title: n.title, url: n.url, source: n.domain || 'Source', published: n.scraped_at || null })),
    ];

    // Recommended actions — most important first
    const recs: string[] = [];
    if (advRecommended) recs.push(advRecommended);
    if (topAlt && (!advRecommended || topAlt.supplier_name !== comp.recommended_supplier)) {
      const cd = topAlt.cost_delta_pct;
      recs.push(`Switch sourcing to ${topAlt.supplier_name}${topAlt.country ? ` (${topAlt.country})` : ''}${cd != null ? ` — ${cd > 0 ? '+' : ''}${cd}% cost` : ''}${topAlt.lead_time_weeks != null ? `, ${topAlt.lead_time_weeks}-week lead time` : ''}.`);
    }
    if (Array.isArray(comp.required_documents) && comp.required_documents.length > 0) {
      const docs = comp.required_documents.slice(0, 2).join(', ');
      recs.push(`Prepare customs documentation for ${comp.recommended_country || 'alternative supplier'} (${docs}…).`);
    }
    if (affectedOrders) {
      recs.push(`Recalculate costs for ${affectedOrders} pending order${affectedOrders !== 1 ? 's' : ''} against the new tariff rate.`);
    }

    // Compliance step finding — updated to use new backend schema
    const compFinding = comp.no_viable_option
      ? `BLOCKED — ${comp.reason || 'No viable alternative found'}`
      : comp.recommended_supplier
        ? `Selected ${comp.recommended_supplier} (${comp.recommended_country || ''}), feasibility: ${comp.compliance_feasibility || 'assessed'}`
        : comp.summary ?? (altList.length > 0 ? `Assessed ${altList.length} alternative supplier${altList.length !== 1 ? 's' : ''}` : null);

    const tariffMonitorFinding = ao.tariff_monitor
      ? `${tm.event_type || 'Event'} detected in ${country}${tm.tariff_rate != null ? `, +${tm.tariff_rate}% tariff` : ''} · ${tm.affected_product_name ?? product} · confidence ${tm.confidence != null ? Math.round(tm.confidence * 100) : '?'}% · ${cleanSource(tm.source || tm.risk_source)}`
      : null;

    const steps = [
      {
        key: 'tariff_monitor', name: 'TariffMonitor', done: !!ao.tariff_monitor,
        finding: tariffMonitorFinding,
      },
      {
        key: 'impact_calculator', name: 'ImpactCalculator', done: !!ao.impact_calculator,
        finding: ao.impact_calculator
          ? `Direct cost ${money(directCost)} across ${affectedOrders ?? 0} order(s); severity ${impact.severity}${impact.historical_basis ? ` · ${impact.historical_basis}` : ''}`
          : null,
      },
      {
        key: 'alternatives_finder', name: 'AlternativesFinder', done: altList.length > 0,
        finding: altList.length
          ? `${altList.length} candidate${altList.length !== 1 ? 's' : ''}: ${altList.map((a) => `${a.supplier_name} (${a.country}${a.cost_delta_pct != null ? `, ${a.cost_delta_pct > 0 ? '+' : ''}${a.cost_delta_pct}%` : ''})`).join(' · ')}`
          : null,
      },
      {
        key: 'import_compliance', name: 'ImportCompliance', done: !!ao.import_compliance,
        finding: compFinding,
      },
      {
        key: 'final', name: 'CoastGuard Final Verdict', done: !!adv.verdict, final: true,
        finding: adv.verdict
          ? `${adv.verdict}${adv.confidence != null ? ` (${Math.round(adv.confidence * 100)}% confidence)` : ''} — ${advRecommended || ''}`
          : null,
      },
    ];

    return {
      tm, impact, comp, adv, topAlt, altList,
      country, product, directCost, riskScore, riskLevel,
      affectedSuppliersCount: affectedSuppliers.length,
      affectedRoutes, alertSources,
      relatedNews: news.slice(0, 4),
      recs, steps,
      summaryText: selected.raw.summary || '',
    };
  }, [selected, suppliers, news]);

  const mutate = useCallback(async (id: number, action: 'dismiss' | 'resolve') => {
    setPendingId(id);
    try {
      await api.put(`/v2/alerts/${id}/${action}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    } catch { /* leave in place on failure */ } finally {
      setPendingId(null);
    }
  }, []);

  // ── Derived run labels ─────────────────────────────────────────────────────
  const phaseLabel = useMemo(() => {
    if (!pipelineLogs.length) return null;
    const lastCrew = [...pipelineLogs].reverse().find((e) => e.event === 'crew_start');
    return lastCrew?.msg ?? null;
  }, [pipelineLogs]);

  const liveAgents = useMemo(() => {
    const order = ['tariff_monitor', 'impact_calculator', 'alternatives_finder', 'import_compliance', 'adversarial'];
    const labels: Record<string, string> = {
      tariff_monitor: 'TariffMonitor', impact_calculator: 'ImpactCalculator',
      alternatives_finder: 'AlternativesFinder', import_compliance: 'ImportCompliance',
      adversarial: 'Adversarial',
    };
    const colors: Record<string, string> = {
      tariff_monitor: '#f59e0b', impact_calculator: '#ef4444',
      alternatives_finder: '#14b8a6', import_compliance: '#10b981', adversarial: '#a78bfa',
    };
    return order.map((key) => ({
      key, label: labels[key], color: colors[key], done: !!agentResults[key],
    }));
  }, [agentResults]);

  return (
    <div className="ap-root">
      {/* ── INBOX ─────────────────────────────────────────────────────────── */}
      <aside className="ap-inbox">
        <div className="ap-inbox-header">
          <span className="ap-inbox-title">Incidents</span>
          <span className="ap-inbox-count">{filtered.length}</span>
        </div>

        <button
          className={`ap-run-btn${runPhase === 'running' ? ' ap-run-btn--running' : ''}`}
          onClick={handleRunAnalysis}
          disabled={runPhase === 'running'}
        >
          <span className={`ap-run-dot${runPhase === 'running' ? ' ap-run-dot--live' : ''}`} />
          {runPhase === 'running' ? 'Pipeline Running…' : 'Run New Analysis'}
        </button>

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
              onClick={() => { setRunPhase('idle'); setSelectedId(alert.id); }}
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

      {/* ── MAIN PANEL ────────────────────────────────────────────────────── */}
      <main className="ap-panel">

        {/* ── LIVE PIPELINE VIEW ─────────────────────────────────────────── */}
        {runPhase === 'running' && (
          <div className="ap-live-root">
            {/* Phase header */}
            <div className="ap-live-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="ap-live-pulse" />
                <span className="ap-live-title">LIVE · AI PIPELINE RUNNING</span>
              </div>
              {phaseLabel && <span className="ap-live-phase">{phaseLabel}</span>}
            </div>

            {/* Agent progress stepper */}
            <div className="ap-live-agents">
              {liveAgents.map((ag, i) => (
                <div key={ag.key} className={`ap-live-agent${ag.done ? ' ap-live-agent--done' : ''}`}>
                  <div className="ap-live-agent-rail">
                    <div
                      className="ap-live-agent-node"
                      style={{
                        borderColor: ag.done ? ag.color : 'rgba(150,140,100,0.25)',
                        background: ag.done ? `${ag.color}22` : 'transparent',
                        color: ag.done ? ag.color : 'rgba(150,140,100,0.4)',
                      }}
                    >
                      {ag.done ? '✓' : i + 1}
                    </div>
                    {i < liveAgents.length - 1 && (
                      <div className="ap-live-agent-line" style={{ background: ag.done ? `${ag.color}55` : 'rgba(150,140,100,0.1)' }} />
                    )}
                  </div>
                  <div className="ap-live-agent-body">
                    <span className="ap-live-agent-name" style={{ color: ag.done ? ag.color : 'rgba(150,140,100,0.5)' }}>
                      {ag.label}
                    </span>
                    {ag.done && agentResults[ag.key] && (
                      <span className="ap-live-agent-status">done</span>
                    )}
                    {!ag.done && pipelineLogs.some((e) => e.event === 'agent_start' && e.msg.toLowerCase().includes(ag.label.toLowerCase())) && (
                      <span className="ap-live-agent-running">reasoning…</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Log stream */}
            <div className="ap-live-log">
              <div className="ap-live-log-header">Pipeline Event Log</div>
              <div className="ap-live-log-body">
                {pipelineLogs.map((ev, i) => {
                  if (ev.event === 'agent_result') return null; // hide raw JSON blobs
                  const color = EVENT_COLOR[ev.event] || '#94a3b8';
                  const label = AGENT_LABELS[ev.event] || ev.event;
                  const ts = new Date(ev.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={i} className="ap-live-log-row">
                      <span className="ap-live-log-ts">{ts}</span>
                      <span className="ap-live-log-tag" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>{label}</span>
                      <span className="ap-live-log-msg">{ev.msg}</span>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ── ALERT DETAIL VIEW ──────────────────────────────────────────── */}
        {runPhase !== 'running' && selected && detail && (
          <div className="ap-investigation">
            {/* Header */}
            <div className="ap-inv-header">
              <div className="ap-inv-header-left">
                <span className="ap-inv-label">Incident Report</span>
                <h1 className="ap-inv-title">{selected.title}</h1>
                <p className="ap-inv-sub">
                  {detail.country} · {detail.product} · Detected {absoluteTime(selected.raw.created_at)}
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

            {/* Incident Summary */}
            <section className="ap-section">
              <h2 className="ap-section-title">Incident Summary</h2>
              <div className="ap-prose-card">
                {detail.summaryText && <p className="ap-prose">{detail.summaryText}</p>}
                <div className="ap-context-row" style={detail.summaryText ? undefined : { borderTop: 'none', paddingTop: 0 }}>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Country</span>
                    <span className="ap-context-value">{detail.country}</span>
                  </div>
                  <div className="ap-context-cell">
                    <span className="ap-context-label">Product</span>
                    <span className="ap-context-value">{detail.product}</span>
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
                    <span className="ap-context-label">Intelligence Source</span>
                    <span className="ap-context-value">{cleanSource(detail.tm.source)}</span>
                  </div>
                  {Array.isArray(detail.tm.affected_hs_codes) && detail.tm.affected_hs_codes.length > 0 && (
                    <div className="ap-context-cell">
                      <span className="ap-context-label">HS Codes</span>
                      <span className="ap-context-value">{hsWithDesc(detail.tm.affected_hs_codes)}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Impact Assessment */}
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
                    <span className="ap-metric-sub">tracked in {detail.country}</span>
                  </div>
                  <div className="ap-metric">
                    <span className="ap-metric-label">Affected Routes</span>
                    <span className="ap-metric-value">{detail.affectedRoutes}</span>
                    <span className="ap-metric-sub">orders/shipments at risk</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Agent Reasoning Timeline */}
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
                        {step.finding || 'Not run for this alert.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Source Intelligence */}
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
                  <span className="ap-source-group-label">General Trade Wire · May contain broader market context</span>
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

            {/* Recommended Actions */}
            <section className="ap-section">
              <h2 className="ap-section-title">Recommended Actions</h2>
              <div className="ap-action-card">
                {detail.topAlt ? (
                  <>
                    <div className="ap-action-top">
                      <span className="ap-action-label">Compliance-Selected Supplier</span>
                      <span className="ap-action-supplier">{detail.topAlt.supplier_name}</span>
                      {detail.topAlt.country && <span className="ap-action-country">{detail.topAlt.country}</span>}
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
                        <span className="ap-benefit-label">Adversarial</span>
                        <span className={`ap-benefit-value ap-benefit-value--${(detail.adv.verdict || '').toUpperCase() === 'CLEAR' ? 'green' : (detail.adv.verdict || '').toUpperCase() === 'BLOCK' ? 'red' : 'amber'}`}>
                          {detail.adv.verdict || 'Review'}
                        </span>
                      </div>
                    </div>
                    {detail.topAlt.stability_note && (
                      <p style={{ fontSize: 11, color: 'rgba(180,170,140,0.8)', marginTop: 10, lineHeight: 1.5 }}>
                        {detail.topAlt.stability_note}
                      </p>
                    )}
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
                    {detail.recs.map((r, i) => (
                      <li key={i} className="ap-rec-item"><span className="ap-rec-bullet">▸</span><span>{r}</span></li>
                    ))}
                  </ul>
                )}
              </div>

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
        )}

        {/* ── EMPTY STATE ────────────────────────────────────────────────── */}
        {runPhase !== 'running' && !selected && (
          <div className="ap-empty">
            <div className="ap-empty-icon">◫</div>
            <p className="ap-empty-title">Select an incident</p>
            <p className="ap-empty-sub">Choose an alert from the left panel, or click <strong>Run New Analysis</strong> to trigger a live pipeline run</p>
          </div>
        )}
      </main>
    </div>
  );
}
