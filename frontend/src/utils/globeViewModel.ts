import type { AgentResults, AgentStatusMap } from '../types/agents';
import type {
  ComplianceRisk,
  GlobeArc,
  GlobeNode,
  GlobePulse,
  GlobeViewModel,
  GlobeViewModelInput,
  NodeStatus,
  ResolvedCoords,
  RouteStatus,
  RiskRing,
  VisualizationMode,
} from '../types/globe';

const DEFAULT_DESTINATION = {
  name: 'Port of Los Angeles',
  country: 'United States',
  lat: 33.7395,
  lng: -118.261,
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

const AGENT_ORDER = [
  'tariff_monitor',
  'impact_calculator',
  'alternatives_finder',
  'import_compliance',
  'adversarial',
] as const;

/** Normalize legacy mock shapes and current pipeline JSON into one structure. */
function normalizeAgentResults(raw: AgentResults, supplierCountry?: string | null): AgentResults {
  const tm = raw.tariff_monitor ?? {};
  const impact = raw.impact_calculator ?? {};
  const af = raw.alternatives_finder ?? {};
  const ic = raw.import_compliance ?? {};
  const adv = raw.adversarial ?? {};

  let alternatives: Array<Record<string, unknown>> = [];
  if (Array.isArray(af.alternatives)) {
    alternatives = af.alternatives as Array<Record<string, unknown>>;
  } else if (Array.isArray(af.options)) {
    alternatives = (af.options as Array<Record<string, unknown>>).map((opt, i) => ({
      rank: i + 1,
      supplier_name: opt.supplier ?? opt.supplier_name,
      country: opt.country,
      country_full: opt.country_full,
      lead_time_weeks: opt.lead_time_weeks,
      cost_delta_pct: opt.cost_delta_pct,
      cost_delta_usd: opt.cost_delta_usd,
    }));
  }

  let complianceByCountry: Record<string, Record<string, unknown>> = {};
  if (ic.compliance_by_country && typeof ic.compliance_by_country === 'object') {
    complianceByCountry = ic.compliance_by_country as Record<string, Record<string, unknown>>;
  } else {
    for (const [code, value] of Object.entries(ic)) {
      if (code === 'summary') continue;
      if (Array.isArray(value)) {
        complianceByCountry[code] = {
          overall_compliance_risk: value.length > 2 ? 'medium' : 'low',
          mandatory_documents: value.map((doc) => ({ document: String(doc) })),
        };
      } else if (value && typeof value === 'object') {
        complianceByCountry[code] = value as Record<string, unknown>;
      }
    }
  }

  const recommendedAction = adv.recommended_action ?? adv.recommendation ?? null;

  return {
    tariff_monitor: {
      ...tm,
      country: tm.country ?? supplierCountry ?? null,
      severity: tm.severity ?? impact.severity ?? 'high',
      tariff_rate: tm.tariff_rate ?? 25,
    },
    impact_calculator: {
      ...impact,
      direct_cost: impact.direct_cost ?? impact.extra_cost_usd ?? null,
      extra_cost_usd: impact.extra_cost_usd ?? impact.direct_cost ?? null,
    },
    alternatives_finder: {
      ...af,
      alternatives,
    },
    import_compliance: {
      ...ic,
      compliance_by_country: complianceByCountry,
    },
    adversarial: {
      ...adv,
      recommended_action: recommendedAction,
    },
  };
}

function extractAlternatives(agentResults: AgentResults): Array<Record<string, unknown>> {
  const af = agentResults.alternatives_finder;
  if (!af) return [];
  return Array.isArray(af.alternatives) ? af.alternatives as Array<Record<string, unknown>> : [];
}

function normalizeCountry(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesCountry(
  candidate: string | null | undefined,
  target: string | null | undefined,
  targetCode: string | null | undefined,
): boolean {
  const c = normalizeCountry(candidate);
  const t = normalizeCountry(target);
  const code = normalizeCountry(targetCode);
  if (!c || (!t && !code)) return false;
  return c === t || c === code || t.includes(c) || c.includes(t);
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function exposureTierFromImpact(directCost: number | null | undefined, riskScore: number | null | undefined): 1 | 2 | 3 {
  const cost = directCost ?? 0;
  const risk = riskScore ?? 0;
  if (cost >= 50000 || risk >= 70) return 3;
  if (cost >= 15000 || risk >= 40) return 2;
  return 1;
}

function arcWidth(tier: 1 | 2 | 3): number {
  return { 1: 0.55, 2: 1.0, 3: 1.65 }[tier];
}

function complianceRiskLevel(value: string | null | undefined): ComplianceRisk {
  const v = (value ?? 'unknown').toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'critical') return v;
  return 'unknown';
}

function agentStepIndex(agentStatus: AgentStatusMap, agentResults: AgentResults): number {
  let step = -1;
  for (let i = 0; i < AGENT_ORDER.length; i++) {
    const key = AGENT_ORDER[i];
    if (agentStatus[key] === 'done' || agentResults[key]) step = i;
  }
  return step;
}

function resolveAffectedCountry(
  agentResults: AgentResults,
  disruptions: GlobeViewModelInput['disruptions'],
): { country: string | null; code: string | null; lat: number | null; lng: number | null } {
  const tm = agentResults.tariff_monitor;
  const country = tm?.country ?? null;

  for (const d of disruptions) {
    const codes = d.countries_affected ?? [];
    if (country && codes.some((c) => matchesCountry(c, country, country))) {
      return {
        country,
        code: country.length === 2 ? country.toUpperCase() : null,
        lat: d.latitude ?? null,
        lng: d.longitude ?? null,
      };
    }
  }

  if (country) {
    return { country, code: country.length === 2 ? country.toUpperCase() : null, lat: null, lng: null };
  }

  const top = [...disruptions].sort(
    (a, b) => (SEVERITY_RANK[(b.severity ?? 'low').toLowerCase()] ?? 0)
      - (SEVERITY_RANK[(a.severity ?? 'low').toLowerCase()] ?? 0),
  )[0];
  if (top) {
    const code = top.countries_affected?.[0] ?? null;
    return {
      country: code,
      code,
      lat: top.latitude ?? null,
      lng: top.longitude ?? null,
    };
  }

  return { country: null, code: null, lat: null, lng: null };
}

function findSelectedAlternative(
  agentResults: AgentResults,
  alternatives: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!alternatives.length) return null;

  const adv = agentResults.adversarial;
  const actionText = String(adv?.recommended_action ?? adv?.recommendation ?? '').toLowerCase();
  if (actionText) {
    const match = alternatives.find((alt) => {
      const name = String(alt.supplier_name ?? alt.supplier ?? '').toLowerCase();
      const country = String(alt.country ?? '').toLowerCase();
      return (name && actionText.includes(name)) || (country && actionText.includes(country));
    });
    if (match) return match;
  }

  if (adv?.verdict && ['CLEAR', 'CAUTION'].includes(String(adv.verdict).toUpperCase())) {
    return alternatives.find((a) => a.rank === 1) ?? alternatives[0];
  }

  return null;
}

function lookupCoords(
  countryOrCode: string,
  alternativeCoords: Record<string, ResolvedCoords>,
  suppliers: GlobeViewModelInput['suppliers'],
): ResolvedCoords | null {
  const key = countryOrCode.trim();
  if (alternativeCoords[key]) return alternativeCoords[key];

  const upper = key.toUpperCase();
  if (alternativeCoords[upper]) return alternativeCoords[upper];

  for (const coords of Object.values(alternativeCoords)) {
    if (matchesCountry(coords.country, key, coords.code)) return coords;
    if (coords.code && matchesCountry(coords.code, key, upper)) return coords;
  }

  const supplier = suppliers.find(
    (s) => matchesCountry(s.country, key, s.countryCode) || matchesCountry(s.countryCode, key, upper),
  );
  if (supplier) {
    return {
      country: supplier.country,
      code: supplier.countryCode,
      latitude: supplier.latitude,
      longitude: supplier.longitude,
    };
  }

  return null;
}

function buildAlternativeNodes(
  alternatives: Array<Record<string, unknown>>,
  selected: Record<string, unknown> | null,
  adversarialDone: boolean,
  complianceByCountry: Record<string, Record<string, unknown>>,
  alternativeCoords: Record<string, ResolvedCoords>,
  impactedOrigin: { lat: number; lng: number } | null,
): { nodes: GlobeNode[]; arcs: GlobeArc[] } {
  const nodes: GlobeNode[] = [];
  const arcs: GlobeArc[] = [];

  for (const alt of alternatives) {
    const countryKey = String(alt.country_full ?? alt.country ?? '');
    const coords = lookupCoords(countryKey, alternativeCoords, []);
    if (!coords) continue;

    const isSelected = selected != null && (
      (alt.rank != null && selected.rank === alt.rank)
      || String(alt.supplier_name) === String(selected.supplier_name)
    );
    const isRejected = adversarialDone && selected != null && !isSelected;

    const code = String(alt.country ?? coords.code ?? '').toUpperCase();
    const compliance = complianceByCountry[code] ?? complianceByCountry[String(alt.country ?? '')];
    const complianceRisk = compliance
      ? complianceRiskLevel(String(compliance.overall_compliance_risk))
      : null;

    const savingsPct = typeof alt.cost_delta_pct === 'number' ? alt.cost_delta_pct : null;
    const rank = typeof alt.rank === 'number' ? alt.rank : null;
    const leadTime = typeof alt.lead_time_weeks === 'number' ? alt.lead_time_weeks : null;

    let status: NodeStatus = 'alternative';
    if (isSelected) status = 'recommended';
    else if (isRejected) status = 'rejected';

    const rankTier: 1 | 2 | 3 = rank === 1 ? 3 : rank === 2 ? 2 : 1;

    nodes.push({
      id: `alt-${code}-${rank ?? alt.supplier_name}`,
      name: String(alt.supplier_name ?? alt.supplier ?? `Alternative (${coords.country})`),
      country: coords.country,
      countryCode: coords.code,
      lat: coords.latitude,
      lng: coords.longitude,
      status,
      riskScore: complianceRisk === 'high' ? 65 : complianceRisk === 'medium' ? 40 : 18,
      exposure: formatMoney(typeof alt.cost_delta_usd === 'number' ? Math.abs(alt.cost_delta_usd) : null),
      exposureTier: rankTier,
      complianceRisk,
      isActiveRisk: false,
      isSelected,
      isRejected,
      rank,
      savingsPct,
      leadTimeWeeks: leadTime,
      opacity: isRejected ? 0.35 : 1,
      pointType: 'supplier',
      tooltipLines: [
        savingsPct != null ? `Cost delta: ${savingsPct > 0 ? '+' : ''}${savingsPct}%` : '',
        leadTime != null ? `Lead time: ${leadTime} weeks` : '',
        complianceRisk ? `Compliance: ${complianceRisk}` : '',
        rank != null ? `Rank: #${rank}` : '',
      ].filter(Boolean),
    });

    if (impactedOrigin) {
      const routeStatus: RouteStatus = isSelected
        ? 'recommended'
        : isRejected
          ? 'rejected'
          : 'alternative';

      arcs.push({
        id: `alt-arc-${code}-${rank}`,
        startLat: impactedOrigin.lat,
        startLng: impactedOrigin.lng,
        endLat: coords.latitude,
        endLng: coords.longitude,
        routeStatus,
        exposureTier: rankTier,
        opacity: isRejected ? 0.25 : isSelected ? 1 : 0.85,
        animated: true,
        isWinner: isSelected,
        tooltip: [
          String(alt.supplier_name ?? 'Alternative'),
          savingsPct != null ? `${savingsPct > 0 ? '+' : ''}${savingsPct}% vs current` : '',
          leadTime != null ? `${leadTime}w lead` : '',
        ].filter(Boolean).join(' · '),
      });
    }
  }

  return { nodes, arcs };
}

function applyVisualizationMode(
  mode: VisualizationMode,
  nodes: GlobeNode[],
  arcs: GlobeArc[],
  pulses: GlobePulse[],
  riskRings: RiskRing[],
  reasoningStep: number,
): { nodes: GlobeNode[]; arcs: GlobeArc[]; pulses: GlobePulse[]; riskRings: RiskRing[] } {
  if (mode === 'executive') {
    const keep = nodes.filter(
      (n) => n.status === 'customer' || n.status === 'impacted' || n.status === 'recommended',
    );
    const keepIds = new Set(keep.map((n) => n.id));
    return {
      nodes: keep,
      arcs: arcs.filter(
        (a) => a.isWinner || a.routeStatus === 'impacted' || a.routeStatus === 'warning',
      ),
      pulses: pulses.filter((p) => p.routeStatus === 'impacted' || p.routeStatus === 'recommended'),
      riskRings: riskRings.slice(0, 1),
    };
  }

  if (mode === 'ai_reasoning') {
    const showAlternatives = reasoningStep >= 2;
    const showCompliance = reasoningStep >= 3;
    const showFinal = reasoningStep >= 4;

    const filteredNodes = nodes.filter((n) => {
      if (n.status === 'customer' || n.status === 'impacted' || n.status === 'healthy') return true;
      if (!showAlternatives) return false;
      if (n.status === 'alternative' || n.status === 'recommended' || n.status === 'rejected') {
        if (!showFinal && n.status === 'rejected') return false;
        if (!showCompliance && n.complianceRisk) return true;
        return true;
      }
      return true;
    });

    const filteredArcs = arcs.filter((a) => {
      if (a.routeStatus === 'impacted' || a.routeStatus === 'warning' || a.routeStatus === 'healthy') {
        return reasoningStep >= 0;
      }
      if (a.routeStatus === 'alternative' || a.routeStatus === 'recommended' || a.routeStatus === 'rejected') {
        return showAlternatives;
      }
      return true;
    });

    return {
      nodes: filteredNodes,
      arcs: filteredArcs,
      pulses: reasoningStep >= 1 ? pulses : [],
      riskRings: reasoningStep >= 0 ? riskRings : [],
    };
  }

  if (mode === 'risk_heatmap') {
    return {
      nodes: nodes.filter((n) => n.isActiveRisk || n.status === 'impacted'),
      arcs: arcs.filter((a) => a.routeStatus === 'impacted' || a.routeStatus === 'warning'),
      pulses: pulses.filter((p) => p.routeStatus === 'impacted' || p.routeStatus === 'warning'),
      riskRings,
    };
  }

  return { nodes, arcs, pulses, riskRings };
}

function applyActiveLayers(
  layers: Set<string>,
  nodes: GlobeNode[],
  arcs: GlobeArc[],
  pulses: GlobePulse[],
  riskRings: RiskRing[],
): { nodes: GlobeNode[]; arcs: GlobeArc[]; pulses: GlobePulse[]; riskRings: RiskRing[] } {
  return {
    nodes: layers.has('suppliers') || layers.has('alt')
      ? nodes.filter((n) => {
          if (n.status === 'customer') return layers.has('suppliers');
          if (n.status === 'alternative' || n.status === 'recommended' || n.status === 'rejected') {
            return layers.has('alt');
          }
          return layers.has('suppliers');
        })
      : nodes.filter((n) => n.status === 'customer'),
    arcs: layers.has('routes') ? arcs : [],
    pulses: layers.has('routes') ? pulses : [],
    riskRings: layers.has('risk') ? riskRings : [],
  };
}

export function buildGlobeViewModel(input: GlobeViewModelInput): GlobeViewModel {
  const {
    suppliers,
    disruptions,
    agentStatus,
    alternativeCoords,
    visualizationMode,
    activeLayers,
    supplierCountry,
  } = input;

  const agentResults = normalizeAgentResults(input.agentResults, supplierCountry);

  const destination = input.destination ?? DEFAULT_DESTINATION;
  const reasoningStep = agentStepIndex(agentStatus, agentResults);
  const activeAgent = AGENT_ORDER.find((k) => agentStatus[k] === 'running') ?? null;

  const tm = agentResults.tariff_monitor;
  const impact = agentResults.impact_calculator;
  const alternatives = extractAlternatives(agentResults);
  const complianceByCountry: Record<string, Record<string, unknown>> =
    agentResults.import_compliance?.compliance_by_country ?? {};

  const affected = resolveAffectedCountry(agentResults, disruptions);
  const affectedCoords = affected.country
    ? lookupCoords(affected.country, alternativeCoords, suppliers)
    : null;

  const focusLat = affectedCoords?.latitude ?? affected.lat ?? null;
  const focusLng = affectedCoords?.longitude ?? affected.lng ?? null;

  const directCost = impact?.direct_cost ?? impact?.extra_cost_usd ?? null;
  const exposureTier = exposureTierFromImpact(directCost, impact?.risk_score);
  const tariffDone = Boolean(tm);
  const impactDone = Boolean(impact);
  const alternativesDone = alternatives.length > 0;
  const adversarialDone = Boolean(agentResults.adversarial);

  const affectedCodes = new Set<string>([
    ...disruptions.flatMap((d) => d.countries_affected ?? []),
    ...(affected.code ? [affected.code] : []),
    ...(affected.country ? [affected.country] : []),
  ]);

  const nodes: GlobeNode[] = [];
  const arcs: GlobeArc[] = [];
  let impactedOrigin: { lat: number; lng: number } | null = null;

  for (const s of suppliers) {
    const isImpacted = tariffDone && (
      (s.countryCode && affectedCodes.has(s.countryCode))
      || matchesCountry(s.country, affected.country, affected.code)
      || matchesCountry(s.countryCode, affected.country, affected.code)
    );

    const status: NodeStatus = isImpacted ? 'impacted' : 'healthy';
    if (isImpacted) impactedOrigin = { lat: s.latitude, lng: s.longitude };

    nodes.push({
      id: `supplier-${s.name}`,
      name: s.name,
      country: s.country,
      countryCode: s.countryCode,
      lat: s.latitude,
      lng: s.longitude,
      status,
      riskScore: isImpacted
        ? Math.round((tm?.confidence ?? 0.75) * 100)
        : Math.max(10, 100 - Math.round((impact?.risk_score ?? 20))),
      exposure: impactDone && isImpacted ? formatMoney(directCost) : '—',
      exposureTier: isImpacted && impactDone ? exposureTier : 1,
      complianceRisk: null,
      isActiveRisk: isImpacted,
      isSelected: false,
      isRejected: false,
      rank: null,
      savingsPct: null,
      leadTimeWeeks: null,
      opacity: 1,
      pointType: 'supplier',
      tooltipLines: isImpacted && impactDone
        ? [`Exposure: ${formatMoney(directCost)}`, tm?.tariff_rate != null ? `Tariff: +${tm.tariff_rate}%` : '']
        : [],
    });

    const routeStatus: RouteStatus = isImpacted
      ? (tariffDone ? 'warning' : 'impacted')
      : 'healthy';

    arcs.push({
      id: `route-${s.name}`,
      startLat: s.latitude,
      startLng: s.longitude,
      endLat: destination.lat,
      endLng: destination.lng,
      routeStatus,
      exposureTier: isImpacted && impactDone ? exposureTier : 1,
      opacity: isImpacted ? 1 : 0.7,
      animated: isImpacted,
      isWinner: false,
      tooltip: isImpacted && impactDone
        ? `Cost impact: ${formatMoney(directCost)} · Risk ${impact?.risk_score ?? '—'}`
        : s.name,
    });
  }

  nodes.push({
    id: 'destination',
    name: destination.name,
    country: destination.country,
    countryCode: 'US',
    lat: destination.lat,
    lng: destination.lng,
    status: 'customer',
    riskScore: 0,
    exposure: '$0',
    exposureTier: 1,
    complianceRisk: null,
    isActiveRisk: false,
    isSelected: false,
    isRejected: false,
    rank: null,
    savingsPct: null,
    leadTimeWeeks: null,
    opacity: 1,
    pointType: 'supplier',
    tooltipLines: ['Import destination'],
  });

  if (!impactedOrigin && affectedCoords) {
    impactedOrigin = { lat: affectedCoords.latitude, lng: affectedCoords.longitude };
  }

  const selected = adversarialDone || agentStatus.adversarial === 'done'
    ? findSelectedAlternative(agentResults, alternatives)
    : null;

  if (alternativesDone) {
    const altData = buildAlternativeNodes(
      alternatives,
      selected,
      adversarialDone,
      complianceByCountry,
      alternativeCoords,
      impactedOrigin,
    );
    nodes.push(...altData.nodes);
    arcs.push(...altData.arcs);

    for (const altNode of altData.nodes.filter((n) => n.isSelected || (!adversarialDone && n.rank === 1))) {
      arcs.push({
        id: `winner-route-${altNode.id}`,
        startLat: altNode.lat,
        startLng: altNode.lng,
        endLat: destination.lat,
        endLng: destination.lng,
        routeStatus: adversarialDone && altNode.isSelected ? 'recommended' : 'alternative',
        exposureTier: altNode.exposureTier,
        opacity: altNode.isSelected ? 1 : 0.75,
        animated: true,
        isWinner: Boolean(altNode.isSelected),
        tooltip: `${altNode.name} → ${destination.name}`,
      });
    }
  }

  const pulses: GlobePulse[] = [];
  for (const arc of arcs) {
    if (!arc.animated || arc.opacity < 0.3) continue;
    const count = arc.exposureTier === 3 ? 4 : arc.exposureTier === 2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      pulses.push({
        lat: arc.startLat + (arc.endLat - arc.startLat) * t,
        lng: arc.startLng + (arc.endLng - arc.startLng) * t,
        routeStatus: arc.routeStatus,
        exposureTier: arc.exposureTier,
        opacity: arc.opacity,
        pointType: 'pulse',
      });
    }
  }

  const riskRings: RiskRing[] = [];
  if (tariffDone && focusLat != null && focusLng != null) {
    const intensity = tm?.severity
      ? (SEVERITY_RANK[String(tm.severity).toLowerCase()] ?? 2) / 4
      : 0.6;
    riskRings.push({
      lat: focusLat,
      lng: focusLng,
      radius: 4 + intensity * 4,
      intensity,
      color: 'rgba(220,38,38,',
    });
  }

  for (const d of disruptions) {
    if (d.latitude == null || d.longitude == null) continue;
    const sev = SEVERITY_RANK[(d.severity ?? 'medium').toLowerCase()] ?? 2;
    riskRings.push({
      lat: d.latitude,
      lng: d.longitude,
      radius: 2 + sev,
      intensity: sev / 4,
      color: 'rgba(239,68,68,',
    });
  }

  let filtered = applyVisualizationMode(
    visualizationMode,
    nodes,
    arcs,
    pulses,
    riskRings,
    reasoningStep,
  );
  filtered = applyActiveLayers(activeLayers, filtered.nodes, filtered.arcs, filtered.pulses, filtered.riskRings);

  const topDisruption = [...disruptions].sort(
    (a, b) => (SEVERITY_RANK[(b.severity ?? 'low').toLowerCase()] ?? 0)
      - (SEVERITY_RANK[(a.severity ?? 'low').toLowerCase()] ?? 0),
  )[0];

  let bannerText = 'Run Analysis to visualize AI supply chain reasoning';
  if (tm?.event) {
    bannerText = `${(tm.severity ?? 'ALERT').toString().toUpperCase()} — ${tm.event}`;
    if (tm.tariff_rate != null) bannerText += ` · +${tm.tariff_rate}% tariff`;
  } else if (topDisruption) {
    bannerText = `${(topDisruption.severity ?? 'medium').toUpperCase()} — ${topDisruption.title}`;
  }

  if (agentResults.adversarial?.recommended_action && adversarialDone) {
    bannerText = `RECOMMENDED — ${agentResults.adversarial.recommended_action}`;
  }

  return {
    nodes: filtered.nodes,
    arcs: filtered.arcs,
    pulses: filtered.pulses,
    riskRings: filtered.riskRings,
    focusPoint: focusLat != null && focusLng != null && tariffDone
      ? { lat: focusLat, lng: focusLng, altitude: visualizationMode === 'executive' ? 1.6 : 2.0 }
      : null,
    bannerText,
    activeAgent,
    reasoningStep,
  };
}

export { arcWidth, DEFAULT_DESTINATION, exposureTierFromImpact, formatMoney };
