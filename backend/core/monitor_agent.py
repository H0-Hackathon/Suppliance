"""
CoastGuard — Monitor Agent (Agent 1).

Primary path (USE_MOCK_LLM=false, GEMINI_API_KEY set):
  All in-flight articles (RSS cache + targeted Google News query) are sent
  to Gemini Flash in a single call via core/event_clusterer.py. The LLM
  groups them into event clusters and fully synthesizes the top cluster:
  title, description, event_type, affected_country, tariff_rate. Severity
  and confidence are then derived deterministically from the cluster's
  constituent articles using the signal extractors in collectors/tariff.py.

  The returned dict includes a `news` list — all articles in the winning
  cluster, each with title, url, domain, summary (400 chars), scraped_at.
  This list flows downstream to Agents 3-5 (Task 4) and to the frontend
  "Related News" panel (future).

Fallback path (no API key, LLM failure, or JSONL-only data):
  Deterministic best-pick using relevance_score + country/product boosts.
  Returns the same dict shape with `news: []`.

JSONL fallback (cache empty at startup):
  Reads data/tariff_dataset.jsonl + data/supply_chain_dataset.jsonl.
  Skips LLM clustering (stale data doesn't warrant an API call).
"""

import json
import logging
import pathlib
from typing import Optional

from collectors.tariff import (
    PRODUCTS,
    TARIFF_TERMS,
    TRADE_ACTIONS,
    calculate_relevance,
    extract_countries,
    extract_matches,
    extract_percentages,
)
from services.coordinates import get_country_name

logger = logging.getLogger(__name__)

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"
TARIFF_DATASET = DATA_DIR / "tariff_dataset.jsonl"
SUPPLY_CHAIN_DATASET = DATA_DIR / "supply_chain_dataset.jsonl"

PORT_KEYWORDS = ["port", "shipping", "freight", "vessel", "congestion", "container", "carrier"]
WEATHER_KEYWORDS = ["storm", "typhoon", "hurricane", "flood", "cyclone", "monsoon"]
EXPORT_CONTROL_KEYWORDS = ["export control", "export restriction", "export ban", "sanction"]

# HS chapter (first 2 digits) -> product keywords from collectors.tariff.PRODUCTS.
HS2_TO_PRODUCTS: dict[str, set[str]] = {
    "61": {"textile", "apparel", "garment", "cotton"},
    "62": {"textile", "apparel", "garment", "cotton"},
    "63": {"textile", "cotton"},
    "72": {"steel"},
    "73": {"steel"},
    "76": {"aluminum"},
    "84": {"electronics", "semiconductor", "chip", "battery", "solar"},
    "85": {"electronics", "semiconductor", "chip", "battery", "solar"},
    "87": {"automobile", "vehicle"},
    "30": {"pharmaceutical"},
}


