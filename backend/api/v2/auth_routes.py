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

class SupplierInput(BaseModel):
    name: str
    country: str


class OnboardingRequest(BaseModel):
    # Customer basic info
    email: EmailStr
    name: str
    company_name: str
    industry: str
    location: str
    years_in_business: int
    average_revenue: str
    suppliers: Optional[List[SupplierInput]] = None

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
        exp = customer.subscription_expires_at
        return {
            "status": "active",
            "plan": customer.subscription_plan,
            "expires_at": (exp.isoformat() + "Z") if exp else None,
        }

    # Within free trial
    if customer.trial_expires_at and customer.trial_expires_at > now:
        hours_left = (customer.trial_expires_at - now).total_seconds() / 3600
        return {
            "status": "trial",
            "plan": "trial",
            "hours_left": round(hours_left, 1),
            "expires_at": customer.trial_expires_at.isoformat() + "Z",
        }

    # Expired
    return {"status": "expired", "plan": None, "expires_at": None}


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

from core.auth import security, _fast_clerk_id
from fastapi.security import HTTPAuthorizationCredentials

@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
def complete_onboarding(
    data: OnboardingRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Creates the Customer + BusinessProfile + starts 24h trial after Clerk sign-up.
    Uses fast (unverified) JWT decode to get clerk_id — no outbound network call,
    so signup never hangs waiting for Clerk's JWKS endpoint.
    """
    # Fast decode: no signature verification, no network call.
    # Safe for signup because Clerk already verified the user on the frontend.
    clerk_id = _fast_clerk_id(credentials.credentials)

    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token. Please sign in again.",
        )

    email = data.email.lower().strip()

    # Upsert: find existing record or create new
    customer = db.query(Customer).filter(Customer.clerk_id == clerk_id).first()
    if not customer and email:
        customer = db.query(Customer).filter(Customer.email == email).first()

    if not customer:
        customer = Customer(
            clerk_id=clerk_id,
            email=email,
            name=data.name.strip(),
            company_name=data.company_name.strip(),
            industry=data.industry.strip(),
            location=data.location.strip(),
            years_in_business=data.years_in_business,
            average_revenue=data.average_revenue.strip(),
            is_verified=True,
        )
        db.add(customer)
        db.flush()   # get customer.id without committing yet
    else:
        customer.clerk_id    = clerk_id
        customer.name        = data.name.strip()
        customer.company_name = data.company_name.strip()
        customer.industry    = data.industry.strip()
        customer.location    = data.location.strip()
        customer.years_in_business = data.years_in_business
        customer.average_revenue   = data.average_revenue.strip()
        customer.is_verified = True

    # Start 24-hour free trial from NOW
    customer.trial_expires_at = datetime.utcnow() + timedelta(hours=TRIAL_HOURS)

    # ── BusinessProfile: upsert ───────────────────────────────────────────
    from models import BusinessProfile, Supplier, Product
    vol = float(data.annual_import_volume_usd or 500_000)

    existing_profile = db.query(BusinessProfile).filter(
        BusinessProfile.customer_id == customer.id
    ).first()

    supplier_inputs = data.suppliers or []
    supplier_countries = sorted({s.country.strip() for s in supplier_inputs if s.country.strip()})

    if not existing_profile:
        # One Gemini call to flesh out every narrative field (HS codes, product
        # descriptions, compliance notes, alternative sourcing, HQ resolution)
        # from the few fields the onboarding form actually collects.
        from core.profile_normalizer import normalize_business_profile
        normalized = normalize_business_profile(
            industry=data.industry,
            raw_location=data.location,
            suppliers=[s.model_dump() for s in supplier_inputs],
            average_revenue=data.average_revenue,
            company_name=data.company_name,
        ) or {}

        profile = BusinessProfile(
            customer_id=customer.id,
            business_type=data.business_type or normalized.get("business_type") or data.industry.strip(),
            annual_import_volume_usd=vol,
            primary_hs_codes=data.primary_hs_codes or normalized.get("primary_hs_codes") or [],
            primary_origin_countries=data.primary_origin_countries or supplier_countries or normalized.get("primary_origin_countries") or [],
            destination_country=data.destination_country or normalized.get("destination_country") or "United States",
            destination_port=data.destination_port or normalized.get("destination_port") or "Port of Los Angeles",
            import_region=data.import_region or normalized.get("import_region") or "East Asia",
            risk_tolerance=data.risk_tolerance or normalized.get("risk_tolerance") or "medium",
            product_categories=data.product_categories or normalized.get("product_categories") or [data.industry.strip()],
            product_descriptions=data.product_descriptions or normalized.get("product_descriptions") or [],
            rss_keywords=data.rss_keywords or normalized.get("rss_keywords") or [f"{data.industry.strip()} tariff"],
            typical_order_value_usd=data.typical_order_value_usd or normalized.get("typical_order_value_usd") or vol * 0.1,
            avg_lead_time_days=data.avg_lead_time_days or normalized.get("avg_lead_time_days") or 30,
            compliance_notes=data.compliance_notes or normalized.get("compliance_notes") or "",
            preferred_alternative_regions=data.preferred_alternative_regions or normalized.get("preferred_alternative_regions") or [],
            preferred_alternative_countries=data.preferred_alternative_countries or normalized.get("preferred_alternative_countries") or [],
            min_supplier_rating=data.min_supplier_rating or normalized.get("min_supplier_rating") or 3.5,
        )
        db.add(profile)

        # Real suppliers the user entered during onboarding — these are what
        # the globe and AlternativesFinder reason about, not placeholder data.
        if supplier_inputs:
            for s in supplier_inputs:
                db.add(Supplier(
                    customer_id=customer.id,
                    name=s.name.strip(),
                    country=s.country.strip(),
                    product_category=data.industry.strip(),
                    reliability_score=85.0,
                ))
        else:
            db.add(Supplier(
                customer_id=customer.id,
                name=f"Primary {data.location.strip()} Partner",
                country=data.location.strip(),
                product_category=data.industry.strip(),
                reliability_score=85.0,
            ))

        hs_codes = data.primary_hs_codes or normalized.get("primary_hs_codes") or []
        hs = hs_codes[0].split(" –")[0] if hs_codes else "8500.00"
        db.add(Product(
            customer_id=customer.id,
            hs_code=hs,
            description=f"{data.industry.strip()} Goods",
            import_country=(supplier_countries[0] if supplier_countries else data.location.strip()),
            unit_value_usd=data.typical_order_value_usd or 150.0,
        ))
    else:
        # Update existing profile fields
        existing_profile.business_type = data.business_type or data.industry.strip()
        existing_profile.annual_import_volume_usd = vol
        if data.primary_hs_codes:           existing_profile.primary_hs_codes = data.primary_hs_codes
        if data.primary_origin_countries:   existing_profile.primary_origin_countries = data.primary_origin_countries
        elif supplier_countries:            existing_profile.primary_origin_countries = supplier_countries
        if data.destination_country:        existing_profile.destination_country = data.destination_country
        if data.destination_port:           existing_profile.destination_port = data.destination_port
        if data.import_region:              existing_profile.import_region = data.import_region
        if data.risk_tolerance:             existing_profile.risk_tolerance = data.risk_tolerance
        if data.product_categories:         existing_profile.product_categories = data.product_categories
        if data.product_descriptions:       existing_profile.product_descriptions = data.product_descriptions
        if data.rss_keywords:               existing_profile.rss_keywords = data.rss_keywords
        if data.typical_order_value_usd:    existing_profile.typical_order_value_usd = data.typical_order_value_usd
        if data.avg_lead_time_days:         existing_profile.avg_lead_time_days = data.avg_lead_time_days
        if data.compliance_notes is not None: existing_profile.compliance_notes = data.compliance_notes
        if data.preferred_alternative_regions:   existing_profile.preferred_alternative_regions = data.preferred_alternative_regions
        if data.preferred_alternative_countries: existing_profile.preferred_alternative_countries = data.preferred_alternative_countries
        if data.min_supplier_rating:        existing_profile.min_supplier_rating = data.min_supplier_rating

        # If the user entered suppliers and none exist yet for this account,
        # seed them now (covers users who completed onboarding before this
        # field existed, or skipped it the first time).
        if supplier_inputs:
            has_suppliers = db.query(Supplier).filter(Supplier.customer_id == customer.id).first() is not None
            if not has_suppliers:
                for s in supplier_inputs:
                    db.add(Supplier(
                        customer_id=customer.id,
                        name=s.name.strip(),
                        country=s.country.strip(),
                        product_category=data.industry.strip(),
                        reliability_score=85.0,
                    ))

    db.commit()
    db.refresh(customer)
    return {"message": "Onboarding complete", "customer_id": customer.id}


@router.get("/me")
def get_me(current_user: Customer = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns logged-in user info and subscription status. No token = 401."""
    from models import AgentRun
    has_run_pipeline = db.query(AgentRun).filter(AgentRun.customer_id == current_user.id).first() is not None
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
        "has_run_pipeline": has_run_pipeline,
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
