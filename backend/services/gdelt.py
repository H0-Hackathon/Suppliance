"""
CoastGuard — GDELT news search tool.

GDELT (https://www.gdeltproject.org/) is a free, keyless API that indexes
news articles from across the world. We use the "DOC 2.0" API to search for
recent news about supply-chain disruptions (tariffs, port closures, strikes,
geopolitical unrest, etc.) near a given supplier country.

This is the ONE real external data source wired into the Monitor agent for
the demo (USITC was ruled out — its API requires a paid/registered key and
the team decided the cost wasn't worth it for a hackathon; GDELT is free and
needs no signup).

This module has zero CrewAI/agent dependencies — it's a plain function that
returns a list of dicts. That makes it easy to:
  - unit test on its own (just call search_disruption_events("VN"))
  - reuse from anywhere else in the backend
  - wrap as a CrewAI @tool in core/crew_monitor_pipeline.py
"""

import logging
from typing import Optional

import requests

from services.coordinates import get_country_name

logger = logging.getLogger(__name__)

GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

# Keywords that describe the kinds of events CoastGuard cares about. Combined
# with the supplier country name, this becomes the GDELT search query.
DISRUPTION_KEYWORDS = [
    "tariff",
    "port",
    "shipping",
    "supply chain",
    "strike",
    "sanctions",
    "export ban",
]

# How many articles to ask GDELT for. Kept small — the Monitor agent only
# needs a handful of headlines to reason about, not a full news dump.
DEFAULT_MAX_RECORDS = 10

# Network calls in a live demo must fail fast rather than hang the request.
REQUEST_TIMEOUT_SECONDS = 8


def search_disruption_events(
    country: str,
    keywords: Optional[list[str]] = None,
    max_records: int = DEFAULT_MAX_RECORDS,
) -> list[dict]:
    """
    Search GDELT for recent news about supply-chain disruptions near `country`.

    Args:
        country: 2-letter ISO code ("VN") or full name ("Vietnam"). Used to
                 build the search query — GDELT's free-text search matches on
                 country names mentioned in articles.
        keywords: Override the default disruption keyword list.
        max_records: Max number of articles to return (GDELT caps at 250).

    Returns:
        A list of dicts, one per article:
            {
                "title": str,
                "url": str,
                "seendate": str,       # GDELT timestamp, e.g. "20260613T120000Z"
                "source_country": str, # e.g. "Vietnam"
                "domain": str,         # publisher domain
                "tone": float,         # GDELT sentiment score (-100..100)
            }
        Returns an empty list (never raises) if GDELT is unreachable or
        returns an unexpected response — a flaky free API should never take
        down the monitoring pipeline.
    """
    country_name = get_country_name(country)
    topic_keywords = keywords or DISRUPTION_KEYWORDS

    # Example query: (Vietnam) (tariff OR port OR shipping OR ... )
    topic_clause = " OR ".join(topic_keywords)
    query = f'"{country_name}" ({topic_clause})'

    params = {
        "query": query,
        "mode": "artlist",
        "maxrecords": max_records,
        "format": "json",
        "sort": "datedesc",
    }

    try:
        response = requests.get(
            GDELT_DOC_API_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.warning("GDELT search failed for %s: %s", country_name, exc)
        return []

    articles = data.get("articles", []) if isinstance(data, dict) else []

    results = []
    for article in articles:
        results.append({
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "seendate": article.get("seendate", ""),
            "source_country": article.get("sourcecountry", ""),
            "domain": article.get("domain", ""),
            "tone": article.get("tone", 0.0),
        })

    logger.info(
        "GDELT returned %d article(s) for query=%r", len(results), query
    )
    return results
