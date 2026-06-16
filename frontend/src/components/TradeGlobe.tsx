import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { AgentResults, AgentStatusMap } from '../types/agents';
import type {
  GlobeNode,
  GlobeArc,
  GlobePulse,
  VisualizationMode,
} from '../types/globe';
import type { ResolvedCoords } from '../types/globe';
import { buildGlobeViewModel } from '../utils/globeViewModel';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DisruptionPoint {
  incident_id?: string;
  title: string;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  severity?: string | null;
  countries_affected?: string[] | null;
}

export interface TradeGlobeSupplier {
  name: string;
  country: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
}

export interface TradeGlobeProps {
  suppliers?: TradeGlobeSupplier[];
  disruptions?: DisruptionPoint[];
  agentResults?: AgentResults;
  agentStatus?: AgentStatusMap;
  alternativeCoords?: Record<string, ResolvedCoords>;
  visualizationMode?: VisualizationMode;
  activeLayers?: Set<string>;
  supplierCountry?: string | null;
}

// ─── Color & metric helpers ───────────────────────────────────────────────────

const NODE_COLOR: Record<GlobeNode['status'], string> = {
  impacted: '#dc2626',
  healthy: '#10b981',
  alternative: '#22d3ee',
  customer: '#38bdf8',
  recommended: '#34d399',
  rejected: '#64748b',
};

const ARC_RGBA: Record<GlobeArc['routeStatus'], [number, number, number, number]> = {
  impacted: [220, 38, 38, 255],
  warning: [239, 68, 68, 255],
  healthy: [16, 185, 129, 200],
  alternative: [34, 211, 238, 240],
  recommended: [52, 211, 153, 255],
  rejected: [100, 116, 139, 100],
};

const ARC_WIDTH: Record<1 | 2 | 3, number> = { 1: 0.55, 2: 1.05, 3: 1.75 };
const ARC_DASH_SPEED: Record<1 | 2 | 3, number> = { 1: 4200, 2: 2800, 3: 1600 };

const COMPLIANCE_TINT: Record<string, string> = {
  low: '#34d399',
  medium: '#fbbf24',
  high: '#f87171',
  critical: '#ef4444',
  unknown: '#94a3b8',
};

const MODE_LABELS: Record<VisualizationMode, string> = {
  executive: 'Executive View',
  supply_chain: 'Supply Chain View',
  ai_reasoning: 'AI Reasoning View',
  risk_heatmap: 'Risk Heatmap View',
};

const AGENT_LABELS: Record<string, string> = {
  tariff_monitor: 'TariffMonitor',
  impact_calculator: 'ImpactCalculator',
  alternatives_finder: 'AlternativesFinder',
  import_compliance: 'ImportCompliance',
  adversarial: 'Adversarial',
};

function nodeColor(d: GlobeNode): string {
  if (d.complianceRisk && d.complianceRisk !== 'unknown') {
    return COMPLIANCE_TINT[d.complianceRisk];
  }
  if (d.isSelected) return NODE_COLOR.recommended;
  if (d.isRejected) return NODE_COLOR.rejected;
  if (d.isActiveRisk) return NODE_COLOR.impacted;
  return NODE_COLOR[d.status];
}

