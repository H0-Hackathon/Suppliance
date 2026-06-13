import React from 'react';
import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { TradeGlobe } from '../components/TradeGlobe';

const TIMELINE = [
  { t: 'T+0s',  label: 'Normal monitoring — supply chain clear',                    done: true  },
  { t: 'T+5s',  label: 'TariffMonitor: 25% tariff on HS 6109.10 from Vietnam',      done: true  },
  { t: 'T+8s',  label: 'ImpactCalculator: $10,000 extra cost on $40k order',        done: true  },
  { t: 'T+20s', label: 'AlternativesFinder: 2 backup suppliers identified',          done: false },
  { t: 'T+32s', label: 'ImportCompliance: USMCA saves $14,025 via Mexico pivot',     done: false },
  { t: 'T+40s', label: 'Adversarial: red-teaming recommendations…',                  done: false },
  { t: 'T+52s', label: 'Final recommendation — awaiting your decision',              done: false },
];

export const DemoPage: React.FC = () => {
  return (
    <main className="page-with-sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <AlertTriangle size={18} color="#ef4444" />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>
            Live Demo — Vietnamese Textile Tariff Crisis
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          US adds 25% tariff to HS 6109.10 · $40,000 order at risk · 5-agent pipeline firing
        </p>
      </div>

      {/* Body: globe + timeline */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 20, padding: 24,
        minHeight: 0,
      }}>
        {/* Globe */}
        <div style={{ borderRadius: 12, overflow: 'hidden', minHeight: 420 }}>
          <TradeGlobe />
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Impact card */}
          <div style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '14px 16px',
            fontFamily: 'system-ui, sans-serif',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#ef4444', textTransform: 'uppercase', marginBottom: 10 }}>
              Financial Exposure
            </div>
            {[
              { label: 'Order Value',        value: '$40,000' },
              { label: 'Tariff Increase',    value: '+$10,000' },
              { label: 'USMCA Savings',      value: '-$14,025', positive: true },
              { label: 'Net Exposure',       value: '$85,000',  bold: true },
            ].map(({ label, value, positive, bold }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{
                  fontWeight: bold ? 700 : 500,
                  color: positive ? '#22c55e' : bold ? '#ef4444' : '#1e293b',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Agent timeline */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '14px 16px', flex: 1,
            fontFamily: 'system-ui, sans-serif',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
              Agent Pipeline
            </div>
            {TIMELINE.map(({ t, label, done }) => (
              <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 10,
                  color: done ? '#f59e0b' : '#94a3b8',
                  fontWeight: 700, minWidth: 40, marginTop: 1,
                }}>
                  {t}
                </span>
                {done
                  ? <CheckCircle size={13} color="#22c55e" style={{ marginTop: 1, flexShrink: 0 }} />
                  : <Clock size={13} color="#94a3b8" style={{ marginTop: 1, flexShrink: 0 }} />
                }
                <span style={{ fontSize: 11, color: done ? '#1a202c' : '#94a3b8', lineHeight: 1.4 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div style={{
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 10, padding: '14px 16px',
            fontFamily: 'system-ui, sans-serif',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>
              Recommended Action
            </div>
            <p style={{ fontSize: 11, color: '#1a202c', lineHeight: 1.5, margin: '0 0 12px' }}>
              Pivot production to MexiThread (Guadalajara). USMCA 0% tariff saves $14,025 vs Vietnam route.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1, padding: '8px 0', borderRadius: 6,
                background: '#1e3a5f', color: '#fff',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                Approve <ArrowRight size={12} />
              </button>
              <button style={{
                flex: 1, padding: '8px 0', borderRadius: 6,
                background: 'transparent', color: '#64748b',
                border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer',
              }}>
                Override
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};