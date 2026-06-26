import React from 'react';
import { Progress } from '../ui/progress';
import { cn } from '../ui/utils';

interface ConfidenceBarProps {
  value: number; // 0–1
  className?: string;
  showLabel?: boolean;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  value,
  className,
  showLabel = true,
}) => {
  const pct = Math.max(0, Math.min(1, value));
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1">
        <Progress
          value={pct * 100}
          className="h-1.5 bg-[rgba(232,226,216,0.08)]"
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-seafoam min-w-[2.5rem] text-right">
          {pctText}
        </span>
      )}
    </div>
  );
};
