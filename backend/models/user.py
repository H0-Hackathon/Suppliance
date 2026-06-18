"""
CoastGuard — User model for authentication.

Users are authenticated entirely via Clerk.
"""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Credentials
    clerk_id = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(50), nullable=True) # Optional since Clerk handles it, but good to store
    email = Column(String(255), nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
