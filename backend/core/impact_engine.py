"""
CoastGuard — Impact Engine (Agent 2, V1).

Deterministic financial-impact calculations. No LLM call, no prediction —
every number here is computed from a formula applied to real order data and
the structured event produced by core/monitor_agent.py (Agent 1).

Responsibilities (see services/impact_service.py for the Aurora-querying
wrapper that calls these):
  - direct_cost        Agent 2 V1 — exact dollar cost of the tariff on an order
  - exposure_score     Agent 2 V1 — how exposed an order is to the event (0-100)
  - risk_score         Agent 2 V1 — dollar-scaled risk magnitude (0-100)
  - classify_severity  Agent 2 V1 — low/medium/high/critical from tariff_rate
  - eta_risk           Ticket 3   — critical/high/medium from delivery ETA
  - supplier_dependency  Ticket 4 — fraction of spend concentrated in one country
"""

from typing import Optional


class ImpactEngine:
    """Pure functions — no DB access, no network calls."""

    @staticmethod
    def direct_cost(order_value: float, tariff_rate: Optional[float]) -> float:
        """Direct Cost = order_value x (tariff_rate / 100)."""
        if not tariff_rate or order_value <= 0:
            return 0.0
        return round(order_value * (tariff_rate / 100.0), 2)

    @staticmethod
    def exposure_score(tariff_rate: Optional[float], country_match: bool, product_match: bool) -> float:
        """
        How exposed is this order to the detected event, on a 0-100 scale:
          - no tariff_rate                    -> 0   (no event to be exposed to)
          - country AND product both match    -> 100 (fully exposed)
          - only one of country/product match -> 50  (partially exposed)
          - neither matches                   -> 0
        """
        if not tariff_rate:
            return 0.0
        if country_match and product_match:
            return 100.0
        if country_match or product_match:
            return 50.0
        return 0.0

    @staticmethod
    def risk_score(direct_cost: float) -> float:
        """Dollar-scaled risk magnitude: $1,000 of direct cost = 1 risk point, capped at 100."""
        return round(min(direct_cost / 1000.0, 100.0), 2)

    @staticmethod
    def classify_severity(tariff_rate: Optional[float], eta_risk: Optional[str] = None) -> str:
        """
        severity from the tariff rate itself (the "% increase"):
          <5%  -> low
          5-20% -> medium
          >20% -> high
        Escalated to "critical" if the ETA is also critical (order can't be
        rerouted in time even before accounting for cost).
        """
        if tariff_rate is None:
            severity = "low"
        elif tariff_rate > 20:
            severity = "high"
        elif tariff_rate >= 5:
            severity = "medium"
        else:
            severity = "low"

        if eta_risk == "critical" and severity in ("medium", "high"):
            return "critical"
        return severity

    @staticmethod
    def eta_risk(eta_days: Optional[int]) -> str:
        """
        Ticket 3 — ETA risk from days until expected delivery:
          <= 14 days -> critical (no time to reroute)
          <= 30 days -> high
          otherwise  -> medium
        """
        if eta_days is None:
            return "unknown"
        if eta_days <= 14:
            return "critical"
        if eta_days <= 30:
            return "high"
        return "medium"

    @staticmethod
    def supplier_dependency(supplier_spend: float, total_spend: float) -> float:
        """
        Ticket 4 — fraction of total pending-order spend concentrated with
        suppliers in the affected country. 0.82 means 82% of this customer's
        pending order value is exposed to this one country.
        """
        if total_spend <= 0:
            return 0.0
        return round(supplier_spend / total_spend, 2)
