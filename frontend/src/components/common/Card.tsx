import React from 'react';
import { cn } from '../ui/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'normal' | 'large';
}

export const Card: React.FC<CardProps> = ({
  padding = 'normal',
  className,
  children,
  ...props
}) => {
  const padClass = padding === 'large' ? 'p-8' : 'p-5';
  return (
    <div
      className={cn(
        'bg-card text-card-foreground rounded-xl border border-[rgba(232,226,216,0.10)]',
        padClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
