import React, { useState, useEffect } from 'react';
import { UserCircle2, ShieldCheck, Key, LogOut, Trash2, Copy, Check } from 'lucide-react';
import { SectionHeader, SettingsCard, FieldRow, TextInput, SelectInput, SaveButton } from './SettingsShared';

export interface AccountSaveData {
  name: string;
}

interface Props {
  onSave: (data: AccountSaveData) => void;
  saving: boolean;
  initialData?: { name?: string; email?: string };
}

const ROLES = [
  { id: 'cso',     label: 'Chief Supply Officer',  badge: 'Exec' },
  { id: 'manager', label: 'Supply Chain Manager',   badge: 'Mgmt' },
  { id: 'analyst', label: 'Trade Risk Analyst',     badge: 'IC' },
  { id: 'ops',     label: 'Operations Coordinator', badge: 'Ops' },
  { id: 'finance', label: 'Finance / Treasury',     badge: 'Fin' },
  { id: 'admin',   label: 'Platform Administrator', badge: 'Admin' },
] as const;

export const AccountSection: React.FC<Props> = ({ onSave, saving, initialData }) => {
  const [name, setName]         = useState(initialData?.name ?? '');
  const [email]                 = useState(initialData?.email ?? '');
  const [role, setRole]         = useState('analyst');
  const [phone, setPhone]       = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [twoFa, setTwoFa]       = useState(true);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (initialData?.name) setName(initialData.name);
  }, [initialData?.name]);

  const apiKey = 'cg_live_xK3mP9vQ2nR7sT1wL8eA5bF0';

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedRole = ROLES.find(r => r.id === role);

  return (
    <div>
      <SectionHeader icon={UserCircle2} title="Account" subtitle="Manage your personal profile, authentication settings, and API access credentials." />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(132,215,216,0.07) 0%, rgba(232,226,216,0.02) 100%)',
        border: '1px solid rgba(132,215,216,0.12)', borderRadius: 12, marginBottom: 20,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(132,215,216,0.3) 0%, rgba(132,215,216,0.1) 100%)',
          border: '2px solid rgba(132,215,216,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#548C92', flexShrink: 0,
        }}>
          {(name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ocean)', letterSpacing: '-0.3px' }}>{name || 'Your Name'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{email}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            {selectedRole && (
              <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(132,215,216,0.12)', border: '1px solid rgba(132,215,216,0.25)', color: '#548C92', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em' }}>
                {selectedRole.badge}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedRole?.label ?? '—'}</span>
          </div>
        </div>
        {twoFa && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#5BA86F', background: 'rgba(91,168,111,0.08)', border: '1px solid rgba(91,168,111,0.2)', padding: '4px 9px', borderRadius: 5 }}>
            <ShieldCheck size={11} />
            2FA Active
          </div>
        )}
      </div>

      <SettingsCard title="Personal Information" description="Name and contact details used in report headers and notification delivery.">
        <FieldRow label="Full Name">
          <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
        </FieldRow>
        <FieldRow label="Email Address">
          <TextInput type="email" value={email} readOnly placeholder="you@company.com" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
        </FieldRow>
        <FieldRow label="Phone (optional)" hint="For SMS critical alerts">
          <TextInput value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
        </FieldRow>
        <FieldRow label="Timezone" hint="Used for daily brief delivery">
          <SelectInput value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="America/New_York">Eastern (UTC−5/4)</option>
            <option value="America/Chicago">Central (UTC−6/5)</option>
            <option value="America/Denver">Mountain (UTC−7/6)</option>
            <option value="America/Los_Angeles">Pacific (UTC−8/7)</option>
            <option value="Europe/London">London (UTC+0/1)</option>
            <option value="Europe/Berlin">Berlin (UTC+1/2)</option>
            <option value="Asia/Singapore">Singapore (UTC+8)</option>
            <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
          </SelectInput>
        </FieldRow>
      </SettingsCard>

      <SettingsCard title="Platform Role" description="Your role determines the default dashboard layout and AI report framing." impact="Personalises AI insights and recommended actions" index={1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {ROLES.map(({ id, label, badge }) => {
            const isSelected = role === id;
            return (
              <button
                key={id}
                onClick={() => setRole(id)}
                style={{
                  padding: '10px 14px', borderRadius: 8,
                  border: `1px solid ${isSelected ? 'rgba(132,215,216,0.35)' : 'rgba(232,226,216,0.07)'}`,
                  background: isSelected ? 'rgba(132,215,216,0.08)' : 'rgba(232,226,216,0.02)',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s', fontFamily: 'var(--font)',
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, background: isSelected ? 'rgba(132,215,216,0.15)' : 'rgba(232,226,216,0.07)', color: isSelected ? '#548C92' : 'var(--text-secondary)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.06em', flexShrink: 0 }}>
                  {badge}
                </span>
                <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--ocean)' : 'var(--text-secondary)' }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Security" description="Authentication and access controls for your Suppliance account." index={2}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
          background: twoFa ? 'rgba(91,168,111,0.05)' : 'rgba(239,68,68,0.05)',
          border: `1px solid ${twoFa ? 'rgba(91,168,111,0.15)' : 'rgba(239,68,68,0.15)'}`,
          borderRadius: 8, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={15} color={twoFa ? '#5BA86F' : '#b54a3a'} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ocean)' }}>Two-Factor Authentication</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{twoFa ? 'Authenticator app configured' : 'Not configured — account at risk'}</div>
            </div>
          </div>
          <button
            onClick={() => setTwoFa(!twoFa)}
            style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: `1px solid ${twoFa ? 'rgba(91,168,111,0.25)' : 'rgba(132,215,216,0.25)'}`, background: twoFa ? 'rgba(91,168,111,0.08)' : 'rgba(132,215,216,0.08)', color: twoFa ? '#5BA86F' : '#548C92', cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            {twoFa ? 'Manage' : 'Enable'}
          </button>
        </div>
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: 'rgba(232,226,216,0.02)', border: '1px solid rgba(232,226,216,0.07)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12.5, fontFamily: 'var(--font)', cursor: 'pointer' }}>
          <Key size={13} />
          Change Password
        </button>
      </SettingsCard>

      <SettingsCard title="API Access" description="Use this key to integrate Suppliance risk signals with your internal systems or BI tools." index={3}>
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(232,226,216,0.09)' }}>
          <div style={{ flex: 1, padding: '9px 12px', background: 'rgba(232,226,216,0.03)', color: 'var(--text-muted)', fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
            {apiKey.slice(0, 14)}{'•'.repeat(12)}
          </div>
          <button
            onClick={copyKey}
            style={{ padding: '9px 14px', background: copied ? 'rgba(91,168,111,0.1)' : 'rgba(132,215,216,0.08)', border: 'none', borderLeft: '1px solid rgba(232,226,216,0.09)', color: copied ? '#5BA86F' : '#548C92', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontFamily: 'var(--font)', fontWeight: 600, transition: 'all 0.15s', flexShrink: 0 }}
          >
            {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Key</>}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Keep this key secret. Regenerating will revoke all existing integrations.
        </p>
      </SettingsCard>

      <div style={{ border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '16px 20px', background: 'rgba(239,68,68,0.03)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#b54a3a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Trash2 size={13} />
          Danger Zone
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, padding: '9px 0', borderRadius: 7, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,120,120,0.65)', fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <LogOut size={12} />
            Sign Out All Devices
          </button>
          <button style={{ flex: 1, padding: '9px 0', borderRadius: 7, background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(239,100,100,0.7)', fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trash2 size={12} />
            Delete Account
          </button>
        </div>
      </div>

      <SaveButton onSave={() => onSave({ name })} saving={saving} label="Save Account Settings" />
    </div>
  );
};
