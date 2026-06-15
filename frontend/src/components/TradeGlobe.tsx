import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';

// ─── Data ─────────────────────────────────────────────────────────────────────

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
  { name: 'Vietnam Textiles Ltd',  country: 'Vietnam',       lat: 20.8651,  lng: 106.6838,  status: 'impacted',    riskScore: 82, exposure: '$40,000',  exposureTier: 3 },
  { name: 'Dhaka Apparel Co',      country: 'Bangladesh',    lat: 23.8103,  lng: 90.4125,   status: 'healthy',     riskScore: 21, exposure: '$18,500',  exposureTier: 1 },
  { name: 'Shenzhen Components',   country: 'China',         lat: 22.5431,  lng: 114.0579,  status: 'impacted',    riskScore: 74, exposure: '$95,000',  exposureTier: 3 },
  { name: 'MexiThread Mfg',        country: 'Mexico',        lat: 20.6597,  lng: -103.3496, status: 'alternative', riskScore: 18, exposure: '$22,000',  exposureTier: 2 },
  { name: 'Colombo Fabrics',       country: 'Sri Lanka',     lat: 6.9271,   lng: 79.8612,   status: 'alternative', riskScore: 29, exposure: '$14,000',  exposureTier: 1 },
  { name: 'US Distribution Hub',   country: 'United States', lat: 34.0522,  lng: -118.2437, status: 'customer',    riskScore: 0,  exposure: '$0',       exposureTier: 1 },
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
  { startLat: 20.8651,  startLng: 106.6838,  endLat: 34.0522, endLng: -118.2437, routeStatus: 'impacted',    exposureTier: 3 },
  { startLat: 22.5431,  startLng: 114.0579,  endLat: 34.0522, endLng: -118.2437, routeStatus: 'impacted',    exposureTier: 3 },
  { startLat: 23.8103,  startLng: 90.4125,   endLat: 34.0522, endLng: -118.2437, routeStatus: 'healthy',     exposureTier: 1 },
  { startLat: 20.6597,  startLng: -103.3496, endLat: 34.0522, endLng: -118.2437, routeStatus: 'alternative', exposureTier: 2 },
  { startLat: 6.9271,   startLng: 79.8612,   endLat: 34.0522, endLng: -118.2437, routeStatus: 'alternative', exposureTier: 1 },
];

// ─── Color helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<Supplier['status'], string> = {
  impacted:    '#dc2626',
  healthy:     '#10b981',
  alternative: '#f59e0b',
  customer:    '#38bdf8',
};

const ARC_COLOR: Record<Arc['routeStatus'], [number, number, number, number]> = {
  impacted:    [220, 38,  38,  230],
  healthy:     [16,  185, 129, 200],
  alternative: [245, 158, 11,  220],
};

const ARC_WIDTH: Record<1|2|3, number> = { 1: 0.4, 2: 0.7, 3: 1.1 };
const ARC_DASH_SPEED: Record<1|2|3, number> = { 1: 4000, 2: 2800, 3: 1800 };

// ─── Component ────────────────────────────────────────────────────────────────

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

