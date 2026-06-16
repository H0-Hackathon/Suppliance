"""
CoastGuard — In-memory article cache.

Populated once on server startup by collectors/monitor.scrape_rss_feeds().
Refreshed via POST /api/v2/monitor/collect (the "Refresh News" button).

Every /monitor/run call reads from this cache (instant) and supplements it
with a single targeted Google News query for that supplier's country (~2-5s).
The cache itself is never stale within a session — the startup scrape or the
manual refresh always gives you the freshest data from the RSS feeds.
"""

from datetime import datetime, UTC
from typing import Optional

_cache: dict = {
    "articles": [],
    "last_scraped": None,
}


def get_articles() -> list[dict]:
    return _cache["articles"]


def get_last_scraped() -> Optional[str]:
    return _cache["last_scraped"]


def refresh(articles: list[dict]) -> None:
    _cache["articles"] = articles
    _cache["last_scraped"] = datetime.now(UTC).isoformat()


def is_empty() -> bool:
    return len(_cache["articles"]) == 0


def status() -> dict:
    return {
        "article_count": len(_cache["articles"]),
        "last_scraped": _cache["last_scraped"],
    }
