import React from 'react';
import { Progress } from '../ui/progress';

interface TopProgressBarProps {
  label: string;
  percent: number; // 0–100
  visible: boolean;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({
  label,
  percent,
  visible,
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(30,58,66,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(232,226,216,0.08)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        transition: 'opacity 0.25s ease-out',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#E8E2D8',
          whiteSpace: 'nowrap',
          minWidth: 160,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>
        <Progress
          value={Math.max(0, Math.min(100, percent))}
          className="h-1.5 bg-[rgba(232,226,216,0.08)]"
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#84D7D8',
          minWidth: 40,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(Math.max(0, Math.min(100, percent)))}%
      </span>
    </div>
  );
};
