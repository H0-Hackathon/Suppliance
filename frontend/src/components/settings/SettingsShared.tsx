import React from 'react';
import { Save, LucideIcon } from 'lucide-react';
import { DriftCard } from '../motion/DriftCard';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, subtitle, badge }) => (
  <div style={{ marginBottom: 32 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'var(--border-soft)',
        border: '1px solid rgba(84,140,146,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(84,140,146,0.08)',
      }}>
        <Icon size={17} color="#548C92" />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ocean)', letterSpacing: '-0.4px', margin: 0 }}>
            {title}
          </h2>
          {badge && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'var(--border-soft)', border: '1px solid rgba(84,140,146,0.25)',
              color: '#548C92', padding: '2px 7px', borderRadius: 4,
            }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      </div>
    </div>
    <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(84,140,146,0.25) 0%, transparent 60%)' }} />
  </div>
);

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  impact?: string;
  index?: number;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, children, impact, index = 0 }) => (
  <DriftCard index={index} hoverLift={false} style={{
    background: 'var(--surface)', border: '1px solid var(--border-soft)',
    borderRadius: 12, padding: '24px 28px', marginBottom: 20,
  }}>
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ocean)', margin: 0, letterSpacing: '-0.2px' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 11.5, color: 'rgba(130,120,90,0.55)', margin: '4px 0 0', lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {impact && (
        <div style={{
          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10.5, color: 'rgba(245,158,11,0.65)', background: 'rgba(245,158,11,0.06)',
          border: '1px solid var(--border-soft)', borderRadius: 4, padding: '2px 8px',
        }}>
          <span style={{ fontSize: 8 }}>◆</span>
          {impact}
        </div>
      )}
    </div>
    {children}
  </DriftCard>
);

interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}

export const FieldRow: React.FC<FieldRowProps> = ({ label, hint, children, full }) => (
  <div style={{
    display: full ? 'block' : 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: full ? 8 : 16, alignItems: 'start', marginBottom: 16,
  }}>
    <div>
      <label style={{
        fontSize: 12, fontWeight: 500, color: 'rgba(180,170,140,0.75)',
        display: 'block', paddingTop: full ? 0 : 9,
      }}>
        {label}
      </label>
      {hint && (
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
    </div>
    <div>{children}</div>
  </div>
);

const inputBase: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 7, color: 'var(--ocean)', fontSize: 12.5,
  fontFamily: 'var(--font)', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
};

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  monospace?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({ monospace, style, ...props }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      {...props}
      style={{
        ...inputBase,
        fontFamily: monospace ? 'JetBrains Mono, monospace' : 'var(--font)',
        borderColor: focused ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.09)',
        boxShadow: focused ? '0 0 0 3px var(--border-soft)' : 'none',
        ...style,
      }}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    />
  );
};

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const SelectInput: React.FC<SelectInputProps> = ({ style, ...props }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      {...props}
      style={{
        ...inputBase,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(160,150,100,0.6)' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32,
        cursor: 'pointer',
        borderColor: focused ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.09)',
        boxShadow: focused ? '0 0 0 3px var(--border-soft)' : 'none',
        ...style,
      }}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    />
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      background: checked ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${checked ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 8, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s',
    }}
    onClick={() => onChange(!checked)}
  >
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: checked ? 'var(--ocean)' : 'rgba(160,150,120,0.7)' }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      )}
    </div>
    <div style={{
      width: 40, height: 22, borderRadius: 11,
      background: checked ? '#548C92' : 'rgba(255,255,255,0.1)',
      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      boxShadow: checked ? '0 0 10px rgba(245,158,11,0.3)' : 'none',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  </div>
);

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = React.useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 7, padding: '8px 10px', minHeight: 42,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length ? 6 : 0 }}>
        {tags.map((tag, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--border-soft)', border: '1px solid rgba(245,158,11,0.25)',
            color: '#548C92', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
          }}>
            {tag}
            <button
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', color: 'rgba(245,158,11,0.6)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}
            >×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder={placeholder ?? 'Type and press Enter…'}
        style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--ocean)', fontSize: 12.5, fontFamily: 'var(--font)', width: '100%', minWidth: 80 }}
      />
    </div>
  );
};

interface SaveButtonProps {
  onSave: () => void;
  saving: boolean;
  label?: string;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ onSave, saving, label = 'Save Changes' }) => (
  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
    <button
      onClick={onSave}
      disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 8,
        background: saving ? 'rgba(245,158,11,0.1)' : 'linear-gradient(135deg, #548C92 0%, #d97706 100%)',
        border: saving ? '1px solid rgba(245,158,11,0.3)' : 'none',
        color: saving ? 'var(--harbor)' : 'white',
        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
        cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', transition: 'all 0.2s',
        boxShadow: saving ? 'none' : '0 4px 20px rgba(245,158,11,0.3)',
      }}
    >
      <Save size={14} />
      {saving ? 'Saving…' : label}
    </button>
  </div>
);
