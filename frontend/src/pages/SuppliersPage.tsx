import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Factory,
  Mountain,
  Ship,
  Shirt,
  Cpu,
  Package,
  Check,
  Mail,
  ExternalLink,
  Star,
} from 'lucide-react';
import { CountryOutlineIcon } from '../components/common/CountryOutlineIcon';
import { StatusPill } from '../components/common/StatusPill';
import { Card } from '../components/common/Card';

// ── World topojson (public CDN) ───────────────────────────────────────────────
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ── Country → [longitude, latitude] ─────────────────────────────────────────
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'China': [104, 35], 'India': [78, 20], 'Germany': [10, 51],
  'USA': [-100, 38], 'United States': [-100, 38], 'Japan': [138, 36],
  'South Korea': [128, 36], 'Brazil': [-51, -10], 'Italy': [12, 43],
  'France': [2, 46], 'Turkey': [35, 39], 'Vietnam': [106, 16],
  'Bangladesh': [90, 23], 'Pakistan': [70, 30], 'Indonesia': [120, -5],
  'Malaysia': [110, 4], 'Thailand': [101, 15], 'Mexico': [-102, 24],
  'Taiwan': [121, 24], 'Spain': [-4, 40], 'Netherlands': [5, 52],
  'Poland': [20, 52], 'Romania': [25, 46], 'Ukraine': [32, 49],
  'Saudi Arabia': [45, 24], 'UAE': [54, 24], 'Egypt': [30, 27],
  'Kenya': [37, -1], 'Nigeria': [8, 10], 'South Africa': [25, -29],
  'Australia': [134, -25], 'Canada': [-96, 56], 'Morocco': [-7, 32],
  'Argentina': [-64, -34], 'Colombia': [-74, 4], 'Chile': [-71, -30],
  'Peru': [-76, -10], 'Philippines': [122, 13], 'Sri Lanka': [81, 8],
  'Cambodia': [105, 12], 'Ethiopia': [38, 9], 'Ghana': [-1, 8],
  'Tanzania': [35, -6], 'Portugal': [-8, 39], 'Sweden': [18, 62],
  'Switzerland': [8, 47], 'Norway': [10, 62], 'Denmark': [10, 56],
  'Finland': [26, 64], 'Austria': [14, 47], 'Belgium': [4, 51],
  'Czech Republic': [16, 50], 'Hungary': [19, 47], 'Greece': [22, 39],
  'Russia': [60, 55], 'Kazakhstan': [68, 48], 'Georgia': [44, 42],
  'Israel': [35, 31], 'Jordan': [36, 31], 'Qatar': [51, 25],
  'Kuwait': [48, 29], 'Oman': [57, 22], 'Iraq': [44, 33],
  'Algeria': [3, 28], 'Tunisia': [9, 34], 'Libya': [17, 27],
  'Senegal': [-14, 14], 'Uganda': [32, 1],
  'New Zealand': [170, -42], 'Myanmar': [96, 17], 'Nepal': [84, 28],
  'Iran': [53, 32], 'Afghanistan': [67, 33],
  'Ecuador': [-78, -2], 'Bolivia': [-65, -16], 'Paraguay': [-58, -23],
  'Uruguay': [-56, -33], 'Venezuela': [-66, 8], 'Guatemala': [-90, 15],
  'Honduras': [-87, 15], 'Nicaragua': [-85, 13], 'Costa Rica': [-84, 10],
  'Panama': [-80, 9], 'Cuba': [-80, 22], 'Dominican Republic': [-70, 19],
  'Haiti': [-73, 19], 'Jamaica': [-77, 18], 'Trinidad and Tobago': [-61, 11],
  'Bahrain': [50, 26], 'Yemen': [48, 15], 'Syria': [38, 35],
  'Lebanon': [36, 34], 'Cyprus': [33, 35], 'Malta': [14, 36],
  'Iceland': [-19, 65], 'Ireland': [-8, 53], 'United Kingdom': [-2, 54],
  'Bulgaria': [25, 43], 'Croatia': [16, 45], 'Serbia': [21, 44],
  'Slovakia': [19, 49], 'Slovenia': [15, 46], 'Estonia': [25, 59],
  'Latvia': [25, 57], 'Lithuania': [24, 56], 'Belarus': [28, 54],
  'Moldova': [29, 47], 'Albania': [20, 41], 'North Macedonia': [22, 42],
  'Bosnia and Herzegovina': [18, 44], 'Montenegro': [19, 43],
  'Kosovo': [21, 43], 'Uzbekistan': [64, 41], 'Kyrgyzstan': [75, 41],
  'Tajikistan': [71, 39], 'Turkmenistan': [58, 39], 'Azerbaijan': [48, 40],
  'Armenia': [45, 40], 'Mongolia': [105, 47], 'Laos': [103, 18],
  'Brunei': [115, 4], 'Singapore': [104, 1], 'Papua New Guinea': [147, -6],
  'Fiji': [178, -18], 'Cameroon': [12, 4], 'Ivory Coast': [-5, 7], 'Sri Lanka': [81, 8],
  'Sudan': [30, 15], 'Mozambique': [35, -18], 'Madagascar': [47, -20],
  'Angola': [18, -12], 'Zambia': [28, -14], 'Zimbabwe': [30, -20],
  'Malawi': [34, -14], 'Rwanda': [30, -2], 'Burundi': [30, -3],
  'Somalia': [46, 6], 'Djibouti': [43, 12], 'Eritrea': [39, 15],
  'Mauritius': [57, -20], 'Seychelles': [55, -5], 'Botswana': [24, -22],
  'Namibia': [18, -22], 'Lesotho': [28, -30], 'Eswatini': [31, -26],
};

