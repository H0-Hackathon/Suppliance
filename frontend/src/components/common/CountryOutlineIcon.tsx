import React from 'react';
import { Globe2 } from 'lucide-react';
import { getCountryGeometry, CountryGeometry, Ring } from '../../data/worldTopo';

interface CountryOutlineIconProps {
  /** Country name (matches the app's supplier-data spelling). */
  country: string;
  size?: number;
  color?: string;
  title?: string;
}

function polygons(geom: CountryGeometry): Ring[] {
  return geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
}

/** Build an SVG path (equirectangular, aspect-preserving, fitted to `size`). */
function buildPath(geom: CountryGeometry, size: number): string | null {
  const rings = polygons(geom);
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const r of rings) {
    for (const [lon, lat] of r) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  // Antimeridian-spanning countries (Russia, Fiji) bbox-break — fall back to icon.
  if (!isFinite(lonSpan) || lonSpan <= 0 || latSpan <= 0 || lonSpan > 200) return null;

  const pad = size * 0.12;
  const inner = size - pad * 2;
  const scale = inner / Math.max(lonSpan, latSpan);
  // Center the (possibly non-square) bbox within the square box.
  const offX = pad + (inner - lonSpan * scale) / 2;
  const offY = pad + (inner - latSpan * scale) / 2;

  const project = ([lon, lat]: [number, number]): [number, number] => [
    offX + (lon - minLon) * scale,
    offY + (maxLat - lat) * scale, // flip y
  ];

  let d = '';
  for (const r of rings) {
    if (r.length < 3) continue;
    r.forEach((pt, i) => {
      const [x, y] = project(pt);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    d += 'Z';
  }
  return d || null;
}

/**
 * Small country silhouette drawn from cached TopoJSON, replacing flag emoji.
 * Falls back to a globe icon for unknown / antimeridian-spanning countries.
 */
export const CountryOutlineIcon: React.FC<CountryOutlineIconProps> = ({
  country,
  size = 18,
  color = 'var(--clay)',
  title,
}) => {
  const [path, setPath] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getCountryGeometry(country)
      .then((geom) => {
        if (!active) return;
        const d = geom ? buildPath(geom, size) : null;
        if (d) setPath(d);
        else setFailed(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [country, size]);

  if (failed) {
    return <Globe2 size={size * 0.82} strokeWidth={1.75} color={color} aria-label={title || country} />;
  }
  if (!path) {
    // tiny placeholder square while geometry resolves
    return <span style={{ display: 'inline-block', width: size, height: size }} aria-label={title || country} />;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title || country}>
      <path d={path} fill={color} stroke={color} strokeWidth={0.4} strokeLinejoin="round" />
    </svg>
  );
};

export default CountryOutlineIcon;
