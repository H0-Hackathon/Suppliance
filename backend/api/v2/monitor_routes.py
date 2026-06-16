"""
CoastGuard — Monitor pipeline routes.

Endpoints:
  POST /api/v2/monitor/run      trigger the 5-agent pipeline for a customer + HS code
  GET  /api/v2/monitor/targets  (supplier_country, hs_code) combos to scan for a customer
  GET  /api/v2/monitor/health   pipeline health and mock mode status

Article collection flow (Task 1):
  Each /monitor/run call reads from the in-memory article cache (populated
  at server startup by collectors/monitor.scrape_rss_feeds) and supplements
  it with a single targeted Google News RSS query for the supplier's country.
  The combined, deduplicated list is passed as `articles` to the pipeline so
  Agent 1 (monitor_agent.get_latest_event) works from live data, not stale
  JSONL files.
"""

import json
import logging
import queue as stdlib_queue
import threading

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import models
from database import get_db, SessionLocal
from schemas import MonitorRunRequest, MonitorRunResponse
from core.crew_orchestrator import CrewAIOrchestrator
from core import article_cache
from services.coordinates import get_country_code, get_country_name
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()

# Maps a Supplier.product_category (free-text, set at onboarding) to the HS
# chapter (first 2 digits) it corresponds to, so /monitor/targets can pick
# the BusinessProfile.primary_hs_codes entry that's actually relevant to
# that supplier rather than scanning every HS code for every country.
PRODUCT_CATEGORY_TO_HS2 = {
    "textiles": "61",
    "apparel": "61",
    "automotive": "87",
    "electronics": "84",
}


def _hs_code_for_supplier(product_category: str | None, primary_hs_codes: list[str]) -> str | None:
    if not primary_hs_codes:
        return None

    hs2 = PRODUCT_CATEGORY_TO_HS2.get((product_category or "").strip().lower())
    if hs2:
        for code in primary_hs_codes:
            if code.startswith(hs2):
                return code

    return primary_hs_codes[0]


def _collect_articles_for_target(supplier_country: str) -> list[dict]:
    """
    Build the article list for one /monitor/run call:
      1. Broad supply-chain news from the in-memory cache (startup-scraped RSS feeds).
      2. A targeted Google News query for this supplier's country (~2-5s, 6 articles max).
    Returns a deduplicated merged list.
    """
    from services.coordinates import get_country_name as _cn

    country_name = _cn(supplier_country) or supplier_country
    cached = article_cache.get_articles()

    # Targeted Google News query is best-effort: it needs network access and a
    # collector helper that may not be present. Any failure (ImportError,
    # network, parse) must not abort the run — Agent 1 still works from the
    # in-memory cache or the bundled JSONL datasets.
    targeted: list[dict] = []
    try:
        from collectors.tariff import query_country_news
        targeted = query_country_news(country_name, max_results=6)
    except Exception as exc:
        logger.warning("Targeted Google News query unavailable for %s: %s", country_name, exc)
        targeted = []

    # Dedup by URL — prefer targeted articles (more specific) first
    seen_urls: set[str] = set()
    merged: list[dict] = []
    for article in targeted + cached:
        url = article.get("url") or article.get("source_url", "")
        if url and url in seen_urls:
            continue
        seen_urls.add(url)
        merged.append(article)

    logger.info(
        "Articles for %s: %d cached + %d targeted = %d merged",
        country_name, len(cached), len(targeted), len(merged),
    )
    return merged


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(payload: MonitorRunRequest, db: Session = Depends(get_db)):
    """
    Trigger the 5-agent tariff monitoring pipeline.

    Collects fresh articles (cache + targeted query) for the supplier country
    and passes them to the pipeline so Agent 1 works from live data.

    The pipeline (MonitorPipeline._save_results) already saves both the
    TariffAlert and its linked DisruptionEvent — this route just forwards
    the request and returns the agent outputs. (Do NOT also create a
    TariffAlert here — that used to double-save every alert.)
    """
    articles = _collect_articles_for_target(payload.supplier_country)

    orchestrator = CrewAIOrchestrator()
    result = orchestrator.run_monitor(
        customer_id=payload.customer_id,
        hs_code=payload.hs_code,
        supplier_country=payload.supplier_country,
        db=db,
        articles=articles,
    )

    return MonitorRunResponse(
        run_id=result["run_id"],
        customer_id=payload.customer_id,
        alerts_generated=result["alerts_generated"],
        agent_outputs=result.get("agent_outputs", {}),
    )


