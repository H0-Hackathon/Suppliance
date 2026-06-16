import React from 'react';
import {
  TrendingUp, Zap, Search, ShieldCheck, Gavel,
  CheckCircle2, Loader2, ChevronDown,
} from 'lucide-react';
import type { AgentResults, AgentStatusMap } from '../types/agents';
import { AGENT_CHAIN } from '../types/agents';

type StepStatus = 'done' | 'running' | 'pending';

interface LiveAgentResultsProps {
  agents?: AgentResults;
  agentStatus?: AgentStatusMap;
  supplier?: string | null;
  updatedAt?: string | null;
  live?: boolean;
}

const CHAIN_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  tariff_monitor: { label: 'TariffMonitor', icon: TrendingUp, color: '#f59e0b' },
  impact_calculator: { label: 'ImpactCalculator', icon: Zap, color: '#dc2626' },
  alternatives_finder: { label: 'AlternativesFinder', icon: Search, color: '#14b8a6' },
  import_compliance: { label: 'ImportCompliance', icon: ShieldCheck, color: '#10b981' },
  adversarial: { label: 'Adversarial', icon: Gavel, color: '#a78bfa' },
};

const money = (n?: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);

function stepStatus(key: string, agents: AgentResults, statusMap: AgentStatusMap): StepStatus {
  if (statusMap[key] === 'done' || agents[key]) return 'done';
  if (statusMap[key] === 'running') return 'running';
  return 'pending';
}

function agentDetail(key: string, agents: AgentResults): React.ReactNode {
  const d = agents[key];
  if (!d) return null;

  if (key === 'tariff_monitor') {
    return (
      <>
        {d.event && <div style={{ fontSize: 10.5, color: '#f1f5f9', fontWeight: 600, marginBottom: 6 }}>{String(d.event)}</div>}
        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Country: {String(d.country ?? '—')}</div>
        {d.tariff_rate != null && <div style={{ fontSize: 9.5, color: '#fca5a5' }}>Tariff: +{String(d.tariff_rate)}%</div>}
      </>
    );
  }
  if (key === 'impact_calculator') {
    return (
      <>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>
          {money(d.direct_cost as number ?? d.extra_cost_usd as number)}
        </div>
        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Affected orders: {String(d.affected_orders ?? 0)}</div>
      </>
    );
  }
  if (key === 'alternatives_finder') {
    const alts = Array.isArray(d.alternatives) ? d.alternatives
      : Array.isArray(d.options) ? d.options : [];
    return (
      <>
        {alts.slice(0, 3).map((alt: Record<string, unknown>, i: number) => (
          <div key={i} style={{ fontSize: 9.5, color: '#cbd5e1', marginBottom: 4 }}>
            #{String(alt.rank ?? i + 1)} {String(alt.supplier_name ?? alt.supplier ?? 'Alternative')} ({String(alt.country_full ?? alt.country ?? '')})
          </div>
        ))}
      </>
    );
  }
  if (key === 'import_compliance') {
    const byCountry = (d.compliance_by_country ?? {}) as Record<string, Record<string, unknown>>;
    return (
      <>
        {Object.entries(byCountry).slice(0, 3).map(([code, info]) => (
          <div key={code} style={{ fontSize: 9.5, color: '#cbd5e1', marginBottom: 3 }}>
            {code}: {String(info.overall_compliance_risk ?? 'unknown')} compliance risk
          </div>
        ))}
      </>
    );
  }
  if (key === 'adversarial') {
    return (
      <>
        {(d.recommended_action ?? d.recommendation) && (
          <div style={{ fontSize: 10, color: '#6ee7b7', lineHeight: 1.4 }}>{String(d.recommended_action ?? d.recommendation)}</div>
        )}
        {d.verdict && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4 }}>Verdict: {String(d.verdict)}</div>}
      </>
    );
  }
  return null;
}

