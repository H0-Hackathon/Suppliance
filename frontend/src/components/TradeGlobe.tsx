import { Map } from 'react-map-gl/maplibre';
import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { MapView } from '@deck.gl/core';

// ─── Supplier Risk Network Data ───────────────────────────────────────────────

interface Supplier {
  name: string;
  country: string;
  coords: [number, number];
  status: 'impacted' | 'healthy' | 'alternative' | 'customer';
  riskScore: number;
  exposure: string;
  // exposure ring size: 1=low, 2=moderate, 3=high
  exposureTier: 1 | 2 | 3;
}

const SUPPLIERS: Supplier[] = [
  {
    name: 'Vietnam Textiles Ltd',
    country: 'Vietnam',
    coords: [106.6838, 20.8651],
    status: 'impacted',
    riskScore: 82,
    exposure: '$40,000',
    exposureTier: 3,
  },
  {
    name: 'Dhaka Apparel Co',
    country: 'Bangladesh',
    coords: [90.4125, 23.8103],
    status: 'healthy',
    riskScore: 21,
    exposure: '$18,500',
    exposureTier: 1,
  },
  {
    name: 'Shenzhen Components',
    country: 'China',
    coords: [114.0579, 22.5431],
    status: 'impacted',
    riskScore: 74,
    exposure: '$95,000',
    exposureTier: 3,
  },
  {
    name: 'MexiThread Mfg',
    country: 'Mexico',
    coords: [-103.3496, 20.6597],
    status: 'alternative',
    riskScore: 18,
    exposure: '$22,000',
    exposureTier: 2,
  },
  {
    name: 'Colombo Fabrics',
    country: 'Sri Lanka',
    coords: [79.8612, 6.9271],
    status: 'alternative',
    riskScore: 29,
    exposure: '$14,000',
    exposureTier: 1,
  },
  {
    name: 'US Distribution Hub',
    country: 'United States',
    coords: [-118.2437, 34.0522],
    status: 'customer',
    riskScore: 0,
    exposure: '$0',
    exposureTier: 1,
  },
];

interface Route {
  source: [number, number];
  target: [number, number];
  routeStatus: 'impacted' | 'healthy' | 'alternative';
}

const ROUTES: Route[] = [
  { source: [106.6838, 20.8651], target: [-118.2437, 34.0522], routeStatus: 'impacted' },
  { source: [114.0579, 22.5431], target: [-118.2437, 34.0522], routeStatus: 'impacted' },
  { source: [90.4125, 23.8103],  target: [-118.2437, 34.0522], routeStatus: 'healthy' },
  { source: [-103.3496, 20.6597], target: [-118.2437, 34.0522], routeStatus: 'alternative' },
  { source: [79.8612, 6.9271],   target: [-118.2437, 34.0522], routeStatus: 'alternative' },
];

// ─── Color maps ───────────────────────────────────────────────────────────────

// Warm trade-risk palette: crimson · emerald · amber · teal
const NODE_COLOR: Record<Supplier['status'], [number, number, number]> = {
  impacted:    [220, 38, 38],    // crimson
  healthy:     [16, 185, 129],   // emerald
  alternative: [13, 148, 136],   // teal
  customer:    [217, 119, 6],    // amber
};

const ROUTE_COLOR: Record<Route['routeStatus'], { src: [number,number,number,number]; tgt: [number,number,number,number] }> = {
  impacted:    { src: [220, 38, 38, 230],  tgt: [220, 38, 38, 35]  },
  healthy:     { src: [16, 185, 129, 220], tgt: [16, 185, 129, 35] },
  alternative: { src: [13, 148, 136, 220], tgt: [13, 148, 136, 35] },
};

// Ring radius per tier (in meters)
const RING_RADIUS: Record<1|2|3, number> = {
  1: 180000,
  2: 310000,
  3: 480000,
};

const INITIAL_VIEW = { longitude: -10, latitude: 22, zoom: 1.7, pitch: 0, bearing: 0 };

