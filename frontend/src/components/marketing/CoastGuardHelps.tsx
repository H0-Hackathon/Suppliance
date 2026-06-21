import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

const BEATS = [
  'We catch it early.',
  'We tell you what it means.',
  'You make the call.',
] as const;

export const CoastGuardHelps: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.85', 'end 0.4'],
  });

  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="underneath" className="mkt-helps" ref={sectionRef}>
      <p className="mkt-helps-intro">What you get</p>

      <div className="mkt-helps-track">
        <div className="mkt-helps-line" aria-hidden>
          <motion.span
            className="mkt-helps-line-fill"
            style={{
              scaleX: reduced ? 1 : lineScale,
              transformOrigin: 'left center',
            }}
          />
        </div>

        <ul className="mkt-helps-beats">
          {BEATS.map((beat, i) => (
            <HelpsBeat
              key={beat}
              beat={beat}
              index={i}
              progress={scrollYProgress}
              reduced={reduced}
            />
          ))}
        </ul>
      </div>
    </section>
  );
};

function HelpsBeat({
  beat,
  index,
  progress,
  reduced,
}: {
  beat: string;
  index: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  reduced: boolean;
}) {
  const threshold = (index + 0.35) / BEATS.length;
  const opacity = useTransform(progress, [threshold - 0.12, threshold], [0, 1]);
  const x = useTransform(progress, [threshold - 0.12, threshold], [-28, 0]);

  return (
    <motion.li
      className="mkt-helps-beat"
      style={reduced ? undefined : { opacity, x }}
    >
      <span className="mkt-helps-dot" />
      <span>{beat}</span>
    </motion.li>
  );
}