@router.get("/stream")
def stream_monitor(
    customer_id: int,
    hs_code: str,
    supplier_country: str,
):
    """
    SSE endpoint for real-time agent progress during a monitor run.

    Emits Server-Sent Events as each agent completes:
      {"type": "agent_start", "agent": "tariff_monitor"}
      {"type": "agent_done",  "agent": "tariff_monitor", "output": {...}}
      {"type": "log",         "text": "CrewAI verbose output..."}
      {"type": "done",        "run_id": "...", "agent_outputs": {...}}
      {"type": "error",       "message": "..."}

    The frontend connects with EventSource and updates the Agent Debug panel
    in real time as each of the 5 agents completes.
    """
    progress_queue: stdlib_queue.Queue = stdlib_queue.Queue()

    def run_in_thread():
        thread_db = SessionLocal()
        try:
            progress_queue.put({"type": "log", "text": f"Collecting articles for {supplier_country} from RSS cache + Google News..."})
            articles = _collect_articles_for_target(supplier_country)
            progress_queue.put({"type": "log", "text": f"Collected {len(articles)} article(s) — sending to pipeline"})
            if not articles:
                progress_queue.put({"type": "log", "text": "WARNING: article cache empty, falling back to JSONL dataset"})
            orchestrator = CrewAIOrchestrator()
            orchestrator.run_monitor(
                customer_id=customer_id,
                hs_code=hs_code,
                supplier_country=supplier_country,
                db=thread_db,
                articles=articles,
                progress_queue=progress_queue,
            )
        except Exception as exc:
            logger.error("stream_monitor thread failed: %s", exc)
            progress_queue.put({"type": "error", "message": str(exc)})
        finally:
            thread_db.close()
            progress_queue.put(None)  # sentinel — tells the generator to stop

    thread = threading.Thread(target=run_in_thread, daemon=True)
    thread.start()

    def event_stream():
        while True:
            try:
                event = progress_queue.get(timeout=120)
            except stdlib_queue.Empty:
                yield "data: {\"type\": \"heartbeat\"}\n\n"
                continue
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/targets")
def get_monitor_targets(customer_id: int, db: Session = Depends(get_db)):
    """
    The (supplier_country, hs_code) combinations "Run Monitor" should scan
    for this customer — one per active supplier, derived from
    BusinessProfile.primary_hs_codes + each Supplier's country/product
    category. Falls back to a single Vietnam/cotton-tee target if the
    customer has no BusinessProfile or no suppliers on file yet.
    """
    profile = (
        db.query(models.BusinessProfile)
        .filter(models.BusinessProfile.customer_id == customer_id)
        .first()
    )
    primary_hs_codes = (profile.primary_hs_codes if profile else None) or ["6109.10"]

    suppliers = (
        db.query(models.Supplier)
        .filter(models.Supplier.customer_id == customer_id, models.Supplier.is_active == True)  # noqa: E712
        .all()
    )

    targets = []
    seen = set()

    for supplier in suppliers:
        country_code = get_country_code(supplier.country) or supplier.country
        hs_code = _hs_code_for_supplier(supplier.product_category, primary_hs_codes)
        if not hs_code:
            continue

        key = (country_code, hs_code)
        if key in seen:
            continue
        seen.add(key)

        targets.append({
            "supplier_country": country_code,
            "country_name": get_country_name(country_code),
            "hs_code": hs_code,
            "supplier_name": supplier.name,
            "product_category": supplier.product_category,
        })

    if not targets:
        targets.append({
            "supplier_country": "VN",
            "country_name": "Vietnam",
            "hs_code": "6109.10",
            "supplier_name": None,
            "product_category": None,
        })

    return targets


@router.get("/health")
def monitor_health():
    """Returns mock mode status and which API keys are configured."""
    return {
        "status": "ok",
        "mock_mode": settings.use_mock_llm,
        "gemini_key_set": bool(settings.gemini_api_key),
        "usitc_key_set": bool(settings.usitc_api_key),
        "gdelt_key_set": bool(settings.gdelt_api_key),
    }
