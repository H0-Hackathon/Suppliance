import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, fadeIn, slideFromRight, reduced } from '../../motion/variants';

type RevealVariant = 'fadeUp' | 'fadeIn' | 'slideFromRight';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  variant?: RevealVariant;
  as?: 'div' | 'section' | 'article' | 'header' | 'li';
}

const VARIANTS = { fadeUp, fadeIn, slideFromRight };

export const Reveal: React.FC<RevealProps> = ({
  children,
  className,
  style,
  delay = 0,
  variant = 'fadeUp',
  as = 'div',
}) => {
  const prefersReduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-48px', amount: 0.15 }}
      variants={prefersReduced ? reduced : VARIANTS[variant]}
      custom={delay}
    >
      {children}
    </Component>
  );
};
