import React, { useRef, useEffect, useCallback } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';

/** Warm sand — explicit start of scroll gradient (#E0D7CF) */
const SAND = { r: 0xe0, g: 0xd7, b: 0xcf };
const SAND_HEX = '#E0D7CF';
const HARBOR = { r: 84, g: 140, b: 146 };
const NAVY = { r: 43, g: 82, b: 96 };

const TEXT_DARK = '#2B5260';
const TEXT_LIGHT = '#f5f1ec';
const TEXT_SEC_DARK = '#4a6670';
const TEXT_SEC_LIGHT = 'rgb(180 215 216)';
const KICKER_LIGHT = '#AB9072';
const KICKER_DARK = 'rgb(196 175 148)';

/** Quick snap band — dark text only on clearly light backgrounds */
const LUM_DARK_TEXT = 0.58;
const LUM_LIGHT_TEXT = 0.50;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function journeyBackgroundRgb(progress: number) {
  if (progress <= 0.55) {
    return mixRgb(SAND, HARBOR, progress / 0.55);
  }
  return mixRgb(HARBOR, NAVY, (progress - 0.55) / 0.45);
}

function journeyBackground(progress: number) {
  if (progress <= 0) return SAND_HEX;
  const c = journeyBackgroundRgb(progress);
  return `rgb(${c.r} ${c.g} ${c.b})`;
}

function textThemeForLuminance(lum: number) {
  if (lum >= LUM_DARK_TEXT) {
    return {
      text: TEXT_DARK,
      secondary: TEXT_SEC_DARK,
      kicker: KICKER_LIGHT,
      mode: 'light-bg' as const,
    };
  }
  if (lum <= LUM_LIGHT_TEXT) {
    return {
      text: TEXT_LIGHT,
      secondary: TEXT_SEC_LIGHT,
      kicker: KICKER_DARK,
      mode: 'dark-bg' as const,
    };
  }

  const t = (lum - LUM_LIGHT_TEXT) / (LUM_DARK_TEXT - LUM_LIGHT_TEXT);
  const useDarkText = t > 0.5;
  return {
    text: useDarkText ? TEXT_DARK : TEXT_LIGHT,
    secondary: useDarkText ? TEXT_SEC_DARK : TEXT_SEC_LIGHT,
    kicker: useDarkText ? KICKER_LIGHT : KICKER_DARK,
    mode: useDarkText ? ('light-bg' as const) : ('dark-bg' as const),
  };
}

/** Vessel-like pacing — gentle acceleration and deceleration */
function easeJourney(progress: number) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - (-2 * progress + 2) ** 2 / 2;
}

function routePath(breathe: number) {
  const y1 = 640 + breathe * 0.6;
  const y2 = 680 + breathe;
  return `M -40 720 Q 480 ${y1} 960 ${y2} T 1960 ${620 + breathe * 0.4}`;
}

interface MarketingJourneyBackdropProps {
  scrollRef: React.RefObject<HTMLElement | null>;
}

export const MarketingJourneyBackdrop: React.FC<MarketingJourneyBackdropProps> = ({
  scrollRef,
}) => {
  const pathRef = useRef<SVGPathElement>(null);
  const scrollProgressRef = useRef(0);
  const glowRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ['start start', 'end end'],
  });

  const backgroundColor = useTransform(scrollYProgress, (p) => journeyBackground(p));

  const applyTheme = useCallback((p: number) => {
    const root = scrollRef.current;
    if (!root) return;

    scrollProgressRef.current = p;

    const lum = relativeLuminance(journeyBackgroundRgb(p));
    const theme = textThemeForLuminance(lum);

    root.style.setProperty('--mkt-journey-text', theme.text);
    root.style.setProperty('--mkt-journey-text-secondary', theme.secondary);
    root.style.setProperty('--mkt-journey-kicker', theme.kicker);
    root.style.setProperty('--mkt-journey-nav-bg', journeyBackground(Math.min(p, 0.12)));
    root.dataset.mktTheme = theme.mode;

    root.style.setProperty(
      '--mkt-route-opacity',
      String(p < 0.08 ? 0.16 + p * 1.25 : p > 0.92 ? 0.3 - (p - 0.92) * 1 : 0.26),
    );
  }, [scrollRef]);

  useMotionValueEvent(scrollYProgress, 'change', applyTheme);

  useEffect(() => {
    applyTheme(0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const tick = (now: number) => {
      const path = pathRef.current;
      const glow = glowRef.current;
      const core = coreRef.current;
      const halo = haloRef.current;

      if (path && glow && core && halo) {
        const elapsed = now / 1000;
        const breathe = reduced ? 0 : Math.sin(elapsed * 0.45) * 5;
        const sway = reduced ? 0 : Math.sin(elapsed * 0.65) * 6;

        path.setAttribute('d', routePath(breathe));

        const eased = easeJourney(scrollProgressRef.current);
        const total = path.getTotalLength();
        const at = eased * total;
        const pt = path.getPointAtLength(at);
        const ahead = path.getPointAtLength(Math.min(at + 2, total));
        const angle = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
        const bob = reduced ? 0 : Math.sin(elapsed * 0.85 + eased * 4) * 5;

        const x = pt.x - Math.sin(angle) * (sway + bob);
        const y = pt.y + Math.cos(angle) * (sway + bob);

        glow.setAttribute('cx', String(x));
        glow.setAttribute('cy', String(y));
        core.setAttribute('cx', String(x));
        core.setAttribute('cy', String(y));
        halo.setAttribute('cx', String(x));
        halo.setAttribute('cy', String(y));
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyTheme]);

  return (
    <div className="mkt-journey-backdrop" aria-hidden>
      <motion.div className="mkt-journey-bg" style={{ backgroundColor }} />
      <svg
        className="mkt-journey-route-svg"
        viewBox="0 0 1920 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <radialGradient id="mkt-marker-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#AB9072" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#AB9072" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#AB9072" stopOpacity="0" />
          </radialGradient>
          <filter id="mkt-marker-soft" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          ref={pathRef}
          d={routePath(0)}
          stroke="#548C92"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ opacity: 'var(--mkt-route-opacity, 0.22)' }}
        />

        <circle ref={haloRef} r="18" fill="url(#mkt-marker-glow)" opacity="0.85" />
        <circle
          ref={glowRef}
          r="9"
          fill="#AB9072"
          opacity="0.18"
          filter="url(#mkt-marker-soft)"
        />
        <circle
          ref={coreRef}
          r="5"
          fill="#AB9072"
          opacity="0.75"
          filter="url(#mkt-marker-soft)"
        />
      </svg>
    </div>
  );
};
