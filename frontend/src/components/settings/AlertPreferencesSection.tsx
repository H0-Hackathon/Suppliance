import React, { useState } from 'react';
import { BellRing, Clock } from 'lucide-react';
import { SectionHeader, SettingsCard, FieldRow, TextInput, ToggleSwitch, SaveButton } from './SettingsShared';

interface Props { onSave: () => void; saving: boolean; }

const SEVERITY_LEVELS = [
  { id: 'critical', label: 'Critical', color: '#ef4444', desc: 'Immediate supply chain risk' },
  { id: 'high',     label: 'High',     color: '#f97316', desc: 'Significant disruption likely' },
  { id: 'medium',   label: 'Medium',   color: '#548C92', desc: 'Moderate potential impact' },
  { id: 'low',      label: 'Low',      color: '#B4D7D8', desc: 'Informational signals' },
] as const;

type Severity = 'critical' | 'high' | 'medium' | 'low';
const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export const AlertPreferencesSection: React.FC<Props> = ({ onSave, saving }) => {
  const [minSeverity, setMinSeverity] = useState<Severity>('medium');
  const [email, setEmail]               = useState(true);
  const [emailAddress, setEmailAddress] = useState('');
  const [browser, setBrowser]           = useState(true);
  const [dailyBrief, setDailyBrief]     = useState(true);
  const [briefTime, setBriefTime]       = useState('07:30');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [digestMode, setDigestMode]     = useState(false);
  const [geopoliticAlerts, setGeopoliticAlerts] = useState(true);
  const [tariffAlerts, setTariffAlerts]         = useState(true);
  const [supplierAlerts, setSupplierAlerts]     = useState(true);
  const [weatherAlerts, setWeatherAlerts]       = useState(false);

  const activeIndex = SEV_ORDER.indexOf(minSeverity);

  return (
    <div>
      <SectionHeader
        icon={BellRing}
        title="Alert Preferences"
        subtitle="Control which signals reach you, how you receive them, and what gets included in your executive brief."
      />

      <SettingsCard
        title="Minimum Alert Severity"
        description="Alerts below this threshold will be filtered out. Critical region events always bypass this setting."
        impact="Reducing threshold increases alert volume significantly"
      >
        <div style={{ position: 'relative', marginTop: 8 }}>
          <div style={{ position: 'relative', height: 4, background: 'rgba(232,226,216,0.07)', borderRadius: 2, margin: '24px 0 40px' }}>
            <div style={{
              position: 'absolute', left: 0, height: '100%',
              width: `${(3 - activeIndex) / 3 * 100}%`,
              background: 'linear-gradient(90deg, #548C92, #f97316)', borderRadius: 2, transition: 'width 0.3s',
            }} />
            {SEV_ORDER.map((sev, i) => {
              const x = (i / 3) * 100;
              const cfg = SEVERITY_LEVELS.find(s => s.id === sev)!;
              const isActive = i >= activeIndex;
              return (
                <button
                  key={sev}
                  onClick={() => setMinSeverity(sev)}
                  style={{
                    position: 'absolute', left: `${x}%`, top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 18, height: 18, borderRadius: '50%',
                    background: isActive ? cfg.color : 'rgba(232,226,216,0.12)',
                    border: `2px solid ${isActive ? cfg.color : 'rgba(232,226,216,0.15)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 8px ${cfg.color}60` : 'none', padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 10.5, fontWeight: minSeverity === sev ? 700 : 400,
                    color: minSeverity === sev ? cfg.color : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', fontFamily: 'var(--font)', transition: 'color 0.15s',
                  }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          padding: '10px 14px', background: 'rgba(132,215,216,0.05)',
          border: '1px solid rgba(132,215,216,0.12)', borderRadius: 7,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <BellRing size={13} color="#548C92" />
          Showing <strong style={{ color: 'var(--ocean)' }}>{minSeverity.charAt(0).toUpperCase() + minSeverity.slice(1)}</strong> and above.{' '}
          Approx. <strong style={{ color: 'var(--ocean)' }}>
            {minSeverity === 'low' ? '40–60' : minSeverity === 'medium' ? '15–25' : minSeverity === 'high' ? '5–10' : '1–3'}
          </strong> alerts/week.
        </div>
      </SettingsCard>

      <SettingsCard title="Email Notifications" description="Receive alerts in your inbox." impact="Immediate email delivery on severity threshold breach" index={1}>
        <ToggleSwitch checked={email} onChange={setEmail} label="Enable Email Alerts" description="Sends alerts matching your severity threshold in real-time" />
        {email && (
          <div style={{ marginTop: 12 }}>
            <FieldRow label="Notification Email" hint="Separate multiple with commas">
              <TextInput type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} placeholder="user@company.com" />
            </FieldRow>
            <ToggleSwitch checked={digestMode} onChange={setDigestMode} label="Digest Mode" description="Bundle alerts into a single email per hour" />
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Browser & Slack Notifications" description="In-app notifications and optional Slack integration." index={2}>
        <ToggleSwitch checked={browser} onChange={setBrowser} label="Browser Notifications" description="Push notifications in Chrome, Edge, or Firefox" />
        <div style={{ marginTop: 4 }}>
          <FieldRow label="Slack Webhook URL" hint="Optional — paste incoming webhook URL">
            <TextInput value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/…" monospace />
          </FieldRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Daily Executive Brief" description="AI-generated summary of the past 24 hours — key disruptions, tariff changes, and recommended actions." impact="Uses AI to synthesize top signals" index={3}>
        <ToggleSwitch checked={dailyBrief} onChange={setDailyBrief} label="Enable Daily Brief" description="Delivered each morning at your configured time" />
        {dailyBrief && (
          <div style={{ marginTop: 12 }}>
            <FieldRow label="Delivery Time" hint="In your local timezone">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={14} color="rgba(132,215,216,0.5)" style={{ flexShrink: 0 }} />
                <input
                  type="time"
                  value={briefTime}
                  onChange={e => setBriefTime(e.target.value)}
                  style={{
                    background: 'rgba(232,226,216,0.04)', border: '1px solid rgba(232,226,216,0.09)',
                    borderRadius: 7, color: 'var(--ocean)', fontSize: 12.5, fontFamily: 'var(--font)',
                    padding: '9px 12px', outline: 'none', colorScheme: 'dark',
                  }}
                />
              </div>
            </FieldRow>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Alert Type Filters" description="Choose which categories of intelligence feed into your alerts." index={4}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ToggleSwitch checked={geopoliticAlerts} onChange={setGeopoliticAlerts} label="Geopolitical Events" description="Sanctions, conflicts, policy changes" />
          <ToggleSwitch checked={tariffAlerts} onChange={setTariffAlerts} label="Tariff & Trade Policy" description="New duties, quota changes, FTAs" />
          <ToggleSwitch checked={supplierAlerts} onChange={setSupplierAlerts} label="Supplier Risk" description="Financial instability, capacity issues" />
          <ToggleSwitch checked={weatherAlerts} onChange={setWeatherAlerts} label="Weather & Logistics" description="Port closures, extreme weather events" />
        </div>
      </SettingsCard>

      <SaveButton onSave={onSave} saving={saving} label="Save Alert Preferences" />
    </div>
  );
};
