import React from 'react';
import { cn } from '../ui/utils';

export type Tone = 'critical' | 'warning' | 'safe' | 'info' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  critical: 'bg-[#E24B4A]/15 text-[#EC8C8B]',
  warning: 'bg-[#E0A23B]/15 text-[#ECC07A]',
  safe: 'bg-[#5BA86F]/15 text-[#93CDA3]',
  info: 'bg-[#548C92]/18 text-[#9FE0E1]',
  neutral: 'bg-[#9DAAAD]/12 text-[#B7C2C4]',
};

const DOT_COLOR: Record<Tone, string> = {
  critical: '#E24B4A',
  warning: '#E0A23B',
  safe: '#5BA86F',
  info: '#84D7D8',
  neutral: '#9DAAAD',
};

/** Map a backend severity string to a pill tone. */
export function severityToTone(severity?: string | null): Tone {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
    case 'medium':
      return 'warning';
    case 'low':
      return 'safe';
    default:
      return 'neutral';
  }
}

interface StatusPillProps {
  tone?: Tone;
  /** Show a leading status dot in the full-strength tone color. */
  dot?: boolean;
  /** Animate the dot (e.g. a live/running state). */
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
  uppercase?: boolean;
}

/**
 * Severity/status pill — one component for every badge, chip, and dot label
 * across the app. Filled at low opacity with full-strength text per the
 * design system.
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  tone = 'neutral',
  dot = false,
  pulse = false,
  children,
  className,
  uppercase = false,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        uppercase && 'uppercase tracking-wide',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: DOT_COLOR[tone],
            boxShadow: `0 0 6px ${DOT_COLOR[tone]}`,
            flexShrink: 0,
            animation: pulse ? 'pulse-dot 1.6s ease-in-out infinite' : 'none',
          }}
        />
      )}
      {children}
    </span>
  );
};

export default StatusPill;
