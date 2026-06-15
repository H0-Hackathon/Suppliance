import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, Search, ShieldCheck, AlertTriangle } from 'lucide-react';

const AGENTS = [
  {
    id: 'tariff',
    name: 'Tariff Monitor',
    desc: 'Scanning HS code changes',
    icon: TrendingUp,
    color: '#38bdf8',
  },
  {
    id: 'impact',
    name: 'Impact Engine',
    desc: 'Calculating cost exposure',
    icon: Zap,
    color: '#a78bfa',
  },
  {
    id: 'alternatives',
    name: 'Alternatives Agent',
    desc: 'Identifying backup suppliers',
    icon: Search,
    color: '#34d399',
  },
  {
    id: 'compliance',
    name: 'Compliance Agent',
    desc: 'Verifying USMCA / trade agreements',
    icon: ShieldCheck,
    color: '#f59e0b',
  },
  {
    id: 'adversarial',
    name: 'Adversarial Validator',
    desc: 'Red-teaming recommendations',
    icon: AlertTriangle,
    color: '#fb7185',
  },
];

export const AgentStatusPanel: React.FC = () => {
  const [ticks, setTicks] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) => {
        const next = { ...prev };
        AGENTS.forEach((a) => {
          next[a.id] = ((prev[a.id] ?? 0) + 1) % 100;
        });
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: 'rgba(13,21,40,0.8)',
      border: '1px solid rgba(56,189,248,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(56,189,248,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 6px #22c55e',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.8)',
        }}>
          AI Agent Status
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9, color: '#22c55e',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
        }}>
          ALL ONLINE
        </span>
      </div>

      {/* Agents */}
      <div style={{ padding: '8px 0' }}>
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const tick = ticks[agent.id] ?? 0;
          const barWidth = 30 + Math.abs(Math.sin(tick / 15)) * 55;

          return (
            <div key={agent.id} style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              {/* Icon */}
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: `${agent.color}18`,
                border: `1px solid ${agent.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} color={agent.color} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: '#e2e8f0',
                  marginBottom: 2, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 9.5, color: 'rgba(100,116,139,0.9)' }}>
                  {agent.desc}
                </div>
                {/* Activity bar */}
                <div style={{
                  marginTop: 4, height: 2,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${agent.color}80, ${agent.color})`,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              {/* Status badge */}
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                color: '#22c55e',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 4,
                padding: '2px 6px',
                flexShrink: 0,
              }}>
                ONLINE
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
