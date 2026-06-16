"""
CoastGuard Supply Chain Monitor — FastAPI Application
"""

import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import Base, engine
from config import get_settings
from api.v2.demo_routes import router as demo_router
from api.v2.supplier_routes import router as supplier_router
from api.v2.alert_routes import router as alert_router
from api.v2.monitor_routes import router as monitor_router
from api.v2.disruption_routes import router as disruption_router
from api.v2.geo_routes import router as geo_router

settings = get_settings()

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

# Import models so SQLAlchemy registers them before create_all
import models  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CoastGuard Supply Chain Monitor",
    description=(
        "AI-powered supply chain monitoring co-pilot for SMB importers. "
        "Watches tariff changes, geopolitical events, and port disruptions, "
        "then fires a 5-agent pipeline to calculate impact and recommend action."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(demo_router)
app.include_router(supplier_router)
app.include_router(alert_router)
app.include_router(monitor_router)
app.include_router(disruption_router)
app.include_router(geo_router)


# ── Article cache refresh ─────────────────────────────────────────────────────

def _run_rss_scrape() -> None:
    """Scrape all RSS feeds and populate the in-memory article cache."""
    try:
        from collectors.monitor import scrape_rss_feeds
        from core import article_cache
        logger.info("Starting RSS feed scrape...")
        articles = scrape_rss_feeds()
        article_cache.refresh(articles)
        logger.info("Article cache populated — %d articles", len(articles))
    except Exception as exc:
        logger.error("RSS scrape failed: %s", exc)


@app.on_event("startup")
def _on_startup():
    from core.scheduler import start_scheduler
    start_scheduler()

    # Scrape RSS feeds in a background thread so the server is immediately
    # ready to accept requests. /monitor/run calls that arrive before the
    # scrape finishes fall back to the in-memory cache (empty → JSONL datasets).
    threading.Thread(target=_run_rss_scrape, daemon=True, name="rss-startup-scrape").start()


@app.on_event("shutdown")
def _on_shutdown():
    from core.scheduler import stop_scheduler
    stop_scheduler()


# ── Manual cache refresh endpoint ─────────────────────────────────────────────

@app.post("/api/v2/monitor/collect", tags=["Monitor"])
def refresh_article_cache():
    """
    Trigger a fresh scrape of all configured RSS feeds and replace the
    in-memory article cache. Called by the "Refresh News" button in the UI.
    Runs synchronously (blocks until complete, typically 20-40 seconds).
    """
    from collectors.monitor import scrape_rss_feeds
    from core import article_cache
    articles = scrape_rss_feeds()
    article_cache.refresh(articles)
    return {
        "status": "ok",
        "articles_collected": len(articles),
        "last_scraped": article_cache.get_last_scraped(),
    }


# ── Health checks ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def health_check():
    from core import article_cache
    return JSONResponse({
        "status": "ok",
        "app": "CoastGuard Supply Chain Monitor",
        "version": "0.1.0",
        "mock_mode": settings.use_mock_llm,
        "database": settings.database_url,
        "article_cache": article_cache.status(),
    })


@app.get("/api/health", tags=["Health"])
async def api_health():
    from database import check_db_connection
    from core import article_cache
    db_status = check_db_connection()
    return {
        "status": "ok",
        "mock_llm": settings.use_mock_llm,
        "mock_data": settings.use_mock_data,
        "gemini_key_set": bool(settings.gemini_api_key),
        "usitc_key_set": bool(settings.usitc_api_key),
        "database": db_status,
        "article_cache": article_cache.status(),
    }
