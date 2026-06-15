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
    "ZA": {"location_name": "Durban, South Africa", "country_name": "South Africa", "latitude": -29.8587, "longitude": 31.0218},
    "NL": {"location_name": "Rotterdam, Netherlands", "country_name": "Netherlands", "latitude": 51.9244, "longitude": 4.4777},
    "DE": {"location_name": "Hamburg, Germany", "country_name": "Germany", "latitude": 53.5511, "longitude": 9.9937},
    "FR": {"location_name": "Marseille, France", "country_name": "France", "latitude": 43.2965, "longitude": 5.3698},
    "GB": {"location_name": "Felixstowe, United Kingdom", "country_name": "United Kingdom", "latitude": 51.9540, "longitude": 1.3510},
    "IT": {"location_name": "Genoa, Italy", "country_name": "Italy", "latitude": 44.4056, "longitude": 8.9463},
    "ES": {"location_name": "Valencia, Spain", "country_name": "Spain", "latitude": 39.4699, "longitude": -0.3763},
    "JP": {"location_name": "Yokohama, Japan", "country_name": "Japan", "latitude": 35.4437, "longitude": 139.6380},
    "KR": {"location_name": "Busan, South Korea", "country_name": "South Korea", "latitude": 35.1796, "longitude": 129.0756},
    "TW": {"location_name": "Kaohsiung, Taiwan", "country_name": "Taiwan", "latitude": 22.6273, "longitude": 120.3014},
    "SG": {"location_name": "Singapore", "country_name": "Singapore", "latitude": 1.3521, "longitude": 103.8198},
    "MY": {"location_name": "Port Klang, Malaysia", "country_name": "Malaysia", "latitude": 3.0000, "longitude": 101.4000},
    "PH": {"location_name": "Manila, Philippines", "country_name": "Philippines", "latitude": 14.5995, "longitude": 120.9842},
    "TR": {"location_name": "Istanbul, Turkey", "country_name": "Turkey", "latitude": 41.0082, "longitude": 28.9784},
    "BR": {"location_name": "Santos, Brazil", "country_name": "Brazil", "latitude": -23.9608, "longitude": -46.3336},
    "AR": {"location_name": "Buenos Aires, Argentina", "country_name": "Argentina", "latitude": -34.6037, "longitude": -58.3816},
    "CL": {"location_name": "Valparaiso, Chile", "country_name": "Chile", "latitude": -33.0472, "longitude": -71.6127},
    "CO": {"location_name": "Cartagena, Colombia", "country_name": "Colombia", "latitude": 10.3910, "longitude": -75.4794},
    "CA": {"location_name": "Vancouver, Canada", "country_name": "Canada", "latitude": 49.2827, "longitude": -123.1207},
    "AU": {"location_name": "Sydney, Australia", "country_name": "Australia", "latitude": -33.8688, "longitude": 151.2093},
    "NZ": {"location_name": "Auckland, New Zealand", "country_name": "New Zealand", "latitude": -36.8485, "longitude": 174.7633},
    "EG": {"location_name": "Alexandria, Egypt", "country_name": "Egypt", "latitude": 31.2001, "longitude": 29.9187},
    "NG": {"location_name": "Lagos, Nigeria", "country_name": "Nigeria", "latitude": 6.5244, "longitude": 3.3792},
    "KE": {"location_name": "Mombasa, Kenya", "country_name": "Kenya", "latitude": -4.0435, "longitude": 39.6682},
    "MA": {"location_name": "Casablanca, Morocco", "country_name": "Morocco", "latitude": 33.5731, "longitude": -7.5898},
    "SA": {"location_name": "Jeddah, Saudi Arabia", "country_name": "Saudi Arabia", "latitude": 21.4858, "longitude": 39.1925},
    "AE": {"location_name": "Dubai, United Arab Emirates", "country_name": "United Arab Emirates", "latitude": 25.2048, "longitude": 55.2708},
    "IL": {"location_name": "Haifa, Israel", "country_name": "Israel", "latitude": 32.7940, "longitude": 34.9896},
    "RU": {"location_name": "St Petersburg, Russia", "country_name": "Russia", "latitude": 59.9311, "longitude": 30.3609},
    "PL": {"location_name": "Gdansk, Poland", "country_name": "Poland", "latitude": 54.3520, "longitude": 18.6466},
    "CZ": {"location_name": "Prague, Czech Republic", "country_name": "Czech Republic", "latitude": 50.0755, "longitude": 14.4378},
    "RO": {"location_name": "Bucharest, Romania", "country_name": "Romania", "latitude": 44.4268, "longitude": 26.1025},
    "GR": {"location_name": "Piraeus, Greece", "country_name": "Greece", "latitude": 37.9475, "longitude": 23.6360},
    "PT": {"location_name": "Lisbon, Portugal", "country_name": "Portugal", "latitude": 38.7223, "longitude": -9.1393},
    "BE": {"location_name": "Antwerp, Belgium", "country_name": "Belgium", "latitude": 51.2194, "longitude": 4.4025},
    "CH": {"location_name": "Zurich, Switzerland", "country_name": "Switzerland", "latitude": 47.3769, "longitude": 8.5417},
    "AT": {"location_name": "Vienna, Austria", "country_name": "Austria", "latitude": 48.2082, "longitude": 16.3738},
    "SE": {"location_name": "Gothenburg, Sweden", "country_name": "Sweden", "latitude": 57.7089, "longitude": 11.9746},
    "NO": {"location_name": "Oslo, Norway", "country_name": "Norway", "latitude": 59.9139, "longitude": 10.7522},
    "DK": {"location_name": "Copenhagen, Denmark", "country_name": "Denmark", "latitude": 55.6761, "longitude": 12.5683},
    "FI": {"location_name": "Helsinki, Finland", "country_name": "Finland", "latitude": 60.1699, "longitude": 24.9384},
    "IE": {"location_name": "Dublin, Ireland", "country_name": "Ireland", "latitude": 53.3498, "longitude": -6.2603},
    "HU": {"location_name": "Budapest, Hungary", "country_name": "Hungary", "latitude": 47.4979, "longitude": 19.0402},
    "UA": {"location_name": "Odesa, Ukraine", "country_name": "Ukraine", "latitude": 46.4825, "longitude": 30.7233},
}

