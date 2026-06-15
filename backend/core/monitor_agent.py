"""
CoastGuard — Monitor Agent (Agent 1).

Reads the two collector datasets:
  data/tariff_dataset.jsonl        (collectors/tariff.py — Bing news)
  data/supply_chain_dataset.jsonl  (collectors/monitor.py — RSS feeds)

and normalizes each article into a structured risk event:

    {
        "event_type": "TARIFF",
        "affected_country": "Vietnam",
        "affected_product": "Textiles",
        "tariff_rate": 25.0,
        "severity": "HIGH",
        "confidence": 0.91,
        ...
    }

This is a pure data-extraction step — NO LLM call. event_type, severity and
confidence are derived deterministically from signals already extracted by
the collectors (country/product mentions, trade actions, tariff percentages,
relevance score). This replaces the GDELT tool as the TariffMonitor agent's
data source in core/crew_monitor_pipeline.py.
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
    """Prefer a non-US country mention (the US is almost always mentioned as
    the importer, not the affected supplier country)."""
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


def load_events() -> list[dict]:
    """Load + normalize every record from both collector datasets."""
    records = _load_jsonl(TARIFF_DATASET) + _load_jsonl(SUPPLY_CHAIN_DATASET)
    return [_normalize_record(r) for r in records]


def get_latest_event(supplier_country: Optional[str] = None, hs_code: Optional[str] = None) -> dict:
    """
    Agent 1's main entrypoint: pick the single most relevant normalized event
    for the given supplier country / HS code.

    Returns a dict shaped for `agent_outputs["tariff_monitor"]` in
    core/crew_monitor_pipeline.py — keeps "risk_detected", "event",
    "confidence", "source" for backwards compatibility with the existing
    AlertCard reasoning UI, plus structured fields (event_type, country,
    product, tariff_rate, severity) for the Impact Agent (Agent 2).
    """
    events = load_events()
    country_label = get_country_name(supplier_country) if supplier_country else None

    if not events:
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
        }

    country_name = country_label.lower() if country_label else None
    product_terms = _hs_code_to_products(hs_code)

    def _rank(event: dict) -> float:
        score = event["relevance_score"]
        if country_name and country_name in [c.lower() for c in event["country_mentions"]]:
            # Must dominate the relevance_score range so a country-specific
            # article always outranks a broad multi-country "tracker" article
            # (those can rack up relevance_score 30+ just from mentioning many
            # countries/products). relevance_score still breaks ties between
            # multiple country-matching events, and is still the sole ranking
            # signal when nothing mentions the queried country at all.
            score += 100
        if product_terms & {p.lower() for p in event["products_mentioned"]}:
            score += 10
        return score

    best = max(events, key=_rank)

    risk_detected = best["event_type"] in {
        "TARIFF", "EXPORT_CONTROL", "PORT_DISRUPTION", "WEATHER", "GEOPOLITICAL",
    }

    # _pick_country() picks the first non-US country mention alphabetically,
    # which can be a different country than the one this customer actually
    # sources from (e.g. an India-focused article that also name-drops China
    # would otherwise report "China" for a customer asking about India). If
    # the queried supplier_country is itself mentioned in this event, prefer
    # it — that's the country this alert is actually about for this customer.
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
    }
