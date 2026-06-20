"""
CoastGuard — Auth utilities.

Provides:
  - FastAPI dependency `get_current_user` using Auth0
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWKClient

from config import get_settings
from database import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency that verifies the Auth0 JWT and returns the Customer row.
    """
    from models import Customer

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Verify Auth0 JWT ──────────────────────────────────────────────────
    token = credentials.credentials

    jwks_url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    jwks_client = PyJWKClient(jwks_url)

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=settings.auth0_algorithms,
            audience=settings.auth0_api_audience,
            issuer=f"https://{settings.auth0_domain}/"
        )
    except jwt.exceptions.PyJWKClientError as error:
        logger.warning(f"Auth0 JWKS error: {error}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    except jwt.exceptions.DecodeError as error:
        logger.warning(f"Auth0 Decode error: {error}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    except jwt.exceptions.ExpiredSignatureError:
        logger.warning("Auth0 token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except Exception as e:
        logger.warning(f"Auth0 generic error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    auth0_id = payload.get("sub")
    if not auth0_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Fetch customer from local DB
    customer = db.query(Customer).filter(Customer.auth0_id == auth0_id).first()

    if not customer:
        email = payload.get("email", "demo@example.com")
        name = payload.get("name", "Demo User")
        
        # Map the first real Auth0 user to the pre-seeded Customer 1
        # so they instantly see a populated dashboard with the demo data.
        seeded_customer = (
            db.query(Customer)
            .filter(Customer.id == settings.active_customer_id)
            .first()
        )
        if seeded_customer and (
            seeded_customer.auth0_id.startswith("auth0|mock")
            or seeded_customer.auth0_id == "seed"
        ):
            logger.info(
                f"Mapping new auth0_id {auth0_id} to pre-seeded "
                f"Customer {seeded_customer.id}"
            )
            seeded_customer.auth0_id = auth0_id
            if email: seeded_customer.email = email
            if name: seeded_customer.name = name
            db.commit()
            db.refresh(seeded_customer)
            customer = seeded_customer
        else:
            # Lazy create customer on subsequent logins
            customer = Customer(
                auth0_id=auth0_id,
                name=name,
                email=email,
                company_name="Acme Corp",
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
            logger.info(f"Lazily created new customer for auth0_id: {auth0_id}")

    if not customer.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    return customer
