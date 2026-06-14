"""
CoastGuard — Monitor pipeline routes.

Endpoints:
  POST /api/v2/monitor/run     trigger the 5-agent pipeline for a customer + HS code
  GET  /api/v2/monitor/health  pipeline health and mock mode status
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas import MonitorRunRequest, MonitorRunResponse
from core.crew_orchestrator import CrewAIOrchestrator
from config import get_settings

router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(payload: MonitorRunRequest, db: Session = Depends(get_db)):
    """
    Trigger the 5-agent tariff monitoring pipeline.

    The pipeline (MonitorPipeline._save_results) already saves both the
    TariffAlert and its linked DisruptionEvent — this route just forwards
    the request and returns the agent outputs. (Do NOT also create a
    TariffAlert here — that used to double-save every alert.)
    """
    orchestrator = CrewAIOrchestrator()
    result = orchestrator.run_monitor(
        customer_id=payload.customer_id,
        hs_code=payload.hs_code,
        supplier_country=payload.supplier_country,
        db=db,
    )

    return MonitorRunResponse(
        run_id=result["run_id"],
        customer_id=payload.customer_id,
        alerts_generated=result["alerts_generated"],
        agent_outputs=result.get("agent_outputs", {}),
    )


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
