"""
CoastGuard — Background scheduler.

Runs the 5-agent monitor pipeline automatically on a fixed interval, instead
of only when someone clicks "Run Monitor" in the UI.

Disabled by default (ENABLE_SCHEDULER=false) — for a hackathon demo you want
deterministic, judge-triggered runs via the "Run Monitor" button, not a
background job firing at an unpredictable moment mid-demo. Flip it on in
.env once everything else is working and you want to show "this runs
automatically every N hours" as a talking point.
"""

import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from config import get_settings
from core.crew_orchestrator import CrewAIOrchestrator
from database import SessionLocal

logger = logging.getLogger(__name__)
settings = get_settings()

_scheduler: Optional[BackgroundScheduler] = None


def run_monitor_for_all_customers() -> None:
    """
    Re-run the monitor pipeline for every (customer, product HS code,
    supplier country) combination that shows up in that customer's pending
    or in-transit orders.

    Each combination is monitored at most once per call — if a customer has
    three pending orders all sourced from the same Vietnamese supplier with
    the same HS code, that's a single monitor run, not three.
    """
    from models import Customer, ImportOrder

    db = SessionLocal()
    try:
        orchestrator = CrewAIOrchestrator()

        for customer in db.query(Customer).all():
            orders = (
                db.query(ImportOrder)
                .filter(
                    ImportOrder.customer_id == customer.id,
                    ImportOrder.status.in_(["pending", "in_transit"]),
                )
                .all()
            )

            seen_combos = set()
            for order in orders:
                if not order.product or not order.supplier:
                    continue
                combo = (order.product.hs_code, order.supplier.country)
                if combo in seen_combos:
                    continue
                seen_combos.add(combo)

                hs_code, supplier_country = combo
                logger.info(
                    "Scheduled monitor run: customer_id=%s hs_code=%s country=%s",
                    customer.id, hs_code, supplier_country,
                )
                try:
                    orchestrator.run_monitor(
                        customer_id=customer.id,
                        hs_code=hs_code,
                        supplier_country=supplier_country,
                        db=db,
                    )
                except Exception as exc:
                    logger.error("Scheduled monitor run failed: %s", exc)
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the background scheduler if ENABLE_SCHEDULER=true. No-op otherwise."""
    global _scheduler

    if not settings.enable_scheduler:
        logger.info("Scheduler disabled (ENABLE_SCHEDULER=false)")
        return

    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        run_monitor_for_all_customers,
        "interval",
        hours=settings.scheduler_interval_hours,
        id="monitor_all_customers",
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — monitor pipeline runs every %d hour(s)",
        settings.scheduler_interval_hours,
    )


def stop_scheduler() -> None:
    """Stop the background scheduler if it's running. No-op otherwise."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown()
        logger.info("Scheduler stopped")
    _scheduler = None
