import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from 'react-simple-maps';
import { portByCountry, congestionLabel, type PortInfo } from '../data/maritimePorts';
import { PortDetailPopover } from './maritime/PortDetailPopover';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const MAP = {
  bg: 'var(--map-bg)',
  land: 'var(--map-land)',
  landHover: 'var(--map-land-hover)',
  stroke: 'var(--map-stroke)',
  grid: 'rgba(180, 215, 216, 0.06)',
  routeHealthy: 'var(--map-route-healthy)',
  routeImpacted: 'var(--map-route-impacted)',
  routeAlt: 'var(--map-route-alt)',
  routeHighlight: 'var(--map-route-highlight)',
  markerHealthy: 'var(--map-marker-healthy)',
  markerImpacted: 'var(--map-marker-impacted)',
  markerAlt: 'var(--map-marker-alt)',
  markerCustomer: 'var(--map-marker-customer)',
  markerSelected: 'var(--map-marker-selected)',
  riskZone: 'var(--map-risk-zone)',
  text: 'var(--map-text)',
  textMuted: 'var(--map-text-muted)',
  panel: 'rgba(34, 63, 72, 0.95)',
  panelBorder: 'rgba(180, 215, 216, 0.12)',
};

interface Supplier {
  name: string;
  country: string;
  lat: number;
  lng: number;
  status: 'impacted' | 'healthy' | 'alternative' | 'customer';
  riskScore: number;
  exposure: string;
  exposureTier: 1 | 2 | 3;
  port?: PortInfo;
}

const SUPPLIERS: Supplier[] = [
  { name: 'Vietnam Textiles Ltd', country: 'Vietnam', lat: 20.8651, lng: 106.6838, status: 'impacted', riskScore: 82, exposure: '$40,000', exposureTier: 3 },
  { name: 'Dhaka Apparel Co', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, status: 'healthy', riskScore: 21, exposure: '$18,500', exposureTier: 1 },
  { name: 'Shenzhen Components', country: 'China', lat: 22.5431, lng: 114.0579, status: 'impacted', riskScore: 74, exposure: '$95,000', exposureTier: 3 },
  { name: 'MexiThread Mfg', country: 'Mexico', lat: 20.6597, lng: -103.3496, status: 'alternative', riskScore: 18, exposure: '$22,000', exposureTier: 2 },
  { name: 'Colombo Fabrics', country: 'Sri Lanka', lat: 6.9271, lng: 79.8612, status: 'alternative', riskScore: 29, exposure: '$14,000', exposureTier: 1 },
  { name: 'US Distribution Hub', country: 'United States', lat: 34.0522, lng: -118.2437, status: 'customer', riskScore: 0, exposure: '$0', exposureTier: 1 },
];

interface Arc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  routeStatus: 'impacted' | 'healthy' | 'alternative';
  exposureTier: 1 | 2 | 3;
  supplierName: string;
}

const LIVE_DESTINATION = {
  name: 'Port of Los Angeles',
  country: 'United States',
  lat: 33.7395,
  lng: -118.261,
};

const ROUTE_WIDTH: Record<1 | 2 | 3, number> = { 1: 0.8, 2: 1.2, 3: 1.6 };

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
}

export interface TradeGlobeProps {
  suppliers?: TradeGlobeSupplier[];
  disruptions?: DisruptionPoint[];
  activeLayers?: Set<string>;
}

function attachPort(s: Omit<Supplier, 'port'>): Supplier {
  const port = portByCountry(s.country);
  return { ...s, port: port ?? undefined };
}

function statusLabel(s: Supplier): string {
  if (s.status === 'impacted') return 'Lane at risk — tariff or disruption on this route';
  if (s.status === 'alternative') return 'Alternative origin — rerouting option';
  if (s.status === 'customer') return 'Import destination';
  return 'Lane clear — no active holds';
}

