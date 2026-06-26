"""
CoastGuard — Geo coordinate lookup routes.

Endpoints:
  GET /api/v2/geo/supplier-coords   country -> {country, code, latitude, longitude, location_name}

Wraps services/coordinates.py so the frontend (TradeGlobe) can position
supplier markers without duplicating the hardcoded lookup table in JS.
"""

from fastapi import APIRouter, HTTPException

from services.coordinates import get_country_coordinates, get_country_code

router = APIRouter(prefix="/api/v2/geo", tags=["Geo"])


@router.get("/supplier-coords")
def supplier_coords(country: str):
    location = get_country_coordinates(country)
    if not location:
        raise HTTPException(status_code=404, detail=f"No coordinates known for '{country}'")

    return {
        "country": location["country_name"],
        "code": get_country_code(country),
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "location_name": location["location_name"],
    }
