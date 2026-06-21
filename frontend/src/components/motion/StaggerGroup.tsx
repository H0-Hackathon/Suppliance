import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

interface StaggerGroupProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}

/** Reveals children one after another on scroll */
export const StaggerGroup: React.FC<StaggerGroupProps> = ({
  children,
  className,
  stagger = MOTION.stagger,
}) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-48px' }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: prefersReduced ? 0 : stagger, delayChildren: 0.06 },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={
        prefersReduced
          ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
          : {
              hidden: { opacity: 0, y: 20 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: MOTION.reveal.duration, ease: MOTION.reveal.ease },
              },
            }
      }
    >
      {children}
    </motion.div>
  );
};