export const TradeGlobe: React.FC<TradeGlobeProps> = ({
  suppliers = [],
  disruptions = [],
  activeLayers = new Set(['suppliers', 'routes', 'risk']),
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Supplier | null>(null);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const showSuppliers = activeLayers.has('suppliers');
  const showRoutes = activeLayers.has('routes');
  const showRisk = activeLayers.has('risk');
  const showAlt = activeLayers.has('alt');

  const affectedCodes = useMemo(
    () => new Set(disruptions.flatMap((d) => d.countries_affected ?? [])),
    [disruptions],
  );

  const usingLiveData = suppliers.length > 0;

  const effectiveSuppliers = useMemo<Supplier[]>(() => {
    const base = !usingLiveData
      ? SUPPLIERS
      : [
          ...suppliers.map((s) => {
            const risk = s.countryCode ? affectedCodes.has(s.countryCode) : false;
            return attachPort({
              name: s.name,
              country: s.country,
              lat: s.latitude,
              lng: s.longitude,
              status: risk ? 'impacted' : 'healthy',
              riskScore: risk ? 78 : 22,
              exposure: '—',
              exposureTier: risk ? 3 : 1,
            });
          }),
          attachPort({
            name: LIVE_DESTINATION.name,
            country: LIVE_DESTINATION.country,
            lat: LIVE_DESTINATION.lat,
            lng: LIVE_DESTINATION.lng,
            status: 'customer',
            riskScore: 0,
            exposure: '$0',
            exposureTier: 1,
          }),
        ];
    return base.map(attachPort);
  }, [usingLiveData, suppliers, affectedCodes]);

  const effectiveArcs = useMemo<Arc[]>(() => {
    const dest = LIVE_DESTINATION;
    const sources = effectiveSuppliers.filter((s) => s.status !== 'customer');
    if (!usingLiveData) {
      return sources.map((s, i) => ({
        id: `demo-${i}`,
        startLat: s.lat,
        startLng: s.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        routeStatus: (s.status === 'impacted' ? 'impacted' : s.status === 'alternative' ? 'alternative' : 'healthy') as Arc['routeStatus'],
        exposureTier: s.exposureTier,
        supplierName: s.name,
      }));
    }
    return sources.map((s, i) => ({
      id: `live-${i}`,
      startLat: s.lat,
      startLng: s.lng,
      endLat: dest.lat,
      endLng: dest.lng,
      routeStatus: (s.status === 'impacted' ? 'impacted' : 'healthy') as Arc['routeStatus'],
      exposureTier: s.exposureTier,
      supplierName: s.name,
    }));
  }, [usingLiveData, effectiveSuppliers]);

  const visibleSuppliers = useMemo(
    () =>
      effectiveSuppliers.filter((s) => {
        if (s.status === 'customer') return showSuppliers;
        if (s.status === 'alternative') return showSuppliers && showAlt;
        return showSuppliers;
      }),
    [effectiveSuppliers, showSuppliers, showAlt],
  );

  const visibleArcs = useMemo(
    () =>
      effectiveArcs.filter((a) => {
        const sup = effectiveSuppliers.find((s) => s.name === a.supplierName);
        if (!sup) return showRoutes;
        if (sup.status === 'alternative') return showRoutes && showAlt;
        return showRoutes;
      }),
    [effectiveArcs, effectiveSuppliers, showRoutes, showAlt],
  );

  const riskMarkers = useMemo(
    () => (showRisk ? disruptions.filter((d) => d.latitude != null && d.longitude != null) : []),
    [disruptions, showRisk],
  );

  const handleHover = useCallback((e: React.MouseEvent, s: Supplier) => {
    setHovered(s);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClick = useCallback((s: Supplier) => {
    setSelected((prev) => (prev?.name === s.name ? null : s));
    setHovered(null);
    setTooltipPos(null);
  }, []);

  const markerRadius = (s: Supplier, isSelected: boolean) => {
    const base = s.status === 'customer' ? 5 : 3.5 + s.exposureTier * 0.5;
    return isSelected ? base + 1.5 : base;
  };

  const routeColor = (arc: Arc, highlighted: boolean) => {
    if (highlighted) return MAP.routeHighlight;
    if (arc.routeStatus === 'impacted') return MAP.routeImpacted;
    if (arc.routeStatus === 'alternative') return MAP.routeAlt;
    return MAP.routeHealthy;
  };

  const focus = selected ?? hovered;
  const focusPort = focus?.port ?? (focus ? portByCountry(focus.country) : undefined);

  return (
    <div
      ref={containerRef}
      className="trade-map"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: MAP.bg,
        overflow: 'hidden',
      }}
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.5 }}
        aria-hidden
      >
        {[...Array(12)].map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${(i + 1) * (100 / 13)}%`} x2="100%" y2={`${(i + 1) * (100 / 13)}%`} stroke={MAP.grid} strokeWidth="1" />
        ))}
        {[...Array(16)].map((_, i) => (
          <line key={`v${i}`} x1={`${(i + 1) * (100 / 17)}%`} y1="0" x2={`${(i + 1) * (100 / 17)}%`} y2="100%" stroke={MAP.grid} strokeWidth="1" />
        ))}
      </svg>

      {selected && focusPort && (
        <PortDetailPopover
          port={focusPort}
          supplierName={selected.name}
          exposure={selected.exposure}
          statusLabel={statusLabel(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 155, center: [10, 15] }} style={{ width: '100%', height: '100%' }}>
        <ZoomableGroup center={[10, 15]} zoom={1} minZoom={0.85} maxZoom={3}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={MAP.land}
                  stroke={MAP.stroke}
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: MAP.landHover, outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {visibleArcs.map((arc) => {
            const highlighted = selected?.name === arc.supplierName;
            const dimmed = selected != null && !highlighted;
            return (
              <Line
                key={arc.id}
                from={[arc.startLng, arc.startLat]}
                to={[arc.endLng, arc.endLat]}
                stroke={routeColor(arc, highlighted)}
                strokeWidth={highlighted ? ROUTE_WIDTH[arc.exposureTier] + 0.8 : ROUTE_WIDTH[arc.exposureTier]}
                strokeLinecap="round"
                strokeOpacity={dimmed ? 0.2 : highlighted ? 0.95 : arc.routeStatus === 'impacted' ? 0.85 : 0.5}
                strokeDasharray={arc.routeStatus === 'healthy' && !highlighted ? '4 3' : undefined}
                style={{ transition: 'stroke-opacity 0.25s ease' }}
              />
            );
          })}

          {riskMarkers.map((d) => (
            <Marker key={d.incident_id} coordinates={[d.longitude!, d.latitude!]}>
              <circle r={8} fill={MAP.riskZone} stroke={MAP.routeImpacted} strokeWidth={1} opacity={0.9} />
            </Marker>
          ))}

          {visibleSuppliers.map((s) => {
            const isSelected = selected?.name === s.name;
            const isHovered = hovered?.name === s.name;
            const fill = isSelected
              ? MAP.markerSelected
              : STATUS_COLOR[s.status];

            return (
              <Marker
                key={`${s.name}-${s.lat}`}
                coordinates={[s.lng, s.lat]}
                onMouseEnter={(e) => handleHover(e as unknown as React.MouseEvent, s)}
                onMouseMove={(e) => handleHover(e as unknown as React.MouseEvent, s)}
                onMouseLeave={() => {
                  setHovered(null);
                  setTooltipPos(null);
                }}
                onClick={() => handleClick(s)}
              >
                <circle
                  r={markerRadius(s, isSelected)}
                  fill={fill}
                  stroke={isSelected || isHovered ? MAP.routeHighlight : MAP.bg}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
                />
                {(isSelected || isHovered) && s.port && (
                  <text
                    textAnchor="middle"
                    y={-14}
                    style={{ fontSize: 9, fill: MAP.text, fontFamily: 'Manrope, sans-serif', fontWeight: 600, pointerEvents: 'none' }}
                  >
                    {s.port.code}
                  </text>
                )}
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: MAP.panel,
          border: `1px solid ${MAP.panelBorder}`,
          borderRadius: 10,
          padding: '12px 16px',
          fontFamily: 'var(--font)',
          fontSize: 11,
          color: MAP.textMuted,
          minWidth: 200,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 12, color: MAP.text, marginBottom: 8 }}>
          Trade lanes
        </div>
        <div style={{ fontSize: 10, color: MAP.textMuted, marginBottom: 10, lineHeight: 1.4 }}>
          Click a marker to highlight its route and port conditions.
        </div>
        {[
          { color: MAP.markerImpacted, label: 'At-risk origin' },
          { color: MAP.markerHealthy, label: 'Clear origin' },
          { color: MAP.markerAlt, label: 'Alternative origin' },
          { color: MAP.markerCustomer, label: 'Los Angeles (import)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {hovered && !selected && tooltipPos && hovered.port && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 8,
            background: MAP.panel,
            border: `1px solid ${MAP.panelBorder}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'var(--font)',
            zIndex: 9999,
            pointerEvents: 'none',
            maxWidth: 260,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: MAP.text }}>
            {hovered.port.name.replace(/^Port of /, '')}
            {' — '}
            {congestionLabel(hovered.port.congestion).toLowerCase()} berth wait
            {hovered.port.waitDays > 0 ? `, +${hovered.port.waitDays}d` : ''}
          </div>
          <div style={{ fontSize: 11, color: MAP.textMuted, marginBottom: 6 }}>{hovered.name}</div>
          <div style={{ fontSize: 11, color: MAP.textMuted, lineHeight: 1.45 }}>
            {hovered.port.note}
          </div>
        </div>
      )}
    </div>
  );
};

const STATUS_COLOR: Record<Supplier['status'], string> = {
  impacted: MAP.markerImpacted,
  healthy: MAP.markerHealthy,
  alternative: MAP.markerAlt,
  customer: MAP.markerCustomer,
};

export default TradeGlobe;
