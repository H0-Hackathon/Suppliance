import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Building2, Globe2, BellRing, Palette, UserCircle2,
  Settings, ChevronRight, Loader2,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { CompanyProfileSection, type CompanySaveData } from '../components/settings/CompanyProfileSection';
import { SupplyChainSection, type SupplyChainSaveData } from '../components/settings/SupplyChainSection';
import { AlertPreferencesSection } from '../components/settings/AlertPreferencesSection';
import { AppearanceSection } from '../components/settings/AppearanceSection';
import { AccountSection, type AccountSaveData } from '../components/settings/AccountSection';
import api from '../services/api';

interface SettingsData {
  customer_id: number;
  name: string;
  email: string;
  company_name: string;
  industry: string;
  hs_codes: string[];
  product_descriptions: string[];
  primary_origin_countries: string[];
  import_region: string;
  risk_tolerance: string;
  rss_keywords: string[];
}

const SECTIONS = [
  { id: 'company',  icon: Building2,    label: 'Company Profile',    sub: 'Identity & scale' },
  { id: 'supply',   icon: Globe2,        label: 'Supply Chain',       sub: 'Sourcing footprint' },
  { id: 'alerts',   icon: BellRing,      label: 'Alert Preferences',  sub: 'Notifications' },
  { id: 'appear',   icon: Palette,       label: 'Appearance',         sub: 'Theme & layout' },
  { id: 'account',  icon: UserCircle2,   label: 'Account',            sub: 'Profile & security' },
] as const;
type SectionId = typeof SECTIONS[number]['id'];

export const SettingsPage: React.FC = () => {
  const [active, setActive] = useState<SectionId>('company');
  const [data, setData]     = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const { getToken } = useAuth();

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await api.get<SettingsData>('/v2/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (err) {
        console.error('Settings load failed:', err);
        toast.error('Could not load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [getToken]);

  const patch = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await api.patch<SettingsData>('/v2/settings', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      toast.success('Settings saved');
    } catch (err) {
      console.error('Settings save failed:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [getToken]);

  const handleCompanySave  = (d: CompanySaveData)     => patch({ company_name: d.company_name, industry: d.industry });
  const handleSupplySave   = (d: SupplyChainSaveData) => patch({
    primary_origin_countries: d.primary_origin_countries,
    import_region: d.import_region,
    risk_tolerance: d.risk_tolerance,
    rss_keywords: d.rss_keywords,
  });
  const handleAccountSave  = (d: AccountSaveData)     => patch({ name: d.name });
  const handleAlertSave    = ()                        => toast.success('Alert preferences saved (local)');
  const handleAppearSave   = ()                        => toast.success('Appearance saved (local)');

  return (
    <div style={{
      minHeight: '100vh',
      marginLeft: 'var(--sidebar-w)',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Page header ── */}
      <div style={{
        borderBottom: '1px solid var(--border-soft)',
        padding: '28px 40px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(132,215,216,0.10)',
          border: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={18} color="var(--seafoam)" />
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
            Settings
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            Personalise Suppliance to match your supply chain footprint
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'flex', flex: 1, gap: 0 }}>

        {/* ── Sidebar nav ── */}
        <nav style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid var(--border-soft)',
          padding: '24px 14px',
        }}>
          {SECTIONS.map(({ id, icon: Icon, label, sub }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px',
                  borderRadius: 9, marginBottom: 4,
                  background: isActive ? 'rgba(132,215,216,0.12)' : 'transparent',
                  border: 'none',
                  boxShadow: isActive ? 'inset 2px 0 0 var(--seafoam)' : 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'background 0.15s', fontFamily: 'var(--font)',
                }}
              >
                <Icon size={16} color={isActive ? 'var(--seafoam)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--foreground)' : 'var(--text-muted)', lineHeight: 1.2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</div>
                </div>
                {isActive && <ChevronRight size={14} color="var(--text-muted)" />}
              </button>
            );
          })}
        </nav>

        {/* ── Content panel ── */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxWidth: 820 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14, paddingTop: 40 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading settings…
            </div>
          ) : (
            <>
              {active === 'company' && (
                <CompanyProfileSection
                  onSave={handleCompanySave}
                  saving={saving}
                  initialData={{ company_name: data?.company_name, industry: data?.industry }}
                />
              )}
              {active === 'supply' && (
                <SupplyChainSection
                  onSave={handleSupplySave}
                  saving={saving}
                  initialData={{
                    primary_origin_countries: data?.primary_origin_countries,
                    import_region: data?.import_region,
                    risk_tolerance: data?.risk_tolerance,
                    rss_keywords: data?.rss_keywords,
                  }}
                />
              )}
              {active === 'alerts' && (
                <AlertPreferencesSection onSave={handleAlertSave} saving={saving} />
              )}
              {active === 'appear' && (
                <AppearanceSection onSave={handleAppearSave} saving={saving} />
              )}
              {active === 'account' && (
                <AccountSection
                  onSave={handleAccountSave}
                  saving={saving}
                  initialData={{ name: data?.name, email: data?.email }}
                />
              )}
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SettingsPage;
