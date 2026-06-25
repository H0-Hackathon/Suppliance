import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { useAuth } from '@clerk/clerk-react';

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
  reliabilityScore?: number;
}

interface Arc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  routeStatus: 'impacted' | 'healthy' | 'alternative';
  exposureTier: 1 | 2 | 3;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<Supplier['status'], string> = {
  impacted:    '#ff2a2a', // Brighter neon red
  healthy:     '#00ff9d', // Neon emerald green
  alternative: '#ffb700', // Neon amber
  customer:    '#00e5ff', // Neon cyan
};

// Gradient from supplier color to customer color
const ARC_COLORS: Record<Arc['routeStatus'], [string, string]> = {
  impacted:    ['#ff2a2a', '#00e5ff'],
  healthy:     ['#00ff9d', '#00e5ff'],
  alternative: ['#ffb700', '#00e5ff'],
};

const ARC_WIDTH: Record<1|2|3, number> = { 1: 0.8, 2: 1.4, 3: 2.2 };
const ARC_DASH_SPEED: Record<1|2|3, number> = { 1: 3000, 2: 2000, 3: 1200 };

// ─── Component ────────────────────────────────────────────────────────────────

export interface DisruptionPoint {
  incident_id: string;
  title: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: string | null;
  countries_affected?: string[] | null;
}

export interface TradeGlobeSupplier {
  name: string;
  country: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  reliabilityScore?: number;
}

