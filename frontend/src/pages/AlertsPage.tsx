import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, TriangleAlert as AlertTriangle, Check, ChevronRight, ExternalLink, ArrowRight, X, Minus } from 'lucide-react';
import { Card } from '../components/common/Card';
import { StatusPill } from '../components/common/StatusPill';
import { ConfidenceBar } from '../components/common/ConfidenceBar';
import api from '../services/api';

const CUSTOMER_ID = 1;

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
    title: tm.event || a.summary || 'Trade risk event',
    country: tm.country || '—',
    sector: tm.product || '—',
    severity: a.severity,
    confidence: tm.confidence != null ? Math.round(tm.confidence * 100) : null,
    timeDetected: relativeTime(a.created_at),
    raw: a,
    ao,
  };
}

const SEV_CONFIG: Record<Severity, { pill: 'critical' | 'warning' | 'neutral'; border: string }> = {
  critical: { pill: 'critical', border: '#E24B4A' },
  high:     { pill: 'warning',  border: '#E0A23B' },
  medium:   { pill: 'warning',  border: '#E0A23B' },
  low:      { pill: 'neutral',  border: '#A89072' },
};

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

  const detail = useMemo(() => {
    if (!selected) return null;
    const ao = selected.ao;
    const tm = ao.tariff_monitor || {};
    const impact = ao.impact_calculator || {};
    const alts = ao.alternatives_finder || {};
    const comp = ao.import_compliance || {};
    const adv = ao.adversarial || {};
    const altRaw: any[] = Array.isArray(alts.alternatives) ? alts.alternatives
      : (Array.isArray(alts.options) ? alts.options : []);
    const altList = altRaw.map((a) => ({
      supplier_name: a.supplier_name || a.supplier || 'Alternative',
      country: a.country_full || a.country || '',
      country_full: a.country_full || a.country || '',
      cost_delta_pct: a.cost_delta_pct,
      lead_time_weeks: a.lead_time_weeks,
    }));
    const topAlt = altList[0];
    const advRecommended = adv.recommended_action || adv.recommendation || null;

    const countryLabel = tm.country || (selected.country !== '—' ? selected.country : 'the affected region');
    const sectorLabel = selected.sector !== '—' ? selected.sector : 'affected goods';
    const countryLc = (tm.country || '').toLowerCase();
    const affectedSuppliers = countryLc
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
      recs.push(`Re-cost ${affectedOrders} affected order(s) for ${sectorLabel} against the ${tm.tariff_rate != null ? `${tm.tariff_rate}% ` : ''}tariff.`);
    }
    if (!topAlt) {
      recs.push(`Run the full agent pipeline (real-LLM mode) to source compliant alternatives for ${countryLabel}.`);
    }
    if (advRecommended) recs.unshift(advRecommended);
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
        key: 'final', name: 'Final Recommendation', done: !!advRecommended, final: true,
        finding: advRecommended,
      },
    ];

    return {
      tm, impact, comp, adv, topAlt, countryLabel,
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

  const bg = 'var(--background)';
  const cardBg = 'var(--card)';
  const textMain = 'var(--foreground)';
  const textMuted = 'var(--text-secondary)';
  const borderSoft = 'var(--border-soft)';

  return (
    <div style={{
      marginLeft: 224,
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      color: textMain,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* ── Left Sidebar (Inbox) ── */}
      <aside style={{
        width: 320,
        borderRight: `1px solid ${borderSoft}`,
        display: 'flex',
        flexDirection: 'column',
        background: cardBg,
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Past Events</h2>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: textMuted,
            background: 'rgba(232,226,216,0.06)',
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            {filtered.length}
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${borderSoft}` }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(232,226,216,0.04)',
            border: `1px solid ${borderSoft}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}>
            <Search size={14} color={textMuted} />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textMain,
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                flex: 1,
              }}
            />
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          borderBottom: `1px solid ${borderSoft}`,
          overflowX: 'auto',
        }}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setActiveSeverity(sev)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease-out',
                background: activeSeverity === sev ? 'rgba(84,140,146,0.14)' : 'transparent',
                color: activeSeverity === sev ? '#84D7D8' : textMuted,
              }}
            >
              {sev === 'all' ? 'All' : sev[0].toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: textMuted, fontSize: 13 }}>
              Loading events…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: textMuted, fontSize: 13 }}>
              No active events match your filters
            </div>
          )}
          {filtered.map((alert) => (
            <button
              key={alert.id}
              onClick={() => setSelectedId(alert.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selectedId === alert.id ? 'rgba(84,140,146,0.08)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${selectedId === alert.id ? '#548C92' : 'transparent'}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 14px',
                marginBottom: 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
              onMouseEnter={e => {
                if (selectedId !== alert.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,226,216,0.04)';
                }
              }}
              onMouseLeave={e => {
                if (selectedId !== alert.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: SEV_CONFIG[alert.severity].border,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: textMain, flex: 1, lineHeight: 1.3 }}>
                  {alert.title}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: textMuted, background: 'rgba(232,226,216,0.04)', borderRadius: 4, padding: '1px 6px' }}>{alert.country}</span>
                <span style={{ fontSize: 10, color: textMuted, background: 'rgba(232,226,216,0.04)', borderRadius: 4, padding: '1px 6px' }}>{alert.sector}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: textMuted }}>
                  {alert.confidence != null ? `${alert.confidence}% confidence` : 'AI Trade Monitor'}
                </span>
                <span style={{ fontSize: 10, color: textMuted }}>{alert.timeDetected}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right Panel (Investigation) ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {selected && detail ? (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted }}>
                  Event Report
                </span>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: textMain, margin: '6px 0 4px', lineHeight: 1.2 }}>
                  {selected.title}
                </h1>
                <p style={{ fontSize: 12, color: textMuted, margin: 0 }}>
                  {selected.country} · {selected.sector} · Detected {absoluteTime(selected.raw.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {selected.confidence != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#84D7D8', lineHeight: 1 }}>{selected.confidence}%</div>
                    <div style={{ fontSize: 9, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</div>
                  </div>
                )}
                <StatusPill
                  variant={SEV_CONFIG[selected.severity].pill}
                  label={selected.severity.toUpperCase()}
                />
              </div>
            </div>

            {/* Incident Summary */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginBottom: 10 }}>
                Event Summary
              </h2>
              <Card>
                {detail.summaryText && (
                  <p style={{ fontSize: 14, color: textMain, lineHeight: 1.6, margin: '0 0 12px 0' }}>
                    {detail.summaryText}
                  </p>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px 16px',
                  borderTop: `1px solid ${borderSoft}`,
                  paddingTop: 12,
                }}>
                  {[
                    { label: 'Country', value: selected.country },
                    { label: 'Sector', value: selected.sector },
                    { label: 'Confidence', value: selected.confidence != null ? `${selected.confidence}%` : '—' },
                    { label: 'Event Type', value: detail.tm.event_type || selected.raw.alert_type || '—' },
                    { label: 'Detected', value: absoluteTime(selected.raw.created_at) },
                    { label: 'Source', value: detail.tm.source || selected.raw.alert_type || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: textMain }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Impact Assessment */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginBottom: 10 }}>
                Impact Assessment
              </h2>
              <Card>
                {/* Risk bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted, minWidth: 70 }}>Risk Level</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(232,226,216,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${detail.riskScore ?? (detail.riskLevel === 'high' || detail.riskLevel === 'critical' ? 80 : detail.riskLevel === 'medium' ? 50 : 25)}%`,
                      borderRadius: 3,
                      background: detail.riskLevel === 'critical' || detail.riskLevel === 'high' ? '#E24B4A' : detail.riskLevel === 'medium' ? '#E0A23B' : '#5BA86F',
                      transition: 'width 0.3s ease-out',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: detail.riskLevel === 'critical' || detail.riskLevel === 'high' ? '#E24B4A' : detail.riskLevel === 'medium' ? '#E0A23B' : '#5BA86F', minWidth: 50, textAlign: 'right' }}>
                    {detail.riskLevel.toUpperCase()}
                  </span>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Est. Cost Impact', value: money(detail.directCost), sub: detail.directCost != null ? 'direct duty cost' : 'no matched orders', color: '#E24B4A' },
                    { label: 'Risk Score', value: detail.riskScore != null ? `${detail.riskScore}` : '—', sub: `${detail.riskLevel} severity`, color: textMain },
                    { label: 'Affected Suppliers', value: String(detail.affectedSuppliersCount), sub: `tracked in ${detail.countryLabel}`, color: textMain },
                    { label: 'Affected Routes', value: String(detail.affectedRoutes), sub: 'orders/shipments at risk', color: textMain },
                  ].map(m => (
                    <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>{m.label}</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: m.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                      <span style={{ fontSize: 10, color: textMuted }}>{m.sub}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Agent Reasoning Timeline */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginBottom: 10 }}>
                Agent Reasoning Timeline
              </h2>
              <Card>
                {detail.steps.map((step, i) => (
                  <div key={step.key} style={{ display: 'flex', gap: 12, paddingBottom: i < detail.steps.length - 1 ? 16 : 0, marginBottom: i < detail.steps.length - 1 ? 16 : 0, borderBottom: i < detail.steps.length - 1 ? `1px solid ${borderSoft}` : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: step.done ? 'rgba(91,168,111,0.12)' : 'rgba(232,226,216,0.04)',
                        border: `1.5px solid ${step.done ? '#5BA86F' : textMuted}`,
                        color: step.done ? '#5BA86F' : textMuted,
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {step.done ? <Check size={12} /> : (i + 1)}
                      </div>
                      {i < detail.steps.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: 'rgba(232,226,216,0.06)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: textMain }}>{step.name}</span>
                        {!step.done && <StatusPill variant="neutral" label="Not run" style={{ fontSize: 8, padding: '1px 5px' }} />}
                      </div>
                      <p style={{ fontSize: 12, color: step.done ? textMuted : 'rgba(107,125,130,0.6)', margin: 0, lineHeight: 1.5 }}>
                        {step.finding || 'Not run for this event — run the full pipeline (real-LLM mode) to populate.'}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>

            {/* Source Intelligence */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginBottom: 10 }}>
                Source Intelligence
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.alertSources.length === 0 && detail.relatedNews.length === 0 && (
                  <Card><p style={{ fontSize: 13, color: textMuted, margin: 0 }}>No linked sources for this event.</p></Card>
                )}
                {detail.alertSources.map((s, i) => (
                  <a key={`src-${i}`} href={s.url} target="_blank" rel="noreferrer" style={{
                    display: 'block',
                    padding: '12px 16px',
                    background: cardBg,
                    border: `1px solid ${borderSoft}`,
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: textMain,
                    transition: 'all 0.15s ease-out',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(84,140,146,0.25)';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(40,82,96,0.4)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = borderSoft;
                    (e.currentTarget as HTMLAnchorElement).style.background = cardBg;
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#84D7D8' }}>{s.source}</span>
                      <span style={{ fontSize: 10, color: textMuted }}>{s.published ? relativeTime(s.published) : 'cited'}</span>
                      <ExternalLink size={10} color={textMuted} style={{ marginLeft: 'auto' }} />
                    </div>
                    <span style={{ fontSize: 12, color: textMain, fontWeight: 500 }}>{s.title}</span>
                  </a>
                ))}
                {detail.relatedNews.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginTop: 4 }}>
                    Related trade wire
                  </span>
                )}
                {detail.relatedNews.map((n, i) => (
                  <a key={`rel-${i}`} href={n.url} target="_blank" rel="noreferrer" style={{
                    display: 'block',
                    padding: '12px 16px',
                    background: cardBg,
                    border: `1px solid ${borderSoft}`,
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: textMain,
                    transition: 'all 0.15s ease-out',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(84,140,146,0.25)';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(40,82,96,0.4)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = borderSoft;
                    (e.currentTarget as HTMLAnchorElement).style.background = cardBg;
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#84D7D8' }}>{n.source}</span>
                      <span style={{ fontSize: 10, color: textMuted }}>{n.category}</span>
                      <span style={{ fontSize: 10, color: textMuted }}>{relativeTime(n.published)}</span>
                      <ExternalLink size={10} color={textMuted} style={{ marginLeft: 'auto' }} />
                    </div>
                    <span style={{ fontSize: 12, color: textMain, fontWeight: 500 }}>{n.title}</span>
                  </a>
                ))}
              </div>
            </section>

            {/* Recommended Actions */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, marginBottom: 10 }}>
                Recommended Actions
              </h2>
              <Card>
                {detail.topAlt ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted }}>Switch To</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: textMain }}>{detail.topAlt.supplier_name}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                      <div>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Cost Delta</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: (detail.topAlt.cost_delta_pct ?? 0) <= 0 ? '#5BA86F' : '#E0A23B', display: 'block', marginTop: 2 }}>
                          {detail.topAlt.cost_delta_pct != null ? `${detail.topAlt.cost_delta_pct > 0 ? '+' : ''}${detail.topAlt.cost_delta_pct}%` : '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Lead Time</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginTop: 2 }}>
                          {detail.topAlt.lead_time_weeks != null ? `${detail.topAlt.lead_time_weeks} wks` : '—'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>Verdict</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: (detail.adv.verdict || '').toUpperCase() === 'CLEAR' ? '#5BA86F' : '#E0A23B', display: 'block', marginTop: 2 }}>
                          {detail.adv.verdict || 'Review'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted }}>Recommended</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: textMain, display: 'block', marginTop: 4, lineHeight: 1.4 }}>
                      {detail.recs[0] || 'Review exposure and run full sourcing analysis.'}
                    </span>
                  </div>
                )}

                {detail.recs.length > 0 && (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.recs.slice(detail.topAlt ? 0 : 1).map((r, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: textMain }}>
                        <ArrowRight size={14} color="#548C92" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => mutate(selected.id, 'dismiss')}
                  disabled={pendingId === selected.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(226,75,74,0.08)',
                    border: '1px solid rgba(226,75,74,0.18)',
                    color: '#f5a0a0',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(226,75,74,0.14)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(226,75,74,0.08)'; }}
                >
                  <Minus size={14} /> Dismiss
                </button>
                <button
                  onClick={() => mutate(selected.id, 'resolve')}
                  disabled={pendingId === selected.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(91,168,111,0.08)',
                    border: '1px solid rgba(91,168,111,0.18)',
                    color: '#a8d9b4',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,168,111,0.14)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,168,111,0.08)'; }}
                >
                  <Check size={14} /> Mark Resolved
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            color: textMuted,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, color: 'rgba(232,226,216,0.08)', marginBottom: 16 }}>
              <AlertTriangle size={48} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: textMain, marginBottom: 6 }}>Select an event</p>
            <p style={{ fontSize: 13, color: textMuted }}>Choose an event from the left panel to open the investigation workspace</p>
          </div>
        )}
      </main>
    </div>
  );
}
