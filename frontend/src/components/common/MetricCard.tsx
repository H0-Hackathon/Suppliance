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
  /**
   * Marks this as the single most-important metric on the row — renders a
   * larger hero number and a bit more padding so it visually outweighs the
   * secondary metrics next to it, instead of every card fighting for the
   * same cramped box.
   */
  hero?: boolean;
}

/**
 * Hero-number metric card: small muted uppercase label, large tabular-nums
 * value as the focal point, optional sub-caption and icon. Label, number,
 * and sub-caption each get their own margin so they breathe instead of
 * sitting flush against the card's padding edge.
 */
export const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, icon: Icon, accent, hero }) => {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-2 mb-3">
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
          fontSize: hero ? 30 : 22,
        }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 truncate">{sub}</div>}
    </Card>
  );
};

export default MetricCard;
