import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Building2, Package, Globe, Tag, ChevronRight, ChevronLeft, Check, Anchor, ChevronDown, Plus, X } from 'lucide-react';
import { Logo } from '../components/common/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* ── Static data ─────────────────────────────────────────────────────────── */

const INDUSTRIES = [
  'Electronics & Semiconductors',
  'Automotive & Auto Parts',
  'Apparel & Textiles',
  'Food & Beverage',
  'Chemicals & Plastics',
  'Medical Devices & Pharma',
  'Industrial Machinery',
  'Furniture & Home Goods',
  'Toys & Consumer Products',
  'Steel & Metals',
  'Agriculture & Commodities',
  'Aerospace & Defense',
  'Energy & Oil',
  'Retail & E-commerce',
  'Logistics & Freight',
];

const COUNTRIES = [
  'China','United States','India','Germany','Japan','South Korea','Vietnam',
  'Taiwan','Mexico','Canada','United Kingdom','France','Italy','Netherlands',
  'Bangladesh','Indonesia','Thailand','Malaysia','Singapore','Brazil',
  'Turkey','Poland','Spain','Australia','Pakistan','Philippines','Cambodia',
  'Sri Lanka','Ethiopia','Egypt','South Africa','Nigeria',
];

const DEST_COUNTRIES = [
  'United States','United Kingdom','Canada','Australia','Germany','France',
  'Netherlands','Japan','South Korea','Singapore','UAE','India','Brazil',
  'Mexico','Italy','Spain','Poland','Sweden','Switzerland','Belgium',
];

const PORTS = {
  'United States': ['Port of Los Angeles','Port of Long Beach','Port of New York','Port of Seattle','Port of Houston','Port of Savannah','Port of Charleston'],
  'United Kingdom': ['Port of Felixstowe','Port of Southampton','Port of London','Port of Liverpool'],
  'Germany': ['Port of Hamburg','Port of Bremen'],
  'Netherlands': ['Port of Rotterdam'],
  'Japan': ['Port of Tokyo','Port of Yokohama','Port of Osaka'],
  'Australia': ['Port of Melbourne','Port of Sydney','Port of Brisbane'],
  'Canada': ['Port of Vancouver','Port of Montreal','Port of Halifax'],
  'Singapore': ['Port of Singapore'],
  'UAE': ['Port of Jebel Ali','Port of Dubai'],
  'India': ['Port of Mumbai','Port of Chennai','Port of Nhava Sheva'],
  'France': ['Port of Le Havre','Port of Marseille'],
};

const REGIONS = [
  'East Asia','Southeast Asia','South Asia','Europe','North America',
  'Latin America','Middle East','Africa','Oceania','Central Asia',
];

const VOLUME_OPTIONS = [
  { label: 'Under $100K',   value: 75000 },
  { label: '$100K – $500K', value: 300000 },
  { label: '$500K – $2M',   value: 1000000 },
  { label: '$2M – $10M',    value: 5000000 },
  { label: '$10M – $50M',   value: 25000000 },
  { label: 'Over $50M',     value: 75000000 },
];

const ORDER_VALUE_OPTIONS = [
  { label: 'Under $5K',    value: 2500 },
  { label: '$5K – $25K',   value: 15000 },
  { label: '$25K – $100K', value: 50000 },
  { label: '$100K – $500K',value: 250000 },
  { label: 'Over $500K',   value: 750000 },
];

const LEAD_TIME_OPTIONS = [
  { label: '1–2 weeks',  value: 10 },
  { label: '3–4 weeks',  value: 25 },
  { label: '1–2 months', value: 45 },
  { label: '2–3 months', value: 75 },
  { label: '3–6 months', value: 120 },
  { label: '6+ months',  value: 210 },
];

const REVENUE_OPTIONS = ['Under $500K','$500K–$2M','$2M–$10M','$10M–$50M','Over $50M'];

