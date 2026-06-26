import React from 'react';
import { Check, X, Loader as Loader2 } from 'lucide-react';

export type AgentStatus = 'pending' | 'running' | 'done' | 'error';

interface AgentStepHeaderProps {
  name: string;
  status: AgentStatus;
  icon?: React.ReactNode;
}

export const AgentStepHeader: React.FC<AgentStepHeaderProps> = ({
  name,
  status,
  icon,
}) => {
  const dotColor =
    status === 'done'
      ? '#5BA86F'
      : status === 'error'
      ? '#E24B4A'
      : status === 'running'
      ? '#84D7D8'
      : '#6B7D82';

  const Dot =
    status === 'running' ? (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          animation: 'pulse-dot 1.2s ease-in-out infinite',
        }}
      />
    ) : status === 'done' ? (
      <Check size={14} color={dotColor} strokeWidth={2.5} />
    ) : status === 'error' ? (
      <X size={14} color={dotColor} strokeWidth={2.5} />
    ) : (
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
        }}
      />
    );

  return (
    <div className="flex items-center gap-2.5">
      {icon && <span className="text-dusty-teal">{icon}</span>}
      <span className="text-sm font-medium text-foreground">{name}</span>
      <div className="ml-auto">{Dot}</div>
    </div>
  );
};