function arcColor(d: GlobeArc): [number, number, number, number] {
  const base = ARC_RGBA[d.routeStatus];
  const alpha = Math.round(base[3] * d.opacity);
  if (d.isWinner) return [base[0], base[1], base[2], 255];
  return [base[0], base[1], base[2], alpha];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TradeGlobe: React.FC<TradeGlobeProps> = ({
  suppliers = [],
  disruptions = [],
  agentResults = {},
  agentStatus = {},
  alternativeCoords = {},
  visualizationMode = 'ai_reasoning',
  activeLayers = new Set(['suppliers', 'routes', 'risk', 'alt']),
  supplierCountry = null,
}) => {
  const globeRef = useRef<GlobeMethods | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<string | null>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const [hoveredNode, setHoveredNode] = useState<GlobeNode | null>(null);
  const [hoveredArc, setHoveredArc] = useState<GlobeArc | null>(null);
  const [animTick, setAnimTick] = useState(0);

  const viewModel = useMemo(
    () => buildGlobeViewModel({
      suppliers,
      disruptions,
      agentResults,
      agentStatus,
      alternativeCoords,
      visualizationMode,
      activeLayers,
      supplierCountry,
    }),
    [suppliers, disruptions, agentResults, agentStatus, alternativeCoords, visualizationMode, activeLayers, supplierCountry],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ width: el.clientWidth || 1200, height: el.clientHeight || 800 });
    });
    ro.observe(el);
    setDims({ width: el.clientWidth || 1200, height: el.clientHeight || 800 });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setAnimTick((t) => (t + 1) % 360), 50);
    return () => clearInterval(interval);
  }, []);

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
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#0a0e1a');
        gradient.addColorStop(0.5, '#050812');
        gradient.addColorStop(1, '#0a0e1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 2000; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const brightness = Math.random() * 0.8 + 0.2;
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
          ctx.fillRect(x, y, Math.random() * 1.5, Math.random() * 1.5);
        }
      }
      scene.background = new THREE.CanvasTexture(canvas);
    }
    const controls = globe.controls() as { autoRotate?: boolean; autoRotateSpeed?: number; enableZoom?: boolean; enablePan?: boolean; minDistance?: number; maxDistance?: number };
    if (controls) {
      controls.autoRotate = !viewModel.focusPoint;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 200;
      controls.maxDistance = 800;
    }
    setTimeout(() => {
      globe.pointOfView({ lat: 20, lng: -20, altitude: 2.8 }, 1500);
    }, 100);
  }, []);

  useEffect(() => {
    if (!globeRef.current || !viewModel.focusPoint) return;
    const key = `${viewModel.focusPoint.lat},${viewModel.focusPoint.lng}`;
    if (lastFocusRef.current === key) return;
    lastFocusRef.current = key;
    const controls = globeRef.current.controls() as { autoRotate?: boolean };
    if (controls) controls.autoRotate = false;
    globeRef.current.pointOfView(viewModel.focusPoint, 1800);
  }, [viewModel.focusPoint]);

  const animatedPulses = useMemo(() => {
    return viewModel.pulses.map((p, idx) => {
      const arc = viewModel.arcs[idx % Math.max(viewModel.arcs.length, 1)];
      if (!arc) return p;
      const baseT = (idx % 4) / 4;
      const progress = (animTick / 360 + baseT) % 1;
      return {
        ...p,
        lat: arc.startLat + (arc.endLat - arc.startLat) * progress,
        lng: arc.startLng + (arc.endLng - arc.startLng) * progress,
      };
    });
  }, [viewModel.pulses, viewModel.arcs, animTick]);

  const allPoints = useMemo(
    () => [...viewModel.nodes, ...animatedPulses],
    [viewModel.nodes, animatedPulses],
  );

  const getPointRadius = useCallback((d: GlobeNode | GlobePulse) => {
    if ('pointType' in d && d.pointType === 'pulse') {
      return d.exposureTier === 3 ? 0.38 : d.exposureTier === 2 ? 0.3 : 0.24;
    }
    const node = d as GlobeNode;
    if (node.status === 'customer') return 0.85;
    if (node.isSelected) return 0.9;
    if (node.isActiveRisk) return 0.78 + Math.sin(animTick / 15) * 0.08;
    if (node.status === 'alternative' || node.status === 'recommended') {
      const rankBoost = node.rank === 1 ? 0.12 : node.rank === 2 ? 0.06 : 0;
      return 0.62 + rankBoost;
    }
    return 0.62;
  }, [animTick]);

  const getPointColor = useCallback((d: GlobeNode | GlobePulse) => {
    if ('pointType' in d && d.pointType === 'pulse') {
      const rgba = ARC_RGBA[d.routeStatus];
      return `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${0.85 * d.opacity})`;
    }
    const node = d as GlobeNode;
    return nodeColor(node);
  }, []);

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
        ref={globeRef as React.RefObject<GlobeMethods>}
        width={dims.width}
        height={dims.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl=""
        showAtmosphere
        atmosphereColor="#4da6ff"
        atmosphereAltitude={0.11}
        pointsData={allPoints}
        pointLat={(d: GlobeNode | GlobePulse) => d.lat}
        pointLng={(d: GlobeNode | GlobePulse) => d.lng}
        pointAltitude={(d: GlobeNode | GlobePulse) => ('pointType' in d && d.pointType === 'pulse' ? 0.01 : 0.014)}
        pointRadius={getPointRadius}
        pointColor={getPointColor}
        pointResolution={8}
        pointMerge={false}
        onPointHover={(point: GlobeNode | GlobePulse | null) => {
          if (!point || ('pointType' in point && point.pointType === 'pulse')) {
            setHoveredNode(null);
            return;
          }
          setHoveredNode(point as GlobeNode);
          setHoveredArc(null);
        }}
        arcsData={viewModel.arcs}
        arcStartLat={(d: GlobeArc) => d.startLat}
        arcStartLng={(d: GlobeArc) => d.startLng}
        arcEndLat={(d: GlobeArc) => d.endLat}
        arcEndLng={(d: GlobeArc) => d.endLng}
        arcColor={(d: GlobeArc) => arcColor(d)}
        arcStroke={(d: GlobeArc) => ARC_WIDTH[d.exposureTier] * (d.isWinner ? 1.25 : 1)}
        arcAltitude={0.42}
        arcDashLength={(d: GlobeArc) => (d.exposureTier === 3 ? 0.22 : 0.32)}
        arcDashGap={(d: GlobeArc) => (d.isWinner ? 0.12 : 0.2)}
        arcDashAnimateTime={(d: GlobeArc) => (d.isWinner ? 1200 : ARC_DASH_SPEED[d.exposureTier])}
        arcCurveResolution={72}
        onArcHover={(arc: GlobeArc | null) => {
          setHoveredArc(arc);
          if (arc) setHoveredNode(null);
        }}
        ringsData={viewModel.riskRings}
        ringLat={(d) => d.lat}
        ringLng={(d) => d.lng}
        ringColor={(d) => (t: number) => `${d.color}${(1 - t) * d.intensity})`}
        ringMaxRadius={(d) => d.radius}
        ringPropagationSpeed={(d) => 1.5 + d.intensity * 2}
        ringRepeatPeriod={1200}
        labelsData={viewModel.nodes.filter((n) => n.status !== 'customer' && n.opacity > 0.4)}
        labelLat={(d: GlobeNode) => d.lat}
        labelLng={(d: GlobeNode) => d.lng}
        labelText={(d: GlobeNode) => d.name}
        labelSize={(d: GlobeNode) => (d.isSelected ? 0.75 : 0.6)}
        labelDotRadius={0}
        labelColor={(d: GlobeNode) => nodeColor(d)}
        labelAltitude={0.024}
        labelResolution={2}
      />

      {/* Alert / recommendation banner */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '72%',
          background: viewModel.reasoningStep >= 4
            ? 'rgba(16,185,129,0.1)'
            : 'rgba(220,38,38,0.1)',
          border: viewModel.reasoningStep >= 4
            ? '1px solid rgba(16,185,129,0.35)'
            : '1px solid rgba(220,38,38,0.35)',
          borderRadius: 6,
          padding: '5px 18px',
          fontSize: 11,
          fontWeight: 700,
          color: viewModel.reasoningStep >= 4 ? '#6ee7b7' : '#fca5a5',
          letterSpacing: '0.05em',
          fontFamily: 'Inter, system-ui, sans-serif',
          zIndex: 10,
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: viewModel.reasoningStep >= 4
            ? '0 2px 12px rgba(16,185,129,0.15)'
            : '0 2px 12px rgba(220,38,38,0.15)',
        }}
      >
        {viewModel.bannerText}
      </div>

      {/* AI reasoning step indicator */}
      {visualizationMode === 'ai_reasoning' && viewModel.reasoningStep >= 0 && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            zIndex: 10,
          }}
        >
          {['tariff_monitor', 'impact_calculator', 'alternatives_finder', 'import_compliance', 'adversarial'].map((key, i) => {
            const done = viewModel.reasoningStep >= i;
            const running = viewModel.activeAgent === key;
            return (
              <div
                key={key}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: running ? '#f59e0b' : done ? '#10b981' : 'rgba(100,116,139,0.4)',
                  boxShadow: running || done ? `0 0 8px ${running ? '#f59e0b' : '#10b981'}` : 'none',
                  animation: running ? 'pulse-dot 1s ease-in-out infinite' : 'none',
                }}
                title={AGENT_LABELS[key]}
              />
            );
          })}
        </div>
      )}

      {/* Mode label */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          background: 'rgba(6,10,20,0.82)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: '#7dd3fc',
          textTransform: 'uppercase',
          zIndex: 10,
        }}
      >
        {MODE_LABELS[visualizationMode]}
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(6,10,20,0.88)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(56,189,248,0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          color: '#cbd5e1',
          minWidth: 210,
          zIndex: 10,
        }}
      >
        <div style={{
          fontWeight: 700, fontSize: 9, letterSpacing: '0.12em',
          color: 'rgba(56,189,248,0.7)', textTransform: 'uppercase', marginBottom: 10,
        }}>
          AI Supply Chain Globe
        </div>
        {[
          { color: '#dc2626', label: 'Affected / at risk' },
          { color: '#22d3ee', label: 'Alternative supplier' },
          { color: '#34d399', label: 'Recommended path' },
          { color: '#38bdf8', label: 'Import destination' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%', background: color,
              boxShadow: `0 0 6px ${color}70`, flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', margin: '9px 0' }} />
        <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
          Arc thickness = financial impact · Pulse speed = exposure velocity · Color intensity = compliance risk
        </div>
      </div>

      {/* Tooltip */}
      {(hoveredNode || hoveredArc) && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            right: 16,
            background: 'rgba(6,10,20,0.97)',
            border: `1px solid ${hoveredNode ? `${nodeColor(hoveredNode)}55` : 'rgba(34,211,238,0.4)'}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'Inter, system-ui, sans-serif',
            zIndex: 20,
            pointerEvents: 'none',
            minWidth: 190,
            maxWidth: 260,
            backdropFilter: 'blur(14px)',
          }}
        >
          {hoveredNode && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
                {hoveredNode.name}
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>{hoveredNode.country}</div>
              {hoveredNode.status !== 'customer' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Risk Score</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                      color: hoveredNode.riskScore > 60 ? '#dc2626' : hoveredNode.riskScore > 35 ? '#f59e0b' : '#10b981',
                    }}>
                      {hoveredNode.riskScore}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Exposure</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                      {hoveredNode.exposure}
                    </span>
                  </div>
                  {hoveredNode.tooltipLines.map((line) => (
                    <div key={line} style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>{line}</div>
                  ))}
                </>
              )}
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(56,189,248,0.1)',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: nodeColor(hoveredNode), textTransform: 'uppercase',
              }}>
                {hoveredNode.isSelected
                  ? 'SELECTED — Final recommendation'
                  : hoveredNode.isActiveRisk
                    ? 'ACTIVE RISK — Tariff disruption'
                    : hoveredNode.status === 'alternative'
                      ? 'CANDIDATE — Alternative sourcing'
                      : hoveredNode.status === 'customer'
                        ? 'DESTINATION'
                        : 'MONITORED SUPPLIER'}
              </div>
            </>
          )}
          {hoveredArc && !hoveredNode && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                Trade Route
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.45 }}>{hoveredArc.tooltip}</div>
              <div style={{
                marginTop: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: hoveredArc.isWinner ? '#34d399' : hoveredArc.routeStatus === 'warning' ? '#f87171' : '#22d3ee',
                textTransform: 'uppercase',
              }}>
                {hoveredArc.isWinner
                  ? 'WINNING ROUTE'
                  : hoveredArc.routeStatus === 'warning'
                    ? 'ELEVATED RISK'
                    : 'SUPPLY FLOW'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeGlobe;
