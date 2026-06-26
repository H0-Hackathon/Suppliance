"""
CoastGuard — 5-Agent Tariff Monitoring Pipeline

Aurora data flow every run:
  1. RssArticle rows written   (temporary buffer — deleted after run)
  2. HistoricalImpact queried  → enriches ImpactCalculator prompt
  3. SupplierRecommendation queried → enriches AlternativesFinder prompt
  4. AgentRun queried          → enriches Adversarial prompt
  5. AgentRun row written      (permanent run log)
  6. HistoricalImpact row written (permanent, enriched with all signal metadata)
  7. SupplierRecommendation rows written (permanent per alternative)
  8. RssArticle rows deleted   (buffer cleared)
"""

import json
import logging
import re
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from config import get_settings
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)
settings = get_settings()

# Approximate country centroids for DisruptionEvent globe visualization
COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "Colombia": (4.1, -72.3), "Brazil": (-10.0, -55.0), "Mexico": (23.6, -102.5),
    "Philippines": (12.9, 121.8), "India": (20.6, 78.9), "China": (35.9, 104.2),
    "Vietnam": (14.1, 108.3), "Thailand": (15.9, 100.9), "Indonesia": (-0.8, 113.9),
    "Honduras": (15.2, -86.2), "Ecuador": (-1.8, -78.2), "Peru": (-9.2, -75.0),
    "Guatemala": (15.8, -90.2), "Costa Rica": (9.7, -83.8), "El Salvador": (13.8, -88.9),
    "Dominican Republic": (18.7, -70.2), "Japan": (36.2, 138.3), "South Korea": (35.9, 127.8),
    "Taiwan": (23.7, 120.9), "Malaysia": (4.2, 108.0), "Bangladesh": (23.7, 90.4),
    "Pakistan": (30.4, 69.3), "Sri Lanka": (7.9, 80.8), "Cambodia": (12.6, 104.9),
    "Myanmar": (17.1, 96.9), "Argentina": (-34.0, -64.0), "Chile": (-35.7, -71.5),
    "Canada": (56.1, -106.3), "Australia": (-25.3, 133.8), "Turkey": (38.9, 35.2),
    "Egypt": (26.8, 30.8), "Morocco": (31.8, -7.1), "Kenya": (-0.0, 37.9),
    "Ethiopia": (9.1, 40.5), "Ghana": (7.9, -1.0), "South Africa": (-30.6, 22.9),
    "United States": (37.1, -95.7), "United Kingdom": (55.4, -3.4), "Germany": (51.2, 10.5),
    "Netherlands": (52.1, 5.3), "Italy": (42.8, 12.8), "Spain": (40.5, -3.7),
    "France": (46.2, 2.2), "Portugal": (39.4, -8.2), "Nigeria": (9.1, 8.7),
    "Saudi Arabia": (23.9, 45.1), "United Arab Emirates": (24.0, 53.8),
}

ALERT_CAP = 10

try:
    from crewai import Agent, Task, Crew, LLM
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False


# ── Live pipeline log ─────────────────────────────────────────────────────────

_log_lock = threading.Lock()
_pipeline_log: deque = deque(maxlen=1000)


def pipeline_emit(event: str, msg: str) -> None:
    logger.info(f"[pipeline:{event}] {msg}")
    with _log_lock:
        _pipeline_log.append({
            "event": event,
            "msg": msg,
            "ts": datetime.now(timezone.utc).isoformat(),
        })


def get_pipeline_log() -> list:
    with _log_lock:
        return list(_pipeline_log)


def clear_pipeline_log() -> None:
    with _log_lock:
        _pipeline_log.clear()


# ── LLM initializer ───────────────────────────────────────────────────────────

def _init_gemini_llm() -> "LLM":
    if not HAS_CREWAI:
        raise RuntimeError("CrewAI is not installed.")
    api_key = settings.gemini_api_key
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    import os
    os.environ.setdefault("GOOGLE_API_KEY", api_key)
    return LLM(model=settings.gemini_model, api_key=api_key)


# ── RSS fetch + Aurora buffer ─────────────────────────────────────────────────

def _fetch_and_buffer_articles(
    rss_keywords: list,
    origin_countries: list,
    run_id: str,
    customer_id: int,
    db: Optional[Session],
    top_n: int = 5,
) -> tuple[list, dict]:
    """
    Fetch RSS articles via fast_run, score them, write matched ones to Aurora
    rss_articles table, then read back from Aurora and return as formatted blocks.

    Returns:
        (article_text_blocks, signal_metadata)
    """
    pipeline_emit("rss_start", f"Fetching RSS feeds — keywords: {', '.join(rss_keywords[:5])}")

    try:
        from collectors.monitor import fast_run
        raw_articles = fast_run(max_articles=60, emit_fn=pipeline_emit)
        pipeline_emit("rss_fetched", f"{len(raw_articles)} entries from {len(set(a.get('source','') for a in raw_articles))} sources")
    except Exception as exc:
        logger.warning(f"RSS collector failed: {exc}")
        pipeline_emit("rss_error", f"RSS fetch failed: {exc}")
        return [], {"articles_matched": 0, "source_credibility": "", "signal_age_hours": None, "risk_source": "gemini_knowledge"}

    # Authoritative sources that boost credibility score
    CREDIBLE_SOURCES = {"usda", "ustr", "trade.gov", "fas.usda", "cbp", "commerce"}

    def score(article: dict) -> int:
        haystack = " ".join(filter(None, [
            article.get("title", ""),
            article.get("summary", ""),
            article.get("feed_description", ""),
            article.get("full_text", "")[:1000],
            " ".join(article.get("keywords", [])),
        ])).lower()
        s = 0
        for kw in rss_keywords:
            if kw.lower() in haystack:
                s += 2
        for country in origin_countries:
            if country.lower() in haystack:
                s += 3
        for broad in ["tariff", "import duty", "trade policy", "customs", "sanction", "embargo"]:
            if broad in haystack:
                s += 1
        return s

    scored = sorted(raw_articles, key=score, reverse=True)
    matched = [a for a in scored if score(a) > 0][:top_n]
    if not matched:
        matched = scored[:min(top_n, len(scored))]
        pipeline_emit("rss_done", f"No exact keyword matches — using top {len(matched)} general trade articles")
    else:
        for a in matched:
            pipeline_emit("rss_match", f"Matched: \"{a.get('title','')[:80]}\" (score={score(a)})")

    # Identify which authoritative sources fired
    credible_fired = []
    for a in matched:
        src = a.get("source", "").lower() + a.get("url", "").lower()
        for cred in CREDIBLE_SOURCES:
            if cred in src:
                credible_fired.append(cred)

    # Compute signal age (hours since newest article)
    signal_age_hours = None
    try:
        from email.utils import parsedate_to_datetime
        pub_dates = []
        for a in matched:
            try:
                pub_dates.append(parsedate_to_datetime(a.get("published", "")))
            except Exception:
                pass
        if pub_dates:
            newest = max(pub_dates)
            if newest.tzinfo is None:
                newest = newest.replace(tzinfo=timezone.utc)
            delta = datetime.now(timezone.utc) - newest
            signal_age_hours = round(delta.total_seconds() / 3600, 1)
    except Exception:
        pass

    signal_meta = {
        "articles_matched": len(matched),
        "source_credibility": ",".join(sorted(set(credible_fired))) if credible_fired else "",
        "signal_age_hours": signal_age_hours,
        "risk_source": "rss" if matched and any(score(a) > 0 for a in matched) else "gemini_knowledge",
    }

    # Write matched articles to Aurora rss_articles buffer
    if db:
        try:
            from models import RssArticle
            for a in matched:
                title_lower = (a.get("title", "") + " " + a.get("summary", "")).lower()
                country_mentioned = next(
                    (c for c in origin_countries if c.lower() in title_lower), None
                )
                db.add(RssArticle(
                    run_id=run_id,
                    customer_id=customer_id,
                    title=a.get("title", "")[:500],
                    url=a.get("url", "")[:1000],
                    source=a.get("source", "")[:255],
                    published_at=a.get("published", "")[:100],
                    body=(a.get("summary") or a.get("feed_description") or "")[:4000],
                    relevance_score=score(a),
                    country_mentioned=country_mentioned,
                    agent_target="tariff_monitor",
                ))
            db.commit()
            pipeline_emit("rss_buffered", f"Wrote {len(matched)} articles to Aurora rss_articles [tariff_monitor] (run_id={run_id[:8]}…)")
        except Exception as exc:
            logger.warning(f"RSS Aurora write failed: {exc}")
            db.rollback()

    # Read back from Aurora to build prompt context (Aurora is the data source for agents)
    article_blocks = []
    if db:
        try:
            from models import RssArticle
            rows = db.query(RssArticle).filter(
                RssArticle.run_id == run_id,
                RssArticle.customer_id == customer_id,
                RssArticle.agent_target == "tariff_monitor",
            ).order_by(RssArticle.relevance_score.desc()).all()

            for i, row in enumerate(rows, 1):
                article_blocks.append(
                    f"[Article {i}] {row.title}\n"
                    f"Source: {row.source} | Published: {row.published_at}"
                    + (f" | Country: {row.country_mentioned}" if row.country_mentioned else "")
                    + f"\nSummary: {(row.body or '')[:400]}"
                )
            pipeline_emit("rss_read_back", f"Read {len(rows)} articles from Aurora rss_articles for agent context")
        except Exception as exc:
            logger.warning(f"RSS Aurora read-back failed: {exc}")
            # Fall back to in-memory articles
            for i, a in enumerate(matched, 1):
                article_blocks.append(
                    f"[Article {i}] {a.get('title','')}\n"
                    f"Source: {a.get('source','')} | Summary: {a.get('summary','')[:400]}"
                )

    return article_blocks, signal_meta


