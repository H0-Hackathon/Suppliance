import { Map } from 'react-map-gl/maplibre';
import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapView } from '@deck.gl/core';

// Fixed import destination for this demo (US importer). Coordinates match
// the "US" entry in backend/services/coordinates.py.
const DESTINATION = {
    name: 'Port of Los Angeles',
    coords: [-118.2610, 33.7395] as [number, number],
};

const INITIAL_VIEW = { longitude: -20, latitude: 25, zoom: 1.8, pitch: 0, bearing: 0 };

// Severity -> marker color, used for the live disruption_events overlay.
const SEVERITY_COLOR: Record<string, [number, number, number]> = {
    critical: [239, 68, 68],
    high: [249, 115, 22],
    medium: [245, 158, 11],
    low: [107, 114, 128],
};

const RISK_COLOR: [number, number, number] = [239, 68, 68];
const OK_COLOR: [number, number, number] = [34, 197, 94];
const DEST_COLOR: [number, number, number] = [56, 189, 248];

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

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
    /** ISO 3166-1 alpha-2 code, used to match against disruption countries_affected */
    countryCode: string | null;
    latitude: number;
    longitude: number;
}

interface GlobeMarker {
    name: string;
    coords: [number, number];
    color: [number, number, number];
    status: 'risk' | 'ok' | 'dest';
}

export interface TradeGlobeProps {
    /** This customer's active suppliers, with resolved coordinates. */
    suppliers?: TradeGlobeSupplier[];
    /** Live disruption events from GET /api/v2/disruptions. */
    disruptions?: DisruptionPoint[];
}

function detectWebGL(): boolean {
    try {
        const canvas = document.createElement('canvas');
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
    } catch {
        return false;
    }
}