export const TradeGlobe: React.FC<TradeGlobeProps> = ({ disruptions = [] }) => {
  const globeRef = useRef<GlobeMethods | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const [hoveredSupplier, setHoveredSupplier] = useState<Supplier | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Responsive sizing via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const updateSize = () => {
      setDims({
        width: el.clientWidth || 1200,
        height: el.clientHeight || 800,
      });
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();

    return () => ro.disconnect();
  }, []);

  // Globe initialization
  useEffect(() => {
    if (!globeRef.current) return;

    const globe = globeRef.current;
    
    // Enable controls
    const controls = globe.controls() as any;
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 150;
      controls.maxDistance = 700;
    }

    // Center on Atlantic, tilt slightly for 3D effect
    setTimeout(() => {
      globe.pointOfView({ lat: 15, lng: 0, altitude: 2.2 }, 1500);
    }, 100);
  }, []);

  // Memoized point data with all properties
  const pointsData = useMemo(() => SUPPLIERS, []);
  
  // Memoized arc data
  const arcsData = useMemo(() => ARCS, []);

  // Get point size based on exposure tier
  const getPointRadius = useCallback((d: any) => {
    if (d.status === 'customer') return 0.65;
    return 0.5;
  }, []);

  // Get point color
  const getPointColor = useCallback((d: any) => STATUS_COLOR[d.status], []);

  // Get arc dash length/gap based on tier
  const getArcDashLength = useCallback((d: any) => (d.exposureTier === 3 ? 0.25 : 0.35), []);
  const getArcDashGap = useCallback((d: any) => (d.exposureTier === 3 ? 0.18 : 0.25), []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: '#060a14',
        overflow: 'hidden',
      }}
    >
      <Globe
        ref={globeRef as any}
        width={dims.width}
        height={dims.height}
        
        // ── Globe appearance ──────────────────────────────────────────────
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        showAtmosphere
        atmosphereColor="#1a3a5c"
        atmosphereAltitude={0.18}
        
        // ── Supplier nodes ────────────────────────────────────────────────
        pointsData={pointsData}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointAltitude={(d: any) => 0.012}
        pointRadius={getPointRadius}
        pointColor={getPointColor}
        pointResolution={8}
        pointMerge={false}
        onPointHover={(point: any) => {
          setHoveredSupplier(point || null);
        }}
        
        // ── Trade exposure arcs ────────────────────────────────────────────
        arcsData={arcsData}
        arcStartLat={(d: any) => d.startLat}
        arcStartLng={(d: any) => d.startLng}
        arcEndLat={(d: any) => d.endLat}
        arcEndLng={(d: any) => d.endLng}
        arcColor={(d: any) => ARC_COLOR[d.routeStatus]}
        arcStroke={(d: any) => ARC_WIDTH[d.exposureTier]}
        arcAltitude={0.45}
        arcDashLength={getArcDashLength}
        arcDashGap={getArcDashGap}
        arcDashAnimateTime={(d: any) => ARC_DASH_SPEED[d.exposureTier]}
        arcCurveResolution={64}
        
        // ── Labels ────────────────────────────────────────────────────────
        labelsData={SUPPLIERS.filter((s) => s.status !== 'customer')}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.name}
        labelSize={0.5}
        labelDotRadius={0}
        labelColor={(d: any) => STATUS_COLOR[d.status]}
        labelAltitude={0.022}
        labelResolution={2}
      />

      {/* ── Critical alert banner ── */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(220,38,38,0.1)',
          border: '1px solid rgba(220,38,38,0.35)',
          borderRadius: 6,
          padding: '5px 18px',
          fontSize: 11,
          fontWeight: 700,
          color: '#fca5a5',
          letterSpacing: '0.05em',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 10,
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 12px rgba(220,38,38,0.15)',
        }}
      >
        CRITICAL — Vietnam tariff exposure +34% · Shenzhen factory suspension
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(6,10,20,0.88)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(245,158,11,0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          color: '#cbd5e1',
          minWidth: 210,
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'rgba(245,158,11,0.7)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Trade Exposure Globe
        </div>

        {[
          { color: '#dc2626', label: 'Impacted Supplier' },
          { color: '#10b981', label: 'Healthy Supplier' },
          { color: '#f59e0b', label: 'Alternative Supplier' },
          { color: '#38bdf8', label: 'Customer Destination' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}70`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', margin: '9px 0' }} />

        {[
          { color: '#f59e0b', label: 'Exposure route (gold)' },
          { color: '#dc2626', label: 'Disrupted route (crimson)' },
          { color: '#10b981', label: 'Alternative route (emerald)' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                width: 22,
                height: 2,
                background: color,
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}

        <div
          style={{
            borderTop: '1px solid rgba(245,158,11,0.1)',
            marginTop: 9,
            paddingTop: 8,
            fontSize: 9,
            color: 'rgba(100,116,139,0.6)',
            letterSpacing: '0.04em',
          }}
        >
          Pulse speed = financial exposure velocity
        </div>
      </div>

      {/* ── Hover tooltip ── */}
      {hoveredSupplier && (
        <div
          style={{
            position: 'fixed',
            left: (tooltipPos?.x || 0) + 16,
            top: (tooltipPos?.y || 0) - 10,
            background: 'rgba(6,10,20,0.97)',
            border: `1px solid ${STATUS_COLOR[hoveredSupplier.status]}55`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'Inter, system-ui, sans-serif',
            zIndex: 9999,
            pointerEvents: 'none',
            minWidth: 175,
            backdropFilter: 'blur(14px)',
            boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${STATUS_COLOR[hoveredSupplier.status]}22`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#f1f5f9',
              marginBottom: 2,
            }}
          >
            {hoveredSupplier.name}
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#475569',
              marginBottom: 8,
            }}
          >
            {hoveredSupplier.country}
          </div>
          {hoveredSupplier.status !== 'customer' && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 10, color: '#64748b' }}>Risk Score</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                    color:
                      hoveredSupplier.riskScore > 60
                        ? '#dc2626'
                        : hoveredSupplier.riskScore > 35
                          ? '#f59e0b'
                          : '#10b981',
                  }}
                >
                  {hoveredSupplier.riskScore}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 10, color: '#64748b' }}>Trade Exposure</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#e2e8f0',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {hoveredSupplier.exposure}
                </span>
              </div>
            </>
          )}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(245,158,11,0.1)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: STATUS_COLOR[hoveredSupplier.status],
              textTransform: 'uppercase',
            }}
          >
            {hoveredSupplier.status === 'impacted'
              ? 'AT RISK — Trade exposure elevated'
              : hoveredSupplier.status === 'alternative'
                ? 'ALTERNATIVE — Rerouting available'
                : hoveredSupplier.status === 'customer'
                  ? 'DESTINATION — Distribution hub'
                  : 'HEALTHY — No active disruptions'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeGlobe;
