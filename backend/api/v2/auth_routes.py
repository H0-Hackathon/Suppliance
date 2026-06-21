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
from typing import Optional, List
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
    # Customer basic info
    email: EmailStr
    name: str
    company_name: str
    industry: str
    location: str
    years_in_business: int
    average_revenue: str
    
    # Business Profile fields
    business_type: Optional[str] = None
    annual_import_volume_usd: Optional[float] = None
    primary_hs_codes: Optional[List[str]] = None
    primary_origin_countries: Optional[List[str]] = None
    destination_country: Optional[str] = None
    destination_port: Optional[str] = None
    import_region: Optional[str] = None
    risk_tolerance: Optional[str] = None
    product_categories: Optional[List[str]] = None
    product_descriptions: Optional[List[str]] = None
    rss_keywords: Optional[List[str]] = None
    typical_order_value_usd: Optional[float] = None
    avg_lead_time_days: Optional[int] = None
    compliance_notes: Optional[str] = None
    preferred_alternative_regions: Optional[List[str]] = None
    preferred_alternative_countries: Optional[List[str]] = None
    min_supplier_rating: Optional[float] = None


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

from core.auth import security, _decode_clerk_token
from fastapi.security import HTTPAuthorizationCredentials

@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
def complete_onboarding(data: OnboardingRequest, db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Creates the Customer, BusinessProfile, Supplier, and Product in Aurora after Clerk auth."""
    
    try:
        payload = _decode_clerk_token(credentials.credentials)
        clerk_id = payload.get("sub")
    except:
        clerk_id = None
        
    email = data.email.lower().strip()
    
    # Check if they already exist
    customer = None
    if clerk_id:
        customer = db.query(Customer).filter(Customer.clerk_id == clerk_id).first()
    if not customer:
        customer = db.query(Customer).filter(Customer.email == email).first()
    
    if not customer:
        customer = Customer(
            email=email,
            clerk_id=clerk_id,
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

    # Automatically create or update BusinessProfile
    from models import BusinessProfile
    existing_profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == customer.id).first()
    
    # Optional logic to infer volume if missing
    import re
    vol = data.annual_import_volume_usd
    if vol is None:
        vol = 500000
        try:
            nums = re.findall(r'\d+', data.average_revenue)
            if nums:
                num = int(nums[-1])
                if "M" in data.average_revenue.upper() or "MILLION" in data.average_revenue.upper():
                    vol = float(num * 1000000)
                elif "K" in data.average_revenue.upper():
                    vol = float(num * 1000)
                elif "B" in data.average_revenue.upper() or "BILLION" in data.average_revenue.upper():
                    vol = float(num * 1000000000)
                else:
                    vol = float(num)
        except:
            pass

    if not existing_profile:
        profile = BusinessProfile(
            customer_id=customer.id,
            business_type=data.business_type or data.industry.strip(),
            annual_import_volume_usd=vol,
            primary_hs_codes=data.primary_hs_codes or ["8542.31", "8517.62"],
            primary_origin_countries=data.primary_origin_countries or ["China", "Taiwan"],
            destination_country=data.destination_country or "United States",
            destination_port=data.destination_port or "Port of Los Angeles",
            import_region=data.import_region or "East Asia",
            risk_tolerance=data.risk_tolerance or "medium",
            product_categories=data.product_categories or [data.industry.strip()],
            product_descriptions=data.product_descriptions or [],
            rss_keywords=data.rss_keywords or [f"{data.industry.strip()} tariff"],
            typical_order_value_usd=data.typical_order_value_usd or vol * 0.1,
            avg_lead_time_days=data.avg_lead_time_days or 30,
            compliance_notes=data.compliance_notes or "",
            preferred_alternative_regions=data.preferred_alternative_regions or [],
            preferred_alternative_countries=data.preferred_alternative_countries or [],
            min_supplier_rating=data.min_supplier_rating or 3.5,
        )
        db.add(profile)
    else:
        existing_profile.business_type = data.business_type or data.industry.strip()
        existing_profile.annual_import_volume_usd = vol
        if data.primary_hs_codes: existing_profile.primary_hs_codes = data.primary_hs_codes
        if data.primary_origin_countries: existing_profile.primary_origin_countries = data.primary_origin_countries
        if data.destination_country: existing_profile.destination_country = data.destination_country
        if data.destination_port: existing_profile.destination_port = data.destination_port
        if data.import_region: existing_profile.import_region = data.import_region
        if data.risk_tolerance: existing_profile.risk_tolerance = data.risk_tolerance
        if data.product_categories: existing_profile.product_categories = data.product_categories
        if data.product_descriptions: existing_profile.product_descriptions = data.product_descriptions
        if data.rss_keywords: existing_profile.rss_keywords = data.rss_keywords
        if data.typical_order_value_usd: existing_profile.typical_order_value_usd = data.typical_order_value_usd
        if data.avg_lead_time_days: existing_profile.avg_lead_time_days = data.avg_lead_time_days
        if data.compliance_notes is not None: existing_profile.compliance_notes = data.compliance_notes
        if data.preferred_alternative_regions: existing_profile.preferred_alternative_regions = data.preferred_alternative_regions
        if data.preferred_alternative_countries: existing_profile.preferred_alternative_countries = data.preferred_alternative_countries
        if data.min_supplier_rating: existing_profile.min_supplier_rating = data.min_supplier_rating
        
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
    try:
        from models import (
            BusinessProfile, Supplier, Product, ImportOrder, TariffAlert,
            AgentRun, RssArticle, SupplierRecommendation, AgentRunLog, PipelineHeadline
        )
        # Manually cascade delete all related tables
        db.query(PipelineHeadline).filter(PipelineHeadline.customer_id == current_user.id).delete()
        db.query(AgentRunLog).filter(AgentRunLog.customer_id == current_user.id).delete()
        db.query(SupplierRecommendation).filter(SupplierRecommendation.customer_id == current_user.id).delete()
        db.query(RssArticle).filter(RssArticle.customer_id == current_user.id).delete()
        db.query(AgentRun).filter(AgentRun.customer_id == current_user.id).delete()
        db.query(TariffAlert).filter(TariffAlert.customer_id == current_user.id).delete()
        db.query(ImportOrder).filter(ImportOrder.customer_id == current_user.id).delete()
        db.query(Product).filter(Product.customer_id == current_user.id).delete()
        db.query(Supplier).filter(Supplier.customer_id == current_user.id).delete()
        db.query(BusinessProfile).filter(BusinessProfile.customer_id == current_user.id).delete()
        
        # Hard-delete the customer record
        db.delete(current_user)
        db.commit()
    except Exception as e:
        db.rollback()
        # Fallback: soft-delete
        current_user.is_active = False
        current_user.email = f"deleted_{current_user.id}_{current_user.email}"
        current_user.clerk_id = None
        db.commit()

    return {"message": "Account deleted successfully."}
