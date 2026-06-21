import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

interface SoftButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'accent';
}

export const SoftButton: React.FC<SoftButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  disabled,
  ...rest
}) => {
  const prefersReduced = useReducedMotion();
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'outline'
        ? 'btn-outline'
        : variant === 'accent'
          ? 'btn-accent'
          : 'btn-ghost';

  return (
    <motion.button
      className={`${base} ${className}`.trim()}
      disabled={disabled}
      whileHover={
        !disabled && !prefersReduced
          ? { y: -2, transition: { duration: MOTION.hover.duration } }
          : undefined
      }
      whileTap={!disabled && !prefersReduced ? { scale: 0.98 } : undefined}
      {...rest}
    >
      {children}
    </motion.button>
  );
};
