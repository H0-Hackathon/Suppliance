import React, { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from '../../motion/tokens';

const ROUTE = 'M 140 300 C 280 240 380 260 520 290 S 760 220 920 180 S 1040 160 1080 170';

const PORTS = [
  { cx: 140, cy: 300, label: 'Shanghai', sub: 'Origin' },
  { cx: 520, cy: 290, label: 'Singapore', sub: 'Transship' },
  { cx: 1080, cy: 170, label: 'Los Angeles', sub: 'Destination' },
] as const;

const STOP_AT = 0.48;
const SINGAPORE = PORTS[1];

export const AnimatedRouteMap: React.FC = () => {
  const reduced = useReducedMotion() ?? false;
  const pathRef = useRef<SVGPathElement>(null);
  const [dot, setDot] = useState({ x: 140, y: 300 });
  const [showNote, setShowNote] = useState(reduced);

  const drawDuration = reduced ? 0 : MOTION.routeDraw.duration;
  const pauseDelay = drawDuration + 0.35;

  useEffect(() => {
    if (reduced) return;

    const path = pathRef.current;
    if (!path) return;

    let frame = 0;
    const start = performance.now();
    const duration = drawDuration * 1000;

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = elapsed < 0.5 ? 2 * elapsed * elapsed : 1 - (-2 * elapsed + 2) ** 2 / 2;
      const at = eased * STOP_AT * path.getTotalLength();
      const pt = path.getPointAtLength(at);
      setDot({ x: pt.x, y: pt.y });

      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDot({ x: SINGAPORE.cx, y: SINGAPORE.cy });
        setShowNote(true);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drawDuration, reduced]);

  return (
    <div className="mkt-hero-map" aria-hidden>
      <svg
        className="mkt-hero-map-svg"
        viewBox="0 0 1200 420"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1200" height="420" fill="transparent" />

        <g stroke="#2B5260" strokeWidth="0.55" opacity="0.18">
          {[...Array(9)].map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={52 + i * 44}
              x2="1200"
              y2={52 + i * 44}
            />
          ))}
          {[...Array(16)].map((_, i) => (
            <line
              key={`v${i}`}
              x1={75 + i * 72}
              y1="0"
              x2={75 + i * 72}
              y2="420"
            />
          ))}
        </g>

        <motion.path
          ref={pathRef}
          d={ROUTE}
          stroke="#548C92"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: STOP_AT, opacity: 1 }}
          transition={{
            pathLength: { duration: drawDuration, ease: MOTION.routeDraw.ease },
            opacity: { duration: 0.4 },
          }}
        />

        <circle cx={dot.x} cy={dot.y} r="7" fill="#AB9072" opacity="0.15" />
        <circle cx={dot.x} cy={dot.y} r="3.5" fill="#AB9072" />

        {PORTS.map(({ cx, cy, label, sub }, i) => (
          <motion.g
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: reduced ? 0 : drawDuration * (i === 0 ? 0.05 : i === 1 ? STOP_AT : STOP_AT),
              duration: 0.4,
            }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={label === 'Singapore' ? 8 : 6}
              fill={label === 'Singapore' ? '#AB9072' : '#2B5260'}
              opacity={0.12}
            />
            <circle
              cx={cx}
              cy={cy}
              r={label === 'Singapore' ? 4 : 3}
              fill={label === 'Singapore' ? '#AB9072' : '#2B5260'}
            />
            <text
              x={cx}
              y={cy + 20}
              textAnchor="middle"
              fill="#2B5260"
              fontSize="12"
              fontWeight="600"
              fontFamily="var(--font, Manrope, sans-serif)"
            >
              {label}
            </text>
            <text
              x={cx}
              y={cy + 33}
              textAnchor="middle"
              fill="#4a6670"
              fontSize="9"
              fontFamily="var(--font, Manrope, sans-serif)"
            >
              {sub}
            </text>
          </motion.g>
        ))}

        {showNote && (
          <g transform={`translate(${SINGAPORE.cx - 72}, ${SINGAPORE.cy - 58})`}>
            <motion.g
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: MOTION.reveal.ease }}
            >
              <line
                x1="72"
                y1="46"
                x2="72"
                y2="58"
                stroke="#AB9072"
                strokeWidth="1"
                opacity="0.5"
              />
              <rect
                width="144"
                height="40"
                rx="6"
                fill="#ffffff"
                stroke="rgba(171, 144, 114, 0.3)"
                strokeWidth="1"
              />
              <text
                x="12"
                y="17"
                fill="#AB9072"
                fontSize="9"
                fontWeight="600"
                letterSpacing="0.06em"
                fontFamily="var(--font, Manrope, sans-serif)"
              >
                HELD AT SINGAPORE
              </text>
              <text
                x="12"
                y="31"
                fill="#2B5260"
                fontSize="10.5"
                fontWeight="600"
                fontFamily="var(--font, Manrope, sans-serif)"
              >
                +4 days · transship at risk
              </text>
            </motion.g>
          </g>
        )}
      </svg>
    </div>
  );
};
