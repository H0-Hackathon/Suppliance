import React from 'react';

/**
 * MonitorProgress — Simulated 5-agent progress stepper shown while
 * "Run Monitor" is in flight.
 *
 * The backend pipeline (core/crew_monitor_pipeline.py) runs all 5 agents
 * synchronously within a single POST /v2/monitor/run call — there's no
 * status-polling endpoint. This component just advances through the 5
 * agent steps on a timer while that request is pending, so the user sees
 * something other than a spinner during the (sometimes 30s+) wait.
 */

export interface MonitorTarget {
  supplier_country: string;
  country_name: string;
  hs_code: string;
  supplier_name: string | null;
  product_category: string | null;
}

export interface MonitorProgressState {
  targetIndex: number;
  totalTargets: number;
  target: MonitorTarget;
  stepIndex: number;
}

const MONITOR_STEPS = [
  { id: 'tariff_monitor', label: 'TariffMonitor', color: '#3B82F6', description: 'Scanning live trade news for tariff & disruption events' },
  { id: 'impact_calculator', label: 'ImpactCalculator', color: '#F97316', description: 'Estimating cost exposure against pending orders' },
  { id: 'alternatives_finder', label: 'AlternativesFinder', color: '#10B981', description: 'Searching for alternative suppliers' },
  { id: 'import_compliance', label: 'ImportCompliance', color: '#8B5CF6', description: 'Checking import documentation requirements' },
  { id: 'adversarial', label: 'Adversarial', color: '#EF4444', description: 'Stress-testing the recommendation' },
];

export const MonitorProgress: React.FC<{ state: MonitorProgressState }> = ({ state }) => {
  const { targetIndex, totalTargets, target, stepIndex } = state;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <style>{`
        @keyframes monitor-progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
          Scanning {target.country_name} ({target.hs_code})
          {target.supplier_name ? ` — ${target.supplier_name}` : ''}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Target {targetIndex + 1} of {totalTargets}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MONITOR_STEPS.map((step, i) => {
          const isComplete = i < stepIndex;
          const isRunning = i === stepIndex;
          const color = isComplete || isRunning ? step.color : 'var(--border)';

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  marginTop: 3,
                  flexShrink: 0,
                  animation: isRunning ? 'monitor-progress-pulse 1s ease-in-out infinite' : 'none',
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isComplete || isRunning ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {step.label}
                  {isComplete && ' ✓'}
                </p>
                {isRunning && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonitorProgress;
export { MONITOR_STEPS };
