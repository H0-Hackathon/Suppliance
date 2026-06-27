import React from 'react';
import { LogoMark } from './LogoMark';

interface LogoProps {
  /** Badge size in px. */
  size?: number;
  /** Show the "Suppliance" wordmark next to the mark. */
  withWordmark?: boolean;
  /** 'sidebar' → compact wordmark in the app typeface; 'splash' → larger serif wordmark for auth/loading screens. */
  variant?: 'sidebar' | 'splash';
  className?: string;
  onClick?: () => void;
}

/**
 * Suppliance logo lockup — brand mark + optional wordmark.
 *
 * The wordmark is rendered as live text (not baked into the image) so it stays
 * crisp and selectable. The in-app sidebar uses the app's typeface for
 * typographic consistency; auth/loading splash screens use a serif to echo
 * the logo's decorative wordmark.
 *
 * Single integration point: to swap in a different logo later, edit this file
 * and LogoMark.tsx only.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 36,
  withWordmark = true,
  variant = 'sidebar',
  className,
  onClick,
}) => {
  const splash = variant === 'splash';
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: splash ? 16 : 12,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <LogoMark size={size} />
      {withWordmark && (
        <span
          style={{
            fontFamily: splash ? 'Georgia, "Times New Roman", serif' : 'var(--font)',
            fontSize: splash ? 30 : 19,
            fontWeight: splash ? 600 : 700,
            letterSpacing: splash ? '0.01em' : '-0.01em',
            color: 'var(--foreground)',
            lineHeight: 1,
          }}
        >
          Suppliance
        </span>
      )}
    </div>
  );
};

export default Logo;