const HS_CODES_BY_INDUSTRY = {
  'Electronics & Semiconductors': ['8542.31 – Integrated circuits','8517.62 – Network equipment','8528.72 – Monitors','8471.30 – Laptops','8471.50 – Processing units'],
  'Automotive & Auto Parts':      ['8708.99 – Auto parts','8703.23 – Passenger vehicles','8708.40 – Gearboxes','8544.30 – Wiring harness'],
  'Apparel & Textiles':           ['6109.10 – T-shirts cotton','6203.42 – Trousers denim','6204.62 – Trousers women','5208.11 – Woven cotton fabric'],
  'Food & Beverage':              ['1006.30 – Rice','0901.11 – Coffee','0902.10 – Green tea','2106.90 – Food preparations'],
  'Chemicals & Plastics':         ['3901.10 – Polyethylene','3902.10 – Polypropylene','2933.59 – Heterocyclic compounds'],
  'Medical Devices & Pharma':     ['9018.90 – Medical instruments','3004.90 – Medicines','9021.10 – Orthopaedic implants'],
  'Industrial Machinery':         ['8479.89 – Machines general','8501.52 – Electric motors','8412.21 – Hydraulic power'],
  'Furniture & Home Goods':       ['9401.61 – Upholstered seats','9403.60 – Wooden furniture','9404.21 – Mattresses'],
  'Toys & Consumer Products':     ['9503.00 – Toys','9504.50 – Video games','9506.91 – Fitness equipment'],
  'Steel & Metals':               ['7208.10 – Flat-rolled steel','7601.10 – Unwrought aluminium','7403.11 – Copper cathodes'],
};

const CATEGORIES_BY_INDUSTRY = {
  'Electronics & Semiconductors': ['Electronics & Electrical'],
  'Automotive & Auto Parts':      ['Automotive Parts'],
  'Apparel & Textiles':           ['Textiles & Apparel', 'Leather Goods'],
  'Food & Beverage':              ['Agriculture & Food Products', 'Beverages', 'Seafood & Marine Products'],
  'Chemicals & Plastics':         ['Chemicals & Petrochemicals', 'Paper & Packaging'],
  'Medical Devices & Pharma':     ['Medical & Healthcare', 'Pharmaceuticals & Healthcare'],
  'Industrial Machinery':         ['Machinery & Industrial Equipment'],
  'Furniture & Home Goods':       ['Furniture & Wood Products', 'Handicrafts & Home Decor'],
  'Toys & Consumer Products':     ['Toys & Games', 'Sports Goods'],
  'Steel & Metals':               ['Metals & Minerals', 'Construction Materials'],
  'Agriculture & Commodities':    ['Agriculture & Food Products'],
  'Aerospace & Defense':          ['Machinery & Industrial Equipment', 'Metals & Minerals'],
  'Energy & Oil':                 ['Chemicals & Petrochemicals'],
  'Retail & E-commerce':          ['Textiles & Apparel', 'Electronics & Electrical', 'Furniture & Wood Products', 'Cosmetics & Personal Care', 'Jewellery & Accessories'],
  'Logistics & Freight':          ['Paper & Packaging'],
};

const KEYWORDS_BY_INDUSTRY = {
  'Electronics & Semiconductors': ['semiconductor tariff','chip export ban','TSMC','China tech restrictions','CHIPS Act'],
  'Automotive & Auto Parts':      ['auto tariff','steel tariff','EV supply chain','USMCA auto rules','battery imports'],
  'Apparel & Textiles':           ['cotton tariff','Xinjiang cotton','textile import quota','Bangladesh garment','forced labor'],
  'Food & Beverage':              ['food import restriction','agriculture tariff','USDA trade','phytosanitary','food safety ban'],
  'Chemicals & Plastics':         ['chemical sanctions','hazmat shipping','REACH compliance','EPA chemical ban','plastic tariff'],
  'Medical Devices & Pharma':     ['FDA import alert','medical device tariff','pharma supply chain','API shortage','510k clearance'],
  'Industrial Machinery':         ['machinery tariff','HS 8479','industrial equipment ban','Section 301','manufacturing embargo'],
};

const STEPS = [
  { label: 'Company',      icon: Building2 },
  { label: 'Imports',      icon: Package },
  { label: 'Supply Chain', icon: Globe },
  { label: 'Products',     icon: Tag },
];

/* ── Reusable styled components ─────────────────────────────────────────── */

const s = {
  input: {
    width:'100%', padding:'10px 14px',
    background:'rgba(232,226,216,0.05)', border:'1px solid rgba(232,226,216,0.1)',
    borderRadius:8, color:'white', fontSize:13, fontFamily:'Inter, sans-serif',
    outline:'none', transition:'border-color 0.2s', boxSizing:'border-box',
  },
  label: {
    display:'block', fontSize:11, fontWeight:600,
    color:'rgba(232,226,216,0.45)', marginBottom:6,
    letterSpacing:'0.05em', textTransform:'uppercase',
  },
};

const Field = ({ label, children, style }) => (
  <div style={{ marginBottom:18, ...style }}>
    <label style={s.label}>{label}</label>
    {children}
  </div>
);

