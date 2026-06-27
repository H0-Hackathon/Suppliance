import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { useAuth } from '@clerk/clerk-react';
import { PALETTE } from '../styles/palette';

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
  impacted:    PALETTE.critical, // semantic red
  healthy:     PALETTE.safe,     // semantic green
  alternative: PALETTE.warning,  // semantic amber
  customer:    PALETTE.seafoam,  // brand seafoam (destination/HQ)
};

// Gradient from supplier color to the seafoam destination color
const ARC_COLORS: Record<Arc['routeStatus'], [string, string]> = {
  impacted:    [PALETTE.critical, PALETTE.seafoam],
  healthy:     [PALETTE.safe, PALETTE.seafoam],
  alternative: [PALETTE.warning, PALETTE.seafoam],
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
        // Deep-space gradient — near-black at the poles, a hint of teal at the equator
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#050B0F');
        gradient.addColorStop(0.5, '#0C1F26');
        gradient.addColorStop(1, '#050B0F');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // A couple of faint nebula glows for depth, like distant illuminated dust
        const nebula = (x: number, y: number, r: number, color: string) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };
        nebula(canvas.width * 0.22, canvas.height * 0.3, 420, 'rgba(84,140,146,0.14)');
        nebula(canvas.width * 0.78, canvas.height * 0.65, 380, 'rgba(132,215,216,0.10)');

        // Dense field of small, mostly white/cream stars
        for (let i = 0; i < 2200; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 1.3 + 0.3;
          const brightness = Math.random() * 0.6 + 0.4;
          ctx.fillStyle = `rgba(232, 230, 222, ${brightness})`;
          ctx.fillRect(x, y, size, size);
        }

        // Sparse layer of slightly larger, brighter "hero" stars with a soft glow —
        // the bit that actually reads as stars at a glance rather than noise
        for (let i = 0; i < 90; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 1.6 + 1.4;
          const tint = Math.random() > 0.7 ? '132, 215, 216' : '255, 255, 255';
          const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
          glow.addColorStop(0, `rgba(${tint}, 0.9)`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
          ctx.fillStyle = `rgba(${tint}, 1)`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
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
        atmosphereColor={PALETTE.seafoam}
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
          background: 'rgba(22,50,58,0.82)',
          backdropFilter: 'blur(14px)',
          border: '1px solid var(--border-soft)',
          borderRadius: 12,
          padding: '14px 18px',
          fontFamily: 'var(--font)',
          fontSize: 12,
          color: 'var(--foreground)',
          minWidth: 210,
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Trade Exposure Globe
        </div>

        {[
          { color: PALETTE.critical, label: 'Impacted Supplier' },
          { color: PALETTE.safe, label: 'Healthy Supplier' },
          { color: PALETTE.warning, label: 'Alternative Supplier' },
          { color: PALETTE.seafoam, label: 'Your HQ / Destination' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
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
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid var(--border-soft)', margin: '10px 0' }} />

        {[
          { color: PALETTE.warning, label: 'Exposure route' },
          { color: PALETTE.critical, label: 'Disrupted route' },
          { color: PALETTE.safe, label: 'Alternative route' },
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
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}

        <div
          style={{
            borderTop: '1px solid var(--border-soft)',
            marginTop: 10,
            paddingTop: 10,
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
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
            background: 'rgba(22,50,58,0.97)',
            border: `1px solid ${STATUS_COLOR[hoveredSupplier.status]}55`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'var(--font)',
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
                        ? PALETTE.critical
                        : hoveredSupplier.riskScore > 35
                          ? PALETTE.warning
                          : PALETTE.safe,
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
              borderTop: '1px solid var(--border-soft)',
              fontSize: 11,
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
            fontFamily: 'var(--font)',
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
