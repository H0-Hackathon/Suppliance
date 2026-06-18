"""
CoastGuard — Auth utilities.

Provides:
  - FastAPI dependency `get_current_user` using clerk-backend-api
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from clerk_backend_api import Clerk

from config import get_settings
from database import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer()

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency that verifies the Clerk JWT and returns the User row.
    Raises 401 if the token is invalid / expired / user not found.
    """
    from models.user import User

    if not settings.clerk_secret_key:
        # In case we're developing without Clerk config, you might want to bypass
        # or raise a specific error.
        raise HTTPException(status_code=500, detail="Clerk secret key not configured")

    sdk = Clerk(bearer_auth=settings.clerk_secret_key)
    
    # Authenticate the request
    try:
        request_state = sdk.authenticate_request(request)
    except Exception as e:
        logger.error(f"Clerk authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not signed in",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clerk_id = request_state.payload.get("sub")
    if clerk_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Fetch user from local DB, lazily create if they don't exist
    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    
    if user is None:
        user = User(clerk_id=clerk_id)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Lazily created new user for clerk_id: {clerk_id}")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
        
    return user
