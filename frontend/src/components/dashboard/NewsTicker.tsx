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
  customerId: number;
  lastRunAt: string | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  Tariffs: '#548C92',
  Trade: '#B4D7D8',
  Shipping: '#6da3a8',
  'Supply Chain': '#548C92',
  Customs: '#AB9072',
  Manufacturing: '#AB9072',
  Geopolitics: 'var(--driftwood)',
  Logistics: '#548C92',
};
const catColor = (c: string) => CATEGORY_COLOR[c] || '#AB9072';

const REFRESH_MS = 5 * 60 * 1000;
const SCROLL_PX_PER_SEC = 70;

function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const NewsTicker: React.FC<NewsTickerProps> = ({ customerId, lastRunAt }) => {
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);
  const [durationSec, setDurationSec] = React.useState(60);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const fetchNews = React.useCallback(async () => {
    try {
      const res = await api.get<{ items: NewsItem[]; fetched_at: number | null }>(
        '/v2/news/pipeline',
        { params: { customer_id: customerId } },
      );
      if (Array.isArray(res.data.items) && res.data.items.length >= 3) {
        setItems(res.data.items);
        setUpdatedAt(res.data.fetched_at ?? Date.now() / 1000);
        return;
      }
    } catch { /* fallback */ }

    try {
      const res = await api.get<{ items: NewsItem[]; fetched_at: number | null }>('/v2/news');
      if (Array.isArray(res.data.items) && res.data.items.length) {
        setItems(res.data.items);
        setUpdatedAt(res.data.fetched_at ?? Date.now() / 1000);
      }
    } catch { /* offline */ }
  }, [customerId]);

  React.useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  React.useEffect(() => {
    if (lastRunAt) fetchNews();
  }, [lastRunAt, fetchNews]);

  React.useLayoutEffect(() => {
    if (!trackRef.current || items.length === 0) return;
    const oneCopyPx = trackRef.current.scrollWidth / 2;
    if (oneCopyPx > 0) {
      setDurationSec(Math.max(20, Math.round(oneCopyPx / SCROLL_PX_PER_SEC)));
    }
  }, [items]);

  if (items.length === 0) return null;

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
        <span className="ticker-cat" style={{ color, borderColor: `${color}40`, background: `${color}18` }}>
          {it.category}
        </span>
        <span style={{ color: 'var(--ws-text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{it.title}</span>
        <span style={{ color: 'var(--ws-text-muted)', whiteSpace: 'nowrap' }}>· {it.source}</span>
        {rel && <span style={{ color: 'var(--ws-text-muted)', whiteSpace: 'nowrap' }}>· {rel}</span>}
        <ExternalLink size={9} color="var(--ws-text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--ws-border)', padding: '0 4px' }}>·</span>
      </a>
    );
  };

  return (
    <div className="ws-ticker">
      <div className="ws-ticker-label">
        <Radio size={12} color="var(--ws-harbor)" />
        <span>Trade news</span>
      </div>

      <div
        className="ws-ticker-viewport"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="ticker-track"
          style={{
            animation: `ticker-scroll ${durationSec}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {loop.map(renderItem)}
        </div>
        <div className="ws-ticker-fade ws-ticker-fade--left" />
        <div className="ws-ticker-fade ws-ticker-fade--right" />
      </div>

      {updatedAt && (
        <div className="ws-ticker-time">
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ws-harbor)' }} />
          {new Date(updatedAt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-family: var(--font);
          text-decoration: none;
          padding: 0 2px;
          transition: opacity 0.15s;
        }
        .ticker-item:hover { opacity: 0.75; }
        .ticker-cat {
          font-size: 10px;
          font-weight: 500;
          border-radius: 4px;
          padding: 2px 6px;
          border: 1px solid;
          flex-shrink: 0;
        }
        .ticker-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
          width: max-content;
          flex-shrink: 0;
          will-change: transform;
        }
      `}</style>
    </div>
  );
};
