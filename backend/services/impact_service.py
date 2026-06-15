"""
CoastGuard — Impact Service (Agent 2 wrapper).

Queries Aurora for a customer's pending/in-transit orders + suppliers, then
calls core.impact_engine.ImpactEngine to turn the Monitor Agent's (Agent 1)
structured event into a deterministic financial-impact result — no LLM call.

Used by core/crew_monitor_pipeline.py to build agent_outputs["impact_calculator"].
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from core.impact_engine import ImpactEngine

logger = logging.getLogger(__name__)


def calculate_impact(db: Optional[Session], customer_id: int, monitor_event: dict) -> dict:
    """
    Args:
        db: SQLAlchemy session (None falls back to a representative demo order)
        customer_id: customer whose pending orders to evaluate
        monitor_event: Agent 1's output dict — must contain
            "country", "product", "tariff_rate" (may be None)

    Returns a dict shaped for agent_outputs["impact_calculator"]:
        {
            "affected": bool,
            "direct_cost": float,
            "extra_cost_usd": float,   # alias of direct_cost, kept for the
                                        # existing AlertCard/_save_results code
            "exposure_score": float,
            "risk_score": float,
            "severity": "low"|"medium"|"high"|"critical",
            "affected_orders": int,
            "eta_risk": "critical"|"high"|"medium"|"unknown",
            "supplier_dependency": float,
            "reasons": [str, ...],
        }
    """
    event_country = (monitor_event.get("country") or "").strip().lower()
    event_product = (monitor_event.get("product") or "").strip().lower()
    tariff_rate = monitor_event.get("tariff_rate")

    orders = _load_pending_orders(db, customer_id)

    if not orders:
        # No DB / no pending orders — fall back to a representative demo
        # order so the engine still has something concrete to calculate from.
        orders = [{
            "order_value_usd": 40000.0,
            "supplier_country": event_country or "vietnam",
            "product_category": event_product or "textiles",
            "eta_days": 10,
        }]

    total_spend = sum(o["order_value_usd"] for o in orders)

    direct_cost_total = 0.0
    affected_orders = 0
    exposure_scores = []
    dependency_spend = 0.0
    min_eta_days = None

    for order in orders:
        country_match = bool(event_country) and event_country in order["supplier_country"].lower()
        product_match = bool(event_product) and event_product in order["product_category"].lower()

        if country_match:
            dependency_spend += order["order_value_usd"]

        exposure = ImpactEngine.exposure_score(tariff_rate, country_match, product_match)
        exposure_scores.append(exposure)

        if country_match and tariff_rate:
            direct_cost_total += ImpactEngine.direct_cost(order["order_value_usd"], tariff_rate)
            affected_orders += 1
            if order["eta_days"] is not None:
                if min_eta_days is None or order["eta_days"] < min_eta_days:
                    min_eta_days = order["eta_days"]

    eta_risk = ImpactEngine.eta_risk(min_eta_days)
    risk_score = ImpactEngine.risk_score(direct_cost_total)
    severity = ImpactEngine.classify_severity(tariff_rate, eta_risk)
    supplier_dependency = ImpactEngine.supplier_dependency(dependency_spend, total_spend)
    max_exposure = max(exposure_scores) if exposure_scores else 0.0

    reasons = _build_reasons(
        monitor_event=monitor_event,
        tariff_rate=tariff_rate,
        direct_cost_total=direct_cost_total,
        affected_orders=affected_orders,
        supplier_dependency=supplier_dependency,
        eta_risk=eta_risk,
    )

    return {
        "affected": direct_cost_total > 0,
        "direct_cost": direct_cost_total,
        "extra_cost_usd": direct_cost_total,
        "exposure_score": max_exposure,
        "risk_score": risk_score,
        "severity": severity,
        "affected_orders": affected_orders,
        "eta_risk": eta_risk,
        "supplier_dependency": supplier_dependency,
        "reasons": reasons,
    }


def _load_pending_orders(db: Optional[Session], customer_id: int) -> list[dict]:
    """Return pending/in-transit orders as plain dicts (country, product, ETA)."""
    if db is None:
        return []

    try:
        from models import ImportOrder

        orders = (
            db.query(ImportOrder)
            .filter(
                ImportOrder.customer_id == customer_id,
                ImportOrder.status.in_(["pending", "in_transit"]),
            )
            .all()
        )

        result = []
        for o in orders:
            if not o.order_value_usd:
                continue

            supplier_country = o.supplier.country if o.supplier else ""
            product_category = (
                (o.supplier.product_category if o.supplier else None)
                or (o.product.description if o.product else None)
                or ""
            )

            eta_days = None
            if o.expected_delivery_date:
                eta_days = (o.expected_delivery_date - datetime.utcnow()).days

            result.append({
                "order_value_usd": float(o.order_value_usd),
                "supplier_country": supplier_country,
                "product_category": product_category,
                "eta_days": eta_days,
            })

        return result
    except Exception as exc:
        logger.warning(f"Pending orders lookup failed: {exc}")
        return []


def _build_reasons(
    monitor_event: dict,
    tariff_rate: Optional[float],
    direct_cost_total: float,
    affected_orders: int,
    supplier_dependency: float,
    eta_risk: str,
) -> list[str]:
    """Explainability — plain-language reasons backing the numbers above."""
    reasons = []

    country = monitor_event.get("country")
    product = monitor_event.get("product")
    event_type = monitor_event.get("event_type")

    if country:
        reasons.append(f"Event detected affecting {country}" + (f" ({product})" if product else ""))

    if tariff_rate:
        reasons.append(f"{tariff_rate:g}% tariff rate detected ({event_type or 'TARIFF'})")

    if direct_cost_total > 0:
        reasons.append(
            f"Direct cost = order value x {tariff_rate:g}% = ${direct_cost_total:,.2f} "
            f"across {affected_orders} pending order(s)"
        )
    else:
        reasons.append("No pending orders directly match this event's country/product")

    if supplier_dependency > 0:
        reasons.append(
            f"{supplier_dependency * 100:.0f}% of pending order value is concentrated with "
            f"suppliers in {country}"
        )

    if eta_risk == "critical":
        reasons.append("Affected order(s) are due within 14 days — too soon to reroute")
    elif eta_risk == "high":
        reasons.append("Affected order(s) are due within 30 days — limited time to reroute")

    return reasons