# ── Historical impact query (ImpactCalculator enrichment) ─────────────────────

def _get_historical_impacts(db: Optional[Session], customer_id: int, countries: list, limit: int = 5) -> str:
    """
    Query historical_impacts for past events affecting this customer and their origin countries.
    Returns a formatted text block for the ImpactCalculator prompt.
    """
    if not db:
        return ""
    try:
        country_conditions = " OR ".join([f"country ILIKE '%{c}%'" for c in countries]) if countries else "1=1"
        rows = db.execute(text(f"""
            SELECT event_type, country, actual_loss, severity, adversarial_verdict,
                   articles_matched, affected_hs_codes, supplier_alternatives_found,
                   confidence, event_text, created_at
            FROM historical_impacts
            WHERE (customer_id = :cid OR customer_id IS NULL)
              AND ({country_conditions})
            ORDER BY created_at DESC
            LIMIT :lim
        """), {"cid": customer_id, "lim": limit}).fetchall()

        if not rows:
            return ""

        lines = [f"Past recorded impacts for similar events ({len(rows)} records):"]
        for r in rows:
            date_str = r[10].strftime("%Y-%m-%d") if r[10] else "unknown date"
            lines.append(
                f"  [{date_str}] {r[0]} | Country: {r[1]} | Loss: ${r[2]:,.0f} | "
                f"Severity: {r[3]} | Verdict: {r[4]} | "
                f"Articles that triggered: {r[5] or 0} | "
                f"Alternatives found: {r[7] or 0}"
                + (f" | Note: {r[9][:80]}" if r[9] else "")
            )
        pipeline_emit("db_history", f"Loaded {len(rows)} historical impact records for ImpactCalculator")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning(f"Historical impact query failed: {exc}")
        return ""


# ── Past supplier recommendations query (AlternativesFinder enrichment) ───────

def _get_past_supplier_recommendations(db: Optional[Session], customer_id: int, limit: int = 10) -> str:
    """
    Query supplier_recommendations for what has been suggested before for this customer.
    Returned as text for the AlternativesFinder prompt.
    """
    if not db:
        return ""
    try:
        rows = db.execute(text("""
            SELECT supplier_name, country, lead_time_weeks, cost_delta_pct,
                   source, adversarial_verdict, created_at
            FROM supplier_recommendations
            WHERE customer_id = :cid
            ORDER BY created_at DESC
            LIMIT :lim
        """), {"cid": customer_id, "lim": limit}).fetchall()

        if not rows:
            return ""

        lines = [f"Previously recommended/rejected suppliers for this customer ({len(rows)} records):"]
        for r in rows:
            date_str = r[6].strftime("%Y-%m-%d") if r[6] else "?"
            verdict = r[5] or "unknown"
            flag = " ⚠ DO NOT SUGGEST AGAIN" if verdict in ("BLOCK", "REJECTED_BY_COMPLIANCE") else ""
            lines.append(
                f"  [{date_str}] {r[0]} ({r[1]}) — {r[2]}wk lead, {'+' if (r[3] or 0) >= 0 else ''}{r[3] or 0}% cost | "
                f"source={r[4]} | verdict={verdict}{flag}"
            )
        pipeline_emit("db_past_suppliers", f"Loaded {len(rows)} past supplier recommendations for AlternativesFinder")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning(f"Past supplier recommendations query failed: {exc}")
        return ""


# ── Past agent run history (Adversarial enrichment) ───────────────────────────

def _get_agent_run_history(db: Optional[Session], customer_id: int, limit: int = 10) -> str:
    """
    Query agent_runs for historical run outcomes for this customer.
    Returned as text for the Adversarial agent prompt.
    """
    if not db:
        return ""
    try:
        rows = db.execute(text("""
            SELECT run_id, started_at, adversarial_verdict, severity,
                   extra_cost_usd, articles_matched, event_type, affected_countries
            FROM agent_runs
            WHERE customer_id = :cid AND status = 'completed'
            ORDER BY started_at DESC
            LIMIT :lim
        """), {"cid": customer_id, "lim": limit}).fetchall()

        if not rows:
            return ""

        block_counts = {"CLEAR": 0, "CAUTION": 0, "BLOCK": 0}
        for r in rows:
            v = r[2] or ""
            if v in block_counts:
                block_counts[v] += 1

        lines = [
            f"Historical pipeline runs for this customer ({len(rows)} runs): "
            f"CLEAR={block_counts['CLEAR']} CAUTION={block_counts['CAUTION']} BLOCK={block_counts['BLOCK']}"
        ]
        for r in rows:
            date_str = r[1].strftime("%Y-%m-%d %H:%M") if r[1] else "?"
            lines.append(
                f"  [{date_str}] verdict={r[2] or '?'} severity={r[3] or '?'} "
                f"cost=${r[4]:,.0f} articles={r[5] or 0} type={r[6] or '?'}"
            )
        pipeline_emit("db_run_history", f"Loaded {len(rows)} past run records for Adversarial agent")
        return "\n".join(lines)
    except Exception as exc:
        logger.warning(f"Agent run history query failed: {exc}")
        return ""