export interface TradeGlobeHQ {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface TradeGlobeAlternateSupplier {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  leadTimeWeeks?: number | null;
  costDeltaPct?: number | null;
}

export interface TradeGlobeProps {
  suppliers?: TradeGlobeSupplier[];
  disruptions?: DisruptionPoint[];
  /** This customer's HQ/destination — resolved server-side from their BusinessProfile. */
  hqLocation?: TradeGlobeHQ | null;
  /** AlternativesFinder output from the latest pipeline run — empty until a run completes. */
  alternateSuppliers?: TradeGlobeAlternateSupplier[];
}

export const TradeGlobe: React.FC<TradeGlobeProps> = ({
  suppliers = [],
  disruptions = [],
  hqLocation = null,
  alternateSuppliers = [],
}) => {
  const globeRef = useRef<GlobeMethods | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const [hoveredSupplier, setHoveredSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [globalSuppliers, setGlobalSuppliers] = useState<any[]>([]);

  const { getToken } = useAuth();

  useEffect(() => {
    const loadGlobalSuppliers = async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch('/api/v2/suppliers/global', { headers });
        if (res.ok) {
          const data = await res.json();
          setGlobalSuppliers(data);
        }
      } catch (e) {
        console.error('Failed to load global suppliers:', e);
      }
    };
    loadGlobalSuppliers();
  }, [getToken]);

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

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls() as any;
    if (controls) {
      const isHovered = !!hoveredSupplier || !!selectedSupplier;
      controls.autoRotate = !isHovered;
      controls.autoRotateSpeed = isHovered ? 0 : 0.5;
    }
  }, [hoveredSupplier, selectedSupplier]);

  useEffect(() => {
    if (!globeRef.current) return;

    const globe = globeRef.current;
    
    const scene = globe.scene() as THREE.Scene;
    if (scene && !scene.background) {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#02040a');
        gradient.addColorStop(1, '#060a14');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 3000; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 1.5;
          const brightness = Math.random() * 0.8 + 0.2;
          ctx.fillStyle = `rgba(140, 200, 255, ${brightness * 0.6})`;
          ctx.fillRect(x, y, size, size);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      scene.background = texture;
    }
    
    const controls = globe.controls() as any;
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 200;
      controls.maxDistance = 800;
    }

    setTimeout(() => {
      globe.pointOfView({ lat: 20, lng: -20, altitude: 2.2 }, 1500);
    }, 100);
  }, []);

  const affectedCodes = useMemo(
    () => new Set(disruptions.flatMap((d) => (d.countries_affected ?? []).map(c => c.toUpperCase()))),
    [disruptions]
  );

  const effectiveSuppliers = useMemo<Supplier[]>(() => {
    // 1. This customer's real suppliers
    const liveMapped = suppliers.map((s) => {
      const risk = (s.countryCode && affectedCodes.has(s.countryCode.toUpperCase())) ||
                   (s.country && affectedCodes.has(s.country.toUpperCase()));
      const baseRiskScore = s.reliabilityScore !== undefined ? Math.round(100 - s.reliabilityScore) : 50;
      const finalRiskScore = risk ? Math.min(100, baseRiskScore + 40) : baseRiskScore;

      return {
        name: s.name,
        country: s.country,
        lat: s.latitude,
        lng: s.longitude,
        status: (risk ? 'impacted' : 'healthy') as Supplier['status'],
        riskScore: finalRiskScore,
        exposure: '—',
        exposureTier: (risk ? 3 : 1) as Supplier['exposureTier'],
      };
    });

    // 2. Alternative suppliers surfaced by the latest AlternativesFinder run (if any)
    const alternateMapped = alternateSuppliers.map((s) => ({
      name: s.name,
      country: s.country,
      lat: s.latitude,
      lng: s.longitude,
      status: 'alternative' as Supplier['status'],
      riskScore: 15,
      exposure: s.costDeltaPct != null ? `${s.costDeltaPct > 0 ? '+' : ''}${s.costDeltaPct}%` : '—',
      exposureTier: 2 as Supplier['exposureTier'],
    }));

    const combined: Supplier[] = [...liveMapped, ...alternateMapped];

    // 3. This customer's HQ/destination, resolved server-side from their BusinessProfile
    if (hqLocation) {
      combined.push({
        name: hqLocation.name,
        country: hqLocation.country,
        lat: hqLocation.latitude,
        lng: hqLocation.longitude,
        status: 'customer',
        riskScore: 0,
        exposure: '$0',
        exposureTier: 1,
      });
    }
    return combined;
  }, [suppliers, alternateSuppliers, hqLocation, affectedCodes]);

  // The 22k global background points — coloured green/red based on disruptions
  const bgPoints = useMemo(() => {
    const impacted: any[] = [];
    const healthy: any[] = [];
    
    globalSuppliers.forEach((s: any) => {
      const risk = (s.countryCode && affectedCodes.has(s.countryCode.toUpperCase())) ||
                   (s.country && affectedCodes.has(s.country.toUpperCase()));
                   
      const baseSupplier = {
        ...s,
        riskScore: s.reliability_score ? Math.round(100 - s.reliability_score) : 50,
        exposure: '—',
        exposureTier: (risk ? 3 : 1) as Supplier['exposureTier'],
        status: (risk ? 'impacted' : 'healthy') as Supplier['status']
      };
      
      if (risk) {
        impacted.push(baseSupplier);
      } else {
        healthy.push(baseSupplier);
      }
    });

    // Deterministically pick ~100 healthy suppliers to spread around the globe
    const step = Math.max(1, Math.floor(healthy.length / 100));
    const sampledHealthy = healthy.filter((_, i) => i % step === 0).slice(0, 100);

    return [...impacted, ...sampledHealthy];
  }, [globalSuppliers, affectedCodes]);

  // Baseline: arcs from every main supplier to HQ. After a pipeline run finds
  // alternatives, swap to arcs from the alternate supplier(s) to HQ instead —
  // the disruption pin (rendered separately from `disruptions`) shows why.
  const effectiveArcs = useMemo<Arc[]>(() => {
    if (!hqLocation) return [];
    const sourceSuppliers = alternateSuppliers.length > 0
      ? effectiveSuppliers.filter((s) => s.status === 'alternative')
      : effectiveSuppliers.filter((s) => s.status !== 'customer');
    return sourceSuppliers.map((s) => ({
      startLat: s.lat,
      startLng: s.lng,
      endLat: hqLocation.latitude,
      endLng: hqLocation.longitude,
      routeStatus: s.status as Arc['routeStatus'],
      exposureTier: s.exposureTier,
    }));
  }, [effectiveSuppliers, hqLocation, alternateSuppliers]);

  // Points for the news events (disruptions) so they visually appear on the map cities
  const disruptionMarkers = useMemo(() => {
    return disruptions
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => ({
        ...d,
        lat: d.latitude!,
        lng: d.longitude!,
      }));
  }, [disruptions]);

  // Only the user's own suppliers + customer destination get rings / labels / arcs
  // The 22k global blob is too large for interactive hover
  const interactivePoints = useMemo(() => effectiveSuppliers, [effectiveSuppliers]);
  const arcsData = useMemo(() => effectiveArcs, [effectiveArcs]);

  const getBgPointColor = useCallback((d: any) =>
    d.status === 'impacted' ? '#ff2a2a' : '#10b981', []);
  const getPointRadius = useCallback((d: any) => (d.status === 'customer' ? 1.0 : 0.8), []);
  const getPointColor = useCallback((d: any) => STATUS_COLOR[d.status as Supplier['status']], []);
  const getArcDashLength = useCallback((d: any) => (d.exposureTier === 3 ? 0.3 : 0.15), []);
  const getArcDashGap = useCallback((d: any) => (d.exposureTier === 3 ? 1.2 : 2.5), []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: 'transparent',
        overflow: 'hidden',
      }}
      onMouseMove={(e) => {
        if (hoveredSupplier) {
          setTooltipPos({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      <Globe
        ref={globeRef as any}
        width={dims.width}
        height={dims.height}
        backgroundColor="rgba(0,0,0,0)"
        
        // ── Globe appearance ──────────────────────────────────────────────
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        
        showAtmosphere
        atmosphereColor="#3b82f6" // Bright glowing blue
        atmosphereAltitude={0.15}
        
        // ── (Removed the old pointsData lines; rendering bgPoints as labels/rings instead) ──

        // ── Interactive user suppliers & 100 random suppliers (rings, hover, labels) ──────────────
        // Use ringsData for the suppliers
        ringsData={[...interactivePoints, ...bgPoints, ...disruptionMarkers.map(d => ({ ...d, isDisruption: true }))]}
        ringLat={(d: any) => d.lat}
        ringLng={(d: any) => d.lng}
        ringColor={(d: any) => d.isDisruption ? 'rgba(255,50,50,0.9)' : STATUS_COLOR[d.status as Supplier['status']]}
        ringMaxRadius={(d: any) => d.isDisruption ? 10 : (d.status === 'impacted' ? 5 : (d.status === 'customer' ? 3.5 : 2))}
        ringPropagationSpeed={(d: any) => d.isDisruption ? 5 : (d.status === 'impacted' ? 3.5 : 1.5)}
        ringRepeatPeriod={(d: any) => d.isDisruption ? 500 : (d.status === 'impacted' ? 700 : 1800)}
        onRingHover={(ring: any) => {
          setHoveredSupplier(ring || null);
          if (globeRef.current) {
            const controls = globeRef.current.controls() as any;
            if (controls) controls.autoRotate = !ring && !selectedSupplier;
          }
        }}
        onRingClick={(ring: any) => {
          setSelectedSupplier(ring);
          if (globeRef.current) {
            const controls = globeRef.current.controls() as any;
            if (controls) controls.autoRotate = !ring && !hoveredSupplier;
          }
        }}
        // ── Trade exposure arcs (from live suppliers → destination) ──────
        arcsData={arcsData}
        arcStartLat={(d: any) => d.startLat}
        arcStartLng={(d: any) => d.startLng}
        arcEndLat={(d: any) => d.endLat}
        arcEndLng={(d: any) => d.endLng}
        arcColor={(d: any) => ARC_COLORS[d.routeStatus as Arc['routeStatus']]}
        arcStroke={(d: any) => ARC_WIDTH[d.exposureTier as Arc['exposureTier']]}
        arcAltitudeAutoScale={0.4}
        arcDashLength={getArcDashLength}
        arcDashGap={getArcDashGap}
        arcDashAnimateTime={(d: any) => ARC_DASH_SPEED[d.exposureTier as Arc['exposureTier']]}
        arcCurveResolution={64}

        // ── Labels (for both active chain and 100 random suppliers) ───────────
        labelsData={[...interactivePoints, ...bgPoints]}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.name}
        labelSize={1.8}
        labelDotRadius={0.5}
        labelColor={(d: any) => STATUS_COLOR[d.status as Supplier['status']]}
        labelAltitude={0.025}
        labelResolution={4}
        onLabelClick={(point: any) => {
          setSelectedSupplier(point);
          if (globeRef.current) {
            const controls = globeRef.current.controls() as any;
            if (controls) controls.autoRotate = !point && !hoveredSupplier;
          }
        }}
        onLabelHover={(point: any) => {
          setHoveredSupplier(point || null);
          if (globeRef.current) {
            const controls = globeRef.current.controls() as any;
            if (controls) controls.autoRotate = !point && !selectedSupplier;
          }
        }}
      />


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

      {/* ── Selected Supplier VCard Panel ── */}
      {selectedSupplier && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            width: 340,
            background: 'rgba(10, 15, 30, 0.85)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${STATUS_COLOR[selectedSupplier.status]}80`,
            borderRadius: 16,
            padding: 24,
            color: '#f8fafc',
            boxShadow: `0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${STATUS_COLOR[selectedSupplier.status]}30`,
            zIndex: 30,
            fontFamily: 'Inter, system-ui, sans-serif',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{selectedSupplier.name}</h3>
            <button
              onClick={() => {
                setSelectedSupplier(null);
                if (globeRef.current) {
                  const controls = globeRef.current.controls() as any;
                  if (controls) controls.autoRotate = !hoveredSupplier;
                }
              }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, fontSize: 16 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ 
              display: 'inline-block', 
              width: 10, height: 10, 
              borderRadius: '50%', 
              backgroundColor: STATUS_COLOR[selectedSupplier.status],
              boxShadow: `0 0 8px ${STATUS_COLOR[selectedSupplier.status]}`
            }} />
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[selectedSupplier.status], fontWeight: 600 }}>
              {selectedSupplier.status === 'impacted' ? 'Impacted by Disruption' : 
               selectedSupplier.status === 'customer' ? 'Your Operations' : 
               selectedSupplier.status === 'alternative' ? 'Available Alternative' : 'Healthy Supply Route'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: selectedSupplier.status === 'impacted' ? 20 : 0 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedSupplier.country}</div>
            </div>
            
            {selectedSupplier.status !== 'customer' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Reliability</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {selectedSupplier.reliabilityScore !== undefined ? `${selectedSupplier.reliabilityScore}/100` : '92/100'}
                </div>
              </div>
            )}
          </div>

          {selectedSupplier.status === 'impacted' && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              borderLeft: '3px solid #ef4444',
              padding: '12px 14px',
              borderRadius: '4px 8px 8px 4px',
              fontSize: 13,
              color: '#fca5a5',
              lineHeight: 1.5,
              fontWeight: 500
            }}>
              WARNING: This supplier is located in an active disruption zone. Route performance may be severely degraded.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeGlobe;
