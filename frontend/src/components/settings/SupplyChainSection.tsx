import React, { useState } from 'react';
import { Globe2, AlertTriangle, Layers, MapPin } from 'lucide-react';
import { SectionHeader, SettingsCard, FieldRow, SelectInput, TagInput, SaveButton } from './SettingsShared';

interface Props { onSave: () => void; saving: boolean; }

const RISK_LEVELS = [
  { id: 'low',    label: 'Low',    color: '#10b981', desc: 'Disruptions under 10% supply impact are acceptable' },
  { id: 'medium', label: 'Medium', color: '#f59e0b', desc: 'Alert on anything with >5% supply probability' },
  { id: 'high',   label: 'High',   color: '#ef4444', desc: 'Maximum vigilance — alert on all upstream signals' },
] as const;

export const SupplyChainSection: React.FC<Props> = ({ onSave, saving }) => {
  const [importedProducts, setImportedProducts] = useState(['Electronics', 'Steel', 'Rare Earth Minerals']);
  const [supplierCountries, setSupplierCountries] = useState(['China', 'Vietnam', 'Mexico', 'Taiwan']);
  const [criticalRegions, setCriticalRegions] = useState(['South China Sea', 'Taiwan Strait']);
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [primarySourcing, setPrimarySourcing] = useState('asia-pacific');
  const [supplyChainTier, setSupplyChainTier] = useState('tier2');

  return (
    <div>
      <SectionHeader
        icon={Globe2}
        title="Supply Chain Profile"
        subtitle="Maps your sourcing footprint so CoastGuard can surface the disruption signals most relevant to your trade flows."
        badge="Critical"
      />

      {/* Products */}
      <SettingsCard
        title="Imported Products"
        description="Product categories you source internationally. Used to match tariff schedules and disruption events."
        impact="Powers tariff impact calculator & commodity alerts"
      >
        <FieldRow label="Product Categories" hint="Press Enter or comma to add" full>
          <TagInput
            tags={importedProducts}
            onChange={setImportedProducts}
            placeholder="e.g. Semiconductors, Steel, Pharmaceuticals…"
          />
        </FieldRow>

        <FieldRow label="Primary Sourcing Region" hint="Where most volume originates">
          <SelectInput value={primarySourcing} onChange={e => setPrimarySourcing(e.target.value)}>
            <option value="asia-pacific">Asia-Pacific</option>
            <option value="southeast-asia">Southeast Asia</option>
            <option value="china">China (mainland)</option>
            <option value="europe">Europe</option>
            <option value="latin-america">Latin America</option>
            <option value="middle-east">Middle East & Africa</option>
            <option value="north-america">North America</option>
          </SelectInput>
        </FieldRow>

        <FieldRow label="Supply Chain Depth" hint="Deepest tier you want monitored">
          <SelectInput value={supplyChainTier} onChange={e => setSupplyChainTier(e.target.value)}>
            <option value="tier1">Tier 1 (direct suppliers only)</option>
            <option value="tier2">Tier 2 (suppliers of suppliers)</option>
            <option value="tier3">Tier 3 (extended network)</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      {/* Supplier Countries */}
      <SettingsCard
        title="Supplier Countries"
        description="Countries where your key suppliers are based. Drives geopolitical risk scoring and tariff monitoring."
        impact="Directly maps to tariff watch-list and sanctions screening"
      >
        <FieldRow label="Countries" hint="Press Enter or comma to add" full>
          <TagInput
            tags={supplierCountries}
            onChange={setSupplierCountries}
            placeholder="e.g. China, Vietnam, Germany…"
          />
        </FieldRow>

        {supplierCountries.length > 0 && (
          <div style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {supplierCountries.map((country, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 6,
                fontSize: 11,
                color: 'rgba(160,150,120,0.7)',
              }}>
                <MapPin size={10} color="rgba(245,158,11,0.5)" />
                {country}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Critical Regions */}
      <SettingsCard
        title="Critical Sourcing Regions"
        description="High-priority geographic zones where any disruption should trigger immediate alerts regardless of severity."
        impact="Bypasses severity filters — always generates alerts"
      >
        <FieldRow label="Regions" hint="Geopolitical hotspots, choke points" full>
          <TagInput
            tags={criticalRegions}
            onChange={setCriticalRegions}
            placeholder="e.g. Strait of Malacca, Red Sea, Taiwan Strait…"
          />
        </FieldRow>

        <div style={{
          marginTop: 8,
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.12)',
          borderRadius: 7,
          fontSize: 11.5,
          color: 'rgba(239,120,120,0.7)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          Any event in these regions will generate a <strong style={{ color: 'rgba(239,120,120,0.85)' }}>Critical</strong> alert regardless of your minimum severity threshold below.
        </div>
      </SettingsCard>

      {/* Risk Tolerance */}
      <SettingsCard
        title="Risk Tolerance"
        description="Determines the sensitivity of the AI risk engine. Higher tolerance means fewer, higher-confidence alerts."
        impact="Controls alert volume and AI recommendation aggressiveness"
      >
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {RISK_LEVELS.map(({ id, label, color, desc }) => {
            const isSelected = riskTolerance === id;
            return (
              <button
                key={id}
                onClick={() => setRiskTolerance(id)}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  borderRadius: 9,
                  border: `1px solid ${isSelected ? color + '40' : 'rgba(255,255,255,0.07)'}`,
                  background: isSelected ? color + '10' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isSelected ? color : 'rgba(255,255,255,0.2)',
                  margin: '0 auto 8px',
                  boxShadow: isSelected ? `0 0 8px ${color}` : 'none',
                  transition: 'all 0.2s',
                }} />
                <div style={{
                  fontSize: 12.5,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? color : 'rgba(160,150,120,0.55)',
                  marginBottom: 5,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 10.5,
                  color: isSelected ? 'rgba(180,170,140,0.55)' : 'rgba(120,110,80,0.35)',
                  lineHeight: 1.4,
                }}>
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SaveButton onSave={onSave} saving={saving} label="Save Supply Chain Profile" />
    </div>
  );
};