// ─── Particle helpers ─────────────────────────────────────────────────────────

// Particles per route tier — more particles = higher exposure
const PARTICLES_PER_TIER: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 9 };

// Great-circle interpolation between two lon/lat points at fraction t
function lerpGreatCircle(
  src: [number, number],
  tgt: [number, number],
  t: number,
  arcHeight = 0.35
): [number, number, number] {
  // Simple spherical linear interpolation (good enough for short-to-mid arcs)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(src[1]);
  const lon1 = toRad(src[0]);
  const lat2 = toRad(tgt[1]);
  const lon2 = toRad(tgt[0]);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (d === 0) return [src[0], src[1], 0];
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);
  // Bell-curve altitude lift
  const alt = Math.sin(t * Math.PI) * arcHeight * 1e6;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI, alt];
}

interface Particle {
  position: [number, number, number];
  color: [number, number, number, number];
  radius: number;
}

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
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hoveredNode, setHoveredNode] = useState<Supplier | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [animTick, setAnimTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAnimTick(t => (t + 1) % 360), 40);
    return () => clearInterval(id);
  }, []);

  // Pulse factor: 0→1→0
  const pulse = (Math.sin((animTick / 360) * Math.PI * 2) + 1) / 2;

  // ── Exposure packet particles (recomputed every tick) ──────────────────────
  const particles = useMemo<Particle[]>(() => {
    const out: Particle[] = [];
    ROUTES.forEach((route) => {
      // Determine exposure tier from the source supplier
      const supplier = SUPPLIERS.find(
        (s) => s.coords[0] === route.source[0] && s.coords[1] === route.source[1]
      );
      const tier = (supplier?.exposureTier ?? 1) as 1 | 2 | 3;
      const count = PARTICLES_PER_TIER[tier];
      const color = ROUTE_COLOR[route.routeStatus].src;

      for (let i = 0; i < count; i++) {
        // Each particle has a base offset spread evenly, animated by tick
        const baseT = i / count;
        const t = ((baseT + animTick / 360) % 1 + 1) % 1; // 0→1 looping
        const position = lerpGreatCircle(route.source, route.target, t);
        // Fade out near endpoints for smooth appearance/disappearance
        const alpha = t < 0.08
          ? Math.round((t / 0.08) * 230)
          : t > 0.92
          ? Math.round(((1 - t) / 0.08) * 230)
          : 230;
        // Larger, brighter packets on high-exposure routes
        const radius = tier === 3 ? 55000 : tier === 2 ? 40000 : 28000;
        out.push({ position, color: [color[0], color[1], color[2], alpha], radius });
      }
    });
    return out;
  }, [animTick]);

  // ── Layers ──────────────────────────────────────────────────────────────────

  // Heat zone glow under high-risk nodes (soft filled halo)
  const heatLayer = new ScatterplotLayer<Supplier>({
    id: 'heat-zones',
    data: SUPPLIERS.filter((s) => s.exposureTier === 3 && s.status !== 'customer'),
    getPosition: (d) => d.coords,
    getFillColor: (d) => [...NODE_COLOR[d.status], Math.round(18 + pulse * 22)] as [number,number,number,number],
    getRadius: 620000 + pulse * 80000,
    stroked: false,
    radiusUnits: 'meters',
    updateTriggers: { getFillColor: animTick, getRadius: animTick },
  });

  // Outer exposure rings (pulsing, per tier)
  const riskRingLayers = ([1, 2, 3] as const).map((tier) => {
    const data = SUPPLIERS.filter(
      (s) => s.exposureTier === tier && s.status !== 'customer'
    );
    const baseRadius = RING_RADIUS[tier];
    const pulseAmt = tier === 3 ? 60000 : tier === 2 ? 35000 : 15000;
    return new ScatterplotLayer<Supplier>({
      id: `risk-ring-${tier}`,
      data,
      getPosition: (d) => d.coords,
      getFillColor: [0, 0, 0, 0],
      getLineColor: (d) => [...NODE_COLOR[d.status], tier === 3 ? 190 : tier === 2 ? 130 : 75] as [number,number,number,number],
      getLineWidth: tier === 3 ? 3 : tier === 2 ? 2 : 1,
      stroked: true,
      filled: false,
      getRadius: baseRadius + pulse * pulseAmt,
      updateTriggers: { getRadius: animTick },
      radiusUnits: 'meters',
    });
  });

  // Base route arcs — dim underlayer
  const arcBaseLayer = new ArcLayer<Route>({
    id: 'routes-base',
    data: ROUTES,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getSourceColor: (d) => {
      const c = ROUTE_COLOR[d.routeStatus].src;
      return [c[0], c[1], c[2], 40] as [number,number,number,number];
    },
    getTargetColor: (d) => {
      const c = ROUTE_COLOR[d.routeStatus].tgt;
      return [c[0], c[1], c[2], 10] as [number,number,number,number];
    },
    getWidth: (d) => d.routeStatus === 'impacted' ? 1 : 0.8,
    greatCircle: true,
    getHeight: 0.5,
  });

  // Bright glow arcs on top (impacted routes glow harder)
  const arcGlowLayer = new ArcLayer<Route>({
    id: 'routes-glow',
    data: ROUTES,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getSourceColor: (d) => ROUTE_COLOR[d.routeStatus].src,
    getTargetColor: (d) => ROUTE_COLOR[d.routeStatus].tgt,
    getWidth: (d) => d.routeStatus === 'impacted' ? 2.5 : d.routeStatus === 'alternative' ? 1.8 : 1.5,
    greatCircle: true,
    getHeight: 0.5,
  });

  // Exposure packet particles
  const particleLayer = new ScatterplotLayer<Particle>({
    id: 'particles',
    data: particles,
    getPosition: (d) => d.position,
    getFillColor: (d) => d.color,
    getRadius: (d) => d.radius,
    stroked: false,
    radiusUnits: 'meters',
    updateTriggers: { getPosition: animTick, getFillColor: animTick, getRadius: animTick },
  });

  // Node core dots
  const nodeLayer = new ScatterplotLayer<Supplier>({
    id: 'nodes',
    data: SUPPLIERS,
    getPosition: (d) => d.coords,
    getFillColor: (d) =>
      hoveredNode?.name === d.name
        ? [255, 255, 255, 255]
        : [...NODE_COLOR[d.status], 240] as [number,number,number,number],
    getLineColor: (d) => [...NODE_COLOR[d.status], 255] as [number,number,number,number],
    getLineWidth: 2,
    stroked: true,
    filled: true,
    getRadius: (d) => hoveredNode?.name === d.name ? 110000 : 75000,
    pickable: true,
    onHover: ({ object, x, y }: any) => {
      setHoveredNode(object ?? null);
      setTooltipPos(object ? { x, y } : null);
    },
    updateTriggers: { getFillColor: hoveredNode, getRadius: hoveredNode },
    transitions: { getRadius: 100 },
    radiusUnits: 'meters',
  });

  // Floating labels (name)
  const labelLayer = new TextLayer<Supplier>({
    id: 'labels',
    data: SUPPLIERS.filter((s) => s.status !== 'customer'),
    getPosition: (d) => d.coords,
    getText: (d) => d.name,
    getSize: 11,
    getColor: (d) => [...NODE_COLOR[d.status], 210] as [number,number,number,number],
    getPixelOffset: [0, -22],
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 600,
    background: true,
    getBackgroundColor: [14, 11, 7, 185],
    getBorderColor: (d) => [...NODE_COLOR[d.status], 80] as [number,number,number,number],
    getBorderWidth: 1,
    backgroundPadding: [4, 2, 4, 2],
    pickable: false,
  });

  // Risk score sub-labels
  const scoreLayer = new TextLayer<Supplier>({
    id: 'scores',
    data: SUPPLIERS.filter((s) => s.status !== 'customer'),
    getPosition: (d) => d.coords,
    getText: (d) => `Risk ${d.riskScore}  ·  Exp ${d.exposure}`,
    getSize: 9,
    getColor: [160, 148, 130, 180],
    getPixelOffset: [0, -8],
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 400,
    background: true,
    getBackgroundColor: [14, 11, 7, 165],
    getBorderColor: [50, 38, 22, 60],
    getBorderWidth: 1,
    backgroundPadding: [4, 2, 4, 2],
    pickable: false,
  });

  const layers = [
    heatLayer,
    ...riskRingLayers,
    arcBaseLayer,
    arcGlowLayer,
    particleLayer,
    nodeLayer,
    labelLayer,
    scoreLayer,
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, background: '#060d1f', overflow: 'hidden' }}>
      <DeckGL
        views={new MapView({ id: 'map', repeat: true })}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
        controller={true}
        layers={layers}
        style={{ position: 'absolute', inset: 0 }}
        parameters={{ clearColor: [0.04, 0.03, 0.02, 1] }}
      >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
      </DeckGL>

      {/* ── Critical alert banner ── */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.32)',
        borderRadius: 6, padding: '5px 16px', fontSize: 11, fontWeight: 700,
        color: '#fca5a5', letterSpacing: '0.05em', fontFamily: 'Inter, system-ui, sans-serif',
        zIndex: 10, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
      }}>
        CRITICAL — Vietnam tariff +34% · Shenzhen factory suspension
      </div>

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(14,11,7,0.9)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245,158,11,0.12)', borderRadius: 10,
        padding: '12px 16px', fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11, color: '#cbd5e1', minWidth: 220, zIndex: 10,
      }}>
        <div style={{
          fontWeight: 700, fontSize: 9, letterSpacing: '0.1em',
          color: 'rgba(120,113,108,0.7)', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Supplier Risk Network
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
              width: 9, height: 9, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}80`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', margin: '10px 0' }} />

        {/* Route types */}
        {([
          { color: '#dc2626', label: 'Impacted route' },
          { color: '#10b981', label: 'Healthy route' },
          { color: '#0d9488', label: 'Alternative route' },
        ] as const).map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', margin: '10px 0' }} />

        {/* Risk rings */}
        <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.7)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Exposure Rings
        </div>
        {([
          { label: 'Low exposure', dash: '1px' },
          { label: 'Moderate exposure', dash: '2px' },
          { label: 'High exposure (pulsing)', dash: '3px' },
        ]).map(({ label, dash }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `${dash} solid rgba(148,163,184,0.5)`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Hover tooltip ── */}
      {hoveredNode && tooltipPos && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 14,
          top: tooltipPos.y - 10,
          background: 'rgba(14,11,7,0.97)',
          border: `1px solid ${NODE_COLOR[hoveredNode.status] ? `rgba(${NODE_COLOR[hoveredNode.status].join(',')},0.4)` : 'rgba(56,189,248,0.3)'}`,
          borderRadius: 8, padding: '10px 14px',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 30, pointerEvents: 'none',
          minWidth: 170,
          backdropFilter: 'blur(12px)',
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
                  fontSize: 11, fontWeight: 700,
                  color: hoveredNode.riskScore > 60 ? '#ef4444' : hoveredNode.riskScore > 35 ? '#fbbf24' : '#22c55e',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {hoveredNode.riskScore}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Exposure</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                  {hoveredNode.exposure}
                </span>
              </div>
            </>
          )}
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid rgba(56,189,248,0.1)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            color: hoveredNode.status === 'impacted' ? '#ef4444'
              : hoveredNode.status === 'alternative' ? '#fbbf24'
              : hoveredNode.status === 'customer' ? '#38bdf8'
              : '#22c55e',
            textTransform: 'uppercase',
          }}>
            {hoveredNode.status === 'impacted' ? 'AT RISK — Trade exposure elevated'
              : hoveredNode.status === 'alternative' ? 'ALTERNATIVE — Rerouting available'
              : hoveredNode.status === 'customer' ? 'DESTINATION'
              : 'HEALTHY — No active disruptions'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeGlobe;
