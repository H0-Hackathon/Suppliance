"""
CoastGuard — Auth utilities.

Provides:
  - get_current_user      — FastAPI dependency: validates Clerk JWT → Customer row
  - get_subscribed_user   — like get_current_user but also checks subscription/trial status
"""
from __future__ import annotations
from datetime import datetime

import os
import jwt
import logging
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=True)

# ── Clerk JWT config ──────────────────────────────────────────────────────────
# Optional: if you want to strictly enforce the issuer.
CLERK_ISSUER = os.getenv("CLERK_ISSUER")

def _decode_clerk_token(token: str) -> dict:
    """Decode and verify Clerk JWT using their public JWKS."""
    try:
        # 1. Decode unverified to get the issuer (so we know where to fetch the JWKS)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified_payload.get("iss")
        
        if not issuer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing issuer")
            
        if CLERK_ISSUER and issuer != CLERK_ISSUER:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid issuer")

        # 2. Fetch the public key from Clerk's JWKS endpoint
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 3. Verify the token signature
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.getenv("CLERK_AUDIENCE"), # usually optional or matches front-end URL
            issuer=issuer,
            options={"verify_aud": False} # skip audience check if not configured
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT Verification failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")
    except Exception as e:
        logger.error(f"Error decoding token: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify token.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Validates Clerk JWT and returns the Customer row."""
    from models import Customer

    payload = _decode_clerk_token(credentials.credentials)
    
    # Clerk tokens usually contain primary email or clerk user ID (sub).
    # You can configure Clerk to include emails in the JWT via session claims,
    # or just use the `sub` (Clerk User ID) to look up the Customer.
    # We will try email first (if added via session claims), then sub.
    # Note: If the user hasn't completed onboarding, they won't exist in our DB yet.
    
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. Please complete onboarding.")
    
    if not getattr(customer, 'is_active', True):
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