def _load_jsonl(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                logger.warning("Skipping malformed JSONL line in %s", path)
    return records


def _pick_country(mentions: list[str]) -> Optional[str]:
    """Prefer a non-US country mention (the US is almost always the importer)."""
    candidates = [m for m in (mentions or []) if m != "united states"]
    chosen = candidates[0] if candidates else (mentions[0] if mentions else None)
    return chosen.title() if chosen else None


def _pick_product(mentions: list[str]) -> Optional[str]:
    return mentions[0].title() if mentions else None


def _max_percentage(percentages: list[str]) -> Optional[float]:
    if not percentages:
        return None
    try:
        return max(float(p.rstrip("%")) for p in percentages)
    except ValueError:
        return None


def _classify_event_type(text_lower: str, signals: dict) -> str:
    if signals["tariff_percentages"] or (
        set(signals["matched_terms"]) & set(TARIFF_TERMS)
    ):
        return "TARIFF"
    if any(k in text_lower for k in EXPORT_CONTROL_KEYWORDS):
        return "EXPORT_CONTROL"
    if any(k in text_lower for k in WEATHER_KEYWORDS):
        return "WEATHER"
    if any(k in text_lower for k in PORT_KEYWORDS):
        return "PORT_DISRUPTION"
    if signals["matched_terms"]:
        return "GEOPOLITICAL"
    return "SUPPLY_CHAIN"


def _score_severity(signals: dict, tariff_rate: Optional[float]) -> tuple[str, float]:
    """Deterministic severity + confidence from extracted signals — no LLM."""
    relevance = signals["relevance_score"]

    if tariff_rate is not None and tariff_rate >= 20:
        severity = "HIGH"
    elif tariff_rate is not None and tariff_rate >= 10:
        severity = "MEDIUM"
    elif relevance >= 15:
        severity = "HIGH"
    elif relevance >= 8:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    confidence = 0.4 + min(relevance, 20) * 0.025
    if tariff_rate is not None:
        confidence += 0.1
    confidence = round(min(confidence, 0.95), 2)

    return severity, confidence


def _extract_signals(text: str) -> dict:
    relevance_score, matched_terms = calculate_relevance(text)
    return {
        "relevance_score": relevance_score,
        "matched_terms": matched_terms,
        "country_mentions": extract_countries(text),
        "products_mentioned": extract_matches(text, PRODUCTS),
        "trade_actions": extract_matches(text, TRADE_ACTIONS),
        "tariff_percentages": extract_percentages(text),
    }


def _normalize_record(record: dict) -> dict:
    if "country_mentions" in record:
        # Already extracted by collectors/tariff.py
        signals = {
            "relevance_score": record.get("relevance_score", 0),
            "matched_terms": record.get("matched_terms", []),
            "country_mentions": record.get("country_mentions", []),
            "products_mentioned": record.get("products_mentioned", []),
            "trade_actions": record.get("trade_actions", []),
            "tariff_percentages": record.get("tariff_percentages", []),
        }
        text_lower = (record.get("full_text") or record.get("summary") or "").lower()
    else:
        # collectors/monitor.py record — run the same extraction on full_text
        text = record.get("full_text") or record.get("summary") or ""
        signals = _extract_signals(text)
        text_lower = text.lower()

    event_type = _classify_event_type(text_lower, signals)
    tariff_rate = _max_percentage(signals["tariff_percentages"])
    severity, confidence = _score_severity(signals, tariff_rate)

    return {
        "event_type": event_type,
        "affected_country": _pick_country(signals["country_mentions"]),
        "affected_product": _pick_product(signals["products_mentioned"]),
        "tariff_rate": tariff_rate,
        "severity": severity,
        "confidence": confidence,
        "relevance_score": signals["relevance_score"],
        "country_mentions": signals["country_mentions"],
        "products_mentioned": signals["products_mentioned"],
        "trade_actions": signals["trade_actions"],
        "title": record.get("title", ""),
        "summary": (record.get("summary") or "")[:500],
        "source_url": record.get("source_url") or record.get("url"),
        "domain": record.get("domain"),
    }


def _hs_code_to_products(hs_code: Optional[str]) -> set[str]:
    if not hs_code:
        return set()
    return HS2_TO_PRODUCTS.get(hs_code[:2], set())


def _empty_result(country_label: Optional[str]) -> dict:
    return {
        "risk_detected": False,
        "event": "No tariff or supply-chain events found in collector data.",
        "event_type": None,
        "country": country_label,
        "product": None,
        "tariff_rate": None,
        "severity": "LOW",
        "confidence": 0.2,
        "source": "monitor_agent",
        "source_url": None,
        "summary": None,
        "news": [],
    }


def _build_cluster_result(
    cluster: dict,
    all_articles: list[dict],
    country_label: Optional[str],
    hs_code: Optional[str],
) -> dict:
    """
    Turn an LLM cluster dict into the final event dict returned by get_latest_event().
    Severity and confidence are derived deterministically from the cluster articles'
    extracted signals so the LLM only handles synthesis, not risk scoring.
    """
    indices = cluster.get("article_indices") or []
    cluster_articles = [all_articles[i] for i in indices if i < len(all_articles)]

    # Deterministic severity/confidence from the cluster's constituent articles
    tariff_rate = cluster.get("tariff_rate")
    if cluster_articles:
        normalized = [_normalize_record(r) for r in cluster_articles]
        max_relevance = max(e["relevance_score"] for e in normalized)
        if tariff_rate is None:
            all_pcts = []
            for e in normalized:
                # _normalize_record doesn't preserve tariff_percentages as strings,
                # but tariff_rate (float) is already the max. Use the largest across
                # cluster articles as a fallback.
                if e["tariff_rate"] is not None:
                    all_pcts.append(e["tariff_rate"])
            tariff_rate = max(all_pcts) if all_pcts else None
        severity, confidence = _score_severity(
            {"relevance_score": max_relevance}, tariff_rate
        )
    else:
        severity, confidence = "MEDIUM", 0.6

    # Source URL: first cluster article that has one
    source_url = None
    for a in cluster_articles:
        u = a.get("source_url") or a.get("url")
        if u:
            source_url = u
            break

    # Product label from HS code mapping
    product_terms = _hs_code_to_products(hs_code)
    product = next(iter(product_terms), None)

    # news list passed to Agents 3-5 and the future frontend panel
    news = [
        {
            "title": a.get("title", ""),
            "url": a.get("source_url") or a.get("url", ""),
            "domain": a.get("domain", ""),
            "summary": (a.get("summary") or a.get("full_text") or "")[:400],
            "scraped_at": a.get("scraped_at", ""),
        }
        for a in cluster_articles
    ]

    return {
        "risk_detected": cluster.get("event_type") in {
            "TARIFF", "EXPORT_CONTROL", "PORT_DISRUPTION", "WEATHER", "GEOPOLITICAL"
        },
        "event": cluster["title"],
        "event_type": cluster["event_type"],
        "country": cluster.get("affected_country") or country_label,
        "product": product.title() if product else None,
        "tariff_rate": tariff_rate,
        "severity": severity,
        "confidence": confidence,
        "source": "event_clusterer",
        "source_url": source_url,
        "summary": cluster.get("description", ""),
        "news": news,
    }


def load_events() -> list[dict]:
    """
    Fallback loader: normalize records from the on-disk JSONL datasets.
    Used when the in-memory article cache (core/article_cache) is empty
    (e.g. server started without network access or before the startup
    scrape completed). LLM clustering is skipped for JSONL data.
    """
    records = _load_jsonl(TARIFF_DATASET) + _load_jsonl(SUPPLY_CHAIN_DATASET)
    return [_normalize_record(r) for r in records]


def get_latest_event(
    supplier_country: Optional[str] = None,
    hs_code: Optional[str] = None,
    articles: Optional[list] = None,
) -> dict:
    """
    Agent 1's main entrypoint: return the most relevant event for this
    supplier country / HS code, with a supporting `news` list.

    Primary path: all in-flight articles → Gemini Flash clustering →
    synthesized Event + news list.

    Fallback path (LLM unavailable): deterministic relevance-score ranking,
    news list is empty.

    articles: pre-collected article dicts from monitor_routes.py
              (RSS cache + targeted Google News query). When None, reads
              from core/article_cache, then falls back to JSONL datasets.
    """
    country_label = get_country_name(supplier_country) if supplier_country else None

    # ── Resolve article source ─────────────────────────────────────────────────
    using_live = True
    pre_normalized_events: Optional[list] = None

    if articles is not None:
        live_articles = articles
    else:
        from core.article_cache import get_articles
        live_articles = get_articles()
        if not live_articles:
            logger.info("Article cache empty — falling back to JSONL datasets")
            pre_normalized_events = load_events()
            using_live = False

    if using_live and not live_articles:
        return _empty_result(country_label)
    if not using_live and not pre_normalized_events:
        return _empty_result(country_label)

    # ── LLM clustering (live articles only) ───────────────────────────────────
    if using_live:
        from config import get_settings
        _settings = get_settings()
        if not _settings.use_mock_llm and _settings.gemini_api_key:
            from core.event_clusterer import cluster_articles as _cluster
            cluster = _cluster(
                articles=live_articles,
                supplier_country=country_label or supplier_country or "any country",
                hs_code=hs_code,
                api_key=_settings.gemini_api_key,
            )
            if cluster:
                return _build_cluster_result(
                    cluster=cluster,
                    all_articles=live_articles,
                    country_label=country_label,
                    hs_code=hs_code,
                )
            logger.warning("LLM clustering returned None — falling back to deterministic ranking")

    # ── Deterministic fallback ─────────────────────────────────────────────────
    if pre_normalized_events is not None:
        events = pre_normalized_events
    else:
        events = [_normalize_record(r) for r in live_articles]

    if not events:
        return _empty_result(country_label)

    country_name = country_label.lower() if country_label else None
    product_terms = _hs_code_to_products(hs_code)

    def _rank(event: dict) -> float:
        score = event["relevance_score"]
        if country_name and country_name in [c.lower() for c in event["country_mentions"]]:
            # Must dominate the relevance_score range so a country-specific
            # article always outranks a broad multi-country "tracker" article
            # (those can rack up relevance_score 30+ just from mentioning many
            # countries/products). relevance_score still breaks ties.
            score += 100
        if product_terms & {p.lower() for p in event["products_mentioned"]}:
            score += 10
        return score

    best = max(events, key=_rank)

    risk_detected = best["event_type"] in {
        "TARIFF", "EXPORT_CONTROL", "PORT_DISRUPTION", "WEATHER", "GEOPOLITICAL",
    }

    # If the queried country is mentioned in this event, prefer it over
    # _pick_country()'s alphabetical first-non-US pick.
    event_country = best["affected_country"] or country_label
    if country_name and country_name in [c.lower() for c in best["country_mentions"]]:
        event_country = country_label

    return {
        "risk_detected": risk_detected,
        "event": best["title"],
        "event_type": best["event_type"],
        "country": event_country,
        "product": best["affected_product"],
        "tariff_rate": best["tariff_rate"],
        "severity": best["severity"],
        "confidence": best["confidence"],
        "source": "monitor_agent",
        "source_url": best["source_url"],
        "summary": best["summary"],
        "news": [],
    }
