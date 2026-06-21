import React, { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

const STEPS = [
  {
    label: 'Flagged',
    phrase: 'Watching for tariffs, sanctions, port holdups — anything on your lanes.',
  },
  {
    label: 'Checked',
    phrase: 'Working out what it actually costs you: which orders, how many days.',
  },
  {
    label: 'Compliant',
    phrase: 'Finding real alternatives — other routes, other suppliers.',
    quiet: 'Checked against thousands of suppliers we already know.',
  },
  {
    label: 'Confirmed',
    phrase: 'Reviewed again before anything lands in your inbox.',
  },
] as const;

const THREAD = 'M 48 44 H 752';
const POINTS = [48, 282, 516, 752] as const;

function easeJourney(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export const PipelineThread: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState(0);
  const [marker, setMarker] = useState({ x: 48, y: 44 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.88', 'end 0.35'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const eased = easeJourney(Math.min(1, Math.max(0, p)));
    const index = Math.min(STEPS.length - 1, Math.floor(eased * STEPS.length));
    setActive(index);

    const path = pathRef.current;
    if (path) {
      const pt = path.getPointAtLength(eased * path.getTotalLength());
      setMarker({ x: pt.x, y: pt.y });
    }
  });

  const step = STEPS[active];

  return (
    <section id="underneath" className="mkt-thread" ref={sectionRef}>
      <p className="mkt-thread-intro">What happens while you&apos;re not looking.</p>

      <div className="mkt-thread-stage">
        <svg className="mkt-thread-svg" viewBox="0 0 800 88" fill="none" aria-hidden>
          <path
            ref={pathRef}
            d={THREAD}
            stroke="#548C92"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          {POINTS.map((x, i) => (
            <g key={STEPS[i].label}>
              <circle
                cx={x}
                cy={44}
                r={i === active ? 6 : 4}
                fill={i === active ? '#AB9072' : '#548C92'}
                opacity={i === active ? 0.35 : 0.2}
              />
              <circle
                cx={x}
                cy={44}
                r={i === active ? 3.5 : 2.5}
                fill={i === active ? '#AB9072' : '#2B5260'}
                opacity={i <= active ? 0.9 : 0.35}
              />
              <text
                x={x}
                y={68}
                textAnchor="middle"
                className={`mkt-thread-dot-label${i === active ? ' is-active' : ''}`}
              >
                {STEPS[i].label}
              </text>
            </g>
          ))}
          <circle cx={marker.x} cy={marker.y} r="9" fill="#AB9072" opacity="0.14" />
          <circle cx={marker.x} cy={marker.y} r="4" fill="#AB9072" opacity="0.88" />
        </svg>

        <div className="mkt-thread-phrases" aria-live="polite">
          {STEPS.map(({ phrase, label }, i) => (
            <p
              key={label}
              className={`mkt-thread-phrase${i === active ? ' is-active' : ''}`}
              aria-hidden={i !== active}
            >
              {phrase}
            </p>
          ))}
        </div>

        {'quiet' in step && step.quiet && (
          <p className="mkt-thread-quiet">{step.quiet}</p>
        )}
      </div>
    </section>
  );
};
