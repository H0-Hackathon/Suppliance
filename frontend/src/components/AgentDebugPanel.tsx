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
  { key: 'tariff_monitor', label: 'Tariff check', color: '#548C92', subtitle: 'Scanning trade news' },
  { key: 'impact_calculator', label: 'Cost exposure', color: 'var(--driftwood)', subtitle: 'Calculating duty impact' },
  { key: 'alternatives_finder', label: 'Alternate suppliers', color: '#2B5260', subtitle: 'Finding backup origins' },
  { key: 'import_compliance', label: 'Import compliance', color: '#548C92', subtitle: 'Checking customs requirements' },
  { key: 'adversarial', label: 'Second review', color: '#AB9072', subtitle: 'Reviewing recommendation' },
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

  React.useEffect(() => {
    if (logRef.current && showLogs) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  return (
    <div className="ws-run-log" style={{
      border: '1px solid var(--ws-border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--ws-surface)',
      overflow: 'hidden',
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px',
        background: 'var(--ws-bg-elevated)',
        borderBottom: '1px solid var(--ws-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ws-text)' }}>
            Run log
          </span>
          <span style={{ fontSize: 11, color: 'var(--ws-text-muted)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--ws-text-secondary)' }}>
            {target ? `${target.country_name} (${target.hs_code})` : 'Pipeline run'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ws-text-muted)' }}>
          {target && targetIndex != null && totalTargets != null
            ? `Target ${targetIndex + 1} of ${totalTargets}`
            : '5 steps'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--ws-border)', padding: '10px 0' }}>
          {AGENT_META.map((meta) => {
            const state = agentStates[meta.key] ?? { status: 'pending' };
            const isRunning = state.status === 'running';
            const isDone = state.status === 'done';
            const isError = state.status === 'error';
            const summary = agentSummary(meta.key, state.output);

            return (
              <div key={meta.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '6px 14px',
                opacity: state.status === 'pending' ? 0.45 : 1,
              }}>
                <div style={{ paddingTop: 3, flexShrink: 0 }}>
                  {isDone ? (
                    <span style={{ fontSize: 10, color: '#548C92', fontWeight: 700 }}>✓</span>
                  ) : isError ? (
                    <span style={{ fontSize: 10, color: 'var(--critical)', fontWeight: 700 }}>✕</span>
                  ) : (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: isRunning ? meta.color : 'var(--ws-border-strong)',
                    }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 600,
                    color: isDone ? 'var(--ws-text)' : isRunning ? meta.color : 'var(--ws-text-muted)',
                    margin: 0,
                  }}>
                    {meta.label}
                  </p>
                  {isRunning && (
                    <p style={{ fontSize: 10, color: 'var(--ws-text-muted)', margin: '2px 0 0' }}>
                      {meta.subtitle}…
                    </p>
                  )}
                  {isDone && summary && (
                    <p style={{
                      fontSize: 10, color: 'var(--ws-text-muted)', margin: '2px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 150,
                    }} title={summary}>
                      {summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px',
            borderBottom: '1px solid var(--ws-border)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ws-text-secondary)' }}>
              Output
            </span>
            <button
              onClick={() => setShowLogs((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: 'var(--ws-text-muted)', padding: '2px 6px',
                fontFamily: 'inherit',
              }}
            >
              {showLogs ? 'Hide' : 'Show'}
            </button>
          </div>

          {showLogs && (
            <div
              ref={logRef}
              style={{
                height: 160, overflowY: 'auto', padding: '8px 12px',
                background: 'var(--ws-bg)',
              }}
            >
              {logs.length === 0 ? (
                <p style={{ fontSize: 11, color: 'var(--ws-text-muted)', margin: 0 }}>
                  Waiting for run output…
                </p>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className="ap-log-line" style={{
                    fontSize: 11, color: 'var(--ws-text-secondary)', lineHeight: 1.5,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    borderBottom: '1px solid var(--ws-border)',
                    padding: '2px 0',
                  }}>
                    {line}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDebugPanel;