// ── Tooltip types ────────────────────────────────────────────────────────────
interface MapTooltip {
  x: number;
  y: number;
  country: string;
  suppliers: Supplier[];
}

// ── Supplier Map Component ────────────────────────────────────────────────────
function SupplierMap({ suppliers }: { suppliers: Supplier[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<MapTooltip | null>(null);

  const countryGroups = React.useMemo(() => {
    const groups: Record<string, Supplier[]> = {};
    suppliers.forEach(s => {
      if (!groups[s.country]) groups[s.country] = [];
      groups[s.country].push(s);
    });
    Object.values(groups).forEach(arr =>
      arr.sort((a, b) => (b.supplier_rating ?? 0) - (a.supplier_rating ?? 0))
    );
    return groups;
  }, [suppliers]);

  const markers = React.useMemo(() =>
    Object.entries(countryGroups)
      .map(([country, items]) => {
        const coords = COUNTRY_COORDS[country];
        if (!coords) return null;
        return { country, items, count: items.length, coords };
      })
      .filter(Boolean) as { country: string; items: Supplier[]; count: number; coords: [number, number] }[],
    [countryGroups]
  );

  const handleMarkerEnter = (e: React.MouseEvent, country: string, items: Supplier[]) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    let x = e.clientX - rect.left + 14;
    let y = e.clientY - rect.top - 10;
    if (x + 270 > rect.width) x = e.clientX - rect.left - 280;
    if (y + 250 > rect.height) y = rect.height - 260;
    if (y < 36) y = 36;
    setTooltip({ x, y, country, suppliers: items });
  };

  const dotR = (count: number) => Math.min(3.5 + Math.sqrt(count) * 0.9, 11);
  const ringR = (count: number) => Math.min(dotR(count) + 3, 16);

  return (
    <div
      ref={mapRef}
      onMouseLeave={() => setTooltip(null)}
      style={{
        marginBottom: 20,
        background: 'var(--card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 12,
        overflow: 'hidden',
        height: 270,
        position: 'relative',
      }}
    >
      {/* Header bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: 'rgba(30,58,66,0.95)',
        borderBottom: '1px solid var(--border-soft)',
        fontSize: 10,
        fontWeight: 700,
        color: '#5BA86F',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        backdropFilter: 'blur(6px)',
      }}>
        <span style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: '#5BA86F',
          boxShadow: '0 0 8px rgba(91,168,111,0.9)',
          flexShrink: 0,
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
        Supplier Locations
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)' }}>
          {markers.length} countr{markers.length === 1 ? 'y' : 'ies'} · {suppliers.length} loaded · hover dot for details
        </span>
      </div>

      {/* Map */}
      <ComposableMap
        projectionConfig={{ scale: 142, center: [0, 10] }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={5}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(30,58,66,0.4)"
                  stroke="rgba(232,226,216,0.08)"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: 'rgba(40,82,96,0.6)', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map(({ country, items, count, coords }) => (
            <Marker
              key={country}
              coordinates={coords}
              onMouseEnter={(e: React.MouseEvent) => handleMarkerEnter(e, country, items)}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={ringR(count)}
                fill="rgba(91,168,111,0.13)"
                style={{ pointerEvents: 'none', animation: 'pulse-dot 2.5s ease-out infinite' }}
              />
              <circle
                r={dotR(count)}
                fill="#5BA86F"
                stroke="#1E3A42"
                strokeWidth={1.2}
                style={{ filter: 'drop-shadow(0 0 4px rgba(91,168,111,0.7))' }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            zIndex: 100,
            width: 262,
            background: 'var(--card)',
            border: '1px solid rgba(91,168,111,0.22)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            overflow: 'hidden',
            pointerEvents: 'none',
            animation: 'slide-up 0.12s ease',
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(91,168,111,0.06)',
          }}>
            <CountryOutlineIcon countryName={tooltip.country} size={20} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
                {tooltip.country}
              </div>
              <div style={{ fontSize: 10, color: '#5BA86F', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>
                {tooltip.suppliers.length} verified supplier{tooltip.suppliers.length > 1 ? 's' : ''}
              </div>
            </div>
            <span style={{
              marginLeft: 'auto',
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#5BA86F',
              boxShadow: '0 0 6px #5BA86F',
              animation: 'pulse-dot 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
          </div>

          <div style={{ height: 1, background: 'rgba(232,226,216,0.05)' }} />
          <div style={{ padding: '6px 12px 3px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
            Top Suppliers
          </div>
          {tooltip.suppliers.slice(0, 3).map((s, i) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, padding: '7px 12px', borderTop: '1px solid rgba(232,226,216,0.03)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#E0A23B', fontFamily: 'JetBrains Mono, monospace', paddingTop: 1, flexShrink: 0 }}>
                #{i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                  {s.business_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: '#E0A23B', fontWeight: 600 }}>{s.product_category}</span>
                  <span style={{ fontSize: 9, color: 'rgba(232,226,216,0.15)' }}>·</span>
                  <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.business_type ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {s.supplier_rating && (
                    <span style={{ fontSize: 10, color: '#E0A23B', fontWeight: 600 }}>
                      <Star size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                      {s.supplier_rating.toFixed(1)}
                    </span>
                  )}
                  {s.annual_export_volume_usd && (
                    <span style={{ fontSize: 10, color: '#5BA86F', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                      {s.annual_export_volume_usd >= 1e6
                        ? `$${(s.annual_export_volume_usd / 1e6).toFixed(1)}M`
                        : `$${(s.annual_export_volume_usd / 1e3).toFixed(0)}K`}
                    </span>
                  )}
                  {s.lead_time_days && (
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.lead_time_days}d lead</span>
                  )}
                </div>
                {(s.email || s.website) && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.email && (
                      <a href={`mailto:${s.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 9, fontWeight: 600, color: '#E0A23B', background: 'rgba(224,162,59,0.08)', border: '1px solid rgba(224,162,59,0.15)', borderRadius: 4, padding: '2px 7px', textDecoration: 'none', cursor: 'pointer', pointerEvents: 'all' }}>
                        Email
                      </a>
                    )}
                    {s.website && (
                      <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, fontWeight: 600, color: '#84D7D8', background: 'rgba(132,215,216,0.08)', border: '1px solid rgba(132,215,216,0.15)', borderRadius: 4, padding: '2px 7px', textDecoration: 'none', cursor: 'pointer', pointerEvents: 'all' }}>
                        Web
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {tooltip.suppliers.length > 3 && (
            <div style={{ padding: '5px 12px 8px', fontSize: 9, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              +{tooltip.suppliers.length - 3} more in list below
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Types ─────────────────────────────────────────────────────────────────────
interface RegionItem { region: string; supplier_count: number; }
interface CountryItem { country: string; supplier_count: number; }
interface CategoryItem { category: string; supplier_count: number; }
interface Supplier {
  id: number;
  supplier_id: string;
  business_name: string;
  country: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  product_category: string;
  product_list?: string;
  business_type?: string;
  year_established?: number;
  employee_count?: number;
  annual_export_volume_usd?: number;
  min_order_quantity?: string;
  export_markets?: string;
  certifications?: string;
  supplier_rating?: number;
  payment_terms?: string;
  lead_time_days?: number;
}
interface SupplierListResponse {
  suppliers: Supplier[];
  total: number; page: number; per_page: number; total_pages: number;
}

// ── Meta maps (lucide icons, no emoji) ───────────────────────────────────────
const REGION_ICONS: Record<string, React.ReactNode> = {
  'Middle East':        <Globe size={20} />,
  'South Asia':         <Globe size={20} />,
  'Western Europe':     <Factory size={20} />,
  'Eastern Europe':     <Factory size={20} />,
  'Southeast Asia':     <Globe size={20} />,
  'North America':      <Factory size={20} />,
  'South America':      <Mountain size={20} />,
  'Sub-Saharan Africa': <Globe size={20} />,
  'North Africa':       <Globe size={20} />,
  'East Asia':          <Factory size={20} />,
  'Oceania':            <Ship size={20} />,
  'CIS Countries':      <Globe size={20} />,
};

const REGION_META: Record<string, { desc: string }> = {
  'Middle East':        { desc: 'UAE, Saudi Arabia, Qatar & more' },
  'South Asia':         { desc: 'India, Bangladesh, Pakistan & more' },
  'Western Europe':     { desc: 'Germany, France, Netherlands & more' },
  'Eastern Europe':     { desc: 'Poland, Romania, Ukraine & more' },
  'Southeast Asia':     { desc: 'Vietnam, Malaysia, Thailand & more' },
  'North America':      { desc: 'USA, Canada, Mexico & more' },
  'South America':      { desc: 'Brazil, Chile, Colombia & more' },
  'Sub-Saharan Africa': { desc: 'Kenya, Nigeria, Tanzania & more' },
  'North Africa':       { desc: 'Egypt, Morocco, Algeria & more' },
  'East Asia':          { desc: 'China, Japan, South Korea & more' },
  'Oceania':            { desc: 'Australia, New Zealand & more' },
  'CIS Countries':      { desc: 'Russia, Kazakhstan, Georgia & more' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Textiles & Apparel': <Shirt size={18} />,
  'Metals & Minerals': <Package size={18} />,
  'Agriculture & Food Products': <Package size={18} />,
  'Leather Goods': <Package size={18} />,
  'Machinery & Industrial Equipment': <Factory size={18} />,
  'Electronics & Electrical': <Cpu size={18} />,
  'Chemicals & Petrochemicals': <Package size={18} />,
  'Construction Materials': <Package size={18} />,
  'Automotive Parts': <Package size={18} />,
  'Handicrafts & Home Decor': <Package size={18} />,
  'Toys & Games': <Package size={18} />,
  'Paper & Packaging': <Package size={18} />,
  'Cosmetics & Personal Care': <Package size={18} />,
  'Seafood & Marine Products': <Ship size={18} />,
  'Furniture & Wood Products': <Package size={18} />,
  'Sports & Outdoor': <Package size={18} />,
  'Medical & Healthcare': <Package size={18} />,
  'Jewellery & Accessories': <Package size={18} />,
  'Beverages': <Package size={18} />,
  'Jewelry & Gemstones': <Package size={18} />,
};

function fmtVolume(v?: number): string {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          size={13}
          fill={i <= full ? '#E0A23B' : (i === full + 1 && half ? '#E0A23B' : 'none')}
          color={i <= full ? '#E0A23B' : (i === full + 1 && half ? '#E0A23B' : 'var(--text-secondary)')}
          opacity={i === full + 1 && half ? 0.6 : 1}
        />
      ))}
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ s }: { s: Supplier }) {
  const certs = s.certifications ? s.certifications.split(',').map(c => c.trim()).filter(Boolean) : [];
  const products = s.product_list ? s.product_list.split(',').map(p => p.trim()).slice(0, 3) : [];

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #548C92, #84D7D8)', flexShrink: 0 }} />
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3, marginBottom: 3 }}>
            {s.business_name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CountryOutlineIcon countryName={s.country} size={14} />
            {s.city ? `${s.city}, ` : ''}{s.country}
          </div>
        </div>
        {s.business_type && (
          <StatusPill variant="info" label={s.business_type} style={{ fontSize: 8, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }} />
        )}
      </div>

      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <StarRating rating={s.supplier_rating} />
        {s.year_established && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>Est. {s.year_established}</span>}
      </div>

      {products.length > 0 && (
        <div style={{ padding: '8px 16px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {products.map(p => (
            <span key={p} style={{ fontSize: 9, color: 'rgba(232,226,216,0.65)', background: 'rgba(232,226,216,0.04)', border: '1px solid rgba(232,226,216,0.06)', borderRadius: 4, padding: '2px 7px' }}>
              {p}
            </span>
          ))}
        </div>
      )}

      <div style={{ padding: '10px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Export Volume</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#E0A23B', fontFamily: 'JetBrains Mono, monospace' }}>{fmtVolume(s.annual_export_volume_usd)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Lead Time</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Min Order</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{s.min_order_quantity ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Employees</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{s.employee_count?.toLocaleString() ?? '—'}</span>
        </div>
      </div>

      {s.payment_terms && (
        <div style={{ padding: '8px 16px 0', fontSize: 10, color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>Payment · </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.payment_terms}</span>
        </div>
      )}

      {certs.length > 0 && (
        <div style={{ padding: '8px 16px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {certs.slice(0, 3).map(c => (
            <span key={c} style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: 'rgba(132,215,216,0.08)', border: '1px solid rgba(132,215,216,0.14)', color: 'rgba(160,220,220,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {c}
            </span>
          ))}
          {certs.length > 3 && (
            <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: 'rgba(132,215,216,0.08)', border: '1px solid rgba(132,215,216,0.14)', color: 'rgba(160,220,220,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              +{certs.length - 3}
            </span>
          )}
        </div>
      )}

      <div style={{ padding: '10px 16px 14px', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(232,226,216,0.04)', flexWrap: 'wrap' }}>
        {s.email && (
          <a href={`mailto:${s.email}`} style={{ fontSize: 10, fontWeight: 600, color: '#E0A23B', background: 'rgba(224,162,59,0.08)', border: '1px solid rgba(224,162,59,0.18)', borderRadius: 5, padding: '4px 10px', textDecoration: 'none', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={10} /> Email
          </a>
        )}
        {s.website && (
          <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 600, color: '#84D7D8', background: 'rgba(132,215,216,0.07)', border: '1px solid rgba(132,215,216,0.18)', borderRadius: 5, padding: '4px 10px', textDecoration: 'none', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ExternalLink size={10} /> Website
          </a>
        )}
        {s.phone && <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>{s.phone}</span>}
      </div>
    </Card>
  );
}

// ── Step type ────────────────────────────────────────────────────────────────
type Step = 'region' | 'country' | 'category' | 'suppliers';
const STEPS: Step[] = ['region', 'country', 'category', 'suppliers'];
const STEP_LABELS = ['Region', 'Country', 'Category', 'Suppliers'];

export const SuppliersPage: React.FC = () => {
  const [step, setStep] = useState<Step>('region');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [animating, setAnimating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const loadingMoreRef = useRef(false);

  // Load regions once
  useEffect(() => {
    fetch('/api/v2/global-suppliers/regions').then(r => r.json()).then(setRegions).catch(console.error);
  }, []);

  // Load countries when region picked
  useEffect(() => {
    if (!selectedRegion) return;
    setLoading(true);
    fetch(`/api/v2/global-suppliers/countries?region=${encodeURIComponent(selectedRegion)}`)
      .then(r => r.json()).then(d => { setCountries(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedRegion]);

  // Load categories when country picked
  useEffect(() => {
    if (!selectedRegion || !selectedCountry) return;
    setLoading(true);
    fetch(`/api/v2/global-suppliers/categories?region=${encodeURIComponent(selectedRegion)}&country=${encodeURIComponent(selectedCountry)}`)
      .then(r => r.json()).then(d => { setCategories(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedRegion, selectedCountry]);

  // Load first page of suppliers
  useEffect(() => {
    if (!selectedRegion || !selectedCountry || !selectedCategory) return;
    setLoading(true);
    setPage(1); pageRef.current = 1;
    setSuppliers([]);
    fetch(buildUrl(1)).then(r => r.json()).then((data: SupplierListResponse) => {
      setSuppliers(data.suppliers);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      totalPagesRef.current = data.total_pages;
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedRegion, selectedCountry, selectedCategory]);

  const buildUrl = (p: number) =>
    `/api/v2/global-suppliers?region=${encodeURIComponent(selectedRegion)}&country=${encodeURIComponent(selectedCountry)}&category=${encodeURIComponent(selectedCategory)}&page=${p}&per_page=6`;

  // Infinite scroll via IntersectionObserver
  const fetchNext = useCallback(() => {
    if (loadingMoreRef.current || pageRef.current >= totalPagesRef.current) return;
    const next = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetch(buildUrl(next)).then(r => r.json()).then((data: SupplierListResponse) => {
      setSuppliers(prev => [...prev, ...data.suppliers]);
      pageRef.current = next;
      setPage(next);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }).catch(() => { loadingMoreRef.current = false; setLoadingMore(false); });
  }, [selectedRegion, selectedCountry, selectedCategory]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchNext();
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [fetchNext]);

  const goTo = (next: Step) => {
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 200);
  };

  const pickRegion = (r: string) => { setSelectedRegion(r); goTo('country'); };
  const pickCountry = (c: string) => { setSelectedCountry(c); goTo('category'); };
  const pickCategory = (c: string) => { setSelectedCategory(c); goTo('suppliers'); };

  const back = () => {
    if (step === 'country')   { setSelectedRegion('');   goTo('region');    }
    if (step === 'category')  { setSelectedCountry('');  goTo('country');   }
    if (step === 'suppliers') { setSelectedCategory(''); goTo('category'); }
  };

  const stepIndex = STEPS.indexOf(step);

  const pageBg = 'var(--background)';
  const textMain = 'var(--foreground)';
  const textMuted = 'var(--text-secondary)';
  const accent = '#548C92';
  const accentGlow = 'rgba(84,140,146,0.3)';
  const safe = '#5BA86F';

  return (
    <div style={{
      marginLeft: 224,
      minHeight: '100vh',
      background: pageBg,
      display: 'flex',
      flexDirection: 'column',
      padding: '0 0 80px 0',
      color: textMain,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '28px 36px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {step !== 'region' && (
            <button
              onClick={back}
              style={{
                background: 'rgba(84,140,146,0.08)',
                border: '1px solid rgba(84,140,146,0.2)',
                color: '#84D7D8',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                padding: '8px 14px',
                borderRadius: 7,
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(84,140,146,0.15)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(84,140,146,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(84,140,146,0.08)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(84,140,146,0.2)'; }}
            >
              <ArrowLeft size={12} /> Back
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: textMain, letterSpacing: '-0.4px', lineHeight: 1.2, margin: '0 0 4px 0' }}>
              {step === 'region'    && 'Global Supplier Directory'}
              {step === 'country'   && (
                <>
                  <span style={{ color: accent }}>{selectedRegion}</span> · Select Country
                </>
              )}
              {step === 'category'  && (
                <>
                  <span style={{ color: accent }}>{selectedCountry}</span> · Select Category
                </>
              )}
              {step === 'suppliers' && (
                <>
                  <span style={{ color: accent }}>{selectedCategory}</span>
                </>
              )}
            </h1>
            <p style={{ fontSize: 12, color: textMuted, margin: 0 }}>
              {step === 'region'    && 'Choose an export market to explore verified global suppliers'}
              {step === 'country'   && `${countries.length} countries supplying to ${selectedRegion}`}
              {step === 'category'  && `${categories.length} categories from ${selectedCountry} → ${selectedRegion}`}
              {step === 'suppliers' && `${total.toLocaleString()} verified suppliers · ${selectedCountry} → ${selectedRegion}`}
            </p>
          </div>
        </div>
        {step === 'suppliers' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(91,168,111,0.07)',
            border: '1px solid rgba(91,168,111,0.15)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 11,
            color: '#a8d9b4',
            fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: safe,
              boxShadow: `0 0 6px ${safe}`,
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            {suppliers.length} / {total.toLocaleString()} loaded
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px 36px 24px' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: s === step ? accent : (i < stepIndex ? safe : textMuted),
              transition: 'color 0.2s ease-out',
            }}>
              <div style={{
                width: 22, height: 22,
                borderRadius: '50%',
                border: `1.5px solid ${s === step ? accent : (i < stepIndex ? safe : textMuted)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                transition: 'all 0.2s ease-out',
                flexShrink: 0,
                background: s === step ? 'rgba(84,140,146,0.12)' : (i < stepIndex ? 'rgba(91,168,111,0.12)' : 'transparent'),
                boxShadow: s === step ? `0 0 10px ${accentGlow}` : 'none',
              }}>
                {i < stepIndex ? <Check size={10} /> : (i + 1)}
              </div>
              <span>{STEP_LABELS[i]}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: 'rgba(232,226,216,0.05)', margin: '0 10px', maxWidth: 60 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div style={{
        padding: '0 36px',
        flex: 1,
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(4px)' : 'translateY(0)',
        transition: 'all 0.18s ease-out',
      }}>

        {/* Step 1: Regions */}
        {step === 'region' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {regions.map(({ region, supplier_count }) => {
              const m = REGION_META[region] ?? { desc: '' };
              const icon = REGION_ICONS[region] ?? <Globe size={20} />;
              return (
                <button
                  key={region}
                  onClick={() => pickRegion(region)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 12,
                    padding: '20px 18px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease-out',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'Inter, sans-serif',
                    color: textMain,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(84,140,146,0.28)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,82,96,0.6)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-soft)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 10, color: accent }}>{icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textMain, marginBottom: 4 }}>{region}</div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 12, lineHeight: 1.4 }}>{m.desc}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#E0A23B', fontFamily: 'JetBrains Mono, monospace' }}>
                    {supplier_count.toLocaleString()} suppliers
                  </div>
                  <div style={{ position: 'absolute', top: 18, right: 16, fontSize: 16, color: 'rgba(84,140,146,0.2)', transition: 'color 0.15s, transform 0.15s' }}>
                    <ArrowRight size={16} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Countries */}
        {step === 'country' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: textMuted, fontSize: 13, padding: '60px 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(84,140,146,0.15)', borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              Loading countries…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {countries.map(({ country, supplier_count }) => (
                <button
                  key={country}
                  onClick={() => pickCountry(country)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 10,
                    padding: '14px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s ease-out',
                    fontFamily: 'Inter, sans-serif',
                    color: textMain,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(84,140,146,0.28)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,82,96,0.6)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-soft)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  <CountryOutlineIcon countryName={country} size={20} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: textMain, flex: 1 }}>{country}</div>
                  <div style={{ fontSize: 9, color: '#E0A23B', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                    {supplier_count.toLocaleString()} suppliers
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Step 3: Categories */}
        {step === 'category' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: textMuted, fontSize: 13, padding: '60px 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(84,140,146,0.15)', borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              Loading categories…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {categories.map(({ category, supplier_count }) => (
                <button
                  key={category}
                  onClick={() => pickCategory(category)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 10,
                    padding: '16px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease-out',
                    fontFamily: 'Inter, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    color: textMain,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(84,140,146,0.28)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(40,82,96,0.6)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-soft)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: 18, flexShrink: 0, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(84,140,146,0.07)', borderRadius: 8, color: accent }}>
                    {CATEGORY_ICONS[category] ?? <Package size={18} />}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textMain, flex: 1, lineHeight: 1.3 }}>{category}</div>
                  <div style={{ fontSize: 10, color: '#E0A23B', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                    {supplier_count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(84,140,146,0.2)', transition: 'color 0.15s, transform 0.15s' }}>
                    <ArrowRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Step 4: Suppliers */}
        {step === 'suppliers' && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: textMuted, fontSize: 13, padding: '60px 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(84,140,146,0.15)', borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              Loading suppliers…
            </div>
          ) : (
            <>
              {suppliers.length > 0 && <SupplierMap suppliers={suppliers} />}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {suppliers.map(s => <SupplierCard key={s.id} s={s} />)}
              </div>
              <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                {loadingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: textMuted, fontSize: 12 }}>
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(84,140,146,0.15)', borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Loading more suppliers…
                  </div>
                )}
              </div>
              {page >= totalPages && suppliers.length > 0 && (
                <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: safe, fontFamily: 'JetBrains Mono, monospace', paddingBottom: 20 }}>
                  <Check size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  All {total.toLocaleString()} suppliers loaded
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

export default SuppliersPage;