# Full-name aliases, in case a caller passes "Vietnam" instead of "VN" (e.g.
# Supplier.country in seed_data.py uses full names). Covers common variant
# spellings/abbreviations for the countries above.
_NAME_ALIASES: dict[str, str] = {
    "VIETNAM": "VN",
    "BANGLADESH": "BD",
    "INDIA": "IN",
    "CHINA": "CN",
    "MEXICO": "MX",
    "USA": "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "THAILAND": "TH",
    "INDONESIA": "ID",
    "PAKISTAN": "PK",
    "CAMBODIA": "KH",
    "SOUTH AFRICA": "ZA",
    "NETHERLANDS": "NL",
    "HOLLAND": "NL",
    "GERMANY": "DE",
    "FRANCE": "FR",
    "UNITED KINGDOM": "GB",
    "UK": "GB",
    "GREAT BRITAIN": "GB",
    "ITALY": "IT",
    "SPAIN": "ES",
    "JAPAN": "JP",
    "SOUTH KOREA": "KR",
    "KOREA, REPUBLIC OF": "KR",
    "REPUBLIC OF KOREA": "KR",
    "TAIWAN": "TW",
    "SINGAPORE": "SG",
    "MALAYSIA": "MY",
    "PHILIPPINES": "PH",
    "TURKEY": "TR",
    "TURKIYE": "TR",
    "BRAZIL": "BR",
    "ARGENTINA": "AR",
    "CHILE": "CL",
    "COLOMBIA": "CO",
    "CANADA": "CA",
    "AUSTRALIA": "AU",
    "NEW ZEALAND": "NZ",
    "EGYPT": "EG",
    "NIGERIA": "NG",
    "KENYA": "KE",
    "MOROCCO": "MA",
    "SAUDI ARABIA": "SA",
    "UNITED ARAB EMIRATES": "AE",
    "UAE": "AE",
    "ISRAEL": "IL",
    "RUSSIA": "RU",
    "RUSSIAN FEDERATION": "RU",
    "POLAND": "PL",
    "CZECH REPUBLIC": "CZ",
    "CZECHIA": "CZ",
    "ROMANIA": "RO",
    "GREECE": "GR",
    "PORTUGAL": "PT",
    "BELGIUM": "BE",
    "SWITZERLAND": "CH",
    "AUSTRIA": "AT",
    "SWEDEN": "SE",
    "NORWAY": "NO",
    "DENMARK": "DK",
    "FINLAND": "FI",
    "IRELAND": "IE",
    "HUNGARY": "HU",
    "UKRAINE": "UA",
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


def get_country_code(country: str) -> Optional[str]:
    """
    Best-effort ISO 3166-1 alpha-2 code for a country (e.g. "Vietnam" -> "VN").

    Accepts either a 2-letter code or a full country name, case-insensitive.
    Returns None if the country isn't in the lookup table.
    """
    if not country:
        return None

    key = country.strip().upper()
    if key in COUNTRY_COORDINATES:
        return key

    return _NAME_ALIASES.get(key)
