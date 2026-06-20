"""
CoastGuard — Disruption event routes.

Endpoints:
  GET /api/v2/disruptions   list structured risk events for the supplier globe

Disruption events are only ever created as a side effect of the monitor pipeline
(core/crew_monitor_pipeline.py MonitorPipeline._save_results) — there's no
create/update/delete API for them.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import DisruptionEvent, TariffAlert
from schemas import DisruptionEventResponse

router = APIRouter(prefix="/api/v2", tags=["Disruptions"])
logger = logging.getLogger(__name__)


@router.get("/disruptions", response_model=List[DisruptionEventResponse])
def list_disruptions(customer_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    List disruption events for the supplier globe.

    If customer_id is provided, only events linked to that customer's
    TariffAlerts are returned (via the TariffAlert.disruption_event_id
    relationship). Without customer_id, returns the most recent events
    across all customers.
    """
    try:
        query = db.query(DisruptionEvent)

        if customer_id is not None:
            query = (
                query.join(TariffAlert, TariffAlert.disruption_event_id == DisruptionEvent.id)
                .filter(TariffAlert.customer_id == customer_id)
            )

        return query.order_by(DisruptionEvent.detected_at.desc()).limit(50).all()
    except Exception as exc:
        logger.error("DB query failed for /disruptions: %s", exc)
        return []