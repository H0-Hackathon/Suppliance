"""
CoastGuard — Hardcoded country -> coordinates lookup.

Why hardcoded:
  The globe visualization needs a (latitude, longitude) for every
  DisruptionEvent. We could ask the Gemini agent to guess coordinates from
  the event text, but LLMs are unreliable at returning precise numbers and a
  bad coordinate would put a marker in the ocean during a live demo.

  Instead we keep a small lookup table of the countries/ports that actually
  show up in this project's demo data (see backend/scripts/seed_data.py and
  crew_monitor_pipeline.py). Each entry points at a real manufacturing hub or
  port city, not just "the middle of the country", so markers look correct
  on the globe.

  This is intentionally a flat dict, not a geocoding API call — no network
  request, no API key, never fails, perfect for a live demo.
"""

from typing import Optional, TypedDict


class CountryLocation(TypedDict):
    location_name: str
    country_name: str
    latitude: float
    longitude: float


# Keyed by ISO 3166-1 alpha-2 country code (uppercase). Add more entries here
# as new supplier countries show up in demo data — that's all that's needed
# for the globe to plot a new point.
COUNTRY_COORDINATES: dict[str, CountryLocation] = {
    "VN": {"location_name": "Ho Chi Minh City, Vietnam", "country_name": "Vietnam", "latitude": 10.8231, "longitude": 106.6297},
    "BD": {"location_name": "Dhaka, Bangladesh", "country_name": "Bangladesh", "latitude": 23.8103, "longitude": 90.4125},
    "IN": {"location_name": "Mumbai, India", "country_name": "India", "latitude": 19.0760, "longitude": 72.8777},
    "CN": {"location_name": "Shenzhen, China", "country_name": "China", "latitude": 22.5431, "longitude": 114.0579},
    "MX": {"location_name": "Guadalajara, Mexico", "country_name": "Mexico", "latitude": 20.6597, "longitude": -103.3496},
    "US": {"location_name": "Port of Los Angeles, USA", "country_name": "United States", "latitude": 33.7395, "longitude": -118.2610},
    "TH": {"location_name": "Bangkok, Thailand", "country_name": "Thailand", "latitude": 13.7563, "longitude": 100.5018},
    "ID": {"location_name": "Jakarta, Indonesia", "country_name": "Indonesia", "latitude": -6.2088, "longitude": 106.8456},
    "PK": {"location_name": "Karachi, Pakistan", "country_name": "Pakistan", "latitude": 24.8607, "longitude": 67.0011},
    "KH": {"location_name": "Phnom Penh, Cambodia", "country_name": "Cambodia", "latitude": 11.5564, "longitude": 104.9282},
}

# A handful of full-name aliases, in case a caller passes "Vietnam" instead
# of "VN" (e.g. Supplier.country in seed_data.py uses full names).
_NAME_ALIASES: dict[str, str] = {
    "VIETNAM": "VN",
    "BANGLADESH": "BD",
    "INDIA": "IN",
    "CHINA": "CN",
    "MEXICO": "MX",
    "USA": "US",
    "UNITED STATES": "US",
    "THAILAND": "TH",
    "INDONESIA": "ID",
    "PAKISTAN": "PK",
    "CAMBODIA": "KH",
}


def get_country_coordinates(country: str) -> Optional[CountryLocation]:
    """
    Look up demo coordinates for a country.

    Accepts either a 2-letter ISO code ("VN") or a full country name
    ("Vietnam"), case-insensitive. Returns None if the country isn't in the
    lookup table — callers should handle that by simply omitting lat/lon
    (the globe will skip points with no coordinates).
    """
    if not country:
        return None

    key = country.strip().upper()
    if key not in COUNTRY_COORDINATES:
        key = _NAME_ALIASES.get(key, key)

    return COUNTRY_COORDINATES.get(key)


def get_country_name(country: str) -> str:
    """
    Best-effort full country name for a 2-letter code (e.g. "VN" -> "Vietnam").
    Falls back to returning the input unchanged if it's not in the lookup —
    used to build human-readable GDELT search queries.
    """
    location = get_country_coordinates(country)
    return location["country_name"] if location else country
