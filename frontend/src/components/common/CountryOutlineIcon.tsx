import React, { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { COUNTRY_NAME_TO_CODE } from '../../data/countryCodes';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

let cachedTopo: any = null;
let cachedPromise: Promise<any> | null = null;

function fetchTopo(): Promise<any> {
  if (cachedTopo) return Promise.resolve(cachedTopo);
  if (cachedPromise) return cachedPromise;
  cachedPromise = fetch(GEO_URL)
    .then((r) => r.json())
    .then((data) => {
      cachedTopo = data;
      return data;
    });
  return cachedPromise;
}

interface CountryOutlineIconProps {
  countryName: string;
  size?: number;
  fill?: string;
  stroke?: string;
  className?: string;
}

export const CountryOutlineIcon: React.FC<CountryOutlineIconProps> = ({
  countryName,
  size = 24,
  fill = 'rgba(132,215,216,0.15)',
  stroke = '#548C92',
  className,
}) => {
  const [geo, setGeo] = useState<any>(null);
  const iso = COUNTRY_NAME_TO_CODE[countryName];

  useEffect(() => {
    fetchTopo().then(setGeo);
  }, []);

  if (!iso || !geo) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, borderRadius: 4, background: 'rgba(232,226,216,0.06)' }}
      />
    );
  }

  return (
    <div className={className} style={{ width: size, height: size, display: 'inline-block' }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120 }}
        width={size}
        height={size}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={geo}>
          {({ geographies }) =>
            geographies
              .filter((g: any) => g.properties.ISO_A2 === iso)
              .map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={0.5}
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                />
              ))
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
};
