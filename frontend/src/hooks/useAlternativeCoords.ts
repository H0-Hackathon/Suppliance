import { useEffect, useState } from 'react';
import type { AgentResults } from '../types/agents';
import type { ResolvedCoords } from '../types/globe';
import api from '../services/api';

async function fetchCoords(country: string): Promise<ResolvedCoords | null> {
  try {
    const res = await api.get<{
      country: string;
      code: string | null;
      latitude: number;
      longitude: number;
      location_name: string;
    }>('/v2/geo/supplier-coords', { params: { country } });
    return {
      country: res.data.country,
      code: res.data.code,
      latitude: res.data.latitude,
      longitude: res.data.longitude,
      location_name: res.data.location_name,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves coordinates for affected countries and alternative suppliers
 * as agent outputs arrive — no hardcoded positions in the globe itself.
 */
export function useAlternativeCoords(
  agentResults: AgentResults,
  supplierCountries: string[],
): Record<string, ResolvedCoords> {
  const [coords, setCoords] = useState<Record<string, ResolvedCoords>>({});

  useEffect(() => {
    const keys = new Set<string>();

    const tmCountry = agentResults.tariff_monitor?.country;
    if (tmCountry) keys.add(String(tmCountry));

    for (const c of supplierCountries) {
      if (c) keys.add(c);
    }

    const alternatives = agentResults.alternatives_finder?.alternatives
      ?? agentResults.alternatives_finder?.options;
    if (Array.isArray(alternatives)) {
      for (const alt of alternatives) {
        if (alt.country) keys.add(String(alt.country));
        if (alt.country_full) keys.add(String(alt.country_full));
      }
    }

    const compliance = agentResults.import_compliance?.compliance_by_country;
    if (compliance) {
      for (const code of Object.keys(compliance)) keys.add(code);
    }

    if (!keys.size) return;

    let cancelled = false;
    (async () => {
      const resolved: Record<string, ResolvedCoords> = {};
      await Promise.all(
        [...keys].map(async (key) => {
          const result = await fetchCoords(key);
          if (result) resolved[key] = result;
        }),
      );
      if (!cancelled && Object.keys(resolved).length) {
        setCoords((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(resolved)) {
            if (!next[k]) next[k] = v;
          }
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [agentResults, supplierCountries]);

  return coords;
}
