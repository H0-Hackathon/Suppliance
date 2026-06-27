/**
 * Minimal, dependency-free TopoJSON loader for country silhouettes.
 *
 * Fetches the same world-atlas topojson the Suppliers map already uses, decodes
 * it ONCE (module-level cached promise), and exposes per-country GeoJSON
 * geometry keyed by country name. Used by CountryOutlineIcon to draw small
 * country outlines in place of flag emoji.
 *
 * We hand-roll the (tiny) TopoJSON arc decoder rather than pull in
 * topojson-client, which isn't directly importable here (react-simple-maps
 * bundles its own copy).
 */

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export type Ring = [number, number][];
export type CountryGeometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

interface Topology {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: [number, number][][];
  objects: Record<string, { type: string; geometries: TopoGeometry[] }>;
}
interface TopoGeometry {
  type: 'Polygon' | 'MultiPolygon' | string;
  arcs: any;
  id?: string;
  properties?: { name?: string };
}

// Country-name aliases: maps the app's supplier-data spellings to Natural Earth
// names used in the topojson. Only the ones that actually differ.
const NAME_ALIASES: Record<string, string> = {
  'USA': 'United States of America',
  'United States': 'United States of America',
  'UAE': 'United Arab Emirates',
  'Czech Republic': 'Czechia',
  'Ivory Coast': "Côte d'Ivoire",
  'North Macedonia': 'Macedonia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Dominican Republic': 'Dominican Rep.',
  'South Korea': 'South Korea',
  'Eswatini': 'eSwatini',
};

let cache: Promise<Map<string, CountryGeometry>> | null = null;

function decodeAllArcs(topo: Topology): [number, number][][] {
  const scale = topo.transform?.scale ?? [1, 1];
  const translate = topo.transform?.translate ?? [0, 0];
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
    });
  });
}

function arc(decoded: [number, number][][], index: number): [number, number][] {
  return index < 0 ? decoded[~index].slice().reverse() : decoded[index];
}

function ring(decoded: [number, number][][], arcIdx: number[]): Ring {
  const out: Ring = [];
  arcIdx.forEach((ai, k) => {
    const pts = arc(decoded, ai);
    out.push(...(k > 0 ? pts.slice(1) : pts));
  });
  return out;
}

function toGeometry(decoded: [number, number][][], g: TopoGeometry): CountryGeometry | null {
  if (g.type === 'Polygon') {
    return { type: 'Polygon', coordinates: (g.arcs as number[][]).map((r) => ring(decoded, r)) };
  }
  if (g.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (g.arcs as number[][][]).map((poly) => poly.map((r) => ring(decoded, r))),
    };
  }
  return null;
}

export function loadCountryGeometries(): Promise<Map<string, CountryGeometry>> {
  if (cache) return cache;
  cache = fetch(GEO_URL)
    .then((r) => r.json())
    .then((topo: Topology) => {
      const decoded = decodeAllArcs(topo);
      const collection = topo.objects.countries;
      const map = new Map<string, CountryGeometry>();
      for (const g of collection.geometries) {
        const name = g.properties?.name;
        if (!name) continue;
        const geom = toGeometry(decoded, g);
        if (geom) map.set(name, geom);
      }
      return map;
    })
    .catch((err) => {
      console.error('Failed to load country geometries:', err);
      return new Map<string, CountryGeometry>();
    });
  return cache;
}

export async function getCountryGeometry(name: string): Promise<CountryGeometry | null> {
  const map = await loadCountryGeometries();
  const resolved = NAME_ALIASES[name] ?? name;
  return map.get(resolved) ?? map.get(name) ?? null;
}
