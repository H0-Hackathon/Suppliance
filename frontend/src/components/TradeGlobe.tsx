import React, { useState, useEffect, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Supplier {
  name: string;
  country: string;
  lat: number;
  lng: number;
  status: 'impacted' | 'healthy' | 'alternative' | 'customer';
  riskScore: number;
  exposure: string;
  exposureTier: 1 | 2 | 3;
}

const SUPPLIERS: Supplier[] = [
  { name: 'Vietnam Textiles Ltd', country: 'Vietnam',      lat: 20.8651,  lng: 106.6838,  status: 'impacted',    riskScore: 82, exposure: '$40,000', exposureTier: 3 },
  { name: 'Dhaka Apparel Co',     country: 'Bangladesh',   lat: 23.8103,  lng: 90.4125,   status: 'healthy',     riskScore: 21, exposure: '$18,500', exposureTier: 1 },
  { name: 'Shenzhen Components',  country: 'China',        lat: 22.5431,  lng: 114.0579,  status: 'impacted',    riskScore: 74, exposure: '$95,000', exposureTier: 3 },
  { name: 'MexiThread Mfg',       country: 'Mexico',       lat: 20.6597,  lng: -103.3496, status: 'alternative', riskScore: 18, exposure: '$22,000', exposureTier: 2 },
  { name: 'Colombo Fabrics',      country: 'Sri Lanka',    lat: 6.9271,   lng: 79.8612,   status: 'alternative', riskScore: 29, exposure: '$14,000', exposureTier: 1 },
  { name: 'US Distribution Hub',  country: 'United States',lat: 34.0522,  lng: -118.2437, status: 'customer',    riskScore: 0,  exposure: '$0',      exposureTier: 1 },
];

interface Arc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  routeStatus: 'impacted' | 'healthy' | 'alternative';
  exposureTier: 1 | 2 | 3;
}

const ARCS: Arc[] = [
  { startLat: 20.8651, startLng: 106.6838, endLat: 34.0522, endLng: -118.2437, routeStatus: 'impacted',    exposureTier: 3 },
  { startLat: 22.5431, startLng: 114.0579, endLat: 34.0522, endLng: -118.2437, routeStatus: 'impacted',    exposureTier: 3 },
  { startLat: 23.8103, startLng: 90.4125,  endLat: 34.0522, endLng: -118.2437, routeStatus: 'healthy',     exposureTier: 1 },
  { startLat: 20.6597, startLng: -103.3496,endLat: 34.0522, endLng: -118.2437, routeStatus: 'alternative', exposureTier: 2 },
  { startLat: 6.9271,  startLng: 79.8612,  endLat: 34.0522, endLng: -118.2437, routeStatus: 'alternative', exposureTier: 1 },
];

// ─── Color maps ───────────────────────────────────────────────────────────────

const NODE_HEX: Record<Supplier['status'], string> = {
  impacted:    '#dc2626',
  healthy:     '#10b981',
  alternative: '#0d9488',
  customer:    '#d97706',
};

const ARC_COLOR: Record<Arc['routeStatus'], string> = {
  impacted:    '#dc2626',
  healthy:     '#10b981',
  alternative: '#f59e0b',
};

// Ring sizes per tier (globe altitude, 0–1 range)
const RING_MAX_R: Record<1|2|3, number> = { 1: 1.5, 2: 2.8, 3: 4.2 };

// Particles per arc
const PULSES: Record<1|2|3, number> = { 1: 1, 2: 2, 3: 3 };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisruptionPoint {
  incident_id: string;
  title: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: string | null;
}

