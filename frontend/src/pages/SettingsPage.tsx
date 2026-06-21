"use client";
import React, { useState } from 'react';
import { CompanyProfileSection } from '../components/settings/CompanyProfileSection';
import { SupplyChainSection } from '../components/settings/SupplyChainSection';
import { AlertPreferencesSection } from '../components/settings/AlertPreferencesSection';
import { AppearanceSection } from '../components/settings/AppearanceSection';
import { AccountSection } from '../components/settings/AccountSection';
import {
  Building2,
  Globe2,
  BellRing,
  Palette,
  UserCircle2,
  ChevronRight,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const SECTIONS = [
  { id: 'company',    label: 'Company Profile',    icon: Building2,    desc: 'Business identity & classification' },
  { id: 'supply',     label: 'Supply Chain',        icon: Globe2,       desc: 'Trade exposure & risk parameters' },
  { id: 'alerts',     label: 'Alert Preferences',   icon: BellRing,     desc: 'Severity thresholds & notifications' },
  { id: 'appearance', label: 'Appearance',          icon: Palette,      desc: 'Theme, layout & animations' },
  { id: 'account',    label: 'Account',             icon: UserCircle2,  desc: 'Profile, email & role' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export const SettingsPage: React.FC = () => {
  const [active, setActive] = useState<SectionId>('company');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Settings saved', {
        description: 'Your configuration has been applied to the platform.',
        icon: <CheckCircle2 size={16} color="#548C92" />,
      });
    }, 900);
  };

  return (
    <div className="settings-page-root page-with-sidebar" style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--sand-warm)',
      fontFamily: 'var(--font)',
    }}>
      <Toaster
        theme="light"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            color: 'var(--ocean)',
            fontFamily: 'var(--font)',
          },
        }}
      />

      <aside style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--border-soft)',
        background: 'var(--surface)',
        padding: '40px 0',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 28px 32px' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}>
            Configuration
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--ocean)',
            letterSpacing: '-0.02em',
          }}>
            Settings
          </div>
          <div style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginTop: 8,
            lineHeight: 1.6,
          }}>
            Personalize CoastGuard for your trade operations
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {SECTIONS.map(({ id, label, icon: Icon, desc }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 28px',
                  background: isActive ? 'var(--sea-glass-soft)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: isActive ? 'var(--surface)' : 'var(--sand-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={16} color={isActive ? 'var(--ocean)' : 'var(--text-muted)'} strokeWidth={isActive ? 2 : 1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--ocean)' : 'var(--text-secondary)',
                    lineHeight: 1.3,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    marginTop: 2,
                  }}>
                    {desc}
                  </div>
                </div>
                {isActive && <ChevronRight size={14} color="var(--harbor)" />}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '24px 28px' }}>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </aside>

      <main style={{
        flex: 1,
        padding: '48px 56px',
        overflowY: 'auto',
        maxWidth: 920,
      }}>
        {active === 'company'    && <CompanyProfileSection onSave={handleSave} saving={saving} />}
        {active === 'supply'     && <SupplyChainSection    onSave={handleSave} saving={saving} />}
        {active === 'alerts'     && <AlertPreferencesSection onSave={handleSave} saving={saving} />}
        {active === 'appearance' && <AppearanceSection     onSave={handleSave} saving={saving} />}
        {active === 'account'    && <AccountSection        onSave={handleSave} saving={saving} />}
      </main>
    </div>
  );
};

export default SettingsPage;
