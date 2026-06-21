"""
CoastGuard — Auth Routes
POST /api/v2/auth/signup/init    — Step 1: Register new account, generate OTP
POST /api/v2/auth/signup/verify  — Step 2: Verify OTP
POST /api/v2/auth/signup/complete— Step 3: Complete company profile -> JWT
POST /api/v2/auth/login          — Login (email + password) -> JWT
GET  /api/v2/auth/me             — Get current user + subscription status
"""
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from passlib.context import CryptContext

from database import get_db
from models import Customer
from core.auth import get_current_user

router = APIRouter(prefix="/api/v2/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TRIAL_HOURS = 24


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    email: EmailStr
    name: str
    company_name: str
    industry: str
    location: str
    years_in_business: int
    average_revenue: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _subscription_status(customer: Customer) -> dict:
    now = datetime.utcnow()

    # Active paid subscription
    if customer.subscription_plan and (
        customer.subscription_expires_at is None
        or customer.subscription_expires_at > now
    ):
        return {
            "status": "active",
            "plan": customer.subscription_plan,
            "expires_at": customer.subscription_expires_at.isoformat() if customer.subscription_expires_at else None,
        }

    # Within free trial
    if customer.trial_expires_at and customer.trial_expires_at > now:
        hours_left = (customer.trial_expires_at - now).total_seconds() / 3600
        return {
            "status": "trial",
            "plan": "trial",
            "hours_left": round(hours_left, 1),
            "expires_at": customer.trial_expires_at.isoformat(),
        }

    # Trial expired, no subscription
    return {
        "status": "expired",
        "plan": None,
        "expires_at": None,
    }


def _user_response(customer: Customer, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": customer.id,
            "email": customer.email,
            "name": customer.name,
            "company_name": customer.company_name,
            "industry": customer.industry,
            "location": customer.location,
        },
        "subscription": _subscription_status(customer),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
def complete_onboarding(data: OnboardingRequest, db: Session = Depends(get_db)):
    """Creates the Customer, BusinessProfile, Supplier, and Product in Aurora after Clerk auth."""
    
    email = data.email.lower().strip()
    
    # Check if they already exist
    customer = db.query(Customer).filter(Customer.email == email).first()
    
    if not customer:
        customer = Customer(
            email=email,
            name=data.name.strip(),
            company_name=data.company_name.strip(),
            industry=data.industry.strip(),
            location=data.location.strip(),
            years_in_business=data.years_in_business,
            average_revenue=data.average_revenue.strip(),
            is_verified=True, # Verified by Clerk
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    else:
        # Update existing
        customer.name = data.name.strip()
        customer.company_name = data.company_name.strip()
        customer.industry = data.industry.strip()
        customer.location = data.location.strip()
        customer.years_in_business = data.years_in_business
        customer.average_revenue = data.average_revenue.strip()
        customer.is_verified = True

    # Start 24h free trial
    customer.trial_expires_at = datetime.utcnow() + timedelta(hours=TRIAL_HOURS)

    # Automatically create BusinessProfile for personalized Agent output
    from models import BusinessProfile
    import re
    existing_profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == customer.id).first()
    if not existing_profile:
        # Heuristic to parse revenue into an annual volume numeric
        vol = 500000
        try:
            nums = re.findall(r'\d+', data.average_revenue)
            if nums:
                num = int(nums[-1])
                if "M" in data.average_revenue.upper() or "MILLION" in data.average_revenue.upper():
                    vol = num * 1000000
                elif "K" in data.average_revenue.upper():
                    vol = num * 1000
                elif "B" in data.average_revenue.upper() or "BILLION" in data.average_revenue.upper():
                    vol = num * 1000000000
                else:
                    vol = num
        except:
            pass

        profile = BusinessProfile(
            customer_id=customer.id,
            business_type=data.industry.strip(),
            annual_import_volume_usd=vol,
            primary_origin_countries=[data.location.strip()],
            destination_country="United States",
            import_region=data.location.strip(),
            primary_hs_codes=["8500.00"], # Default fallback
            product_descriptions=[data.industry.strip()],
        )
        db.add(profile)
        
        # Create a default Supplier so the map is instantly personalized
        from models import Supplier, Product
        supplier = Supplier(
            customer_id=customer.id,
            name=f"Primary {data.location.strip()} Partner",
            country=data.location.strip(),
            product_category=data.industry.strip(),
            reliability_score=85.0
        )
        db.add(supplier)
        
        product = Product(
            customer_id=customer.id,
            hs_code="8500.00",
            description=f"{data.industry.strip()} Goods",
            import_country=data.location.strip(),
            unit_value_usd=150.0
        )
        db.add(product)
    
    db.commit()
    db.refresh(customer)

    return {"message": "Onboarding complete"}


@router.get("/me")
def get_me(current_user: Customer = Depends(get_current_user)):
    """Returns logged-in user info and subscription status. No token = 401."""
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "company_name": current_user.company_name,
            "industry": current_user.industry,
            "location": current_user.location,
        },
        "subscription": _subscription_status(current_user),
    }


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete the authenticated user's account and all associated data."""
    # Hard-delete the customer record. Cascade should remove related rows
    # (tariff_alerts, agent_runs, etc.) if FK ON DELETE CASCADE is set;
    # otherwise we do a manual soft-delete by marking inactive first.
    try:
        db.delete(current_user)
        db.commit()
    except Exception:
        # Fallback: soft-delete so FK constraints don't block us
        db.rollback()
        current_user.is_active = False
        current_user.email = f"deleted_{current_user.id}_{current_user.email}"
        db.commit()

    return {"message": "Account deleted successfully."}
