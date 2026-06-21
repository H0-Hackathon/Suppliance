"""
CoastGuard Supply Chain Monitor — FastAPI Application
"""

import logging
import threading
from contextlib import asynccontextmanager

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
from api.v2.news_routes import router as news_router
from api.v2.settings_routes import router as settings_router

settings = get_settings()

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

# Quiet noisy third-party loggers — they spam at INFO but carry no useful signal
for _noisy in ("sqlalchemy.engine", "sqlalchemy.pool", "sqlalchemy.dialects",
               "httpx", "httpcore", "google_genai", "google.auth",
               "crewai", "crewai.crew", "crewai.agent", "crewai.task",
               "opentelemetry", "litellm"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

import models  # noqa: F401 — registers all models with SQLAlchemy before create_all

Base.metadata.create_all(bind=engine)

# ── Startup pipeline status (polled by frontend loading screen) ───────────────
startup_pipeline_status = {
    "running": False,
    "completed": 0,
    "total": 3,
    "errors": [],
}

STARTUP_PIPELINE_RUNS = 0


def _run_startup_pipelines_thread():
    """
    Run STARTUP_PIPELINE_RUNS pipeline runs for the active customer in a background
    daemon thread. Daemon=True means this thread is killed cleanly when the server exits.
    Using a thread (not asyncio task) keeps pipeline failures fully isolated from
    the uvicorn event loop — a crash here cannot bring down the server.
    """
    global startup_pipeline_status
    startup_pipeline_status["running"] = True
    startup_pipeline_status["completed"] = 0
    startup_pipeline_status["errors"] = []

    from database import SessionLocal
    from core.crew_orchestrator import CrewAIOrchestrator
    from core.crew_monitor_pipeline import clear_pipeline_log

    clear_pipeline_log()
    customer_id = settings.active_customer_id
    orchestrator = CrewAIOrchestrator()

    for i in range(STARTUP_PIPELINE_RUNS):
        db = SessionLocal()
        try:
            logger.info(f"Startup pipeline run {i + 1}/{STARTUP_PIPELINE_RUNS} for customer {customer_id}")
            orchestrator.run_monitor(customer_id=customer_id, db=db)
            startup_pipeline_status["completed"] += 1
            logger.info(f"Startup pipeline run {i + 1} complete")
        except BaseException as exc:
            # Catch BaseException (including SystemExit from CrewAI internals)
            # so a pipeline failure never propagates to the main thread
            logger.error(f"Startup pipeline run {i + 1} failed: {exc}")
            startup_pipeline_status["errors"].append(str(exc))
            startup_pipeline_status["completed"] += 1
        finally:
            try:
                db.close()
            except Exception:
                pass

    startup_pipeline_status["running"] = False
    logger.info("All startup pipeline runs finished.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start pipelines in an isolated daemon thread — server stays up regardless of outcome
    t = threading.Thread(target=_run_startup_pipelines_thread, daemon=True, name="startup-pipelines")
    t.start()
    yield
    # Server is shutting down — daemon thread is killed automatically


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CoastGuard Supply Chain Monitor",
    description=(
        "AI-powered supply chain monitoring co-pilot for SMB importers. "
        "Watches tariff changes, geopolitical events, and port disruptions, "
        "then fires a 5-agent pipeline to calculate impact and recommend action."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.v2.demo_routes import router as demo_router
from api.v2.supplier_routes import router as supplier_router
from api.v2.alert_routes import router as alert_router
from api.v2.monitor_routes import router as monitor_router
from api.v2.global_supplier_routes import router as global_supplier_router
from api.v2.auth_routes import router as auth_router
from api.v2.payment_routes import router as payment_router

app.include_router(demo_router)
app.include_router(supplier_router)
app.include_router(alert_router)
app.include_router(monitor_router)
app.include_router(disruption_router)
app.include_router(geo_router)
app.include_router(news_router)
app.include_router(global_supplier_router)
<<<<<<< HEAD
app.include_router(auth_router)
app.include_router(payment_router)
=======
app.include_router(settings_router)
>>>>>>> 0a8b967f792f8ea25c1aca56f1b1d7abdae410f5


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
    # DISABLED for memory limits: threading.Thread(target=_run_rss_scrape, daemon=True, name="rss-startup-scrape").start()

    # Warm the news-ticker cache in the background so the first /api/v2/news
    # request is instant.
    from services import news_feed
    threading.Thread(target=news_feed.prefetch, daemon=True, name="news-prefetch").start()


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
        "active_customer_id": settings.active_customer_id,
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
        "active_customer_id": settings.active_customer_id,
        "gemini_key_set": bool(settings.gemini_api_key),
        "database": db_status,
        "article_cache": article_cache.status(),
        "startup_pipelines": startup_pipeline_status,
    }
