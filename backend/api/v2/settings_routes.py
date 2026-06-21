"""
CoastGuard — Settings Routes

GET  /api/v2/settings?customer_id=N   → returns customer + business profile for the settings page
PATCH /api/v2/settings?customer_id=N  → updates customer and/or business profile fields
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import get_db
from models import Customer, BusinessProfile

router = APIRouter(prefix="/api/v2/settings", tags=["Settings"])


class SettingsResponse(BaseModel):
    customer_id: int
    name: str
    email: str
    company_name: Optional[str]
    industry: Optional[str]
    # business profile
    business_type: Optional[str]
    risk_tolerance: Optional[str]
    import_region: Optional[str]
    destination_port: Optional[str]
    destination_country: Optional[str]
    annual_import_volume_usd: Optional[float]
    primary_origin_countries: Optional[List[str]]
    primary_hs_codes: Optional[List[str]]
    product_categories: Optional[List[str]]
    rss_keywords: Optional[List[str]]
    preferred_alternative_regions: Optional[List[str]]
    preferred_alternative_countries: Optional[List[str]]
    min_supplier_rating: Optional[float]
    avg_lead_time_days: Optional[int]
    compliance_notes: Optional[str]

    class Config:
        from_attributes = True


class SettingsPatch(BaseModel):
    # Customer fields
    name: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    # BusinessProfile fields
    business_type: Optional[str] = None
    risk_tolerance: Optional[str] = None
    import_region: Optional[str] = None
    destination_port: Optional[str] = None
    destination_country: Optional[str] = None
    annual_import_volume_usd: Optional[float] = None
    primary_origin_countries: Optional[List[str]] = None
    primary_hs_codes: Optional[List[str]] = None
    product_categories: Optional[List[str]] = None
    rss_keywords: Optional[List[str]] = None
    preferred_alternative_regions: Optional[List[str]] = None
    preferred_alternative_countries: Optional[List[str]] = None
    min_supplier_rating: Optional[float] = None
    avg_lead_time_days: Optional[int] = None
    compliance_notes: Optional[str] = None


@router.get("", response_model=SettingsResponse)
def get_settings(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")

    profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == customer_id).first()

    return SettingsResponse(
        customer_id=customer.id,
        name=customer.name or "",
        email=customer.email or "",
        company_name=customer.company_name,
        industry=customer.industry,
        business_type=profile.business_type if profile else None,
        risk_tolerance=profile.risk_tolerance if profile else None,
        import_region=profile.import_region if profile else None,
        destination_port=profile.destination_port if profile else None,
        destination_country=profile.destination_country if profile else None,
        annual_import_volume_usd=profile.annual_import_volume_usd if profile else None,
        primary_origin_countries=profile.primary_origin_countries if profile else [],
        primary_hs_codes=profile.primary_hs_codes if profile else [],
        product_categories=profile.product_categories if profile else [],
        rss_keywords=profile.rss_keywords if profile else [],
        preferred_alternative_regions=profile.preferred_alternative_regions if profile else [],
        preferred_alternative_countries=profile.preferred_alternative_countries if profile else [],
        min_supplier_rating=profile.min_supplier_rating if profile else None,
        avg_lead_time_days=profile.avg_lead_time_days if profile else None,
        compliance_notes=profile.compliance_notes if profile else None,
    )


@router.patch("", response_model=SettingsResponse)
def patch_settings(customer_id: int, payload: SettingsPatch, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")

    # Update customer fields
    if payload.name is not None:
        customer.name = payload.name
    if payload.company_name is not None:
        customer.company_name = payload.company_name
    if payload.industry is not None:
        customer.industry = payload.industry

    # Get or create BusinessProfile
    profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == customer_id).first()
    if not profile:
        profile = BusinessProfile(customer_id=customer_id)
        db.add(profile)

    profile_fields = [
        "business_type", "risk_tolerance", "import_region", "destination_port",
        "destination_country", "annual_import_volume_usd", "primary_origin_countries",
        "primary_hs_codes", "product_categories", "rss_keywords",
        "preferred_alternative_regions", "preferred_alternative_countries",
        "min_supplier_rating", "avg_lead_time_days", "compliance_notes",
    ]
    for field in profile_fields:
        value = getattr(payload, field, None)
        if value is not None:
            setattr(profile, field, value)

    db.commit()
    db.refresh(customer)
    db.refresh(profile)

    return get_settings(customer_id=customer_id, db=db)