export interface TradeGlobeProps {
  disruptions?: DisruptionPoint[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TradeGlobe: React.FC<TradeGlobeProps> = ({ disruptions = [] }) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [hoveredNode, setHoveredNode] = useState<Supplier | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [animTick, setAnimTick] = useState(0);

  // Size tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight });
    });
    obs.observe(el);
    setDims({ w: el.offsetWidth || 800, h: el.offsetHeight || 600 });
    return () => obs.disconnect();
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate = true;
    ctrl.autoRotateSpeed = 0.4;
    ctrl.enableZoom = true;
    ctrl.enablePan = false;
    globeRef.current.pointOfView({ lat: 22, lng: 18, altitude: 2.2 }, 1200);
  }, []);

  // Pulse ticker for rings
  useEffect(() => {
    const id = setInterval(() => setAnimTick(t => (t + 1) % 360), 40);
    return () => clearInterval(id);
  }, []);

  // ── Ring data (pulsing per node) ───────────────────────────────────────────
  const ringData = SUPPLIERS.flatMap((s) => {
    if (s.status === 'customer') return [];
    return [{ lat: s.lat, lng: s.lng, maxR: RING_MAX_R[s.exposureTier], color: NODE_HEX[s.status], speed: s.exposureTier }];
  });

  // ── Arc stroke width per tier ──────────────────────────────────────────────
  const arcStroke = (d: Arc) => d.exposureTier === 3 ? 1.2 : d.exposureTier === 2 ? 0.9 : 0.6;

  // ── Arc dash for animated pulses ───────────────────────────────────────────
  // dashLength + dashGap + animateTime drive the flowing pulse effect
  const arcDashLength = (d: Arc) => d.exposureTier === 3 ? 0.4 : 0.25;
  const arcDashGap    = (d: Arc) => 1 - arcDashLength(d);
  const arcAnimTime   = (d: Arc) => d.routeStatus === 'impacted' ? 1800 : 2800;

  // ── Node point color / size ────────────────────────────────────────────────
  const pointColor  = (d: Supplier) => NODE_HEX[d.status];
  const pointRadius = (d: Supplier) => d.status === 'customer' ? 0.45 : d.exposureTier === 3 ? 0.55 : 0.4;
  const pointAlt    = (d: Supplier) => d.status === 'customer' ? 0.005 : 0.01;

  // ── Hover handlers ─────────────────────────────────────────────────────────
  const onPointHover = useCallback((point: object | null, _prev: object | null, event?: MouseEvent) => {
    const s = point as Supplier | null;
    setHoveredNode(s);
    if (s && event) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    } else {
      setTooltipPos(null);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: '#020b18', overflow: 'hidden' }}
    >
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}

        // ── Earth textures ──────────────────────────────────────────────────
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        // ── Atmosphere ─────────────────────────────────────────────────────
        showAtmosphere={true}
        atmosphereColor="#1a4a7a"
        atmosphereAltitude={0.18}

        // ── Supplier nodes ─────────────────────────────────────────────────
        pointsData={SUPPLIERS}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor as any}
        pointRadius={pointRadius as any}
        pointAltitude={pointAlt as any}
        pointResolution={16}
        onPointHover={onPointHover as any}
        pointLabel={() => ''}

        // ── Exposure arcs ──────────────────────────────────────────────────
        arcsData={ARCS}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(d: any) => {
          const hex = ARC_COLOR[(d as Arc).routeStatus];
          // base→faded gradient: [source color, transparent]
          return [hex, `${hex}22`];
        }}
        arcAltitude={(d: any) => (d as Arc).exposureTier === 3 ? 0.5 : 0.35}
        arcStroke={arcStroke as any}
        arcDashLength={arcDashLength as any}
        arcDashGap={arcDashGap as any}
        arcDashAnimateTime={arcAnimTime as any}

        // ── Exposure rings ─────────────────────────────────────────────────
        ringsData={ringData}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius="maxR"
        ringColor={(d: any) => (t: number) => `${d.color}${Math.round((1 - t) * 200).toString(16).padStart(2, '0')}`}
        ringRepeatPeriod={(d: any) => (4 - d.speed) * 900}
        ringPropagationSpeed={(d: any) => d.speed * 1.2}
        ringAltitude={0.005}

        // ── Misc ───────────────────────────────────────────────────────────
        rendererConfig={{ antialias: true, alpha: true }}
      />

      {/* ── Critical alert banner ── */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.32)',
        borderRadius: 6, padding: '5px 18px', fontSize: 11, fontWeight: 700,
        color: '#fca5a5', letterSpacing: '0.06em', fontFamily: 'Inter, system-ui, sans-serif',
        zIndex: 10, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)',
      }}>
        CRITICAL — Vietnam tariff +34% · Shenzhen factory suspension
      </div>

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(2,11,24,0.88)', backdropFilter: 'blur(14px)',
        border: '1px solid rgba(245,158,11,0.14)', borderRadius: 10,
        padding: '12px 16px', fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11, color: '#cbd5e1', minWidth: 210, zIndex: 10,
      }}>
        <div style={{
          fontWeight: 700, fontSize: 9, letterSpacing: '0.12em',
          color: 'rgba(120,113,108,0.65)', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Trade Exposure Network
        </div>

        {/* Node types */}
        {([
          { color: '#dc2626', label: 'Impacted Supplier' },
          { color: '#10b981', label: 'Healthy Supplier' },
          { color: '#0d9488', label: 'Alternative Supplier' },
          { color: '#d97706', label: 'Customer Destination' },
        ] as const).map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%', background: color,
              boxShadow: `0 0 6px ${color}90`, flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '9px 0' }} />

        {/* Route types */}
        {([
          { color: '#dc2626', label: 'Disrupted route — exposure risk' },
          { color: '#10b981', label: 'Healthy route' },
          { color: '#f59e0b', label: 'Alternative route — gold' },
        ] as const).map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '9px 0' }} />

        <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Pulsing rings = exposure tier
        </div>
        {(['Low', 'Moderate', 'High'] as const).map((tier, i) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 14 + i * 4, height: 14 + i * 4, borderRadius: '50%',
              border: `${1 + i}px solid rgba(148,163,184,${0.3 + i * 0.15})`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{tier} exposure</span>
          </div>
        ))}
      </div>

      {/* ── Hover tooltip ── */}
      {hoveredNode && tooltipPos && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 16,
          top: tooltipPos.y - 12,
          background: 'rgba(2,11,24,0.97)',
          border: `1px solid ${NODE_HEX[hoveredNode.status]}55`,
          borderRadius: 8, padding: '10px 14px',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 30, pointerEvents: 'none', minWidth: 176,
          backdropFilter: 'blur(14px)',
          boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px ${NODE_HEX[hoveredNode.status]}22`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
            {hoveredNode.name}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>
            {hoveredNode.country}
          </div>
          {hoveredNode.status !== 'customer' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Risk Score</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                  color: hoveredNode.riskScore > 60 ? '#ef4444' : hoveredNode.riskScore > 35 ? '#fbbf24' : '#22c55e',
                }}>
                  {hoveredNode.riskScore}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Exposure</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                  {hoveredNode.exposure}
                </span>
              </div>
            </>
          )}
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: NODE_HEX[hoveredNode.status],
            textTransform: 'uppercase',
          }}>
            {hoveredNode.status === 'impacted'    ? 'AT RISK — Trade exposure elevated'
            : hoveredNode.status === 'alternative' ? 'ALTERNATIVE — Rerouting available'
            : hoveredNode.status === 'customer'    ? 'DESTINATION'
            :                                        'HEALTHY — No active disruptions'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeGlobe;
