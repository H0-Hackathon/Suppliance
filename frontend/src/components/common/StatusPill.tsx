import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../ui/utils';

const pillVariants = cva(
  'inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors',
  {
    variants: {
      variant: {
        critical: 'bg-[rgba(226,75,74,0.15)] text-[#f5a0a0]',
        warning: 'bg-[rgba(224,162,59,0.15)] text-[#f5d79a]',
        safe: 'bg-[rgba(91,168,111,0.15)] text-[#a8d9b4]',
        info: 'bg-[rgba(84,140,146,0.15)] text-[#a0cdd3]',
        neutral: 'bg-[rgba(168,144,114,0.15)] text-[#d4c4b0]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  label?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  variant,
  label,
  children,
  className,
  ...props
}) => {
  return (
    <span className={cn(pillVariants({ variant }), className)} {...props}>
      {label ?? children}
    </span>
  );
};
