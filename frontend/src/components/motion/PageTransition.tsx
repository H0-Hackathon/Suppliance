import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: prefersReduced ? 1 : 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.45, ease: MOTION.reveal.ease }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
};
