import type { AgentResults, AgentStatusMap } from '../types/agents';

export type VisualizationMode =
  | 'executive'
  | 'supply_chain'
  | 'ai_reasoning'
  | 'risk_heatmap';

export type NodeStatus =
  | 'impacted'
  | 'healthy'
  | 'alternative'
  | 'customer'
  | 'recommended'
  | 'rejected';

export type RouteStatus =
  | 'impacted'
  | 'healthy'
  | 'alternative'
  | 'recommended'
  | 'rejected'
  | 'warning';

export type ComplianceRisk = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface ResolvedCoords {
  country: string;
  code: string | null;
  latitude: number;
  longitude: number;
  location_name?: string;
}

export interface GlobeNode {
  id: string;
  name: string;
  country: string;
  countryCode: string | null;
  lat: number;
  lng: number;
  status: NodeStatus;
  riskScore: number;
  exposure: string;
  exposureTier: 1 | 2 | 3;
  complianceRisk: ComplianceRisk | null;
  isActiveRisk: boolean;
  isSelected: boolean;
  isRejected: boolean;
  rank: number | null;
  savingsPct: number | null;
  leadTimeWeeks: number | null;
  opacity: number;
  pointType: 'supplier';
  tooltipLines: string[];
}

export interface GlobeArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  routeStatus: RouteStatus;
  exposureTier: 1 | 2 | 3;
  opacity: number;
  animated: boolean;
  isWinner: boolean;
  tooltip: string;
}

export interface GlobePulse {
  lat: number;
  lng: number;
  routeStatus: RouteStatus;
  exposureTier: 1 | 2 | 3;
  opacity: number;
  pointType: 'pulse';
}

export interface RiskRing {
  lat: number;
  lng: number;
  radius: number;
  intensity: number;
  color: string;
}

export interface GlobeViewModel {
  nodes: GlobeNode[];
  arcs: GlobeArc[];
  pulses: GlobePulse[];
  riskRings: RiskRing[];
  focusPoint: { lat: number; lng: number; altitude: number } | null;
  bannerText: string;
  activeAgent: string | null;
  reasoningStep: number;
}

export interface GlobeViewModelInput {
  suppliers: Array<{
    name: string;
    country: string;
    countryCode: string | null;
    latitude: number;
    longitude: number;
  }>;
  disruptions: Array<{
    title: string;
    severity: string | null;
    countries_affected?: string[] | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;
  agentResults: AgentResults;
  agentStatus: AgentStatusMap;
  alternativeCoords: Record<string, ResolvedCoords>;
  visualizationMode: VisualizationMode;
  activeLayers: Set<string>;
  destination?: { name: string; country: string; lat: number; lng: number };
  supplierCountry?: string | null;
}

export type { AgentResults, AgentStatusMap };
