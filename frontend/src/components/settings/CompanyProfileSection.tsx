import React, { useState } from 'react';
import { Building2, TrendingUp, Globe, Users } from 'lucide-react';
import { SectionHeader, SettingsCard, FieldRow, TextInput, SelectInput, SaveButton } from './SettingsShared';

interface Props { onSave: () => void; saving: boolean; }

export const CompanyProfileSection: React.FC<Props> = ({ onSave, saving }) => {
  const [form, setForm] = useState({
    companyName:   'Meridian Imports LLC',
    industry:      'manufacturing',
    hqCountry:     'US',
    revenueRange:  '50m-250m',
    employeeCount: '250-999',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <SectionHeader
        icon={Building2}
        title="Company Profile"
        subtitle="Defines how CoastGuard classifies your trade exposure and benchmarks risk against industry peers."
        badge="Core"
      />

      {/* Identity */}
      <SettingsCard
        title="Business Identity"
        description="Basic organisational information used for report headers and peer benchmarking."
        impact="Affects tariff-impact calculations and compliance threshold defaults"
      >
        <FieldRow label="Company Name" hint="Legal entity name for reports">
          <TextInput
            value={form.companyName}
            onChange={set('companyName')}
            placeholder="Enter company name"
          />
        </FieldRow>

        <FieldRow label="Primary Industry" hint="Drives sector-specific risk models">
          <SelectInput value={form.industry} onChange={set('industry')}>
            <option value="">Select industry</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="retail">Retail & E-commerce</option>
            <option value="pharma">Pharmaceuticals</option>
            <option value="automotive">Automotive</option>
            <option value="electronics">Electronics</option>
            <option value="food">Food & Beverage</option>
            <option value="chemicals">Chemicals</option>
            <option value="aerospace">Aerospace & Defense</option>
            <option value="other">Other</option>
          </SelectInput>
        </FieldRow>

        <FieldRow label="Headquarters Country" hint="Sets primary regulatory jurisdiction">
          <SelectInput value={form.hqCountry} onChange={set('hqCountry')}>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="SG">Singapore</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      {/* Scale */}
      <SettingsCard
        title="Business Scale"
        description="Scale parameters calibrate risk thresholds and determine which disruption scenarios are material."
        impact="Calibrates alert materiality thresholds"
      >
        {/* Revenue range cards */}
        <FieldRow label="Annual Revenue" hint="Used to size tariff & disruption exposure">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {([
              { v: 'under10m',  label: 'Under $10M',   icon: '◈' },
              { v: '10m-50m',   label: '$10M – $50M',  icon: '◈' },
              { v: '50m-250m',  label: '$50M – $250M', icon: '◈' },
              { v: '250m-1b',   label: '$250M – $1B',  icon: '◈' },
              { v: '1b-5b',     label: '$1B – $5B',    icon: '◈' },
              { v: 'over5b',    label: 'Over $5B',     icon: '◈' },
            ] as const).map(({ v, label }) => {
              const isSelected = form.revenueRange === v;
              return (
                <button
                  key={v}
                  onClick={() => setForm(prev => ({ ...prev, revenueRange: v }))}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 7,
                    border: `1px solid ${isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    background: isSelected ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                    color: isSelected ? '#548C92' : 'var(--text-muted)',
                    fontSize: 11.5,
                    fontWeight: isSelected ? 600 : 400,
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
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
            <option value="1-49">1 – 49 employees</option>
            <option value="50-249">50 – 249 employees</option>
            <option value="250-999">250 – 999 employees</option>
            <option value="1000-4999">1,000 – 4,999 employees</option>
            <option value="5000+">5,000+ employees</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      {/* How settings personalise */}
      <div style={{
        background: 'rgba(245,158,11,0.04)',
        border: '1px solid rgba(245,158,11,0.1)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'rgba(245,158,11,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Globe size={13} color="#548C92" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ocean)', marginBottom: 4 }}>
            How this personalises your monitoring
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Your industry and revenue range determine which tariff schedules, trade regulations, and supplier risk benchmarks are pre-loaded in your dashboard. Changing these settings will immediately recalibrate alert severity scoring and peer comparison metrics.
          </div>
        </div>
      </div>

      <SaveButton onSave={onSave} saving={saving} label="Save Company Profile" />
    </div>
  );
};