# ── Compliance RSS fetch (Aurora-buffered) ────────────────────────────────────

def _fetch_compliance_articles(
    origin_countries: list,
    hs_codes: list,
    dest_port: str,
    run_id: str,
    customer_id: int,
    db,
) -> str:
    """
    Fetch live regulatory/compliance articles (Federal Register, FDA, APHIS).
    Writes to Aurora rss_articles with agent_target='import_compliance'.
    Reads back from Aurora. Deleted at end of pipeline with the rest.
    Returns formatted text block for ImportCompliance agent prompt.
    """
    pipeline_emit("compliance_rss_start", f"Fetching compliance feeds — HS: {', '.join(hs_codes[:3])} | Port: {dest_port}")
    try:
        from collectors.monitor import fast_run_compliance
        articles = fast_run_compliance(
            origin_countries=origin_countries,
            hs_codes=hs_codes,
            dest_port=dest_port,
            max_articles=20,
            emit_fn=pipeline_emit,
        )
    except Exception as exc:
        logger.warning(f"Compliance RSS fetch failed: {exc}")
        pipeline_emit("compliance_rss_error", f"Compliance feed fetch failed: {exc}")
        return ""

    if not articles:
        pipeline_emit("compliance_rss_done", "No compliance articles retrieved")
        return ""

    # Write to Aurora buffer
    if db:
        try:
            from models import RssArticle
            for a in articles[:10]:
                db.add(RssArticle(
                    run_id=run_id,
                    customer_id=customer_id,
                    title=a.get("title", "")[:500],
                    url=a.get("url", "")[:1000],
                    source=a.get("source", "")[:255],
                    published_at=a.get("published", "")[:100],
                    body=(a.get("summary") or a.get("feed_description") or "")[:4000],
                    relevance_score=0,
                    agent_target="import_compliance",
                ))
            db.commit()
            pipeline_emit("compliance_rss_buffered", f"Wrote {min(10, len(articles))} compliance articles to Aurora [import_compliance]")
        except Exception as exc:
            logger.warning(f"Compliance RSS Aurora write failed: {exc}")
            db.rollback()

    # Read back from Aurora
    blocks = []
    if db:
        try:
            from models import RssArticle
            rows = db.query(RssArticle).filter(
                RssArticle.run_id == run_id,
                RssArticle.agent_target == "import_compliance",
            ).limit(5).all()
            for i, row in enumerate(rows, 1):
                blocks.append(
                    f"[Reg {i}] {row.title}\n"
                    f"Source: {row.source} | Published: {row.published_at}\n"
                    f"Summary: {(row.body or '')[:400]}"
                )
            pipeline_emit("compliance_rss_done", f"Read {len(rows)} compliance articles back from Aurora for ImportCompliance")
        except Exception as exc:
            logger.warning(f"Compliance RSS read-back failed: {exc}")
            for i, a in enumerate(articles[:5], 1):
                blocks.append(
                    f"[Reg {i}] {a.get('title', '')}\n"
                    f"Source: {a.get('source', '')} | Published: {a.get('published', '')}\n"
                    f"Summary: {(a.get('summary') or '')[:400]}"
                )
    else:
        for i, a in enumerate(articles[:5], 1):
            blocks.append(
                f"[Reg {i}] {a.get('title', '')}\n"
                f"Source: {a.get('source', '')} | Published: {a.get('published', '')}\n"
                f"Summary: {(a.get('summary') or '')[:400]}"
            )

    return "\n\n".join(blocks)


# ── Alternatives RSS fetch (Aurora-buffered) ──────────────────────────────────

def _fetch_alternatives_articles(
    alternative_regions: list,
    product_categories: list,
    origin_countries: list,
    run_id: str,
    customer_id: int,
    db,
) -> str:
    """
    Fetch supplier-stability RSS for alternative sourcing regions (MercoPress,
    Latinvex, SupplyChainBrain, FAO, World Bank, etc.).
    Scores by stability signals in alternative regions vs. the product category.
    Writes to Aurora rss_articles with agent_target='alternatives_finder'.
    Reads back from Aurora. Deleted at end of pipeline with the rest.
    Returns formatted text block for AlternativesFinder agent prompt.
    """
    pipeline_emit("alt_rss_start", f"Fetching alternatives stability feeds — regions: {', '.join(alternative_regions[:4])}")
    try:
        from collectors.monitor import fast_run_alternatives
        articles = fast_run_alternatives(
            alternative_regions=alternative_regions,
            product_categories=product_categories,
            origin_countries=origin_countries,
            max_articles=20,
            emit_fn=pipeline_emit,
        )
    except Exception as exc:
        logger.warning(f"Alternatives RSS fetch failed: {exc}")
        pipeline_emit("alt_rss_error", f"Alternatives feed fetch failed: {exc}")
        return ""

    if not articles:
        pipeline_emit("alt_rss_done", "No alternatives stability articles retrieved")
        return ""

    # Write to Aurora buffer
    if db:
        try:
            from models import RssArticle
            for a in articles[:10]:
                title_lower = (a.get("title", "") + " " + a.get("summary", "")).lower()
                country_mentioned = next(
                    (r for r in alternative_regions if r.lower() in title_lower), None
                )
                db.add(RssArticle(
                    run_id=run_id,
                    customer_id=customer_id,
                    title=a.get("title", "")[:500],
                    url=a.get("url", "")[:1000],
                    source=a.get("source", "")[:255],
                    published_at=a.get("published", "")[:100],
                    body=(a.get("summary") or a.get("feed_description") or "")[:4000],
                    relevance_score=0,
                    country_mentioned=country_mentioned,
                    agent_target="alternatives_finder",
                ))
            db.commit()
            pipeline_emit("alt_rss_buffered", f"Wrote {min(10, len(articles))} stability articles to Aurora [alternatives_finder]")
        except Exception as exc:
            logger.warning(f"Alternatives RSS Aurora write failed: {exc}")
            db.rollback()

    # Read back from Aurora
    blocks = []
    if db:
        try:
            from models import RssArticle
            rows = db.query(RssArticle).filter(
                RssArticle.run_id == run_id,
                RssArticle.agent_target == "alternatives_finder",
            ).limit(5).all()
            for i, row in enumerate(rows, 1):
                country_tag = f" | Country: {row.country_mentioned}" if row.country_mentioned else ""
                blocks.append(
                    f"[Region {i}] {row.title}\n"
                    f"Source: {row.source} | Published: {row.published_at}{country_tag}\n"
                    f"Summary: {(row.body or '')[:400]}"
                )
            pipeline_emit("alt_rss_done", f"Read {len(rows)} stability articles back from Aurora for AlternativesFinder")
        except Exception as exc:
            logger.warning(f"Alternatives RSS read-back failed: {exc}")
            for i, a in enumerate(articles[:5], 1):
                blocks.append(
                    f"[Region {i}] {a.get('title', '')}\n"
                    f"Source: {a.get('source', '')} | Published: {a.get('published', '')}\n"
                    f"Summary: {(a.get('summary') or '')[:400]}"
                )
    else:
        for i, a in enumerate(articles[:5], 1):
            blocks.append(
                f"[Region {i}] {a.get('title', '')}\n"
                f"Source: {a.get('source', '')} | Published: {a.get('published', '')}\n"
                f"Summary: {(a.get('summary') or '')[:400]}"
            )

    return "\n\n".join(blocks)


