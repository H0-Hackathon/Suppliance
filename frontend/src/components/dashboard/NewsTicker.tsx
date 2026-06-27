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

interface NewsTickerProps {
  lastRunAt: string | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  Tariffs: '#E0A23B',
  Trade: '#84D7D8',
  Shipping: '#84D7D8',
  'Supply Chain': '#548C92',
  Customs: '#A89072',
  Manufacturing: '#E0A23B',
  Geopolitics: '#E24B4A',
  Logistics: '#5BA86F',
};
const catColor = (c: string) => CATEGORY_COLOR[c] || '#9DAAAD';

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh every 5 min

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SCROLL_PX_PER_SEC = 70; // constant, readable ticker speed

export const NewsTicker: React.FC<NewsTickerProps> = ({ lastRunAt }) => {
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);
  const [durationSec, setDurationSec] = React.useState(60);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const fetchNews = React.useCallback(async () => {
    // First try pipeline-specific headlines for the authenticated customer
    // (resolved server-side from the Clerk session token)
    try {
      const res = await api.get<{ items: NewsItem[]; fetched_at: number | null }>('/v2/news/pipeline');
      if (Array.isArray(res.data.items) && res.data.items.length >= 3) {
        setItems(res.data.items);
        setUpdatedAt(res.data.fetched_at ?? Date.now() / 1000);
        return;
      }
    } catch {
      // fall through to generic news
    }

    // Fallback: generic trade/supply-chain RSS feed
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

  // Fetch on mount and auto-refresh every 5 min
  React.useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  // Re-fetch pipeline articles whenever a new pipeline run completes
  React.useEffect(() => {
    if (lastRunAt) fetchNews();
  }, [lastRunAt, fetchNews]);

  // Measure the rendered track and derive a duration that yields a constant
  // scroll speed regardless of how many headlines are present. The track holds
  // two copies, so translating by -50% scrolls exactly one copy width.
  React.useLayoutEffect(() => {
    if (!trackRef.current || items.length === 0) return;
    const oneCopyPx = trackRef.current.scrollWidth / 2;
    if (oneCopyPx > 0) {
      setDurationSec(Math.max(20, Math.round(oneCopyPx / SCROLL_PX_PER_SEC)));
    }
  }, [items]);

  // Hide entirely when there's no real data to show.
  if (items.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly.
  const loop = [...items, ...items];

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
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          color, background: `${color}1f`, borderRadius: 5, padding: '2px 6px', flexShrink: 0,
        }}>{it.category}</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: 'var(--foreground)', fontWeight: 600, whiteSpace: 'nowrap' }}>{it.title}</span>
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {it.source}</span>
        {rel && <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>· {rel}</span>}
        <ExternalLink size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--border-soft)', padding: '0 4px' }}>•</span>
      </a>
    );
  };

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      background: 'var(--card)', borderTop: '1px solid var(--border-soft)',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Animated scan-line — a thin pulse of light sweeping the top edge,
          reinforcing "this feed is live" the way a stock ticker glows. */}
      <div className="ticker-scanline" />

      {/* Live label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        padding: '0 16px', height: '100%',
        background: 'linear-gradient(90deg, rgba(132,215,216,0.12), transparent)',
        borderRight: '1px solid var(--border-soft)',
      }}>
        <Radio size={13} color="var(--seafoam)" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--seafoam)' }}>LIVE</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>TRADE WIRE</span>
      </div>

      {/* Marquee viewport */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="ticker-track"
          style={{
            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
            width: 'max-content', flexShrink: 0, willChange: 'transform',
            animation: `ticker-scroll ${durationSec}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {loop.map(renderItem)}
        </div>
        {/* edge fades */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(90deg, var(--card), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(270deg, var(--card), transparent)', pointerEvents: 'none' }} />
      </div>

      {/* Updated stamp */}
      {updatedAt && (
        <div style={{
          flexShrink: 0, padding: '0 14px', fontSize: 11,
          color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace',
          borderLeft: '1px solid var(--border-soft)', height: '100%', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--safe)', boxShadow: '0 0 5px var(--safe)' }} />
          {new Date(updatedAt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Scoped marquee styles */}
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-scanline-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ticker-scanline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          overflow: hidden;
          pointer-events: none;
        }
        .ticker-scanline::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          width: 35%;
          background: linear-gradient(90deg, transparent, var(--seafoam), transparent);
          opacity: 0.55;
          animation: ticker-scanline-sweep 4.5s ease-in-out infinite;
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-family: var(--font);
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
