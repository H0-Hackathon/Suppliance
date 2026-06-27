import React from 'react';
import { cn } from '../ui/utils';

interface CardProps extends React.ComponentProps<'div'> {
  /** Remove default padding (e.g. when the card hosts a full-bleed map/globe). */
  flush?: boolean;
  /** Subtle hover lift for clickable cards. */
  interactive?: boolean;
}

/**
 * Standard surface shell — frosted-glass card over the app's mesh-gradient
 * background: semi-transparent teal-navy fill + backdrop blur so the
 * atmosphere behind shows through faintly, soft 1px border, 12px radius, and
 * consistent 24px padding. Every panel/card in the app uses this so padding,
 * radius, border, and glass treatment never drift.
 */
export const Card: React.FC<CardProps> = ({ flush, interactive, className, style, children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card/75 backdrop-blur-xl text-card-foreground',
        !flush && 'p-6',
        interactive && 'transition-[background,border-color,transform,box-shadow] duration-200 ease-out hover:border-primary/40 hover:bg-[#2C5763]/80 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] cursor-pointer',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-sm)', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
