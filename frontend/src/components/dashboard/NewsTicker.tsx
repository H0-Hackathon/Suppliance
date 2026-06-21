import React from 'react';
import { Radio, ExternalLink } from 'lucide-react';
import api from '../../services/api';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  category: string;
  published: string | null;
  published_ts: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  Tariffs: '#f59e0b',
  Trade: '#fbbf24',
  Shipping: '#38bdf8',
  'Supply Chain': '#14b8a6',
  Customs: '#a78bfa',
  Manufacturing: '#f97316',
  Geopolitics: '#ef4444',
  Logistics: '#10b981',
};
const catColor = (c: string) => CATEGORY_COLOR[c] || '#94a3b8';

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh every 5 min

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const NewsTicker: React.FC = () => {
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);

  const fetchNews = React.useCallback(async () => {
    try {
      const res = await api.get<{ items: NewsItem[]; fetched_at: number | null }>('/v2/news');
      if (Array.isArray(res.data.items) && res.data.items.length) {
        setItems(res.data.items);
        setUpdatedAt(res.data.fetched_at ?? Date.now() / 1000);
      }
    } catch {
      // backend offline — ticker simply stays empty/hidden
    }
  }, []);

  React.useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  // Hide entirely when there's no real data to show.
  if (items.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly. Speed scales with the
  // number of headlines so reading pace stays roughly constant.
  const loop = [...items, ...items];
  const durationSec = Math.max(40, items.length * 5);

  const renderItem = (it: NewsItem, i: number) => {
    const color = catColor(it.category);
    const rel = relativeTime(it.published_ts);
    return (
      <a
        key={`${it.url}-${i}`}
        href={it.url}
        target="_blank"
        rel="noreferrer"
        className="ticker-item"
        title={`${it.title} — ${it.source}`}
      >
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
          color, background: `${color}1f`, border: `1px solid ${color}40`,
          borderRadius: 3, padding: '1px 5px', flexShrink: 0,
        }}>{it.category}</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: '#e8e3d8', fontWeight: 600, whiteSpace: 'nowrap' }}>{it.title}</span>
        <span style={{ color: 'rgba(150,140,100,0.85)', whiteSpace: 'nowrap' }}>· {it.source}</span>
        {rel && <span style={{ color: 'rgba(120,110,80,0.7)', whiteSpace: 'nowrap' }}>· {rel}</span>}
        <ExternalLink size={9} color="rgba(150,140,100,0.5)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'rgba(245,158,11,0.25)', padding: '0 4px' }}>•</span>
      </a>
    );
  };

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      background: 'rgba(20,20,18,0.95)', borderTop: '1px solid rgba(245,158,11,0.12)',
      overflow: 'hidden',
    }}>
      {/* Live label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: '0 14px', height: '100%',
        background: 'linear-gradient(90deg, rgba(220,38,38,0.18), rgba(220,38,38,0))',
        borderRight: '1px solid rgba(245,158,11,0.1)',
      }}>
        <Radio size={12} color="#ef4444" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: '#fca5a5' }}>LIVE</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(200,185,140,0.85)' }}>TRADE WIRE</span>
      </div>

      {/* Marquee viewport */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="ticker-track"
          style={{
            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
            animation: `ticker-scroll ${durationSec}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {loop.map(renderItem)}
        </div>
        {/* edge fades */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(90deg, rgba(20,20,18,0.95), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(270deg, rgba(20,20,18,0.95), transparent)', pointerEvents: 'none' }} />
      </div>

      {/* Updated stamp */}
      {updatedAt && (
        <div style={{
          flexShrink: 0, padding: '0 12px', fontSize: 8.5,
          color: 'rgba(120,110,80,0.7)', fontFamily: 'JetBrains Mono, monospace',
          borderLeft: '1px solid rgba(245,158,11,0.08)', height: '100%', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981' }} />
          {new Date(updatedAt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Scoped marquee styles */}
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-family: Inter, system-ui, sans-serif;
          text-decoration: none;
          padding: 0 2px;
          transition: opacity 0.15s;
        }
        .ticker-item:hover { opacity: 0.7; }
        .ticker-item:hover span { text-decoration: none; }
      `}</style>
    </div>
  );
};
