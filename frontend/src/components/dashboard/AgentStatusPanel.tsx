import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Search, ShieldCheck, CheckCircle, ChevronDown } from 'lucide-react';

const PIPELINE_STEPS = [
  {
    id: 'monitor',
    label: 'Monitor',
    desc: 'Scanning tariffs, sanctions & trade policy',
    icon: TrendingUp,
    color: '#f59e0b',
    statusLabel: 'ACTIVE',
    statusColor: '#f59e0b',
  },
  {
    id: 'impact',
    label: 'Impact',
    desc: 'Calculating financial exposure per supplier',
    icon: Zap,
    color: '#dc2626',
    statusLabel: 'RUNNING',
    statusColor: '#dc2626',
  },
  {
    id: 'alternatives',
    label: 'Alternatives',
    desc: 'Sourcing backup suppliers by country & HS code',
    icon: Search,
    color: '#14b8a6',
    statusLabel: 'READY',
    statusColor: '#14b8a6',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    desc: 'Verifying USMCA, GSP & FTA eligibility',
    icon: ShieldCheck,
    color: '#10b981',
    statusLabel: 'READY',
    statusColor: '#10b981',
  },
  {
    id: 'validation',
    label: 'Validation',
    desc: 'Red-teaming recommendations for accuracy',
    icon: CheckCircle,
    color: '#6b7280',
    statusLabel: 'IDLE',
    statusColor: '#6b7280',
  },
];

export const AgentStatusPanel: React.FC = () => {
  const [ticks, setTicks] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) => {
        const next = { ...prev };
        PIPELINE_STEPS.forEach((s) => {
          next[s.id] = ((prev[s.id] ?? 0) + 1) % 100;
        });
        return next;
      });
    }, 140);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: 'rgba(20,20,18,0.9)',
      border: '1px solid rgba(245,158,11,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(245,158,11,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: 'rgba(245,158,11,0.04)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#f59e0b',
          boxShadow: '0 0 6px #f59e0b',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(200,185,140,0.8)',
        }}>
          Intelligence Pipeline
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9, color: '#10b981',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
        }}>
          2/5 ACTIVE
        </span>
      </div>

      {/* Pipeline steps */}
      <div style={{ padding: '6px 0' }}>
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const tick = ticks[step.id] ?? 0;
          const isActive = step.statusLabel === 'ACTIVE' || step.statusLabel === 'RUNNING';
          const barWidth = isActive
            ? 30 + Math.abs(Math.sin(tick / 12)) * 60
            : step.statusLabel === 'READY' ? 100 : 0;
          const isLast = idx === PIPELINE_STEPS.length - 1;

          return (
            <div key={step.id}>
              <div style={{
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: isActive ? `${step.color}06` : 'transparent',
                borderLeft: isActive ? `2px solid ${step.color}` : '2px solid transparent',
              }}>
                {/* Step number + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={13} color={step.color} />
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600,
                      color: isActive ? '#e8e3d8' : 'rgba(200,185,140,0.7)',
                    }}>
                      {step.label}
                    </span>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700,
                      letterSpacing: '0.07em',
                      color: step.statusColor,
                      background: `${step.statusColor}15`,
                      border: `1px solid ${step.statusColor}25`,
                      borderRadius: 3,
                      padding: '1px 5px',
                    }}>
                      {step.statusLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(130,120,90,0.9)', marginBottom: 5 }}>
                    {step.desc}
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    height: 2,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      background: isActive
                        ? `linear-gradient(90deg, ${step.color}60, ${step.color})`
                        : step.statusLabel === 'READY'
                        ? `${step.color}40`
                        : 'transparent',
                      borderRadius: 2,
                      transition: isActive ? 'width 0.35s ease' : 'none',
                    }} />
                  </div>
                </div>
              </div>

              {/* Connector arrow between steps */}
              {!isLast && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '1px 0',
                  opacity: 0.3,
                }}>
                  <ChevronDown size={12} color="rgba(245,158,11,0.6)" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