# ── Global supplier lookup ────────────────────────────────────────────────────

def _get_alternative_suppliers(
    db: Session,
    product_categories: list,
    excluded_countries: list,
    min_rating: float,
    limit: int = 5,
) -> str:
    if not db or not product_categories:
        return ""
    try:
        category_filters = " OR ".join(
            [f"product_category ILIKE '%{cat}%'" for cat in product_categories]
        )
        excluded = ", ".join([f"'{c}'" for c in excluded_countries])
        query = text(f"""
            SELECT business_name, country, city, product_category,
                   supplier_rating, lead_time_days, export_markets
            FROM global_suppliers
            WHERE ({category_filters})
              AND country NOT IN ({excluded})
              AND supplier_rating >= :min_rating
            ORDER BY supplier_rating DESC
            LIMIT :limit
        """)
        rows = db.execute(query, {"min_rating": min_rating, "limit": limit}).fetchall()
        if not rows:
            pipeline_emit("db_suppliers", "No matching suppliers in global_suppliers")
            return ""
        lines = ["Verified suppliers from CoastGuard database (prioritize these):"]
        for i, r in enumerate(rows, 1):
            lines.append(
                f"{i}. {r[0]} | {r[2]}, {r[1]} | Category: {r[3]} | "
                f"Rating: {r[4]}/5 | Lead time: {r[5]} days"
            )
        pipeline_emit("db_suppliers", f"Found {len(rows)} alternative suppliers: " +
                      ", ".join(f"{r[0]} ({r[1]})" for r in rows))
        return "\n".join(lines)
    except Exception as exc:
        logger.warning(f"Supplier lookup failed: {exc}")
        pipeline_emit("db_error", f"Supplier lookup failed: {exc}")
        return ""


# ── Alert cap ────────────────────────────────────────────────────────────────

def _enforce_alert_cap(db: Session, customer_id: int) -> None:
    try:
        from models import TariffAlert
        alerts = (
            db.query(TariffAlert)
            .filter(TariffAlert.customer_id == customer_id)
            .order_by(TariffAlert.created_at.desc())
            .all()
        )
        if len(alerts) > ALERT_CAP:
            for old in alerts[ALERT_CAP:]:
                db.delete(old)
            db.commit()
            logger.info(f"Alert cap: pruned {len(alerts) - ALERT_CAP} old alerts for customer {customer_id}")
    except Exception as exc:
        logger.warning(f"Alert cap enforcement failed: {exc}")


# ── Pipeline ──────────────────────────────────────────────────────────────────

