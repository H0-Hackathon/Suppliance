import React from 'react';
import { Card } from './Card';
import { cn } from '../ui/utils';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sub,
  icon,
  className,
  valueClassName,
}) => {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-dusty-teal">{icon}</span>}
        <span className="text-xs font-semibold uppercase tracking-wider text-clay">
          {label}
        </span>
      </div>
      <div
        className={cn(
          'text-[32px] font-bold leading-none text-foreground font-variant-numeric tabular-nums',
          valueClassName
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-clay">{sub}</div>}
    </Card>
  );
};
