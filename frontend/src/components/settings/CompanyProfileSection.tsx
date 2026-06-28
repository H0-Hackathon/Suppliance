import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, Globe } from 'lucide-react';
import { SectionHeader, SettingsCard, FieldRow, TextInput, SelectInput, SaveButton } from './SettingsShared';

export interface CompanySaveData {
  company_name: string;
  industry: string;
  hq_country: string;
  revenue_range: string;
  employee_count: string;
}

interface Props {
  onSave: (data: CompanySaveData) => void;
  saving: boolean;
  initialData?: { company_name?: string; industry?: string };
}

const REVENUE_OPTIONS = [
  { v: 'under10m',  label: 'Under $10M' },
  { v: '10m-50m',   label: '$10M – $50M' },
  { v: '50m-250m',  label: '$50M – $250M' },
  { v: '250m-1b',   label: '$250M – $1B' },
  { v: '1b-5b',     label: '$1B – $5B' },
  { v: 'over5b',    label: 'Over $5B' },
] as const;

export const CompanyProfileSection: React.FC<Props> = ({ onSave, saving, initialData }) => {
  const [form, setForm] = useState({
    companyName:   initialData?.company_name ?? '',
    industry:      initialData?.industry ?? '',
    hqCountry:     'US',
    revenueRange:  '50m-250m',
    employeeCount: '250-999',
  });

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({
        ...prev,
        companyName: initialData.company_name ?? prev.companyName,
        industry:    initialData.industry ?? prev.industry,
      }));
    }
  }, [initialData?.company_name, initialData?.industry]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = () => onSave({
    company_name:   form.companyName,
    industry:       form.industry,
    hq_country:     form.hqCountry,
    revenue_range:  form.revenueRange,
    employee_count: form.employeeCount,
  });

  return (
    <div>
      <SectionHeader
        icon={Building2}
        title="Company Profile"
        subtitle="Defines how Suppliance classifies your trade exposure and benchmarks risk against industry peers."
        badge="Core"
      />

      <SettingsCard
        title="Business Identity"
        description="Basic organisational information used for report headers and peer benchmarking."
        impact="Affects tariff-impact calculations and compliance threshold defaults"
      >
        <FieldRow label="Company Name" hint="Legal entity name for reports">
          <TextInput value={form.companyName} onChange={set('companyName')} placeholder="Enter company name" />
        </FieldRow>

        <FieldRow label="Primary Industry" hint="Drives sector-specific risk models">
          <SelectInput value={form.industry} onChange={set('industry')}>
            <option value="" style={{ color: '#000', background: '#fff' }}>Select industry</option>
            <option value="Electronics & Semiconductors" style={{ color: '#000', background: '#fff' }}>Electronics & Semiconductors</option>
            <option value="Automotive & Auto Parts" style={{ color: '#000', background: '#fff' }}>Automotive & Auto Parts</option>
            <option value="Apparel & Textiles" style={{ color: '#000', background: '#fff' }}>Apparel & Textiles</option>
            <option value="Food & Beverage" style={{ color: '#000', background: '#fff' }}>Food & Beverage</option>
            <option value="Chemicals & Plastics" style={{ color: '#000', background: '#fff' }}>Chemicals & Plastics</option>
            <option value="Medical Devices & Pharma" style={{ color: '#000', background: '#fff' }}>Medical Devices & Pharma</option>
            <option value="Industrial Machinery" style={{ color: '#000', background: '#fff' }}>Industrial Machinery</option>
            <option value="Furniture & Home Goods" style={{ color: '#000', background: '#fff' }}>Furniture & Home Goods</option>
            <option value="Toys & Consumer Products" style={{ color: '#000', background: '#fff' }}>Toys & Consumer Products</option>
            <option value="Steel & Metals" style={{ color: '#000', background: '#fff' }}>Steel & Metals</option>
            <option value="Agriculture & Commodities" style={{ color: '#000', background: '#fff' }}>Agriculture & Commodities</option>
            <option value="Aerospace & Defense" style={{ color: '#000', background: '#fff' }}>Aerospace & Defense</option>
            <option value="Energy & Oil" style={{ color: '#000', background: '#fff' }}>Energy & Oil</option>
            <option value="Retail & E-commerce" style={{ color: '#000', background: '#fff' }}>Retail & E-commerce</option>
            <option value="Logistics & Freight" style={{ color: '#000', background: '#fff' }}>Logistics & Freight</option>
          </SelectInput>
        </FieldRow>

        <FieldRow label="Headquarters Country" hint="Sets primary regulatory jurisdiction">
          <SelectInput value={form.hqCountry} onChange={set('hqCountry')}>
            <option value="US" style={{ color: '#000', background: '#fff' }}>United States</option>
            <option value="GB" style={{ color: '#000', background: '#fff' }}>United Kingdom</option>
            <option value="DE" style={{ color: '#000', background: '#fff' }}>Germany</option>
            <option value="FR" style={{ color: '#000', background: '#fff' }}>France</option>
            <option value="JP" style={{ color: '#000', background: '#fff' }}>Japan</option>
            <option value="CA" style={{ color: '#000', background: '#fff' }}>Canada</option>
            <option value="AU" style={{ color: '#000', background: '#fff' }}>Australia</option>
            <option value="SG" style={{ color: '#000', background: '#fff' }}>Singapore</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      <SettingsCard
        title="Business Scale"
        description="Scale parameters calibrate risk thresholds and determine which disruption scenarios are material."
        impact="Calibrates alert materiality thresholds"
        index={1}
      >
        <FieldRow label="Annual Revenue" hint="Used to size tariff & disruption exposure">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {REVENUE_OPTIONS.map(({ v, label }) => {
              const isSelected = form.revenueRange === v;
              return (
                <button
                  key={v}
                  onClick={() => setForm(prev => ({ ...prev, revenueRange: v }))}
                  style={{
                    padding: '9px 12px', borderRadius: 7,
                    border: `1px solid ${isSelected ? 'rgba(132,215,216,0.4)' : 'rgba(232,226,216,0.07)'}`,
                    background: isSelected ? 'rgba(132,215,216,0.1)' : 'rgba(232,226,216,0.02)',
                    color: isSelected ? '#548C92' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: isSelected ? 600 : 400,
                    fontFamily: 'var(--font)', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <TrendingUp size={11} />
                  {label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow label="Employee Count" hint="Helps size operational risk models">
          <SelectInput value={form.employeeCount} onChange={set('employeeCount')}>
            <option value="1-49" style={{ color: '#000', background: '#fff' }}>1 – 49 employees</option>
            <option value="50-249" style={{ color: '#000', background: '#fff' }}>50 – 249 employees</option>
            <option value="250-999" style={{ color: '#000', background: '#fff' }}>250 – 999 employees</option>
            <option value="1000-4999" style={{ color: '#000', background: '#fff' }}>1,000 – 4,999 employees</option>
            <option value="5000+" style={{ color: '#000', background: '#fff' }}>5,000+ employees</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      <div style={{
        background: 'rgba(132,215,216,0.04)', border: '1px solid rgba(132,215,216,0.1)',
        borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: 'rgba(132,215,216,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Globe size={13} color="#548C92" />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ocean)', marginBottom: 4 }}>
            How this personalises your monitoring
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Your industry and revenue range determine which tariff schedules, trade regulations, and supplier risk benchmarks are pre-loaded. Changing these recalibrates alert severity scoring and peer comparison metrics.
          </div>
        </div>
      </div>

      <SaveButton onSave={handleSave} saving={saving} label="Save Company Profile" />
    </div>
  );
};
