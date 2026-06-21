import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

interface AmbientLayerProps {
  className?: string;
}

/** Slow background depth — sits behind content, never distracts */
export const AmbientLayer: React.FC<AmbientLayerProps> = ({ className }) => {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return null;

  return (
    <div className={className} aria-hidden style={{ pointerEvents: 'none' }}>
      <motion.div
        style={{
          position: 'absolute',
          top: '-12%',
          right: '-8%',
          width: '42%',
          height: '55%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(180,215,216,0.35) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ x: [0, 18, 0], y: [0, 12, 0] }}
        transition={{ duration: MOTION.ambient.duration, repeat: Infinity, ease: MOTION.ambient.ease }}
      />
      <motion.div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-6%',
          width: '38%',
          height: '48%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(84,140,146,0.18) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }}
        animate={{ x: [0, -14, 0], y: [0, -10, 0] }}
        transition={{
          duration: MOTION.ambient.duration * 1.15,
          repeat: Infinity,
          ease: MOTION.ambient.ease,
          delay: 2,
        }}
      />
      <motion.div
        style={{
          position: 'absolute',
          top: '35%',
          left: '30%',
          width: '24%',
          height: '30%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,215,207,0.5) 0%, transparent 70%)',
          filter: 'blur(32px)',
        }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.55, 0.4] }}
        transition={{
          duration: MOTION.ambient.duration * 0.9,
          repeat: Infinity,
          ease: MOTION.ambient.ease,
          delay: 4,
        }}
      />
    </div>
  );
};
