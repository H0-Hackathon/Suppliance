import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, ArrowRightLeft, ShieldCheck, CheckCircle2, ChevronDown } from 'lucide-react';

// Pipeline stages — rendered as a vertical workflow, not a server rack
const PIPELINE_STAGES = [
  {
    id: 'monitor',
    step: '01',
    label: 'Monitor',
    desc: 'Scanning tariffs, sanctions & supplier feeds',
    icon: Search,
    color: '#d97706',
    status: 'active' as const,
  },
  {
    id: 'impact',
    step: '02',
    label: 'Impact',
    desc: 'Calculating financial exposure per HS code',
    icon: TrendingUp,
    color: '#dc2626',
    status: 'active' as const,
  },
  {
    id: 'alternatives',
    step: '03',
    label: 'Alternatives',
    desc: 'Identifying eligible backup suppliers',
    icon: ArrowRightLeft,
    color: '#0d9488',
    status: 'active' as const,
  },
  {
    id: 'compliance',
    step: '04',
    label: 'Compliance',
    desc: 'Verifying USMCA, FTA & duty eligibility',
    icon: ShieldCheck,
    color: '#ca8a04',
    status: 'active' as const,
  },
  {
    id: 'validation',
    step: '05',
    label: 'Validation',
    desc: 'Red-teaming recommendations for accuracy',
    icon: CheckCircle2,
    color: '#10b981',
    status: 'idle' as const,
  },
];

export const AgentStatusPanel: React.FC = () => {
  const [ticks, setTicks] = useState<Record<string, number>>({});
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) => {
        const next = { ...prev };
        PIPELINE_STAGES.forEach((s) => {
          next[s.id] = ((prev[s.id] ?? 0) + 1) % 100;
        });
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: 'rgba(22,18,9,0.9)',
      border: '1px solid rgba(245,158,11,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 14px',
        borderBottom: '1px solid rgba(245,158,11,0.08)',
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 5px #10b981',
          animation: 'pulse-dot 2.5s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(245,240,232,0.55)',
        }}>
          Analysis Pipeline
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 9,
          color: '#10b981',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
        }}>
          4/5 RUNNING
        </span>
      </div>

      {/* Pipeline stages */}
      <div style={{ padding: '6px 0' }}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const tick = ticks[stage.id] ?? 0;
          const isActive = stage.status === 'active';
          const isExpanded = activeStage === stage.id;
          // Animated progress — active stages oscillate, idle stays low
          const progress = isActive
            ? 30 + Math.abs(Math.sin((tick + idx * 20) / 15)) * 60
            : 15;

          return (
            <div key={stage.id}>
              {/* Connector arrow between steps */}
              {idx > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '1px 0',
                }}>
                  <ChevronDown size={11} color="rgba(120,113,108,0.35)" />
                </div>
              )}

              <div
                onClick={() => setActiveStage(isExpanded ? null : stage.id)}
                style={{
                  margin: '0 8px',
                  padding: '8px 10px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: isExpanded
                    ? `${stage.color}0e`
                    : 'transparent',
                  border: isExpanded
                    ? `1px solid ${stage.color}25`
                    : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {/* Step icon */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                    background: `${stage.color}14`,
                    border: `1px solid ${stage.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={13} color={stage.color} />
                  </div>

                  {/* Label + progress */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 3,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
                          color: `${stage.color}90`, fontWeight: 600,
                        }}>
                          {stage.step}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: isActive ? '#f5f0e8' : 'rgba(120,113,108,0.6)',
                        }}>
                          {stage.label}
                        </span>
                      </div>
                      {/* Status badge */}
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: '0.07em',
                        color: isActive ? stage.color : 'rgba(120,113,108,0.4)',
                        background: isActive ? `${stage.color}12` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isActive ? stage.color + '28' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 3, padding: '1px 5px',
                        flexShrink: 0,
                      }}>
                        {isActive ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </div>

                    {/* Activity bar */}
                    <div style={{
                      height: 2,
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: isActive
                          ? `linear-gradient(90deg, ${stage.color}60, ${stage.color})`
                          : 'rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        transition: 'width 0.35s ease',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: `1px solid ${stage.color}15`,
                    fontSize: 10, color: 'rgba(120,113,108,0.8)',
                    lineHeight: 1.5,
                  }}>
                    {stage.desc}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
