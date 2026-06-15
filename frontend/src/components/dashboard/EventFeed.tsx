import React, { useRef, useEffect } from 'react';
import { Radio } from 'lucide-react';

interface FeedEvent {
  id: string;
  time: string;
  category: 'tariff' | 'sanctions' | 'customs' | 'supplier' | 'compliance';
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

const CATEGORY_COLORS: Record<FeedEvent['category'], string> = {
  tariff:     '#d97706',
  sanctions:  '#dc2626',
  customs:    '#ca8a04',
  supplier:   '#10b981',
  compliance: '#0d9488',
};

const CATEGORY_LABELS: Record<FeedEvent['category'], string> = {
  tariff:     'TARIFF',
  sanctions:  'SANCTIONS',
  customs:    'CUSTOMS',
  supplier:   'SUPPLIER',
  compliance: 'COMPLIANCE',
};

const MOCK_EVENTS: FeedEvent[] = [
  { id: '1',  time: '14:32', category: 'tariff',     severity: 'critical', message: 'US adds 34% tariff on HS 6109.10 Vietnamese textiles — effective immediately' },
  { id: '2',  time: '14:31', category: 'sanctions',  severity: 'critical', message: 'Vietnam factory suspension order — Mekong Textiles Co halts operations' },
  { id: '3',  time: '14:29', category: 'tariff',     severity: 'high',    message: 'Section 301 review expanded to HS chapter 62 — apparel categories impacted' },
  { id: '4',  time: '14:27', category: 'customs',    severity: 'medium',  message: 'CBP enhanced scrutiny on Vietnamese textile shipments — +3-5 day clearance' },
  { id: '5',  time: '14:25', category: 'supplier',   severity: 'medium',  message: 'Dhaka Apparel Co capacity at 94% — redistribution recommended' },
  { id: '6',  time: '14:22', category: 'compliance', severity: 'low',     message: 'USMCA preferential rate confirmed for HS 6109.10 via Mexico origin' },
  { id: '7',  time: '14:20', category: 'tariff',     severity: 'low',     message: 'Bangladesh GSP renewal approved — duty-free access extended through 2026' },
  { id: '8',  time: '14:18', category: 'supplier',   severity: 'low',     message: 'MexiThread Guadalajara — 18,000 units/month capacity confirmed available' },
  { id: '9',  time: '14:15', category: 'customs',    severity: 'low',     message: 'Sri Lanka origin verification cleared — Colombo Fabrics duty rate 0%' },
  { id: '10', time: '14:12', category: 'tariff',     severity: 'medium',  message: 'China Section 301 List 4A — Shenzhen electronics components +25% duty' },
  { id: '11', time: '14:09', category: 'compliance', severity: 'medium',  message: 'CTPAT enrollment confirmed for MexiThread — expedited customs processing' },
  { id: '12', time: '14:06', category: 'sanctions',  severity: 'high',    message: 'OFAC alert — new entity designations affecting Southeast Asia textile trade' },
];

export const EventFeed: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, []);

  return (
    <div style={{
      background: 'rgba(14,12,10,0.95)',
      borderTop: '1px solid rgba(245,158,11,0.07)',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
    }}>
      {/* Live label */}
      <div style={{
        padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 6,
        borderRight: '1px solid rgba(245,158,11,0.08)',
        flexShrink: 0, height: '100%',
      }}>
        <Radio size={10} color="#dc2626" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(120,113,108,0.6)',
            whiteSpace: 'nowrap',
          }}>
            Trade Intel
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: '#dc2626',
              animation: 'pulse-dot 1s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8, color: '#dc2626', fontWeight: 700 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Scrollable events */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          scrollbarWidth: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 0,
        }}>
          {MOCK_EVENTS.map((event, i) => {
            const catColor = CATEGORY_COLORS[event.category];
            const severityDot =
              event.severity === 'critical' ? '#dc2626' :
              event.severity === 'high'     ? '#ea580c' :
              event.severity === 'medium'   ? '#ca8a04' : 'rgba(120,113,108,0.4)';

            return (
              <React.Fragment key={event.id}>
                {i > 0 && (
                  <div style={{
                    width: 1, height: 20,
                    background: 'rgba(245,158,11,0.08)',
                    flexShrink: 0, margin: '0 14px',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  flexShrink: 0,
                  maxWidth: 360,
                }}>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(120,113,108,0.5)',
                    fontFamily: 'JetBrains Mono, monospace',
                    flexShrink: 0,
                  }}>
                    {event.time}
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                    color: catColor,
                    background: `${catColor}12`,
                    border: `1px solid ${catColor}22`,
                    borderRadius: 3,
                    padding: '1px 5px',
                    flexShrink: 0,
                  }}>
                    {CATEGORY_LABELS[event.category]}
                  </span>
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: severityDot, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 11, color: '#d6cfc4',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {event.message}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
