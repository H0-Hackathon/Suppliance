import React, { useState } from 'react';
import { Palette, LayoutGrid } from 'lucide-react';
import { SectionHeader, SettingsCard, ToggleSwitch, SaveButton } from './SettingsShared';

interface Props { onSave: () => void; saving: boolean; }

const THEMES = [
  { id: 'suppliance',    label: 'Suppliance',     desc: 'Deep teal-navy with seafoam accents — default', preview: { bg: '#285260', accent: '#84D7D8', border: 'rgba(132,215,216,0.3)' } },
  { id: 'harbor',        label: 'Harbor',         desc: 'Darker ocean tones for focused work', preview: { bg: '#16323A', accent: '#548C92', border: 'rgba(84,140,146,0.35)' } },
  { id: 'sand',          label: 'Sand',           desc: 'Light, warm neutral surface', preview: { bg: '#E0D7CF', accent: '#548C92', border: 'rgba(84,140,146,0.3)' } },
  { id: 'high-contrast', label: 'High Contrast',  desc: 'Maximum legibility', preview: { bg: '#0E2025', accent: '#84D7D8', border: 'rgba(132,215,216,0.4)' } },
] as const;

const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable', desc: 'More whitespace, easier scanning' },
  { id: 'compact',     label: 'Compact',     desc: 'Denser layout, more data per screen' },
  { id: 'ultra',       label: 'Ultra Dense', desc: 'Maximum information density' },
] as const;

export const AppearanceSection: React.FC<Props> = ({ onSave, saving }) => {
  const [theme, setTheme]                 = useState('suppliance');
  const [density, setDensity]             = useState('comfortable');
  const [animations, setAnimations]       = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showDataPulse, setShowDataPulse] = useState(true);
  const [globeAutoRotate, setGlobeAutoRotate] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [monoNumbers, setMonoNumbers]     = useState(true);

  return (
    <div>
      <SectionHeader
        icon={Palette}
        title="Appearance"
        subtitle="Customise the Suppliance interface to match your workflow and reduce cognitive load during monitoring sessions."
      />

      <SettingsCard title="Dashboard Theme" description="Visual style of the platform. All themes are optimised for extended screen time.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEMES.map(({ id, label, desc, preview }) => {
            const isSelected = theme === id;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                style={{
                  padding: 0, borderRadius: 10,
                  border: `2px solid ${isSelected ? preview.accent : 'rgba(232,226,216,0.07)'}`,
                  background: 'transparent', cursor: 'pointer', overflow: 'hidden',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? `0 0 16px ${preview.accent}30` : 'none', textAlign: 'left',
                }}
              >
                <div style={{
                  height: 52, background: preview.bg, borderBottom: `1px solid ${preview.border}`,
                  padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 3, width: '40%', borderRadius: 1, background: preview.accent, opacity: 0.8 }} />
                    <div style={{ height: 3, width: '25%', borderRadius: 1, background: 'rgba(232,226,216,0.15)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 3, width: '60%', borderRadius: 1, background: 'rgba(232,226,216,0.08)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 5, width: '30%', borderRadius: 2, background: preview.accent, opacity: 0.3 }} />
                    <div style={{ height: 5, width: '30%', borderRadius: 2, background: 'rgba(232,226,216,0.05)' }} />
                  </div>
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(232,226,216,0.02)' }}>
                  <div style={{
                    fontSize: 12, fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'var(--ocean)' : 'var(--text-muted)',
                    fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    {label}
                    {isSelected && (
                      <span style={{ fontSize: 9, background: preview.accent, color: '#000', padding: '1px 5px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.05em' }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font)' }}>{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Dashboard Density" description="Controls the amount of information displayed per viewport." impact="Affects chart heights, table rows, and card spacing" index={1}>
        <div style={{ display: 'flex', gap: 10 }}>
          {DENSITIES.map(({ id, label, desc }) => {
            const isSelected = density === id;
            return (
              <button
                key={id}
                onClick={() => setDensity(id)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 8,
                  border: `1px solid ${isSelected ? 'rgba(132,215,216,0.35)' : 'rgba(232,226,216,0.07)'}`,
                  background: isSelected ? 'rgba(132,215,216,0.08)' : 'rgba(232,226,216,0.02)',
                  cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'center', transition: 'all 0.15s',
                }}
              >
                <LayoutGrid size={isSelected ? 18 : 16} color={isSelected ? '#548C92' : '#9DAAAD'} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--ocean)' : 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Motion & Animations" description="Control interface animations. Disable for accessibility or reduced GPU usage." index={2}>
        <ToggleSwitch checked={animations} onChange={setAnimations} label="Interface Animations" description="Page transitions, hover effects, and panel slide-ins" />
        <ToggleSwitch checked={reducedMotion} onChange={setReducedMotion} label="Respect System Reduced Motion" description="Automatically reduces motion when your OS setting is enabled" />
        <ToggleSwitch checked={showDataPulse} onChange={setShowDataPulse} label="Live Data Pulse Indicators" description="Animated dots on alert cards when new data arrives" />
        <ToggleSwitch checked={globeAutoRotate} onChange={setGlobeAutoRotate} label="Globe Auto-Rotation" description="Trade globe rotates automatically when not in focus" />
      </SettingsCard>

      <SettingsCard title="Data Display" description="Fine-tune how numeric data is presented across dashboards and reports." index={3}>
        <ToggleSwitch checked={monoNumbers} onChange={setMonoNumbers} label="Monospace Numbers" description="Use fixed-width font for numeric data — prevents column shifting in tables" />
        <ToggleSwitch checked={sidebarCollapsed} onChange={setSidebarCollapsed} label="Compact Sidebar by Default" description="Start with icon-only sidebar, expand on hover" />
      </SettingsCard>

      <SaveButton onSave={onSave} saving={saving} label="Save Appearance" />
    </div>
  );
};