export const TradeGlobe: React.FC<TradeGlobeProps> = ({ suppliers = [], disruptions = [] }) => {
    const [webglOk] = useState<boolean>(() => detectWebGL());
    const [viewState, setViewState] = useState(INITIAL_VIEW);
    const [hoveredSupplier, setHoveredSupplier] = useState<string | null>(null);
    const [hoveredDisruption, setHoveredDisruption] = useState<string | null>(null);
    const [animOffset, setAnimOffset] = useState(0);

    // Only plot events that have real coordinates (hardcoded lookup in
    // backend/services/coordinates.py — see DisruptionEvent model).
    const points = disruptions.filter(
        (d): d is DisruptionPoint & { latitude: number; longitude: number } =>
            d.latitude != null && d.longitude != null
    );

    // A supplier is "at risk" if its country shows up in any active
    // disruption's countries_affected list.
    const affectedCodes = new Set(
        disruptions.flatMap((d) => d.countries_affected ?? [])
    );

    const supplierPoints = suppliers
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
            ...s,
            coords: [s.longitude, s.latitude] as [number, number],
            atRisk: s.countryCode ? affectedCodes.has(s.countryCode) : false,
        }));

    const markers: GlobeMarker[] = [
        ...supplierPoints.map((s) => ({
            name: s.name,
            coords: s.coords,
            color: s.atRisk ? RISK_COLOR : OK_COLOR,
            status: (s.atRisk ? 'risk' : 'ok') as const,
        })),
        { name: DESTINATION.name, coords: DESTINATION.coords, color: DEST_COLOR, status: 'dest' as const },
    ];

    const arcData = supplierPoints.map((s) => ({
        source: s.coords,
        target: DESTINATION.coords,
        sourceColor: [...(s.atRisk ? RISK_COLOR : OK_COLOR), 220] as [number, number, number, number],
        targetColor: (s.atRisk ? [...RISK_COLOR, 40] : [...OK_COLOR, 160]) as [number, number, number, number],
    }));

    // Pick the most severe active disruption for the top banner.
    const topDisruption = [...disruptions].sort(
        (a, b) => (SEVERITY_RANK[b.severity ?? 'low'] ?? 0) - (SEVERITY_RANK[a.severity ?? 'low'] ?? 0)
    )[0];
    const showBanner = topDisruption && (topDisruption.severity === 'critical' || topDisruption.severity === 'high');
    const bannerColor = topDisruption ? SEVERITY_COLOR[topDisruption.severity ?? 'medium'] ?? SEVERITY_COLOR.medium : SEVERITY_COLOR.medium;

    useEffect(() => {
        const id = setInterval(() => setAnimOffset(t => (t + 1) % 100), 50);
        return () => clearInterval(id);
    }, []);

    const layers = [
        new ScatterplotLayer({
            id: 'pulse',
            data: markers.filter((m) => m.status === 'risk'),
            getPosition: (d: GlobeMarker) => d.coords,
            getFillColor: [239, 68, 68, 0],
            getLineColor: [239, 68, 68, 140],
            getLineWidth: 4,
            stroked: true,
            filled: false,
            getRadius: 200000 + Math.sin(animOffset / 8) * 80000,
            updateTriggers: { getRadius: animOffset },
        }),
        new ArcLayer({
            id: 'arcs',
            data: arcData,
            getSourcePosition: (d: typeof arcData[0]) => d.source,
            getTargetPosition: (d: typeof arcData[0]) => d.target,
            getSourceColor: (d: typeof arcData[0]) => d.sourceColor,
            getTargetColor: (d: typeof arcData[0]) => d.targetColor,
            getWidth: 3,
            greatCircle: true,
        }),
        new ScatterplotLayer({
            id: 'suppliers',
            data: markers,
            getPosition: (d: GlobeMarker) => d.coords,
            getFillColor: (d: GlobeMarker) =>
                hoveredSupplier === d.name ? [255, 255, 255, 255] : [...d.color, 220] as [number, number, number, number],
            getRadius: (d: GlobeMarker) => hoveredSupplier === d.name ? 200000 : 140000,
            pickable: true,
            onHover: ({ object }: any) => setHoveredSupplier(object ? object.name : null),
            updateTriggers: { getFillColor: hoveredSupplier, getRadius: hoveredSupplier },
            transitions: { getRadius: 120 },
        }),
        // Live disruption events from GET /api/v2/disruptions — one pulsing
        // marker per detected risk event, colored by severity.
        new ScatterplotLayer({
            id: 'disruption-events',
            data: points,
            getPosition: (d: typeof points[0]) => [d.longitude, d.latitude],
            getFillColor: (d: typeof points[0]) =>
                [...(SEVERITY_COLOR[d.severity ?? 'medium'] ?? SEVERITY_COLOR.medium), 220] as [number, number, number, number],
            getLineColor: (d: typeof points[0]) =>
                SEVERITY_COLOR[d.severity ?? 'medium'] ?? SEVERITY_COLOR.medium,
            getLineWidth: 4,
            stroked: true,
            filled: true,
            getRadius: 180000 + Math.sin(animOffset / 8) * 60000,
            pickable: true,
            onHover: ({ object }: any) => setHoveredDisruption(object ? object.title : null),
            updateTriggers: { getRadius: animOffset },
        }),
    ];

    if (!webglOk) {
        return (
            <div style={{
                width: '100%', height: '100%', background: '#060d1f', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: '#475569', fontFamily: 'system-ui, sans-serif', fontSize: 12,
            }}>
                <span style={{ fontSize: 28 }}>🗺️</span>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Interactive map unavailable</span>
                <span style={{ fontSize: 11, color: '#475569' }}>WebGL is disabled or not supported by this browser</span>
                {suppliers.length > 0 && (
                    <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                        {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} tracked
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#060d1f', borderRadius: 12, overflow: 'hidden' }}>
            <DeckGL
                views={new MapView({ id: 'map', repeat: true })}
                viewState={viewState}
                onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
                controller={true}
                layers={layers}
                style={{ position: 'absolute', inset: 0 }}
                parameters={{ clearColor: [0.02, 0.05, 0.12, 1] }}
            >
                <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
            </DeckGL>

            {/* Alert banner — shows the most severe active disruption */}
            {showBanner && (
                <div style={{
                    position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                    background: `rgba(${bannerColor.join(',')},0.15)`, border: `1px solid rgba(${bannerColor.join(',')},0.4)`,
                    borderRadius: 6, padding: '5px 16px', fontSize: 11, fontWeight: 700,
                    color: '#fca5a5', letterSpacing: '0.05em', fontFamily: 'system-ui, sans-serif',
                    zIndex: 10, whiteSpace: 'nowrap', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    ⚠ {(topDisruption.severity ?? 'medium').toUpperCase()} — {topDisruption.title}
                </div>
            )}

            {/* Legend */}
            <div style={{
                position: 'absolute', bottom: 16, left: 16,
                background: 'rgba(6,13,31,0.88)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10,
                padding: '12px 16px', fontFamily: 'system-ui, sans-serif',
                fontSize: 11, color: '#cbd5e1', minWidth: 200, zIndex: 10,
            }}>
                <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Tracked Suppliers
                </div>
                {markers.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: 10 }}>No suppliers to display</div>
                )}
                {markers.map(m => (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: `rgb(${m.color.join(',')})`, flexShrink: 0 }} />
                        <span style={{ color: hoveredSupplier === m.name ? '#f1f5f9' : '#94a3b8', fontSize: 10 }}>{m.name}</span>
                        <span style={{
                            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                            color: m.status === 'risk' ? '#ef4444' : m.status === 'dest' ? '#38bdf8' : '#22c55e',
                        }}>
                            {m.status === 'risk' ? '⚠ AT RISK' : m.status === 'dest' ? '📦 DEST' : '✓ OK'}
                        </span>
                    </div>
                ))}
            </div>

            {hoveredSupplier && (
                <div style={{
                    position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(6,13,31,0.95)', border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#f1f5f9',
                    fontFamily: 'system-ui, sans-serif', zIndex: 10, pointerEvents: 'none',
                }}>
                    {hoveredSupplier}
                </div>
            )}

            {hoveredDisruption && (
                <div style={{
                    position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(6,13,31,0.95)', border: '1px solid rgba(239,68,68,0.4)',
                    borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#f1f5f9',
                    fontFamily: 'system-ui, sans-serif', zIndex: 10, pointerEvents: 'none',
                    maxWidth: 280, textAlign: 'center',
                }}>
                    {hoveredDisruption}
                </div>
            )}
        </div>
    );
};

export default TradeGlobe;
