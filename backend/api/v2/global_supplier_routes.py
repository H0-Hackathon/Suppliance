"""
CoastGuard — Global Supplier Directory API routes.

Endpoints:
  GET /api/v2/global-suppliers/regions      distinct export-market regions
  GET /api/v2/global-suppliers/countries    distinct supplier countries for a region
  GET /api/v2/global-suppliers/categories   categories for a region + country
  GET /api/v2/global-suppliers              paginated list (region + country + category)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import GlobalSupplier, BusinessProfile
from core.auth import get_current_user_optional
from services.coordinates import get_country_coordinates, get_country_code

router = APIRouter(prefix="/api/v2/global-suppliers", tags=["Global Supplier Directory"])


# ── Response schema ───────────────────────────────────────────────────────────

class GlobalSupplierOut(BaseModel):
    id: int
    supplier_id: str
    business_name: str
    country: str
    city: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    website: Optional[str]
    product_category: str
    product_list: Optional[str]
    business_type: Optional[str]
    year_established: Optional[int]
    employee_count: Optional[int]
    annual_export_volume_usd: Optional[float]
    min_order_quantity: Optional[str]
    export_markets: Optional[str]
    certifications: Optional[str]
    supplier_rating: Optional[float]
    payment_terms: Optional[str]
    lead_time_days: Optional[int]

    class Config:
        from_attributes = True


class SupplierListResponse(BaseModel):
    suppliers: List[GlobalSupplierOut]
    total: int
    page: int
    per_page: int
    total_pages: int


# ── Known regions ─────────────────────────────────────────────────────────────
ALL_REGIONS = [
    "Middle East", "South Asia", "Western Europe", "Eastern Europe",
    "Southeast Asia", "North America", "South America",
    "Sub-Saharan Africa", "North Africa", "East Asia", "Oceania", "CIS Countries",
]

REGION_TO_COUNTRIES = {
    "Middle East": ['Israel', 'Kuwait', 'Qatar', 'Saudi Arabia', 'Turkey', 'UAE'],
    "South Asia": ['Bangladesh', 'India', 'Nepal', 'Pakistan', 'Sri Lanka'],
    "Western Europe": ['Austria', 'Belgium', 'Denmark', 'Finland', 'France', 'Germany', 'Greece', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Portugal', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'],
    "Eastern Europe": ['Czech Republic', 'Hungary', 'Poland', 'Romania', 'Russia', 'Ukraine'],
    "Southeast Asia": ['Cambodia', 'Indonesia', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'],
    "North America": ['Canada', 'Mexico', 'United States'],
    "South America": ['Argentina', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Peru'],
    "Sub-Saharan Africa": ['Ethiopia', 'Ghana', 'Kenya', 'Nigeria', 'South Africa', 'Tanzania'],
    "North Africa": ['Egypt', 'Morocco', 'Tunisia'],
    "East Asia": ['China', 'Hong Kong', 'Japan', 'South Korea', 'Taiwan'],
    "Oceania": ['Australia', 'New Zealand'],
    "CIS Countries": ['Kazakhstan', 'Russia', 'Ukraine'],
}

def _region_filter(query, region: str):
    countries = REGION_TO_COUNTRIES.get(region, [])
    if countries:
        return query.filter(GlobalSupplier.country.in_(countries))
    else:
        # Fallback to export_markets if region not mapped
        return query.filter(GlobalSupplier.export_markets.ilike(f"%{region}%"))
# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/regions", response_model=List[dict])
def get_regions(
    explore_all: bool = Query(False),
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional)
):
    categories = None
    if user and not explore_all:
        profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == user.id).first()
        if profile and profile.product_categories:
            categories = profile.product_categories

    results = []
    for region in ALL_REGIONS:
        q = _region_filter(db.query(func.count(GlobalSupplier.id)), region)
        if categories:
            q = q.filter(GlobalSupplier.product_category.in_(categories))
            
        count = q.scalar()
        if count and count > 0:
            results.append({"region": region, "supplier_count": count})
    return results


@router.get("/countries", response_model=List[dict])
def get_countries(
    region: str = Query(..., description="Export market region"),
    explore_all: bool = Query(False),
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional)
):
    """Distinct supplier home countries that export to the given region."""
    categories = None
    if user and not explore_all:
        profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == user.id).first()
        if profile and profile.product_categories:
            categories = profile.product_categories

    q_countries = _region_filter(db.query(GlobalSupplier.country), region)
    if categories:
        q_countries = q_countries.filter(GlobalSupplier.product_category.in_(categories))
        
    rows = q_countries.distinct().order_by(GlobalSupplier.country).all()

    countries = []
    for (c,) in rows:
        if not c:
            continue
        q_count = _region_filter(db.query(func.count(GlobalSupplier.id)).filter(GlobalSupplier.country == c), region)
        if categories:
            q_count = q_count.filter(GlobalSupplier.product_category.in_(categories))
            
        count = q_count.scalar()
        if count and count > 0:
            countries.append({"country": c, "supplier_count": count})
    return countries


@router.get("/categories", response_model=List[dict])
def get_categories(
    region: str = Query(...),
    country: Optional[str] = Query(None, description="Filter by supplier country"),
    explore_all: bool = Query(False),
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional)
):
    q = _region_filter(db.query(GlobalSupplier.product_category), region)
    if country:
        q = q.filter(GlobalSupplier.country == country)
        
    if user and not explore_all:
        profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == user.id).first()
        if profile and profile.product_categories:
            q = q.filter(GlobalSupplier.product_category.in_(profile.product_categories))
            
    rows = q.distinct().order_by(GlobalSupplier.product_category).all()

    categories = []
    for (cat,) in rows:
        if not cat:
            continue
        cq = _region_filter(
            db.query(func.count(GlobalSupplier.id))
            .filter(GlobalSupplier.product_category == cat),
            region,
        )
        if country:
            cq = cq.filter(GlobalSupplier.country == country)
        count = cq.scalar()
        categories.append({"category": cat, "supplier_count": count})
    return categories


@router.get("", response_model=SupplierListResponse)
def list_global_suppliers(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(6, ge=1, le=50),
    db: Session = Depends(get_db),
):
    base_q = db.query(GlobalSupplier)
    if category:
        base_q = base_q.filter(GlobalSupplier.product_category == category)
    if region:
        base_q = _region_filter(base_q, region)
    if country:
        base_q = base_q.filter(GlobalSupplier.country == country)

    base_q = base_q.order_by(
        GlobalSupplier.supplier_rating.desc().nullslast(),
        GlobalSupplier.annual_export_volume_usd.desc().nullslast(),
    )

    total = base_q.count()
    suppliers = base_q.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "suppliers": suppliers,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


@router.get("/globe-data", response_model=List[dict])
def get_globe_data(db: Session = Depends(get_db)):
    """Returns total supplier count per country for the 3D globe."""
    rows = (
        db.query(GlobalSupplier.country, func.count(GlobalSupplier.id))
        .group_by(GlobalSupplier.country)
        .all()
    )
    return [{"country": c, "count": count} for c, count in rows if c]


@router.get("/globe-density", response_model=List[dict])
def get_globe_density(db: Session = Depends(get_db)):
    """
    One geocoded point per country (not one per supplier) for the dashboard
    globe's ambient background layer — ~100-150 rows total instead of the
    25k individual GlobalSupplier rows, since GlobalSupplier has no per-row
    lat/lng anyway (country is the only location field it stores).
    """
    rows = (
        db.query(GlobalSupplier.country, func.count(GlobalSupplier.id))
        .group_by(GlobalSupplier.country)
        .all()
    )
    points = []
    for country, count in rows:
        if not country:
            continue
        loc = get_country_coordinates(country)
        if not loc:
            continue
        points.append({
            "country": loc["country_name"],
            "countryCode": get_country_code(country),
            "count": count,
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
        })
    return points
