/** Shared agent output types used by the globe and dashboard. */

export interface TariffMonitorOutput {
  risk_detected?: boolean;
  event?: string;
  event_type?: string | null;
  country?: string | null;
  product?: string | null;
  tariff_rate?: number | null;
  severity?: string | null;
  confidence?: number | null;
  source?: string | null;
  source_url?: string | null;
  summary?: string | null;
}

export interface ImpactCalculatorOutput {
  affected?: boolean;
  direct_cost?: number | null;
  extra_cost_usd?: number | null;
  exposure_score?: number | null;
  risk_score?: number | null;
  severity?: string | null;
  affected_orders?: number | null;
  eta_risk?: string | null;
  supplier_dependency?: number | null;
  reasons?: string[];
}

export type AgentResults = Record<string, Record<string, unknown> | undefined>;
export type AgentStatusMap = Record<string, 'running' | 'done'>;

export const AGENT_CHAIN = [
  'tariff_monitor',
  'impact_calculator',
  'alternatives_finder',
  'import_compliance',
  'adversarial',
] as const;

export type AgentKey = (typeof AGENT_CHAIN)[number];
