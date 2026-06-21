import React from 'react';
import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TradeGlobe } from '../components/TradeGlobe';
import { Reveal, DriftCard, SoftButton, AmbientLayer } from '../components/motion';
import { MOTION } from '../motion/tokens';

const TIMELINE = [
  { t: 'T+0s',  label: 'Normal monitoring — supply chain clear',                    done: true  },
  { t: 'T+5s',  label: 'Tariff monitor: 25% tariff on HS 6109.10 from Vietnam',   done: true  },
  { t: 'T+8s',  label: 'Impact calculator: $10,000 extra cost on $40k order',     done: true  },
  { t: 'T+20s', label: 'Alternatives finder: 2 backup suppliers identified',       done: false },
  { t: 'T+32s', label: 'Import compliance: USMCA saves $14,025 via Mexico pivot',  done: false },
  { t: 'T+40s', label: 'Adversarial review: validating recommendations…',         done: false },
  { t: 'T+52s', label: 'Final recommendation — awaiting your decision',            done: false },
];

export const DemoPage: React.FC = () => {
  return (
    <main className="page-with-sidebar" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--sand-warm)',
      fontFamily: 'var(--font)',
      position: 'relative',
    }}>
      <AmbientLayer className="hp-ambient" />

      <Reveal style={{ padding: '32px 40px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <AlertTriangle size={20} color="var(--critical)" strokeWidth={1.75} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ocean)', margin: 0, letterSpacing: '-0.02em' }}>
            Scenario demo — Vietnamese textile tariff
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 560 }}>
          US adds 25% tariff to HS 6109.10 · $40,000 order at risk · full analysis pipeline
        </p>
      </Reveal>

      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 24, padding: '28px 40px 40px',
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <motion.div
          style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            minHeight: 420,
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-sm)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.reveal.duration, ease: MOTION.reveal.ease, delay: 0.1 }}
        >
          <TradeGlobe />
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DriftCard index={0} style={{
            background: 'var(--critical-soft)',
            border: '1px solid rgba(181,74,58,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 22px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--critical)', marginBottom: 14 }}>
              Financial exposure
            </div>
            {[
              { label: 'Order value',        value: '$40,000' },
              { label: 'Tariff increase',    value: '+$10,000' },
              { label: 'USMCA savings',      value: '-$14,025', positive: true },
              { label: 'Net exposure',       value: '$85,000',  bold: true },
            ].map(({ label, value, positive, bold }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{
                  fontWeight: bold ? 700 : 500,
                  color: positive ? 'var(--success)' : bold ? 'var(--critical)' : 'var(--ocean)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </DriftCard>

          <DriftCard index={1} hoverLift={false} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 22px',
            flex: 1,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>
              Analysis timeline
            </div>
            {TIMELINE.map(({ t, label, done }) => (
              <div key={t} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 11,
                  color: done ? 'var(--harbor)' : 'var(--text-muted)',
                  fontWeight: 600,
                  minWidth: 44,
                  marginTop: 2,
                }}>
                  {t}
                </span>
                {done
                  ? <CheckCircle size={15} color="var(--success)" style={{ marginTop: 1, flexShrink: 0 }} />
                  : <Clock size={15} color="var(--text-muted)" style={{ marginTop: 1, flexShrink: 0 }} />
                }
                <span style={{ fontSize: 13, color: done ? 'var(--ocean)' : 'var(--text-muted)', lineHeight: 1.5 }}>
                  {label}
                </span>
              </div>
            ))}
          </DriftCard>

          <DriftCard index={2} style={{
            background: 'var(--success-soft)',
            border: '1px solid rgba(61,122,110,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 22px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>
              Recommended action
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Pivot production to MexiThread (Guadalajara). USMCA 0% tariff saves $14,025 vs the Vietnam route.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <SoftButton variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Approve <ArrowRight size={14} />
              </SoftButton>
              <SoftButton variant="ghost" style={{ flex: 1 }}>
                Override
              </SoftButton>
            </div>
          </DriftCard>
        </div>
      </div>
    </main>
  );
};
