import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Lock, ArrowRight, Check, Mail, Globe, Star,
  Landmark, Compass, Building2, Church, TreePalm, Mountain, TreePine, Globe2, Sun, Ship, Waves, Snowflake,
  Shirt, Cog, Wheat, ShoppingBag, Factory, Cpu, FlaskConical, HardHat, Car, Palette,
  Gamepad2, Package, Sparkles, Fish, Armchair, Dumbbell, Stethoscope, Gem, CupSoda,
  LucideIcon,
} from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { CountryOutlineIcon } from '../components/common/CountryOutlineIcon';
import { WaveAccent } from '../components/common/WaveAccent';
import { PALETTE } from '../styles/palette';
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
    setTooltip({ x, y, country, suppliers: items });
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
                  fill="#22454E"
                  stroke="rgba(168,144,114,0.18)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#2A525C', outline: 'none' },
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
                fill="rgba(91,168,111,0.13)"
                className="sp-dot-pulse"
                style={{ pointerEvents: 'none' }}
              />
              {/* Core supplier dot */}
              <circle
                r={dotR(count)}
                fill={PALETTE.safe}
                stroke="#16323A"
                strokeWidth={1.2}
                style={{ filter: 'drop-shadow(0 0 5px rgba(91,168,111,0.55))' }}
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
            <span className="sp-tt-flag"><CountryOutlineIcon country={tooltip.country} size={22} color="var(--seafoam)" /></span>
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
                    <span className="sp-tt-rating" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Star size={11} color={PALETTE.warning} fill={PALETTE.warning} strokeWidth={1.5} /> {s.supplier_rating.toFixed(1)}
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
                        <Mail size={12} /> Email
                      </a>
                    )}
                    {s.website && (
                      <a
                        href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                        target="_blank" rel="noreferrer"
                        className="sp-tt-link sp-tt-web"
                        onClick={e => e.stopPropagation()}
                      >
                        <Globe size={12} /> Web
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

// ── Meta maps (Lucide icons — no emoji) ───────────────────────────────────────
const REGION_META: Record<string, { icon: LucideIcon; desc: string }> = {
  'Middle East':        { icon: Landmark,  desc: 'UAE, Saudi Arabia, Qatar & more' },
  'South Asia':         { icon: Compass,   desc: 'India, Bangladesh, Pakistan & more' },
  'Western Europe':     { icon: Building2, desc: 'Germany, France, Netherlands & more' },
  'Eastern Europe':     { icon: Church,    desc: 'Poland, Romania, Ukraine & more' },
  'Southeast Asia':     { icon: TreePalm,  desc: 'Vietnam, Malaysia, Thailand & more' },
  'North America':      { icon: Mountain,  desc: 'USA, Canada, Mexico & more' },
  'South America':      { icon: TreePine,  desc: 'Brazil, Chile, Colombia & more' },
  'Sub-Saharan Africa': { icon: Globe2,    desc: 'Kenya, Nigeria, Tanzania & more' },
  'North Africa':       { icon: Sun,       desc: 'Egypt, Morocco, Algeria & more' },
  'East Asia':          { icon: Ship,      desc: 'China, Japan, South Korea & more' },
  'Oceania':            { icon: Waves,     desc: 'Australia, New Zealand & more' },
  'CIS Countries':      { icon: Snowflake, desc: 'Russia, Kazakhstan, Georgia & more' },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Textiles & Apparel': Shirt, 'Metals & Minerals': Cog,
  'Agriculture & Food Products': Wheat, 'Leather Goods': ShoppingBag,
  'Machinery & Industrial Equipment': Factory, 'Electronics & Electrical': Cpu,
  'Chemicals & Petrochemicals': FlaskConical, 'Construction Materials': HardHat,
  'Automotive Parts': Car, 'Handicrafts & Home Decor': Palette,
  'Toys & Games': Gamepad2, 'Paper & Packaging': Package,
  'Cosmetics & Personal Care': Sparkles, 'Seafood & Marine Products': Fish,
  'Furniture & Wood Products': Armchair, 'Sports & Outdoor': Dumbbell,
  'Medical & Healthcare': Stethoscope, 'Jewellery & Accessories': Gem,
  'Beverages': CupSoda, 'Jewelry & Gemstones': Gem,
};
const categoryIcon = (cat: string): LucideIcon => CATEGORY_ICONS[cat] ?? Package;

function fmtVolume(v?: number): string {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => {
        const lit = i <= full || (i === full + 1 && half);
        return (
          <Star
            key={i}
            size={14}
            color={lit ? PALETTE.warning : 'rgba(157,170,173,0.25)'}
            fill={lit ? PALETTE.warning : 'none'}
            strokeWidth={1.5}
            style={{ opacity: i === full + 1 && half ? 0.55 : 1 }}
          />
        );
      })}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
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
          <div className="sp-card-location" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CountryOutlineIcon country={s.country} size={16} color="var(--clay)" />
            {s.city ? `${s.city}, ` : ''}{s.country}
          </div>
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
          <a href={`mailto:${s.email}`} className="sp-contact-btn"><Mail size={13} /> Email</a>
        )}
        {s.website && (
          <a
            href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
            target="_blank" rel="noreferrer"
            className="sp-contact-btn sp-website-btn"
          ><Globe size={13} /> Website</a>
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
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [accessStatus, setAccessStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  const [step, setStep] = useState<Step>('region');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [exploreAllMode, setExploreAllMode] = useState(false);

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

  // Check access first
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = await getToken();
        if (!token) return setAccessStatus('denied');
        const res = await fetch('/api/v2/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return setAccessStatus('denied');
        const data = await res.json();
        const plan = data.subscription?.plan;
        const status = data.subscription?.status;

        // Allowed if Pro, Trial, or if it's the 149$ plan
        if (status === 'trial' || plan === 'pro' || plan === 'price_pro') {
          setAccessStatus('allowed');
        } else {
          setAccessStatus('denied');
        }
      } catch (e) {
        setAccessStatus('denied');
      }
    };
    checkAccess();
  }, [getToken]);

  // Load regions once or when exploreAllMode changes
  useEffect(() => {
    if (accessStatus !== 'allowed') return;
    const loadRegions = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`/api/v2/global-suppliers/regions?explore_all=${exploreAllMode}`, { headers });
        if (res.ok) setRegions(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    loadRegions();
  }, [accessStatus, exploreAllMode, getToken]);

  // Load countries when region picked
  useEffect(() => {
    if (!selectedRegion) return;
    setLoading(true);
    const loadCountries = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(`/api/v2/global-suppliers/countries?region=${encodeURIComponent(selectedRegion)}&explore_all=${exploreAllMode}`, { headers });
        if (res.ok) setCountries(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadCountries();
  }, [selectedRegion, exploreAllMode, getToken]);

  // Load categories when country picked
  useEffect(() => {
    if (!selectedRegion || !selectedCountry) return;
    setLoading(true);
    
    const loadCats = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        // Pass explore_all=true if exploreAllMode is active
        const url = `/api/v2/global-suppliers/categories?region=${encodeURIComponent(selectedRegion)}&country=${encodeURIComponent(selectedCountry)}&explore_all=${exploreAllMode}`;
        
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadCats();
  }, [selectedRegion, selectedCountry, exploreAllMode, getToken]);

  // Load first page of suppliers
  useEffect(() => {
    if (step !== 'suppliers') return;
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
  }, [selectedRegion, selectedCountry, selectedCategory, step]);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (selectedRegion) params.append('region', selectedRegion);
    if (selectedCountry) params.append('country', selectedCountry);
    if (selectedCategory) params.append('category', selectedCategory);
    params.append('page', p.toString());
    params.append('per_page', '6');
    return `/api/v2/global-suppliers?${params.toString()}`;
  };

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

  if (accessStatus === 'checking') {
    return (
      <div className="sp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="sp-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div className="sp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ background: 'rgba(132,215,216,0.12)', padding: 24, borderRadius: '50%', marginBottom: 24 }}>
          <Lock size={48} color="var(--seafoam)" />
        </div>
        <h2 style={{ color: 'var(--foreground)', marginBottom: 12, fontSize: 24, fontWeight: 700 }}>Pro Feature</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 450, textAlign: 'center', marginBottom: 32, fontSize: 15, lineHeight: 1.6 }}>
          The Global Supplier Directory is available on the Pro plan or during your free trial.
          Upgrade to unlock 25,000+ verified alternative suppliers globally and the Alternative Supplier Finder agent.
        </p>
        <button
          className="btn-accent"
          onClick={() => navigate('/subscription')}
          style={{ padding: '12px 28px', fontSize: 15 }}
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <WaveAccent style={{ top: -16, right: 8, opacity: 0.85, zIndex: -1 }} />
        <div className="sp-header-left">
          {step !== 'region' && (
            <button className="sp-back-btn" onClick={back}>← Back</button>
          )}
          <div>
            <h1 className="sp-title">
              {step === 'region'    && 'Global Supplier Directory'}
              {step === 'country'   && <><span className="sp-breadcrumb">{selectedRegion}</span> · Select Country</>}
              {step === 'category'  && <><span className="sp-breadcrumb" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CountryOutlineIcon country={selectedCountry} size={18} color="var(--seafoam)" /> {selectedCountry}</span> · Select Category</>}
              {step === 'suppliers' && <><span className="sp-breadcrumb">{selectedCategory}</span></>}
            </h1>
            <p className="sp-subtitle">
              {step === 'region'    && 'Choose a region to find suppliers'}
              {step === 'country'   && `${countries.length} countries in ${selectedRegion}`}
              {step === 'category'  && `${categories.length} categories in ${selectedCountry}`}
              {step === 'suppliers' && (selectedRegion ? `${total.toLocaleString()} verified suppliers · ${selectedCountry} → ${selectedRegion}` : `${total.toLocaleString()} verified suppliers globally`)}
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
              <div className="sp-step-dot">{i < stepIndex ? <Check size={13} strokeWidth={3} /> : i + 1}</div>
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
          <>
            <div className="sp-grid-regions">
              {regions.map(({ region, supplier_count }) => {
                const m = REGION_META[region] ?? { icon: Globe2, desc: '' };
                const RegionIcon = m.icon;
                return (
                  <button key={region} className="sp-region-card" onClick={() => pickRegion(region)}>
                    <div className="sp-region-emoji"><RegionIcon size={26} strokeWidth={1.75} color="var(--seafoam)" /></div>
                    <div className="sp-region-name">{region}</div>
                    <div className="sp-region-desc">{m.desc}</div>
                    <div className="sp-region-count">{supplier_count.toLocaleString()} suppliers</div>
                    <div className="sp-region-arrow"><ArrowRight size={16} /></div>
                  </button>
                );
              })}
            </div>
            
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <button
                onClick={() => setExploreAllMode(!exploreAllMode)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(232,226,216,0.05)',
                  border: '1px solid var(--border-soft)',
                  padding: '12px 24px',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(232,226,216,0.09)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(232,226,216,0.05)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
              >
                <Globe2 size={16} />
                {exploreAllMode ? 'Show Only My Profile Categories' : 'Explore All Global Suppliers'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Countries */}
        {step === 'country' && (
          loading ? <div className="sp-loading"><div className="sp-spinner" />Loading countries…</div> : (
            <div className="sp-grid-countries">
              {countries.map(({ country, supplier_count }) => (
                <button key={country} className="sp-country-card" onClick={() => pickCountry(country)}>
                  <div className="sp-country-flag"><CountryOutlineIcon country={country} size={40} color="var(--seafoam)" /></div>
                  <div className="sp-country-name">{country}</div>
                  <div className="sp-country-count">{supplier_count.toLocaleString()} suppliers</div>
                  <div className="sp-cat-arrow"><ArrowRight size={16} /></div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Step 3: Categories */}
        {step === 'category' && (
          loading ? <div className="sp-loading"><div className="sp-spinner" />Loading categories…</div> : (
            <>
              <div className="sp-grid-categories">
                {categories.map(({ category, supplier_count }) => {
                  const CatIcon = categoryIcon(category);
                  return (
                    <button key={category} className="sp-category-card" onClick={() => pickCategory(category)}>
                      <div className="sp-cat-icon"><CatIcon size={24} strokeWidth={1.75} color="var(--seafoam)" /></div>
                      <div className="sp-cat-name">{category}</div>
                      <div className="sp-cat-count">{supplier_count.toLocaleString()}</div>
                      <div className="sp-cat-arrow"><ArrowRight size={16} /></div>
                    </button>
                  );
                })}
              </div>
              
              <div style={{ marginTop: 40, textAlign: 'center' }}>
                <button
                  onClick={() => setExploreAllMode(!exploreAllMode)}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--border-soft)',
                    padding: '10px 20px',
                    borderRadius: 8,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontFamily: 'var(--font)',
                    transition: 'color 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-soft)'; }}
                >
                  {exploreAllMode ? 'Show Only My Profile Categories' : 'Show All Global Categories'}
                </button>
              </div>
            </>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    <div className="sp-spinner" />Loading more suppliers…
                  </div>
                )}
              </div>
              {page >= totalPages && suppliers.length > 0 && (
                <div className="sp-end-msg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Check size={14} strokeWidth={3} /> All {total.toLocaleString()} suppliers loaded
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
