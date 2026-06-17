import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import './SuppliersPage.css';

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
  'Senegal': [-14, 14], 'Ivory Coast': [-5, 7], 'Uganda': [32, 1],
  'New Zealand': [170, -42], 'Myanmar': [96, 17], 'Nepal': [84, 28],
  'Sri Lanka': [81, 8], 'Iran': [53, 32], 'Afghanistan': [67, 33],
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
  'Fiji': [178, -18], 'Cameroon': [12, 4], 'Ivory Coast': [-5, 7],
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
  flag: string;
  suppliers: Supplier[];
}

// ── Supplier Map Component ────────────────────────────────────────────────────
function SupplierMap({ suppliers }: { suppliers: Supplier[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<MapTooltip | null>(null);

  // Group suppliers by country, sorted by rating desc
  const countryGroups = React.useMemo(() => {
    const groups: Record<string, Supplier[]> = {};
    suppliers.forEach(s => {
      if (!groups[s.country]) groups[s.country] = [];
      groups[s.country].push(s);
    });
    // Sort each group by rating desc
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
    // Keep tooltip inside map bounds (tooltip ~260px wide, ~240px tall)
    if (x + 270 > rect.width) x = e.clientX - rect.left - 280;
    if (y + 250 > rect.height) y = rect.height - 260;
    if (y < 36) y = 36;
    setTooltip({ x, y, country, flag: getFlag(country), suppliers: items });
  };

  const dotR = (count: number) => Math.min(3.5 + Math.sqrt(count) * 0.9, 11);
  const ringR = (count: number) => Math.min(dotR(count) + 3, 16);

  return (
    <div className="sp-map-wrap" ref={mapRef} onMouseLeave={() => setTooltip(null)}>
      {/* Header bar */}
      <div className="sp-map-label">
        <span className="sp-map-dot-legend" />
        Supplier Locations
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b6a5e' }}>
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
                  fill="#1b1b1e"
                  stroke="#28282c"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#222226', outline: 'none' },
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
              {/* Pulsing outer ring */}
              <circle
                r={ringR(count)}
                fill="rgba(16,185,129,0.13)"
                className="sp-dot-pulse"
                style={{ pointerEvents: 'none' }}
              />
              {/* Core green dot */}
              <circle
                r={dotR(count)}
                fill="#10b981"
                stroke="#0e0e10"
                strokeWidth={1.2}
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.7))' }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Rich hover tooltip */}
      {tooltip && (
        <div
          className="sp-map-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
          onMouseEnter={() => {/* keep open when hovering tooltip */}}
        >
          {/* Tooltip header */}
          <div className="sp-tt-header">
            <span className="sp-tt-flag">{tooltip.flag}</span>
            <div>
              <div className="sp-tt-country">{tooltip.country}</div>
              <div className="sp-tt-count">
                {tooltip.suppliers.length} verified supplier{tooltip.suppliers.length > 1 ? 's' : ''}
              </div>
            </div>
            <span className="sp-tt-live" />
          </div>

          {/* Top suppliers list */}
          <div className="sp-tt-divider" />
          <div className="sp-tt-label">Top Suppliers</div>
          {tooltip.suppliers.slice(0, 3).map((s, i) => (
            <div key={s.id} className="sp-tt-row">
              <div className="sp-tt-rank">#{i + 1}</div>
              <div className="sp-tt-info">
                <div className="sp-tt-name">{s.business_name}</div>
                <div className="sp-tt-meta">
                  <span className="sp-tt-cat">{s.product_category}</span>
                  <span className="sp-tt-sep">·</span>
                  <span className="sp-tt-type">{s.business_type ?? '—'}</span>
                </div>
                <div className="sp-tt-stats">
                  {s.supplier_rating && (
                    <span className="sp-tt-rating">
                      ★ {s.supplier_rating.toFixed(1)}
                    </span>
                  )}
                  {s.annual_export_volume_usd && (
                    <span className="sp-tt-vol">
                      {s.annual_export_volume_usd >= 1e6
                        ? `$${(s.annual_export_volume_usd / 1e6).toFixed(1)}M`
                        : `$${(s.annual_export_volume_usd / 1e3).toFixed(0)}K`}
                    </span>
                  )}
                  {s.lead_time_days && (
                    <span className="sp-tt-lead">{s.lead_time_days}d lead</span>
                  )}
                </div>
                {(s.email || s.website) && (
                  <div className="sp-tt-links">
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="sp-tt-link" onClick={e => e.stopPropagation()}>
                        ✉ Email
                      </a>
                    )}
                    {s.website && (
                      <a
                        href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                        target="_blank" rel="noreferrer"
                        className="sp-tt-link sp-tt-web"
                        onClick={e => e.stopPropagation()}
                      >
                        🌐 Web
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {tooltip.suppliers.length > 3 && (
            <div className="sp-tt-more">+{tooltip.suppliers.length - 3} more in list below</div>
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

// ── Meta maps ─────────────────────────────────────────────────────────────────
const REGION_META: Record<string, { emoji: string; desc: string }> = {
  'Middle East':        { emoji: '🕌', desc: 'UAE, Saudi Arabia, Qatar & more' },
  'South Asia':         { emoji: '🌏', desc: 'India, Bangladesh, Pakistan & more' },
  'Western Europe':     { emoji: '🇪🇺', desc: 'Germany, France, Netherlands & more' },
  'Eastern Europe':     { emoji: '🏰', desc: 'Poland, Romania, Ukraine & more' },
  'Southeast Asia':     { emoji: '🌴', desc: 'Vietnam, Malaysia, Thailand & more' },
  'North America':      { emoji: '🦅', desc: 'USA, Canada, Mexico & more' },
  'South America':      { emoji: '🌿', desc: 'Brazil, Chile, Colombia & more' },
  'Sub-Saharan Africa': { emoji: '🌍', desc: 'Kenya, Nigeria, Tanzania & more' },
  'North Africa':       { emoji: '🏜️', desc: 'Egypt, Morocco, Algeria & more' },
  'East Asia':          { emoji: '⛩️', desc: 'China, Japan, South Korea & more' },
  'Oceania':            { emoji: '🦘', desc: 'Australia, New Zealand & more' },
  'CIS Countries':      { emoji: '❄️', desc: 'Russia, Kazakhstan, Georgia & more' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Textiles & Apparel': '👗', 'Metals & Minerals': '⚙️',
  'Agriculture & Food Products': '🌾', 'Leather Goods': '👜',
  'Machinery & Industrial Equipment': '🏭', 'Electronics & Electrical': '💡',
  'Chemicals & Petrochemicals': '🧪', 'Construction Materials': '🏗️',
  'Automotive Parts': '🚗', 'Handicrafts & Home Decor': '🏺',
  'Toys & Games': '🎮', 'Paper & Packaging': '📦',
  'Cosmetics & Personal Care': '✨', 'Seafood & Marine Products': '🦐',
  'Furniture & Wood Products': '🪑', 'Sports & Outdoor': '⚽',
  'Medical & Healthcare': '💊', 'Jewellery & Accessories': '💎',
  'Beverages': '🍶', 'Jewelry & Gemstones': '💎',
};

const COUNTRY_FLAGS: Record<string, string> = {
  'China': '🇨🇳', 'India': '🇮🇳', 'Germany': '🇩🇪', 'USA': '🇺🇸',
  'United States': '🇺🇸', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Brazil': '🇧🇷', 'Italy': '🇮🇹', 'France': '🇫🇷',
  'Turkey': '🇹🇷', 'Vietnam': '🇻🇳', 'Bangladesh': '🇧🇩',
  'Pakistan': '🇵🇰', 'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾',
  'Thailand': '🇹🇭', 'Mexico': '🇲🇽', 'Taiwan': '🇹🇼',
  'Spain': '🇪🇸', 'Netherlands': '🇳🇱', 'Poland': '🇵🇱',
  'Romania': '🇷🇴', 'Ukraine': '🇺🇦', 'Saudi Arabia': '🇸🇦',
  'UAE': '🇦🇪', 'Egypt': '🇪🇬', 'Kenya': '🇰🇪',
  'Nigeria': '🇳🇬', 'South Africa': '🇿🇦', 'Australia': '🇦🇺',
  'Canada': '🇨🇦', 'Morocco': '🇲🇦', 'Argentina': '🇦🇷',
  'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Peru': '🇵🇪',
  'Philippines': '🇵🇭', 'Sri Lanka': '🇱🇰', 'Cambodia': '🇰🇭',
  'Ethiopia': '🇪🇹', 'Ghana': '🇬🇭', 'Tanzania': '🇹🇿',
  'Portugal': '🇵🇹', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮',
  'Austria': '🇦🇹', 'Belgium': '🇧🇪', 'Czech Republic': '🇨🇿',
  'Hungary': '🇭🇺', 'Greece': '🇬🇷', 'Russia': '🇷🇺',
  'Kazakhstan': '🇰🇿', 'Georgia': '🇬🇪', 'Israel': '🇮🇱',
  'Jordan': '🇯🇴', 'Qatar': '🇶🇦', 'Kuwait': '🇰🇼',
  'Oman': '🇴🇲', 'Iraq': '🇮🇶', 'Iran': '🇮🇷',
  'Algeria': '🇩🇿', 'Tunisia': '🇹🇳', 'Libya': '🇱🇾',
  'Senegal': '🇸🇳', 'Ivory Coast': '🇨🇮', 'Uganda': '🇺🇬',
  'New Zealand': '🇳🇿', 'Myanmar': '🇲🇲', 'Nepal': '🇳🇵',
};

function getFlag(country: string) {
  return COUNTRY_FLAGS[country] || '🏳️';
}

function fmtVolume(v?: number): string {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span style={{ color: '#6b6a5e', fontSize: 11 }}>No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: 13,
          color: i <= full ? '#f59e0b' : (i === full + 1 && half ? '#f59e0b' : '#2a2a2c'),
          opacity: i === full + 1 && half ? 0.6 : 1,
        }}>★</span>
      ))}
      <span style={{ fontSize: 10, color: '#6b6a5e', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ s }: { s: Supplier }) {
  const certs = s.certifications ? s.certifications.split(',').map(c => c.trim()).filter(Boolean) : [];
  const products = s.product_list ? s.product_list.split(',').map(p => p.trim()).slice(0, 3) : [];

  return (
    <div className="sp-card">
      <div className="sp-card-top-bar" />
      <div className="sp-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sp-card-name">{s.business_name}</div>
          <div className="sp-card-location">{getFlag(s.country)} {s.city ? `${s.city}, ` : ''}{s.country}</div>
        </div>
        {s.business_type && <div className="sp-card-type">{s.business_type}</div>}
      </div>

      <div className="sp-card-rating-row">
        <StarRating rating={s.supplier_rating} />
        {s.year_established && <span className="sp-card-est">Est. {s.year_established}</span>}
      </div>

      {products.length > 0 && (
        <div className="sp-card-products">
          {products.map(p => <span key={p} className="sp-product-chip">{p}</span>)}
        </div>
      )}

      <div className="sp-card-stats">
        <div className="sp-stat">
          <span className="sp-stat-label">Export Volume</span>
          <span className="sp-stat-value amber">{fmtVolume(s.annual_export_volume_usd)}</span>
        </div>
        <div className="sp-stat">
          <span className="sp-stat-label">Lead Time</span>
          <span className="sp-stat-value">{s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}</span>
        </div>
        <div className="sp-stat">
          <span className="sp-stat-label">Min Order</span>
          <span className="sp-stat-value">{s.min_order_quantity ?? '—'}</span>
        </div>
        <div className="sp-stat">
          <span className="sp-stat-label">Employees</span>
          <span className="sp-stat-value">{s.employee_count?.toLocaleString() ?? '—'}</span>
        </div>
      </div>

      {s.payment_terms && (
        <div className="sp-payment">
          <span className="sp-stat-label">Payment · </span>
          <span style={{ fontSize: 11, color: '#9ca3a0' }}>{s.payment_terms}</span>
        </div>
      )}

      {certs.length > 0 && (
        <div className="sp-certs">
          {certs.slice(0, 3).map(c => <span key={c} className="sp-cert-badge">{c}</span>)}
          {certs.length > 3 && <span className="sp-cert-badge">+{certs.length - 3}</span>}
        </div>
      )}

      <div className="sp-card-footer">
        {s.email && (
          <a href={`mailto:${s.email}`} className="sp-contact-btn">✉ Email</a>
        )}
        {s.website && (
          <a
            href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
            target="_blank" rel="noreferrer"
            className="sp-contact-btn sp-website-btn"
          >🌐 Website</a>
        )}
        {s.phone && <span className="sp-phone">{s.phone}</span>}
      </div>
    </div>
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

  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-left">
          {step !== 'region' && (
            <button className="sp-back-btn" onClick={back}>← Back</button>
          )}
          <div>
            <h1 className="sp-title">
              {step === 'region'    && 'Global Supplier Directory'}
              {step === 'country'   && <><span className="sp-breadcrumb">{REGION_META[selectedRegion]?.emoji} {selectedRegion}</span> · Select Country</>}
              {step === 'category'  && <><span className="sp-breadcrumb">{getFlag(selectedCountry)} {selectedCountry}</span> · Select Category</>}
              {step === 'suppliers' && <><span className="sp-breadcrumb">{selectedCategory}</span></>}
            </h1>
            <p className="sp-subtitle">
              {step === 'region'    && 'Choose an export market to explore verified global suppliers'}
              {step === 'country'   && `${countries.length} countries supplying to ${selectedRegion}`}
              {step === 'category'  && `${categories.length} categories from ${selectedCountry} → ${selectedRegion}`}
              {step === 'suppliers' && `${total.toLocaleString()} verified suppliers · ${getFlag(selectedCountry)} ${selectedCountry} → ${selectedRegion}`}
            </p>
          </div>
        </div>
        {step === 'suppliers' && (
          <div className="sp-header-badge">
            <span className="sp-badge-dot" />
            {suppliers.length} / {total.toLocaleString()} loaded
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="sp-steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`sp-step${step === s ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}>
              <div className="sp-step-dot">{i < stepIndex ? '✓' : i + 1}</div>
              <span>{STEP_LABELS[i]}</span>
            </div>
            {i < STEPS.length - 1 && <div className="sp-step-line" />}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className={`sp-content${animating ? ' sp-fade-out' : ' sp-fade-in'}`}>

        {/* Step 1: Regions */}
        {step === 'region' && (
          <div className="sp-grid-regions">
            {regions.map(({ region, supplier_count }) => {
              const m = REGION_META[region] ?? { emoji: '🌐', desc: '' };
              return (
                <button key={region} className="sp-region-card" onClick={() => pickRegion(region)}>
                  <div className="sp-region-emoji">{m.emoji}</div>
                  <div className="sp-region-name">{region}</div>
                  <div className="sp-region-desc">{m.desc}</div>
                  <div className="sp-region-count">{supplier_count.toLocaleString()} suppliers</div>
                  <div className="sp-region-arrow">→</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Countries */}
        {step === 'country' && (
          loading ? <div className="sp-loading"><div className="sp-spinner" />Loading countries…</div> : (
            <div className="sp-grid-countries">
              {countries.map(({ country, supplier_count }) => (
                <button key={country} className="sp-country-card" onClick={() => pickCountry(country)}>
                  <div className="sp-country-flag">{getFlag(country)}</div>
                  <div className="sp-country-name">{country}</div>
                  <div className="sp-country-count">{supplier_count.toLocaleString()} suppliers</div>
                  <div className="sp-cat-arrow">→</div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Step 3: Categories */}
        {step === 'category' && (
          loading ? <div className="sp-loading"><div className="sp-spinner" />Loading categories…</div> : (
            <div className="sp-grid-categories">
              {categories.map(({ category, supplier_count }) => (
                <button key={category} className="sp-category-card" onClick={() => pickCategory(category)}>
                  <div className="sp-cat-icon">{CATEGORY_ICONS[category] ?? '📦'}</div>
                  <div className="sp-cat-name">{category}</div>
                  <div className="sp-cat-count">{supplier_count.toLocaleString()}</div>
                  <div className="sp-cat-arrow">→</div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Step 4: Suppliers */}
        {step === 'suppliers' && (
          loading ? <div className="sp-loading"><div className="sp-spinner" />Loading suppliers…</div> : (
            <>
              {/* Map */}
              {suppliers.length > 0 && <SupplierMap suppliers={suppliers} />}

              {/* Cards */}
              <div className="sp-grid-suppliers">
                {suppliers.map(s => <SupplierCard key={s.id} s={s} />)}
              </div>
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                {loadingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6a5e', fontSize: 12 }}>
                    <div className="sp-spinner" />Loading more suppliers…
                  </div>
                )}
              </div>
              {page >= totalPages && suppliers.length > 0 && (
                <div className="sp-end-msg">✓ All {total.toLocaleString()} suppliers loaded</div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

export default SuppliersPage;
