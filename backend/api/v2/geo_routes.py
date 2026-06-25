"""
CoastGuard — Geo coordinate lookup routes.

Endpoints:
  GET /api/v2/geo/supplier-coords   country (+ optional supplier name) -> {country, code, latitude, longitude, location_name}

Resolution order:
  1. If a supplier `name` is given, fuzzy-match it against the global_suppliers
     directory (25k real-world exporters) within the same country. A match
     anchors the pin to that business and nudges it off the bare country
     centroid with a small deterministic offset (derived from the matched
     business name) so multiple suppliers in the same country don't all
     render on the exact same point.
  2. No match (or no name given) -> plain country centroid, still offset
     deterministically by the supplier's own name/country so distinct
     suppliers spread out visually instead of stacking.
"""

import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GlobalSupplier
from services.coordinates import get_country_coordinates, get_country_code

router = APIRouter(prefix="/api/v2/geo", tags=["Geo"])

# Max jitter applied around a country centroid, in degrees — small enough to
# stay visually "in country" but enough to separate distinct supplier pins.
_OFFSET_DEGREES = 1.8


def _deterministic_offset(seed: str) -> tuple[float, float]:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    lat_off = (int(digest[:8], 16) / 0xFFFFFFFF - 0.5) * _OFFSET_DEGREES
    lng_off = (int(digest[8:16], 16) / 0xFFFFFFFF - 0.5) * _OFFSET_DEGREES
    return lat_off, lng_off


@router.get("/supplier-coords")
def supplier_coords(
    country: str,
    name: str = Query(default=""),
    db: Session = Depends(get_db),
):
    location = get_country_coordinates(country)
    if not location:
        raise HTTPException(status_code=404, detail=f"No coordinates known for '{country}'")

    matched_business: Optional[str] = None
    if name.strip():
        match = (
            db.query(GlobalSupplier)
            .filter(func.lower(GlobalSupplier.country) == country.strip().lower())
            .filter(func.lower(GlobalSupplier.business_name).like(f"%{name.strip().lower()}%"))
            .first()
        )
        if match:
            matched_business = match.business_name

    seed = matched_business or name.strip() or location["country_name"]
    lat_off, lng_off = _deterministic_offset(seed)

    return {
        "country": location["country_name"],
        "code": get_country_code(country),
        "latitude": location["latitude"] + lat_off,
        "longitude": location["longitude"] + lng_off,
        "location_name": matched_business or location["location_name"],
        "matched_global_supplier": matched_business is not None,
    }
