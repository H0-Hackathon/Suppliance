"""
CoastGuard — Auth utilities.

Provides:
  - get_current_user      — FastAPI dependency: validates Clerk JWT → Customer row
  - get_current_user_optional — like get_current_user but returns None instead of raising
  - get_subscribed_user   — like get_current_user but also checks subscription/trial status
"""
from __future__ import annotations
from datetime import datetime

import logging
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer(auto_error=True)
security_optional = HTTPBearer(auto_error=False)

CLERK_ISSUER = settings.clerk_issuer_url

# Cache JWKS clients per issuer so the JWKS endpoint is only fetched ONCE
# on first use, then reused for every subsequent request. Without this, every
# request makes an outbound HTTPS call to Clerk which can cause 10-30s hangs.
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(issuer: str) -> PyJWKClient:
    """Return a cached PyJWKClient for the given Clerk issuer URL."""
    if issuer not in _jwks_clients:
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        # cache_keys=True + lifespan=3600 mean keys are refreshed hourly
        _jwks_clients[issuer] = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        logger.info("JWKS client created for issuer: %s", issuer)
    return _jwks_clients[issuer]


def _decode_clerk_token(token: str) -> dict:
    """
    Decode and verify a Clerk JWT using their cached public JWKS.
    First call per issuer fetches JWKS; subsequent calls are instant.
    """
    try:
        # 1. Decode header/payload unverified to get the issuer
        unverified = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified.get("iss")

        if not issuer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Token missing issuer.")

        if CLERK_ISSUER and issuer != CLERK_ISSUER:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token issuer.")

        # 2. Get cached (or fetch on first call) signing key
        client = _get_jwks_client(issuer)
        signing_key = client.get_signing_key_from_jwt(token)

        # 3. Full signature verification
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
        return payload

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError as e:
        logger.warning("JWT invalid: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid authentication token.")
    except Exception as e:
        logger.error("Token decode error: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not verify token.")


def _fast_clerk_id(token: str) -> str | None:
    """
    Extract the Clerk user ID (sub) from a JWT WITHOUT signature verification.
    Use only in signup/onboarding flows where Clerk has already verified the user
    on the frontend and we just need the identifier to create the DB record.
    """
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Validates Clerk JWT (full JWKS verification) and returns the Customer row."""
    from models import Customer

    payload = _decode_clerk_token(credentials.credentials)

    clerk_user_id = payload.get("sub")
    email = payload.get("email")

    customer = None
    if clerk_user_id:
        customer = db.query(Customer).filter(Customer.clerk_id == clerk_user_id).first()

    if not customer and email:
        customer = db.query(Customer).filter(Customer.email == email).first()
        if customer:
            customer.clerk_id = clerk_user_id
            db.commit()

    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="User not found. Please complete onboarding.")

    if not getattr(customer, "is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is deactivated.")

    return customer


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
):
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def get_subscribed_user(customer=Depends(get_current_user)):
    """
    Like get_current_user but additionally checks subscription/trial status.
    Returns 402 if trial has expired and no active subscription exists.
    """
    now = datetime.utcnow()

    if customer.subscription_plan and (
        customer.subscription_expires_at is None
        or customer.subscription_expires_at > now
    ):
        return customer

    if customer.trial_expires_at and customer.trial_expires_at > now:
        return customer

    raise HTTPException(
        status_code=402,
        detail="subscription_required",
        headers={"X-Subscription-Status": "expired"},
    )
