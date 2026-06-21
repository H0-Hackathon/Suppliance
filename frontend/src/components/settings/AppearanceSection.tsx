import React, { useState } from 'react';
import { Palette, Monitor, Zap, LayoutGrid } from 'lucide-react';
import { SectionHeader, SettingsCard, ToggleSwitch, SaveButton } from './SettingsShared';

interface Props { onSave: () => void; saving: boolean; }

const THEMES = [
  {
    id: 'coastguard',
    label: 'CoastGuard',
    desc: 'Warm sand and ocean tones — default',
    preview: { bg: '#faf8f5', accent: '#548C92', border: 'rgba(84,140,146,0.25)' },
    default: true,
  },
  {
    id: 'sea-glass',
    label: 'Sea Glass',
    desc: 'Light and airy with soft teal accents',
    preview: { bg: '#f5f1ec', accent: '#B4D7D8', border: 'rgba(180,215,216,0.4)' },
  },
  {
    id: 'harbor',
    label: 'Harbor',
    desc: 'Deep ocean tones for focused work',
    preview: { bg: '#2B5260', accent: '#B4D7D8', border: 'rgba(180,215,216,0.3)' },
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    desc: 'Maximum legibility',
    preview: { bg: '#ffffff', accent: '#2B5260', border: 'rgba(43,82,96,0.3)' },
  },
] as const;

const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable', desc: 'More whitespace, easier scanning' },
  { id: 'compact',     label: 'Compact',     desc: 'Denser layout, more data per screen' },
  { id: 'ultra',       label: 'Ultra Dense', desc: 'Maximum information density' },
] as const;

export const AppearanceSection: React.FC<Props> = ({ onSave, saving }) => {
  const [theme, setTheme] = useState('coastguard');
  const [density, setDensity] = useState('comfortable');
  const [animations, setAnimations] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showDataPulse, setShowDataPulse] = useState(true);
  const [globeAutoRotate, setGlobeAutoRotate] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [monoNumbers, setMonoNumbers] = useState(true);

  return (
    <div>
      <SectionHeader
        icon={Palette}
        title="Appearance"
        subtitle="Customise the CoastGuard interface to match your workflow and reduce cognitive load during high-stakes monitoring sessions."
      />

      {/* Theme */}
      <SettingsCard
        title="Dashboard Theme"
        description="Choose the visual style of the platform. All themes are optimised for extended screen time in trading environments."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEMES.map(({ id, label, desc, preview }) => {
            const isSelected = theme === id;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                style={{
                  padding: 0,
                  borderRadius: 10,
                  border: `2px solid ${isSelected ? preview.accent : 'rgba(255,255,255,0.07)'}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? `0 0 16px ${preview.accent}30` : 'none',
                  textAlign: 'left',
                }}
              >
                {/* Preview swatch */}
                <div style={{
                  height: 52,
                  background: preview.bg,
                  borderBottom: `1px solid ${preview.border}`,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 3, width: '40%', borderRadius: 1, background: preview.accent, opacity: 0.8 }} />
                    <div style={{ height: 3, width: '25%', borderRadius: 1, background: 'rgba(255,255,255,0.15)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 3, width: '60%', borderRadius: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ height: 5, width: '30%', borderRadius: 2, background: preview.accent, opacity: 0.3 }} />
                    <div style={{ height: 5, width: '30%', borderRadius: 2, background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                </div>
                {/* Label area */}
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'var(--ocean)' : 'var(--text-muted)',
                    fontFamily: 'var(--font)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {label}
                    {isSelected && (
                      <span style={{
                        fontSize: 9,
                        background: preview.accent,
                        color: '#000',
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10.5,
                    color: 'rgba(120,110,80,0.4)',
                    marginTop: 2,
                    fontFamily: 'var(--font)',
                  }}>
                    {desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Density */}
      <SettingsCard
        title="Dashboard Density"
        description="Controls the amount of information displayed per viewport. Compact mode shows more data points simultaneously."
        impact="Affects chart heights, table rows, and card spacing"
      >
        <div style={{ display: 'flex', gap: 10 }}>
          {DENSITIES.map(({ id, label, desc }) => {
            const isSelected = density === id;
            return (
              <button
                key={id}
                onClick={() => setDensity(id)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  background: isSelected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <LayoutGrid
                  size={isSelected ? 18 : 16}
                  color={isSelected ? '#548C92' : 'rgba(160,150,120,0.35)'}
                  style={{ marginBottom: 6 }}
                />
                <div style={{
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--ocean)' : 'var(--text-muted)',
                  marginBottom: 4,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 10.5,
                  color: 'rgba(120,110,80,0.4)',
                  lineHeight: 1.4,
                }}>
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Animations */}
      <SettingsCard
        title="Motion & Animations"
        description="Control interface animations and data visualisation effects. Disable for accessibility or reduced GPU usage."
      >
        <ToggleSwitch
          checked={animations}
          onChange={setAnimations}
          label="Interface Animations"
          description="Page transitions, hover effects, and panel slide-ins"
        />
        <ToggleSwitch
          checked={reducedMotion}
          onChange={setReducedMotion}
          label="Respect System Reduced Motion"
          description="Automatically reduces motion when your OS setting is enabled"
        />
        <ToggleSwitch
          checked={showDataPulse}
          onChange={setShowDataPulse}
          label="Live Data Pulse Indicators"
          description="Animated dots on alert cards and data feeds when new data arrives"
        />
        <ToggleSwitch
          checked={globeAutoRotate}
          onChange={setGlobeAutoRotate}
          label="Globe Auto-Rotation"
          description="Trade globe rotates automatically when not in focus"
        />
      </SettingsCard>

      {/* Typography */}
      <SettingsCard
        title="Data Display"
        description="Fine-tune how numeric data is presented across dashboards and reports."
      >
        <ToggleSwitch
          checked={monoNumbers}
          onChange={setMonoNumbers}
          label="Monospace Numbers"
          description="Use fixed-width font for numeric data — prevents column shifting in tables"
        />
        <ToggleSwitch
          checked={sidebarCollapsed}
          onChange={setSidebarCollapsed}
          label="Compact Sidebar by Default"
          description="Start with icon-only sidebar, expand on hover"
        />
      </SettingsCard>

      <SaveButton onSave={onSave} saving={saving} label="Save Appearance" />
    </div>
  );
};