class MonitorPipeline:

    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            self._llm = _init_gemini_llm()
        return self._llm

    def run(self, customer_id: int, db: Optional[Session] = None) -> dict:
        if settings.use_mock_llm:
            return self._mock_run(customer_id, db)
        return self._real_run(customer_id, db)

    def _load_profile(self, customer_id: int, db: Optional[Session]) -> dict:
        if db is None:
            return {}
        try:
            from models import Customer, BusinessProfile
            customer = db.query(Customer).filter(Customer.id == customer_id).first()
            profile = db.query(BusinessProfile).filter(BusinessProfile.customer_id == customer_id).first()
            if not customer or not profile:
                return {}
            return {
                "company_name": customer.company_name or customer.name,
                "industry": customer.industry or "",
                "business_type": profile.business_type or "",
                "annual_import_volume_usd": profile.annual_import_volume_usd or 0,
                "primary_hs_codes": profile.primary_hs_codes or [],
                "primary_origin_countries": profile.primary_origin_countries or [],
                "destination_country": profile.destination_country or "United States",
                "destination_port": profile.destination_port or "",
                "import_region": profile.import_region or "",
                "risk_tolerance": profile.risk_tolerance or "medium",
                "product_categories": profile.product_categories or [],
                "product_descriptions": profile.product_descriptions or [],
                "rss_keywords": profile.rss_keywords or [],
                "typical_order_value_usd": profile.typical_order_value_usd or 50000,
                "avg_lead_time_days": profile.avg_lead_time_days or 30,
                "compliance_notes": profile.compliance_notes or "",
                "preferred_alternative_regions": profile.preferred_alternative_regions or [],
                "min_supplier_rating": profile.min_supplier_rating or 3.0,
            }
        except Exception as exc:
            logger.warning(f"Profile load failed for customer {customer_id}: {exc}")
            return {}

    # ── Mock mode ─────────────────────────────────────────────────────────────

    def _mock_run(self, customer_id: int, db: Optional[Session]) -> dict:
        ctx = self._load_profile(customer_id, db)
        company = ctx.get("company_name", f"Customer {customer_id}")
        countries = ctx.get("primary_origin_countries", ["Unknown"])
        hs_codes = ctx.get("primary_hs_codes", ["0000.00"])
        annual_vol = ctx.get("annual_import_volume_usd", 50000)
        risk = ctx.get("risk_tolerance", "medium")
        descriptions = ctx.get("product_descriptions", ["goods"])
        typical_order = ctx.get("typical_order_value_usd", 50000)

        affected_country = countries[0] if countries else "Unknown"
        primary_hs = hs_codes[0] if hs_codes else "0000.00"
        primary_product = descriptions[0] if descriptions else "goods"
        extra_cost = round(typical_order * 0.25, 2)
        severity = "high" if risk == "high" else ("medium" if risk == "medium" else "low")

        supplier_block = _get_alternative_suppliers(
            db, ctx.get("product_categories", []), countries,
            ctx.get("min_supplier_rating", 3.0), limit=2,
        )
        alt_supplier = "Regional Alternative Supplier"
        alt_country = ctx.get("preferred_alternative_regions", ["Southeast Asia"])[0]
        if supplier_block:
            lines = [l for l in supplier_block.split("\n") if l.startswith("1.")]
            if lines:
                parts = lines[0].split("|")
                if len(parts) >= 2:
                    alt_supplier = parts[0].replace("1.", "").strip()
                    alt_country = parts[1].strip().split(",")[-1].strip()

        agent_outputs = {
            "tariff_monitor": {
                "risk_detected": True,
                "event": f"25% tariff increase on {primary_product} (HS {primary_hs}) from {affected_country}",
                "event_type": "tariff",
                "confidence": 0.91,
                "source": "mock_usitc",
                "affected_countries": countries,
                "affected_hs_codes": hs_codes[:2],
                "risk_source": "mock",
            },
            "impact_calculator": {
                "extra_cost_usd": extra_cost,
                "severity": severity,
                "affected_orders": 1,
                "annual_volume_usd": annual_vol,
                "company": company,
            },
            "alternatives_finder": {
                "options": [{
                    "supplier": alt_supplier,
                    "country": alt_country,
                    "lead_time_weeks": ctx.get("avg_lead_time_days", 30) // 7 + 2,
                    "cost_delta_pct": -8,
                    "source": "global_suppliers_db" if supplier_block else "mock",
                }]
            },
            "import_compliance": {
                alt_country: [
                    "Certificate of Origin",
                    f"Commercial Invoice ({ctx.get('destination_port', 'US port')})",
                    ctx.get("compliance_notes", "Standard customs declaration"),
                ]
            },
            "adversarial": {
                "verdict": "CAUTION" if risk != "low" else "CLEAR",
                "flags": [f"Tariff on {affected_country} sourcing affects {company}'s annual imports"],
                "recommendation": (
                    f"Switch {primary_product} sourcing from {affected_country} to {alt_country} "
                    f"via {alt_supplier}. Expected saving: ${extra_cost:,.0f}."
                ),
            },
        }

        run_id = str(uuid.uuid4())
        self._save_alert(db=db, customer_id=customer_id, agent_outputs=agent_outputs,
                         severity=severity,
                         summary=f"{company}: tariff on {primary_product} from {affected_country} "
                                 f"adds ${extra_cost:,.0f}. Recommended: switch to {alt_country}.",
                         data_source="mock")
        return {"run_id": run_id, "customer_id": customer_id, "alerts_generated": 1, "agent_outputs": agent_outputs}

    # ── Real mode ─────────────────────────────────────────────────────────────

    def _real_run(self, customer_id: int, db: Optional[Session]) -> dict:
        if not HAS_CREWAI:
            raise RuntimeError("CrewAI is not installed.")

        run_id = str(uuid.uuid4())
        pipeline_emit("pipeline_start", f"Pipeline started — run_id={run_id[:8]}… customer={customer_id}")

        # ── 1. Load business profile ──────────────────────────────────────────
        ctx = self._load_profile(customer_id, db)
        company = ctx.get("company_name", f"Customer {customer_id}")
        countries = ctx.get("primary_origin_countries", [])
        hs_codes = ctx.get("primary_hs_codes", [])
        annual_vol = ctx.get("annual_import_volume_usd", 0)
        typical_order = ctx.get("typical_order_value_usd", 50000)
        risk = ctx.get("risk_tolerance", "medium")
        dest_port = ctx.get("destination_port", "US port")
        compliance_notes = ctx.get("compliance_notes", "")
        descriptions = ctx.get("product_descriptions", [])
        alt_regions = ctx.get("preferred_alternative_regions", [])

        pipeline_emit("profile_loaded",
                      f"{company} | HS: {', '.join(hs_codes)} | Origins: {', '.join(countries)} | "
                      f"Vol: ${annual_vol:,.0f}/yr | Port: {dest_port}")

        # ── 2. Create AgentRun row (status=running) ───────────────────────────
        agent_run_obj = None
        if db:
            try:
                from models import AgentRun
                agent_run_obj = AgentRun(
                    run_id=run_id,
                    customer_id=customer_id,
                    started_at=datetime.utcnow(),
                    status="running",
                    model_used=settings.gemini_model,
                )
                db.add(agent_run_obj)
                db.commit()
                pipeline_emit("run_log", f"AgentRun row created — run_id={run_id[:8]}…")
            except Exception as exc:
                logger.warning(f"AgentRun create failed: {exc}")
                db.rollback()

        # ── 3. Fetch RSS → write to Aurora → read back ────────────────────────
        article_blocks, signal_meta = _fetch_and_buffer_articles(
            ctx.get("rss_keywords", []),
            countries,
            run_id=run_id,
            customer_id=customer_id,
            db=db,
        )
        rss_context = "\n\n".join(article_blocks) if article_blocks else "No recent relevant news found."

        # ── 4. Query Aurora for historical context ────────────────────────────
        pipeline_emit("db_query", "Querying Aurora for historical context (impacts, past suppliers, run history)")
        historical_context = _get_historical_impacts(db, customer_id, countries)
        past_suppliers_context = _get_past_supplier_recommendations(db, customer_id)
        run_history_context = _get_agent_run_history(db, customer_id)

        # ── 5. Query global_suppliers for alternatives ────────────────────────
        pipeline_emit("db_query", f"Querying global_suppliers for categories: {', '.join(ctx.get('product_categories', []))}")
        supplier_context = _get_alternative_suppliers(
            db, ctx.get("product_categories", []), countries, ctx.get("min_supplier_rating", 3.0),
        )

        # ── 5b. Fetch compliance + alternatives RSS (both Aurora-buffered) ──────
        compliance_rss_context = _fetch_compliance_articles(
            origin_countries=countries,
            hs_codes=hs_codes,
            dest_port=dest_port,
            run_id=run_id,
            customer_id=customer_id,
            db=db,
        )
        alternatives_rss_context = _fetch_alternatives_articles(
            alternative_regions=ctx.get("preferred_alternative_regions", []),
            product_categories=ctx.get("product_categories", []),
            origin_countries=countries,
            run_id=run_id,
            customer_id=customer_id,
            db=db,
        )

        # ── 6. Build agents ───────────────────────────────────────────────────
        llm = self.llm

        tariff_monitor = Agent(
            role="Tariff Risk Monitor",
            goal=(
                f"Detect tariff changes, port disruptions, and geopolitical events "
                f"affecting {company}, which imports {', '.join(descriptions[:2])} from {', '.join(countries)}."
            ),
            backstory=(
                "You are a senior trade analyst monitoring USITC DataWeb, GDELT, and live RSS feeds. "
                "You specialize in spotting early signals that financially hurt small importers. "
                "You classify each event by type (tariff/port_disruption/geopolitical/supply_shortage), "
                "identify which HS codes are affected, and assess whether the signal came from authoritative "
                "sources (USDA, USTR, CBP) or general news."
            ),
            llm=llm,
            verbose=True,
        )

        impact_calculator = Agent(
            role="Financial Impact Calculator",
            goal=(
                f"Calculate the exact dollar impact of a tariff event on {company}. "
                f"Annual import volume ${annual_vol:,.0f}, typical order ${typical_order:,.0f}. "
                f"Use historical data to calibrate your estimate — don't just do order × rate math."
            ),
            backstory=(
                "You are a financial analyst specializing in SMB import cost modeling. "
                "You calculate extra costs from tariff changes and classify severity: "
                "low (<5%), medium (5-20%), high (>20%), critical (order cannot proceed). "
                "You adjust estimates based on historical patterns for similar events."
            ),
            llm=llm,
            verbose=True,
        )

        alternatives_finder = Agent(
            role="Alternative Supplier Finder",
            goal=(
                f"Find 2-3 backup suppliers for {company} in preferred regions: {', '.join(alt_regions)}. "
                f"Risk tolerance: {risk}. Build on what has been suggested before — don't repeat blocked suppliers."
            ),
            backstory=(
                "You are a global supply chain expert. When a primary supplier is unviable due to tariffs, "
                "you find vetted alternatives with realistic lead times and costs, ranked by best fit. "
                "You check what has been recommended historically and avoid repeating suppliers that "
                "the adversarial agent previously blocked."
            ),
            llm=llm,
            verbose=True,
        )

        import_compliance = Agent(
            role="Import Compliance Specialist",
            goal=(
                f"List exact customs documents required to import via {dest_port}. "
                f"Known requirements for {company}: {compliance_notes}"
            ),
            backstory=(
                "You are a licensed US customs broker with 15 years experience. "
                "You know exactly which certificates, permits, and declarations are needed "
                "per country of origin and product type."
            ),
            llm=llm,
            verbose=True,
        )

        adversarial = Agent(
            role="Risk Challenger",
            goal=(
                f"Challenge every recommendation for {company} (risk tolerance: {risk}). "
                "Flag missed deadlines, unverified suppliers, compliance gaps, and repeat failures. "
                "Use the historical run record to identify patterns — if the same supplier keeps being "
                "blocked, flag it explicitly."
            ),
            backstory=(
                "You are the devil's advocate of the supply chain team. Your job is to find holes in "
                "every recommendation before it reaches the customer. You have access to the full "
                "history of past pipeline runs for this company and use that to issue data-driven verdicts."
            ),
            llm=llm,
            verbose=True,
        )

        # ── 7. Build tasks with enriched prompts ──────────────────────────────
        pipeline_emit("crew_start", "Assembling 5-agent crew with enriched Aurora context")
        pipeline_emit("agent_start", "1/5 · Tariff Risk Monitor — scanning for event type, HS codes, signal source")

        monitor_task = Task(
            description=(
                f"Analyze risk for {company}, a {ctx.get('business_type')} "
                f"importing HS codes {', '.join(hs_codes)} from {', '.join(countries)}.\n\n"
                f"Recent relevant news from Aurora RSS buffer:\n{rss_context}\n\n"
                f"Identify the most significant active risk. Classify the event_type as one of: "
                f"tariff | port_disruption | geopolitical | supply_shortage. "
                f"Identify which HS codes from {hs_codes} are affected. "
                f"Set risk_source to 'rss' if news articles drove the finding, 'gemini_knowledge' otherwise. "
                f"Return valid JSON only."
            ),
            agent=tariff_monitor,
            expected_output=(
                'JSON: {"risk_detected": true, "event": "description", "event_type": "tariff", '
                '"confidence": 0.9, "source": "rss", "affected_countries": ["Colombia"], '
                '"affected_hs_codes": ["0901.11"], "risk_source": "rss"}'
            ),
        )

        impact_task = Task(
            description=(
                f"A risk event was detected affecting {company}.\n"
                f"Profile: annual import ${annual_vol:,.0f}, typical order ${typical_order:,.0f}, "
                f"HS codes: {', '.join(hs_codes)}.\n\n"
                + (f"{historical_context}\n\n" if historical_context else "")
                + f"Using both the company profile and the historical data above, "
                  f"calculate extra_cost_usd, classify severity, and count affected_orders. "
                  f"If historical data shows similar events had higher costs, bias upward. "
                  f"Return valid JSON only."
            ),
            agent=impact_calculator,
            expected_output=(
                'JSON: {"extra_cost_usd": 21250, "severity": "high", "affected_orders": 1, '
                '"company": "Gulf Coast Harvest LLC", "historical_basis": "based on 3 similar past events"}'
            ),
        )

        alternatives_task = Task(
            description=(
                f"Find 2-3 alternative suppliers for {company} to replace sourcing from {', '.join(countries)}.\n"
                f"The ImpactCalculator (previous agent) has quantified the financial cost — use its severity "
                f"to calibrate how urgently a stable, low-risk alternative is needed.\n\n"
                f"LIVE REGIONAL STABILITY NEWS (from MercoPress, Latinvex, FAO, SupplyChainBrain, World Bank):\n"
                + (f"{alternatives_rss_context}\n\n" if alternatives_rss_context else "No regional stability news available.\n\n")
                + f"Use the regional news above to assess current conditions in potential sourcing countries. "
                  f"Prefer countries with positive trade signals (new agreements, stable harvests, port capacity). "
                  f"Flag countries with negative signals (strikes, political unrest, crop failures, new tariffs) — "
                  f"avoid recommending them unless no better option exists.\n\n"
                f"Verified suppliers from CoastGuard global database:\n{supplier_context}\n\n"
                + (f"Previously recommended/blocked suppliers (DO NOT repeat BLOCK or REJECTED entries):\n{past_suppliers_context}\n\n" if past_suppliers_context else "")
                + f"For each option: supplier (name), country, lead_time_weeks (int), "
                  f"cost_delta_pct (signed int), source, and a one-line stability_note based on the news above. "
                  f"Return valid JSON only."
            ),
            agent=alternatives_finder,
            expected_output=(
                'JSON: {"options": [{"supplier": "Name", "country": "Country", '
                '"lead_time_weeks": 4, "cost_delta_pct": -5, "source": "global_suppliers_db", '
                '"stability_note": "Ecuador port expansion ongoing, no active disruptions"}]}'
            ),
        )

        avg_lead_days = ctx.get("avg_lead_time_days", 30)
        min_rating = ctx.get("min_supplier_rating", 3.0)

        compliance_task = Task(
            description=(
                f"You are evaluating alternative supplier options for {company}, which imports "
                f"via {dest_port} with an average lead time of {avg_lead_days} days "
                f"and risk tolerance: {risk}.\n\n"
                f"Known baseline compliance requirements: {compliance_notes}\n\n"
                + (
                    f"LIVE REGULATORY UPDATES (from Federal Register, FDA, USDA APHIS feeds):\n"
                    f"{compliance_rss_context}\n\n"
                    if compliance_rss_context else ""
                )
                + f"Use the live regulatory data above to determine whether import documents "
                  f"for each alternative country are currently achievable or if there are "
                  f"active restrictions, detentions, or new requirements in effect.\n\n"
                  f"Review all alternative suppliers proposed by the previous agent. "
                  f"For each one, assess viability by checking:\n"
                  f"  1. Are required documents achievable given current regulatory notices?\n"
                  f"  2. Are there active FDA import alerts or APHIS holds on this country?\n"
                  f"  3. Does the lead time fit {company}'s {avg_lead_days}-day average?\n"
                  f"  4. Has this supplier or country been previously blocked or flagged?\n"
                  f"  5. Is the cost delta genuinely beneficial vs. the tariff impact?\n\n"
                + (f"Past supplier history for this customer:\n{past_suppliers_context}\n\n" if past_suppliers_context else "")
                + f"Narrow the list down to exactly ONE best option using the above criteria. "
                  f"If no option is viable (active FDA/APHIS holds, all blocked historically, "
                  f"prohibitive compliance, or unacceptable lead times), set no_viable_option to true.\n"
                  f"Return valid JSON only."
            ),
            agent=import_compliance,
            expected_output=(
                'JSON: {'
                '"no_viable_option": false, '
                '"recommended_supplier": "Name", '
                '"recommended_country": "Country", '
                '"lead_time_weeks": 4, '
                '"cost_delta_pct": -5, '
                '"source": "global_suppliers_db", '
                '"compliance_feasibility": "moderate", '
                '"required_documents": ["Certificate of Origin", "Commercial Invoice"], '
                '"rationale": "Selected because lead time fits and no prior blocks", '
                '"risk_factors": ["Phytosanitary cert takes 3 weeks to obtain"]'
                '} OR if no viable option: '
                '{"no_viable_option": true, "reason": "All alternatives previously blocked"}'
            ),
        )

        adversarial_task = Task(
            description=(
                f"You are the final decision agent for {company} (risk tolerance: {risk}, "
                f"avg lead time: {avg_lead_days} days, min supplier rating: {min_rating}).\n\n"
                f"The pipeline has completed. Your job:\n"
                f"  1. Read the ImportCompliance agent's output from the previous step.\n"
                f"  2. If it contains no_viable_option=true, issue BLOCK immediately — "
                f"     no further reasoning needed.\n"
                f"  3. Otherwise, challenge the single recommended supplier by reviewing "
                f"     ALL prior agent outputs (tariff event, financial impact, alternatives "
                f"     considered, compliance selection) and the historical Aurora data below.\n\n"
                f"Challenge these specific dimensions:\n"
                f"  - Is the tariff signal credible? (Check TariffMonitor confidence and risk_source)\n"
                f"  - Does the financial impact justify switching suppliers?\n"
                f"  - Is the recommended supplier genuinely better, or is this a lateral move?\n"
                f"  - Are the risk_factors from compliance actually manageable?\n"
                f"  - Does the run history show a pattern this recommendation repeats?\n\n"
                + (f"Aurora run history for {company}:\n{run_history_context}\n\n" if run_history_context else "")
                + (f"Previously recommended/blocked suppliers:\n{past_suppliers_context}\n\n" if past_suppliers_context else "")
                + f"Issue CLEAR (proceed), CAUTION (proceed with caveats), or BLOCK (do not proceed). "
                  f"This is a recommendation — the user makes the final call. "
                  f"Be specific. Return valid JSON only."
            ),
            agent=adversarial,
            expected_output=(
                'JSON: {"verdict": "CAUTION", '
                '"flags": ["specific weakness in the recommendation"], '
                '"challenged_assumptions": ["assumption the compliance agent made that may be wrong"], '
                '"recommendation": "concrete action ' + company + ' should take", '
                '"confidence": 0.78}'
            ),
        )

        crew = Crew(
            agents=[tariff_monitor, impact_calculator, alternatives_finder, import_compliance, adversarial],
            tasks=[monitor_task, impact_task, alternatives_task, compliance_task, adversarial_task],
            verbose=True,
        )

        try:
            crew.kickoff()
        except Exception as exc:
            logger.error(f"Crew kickoff failed: {exc}")
            pipeline_emit("crew_error", f"Crew failed: {exc}")
            if agent_run_obj and db:
                try:
                    agent_run_obj.status = "failed"
                    agent_run_obj.completed_at = datetime.utcnow()
                    db.commit()
                except Exception:
                    db.rollback()
            raise

        # ── 8. Parse outputs ──────────────────────────────────────────────────
        agent_outputs = {
            "tariff_monitor": _parse_task_output(monitor_task),
            "impact_calculator": _parse_task_output(impact_task),
            "alternatives_finder": _parse_task_output(alternatives_task),
            "import_compliance": _parse_task_output(compliance_task),
            "adversarial": _parse_task_output(adversarial_task),
        }

        tm = agent_outputs.get("tariff_monitor", {})
        ic = agent_outputs.get("impact_calculator", {})
        af = agent_outputs.get("alternatives_finder", {})
        comp = agent_outputs.get("import_compliance", {})
        adv = agent_outputs.get("adversarial", {})

        # Auto-BLOCK if compliance found no viable option
        if comp.get("no_viable_option"):
            adv = {
                "verdict": "BLOCK",
                "flags": [comp.get("reason", "No viable alternative supplier found")],
                "challenged_assumptions": [],
                "recommendation": f"Do not proceed with supplier switch — {comp.get('reason', 'no viable alternative identified')}. Re-evaluate sourcing strategy for {company}.",
                "confidence": 1.0,
                "auto_block": True,
            }
            agent_outputs["adversarial"] = adv
            pipeline_emit("agent_done", f"5/5 · Adversarial → AUTO-BLOCK (no viable option from compliance)")
        else:
            pipeline_emit("agent_done", f"5/5 · Adversarial → verdict={adv.get('verdict')} confidence={adv.get('confidence')} | {str(adv.get('recommendation',''))[:80]}")

        pipeline_emit("agent_done", f"1/5 · TariffMonitor → event_type={tm.get('event_type')} risk={tm.get('risk_detected')} | {str(tm.get('event',''))[:80]}")
        pipeline_emit("agent_done", f"2/5 · ImpactCalculator → cost=${ic.get('extra_cost_usd',0):,} severity={ic.get('severity')}")
        options = af.get("options", [])
        pipeline_emit("agent_done", f"3/5 · AlternativesFinder → {len(options)} candidates: " +
                      ", ".join(f"{o.get('supplier')} ({o.get('country')})" for o in options[:3]))
        if comp.get("no_viable_option"):
            pipeline_emit("agent_done", f"4/5 · ImportCompliance → NO VIABLE OPTION — {comp.get('reason','')[:80]}")
        else:
            pipeline_emit("agent_done",
                f"4/5 · ImportCompliance → selected {comp.get('recommended_supplier')} ({comp.get('recommended_country')}) "
                f"feasibility={comp.get('compliance_feasibility')} | {str(comp.get('rationale',''))[:80]}"
            )

        severity = ic.get("severity", "medium")
        recommendation = adv.get("recommendation", "Review the alert and take action.")
        extra_cost = ic.get("extra_cost_usd", 0)
        adversarial_verdict = adv.get("verdict", "CAUTION")
        event_type = tm.get("event_type", "tariff")
        affected_hs_codes = tm.get("affected_hs_codes", hs_codes)

        primary_country = countries[0] if countries else "Unknown"
        # Use compliance's chosen lead time; fall back to alternatives list
        best_lead = comp.get("lead_time_weeks") or (
            min((o.get("lead_time_weeks") for o in options if o.get("lead_time_weeks")), default=None)
        )

        # ── 9. Write DisruptionEvent (feeds globe visualization) ──────────────
        disruption_event_id = None
        if db:
            try:
                from models import DisruptionEvent
                lat, lon = COUNTRY_COORDS.get(primary_country, (0.0, 0.0))
                incident_id = f"cg-{run_id[:24]}"
                existing_de = db.query(DisruptionEvent).filter(
                    DisruptionEvent.incident_id == incident_id
                ).first()
                if not existing_de:
                    de = DisruptionEvent(
                        incident_id=incident_id,
                        event_type=event_type,
                        title=str(tm.get("event", f"{event_type} event affecting {primary_country}"))[:500],
                        description=str(tm.get("event", ""))[:2000],
                        location_name=primary_country,
                        latitude=lat,
                        longitude=lon,
                        hs_codes=affected_hs_codes,
                        countries_affected=countries,
                        severity=severity,
                        confidence=float(tm.get("confidence", 0.0)),
                        source=str(tm.get("risk_source", "gemini_knowledge")),
                        raw_data={"run_id": run_id, "customer_id": customer_id,
                                  "adversarial_verdict": adversarial_verdict},
                    )
                    db.add(de)
                    db.commit()
                    db.refresh(de)
                    disruption_event_id = de.id
                    pipeline_emit("db_write", f"DisruptionEvent written — {event_type} @ {primary_country} ({lat:.1f}°, {lon:.1f}°)")
                else:
                    disruption_event_id = existing_de.id
            except Exception as exc:
                logger.warning(f"DisruptionEvent write failed: {exc}")
                db.rollback()

        # ── 10. Save TariffAlert (first — so alert_id is available for FKs) ──
        alert_id = self._save_alert(
            db=db,
            customer_id=customer_id,
            agent_outputs=agent_outputs,
            severity=severity,
            summary=f"{company}: {recommendation} (est. impact: ${extra_cost:,.0f})",
            data_source="gemini",
            disruption_event_id=disruption_event_id,
        )

        # ── 11. Write per-agent AgentRunLog rows ─────────────────────────────
        if db:
            try:
                from models import AgentRunLog
                per_agent = [
                    ("tariff_monitor",    monitor_task.description,      agent_outputs["tariff_monitor"]),
                    ("impact_calculator", impact_task.description,        agent_outputs["impact_calculator"]),
                    ("alternatives_finder", alternatives_task.description, agent_outputs["alternatives_finder"]),
                    ("import_compliance", compliance_task.description,    agent_outputs["import_compliance"]),
                    ("adversarial",       adversarial_task.description,   agent_outputs["adversarial"]),
                ]
                for agent_name, input_ctx, output in per_agent:
                    db.add(AgentRunLog(
                        run_id=run_id,
                        customer_id=customer_id,
                        agent_name=agent_name,
                        input_context=(input_ctx or "")[:5000],
                        output_json=json.dumps(output),
                        ran_at=datetime.utcnow(),
                        tariff_alert_id=alert_id,
                    ))
                db.commit()
                pipeline_emit("run_log", f"AgentRunLog: 5 per-agent rows written (alert_id={alert_id})")
            except Exception as exc:
                logger.warning(f"AgentRunLog write failed: {exc}")
                db.rollback()

        # ── 12. Write HistoricalImpact ────────────────────────────────────────
        if db:
            try:
                from models import HistoricalImpact
                hi = HistoricalImpact(
                    event_type=event_type,
                    country=primary_country,
                    product=", ".join(descriptions[:2]) if descriptions else None,
                    actual_loss=float(extra_cost) if extra_cost else 0.0,
                    delay_days=None,
                    confidence=float(tm.get("confidence", 0.0)),
                    event_text=str(tm.get("event", ""))[:2000],
                    run_id=run_id,
                    customer_id=customer_id,
                    alert_id=alert_id,
                    severity=severity,
                    adversarial_verdict=adversarial_verdict,
                    affected_hs_codes=affected_hs_codes,
                    affected_countries=countries,
                    articles_matched=signal_meta.get("articles_matched", 0),
                    source_credibility=signal_meta.get("source_credibility", ""),
                    signal_age_hours=signal_meta.get("signal_age_hours"),
                    risk_source=signal_meta.get("risk_source", "gemini_knowledge"),
                    supplier_alternatives_found=len(options),
                    best_alternative_lead_time_weeks=best_lead,
                )
                db.add(hi)
                db.commit()
                pipeline_emit("db_write", f"HistoricalImpact written — cost=${extra_cost:,} verdict={adversarial_verdict} alert_id={alert_id}")
            except Exception as exc:
                logger.warning(f"HistoricalImpact write failed: {exc}")
                db.rollback()

        # ── 13. Write SupplierRecommendations ─────────────────────────────────
        # Write the compliance-chosen supplier (if any) with the final adversarial verdict.
        # Also write rejected alternatives with verdict="REJECTED_BY_COMPLIANCE" so future
        # runs know these were considered and dropped.
        if db:
            try:
                from models import SupplierRecommendation
                rows_written = 0

                # Compliance-chosen supplier
                if not comp.get("no_viable_option") and comp.get("recommended_supplier"):
                    db.add(SupplierRecommendation(
                        alert_id=alert_id,
                        customer_id=customer_id,
                        run_id=run_id,
                        supplier_name=str(comp.get("recommended_supplier", "Unknown"))[:255],
                        country=str(comp.get("recommended_country", "Unknown"))[:100],
                        lead_time_weeks=comp.get("lead_time_weeks"),
                        cost_delta_pct=comp.get("cost_delta_pct"),
                        source=str(comp.get("source", ""))[:100],
                        adversarial_verdict=adversarial_verdict,
                    ))
                    rows_written += 1

                # Alternatives that compliance rejected (for future AlternativesFinder context)
                chosen_name = (comp.get("recommended_supplier") or "").lower()
                for opt in options:
                    if str(opt.get("supplier", "")).lower() == chosen_name:
                        continue  # already written above
                    db.add(SupplierRecommendation(
                        alert_id=alert_id,
                        customer_id=customer_id,
                        run_id=run_id,
                        supplier_name=str(opt.get("supplier", "Unknown"))[:255],
                        country=str(opt.get("country", "Unknown"))[:100],
                        lead_time_weeks=opt.get("lead_time_weeks"),
                        cost_delta_pct=opt.get("cost_delta_pct"),
                        source=str(opt.get("source", ""))[:100],
                        adversarial_verdict="REJECTED_BY_COMPLIANCE",
                    ))
                    rows_written += 1

                db.commit()
                pipeline_emit("db_write", f"SupplierRecommendations written — {rows_written} rows (1 chosen + {rows_written-1} rejected), alert_id={alert_id}")
            except Exception as exc:
                logger.warning(f"SupplierRecommendation write failed: {exc}")
                db.rollback()

        # ── 14. Update AgentRun to completed ─────────────────────────────────
        if agent_run_obj and db:
            try:
                agent_run_obj.status = "completed"
                agent_run_obj.completed_at = datetime.utcnow()
                agent_run_obj.articles_matched = signal_meta.get("articles_matched", 0)
                agent_run_obj.alerts_generated = 1
                agent_run_obj.adversarial_verdict = adversarial_verdict
                agent_run_obj.severity = severity
                agent_run_obj.extra_cost_usd = float(extra_cost) if extra_cost else None
                agent_run_obj.event_type = event_type
                agent_run_obj.affected_countries = countries
                db.commit()
                pipeline_emit("run_log", f"AgentRun updated — completed, verdict={adversarial_verdict}")
            except Exception as exc:
                logger.warning(f"AgentRun update failed: {exc}")
                db.rollback()

        # ── 15. Delete RSS buffer rows ────────────────────────────────────────
        if db:
            try:
                from models import RssArticle
                deleted = db.query(RssArticle).filter(RssArticle.run_id == run_id).delete()
                db.commit()
                pipeline_emit("rss_cleared", f"Deleted {deleted} rss_articles rows from Aurora buffer")
            except Exception as exc:
                logger.warning(f"RSS buffer cleanup failed: {exc}")
                db.rollback()

        pipeline_emit("pipeline_done", f"Pipeline complete — severity={severity} cost=${extra_cost:,} verdict={adversarial_verdict}")

        return {
            "run_id": run_id,
            "customer_id": customer_id,
            "alerts_generated": 1,
            "agent_outputs": agent_outputs,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _save_alert(
        db: Optional[Session],
        customer_id: int,
        agent_outputs: dict,
        severity: str,
        summary: str,
        data_source: str,
        disruption_event_id: Optional[int] = None,
    ) -> Optional[int]:
        """Save TariffAlert and return its id (used as FK by AgentRunLog, HistoricalImpact, SupplierRecommendation)."""
        if db is None:
            return None
        try:
            from models import TariffAlert
            alert = TariffAlert(
                customer_id=customer_id,
                alert_type="tariff_change",
                severity=severity,
                summary=summary,
                agent_output=json.dumps(agent_outputs),
                data_source=data_source,
                status="active",
                disruption_event_id=disruption_event_id,
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            logger.info(f"TariffAlert id={alert.id} saved (severity={severity})")
            _enforce_alert_cap(db, customer_id)
            return alert.id
        except Exception as exc:
            logger.error(f"Failed to save TariffAlert: {exc}")
            if db:
                db.rollback()
            return None


def _parse_task_output(task) -> dict:
    try:
        raw = task.output.raw if (hasattr(task, "output") and task.output) else ""
        return json.loads(raw)
    except Exception:
        pass
    try:
        raw = task.output.raw if (hasattr(task, "output") and task.output) else ""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {"raw": str(getattr(getattr(task, "output", None), "raw", ""))}
