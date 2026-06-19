import React from 'react';

export interface AgentState {
  status: 'pending' | 'running' | 'done' | 'error';
  output?: Record<string, unknown>;
}

export interface AgentDebugTarget {
  supplier_country: string;
  country_name: string;
  hs_code: string;
  supplier_name?: string | null;
}

export interface AgentDebugPanelProps {
  target?: AgentDebugTarget | null;
  agentStates: Record<string, AgentState>;
  logs: string[];
  targetIndex?: number;
  totalTargets?: number;
}

const AGENT_META: { key: string; label: string; color: string; subtitle: string }[] = [
  { key: 'tariff_monitor',      label: 'TariffMonitor',      color: '#3B82F6', subtitle: 'Scanning live trade news' },
  { key: 'impact_calculator',   label: 'ImpactCalculator',   color: '#F97316', subtitle: 'Calculating cost exposure' },
  { key: 'alternatives_finder', label: 'AlternativesFinder', color: '#10B981', subtitle: 'Finding backup suppliers' },
  { key: 'import_compliance',   label: 'ImportCompliance',   color: '#8B5CF6', subtitle: 'Checking customs docs' },
  { key: 'adversarial',         label: 'Adversarial',        color: '#EF4444', subtitle: 'Stress-testing recommendation' },
];

function agentSummary(key: string, output: Record<string, unknown> | undefined): string | null {
  if (!output) return null;
  switch (key) {
    case 'tariff_monitor': {
      const evt = output.event as string | undefined;
      const rate = output.tariff_rate as number | undefined;
      return evt ? `${evt}${rate != null ? ` (${rate}%)` : ''}` : null;
    }
    case 'impact_calculator': {
      const cost = output.direct_cost as number | undefined;
      const sev = output.severity as string | undefined;
      return cost != null ? `$${cost.toLocaleString()} direct cost · ${sev ?? ''}` : null;
    }
    case 'alternatives_finder': {
      const alts = output.alternatives as unknown[] | undefined;
      const summary = output.recommendation_summary as string | undefined;
      return summary ?? (alts ? `${alts.length} alternative(s) found` : null);
    }
    case 'import_compliance': {
      const countries = output.compliance_by_country
        ? Object.keys(output.compliance_by_country as object)
        : [];
      return countries.length ? `Checked ${countries.join(', ')}` : (output.summary as string | null) ?? null;
    }
    case 'adversarial': {
      const verdict = output.verdict as string | undefined;
      const action = output.recommended_action as string | undefined;
      return verdict ? `${verdict}${action ? ' — ' + action.slice(0, 80) + (action.length > 80 ? '…' : '') : ''}` : null;
    }
    default:
      return null;
  }
}

export const AgentDebugPanel: React.FC<AgentDebugPanelProps> = ({
  target = null,
  agentStates,
  logs,
  targetIndex,
  totalTargets,
}) => {
  const logRef = React.useRef<HTMLDivElement>(null);
  const [showLogs, setShowLogs] = React.useState(true);

  // Auto-scroll log area as new lines arrive
  React.useEffect(() => {
    if (logRef.current && showLogs) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  return (
    <div style={{
      border: '1px solid rgba(56,189,248,0.25)',
      borderRadius: 10,
      background: '#0c1628',
      marginBottom: 20,
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px',
        background: 'rgba(56,189,248,0.07)',
        borderBottom: '1px solid rgba(56,189,248,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
            Agent Debug
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>—</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            {target ? `Scanning ${target.country_name} (${target.hs_code})` : 'Pipeline Run'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#475569' }}>
          {target && targetIndex != null && totalTargets != null
            ? `Target ${targetIndex + 1} of ${totalTargets}`
            : '5 agents'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Agent list */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '12px 0' }}>
          {AGENT_META.map((meta) => {
            const state = agentStates[meta.key] ?? { status: 'pending' };
            const isRunning = state.status === 'running';
            const isDone = state.status === 'done';
            const isError = state.status === 'error';
            const summary = agentSummary(meta.key, state.output);

            return (
              <div key={meta.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '7px 16px',
                opacity: state.status === 'pending' ? 0.4 : 1,
                transition: 'opacity 0.3s',
              }}>
                {/* Status dot */}
                <div style={{ paddingTop: 3, flexShrink: 0 }}>
                  {isDone ? (
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 900 }}>✓</span>
                  ) : isError ? (
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 900 }}>✕</span>
                  ) : (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isRunning ? meta.color : '#334155',
                      animation: isRunning ? 'agent-debug-pulse 0.9s ease-in-out infinite' : 'none',
                    }} />
                  )}
                </div>
                {/* Label */}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600,
                    color: isDone ? '#e2e8f0' : isRunning ? '#f1f5f9' : '#64748b',
                    margin: 0,
                  }}>
                    {meta.label}
                  </p>
                  {isRunning && (
                    <p style={{ fontSize: 10, color: '#38bdf8', margin: '2px 0 0', fontStyle: 'italic' }}>
                      {meta.subtitle}…
                    </p>
                  )}
                  {isDone && summary && (
                    <p style={{
                      fontSize: 10, color: '#64748b', margin: '2px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160,
                    }} title={summary}>
                      {summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Log stream */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#475569', textTransform: 'uppercase' }}>
              Output Log
            </span>
            <button
              onClick={() => setShowLogs((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: '#475569', padding: '2px 6px',
                fontFamily: 'inherit',
              }}
            >
              {showLogs ? '▲ hide' : '▼ show'}
            </button>
          </div>

          {showLogs && (
            <div
              ref={logRef}
              style={{
                height: 180, overflowY: 'auto', padding: '8px 12px',
                background: '#060d1f',
              }}
            >
              {logs.length === 0 ? (
                <p style={{ fontSize: 11, color: '#334155', fontStyle: 'italic', margin: 0 }}>
                  Waiting for agent output…
                </p>
              ) : (
                logs.map((line, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: '#64748b', lineHeight: 1.5,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    padding: '1px 0',
                  }}>
                    <span style={{ color: '#1e3a5f', userSelect: 'none' }}>{String(i + 1).padStart(3, '0')} </span>
                    {line}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes agent-debug-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};

export default AgentDebugPanel;
