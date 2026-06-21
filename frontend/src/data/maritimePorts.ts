/** Known ports and plausible congestion — display-only logistics context */

export type CongestionLevel = 'clear' | 'moderate' | 'high';

export interface PortInfo {
  code: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  congestion: CongestionLevel;
  waitDays: number;
  note: string;
}

export const MAJOR_PORTS: PortInfo[] = [
  {
    code: 'CNSHA',
    name: 'Port of Shanghai',
    country: 'China',
    lat: 31.23,
    lng: 121.47,
    congestion: 'moderate',
    waitDays: 1,
    note: 'Yangshan berth queue easing; expect +1d on eastbound sailings',
  },
  {
    code: 'VNSGN',
    name: 'Port of Ho Chi Minh City (Cat Lai)',
    country: 'Vietnam',
    lat: 10.75,
    lng: 106.75,
    congestion: 'high',
    waitDays: 3,
    note: 'Mekong feeder delays; textile exports facing +2–3d dwell',
  },
  {
    code: 'BDDAC',
    name: 'Port of Chittagong',
    country: 'Bangladesh',
    lat: 22.32,
    lng: 91.81,
    congestion: 'moderate',
    waitDays: 2,
    note: 'Apparel peak season; moderate yard congestion',
  },
  {
    code: 'SGSIN',
    name: 'Port of Singapore',
    country: 'Singapore',
    lat: 1.26,
    lng: 103.85,
    congestion: 'clear',
    waitDays: 0,
    note: 'Transshipment hub operating normally',
  },
  {
    code: 'LKCMB',
    name: 'Port of Colombo',
    country: 'Sri Lanka',
    lat: 6.94,
    lng: 79.85,
    congestion: 'clear',
    waitDays: 0,
    note: 'South Asia transshipment — on schedule',
  },
  {
    code: 'MXLZC',
    name: 'Port of Manzanillo',
    country: 'Mexico',
    lat: 19.05,
    lng: -104.32,
    congestion: 'moderate',
    waitDays: 1,
    note: 'Pacific gateway; USMCA lanes clearing within 24h',
  },
  {
    code: 'NLRTM',
    name: 'Port of Rotterdam',
    country: 'Netherlands',
    lat: 51.95,
    lng: 4.14,
    congestion: 'moderate',
    waitDays: 2,
    note: 'Moderate berth wait on deep-sea calls; +2d typical',
  },
  {
    code: 'USLAX',
    name: 'Port of Los Angeles',
    country: 'United States',
    lat: 33.74,
    lng: -118.26,
    congestion: 'moderate',
    waitDays: 2,
    note: 'San Pedro Bay — moderate import dwell; chassis availability fair',
  },
];

const COUNTRY_PORT: Record<string, string> = {
  China: 'CNSHA',
  Vietnam: 'VNSGN',
  Bangladesh: 'BDDAC',
  Singapore: 'SGSIN',
  'Sri Lanka': 'LKCMB',
  Mexico: 'MXLZC',
  Netherlands: 'NLRTM',
  'United States': 'USLAX',
  USA: 'USLAX',
};

export function portByCountry(country: string): PortInfo | undefined {
  const code = COUNTRY_PORT[country];
  return code ? MAJOR_PORTS.find((p) => p.code === code) : undefined;
}

export function portByCode(code: string): PortInfo | undefined {
  return MAJOR_PORTS.find((p) => p.code === code);
}

export function congestionLabel(level: CongestionLevel): string {
  if (level === 'clear') return 'Clear';
  if (level === 'moderate') return 'Moderate wait';
  return 'Congested';
}

export interface RouteLeg {
  port: PortInfo;
  role: 'origin' | 'transshipment' | 'destination';
  etaLabel?: string;
  status?: 'done' | 'current' | 'upcoming' | 'delayed';
}

/** Plausible lane for a supplier country → US import */
export function buildRouteLegs(originCountry: string): RouteLeg[] {
  const origin = portByCountry(originCountry) ?? portByCountry('China')!;
  const transship = portByCode('SGSIN')!;
  const dest = portByCode('USLAX')!;

  const delayed = origin.congestion === 'high';

  return [
    { port: origin, role: 'origin', etaLabel: 'Departed', status: 'done' },
    {
      port: transship,
      role: 'transshipment',
      etaLabel: delayed ? 'ETA +1d' : 'On schedule',
      status: delayed ? 'delayed' : 'current',
    },
    { port: dest, role: 'destination', etaLabel: 'Est. arrival', status: 'upcoming' },
  ];
}