/* Single-select pill row */
const PillSelect = ({ options, value, onChange, colorFn }) => (
  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
    {options.map(opt => {
      const v = typeof opt === 'object' ? opt.value : opt;
      const l = typeof opt === 'object' ? opt.label : opt;
      const sel = value === v || value === l;
      const accent = colorFn ? colorFn(l) : 'rgba(132,215,216,0.15)';
      const border = colorFn ? colorFn(l, true) : 'rgba(132,215,216,0.5)';
      return (
        <button key={l} type="button" onClick={() => onChange(v)}
          style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif',
            background: sel ? accent : 'rgba(232,226,216,0.04)',
            border: `1px solid ${sel ? border : 'rgba(232,226,216,0.08)'}`,
            color: sel ? 'white' : 'rgba(232,226,216,0.4)', transition:'all 0.15s' }}>
          {l}
        </button>
      );
    })}
  </div>
);

/* Native styled select */
const Select = ({ value, onChange, options, placeholder }) => (
  <div style={{ position:'relative' }}>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...s.input, appearance:'none', paddingRight:36, cursor:'pointer' }}
      onFocus={e => e.target.style.borderColor='rgba(132,215,216,0.5)'}
      onBlur={e  => e.target.style.borderColor='rgba(232,226,216,0.1)'}
    >
      {placeholder && <option value="" disabled style={{ color: '#000', background: '#fff' }}>{placeholder}</option>}
      {options.map(o => <option key={typeof o==='object'?o.value:o} value={typeof o==='object'?o.value:o} style={{ color: '#000', background:'#fff' }}>{typeof o==='object'?o.label:o}</option>)}
    </select>
    <ChevronDown size={14} color="rgba(232,226,216,0.3)" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
  </div>
);

/* Multi-select tag picker */
const TagPicker = ({ options, selected, onChange, max }) => {
  const toggle = (v) => {
    if (selected.includes(v)) {
      onChange(selected.filter(x => x !== v));
    } else if (!max || selected.length < max) {
      onChange([...selected, v]);
    }
  };
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
      {options.map(o => {
        const v = typeof o==='object' ? o.value : o;
        const l = typeof o==='object' ? o.label : o;
        const sel = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => toggle(v)}
            style={{ padding:'6px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif',
              background: sel ? 'rgba(132,215,216,0.15)' : 'rgba(232,226,216,0.04)',
              border: `1px solid ${sel ? 'rgba(132,215,216,0.5)' : 'rgba(232,226,216,0.08)'}`,
              color: sel ? '#84D7D8' : 'rgba(232,226,216,0.4)',
              display:'flex', alignItems:'center', gap:5, transition:'all 0.15s' }}>
            {sel && <Check size={10} strokeWidth={3}/>}
            {l}
          </button>
        );
      })}
    </div>
  );
};

