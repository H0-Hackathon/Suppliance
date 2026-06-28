import React from 'react';
import { Check, X, LucideIcon } from 'lucide-react';
import { ICON_SIZE_SM, ICON_STROKE } from './iconDefaults';

export type AgentStatus = 'pending' | 'running' | 'done' | 'error';

interface AgentStepHeaderProps {
  icon?: LucideIcon;
  name: string;
  status: AgentStatus;
  /** Optional one-line summary shown to the right when collapsed/complete. */
  summary?: string;
  accent?: string;
}

const STATUS_RING: Record<AgentStatus, string> = {
  pending: 'rgba(157,170,173,0.30)',
  running: 'var(--seafoam)',
  done: 'var(--safe)',
  error: 'var(--critical)',
};

/**
 * Consistent agent row header: an icon, the agent name, and a status indicator
 * (pending=gray / running=pulsing seafoam / done=green check / error=red x).
 * Used by both the dashboard live-agent panel and the Past Events timeline.
 */
export const AgentStepHeader: React.FC<AgentStepHeaderProps> = ({
  icon: Icon,
  name,
  status,
  summary,
  accent,
}) => {
  const ring = STATUS_RING[status];
  const dim = status === 'pending';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      {/* status node */}
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1.5px solid ${ring}`,
          background:
            status === 'done'
              ? 'rgba(91,168,111,0.16)'
              : status === 'error'
                ? 'rgba(226,75,74,0.16)'
                : status === 'running'
                  ? 'rgba(132,215,216,0.14)'
                  : 'transparent',
          color: ring,
        }}
      >
        {status === 'done' ? (
          <Check size={12} strokeWidth={3} />
        ) : status === 'error' ? (
          <X size={12} strokeWidth={3} />
        ) : status === 'running' ? (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--seafoam)',
              animation: 'pulse-dot var(--pulse-duration, 1.4s) ease-in-out infinite',
            }}
          />
        ) : Icon ? (
          <Icon size={11} strokeWidth={ICON_STROKE} />
        ) : null}
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {Icon && status !== 'pending' && (
            <Icon size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} color={accent || 'var(--clay)'} />
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: dim ? 'var(--text-muted)' : 'var(--foreground)',
            }}
          >
            {name}
          </span>
        </div>
        {summary && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentStepHeader;
