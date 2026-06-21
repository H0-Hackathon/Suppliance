import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Briefcase, MapPin, Target, Settings, Globe, ShieldCheck, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'General Info', icon: Briefcase },
  { id: 2, title: 'Operations', icon: Settings },
  { id: 3, title: 'Logistics', icon: Globe },
  { id: 4, title: 'Products & Compliance', icon: ShieldCheck },
];

const InputField = ({ label, name, placeholder, type = "text", required = false, helpText, value, onChange }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 13, color: '#e2e8f0', marginBottom: 6, fontWeight: 500 }}>
      {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    {type === 'textarea' ? (
      <textarea
        required={required}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: '#fff', fontSize: 14, outline: 'none', minHeight: 80, resize: 'vertical'
        }}
      />
    ) : type === 'select' ? (
      <select
        value={value}
        onChange={e => onChange(name, e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: '#fff', fontSize: 14, outline: 'none', appearance: 'none'
        }}
      >
        <option value="low" style={{ background: '#0a0f1e' }}>Low</option>
        <option value="medium" style={{ background: '#0a0f1e' }}>Medium</option>
        <option value="high" style={{ background: '#0a0f1e' }}>High</option>
      </select>
    ) : (
      <input
        type={type}
        required={required}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: '#fff', fontSize: 14, outline: 'none'
        }}
      />
    )}
    {helpText && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 0 }}>{helpText}</p>}
  </div>
);