/* Repeatable supplier name + country rows */
const SupplierList = ({ suppliers, onChange }) => {
  const update = (i, field, value) => {
    const next = suppliers.map((row, idx) => idx === i ? { ...row, [field]: value } : row);
    onChange(next);
  };
  const add = () => onChange([...suppliers, { name: '', country: '' }]);
  const remove = (i) => onChange(suppliers.filter((_, idx) => idx !== i));

  return (
    <div>
      {suppliers.map((row, i) => (
        <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
          <input style={{ ...s.input, flex: 1.3 }} placeholder="Supplier name"
            value={row.name} onChange={e => update(i, 'name', e.target.value)}
            onFocus={e => e.target.style.borderColor='rgba(132,215,216,0.5)'}
            onBlur={e  => e.target.style.borderColor='rgba(232,226,216,0.1)'}/>
          <div style={{ flex: 1 }}>
            <Select value={row.country} onChange={v => update(i, 'country', v)}
              options={COUNTRIES} placeholder="Country…"/>
          </div>
          <button type="button" onClick={() => remove(i)} disabled={suppliers.length <= 1}
            style={{ width:32, height:32, flexShrink:0, borderRadius:8, cursor: suppliers.length <= 1 ? 'not-allowed' : 'pointer',
              background:'rgba(232,226,216,0.04)', border:'1px solid rgba(232,226,216,0.08)',
              color: suppliers.length <= 1 ? 'rgba(232,226,216,0.15)' : 'rgba(232,226,216,0.5)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={14}/>
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', marginTop:2,
          background:'rgba(132,215,216,0.08)', border:'1px solid rgba(132,215,216,0.25)', borderRadius:8,
          color:'#84D7D8', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>
        <Plus size={13}/> Add another supplier
      </button>
    </div>
  );
};

/* ── Main component ───────────────────────────────────────────────────────── */

export default function OnboardingPage({ onComplete }) {
  const navigate  = useNavigate();
  const { getToken } = useAuth();
  const { user }  = useUser();

  const [step, setStep]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    location: 'China',
    years_in_business: '5',
    average_revenue: '$500K–$2M',
    // Imports
    annual_import_volume_usd: 1000000,
    risk_tolerance: 'medium',
    typical_order_value_usd: 50000,
    avg_lead_time_days: 45,
    // Supply chain
    suppliers: [{ name: '', country: '' }],  // [{ name, country }] — who you actually buy from
    primary_origin_countries: [],      // array
    destination_country: 'United States',
    destination_port: 'Port of Los Angeles',
    import_region: 'East Asia',
    preferred_alternative_regions: [], // array
    // Products
    primary_hs_codes: [],              // array of "code – description"
    product_categories: [],            // array
    rss_keywords: [],                  // array
    compliance_notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-populate HS codes / categories / keywords when industry changes
  useEffect(() => {
    if (!form.industry) return;
    set('primary_hs_codes', (HS_CODES_BY_INDUSTRY[form.industry] || ['9999.00 – General']).slice(0,2));
    set('product_categories', CATEGORIES_BY_INDUSTRY[form.industry] || []);
    set('rss_keywords', (KEYWORDS_BY_INDUSTRY[form.industry] || ['trade restriction', 'tariff', 'compliance']).slice(0,3));
  }, [form.industry]);

  // Auto-populate port when destination country changes
  useEffect(() => {
    const ports = PORTS[form.destination_country];
    if (ports?.length) set('destination_port', ports[0]);
    else set('destination_port', '');
  }, [form.destination_country]);

  const canNext = () => {
    if (step === 0) return form.company_name.trim() && form.industry;
    if (step === 2) {
      const hasSupplier = form.suppliers.some(sup => sup.name.trim() && sup.country.trim());
      return form.primary_origin_countries.length > 0 && hasSupplier;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      const splitCode = (arr) => arr.map(s => s.split(' –')[0].trim());

      const payload = {
        email: user?.primaryEmailAddress?.emailAddress || '',
        name:  user?.fullName || user?.firstName || 'User',
        company_name: form.company_name,
        industry:     form.industry,
        location:     form.location,
        years_in_business: parseInt(form.years_in_business) || 1,
        average_revenue:   form.average_revenue,
        risk_tolerance:    form.risk_tolerance,
        annual_import_volume_usd:    Number(form.annual_import_volume_usd),
        typical_order_value_usd:     Number(form.typical_order_value_usd),
        avg_lead_time_days:          Number(form.avg_lead_time_days),
        suppliers: form.suppliers
          .filter(sup => sup.name.trim() && sup.country.trim())
          .map(sup => ({ name: sup.name.trim(), country: sup.country.trim() })),
        primary_origin_countries:    form.primary_origin_countries,
        destination_country:         form.destination_country,
        destination_port:            form.destination_port || null,
        import_region:               form.import_region,
        preferred_alternative_regions: form.preferred_alternative_regions,
        preferred_alternative_countries: [],
        primary_hs_codes:    splitCode(form.primary_hs_codes),
        product_categories:  form.product_categories,
        rss_keywords:        form.rss_keywords,
        compliance_notes:    form.compliance_notes || null,
        min_supplier_rating: 3.5,
      };

      const res = await fetch(`${API_URL}/api/v2/auth/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Onboarding failed');
      }
      // Signal App.jsx to transition to dashboard
      if (onComplete) onComplete();
      else navigate('/dashboard');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  /* ── Step indicator ───────────────────────────────────────────────────── */
  const StepBar = () => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginBottom:36 }}>
      {STEPS.map((s, i) => {
        const done = i < step, cur = i === step;
        const Icon = s.icon;
        return (
          <React.Fragment key={i}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ width:36, height:36, borderRadius:'50%',
                background: done ? 'linear-gradient(135deg,#5BA86F,#4A9460)' : cur ? 'rgba(132,215,216,0.15)' : 'rgba(232,226,216,0.04)',
                border: done ? 'none' : cur ? '2px solid #84D7D8' : '1px solid rgba(232,226,216,0.1)',
                display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.3s' }}>
                {done ? <Check size={15} color="white" strokeWidth={3}/> : <Icon size={15} color={cur ? '#84D7D8' : 'rgba(232,226,216,0.2)'}/>}
              </div>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase',
                color: cur ? '#84D7D8' : done ? '#5BA86F' : 'rgba(232,226,216,0.2)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length-1 && (
              <div style={{ width:52, height:1, margin:'0 6px', marginBottom:18,
                background: i < step ? 'rgba(91,168,111,0.4)' : 'rgba(232,226,216,0.07)',
                transition:'background 0.3s' }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  /* ── Step content ─────────────────────────────────────────────────────── */
  const renderStep = () => {

    /* Step 0 — Company */
    if (step === 0) return (
      <>
        <Field label="Company Name *">
          <input style={s.input} placeholder="Acme Imports LLC" value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            onFocus={e => e.target.style.borderColor='rgba(132,215,216,0.5)'}
            onBlur={e  => e.target.style.borderColor='rgba(232,226,216,0.1)'}/>
        </Field>
        <Field label="Industry / Sector *">
          <Select value={form.industry} onChange={v => set('industry',v)}
            options={INDUSTRIES} placeholder="Select your industry…"/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Primary Supplier Country *">
            <Select value={form.location} onChange={v => set('location',v)} options={COUNTRIES}/>
          </Field>
          <Field label="Years in Business">
            <Select value={form.years_in_business} onChange={v => set('years_in_business',v)}
              options={['1','2','3','4','5','6-10','11-20','20+']}/>
          </Field>
        </div>
        <Field label="Annual Revenue">
          <PillSelect options={REVENUE_OPTIONS} value={form.average_revenue}
            onChange={v => set('average_revenue',v)}/>
        </Field>
      </>
    );

    /* Step 1 — Imports */
    if (step === 1) return (
      <>
        <Field label="Annual Import Volume">
          <PillSelect options={VOLUME_OPTIONS} value={form.annual_import_volume_usd}
            onChange={v => set('annual_import_volume_usd', v)}/>
        </Field>
        <Field label="Typical Order Value">
          <PillSelect options={ORDER_VALUE_OPTIONS} value={form.typical_order_value_usd}
            onChange={v => set('typical_order_value_usd', v)}/>
        </Field>
        <Field label="Average Lead Time">
          <PillSelect options={LEAD_TIME_OPTIONS} value={form.avg_lead_time_days}
            onChange={v => set('avg_lead_time_days', v)}/>
        </Field>
        <Field label="Risk Tolerance">
          <PillSelect
            options={['low','medium','high']}
            value={form.risk_tolerance}
            onChange={v => set('risk_tolerance',v)}
            colorFn={(l, border) => {
              const map = { low: border?'rgba(91,168,111,0.5)':'rgba(91,168,111,0.15)', medium: border?'rgba(132,215,216,0.5)':'rgba(132,215,216,0.15)', high: border?'rgba(226,75,74,0.5)':'rgba(226,75,74,0.15)' };
              return map[l] || (border?'rgba(132,215,216,0.5)':'rgba(132,215,216,0.15)');
            }}
          />
        </Field>
      </>
    );

    /* Step 2 — Supply Chain */
    if (step === 2) return (
      <>
        <Field label="Your Suppliers * (who you actually import from)">
          <SupplierList suppliers={form.suppliers} onChange={v => set('suppliers', v)}/>
        </Field>
        <Field label="Primary Supplier Countries * (select all that apply)">
          <TagPicker options={COUNTRIES} selected={form.primary_origin_countries}
            onChange={v => set('primary_origin_countries', v)} max={8}/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Destination Country">
            <Select value={form.destination_country}
              onChange={v => set('destination_country',v)} options={DEST_COUNTRIES}/>
          </Field>
          <Field label="Destination Port">
            <Select value={form.destination_port}
              onChange={v => set('destination_port',v)}
              options={PORTS[form.destination_country] || ['Other']}/>
          </Field>
        </div>
        <Field label="Primary Import Region">
          <PillSelect options={REGIONS} value={form.import_region}
            onChange={v => set('import_region',v)}/>
        </Field>
        <Field label="Preferred Backup Regions (select all that apply)">
          <TagPicker options={REGIONS.filter(r => r !== form.import_region)}
            selected={form.preferred_alternative_regions}
            onChange={v => set('preferred_alternative_regions',v)} max={4}/>
        </Field>
      </>
    );

    /* Step 3 — Products */
    return (
      <>
        {form.industry && (
          <p style={{ margin:'0 0 16px', fontSize:12, color:'rgba(132,215,216,0.7)', background:'rgba(132,215,216,0.06)', border:'1px solid rgba(132,215,216,0.15)', borderRadius:8, padding:'8px 12px' }}>
            Pre-filled for <strong>{form.industry}</strong> — adjust as needed
          </p>
        )}
        <Field label="HS Codes (select all that apply)">
          <TagPicker
            options={HS_CODES_BY_INDUSTRY[form.industry] || ['8542.31 – ICs','8517.62 – Network','9999.00 – Other']}
            selected={form.primary_hs_codes}
            onChange={v => set('primary_hs_codes',v)}/>
        </Field>
        <Field label="Additional Product Categories (optional)">
          <TagPicker
            options={INDUSTRIES}
            selected={form.product_categories}
            onChange={v => set('product_categories',v)}/>
        </Field>
        <Field label="Alert Keywords (auto-suggested — add/remove as needed)">
          <TagPicker
            options={KEYWORDS_BY_INDUSTRY[form.industry] || ['tariff','trade restriction','sanctions']}
            selected={form.rss_keywords}
            onChange={v => set('rss_keywords',v)} max={6}/>
        </Field>
        <Field label="Compliance Notes (optional)">
          <textarea style={{ ...s.input, minHeight:68, resize:'vertical' }}
            placeholder="Any special compliance requirements…"
            value={form.compliance_notes} onChange={e => set('compliance_notes',e.target.value)}
            onFocus={e => e.target.style.borderColor='rgba(132,215,216,0.5)'}
            onBlur={e  => e.target.style.borderColor='rgba(232,226,216,0.1)'}/>
        </Field>
      </>
    );
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#16323A 0%,#285260 50%,#16323A 100%)',
      fontFamily:'Inter, sans-serif', padding:'40px 20px' }}>

      {/* Glow */}
      <div style={{ position:'fixed', width:600, height:600, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(132,215,216,0.06) 0%,transparent 70%)',
        top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:580, position:'relative', zIndex:10 }}>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28, gap:8 }}>
          <Logo size={44} variant="splash" />
          <p style={{ margin:0, color:'var(--text-muted)', fontSize:13 }}>
            Personalize your trade risk intelligence in 2 minutes.
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'rgba(232,226,216,0.03)', border:'1px solid rgba(232,226,216,0.08)',
          borderRadius:16, padding:'32px 32px 24px' }}>

          <StepBar/>

          <h2 style={{ fontSize:19, fontWeight:700, color:'white', margin:'0 0 22px', letterSpacing:'-0.3px' }}>
            {STEPS[step].label}
          </h2>

          {renderStep()}

          {error && (
            <div style={{ background:'rgba(226,75,74,0.1)', border:'1px solid rgba(226,75,74,0.25)',
              borderRadius:8, padding:'10px 14px', marginBottom:14, color:'#EC8C8B', fontSize:12 }}>
              {error}
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s-1)}
                style={{ flex:1, padding:'11px', background:'rgba(232,226,216,0.05)',
                  border:'1px solid rgba(232,226,216,0.1)', borderRadius:8,
                  color:'rgba(232,226,216,0.6)', fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'Inter, sans-serif',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <ChevronLeft size={15}/> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => canNext() && setStep(s => s+1)}
                style={{ flex:2, padding:'11px',
                  background: canNext() ? 'linear-gradient(135deg,#548C92,#84D7D8)' : 'rgba(232,226,216,0.05)',
                  border:'none', borderRadius:8,
                  color: canNext() ? '#0E2025' : 'rgba(232,226,216,0.2)',
                  fontSize:13, fontWeight:700,
                  cursor: canNext() ? 'pointer' : 'not-allowed',
                  fontFamily:'Inter, sans-serif',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                Next <ChevronRight size={15}/>
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading}
                style={{ flex:2, padding:'11px',
                  background:'linear-gradient(135deg,#548C92,#84D7D8)',
                  border:'none', borderRadius:8, color:'#0E2025',
                  fontSize:13, fontWeight:700,
                  cursor: loading ? 'wait' : 'pointer',
                  fontFamily:'Inter, sans-serif', opacity: loading ? 0.7 : 1,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {loading ? 'Setting up…' : <><Anchor size={14}/> Launch Suppliance</>}
              </button>
            )}
          </div>

          <p style={{ textAlign:'center', margin:'14px 0 0', fontSize:11, color:'rgba(232,226,216,0.2)' }}>
            Step {step+1} of {STEPS.length} — 24 hours free access after setup
          </p>
        </div>
      </div>
    </div>
  );
}
