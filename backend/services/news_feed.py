"""
CoastGuard — Live trade/supply-chain news feed for the dashboard ticker.

Aggregates real headlines from Google News RSS topic searches plus a couple of
industry RSS feeds, covering: tariffs, trade policy, logistics, supply chains,
shipping, customs, manufacturing, and geopolitics.

Lightweight by design — we only read RSS entry metadata (title, link, source,
published) via requests + feedparser; no per-article full-text download. Results
are cached in-memory with a short TTL so the ticker can poll cheaply.

Exposed via GET /api/v2/news (api/v2/news_routes.py).
"""

import logging
import re
import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser
import requests

logger = logging.getLogger(__name__)

_GOOGLE_NEWS = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

# (category, Google News query). Categories drive the ticker's color coding.
_TOPICS: list[tuple[str, str]] = [
    ("Tariffs", "tariffs OR import duty when:7d"),
    ("Trade", '"trade war" OR "trade policy" OR "trade deal" when:7d'),
    ("Shipping", '"container shipping" OR "freight rates" OR "port congestion" when:7d'),
    ("Supply Chain", '"supply chain" disruption OR shortage when:7d'),
    ("Customs", "customs OR tariff classification OR import restrictions when:7d"),
    ("Manufacturing", '"manufacturing output" OR factory OR "industrial production" when:7d'),
    ("Geopolitics", "sanctions OR export controls OR trade embargo when:7d"),
]

# Direct industry RSS feeds (already trade/logistics focused).
_DIRECT_FEEDS: list[tuple[str, str]] = [
    ("Supply Chain", "https://www.supplychaindive.com/feeds/news/"),
    ("Logistics", "https://theloadstar.com/feed/"),
]

_MAX_ITEMS = 45
_TTL_SECONDS = 600  # 10 min
_REQUEST_TIMEOUT = 8
_USER_AGENT = "Mozilla/5.0 (compatible; CoastGuardNewsBot/1.0)"

_cache: dict = {"items": [], "fetched_at": None}
_lock = threading.Lock()


def _clean_title(title: str, source: str) -> str:
    """Google News titles are 'Headline - Source'; strip the trailing source."""
    if source and title.endswith(f" - {source}"):
        return title[: -(len(source) + 3)].strip()
    return re.sub(r"\s+-\s+[^-]+$", "", title).strip() if " - " in title else title.strip()


def _parse_published(entry) -> tuple[str | None, float]:
    raw = entry.get("published") or entry.get("updated") or ""
    if not raw:
        return None, 0.0
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(), dt.timestamp()
    except Exception:
        return raw, 0.0


def _fetch_feed(category: str, url: str) -> list[dict]:
    try:
        resp = requests.get(url, timeout=_REQUEST_TIMEOUT, headers={"User-Agent": _USER_AGENT})
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
    except Exception as exc:
        logger.warning("News feed fetch failed (%s): %s", category, str(exc)[:160])
        return []

    items = []
    for entry in parsed.entries[:15]:
        link = entry.get("link")
        title = entry.get("title", "").strip()
        if not link or not title:
            continue
        source = ""
        src = entry.get("source")
        if isinstance(src, dict):
            source = src.get("title", "")
        if not source:
            source = parsed.feed.get("title", category)
        published_iso, published_ts = _parse_published(entry)
        items.append({
            "title": _clean_title(title, source),
            "url": link,
            "source": source or "News",
            "category": category,
            "published": published_iso,
            "published_ts": published_ts,
        })
    return items


def _fetch_all() -> list[dict]:
    feeds = [(c, _GOOGLE_NEWS.format(q=requests.utils.quote(q))) for c, q in _TOPICS] + _DIRECT_FEEDS
    collected: list[dict] = []
    seen: set[str] = set()
    for category, url in feeds:
        for item in _fetch_feed(category, url):
            key = re.sub(r"[^a-z0-9]", "", item["title"].lower())[:60]
            if not key or key in seen:
                continue
            seen.add(key)
            collected.append(item)
    # Most recent first; undated entries sink to the bottom.
    collected.sort(key=lambda x: x["published_ts"], reverse=True)
    return collected[:_MAX_ITEMS]


def get_headlines(force: bool = False) -> dict:
    """Return cached headlines, refreshing if stale (or forced)."""
    now = time.time()
    fetched_at = _cache.get("fetched_at")
    is_fresh = fetched_at is not None and (now - fetched_at) < _TTL_SECONDS and _cache["items"]
    if is_fresh and not force:
        return {"items": _cache["items"], "fetched_at": fetched_at, "cached": True}

    with _lock:
        # Re-check after acquiring the lock (another thread may have refreshed).
        fetched_at = _cache.get("fetched_at")
        if not force and fetched_at and (time.time() - fetched_at) < _TTL_SECONDS and _cache["items"]:
            return {"items": _cache["items"], "fetched_at": fetched_at, "cached": True}
        items = _fetch_all()
        if items:
            _cache["items"] = items
            _cache["fetched_at"] = time.time()
        return {
            "items": _cache["items"],
            "fetched_at": _cache.get("fetched_at"),
            "cached": False,
        }


def prefetch() -> None:
    """Best-effort warm of the cache (called from a startup background thread)."""
    try:
        get_headlines(force=True)
        logger.info("News ticker cache warmed — %d headlines", len(_cache["items"]))
    except Exception as exc:
        logger.warning("News prefetch failed: %s", exc)
