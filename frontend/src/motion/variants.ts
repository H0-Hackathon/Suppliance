import type { Variants } from 'framer-motion';
import { MOTION } from './tokens';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.reveal.duration,
      ease: MOTION.reveal.ease,
      delay,
    },
  }),
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (delay = 0) => ({
    opacity: 1,
    transition: { duration: MOTION.reveal.duration, ease: MOTION.reveal.ease, delay },
  }),
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 36 },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: MOTION.hero.duration, ease: MOTION.hero.ease, delay },
  }),
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: MOTION.stagger, delayChildren: 0.08 },
  },
};

export const driftCard: Variants = {
  idle: { y: 0 },
  float: (i = 0) => ({
    y: [0, -4, 0, 3, 0],
    transition: {
      duration: MOTION.drift.duration + i * 0.8,
      repeat: Infinity,
      ease: MOTION.drift.ease,
      delay: i * 0.4,
    },
  }),
};

/** Reduced-motion fallback: instant visible state */
export const reduced = {
  hidden: { opacity: 1, y: 0, x: 0 },
  visible: { opacity: 1, y: 0, x: 0 },
};
