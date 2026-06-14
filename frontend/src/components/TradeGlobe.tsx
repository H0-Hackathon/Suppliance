import { Map } from 'react-map-gl/maplibre';
import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapView } from '@deck.gl/core';

const SUPPLIERS = [
    { name: 'Mekong Textiles Co', coords: [106.6838, 20.8651] as [number, number], status: 'risk', color: [239, 68, 68] as [number, number, number] },
    { name: 'Dhaka Garments Ltd', coords: [90.4125, 23.8103] as [number, number], status: 'ok', color: [34, 197, 94] as [number, number, number] },
    { name: 'MexiThread Mfg', coords: [-103.3496, 20.6597] as [number, number], status: 'alt', color: [251, 191, 36] as [number, number, number] },
    { name: 'Los Angeles Port', coords: [-118.2437, 34.0522] as [number, number], status: 'dest', color: [56, 189, 248] as [number, number, number] },
];

const ARC_DATA = [
    {
        source: [106.6838, 20.8651] as [number, number],
        target: [-118.2437, 34.0522] as [number, number],
        sourceColor: [239, 68, 68, 220] as [number, number, number, number],
        targetColor: [239, 68, 68, 40] as [number, number, number, number],
    },
    {
        source: [-103.3496, 20.6597] as [number, number],
        target: [-118.2437, 34.0522] as [number, number],
        sourceColor: [251, 191, 36, 220] as [number, number, number, number],
        targetColor: [34, 197, 94, 220] as [number, number, number, number],
    },
];

const INITIAL_VIEW = { longitude: -20, latitude: 25, zoom: 1.8, pitch: 0, bearing: 0 };

// Severity -> marker color, used for the live disruption_events overlay.
const SEVERITY_COLOR: Record<string, [number, number, number]> = {
    critical: [239, 68, 68],
    high: [249, 115, 22],
    medium: [245, 158, 11],
    low: [107, 114, 128],
};

export interface DisruptionPoint {
    incident_id: string;
    title: string;
    location_name: string | null;
    latitude: number | null;
    longitude: number | null;
    severity: string | null;
}

export interface TradeGlobeProps {
    /** Live disruption events from GET /api/v2/disruptions. Optional —
     * falls back to the hardcoded demo SUPPLIERS/ARC layers when empty. */
    disruptions?: DisruptionPoint[];
}

export const TradeGlobe: React.FC<TradeGlobeProps> = ({ disruptions = [] }) => {
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

    // useEffect(() => {
    //     const id = setInterval(() => {
    //         setViewState(v => ({ ...v, bearing: (v.bearing + 0.1) % 360 }));
    //     }, 50);
    //     return () => clearInterval(id);
    // }, []);

    useEffect(() => {
        const id = setInterval(() => setAnimOffset(t => (t + 1) % 100), 50);
        return () => clearInterval(id);
    }, []);

    const layers = [
        new ScatterplotLayer({
            id: 'pulse',
            data: SUPPLIERS.filter(s => s.status === 'risk'),
            getPosition: (d: typeof SUPPLIERS[0]) => d.coords,
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
            data: ARC_DATA,
            getSourcePosition: (d: typeof ARC_DATA[0]) => d.source,
            getTargetPosition: (d: typeof ARC_DATA[0]) => d.target,
            getSourceColor: (d: typeof ARC_DATA[0]) => d.sourceColor,
            getTargetColor: (d: typeof ARC_DATA[0]) => d.targetColor,
            getWidth: 3,
            greatCircle: true,
        }),
        new ScatterplotLayer({
            id: 'suppliers',
            data: SUPPLIERS,
            getPosition: (d: typeof SUPPLIERS[0]) => d.coords,
            getFillColor: (d: typeof SUPPLIERS[0]) =>
                hoveredSupplier === d.name ? [255, 255, 255, 255] : [...d.color, 220] as [number, number, number, number],
            getRadius: (d: typeof SUPPLIERS[0]) => hoveredSupplier === d.name ? 200000 : 140000,
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

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 420, background: '#060d1f', borderRadius: 12, overflow: 'hidden' }}>
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

            {/* Alert banner */}
            <div style={{
                position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 6, padding: '5px 16px', fontSize: 11, fontWeight: 700,
                color: '#fca5a5', letterSpacing: '0.05em', fontFamily: 'system-ui, sans-serif',
                zIndex: 10, whiteSpace: 'nowrap',
            }}>
                ⚠ CRITICAL — Haiphong Port Closure
            </div>

            {/* Legend */}
            <div style={{
                position: 'absolute', bottom: 16, left: 16,
                background: 'rgba(6,13,31,0.88)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10,
                padding: '12px 16px', fontFamily: 'system-ui, sans-serif',
                fontSize: 11, color: '#cbd5e1', minWidth: 200, zIndex: 10,
            }}>
                <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Trade Routes
                </div>
                {[
                    { color: '#ef4444', label: 'Blocked — Haiphong → LA' },
                    { color: '#fbbf24', label: 'Alternative — Mexico → LA' },
                ].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 24, height: 3, background: color, borderRadius: 2 }} />
                        <span>{label}</span>
                    </div>
                ))}
                <div style={{ marginTop: 10, borderTop: '1px solid rgba(56,189,248,0.1)', paddingTop: 10 }}>
                    {SUPPLIERS.map(s => (
                        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: `rgb(${s.color.join(',')})`, flexShrink: 0 }} />
                            <span style={{ color: hoveredSupplier === s.name ? '#f1f5f9' : '#94a3b8', fontSize: 10 }}>{s.name}</span>
                            <span style={{
                                marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                                color: s.status === 'risk' ? '#ef4444' : s.status === 'alt' ? '#fbbf24' : s.status === 'dest' ? '#38bdf8' : '#22c55e',
                            }}>
                                {s.status === 'risk' ? '⚠ AT RISK' : s.status === 'alt' ? '↗ ALT' : s.status === 'dest' ? '📦 DEST' : '✓ OK'}
                            </span>
                        </div>
                    ))}
                </div>
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