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
from models import Customer, TariffAlert
from schemas import TariffAlertResponse
from core.auth import get_current_user

router = APIRouter(prefix="/api/v2", tags=["Alerts"])

ALERT_DISPLAY_CAP = 20


def _owned_alert(alert_id: int, current_user: Customer, db: Session) -> TariffAlert:
    alert = (
        db.query(TariffAlert)
        .filter(TariffAlert.id == alert_id, TariffAlert.customer_id == current_user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/alerts", response_model=List[TariffAlertResponse])
def list_alerts(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the most recent alerts for the authenticated customer, capped at ALERT_DISPLAY_CAP."""
    return (
        db.query(TariffAlert)
        .filter(TariffAlert.customer_id == current_user.id)
        .order_by(TariffAlert.created_at.desc())
        .limit(ALERT_DISPLAY_CAP)
        .all()
    )


@router.get("/alerts/{alert_id}", response_model=TariffAlertResponse)
def get_alert(
    alert_id: int,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _owned_alert(alert_id, current_user, db)


@router.put("/alerts/{alert_id}/dismiss", response_model=TariffAlertResponse)
def dismiss_alert(
    alert_id: int,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _owned_alert(alert_id, current_user, db)
    alert.status = "dismissed"
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/alerts/{alert_id}/resolve", response_model=TariffAlertResponse)
def resolve_alert(
    alert_id: int,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _owned_alert(alert_id, current_user, db)
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