export default function OnboardingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    // Step 1: General
    company_name: '',
    industry: '',
    location: '',
    years_in_business: '',
    average_revenue: '',
    // Step 2: Operations
    business_type: '',
    annual_import_volume_usd: '',
    risk_tolerance: 'medium',
    typical_order_value_usd: '',
    avg_lead_time_days: '',
    // Step 3: Logistics
    primary_origin_countries: '',
    destination_country: '',
    destination_port: '',
    import_region: '',
    preferred_alternative_regions: '',
    preferred_alternative_countries: '',
    // Step 4: Products & Compliance
    primary_hs_codes: '',
    product_categories: '',
    product_descriptions: '',
    rss_keywords: '',
    compliance_notes: '',
    min_supplier_rating: '3.5'
  });

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const splitAndTrim = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      const payload = {
        email: user?.primaryEmailAddress?.emailAddress || "unknown@clerk.dev",
        name: user?.fullName || "User",
        company_name: formData.company_name,
        industry: formData.industry,
        location: formData.location,
        years_in_business: parseInt(formData.years_in_business) || 1,
        average_revenue: formData.average_revenue,
        
        business_type: formData.business_type || formData.industry,
        annual_import_volume_usd: formData.annual_import_volume_usd ? parseFloat(formData.annual_import_volume_usd) : null,
        risk_tolerance: formData.risk_tolerance,
        typical_order_value_usd: formData.typical_order_value_usd ? parseFloat(formData.typical_order_value_usd) : null,
        avg_lead_time_days: formData.avg_lead_time_days ? parseInt(formData.avg_lead_time_days) : null,
        
        primary_origin_countries: splitAndTrim(formData.primary_origin_countries),
        destination_country: formData.destination_country,
        destination_port: formData.destination_port,
        import_region: formData.import_region,
        preferred_alternative_regions: splitAndTrim(formData.preferred_alternative_regions),
        preferred_alternative_countries: splitAndTrim(formData.preferred_alternative_countries),
        
        primary_hs_codes: splitAndTrim(formData.primary_hs_codes),
        product_categories: splitAndTrim(formData.product_categories),
        product_descriptions: splitAndTrim(formData.product_descriptions),
        rss_keywords: splitAndTrim(formData.rss_keywords),
        compliance_notes: formData.compliance_notes,
        min_supplier_rating: parseFloat(formData.min_supplier_rating) || 3.5,
      };

      const res = await fetch('/api/v2/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Onboarding failed");
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #02040a 0%, #0a0f1e 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f8fafc',
      padding: '40px 20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 600,
        background: 'rgba(10, 15, 30, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 24,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>CoastGuard Enterprise Setup</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Personalize your AI monitoring agents and global supplier network.</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? '#3b82f6' : isCompleted ? '#10b981' : '#1e293b',
                    color: '#fff', border: `2px solid ${isActive ? '#3b82f6' : isCompleted ? '#10b981' : '#334155'}`,
                    transition: 'all 0.3s'
                  }}>
                    {isCompleted ? <CheckCircle size={14} /> : <Icon size={14} />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500, color: isActive ? '#fff' : '#64748b' }}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '32px 40px' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: 12, borderRadius: 8, marginBottom: 24, fontSize: 13 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: 18, marginBottom: 20 }}>1. General Information</h3>
                <InputField value={formData.company_name} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Company Name" name="company_name" required placeholder="e.g. Acme Global Imports" />
                <InputField value={formData.industry} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Primary Industry" name="industry" required placeholder="e.g. Consumer Electronics" />
                <InputField value={formData.location} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Headquarters Location" name="location" required placeholder="e.g. Seattle, WA" />
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><InputField value={formData.years_in_business} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Years in Business" name="years_in_business" required type="number" placeholder="e.g. 5" /></div>
                  <div style={{ flex: 1 }}><InputField value={formData.average_revenue} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Average Revenue" name="average_revenue" required placeholder="e.g. $5M - $10M" /></div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: 18, marginBottom: 20 }}>2. Operational Metrics</h3>
                <InputField value={formData.business_type} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Business Type" name="business_type" placeholder="e.g. Electronics Importer, Retailer" helpText="Specific sub-niche inside your industry." />
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><InputField value={formData.annual_import_volume_usd} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Annual Import Volume (USD)" name="annual_import_volume_usd" type="number" placeholder="e.g. 5000000" helpText="Raw number, e.g. 5000000" /></div>
                  <div style={{ flex: 1 }}><InputField value={formData.typical_order_value_usd} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Typical Order Value (USD)" name="typical_order_value_usd" type="number" placeholder="e.g. 250000" /></div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><InputField value={formData.risk_tolerance} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Risk Tolerance" name="risk_tolerance" type="select" helpText="Determines how aggressively agents block suppliers." /></div>
                  <div style={{ flex: 1 }}><InputField value={formData.avg_lead_time_days} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Avg Lead Time (Days)" name="avg_lead_time_days" type="number" placeholder="e.g. 45" /></div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: 18, marginBottom: 20 }}>3. Supply Chain Logistics</h3>
                <InputField value={formData.primary_origin_countries} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Primary Origin Countries" name="primary_origin_countries" placeholder="e.g. China, Taiwan, Vietnam" helpText="Comma separated list of countries you import from." />
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}><InputField value={formData.destination_country} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Destination Country" name="destination_country" placeholder="e.g. United States" /></div>
                  <div style={{ flex: 1 }}><InputField value={formData.destination_port} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Destination Port" name="destination_port" placeholder="e.g. Port of Los Angeles" /></div>
                </div>
                <InputField value={formData.import_region} onChange={(n, v) => setFormData({...formData, [n]: v})} label="General Import Region" name="import_region" placeholder="e.g. East Asia" />
                <InputField value={formData.preferred_alternative_regions} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Preferred Alternative Regions" name="preferred_alternative_regions" placeholder="e.g. Southeast Asia, Latin America" helpText="Where our agents should look first for alternative suppliers." />
                <InputField value={formData.preferred_alternative_countries} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Preferred Alternative Countries" name="preferred_alternative_countries" placeholder="e.g. Mexico, India, Malaysia" helpText="Specific fallback countries." />
              </div>
            )}

            {currentStep === 4 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: 18, marginBottom: 20 }}>4. Products & Compliance</h3>
                <InputField value={formData.primary_hs_codes} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Primary HS Codes" name="primary_hs_codes" placeholder="e.g. 8542.31, 8517.62" helpText="Comma separated HTS/HS codes for your products." />
                <InputField value={formData.product_categories} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Product Categories" name="product_categories" placeholder="e.g. Semiconductors, Electronic Components" />
                <InputField value={formData.product_descriptions} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Product Descriptions" name="product_descriptions" type="textarea" placeholder="e.g. Integrated circuits, display panels..." />
                <InputField value={formData.rss_keywords} onChange={(n, v) => setFormData({...formData, [n]: v})} label="RSS Keywords" name="rss_keywords" placeholder="e.g. semiconductor tariff, China export restriction" helpText="Keywords for our news monitoring agent." />
                <InputField value={formData.compliance_notes} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Compliance Notes" name="compliance_notes" type="textarea" placeholder="e.g. FCC compliance required, RoHS certification needed" />
                <InputField value={formData.min_supplier_rating} onChange={(n, v) => setFormData({...formData, [n]: v})} label="Min Supplier Rating (1-5)" name="min_supplier_rating" type="number" placeholder="e.g. 3.5" helpText="Only suggest suppliers with this rating or higher." />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  padding: '10px 20px', background: 'transparent', color: currentStep === 1 ? 'transparent' : '#94a3b8',
                  border: '1px solid', borderColor: currentStep === 1 ? 'transparent' : 'rgba(255,255,255,0.1)', borderRadius: 8,
                  fontSize: 14, fontWeight: 500, cursor: currentStep === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  pointerEvents: currentStep === 1 ? 'none' : 'auto'
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 24px', background: currentStep === 4 ? '#10b981' : '#3b82f6', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1, transition: 'background 0.2s'
                }}
              >
                {loading ? 'Initializing AI Agents...' : currentStep === 4 ? 'Complete Setup' : 'Next Step'}
                {currentStep < 4 && <ChevronRight size={16} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
