import React, { useRef, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';

interface FeedEvent {
  id: string;
  time: string;
  category: 'tariff' | 'sanctions' | 'customs' | 'supplier' | 'disruption';
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  impact?: string;
}

const CATEGORY_COLORS: Record<FeedEvent['category'], string> = {
  tariff:     '#f59e0b',
  sanctions:  '#dc2626',
  customs:    '#14b8a6',
  supplier:   '#10b981',
  disruption: '#ea580c',
};

const CATEGORY_LABELS: Record<FeedEvent['category'], string> = {
  tariff:     'TARIFF',
  sanctions:  'SANCTIONS',
  customs:    'CUSTOMS',
  supplier:   'SUPPLIER',
  disruption: 'DISRUPTION',
};

const MOCK_EVENTS: FeedEvent[] = [
  { id: '1',  time: '14:32', category: 'tariff',     severity: 'critical', impact: '+$40K',  message: 'US imposes 25% tariff on HS 6109.10 Vietnamese textiles — effective immediately' },
  { id: '2',  time: '14:31', category: 'disruption', severity: 'high',     impact: '$28K',   message: 'Mekong Textiles Co factory suspension — 3-week production halt confirmed' },
  { id: '3',  time: '14:29', category: 'customs',    severity: 'medium',   impact: '+7 days', message: 'CBP enhanced scrutiny on Vietnamese origin textiles — expect clearance delays' },
  { id: '4',  time: '14:27', category: 'sanctions',  severity: 'low',                        message: 'OFAC watchlist updated — no direct CoastGuard supplier matches found' },
  { id: '5',  time: '14:25', category: 'supplier',   severity: 'medium',   impact: '$12K',   message: 'Dhaka Garments capacity at 94% — redistribution recommended within 10 days' },
  { id: '6',  time: '14:23', category: 'tariff',     severity: 'low',      impact: '-18%',   message: 'USMCA preferential rate verified for HS 6109.10 via Mexico origin — $0 duty' },
  { id: '7',  time: '14:20', category: 'customs',    severity: 'low',                        message: 'Bangladesh GSP renewal approved — duty-free access extended through 2026' },
  { id: '8',  time: '14:18', category: 'disruption', severity: 'medium',   impact: '$9K',    message: 'Section 301 review expanded to include HS chapter 62 apparel — monitor closely' },
  { id: '9',  time: '14:15', category: 'supplier',   severity: 'low',                        message: 'MexiThread Guadalajara — production capacity confirmed at 18,000 units/month' },
  { id: '10', time: '14:12', category: 'tariff',     severity: 'high',     impact: '+$22K',  message: 'EU anti-dumping duty on synthetic fibres HS 5402 — affecting 3 suppliers' },
  { id: '11', time: '14:09', category: 'sanctions',  severity: 'medium',                     message: 'New Xinjiang supply chain traceability requirement — audit documentation needed' },
  { id: '12', time: '14:05', category: 'customs',    severity: 'low',                        message: 'India FTA tariff preference extended — HS 5205 cotton yarn duty reduced to 0%' },
];

export const EventFeed: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, []);

  return (
    <div style={{
      background: 'rgba(20,20,18,0.9)',
      borderTop: '1px solid rgba(245,158,11,0.08)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        borderBottom: '1px solid rgba(245,158,11,0.06)',
      }}>
        <BarChart2 size={11} color="#f59e0b" />
        <span style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(200,185,140,0.7)',
        }}>
          Global Trade Intelligence Feed
        </span>
        <div style={{
          marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#dc2626',
            animation: 'pulse-dot 1s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>LIVE</span>
          <span style={{ fontSize: 9, color: 'rgba(130,120,90,0.6)', marginLeft: 6 }}>
            {MOCK_EVENTS.length} events
          </span>
        </div>
      </div>

      {/* Scrollable event ticker */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          scrollbarWidth: 'none',
          padding: '0 4px',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 0,
          height: '100%',
        }}>
          {MOCK_EVENTS.map((event, i) => {
            const catColor = CATEGORY_COLORS[event.category];
            const severityColor =
              event.severity === 'critical' ? '#dc2626' :
              event.severity === 'high'     ? '#ea580c' :
              event.severity === 'medium'   ? '#d97706' : '#6b7280';

            return (
              <React.Fragment key={event.id}>
                {i > 0 && (
                  <div style={{
                    width: 1, height: 22,
                    background: 'rgba(245,158,11,0.08)',
                    flexShrink: 0,
                    margin: '0 14px',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  flexShrink: 0,
                  maxWidth: 380,
                }}>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(130,120,90,0.7)',
                    fontFamily: 'JetBrains Mono, monospace',
                    flexShrink: 0,
                  }}>
                    {event.time}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                    color: catColor,
                    background: `${catColor}12`,
                    border: `1px solid ${catColor}22`,
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
                    fontSize: 11, color: 'rgba(220,210,180,0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {event.message}
                  </span>
                  {event.impact && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: event.impact.startsWith('+') ? '#dc2626' : '#10b981',
                      fontFamily: 'JetBrains Mono, monospace',
                      flexShrink: 0,
                      background: event.impact.startsWith('+') ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)',
                      border: `1px solid ${event.impact.startsWith('+') ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      borderRadius: 3,
                      padding: '1px 6px',
                    }}>
                      {event.impact}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
