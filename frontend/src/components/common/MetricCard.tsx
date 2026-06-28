import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { ICON_SIZE, ICON_STROKE } from './iconDefaults';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  /** Accent color for the icon + value (defaults to foreground). */
  accent?: string;
}

/**
 * Hero-number metric card: small muted uppercase label, large tabular-nums
 * value as the focal point, optional sub-caption and icon. Centered both
 * ways within the card so it sits in the middle of the box, not flush top.
 */
export const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, icon: Icon, accent }) => {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-5 h-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        {Icon && <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={accent || 'var(--clay)'} />}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div
        className="font-bold leading-none"
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1, "lnum" 1',
          color: accent || 'var(--foreground)',
          fontSize: 22,
        }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 truncate">{sub}</div>}
    </Card>
  );
};

export default MetricCard;
