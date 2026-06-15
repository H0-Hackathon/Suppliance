import React, { useRef, useEffect } from 'react';
import { Radio } from 'lucide-react';

interface FeedEvent {
  id: string;
  time: string;
  category: 'tariff' | 'port' | 'shipping' | 'customs' | 'supplier';
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

const CATEGORY_COLORS: Record<FeedEvent['category'], string> = {
  tariff:   '#38bdf8',
  port:     '#ef4444',
  shipping: '#a78bfa',
  customs:  '#f59e0b',
  supplier: '#34d399',
};

const CATEGORY_LABELS: Record<FeedEvent['category'], string> = {
  tariff:   'TARIFF',
  port:     'PORT',
  shipping: 'SHIPPING',
  customs:  'CUSTOMS',
  supplier: 'SUPPLIER',
};

const MOCK_EVENTS: FeedEvent[] = [
  { id: '1',  time: '14:32:10', category: 'tariff',   severity: 'critical', message: 'US adds 25% tariff on HS 6109.10 Vietnamese textiles — effective immediately' },
  { id: '2',  time: '14:31:44', category: 'port',     severity: 'high',    message: 'Haiphong Port partial closure — Typhoon Mawar disrupting container operations' },
  { id: '3',  time: '14:30:22', category: 'shipping', severity: 'medium',  message: 'COSCO vessel ETA +72h delay on Trans-Pacific Lane 4 routing' },
  { id: '4',  time: '14:28:55', category: 'customs',  severity: 'low',     message: 'Bangladesh GSP renewal approved — duty-free access extended through 2026' },
  { id: '5',  time: '14:27:18', category: 'supplier', severity: 'medium',  message: 'Dhaka Garments capacity at 94% — consider order redistribution' },
  { id: '6',  time: '14:25:03', category: 'tariff',   severity: 'low',     message: 'USMCA preferential rate verified for HS 6109.10 via Mexico origin' },
  { id: '7',  time: '14:24:11', category: 'port',     severity: 'low',     message: 'Long Beach Port — congestion index 0.72, 2.1 day average dwell time' },
  { id: '8',  time: '14:21:30', category: 'shipping', severity: 'low',     message: 'Maersk updates bunker adjustment factor +3.2% for Q3 2025' },
  { id: '9',  time: '14:19:45', category: 'customs',  severity: 'medium',  message: 'CBP targeting Vietnamese textile shipments for enhanced scrutiny' },
  { id: '10', time: '14:17:02', category: 'supplier', severity: 'low',     message: 'MexiThread Guadalajara — production capacity confirmed at 18,000 units/month' },
  { id: '11', time: '14:15:33', category: 'tariff',   severity: 'high',    message: 'Section 301 review expanded to include HS chapter 62 apparel categories' },
  { id: '12', time: '14:13:20', category: 'port',     severity: 'low',     message: 'Singapore Tuas Port — new automated terminal reduces loading time by 18%' },
];

export const EventFeed: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show latest events
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, []);

  return (
    <div style={{
      background: 'rgba(13,21,40,0.8)',
      border: '1px solid rgba(56,189,248,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(56,189,248,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <Radio size={11} color="#ef4444" />
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.8)',
        }}>
          Live Global Event Stream
        </span>
        <div style={{
          marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#ef4444',
            animation: 'pulse-dot 1s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          scrollbarWidth: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 0,
          animation: 'none',
        }}>
          {MOCK_EVENTS.map((event, i) => {
            const catColor = CATEGORY_COLORS[event.category];
            const severityColor =
              event.severity === 'critical' ? '#ef4444' :
              event.severity === 'high'     ? '#f97316' :
              event.severity === 'medium'   ? '#f59e0b' : '#6b7280';

            return (
              <React.Fragment key={event.id}>
                {i > 0 && (
                  <div style={{
                    width: 1, height: 24,
                    background: 'rgba(56,189,248,0.1)',
                    flexShrink: 0,
                    margin: '0 16px',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                  maxWidth: 340,
                }}>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(100,116,139,0.7)',
                    fontFamily: 'JetBrains Mono, monospace',
                    flexShrink: 0,
                  }}>
                    {event.time}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                    color: catColor,
                    background: `${catColor}15`,
                    border: `1px solid ${catColor}25`,
                    borderRadius: 3,
                    padding: '1px 5px',
                    flexShrink: 0,
                  }}>
                    {CATEGORY_LABELS[event.category]}
                  </span>
                  {event.severity && (
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: severityColor, flexShrink: 0,
                    }} />
                  )}
                  <span style={{
                    fontSize: 11, color: '#cbd5e1',
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
