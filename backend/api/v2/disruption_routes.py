"""
CoastGuard — Disruption event routes.

Endpoints:
  GET /api/v2/disruptions   list structured risk events for the supplier globe

This is intentionally a tiny read-only router. Disruption events are only
ever created as a side effect of the monitor pipeline
(core/crew_monitor_pipeline.py MonitorPipeline._save_results) — there's no
create/update/delete API for them.
"""

import json
import logging
import pathlib
from typing import List, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import DisruptionEvent, TariffAlert, Customer
from schemas import DisruptionEventResponse
from core.auth import get_current_user

router = APIRouter(prefix="/api/v2", tags=["Disruptions"])
logger = logging.getLogger(__name__)

# TEMPORARY: JSON fallback used when the DB is unavailable (SQLite schema mismatch
# or Aurora not yet connected). Remove once the real DB is working.
_SAMPLE_DATA_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "data" / "sample_data.json"


def _load_sample_disruptions() -> list:
    try:
        data = json.loads(_SAMPLE_DATA_PATH.read_text())
        return data["disruptions"]
    except Exception as exc:
        logger.error("Failed to load sample_data.json: %s", exc)
        return []


@router.get("/disruptions", response_model=List[DisruptionEventResponse])
def list_disruptions(customer_id: Optional[int] = None, db: Session = Depends(get_db), current_customer: Customer = Depends(get_current_user)):
    """
    List disruption events for the supplier globe for the authenticated customer.
    """
    try:
        query = db.query(DisruptionEvent)

        query = (
            query.join(TariffAlert, TariffAlert.disruption_event_id == DisruptionEvent.id)
            .filter(TariffAlert.customer_id == current_customer.id)
        )

        return query.order_by(DisruptionEvent.detected_at.desc()).limit(50).all()
    except Exception as exc:
        # TEMPORARY: DB unavailable — serve sample data so the globe has points to render.
        # Remove this fallback once Aurora is reconnected or SQLite schema is stable.
        logger.warning("DB query failed for /disruptions, serving sample_data.json: %s", exc)
        return JSONResponse(content=_load_sample_disruptions())
