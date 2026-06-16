"""
CoastGuard — TariffAlert CRUD routes.

Endpoints:
  GET /api/v2/alerts              list alerts for a customer
  GET /api/v2/alerts/{id}         get single alert
  PUT /api/v2/alerts/{id}/dismiss mark alert dismissed
  PUT /api/v2/alerts/{id}/resolve mark alert resolved
"""

import json
import logging
import pathlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import TariffAlert
from schemas import TariffAlertResponse

router = APIRouter(prefix="/api/v2", tags=["Alerts"])
logger = logging.getLogger(__name__)

# TEMPORARY: JSON fallback used when the DB is unavailable (SQLite schema mismatch
# or Aurora not yet connected). Remove once the real DB is working.
_SAMPLE_DATA_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "data" / "sample_data.json"


def _load_sample_alerts(customer_id: int) -> list:
    try:
        data = json.loads(_SAMPLE_DATA_PATH.read_text())
        return [a for a in data["alerts"] if a["customer_id"] == customer_id]
    except Exception as exc:
        logger.error("Failed to load sample_data.json: %s", exc)
        return []


@router.get("/alerts", response_model=List[TariffAlertResponse])
def list_alerts(customer_id: int, db: Session = Depends(get_db)):
    try:
        return (
            db.query(TariffAlert)
            .filter(TariffAlert.customer_id == customer_id)
            .order_by(TariffAlert.created_at.desc())
            .all()
        )
    except Exception as exc:
        # TEMPORARY: DB unavailable — serve sample data so the dashboard loads.
        # Remove this fallback once Aurora is reconnected or SQLite schema is stable.
        logger.warning("DB query failed for /alerts, serving sample_data.json: %s", exc)
        return JSONResponse(content=_load_sample_alerts(customer_id))


@router.get("/alerts/{alert_id}", response_model=TariffAlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(TariffAlert).filter(TariffAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.put("/alerts/{alert_id}/dismiss", response_model=TariffAlertResponse)
def dismiss_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(TariffAlert).filter(TariffAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "dismissed"
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/alerts/{alert_id}/resolve", response_model=TariffAlertResponse)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(TariffAlert).filter(TariffAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
