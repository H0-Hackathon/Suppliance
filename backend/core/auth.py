"""
CoastGuard — Auth utilities.

Provides:
  - create_access_token   — issues a signed HS256 JWT
  - get_current_user      — FastAPI dependency: validates JWT → Customer row
  - get_subscribed_user   — like get_current_user but also checks subscription/trial status
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from database import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=True)

# ── JWT config ────────────────────────────────────────────────────────────────
SECRET_KEY = "COASTGUARD_SUPER_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> str:
    """Decode JWT and return the email (sub claim). Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Validates JWT and returns the Customer row. Does NOT check subscription."""
    from models import Customer

    email = _decode_token(credentials.credentials)

    customer = db.query(Customer).filter(Customer.email == email).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    if not customer.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")

    return customer


def get_subscribed_user(
    customer=Depends(get_current_user),
):
    """
    Like get_current_user but additionally checks subscription/trial status.
    Returns 402 if trial has expired and no active subscription exists.
    Use this dependency on dashboard routes that should be gated.
    """
    now = datetime.utcnow()

    # Active paid subscription (no expiry = lifetime)
    if customer.subscription_plan and (
        customer.subscription_expires_at is None
        or customer.subscription_expires_at > now
    ):
        return customer

    # Within free trial
    if customer.trial_expires_at and customer.trial_expires_at > now:
        return customer

    # No active access
    raise HTTPException(
        status_code=402,
        detail="subscription_required",
        headers={"X-Subscription-Status": "expired"},
    )
