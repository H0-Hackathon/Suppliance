"""
CoastGuard Supply Chain Monitor — FastAPI Application
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import Base, engine
from config import get_settings
from api.v2.demo_routes import router as demo_router
from api.v2.supplier_routes import router as supplier_router
from api.v2.alert_routes import router as alert_router
from api.v2.monitor_routes import router as monitor_router
<<<<<<< Updated upstream
=======
from api.v2.disruption_routes import router as disruption_router
from api.v2.geo_routes import router as geo_router
from api.v2.news_routes import router as news_router
from api.v2.global_supplier_routes import router as global_supplier_router
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
=======
app.include_router(disruption_router)
app.include_router(geo_router)
app.include_router(news_router)
app.include_router(global_supplier_router)
>>>>>>> Stashed changes


@app.get("/", tags=["Health"])
async def health_check():
    return JSONResponse({
        "status": "ok",
        "app": "CoastGuard Supply Chain Monitor",
        "version": "0.1.0",
        "mock_mode": settings.use_mock_llm,
        "database": settings.database_url,
    })


@app.get("/api/health", tags=["Health"])
async def api_health():
    from database import check_db_connection
    db_status = check_db_connection()
    return {
        "status": "ok",
        "mock_llm": settings.use_mock_llm,
        "mock_data": settings.use_mock_data,
        "gemini_key_set": bool(settings.gemini_api_key),
        "usitc_key_set": bool(settings.usitc_api_key),
        "database": db_status,
    }