export const LiveAgentResults: React.FC<LiveAgentResultsProps> = ({
  agents = {}, agentStatus = {}, updatedAt, live,
}) => {
  const hasAny = AGENT_CHAIN.some((k) => stepStatus(k, agents, agentStatus) !== 'pending');
  const runningKey = AGENT_CHAIN.find((k) => stepStatus(k, agents, agentStatus) === 'running');
  const lastDoneKey = [...AGENT_CHAIN].reverse().find((k) => stepStatus(k, agents, agentStatus) === 'done');
  const autoTarget = runningKey ?? lastDoneKey ?? null;

  const [expandedKey, setExpandedKey] = React.useState<string | null>(autoTarget);
  React.useEffect(() => {
    if (autoTarget) setExpandedKey(autoTarget);
  }, [autoTarget]);

  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div style={{
      background: 'rgba(20,20,18,0.9)',
      border: '1px solid rgba(245,158,11,0.1)',
      borderRadius: 10,
      padding: '11px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11, fontSize: 9, color: 'rgba(150,140,100,0.7)' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: live ? '#dc2626' : hasAny ? '#10b981' : 'rgba(150,140,100,0.5)',
          boxShadow: live || hasAny ? `0 0 6px ${live ? '#dc2626' : '#10b981'}` : 'none',
          animation: live ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.08em', color: live ? '#fca5a5' : hasAny ? '#6ee7b7' : 'rgba(150,140,100,0.7)' }}>
          {live ? 'LIVE — REASONING CHAIN' : hasAny ? 'REASONING CHAIN' : 'AGENT PIPELINE'}
        </span>
        {ts && <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>{ts}</span>}
      </div>

      {!hasAny && (
        <div style={{ fontSize: 10.5, color: 'rgba(130,120,90,0.85)', lineHeight: 1.45 }}>
          Click <strong style={{ color: '#e8e3d8' }}>Run Analysis</strong> to visualize AI reasoning on the globe.
        </div>
      )}

      {AGENT_CHAIN.map((key, idx) => {
        const meta = CHAIN_META[key];
        const status = stepStatus(key, agents, agentStatus);
        const Icon = meta.icon;
        const isExpanded = expandedKey === key && status === 'done';
        const isLast = idx === AGENT_CHAIN.length - 1;
        const lineColor = status === 'done' ? 'rgba(16,185,129,0.5)' : 'rgba(150,140,100,0.18)';

        return (
          <div key={key} style={{ display: 'flex', gap: 9 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              {status === 'done' ? <CheckCircle2 size={20} color="#10b981" />
                : status === 'running' ? <Loader2 size={18} color={meta.color} style={{ animation: 'spin 1s linear infinite' }} />
                  : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(150,140,100,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(150,140,100,0.5)' }}>{idx + 1}</div>}
              {!isLast && <div style={{ flex: 1, width: 2, minHeight: 16, marginTop: 3, background: lineColor }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
              <button
                onClick={() => status === 'done' && setExpandedKey(isExpanded ? null : key)}
                disabled={status !== 'done'}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', padding: '1px 0', textAlign: 'left', cursor: status === 'done' ? 'pointer' : 'default' }}
              >
                <Icon size={12} color={status === 'pending' ? 'rgba(150,140,100,0.5)' : meta.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: status === 'pending' ? 'rgba(150,140,100,0.55)' : '#e8e3d8' }}>{meta.label}</span>
                {status === 'running' && <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.color }}>RUNNING…</span>}
                {status === 'done' && <ChevronDown size={13} color="rgba(150,140,100,0.7)" style={{ marginLeft: 'auto', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
              </button>
              {isExpanded && (
                <div style={{ marginTop: 7, padding: '9px 11px', background: 'rgba(0,0,0,0.18)', border: `1px solid ${meta.color}20`, borderRadius: 8 }}>
                  {agentDetail(key, agents)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export type { AgentResults, AgentStatusMap };
