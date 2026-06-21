"""
CoastGuard — TariffAlert CRUD routes.

Endpoints:
  GET /api/v2/alerts              list alerts for the active customer (max 10, newest first)
  GET /api/v2/alerts/{id}         get single alert
  PUT /api/v2/alerts/{id}/dismiss mark alert dismissed
  PUT /api/v2/alerts/{id}/resolve mark alert resolved
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import TariffAlert
from schemas import TariffAlertResponse
from config import get_settings

router = APIRouter(prefix="/api/v2", tags=["Alerts"])
settings = get_settings()

ALERT_DISPLAY_CAP = 10


@router.get("/alerts", response_model=List[TariffAlertResponse])
def list_alerts(customer_id: int = None, db: Session = Depends(get_db)):
    """
    Returns the most recent alerts for the active customer, capped at 10.
    customer_id param is optional — defaults to ACTIVE_CUSTOMER_ID from config.
    Once Clerk auth is wired, this will use the auth token instead.
    """
    cid = customer_id or settings.active_customer_id
    return (
        db.query(TariffAlert)
        .filter(TariffAlert.customer_id == cid)
        .order_by(TariffAlert.created_at.desc())
        .limit(ALERT_DISPLAY_CAP)
        .all()
    )


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
