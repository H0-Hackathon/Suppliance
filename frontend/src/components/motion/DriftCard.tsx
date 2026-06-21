import React, { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

interface DriftCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  index?: number;
  hoverLift?: boolean;
}

export const DriftCard: React.FC<DriftCardProps> = ({
  children,
  className,
  style,
  index = 0,
  hoverLift = true,
}) => {
  const prefersReduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 22 }}
      animate={
        inView
          ? { opacity: 1, y: prefersReduced ? 0 : [0, -3, 0, 2, 0] }
          : { opacity: 0, y: 22 }
      }
      transition={{
        opacity: { duration: MOTION.reveal.duration, delay: index * MOTION.stagger },
        y: prefersReduced
          ? { duration: MOTION.reveal.duration, delay: index * MOTION.stagger }
          : {
              duration: MOTION.drift.duration + index * 0.6,
              repeat: Infinity,
              ease: MOTION.drift.ease,
              delay: index * 0.45 + MOTION.reveal.duration,
            },
      }}
      whileHover={
        hoverLift && !prefersReduced
          ? { y: -5, boxShadow: '0 8px 28px rgba(43,82,96,0.1)', transition: MOTION.hover }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
};
